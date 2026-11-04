import { mongo } from 'mongoose';
import { loadConfig } from '../apps/api/src/config';
import { energyBill } from '../packages/engine';
import type { CalculationInput } from '../packages/schemas';
import type { Application, Bill, Household, SavedCalculation } from '../apps/api/src/types';

const config = await loadConfig();
if (config.DATA_DRIVER !== 'mongo') throw new Error('The Compass demo requires DATA_DRIVER=mongo.');
const base = `http://127.0.0.1:${config.PORT}/api/v1`;
const demoMobile = '9999999990';
const demoName = 'DEMO — SolarSaathi User';
const demoHome = 'DEMO — Pune Solar Home';
let token = '',
  cookie = '';
async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(base + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-SS-Client': 'web',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const result = (await response.json()) as T & { message?: string; error?: string };
  if (!response.ok)
    throw new Error(`${method} ${path}: ${result.message || result.error || response.status}`);
  return result;
}
const health = await api<{ ok: boolean; dataDriver: string }>('/health');
if (!health.ok || health.dataDriver !== 'mongo')
  throw new Error('Start the API with MongoDB enabled before running the demo.');

console.info('1. Send a local demo login through POST /auth/otp/request and /auth/otp/verify.');
const challenge = await api<{ challengeId: string; devCode?: string }>(
  '/auth/otp/request',
  'POST',
  { mobile: demoMobile },
);
if (!challenge.devCode) throw new Error('This command requires the local console OTP driver.');
const login = await api<{ accessToken: string; user: { id: string; displayName: string } }>(
  '/auth/otp/verify',
  'POST',
  { challengeId: challenge.challengeId, code: challenge.devCode, consent: true },
);
token = login.accessToken;
try {
  if (!['Solar explorer', demoName].includes(login.user.displayName))
    throw new Error(
      'The demo mobile already belongs to a personalised local account; it was not modified.',
    );
  await api('/me', 'PATCH', { displayName: demoName, preferredLang: 'en' });
  const homes = await api<Household[]>('/households');
  let home = homes.find((h) => h.nickname === demoHome);
  if (!home) {
    const units = [380, 370, 400, 450, 520, 650, 600, 480, 400, 420, 390, 340];
    const input: CalculationInput = {
      discomCode: 'MSEDCL',
      consumerCategory: 'LT_RESIDENTIAL',
      phaseType: 'SINGLE',
      sanctionedLoadKw: 5,
      monthlyUnits: units.map((unitsKwh, i) => ({
        billMonth: new Date(Date.UTC(2025, 10 + i, 1)).toISOString().slice(0, 7),
        unitsKwh,
      })),
      roofAreaSqM: 60,
      shadowFreePct: 90,
      ownershipType: 'OWN',
      districtCode: 'PUNE',
      expectedAddedLoadKw: 0,
      vendorQuoteInr: 165000,
    };
    console.info(
      '2. Calculate the demo roof through POST /calculate; save it through POST /households.',
    );
    const calculation = await api<SavedCalculation>('/calculate', 'POST', input);
    home = await api<Household>('/households', 'POST', {
      nickname: demoHome,
      calculationId: calculation.id,
    });
  } else console.info('2. Reuse the labelled demo household; preserve existing records.');
  const calculation = await api<SavedCalculation>(`/calculations/${home.calculationId}`);
  const householdPath = `/households/${home.id}`;
  const existingBills = await api<Bill[]>(householdPath + '/bills');
  const tariff = calculation.ruleSnapshot.tariff;
  console.info('3. Add missing monthly demo bills through the same endpoint the Bills page uses.');
  let addedBills = 0;
  for (const month of calculation.inputSnapshot.monthlyUnits) {
    if (existingBills.some((b) => b.billMonth === month.billMonth)) continue;
    await api(householdPath + '/bills', 'POST', {
      billMonth: month.billMonth,
      unitsKwh: month.unitsKwh,
      amountInr: Math.round(energyBill(month.unitsKwh, tariff)),
      fixedChargeInr: tariff.fixedChargeInr,
      facInr: Math.round(month.unitsKwh * tariff.facInrPerKwh),
      dutyInr: Math.round(
        (energyBill(month.unitsKwh, tariff) * tariff.dutyPct) / (100 + tariff.dutyPct),
      ),
    });
    addedBills++;
  }
  console.info('4. Save labelled, fictional application references through PUT /application.');
  let application = await api<Application>(householdPath + '/application');
  if (!application.version)
    application = await api<Application>(householdPath + '/application', 'PUT', {
      ...application,
      stage: 3,
      nationalPortalAppNo: 'DEMO-NATIONAL-2026-001',
      discomAppNo: 'DEMO-MSEDCL-2026-001',
      sanctionedOn: '2026-10-20',
      steps: { '0': '2026-10-01', '1': '2026-10-05', '2': '2026-10-10', '3': '2026-10-20' },
      checklistProgress: ['IDENTITY'],
    });
  const bills = await api<Bill[]>(householdPath + '/bills');
  const readBack = await api<Household>(householdPath);
  console.info(
    '5. Read the saved records back through GET endpoints and verify the matching MongoDB documents.',
  );
  const client = new mongo.MongoClient(config.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
  try {
    await client.connect();
    const database = client.db();
    const homeDocument = await database
      .collection<{ _id: string; payload: Household }>('households')
      .findOne({ _id: home.id });
    const billCount = await database
      .collection('billEntries')
      .countDocuments({ 'payload.householdId': home.id });
    const calculationDocument = await database
      .collection<{ _id: string; payload: SavedCalculation }>('calculations')
      .findOne({ _id: home.calculationId });
    const applicationDocument = await database
      .collection<{ _id: string; payload: Application }>('applications')
      .findOne({ _id: application.id });
    if (
      homeDocument?.payload.nickname !== readBack.nickname ||
      billCount !== bills.length ||
      !calculationDocument ||
      !applicationDocument
    )
      throw new Error('The API response did not match the database documents.');
    const result =
      calculation.outputSnapshot.scenarios[calculation.outputSnapshot.headlineScenario];
    console.info(
      JSON.stringify(
        {
          verified: true,
          database: database.databaseName,
          demoUser: demoName,
          demoLogin: demoMobile,
          userId: login.user.id,
          householdId: home.id,
          calculationId: home.calculationId,
          applicationId: application.id,
          bills: billCount,
          billsAdded: addedBills,
          capacityKw: result.capacityKw,
          subsidyInr: result.subsidyInr,
          householdUrl: `http://127.0.0.1:5173/app/households/${home.id}`,
          compassFilter: { 'payload.nickname': demoHome },
        },
        null,
        2,
      ),
    );
  } finally {
    await client.close();
  }
} finally {
  await api('/auth/logout', 'POST', {}).catch(() => undefined);
}
