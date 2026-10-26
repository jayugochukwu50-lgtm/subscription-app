import { randomUUID } from "node:crypto";
import { db } from "./db.js";

export function createSubscription(customerId: number, planId: number) {
  const customer = db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
  const plan = db
    .prepare("SELECT id, price_kobo FROM plans WHERE id = ?")
    .get(planId) as { id: number; price_kobo: number } | undefined;
  if (!customer || !plan) return null;

  const reference = "sub_" + randomUUID();
  db.prepare("INSERT INTO subscriptions (customer_id, plan_id) VALUES (?, ?)").run(customerId, planId);
  db.prepare(
    "INSERT INTO transactions (reference, customer_id, plan_id, amount_kobo) VALUES (?, ?, ?, ?)"
  ).run(reference, customerId, planId, plan.price_kobo);

  return { reference, amount_kobo: plan.price_kobo };
}

export function markTransactionPaid(reference: string) {
  const tx = db
    .prepare("SELECT * FROM transactions WHERE reference = ?")
    .get(reference) as any;
  if (!tx) return "not_found";
  if (tx.status === "success") return "already_paid";

  db.prepare("UPDATE transactions SET status = 'success' WHERE reference = ?").run(reference);
  db.prepare(
    `UPDATE subscriptions SET status = 'active' WHERE id = (
       SELECT id FROM subscriptions
       WHERE customer_id = ? AND plan_id = ? AND status = 'pending'
       ORDER BY id DESC LIMIT 1)`
  ).run(tx.customer_id, tx.plan_id);
  return "paid";
}
