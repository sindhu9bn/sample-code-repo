# FinPay Codebase Context

## What This System Does
FinPay is a fintech payment platform. Users can send money, view transaction
history, manage bank accounts, and set up recurring payments. Available on
web (React) and mobile (React Native), sharing a common business logic layer.

## Monorepo Structure
```
packages/
  shared/          Core business logic, types, API client, hooks
                   Used by BOTH web and mobile. Changes here affect everything.

  web-app/         React web application
                   Entry: packages/web-app/src/index.tsx

  mobile-app/      React Native application
                   Entry: packages/mobile-app/src/App.tsx
```

## Critical Rules — Things That Must Never Break
- ALL monetary values are stored and computed in CENTS (integer)
  Never use floating point for money. $10.50 = 1050 cents.
- Authentication tokens expire after 15 minutes. Refresh logic must be bulletproof.
- Transaction IDs must be unique. The API is NOT idempotent by default.
- User PII (name, email, account numbers) must never appear in logs or error messages.
- The shared/ package is the single source of truth for business logic.
  Web and mobile must never duplicate logic — they import from shared/.

## Architecture Layers
```
mobile-app/screens  ─┐
web-app/pages        ─┼──► shared/hooks ──► shared/api ──► Backend API
web-app/components   ─┘         │
                                 └──► shared/utils
                                 └──► shared/types
```

## Known Fragile Areas
- AuthContext in shared/hooks/useAuth.ts — token refresh has race condition history
- PaymentForm — floating point bugs have appeared here before
- Transaction list pagination — off-by-one errors have occurred

## Patterns We Follow
- All API errors are caught at the hook level, never in components
- Components are presentational — no direct API calls
- All amounts displayed to users go through formatCurrency() in shared/utils
- React Query for all server state — no manual loading/error state in components
