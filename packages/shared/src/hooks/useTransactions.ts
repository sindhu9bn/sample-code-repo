// packages/shared/src/hooks/useTransactions.ts
// Hook for fetching and managing transaction data.
// Used by both TransactionList (web) and TransactionScreen (mobile).

import { useState, useEffect, useCallback } from "react";
import { Transaction, PaginatedResponse } from "../types";
import { fetchTransactions, submitPayment } from "../api/transactions";
import { dollarsToCents, isValidAmount } from "../utils/currency";

interface UseTransactionsReturn {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  sendPayment: (
    fromAccountId: string,
    toAccountId: string,
    dollarAmount: string,
    description: string
  ) => Promise<boolean>;
  refresh: () => void;
}

/**
 * BUG 15 (MEDIUM): Duplicate transactions on StrictMode / fast refresh.
 * In React StrictMode (development), effects run twice.
 * The initial fetch fires twice, and if the user calls loadMore quickly,
 * the same page can be fetched and appended twice.
 * Fix: track in-flight requests and deduplicate.
 */
export function useTransactions(accountId: string): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (pageNum: number, replace = false) => {
      if (isLoading) return; // guard against concurrent calls
      setIsLoading(true);
      setError(null);

      const response = await fetchTransactions(accountId, pageNum);

      setIsLoading(false);

      if (!response.success || !response.data) {
        setError(response.error || "Failed to load transactions");
        return;
      }

      const paged = response.data;

      setHasMore(paged.hasMore);

      if (replace) {
        setTransactions(paged.items);
      } else {
        // BUG 15: appending without deduplication
        // If fetchPage(1) is called twice, first page is duplicated
        setTransactions((prev) => [...prev, ...paged.items]);
      }
    },
    [accountId, isLoading]
  );

  useEffect(() => {
    setTransactions([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
  }, [accountId]); // fetchPage intentionally omitted — would cause infinite loop
  // BUG 16 (LOW): fetchPage omitted from deps — stale closure risk
  // Correct fix: use useCallback correctly so fetchPage is stable

  const loadMore = useCallback(() => {
    if (!hasMore || isLoading) return;
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPage(nextPage);
  }, [hasMore, isLoading, page, fetchPage]);

  /**
   * BUG 17 (CRITICAL): Dollar amount converted to cents using buggy utility.
   * dollarsToCents() has a floating point bug (see currency.ts BUG 2).
   * This hook calls it without rounding, so payment amounts can be off by 1 cent.
   *
   * BUG 18 (MEDIUM): No optimistic update.
   * After a successful payment, the transaction list is not refreshed.
   * The user sees the same list until they manually refresh.
   * Should call refresh() after successful payment.
   */
  const sendPayment = useCallback(
    async (
      fromAccountId: string,
      toAccountId: string,
      dollarAmount: string,
      description: string
    ): Promise<boolean> => {
      const cents = dollarsToCents(dollarAmount); // BUG 17: floating point

      if (!isValidAmount(cents)) {
        setError("Invalid amount");
        return false;
      }

      const response = await submitPayment({
        fromAccountId,
        toAccountId,
        amount: cents,
        description,
      });

      if (!response.success) {
        setError(response.error || "Payment failed");
        return false;
      }

      // BUG 18: Missing refresh() call here
      // New transaction won't appear until page reload
      return true;
    },
    [accountId] // accountId not actually used here — wrong dep
  );

  const refresh = useCallback(() => {
    setTransactions([]);
    setPage(1);
    setHasMore(true);
    fetchPage(1, true);
  }, [fetchPage]);

  return {
    transactions,
    isLoading,
    error,
    hasMore,
    loadMore,
    sendPayment,
    refresh,
  };
}
