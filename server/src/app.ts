import cors from "cors";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { authenticate } from "./auth/middleware";
import { db } from "./db";
import { ApiError } from "./errors";
import { businessRouter, profileRouter } from "./routes/account";
import { authRouter } from "./routes/auth";
import { catalogRouter } from "./routes/catalog";
import { expensesRouter } from "./routes/expenses";
import { productsRouter } from "./routes/products";
import { purchasesRouter } from "./routes/purchases";
import { salesRouter } from "./routes/sales";
import { signalsRouter } from "./routes/signals";
import { wasteRouter } from "./routes/waste";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", async (_req, res) => {
  try {
    await db.raw("select 1");
    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ status: "error", message: (err as Error).message });
  }
});

app.use("/auth", authRouter);
app.use(profileRouter);

// Every business-scoped route requires a valid access token; the specific
// member/manager check happens per-route in the routers themselves.
app.use(
  "/businesses/:businessId",
  authenticate,
  businessRouter,
  catalogRouter,
  productsRouter,
  salesRouter,
  purchasesRouter,
  expensesRouter,
  wasteRouter,
  signalsRouter,
);

// Central error handler: every route forwards failures via next(err) rather
// than formatting its own response, so ApiError -> HTTP status stays
// consistent in one place.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ApiError) {
    res.status(err.status).json({ message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ message: "Something went wrong. Please try again." });
});
