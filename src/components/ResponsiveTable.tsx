"use client";

/**
 * Every list in the app rendered a plain <table> with overflow-x-auto — on a
 * phone that's still a sideways-scrolling table, not a phone-shaped one,
 * despite collectors (and suppliers) working this app from the field. Below
 * `sm` this renders the same rows as stacked cards instead; the column
 * `render` functions are shared between both, so badges/buttons/links don't
 * need a second implementation.
 */
import type { ReactNode } from "react";

export interface ResponsiveTableColumn<T> {
  key: string;
  header: string;
  align?: "left" | "right";
  render: (row: T) => ReactNode;
  /** Omit this column from the mobile card — use when it duplicates cardTitle or is pure noise at that size. */
  hideOnCard?: boolean;
}

/** Placeholder row count — enough to suggest a list, few enough not to imply one. */
const SKELETON_ROWS = [0, 1, 2];

export function ResponsiveTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyMessage,
  cardTitle,
}: {
  columns: ResponsiveTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyMessage: ReactNode;
  /** Heading for each mobile card — usually the same value as the table's first column. */
  cardTitle: (row: T) => ReactNode;
}) {
  const cardColumns = columns.filter((c) => !c.hideOnCard);

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "row" : "rows"}`}
      </p>
      <div className="hidden overflow-x-auto rounded-card border border-gray-200 bg-white sm:block">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={`px-4 py-2 font-medium text-gray-500 ${c.align === "right" ? "text-right" : "text-left"}`}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading &&
              SKELETON_ROWS.map((row) => (
                <tr key={row} aria-hidden>
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <span className={`skeleton ${c.align === "right" ? "ml-auto w-16" : "w-28"}`} />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-4 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-2 ${c.align === "right" ? "text-right" : ""}`}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="sm:hidden">
        {loading && (
          <ul className="space-y-3">
            {SKELETON_ROWS.map((row) => (
              <li key={row} aria-hidden className="rounded-card border border-gray-200 bg-white p-4">
                <span className="skeleton w-32" />
                <span className="skeleton mt-3 w-full" />
                <span className="skeleton mt-2 w-3/4" />
              </li>
            ))}
          </ul>
        )}
        {!loading && rows.length === 0 && (
          <p className="rounded-card border border-gray-200 bg-white px-4 py-4 text-center text-sm text-gray-500">
            {emptyMessage}
          </p>
        )}
        {rows.length > 0 && (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={rowKey(row)} className="rounded-card border border-gray-200 bg-white p-4">
                <p className="font-medium text-gray-900">{cardTitle(row)}</p>
                <dl className="mt-2 space-y-1.5">
                  {cardColumns.map((c) => (
                    <div key={c.key} className="flex items-center justify-between gap-3 text-sm">
                      <dt className="text-gray-500">{c.header}</dt>
                      <dd className="text-right text-gray-900">{c.render(row)}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
