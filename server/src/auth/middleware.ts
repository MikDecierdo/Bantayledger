import type { NextFunction, Request, Response } from "express";
import { db } from "../db";
import { forbidden, unauthorized } from "../errors";
import { verifyAccessToken } from "./tokens";

/**
 * Replaces Supabase RLS. Every route in this API must call `authenticate`
 * and then one of `requireBusinessMember`/`requireBusinessManager` before
 * touching business-scoped data — there is no automatic boundary here the
 * way `0003_rls.sql` gave Postgres. See the migration plan's "Authorization"
 * section for why this lives in middleware rather than per-route ad hoc
 * checks: it keeps one auditable place per role tier, mirroring
 * user_is_business_member/user_is_business_manager from
 * supabase/migrations/0002_functions_triggers.sql.
 */

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

  if (!token) {
    next(unauthorized());
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch {
    next(unauthorized("Your session has expired. Please sign in again."));
  }
}

async function roleFor(userId: string, businessId: string): Promise<string | undefined> {
  const row = await db("business_users").where({ user_id: userId, business_id: businessId }).first("role");
  return row?.role;
}

/** Any member — mirrors user_is_business_member(). */
export function requireBusinessMember(getBusinessId: (req: Request) => string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userId) {
      next(unauthorized());
      return;
    }
    const role = await roleFor(req.userId, getBusinessId(req));
    if (!role) {
      next(forbidden());
      return;
    }
    next();
  };
}

/** OWNER or ADMIN only — mirrors user_is_business_manager(). */
export function requireBusinessManager(getBusinessId: (req: Request) => string) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.userId) {
      next(unauthorized());
      return;
    }
    const role = await roleFor(req.userId, getBusinessId(req));
    if (!role || !["OWNER", "ADMIN"].includes(role)) {
      next(forbidden());
      return;
    }
    next();
  };
}
