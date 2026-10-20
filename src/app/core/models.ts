/** Client-side shapes of the tables in database/001_initial_schema.sql (camelCased). */

export type AccountType =
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'investment'
  | 'cash'
  | 'loan'
  | 'property';

/** Finer-grained kind within a type, e.g. Roth IRA vs. brokerage, auto vs. student loan. */
export type AccountSubtype =
  | 'brokerage'
  | 'traditional_ira'
  | 'roth_ira'
  | 'rollover_ira'
  | '401k'
  | 'roth_401k'
  | '403b'
  | 'auto'
  | 'student'
  | 'mortgage'
  | 'personal'
  | 'home'
  | 'vehicle';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  subtype: AccountSubtype | null;
  institution: string | null;
  /** Liabilities (credit cards, loans) are stored as negative balances. */
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

export type LifeKind = 'term' | 'whole' | 'universal' | 'indexed_universal' | 'variable_universal';

export interface InsurancePolicy {
  id: string;
  name: string;
  provider: string;
  type: 'auto' | 'home' | 'life' | 'health';
  /** Only for life policies; anything but term is permanent and builds cash value. */
  lifeKind: LifeKind | null;
  premium: number;
  frequency: string;
  effectiveDate: string;
  expirationDate: string | null;
  cashValue: number | null;
  cashValueAsOf: string | null;
  deathBenefit: number | null;
  recurringPaymentId: string | null;
}

export interface NetWorthSnapshot {
  id: string;
  date: string;
  totalValue: number;
  /** JSON, expected shape {"owned": number, "owed": number}. */
  breakdown: string | null;
}

export interface AccountBalanceSnapshot {
  id: string;
  accountId: string;
  asOfDate: string;
  balance: number;
  /** Money added minus withdrawn since the previous snapshot; null when unknown. */
  netContributions: number | null;
}

/** One row of GET /api/reports/budget-vs-actual. */
export interface BudgetActual {
  periodId: string;
  periodStart: string;
  categoryId: string;
  budgeted: number;
  actual: number;
}
