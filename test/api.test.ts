import { test } from "node:test";
import assert from "node:assert/strict";
import { useServer, adminHeaders } from "./helpers.js";

const server = useServer();

type Stats = {
  activeSubscriptions: number;
  pendingTransactions: number;
  revenueKobo: number;
};

async function getStats() {
  const res = await server.get("/api/admin/stats", adminHeaders);
  return (await res.json()) as Stats;
}

test("health check responds ok", async () => {
  const res = await server.get("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("lists the three seeded plans", async () => {
  const plans = (await (await server.get("/api/plans")).json()) as { name: string }[];
  assert.deepEqual(
    plans.map((p) => p.name),
    ["Basic", "Pro", "Premium"]
  );
});

test("rejects an invalid email with a 400", async () => {
  const res = await server.post("/api/customers", { name: "Bo", email: "notanemail" });
  assert.equal(res.status, 400);
  const body = (await res.json()) as { details: { field: string }[] };
  assert.equal(body.details[0].field, "email");
});

test("rejects a missing name with a 400", async () => {
  const res = await server.post("/api/customers", { email: "x@test.com" });
  assert.equal(res.status, 400);
});

test("creates a customer, then rejects a duplicate email with a 409", async () => {
  const first = await server.post("/api/customers", { name: "Ada", email: "ada@test.com" });
  assert.equal(first.status, 201);
  const second = await server.post("/api/customers", { name: "Ada", email: "ada@test.com" });
  assert.equal(second.status, 409);
});

test("unknown routes return a 404", async () => {
  const res = await server.get("/nothing");
  assert.equal(res.status, 404);
});

test("admin routes reject requests with no key or a wrong key", async () => {
  for (const path of ["/api/admin/stats", "/api/admin/transactions", "/api/customers"]) {
    const none = await server.get(path);
    assert.equal(none.status, 401, path + " without key");
    const wrong = await server.get(path, { "x-admin-key": "nope" });
    assert.equal(wrong.status, 401, path + " with wrong key");
  }
});

test("simulated payments require the admin key", async () => {
  const res = await server.post("/api/dev/simulate-payment/anything", {});
  assert.equal(res.status, 401);
});

test("subscribing validates input and checks the customer and plan exist", async () => {
  const bad = await server.post("/api/subscriptions", { customerId: "one" });
  assert.equal(bad.status, 400);
  const missing = await server.post("/api/subscriptions", { customerId: 9999, planId: 2 });
  assert.equal(missing.status, 404);
});

test("full payment flow activates the subscription exactly once", async () => {
  const statsBefore = await getStats();

  const customer = (await (
    await server.post("/api/customers", { name: "Flow Tester", email: "flow@test.com" })
  ).json()) as { id: number };

  const sub = await server.post("/api/subscriptions", { customerId: customer.id, planId: 2 });
  assert.equal(sub.status, 201);
  const { reference, amount_kobo } = (await sub.json()) as {
    reference: string;
    amount_kobo: number;
  };
  assert.equal(amount_kobo, 1500000);

  const pay = () => server.post("/api/dev/simulate-payment/" + reference, {}, adminHeaders);

  const first = await pay();
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { outcome: "paid" });

  const second = await pay();
  assert.deepEqual(await second.json(), { outcome: "already_paid" });

  const statsAfter = await getStats();
  assert.equal(statsAfter.activeSubscriptions, statsBefore.activeSubscriptions + 1);
  assert.equal(statsAfter.revenueKobo, statsBefore.revenueKobo + 1500000);
  assert.equal(statsAfter.pendingTransactions, statsBefore.pendingTransactions);
});
