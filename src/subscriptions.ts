import { randomUUID } from "node:crypto";
import { db } from "./db.js";

type PlanRow = { id: number; price_kobo: number };
type TransactionRow = { customer_id: number; plan_id: number; status: string };

export type PaymentOutcome = "paid" | "already_paid" | "not_found";

// Runs several writes as one unit: either all succeed or none are saved.
function inTransaction<T>(work: () => T): T {
  db.exec("BEGIN");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/**
 * Creates a pending subscription and a pending transaction for a customer.
 * The price always comes from the plans table, never from the client.
 * Returns null if the customer or plan does not exist.
 */
export function createSubscription(customerId: number, planId: number) {
  const customer = db.prepare("SELECT id FROM customers WHERE id = ?").get(customerId);
  const plan = db
    .prepare("SELECT id, price_kobo FROM plans WHERE id = ?")
    .get(planId) as PlanRow | undefined;
  if (!customer || !plan) return null;

  const reference = "sub_" + randomUUID();

  inTransaction(() => {
    db.prepare("INSERT INTO subscriptions (customer_id, plan_id) VALUES (?, ?)").run(
      customerId,
      planId
    );
    db.prepare(
      "INSERT INTO transactions (reference, customer_id, plan_id, amount_kobo) VALUES (?, ?, ?, ?)"
    ).run(reference, customerId, planId, plan.price_kobo);
  });

  return { reference, amount_kobo: plan.price_kobo };
}

/**
 * Marks a transaction as paid and activates the matching subscription.
 *
 * This is idempotent: Paystack can notify us twice (the browser callback and
 * the webhook), and a retry must never count revenue twice. A second call for
 * an already-paid reference does nothing and returns "already_paid".
 */
export function markTransactionPaid(reference: string): PaymentOutcome {
  const tx = db
    .prepare("SELECT customer_id, plan_id, status FROM transactions WHERE reference = ?")
    .get(reference) as TransactionRow | undefined;
  if (!tx) return "not_found";
  if (tx.status === "success") return "already_paid";

  inTransaction(() => {
    db.prepare("UPDATE transactions SET status = 'success' WHERE reference = ?").run(reference);

    // Transactions are not linked to a subscription id, so we activate the
    // customer's most recent pending subscription for this plan.
    db.prepare(
      `UPDATE subscriptions SET status = 'active' WHERE id = (
         SELECT id FROM subscriptions
         WHERE customer_id = ? AND plan_id = ? AND status = 'pending'
         ORDER BY id DESC LIMIT 1)`
    ).run(tx.customer_id, tx.plan_id);
  });

  return "paid";
}
