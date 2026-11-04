import { Table } from '@flowstack-ui/brick';
import { ArrowUpRight } from 'lucide-react';
import { api } from '../api.js';
import {
  ActionLink,
  Badge,
  Container,
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
  Section,
  Stack,
  Text,
  money,
  useResource,
} from '../ui.jsx';
const guides = [
  {
    slug: 'net-metering',
    title: 'How net metering works',
    intro:
      'Your roof generates electricity during the day. Your home uses some immediately; the rest can flow to the grid under your approved metering arrangement.',
    paragraphs: [
      'A bidirectional meter records imported and exported electricity. The applicable tariff and regulations determine how those readings become credits, charges and any settlement.',
      'A solar system does not normally remove every charge from a bill. Fixed charges, taxes, banking terms and your timing of use affect the final amount.',
      'This local calculator uses a simplified annual banking model and sample tariffs. Read the current MERC order and your MSEDCL agreement before using an estimate to make a purchase.',
    ],
    source: 'https://portal.mahadiscom.in/ismart/',
  },
  {
    slug: 'subsidy-steps',
    title: 'Your PM Surya Ghar journey',
    intro:
      'Use the official national portal for the current application procedure and eligible registered vendors.',
    paragraphs: [
      'Check your residential connection, roof rights and applicant details. Register and follow the national portal and DISCOM feasibility process before installing a system.',
      'Ask your vendor for current registration, equipment compliance and warranty documents. Keep invoices and records for the inspection and commissioning process.',
      'After the required approvals and commissioning, follow the portal’s bank validation and subsidy claim steps. A calculator estimate is not a guaranteed payment or a promised timeline.',
    ],
    source: 'https://pmsuryaghar.gov.in/',
  },
  {
    slug: 'reading-your-bill',
    title: 'Find the numbers on your electricity bill',
    intro:
      'You need units consumed and sanctioned load to begin. Your consumer number is not needed for this calculator.',
    paragraphs: [
      'Look for the monthly energy consumption, usually labelled units or kWh. Enter the units for the billing month, rather than the payable rupee amount.',
      'Find the sanctioned load near your connection or consumer details. It is a capacity in kW or another explicitly stated unit. If the bill uses a different unit, ask your DISCOM to confirm the equivalent.',
      'For bill comparisons, record the final payable amount and optional line items. Arrears, adjustments and one-off charges can make two bills differ even when consumption is similar.',
    ],
    source: 'https://www.mahadiscom.in/',
  },
  {
    slug: 'choosing-a-vendor',
    title: 'A clearer conversation with your vendor',
    intro:
      'Get a written proposal that makes the equipment, installation and responsibilities easy to compare.',
    paragraphs: [
      'Check that the vendor appears on the relevant official registered list. Verify the current domestic-content and module requirements for the subsidy you intend to claim.',
      'Ask for panel and inverter models, capacity, full installed price, taxes, roof structure work, warranties, after-sales support and the scope of approval assistance.',
      'Have the usable roof and system size checked on site. Do not order a larger system on the assumption that a future load increase or a contested policy interpretation will be accepted.',
    ],
    source: 'https://pmsuryaghar.gov.in/',
  },
];
export default function RulesPage() {
  const { data: snapshot, error, loading, reload } = useResource(() => api('/rules/active'));
  if (loading)
    return (
      <Section>
        <Container>
          <Loading />
        </Container>
      </Section>
    );
  if (error || !snapshot)
    return (
      <Section>
        <Container>
          <ErrorState error={error || 'Rules unavailable'} retry={reload} />
        </Container>
      </Section>
    );
  return (
    <div className="scene-page scene-clear">
      <Section>
        <Container>
          <Stack gap={9}>
            <PageTitle
              eyebrow="CLARITY IS PART OF THE PRODUCT"
              title="The rules behind your numbers."
            >
              What we use, where it comes from, and what still needs checking.
            </PageTitle>
            <Notice>
              Capacity enforcement, tariff slabs, district yield, installation cost and carbon
              factors are unverified sample assumptions. This local build is a planning tool, not
              official approval. The PRD’s reported court and policy claims have not been treated as
              verified law.
            </Notice>
            <Grid columns={{ initial: 1, lg: 2 }} gap={6}>
              <Panel title="Two ways to look at capacity">
                <Stack gap={5}>
                  <Badge tone="warning">
                    {snapshot.rule.enforcementStatus.replaceAll('_', ' ')}
                  </Badge>
                  <Paragraph>{snapshot.rule.plainLanguageSummary}</Paragraph>
                  <Heading level={3} variant="title-md">
                    Reported consumption-cap model
                  </Heading>
                  <Paragraph>
                    Average monthly use × {snapshot.rule.capFactor} ÷{' '}
                    {snapshot.rule.genUnitsPerKwMonth} kWh/kW-month, limited by usable roof and
                    sanctioned load.
                  </Paragraph>
                  <Heading level={3} variant="title-md">
                    Sanctioned-load model
                  </Heading>
                  <Paragraph>
                    The lower of sanctioned load, {snapshot.rule.deemedApprovalMaxKw} kW and the
                    usable roof limit. This is a comparison scenario; it is not an entitlement
                    determination.
                  </Paragraph>
                  <Text variant="body-sm">
                    Rule {snapshot.rule.id} · Verified {snapshot.rule.verifiedOn ?? 'not yet'}
                  </Text>
                  <Link to={snapshot.rule.sourceUrl}>
                    Capacity source to verify <ArrowUpRight size={15} />
                  </Link>
                </Stack>
              </Panel>
              <Panel title="Central residential subsidy">
                <Stack gap={5}>
                  <Metric
                    label="Maximum in the active snapshot"
                    value={money(snapshot.subsidy.maxSubsidyInr)}
                  />
                  <Table.Root>
                    <Table.Caption>Seeded PM Surya Ghar subsidy tiers</Table.Caption>
                    <Table.Header>
                      <Table.Row>
                        <Table.Head>Capacity band</Table.Head>
                        <Table.Head>Support per kW</Table.Head>
                      </Table.Row>
                    </Table.Header>
                    <Table.Body>
                      <For each={snapshot.subsidy.tiers}>
                        {(tier, i) => (
                          <Table.Row key={tier.upToKw}>
                            <Table.Head scope="row">
                              {i ? snapshot.subsidy.tiers[i - 1].upToKw : 0}–{tier.upToKw} kW
                            </Table.Head>
                            <Table.Cell>{money(tier.inrPerKw)}</Table.Cell>
                          </Table.Row>
                        )}
                      </For>
                    </Table.Body>
                  </Table.Root>
                  <Paragraph variant="body-sm">
                    Residential eligibility, approved equipment and the official application process
                    still apply. Fractional kW is modelled pro-rata and needs portal verification.
                  </Paragraph>
                  <Link to={snapshot.subsidy.sourceUrl}>
                    Government scheme source <ArrowUpRight size={15} />
                  </Link>
                  <Text variant="caption">
                    Scheme source checked {snapshot.subsidy.verifiedOn ?? 'not yet'} ·{' '}
                    {snapshot.subsidy.id}
                  </Text>
                </Stack>
              </Panel>
            </Grid>
            <Panel
              title="Tariffs: deliberately labelled, never hidden"
              description="Illustrative test rates, not the current MERC residential tariff"
            >
              <Stack gap={5}>
                <Table.Root>
                  <Table.Caption>Sample slab model used by the calculator</Table.Caption>
                  <Table.Header>
                    <Table.Row>
                      <Table.Head>Monthly use</Table.Head>
                      <Table.Head>Energy rate</Table.Head>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    <For each={snapshot.tariff.slabs}>
                      {(slab, i) => (
                        <Table.Row key={i}>
                          <Table.Head scope="row">
                            {i ? snapshot.tariff.slabs[i - 1].upTo + 1 : 0}–{slab.upTo ?? 'above'}{' '}
                            kWh
                          </Table.Head>
                          <Table.Cell>{money(slab.rate)} / kWh</Table.Cell>
                        </Table.Row>
                      )}
                    </For>
                  </Table.Body>
                </Table.Root>
                <Paragraph>
                  Fixed charge {money(snapshot.tariff.fixedChargeInr)}, wheeling{' '}
                  {money(snapshot.tariff.wheelingRateInrPerKwh)}/kWh, FAC{' '}
                  {money(snapshot.tariff.facInrPerKwh)}/kWh, duty {snapshot.tariff.dutyPct}%.
                  Surplus cash settlement assumed at {money(snapshot.tariff.surplusRateInrPerKwh)}
                  /kWh.
                </Paragraph>
                <Link to={snapshot.tariff.sourceUrl}>
                  Verify with a MERC order <ArrowUpRight size={15} />
                </Link>
              </Stack>
            </Panel>
            <Panel title="How changes reach your estimate">
              <Stack gap={4}>
                <Paragraph>
                  A policy analyst submits a new version with a source and a reason. A different
                  admin reviews it and supplies a fresh verification code before publication.
                  Publishing supersedes the old version atomically in MongoDB mode.
                </Paragraph>
                <Paragraph>
                  Open result pages receive a change notification. Saved results preserve their
                  input, output and full snapshot; a new calculation uses the new active version.
                  Rule impacts on saved homes appear in your workspace.
                </Paragraph>
                <Paragraph variant="body-sm" tone="secondary">
                  JSON mode is intended for one local API process. MongoDB mode requires a replica
                  set. Official-page watching and automated policy ingestion are not enabled in this
                  build.
                </Paragraph>
              </Stack>
            </Panel>
            <HStack gap={4} wrap="wrap">
              <ActionLink to="/calculate">Try the calculator</ActionLink>
              <ActionLink to="/learn" secondary>
                Read the short guides
              </ActionLink>
            </HStack>
          </Stack>
        </Container>
      </Section>
    </div>
  );
}
export function LearnPage({ slug }) {
  const guide = guides.find((g) => g.slug === slug);
  return (
    <div className="scene-page scene-clear">
      <Section>
        <Container measure={guide ? 'narrow' : 'wide'}>
          {guide ? (
            <Stack gap={7}>
              <Link to="/learn">All guides</Link>
              <PageTitle eyebrow="A LITTLE MORE CLARITY" title={guide.title}>
                {guide.intro}
              </PageTitle>
              <For each={guide.paragraphs}>{(p) => <Paragraph key={p}>{p}</Paragraph>}</For>
              <Link to={guide.source}>
                Check the official source <ArrowUpRight size={16} />
              </Link>
              <ActionLink to="/calculate">Explore your solar estimate</ActionLink>
            </Stack>
          ) : (
            <Stack gap={9}>
              <PageTitle
                eyebrow="SOLAR, IN PLAIN LANGUAGE"
                title="A little reading. A clearer decision."
              >
                Short guides for the questions that come before the panels.
              </PageTitle>
              <Grid columns={{ initial: 1, md: 2 }} gap={6}>
                <For each={guides}>
                  {(g) => (
                    <Panel key={g.slug} title={g.title}>
                      <Stack gap={5}>
                        <Paragraph tone="secondary">{g.intro}</Paragraph>
                        <Link to={`/learn/${g.slug}`}>
                          Read guide <ArrowUpRight size={16} />
                        </Link>
                      </Stack>
                    </Panel>
                  )}
                </For>
              </Grid>
            </Stack>
          )}
        </Container>
      </Section>
    </div>
  );
}
export function LegalPage({ kind }) {
  const contents = {
    privacy: [
      'Your information, in this local app.',
      'This prototype stores your mobile number, login sessions, consent, saved calculations, households and bills on this machine. Its default JSON driver writes to the ignored .local folder. The calculator does not request a consumer number or Aadhaar.',
      'Access tokens stay in browser memory. A rotating refresh token lives in an httpOnly cookie. Local OTP codes appear in the API terminal and development banner. No SMS, marketing message, vendor lead or government submission is sent.',
      'Account deletion revokes sessions immediately and marks your account for a local purge after 30 days. Keep a backup only if you need it; downloaded CSVs and printed reports are your own copies.',
      'This is a development privacy notice, not reviewed production legal text. A public launch requires reviewed privacy and consent documents, hardened hosting and verified policy data.',
    ],
    terms: [
      'A planning companion for your roof.',
      'SolarSaathi is an independent local prototype. It is not affiliated with MSEDCL, MERC, MNRE or PM Surya Ghar.',
      'Results are estimates for planning. They are not technical approval, legal advice, a vendor quotation, or a subsidy guarantee. Capacity, tariff, generation and economics seeds require verification before financial decisions.',
      'Confirm current rules and eligibility with the official portals and your DISCOM. A qualified installer must inspect the roof and design the electrical system.',
    ],
    about: [
      'Your companion for rooftop solar.',
      'SolarSaathi helps Maharashtra households explore rooftop solar before speaking to a vendor. It brings capacity, subsidy, costs and next steps into a transparent planning workflow.',
      'The app preserves the assumptions behind each result. It does not log in to government portals or apply on your behalf. Its current focus is local development and validation of the product specification.',
    ],
  }[kind];
  return (
    <Section>
      <Container measure="narrow">
        <Stack gap={7}>
          <PageTitle eyebrow={kind.toUpperCase()} title={contents[0]} />
          <For each={contents.slice(1)}>{(p) => <Paragraph key={p}>{p}</Paragraph>}</For>
          <Link to="https://pmsuryaghar.gov.in/">
            Official PM Surya Ghar portal <ArrowUpRight size={15} />
          </Link>
        </Stack>
      </Container>
    </Section>
  );
}
