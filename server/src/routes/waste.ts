import type { Request } from "express";
import { Router } from "express";
import { requireBusinessManager, requireBusinessMember } from "../auth/middleware";
import { wasteService } from "../services/wasteService";

// Mounted at /businesses/:businessId
export const wasteRouter = Router({ mergeParams: true });

const businessId = (req: Request) => req.params.businessId;

wasteRouter.get("/waste", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await wasteService.list(req.params.businessId, limit));
  } catch (err) {
    next(err);
  }
});

wasteRouter.get("/waste/overview", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await wasteService.overview(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

// waste_records_insert_member: any member.
wasteRouter.post("/waste", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    await wasteService.create(req.params.businessId, req.userId ?? null, req.body ?? {});
    res.status(201).end();
  } catch (err) {
    next(err);
  }
});

// waste_records_delete_manager: managers only.
wasteRouter.delete("/waste/:id", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    await wasteService.remove(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
