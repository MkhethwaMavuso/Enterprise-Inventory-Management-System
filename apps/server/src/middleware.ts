import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient, type UserRole } from "@assetpulse/db";
import { config } from "./config.js";

export const prisma = new PrismaClient();

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string; role: UserRole };
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const claims = jwt.verify(token, config.JWT_SECRET) as jwt.JwtPayload;
    if (typeof claims.sub !== "string") throw new Error("Invalid token subject");
    void prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, role: true, isActive: true },
    }).then((user) => {
      if (!user?.isActive) return res.status(401).json({ error: "Account is unavailable" });
      req.auth = { userId: user.id, role: user.role };
      next();
    }).catch(next);
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function allowRoles(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
}

export function validate<T>(schema: { parse: (value: unknown) => T }, source: "body" | "query" | "params" = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req[source] = schema.parse(req[source]) as never;
      next();
    } catch (error) {
      res.status(400).json({ error: "Invalid request", details: error instanceof Error ? error.message : "Validation failed" });
    }
  };
}