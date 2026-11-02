import { createLinkedUser } from "@/lib/createLinkedUser";
import { createRosterApi, type RosterKind } from "@/lib/roster";

export interface CreateLoginForRecordInput {
  role: Extract<RosterKind, "supplier" | "collector">;
  linkedId: string;
  displayName: string;
  email: string;
  tempPassword: string;
}

/** Creates the login (Phase 1's secondary-app trick), then links it back onto the supplier/collector record. */
export async function createLoginForRecord(input: CreateLoginForRecordInput): Promise<string> {
  const uid = await createLinkedUser(input);
  const api = createRosterApi(input.role === "supplier" ? "suppliers" : "collectors", input.role);
  await api.linkAuthUid(input.linkedId, uid);
  return uid;
}
