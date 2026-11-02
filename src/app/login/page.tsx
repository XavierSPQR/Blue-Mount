"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { COMPANY_NAME } from "@/lib/companyInfo";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    trigger,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const [resetState, setResetState] = useState<"idle" | "sending" | "sent">("idle");
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await signInWithEmailAndPassword(auth, values.email, values.password);
      router.replace("/");
    } catch {
      setFormError("Incorrect email or password.");
    }
  }

  async function onForgotPassword() {
    // Validate just the email field (the password field may be empty/wrong at this point — that's fine here).
    const emailOk = await trigger("email");
    if (!emailOk) return;
    setResetState("sending");
    try {
      await sendPasswordResetEmail(auth, getValues("email"));
    } catch {
      // Deliberately swallowed: same message whether the account exists or
      // not, so this can't be used to enumerate registered emails.
    } finally {
      setResetState("sent");
    }
  }

  const errorParam = searchParams.get("error");
  const noProfile = errorParam === "no-profile";
  const inactive = errorParam === "inactive";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="card w-full max-w-sm p-8 shadow-raised">
        <div className="mb-6 flex items-center gap-3">
          <Image src="/logo.jpeg" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-md object-cover" />
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{COMPANY_NAME}</h1>
            <p className="text-sm text-gray-500">Sign in to your account</p>
          </div>
        </div>

        {noProfile && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Your account isn&apos;t linked to a profile yet. Contact an admin.
          </p>
        )}
        {inactive && (
          <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Your account has been deactivated. Contact an admin if this is unexpected.
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="field"
              {...register("email")}
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="flex gap-2">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="field"
                {...register("password")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                className="btn btn-secondary btn-sm shrink-0"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onForgotPassword}
              disabled={resetState === "sending"}
              className="text-xs text-gray-500 underline underline-offset-2 hover:text-gray-700 disabled:opacity-50"
            >
              {resetState === "sending" ? "Sending…" : "Forgot password?"}
            </button>
          </div>
          {resetState === "sent" && (
            <p role="status" className="text-xs text-gray-600">
              If an account exists for that email, a password reset link has been sent.
            </p>
          )}

          {formError && (
            <p role="alert" className="text-sm text-red-600">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn btn-primary w-full"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
