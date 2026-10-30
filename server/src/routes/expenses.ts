import type { Request } from "express";
import { Router } from "express";
import { requireBusinessManager, requireBusinessMember } from "../auth/middleware";
import { expenseService } from "../services/expenseService";

// Mounted at /businesses/:businessId
export const expensesRouter = Router({ mergeParams: true });

const businessId = (req: Request) => req.params.businessId;

expensesRouter.get("/expenses", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    res.json(await expenseService.list(req.params.businessId, limit));
  } catch (err) {
    next(err);
  }
});

expensesRouter.get("/expenses/overview", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await expenseService.overview(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

// expenses_insert_member: any member.
expensesRouter.post("/expenses", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    await expenseService.create(req.params.businessId, req.userId ?? null, req.body ?? {});
    res.status(201).end();
  } catch (err) {
    next(err);
  }
});

// expenses_delete_manager: managers only.
expensesRouter.delete("/expenses/:id", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    await expenseService.remove(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
