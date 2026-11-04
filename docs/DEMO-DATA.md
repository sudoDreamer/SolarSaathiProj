# See data flowing through SolarSaathi

Start everything with `npm.cmd run dev` and leave that PowerShell window open. Run this in a second window:

```powershell
npm.cmd run db:demo
```

This creates a fictional local user named **DEMO — SolarSaathi User**, a household named **DEMO — Pune Solar Home**, 12 monthly bills, a solar calculation and an application with `DEMO-` reference numbers. It uses the normal API endpoints, reads the results back, and checks the matching documents directly in MongoDB. Existing demo bills are preserved when run again. If you rerun within 30 seconds, wait for the OTP cooldown.

## Open the right Compass connection

Use the saved connection **SolarSaathi Project (27018)**, then open **SOLARSAATHIDB**. Its connection string is:

```text
mongodb://127.0.0.1:27018/SOLARSAATHIDB?replicaSet=solarsaathi-rs
```

The older connection on port 27017 points to another server and its empty `projectdb` collection. Keep the project database terminal running while inspecting port 27018.

Open `households`, select the Documents tab and put this in Filter:

```json
{ "payload.nickname": "DEMO — Pune Solar Home" }
```

Click **Find**. Expand `payload` to see the stored fields. The app's current Mongo adapter stores each record as `{ _id, payload }`.

## Follow the linked records

| Collection     | What to look at                                                                     | Link to the next record                                               |
| -------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `users`        | Filter `payload.displayName` to `DEMO — SolarSaathi User`                           | Its `_id` appears as `payload.userId` in the household                |
| `households`   | The named demo home, roof and connection details                                    | `payload.calculationId` matches a calculation's `_id`                 |
| `calculations` | Expand `payload.inputSnapshot`, `payload.outputSnapshot` and `payload.ruleSnapshot` | Inputs, computed values and the exact policy snapshot used            |
| `billEntries`  | Filter `payload.householdId` to the household's `_id`                               | Twelve related monthly records                                        |
| `applications` | Use the same `payload.householdId` filter                                           | Fictional references, dates and current stage                         |
| `ruleVersions` | Expand the active record's `payload.snapshot`                                       | Capacity assumptions, tariff slabs, subsidy tiers and district yields |

For example, after copying the household `_id`, filter the bills with:

```json
{ "payload.householdId": "PASTE-HOUSEHOLD-ID-HERE" }
```

## See it in the app

Log in with **9999999990** and the development OTP shown on the login page. Open **DEMO — Pune Solar Home**. Its result, bills, comparison and application tracker read the same records displayed in Compass.

Add a bill for a new month in the app, or edit one of the demo bills. In Compass, refresh `billEntries` using the household filter. The new values should appear. Reload the Bills page to confirm the API reads them back.

The flow is **page → API validation → MongoDB document → API response → page**. These are fictional examples using illustrative rates, not real customer records or official application approvals.
