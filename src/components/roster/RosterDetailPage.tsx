"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { FirebaseError } from "firebase/app";
import { FormField } from "@/components/FormField";
import { StatusBadge } from "@/components/StatusBadge";
import { useRosterDoc } from "@/hooks/useRoster";
import { createRosterApi, type RosterCollection, type RosterFormInput, type RosterKind } from "@/lib/roster";
import { createLoginForRecord } from "@/lib/createLoginForRecord";
import { useToast } from "@/components/ToastProvider";
import { useConfirm } from "@/components/ConfirmProvider";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

const editSchema = z.object({
  name: z.string().min(1, "Name is required"),
  contact: z.string().min(1, "Contact is required"),
  address: z.string().min(1, "Address is required"),
  joinDate: z.string().min(1, "Join date is required"),
});

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  tempPassword: z.string().min(6, "At least 6 characters"),
});
type LoginFormValues = z.infer<typeof loginSchema>;

/** Short, easy-to-read-aloud temp password: mixed-case letters and digits, no
 * visually ambiguous characters (0/O, 1/l/I) since it gets read off a screen
 * and typed by someone else. */
function generateTempPassword(length = 10): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export function RosterDetailPage({
  collectionName,
  idKind,
  role,
  backHref,
  backLabel,
}: {
  collectionName: RosterCollection;
  idKind: RosterKind;
  role: Extract<RosterKind, "supplier" | "collector">;
  backHref: string;
  backLabel: string;
}) {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { record, loading } = useRosterDoc(collectionName, id);
  const api = createRosterApi(collectionName, idKind);
  const { notify } = useToast();
  const confirm = useConfirm();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    reset,
  } = useForm<RosterFormInput>({ resolver: zodResolver(editSchema), values: record ?? undefined });
  useUnsavedChangesGuard(isDirty);

  const [statusPending, setStatusPending] = useState(false);
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    reset: resetLogin,
    setValue: setLoginValue,
    getValues: getLoginValues,
    formState: { errors: loginErrors, isSubmitting: loginSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema) });
  const [copyStatus, setCopyStatus] = useState<"idle" | "copied">("idle");

  if (!id) {
    return <p className="text-sm text-red-600">Missing ID.</p>;
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  if (!record) {
    return (
      <div>
        <p className="text-sm text-red-600">
          No {idKind} found with ID {id}.
        </p>
        <Link href={backHref} className="mt-2 inline-block text-sm text-gray-600 underline">
          {backLabel}
        </Link>
      </div>
    );
  }

  async function onSaveEdit(values: RosterFormInput) {
    try {
      await api.update(id!, values);
      reset(values);
      notify("success", "Changes saved.");
    } catch {
      notify("error", "Couldn't save changes. Please try again.");
    }
  }

  async function onToggleActive() {
    const goingInactive = record!.active;
    if (goingInactive) {
      const ok = await confirm({
        title: `Deactivate ${record!.name}?`,
        message: `${record!.name} (${record!.id}) won't be able to sign in once deactivated. You can reactivate them from this same page at any time.`,
        confirmLabel: "Deactivate",
        tone: "danger",
      });
      if (!ok) return;
    }
    setStatusPending(true);
    try {
      await api.setActive(id!, !record!.active);
      notify("success", goingInactive ? `${record!.name} deactivated.` : `${record!.name} reactivated.`);
    } catch {
      notify("error", "Couldn't update status. Please try again.");
    } finally {
      setStatusPending(false);
    }
  }

  async function onCreateLogin(values: LoginFormValues) {
    try {
      await createLoginForRecord({
        role,
        linkedId: id!,
        displayName: record!.name,
        email: values.email,
        tempPassword: values.tempPassword,
      });
      notify("success", "Login created. Share the email and temporary password with them directly.");
      resetLogin({ email: "", tempPassword: "" });
    } catch (err) {
      const message =
        err instanceof FirebaseError && err.code === "auth/email-already-in-use"
          ? "That email is already registered."
          : "Couldn't create the login. Please try again.";
      notify("error", message);
    }
  }

  async function onCopyPassword() {
    const value = getLoginValues("tempPassword");
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("copied");
      window.setTimeout(() => setCopyStatus("idle"), 2000);
    } catch {
      notify("error", "Couldn't copy — your browser blocked clipboard access. Select and copy the text manually.");
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <Link href={backHref} className="text-sm text-gray-500 underline">
          {backLabel}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{record.name}</h1>
          <StatusBadge active={record.active} />
        </div>
        <p className="text-sm text-gray-500">{record.id}</p>
      </div>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-gray-900">Details</h2>
        <form onSubmit={handleSubmit(onSaveEdit)} className="mt-4 space-y-4" noValidate>
          <FormField label="Name" error={errors.name?.message}>
            <input
              className="field"
              {...register("name")}
            />
          </FormField>
          <FormField label="Contact (phone)" error={errors.contact?.message}>
            <input
              className="field"
              {...register("contact")}
            />
          </FormField>
          <FormField label="Address" error={errors.address?.message}>
            <input
              className="field"
              {...register("address")}
            />
          </FormField>
          <FormField label="Join date" error={errors.joinDate?.message}>
            <input
              type="date"
              className="field"
              {...register("joinDate")}
            />
          </FormField>
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="btn btn-primary"
          >
            {isSubmitting ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-gray-900">Status</h2>
        <p className="mt-1 max-w-prose text-sm text-gray-600">
          {record.active
            ? `Deactivating ${idKind === "supplier" ? "a supplier" : "a collector"} blocks their login and excludes them from the active pickers used when recording collections.`
            : `${record.name} is inactive — they can't sign in, and won't appear in the active-${idKind} pickers elsewhere in the app.`}
        </p>
        <button
          type="button"
          onClick={onToggleActive}
          disabled={statusPending}
          className="btn btn-secondary mt-3"
        >
          {statusPending ? "Updating…" : record.active ? "Mark inactive" : "Mark active"}
        </button>
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-gray-900">Login</h2>
        {record.authUid ? (
          <p className="mt-1 max-w-prose text-sm text-gray-600">
            A login account is already linked to this {idKind}.
          </p>
        ) : (
          <>
            <p className="mt-1 max-w-prose text-sm text-gray-600">
              No login yet — set one up so this {idKind} can sign in.
            </p>
            <form onSubmit={handleLoginSubmit(onCreateLogin)} className="mt-4 max-w-sm space-y-4" noValidate>
              <FormField label="Email" error={loginErrors.email?.message}>
                <input
                  type="email"
                  className="field"
                  {...registerLogin("email")}
                />
              </FormField>
              <div>
                <label htmlFor="temp-password" className="mb-1 block text-sm font-medium text-gray-700">
                  Temporary password
                </label>
                <div className="flex gap-2">
                  <input
                    id="temp-password"
                    type="text"
                    aria-invalid={loginErrors.tempPassword ? true : undefined}
                    aria-describedby={loginErrors.tempPassword ? "temp-password-error" : undefined}
                    className="field"
                    {...registerLogin("tempPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setLoginValue("tempPassword", generateTempPassword(), { shouldValidate: true })}
                    className="btn btn-secondary btn-sm shrink-0"
                  >
                    Generate
                  </button>
                  <button
                    type="button"
                    onClick={onCopyPassword}
                    className="btn btn-secondary btn-sm shrink-0"
                  >
                    {copyStatus === "copied" ? "Copied" : "Copy"}
                  </button>
                </div>
                {loginErrors.tempPassword && (
                  <p id="temp-password-error" className="mt-1 text-xs text-red-600">
                    {loginErrors.tempPassword.message}
                  </p>
                )}
                {/* Generate and Copy both changed state silently. */}
                <p aria-live="polite" className="sr-only">
                  {copyStatus === "copied" ? "Password copied to clipboard" : ""}
                </p>
              </div>
              <button
                type="submit"
                disabled={loginSubmitting}
                className="btn btn-primary"
              >
                {loginSubmitting ? "Creating…" : "Create login"}
              </button>
            </form>
          </>
        )}
      </section>

      <section className="card p-6">
        <h2 className="text-base font-semibold text-gray-900">History</h2>
        {idKind === "supplier" ? (
          <p className="mt-1 max-w-prose text-sm text-gray-600">
            This supplier&apos;s collections and deductions feed directly into{" "}
            <Link href="/admin/payslips" className="underline">
              Pay Slips
            </Link>{" "}
            and the{" "}
            <Link href="/admin/deductions" className="underline">
              Deductions ledger
            </Link>
            . A combined day-by-day timeline for just this supplier isn&apos;t shown on this page yet.
          </p>
        ) : (
          <p className="mt-1 max-w-prose text-sm text-gray-600">
            This collector&apos;s own collection history is visible from their dashboard once they sign in — a
            view of it from this admin page isn&apos;t available yet.
          </p>
        )}
      </section>
    </div>
  );
}
