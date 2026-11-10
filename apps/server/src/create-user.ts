import bcrypt from "bcryptjs";
import { PrismaClient, type UserRole } from "@assetpulse/db";

const options = Object.fromEntries(process.argv.slice(2).reduce<string[][]>((args, value) => {
  if (value.startsWith("--")) args.push([value.slice(2)]);
  else if (args.length) args[args.length - 1]!.push(value);
  return args;
}, []).map(([key, ...values]) => [key, values.join(" ")]));

const required = ["email", "password", "first-name", "last-name", "role"];
const missing = required.filter((key) => !options[key]);
if (missing.length) throw new Error(`Missing arguments: ${missing.map((key) => `--${key}`).join(", ")}`);
if (!/^(ADMIN|MANAGER|STAFF|EXECUTIVE)$/.test(options.role)) throw new Error("Role must be ADMIN, MANAGER, STAFF, or EXECUTIVE");

const prisma = new PrismaClient();
try {
  const user = await prisma.$transaction(async (tx) => {
    await tx.category.upsert({ where: { name: "General" }, update: {}, create: { name: "General", description: "General equipment and supplies" } });
    await tx.location.upsert({ where: { name: "Main Office" }, update: {}, create: { name: "Main Office" } });
    const created = await tx.user.create({
      data: {
        email: options.email.toLowerCase(),
        passwordHash: await bcrypt.hash(options.password, 12),
        firstName: options["first-name"],
        lastName: options["last-name"],
        role: options.role as UserRole,
      },
      select: { id: true, email: true, role: true },
    });
    await tx.auditLog.create({ data: { userId: created.id, action: "USER_CREATED", entityType: "USER", entityId: created.id } });
    return created;
  });
  console.info(`Created ${user.role} user ${user.email} (${user.id})`);
} finally {
  await prisma.$disconnect();
}