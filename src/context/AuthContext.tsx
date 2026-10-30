import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { authClient, type SignUpInput } from '../services/api/authClient';
import { setActiveContext } from '../services/activeContext';
import type { BusinessRole, BusinessRow, ProfileRow } from '../types/database';
import { changeLanguage, currentLanguage, hasSavedLanguage, t } from '../i18n';

/**
 * Authentication and business membership, backed entirely by the Laravel
 * API (see src/services/api/authClient.ts). This used to branch between
 * Supabase, on-device SQLite, and a sample-data fallback — see git history
 * for that version — but the app now has exactly one backend.
 */

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthState {
  /** True while the initial session lookup is in flight. */
  loading: boolean;
  user: AuthUser | null;
  profile: ProfileRow | null;
  /** Version of the data privacy notice people must have accepted. */
  privacyNoticeVersion: string;
  /** True once signed in but the privacy notice (current version) hasn't been accepted. */
  needsPrivacyNotice: boolean;
  /** Every business the signed-in user belongs to. */
  businesses: BusinessRow[];
  /** The business whose data the app is currently showing. */
  activeBusiness: BusinessRow | null;
  /** The signed-in user's role in `activeBusiness`. */
  role: BusinessRole | null;
  /** Convenience: the OWNER may edit the catalogue and manage the team. */
  isManager: boolean;
  /**
   * Always false now — kept only so the handful of pages that still check
   * it (Login, Register, ForgotPassword, ProtectedRoute) don't need
   * touching. There is no sample-data fallback mode any more.
   */
  isDemoMode: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  setActiveBusiness: (businessId: string) => void;
  /** Re-reads profile and memberships, e.g. after creating a business. */
  refresh: () => Promise<void>;
}

export type { SignUpInput };

const ACTIVE_BUSINESS_KEY = 'bantayledger.activeBusiness';

const AuthContext = createContext<AuthState | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [privacyNoticeVersion, setPrivacyNoticeVersion] = useState('1');
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [roleByBusiness, setRoleByBusiness] = useState<Record<string, BusinessRole>>({});
  const [activeBusinessId, setActiveBusinessId] = useState<string | null>(null);

  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Loads the profile row and every business the user belongs to. */
  const loadUserContext = useCallback(async () => {
    const result = await authClient.me();
    if (!mounted.current) return false;

    if (!result) {
      setUser(null);
      setProfile(null);
      setBusinesses([]);
      setRoleByBusiness({});
      setActiveBusinessId(null);
      return false;
    }

    setUser({ id: result.profile.id, email: result.profile.email });
    setProfile(result.profile);
    setPrivacyNoticeVersion(result.privacyNoticeVersion);

    // A new browser follows the language saved on the account (once).
    const saved = result.profile.language;
    if (saved && (saved === 'en' || saved === 'tl' || saved === 'ceb') && !hasSavedLanguage() && saved !== currentLanguage()) {
      void changeLanguage(saved).then(() => window.location.reload());
    }
    setBusinesses(result.context.businesses);
    setRoleByBusiness(result.context.roleByBusiness);

    setActiveBusinessId((current) => {
      const remembered = current ?? window.localStorage.getItem(ACTIVE_BUSINESS_KEY);
      if (remembered && result.context.businesses.some((b) => b.id === remembered)) return remembered;
      return result.context.businesses[0]?.id ?? null;
    });

    return true;
  }, []);

  /* ---- Session bootstrap -------------------------------------------------- */

  useEffect(() => {
    let cancelled = false;

    const token = authClient.getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    loadUserContext().finally(() => {
      if (!cancelled && mounted.current) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [loadUserContext]);

  /* ---- Actions ------------------------------------------------------------ */

  const signIn = useCallback(
    async (email: string, password: string) => {
      await authClient.signIn(email, password);
      await loadUserContext();
    },
    [loadUserContext],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      await authClient.signUp(input);
      await loadUserContext();
      return { needsEmailConfirmation: false };
    },
    [loadUserContext],
  );

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
    setProfile(null);
    setBusinesses([]);
    setRoleByBusiness({});
    setActiveBusinessId(null);
  }, []);

  const requestPasswordReset = useCallback(async (_email: string) => {
    // No email service is wired up yet on this backend (see the Laravel
    // AuthController docblock) — surface this plainly rather than a silent
    // no-op, same reasoning the local-SQLite version used.
    throw new Error(
      t(
        t('Password reset by email is not available yet. Sign in with your current password, or ask another owner/admin of this business for help.'),
      ),
    );
  }, []);

  const updatePassword = useCallback(async (_newPassword: string) => {
    throw new Error(t('Changing your password is not available yet.'));
  }, []);

  const setActiveBusiness = useCallback((businessId: string) => {
    setActiveBusinessId(businessId);
    window.localStorage.setItem(ACTIVE_BUSINESS_KEY, businessId);
  }, []);

  const refresh = useCallback(async () => {
    await loadUserContext();
  }, [loadUserContext]);

  const activeBusiness = useMemo(
    () => businesses.find((b) => b.id === activeBusinessId) ?? businesses[0] ?? null,
    [businesses, activeBusinessId],
  );

  const role = activeBusiness ? (roleByBusiness[activeBusiness.id] ?? null) : null;

  /**
   * Publish who we are acting as, so `dataService` can resolve the business
   * without every page having to thread an id through.
   *
   * This MUST be a layout effect, not a passive one. Signing up commits the
   * new business state and the redirect to /dashboard in the same render:
   * React runs passive effects child-before-parent, so a page's data-fetching
   * effect would otherwise run *before* this provider published the business
   * id — reading a still-null context and caching the empty-state fallback
   * for the life of that page. Layout effects for the whole tree complete
   * before any passive effect starts, which closes that window.
   */
  useLayoutEffect(() => {
    setActiveContext({
      businessId: activeBusiness?.id ?? null,
      userId: user?.id ?? null,
    });
  }, [activeBusiness, user]);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      user,
      profile,
      privacyNoticeVersion,
      needsPrivacyNotice:
        !!user &&
        !!profile &&
        (!profile.privacy_accepted_at || profile.privacy_version !== privacyNoticeVersion),
      businesses,
      activeBusiness,
      role,
      isManager: role === 'OWNER',
      isDemoMode: false,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      setActiveBusiness,
      refresh,
    }),
    [
      loading,
      user,
      profile,
      privacyNoticeVersion,
      businesses,
      activeBusiness,
      role,
      signIn,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      setActiveBusiness,
      refresh,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthProvider;
