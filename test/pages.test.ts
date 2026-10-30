import { test } from "node:test";
import assert from "node:assert/strict";
import { useServer } from "./helpers.js";

const server = useServer();

test("home page is served at /", async () => {
  const res = await server.get("/");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Simple plans/);
});

test("admin dashboard is served at /admin", async () => {
  const res = await server.get("/admin");
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Admin sign in/);
});
