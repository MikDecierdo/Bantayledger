import type { BusinessProfile } from '../../types';
import type { BusinessRole, BusinessRow, ProfileRow } from '../../types/database';
import { initialsOf } from '../../utils/format';
import { api } from './client';
import { authClient } from './authClient';
import { intlLocale } from '../../i18n';
import { t } from '../../i18n';

export const profileService = {
  async get(_userId: string): Promise<ProfileRow | null> {
    // The Laravel route infers the user from the bearer token, not a
    // userId param, so this just re-reads /auth/me.
    const res = await authClient.me();
    return res?.profile ?? null;
  },

  async update(
    _userId: string,
    input: { fullName?: string; phone?: string; avatarUrl?: string | null },
  ): Promise<ProfileRow> {
    return authClient.updateProfile(input);
  },
};

export const businessService = {
  async get(businessId: string): Promise<BusinessRow | null> {
    return api.get<BusinessRow>(`/businesses/${businessId}`);
  },

  async roleOf(businessId: string, _userId: string): Promise<BusinessRole | null> {
    const res = await authClient.me();
    return res?.context.roleByBusiness[businessId] ?? null;
  },

  async update(
    businessId: string,
    input: {
      name?: string;
      businessType?: string;
      address?: string;
      phone?: string;
      email?: string;
      monthlyPurchaseBudget?: number | null;
    },
  ): Promise<BusinessRow> {
    return api.patch<BusinessRow>(`/businesses/${businessId}`, input);
  },

  async members(businessId: string): Promise<TeamMember[]> {
    return api.get<TeamMember[]>(`/businesses/${businessId}/members`);
  },

  async addMember(
    businessId: string,
    input: { fullName: string; email: string; phone?: string; password: string },
  ): Promise<void> {
    await api.post(`/businesses/${businessId}/members`, input);
  },

  async resetMemberPassword(businessId: string, userId: string, password: string): Promise<void> {
    await api.patch(`/businesses/${businessId}/members/${userId}/password`, { password });
  },

  async removeMember(businessId: string, userId: string): Promise<void> {
    await api.delete(`/businesses/${businessId}/members/${userId}`);
  },
};

export interface TeamMember {
  membershipId: string;
  userId: string;
  role: BusinessRole;
  fullName: string;
  email: string;
  phone: string;
  avatarUrl: string | null;
}

export function toBusinessProfile(
  profile: ProfileRow | null,
  business: BusinessRow | null,
  role: BusinessRole | null,
): BusinessProfile {
  const fullName = profile?.full_name ?? profile?.email?.split('@')[0] ?? t('You');
  const roleLabel = role === 'OWNER' ? t('Owner') : t('Staff');

  return {
    ownerName: fullName,
    firstName: fullName.split(' ')[0],
    role: roleLabel,
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    initials: initialsOf(fullName),
    businessName: business?.name ?? t('Your business'),
    businessType: business?.business_type ?? '—',
    address: business?.address ?? '',
    currency: business?.currency ?? 'PHP',
    memberSince: profile?.created_at
      ? new Date(profile.created_at).toLocaleDateString(intlLocale(), { month: 'long', year: 'numeric' })
      : '—',
  };
}
