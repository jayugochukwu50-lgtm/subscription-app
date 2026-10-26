import { z } from "zod";

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

export const subscribeSchema = z.object({
  customerId: z.number({ error: "customerId is required" }).int().positive(),
  planId: z.number({ error: "planId is required" }).int().positive(),
});
