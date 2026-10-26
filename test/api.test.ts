import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import { app } from "../src/app.js";

let server: Server;
let base: string;
const adminHeaders = { "x-admin-key": "test-key" };

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const { port } = server.address() as { port: number };
  base = `http://127.0.0.1:${port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function getStats() {
  const res = await fetch(base + "/api/admin/stats", { headers: adminHeaders });
  return (await res.json()) as any;
}

test("health check responds ok", async () => {
  const res = await fetch(base + "/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: "ok" });
});

test("lists the three seeded plans", async () => {
  const plans = (await (await fetch(base + "/api/plans")).json()) as any[];
  assert.deepEqual(plans.map((p) => p.name), ["Basic", "Pro", "Premium"]);
});

test("rejects an invalid email with a 400", async () => {
  const res = await post("/api/customers", { name: "Bo", email: "notanemail" });
  assert.equal(res.status, 400);
  const body = (await res.json()) as any;
  assert.equal(body.details[0].field, "email");
});

test("rejects a missing name with a 400", async () => {
  const res = await post("/api/customers", { email: "x@test.com" });
  assert.equal(res.status, 400);
});

test("creates a customer, then rejects a duplicate email with a 409", async () => {
  const first = await post("/api/customers", { name: "Ada", email: "ada@test.com" });
  assert.equal(first.status, 201);
  const second = await post("/api/customers", { name: "Ada", email: "ada@test.com" });
  assert.equal(second.status, 409);
});

test("unknown routes return a 404", async () => {
  const res = await fetch(base + "/nothing");
  assert.equal(res.status, 404);
});

test("admin routes reject requests with no key or a wrong key", async () => {
  for (const path of ["/api/admin/stats", "/api/admin/transactions", "/api/customers"]) {
    const none = await fetch(base + path);
    assert.equal(none.status, 401, path + " without key");
    const wrong = await fetch(base + path, { headers: { "x-admin-key": "nope" } });
    assert.equal(wrong.status, 401, path + " with wrong key");
  }
});

test("simulated payments require the admin key", async () => {
  const res = await post("/api/dev/simulate-payment/anything", {});
  assert.equal(res.status, 401);
});

test("subscribing validates input and checks the customer and plan exist", async () => {
  const bad = await post("/api/subscriptions", { customerId: "one" });
  assert.equal(bad.status, 400);
  const missing = await post("/api/subscriptions", { customerId: 9999, planId: 2 });
  assert.equal(missing.status, 404);
});

test("full payment flow activates the subscription exactly once", async () => {
  const statsBefore = await getStats();

  const customer = (await (
    await post("/api/customers", { name: "Flow Tester", email: "flow@test.com" })
  ).json()) as any;

  const sub = await post("/api/subscriptions", { customerId: customer.id, planId: 2 });
  assert.equal(sub.status, 201);
  const { reference, amount_kobo } = (await sub.json()) as any;
  assert.equal(amount_kobo, 1500000);

  const pay = () => post("/api/dev/simulate-payment/" + reference, {}, adminHeaders);

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
