import { db } from "../db";
import { badRequest, notFound } from "../errors";

/**
 * Profile and business management. Ported from
 * src/services/supabase/accountService.ts (`toBusinessProfile` moves to the
 * client, since it only combines fields — no query of its own).
 */

export type BusinessRole = "OWNER" | "ADMIN" | "STAFF";

export const profileService = {
  async get(userId: string) {
    return db("profiles").where({ id: userId }).first();
  },

  async update(userId: string, input: { fullName?: string; phone?: string; avatarUrl?: string | null }) {
    const patch: Record<string, unknown> = {};
    if (input.fullName !== undefined) patch.full_name = input.fullName.trim();
    if (input.phone !== undefined) patch.phone = input.phone.trim() || null;
    if (input.avatarUrl !== undefined) patch.avatar_url = input.avatarUrl;

    const updated = await db("profiles").where({ id: userId }).update(patch);
    if (!updated) throw notFound("Your profile could not be found.");
    return db("profiles").where({ id: userId }).first();
  },
};

export const businessService = {
  async get(businessId: string) {
    return db("businesses").where({ id: businessId }).first();
  },

  async roleOf(businessId: string, userId: string): Promise<BusinessRole | null> {
    const row = await db("business_users").where({ business_id: businessId, user_id: userId }).first("role");
    return row?.role ?? null;
  },

  async update(
    businessId: string,
    input: { name?: string; businessType?: string; address?: string; phone?: string; email?: string },
  ) {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.businessType !== undefined) patch.business_type = input.businessType || null;
    if (input.address !== undefined) patch.address = input.address || null;
    if (input.phone !== undefined) patch.phone = input.phone || null;
    if (input.email !== undefined) patch.email = input.email || null;

    const updated = await db("businesses").where({ id: businessId }).update(patch);
    if (!updated) throw notFound("That business could not be found.");
    return db("businesses").where({ id: businessId }).first();
  },

  /** Members of a business, for the team/settings screens. */
  async members(businessId: string) {
    const rows = await db("business_users as bu")
      .join("profiles as p", "p.id", "bu.user_id")
      .where("bu.business_id", businessId)
      .select(
        "bu.id as membership_id",
        "bu.user_id",
        "bu.role",
        "p.full_name",
        "p.email",
        "p.phone",
        "p.avatar_url",
      );

    return rows.map((row) => ({
      membershipId: row.membership_id,
      userId: row.user_id,
      role: row.role,
      fullName: row.full_name ?? "—",
      email: row.email ?? "",
      phone: row.phone ?? "",
      avatarUrl: row.avatar_url ?? null,
    }));
  },

  /** Changes someone's role. OWNER/ADMIN only, enforced by requireBusinessManager on the route. */
  async setRole(businessId: string, userId: string, role: BusinessRole): Promise<void> {
    if (!["OWNER", "ADMIN", "STAFF"].includes(role)) throw badRequest("Invalid role.");
    const updated = await db("business_users").where({ business_id: businessId, user_id: userId }).update({ role });
    if (!updated) throw notFound("That person is not a member of this business.");
  },

  async removeMember(businessId: string, userId: string): Promise<void> {
    await db("business_users").where({ business_id: businessId, user_id: userId }).delete();
  },
};
