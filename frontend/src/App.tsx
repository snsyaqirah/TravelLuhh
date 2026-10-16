import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { AppThemeProvider } from '@/components/theme/ThemeProvider';
import { AuthProvider } from '@/context/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { Layout } from '@/components/layout/Layout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { AppSkeleton } from '@/components/shell/AppSkeleton';
import { RouteErrorBoundary } from '@/components/shell/RouteErrorBoundary';
import { SessionExpiryRedirect } from '@/components/shell/SessionExpiryRedirect';
import { TripIndexRedirect, TripTabGuard } from '@/components/shell/TripRoutes';

// Every page is its own chunk (§13); the shell above stays in the entry.
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const OAuthCallback = lazy(() => import('./pages/OAuthCallback'));
const Home = lazy(() => import('./pages/Home'));
const Trips = lazy(() => import('./pages/Trips'));
const TripNew = lazy(() => import('./pages/TripNew'));
const TripDetail = lazy(() => import('./pages/TripDetail'));
const Passport = lazy(() => import('./pages/Passport'));
const Me = lazy(() => import('./pages/Me'));
const NotFound = lazy(() => import('./pages/NotFound'));
// The older Radix toaster (pages still on useToast) mounts after first paint; queued toasts wait in its store.
const Toaster = lazy(() => import('@/components/ui/toaster').then((m) => ({ default: m.Toaster })));
// Dev-only primitive gallery (§14). The DEV check is static, so production builds drop the chunk entirely.
const IsoKit = import.meta.env.DEV ? lazy(() => import('./pages/dev/IsoKit')) : null;

/** Outermost safety net (public pages, or the shell itself). Navigating elsewhere clears it. */
function ScreenBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <RouteErrorBoundary variant="screen" resetKey={pathname}>
      {children}
    </RouteErrorBoundary>
  );
}

/** Old paths keep working, query string included (/portfolio?year=2025 → /passport?year=2025). */
function Redirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  return <Navigate replace to={{ pathname: to, search, hash }} />;
}

/** The route table. Exported for the routing tests, which mount it in a MemoryRouter. */
export function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      {/* The backend's OAuth success handler redirects here: keep the path. */}
      <Route path="/auth/callback" element={<OAuthCallback />} />

      {/* Signed in, inside the shell */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/home" element={<Home />} />
        <Route path="/dashboard" element={<Redirect to="/home" />} />
        <Route path="/trips" element={<Trips />} />
        <Route path="/trips/new" element={<TripNew />} />
        <Route path="/trips/:tripId" element={<TripIndexRedirect />} />
        <Route path="/trips/:tripId/edit" element={<TripIndexRedirect sheet="edit" />} />
        <Route
          path="/trips/:tripId/:tab"
          element={
            <TripTabGuard>
              <TripDetail />
            </TripTabGuard>
          }
        />
        <Route path="/passport" element={<Passport />} />
        <Route path="/portfolio" element={<Redirect to="/passport" />} />
        <Route path="/me" element={<Me />} />
        <Route path="/profile" element={<Redirect to="/me" />} />
      </Route>

      {IsoKit ? <Route path="/dev/iso-kit" element={<IsoKit />} /> : null}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AppThemeProvider>
      <MotionConfig reducedMotion="user">
        <AuthProvider>
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <SessionExpiryRedirect />
            <ScreenBoundary>
              <Suspense fallback={<AppSkeleton variant="screen" />}>
                <AppRoutes />
              </Suspense>
            </ScreenBoundary>
          </BrowserRouter>
          <Suspense fallback={null}>
            <Toaster />
          </Suspense>
          <Sonner />
        </AuthProvider>
      </MotionConfig>
    </AppThemeProvider>
  </QueryClientProvider>
);

export default App;
