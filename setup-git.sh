#!/bin/bash
# Run this once after unzipping to initialize git history
echo "Setting up git repository..."

git init
git config user.email "dev@finpay.com"
git config user.name "FinPay Dev"

git add CODEBASE.md package.json packages/shared/src/types/index.ts
git commit -m "feat: initial project structure and types"

git add packages/shared/src/utils/currency.ts
git commit -m "feat: add currency utility functions"

git add packages/shared/src/api/client.ts packages/shared/src/api/transactions.ts
git commit -m "feat: add API client and transaction endpoints"

git add packages/shared/src/hooks/useAuth.ts packages/shared/src/hooks/useTransactions.ts
git commit -m "feat: add useAuth and useTransactions hooks"

git add packages/web-app/src/components/PaymentForm.tsx \
        packages/web-app/src/components/TransactionList.tsx \
        packages/web-app/src/pages/Dashboard.tsx \
        packages/mobile-app/src/screens/PaymentScreen.tsx \
        packages/mobile-app/src/screens/TransactionScreen.tsx
git commit -m "feat: add payment form, transaction list, and mobile screens"

echo ""
echo "✓ Git setup complete. Commit history:"
git log --oneline
echo ""
echo "✓ Files in last commit (what the agent will review):"
git diff HEAD~1 --name-only
