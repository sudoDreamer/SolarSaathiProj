import { useTranslation } from 'react-i18next';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  FileText,
  House,
  Sun,
  ShieldCheck,
  Wallet,
  Zap,
} from 'lucide-react';
import { Hero } from '../components/Hero';
import {
  Accordion,
  ActionLink,
  Badge,
  Button,
  Card,
  Container,
  For,
  Grid,
  Heading,
  HStack,
  Link,
  Paragraph,
  Section,
  Stack,
  Text,
  money,
  useResource,
} from '../ui';
import { api } from '../api';
import type { RuleSnapshot } from '../../../../packages/schemas';
const faqs = [
  [
    'Is SolarSaathi an official government service?',
    'SolarSaathi is an independent planning tool. It is not affiliated with MSEDCL, MNRE or the PM Surya Ghar portal. Only the relevant authorities can approve your installation and subsidy.',
  ],
  [
    'Why do you show two possible system sizes?',
    'The PRD describes a reported consumption-linked cap alongside a sanctioned-load path. Because current enforcement is unverified here, we show both assumptions and the limits used for each.',
  ],
  [
    'What if I have fewer than 12 electricity bills?',
    'Choose three bills or a new connection in the calculator. We will label the result provisional and include a checklist item to clarify the application route with MSEDCL.',
  ],
  [
    'Can I use it for a flat or a rented home?',
    'Shared roofs need society consent and may use a different scheme route. Renters should ask the owner to apply. The calculator flags these conditions rather than promising eligibility.',
  ],
];
export default function Landing({ reduced }: { reduced: boolean }) {
  const { t } = useTranslation(),
    { data: rules } = useResource(() => api<RuleSnapshot>('/rules/active'));
  return (
    <>
      <Hero reduced={reduced} />
      <section id="solar-start" className="trust-rail">
        <Container>
          <HStack justify="between" gap={5} wrap="wrap">
            <Text variant="eyebrow">Clarity before commitment</Text>
            <HStack gap={2}>
              <ShieldCheck size={18} aria-hidden="true" />
              <Text variant="body-sm">Independent guidance</Text>
            </HStack>
            <HStack gap={2}>
              <FileText size={18} aria-hidden="true" />
              <Text variant="body-sm">Every assumption, visible</Text>
            </HStack>
            <Text variant="body-sm">For Maharashtra households</Text>
          </HStack>
        </Container>
      </section>
      <Section spacing="xl">
        <Container>
          <Grid templateColumns={{ initial: '1fr', md: '1.1fr 1fr' }} gap={12} align="center">
            <Stack gap={6}>
              <Text variant="eyebrow">From “where do I start?” to “here’s my plan.”</Text>
              <Heading level={2} variant={{ initial: 'title-xl', md: 'display-sm' }}>
                Good for your roof.
                <br />
                <span className="accent-text">Better for your bills.</span>
              </Heading>
              <Paragraph tone="secondary">
                Solar should feel like a possibility, not a pile of paperwork. Get a clear picture
                of what fits, what it could save, and what to check next.
              </Paragraph>
              <Link to="/calculate">
                Find my solar potential <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </Stack>
            <div
              className="rooftop-art"
              role="img"
              aria-label="A home with rooftop solar panels catching the morning sun"
            >
              <div className="art-sun" />
              <div className="art-orbit" />
              <div className="art-house">
                <div className="art-roof">
                  <div />
                  <div />
                  <div />
                  <div />
                </div>
                <div className="art-window" />
                <div className="art-door" />
              </div>
              <span className="art-label">A little sunlight. A lot of possibility.</span>
            </div>
          </Grid>
        </Container>
      </Section>
      <Section className="how-section" id="how-it-works">
        <Container>
          <Stack gap={10}>
            <HStack justify="between" align="end" wrap="wrap" gap={6}>
              <Stack gap={3}>
                <Text variant="eyebrow">A clear path to solar</Text>
                <Heading level={2} variant="title-xl">
                  Three steps. One brighter decision.
                </Heading>
              </Stack>
              <Paragraph tone="secondary">
                Your bills tell a story.
                <br />
                Let’s see what sunlight can change.
              </Paragraph>
            </HStack>
            <Grid columns={{ initial: 1, md: 3 }} gap={8}>
              <For
                each={[
                  {
                    no: '01',
                    icon: FileText,
                    title: 'Tell us about your home',
                    text: 'Your electricity use, connection and available rooftop space. No consumer number required.',
                  },
                  {
                    no: '02',
                    icon: Sun,
                    title: 'See your solar potential',
                    text: 'Explore both sizing paths, your possible subsidy and a transparent cost estimate.',
                  },
                  {
                    no: '03',
                    icon: Check,
                    title: 'Know your next step',
                    text: 'Keep a personal checklist, save your household and track bills as your solar journey unfolds.',
                  },
                ]}
              >
                {(step) => (
                  <Stack key={step.no} gap={5} className="how-step">
                    <HStack justify="between">
                      <Text variant="title-xl" className="step-number">
                        {step.no}
                      </Text>
                      <step.icon size={24} aria-hidden="true" />
                    </HStack>
                    <Heading level={3} variant="title-lg">
                      {step.title}
                    </Heading>
                    <Paragraph tone="secondary">{step.text}</Paragraph>
                  </Stack>
                )}
              </For>
            </Grid>
          </Stack>
        </Container>
      </Section>
      <Section>
        <Container>
          <Grid templateColumns={{ initial: '1fr', md: '1.15fr 1fr' }} gap={12} align="center">
            <Stack gap={6}>
              <Badge variant="outline" tone="warning">
                Policy, in plain language
              </Badge>
              <Heading level={2} variant="title-xl">
                The rules can change.
                <br />
                Your clarity shouldn’t.
              </Heading>
              <Paragraph tone="secondary">
                A solar estimate is only as useful as its assumptions. See the capacity paths,
                subsidy tiers and source history behind every number.
              </Paragraph>
              <ActionLink to="/rules" secondary>
                Explore rules & sources <ArrowUpRight size={17} />
              </ActionLink>
            </Stack>
            <Card.Root size="lg" className="subsidy-feature">
              <Card.Header>
                <Card.Description>PM SURYA GHAR · CENTRAL SUBSIDY</Card.Description>
                <Card.Title as="h3">A little help to get you started.</Card.Title>
              </Card.Header>
              <Card.Content>
                <Stack gap={5}>
                  <Text variant="display-md" className="subsidy-amount">
                    {money(rules?.subsidy.maxSubsidyInr ?? 0)}
                  </Text>
                  <Paragraph>
                    Maximum central subsidy shown by the active scheme snapshot, subject to
                    eligibility and official approval.
                  </Paragraph>
                  <HStack gap={3}>
                    <ShieldCheck size={18} />
                    <Text variant="body-sm">Source-linked. Versioned. Always visible.</Text>
                  </HStack>
                </Stack>
              </Card.Content>
              <Card.Footer>
                <Link to="/rules">
                  See subsidy tiers <ArrowRight size={16} />
                </Link>
              </Card.Footer>
            </Card.Root>
          </Grid>
        </Container>
      </Section>
      <Section className="faq-section">
        <Container measure="narrow">
          <Stack gap={8}>
            <Stack gap={3}>
              <Text variant="eyebrow">A few things you might be wondering</Text>
              <Heading level={2} variant="title-xl">
                A brighter picture.
              </Heading>
            </Stack>
            <Accordion.Root variant="plain" size="xl">
              <For each={faqs}>
                {([q, a]) => (
                  <Accordion.Item key={q} value={q}>
                    <Accordion.Header as="h3">
                      <Accordion.Trigger>
                        {q}
                        <Accordion.Indicator />
                      </Accordion.Trigger>
                    </Accordion.Header>
                    <Accordion.Content>
                      <Accordion.ContentInner>
                        <Paragraph tone="secondary">{a}</Paragraph>
                      </Accordion.ContentInner>
                    </Accordion.Content>
                  </Accordion.Item>
                )}
              </For>
            </Accordion.Root>
          </Stack>
        </Container>
      </Section>
      <Section className="closing-section">
        <Container>
          <Stack align="center" gap={6}>
            <Sun size={36} aria-hidden="true" />
            <Heading level={2} variant="display-sm" align="center">
              A brighter tomorrow
              <br />
              starts on your roof.
            </Heading>
            <Paragraph>Let’s see what’s possible for your home.</Paragraph>
            <ActionLink to="/calculate">
              {t('check')} <ArrowUpRight size={18} />
            </ActionLink>
            <Text variant="body-sm">Free. Independent. Made for Maharashtra.</Text>
          </Stack>
        </Container>
      </Section>
    </>
  );
}
