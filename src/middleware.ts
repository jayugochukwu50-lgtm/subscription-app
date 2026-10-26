import { timingSafeEqual } from "node:crypto";
import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";

export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) return res.status(500).json({ error: "Server not configured" });
  const given = Buffer.from(req.header("x-admin-key") ?? "");
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !timingSafeEqual(given, wanted)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: "Route not found" });
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err?.message?.includes("UNIQUE constraint failed")) {
    return res.status(409).json({ error: "Email already exists" });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
}
