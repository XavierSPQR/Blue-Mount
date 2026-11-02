import { Badge } from "@/components/Badge";

const TONE_BY_STATUS: Record<string, "pending" | "positive" | "negative" | "info" | "neutral"> = {
  pending: "pending",
  approved: "positive",
  rejected: "negative",
  fulfilled: "info",
};

export function RequestStatusBadge({ status }: { status: string }) {
  return <Badge tone={TONE_BY_STATUS[status] ?? "neutral"}>{status}</Badge>;
}
