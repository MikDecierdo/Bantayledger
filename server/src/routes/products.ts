import type { Request } from "express";
import { Router } from "express";
import { requireBusinessManager, requireBusinessMember } from "../auth/middleware";
import { badRequest } from "../errors";
import { productService } from "../services/productService";

// Mounted at /businesses/:businessId
export const productsRouter = Router({ mergeParams: true });

const businessId = (req: Request) => req.params.businessId;

productsRouter.get("/products", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await productService.list(req.params.businessId));
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/products/:id", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    res.json(await productService.get(req.params.businessId, req.params.id));
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/products/:id/stock-movement", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined;
    res.json(await productService.stockMovement(req.params.businessId, req.params.id, days));
  } catch (err) {
    next(err);
  }
});

productsRouter.get("/products/:id/unit-sales", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : undefined;
    res.json(await productService.unitSales(req.params.businessId, req.params.id, days));
  } catch (err) {
    next(err);
  }
});

// products_write_manager: managers only.
productsRouter.post("/products", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    const product = await productService.create(req.params.businessId, req.userId!, req.body ?? {});
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

productsRouter.patch("/products/:id", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    const product = await productService.update(req.params.businessId, req.params.id, req.body ?? {});
    res.json(product);
  } catch (err) {
    next(err);
  }
});

productsRouter.delete("/products/:id", requireBusinessManager(businessId), async (req, res, next) => {
  try {
    await productService.remove(req.params.businessId, req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// adjust_stock in Postgres only required membership, not manager — any
// staff member can record a correction, same as recording a sale.
productsRouter.post("/products/:id/adjust-stock", requireBusinessMember(businessId), async (req, res, next) => {
  try {
    const { quantity, notes } = req.body ?? {};
    if (typeof quantity !== "number") throw badRequest("A numeric quantity is required.");
    await productService.adjustStock(req.params.businessId, req.userId!, req.params.id, quantity, notes);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
