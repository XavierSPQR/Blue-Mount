import { readFileSync } from "node:fs";
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from "firebase/firestore";

// Fixture identities. Every scenario below is built from this same small
// cast so the "who can see/do what" matrix stays easy to read.
const ADMIN = "admin1";
const COLLECTOR_1 = "collector1"; // linkedId COL-0001
const COLLECTOR_2 = "collector2"; // linkedId COL-0002
const SUPPLIER_1 = "supplier1"; // linkedId SUP-0001
const SUPPLIER_2 = "supplier2"; // linkedId SUP-0002
const INACTIVE_SUPPLIER = "inactiveSupplier"; // linkedId SUP-0003, active: false

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-blue-mount-tea",
    firestore: {
      rules: readFileSync("firestore.rules", "utf8"),
      host: "127.0.0.1",
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

beforeEach(async () => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await Promise.all([
      setDoc(doc(db, "users", ADMIN), { role: "admin", displayName: "Admin", linkedId: "", active: true }),
      setDoc(doc(db, "users", COLLECTOR_1), {
        role: "collector",
        displayName: "Collector One",
        linkedId: "COL-0001",
        active: true,
      }),
      setDoc(doc(db, "users", COLLECTOR_2), {
        role: "collector",
        displayName: "Collector Two",
        linkedId: "COL-0002",
        active: true,
      }),
      setDoc(doc(db, "users", SUPPLIER_1), {
        role: "supplier",
        displayName: "Supplier One",
        linkedId: "SUP-0001",
        active: true,
      }),
      setDoc(doc(db, "users", SUPPLIER_2), {
        role: "supplier",
        displayName: "Supplier Two",
        linkedId: "SUP-0002",
        active: true,
      }),
      setDoc(doc(db, "users", INACTIVE_SUPPLIER), {
        role: "supplier",
        displayName: "Deactivated Supplier",
        linkedId: "SUP-0003",
        active: false,
      }),

      setDoc(doc(db, "suppliers", "SUP-0001"), {
        name: "Supplier One",
        contact: "071",
        address: "Estate Rd",
        joinDate: "2026-01-01",
        active: true,
        authUid: SUPPLIER_1,
      }),
      setDoc(doc(db, "suppliers", "SUP-0002"), {
        name: "Supplier Two",
        contact: "072",
        address: "Estate Rd",
        joinDate: "2026-01-01",
        active: true,
        authUid: SUPPLIER_2,
      }),
      setDoc(doc(db, "suppliers", "SUP-0003"), {
        name: "Deactivated Supplier",
        contact: "073",
        address: "Estate Rd",
        joinDate: "2026-01-01",
        active: false,
        authUid: INACTIVE_SUPPLIER,
      }),
      setDoc(doc(db, "collectors", "COL-0001"), {
        name: "Collector One",
        contact: "071",
        address: "Estate Rd",
        joinDate: "2026-01-01",
        active: true,
        authUid: COLLECTOR_1,
      }),

      setDoc(doc(db, "grades", "GR-A"), { name: "Grade A", active: true }),

      setDoc(doc(db, "collections", "entry1"), {
        supplierId: "SUP-0001",
        collectorId: "COL-0001",
        date: "2026-08-01",
        gradeId: "GR-A",
        quantityKg: 10,
        createdBy: COLLECTOR_1,
      }),

      setDoc(doc(db, "requests", "req1"), {
        supplierId: "SUP-0001",
        type: "fertilizer",
        description: "Urea",
        quantity: 2,
        status: "pending",
      }),

      setDoc(doc(db, "advances", "adv1"), {
        supplierId: "SUP-0001",
        amount: 5000,
        notes: "",
        status: "pending",
      }),

      setDoc(doc(db, "deductions", "ded1"), {
        supplierId: "SUP-0001",
        type: "advance",
        amount: 5000,
        sourceId: "adv1",
        appliedToPayslipId: null,
      }),

      setDoc(doc(db, "rateHistory", "rate1"), {
        gradeId: "GR-A",
        ratePerKg: 100,
        effectiveFrom: "2026-01-01",
        setBy: ADMIN,
      }),

      setDoc(doc(db, "payslips", "pay1"), {
        supplierId: "SUP-0001",
        supplierName: "Supplier One",
        periodStart: "2026-08-01",
        periodEnd: "2026-08-31",
        gradeBreakdown: [],
        grossKg: 10,
        grossAmount: 1000,
        deductions: [],
        deductionTotal: 0,
        netAmount: 1000,
        generatedBy: ADMIN,
      }),
    ]);
  });
});

function dbFor(uid: string | null) {
  return (uid ? testEnv.authenticatedContext(uid) : testEnv.unauthenticatedContext()).firestore();
}

