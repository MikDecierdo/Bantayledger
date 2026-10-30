import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Suspense, lazy } from 'react';
import { Redirect, Route, Switch, useLocation } from 'react-router-dom';
import ProtectedRoute, { PublicOnlyRoute } from './components/auth/ProtectedRoute';
import AppShell from './components/layout/AppShell';
import ToastProvider from './components/common/ToastProvider';
import { LoadingState, SkeletonGrid } from './components/common/States';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider } from './i18n/LanguageContext';

/*
 * Every in-app route is code-split. Ionic's runtime is the bulk of the initial
 * bundle already, so keeping page bundles separate means navigating to, say,
 * Reports doesn't cost anything until the user actually goes there.
 */
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Inventory = lazy(() => import('./pages/Inventory'));
const ProductDetails = lazy(() => import('./pages/ProductDetails'));
const Sales = lazy(() => import('./pages/Sales'));
const Purchases = lazy(() => import('./pages/Purchases'));
const Suppliers = lazy(() => import('./pages/Suppliers'));
const Expenses = lazy(() => import('./pages/Expenses'));
const Waste = lazy(() => import('./pages/Waste'));
const Forecast = lazy(() => import('./pages/Forecast'));
const AIInsights = lazy(() => import('./pages/AIInsights'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Reports = lazy(() => import('./pages/Reports'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/NotFound'));

// The authentication screens load eagerly: they are the first thing a
// signed-out visitor sees, and splitting them would only add a spinner.
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Welcome from './pages/Welcome';

setupIonicReact({ mode: 'md' });

/** Routes rendered outside the app shell, for signed-out visitors. */
const AUTH_ROUTES = ['/login', '/register', '/forgot-password', '/reset-password'];

function RouteFallback() {
  return (
    <LoadingState label="Loading page">
      <SkeletonGrid count={4} lines={2} />
    </LoadingState>
  );
}

/**
 * Application routes.
 *
 * Authentication screens render standalone; everything else sits inside the
 * responsive shell behind `ProtectedRoute`. A signed-out user reaching a
 * protected page is sent to `/login` with their intended destination
 * remembered, and bounced straight there after signing in.
 */
function Routes() {
  const { pathname } = useLocation();
  const { loading, needsPrivacyNotice } = useAuth();

  // Signed in but hasn't accepted the data notice yet (first login, or the
  // notice changed): that step comes before anything else, outside the shell.
  if (!loading && needsPrivacyNotice && !AUTH_ROUTES.includes(pathname)) {
    return <Welcome />;
  }

  if (AUTH_ROUTES.includes(pathname)) {
    return (
      <Switch>
        <PublicOnlyRoute exact path="/login">
          <Login />
        </PublicOnlyRoute>
        <PublicOnlyRoute exact path="/register">
          <Register />
        </PublicOnlyRoute>
        <PublicOnlyRoute exact path="/forgot-password">
          <ForgotPassword />
        </PublicOnlyRoute>
        {/* Reached from an emailed link, which carries its own session. */}
        <Route exact path="/reset-password" component={ResetPassword} />
      </Switch>
    );
  }

  return (
    <AppShell>
      <Suspense fallback={<RouteFallback />}>
        <Switch>
          <Route exact path="/">
            <Redirect to="/dashboard" />
          </Route>

          <ProtectedRoute exact path="/dashboard">
            <Dashboard />
          </ProtectedRoute>
          <ProtectedRoute exact path="/inventory">
            <Inventory />
          </ProtectedRoute>
          <ProtectedRoute exact path="/inventory/:id">
            <ProductDetails />
          </ProtectedRoute>
          <ProtectedRoute exact path="/sales">
            <Sales />
          </ProtectedRoute>
          <ProtectedRoute exact path="/purchases">
            <Purchases />
          </ProtectedRoute>
          <ProtectedRoute exact path="/suppliers">
            <Suppliers />
          </ProtectedRoute>
          <ProtectedRoute exact path="/expenses">
            <Expenses />
          </ProtectedRoute>
          <ProtectedRoute exact path="/waste">
            <Waste />
          </ProtectedRoute>
          <ProtectedRoute exact path="/forecast">
            <Forecast />
          </ProtectedRoute>
          <ProtectedRoute exact path="/ai-insights">
            <AIInsights />
          </ProtectedRoute>
          <ProtectedRoute exact path="/alerts">
            <Alerts />
          </ProtectedRoute>
          <ProtectedRoute exact path="/reports">
            <Reports />
          </ProtectedRoute>
          <ProtectedRoute exact path="/profile">
            <Profile />
          </ProtectedRoute>
          <ProtectedRoute exact path="/settings">
            <Settings />
          </ProtectedRoute>

          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </AppShell>
  );
}

export function App() {
  return (
    <IonApp>
      <LanguageProvider>
      <AuthProvider>
        <ToastProvider>
          <IonReactRouter>
            {/*
              A plain outlet: the app uses its own scroll container and CSS
              transitions rather than Ionic's stack navigation, which keeps the
              desktop layout from being treated as a native page stack.
            */}
            <IonRouterOutlet>
              <Route path="/" component={Routes} />
            </IonRouterOutlet>
          </IonReactRouter>
        </ToastProvider>
      </AuthProvider>
      </LanguageProvider>
    </IonApp>
  );
}

export default App;
