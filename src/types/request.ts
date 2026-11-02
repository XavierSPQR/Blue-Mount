export type RequestType = "fertilizer" | "teaPowder";
export type RequestStatus = "pending" | "approved" | "rejected" | "fulfilled";

export interface SupplierRequest {
  id: string;
  supplierId: string;
  type: RequestType;
  description: string;
  quantity: number;
  status: RequestStatus;
  decidedBy: string | null;
  fulfilledBy: string | null;
  /** Set once fulfilled — the deductions/{id} doc this request's cost was recorded as. */
  deductionId: string | null;
}
