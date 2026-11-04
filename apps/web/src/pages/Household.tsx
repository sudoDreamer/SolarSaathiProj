import { useState } from 'react';
import { Outlet, useOutletContext, useParams, useLocation } from 'react-router-dom';
import { ArrowUpRight, CalendarCheck, Check, Plus } from 'lucide-react';
import { Table } from '@flowstack-ui/brick';
import type { Household, SavedCalculation, Bill, Application } from '../../../api/src/types';
import { billSchema, type BillInput } from '../../../../packages/schemas';
import { energyBill } from '../../../../packages/engine';
import { api, post } from '../api';
import {
  ActionLink,
  Badge,
  BulbString,
  Button,
  Checkbox,
  Empty,
  ErrorState,
  For,
  Grid,
  Heading,
  HStack,
  Link,
  Loading,
  Metric,
  NavList,
  Notice,
  NumberField,
  PageTitle,
  Panel,
  Paragraph,
  SavingsJar,
  SelectField,
  Show,
  Stack,
  Text,
  TextField,
  money,
  useResource,
} from '../ui';
type Home = Household & { calculation: SavedCalculation };
type HomeContext = { home: Home };
export default function HouseholdPage() {
  const { householdId } = useParams(),
    location = useLocation(),
    resource = useResource(() => api<Home>(`/households/${householdId}`), [householdId]);
  if (resource.loading) return <Loading />;
  if (resource.error || !resource.data)
    return <ErrorState error={resource.error || 'Household unavailable'} retry={resource.reload} />;
  const home = resource.data,
    base = `/app/households/${home.id}`;
  return (
    <Stack gap={7}>
      <PageTitle
        eyebrow={`${home.input.districtCode} · MSEDCL`}
        title={home.nickname}
        action={
          <ActionLink to={`/result/${home.calculationId}`} secondary>
            View saved result
          </ActionLink>
        }
      >
        {home.input.sanctionedLoadKw} kW sanctioned load · {home.input.roofAreaSqM.toFixed(1)} sq m
        roof · {home.solarStatus.toLowerCase().replaceAll('_', ' ')}
      </PageTitle>
      <nav aria-label="Household sections">
        <HStack gap={2} wrap="wrap">
          <For
            each={[
              ['Overview', base],
              ['Bills', base + '/bills'],
              ['Compare', base + '/compare'],
              ['Application', base + '/application'],
            ]}
          >
            {([label, to]) => (
              <Button
                key={to}
                href={to}
                variant={location.pathname === to ? 'solid' : 'outline'}
                tone={location.pathname === to ? 'accent' : 'neutral'}
              >
                {label}
              </Button>
            )}
          </For>
        </HStack>
      </nav>
      <Outlet context={{ home } satisfies HomeContext} />
    </Stack>
  );
}
export function HouseholdOverview() {
  const { home } = useOutletContext<HomeContext>(),
    output = home.calculation.outputSnapshot,
    r = output.scenarios[output.headlineScenario];
  return (
    <Stack gap={7}>
      <Grid columns={{ initial: 1, md: 3 }} gap={5}>
        <Panel>
          <Metric label="Estimated capacity" value={`${r.capacityKw} kW`} />
        </Panel>
        <Panel>
          <Metric label="Central subsidy estimate" value={money(r.subsidyInr)} />
        </Panel>
        <Panel>
          <Metric label="Estimated monthly saving" value={money(r.monthlySavingsInr)} positive />
        </Panel>
      </Grid>
      <Panel title="Your next little step" description="Build a history you can come back to.">
        <Stack gap={5}>
          <Paragraph>
            Add your monthly electricity bills to compare usage and costs. When you apply for solar,
            keep your own application references and completed steps together.
          </Paragraph>
          <HStack gap={4} wrap="wrap">
            <ActionLink to={`/app/households/${home.id}/bills`}>Add my first bill</ActionLink>
            <ActionLink to={`/app/households/${home.id}/application`} secondary>
              Open application tracker
            </ActionLink>
          </HStack>
        </Stack>
      </Panel>
      <Notice>
        The saved estimate uses {output.versions.ruleVersionId} and{' '}
        {output.versions.tariffVersionId}. It stays unchanged when new rules are published.
      </Notice>
    </Stack>
  );
}
const emptyBill = (): BillInput => ({
  billMonth: new Date().toISOString().slice(0, 7),
  unitsKwh: 0,
  amountInr: 0,
  fixedChargeInr: 0,
  facInr: 0,
  dutyInr: 0,
});
function csv(rows: Bill[]) {
  const text = [
    'month,units_kwh,amount_inr,fixed_charge_inr,fac_inr,duty_inr',
    ...rows.map((b) =>
      [b.billMonth, b.unitsKwh, b.amountInr, b.fixedChargeInr, b.facInr, b.dutyInr].join(','),
    ),
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })),
    a = document.createElement('a');
  a.href = url;
  a.download = 'solarsaathi-bills.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function BillsPage() {
  const { home } = useOutletContext<HomeContext>(),
    base = `/households/${home.id}`,
    resource = useResource(() => api<Bill[]>(base + '/bills'), [home.id]);
  const [open, setOpen] = useState(false),
    [form, setForm] = useState(emptyBill),
    [edit, setEdit] = useState<Bill | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [deleted, setDeleted] = useState<Bill | null>(null);
  const change = <K extends keyof BillInput>(key: K, value: BillInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  async function save() {
    setBusy(true);
    setError('');
    try {
      const value = billSchema.parse(form);
      if (edit)
        await api(`${base}/bills/${edit.billMonth}`, {
          method: 'PATCH',
          headers: { 'If-Match': String(edit.version) },
          body: JSON.stringify(value),
        });
      else await post(base + '/bills', value);
      setOpen(false);
      setEdit(null);
      resource.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }
  async function remove(bill: Bill) {
    try {
      await api(`${base}/bills/${bill.billMonth}`, { method: 'DELETE' });
      setDeleted(bill);
      resource.reload();
    } catch (e) {
      setError(String(e));
    }
  }
  const bills = resource.data ?? [],
    saving = bills.reduce(
      (sum, b) => sum + energyBill(b.unitsKwh, home.calculation.ruleSnapshot.tariff) - b.amountInr,
      0,
    );
  return (
    <Stack gap={7}>
      <HStack justify="between" wrap="wrap" gap={4}>
        <Heading level={2} variant="title-xl">
          Your bills, a little clearer.
        </Heading>
        <HStack gap={3}>
          <Button variant="outline" disabled={!bills.length} onClick={() => csv(bills)}>
            Export CSV
          </Button>
          <Button
            startIcon={<Plus />}
            onClick={() => {
              setOpen((v) => !v);
              setEdit(null);
              setForm(emptyBill());
            }}
          >
            Add a bill
          </Button>
        </HStack>
      </HStack>
      {bills.length > 0 && (
        <Panel>
          <SavingsJar value={saving} label="Difference from modelled bill cost" />
          <Paragraph variant="body-sm" tone="secondary">
            This compares each recorded amount with the saved tariff applied to that same bill’s
            units. It is a cost variance, not measured solar savings. Solar savings require a
            comparable pre-solar baseline.
          </Paragraph>
        </Panel>
      )}
      {deleted && (
        <Notice>
          {deleted.billMonth} bill deleted.{' '}
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              void post(base + '/bills', deleted)
                .then(() => {
                  setDeleted(null);
                  resource.reload();
                })
                .catch((e) => setError(String(e)))
            }
          >
            Undo
          </Button>
        </Notice>
      )}
      {open && (
        <Panel
          title={edit ? `Edit ${edit.billMonth} bill` : 'Add a monthly electricity bill'}
          description="Manual entry · use the final payable amount and units from your bill."
        >
          <Stack gap={5}>
            <Grid columns={{ initial: 1, md: 3 }} gap={5}>
              <TextField
                label="Bill month"
                type="month"
                value={form.billMonth}
                onChange={(v) => change('billMonth', v)}
              />
              <NumberField
                label="Units consumed"
                value={form.unitsKwh}
                unit="kWh"
                onChange={(v) => change('unitsKwh', v ?? 0)}
              />
              <NumberField
                label="Bill amount"
                value={form.amountInr}
                unit="₹"
                onChange={(v) => change('amountInr', v ?? 0)}
              />
              <NumberField
                label="Fixed charge"
                value={form.fixedChargeInr}
                unit="₹"
                onChange={(v) => change('fixedChargeInr', v ?? 0)}
              />
              <NumberField
                label="Fuel adjustment charge"
                value={form.facInr}
                unit="₹"
                onChange={(v) => change('facInr', v ?? 0)}
              />
              <NumberField
                label="Electricity duty"
                value={form.dutyInr}
                unit="₹"
                onChange={(v) => change('dutyInr', v ?? 0)}
              />
              <NumberField
                label="Imported units (if installed)"
                value={form.unitsImportedKwh ?? null}
                unit="kWh"
                onChange={(v) => change('unitsImportedKwh', v ?? undefined)}
              />
              <NumberField
                label="Exported units (if installed)"
                value={form.unitsExportedKwh ?? null}
                unit="kWh"
                onChange={(v) => change('unitsExportedKwh', v ?? undefined)}
              />
              <NumberField
                label="Banked units (if installed)"
                value={form.bankedUnitsKwh ?? null}
                unit="kWh"
                onChange={(v) => change('bankedUnitsKwh', v ?? undefined)}
              />
            </Grid>
            <HStack gap={3}>
              <Button loading={busy} onClick={() => void save()}>
                Save bill
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </HStack>
          </Stack>
        </Panel>
      )}
      {error && <Notice error>{error}</Notice>}
      {resource.loading ? (
        <Loading />
      ) : resource.error ? (
        <ErrorState error={resource.error} retry={resource.reload} />
      ) : bills.length ? (
        <Panel>
          <Table.Container>
            <Table.Root minInlineSize="640px">
              <Table.Caption>Recorded monthly electricity bills</Table.Caption>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Month</Table.Head>
                  <Table.Head>Units</Table.Head>
                  <Table.Head>Amount</Table.Head>
                  <Table.Head>Change</Table.Head>
                  <Table.Head>Actions</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                <For each={bills}>
                  {(bill, index) => (
                    <Table.Row key={bill.id}>
                      <Table.Head scope="row">{bill.billMonth}</Table.Head>
                      <Table.Cell>{bill.unitsKwh} kWh</Table.Cell>
                      <Table.Cell>{money(bill.amountInr)}</Table.Cell>
                      <Table.Cell>
                        {index
                          ? `${bill.amountInr - bills[index - 1].amountInr >= 0 ? '+' : '−'}${money(Math.abs(bill.amountInr - bills[index - 1].amountInr))}`
                          : 'First bill'}
                      </Table.Cell>
                      <Table.Cell>
                        <HStack gap={2}>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEdit(bill);
                              setForm(bill);
                              setOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => void remove(bill)}>
                            Delete
                          </Button>
                        </HStack>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </For>
              </Table.Body>
            </Table.Root>
          </Table.Container>
        </Panel>
      ) : (
        <Panel>
          <Empty title="Every bill tells a story.">
            Add your first bill to start a monthly history. No example bill amounts have been added
            to your account.
          </Empty>
        </Panel>
      )}
    </Stack>
  );
}
export function ComparePage() {
  const { home } = useOutletContext<HomeContext>(),
    resource = useResource(() => api<Bill[]>(`/households/${home.id}/bills`), [home.id]);
  const [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  if (resource.loading) return <Loading />;
  if (resource.error) return <ErrorState error={resource.error} retry={resource.reload} />;
  const bills = resource.data ?? [];
  if (bills.length < 2)
    return (
      <Panel>
        <Empty title="Two bills. A clearer comparison.">
          Add at least two monthly bills to compare your real costs and consumption.
        </Empty>
        <ActionLink to={`/app/households/${home.id}/bills`}>Add bills</ActionLink>
      </Panel>
    );
  const a = bills.find((b) => b.id === from) ?? bills[bills.length - 2],
    b = bills.find((b) => b.id === to) ?? bills[bills.length - 1],
    diff = b.amountInr - a.amountInr;
  return (
    <Stack gap={7}>
      <Panel title="See what changed between two months">
        <Grid columns={{ initial: 1, md: 2 }} gap={6}>
          <SelectField
            label="Compare from"
            value={a.id}
            onChange={setFrom}
            options={bills.map((row) => ({ value: row.id, label: row.billMonth }))}
          />
          <SelectField
            label="Compare to"
            value={b.id}
            onChange={setTo}
            options={bills.map((row) => ({ value: row.id, label: row.billMonth }))}
          />
        </Grid>
      </Panel>
      <PageTitle title={`${money(Math.abs(diff))} ${diff <= 0 ? 'lower' : 'higher'}.`}>
        {a.billMonth} → {b.billMonth}. Consumption changed by {b.unitsKwh - a.unitsKwh} kWh. This
        comparison does not establish the cause.
      </PageTitle>
      <Grid columns={{ initial: 1, md: 2 }} gap={6}>
        <For each={[a, b]}>
          {(bill) => (
            <Panel key={bill.id + (bill === a ? 'a' : 'b')} title={bill.billMonth}>
              <Stack gap={5}>
                <Metric label="Total bill" value={money(bill.amountInr)} />
                <div className="comparison-bar" role="img" aria-label={`${bill.unitsKwh} kWh`}>
                  <div
                    style={{
                      width: `${Math.max(2, (bill.unitsKwh / Math.max(a.unitsKwh, b.unitsKwh, 1)) * 100)}%`,
                    }}
                  />
                </div>
                <Text>{bill.unitsKwh} kWh</Text>
              </Stack>
            </Panel>
          )}
        </For>
      </Grid>
      <Panel>
        <Table.Container>
          <Table.Root>
            <Table.Caption>Recorded line items and total difference</Table.Caption>
            <Table.Header>
              <Table.Row>
                <Table.Head>Component</Table.Head>
                <Table.Head>{a.billMonth}</Table.Head>
                <Table.Head>{b.billMonth}</Table.Head>
                <Table.Head>Difference</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              <For
                each={
                  [
                    ['Total amount', a.amountInr, b.amountInr],
                    ['Fixed charge', a.fixedChargeInr, b.fixedChargeInr],
                    ['FAC', a.facInr, b.facInr],
                    ['Duty', a.dutyInr, b.dutyInr],
                  ] as const
                }
              >
                {([label, av, bv]) => (
                  <Table.Row key={label}>
                    <Table.Head scope="row">{label}</Table.Head>
                    <Table.Cell>{money(av)}</Table.Cell>
                    <Table.Cell>{money(bv)}</Table.Cell>
                    <Table.Cell>{money(bv - av)}</Table.Cell>
                  </Table.Row>
                )}
              </For>
            </Table.Body>
          </Table.Root>
        </Table.Container>
      </Panel>
    </Stack>
  );
}
export function TrackerPage() {
  const { home } = useOutletContext<HomeContext>(),
    resource = useResource(() => api<Application>(`/households/${home.id}/application`), [home.id]);
  const [form, setForm] = useState<Application | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  const state = form ?? resource.data;
  if (resource.loading) return <Loading />;
  if (resource.error || !state)
    return <ErrorState error={resource.error || 'Tracker unavailable'} retry={resource.reload} />;
  const change = <K extends keyof Application>(key: K, value: Application[K]) =>
    setForm({ ...state, [key]: value });
  const steps = [
    'Decide & size your system',
    'Choose a registered vendor',
    'Apply on the national portal',
    'DISCOM feasibility approved',
    'Install your system',
    'Inspection & net meter',
    'Commission the installation',
    'Subsidy credited',
  ];
  const deadline = state.sanctionedOn ? new Date(state.sanctionedOn + 'T00:00:00') : null;
  if (deadline) deadline.setMonth(deadline.getMonth() + 6);
  async function save() {
    setBusy(true);
    setMessage('');
    try {
      const data = await api<Application>(`/households/${home.id}/application`, {
        method: 'PUT',
        body: JSON.stringify(state),
      });
      setForm(data);
      setMessage('Application tracker saved.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap={7}>
      <PageTitle title="A step closer to sunlight.">
        Your personal record of progress. SolarSaathi does not submit or check government
        applications.
      </PageTitle>
      <Panel>
        <Stack gap={5}>
          <SelectField
            label="Current application stage"
            value={String(state.stage)}
            onChange={(v) => change('stage', Number(v))}
            options={steps.map((label, i) => ({ value: String(i), label }))}
          />
          <Grid columns={{ initial: 1, md: 3 }} gap={5}>
            <TextField
              label="National portal application number"
              value={state.nationalPortalAppNo}
              onChange={(v) => change('nationalPortalAppNo', v)}
            />
            <TextField
              label="MSEDCL application number"
              value={state.discomAppNo}
              onChange={(v) => change('discomAppNo', v)}
            />
            <TextField
              label="Sanction date"
              type="date"
              value={state.sanctionedOn}
              onChange={(v) => change('sanctionedOn', v)}
            />
          </Grid>
          {deadline && (
            <Notice>
              Planning reminder: six months from your entered sanction date is{' '}
              {deadline.toLocaleDateString('en-IN')}. Verify the actual commissioning deadline on
              your sanction letter. No automated reminder is sent.
            </Notice>
          )}
          <Stack gap={4}>
            <For each={steps}>
              {(label, i) => (
                <HStack key={label} gap={4} className="tracker-step">
                  <span
                    className={
                      i < state.stage
                        ? 'tracker-marker completed'
                        : i === state.stage
                          ? 'tracker-marker current'
                          : 'tracker-marker'
                    }
                    aria-hidden="true"
                  >
                    {i < state.stage ? <Check size={16} /> : i + 1}
                  </span>
                  <Stack.Item flex="auto">
                    <Text weight={i === state.stage ? 'semibold' : 'regular'}>{label}</Text>
                  </Stack.Item>
                  <TextField
                    label={`${label} date`}
                    type="date"
                      value={state.steps?.[String(i)] ?? ''}
                    onChange={(v) => change('steps', { ...state.steps, [i]: v })}
                  />
                </HStack>
              )}
            </For>
          </Stack>
          <HStack gap={4}>
            <Button loading={busy} onClick={() => void save()}>
              Save progress
            </Button>
            {message && <Text role="status">{message}</Text>}
          </HStack>
          <Link to="https://pmsuryaghar.gov.in/">
            Open national portal <ArrowUpRight size={15} />
          </Link>
        </Stack>
      </Panel>
    </Stack>
  );
}
