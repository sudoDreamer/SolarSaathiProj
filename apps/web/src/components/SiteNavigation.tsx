import { useEffect, useState } from 'react';
import { Frame, NavigationMenu } from '@flowstack-ui/brick';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../api';
import { useSession } from '../session';
import { For, Grid, Show, Stack, Text, useResource } from '../ui';

export default function SiteNavigation() {
  const { user } = useSession(),
    location = useLocation(),
    { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(null);
  const homes = useResource(
    () =>
      user
        ? api<{ id: string; nickname: string; calculationId: string }[]>('/households')
        : Promise.resolve([]),
    [user?.id, location.pathname],
  );
  useEffect(() => setOpen(null), [location.pathname]);
  const selectedId = location.pathname.match(/^\/app\/households\/([^/]+)/)?.[1];
  const home = homes.data?.find((h) => h.id === selectedId) ?? homes.data?.[0];
  const householdBase = home ? `/app/households/${home.id}` : '/app';
  const groups = [
    {
      title: 'Explore solar',
      items: [
        { label: 'Home', to: '/' },
        { label: t('calculator'), to: '/calculate' },
        { label: t('rules'), to: '/rules' },
        { label: 'Guides & methodology', to: '/learn' },
      ],
    },
    {
      title: home ? `Your home · ${home.nickname}` : 'Your solar workspace',
      items: [
        { label: 'My dashboard', to: '/app' },
        { label: home ? 'Household overview' : 'Create or select a household', to: householdBase },
        ...(home ? [{ label: 'Saved solar result', to: `/result/${home.calculationId}` }] : []),
        { label: 'Bills', to: home ? householdBase + '/bills' : '/app?view=bills' },
        { label: 'Bill comparison', to: home ? householdBase + '/compare' : '/app?view=compare' },
        {
          label: 'Application tracker',
          to: home ? householdBase + '/application' : '/app?view=application',
        },
      ],
    },
    {
      title: 'Learn',
      items: [
        { label: 'Net metering', to: '/learn/net-metering' },
        { label: 'Subsidy steps', to: '/learn/subsidy-steps' },
        { label: 'Read your bill', to: '/learn/reading-your-bill' },
        { label: 'Choose a vendor', to: '/learn/choosing-a-vendor' },
      ],
    },
    {
      title: 'SolarSaathi',
      items: [
        { label: 'About', to: '/about' },
        { label: 'Privacy', to: '/privacy' },
        { label: 'Terms', to: '/terms' },
        { label: user ? 'Switch account / log in' : 'Log in', to: '/login' },
        ...(['ANALYST', 'ADMIN'].includes(user?.role ?? '')
          ? [{ label: 'Admin control room', to: '/admin' }]
          : []),
      ],
    },
  ];
  return (
    <NavigationMenu.Root
      aria-label="Main navigation"
      value={open}
      onValueChange={setOpen}
      disableHoverTrigger
      size="md"
      tone="neutral"
    >
      <NavigationMenu.List>
        <For
          each={[
            { label: t('calculator'), to: '/calculate' },
            { label: t('rules'), to: '/rules' },
          ]}
        >
          {(item) => (
            <Show key={item.to} from="lg" asChild>
              <NavigationMenu.Item value={item.to}>
                <NavigationMenu.Link asChild href={item.to} active={location.pathname === item.to}>
                  <RouterLink to={item.to}>{item.label}</RouterLink>
                </NavigationMenu.Link>
              </NavigationMenu.Item>
            </Show>
          )}
        </For>
        <NavigationMenu.Item value="all-pages">
          <NavigationMenu.Trigger>Pages</NavigationMenu.Trigger>
          <NavigationMenu.Content inset="md">
            <Frame inlineSize="min(36rem, calc(100vw - 2rem))">
              <Grid columns={2} gap={7}>
                <For each={groups}>
                  {(group) => (
                    <Stack key={group.title} gap={3}>
                      <Text variant="eyebrow">{group.title}</Text>
                      <Stack gap={1}>
                        <For each={group.items}>
                          {(item) => (
                            <NavigationMenu.Link
                              key={item.to}
                              asChild
                              href={item.to}
                              active={location.pathname === item.to}
                            >
                              <RouterLink to={item.to}>{item.label}</RouterLink>
                            </NavigationMenu.Link>
                          )}
                        </For>
                      </Stack>
                    </Stack>
                  )}
                </For>
              </Grid>
            </Frame>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Viewport align="end" collisionPadding={16} />
    </NavigationMenu.Root>
  );
}
