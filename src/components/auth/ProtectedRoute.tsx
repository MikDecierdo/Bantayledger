import type { ReactElement } from 'react';
import { Redirect, Route, type RouteProps } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LoadingState, SkeletonGrid } from '../common/States';
import { t } from '../../i18n';

/**
 * Gate for authenticated pages.
 *
 * While the initial session lookup runs we render a skeleton rather than
 * redirecting — otherwise a signed-in user reloading the page would be bounced
 * to the login screen for a moment before being sent back, which is the
 * classic authentication loop this avoids.
 */
export function ProtectedRoute({ children, ...rest }: RouteProps) {
  const { loading, user } = useAuth();

  return (
    <Route
      {...rest}
      render={({ location }): ReactElement => {
        if (loading) {
          return (
            <LoadingState label={t('Checking your session')}>
              <SkeletonGrid count={4} lines={2} />
            </LoadingState>
          );
        }

        if (!user) {
          // `from` lets the login page send the user back where they meant to go.
          return <Redirect to={{ pathname: '/login', state: { from: location } }} />;
        }

        return <>{children}</>;
      }}
    />
  );
}

/**
 * The mirror image: keeps a signed-in user off the login and registration
 * screens, so following an old bookmark lands them in the app instead.
 */
export function PublicOnlyRoute({ children, ...rest }: RouteProps) {
  const { loading, user, isDemoMode } = useAuth();

  return (
    <Route
      {...rest}
      render={(): ReactElement => {
        if (loading) return <></>;
        // In sample-data mode the stand-in user is always present, so this
        // guard would make the login screen unreachable. Leave it open there.
        if (user && !isDemoMode) return <Redirect to="/dashboard" />;
        return <>{children}</>;
      }}
    />
  );
}

export default ProtectedRoute;
