import type { Request } from "express";
import { Router } from "express";
import { authenticate, requireBusinessManager, requireBusinessMember } from "../auth/middleware";
import { badRequest } from "../errors";
import { businessService, profileService } from "../services/accountService";

// Self-service profile routes — not business-scoped.
export const profileRouter = Router();

profileRouter.get("/profile", authenticate, async (req, res, next) => {
  try {
    res.json(await profileService.get(req.userId!));
  } catch (err) {
    next(err);
  }
});

profileRouter.patch("/profile", authenticate, async (req, res, next) => {
  try {
    res.json(await profileService.update(req.userId!, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

// Mounted at /businesses/:businessId
export const businessRouter = Router({ mergeParams: true });

const businessId = (req: Request) => req.params.businessId;

businessRouter.get("/", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await businessService.get(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

// businesses_update_manager: managers only.
businessRouter.patch("/", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    res.json(await businessService.update(req.params.businessId, req.body ?? {}));
  } catch (err) {
    next(err);
  }
});

businessRouter.get("/members", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await businessService.members(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

// business_users_update_manager: managers only.
businessRouter.patch("/members/:userId/role", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    const { role } = req.body ?? {};
    if (!role) throw badRequest("A role is required.");
    await businessService.setRole(req.params.businessId, req.params.userId, role);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// business_users_delete_manager: managers only.
businessRouter.delete("/members/:userId", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    await businessService.removeMember(req.params.businessId, req.params.userId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
