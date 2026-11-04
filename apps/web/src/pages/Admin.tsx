import { useState } from 'react';
import { AlertDialog, Table } from '@flowstack-ui/brick';
import { Check, FileClock, Shield, X } from 'lucide-react';
import type { Audit, RuleVersion } from '../../../api/src/types';
import type { RuleSnapshot } from '../../../../packages/schemas';
import { calculate } from '../../../../packages/engine';
import { acceptSession, api, post, type Viewer } from '../api';
import { useSession } from '../session';
import {
  Appearance,
  Badge,
  Button,
  Checkbox,
  For,
  Grid,
  Heading,
  HStack,
  Input,
  Link,
  Loading,
  Metric,
  Notice,
  NumberField,
  PageTitle,
  Panel,
  Paragraph,
  SelectField,
  Stack,
  Text,
  TextField,
  money,
  useResource,
} from '../ui';
import { billMonths, districts } from './Calculator';
type Overview = { versions: RuleVersion[]; auditLogs: Audit[]; households: number; users: number };
export default function AdminPage() {
  const { user } = useSession(),
    resource = useResource(() => api<Overview>('/admin/overview'));
  const [draft, setDraft] = useState<RuleSnapshot | null>(null),
    [tab, setTab] = useState('capacity'),
    [note, setNote] = useState(''),
    [error, setError] = useState(''),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [mobile, setMobile] = useState('9999999991'),
    [challenge, setChallenge] = useState(''),
    [code, setCode] = useState(''),
    [devCode, setDevCode] = useState(''),
    [stepped, setStepped] = useState(false);
  if (resource.loading) return <Loading />;
  if (resource.error || !resource.data)
    return <Notice error>{resource.error || 'Could not load the admin console.'}</Notice>;
  const active = resource.data.versions.find((v) => v.status === 'ACTIVE')!,
    state = draft ?? structuredClone(active.snapshot),
    pending = resource.data.versions.filter((v) => v.status === 'PENDING_REVIEW');
  const updateRule = <K extends keyof RuleSnapshot['rule']>(
    key: K,
    value: RuleSnapshot['rule'][K],
  ) => setDraft({ ...state, rule: { ...state.rule, [key]: value } });
  const updateTariff = <K extends keyof RuleSnapshot['tariff']>(
    key: K,
    value: RuleSnapshot['tariff'][K],
  ) => setDraft({ ...state, tariff: { ...state.tariff, [key]: value } });
  const updateScheme = <K extends keyof RuleSnapshot['subsidy']>(
    key: K,
    value: RuleSnapshot['subsidy'][K],
  ) => setDraft({ ...state, subsidy: { ...state.subsidy, [key]: value } });
  async function task(fn: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  async function submit() {
    await task(async () => {
      await post('/admin/versions', {
        rule: state.rule,
        tariff: state.tariff,
        subsidy: state.subsidy,
        yields: state.yields,
        note,
        baseVersionId: active.id,
      });
      setMessage('Snapshot submitted. A different admin must review and approve it.');
      setDraft(null);
      setNote('');
      resource.reload();
    });
  }
  async function requestStep() {
    await task(async () => {
      const r = await post<{ challengeId: string; devCode?: string }>('/auth/otp/request', {
        mobile,
        purpose: 'STEP_UP',
      });
      setChallenge(r.challengeId);
      setDevCode(r.devCode || '');
    });
  }
  async function verifyStep() {
    await task(async () => {
      const r = await post<{ accessToken: string; user: Viewer }>('/auth/step-up', {
        challengeId: challenge,
        code,
      });
      acceptSession(r);
      setStepped(true);
      setChallenge('');
      setDevCode('');
      setMessage('Step-up verification complete. You can publish for the next 10 minutes.');
    });
  }
  return (
    <Appearance value="dark">
      <div className="admin-console">
        <Stack gap={8}>
          <PageTitle
            eyebrow="CONTROL ROOM · LOCAL DEVELOPMENT"
            title="Keep the numbers trustworthy."
          >
            Immutable snapshots. A second pair of eyes. A clear audit trail.
          </PageTitle>
          <Grid columns={{ initial: 1, md: 3 }} gap={5}>
            <Panel>
              <Metric label="Awaiting review" value={String(pending.length)} />
            </Panel>
            <Panel>
              <Metric label="Saved households" value={String(resource.data.households)} />
            </Panel>
            <Panel>
              <Metric
                label="Active capacity version"
                value={`v${active.snapshot.rule.version}`}
                help={active.snapshot.rule.enforcementStatus}
              />
            </Panel>
          </Grid>
          {error && <Notice error>{error}</Notice>}
          {message && <Text role="status">{message}</Text>}
          <Grid templateColumns={{ initial: '1fr', xl: '1.5fr 1fr' }} gap={6} align="start">
            <Panel
              title="Draft the next snapshot"
              description="Every submitted draft preserves the current version and requires a source and note."
            >
              <Stack gap={6}>
                <SelectField
                  label="Editing area"
                  value={tab}
                  onChange={setTab}
                  options={[
                    { value: 'capacity', label: 'Capacity policy' },
                    { value: 'tariff', label: 'Tariff & charges' },
                    { value: 'subsidy', label: 'Subsidy scheme' },
                    { value: 'yield', label: 'District yield' },
                  ]}
                />
                {tab === 'capacity' && (
                  <Stack gap={5}>
                    <Grid columns={{ initial: 1, md: 2 }} gap={5}>
                      <NumberField
                        label="Consumption cap multiplier"
                        value={state.rule.capFactor}
                        step={0.05}
                        max={3}
                        onChange={(v) => updateRule('capFactor', v ?? 1)}
                      />
                      <NumberField
                        label="Generation divisor"
                        value={state.rule.genUnitsPerKwMonth}
                        unit="kWh"
                        max={300}
                        onChange={(v) => updateRule('genUnitsPerKwMonth', v ?? 150)}
                      />
                      <NumberField
                        label="Roof area per kW"
                        value={state.rule.sqMPerKw}
                        unit="sq m"
                        onChange={(v) => updateRule('sqMPerKw', v ?? 10)}
                      />
                      <NumberField
                        label="Deemed-approval limit"
                        value={state.rule.deemedApprovalMaxKw}
                        unit="kW"
                        max={100}
                        onChange={(v) => updateRule('deemedApprovalMaxKw', v ?? 10)}
                      />
                      <NumberField
                        label="Capacity tolerance"
                        value={state.rule.capacityTolerancePct}
                        unit="%"
                        max={10}
                        onChange={(v) => updateRule('capacityTolerancePct', v ?? 0)}
                      />
                      <SelectField
                        label="Enforcement status"
                        value={state.rule.enforcementStatus}
                        onChange={(v) =>
                          updateRule(
                            'enforcementStatus',
                            v as RuleSnapshot['rule']['enforcementStatus'],
                          )
                        }
                        options={['ENFORCED', 'STAYED', 'UNDER_REVIEW'].map((value) => ({
                          value,
                          label: value.replaceAll('_', ' '),
                        }))}
                      />
                    </Grid>
                    <TextField
                      label="Plain-language summary"
                      value={state.rule.plainLanguageSummary}
                      onChange={(v) => updateRule('plainLanguageSummary', v)}
                    />
                    <TextField
                      label="Capacity source URL"
                      type="url"
                      value={state.rule.sourceUrl}
                      onChange={(v) => updateRule('sourceUrl', v)}
                    />
                    <TextField
                      label="Effective from"
                      type="date"
                      value={state.rule.effectiveFrom}
                      onChange={(v) => updateRule('effectiveFrom', v)}
                    />
                    <TextField
                      label="Verified on"
                      type="date"
                      value={state.rule.verifiedOn || ''}
                      onChange={(v) => updateRule('verifiedOn', v || null)}
                    />
                    <Checkbox
                      checked={state.rule.verified}
                      onCheckedChange={(v) => updateRule('verified', v === true)}
                    >
                      The current policy and formula have been verified against the source.
                    </Checkbox>
                  </Stack>
                )}
                {tab === 'tariff' && (
                  <Stack gap={5}>
                    <For each={state.tariff.slabs}>
                      {(slab, i) => (
                        <Grid key={i} columns={2} gap={4}>
                          <NumberField
                            label={`Slab ${i + 1} upper units`}
                            value={slab.upTo}
                            onChange={(v) =>
                              updateTariff(
                                'slabs',
                                state.tariff.slabs.map((s, j) => (j === i ? { ...s, upTo: v } : s)),
                              )
                            }
                            help={
                              i === state.tariff.slabs.length - 1
                                ? 'Keep empty for unlimited'
                                : undefined
                            }
                          />
                          <NumberField
                            label={`Slab ${i + 1} rate / kWh`}
                            value={slab.rate}
                            step={0.01}
                            max={100}
                            unit="₹"
                            onChange={(v) =>
                              updateTariff(
                                'slabs',
                                state.tariff.slabs.map((s, j) =>
                                  j === i ? { ...s, rate: v ?? 0 } : s,
                                ),
                              )
                            }
                          />
                        </Grid>
                      )}
                    </For>
                    <Grid columns={2} gap={4}>
                      <For
                        each={
                          [
                            'fixedChargeInr',
                            'wheelingRateInrPerKwh',
                            'facInrPerKwh',
                            'dutyPct',
                            'surplusRateInrPerKwh',
                          ] as const
                        }
                      >
                        {(key) => (
                          <NumberField
                            key={key}
                            label={key.replace(/([A-Z])/g, ' $1')}
                            value={state.tariff[key]}
                            step={0.01}
                            onChange={(v) => updateTariff(key, v ?? 0)}
                          />
                        )}
                      </For>
                    </Grid>
                    <TextField
                      label="Tariff source URL"
                      type="url"
                      value={state.tariff.sourceUrl}
                      onChange={(v) => updateTariff('sourceUrl', v)}
                    />
                    <TextField
                      label="Tariff verified on"
                      type="date"
                      value={state.tariff.verifiedOn || ''}
                      onChange={(v) => updateTariff('verifiedOn', v || null)}
                    />
                    <Checkbox
                      checked={state.tariff.verified}
                      onCheckedChange={(v) => updateTariff('verified', v === true)}
                    >
                      These rates are verified from the current tariff order.
                    </Checkbox>
                  </Stack>
                )}
                {tab === 'subsidy' && (
                  <Stack gap={5}>
                    <For each={state.subsidy.tiers}>
                      {(tier, i) => (
                        <Grid key={i} columns={2} gap={4}>
                          <NumberField
                            label={`Tier ${i + 1} upper kW`}
                            value={tier.upToKw}
                            step={0.5}
                            onChange={(v) =>
                              updateScheme(
                                'tiers',
                                state.subsidy.tiers.map((t, j) =>
                                  j === i ? { ...t, upToKw: v ?? 1 } : t,
                                ),
                              )
                            }
                          />
                          <NumberField
                            label={`Tier ${i + 1} subsidy per kW`}
                            value={tier.inrPerKw}
                            unit="₹"
                            onChange={(v) =>
                              updateScheme(
                                'tiers',
                                state.subsidy.tiers.map((t, j) =>
                                  j === i ? { ...t, inrPerKw: v ?? 0 } : t,
                                ),
                              )
                            }
                          />
                        </Grid>
                      )}
                    </For>
                    <NumberField
                      label="Maximum subsidy"
                      value={state.subsidy.maxSubsidyInr}
                      unit="₹"
                      onChange={(v) => updateScheme('maxSubsidyInr', v ?? 0)}
                    />
                    <TextField
                      label="Scheme source URL"
                      type="url"
                      value={state.subsidy.sourceUrl}
                      onChange={(v) => updateScheme('sourceUrl', v)}
                    />
                    <TextField
                      label="Scheme verified on"
                      type="date"
                      value={state.subsidy.verifiedOn || ''}
                      onChange={(v) => updateScheme('verifiedOn', v || null)}
                    />
                  </Stack>
                )}
                {tab === 'yield' && (
                  <Stack gap={5}>
                    <Notice>
                      Seeded district yields are illustrative, not an imported PVGIS dataset. Enter
                      kWh generated per installed kW for each month.
                    </Notice>
                    <For each={districts}>
                      {(district) => (
                        <Stack key={district.value} gap={3}>
                          <Heading level={3} variant="title-md">
                            {district.label}
                          </Heading>
                          <Grid columns={{ initial: 2, md: 4 }} gap={3}>
                            <For each={state.yields[district.value]}>
                              {(value, i) => (
                                <NumberField
                                  key={i}
                                  label={`${district.label} ${new Date(2026, i).toLocaleString('en-IN', { month: 'short' })}`}
                                  value={value}
                                  max={300}
                                  onChange={(v) =>
                                    setDraft({
                                      ...state,
                                      yields: {
                                        ...state.yields,
                                        [district.value]: state.yields[district.value].map(
                                          (x, j) => (i === j ? (v ?? 0) : x),
                                        ),
                                      },
                                    })
                                  }
                                />
                              )}
                            </For>
                          </Grid>
                        </Stack>
                      )}
                    </For>
                  </Stack>
                )}
                <TextField
                  label="Change note and source justification"
                  value={note}
                  onChange={setNote}
                  help="At least 10 characters. Explain the change for the reviewer."
                />
                <Button
                  loading={busy}
                  disabled={note.trim().length < 10}
                  onClick={() => void submit()}
                >
                  Submit for review
                </Button>
              </Stack>
            </Panel>
            <Stack gap={6}>
              <Panel
                title="Impact preview"
                description="Three example owner-occupied Pune homes, with 5 kW load and sufficient roof."
              >
                <Table.Root>
                  <Table.Caption>Example capacity and subsidy deltas</Table.Caption>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Units/month</Table.Head>
                      <Table.Head>Before</Table.Head>
                      <Table.Head>After</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    <For each={[200, 300, 450]}>
                      {(units) => {
                        const input = {
                          discomCode: 'MSEDCL' as const,
                          consumerCategory: 'LT_RESIDENTIAL' as const,
                          phaseType: 'SINGLE' as const,
                          sanctionedLoadKw: 5,
                          monthlyUnits: billMonths.map((m) => ({
                            billMonth: m.key,
                            unitsKwh: units,
                          })),
                          roofAreaSqM: 80,
                          shadowFreePct: 100,
                          ownershipType: 'OWN' as const,
                          districtCode: 'PUNE' as const,
                          expectedAddedLoadKw: 0,
                        };
                        const before = calculate(input, active.snapshot),
                          after = calculate(input, state),
                          b = before.scenarios[before.headlineScenario],
                          a = after.scenarios[after.headlineScenario];
                        return (
                          <Table.Row key={units}>
                            <Table.Head scope="row">{units}</Table.Head>
                            <Table.Cell>
                              {b.capacityKw} kW
                              <br />
                              {money(b.subsidyInr)}
                            </Table.Cell>
                            <Table.Cell>
                              {a.capacityKw} kW
                              <br />
                              {money(a.subsidyInr)}
                            </Table.Cell>
                          </Table.Row>
                        );
                      }}
                    </For>
                  </Table.Body>
                </Table.Root>
              </Panel>
              <Panel title="Fresh verification for publishing">
                <Stack gap={4}>
                  <Paragraph variant="body-sm">
                    The approver must be a different admin from the author. Step-up expires after 10
                    minutes. Analysts can draft, but cannot publish.
                  </Paragraph>
                  <TextField
                    label="Your staff mobile"
                    value={mobile}
                    onChange={setMobile}
                    type="tel"
                  />
                  {challenge ? (
                    <>
                      <TextField
                        label="Step-up verification code"
                        value={code}
                        onChange={setCode}
                      />
                      {devCode && <Notice>Local step-up code: {devCode}</Notice>}
                      <Button loading={busy} onClick={() => void verifyStep()}>
                        Verify identity
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" loading={busy} onClick={() => void requestStep()}>
                      {stepped ? 'Renew verification' : 'Request step-up code'}
                    </Button>
                  )}
                </Stack>
              </Panel>
            </Stack>
          </Grid>
          <Panel
            title="Review queue"
            description="Inspect the snapshot and source before publishing."
          >
            <Stack gap={6}>
              {!pending.length && (
                <Paragraph tone="secondary">No drafts awaiting review.</Paragraph>
              )}
              <For each={pending}>
                {(version) => (
                  <Stack key={version.id} gap={4} className="review-item">
                    <HStack justify="between" gap={4} wrap="wrap">
                      <Heading level={3} variant="title-lg">
                        Snapshot v{version.snapshot.rule.version}
                      </Heading>
                      <Badge tone="warning">Pending review</Badge>
                    </HStack>
                    <Paragraph>{version.note}</Paragraph>
                    <Paragraph variant="body-sm">
                      Consumption multiplier: {active.snapshot.rule.capFactor} →{' '}
                      {version.snapshot.rule.capFactor}. Enforcement:{' '}
                      {active.snapshot.rule.enforcementStatus} →{' '}
                      {version.snapshot.rule.enforcementStatus}. Author:{' '}
                      {version.draftBy === user?.id ? 'you' : 'another staff member'}.
                    </Paragraph>
                    <Link to={version.snapshot.rule.sourceUrl}>Review capacity source</Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const blob = new Blob(
                          [
                            JSON.stringify(
                              { before: active.snapshot, after: version.snapshot },
                              null,
                              2,
                            ),
                          ],
                          { type: 'application/json' },
                        );
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `snapshot-review-v${version.snapshot.rule.version}.json`;
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }}
                    >
                      Download complete before / after diff
                    </Button>
                    <ReviewActions
                      version={version}
                      canApprove={version.draftBy !== user?.id && user?.role === 'ADMIN' && stepped}
                      canReject={version.draftBy !== user?.id}
                      onChange={resource.reload}
                    />
                  </Stack>
                )}
              </For>
            </Stack>
          </Panel>
          <Panel title="Audit log">
            <Table.Container>
              <Table.Root minInlineSize="600px">
                <Table.Caption>Recent local authentication and policy events</Table.Caption>
                <Table.Header>
                  <Table.Row>
                    <Table.Head>Time</Table.Head>
                    <Table.Head>Action</Table.Head>
                    <Table.Head>Record</Table.Head>
                    <Table.Head>Note</Table.Head>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  <For each={resource.data.auditLogs}>
                    {(event) => (
                      <Table.Row key={event.id}>
                        <Table.Cell>{new Date(event.at).toLocaleString('en-IN')}</Table.Cell>
                        <Table.Cell>{event.action}</Table.Cell>
                        <Table.Cell>{event.docId.slice(0, 8)}</Table.Cell>
                        <Table.Cell>{event.detail || '—'}</Table.Cell>
                      </Table.Row>
                    )}
                  </For>
                </Table.Body>
              </Table.Root>
            </Table.Container>
          </Panel>
        </Stack>
      </div>
    </Appearance>
  );
}

