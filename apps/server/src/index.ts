import bcrypt from "bcryptjs";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { Prisma } from "@assetpulse/db";
import { config } from "./config.js";
import { allowRoles, authenticate, prisma, validate } from "./middleware.js";
import {
  assetCreateSchema,
  checkoutSchema,
  assetListQuerySchema,
  idParamSchema,
  inventoryCreateSchema,
  inventoryListQuerySchema,
  loginSchema,
  stockAdjustmentSchema,
  userCreateSchema,
} from "./schemas.js";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
const allowedOrigins = new Set([
  config.CLIENT_ORIGIN,
  ...(config.CODESPACE_NAME ? [`https://${config.CODESPACE_NAME}-3000.app.github.dev`] : []),
]);
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "32kb" }));

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: "draft-7", legacyHeaders: false });
const managers = allowRoles("ADMIN", "MANAGER");
const admins = allowRoles("ADMIN");

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/api/auth/login", loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign({ role: user.role }, config.JWT_SECRET, { subject: user.id, expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"] });
    res.json({ token, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } });
  } catch (error) { next(error); }
});

app.use("/api", authenticate);

app.get("/api/me", async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { id: true, email: true, firstName: true, lastName: true, role: true } });
    res.json({ user });
  } catch (error) { next(error); }
});

app.get("/api/users", async (_req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });
    res.json({ users });
  } catch (error) { next(error); }
});

app.post("/api/users", admins, validate(userCreateSchema), async (req, res, next) => {
  try {
    const body = req.body as ReturnType<typeof userCreateSchema.parse>;
    const user = await prisma.$transaction(async (tx) => {
      const { password, ...userData } = body;
      const created = await tx.user.create({
        data: { ...userData, passwordHash: await bcrypt.hash(password, 12) },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, isActive: true, createdAt: true },
      });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: "USER_CREATED", entityType: "USER", entityId: created.id, ipAddress: req.ip, details: { role: created.role } } });
      return created;
    });
    res.status(201).json({ user });
  } catch (error) { next(error); }
});

app.get("/api/catalog", async (_req, res, next) => {
  try {
    const [categories, locations] = await Promise.all([
      prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.location.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    ]);
    res.json({ categories, locations });
  } catch (error) { next(error); }
});

app.get("/api/dashboard", async (_req, res, next) => {
  try {
    const [assets, inventoryStats, assetCount, retiredCount, assignedCount] = await Promise.all([
      prisma.asset.aggregate({ _sum: { purchasePrice: true }, _count: { _all: true } }),
      prisma.$queryRaw<{ inventoryValue: Prisma.Decimal; lowStockAlerts: number }[]>`
        SELECT COALESCE(SUM("quantity" * "unitPrice"), 0)::numeric AS "inventoryValue",
          COUNT(*) FILTER (WHERE "quantity" <= "minThreshold")::int AS "lowStockAlerts"
        FROM "InventoryItem"
      `,
      prisma.asset.count(),
      prisma.asset.count({ where: { status: "RETIRED" } }),
      prisma.asset.count({ where: { status: "ASSIGNED" } }),
    ]);
    const { inventoryValue, lowStockAlerts } = inventoryStats[0]!;
    res.json({
      totalValuation: Number(assets._sum.purchasePrice ?? 0) + Number(inventoryValue),
      activeUnits: assetCount - retiredCount,
      assignedUnits: assignedCount,
      lowStockAlerts,
      trackedAssets: assets._count._all,
    });
  } catch (error) { next(error); }
});

app.get("/api/assets", validate(assetListQuerySchema, "query"), async (req, res, next) => {
  try {
    const { page, limit, categoryId, locationId, q, sort, order } = req.query as unknown as ReturnType<typeof assetListQuerySchema.parse>;
    const where: Prisma.AssetWhereInput = {
      ...(categoryId ? { categoryId } : {}),
      ...(locationId ? { locationId } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }, { serialNumber: { contains: q, mode: "insensitive" } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.asset.findMany({ where, include: { category: true, location: true, assignments: { where: { returnedAt: null }, include: { user: { select: { firstName: true, lastName: true } } } }, }, orderBy: { [sort]: order }, skip: (page - 1) * limit, take: limit }),
      prisma.asset.count({ where }),
    ]);
    res.json({ items, page, limit, total });
  } catch (error) { next(error); }
});

app.post("/api/assets", managers, validate(assetCreateSchema), async (req, res, next) => {
  try {
    const body = req.body as ReturnType<typeof assetCreateSchema.parse>;
    const item = await prisma.$transaction(async (tx) => {
      const { userId, ...assetData } = body;
      if (userId) {
        const assignee = await tx.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
        if (!assignee) throw Object.assign(new Error("Active user not found"), { status: 404 });
      }
      const created = await tx.asset.create({ data: { ...assetData, purchasePrice: body.purchasePrice === undefined ? undefined : new Prisma.Decimal(body.purchasePrice) } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, assetId: created.id, action: "ASSET_CREATED", entityType: "ASSET", entityId: created.id, ipAddress: req.ip, details: { sku: created.sku } } });
      if (userId) {
        await tx.asset.update({ where: { id: created.id }, data: { status: "ASSIGNED" } });
        await tx.assetAssignment.create({ data: { assetId: created.id, userId } });
        await tx.auditLog.create({ data: { userId: req.auth!.userId, assetId: created.id, action: "CHECK_OUT", entityType: "ASSET", entityId: created.id, ipAddress: req.ip, details: { assigneeId: userId } } });
        return tx.asset.findUniqueOrThrow({ where: { id: created.id } });
      }
      return created;
    });
    res.status(201).json({ item });
  } catch (error) { next(error); }
});

