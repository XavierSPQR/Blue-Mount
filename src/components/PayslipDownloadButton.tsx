"use client";

/**
 * The old flow saved the PDF straight to disk on click — the first look
 * anyone got at their own pay slip was the file itself. This renders it to a
 * blob once and shows it in a preview dialog first; "Save PDF" inside that
 * dialog does the actual download.
 */
import { useEffect, useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { PayslipDocument } from "@/components/PayslipDocument";
import { useToast } from "@/components/ToastProvider";
import { formatPeriod } from "@/lib/format";
import type { Payslip } from "@/types/payslip";

export function PayslipDownloadButton({ payslip }: { payslip: Payslip }) {
  const [loading, setLoading] = useState(false);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { notify } = useToast();

  // Revoke the blob URL whenever it's replaced or this button unmounts —
  // otherwise every preview leaks memory for the rest of the session.
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  async function onPreview() {
    setLoading(true);
    try {
      const blob = await pdf(<PayslipDocument payslip={payslip} />).toBlob();
      setBlobUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(blob);
      });
      dialogRef.current?.showModal();
    } catch {
      notify("error", "Couldn't prepare the PDF. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function onClose() {
    dialogRef.current?.close();
  }

  function onSave() {
    if (!blobUrl) return;
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `payslip-${payslip.supplierId}-${payslip.periodStart}_to_${payslip.periodEnd}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <>
      <button
        type="button"
        onClick={onPreview}
        disabled={loading}
        className="btn btn-secondary btn-sm"
      >
        {loading ? "Preparing…" : "Preview"}
      </button>
      <dialog
        ref={dialogRef}
        onClose={onClose}
        onCancel={onClose}
        onClick={(e) => {
          if (e.target === dialogRef.current) onClose(); // backdrop click
        }}
        className="m-auto h-[85vh] w-[min(92vw,760px)] card shadow-overlay backdrop:bg-gray-900/40"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <h2 className="text-base font-semibold text-gray-900">
              Pay slip — {formatPeriod(payslip.periodStart, payslip.periodEnd)}
            </h2>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSave}
                className="btn btn-primary btn-sm"
              >
                Save PDF
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
          {blobUrl && (
            <iframe src={blobUrl} title={`Pay slip ${formatPeriod(payslip.periodStart, payslip.periodEnd)}`} className="w-full flex-1" />
          )}
        </div>
      </dialog>
    </>
  );
}
