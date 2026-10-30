import type { Request } from "express";
import { Router } from "express";
import { requireBusinessManager, requireBusinessMember } from "../auth/middleware";
import { badRequest } from "../errors";
import { purchaseService } from "../services/purchaseService";

// Mounted at /businesses/:businessId
export const purchasesRouter = Router({ mergeParams: true });

const businessId = (req: Request) => req.params.businessId;

purchasesRouter.get("/purchases", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await purchaseService.list(req.params.businessId, limit));
  } catch (err) {
    next(err);
  }
});

purchasesRouter.get("/purchases/overview", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await purchaseService.overview(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

// purchases_insert_member in 0003_rls.sql: any member may record a purchase.
purchasesRouter.post("/purchases", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    await purchaseService.create(req.params.businessId, req.userId ?? null, req.body ?? {});
    res.status(201).end();
  } catch (err) {
    next(err);
  }
});

// purchases_update_member: unlike sales, any member may flip a purchase's status.
purchasesRouter.patch("/purchases/:id/status", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const { status } = req.body ?? {};
    if (!status) throw badRequest("A status is required.");
    await purchaseService.setStatus(req.params.businessId, req.params.id, status, req.userId ?? null);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// purchases_delete_manager: managers only.
purchasesRouter.delete("/purchases/:id", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    await purchaseService.remove(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