describe("users", () => {
  it("lets a user read their own profile", async () => {
    await assertSucceeds(getDoc(doc(dbFor(SUPPLIER_1), "users", SUPPLIER_1)));
  });

  it("blocks reading someone else's profile if you're not admin", async () => {
    await assertFails(getDoc(doc(dbFor(SUPPLIER_1), "users", SUPPLIER_2)));
  });

  it("lets admin read any profile", async () => {
    await assertSucceeds(getDoc(doc(dbFor(ADMIN), "users", SUPPLIER_1)));
  });

  it("lets a DEACTIVATED user still read their own profile (how the app detects it)", async () => {
    await assertSucceeds(getDoc(doc(dbFor(INACTIVE_SUPPLIER), "users", INACTIVE_SUPPLIER)));
  });

  it("blocks a non-admin from creating a user doc", async () => {
    await assertFails(
      setDoc(doc(dbFor(SUPPLIER_1), "users", "newuser"), {
        role: "supplier",
        displayName: "New",
        linkedId: "SUP-0099",
        active: true,
      }),
    );
  });

  it("lets admin create a user doc (account provisioning)", async () => {
    await assertSucceeds(
      setDoc(doc(dbFor(ADMIN), "users", "newuser"), {
        role: "supplier",
        displayName: "New",
        linkedId: "SUP-0099",
        active: true,
      }),
    );
  });

  it("blocks deleting a user doc even for admin (deactivate, never delete)", async () => {
    await assertFails(deleteDoc(doc(dbFor(ADMIN), "users", SUPPLIER_1)));
  });
});

describe("suppliers", () => {
  it("lets admin read any supplier", async () => {
    await assertSucceeds(getDoc(doc(dbFor(ADMIN), "suppliers", "SUP-0001")));
  });

  it("lets a collector read the roster", async () => {
    await assertSucceeds(getDoc(doc(dbFor(COLLECTOR_1), "suppliers", "SUP-0001")));
  });

  it("lets a supplier read their own record", async () => {
    await assertSucceeds(getDoc(doc(dbFor(SUPPLIER_1), "suppliers", "SUP-0001")));
  });

  it("blocks a supplier from reading another supplier's record", async () => {
    await assertFails(getDoc(doc(dbFor(SUPPLIER_1), "suppliers", "SUP-0002")));
  });

  it("REGRESSION: blocks a DEACTIVATED supplier from reading even their own record", async () => {
    await assertFails(getDoc(doc(dbFor(INACTIVE_SUPPLIER), "suppliers", "SUP-0003")));
  });

  it("blocks a non-admin from creating/updating a supplier", async () => {
    await assertFails(
      setDoc(doc(dbFor(SUPPLIER_1), "suppliers", "SUP-0099"), {
        name: "x",
        contact: "",
        address: "",
        joinDate: "2026-01-01",
        active: true,
        authUid: null,
      }),
    );
    await assertFails(updateDoc(doc(dbFor(COLLECTOR_1), "suppliers", "SUP-0001"), { name: "Renamed" }));
  });

  it("lets admin create/update a supplier", async () => {
    await assertSucceeds(updateDoc(doc(dbFor(ADMIN), "suppliers", "SUP-0001"), { name: "Renamed" }));
  });

  it("blocks deleting a supplier even for admin (deactivate, never delete)", async () => {
    await assertFails(deleteDoc(doc(dbFor(ADMIN), "suppliers", "SUP-0001")));
  });
});

describe("collectors", () => {
  it("lets admin read any collector; blocks a supplier", async () => {
    await assertSucceeds(getDoc(doc(dbFor(ADMIN), "collectors", "COL-0001")));
    await assertFails(getDoc(doc(dbFor(SUPPLIER_1), "collectors", "COL-0001")));
  });

  it("lets a collector read their own record", async () => {
    await assertSucceeds(getDoc(doc(dbFor(COLLECTOR_1), "collectors", "COL-0001")));
  });
});

describe("counters", () => {
  it("is admin-only for both read and write", async () => {
    await assertFails(getDoc(doc(dbFor(COLLECTOR_1), "counters", "supplier")));
    await assertSucceeds(setDoc(doc(dbFor(ADMIN), "counters", "supplier"), { lastNumber: 1 }));
  });
});