app.post("/api/assets/:id/checkout", validate(idParamSchema, "params"), validate(checkoutSchema), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as ReturnType<typeof idParamSchema.parse>;
    const { userId, notes } = req.body as ReturnType<typeof checkoutSchema.parse>;
    const assignment = await prisma.$transaction(async (tx) => {
      const assignee = await tx.user.findFirst({ where: { id: userId, isActive: true }, select: { id: true } });
      if (!assignee) throw Object.assign(new Error("Active user not found"), { status: 404 });
      const claimed = await tx.asset.updateMany({ where: { id, status: "AVAILABLE" }, data: { status: "ASSIGNED" } });
      if (claimed.count !== 1) throw Object.assign(new Error("Asset is not available"), { status: 409 });
      const record = await tx.assetAssignment.create({ data: { assetId: id, userId, notes } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, assetId: id, action: "CHECK_OUT", entityType: "ASSET", entityId: id, ipAddress: req.ip, details: { assigneeId: userId } } });
      return record;
    });
    res.status(201).json({ assignment });
  } catch (error) { next(error); }
});

app.post("/api/assets/:id/return", validate(idParamSchema, "params"), managers, async (req, res, next) => {
  try {
    const { id } = req.params as unknown as ReturnType<typeof idParamSchema.parse>;
    const result = await prisma.$transaction(async (tx) => {
      const released = await tx.asset.updateMany({ where: { id, status: "ASSIGNED" }, data: { status: "AVAILABLE" } });
      if (released.count !== 1) throw Object.assign(new Error("No active assignment found"), { status: 409 });
      const returned = await tx.assetAssignment.updateMany({ where: { assetId: id, returnedAt: null }, data: { returnedAt: new Date() } });
      if (returned.count !== 1) throw Object.assign(new Error("No active assignment found"), { status: 409 });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, assetId: id, action: "CHECK_IN", entityType: "ASSET", entityId: id, ipAddress: req.ip } });
      return tx.assetAssignment.findFirst({ where: { assetId: id, returnedAt: { not: null } }, orderBy: { returnedAt: "desc" } });
    });
    res.json({ assignment: result });
  } catch (error) { next(error); }
});

app.get("/api/inventory", validate(inventoryListQuerySchema, "query"), async (req, res, next) => {
  try {
    const { page, limit, categoryId, locationId, q, sort, order } = req.query as unknown as ReturnType<typeof inventoryListQuerySchema.parse>;
    const where: Prisma.InventoryItemWhereInput = {
      ...(categoryId ? { categoryId } : {}), ...(locationId ? { locationId } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { sku: { contains: q, mode: "insensitive" } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.inventoryItem.findMany({ where, include: { category: true, location: true }, orderBy: { [sort]: order }, skip: (page - 1) * limit, take: limit }),
      prisma.inventoryItem.count({ where }),
    ]);
    res.json({ items, page, limit, total });
  } catch (error) { next(error); }
});

app.post("/api/inventory", managers, validate(inventoryCreateSchema), async (req, res, next) => {
  try {
    const body = req.body as ReturnType<typeof inventoryCreateSchema.parse>;
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({ data: { ...body, unitPrice: new Prisma.Decimal(body.unitPrice) } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: "STOCK_CREATED", entityType: "INVENTORY", entityId: created.id, ipAddress: req.ip, details: { sku: created.sku, quantity: created.quantity } } });
      return created;
    });
    res.status(201).json({ item });
  } catch (error) { next(error); }
});

app.post("/api/inventory/:id/adjust", managers, validate(idParamSchema, "params"), validate(stockAdjustmentSchema), async (req, res, next) => {
  try {
    const { id } = req.params as unknown as ReturnType<typeof idParamSchema.parse>;
    const { delta, notes } = req.body as ReturnType<typeof stockAdjustmentSchema.parse>;
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.inventoryItem.findUnique({ where: { id } });
      if (!existing) throw Object.assign(new Error("Inventory item not found"), { status: 404 });
      const conditions: Prisma.InventoryItemWhereInput = delta > 0
        ? { id, quantity: { lte: 2147483647 - delta } }
        : { id, quantity: { gte: -delta } };
      const changed = await tx.inventoryItem.updateMany({ where: conditions, data: { quantity: { increment: delta } } });
      if (changed.count !== 1) throw Object.assign(new Error("Stock cannot become negative or exceed the supported limit"), { status: 409 });
      const updated = await tx.inventoryItem.findUniqueOrThrow({ where: { id } });
      await tx.auditLog.create({ data: { userId: req.auth!.userId, action: delta > 0 ? "STOCK_RESTOCK" : "STOCK_WITHDRAWAL", entityType: "INVENTORY", entityId: id, ipAddress: req.ip, details: { delta, previousQuantity: existing.quantity, quantity: updated.quantity, notes } } });
      return updated;
    });
    res.json({ item });
  } catch (error) { next(error); }
});

app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
    ? 409
    : typeof error === "object" && error !== null && "status" in error ? Number(error.status) : 500;
  if (status >= 500) console.error(error);
  res.status(status).json({ error: status >= 500 ? "Internal server error" : status === 409 && error instanceof Prisma.PrismaClientKnownRequestError ? "A record with that unique value already exists" : error instanceof Error ? error.message : "Request failed" });
});

const server = app.listen(config.PORT, () => console.info(`AssetPulse API listening on ${config.PORT}`));
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => void prisma.$disconnect().finally(() => process.exit(0))));
}