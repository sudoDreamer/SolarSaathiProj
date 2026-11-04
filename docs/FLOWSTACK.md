# FLOWSTACK implementation notes

## Exact package authority

Installed `@flowstack-ui/brick@0.3.0`, which depends on Atom 0.27.3. The plugin resolver successfully selected the installed manifest and coverage. Coverage reported 5,347 public surfaces and 129 component owners, with zero unclassified, invalid-exclusion or unresolved-selection counters and no failures.

The package's layer-selection and interface-composition guides were read. Selected owners were resolved from the exact installed package: Button, Card, Text, Stack, Grid, Field, Input, NativeSelect, NumberInput, Slider, PinInput, Checkbox, Steps, Table, Accordion, Badge, Container, Section, AppBar, NavList, Link, Appearance, Stat, Alert, AlertDialog, Show and For.

The application imports no Atom components directly. Brick `styles.css` loads once in the web entry. Branding is provided by semantic tokens and documented typography/component tokens; a separately compiled FLOWSTACK Theme package is not claimed. Native landmarks and product scenery remain application-owned.

## Intentional adapters and draft gaps

| Interface job | Owner searched | Public contract checked | Adapter or remaining gap | Ownership and evidence |
| --- | --- | --- | --- | --- |
| Browser-native month/date picker | Input, DateInput, Field | Input type union, DateInput segmented value model, Field ids/label/error relationship | Native date/month inputs inside Field; explicit control IDs and an application-scoped style. Brick Input excludes these native types; DateInput is a different interaction. | Application adapter; bill/tracker browser checks verify naming, entry and persistence. |
| React Router destinations | Button, Link, NavList | href, asChild, semantic link mode | Router anchors under Button/Link; both outer owner and anchor receive the real destination. Workspace links may use normal document navigation. | Framework adapter; browser tests cover calculator, household and tabs. |
| City film and live bill-offset light artwork | Image, Surface composition map | Art coordinates versus component layout ownership | Canvas with immediately visible image poster, deterministic generated WebP frames, custom skyline and light-window marks. | Application artwork. Reduced-motion, skip and screenshot checks cover the hero. |
| Domain charts | Table, Grid, layer-selection map | Native comparison semantics, container overflow, chart-data ownership | Recharts with real result data; accessible summaries and a native Brick monthly table. | Application/data-visualisation adapter; responsive result browser checks. |
| Brand display wordmark | Text, Link | Display variants, native font-metric escape hatch, semantic foreground pairs | Narrow font sizing/tracking and scene artwork paint on product composition classes. | Application art direction; desktop/mobile screenshots. |
| Pending content and empty collections | Skeleton, EmptyState selection map | Loading and recovery semantics | Current draft uses application skeleton shapes and a small Empty composition with heading, explanatory copy and real actions. This is an acknowledged remaining Brick adoption gap, not a missing public capability. | Brick adoption work; current states have accessible loading/empty text. |
| Generated CSV and review JSON | DownloadTrigger selection map | Application serialization ownership | Current draft uses a Button operation and a temporary download anchor. This is an acknowledged remaining DownloadTrigger adoption gap. | Application adapter pending migration; generated values come from actual records. |
| Responsive navigation | AppBar, NavList, Show, Stack | Shared breakpoints, semantic routes, current state | Desktop rail and household section links work; the PRD's separate mobile bottom navigation remains deferred. | Application shell; mobile browser flows and overflow checks. |

No universal FLOWSTACK compliance, full accessibility audit, or cross-browser certification is claimed for this first draft. Known UI-owner adoption gaps are recorded here rather than concealed.
