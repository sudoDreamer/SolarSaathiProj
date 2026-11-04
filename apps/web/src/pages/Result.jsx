import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowDownToLine, ArrowUpRight, Bookmark } from 'lucide-react';
import { Table } from '@flowstack-ui/brick';
import { api, post } from '../api.js';
import { useSession } from '../session.jsx';
import {
  Accordion,
  ActionLink,
  Badge,
  Button,
  Checkbox,
  Container,
  ErrorState,
  For,
  Grid,
  HStack,
  LightUpScene,
  Link,
  Loading,
  Metric,
  Notice,
  PageTitle,
  Panel,
  Paragraph,
  Section,
  Stack,
  Text,
  TextField,
  compactMoney,
  money,
  useResource,
} from '../ui.jsx';
export default function Result() {
  const { calculationId } = useParams(),
    navigate = useNavigate(),
    { user } = useSession();
  const {
    data: row,
    error,
    loading,
    reload,
  } = useResource(() => api(`/calculations/${calculationId}`), [calculationId]);
  const [scenario, setScenario] = useState('CONSUMPTION_CAP'),
    [checked, setChecked] = useState([]),
    [stale, setStale] = useState(false),
    [saving, setSaving] = useState(false),
    [actionError, setActionError] = useState(''),
    [savedId, setSavedId] = useState(''),
    [nickname, setNickname] = useState('My home');
  useEffect(() => {
    if (row) {
      setScenario(row.outputSnapshot.headlineScenario);
      void api('/rules/active').then((s) => setStale(s.rule.id !== row.ruleSnapshot.rule.id));
    }
  }, [row]);
  useEffect(() => {
    const stream = new EventSource('/api/v1/stream/rules');
    stream.addEventListener('rules', () => setStale(true));
    return () => stream.close();
  }, []);
  if (loading)
    return (
      <Section>
        <Container>
          <Loading />
        </Container>
      </Section>
    );
  if (error || !row)
    return (
      <Section>
        <Container>
          <ErrorState error={error || 'Result unavailable'} retry={reload} />
        </Container>
      </Section>
    );
  const output = row.outputSnapshot,
    result = output.scenarios[scenario];
  const offset =
    result.billBeforeInr > 0
      ? Math.max(0, Math.min(1, 1 - result.billAfterInr / result.billBeforeInr))
      : 0;
  async function save() {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/result/${calculationId}?save=1`)}`);
      return;
    }
    if (!row) return;
    setSaving(true);
    setActionError('');
    try {
      if (!row.userId) {
        const claimToken = sessionStorage.getItem(`ss-claim-${calculationId}`);
        if (!claimToken)
          throw new Error(
            'This browser does not have the claim key. Run a new calculation while signed in.',
          );
        await post(`/calculations/${calculationId}/claim`, { claimToken });
        sessionStorage.removeItem(`ss-claim-${calculationId}`);
      }
      const home = await post('/households', { nickname, calculationId });
      setSavedId(home.id);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }
  async function recalculate() {
    try {
      const updated = await post('/calculate', row.inputSnapshot);
      sessionStorage.setItem(`ss-claim-${updated.id}`, updated.claimToken);
      navigate(`/result/${updated.id}`);
    } catch (e) {
      setActionError(String(e));
    }
  }
  return (
    <div className="scene-page scene-sun result-page">
      <Section>
        <Container>
          <Stack gap={9}>
            <PageTitle
              eyebrow="YOUR ROOF. YOUR POSSIBILITIES."
              title="A brighter outlook for your home."
              action={
                <ActionLink to={`/calculate?edit=${calculationId}`} secondary>
                  Edit my inputs
                </ActionLink>
              }
            >
              Every figure below comes from your inputs and the saved rule snapshot.
            </PageTitle>
            {stale && (
              <Notice>
                A newer rule snapshot is available. This result preserves its original assumptions.{' '}
                <Button size="sm" variant="outline" onClick={() => void recalculate()}>
                  Recalculate
                </Button>
              </Notice>
            )}
            <Panel className="result-headline">
              <Grid templateColumns={{ initial: '1fr', md: '1.5fr 1fr' }} gap={8} align="center">
                <Stack gap={5}>
                  <HStack gap={3} wrap="wrap">
                    <Badge tone="warning" variant="surface">
                      {output.historyStatus === 'INSUFFICIENT'
                        ? 'Provisional · incomplete history'
                        : 'Planning estimate'}
                    </Badge>
                    <Badge tone="neutral" variant="outline">
                      {row.ruleSnapshot.rule.enforcementStatus.replaceAll('_', ' ')}
                    </Badge>
                  </HStack>
                  <Text variant="body-lg">Your estimated system size</Text>
                  <HStack gap={4} align="baseline">
                    <Text variant="display-xl" numeric="tabular" className="capacity-number">
                      {result.capacityKw.toFixed(2)}
                    </Text>
                    <Text variant="title-xl">kW</Text>
                  </HStack>
                  <Paragraph>
                    {scenario === 'CONSUMPTION_CAP'
                      ? 'Under the reported consumption-cap model'
                      : 'Under the sanctioned-load model, up to the snapshot’s deemed-approval limit'}
                    . This is not an approval.
                  </Paragraph>
                  <HStack gap={3} wrap="wrap">
                    <Button
                      variant={scenario === 'CONSUMPTION_CAP' ? 'solid' : 'outline'}
                      tone={scenario === 'CONSUMPTION_CAP' ? 'accent' : 'neutral'}
                      onClick={() => setScenario('CONSUMPTION_CAP')}
                      aria-pressed={scenario === 'CONSUMPTION_CAP'}
                    >
                      Consumption cap
                    </Button>
                    <Button
                      variant={scenario === 'LEGAL_MAX' ? 'solid' : 'outline'}
                      tone={scenario === 'LEGAL_MAX' ? 'accent' : 'neutral'}
                      onClick={() => setScenario('LEGAL_MAX')}
                      aria-pressed={scenario === 'LEGAL_MAX'}
                    >
                      Sanctioned-load path
                    </Button>
                  </HStack>
                </Stack>
                <Stack gap={5} align="center">
                  <LightUpScene offset={offset} />
                  <Text variant="body-sm">{Math.round(offset * 100)}% modelled bill offset</Text>
                  <Text variant="caption">Lights reflect your estimate.</Text>
                </Stack>
              </Grid>
            </Panel>
            <Grid columns={{ initial: 1, sm: 2, lg: 4 }} gap={5}>
              <Panel>
                <Metric
                  label="Central subsidy"
                  value={money(result.subsidyInr)}
                  help="Subject to scheme approval"
                />
              </Panel>
              <Panel>
                <Metric
                  label="Net installation cost"
                  value={money(result.netCostInr)}
                  help={
                    row.inputSnapshot.vendorQuoteInr === undefined
                      ? 'Illustrative cost minus subsidy'
                      : 'Your quote minus subsidy'
                  }
                />
              </Panel>
              <Panel>
                <Metric
                  label="Estimated monthly saving"
                  value={money(result.monthlySavingsInr)}
                  positive
                  help={`${money(result.billBeforeInr)} → ${money(result.billAfterInr)} per month`}
                />
              </Panel>
              <Panel>
                <Metric
                  label="Estimated payback"
                  value={
                    result.paybackYears === null ? 'Not reached' : `${result.paybackYears} years`
                  }
                  help="With degradation & inverter replacement"
                />
              </Panel>
            </Grid>
            <Notice>
              <Stack gap={3}>
                <For each={output.warnings}>
                  {(warning) => (
                    <Paragraph key={warning} variant="body-sm">
                      {warning}
                    </Paragraph>
                  )}
                </For>
              </Stack>
            </Notice>
            <Grid columns={{ initial: 1, lg: 2 }} gap={6}>
              <Panel
                title="Your year in sunlight"
                description="Modelled generation and consumption, in kWh"
              >
                <div
                  className="chart-frame"
                  role="img"
                  aria-label={`Estimated annual generation ${result.annualGenerationKwh} kWh; see the data table below.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={result.monthly}
                      margin={{ top: 15, right: 10, bottom: 5, left: 0 }}
                    >
                      <CartesianGrid vertical={false} stroke="var(--ss-border)" />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: 'var(--ss-muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        width={42}
                        tick={{ fill: 'var(--ss-muted)', fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'var(--ss-panel)',
                          borderColor: 'var(--ss-border)',
                          borderRadius: 10,
                          color: 'var(--ss-text)',
                        }}
                      />
                      <Legend />
                      <Bar
                        dataKey="consumptionKwh"
                        name="Consumption"
                        fill="var(--ss-teal)"
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      />
                      <Bar
                        dataKey="generationKwh"
                        name="Generation"
                        fill="var(--ss-amber)"
                        radius={[3, 3, 0, 0]}
                        isAnimationActive={false}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <Paragraph variant="body-sm" tone="secondary">
                  Monsoon months use a lower seeded yield. Actual roof orientation, shading and
                  weather can change generation.
                </Paragraph>
              </Panel>
              <Panel
                title="The longer view"
                description="Cumulative savings after upfront cost, in rupees"
              >
                <div
                  className="chart-frame"
                  role="img"
                  aria-label={`Modelled net savings after 25 years: ${money(result.savings25yrInr)}. Inverter replacement in year ${row.ruleSnapshot.economics.inverterReplacementYear}.`}
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={result.projection}
                      margin={{ top: 15, right: 15, bottom: 5, left: 5 }}
                    >
                      <CartesianGrid vertical={false} stroke="var(--ss-border)" />
                      <XAxis
                        dataKey="year"
                        tick={{ fill: 'var(--ss-muted)', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        width={65}
                        tickFormatter={(n) => `${Math.round(Number(n) / 1000)}k`}
                        tick={{ fill: 'var(--ss-muted)', fontSize: 12 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        formatter={(value) => money(Number(value))}
                        contentStyle={{
                          background: 'var(--ss-panel)',
                          borderColor: 'var(--ss-border)',
                          color: 'var(--ss-text)',
                        }}
                      />
                      <ReferenceLine y={0} stroke="var(--ss-muted)" />
                      <ReferenceLine
                        x={row.ruleSnapshot.economics.inverterReplacementYear}
                        stroke="var(--ss-muted)"
                        strokeDasharray="4 4"
                      />
                      <Area
                        dataKey="netSavingsInr"
                        name="Net savings"
                        stroke="var(--ss-teal)"
                        fill="var(--ss-teal)"
                        fillOpacity={0.1}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <HStack justify="between" gap={4}>
                  <Metric
                    label="25-year net saving"
                    value={compactMoney(result.savings25yrInr)}
                    positive={result.savings25yrInr > 0}
                  />
                  <Text variant="caption">
                    Inverter replacement:
                    <br />
                    year {row.ruleSnapshot.economics.inverterReplacementYear}
                  </Text>
                </HStack>
              </Panel>
            </Grid>
            <Panel title="Why this size?" description="The limits behind the estimate">
              <Grid columns={{ initial: 1, sm: 2, lg: 4 }} gap={6}>
                <Metric label="Average monthly use" value={`${output.averageMonthlyUnits} kWh`} />
                <Metric label="Consumption model limit" value={`${output.consumptionCapKw} kW`} />
                <Metric label="Usable-roof limit" value={`${output.roofCapKw} kW`} />
                <Metric
                  label="Sanctioned load"
                  value={`${row.inputSnapshot.sanctionedLoadKw} kW`}
                />
              </Grid>
              <Paragraph variant="body-sm">
                Consumption model: average monthly units × {row.ruleSnapshot.rule.capFactor} ÷{' '}
                {row.ruleSnapshot.rule.genUnitsPerKwMonth}. Physical roof and sanctioned load remain
                safety limits. The alternative path uses the lower of sanctioned load,{' '}
                {row.ruleSnapshot.rule.deemedApprovalMaxKw} kW and roof capacity.
              </Paragraph>
            </Panel>
            <Panel
              title="A clearer path to approval"
              description={`${checked.length} of ${output.checklist.length} checks completed in this view`}
            >
              <Stack gap={5}>
                <Accordion.Root type="multiple" variant="plain">
                  <For each={output.checklist}>
                    {(item) => (
                      <Accordion.Item key={item.code} value={item.code}>
                        <HStack justify="between" gap={3}>
                          <Accordion.Header as="h3">
                            <Accordion.Trigger>
                              {item.title}
                              <Accordion.Indicator />
                            </Accordion.Trigger>
                          </Accordion.Header>
                          <Checkbox
                            checked={checked.includes(item.code)}
                            onCheckedChange={(value) =>
                              setChecked((v) =>
                                value === true
                                  ? [...v, item.code]
                                  : v.filter((k) => k !== item.code),
                              )
                            }
                            aria-label={`Complete: ${item.title}`}
                          >
                            Done
                          </Checkbox>
                        </HStack>
                        <Accordion.Content>
                          <Accordion.ContentInner>
                            <Stack gap={3}>
                              <Badge tone={item.severity === 'MUST_FIX' ? 'danger' : 'warning'}>
                                {item.severity.replaceAll('_', ' ')}
                              </Badge>
                              <Paragraph>{item.why}</Paragraph>
                              <Paragraph>{item.fix}</Paragraph>
                              <Link to={item.sourceUrl}>
                                Check the official source <ArrowUpRight size={15} />
                              </Link>
                            </Stack>
                          </Accordion.ContentInner>
                        </Accordion.Content>
                      </Accordion.Item>
                    )}
                  </For>
                </Accordion.Root>
                <Paragraph variant="body-sm" tone="secondary">
                  Checking an item records your review in this view; it does not verify documents or
                  submit an application.
                </Paragraph>
              </Stack>
            </Panel>
            <Panel
              title="Keep your solar journey in one place"
              description="Save this result to a household, then add bills and follow your next steps."
            >
              <Stack gap={5}>
                <HStack gap={4} align="end" wrap="wrap">
                  <Stack.Item flex="auto">
                    <TextField label="Household name" value={nickname} onChange={setNickname} />
                  </Stack.Item>
                  <Button startIcon={<Bookmark />} loading={saving} onClick={() => void save()}>
                    {user ? 'Save household' : 'Log in to save'}
                  </Button>
                  <Button
                    variant="outline"
                    startIcon={<ArrowDownToLine />}
                    onClick={() => window.print()}
                  >
                    Print / Save PDF
                  </Button>
                </HStack>
                {savedId && (
                  <Link to={`/app/households/${savedId}`}>
                    Household saved — open overview <ArrowUpRight size={16} />
                  </Link>
                )}
                {actionError && <Notice error>{actionError}</Notice>}
                <Link to="https://pmsuryaghar.gov.in/">
                  Open the official national portal <ArrowUpRight size={16} />
                </Link>
              </Stack>
            </Panel>
            <Accordion.Root variant="plain" type="multiple">
              <Accordion.Item value="assumptions">
                <Accordion.Header as="h2">
                  <Accordion.Trigger>
                    Assumptions & saved version IDs
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  <Accordion.ContentInner>
                    <Stack gap={3}>
                      <Paragraph>
                        Engine {output.engineVersion} · Capacity {output.versions.ruleVersionId} ·
                        Tariff {output.versions.tariffVersionId} · Subsidy{' '}
                        {output.versions.subsidySchemeId}
                      </Paragraph>
                      <Paragraph>
                        Capacity verified: {row.ruleSnapshot.rule.verifiedOn ?? 'Not verified'}.
                        Tariff verified: {row.ruleSnapshot.tariff.verifiedOn ?? 'Not verified'}.
                        Yield and carbon factor: illustrative seeds. Flat tariffs and consumption
                        are assumed across the projection; inflation, financing and maintenance
                        beyond the specified inverter event are excluded.
                      </Paragraph>
                      <Paragraph>
                        Monthly credits are modelled as banking forward within one Jan–Dec year, not
                        a verified regulatory settlement calendar. {result.co2AvoidedKgPerYear} kg
                        CO₂/year is indicative only.
                      </Paragraph>
                      <Link to="/rules">View source notes and limitations</Link>
                    </Stack>
                  </Accordion.ContentInner>
                </Accordion.Content>
              </Accordion.Item>
              <Accordion.Item value="data">
                <Accordion.Header as="h2">
                  <Accordion.Trigger>
                    Monthly chart data
                    <Accordion.Indicator />
                  </Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Content>
                  <Accordion.ContentInner>
                    <Table.Container>
                      <Table.Root>
                        <Table.Caption>
                          Estimated monthly consumption, generation and bills
                        </Table.Caption>
                        <Table.Header>
                          <Table.Row>
                            <Table.Head>Month</Table.Head>
                            <Table.Head>Use (kWh)</Table.Head>
                            <Table.Head>Solar (kWh)</Table.Head>
                            <Table.Head>Before</Table.Head>
                            <Table.Head>After</Table.Head>
                          </Table.Row>
                        </Table.Header>
                        <Table.Body>
                          <For each={result.monthly}>
                            {(m) => (
                              <Table.Row key={m.month}>
                                <Table.Head scope="row">{m.month}</Table.Head>
                                <Table.Cell>{m.consumptionKwh}</Table.Cell>
                                <Table.Cell>{m.generationKwh}</Table.Cell>
                                <Table.Cell>{money(m.billBeforeInr)}</Table.Cell>
                                <Table.Cell>{money(m.billAfterInr)}</Table.Cell>
                              </Table.Row>
                            )}
                          </For>
                        </Table.Body>
                      </Table.Root>
                    </Table.Container>
                  </Accordion.ContentInner>
                </Accordion.Content>
              </Accordion.Item>
            </Accordion.Root>
          </Stack>
        </Container>
      </Section>
    </div>
  );
}
