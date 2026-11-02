/**
 * Single source of truth for every status pill in the app. StatusBadge and
 * RequestStatusBadge used to each hard-code their own color map — easy for
 * the two palettes to drift as statuses were added. Both are now thin
 * wrappers around this one tone table.
 */
const TONE_STYLES: Record<string, string> = {
  neutral: "bg-gray-100 text-gray-600",
  positive: "bg-green-100 text-green-800",
  pending: "bg-amber-100 text-amber-800",
  negative: "bg-red-100 text-red-800",
  info: "bg-blue-100 text-blue-800",
};

export function Badge({ tone, children }: { tone: keyof typeof TONE_STYLES; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs capitalize ${TONE_STYLES[tone]}`}>{children}</span>
  );
}
