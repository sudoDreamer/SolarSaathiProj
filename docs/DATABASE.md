# MongoDB and Compass

MongoDB Server stores the data. Compass is a desktop app for connecting to that server and inspecting databases, documents and indexes. The SolarSaathi backend connects directly to the same MongoDB Server using a connection string; it does not connect through Compass.

## The Create Database dialog

Use the database name `SOLARSAATHIDB` and the first collection name `users`. Leave Time-Series unchecked. There is no need to create the other collections manually. An empty `projectdb` collection, if already created, can remain unused.

MongoDB uses **collections**, **documents** and **embedded documents**, rather than SQL tables and subtables. The models and indexes belong in the application code and can be created by its seed/setup command.

## Connect the backend

The app is now connected to the **project replica set on port 27018**. In Compass, add a connection using this exact URI:

```text
mongodb://127.0.0.1:27018/SOLARSAATHIDB?replicaSet=solarsaathi-rs
```

Open `SOLARSAATHIDB` there to see the app collections. The database previously created on port 27017 belongs to the original standalone server; that server and its `projectdb` collection were not modified.

The ignored `.env.development` is configured with `DATA_DRIVER=mongo` and the project URI. Existing local JSON records were imported into the project replica set in one transaction. The JSON original was preserved. The database helper stores MongoDB files at `.local/mongodb` and logs at `.local/mongod.log`.

To restart the project database and app, use two PowerShell windows:

```powershell
# Window 1: leave running
npm.cmd run db:local
```

```powershell
# Window 2
npm.cmd run db:status
npm.cmd run dev
```

The following steps apply when connecting a different MongoDB deployment:

1. In Compass, open the saved connection's menu and copy its connection string. Preserve its host, port, authentication and other options.
2. In the project root, copy `.env.example` to `.env.development` if that file does not already exist. Do not overwrite existing local secrets or configuration.
3. Set `DATA_DRIVER=mongo` and set `MONGODB_URI` to that server's URI, using `/SOLARSAATHIDB` as the database path. The example below assumes a local server on port 27017 with no authentication. It is not a verified description of your saved Compass connection.

```dotenv
LOCAL_MODE=true
DATA_DRIVER=mongo
MONGODB_URI=mongodb://127.0.0.1:27017/SOLARSAATHIDB?directConnection=true
```

Then run in PowerShell:

```powershell
npm.cmd run db:status
npm.cmd run db:seed
npm.cmd run dev
```

`db:status` is read-only. It reports connection availability and whether the server is a replica set. The existing draft requires a replica set for its transactional record updates and review publishing. Creating the database in Compass does **not** turn a standalone server into a replica set. Do not reconfigure an existing MongoDB service just to make this draft connect; use a separately configured local replica set or the supplied Docker compose setup.

MongoDB Server 9.0 was found at `C:\Program Files\MongoDB\Server\9.0\bin\mongod.exe`, outside PATH. The project helper uses that executable to run the separate replica set. It does not change Windows services. `db:status` confirms the active environment's database and replica-set configuration.

The draft's Mongo repository and collection setup are already present in `apps/api/src/store.ts`. Once the connection works, `db:seed` initialises its models, indexes, active snapshot and local staff fixtures. Do not paste an authenticated database URI into public source files or chat; keep it in the ignored environment file.

## What is stored now

| Collection      | What the app writes                                                                                | What the app reads it for                                    |
| --------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `users`         | Mobile number, profile, role, consent, deletion status                                             | Login, permissions and owned data                            |
| `otpChallenges` | OTP HMAC, purpose, expiry, attempts                                                                | Code verification, cooldowns and lockout                     |
| `sessions`      | Refresh-token hash, token family, expiry, revocation                                               | Persistent login, refresh rotation and logout                |
| `households`    | Owner ID, name, location, connection, roof, solar status                                           | Dashboard and household pages                                |
| `billEntries`   | Household ID, month, units, payable amount and optional charges/import/export                      | Bill history, edits, CSV and comparisons                     |
| `calculations`  | Input snapshot, output snapshot, complete rule snapshot, version IDs and hashed claim key          | Reproducible results and anonymous-to-account claim          |
| `applications`  | Household ID, stage, references, entered dates and revision                                        | Personal application tracker                                 |
| `ruleVersions`  | Complete immutable capacity/tariff/subsidy/yield snapshot, draft/review state, author and reviewer | Calculator assumptions, admin review and source transparency |
| `notifications` | User ID and capacity/subsidy change message                                                        | Workspace change notices                                     |
| `auditLogs`     | Staff/user action, actor, record ID, timestamp and note                                            | Review and authentication history                            |
| `storeRevision` | A revision counter                                                                                 | Serialising Mongo transaction updates in this draft          |

Relationships use IDs: one user owns households; one household owns monthly bills and an application; calculations refer to the household/user and preserve the policy versions they used. Monthly bill records are separate documents because the history can grow. Slabs and subsidy tiers are small arrays embedded in a versioned snapshot.

The draft Mongo adapter currently wraps each validated domain record in a `payload` document. Its collection layout will therefore look like `{ _id, payload: { ...fields } }` in Compass. It is an implemented development adapter, not yet the PRD's final query-optimised Mongoose schema layout.

## What stays outside MongoDB

- React source, CSS, fonts, icons, hero frames and static guides are project files.
- Access JWTs stay in browser memory; raw refresh tokens stay in an httpOnly cookie. Only their hashes are stored in MongoDB.
- The unsaved calculator draft and anonymous claim key stay in browser session storage until submitted or claimed.
- UI state such as the selected scenario and result checklist ticks is local to the view.
- Future uploads should store file metadata/references in MongoDB and file bytes in the file-store driver. Uploads/OCR are not active in this draft.

## Planned PRD collections

Before a production pilot, the combined snapshot can be separated into `ruleVersions`, `tariffVersions`, `subsidySchemes`, `irradianceYields` and `checklistTemplates`, preserving immutable version IDs and transactional publishing. Vendor work adds `vendors` and `vendorRateCards`; source watching adds review tasks. Those additional collections should be created when their features are implemented, not as empty speculative tables in Compass.

Official references: [Connect Compass](https://www.mongodb.com/docs/compass/connect/), [Manage databases](https://www.mongodb.com/docs/compass/databases/), and [Replica-set setup](https://www.mongodb.com/docs/manual/tutorial/deploy-replica-set/).
