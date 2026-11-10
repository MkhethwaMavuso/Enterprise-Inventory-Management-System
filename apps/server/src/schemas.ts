import { z } from "zod";

const uuid = z.string().uuid();
const positiveMoney = z.coerce.number().finite().min(0).max(99999999.99);

export const loginSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const userCreateSchema = z.object({
  email: z.string().email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  role: z.enum(["ADMIN", "MANAGER", "STAFF", "EXECUTIVE"]),
});

const paginationQuery = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  categoryId: uuid.optional(),
  locationId: uuid.optional(),
  q: z.string().trim().max(100).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
};

export const assetListQuerySchema = z.object({ ...paginationQuery, sort: z.enum(["name", "sku", "createdAt", "status"]).default("createdAt") });
export const inventoryListQuerySchema = z.object({ ...paginationQuery, sort: z.enum(["name", "sku", "createdAt", "quantity"]).default("createdAt") });

export const assetCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  serialNumber: z.string().trim().min(1).max(120),
  categoryId: uuid,
  locationId: uuid,
  userId: uuid.optional(),
  purchaseDate: z.coerce.date().optional(),
  purchasePrice: positiveMoney.optional(),
});

export const checkoutSchema = z.object({
  userId: uuid,
  notes: z.string().trim().max(1000).optional(),
});

export const inventoryCreateSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(0).max(100000000).default(0),
  minThreshold: z.number().int().min(0).max(100000000).default(5),
  unitPrice: positiveMoney,
  categoryId: uuid,
  locationId: uuid,
});

export const stockAdjustmentSchema = z.object({
  delta: z.number().int().min(-100000000).max(100000000).refine((value) => value !== 0),
  notes: z.string().trim().max(1000).optional(),
});

export const idParamSchema = z.object({ id: uuid });