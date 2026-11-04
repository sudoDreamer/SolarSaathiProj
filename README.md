# SolarSaathi

A working local draft of the Maharashtra rooftop-solar planning platform in the supplied PRD. It uses React, TypeScript, FLOWSTACK Brick 0.3.0, Vite, Express, Zod and a pure shared calculation engine.

This is a **local development draft**, not a production release. Its capacity policy, tariff, yield, installation-cost and carbon assumptions are deliberately labelled as unverified. Do not use its economics as a purchase recommendation.

## Start the app (Windows)

**This computer is already set up.** Open two PowerShell windows in the `SolarSaathiProj` folder.

**Window 1 — start MongoDB and leave it running:**

```powershell
npm.cmd run db:local
```

**Window 2 — start the app and leave it running:**

```powershell
npm.cmd run dev
```

Open **[http://127.0.0.1:5173](http://127.0.0.1:5173)** in your browser.

To log in, enter an Indian mobile number and use the development code shown on the login page. No SMS is sent.

To stop, press **Ctrl+C** in Window 2, then Window 1.

### First-time setup on another Windows computer

1. Install **Node.js 20.19 or later** and **MongoDB Community Server**. Compass alone is not the server.
2. Open the project folder in PowerShell and run:

   ```powershell
   npm.cmd install
   ```

3. If `.env.development` is missing, create it in the project folder with these two lines:

   ```dotenv
   DATA_DRIVER=mongo
   MONGODB_URI=mongodb://127.0.0.1:27018/SOLARSAATHIDB?directConnection=true&replicaSet=solarsaathi-rs
   ```

4. Follow the two-window start instructions above. The app creates its starter data and local secrets automatically.

MongoDB stores this project's data in `.local/mongodb`. For more setup details, see [the database guide](docs/DATABASE.md).

## Try the draft

1. Open the calculator and select **Use example household**, or enter your own planning inputs.
2. Complete the four steps and compare the consumption-cap and sanctioned-load scenarios.
3. Log in to save a household. Any valid-format Indian mobile works locally. The random OTP appears in the API terminal and in a clearly labelled local-only banner. No SMS is sent.
4. In the workspace, add bills, compare two months, and save application references and dates.
5. For staff testing, use analyst `9999999992` and admin `9999999991`. Each gets a fresh OTP. A different admin must approve a draft; publication requires step-up verification. The first OTP request and a step-up request share the 30-second resend cooldown.

The labelled example household is created only when requested. The app does not seed fake bill history into new accounts.

## What works

- Scroll-driven night-to-day canvas sequence, with optimised generated development frames, manifest-based loading, static poster, reduced-motion path and keyboard skip.
- Four-step calculator with draft recovery, bill history branches, roof units, shade adjustment, ownership checks, eight seeded districts, optional future load and vendor quote.
- Deterministic capacity scenarios, configurable subsidy tiers, slab bills, simplified forward banking, panel degradation, inverter replacement, payback and 25-year projection.
- Saved immutable input/output/rule snapshots, source notes, results charts, accessible monthly data table, personal checklist and browser print/save-as-PDF.
- Local random OTP login, HMAC-only challenge storage, attempt limits, cooldowns, per-mobile/IP limits, rotating refresh cookies, reuse detection, access revocation, ownership and staff role checks.
- Household dashboard, manual bill create/edit/delete/undo, stale-edit protection, CSV export and actual month-to-month bill comparison.
- Application-stage tracking, reference numbers, dated steps, locally displayed deadline reminder and revision protection.
- Rules/source page, short guides, development privacy/terms pages and English/Marathi/Hindi navigation strings.
- Capacity, tariff, subsidy and district-yield snapshot drafts, three-household impact preview, second-person approval, step-up, stale-draft protection, audit log, SSE change indication and saved-household capacity/subsidy impact notifications.
- API endpoints for session management, profile editing and account deletion. Deletion revokes sessions immediately; local maintenance purges account data after 30 days. Maintenance also expires anonymous calculations after seven days and retains audit events for 90 days.

## MongoDB mode

The current Windows setup uses the installed MongoDB Server executable. Keep the database running in one PowerShell window:

```powershell
npm.cmd run db:local
```

In another PowerShell window, run `npm.cmd run dev`. The local database helper starts or recognises only the project instance on port 27018; it does not reconfigure the existing server on port 27017. For Compass, use:

```text
mongodb://127.0.0.1:27018/SOLARSAATHIDB?directConnection=true&replicaSet=solarsaathi-rs
```

If using Docker on another machine instead:

```powershell
docker compose up -d
Copy-Item .env.example .env.development
# Set DATA_DRIVER=mongo in .env.development.
npm.cmd run db:seed
npm.cmd run dev
```

The compose health check initialises a single-node replica set. Mongo mode refuses a standalone server and creates the documented bill/user indexes. Publishing and record mutations use MongoDB transactions. Validated domain records live in the named Mongoose collections under a `payload` field; this is a draft repository adapter, not the PRD's final optimised collection schema.

MongoDB connection, transaction-based import, collection/index setup and the running API have been verified against the project replica set. See [docs/DATABASE.md](docs/DATABASE.md) for the Compass setup. The Mongo adapter currently reads collection snapshots within transactions; large datasets need query-specific repositories before a pilot. Direct database edits and changes from another API process do not propagate through Mongo change streams yet.

## Commands

| PowerShell command            | Purpose                                                               |
| ----------------------------- | --------------------------------------------------------------------- |
| `npm.cmd run dev`             | API and web with reload                                               |
| `npm.cmd run db:seed`         | Preserve data and add missing local staff accounts                    |
| `npm.cmd run db:local`        | Start the isolated MongoDB replica set on port 27018                  |
| `npm.cmd run db:status`       | Check MongoDB reachability, replica-set name and collections          |
| `npm.cmd run db:migrate-json` | Import JSON records into an empty Mongo app database, preserving JSON |
| `npm.cmd run db:indexes`      | Initialise the selected repository and indexes                        |
| `npm.cmd run typecheck`       | Strict TypeScript check                                               |
| `npm.cmd run lint`            | ESLint checks, including a ban on explicit `any`                      |
| `npm.cmd test`                | Engine golden cases and API/auth/ownership tests                      |
| `npm.cmd run test:e2e`        | Chrome desktop and mobile browser flows                               |
| `npm.cmd run build`           | Typecheck and production asset build                                  |
| `npm.cmd start`               | Serve the built assets and API at `127.0.0.1:4000` in local mode      |
| `npm.cmd run hero:frames`     | Regenerate the development WebP sequence                              |
| `npm.cmd run format`          | Format source and configuration                                       |

For the browser tests, Chrome must be installed. The test configuration can use `channel: 'msedge'` if only Edge is available. Tests use synthetic local records. Generated screenshots and traces are ignored under `test-results/`.

## Known draft boundaries

- Policy enforcement and the legal situation are **not verified**. No current MERC tariff order has been ingested. Seeded generation values are not a PVGIS/NASA import. The subsidy source is linked, but eligibility and fractional-kW treatment still require official confirmation.
- The hero is a generated development illustration, not the final cinematic film. No Lighthouse score, 4G first-frame guarantee, mid-range Android frame-rate result, or full WCAG audit is claimed.
- The personalised checklist is generated by the engine; admin editing of checklist templates is deferred. Result checklist ticks are view-local, not persisted.
- Bill comparisons currently cover month versus month. Year comparisons, measured before/after solar baselines, predicted-versus-actual savings, anomaly detection and the full savings bulb/jar experience are deferred. The displayed bill-model variance is explicitly not claimed as measured solar savings.
- Bill OCR, bill/quote uploads, vendor directory and quote comparison, application reminders, source watchers, scheduled irradiance import and WhatsApp integration are not implemented.
- English is the complete content language. Marathi/Hindi navigation and key calculator actions are draft translations; full translation and native-speaker review remain.
- Local queue/cache/file/OTP driver interfaces exist. The queue is in-process. Redis/BullMQ, cloud storage, SMS and email drivers are not implemented. The API refuses non-local or production operation.
- Profile/session/deletion APIs exist; a dedicated account-settings screen is deferred. No consumer number or Aadhaar is collected, so encryption for those future fields is not presented as implemented.
- Public deployment, legal review, trademark/domain checks, cross-browser qualification and policy verification remain separate launch work.

See [DECISIONS.md](DECISIONS.md) for model choices and [docs/FLOWSTACK.md](docs/FLOWSTACK.md) for package authority and UI ownership notes. The original supplied specification is retained as [docs/SolarSaathi PRD.docx](docs/SolarSaathi%20PRD.docx).
