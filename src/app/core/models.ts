/** Client-side shapes of the tables in database/001_initial_schema.sql (camelCased). */

export type AccountType = 'checking' | 'savings' | 'credit_card' | 'investment' | 'cash';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string | null;
  /** Liabilities (credit cards) are stored as negative balances. */
  balance: number;
  currency: string;
}

export interface CsvImport {
  id: string;
  accountId: string;
  filename: string;
  importedAt: string;
  rowCount: number;
  status: 'pending' | 'completed' | 'failed';
}

export interface Category {
  id: string;
  parentId: string | null;
  name: string;
  type: 'income' | 'expense';
}

export interface BudgetPeriod {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  type: 'monthly' | 'quarterly' | 'yearly';
}

export interface Budget {
  id: string;
  categoryId: string;
  periodId: string;
  /** Current (adjusted) target. */
  amount: number;
  /** Target as first planned. */
  originalAmount: number;
  revision: number;
  notes: string | null;
  updatedAt: string;
}

export type AdjustmentReason = 'bonus' | 'missed_bill' | 'reallocation' | 'manual' | 'csv_import';

export interface BudgetAdjustment {
  id: string;
  budgetId: string;
  categoryId: string;
  periodId: string;
  oldAmount: number;
  newAmount: number;
  reason: AdjustmentReason;
  note: string | null;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  csvImportId: string | null;
  date: string;
  /** Always positive; `type` gives the direction. */
  amount: number;
  description: string | null;
  type: 'income' | 'expense' | 'transfer';
  categoryId: string;
}

export interface BillOccurrence {
  id: string;
  recurringPaymentId: string;
  transactionId: string | null;
  expectedAmount: number;
  expectedDate: string;
  status: 'pending' | 'paid' | 'missed' | 'deferred';
  periodId: string;
}

export interface RecurringPayment {
  id: string;
  name: string;
  amount: number;
  frequency: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  nextDueDate: string;
  status: 'active' | 'paused' | 'cancelled';
  accountId: string;
  categoryId: string;
}

export interface Goal {
  id: string;
  categoryId: string | null;
  name: string;
  targetAmount: number;
  /** When saving started; with targetDate, defines the expected pace. */
  startDate: string;
  targetDate: string;
  periodId: string | null;
}

export interface GoalContribution {
  id: string;
  /** Negative when funds are diverted away from the goal. */
  amount: number;
  date: string;
  accountId: string;
  goalId: string;
}
