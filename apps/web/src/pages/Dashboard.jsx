import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, Bell, Home, Plus, Sun } from 'lucide-react';
import { api, post } from '../api.js';
import { useSession } from '../session.jsx';
import {
  ActionLink,
  Badge,
  Button,
  Empty,
  ErrorState,
  For,
  Grid,
  Heading,
  HStack,
  Link,
  Loading,
  Metric,
  Notice,
  PageTitle,
  Panel,
  Paragraph,
  Show,
  Stack,
  Text,
  money,
  useResource,
} from '../ui.jsx';
import { billMonths } from './Calculator.jsx';
export default function Dashboard() {
  const { user } = useSession(),
    navigate = useNavigate(),
    [busy, setBusy] = useState(false),
    [actionError, setActionError] = useState('');
  const homes = useResource(() => api('/households'));
  const notifications = useResource(() => api('/notifications'));
  async function example() {
    setBusy(true);
    try {
      const c = await post('/calculate', {
        discomCode: 'MSEDCL',
        consumerCategory: 'LT_RESIDENTIAL',
        phaseType: 'SINGLE',
        sanctionedLoadKw: 5,
        monthlyUnits: billMonths.map((m) => ({ billMonth: m.key, unitsKwh: 450 })),
        roofAreaSqM: 50,
        shadowFreePct: 90,
        ownershipType: 'OWN',
        districtCode: 'PUNE',
        expectedAddedLoadKw: 0,
      });
      const h = await post('/households', {
        nickname: 'Example Pune home',
        calculationId: c.id,
      });
      navigate(`/app/households/${h.id}`);
    } catch (e) {
      setActionError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap={9}>
      <PageTitle
        eyebrow="YOUR SOLAR WORKSPACE"
        title={`Hello, ${user?.displayName === 'Solar explorer' ? 'sunshine' : user?.displayName}.`}
        action={
          <ActionLink to="/calculate">
            <Plus size={18} /> New calculation
          </ActionLink>
        }
      >
        A little more clarity, every step of the way.
      </PageTitle>
      {homes.loading ? (
        <Loading />
      ) : homes.error ? (
        <ErrorState error={homes.error} retry={homes.reload} />
      ) : !homes.data?.length ? (
        <Panel>
          <Empty title="Your first brighter possibility.">
            Save a calculation to see your household here. Then add monthly bills and follow your
            application steps.
          </Empty>
          <HStack gap={4} justify="center" wrap="wrap">
            <ActionLink to="/calculate">Calculate my solar potential</ActionLink>
            <Button variant="outline" loading={busy} onClick={() => void example()}>
              Explore a labelled example home
            </Button>
          </HStack>
        </Panel>
      ) : (
        <Grid columns={{ initial: 1, lg: 2 }} gap={6}>
          <For each={homes.data}>
            {(h) => {
              const r = h.calculation?.scenarios[h.calculation.headlineScenario];
              return (
                <Panel key={h.id}>
                  <Stack gap={6}>
                    <HStack justify="between">
                      <Home size={24} aria-hidden="true" />
                      <Badge variant="outline">{h.solarStatus.replaceAll('_', ' ')}</Badge>
                    </HStack>
                    <Heading level={2} variant="title-xl">
                      {h.nickname}
                    </Heading>
                    <Text tone="secondary">
                      {h.input.districtCode.toLowerCase().replace(/^./, (s) => s.toUpperCase())} ·
                      MSEDCL · {h.input.sanctionedLoadKw} kW sanctioned load
                    </Text>
                    <Grid columns={2} gap={5}>
                      <Metric
                        label="Estimated size"
                        value={r ? `${r.capacityKw} kW` : 'Not calculated'}
                      />
                      <Metric
                        label="Possible subsidy"
                        value={r ? money(r.subsidyInr) : 'Not calculated'}
                      />
                    </Grid>
                    <HStack justify="between" gap={4} wrap="wrap">
                      <Link to={`/app/households/${h.id}`}>
                        Open household <ArrowUpRight size={16} />
                      </Link>
                      <Link to={`/app/households/${h.id}/bills`}>Add a bill</Link>
                    </HStack>
                  </Stack>
                </Panel>
              );
            }}
          </For>
        </Grid>
      )}
      {actionError && <Notice error>{actionError}</Notice>}
      <Panel
        title="What changed for you"
        description="New rule versions can change the estimate for a saved home."
      >
        <Show
          when={notifications.data?.length}
          fallback={
            <Paragraph tone="secondary">
              No rule-change notifications yet. Your saved results keep the exact assumptions they
              used.
            </Paragraph>
          }
        >
          <Stack gap={4}>
            <For each={notifications.data ?? []}>
              {(n) => (
                <HStack key={n.id} gap={3}>
                  <Bell size={18} aria-hidden="true" />
                  <Paragraph>{n.message}</Paragraph>
                </HStack>
              )}
            </For>
          </Stack>
        </Show>
      </Panel>
      <HStack gap={3}>
        <Sun size={20} aria-hidden="true" />
        <Paragraph variant="body-sm" tone="secondary">
          A good next step: confirm your roof, connection and vendor documents before committing
          money.
        </Paragraph>
      </HStack>
    </Stack>
  );
}
