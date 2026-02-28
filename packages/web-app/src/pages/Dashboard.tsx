// packages/web-app/src/pages/Dashboard.tsx
// Main dashboard page — shows account balance and recent transactions.

import React from "react";
import { useAuth } from "@finpay/shared/hooks/useAuth";
import { TransactionList } from "../components/TransactionList";
import { PaymentForm } from "../components/PaymentForm";
import { formatCurrency } from "@finpay/shared/utils/currency";

/**
 * BUG 36 (MEDIUM): Balance displayed without null check.
 * If accounts haven't loaded yet, defaultAccount is undefined,
 * and formatCurrency(undefined) returns "NaN" or throws.
 * Should show a loading skeleton instead.
 *
 * BUG 37 (LOW): Account number shown in full.
 * The BankAccount type has a note that accountNumber should be
 * last-4-digits only after masking, but here it renders
 * whatever the API returns — if masking fails on the backend,
 * full account numbers appear in the UI.
 */
export function Dashboard() {
  const { user } = useAuth();

  // Mock accounts — in real app would come from useAccounts hook
  const accounts = (user as any)?.accounts || [];
  const defaultAccount = accounts.find((a: any) => a.isDefault) || accounts[0];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Welcome, {user?.fullName}</h1>
      </header>

      <section className="balance-card">
        <h2>Account Balance</h2>
        {/* BUG 36: defaultAccount may be undefined */}
        <div className="balance-amount">
          {formatCurrency(defaultAccount?.balance)}
        </div>
        {/* BUG 37: accountNumber not verified to be masked */}
        <div className="account-number">
          Account: {defaultAccount?.accountNumber}
        </div>
      </section>

      {defaultAccount && (
        <>
          <section className="send-money">
            <PaymentForm
              fromAccountId={defaultAccount.id}
              toAccountId="" // BUG 38 (LOW): empty string toAccountId — no validation
            />
          </section>

          <section className="history">
            <TransactionList accountId={defaultAccount.id} />
          </section>
        </>
      )}
    </div>
  );
}
