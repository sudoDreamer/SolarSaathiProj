import React, { Suspense, lazy, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, House, LayoutDashboard, LogOut, Settings2, Shield, Sun } from 'lucide-react';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/fraunces/400.css';
import '@fontsource/fraunces/500.css';
import '@flowstack-ui/brick/styles.css';
import './i18n';
import './styles.css';
import {
  ActionLink,
  Appearance,
  AppBar,
  Badge,
  Button,
  Container,
  ErrorState,
  For,
  Grid,
  Heading,
  HStack,
  Link,
  Loading,
  NavList,
  Notice,
  Paragraph,
  Section,
  SelectField,
  Show,
  Stack,
  Text,
} from './ui';
import { SessionProvider, useSession } from './session';
import { signOut } from './api';
import SiteNavigation from './components/SiteNavigation';
const Landing = lazy(() => import('./pages/Landing'));
const Calculator = lazy(() => import('./pages/Calculator'));
const Result = lazy(() => import('./pages/Result'));
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Admin = lazy(() => import('./pages/Admin'));
const Rules = lazy(() => import('./pages/Rules'));
const Household = lazy(() => import('./pages/Household'));
const Bills = lazy(() => import('./pages/Household').then((m) => ({ default: m.BillsPage })));
const Compare = lazy(() => import('./pages/Household').then((m) => ({ default: m.ComparePage })));
const Tracker = lazy(() => import('./pages/Household').then((m) => ({ default: m.TrackerPage })));
const HouseholdOverview = lazy(() =>
  import('./pages/Household').then((m) => ({ default: m.HouseholdOverview })),
);
const Learn = lazy(() => import('./pages/Rules').then((m) => ({ default: m.LearnPage })));
const Legal = lazy(() => import('./pages/Rules').then((m) => ({ default: m.LegalPage })));

