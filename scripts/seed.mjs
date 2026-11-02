#!/usr/bin/env node
/**
 * Adds plausible demo data to a Blue Hills Tea Factory database, alongside what's there.
 *
 *   node scripts/seed.mjs --emulator     needs Auth + Firestore emulators running
 *   node scripts/seed.mjs --production   writes to the project in .env.local
 *
 * Production needs an existing admin login in a gitignored `.env.seed`:
 *   SEED_ADMIN_EMAIL=...
 *   SEED_ADMIN_PASSWORD=...
 *
 * There is no Admin SDK on this project, so everything goes through
 * firestore.rules: a collector login writes collections, supplier logins file
 * requests and advances, and the admin login does the rest. New logins are
 * written to the gitignored `.env.seed-accounts` with a random shared password.
 *
 * Grades and rates are read from the database and never written, so seeded pay
 * slips are priced exactly as the app would price them. Existing documents are
 * left untouched, apart from advancing the two ID counters.
 *
 * Every new document carries `seedBatch`, so seeded data can be told apart later.
 * The rules forbid deleting most of these documents from a client, so the
 * script refuses to run if that batch is already present.
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
} from "firebase/auth";
import {
  Timestamp,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

const SEED_BATCH = "demo-2026-11";
const EMAIL_DOMAIN = "bluemount.example"; // reserved TLD: can never reach a real inbox
const HISTORY_START = "2026-04-01";
const EMULATOR_PROJECT = "demo-bluemount";
// Separate files, so an emulator test can never overwrite production's password.
const ACCOUNTS_FILE = process.argv.includes("--production") ? ".env.seed-accounts" : ".env.seed-accounts.emulator";

const mode = process.argv.includes("--production")
  ? "production"
  : process.argv.includes("--emulator")
    ? "emulator"
    : null;
if (!mode) {
  console.error("Pass --emulator or --production.");
  process.exit(1);
}

// ---------------------------------------------------------------- reference data

// Existing grades, in the order of each supplier's `mix` weights.
const GRADE_NAMES = ["AA", "A", "BOPF"];

const COLLECTORS = [
  { login: "nimal", name: "Nimal Perera", phone: "0715550101", address: "12 Station Road, Hatton", joinDate: "2023-02-06" },
  { login: "sivakumar", name: "Sivakumar Rajan", phone: "0775550102", address: "44 Main Street, Bogawantalawa", joinDate: "2023-08-14" },
  { login: "kasun", name: "Kasun Bandara", phone: "0765550103", address: "7 Temple Road, Talawakelle", joinDate: "2024-05-20" },
  { login: "ruwan", name: "Ruwan Jayasinghe", phone: "0705550104", address: "23 Bazaar Street, Kotagala", joinDate: "2023-03-13", leftOn: "2026-07-31" },
];

// Weekdays use 0 = Sunday. Route 3 changes hands when Ruwan leaves.
const ROUTES = {
  1: { days: [1, 3, 5], collector: () => "nimal" },
  2: { days: [2, 4, 6], collector: () => "sivakumar" },
  3: { days: [1, 4], collector: (date) => (date <= "2026-07-31" ? "ruwan" : "kasun") },
  4: { days: [2, 5], collector: () => "kasun" },
};

// mix = likelihood of each of GRADE_NAMES; baseKg = a typical delivery.
const SUPPLIERS = [
  { login: "wimalasena", name: "A. M. Wimalasena", phone: "0715550201", address: "Dickoya Road, Hatton", joinDate: "2023-03-01", route: 1, baseKg: 42, mix: [0.5, 0.35, 0.15] },
  { login: "kumari", name: "K. G. Kumari Dissanayake", phone: "0725550202", address: "Upper Division, Dickoya", joinDate: "2023-03-15", route: 1, baseKg: 28, mix: [0.3, 0.45, 0.25] },
  { login: "ramasamy", name: "P. Ramasamy", phone: "0775550203", address: "Norwood Junction, Norwood", joinDate: "2023-04-10", route: 1, baseKg: 55, mix: [0.2, 0.45, 0.35] },
  { login: "gunawardena", name: "S. D. Gunawardena", phone: "0765550204", address: "Kehelgamuwa Road, Norton Bridge", joinDate: "2023-06-05", route: 1, baseKg: 35, mix: [0.45, 0.4, 0.15] },
  { login: "selvarani", name: "M. Selvarani", phone: "0775550205", address: "Lower Town, Bogawantalawa", joinDate: "2023-09-01", route: 2, baseKg: 24, mix: [0.25, 0.4, 0.35] },
  { login: "herath", name: "H. M. Herath", phone: "0715550206", address: "Campion Road, Bogawantalawa", joinDate: "2023-09-18", route: 2, baseKg: 62, mix: [0.55, 0.3, 0.15] },
  { login: "krishnan", name: "V. Krishnan", phone: "0705550207", address: "Maskeliya Road, Maskeliya", joinDate: "2024-01-22", route: 2, baseKg: 38, mix: [0.3, 0.4, 0.3] },
  { login: "sumanawathi", name: "R. Sumanawathi", phone: "0725550208", address: "Lake View, Maskeliya", joinDate: "2024-02-12", route: 2, baseKg: 19, mix: [0.2, 0.5, 0.3] },
  { login: "fernando", name: "L. A. Fernando", phone: "0765550209", address: "Railway Road, Talawakelle", joinDate: "2023-05-08", route: 3, baseKg: 47, mix: [0.4, 0.4, 0.2] },
  { login: "thangaraj", name: "S. Thangaraj", phone: "0775550210", address: "St. Clair Road, Talawakelle", joinDate: "2023-07-03", route: 3, baseKg: 33, mix: [0.25, 0.45, 0.3] },
  { login: "rathnayake", name: "D. P. Rathnayake", phone: "0715550211", address: "Devon Road, Kotagala", joinDate: "2024-03-25", route: 3, baseKg: 26, mix: [0.35, 0.4, 0.25] },
  { login: "mallika", name: "T. Mallika Senanayake", phone: "0725550212", address: "Agarapathana Road, Agarapathana", joinDate: "2026-07-06", route: 4, baseKg: 22, mix: [0.3, 0.5, 0.2] },
  { login: "balasubramaniam", name: "K. Balasubramaniam", phone: "0705550213", address: "Upper Estate Road, Agarapathana", joinDate: "2024-06-17", route: 4, baseKg: 51, mix: [0.35, 0.35, 0.3] },
  { login: "piyadasa", name: "W. Piyadasa", phone: "0765550214", address: "Pattana Road, Kotagala", joinDate: "2023-10-09", route: 4, baseKg: 30, mix: [0.3, 0.4, 0.3], leftOn: "2026-08-22" },
];

// Upcountry crop rises in the April-May flush and dips in the July-August dry spell.
const SEASON = { "04": 1.2, "05": 1.25, "06": 1.0, "07": 0.82, "08": 0.75, "09": 0.95, "10": 1.1, "11": 1.05, "12": 1.0 };
const NO_COLLECTION_DAYS = new Set(["2026-04-13", "2026-04-14", "2026-05-01", "2026-05-31"]);

const REQUEST_ITEMS = [
  { type: "fertilizer", description: "T750 tea fertilizer, 50 kg bag", qty: [1, 3], unitCost: 11500 },
  { type: "fertilizer", description: "T65 tea fertilizer, 50 kg bag", qty: [1, 2], unitCost: 12800 },
  { type: "fertilizer", description: "Dolomite, 50 kg bag", qty: [1, 4], unitCost: 1850 },
  { type: "teaPowder", description: "BOPF tea powder, 1 kg pack", qty: [2, 8], unitCost: 1450 },
  { type: "teaPowder", description: "Dust grade tea powder, 500 g pack", qty: [2, 10], unitCost: 650 },
];

const ADVANCE_NOTES = [
  "School fees and books",
  "Family medical expenses",
  "Roof repair after the rains",
  "Wages for pluckers this month",
  "Weeding and drain clearing labour",
  "Loan instalment",
  "",
];

// ---------------------------------------------------------------- helpers

// Seeded, so a same-day emulator run previews what production will receive.
// Clock times in stamp() are cosmetic and use Math.random, because they're drawn
// inside concurrent writes and would otherwise reorder this sequence.
let rngState = 20261102;
function random() {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min, max) => min + Math.floor(random() * (max - min + 1));
const pick = (items) => items[randInt(0, items.length - 1)];

// The app derives "today" from UTC (aggregateCollections.ts); match it.
const now = new Date();
const TODAY = now.toISOString().slice(0, 10);

function addDays(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Never stamps a time later than now, even for today's date.
function stamp(iso, hour = 8) {
  const d = new Date(`${iso}T${String(hour).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}:00Z`);
  return Timestamp.fromDate(d > now ? now : d);
}

function monthEnd(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

function monthsBetween(startIso, endIso) {
  const months = [];
  let cursor = startIso.slice(0, 7);
  while (cursor <= endIso.slice(0, 7)) {
    months.push(cursor);
    cursor = addDays(`${cursor}-28`, 7).slice(0, 7);
  }
  return months;
}

// A grade can only be recorded on dates it has a rate for, or the app would
// block that month's pay slip.
function pickGrade(mix, date) {
  const usable = GRADE_NAMES.map((name, i) => ({ name, weight: rateFor(name, date) == null ? 0 : mix[i] }));
  let roll = random() * usable.reduce((sum, u) => sum + u.weight, 0);
  for (const u of usable) {
    roll -= u.weight;
    if (u.weight > 0 && roll <= 0) return u.name;
  }
  throw new Error(`No grade has a rate on ${date}.`);
}

function otherGrade(gradeName, date) {
  return pick(GRADE_NAMES.filter((name) => name !== gradeName && rateFor(name, date) != null));
}

const roundHalfKg = (kg) => Math.max(3, Math.round(kg * 2) / 2);

// Filled from the database in loadGradesAndRates().
const gradeByName = {};
let rateEntries = [];

// Same rule as findEffectiveRate() in src/lib/rates.ts, over the same query
// order, so two rates sharing an effectiveFrom resolve the way the app does.
function rateFor(gradeName, date) {
  const gradeId = gradeByName[gradeName].id;
  let best = null;
  for (const r of rateEntries) {
    if (r.gradeId !== gradeId || r.effectiveFrom > date) continue;
    if (!best || r.effectiveFrom > best.effectiveFrom) best = r;
  }
  return best ? best.ratePerKg : null;
}

async function pool(tasks, size = 8) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < tasks.length) await tasks[next++]();
    }),
  );
}

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const values = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match) values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

// ---------------------------------------------------------------- connections

function firebaseConfig() {
  if (mode === "emulator") return { apiKey: "demo-key", projectId: EMULATOR_PROJECT, appId: "demo-app" };
  const env = readEnvFile(".env.local");
  return {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

const config = firebaseConfig();
const openApps = [];

function openConnection(name) {
  const app = initializeApp(config, name);
  openApps.push(app);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (mode === "emulator") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(db, "127.0.0.1", 8080);
  }
  return { auth, db };
}

async function connectAdmin() {
  const admin = openConnection("seed-admin");
  if (mode === "production") {
    const env = readEnvFile(".env.seed");
    if (!env.SEED_ADMIN_EMAIL || !env.SEED_ADMIN_PASSWORD) {
      throw new Error("Put SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD in .env.seed first.");
    }
    const { user } = await signInWithEmailAndPassword(admin.auth, env.SEED_ADMIN_EMAIL, env.SEED_ADMIN_PASSWORD);
    return { ...admin, uid: user.uid };
  }

  // The first admin is normally made by hand in the console; the emulator's
  // "owner" token stands in for that step. Emulator only.
  const email = `admin@${EMAIL_DOMAIN}`;
  const emulatorPassword = "emulator-only";
  const { user } = await createUserWithEmailAndPassword(admin.auth, email, emulatorPassword).catch((error) => {
    if (error.code !== "auth/email-already-in-use") throw error;
    return signInWithEmailAndPassword(admin.auth, email, emulatorPassword);
  });
  const response = await fetch(
    `http://127.0.0.1:8080/v1/projects/${EMULATOR_PROJECT}/databases/(default)/documents/users?documentId=${user.uid}`,
    {
      method: "POST",
      headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
      body: JSON.stringify({
        fields: {
          role: { stringValue: "admin" },
          displayName: { stringValue: "Emulator Admin" },
          linkedId: { stringValue: "" },
          active: { booleanValue: true },
        },
      }),
    },
  );
  // 409: already bootstrapped by an earlier run against this emulator.
  if (!response.ok && response.status !== 409) throw new Error(`Couldn't bootstrap the emulator admin: ${response.status}`);
  return { ...admin, uid: user.uid };
}

async function assertAdminAndNotSeeded(admin) {
  const profile = await getDoc(doc(admin.db, "users", admin.uid));
  if (profile.data()?.role !== "admin" || profile.data()?.active !== true) {
    throw new Error("The signed-in account is not an active admin.");
  }

  const names = ["suppliers", "collectors", "collections", "requests", "advances", "deductions", "payslips"];
  const occupied = [];
  for (const name of names) {
    const snap = await getDocs(query(collection(admin.db, name), where("seedBatch", "==", SEED_BATCH), limit(1)));
    if (!snap.empty) occupied.push(name);
  }
  if (occupied.length) {
    throw new Error(`Refusing to seed: batch ${SEED_BATCH} is already in: ${occupied.join(", ")}.`);
  }
}

async function loadGradesAndRates(admin) {
  const grades = await getDocs(collection(admin.db, "grades"));
  for (const name of GRADE_NAMES) {
    const match = grades.docs.find((d) => d.get("name") === name && d.get("active") === true);
    if (!match) throw new Error(`Expected an active grade named "${name}".`);
    gradeByName[name] = { id: match.id, name };
  }
  // The same query as useRateHistory().
  const rates = await getDocs(query(collection(admin.db, "rateHistory"), orderBy("effectiveFrom", "desc")));
  rateEntries = rates.docs.map((d) => d.data());
}

async function readCounter(admin, kind) {
  const snap = await getDoc(doc(admin.db, "counters", kind));
  return snap.data()?.lastNumber ?? 0;
}

// ---------------------------------------------------------------- planning

function planCollections(supplierIdByLogin) {
  const entries = [];
  for (const supplier of SUPPLIERS) {
    const route = ROUTES[supplier.route];
    const first = supplier.joinDate > HISTORY_START ? supplier.joinDate : HISTORY_START;
    const last = supplier.leftOn && supplier.leftOn < TODAY ? supplier.leftOn : TODAY;

    for (let date = first; date <= last; date = addDays(date, 1)) {
      if (!route.days.includes(new Date(`${date}T00:00:00Z`).getUTCDay())) continue;
      if (NO_COLLECTION_DAYS.has(date)) continue;
      // Nobody delivers every round, but keep today populated for the dashboards.
      if (date !== TODAY && random() < 0.12) continue;

      const total = supplier.baseKg * SEASON[date.slice(5, 7)] * (0.75 + random() * 0.5);
      const collector = route.collector(date);
      const base = { supplierId: supplierIdByLogin[supplier.login], collectorLogin: collector, date };

      if (random() < 0.25 && total >= 15) {
        const firstGrade = pickGrade(supplier.mix, date);
        let secondGrade = pickGrade(supplier.mix, date);
        if (secondGrade === firstGrade) secondGrade = otherGrade(firstGrade, date);
        const firstShare = 0.55 + random() * 0.3;
        entries.push({ ...base, gradeKey: firstGrade, quantityKg: roundHalfKg(total * firstShare) });
        entries.push({ ...base, gradeKey: secondGrade, quantityKg: roundHalfKg(total * (1 - firstShare)) });
      } else {
        entries.push({ ...base, gradeKey: pickGrade(supplier.mix, date), quantityKg: roundHalfKg(total) });
      }
    }
  }
  return entries;
}

function eligibleSupplier(date) {
  const candidates = SUPPLIERS.filter((s) => s.joinDate <= date && (!s.leftOn || date <= addDays(s.leftOn, -21)));
  return pick(candidates);
}

// Rejections are counted rather than rolled, so every status is sure to appear.
const REJECT_EVERY = 6;
let decisions = 0;

// Status follows from elapsed time, so recent filings are still in the queue.
function planRequests(supplierIdByLogin) {
  const requests = [];
  // Open work for the admin's queues. Suppliers at odd SUPPLIERS positions have
  // no pay slip for the newest month, so their deductions stay outstanding.
  const recent = (login, item, quantity, status, daysAgo) => ({
    supplierId: supplierIdByLogin[login],
    supplierLogin: login,
    type: item.type,
    description: item.description,
    quantity,
    date: addDays(TODAY, -daysAgo),
    decidedOn: addDays(TODAY, -daysAgo + 3),
    fulfilledOn: addDays(TODAY, -daysAgo + 7),
    status,
    cost: quantity * item.unitCost,
  });
  requests.push(
    recent("wimalasena", REQUEST_ITEMS[0], 2, "pending", 0),
    recent("selvarani", REQUEST_ITEMS[3], 4, "pending", 1),
    recent("fernando", REQUEST_ITEMS[2], 3, "pending", 2),
    recent("krishnan", REQUEST_ITEMS[1], 1, "approved", 5),
    recent("rathnayake", REQUEST_ITEMS[4], 6, "approved", 6),
    recent("sumanawathi", REQUEST_ITEMS[3], 3, "fulfilled", 11),
    recent("gunawardena", REQUEST_ITEMS[0], 1, "fulfilled", 13),
  );
  for (const month of monthsBetween(HISTORY_START, TODAY)) {
    for (let i = randInt(2, 4); i > 0; i--) {
      const date = `${month}-${String(randInt(1, 28)).padStart(2, "0")}`;
      if (date > TODAY) continue;
      const supplier = eligibleSupplier(date);
      const item = pick(REQUEST_ITEMS);
      const quantity = randInt(item.qty[0], item.qty[1]);
      const decidedOn = addDays(date, randInt(2, 6));
      const fulfilledOn = addDays(decidedOn, randInt(3, 12));

      let status = "pending";
      if (decidedOn <= TODAY) {
        decisions += 1;
        if (decisions % REJECT_EVERY === 0) status = "rejected";
        else status = fulfilledOn <= TODAY ? "fulfilled" : "approved";
      }
      requests.push({
        supplierId: supplierIdByLogin[supplier.login],
        supplierLogin: supplier.login,
        type: item.type,
        description: item.description,
        quantity,
        date,
        decidedOn,
        fulfilledOn,
        status,
        cost: quantity * item.unitCost,
      });
    }
  }
  return requests;
}

function planAdvances(supplierIdByLogin) {
  const advances = [];
  const recent = (login, amount, notes, status, daysAgo) => ({
    supplierId: supplierIdByLogin[login],
    supplierLogin: login,
    amount,
    notes,
    date: addDays(TODAY, -daysAgo),
    decidedOn: addDays(TODAY, -daysAgo + 2),
    status,
  });
  advances.push(
    recent("ramasamy", 15000, "Deepavali expenses", "pending", 0),
    recent("balasubramaniam", 20000, "Deepavali expenses", "pending", 1),
    recent("mallika", 5000, "School fees and books", "pending", 2),
    recent("kumari", 10000, "Family medical expenses", "approved", 7),
    recent("herath", 25000, "Wages for pluckers this month", "approved", 6),
    recent("thangaraj", 8000, "Deepavali expenses", "approved", 5),
  );
  for (const month of monthsBetween(HISTORY_START, TODAY)) {
    for (let i = randInt(2, 3); i > 0; i--) {
      const date = `${month}-${String(randInt(1, 28)).padStart(2, "0")}`;
      if (date > TODAY) continue;
      const supplier = eligibleSupplier(date);
      const decidedOn = addDays(date, randInt(1, 4));

      let status = "pending";
      if (decidedOn <= TODAY) {
        decisions += 1;
        status = decisions % REJECT_EVERY === 0 ? "rejected" : "approved";
      }

      // Scaled to what the supplier actually earns, rounded the way cash is.
      const amount = Math.max(5000, Math.round((supplier.baseKg * randInt(150, 500)) / 1000) * 1000);
      let notes = pick(ADVANCE_NOTES);
      if (month === "2026-04") notes = "Sinhala and Tamil New Year expenses";
      if (month === "2026-11" || (month === "2026-10" && date >= "2026-10-20")) notes = "Deepavali expenses";

      advances.push({
        supplierId: supplierIdByLogin[supplier.login],
        supplierLogin: supplier.login,
        amount,
        notes,
        date,
        decidedOn,
        status,
      });
    }
  }
  return advances;
}

// Mirrors computeGrossPay() and generatePayslip() in src/lib.
function planPayslips(entries, deductions, supplierIdByLogin) {
  const payslips = [];
  const completedMonths = monthsBetween(HISTORY_START, TODAY).filter((m) => monthEnd(m) < TODAY);
  const newestMonth = completedMonths.at(-1);

  completedMonths.forEach((month) => {
    SUPPLIERS.forEach((supplier, index) => {
      // The newest month is only half done, leaving real work on the admin's Pay Slips page.
      if (month === newestMonth && index % 2 === 1) return;

      const supplierId = supplierIdByLogin[supplier.login];
      const periodStart = `${month}-01`;
      const periodEnd = monthEnd(month);
      const inPeriod = entries.filter((e) => e.supplierId === supplierId && e.date >= periodStart && e.date <= periodEnd);
      if (!inPeriod.length) return;

      const lines = new Map();
      let grossKg = 0;
      let grossAmount = 0;
      for (const e of inPeriod) {
        const amount = rateFor(e.gradeKey, e.date) * e.quantityKg;
        grossKg += e.quantityKg;
        grossAmount += amount;
        const line = lines.get(e.gradeKey) ?? {
          gradeId: gradeByName[e.gradeKey].id,
          gradeName: gradeByName[e.gradeKey].name,
          quantityKg: 0,
          amount: 0,
        };
        line.quantityKg += e.quantityKg;
        line.amount += amount;
        lines.set(e.gradeKey, line);
      }

      const plannedOn = addDays(periodEnd, randInt(3, 6));
      const generatedAt = stamp(plannedOn > TODAY ? TODAY : plannedOn, 9);

      // An admin wouldn't wipe out a month's pay, so large deductions wait for a later slip.
      const absorbed = [];
      let deductionTotal = 0;
      for (const d of deductions) {
        if (d.supplierId !== supplierId || d.applied || d.createdAt.toMillis() > generatedAt.toMillis()) continue;
        if (deductionTotal + d.amount > grossAmount * 0.6) continue;
        d.applied = true;
        absorbed.push(d);
        deductionTotal += d.amount;
      }

      payslips.push({
        supplierId,
        supplierName: supplier.name,
        periodStart,
        periodEnd,
        gradeBreakdown: [...lines.values()],
        grossKg,
        grossAmount,
        absorbed,
        deductionTotal,
        netAmount: grossAmount - deductionTotal,
        generatedAt,
      });
    });
  });
  return payslips;
}

// ---------------------------------------------------------------- main

async function main() {
  console.log(`Target: ${mode} (project ${config.projectId}); history ${HISTORY_START} to ${TODAY}`);

  const admin = await connectAdmin();
  await assertAdminAndNotSeeded(admin);
  await loadGradesAndRates(admin);
  const lastSupplier = await readCounter(admin, "supplier");
  const lastCollector = await readCounter(admin, "collector");

  const password = randomBytes(12).toString("base64url");
  const tag = { seedBatch: SEED_BATCH };
  const emailFor = (person) => `${person.login}@${EMAIL_DOMAIN}`;

  // Saved before any account exists, so a failed run can't strand its logins.
  writeFileSync(
    ACCOUNTS_FILE,
    [
      `# Demo logins created by scripts/seed.mjs for ${config.projectId}. All share one password.`,
      `SEED_PASSWORD=${password}`,
      ...COLLECTORS.map((p) => `# collector: ${emailFor(p)}${p.leftOn ? " (deactivated)" : ""}`),
      ...SUPPLIERS.map((p) => `# supplier: ${emailFor(p)}${p.leftOn ? " (deactivated)" : ""}`),
      "",
    ].join("\n"),
    { mode: 0o600 },
  );

  // Keeps the app's own ID generator continuing after the seeded IDs. Advanced
  // first, so a failed run can't leave IDs the app would hand out again.
  await setDoc(doc(admin.db, "counters", "supplier"), { lastNumber: lastSupplier + SUPPLIERS.length }, { merge: true });
  await setDoc(doc(admin.db, "counters", "collector"), { lastNumber: lastCollector + COLLECTORS.length }, { merge: true });

  // People and their logins
  const actors = {};
  const supplierIdByLogin = {};
  async function registerPeople(people, collectionName, prefix, role, lastNumber) {
    let number = lastNumber;
    for (const person of people) {
      number += 1;
      const id = `${prefix}-${String(number).padStart(4, "0")}`;
      const connection = openConnection(`seed-${person.login}`);
      const { user } = await createUserWithEmailAndPassword(connection.auth, emailFor(person), password);
      await setDoc(doc(admin.db, "users", user.uid), {
        role,
        displayName: person.name,
        linkedId: id,
        active: true,
        createdAt: stamp(person.joinDate),
        ...tag,
      });
      await setDoc(doc(admin.db, collectionName, id), {
        name: person.name,
        contact: person.phone,
        address: person.address,
        joinDate: person.joinDate,
        active: true,
        authUid: user.uid,
        createdAt: stamp(person.joinDate),
        ...tag,
      });
      actors[person.login] = { ...connection, uid: user.uid, id };
      if (role === "supplier") supplierIdByLogin[person.login] = id;
    }
  }
  await registerPeople(COLLECTORS, "collectors", "COL", "collector", lastCollector);
  await registerPeople(SUPPLIERS, "suppliers", "SUP", "supplier", lastSupplier);
  console.log(`collectors: ${COLLECTORS.length}, suppliers: ${SUPPLIERS.length}`);

  // Collections, each written by the collector who made the round
  const entries = planCollections(supplierIdByLogin);
  await pool(
    entries.map((e) => () => {
      const actor = actors[e.collectorLogin];
      return setDoc(doc(collection(actor.db, "collections")), {
        supplierId: e.supplierId,
        collectorId: actor.id,
        date: e.date,
        gradeId: gradeByName[e.gradeKey].id,
        quantityKg: e.quantityKg,
        createdBy: actor.uid,
        createdAt: stamp(e.date, 7 + Math.floor(Math.random() * 5)),
        ...tag,
      });
    }),
  );
  console.log(`collections: ${entries.length}`);

  // Requests: the supplier files, then the admin decides and fulfils
  const deductions = [];
  const requests = planRequests(supplierIdByLogin);
  await pool(
    requests.map((r) => async () => {
      const ref = doc(collection(actors[r.supplierLogin].db, "requests"));
      await setDoc(ref, {
        supplierId: r.supplierId,
        type: r.type,
        description: r.description,
        quantity: r.quantity,
        status: "pending",
        requestedAt: stamp(r.date, 6),
        decidedAt: null,
        decidedBy: null,
        fulfilledAt: null,
        fulfilledBy: null,
        deductionId: null,
        ...tag,
      });
      if (r.status === "pending") return;

      const adminRef = doc(admin.db, "requests", ref.id);
      const decided = {
        status: r.status === "rejected" ? "rejected" : "approved",
        decidedAt: stamp(r.decidedOn, 9),
        decidedBy: admin.uid,
      };
      if (r.status !== "fulfilled") return updateDoc(adminRef, decided);

      const deductionRef = doc(collection(admin.db, "deductions"));
      const createdAt = stamp(r.fulfilledOn, 10);
      const batch = writeBatch(admin.db);
      batch.set(deductionRef, {
        supplierId: r.supplierId,
        type: r.type,
        amount: r.cost,
        sourceId: ref.id,
        appliedToPayslipId: null,
        createdAt,
        ...tag,
      });
      batch.update(adminRef, {
        ...decided,
        status: "fulfilled",
        fulfilledAt: createdAt,
        fulfilledBy: admin.uid,
        deductionId: deductionRef.id,
      });
      await batch.commit();
      deductions.push({ id: deductionRef.id, supplierId: r.supplierId, type: r.type, amount: r.cost, createdAt });
    }),
  );
  console.log(`requests: ${requests.length}`);

  // Advances: approving is the disbursement, so the deduction lands at the same moment
  const advances = planAdvances(supplierIdByLogin);
  await pool(
    advances.map((a) => async () => {
      const ref = doc(collection(actors[a.supplierLogin].db, "advances"));
      await setDoc(ref, {
        supplierId: a.supplierId,
        amount: a.amount,
        notes: a.notes,
        status: "pending",
        createdAt: stamp(a.date, 6),
        decidedAt: null,
        decidedBy: null,
        deductionId: null,
        ...tag,
      });
      if (a.status === "pending") return;

      const adminRef = doc(admin.db, "advances", ref.id);
      const decidedAt = stamp(a.decidedOn, 9);
      if (a.status === "rejected") {
        return updateDoc(adminRef, { status: "rejected", decidedAt, decidedBy: admin.uid });
      }

      const deductionRef = doc(collection(admin.db, "deductions"));
      const batch = writeBatch(admin.db);
      batch.set(deductionRef, {
        supplierId: a.supplierId,
        type: "advance",
        amount: a.amount,
        sourceId: ref.id,
        appliedToPayslipId: null,
        createdAt: decidedAt,
        ...tag,
      });
      batch.update(adminRef, { status: "approved", decidedAt, decidedBy: admin.uid, deductionId: deductionRef.id });
      await batch.commit();
      deductions.push({ id: deductionRef.id, supplierId: a.supplierId, type: "advance", amount: a.amount, createdAt: decidedAt });
    }),
  );
  console.log(`advances: ${advances.length}, deductions: ${deductions.length}`);

  // Pool order isn't chronological; pay slips must absorb oldest deductions first.
  deductions.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis());

  // Pay slips, written with their deductions in one batch like generatePayslip()
  const payslips = planPayslips(entries, deductions, supplierIdByLogin);
  await pool(
    payslips.map((p) => () => {
      const ref = doc(collection(admin.db, "payslips"));
      const batch = writeBatch(admin.db);
      batch.set(ref, {
        supplierId: p.supplierId,
        supplierName: p.supplierName,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        gradeBreakdown: p.gradeBreakdown,
        grossKg: p.grossKg,
        grossAmount: p.grossAmount,
        deductions: p.absorbed.map((d) => ({ deductionId: d.id, type: d.type, amount: d.amount })),
        deductionTotal: p.deductionTotal,
        netAmount: p.netAmount,
        generatedAt: p.generatedAt,
        generatedBy: admin.uid,
        ...tag,
      });
      for (const d of p.absorbed) {
        batch.update(doc(admin.db, "deductions", d.id), { appliedToPayslipId: ref.id });
      }
      return batch.commit();
    }),
  );
  console.log(`payslips: ${payslips.length}, outstanding deductions: ${deductions.filter((d) => !d.applied).length}`);

  // Done last: deactivation revokes the write access used above.
  for (const person of COLLECTORS.filter((p) => p.leftOn)) {
    await updateDoc(doc(admin.db, "collectors", actors[person.login].id), { active: false });
    await updateDoc(doc(admin.db, "users", actors[person.login].uid), { active: false });
  }
  for (const person of SUPPLIERS.filter((p) => p.leftOn)) {
    await updateDoc(doc(admin.db, "suppliers", actors[person.login].id), { active: false });
    await updateDoc(doc(admin.db, "users", actors[person.login].uid), { active: false });
  }

  console.log(`Done. Logins are in ${ACCOUNTS_FILE}`);
}

try {
  await main();
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await Promise.all(openApps.map((app) => deleteApp(app)));
}
