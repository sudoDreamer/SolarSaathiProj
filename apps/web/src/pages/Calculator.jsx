import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowUpRight, Zap } from 'lucide-react';
import { calculate } from '../../../../packages/engine/index.js';
import { calculationInputSchema } from '../../../../packages/schemas/index.js';
import { api, post } from '../api.js';
import {
  Badge,
  Button,
  Container,
  For,
  Grid,
  Heading,
  HStack,
  Link,
  Notice,
  NumberField,
  Panel,
  Paragraph,
  Section,
  SelectField,
  Show,
  Slider,
  Stack,
  Steps,
  Text,
  money,
  useResource,
} from '../ui.jsx';
export const districts = [
  { value: 'PUNE', label: 'Pune' },
  { value: 'MUMBAI', label: 'Mumbai' },
  { value: 'THANE', label: 'Thane' },
  { value: 'NASHIK', label: 'Nashik' },
  { value: 'NAGPUR', label: 'Nagpur' },
  { value: 'KOLHAPUR', label: 'Kolhapur' },
  { value: 'SAMBHAJINAGAR', label: 'Chhatrapati Sambhajinagar' },
  { value: 'SOLAPUR', label: 'Solapur' },
];
export const billMonths = Array.from({ length: 12 }, (_, i) => {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth() - 12 + i, 1));
  return {
    key: date.toISOString().slice(0, 7),
    label: date.toLocaleString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
  };
});
const initial = {
  discomCode: 'MSEDCL',
  consumerCategory: 'LT_RESIDENTIAL',
  phaseType: 'SINGLE',
  sanctionedLoadKw: 5,
  roofAreaSqM: 50,
  shadowFreePct: 90,
  ownershipType: 'OWN',
  districtCode: 'PUNE',
  expectedAddedLoadKw: 0,
  units: {},
  months: '12',
  roofUnit: 'sqm',
};
export default function Calculator() {
  const navigate = useNavigate(),
    [search] = useSearchParams(),
    { t } = useTranslation();
  const [draft, setDraft] = useState(() => {
    try {
      return {
        ...initial,
        ...JSON.parse(sessionStorage.getItem('ss-draft') || '{}'),
      };
    } catch {
      return initial;
    }
  });
  const [step, setStep] = useState(0),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [sameUnits, setSameUnits] = useState(450);
  const { data: snapshot } = useResource(() => api('/rules/active'));
  useEffect(() => {
    sessionStorage.setItem('ss-draft', JSON.stringify(draft));
  }, [draft]);
  useEffect(() => {
    const edit = search.get('edit');
    if (edit)
      void api(`/calculations/${edit}`)
        .then(({ inputSnapshot }) =>
          setDraft((d) => ({
            ...d,
            ...inputSnapshot,
            units: Object.fromEntries(
              inputSnapshot.monthlyUnits.map((m) => [m.billMonth, m.unitsKwh]),
            ),
          })),
        )
        .catch(() => setError('Could not load the saved input. Your draft is still available.'));
  }, []);
  const visibleMonths = draft.months === '0' ? [] : billMonths.slice(-Number(draft.months));
  const input = useMemo(
    () => ({
      ...draft,
      monthlyUnits: visibleMonths
        .filter((m) => draft.units[m.key] !== null && draft.units[m.key] !== undefined)
        .map((m) => ({ billMonth: m.key, unitsKwh: draft.units[m.key] })),
    }),
    [draft],
  );
  const preview = useMemo(() => {
    if (!snapshot) return null;
    const parsed = calculationInputSchema.safeParse(input);
    if (!parsed.success) return null;
    const output = calculate(parsed.data, snapshot);
    return output.scenarios[output.headlineScenario];
  }, [input, snapshot]);
  const change = (key, value) => setDraft((d) => ({ ...d, [key]: value }));
  function validateStep() {
    if (step === 0 && !(draft.sanctionedLoadKw > 0)) {
      setError('Enter a sanctioned load above zero.');
      return false;
    }
    if (
      step === 1 &&
      visibleMonths.some((m) => draft.units[m.key] === null || draft.units[m.key] === undefined)
    ) {
      setError(
        'Fill each visible month, or select fewer bills. Enter 0 for a bill with no consumption.',
      );
      return false;
    }
    if (step === 2 && draft.roofAreaSqM <= 0) {
      setError('Enter your available roof area.');
      return false;
    }
    setError('');
    return true;
  }
  async function submit() {
    if (!validateStep()) return;
    setBusy(true);
    setError('');
    try {
      const row = await post('/calculate', input);
      sessionStorage.setItem(`ss-claim-${row.id}`, row.claimToken);
      navigate(`/result/${row.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not calculate. Please retry.');
    } finally {
      setBusy(false);
    }
  }
  const steps = ['Connect', 'Bills', 'Roof', 'Extras'];
  return (
    <div className="scene-page scene-dawn">
      <Section>
        <Container>
          <Grid
            templateColumns={{ initial: '1fr', lg: 'minmax(0,1fr) minmax(0,1.65fr)' }}
            gap={12}
            align="start"
          >
            <Stack gap={7} className="calculator-intro">
              <Text variant="eyebrow">A little information. A brighter outlook.</Text>
              <Heading level={1} variant={{ initial: 'display-sm', md: 'display-md' }}>
                Let’s find your
                <br />
                <span className="accent-text">solar potential.</span>
              </Heading>
              <Paragraph>
                Start with your electricity connection. We’ll turn your bills and rooftop space into
                a plan you can understand.
              </Paragraph>
              <HStack gap={3}>
                <Badge tone="neutral" variant="outline">
                  MSEDCL households
                </Badge>
                <Badge tone="neutral" variant="outline">
                  No login needed
                </Badge>
              </HStack>
              <div className="solar-orbit" aria-hidden="true">
                <div />
                <Zap size={32} />
              </div>
              <Paragraph variant="body-sm">
                Your numbers stay in this local app. The estimate shows its sources and assumptions.
              </Paragraph>
              <Link to="/rules">See how the rules work</Link>
            </Stack>
            <Panel className="calculator-panel">
              <Stack gap={7}>
                <Steps.Root count={4} step={step} onStepChange={setStep} size="sm">
                  <Steps.List>
                    <For each={steps}>
                      {(label, index) => (
                        <Steps.Item key={label} index={index}>
                          <Steps.Indicator />
                          <Steps.Title>{label}</Steps.Title>
                          <Steps.Separator />
                        </Steps.Item>
                      )}
                    </For>
                  </Steps.List>
                </Steps.Root>
                <HStack justify="between" wrap="wrap" gap={3}>
                  <Text variant="eyebrow">Step {step + 1} of 4</Text>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setDraft({
                        ...initial,
                        units: Object.fromEntries(billMonths.map((m) => [m.key, 450])),
                      });
                      setError('');
                    }}
                  >
                    Use example household
                  </Button>
                </HStack>
                <Heading level={2} variant="title-xl">
                  {
                    [
                      'Your electricity connection',
                      'A year of electricity use',
                      'A roof with room for sunlight',
                      'Make the estimate yours',
                    ][step]
                  }
                </Heading>
                <Show when={step === 0}>
                  <Stack gap={5}>
                    <SelectField
                      label="Electricity provider"
                      value="MSEDCL"
                      onChange={() => undefined}
                      options={[{ value: 'MSEDCL', label: 'MSEDCL / Mahavitaran' }]}
                    />
                    <Grid columns={{ initial: 1, sm: 2 }} gap={5}>
                      <SelectField
                        label="Consumer category"
                        value={draft.consumerCategory}
                        onChange={(v) => change('consumerCategory', v)}
                        options={[
                          { value: 'LT_RESIDENTIAL', label: 'Residential household' },
                          { value: 'COMMERCIAL', label: 'Commercial connection' },
                        ]}
                      />
                      <SelectField
                        label="Connection phase"
                        value={draft.phaseType}
                        onChange={(v) => change('phaseType', v)}
                        options={[
                          { value: 'SINGLE', label: 'Single phase' },
                          { value: 'THREE', label: 'Three phase' },
                        ]}
                      />
                    </Grid>
                    <NumberField
                      label="Sanctioned load"
                      value={draft.sanctionedLoadKw}
                      min={0.1}
                      max={100}
                      step={0.5}
                      unit="kW"
                      onChange={(v) => change('sanctionedLoadKw', v ?? 0)}
                      help="The approved load on your electricity bill, usually near the connection details."
                    />
                    <Show when={draft.consumerCategory === 'COMMERCIAL'}>
                      <Notice>
                        The central residential subsidy does not apply to a commercial connection.
                        You can still explore capacity and costs.
                      </Notice>
                    </Show>
                  </Stack>
                </Show>
                <Show when={step === 1}>
                  <Stack gap={5}>
                    <SelectField
                      label="How much bill history do you have?"
                      value={draft.months}
                      onChange={(v) => change('months', v)}
                      options={[
                        { value: '12', label: 'All 12 months' },
                        { value: '3', label: 'Only the last 3 months' },
                        { value: '0', label: 'New connection — no bills yet' },
                      ]}
                    />
                    <Show when={visibleMonths.length > 0}>
                      <HStack align="end" gap={3} wrap="wrap">
                        <Stack.Item flex="auto">
                          <NumberField
                            label="Quick fill: same use each month"
                            value={sameUnits}
                            max={50000}
                            unit="kWh"
                            onChange={setSameUnits}
                          />
                        </Stack.Item>
                        <Button
                          variant="outline"
                          onClick={() =>
                            change('units', {
                              ...draft.units,
                              ...Object.fromEntries(
                                visibleMonths.map((m) => [m.key, sameUnits ?? 0]),
                              ),
                            })
                          }
                        >
                          Fill months
                        </Button>
                      </HStack>
                      <Grid columns={{ initial: 2, md: 3 }} gap={4}>
                        <For each={visibleMonths}>
                          {(month) => (
                            <NumberField
                              key={month.key}
                              label={month.label}
                              value={draft.units[month.key] ?? null}
                              max={50000}
                              onChange={(v) => change('units', { ...draft.units, [month.key]: v })}
                            />
                          )}
                        </For>
                      </Grid>
                    </Show>
                    <Show when={draft.months !== '12'}>
                      <Notice>
                        We can show a provisional estimate. The consumption-cap application route
                        may require all 12 months of bills.
                      </Notice>
                    </Show>
                    <Show when={input.monthlyUnits.some((m) => m.unitsKwh > 2000)}>
                      <Notice>
                        One or more months exceed 2,000 kWh. Check that you entered units consumed,
                        rather than the bill amount in rupees.
                      </Notice>
                    </Show>
                  </Stack>
                </Show>
                <Show when={step === 2}>
                  <Stack gap={5}>
                    <Grid columns={{ initial: 1, sm: 2 }} gap={5}>
                      <NumberField
                        label="Available roof area"
                        value={Number(
                          (draft.roofAreaSqM * (draft.roofUnit === 'sqft' ? 10.7639 : 1)).toFixed(
                            1,
                          ),
                        )}
                        min={0}
                        unit={draft.roofUnit === 'sqft' ? 'sq ft' : 'sq m'}
                        onChange={(v) =>
                          change(
                            'roofAreaSqM',
                            (v ?? 0) / (draft.roofUnit === 'sqft' ? 10.7639 : 1),
                          )
                        }
                      />
                      <SelectField
                        label="Area unit"
                        value={draft.roofUnit}
                        onChange={(v) => change('roofUnit', v)}
                        options={[
                          { value: 'sqm', label: 'Square metres' },
                          { value: 'sqft', label: 'Square feet' },
                        ]}
                      />
                    </Grid>
                    <Slider.Root
                      value={draft.shadowFreePct}
                      onValueChange={(v) => change('shadowFreePct', Array.isArray(v) ? v[0] : v)}
                      min={0}
                      max={100}
                      step={5}
                    >
                      <HStack justify="between">
                        <Slider.Label>Shadow-free roof</Slider.Label>
                        <Text numeric="tabular">{draft.shadowFreePct}%</Text>
                      </HStack>
                      <Slider.Control>
                        <Slider.Track>
                          <Slider.Range />
                        </Slider.Track>
                        <Slider.Thumb index={0} />
                      </Slider.Control>
                    </Slider.Root>
                    <Paragraph variant="body-sm" tone="secondary">
                      Exclude water tanks, trees and areas shaded for much of the day. A site survey
                      will confirm usable space.
                    </Paragraph>
                    <SelectField
                      label="Who owns the roof?"
                      value={draft.ownershipType}
                      onChange={(v) => change('ownershipType', v)}
                      options={[
                        { value: 'OWN', label: 'I own the home and roof' },
                        { value: 'SHARED', label: 'Shared / housing society roof' },
                        { value: 'RENTED', label: 'I rent this home' },
                      ]}
                    />
                  </Stack>
                </Show>
                <Show when={step === 3}>
                  <Stack gap={5}>
                    <SelectField
                      label="District"
                      value={draft.districtCode}
                      onChange={(v) => change('districtCode', v)}
                      options={districts}
                    />
                    <NumberField
                      label="Planned extra load (optional)"
                      value={draft.expectedAddedLoadKw}
                      max={100}
                      unit="kW"
                      step={0.5}
                      onChange={(v) => change('expectedAddedLoadKw', v ?? 0)}
                      help="For a future EV or AC. This does not increase your present sanctioned load."
                    />
                    <NumberField
                      label="Total vendor quote (optional)"
                      value={draft.vendorQuoteInr ?? null}
                      unit="₹"
                      onChange={(v) => change('vendorQuoteInr', v ?? undefined)}
                      help="A quote for the selected system. Without one, we use an illustrative per-kW cost."
                    />
                    <Notice>
                      This is a planning estimate. The capacity policy, tariffs and yields need
                      verification before you spend money.
                    </Notice>
                  </Stack>
                </Show>
                <Show when={Boolean(error)}>
                  <Notice error>{error}</Notice>
                </Show>
                <HStack justify="between" gap={4}>
                  <Button
                    variant="outline"
                    startIcon={<ArrowLeft />}
                    disabled={step === 0 || busy}
                    onClick={() => {
                      setError('');
                      setStep((s) => s - 1);
                    }}
                  >
                    {t('back')}
                  </Button>
                  <Button
                    loading={busy}
                    endIcon={step < 3 ? <ArrowUpRight /> : <Zap />}
                    onClick={() => {
                      if (step < 3) {
                        if (validateStep()) setStep((s) => s + 1);
                      } else void submit();
                    }}
                  >
                    {step < 3 ? t('continue') : t('estimate')}
                  </Button>
                </HStack>
                <Show when={preview && input.monthlyUnits.length > 0}>
                  {() => (
                    <HStack justify="between" wrap="wrap" gap={3} className="estimate-strip">
                      <Text variant="body-sm">Provisional preview</Text>
                      <Text weight="semibold">
                        {preview?.capacityKw} kW · {money(preview?.subsidyInr ?? 0)} subsidy
                      </Text>
                    </HStack>
                  )}
                </Show>
              </Stack>
            </Panel>
          </Grid>
        </Container>
      </Section>
    </div>
  );
}
