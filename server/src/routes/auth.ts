import { Router } from "express";
import * as authService from "../auth/authService";
import { authenticate } from "../auth/middleware";
import { badRequest } from "../errors";
import { db } from "../db";

export const authRouter = Router();

authRouter.post("/signup", async (req, res, next) => {
  try {
    const { email, password, fullName, phone, businessName } = req.body ?? {};
    const session = await authService.signUp({ email, password, fullName, phone, businessName });
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) throw badRequest("Email and password are required.");
    const session = await authService.signIn(email, password);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/refresh", async (req, res, next) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) throw badRequest("refreshToken is required.");
    const session = await authService.refresh(refreshToken);
    res.json(session);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const { refreshToken } = req.body ?? {};
    if (refreshToken) await authService.signOut(refreshToken);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const profile = await db("profiles").where({ id: req.userId }).first();
    const businesses = await db("business_users")
      .join("businesses", "businesses.id", "business_users.business_id")
      .where("business_users.user_id", req.userId)
      .select("businesses.*", "business_users.role as membershipRole")
      .orderBy("businesses.name");

    res.json({ profile, businesses });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/businesses", authenticate, async (req, res, next) => {
  try {
    const { name } = req.body ?? {};
    if (!name) throw badRequest("A business name is required.");
    const businessId = await authService.createBusinessWithOwner(req.userId!, name);
    res.status(201).json({ businessId });
  } catch (err) {
    next(err);
  }
});
