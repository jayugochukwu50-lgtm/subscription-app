import { Router } from "express";
import { db } from "./db.js";
import { validate } from "./middleware.js";
import { subscribeSchema } from "./schemas.js";
import { createSubscription, markTransactionPaid } from "./subscriptions.js";

export const api = Router();

api.post("/subscriptions", validate(subscribeSchema), (req, res) => {
  const result = createSubscription(req.body.customerId, req.body.planId);
  if (!result) return res.status(404).json({ error: "Customer or plan not found" });
  res.status(201).json(result);
});

// Temporary: stands in for Paystack until we integrate it
api.post("/dev/simulate-payment/:reference", (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(404).json({ error: "Route not found" });
  }
  const outcome = markTransactionPaid(String(req.params.reference));
  if (outcome === "not_found") return res.status(404).json({ error: "Transaction not found" });
  res.json({ outcome });
});

api.get("/admin/stats", (_req, res) => {
  const one = (sql: string) => db.prepare(sql).get() as { n: number };
  res.json({
    customers: one("SELECT COUNT(*) AS n FROM customers").n,
    activeSubscriptions: one("SELECT COUNT(*) AS n FROM subscriptions WHERE status = 'active'").n,
    pendingTransactions: one("SELECT COUNT(*) AS n FROM transactions WHERE status = 'pending'").n,
    revenueKobo: one("SELECT COALESCE(SUM(amount_kobo), 0) AS n FROM transactions WHERE status = 'success'").n,
  });
});

api.get("/admin/transactions", (_req, res) => {
  res.json(
    db.prepare(
      `SELECT t.id, t.reference, t.amount_kobo, t.status, t.created_at,
              c.name AS customer, c.email, p.name AS plan
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
       JOIN plans p ON p.id = t.plan_id
       ORDER BY t.id DESC`
    ).all()
  );
});