function ReviewActions({
  version,
  canApprove,
  canReject,
  onChange,
}: {
  version: RuleVersion;
  canApprove: boolean;
  canReject: boolean;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false),
    [note, setNote] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function publish() {
    setBusy(true);
    setError('');
    try {
      await post(`/admin/versions/${version.id}/approve`, { revision: version.revision });
      setOpen(false);
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not publish');
    } finally {
      setBusy(false);
    }
  }
  async function reject() {
    setBusy(true);
    setError('');
    try {
      await post(`/admin/versions/${version.id}/reject`, { note });
      onChange();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reject');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Stack gap={4}>
      <AlertDialog.Root open={open} onOpenChange={setOpen}>
        <AlertDialog.Trigger asChild>
          <Button disabled={!canApprove}>Approve & publish</Button>
        </AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Overlay />
          <AlertDialog.Positioner>
            <Appearance value="dark">
              <AlertDialog.Content>
                <AlertDialog.Header>
                  <AlertDialog.Title>
                    Publish snapshot v{version.snapshot.rule.version}?
                  </AlertDialog.Title>
                  <AlertDialog.Description>
                    This activates the reviewed rules for new calculations and notifies saved
                    households of capacity or subsidy changes. Saved results retain their original
                    snapshot.
                  </AlertDialog.Description>
                </AlertDialog.Header>
                {error && (
                  <AlertDialog.Body>
                    <Notice error>{error}</Notice>
                  </AlertDialog.Body>
                )}
                <AlertDialog.Footer>
                  <AlertDialog.Cancel asChild>
                    <Button variant="outline">Cancel</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action
                    asChild
                    onClick={(e) => {
                      e.preventDefault();
                      void publish();
                    }}
                  >
                    <Button loading={busy}>Publish reviewed snapshot</Button>
                  </AlertDialog.Action>
                </AlertDialog.Footer>
              </AlertDialog.Content>
            </Appearance>
          </AlertDialog.Positioner>
        </AlertDialog.Portal>
      </AlertDialog.Root>
      <HStack gap={4} align="end" wrap="wrap">
        <Stack.Item flex="auto">
          <TextField
            label="Rejection reason"
            value={note}
            onChange={setNote}
            help="At least five characters, if rejecting."
          />
        </Stack.Item>
        <Button
          variant="outline"
          disabled={!canReject || note.length < 5 || busy}
          onClick={() => void reject()}
        >
          Reject draft
        </Button>
      </HStack>
      {error && !open && <Notice error>{error}</Notice>}
    </Stack>
  );
}
