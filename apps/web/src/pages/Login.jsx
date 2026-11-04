import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { acceptSession, post } from '../api.js';
import { useSession } from '../session.jsx';
import {
  Appearance,
  Badge,
  Button,
  Checkbox,
  Container,
  Field,
  For,
  Grid,
  Heading,
  HStack,
  Input,
  LightUpScene,
  Link,
  Notice,
  Panel,
  Paragraph,
  PinInput,
  Section,
  Show,
  Stack,
  Text,
} from '../ui.jsx';
export default function Login() {
  const [search] = useSearchParams(),
    navigate = useNavigate(),
    { user } = useSession();
  const rawNext = search.get('next') || '/app',
    next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/app';
  const [mobile, setMobile] = useState(''),
    [challenge, setChallenge] = useState(''),
    [code, setCode] = useState(Array(6).fill('')),
    [consent, setConsent] = useState(false),
    [devCode, setDevCode] = useState(''),
    [cooldown, setCooldown] = useState(0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (user) navigate(next, { replace: true });
  }, [user]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown((v) => v - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function request() {
    setBusy(true);
    setError('');
    try {
      const data = await post('/auth/otp/request', { mobile });
      setChallenge(data.challengeId);
      setDevCode(data.devCode || '');
      setCooldown(data.resendAfterSeconds);
      setCode(Array(6).fill(''));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not request code');
    } finally {
      setBusy(false);
    }
  }
  async function verify() {
    setBusy(true);
    setError('');
    try {
      const data = await post('/auth/otp/verify', {
        challengeId: challenge,
        code: code.join(''),
        consent,
      });
      acceptSession(data);
      navigate(next, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not verify');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Appearance value="dark">
      <div className="scene-page scene-night">
        <Section>
          <Container>
            <Grid templateColumns={{ initial: '1fr', md: '1.1fr 1fr' }} gap={14} align="center">
              <Stack gap={7}>
                <Text variant="eyebrow">Your solar journey starts here</Text>
                <Heading level={1} variant="display-md">
                  Welcome to a<br />
                  <span className="accent-text">brighter side.</span>
                </Heading>
                <Paragraph>
                  Save your solar plan. Keep your bills together.
                  <br />
                  See what changes as your home turns to sunlight.
                </Paragraph>
                <LightUpScene offset={challenge ? 0.4 : mobile.length > 5 ? 0.15 : 0.05} />
                <HStack gap={3}>
                  <LockKeyhole size={18} />
                  <Text variant="body-sm">Passwordless. Private. Yours.</Text>
                </HStack>
              </Stack>
              <Panel className="login-panel">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void (challenge ? verify() : request());
                  }}
                >
                  <Stack gap={6}>
                    <Badge tone="neutral" variant="outline">
                      LOCAL DEVELOPMENT
                    </Badge>
                    <Heading level={2} variant="title-xl">
                      {challenge ? 'A little code. You’re home.' : 'Make yourself at home.'}
                    </Heading>
                    <Paragraph tone="secondary">
                      {challenge
                        ? `Enter the six-digit code for ${mobile}. It expires in 5 minutes.`
                        : 'Enter your Indian mobile number. We’ll send a one-time login code.'}
                    </Paragraph>
                    <Show when={!challenge}>
                      <Field.Root required>
                        <Field.Label>Mobile number</Field.Label>
                        <Input
                          value={mobile}
                          onChange={(e) => setMobile(e.target.value)}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel-national"
                          placeholder="10-digit mobile number"
                          variant="surface"
                        />
                      </Field.Root>
                    </Show>
                    <Show when={Boolean(challenge)}>
                      <Field.Root>
                        <Field.Label>Verification code</Field.Label>
                        <PinInput.Root
                          length={6}
                          otp
                          type="numeric"
                          value={code}
                          onValueChange={(d) => setCode(d.value)}
                          name="otp"
                          aria-label="Verification code"
                        >
                          <For each={[0, 1, 2, 3, 4, 5]}>
                            {(i) => <PinInput.Input key={i} index={i} />}
                          </For>
                        </PinInput.Root>
                      </Field.Root>
                      <HStack justify="between" wrap="wrap" gap={3}>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={cooldown > 0 || busy}
                          onClick={() => void request()}
                        >
                          {cooldown ? `Resend in ${cooldown}s` : 'Resend code'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setChallenge('');
                            setDevCode('');
                          }}
                        >
                          Change number
                        </Button>
                      </HStack>
                    </Show>
                    <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)}>
                      I agree to the local app’s terms and privacy notice.
                    </Checkbox>
                    <Paragraph variant="body-sm">
                      <Link to="/privacy">Read the privacy notice</Link> and{' '}
                      <Link to="/terms">terms</Link>. No marketing messages are enabled.
                    </Paragraph>
                    {devCode && (
                      <Notice>
                        Development code: <strong data-testid="dev-otp">{devCode}</strong>. No SMS
                        was sent. This banner is available only in local mode.
                      </Notice>
                    )}
                    {error && <Notice error>{error}</Notice>}
                    <Button
                      type="submit"
                      fullWidth
                      loading={busy}
                      disabled={challenge ? code.join('').length !== 6 : !mobile.trim()}
                      endIcon={<ArrowRight />}
                    >
                      {challenge ? 'Verify & continue' : 'Get login code'}
                    </Button>
                    <Paragraph variant="body-sm" tone="secondary">
                      For local staff testing: analyst 9999999992, admin 9999999991. A real random
                      code is generated for each request.
                    </Paragraph>
                  </Stack>
                </form>
              </Panel>
            </Grid>
          </Container>
        </Section>
      </div>
    </Appearance>
  );
}
