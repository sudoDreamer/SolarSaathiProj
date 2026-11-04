import { useEffect, useId, useState, type ReactNode, type ComponentProps } from 'react';
import {
  Button,
  Card,
  Field,
  Input,
  NativeSelect,
  NumberInput,
  Paragraph,
  Heading,
  Text,
  Stack,
  HStack,
  Grid as BrickGrid,
  Badge,
  Container,
  Section,
  Show,
  For,
  Link as BrickLink,
  Stat,
  Alert,
  Accordion,
  Checkbox,
  Steps,
  Slider,
  PinInput,
  Appearance,
  AppBar,
  NavList,
} from '@flowstack-ui/brick';
import { Link as RouterLink } from 'react-router-dom';
import { ArrowRight, CircleAlert, Sun, Lightbulb, Check } from 'lucide-react';
export const Grid = BrickGrid.Root;
export {
  Button,
  Card,
  Field,
  Input,
  NativeSelect,
  NumberInput,
  Paragraph,
  Heading,
  Text,
  Stack,
  HStack,
  Badge,
  Container,
  Section,
  Show,
  For,
  Stat,
  Alert,
  Accordion,
  Checkbox,
  Steps,
  Slider,
  PinInput,
  Appearance,
  AppBar,
  NavList,
  ArrowRight,
  Sun,
};
export const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
export const compactMoney = (n: number) =>
  n >= 100000 ? `₹${(n / 100000).toFixed(1)} lakh` : money(n);
