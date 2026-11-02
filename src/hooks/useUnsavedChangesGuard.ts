"use client";

/**
 * Warns before a form's typed input gets thrown away. Next's App Router
 * (checked against this project's bundled docs — no useBlocker or router-level
 * navigation guard exists here) has no built-in way to intercept a route
 * change, so in-app <Link> clicks are caught by listening for clicks at the
 * document level and routing manually only once the user confirms; leaving
 * the tab entirely (close/refresh/type a URL) goes through the standard
 * `beforeunload` prompt instead, which is the one piece browsers keep native.
 */
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/ConfirmProvider";

export function useUnsavedChangesGuard(isDirty: boolean) {
  const router = useRouter();
  const confirm = useConfirm();
  const isDirtyRef = useRef(isDirty);
  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }

    function onClick(e: MouseEvent) {
      if (!isDirtyRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const anchor = (e.target as HTMLElement)?.closest?.("a[href]");
      if (!anchor || !(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return; // same-page anchor/hash

      e.preventDefault();
      void (async () => {
        const ok = await confirm({
          title: "Leave without saving?",
          message: "You have unsaved changes on this page. They'll be lost if you leave now.",
          confirmLabel: "Leave",
          cancelLabel: "Stay",
          tone: "danger",
        });
        if (ok) {
          isDirtyRef.current = false; // don't re-trigger the guard for the navigation we just approved
          router.push(url.pathname + url.search + url.hash);
        }
      })();
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [router, confirm]);
}
