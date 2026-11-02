import { Children, cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from "react";

/**
 * Label + control + error, wired together.
 *
 * This used to render a bare <label> with no htmlFor, and none of its call
 * sites gave their input an id — so across roughly 30 fields the label was
 * decorative text. Tapping it didn't focus the control (which matters most on
 * the phone a collector uses in the field), and a screen reader announced
 * "combo box" with no name, so there was no way to tell Supplier from Grade.
 * Error text had the same problem in reverse: it rendered as a loose paragraph
 * nothing pointed at, so a failed submit was silent.
 *
 * Generating the id here and cloning it onto the child fixes every call site
 * at once — they pass the same children they always did.
 */
export function FormField({
  label,
  error,
  hint,
  children,
}: {
  label: string;
  error?: string;
  /** Optional guidance shown under the control and linked via aria-describedby. */
  hint?: string;
  children: ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  const child = Children.only(children);
  const control = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, {
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
      })
    : child;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-gray-700">
        {label}
      </label>
      {control}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-gray-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
