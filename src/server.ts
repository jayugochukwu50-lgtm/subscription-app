import express from "express";
import { db } from "./db.js";

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/plans", (_req, res) => {
  const plans = db.prepare("SELECT * FROM plans").all();
  res.json(plans);
});

app.post("/api/customers", (req, res) => {
  const { name, email } = req.body;
  const result = db
    .prepare("INSERT INTO customers (name, email) VALUES (?, ?)")
    .run(name, email);
  res.status(201).json({ id: result.lastInsertRowid, name, email });
});

app.get("/api/customers", (_req, res) => {
  const customers = db.prepare("SELECT * FROM customers").all();
  res.json(customers);
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
