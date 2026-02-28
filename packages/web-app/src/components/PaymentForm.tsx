// packages/web-app/src/components/PaymentForm.tsx
// Payment form component — allows users to send money.
// Uses useTransactions hook for submitting.

import React, { useState, useCallback } from "react";
import { useTransactions } from "@finpay/shared/hooks/useTransactions";
import { formatCurrency } from "@finpay/shared/utils/currency";

interface PaymentFormProps {
  fromAccountId: string;
  toAccountId: string;
  onSuccess?: () => void;
}

/**
 * BUG 19 (MEDIUM): Amount displayed using floating point formatCurrency.
 * Preview shows "$10.50" but the actual amount sent may differ by fractions
 * due to the dollarsToCents bug in the hook.
 * User sees one amount, system charges another.
 *
 * BUG 20 (LOW): No loading state on submit button.
 * Double-clicking submit sends the payment twice.
 * Should disable button while isLoading is true.
 */
export function PaymentForm({ fromAccountId, toAccountId, onSuccess }: PaymentFormProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const { sendPayment } = useTransactions(fromAccountId);

  /**
   * BUG 21 (MEDIUM): No input sanitisation on description.
   * Description goes directly into the API request body.
   * A user can inject special characters, very long strings,
   * or script tags if this is ever rendered as HTML.
   * Should trim, strip HTML, and enforce max length.
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      // BUG 20: isSubmitting check exists but button not disabled in JSX below
      if (isSubmitting) return;
      setIsSubmitting(true);

      const success = await sendPayment(
        fromAccountId,
        toAccountId,
        amount,        // Raw user input, no sanitisation
        description    // BUG 21: unsanitised
      );

      setIsSubmitting(false);

      if (success) {
        setSuccessMessage(`Payment of ${formatCurrency(parseFloat(amount) * 100)} sent!`);
        // BUG 19: formatCurrency called with floating point multiplication
        setAmount("");
        setDescription("");
        onSuccess?.();
      } else {
        setSubmitError("Payment failed. Please try again.");
      }
    },
    [amount, description, fromAccountId, toAccountId, sendPayment, isSubmitting, onSuccess]
  );

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <h2>Send Payment</h2>

      {submitError && (
        <div className="error-banner" role="alert">
          {submitError}
        </div>
      )}

      {successMessage && (
        <div className="success-banner" role="status">
          {successMessage}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="amount">Amount ($)</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          min="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <input
          id="description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What's this for?"
          required
        />
      </div>

      {/* BUG 20: Button not disabled when isSubmitting = true */}
      <button type="submit" className="submit-btn">
        {isSubmitting ? "Sending..." : "Send Payment"}
      </button>
    </form>
  );
}