export function Link({
  to,
  children,
  ...props
}: {
  to: string;
  children: ReactNode;
  className?: string;
  variant?: 'plain' | 'subtle' | 'underline';
}) {
  return (
    <BrickLink asChild href={to} {...props}>
      <RouterLink to={to}>{children}</RouterLink>
    </BrickLink>
  );
}
export function ActionLink({
  to,
  children,
  secondary = false,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
}) {
  return (
    <Button
      asChild
      href={to}
      variant={secondary ? 'outline' : 'solid'}
      tone={secondary ? 'neutral' : 'accent'}
    >
      <RouterLink to={to}>{children}</RouterLink>
    </Button>
  );
}
export function Panel({
  title,
  description,
  children,
  className = '',
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card.Root className={className} size="lg">
      {title && (
        <Card.Header>
          <Card.Title as="h2">{title}</Card.Title>
          {description && <Card.Description>{description}</Card.Description>}
        </Card.Header>
      )}
      <Card.Content>{children}</Card.Content>
    </Card.Root>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 1000000,
  unit,
  step = 1,
  help,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  min?: number;
  max?: number;
  unit?: string;
  step?: number;
  help?: string;
}) {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <NumberInput.Root
        value={value}
        onValueChange={onChange}
        min={min}
        max={max}
        step={step}
        variant="surface"
      >
        <NumberInput.Input />
        {unit && <NumberInput.Unit>{unit}</NumberInput.Unit>}
        <NumberInput.Control
          incrementLabel={`Increase ${label}`}
          decrementLabel={`Decrease ${label}`}
        />
      </NumberInput.Root>
      {help && <Field.Description>{help}</Field.Description>}
    </Field.Root>
  );
}
export function TextField({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: ComponentProps<typeof Input>['type'] | 'date' | 'month';
  required?: boolean;
  placeholder?: string;
  help?: string;
}) {
  const fieldId = useId();
  // Browser-native month/date picking is an intentional adapter: Brick Input
  // excludes these native types; DateInput owns a different segmented model.
  if (type === 'date' || type === 'month')
    return (
      <Field.Root ids={{ control: fieldId }} required={required}>
        <Field.Label>{label}</Field.Label>
        <input
          className="native-calendar-input"
          id={fieldId}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
        />
        {help && <Field.Description>{help}</Field.Description>}
      </Field.Root>
    );
  return (
    <Field.Root required={required}>
      <Field.Label>{label}</Field.Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={type}
        placeholder={placeholder}
        variant="surface"
      />
      {help && <Field.Description>{help}</Field.Description>}
    </Field.Root>
  );
}
export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <Field.Root>
      <Field.Label>{label}</Field.Label>
      <NativeSelect.Root variant="surface">
        <NativeSelect.Field value={value} onChange={(e) => onChange(e.target.value)}>
          <For each={options}>
            {(o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            )}
          </For>
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>
  );
}
export function Metric({
  label,
  value,
  help,
  positive = false,
}: {
  label: string;
  value: string;
  help?: string;
  positive?: boolean;
}) {
  return (
    <Stat.Root className={positive ? 'metric-positive' : ''} size="lg">
      <Stat.Label>{label}</Stat.Label>
      <Stat.ValueText>{value}</Stat.ValueText>
      {help && <Stat.HelpText>{help}</Stat.HelpText>}
    </Stat.Root>
  );
}
export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <Alert.Root status={error ? 'error' : 'warning'} role={error ? 'alert' : undefined}>
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Description>{children}</Alert.Description>
      </Alert.Content>
    </Alert.Root>
  );
}
export function Loading() {
  return (
    <Stack gap={4} aria-label="Loading" aria-busy="true">
      <div className="loading-line" />
      <div className="loading-line short" />
      <div className="loading-block" />
    </Stack>
  );
}
export function ErrorState({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <Stack gap={4}>
      <Notice error>{error}</Notice>
      {retry && (
        <Button onClick={retry} variant="outline">
          Try again
        </Button>
      )}
    </Stack>
  );
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={5} align="center" className="empty-state">
      <Lightbulb size={34} aria-hidden="true" />
      <Heading level={2} variant="title-lg">
        {title}
      </Heading>
      <Paragraph tone="secondary">{children}</Paragraph>
    </Stack>
  );
}
export function BulbString({ values }: { values: { label: string; offset: number }[] }) {
  return (
    <HStack justify="between" gap={2} wrap="wrap" className="bulb-string">
      <For each={values}>
        {(v) => (
          <Stack key={v.label} gap={1} align="center">
            <Lightbulb
              size={24}
              aria-hidden="true"
              style={{
                color: v.offset > 0 ? 'var(--ss-amber)' : 'var(--ss-muted)',
                opacity: Math.max(0.35, Math.min(1, v.offset)),
              }}
            />
            <Text variant="caption">{v.label}</Text>
          </Stack>
        )}
      </For>
    </HStack>
  );
}
export function SavingsJar({
  value,
  label = 'Estimated savings so far',
}: {
  value: number;
  label?: string;
}) {
  return (
    <HStack gap={6} className="savings-jar">
      <div className="jar-art" aria-hidden="true">
        <div style={{ height: `${Math.min(85, 15 + Math.max(0, value) / 1000)}%` }} />
        <Sun size={28} />
      </div>
      <Metric
        label={label}
        value={money(value)}
        positive={value > 0}
        help="Based on your recorded bills and saved tariff assumptions"
      />
    </HStack>
  );
}
export function LightUpScene({ offset }: { offset: number }) {
  return (
    <div
      className="lightup-scene"
      role="img"
      aria-label={`${Math.round(offset * 100)} percent estimated bill offset`}
    >
      <For each={Array.from({ length: 20 }, (_, i) => i)}>
        {(i) => <span key={i} className={i / 20 < offset ? 'lit' : ''} />}
      </For>
    </div>
  );
}
export function useResource<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [nonce, setNonce] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    loader()
      .then((d) => {
        if (alive) setData(d);
      })
      .catch((e) => {
        if (alive) setError(e instanceof Error ? e.message : 'Could not load this page');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [...deps, nonce]);
  return { data, error, loading, reload: () => setNonce((n) => n + 1) };
}
export function PageTitle({
  eyebrow,
  title,
  children,
  action,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Stack gap={3} className="page-title">
      <HStack justify="between" gap={4} wrap="wrap">
        <Stack gap={3}>
          {eyebrow && <Text variant="eyebrow">{eyebrow}</Text>}
          <Heading level={1} variant={{ initial: 'display-sm', md: 'display-md' }}>
            {title}
          </Heading>
        </Stack>
        {action}
      </HStack>
      {children && <Paragraph tone="secondary">{children}</Paragraph>}
    </Stack>
  );
}
