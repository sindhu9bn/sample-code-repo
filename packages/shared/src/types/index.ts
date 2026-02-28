// packages/shared/src/types/index.ts
// Core domain types used across web and mobile

export interface User {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  createdAt: string;
}

export interface BankAccount {
  id: string;
  userId: string;
  accountNumber: string;    // Last 4 digits only after masking
  routingNumber: string;
  bankName: string;
  balance: number;          // WARNING: Should always be in CENTS
  isDefault: boolean;
}

export interface Transaction {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;           // Always in CENTS
  description: string;
  status: TransactionStatus;
  createdAt: string;
  updatedAt: string;
}

export type TransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface PaymentRequest {
  fromAccountId: string;
  toAccountId: string;
  amount: number;           // Caller must pass CENTS
  description: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;        // Unix timestamp in milliseconds
}

export interface ApiResponse<T> {
  data: T;
  error: string | null;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
