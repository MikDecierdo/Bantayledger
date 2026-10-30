import type { Request } from "express";
import { Router } from "express";
import { requireBusinessMember } from "../auth/middleware";
import { alertService, forecastService, recommendationService } from "../services/signalService";

// Mounted at /businesses/:businessId
export const signalsRouter = Router({ mergeParams: true });

const businessId = (req: Request) => req.params.businessId;

signalsRouter.get("/alerts", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await alertService.list(req.params.businessId, limit));
  } catch (err) {
    next(err);
  }
});

signalsRouter.get("/alerts/counts", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await alertService.counts(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

// alerts_update_member in 0003_rls.sql: any member may mark alerts read.
signalsRouter.post("/alerts/:id/read", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    await alertService.markRead(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

signalsRouter.post("/alerts/read-all", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    await alertService.markAllRead(req.params.businessId);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

signalsRouter.delete("/alerts/:id", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    await alertService.remove(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

signalsRouter.get("/insights", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await recommendationService.list(req.params.businessId, limit));
  } catch (err) {
    next(err);
  }
});

signalsRouter.post("/insights/:id/read", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    await recommendationService.markRead(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

signalsRouter.get("/forecasts", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const [demand, price, cost] = await Promise.all([
      forecastService.demand(req.params.businessId),
      forecastService.price(req.params.businessId),
      forecastService.cost(req.params.businessId),
    ]);
    res.json({ demand, price, cost });
  } catch (err) {
    next(err);
  }
});
