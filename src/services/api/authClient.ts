import type { BusinessRole, BusinessRow, ProfileRow } from '../../types/database';
import { api, setToken } from './client';

/**
 * Auth against the Laravel backend (Sanctum tokens). Replaces both the
 * Supabase Auth path and the on-device SQLite localAuthService — the app
 * now has exactly one backend.
 */

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  businessName: string;
}

interface LaravelUserRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  privacy_accepted_at: string | null;
  privacy_version: string | null;
  language: string | null;
  created_at: string;
  updated_at: string;
}

function toProfile(row: LaravelUserRow): ProfileRow {
  return {
    id: row.id,
    email: row.email,
    full_name: row.name,
    phone: row.phone,
    avatar_url: row.avatar_url,
    privacy_accepted_at: row.privacy_accepted_at ?? null,
    privacy_version: row.privacy_version ?? null,
    language: row.language ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface UserContext {
  businesses: BusinessRow[];
  roleByBusiness: Record<string, BusinessRole>;
}

export const authClient = {
  async signUp(input: SignUpInput): Promise<{ userId: string }> {
    // Errors propagate as-is (ApiError, from ./client) rather than being
    // rewrapped — lib/errors.ts's toUserMessage() knows how to read an
    // ApiError's message directly, and the API already returns specific,
    // user-safe text (e.g. "An account with that email already exists.").
    const res = await api.post<{ userId: string; accessToken: string }>('/auth/signup', {
      email: input.email.trim(),
      password: input.password,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || undefined,
      businessName: input.businessName.trim(),
    });
    setToken(res.accessToken);
    return { userId: res.userId };
  },

  async signIn(email: string, password: string): Promise<{ userId: string }> {
    const res = await api.post<{ userId: string; accessToken: string }>('/auth/login', {
      email: email.trim(),
      password,
    });
    setToken(res.accessToken);
    return { userId: res.userId };
  },

  /** Emails a reset link. Answers the same whether or not the email has an account. */
  async requestPasswordReset(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email: email.trim() });
  },

  /** Sets a new password from the emailed link and signs in. */
  async resetPassword(token: string, email: string, password: string): Promise<{ userId: string }> {
    const res = await api.post<{ userId: string; accessToken: string }>('/auth/reset-password', {
      token,
      email: email.trim(),
      password,
    });
    setToken(res.accessToken);
    return { userId: res.userId };
  },

  async signOut(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch {
      // Even if the server call fails (e.g. token already expired), still
      // drop the local token so the app treats the user as signed out.
    }
    setToken(null);
  },

  getToken(): string | null {
    return window.localStorage.getItem('bantayledger.apiToken');
  },

  async me(): Promise<{ profile: ProfileRow; context: UserContext; privacyNoticeVersion: string } | null> {
    try {
      const res = await api.get<{
        profile: LaravelUserRow;
        businesses: (BusinessRow & { membershipRole: BusinessRole })[];
        privacyNoticeVersion?: string;
      }>('/auth/me');

      const roleByBusiness: Record<string, BusinessRole> = {};
      const businesses: BusinessRow[] = res.businesses
        .map(({ membershipRole, ...business }) => {
          roleByBusiness[business.id] = membershipRole;
          return business;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      return {
        profile: toProfile(res.profile),
        context: { businesses, roleByBusiness },
        privacyNoticeVersion: res.privacyNoticeVersion ?? '1',
      };
    } catch {
      return null;
    }
  },

  async updateProfile(input: { fullName?: string; phone?: string; avatarUrl?: string | null; language?: string }): Promise<ProfileRow> {
    const row = await api.patch<LaravelUserRow>('/profile', {
      fullName: input.fullName,
      phone: input.phone,
      avatarUrl: input.avatarUrl,
      language: input.language,
    });
    return toProfile(row);
  },

  /** Records that the person accepted the data privacy notice, and their language. */
  async acceptPrivacy(version: string, language: string): Promise<ProfileRow> {
    const row = await api.post<LaravelUserRow>('/profile/consent', { version, language });
    return toProfile(row);
  },

  async createBusiness(name: string): Promise<string> {
    const res = await api.post<{ businessId: string }>('/auth/businesses', { name: name.trim() });
    return res.businessId;
  },
};

export default authClient;
