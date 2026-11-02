"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthlyPoint } from "@/lib/aggregateCollections";
import { formatKg } from "@/lib/format";

// Single series (one entity's monthly total) — a single sequential hue, no
// legend needed (the section title names the series). Thin bar, rounded
// data-end, recessive gridlines/axes, hover tooltip — see dataviz skill.
//
// This was indigo-600, the one saturated colour in an otherwise entirely grey
// product, matching nothing else in it. It now reads from the brand token so
// the chart belongs to the same system as everything else.
const BAR_COLOR = "var(--color-brand-600)";

export function SixMonthChart({ data, seriesLabel = "Leaf quantity" }: { data: MonthlyPoint[]; seriesLabel?: string }) {
  const isEmpty = data.every((d) => d.totalKg === 0);

  // A Recharts SVG is invisible to a screen reader — no role, no title, no text
  // alternative — and the six-month view is a named requirement on all three
  // roles. The summary below is what a non-sighted user gets instead of the
  // picture, and the table underneath is the real alternative: every value,
  // readable and selectable.
  const summary = isEmpty
    ? "No collections recorded in the last 6 months."
    : `${seriesLabel} by month, ${data[0].label} to ${data[data.length - 1].label}. ` +
      data.map((d) => `${d.label}: ${formatKg(d.totalKg)} kg`).join(". ") + ".";

  return (
    <figure className="m-0">
      <div className="relative h-64 w-full rounded-card border border-gray-200 bg-white p-4">
        {isEmpty && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-sm text-gray-500">No collections recorded in the last 6 months.</p>
          </div>
        )}
        <div className={isEmpty ? "opacity-0" : ""} aria-hidden={isEmpty} role="img" aria-label={summary}>
          <ResponsiveContainer width="100%" height={224}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} stroke="#d1d5db" />
              <YAxis
                tick={{ fontSize: 12, fill: "#6b7280" }}
                stroke="#d1d5db"
                width={40}
                label={{ value: "kg", angle: -90, position: "insideLeft", fontSize: 12, fill: "#6b7280" }}
              />
              <Tooltip
                cursor={{ fill: "#f3f4f6" }}
                formatter={(value) => [`${formatKg(Number(value))} kg`, "Quantity"]}
                contentStyle={{ fontSize: 12, borderRadius: 6, borderColor: "#e5e7eb" }}
              />
              <Bar dataKey="totalKg" fill={BAR_COLOR} radius={[3, 3, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!isEmpty && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900">
            View as table
          </summary>
          <table className="mt-2 w-full max-w-xs text-sm">
            <caption className="sr-only">{seriesLabel} by month, last 6 months</caption>
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th scope="col" className="py-1.5 font-medium">Month</th>
                <th scope="col" className="py-1.5 text-right font-medium">Quantity (kg)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((d) => (
                <tr key={d.label}>
                  <td className="py-1.5">{d.label}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatKg(d.totalKg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </figure>
  );
}
