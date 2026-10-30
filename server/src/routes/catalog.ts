import type { Request } from "express";
import { Router } from "express";
import { requireBusinessManager, requireBusinessMember } from "../auth/middleware";
import * as catalogService from "../services/catalogService";

// Mounted at /businesses/:businessId — mergeParams so req.params.businessId
// is visible here.
export const catalogRouter = Router({ mergeParams: true });

const businessId = (req: Request) => req.params.businessId;

catalogRouter.get("/categories", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await catalogService.categoryService.list(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

// categories_write_manager in 0003_rls.sql: managers only.
catalogRouter.post("/categories", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    const { name, description } = req.body ?? {};
    const category = await catalogService.categoryService.create(req.params.businessId, name, description);
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

catalogRouter.delete("/categories/:id", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    await catalogService.categoryService.remove(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

catalogRouter.get("/suppliers", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await catalogService.supplierService.list(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

// suppliers_write_manager: managers only.
catalogRouter.post("/suppliers", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    const supplier = await catalogService.supplierService.create(req.params.businessId, req.body ?? {});
    res.status(201).json(supplier);
  } catch (err) {
    next(err);
  }
});

catalogRouter.patch("/suppliers/:id", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    const supplier = await catalogService.supplierService.update(req.params.businessId, req.params.id, req.body ?? {});
    res.json(supplier);
  } catch (err) {
    next(err);
  }
});

catalogRouter.delete("/suppliers/:id", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    await catalogService.supplierService.remove(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
