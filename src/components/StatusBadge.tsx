import { Badge } from "@/components/Badge";

export function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? "positive" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>;
}