describe("collections (leaf entries)", () => {
  const validEntry = {
    supplierId: "SUP-0001",
    collectorId: "COL-0001",
    date: "2026-08-05",
    gradeId: "GR-A",
    quantityKg: 5,
    createdBy: COLLECTOR_1,
  };

  it("lets a collector create an entry under their own collectorId/createdBy", async () => {
    await assertSucceeds(addDoc(collection(dbFor(COLLECTOR_1), "collections"), validEntry));
  });

  it("blocks recording an entry under another collector's collectorId", async () => {
    await assertFails(
      addDoc(collection(dbFor(COLLECTOR_1), "collections"), { ...validEntry, collectorId: "COL-0002" }),
    );
  });

  it("blocks attributing the entry to someone other than the caller", async () => {
    await assertFails(
      addDoc(collection(dbFor(COLLECTOR_1), "collections"), { ...validEntry, createdBy: COLLECTOR_2 }),
    );
  });

  it("blocks a non-positive quantity", async () => {
    await assertFails(addDoc(collection(dbFor(COLLECTOR_1), "collections"), { ...validEntry, quantityKg: 0 }));
  });

  it("blocks a missing/empty gradeId", async () => {
    await assertFails(addDoc(collection(dbFor(COLLECTOR_1), "collections"), { ...validEntry, gradeId: "" }));
  });

  it("blocks a supplier from creating a collection entry", async () => {
    await assertFails(addDoc(collection(dbFor(SUPPLIER_1), "collections"), validEntry));
  });

  it("is append-only: no update/delete, even for admin", async () => {
    await assertFails(updateDoc(doc(dbFor(ADMIN), "collections", "entry1"), { quantityKg: 999 }));
    await assertFails(deleteDoc(doc(dbFor(ADMIN), "collections", "entry1")));
  });

  it("scopes reads to admin, the owning collector, and the named supplier", async () => {
    await assertSucceeds(getDoc(doc(dbFor(ADMIN), "collections", "entry1")));
    await assertSucceeds(getDoc(doc(dbFor(COLLECTOR_1), "collections", "entry1")));
    await assertFails(getDoc(doc(dbFor(COLLECTOR_2), "collections", "entry1")));
    await assertSucceeds(getDoc(doc(dbFor(SUPPLIER_1), "collections", "entry1")));
    await assertFails(getDoc(doc(dbFor(SUPPLIER_2), "collections", "entry1")));
  });
});

describe("requests", () => {
  const validRequest = {
    supplierId: "SUP-0001",
    type: "fertilizer",
    description: "Urea",
    quantity: 1,
    status: "pending",
  };

  it("lets a supplier file their own pending request", async () => {
    await assertSucceeds(addDoc(collection(dbFor(SUPPLIER_1), "requests"), validRequest));
  });

  it("blocks filing a request under another supplier's ID", async () => {
    await assertFails(
      addDoc(collection(dbFor(SUPPLIER_1), "requests"), { ...validRequest, supplierId: "SUP-0002" }),
    );
  });

  it("blocks self-approving at creation time", async () => {
    await assertFails(
      addDoc(collection(dbFor(SUPPLIER_1), "requests"), { ...validRequest, status: "approved" }),
    );
  });

  it("blocks a non-positive quantity", async () => {
    await assertFails(addDoc(collection(dbFor(SUPPLIER_1), "requests"), { ...validRequest, quantity: 0 }));
  });

  it("blocks a supplier from updating status themself", async () => {
    await assertFails(updateDoc(doc(dbFor(SUPPLIER_1), "requests", "req1"), { status: "approved" }));
  });

  it("lets admin decide (approve/reject/fulfill) a request", async () => {
    await assertSucceeds(updateDoc(doc(dbFor(ADMIN), "requests", "req1"), { status: "approved" }));
  });

  it("scopes reads to admin and the owning supplier only", async () => {
    await assertSucceeds(getDoc(doc(dbFor(SUPPLIER_1), "requests", "req1")));
    await assertFails(getDoc(doc(dbFor(SUPPLIER_2), "requests", "req1")));
    await assertFails(getDoc(doc(dbFor(COLLECTOR_1), "requests", "req1")));
    await assertSucceeds(getDoc(doc(dbFor(ADMIN), "requests", "req1")));
  });
});

describe("advances", () => {
  const validAdvance = { supplierId: "SUP-0001", amount: 1000, notes: "", status: "pending" };

  it("lets a supplier request their own pending advance", async () => {
    await assertSucceeds(addDoc(collection(dbFor(SUPPLIER_1), "advances"), validAdvance));
  });

  it("blocks requesting an advance under another supplier's ID", async () => {
    await assertFails(
      addDoc(collection(dbFor(SUPPLIER_1), "advances"), { ...validAdvance, supplierId: "SUP-0002" }),
    );
  });

  it("blocks a non-positive amount", async () => {
    await assertFails(addDoc(collection(dbFor(SUPPLIER_1), "advances"), { ...validAdvance, amount: 0 }));
  });

  it("blocks a supplier from approving/rejecting themself", async () => {
    await assertFails(updateDoc(doc(dbFor(SUPPLIER_1), "advances", "adv1"), { status: "approved" }));
  });

  it("lets admin approve/reject", async () => {
    await assertSucceeds(updateDoc(doc(dbFor(ADMIN), "advances", "adv1"), { status: "approved" }));
  });
});

