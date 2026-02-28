// packages/web-app/src/components/TransactionList.tsx
// Displays paginated transaction history for an account.

import React, { useEffect, useRef, useCallback } from "react";
import { useTransactions } from "@finpay/shared/hooks/useTransactions";
import { formatCurrency } from "@finpay/shared/utils/currency";
import { Transaction } from "@finpay/shared/types";

interface TransactionListProps {
  accountId: string;
}

/**
 * BUG 22 (MEDIUM): Infinite scroll fires multiple times.
 * IntersectionObserver callback calls loadMore() every time
 * the sentinel enters the viewport — which includes while a request
 * is already in-flight. The isLoading guard in the hook helps but
 * the observer should be disconnected while loading.
 *
 * BUG 23 (LOW): Transaction amount displayed without checking for
 * negative values. Refunds/chargebacks have negative amounts in cents,
 * but formatCurrency(-1050) will show "-$10.50" without any
 * visual distinction from a normal debit. Should style differently.
 */
export function TransactionList({ accountId }: TransactionListProps) {
  const { transactions, isLoading, error, hasMore, loadMore } =
    useTransactions(accountId);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Infinite scroll: when sentinel enters viewport, load more
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          loadMore(); // BUG 22: called even if already loading
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]); // loadMore changes every render — reconnects observer constantly
  // BUG 24 (LOW): loadMore is recreated each render due to deps, causing
  // the observer to disconnect and reconnect on every transaction load.
  // Should use useRef for loadMore or stabilise with useCallback.

  if (error) {
    return (
      <div className="error-state">
        <p>Failed to load transactions: {error}</p>
        {/* BUG 25 (LOW): Error message may contain sensitive server info
            from BUG 7 in client.ts — rendering it directly to DOM */}
      </div>
    );
  }

  return (
    <div className="transaction-list">
      <h2>Transaction History</h2>

      {transactions.length === 0 && !isLoading && (
        <p className="empty-state">No transactions yet.</p>
      )}

      <ul>
        {transactions.map((tx: Transaction) => (
          <li key={tx.id} className={`transaction-item status-${tx.status}`}>
            <div className="tx-description">{tx.description}</div>
            {/* BUG 23: No visual distinction for negative amounts (refunds) */}
            <div className="tx-amount">{formatCurrency(tx.amount)}</div>
            <div className="tx-status">{tx.status}</div>
            <div className="tx-date">
              {new Date(tx.createdAt).toLocaleDateString()}
            </div>
          </li>
        ))}
      </ul>

      {isLoading && (
        <div className="loading-spinner" aria-label="Loading transactions..." />
      )}

      {/* Sentinel element — when visible, triggers loadMore */}
      <div ref={sentinelRef} style={{ height: 1 }} />

      {!hasMore && transactions.length > 0 && (
        <p className="end-of-list">All transactions loaded.</p>
      )}
    </div>
  );
}
