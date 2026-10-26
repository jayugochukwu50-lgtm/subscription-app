import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { db } from "./db.js";
import { validate, notFound, errorHandler } from "./middleware.js";
import { customerSchema } from "./schemas.js";
import { api } from "./routes.js";

const app = express();
app.use(helmet());
app.use(express.json({ limit: "10kb" }));
app.use("/api", rateLimit({ windowMs: 60_000, limit: 100 }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/plans", (_req, res) => {
  res.json(db.prepare("SELECT * FROM plans").all());
});

app.post("/api/customers", validate(customerSchema), (req, res) => {
  const { name, email } = req.body;
  const result = db
    .prepare("INSERT INTO customers (name, email) VALUES (?, ?)")
    .run(name, email);
  res.status(201).json({ id: Number(result.lastInsertRowid), name, email });
});

app.get("/api/customers", (_req, res) => {
  res.json(db.prepare("SELECT * FROM customers").all());
});

app.use("/api", api);
app.use(notFound);
app.use(errorHandler);

const PORT = 3000;
app.listen(PORT, () => console.log(`Running on ${PORT}`));