describe("deductions", () => {
  it("is never created/updated directly by a client — admin only", async () => {
    await assertFails(
      addDoc(collection(dbFor(SUPPLIER_1), "deductions"), {
        supplierId: "SUP-0001",
        type: "advance",
        amount: 100,
        sourceId: "adv1",
        appliedToPayslipId: null,
      }),
    );
    await assertSucceeds(
      addDoc(collection(dbFor(ADMIN), "deductions"), {
        supplierId: "SUP-0001",
        type: "advance",
        amount: 100,
        sourceId: "adv1",
        appliedToPayslipId: null,
      }),
    );
  });

  it("lets a supplier read only their own deductions", async () => {
    await assertSucceeds(getDoc(doc(dbFor(SUPPLIER_1), "deductions", "ded1")));
    await assertFails(getDoc(doc(dbFor(SUPPLIER_2), "deductions", "ded1")));
  });
});

describe("grades", () => {
  it("lets admin and collector read; blocks supplier", async () => {
    await assertSucceeds(getDoc(doc(dbFor(ADMIN), "grades", "GR-A")));
    await assertSucceeds(getDoc(doc(dbFor(COLLECTOR_1), "grades", "GR-A")));
    await assertFails(getDoc(doc(dbFor(SUPPLIER_1), "grades", "GR-A")));
  });

  it("is admin-only to create/update", async () => {
    await assertFails(updateDoc(doc(dbFor(COLLECTOR_1), "grades", "GR-A"), { name: "Renamed" }));
    await assertSucceeds(updateDoc(doc(dbFor(ADMIN), "grades", "GR-A"), { name: "Renamed" }));
  });

  it("blocks deleting a grade even for admin (retire via active:false)", async () => {
    await assertFails(deleteDoc(doc(dbFor(ADMIN), "grades", "GR-A")));
  });
});

describe("rateHistory", () => {
  it("is admin-only for read and create", async () => {
    await assertFails(getDoc(doc(dbFor(COLLECTOR_1), "rateHistory", "rate1")));
    await assertFails(getDoc(doc(dbFor(SUPPLIER_1), "rateHistory", "rate1")));
    await assertSucceeds(getDoc(doc(dbFor(ADMIN), "rateHistory", "rate1")));
  });

  it("is append-only: no update/delete, even for admin", async () => {
    await assertFails(updateDoc(doc(dbFor(ADMIN), "rateHistory", "rate1"), { ratePerKg: 200 }));
    await assertFails(deleteDoc(doc(dbFor(ADMIN), "rateHistory", "rate1")));
  });
});

describe("payslips", () => {
  it("is admin-only to create", async () => {
    await assertFails(
      addDoc(collection(dbFor(SUPPLIER_1), "payslips"), {
        supplierId: "SUP-0001",
        supplierName: "Supplier One",
        periodStart: "2026-09-01",
        periodEnd: "2026-09-30",
        gradeBreakdown: [],
        grossKg: 0,
        grossAmount: 0,
        deductions: [],
        deductionTotal: 0,
        netAmount: 0,
        generatedBy: SUPPLIER_1,
      }),
    );
  });

  it("lets a supplier read only their own pay slips", async () => {
    await assertSucceeds(getDoc(doc(dbFor(SUPPLIER_1), "payslips", "pay1")));
    await assertFails(getDoc(doc(dbFor(SUPPLIER_2), "payslips", "pay1")));
    await assertFails(getDoc(doc(dbFor(COLLECTOR_1), "payslips", "pay1")));
  });

  it("is immutable: no update/delete, even for admin", async () => {
    await assertFails(updateDoc(doc(dbFor(ADMIN), "payslips", "pay1"), { netAmount: 0 }));
    await assertFails(deleteDoc(doc(dbFor(ADMIN), "payslips", "pay1")));
  });
});

describe("everything else / unauthenticated", () => {
  it("denies an unauthenticated request across the board", async () => {
    await assertFails(getDoc(doc(dbFor(null), "suppliers", "SUP-0001")));
    await assertFails(getDoc(doc(dbFor(null), "users", ADMIN)));
  });

  it("denies access to an undeclared collection, even for admin", async () => {
    await assertFails(getDocs(collection(dbFor(ADMIN), "somethingNotInTheRules")));
  });
});