class ErrorBoundary extends React.Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <Section>
        <Container>
          <ErrorState
            error="The page could not render. Please reload to try again."
            retry={() => window.location.reload()}
          />
        </Container>
      </Section>
    ) : (
      this.props.children
    );
  }
}
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (hash) requestAnimationFrame(() => document.getElementById(hash.slice(1))?.scrollIntoView());
    else window.scrollTo(0, 0);
  }, [pathname, hash]);
  return null;
}
function RequireAuth({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
  const { user, loading } = useSession(),
    location = useLocation();
  if (loading)
    return (
      <Section>
        <Container>
          <Loading />
        </Container>
      </Section>
    );
  if (!user)
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (staff && !['ADMIN', 'ANALYST'].includes(user.role))
    return (
      <Section>
        <Container>
          <Notice error>You do not have access to the control room.</Notice>
          <Link to="/app">Return to your workspace</Link>
        </Container>
      </Section>
    );
  return children;
}
function Header() {
  const { user } = useSession(),
    { t, i18n } = useTranslation(),
    location = useLocation(),
    landing = location.pathname === '/';
  const nav = [
    { label: t('calculator'), to: '/calculate' },
    { label: t('rules'), to: '/rules' },
    { label: t('learn'), to: '/learn' },
  ];
  return (
    <Appearance value={landing ? 'dark' : 'light'}>
      <AppBar.Root className={`site-header ${landing ? 'over-hero' : ''}`} treatment="translucent">
        <Container>
          <AppBar.Toolbar inset="none" density="comfortable" layout="flex" gap={3}>
            <AppBar.Start>
              <Link to="/" variant="plain" className="wordmark">
                <Sun size={26} aria-hidden="true" />
                <span>
                  <span>Solar</span>Saathi
                </span>
              </Link>
            </AppBar.Start>
            <AppBar.Center>
              <SiteNavigation />
            </AppBar.Center>
            <AppBar.End gap={3}>
              <div className="language-picker">
                <SelectField
                  label={t('language')}
                  value={i18n.language}
                  onChange={(value) => {
                    void i18n.changeLanguage(value);
                    localStorage.setItem('ss-language', value);
                    document.documentElement.lang = value;
                  }}
                  options={[
                    { value: 'en', label: 'EN' },
                    { value: 'mr', label: 'मराठी' },
                    { value: 'hi', label: 'हिन्दी' },
                  ]}
                />
              </div>
              <Show from="lg">
                <Button
                  href={user ? '/app' : '/login'}
                  variant={landing ? 'outline' : 'soft'}
                  tone="neutral"
                  size="md"
                >
                  {user ? t('dashboard') : t('login')}
                </Button>
              </Show>
            </AppBar.End>
          </AppBar.Toolbar>
        </Container>
      </AppBar.Root>
    </Appearance>
  );
}
function Workspace() {
  const location = useLocation(),
    { user } = useSession();
  const items = [
    { to: '/app', label: 'My overview', icon: LayoutDashboard },
    { to: '/calculate', label: 'New calculation', icon: Sun },
    { to: '/rules', label: 'Rules & sources', icon: Shield },
    ...(['ANALYST', 'ADMIN'].includes(user?.role ?? '')
      ? [{ to: '/admin', label: 'Control room', icon: Settings2 }]
      : []),
  ];
  return (
    <div
      className={`workspace scene-page ${location.pathname.match(/bills|compare|application/) ? 'scene-golden' : 'scene-clear'}`}
    >
      <Container>
        <Grid
          templateColumns={{ initial: '1fr', lg: '190px minmax(0, 1fr)' }}
          gap={10}
          className="workspace-grid"
        >
          <Show from="lg">
            <aside className="workspace-sidebar">
              <Stack gap={8}>
                <Text variant="eyebrow">Your solar space</Text>
                <NavList.Root aria-label="Workspace">
                  <NavList.List>
                    <For each={items}>
                      {(item) => (
                        <NavList.Item key={item.to}>
                          <NavList.Link
                            href={item.to}
                            active={location.pathname === item.to}
                            startIcon={<item.icon />}
                          >
                            {item.label}
                          </NavList.Link>
                        </NavList.Item>
                      )}
                    </For>
                  </NavList.List>
                </NavList.Root>
                <Stack gap={4}>
                  <Text variant="body-sm" tone="secondary">
                    {user?.mobileMasked}
                  </Text>
                  <Button variant="outline" startIcon={<LogOut />} onClick={() => void signOut()}>
                    Log out
                  </Button>
                </Stack>
              </Stack>
            </aside>
          </Show>
          <div className="workspace-content">
            <Outlet />
          </div>
        </Grid>
      </Container>
    </div>
  );
}
function Footer({ motion, onMotion }: { motion: string; onMotion: (value: string) => void }) {
  const { user } = useSession();
  return (
    <footer className="site-footer">
      <Container>
        <Stack gap={8}>
          <HStack justify="between" wrap="wrap" gap={6}>
            <Stack gap={4}>
              <Link to="/" variant="plain" className="wordmark">
                <Sun size={24} aria-hidden="true" />
                <span>
                  <span>Solar</span>Saathi
                </span>
              </Link>
              <Paragraph variant="body-sm" tone="secondary">
                Your companion for rooftop solar in Maharashtra.
              </Paragraph>
            </Stack>
            <HStack gap={6} wrap="wrap">
              <Text variant="body-sm" tone="secondary">
                Explore every page from the Pages menu above.
              </Text>
              {user && (
                <Button size="sm" variant="outline" onClick={() => void signOut()}>
                  Log out
                </Button>
              )}
            </HStack>
          </HStack>
          <HStack justify="between" wrap="wrap" gap={6}>
            <Paragraph variant="body-sm" tone="secondary">
              Estimates for planning only. Not an approval or a subsidy guarantee.
              <br />
              Independent of MSEDCL, MERC and MNRE. Confirm before committing money.
            </Paragraph>
            <SelectField
              label="Motion preference"
              value={motion}
              onChange={onMotion}
              options={[
                { value: 'system', label: 'Follow system' },
                { value: 'full', label: 'Full motion' },
                { value: 'reduced', label: 'Reduced motion' },
                { value: 'off', label: 'Motion off' },
              ]}
            />
          </HStack>
          <Text variant="caption" tone="secondary">
            SolarSaathi · Local development · Marathi and Hindi navigation is a draft translation.
          </Text>
        </Stack>
      </Container>
    </footer>
  );
}
function GuideRoute() {
  const { slug } = useParams();
  return <Learn slug={slug} />;
}
function NotFound() {
  return (
    <Section>
      <Container>
        <Stack align="center" gap={6}>
          <Sun size={40} />
          <Heading level={1} variant="display-sm">
            A little off the sun’s path.
          </Heading>
          <Paragraph>We couldn’t find that page.</Paragraph>
          <ActionLink to="/">Head back home</ActionLink>
        </Stack>
      </Container>
    </Section>
  );
}
function App() {
  const [motion, setMotion] = useState(localStorage.getItem('ss-motion') || 'system'),
    [systemReduced, setSystemReduced] = useState(
      matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
    [online, setOnline] = useState(navigator.onLine);
  const reduced =
    motion === 'off' || motion === 'reduced' || (motion === 'system' && systemReduced);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'),
      update = () => setSystemReduced(media.matches),
      on = () => setOnline(true),
      off = () => setOnline(false);
    media.addEventListener('change', update);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = reduced ? 'reduced' : 'full';
    localStorage.setItem('ss-motion', motion);
  }, [motion, reduced]);
  return (
    <>
      <ScrollToTop />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Header />
      {!online && (
        <Notice>You’re offline. The local app needs its API to save or load data.</Notice>
      )}
      <main id="main-content">
        <ErrorBoundary>
          <Suspense
            fallback={
              <Section>
                <Container>
                  <Loading />
                </Container>
              </Section>
            }
          >
            <Routes>
              <Route path="/" element={<Landing reduced={reduced} />} />
              <Route path="/calculate" element={<Calculator />} />
              <Route path="/result/:calculationId" element={<Result />} />
              <Route path="/login" element={<Login />} />
              <Route path="/rules" element={<Rules />} />
              <Route path="/learn" element={<Learn />} />
              <Route path="/learn/:slug" element={<GuideRoute />} />
              <Route path="/privacy" element={<Legal kind="privacy" />} />
              <Route path="/terms" element={<Legal kind="terms" />} />
              <Route path="/about" element={<Legal kind="about" />} />
              <Route
                path="/app"
                element={
                  <RequireAuth>
                    <Workspace />
                  </RequireAuth>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="households/:householdId" element={<Household />}>
                  <Route index element={<HouseholdOverview />} />
                  <Route path="bills" element={<Bills />} />
                  <Route path="compare" element={<Compare />} />
                  <Route path="application" element={<Tracker />} />
                </Route>
              </Route>
              <Route
                path="/admin"
                element={
                  <RequireAuth staff>
                    <div className="admin-page">
                      <Section>
                        <Container>
                          <Admin />
                        </Container>
                      </Section>
                    </div>
                  </RequireAuth>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <Footer motion={motion} onMotion={setMotion} />
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <SessionProvider>
      <App />
    </SessionProvider>
  </BrowserRouter>,
);
