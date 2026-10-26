import { DatabaseSync } from "node:sqlite";

export const db = new DatabaseSync(process.env.DB_PATH ?? "app.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price_kobo INTEGER NOT NULL,
    interval TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL DEFAULT 'pending'
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    reference TEXT NOT NULL UNIQUE,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    plan_id INTEGER NOT NULL REFERENCES plans(id),
    amount_kobo INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`);

const count = db.prepare("SELECT COUNT(*) AS n FROM plans").get() as { n: number };
if (count.n === 0) {
  const insert = db.prepare(
    "INSERT INTO plans (name, price_kobo, interval) VALUES (?, ?, ?)"
  );
  insert.run("Basic", 500000, "monthly");
  insert.run("Pro", 1500000, "monthly");
  insert.run("Premium", 4000000, "monthly");
}
