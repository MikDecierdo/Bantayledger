import type { Request } from "express";
import { Router } from "express";
import { requireBusinessManager, requireBusinessMember } from "../auth/middleware";
import { salesService } from "../services/salesService";

// Mounted at /businesses/:businessId
export const salesRouter = Router({ mergeParams: true });

const businessId = (req: Request) => req.params.businessId;

salesRouter.get("/sales", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await salesService.list(req.params.businessId, limit));
  } catch (err) {
    next(err);
  }
});

salesRouter.get("/sales/overview", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await salesService.overview(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

// sales_insert_member in 0003_rls.sql: any member may record a sale.
salesRouter.post("/sales", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const sale = await salesService.create(req.params.businessId, req.userId ?? null, req.body ?? {});
    res.status(201).json(sale);
  } catch (err) {
    next(err);
  }
});

// sales_delete_manager: deleting rewrites stock history, managers only.
salesRouter.delete("/sales/:id", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    await salesService.remove(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
