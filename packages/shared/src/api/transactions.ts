// packages/shared/src/api/transactions.ts
// All transaction-related API calls.
// Used by both web and mobile via hooks.

import { apiRequest } from "./client";
import {
  Transaction,
  PaymentRequest,
  ApiResponse,
  PaginatedResponse,
} from "../types";

/**
 * Fetches paginated transaction history for an account.
 *
 * BUG 9 (MEDIUM): Off-by-one in pagination.
 * Page numbers are 0-indexed on the backend but callers pass 1-indexed pages.
 * The first page (page=1) actually fetches page=1 from backend,
 * which skips the first pageSize records (backend page 0).
 * Fix: pass page - 1 to the API.
 */
export async function fetchTransactions(
  accountId: string,
  page: number = 1,
  pageSize: number = 20
): Promise<ApiResponse<PaginatedResponse<Transaction>>> {
  // Should be: page=${page - 1} if backend is 0-indexed
  return apiRequest(
    `/accounts/${accountId}/transactions?page=${page}&pageSize=${pageSize}`
  );
}

/**
 * Submits a payment.
 *
 * BUG 10 (CRITICAL): No idempotency key.
 * CODEBASE.md says the API is NOT idempotent by default.
 * If the network times out after the server processes the payment
 * but before the client receives confirmation, and the user retries,
 * they will be charged TWICE.
 * Fix: generate a UUID client-side and send as X-Idempotency-Key header.
 */
export async function submitPayment(
  request: PaymentRequest
): Promise<ApiResponse<Transaction>> {
  // Missing: idempotency key header
  return apiRequest("/payments", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/**
 * Cancels a pending transaction.
 */
export async function cancelTransaction(
  transactionId: string
): Promise<ApiResponse<Transaction>> {
  return apiRequest(`/transactions/${transactionId}/cancel`, {
    method: "POST",
  });
}

/**
 * Fetches a single transaction by ID.
 *
 * BUG 11 (LOW): No input sanitisation on transactionId.
 * If transactionId comes from a URL param and contains special characters,
 * this could result in unexpected API paths.
 * Should validate that transactionId matches expected UUID format.
 */
export async function fetchTransaction(
  transactionId: string
): Promise<ApiResponse<Transaction>> {
  return apiRequest(`/transactions/${transactionId}`);
}
