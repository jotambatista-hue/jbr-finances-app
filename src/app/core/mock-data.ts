import {
  Account,
  BillOccurrence,
  Budget,
  BudgetAdjustment,
  BudgetPeriod,
  Category,
  CsvImport,
  Transaction,
} from './models';

/**
 * Placeholder data until the API is wired to SQL Server.
 * Everything is pinned to this date so the demo reads the same on any day.
 */
export const AS_OF = '2026-10-19';

export const ACCOUNTS: Account[] = [
  { id: 'acc-chk', name: 'Everyday Checking', type: 'checking', institution: 'Chase', balance: 4820.35, currency: 'USD' },
  { id: 'acc-sav', name: 'High-Yield Savings', type: 'savings', institution: 'Ally', balance: 18250.0, currency: 'USD' },
  { id: 'acc-emg', name: 'Emergency Fund', type: 'savings', institution: 'Marcus', balance: 12000.0, currency: 'USD' },
  { id: 'acc-cc1', name: 'Sapphire Preferred', type: 'credit_card', institution: 'Chase', balance: -1342.18, currency: 'USD' },
  { id: 'acc-cc2', name: 'Blue Cash Everyday', type: 'credit_card', institution: 'American Express', balance: -486.9, currency: 'USD' },
  { id: 'acc-brk', name: 'Brokerage', type: 'investment', institution: 'Fidelity', balance: 42310.77, currency: 'USD' },
  { id: 'acc-ira', name: 'Roth IRA', type: 'investment', institution: 'Vanguard', balance: 28904.12, currency: 'USD' },
  { id: 'acc-csh', name: 'Wallet', type: 'cash', institution: null, balance: 180.0, currency: 'USD' },
];

export const CSV_IMPORTS: CsvImport[] = [
  { id: 'imp-1', accountId: 'acc-chk', filename: 'chase_checking_2026-10.csv', importedAt: '2026-10-17T09:12:00Z', rowCount: 42, status: 'completed' },
  { id: 'imp-2', accountId: 'acc-sav', filename: 'ally_savings_2026-10.csv', importedAt: '2026-10-15T18:40:00Z', rowCount: 3, status: 'completed' },
  { id: 'imp-3', accountId: 'acc-emg', filename: 'marcus_2026-08.csv', importedAt: '2026-08-30T11:05:00Z', rowCount: 2, status: 'completed' },
  { id: 'imp-4', accountId: 'acc-cc1', filename: 'sapphire_2026-10.csv', importedAt: '2026-10-18T07:55:00Z', rowCount: 61, status: 'completed' },
  { id: 'imp-5', accountId: 'acc-cc2', filename: 'amex_2026-09.csv', importedAt: '2026-10-02T20:31:00Z', rowCount: 27, status: 'completed' },
  { id: 'imp-6', accountId: 'acc-cc2', filename: 'amex_2026-10.csv', importedAt: '2026-10-18T21:14:00Z', rowCount: 0, status: 'failed' },
  { id: 'imp-7', accountId: 'acc-brk', filename: 'fidelity_positions_2026-10.csv', importedAt: '2026-10-11T13:20:00Z', rowCount: 18, status: 'completed' },
  { id: 'imp-8', accountId: 'acc-ira', filename: 'vanguard_2026-07.csv', importedAt: '2026-07-31T16:02:00Z', rowCount: 9, status: 'completed' },
];

export const CATEGORIES: Category[] = [
  { id: 'grp-ess', parentId: null, name: 'Essentials', type: 'expense' },
  { id: 'grp-life', parentId: null, name: 'Lifestyle', type: 'expense' },
  { id: 'cat-housing', parentId: 'grp-ess', name: 'Housing', type: 'expense' },
  { id: 'cat-groceries', parentId: 'grp-ess', name: 'Groceries', type: 'expense' },
  { id: 'cat-transport', parentId: 'grp-ess', name: 'Transportation', type: 'expense' },
  { id: 'cat-utilities', parentId: 'grp-ess', name: 'Utilities', type: 'expense' },
  { id: 'cat-internet', parentId: 'grp-ess', name: 'Internet & phone', type: 'expense' },
  { id: 'cat-health', parentId: 'grp-ess', name: 'Health', type: 'expense' },
  { id: 'cat-dining', parentId: 'grp-life', name: 'Dining out', type: 'expense' },
  { id: 'cat-fun', parentId: 'grp-life', name: 'Entertainment', type: 'expense' },
  { id: 'cat-shopping', parentId: 'grp-life', name: 'Shopping', type: 'expense' },
  { id: 'cat-subs', parentId: 'grp-life', name: 'Subscriptions', type: 'expense' },
  { id: 'cat-salary', parentId: null, name: 'Salary', type: 'income' },
  { id: 'cat-bonus', parentId: null, name: 'Bonus', type: 'income' },
];

export const BUDGET_PERIODS: BudgetPeriod[] = [
  { id: 'per-2026-10', label: 'October 2026', startDate: '2026-10-01', endDate: '2026-10-31', type: 'monthly' },
];

const budget = (
  categoryId: string,
  originalAmount: number,
  amount = originalAmount,
  revision = 0,
  notes: string | null = null,
): Budget => ({
  id: `bud-${categoryId.slice(4)}`,
  categoryId,
  periodId: 'per-2026-10',
  amount,
  originalAmount,
  revision,
  notes,
  updatedAt: '2026-10-01T08:00:00Z',
});

export const BUDGETS: Budget[] = [
  budget('cat-housing', 1850),
  budget('cat-groceries', 600, 650, 1),
  budget('cat-dining', 300, 250, 1),
  budget('cat-transport', 300),
  budget('cat-utilities', 220),
  budget('cat-internet', 140),
  budget('cat-health', 150),
  budget('cat-fun', 120),
  budget('cat-shopping', 250, 400, 1, 'Part of the October bonus'),
  budget('cat-subs', 65),
];

export const BUDGET_ADJUSTMENTS: BudgetAdjustment[] = [
  {
    id: 'adj-1', budgetId: 'bud-groceries', categoryId: 'cat-groceries', periodId: 'per-2026-10',
    oldAmount: 600, newAmount: 650, reason: 'reallocation', note: 'Moved $50 from Dining out', createdAt: '2026-10-08T19:00:00Z',
  },
  {
    id: 'adj-2', budgetId: 'bud-dining', categoryId: 'cat-dining', periodId: 'per-2026-10',
    oldAmount: 300, newAmount: 250, reason: 'reallocation', note: 'Moved $50 to Groceries', createdAt: '2026-10-08T19:00:00Z',
  },
  {
    id: 'adj-3', budgetId: 'bud-shopping', categoryId: 'cat-shopping', periodId: 'per-2026-10',
    oldAmount: 250, newAmount: 400, reason: 'bonus', note: 'Part of the October bonus', createdAt: '2026-10-16T12:30:00Z',
  },
];

let txSeq = 0;
const tx = (
  date: string,
  categoryId: string,
  amount: number,
  description: string,
  accountId = 'acc-cc1',
  type: Transaction['type'] = 'expense',
): Transaction => ({
  id: `tx-${++txSeq}`,
  accountId,
  csvImportId: null,
  date,
  amount,
  description,
  type,
  categoryId,
});

export const TRANSACTIONS: Transaction[] = [
  tx('2026-10-01', 'cat-housing', 1850.0, 'Rent - Maple Court Apts', 'acc-chk'),
  tx('2026-10-02', 'cat-groceries', 132.18, 'Whole Foods'),
  tx('2026-10-06', 'cat-groceries', 88.42, "Trader Joe's"),
  tx('2026-10-10', 'cat-groceries', 164.35, 'Costco', 'acc-cc2'),
  tx('2026-10-15', 'cat-groceries', 74.9, 'Whole Foods'),
  tx('2026-10-18', 'cat-groceries', 52.55, 'Farmers market', 'acc-csh'),
  tx('2026-10-03', 'cat-dining', 86.4, 'Sushi Ko'),
  tx('2026-10-09', 'cat-dining', 14.25, 'Blue Bottle Coffee'),
  tx('2026-10-11', 'cat-dining', 118.6, 'Osteria Nonna'),
  tx('2026-10-17', 'cat-dining', 49.5, 'Taqueria El Sol', 'acc-cc2'),
  tx('2026-10-04', 'cat-transport', 58.7, 'Shell'),
  tx('2026-10-12', 'cat-transport', 40.0, 'Metro card reload', 'acc-chk'),
  tx('2026-10-16', 'cat-transport', 42.5, 'Chevron'),
  tx('2026-10-08', 'cat-utilities', 38.1, 'City Water', 'acc-chk'),
  tx('2026-10-14', 'cat-utilities', 58.2, 'PG&E', 'acc-chk'),
  tx('2026-10-05', 'cat-internet', 79.99, 'Comcast Xfinity', 'acc-chk'),
  tx('2026-10-07', 'cat-internet', 60.0, 'Mint Mobile'),
  tx('2026-10-13', 'cat-health', 45.0, 'CVS Pharmacy', 'acc-cc2'),
  tx('2026-10-04', 'cat-fun', 32.0, 'AMC Theatres'),
  tx('2026-10-18', 'cat-fun', 99.5, 'Concert tickets'),
  tx('2026-10-06', 'cat-shopping', 64.3, 'Target', 'acc-cc2'),
  tx('2026-10-11', 'cat-shopping', 189.0, 'REI'),
  tx('2026-10-16', 'cat-shopping', 89.5, 'Amazon'),
  tx('2026-10-01', 'cat-subs', 22.99, 'Netflix'),
  tx('2026-10-02', 'cat-subs', 11.99, 'Spotify'),
  tx('2026-10-09', 'cat-subs', 2.99, 'iCloud+'),
  tx('2026-10-12', 'cat-subs', 21.0, 'New York Times'),
  tx('2026-10-15', 'cat-salary', 4850.0, 'Payroll - Acme Corp', 'acc-chk', 'income'),
  tx('2026-10-16', 'cat-bonus', 500.0, 'Q3 bonus - Acme Corp', 'acc-chk', 'income'),
];

export const BILL_OCCURRENCES: BillOccurrence[] = [
  { id: 'bo-1', recurringPaymentId: 'rp-rent', transactionId: 'tx-1', expectedAmount: 1850, expectedDate: '2026-10-01', status: 'paid', periodId: 'per-2026-10' },
  { id: 'bo-2', recurringPaymentId: 'rp-internet', transactionId: 'tx-16', expectedAmount: 79.99, expectedDate: '2026-10-05', status: 'paid', periodId: 'per-2026-10' },
  { id: 'bo-3', recurringPaymentId: 'rp-phone', transactionId: 'tx-17', expectedAmount: 60, expectedDate: '2026-10-07', status: 'paid', periodId: 'per-2026-10' },
  { id: 'bo-4', recurringPaymentId: 'rp-power', transactionId: 'tx-15', expectedAmount: 58.2, expectedDate: '2026-10-14', status: 'paid', periodId: 'per-2026-10' },
  { id: 'bo-5', recurringPaymentId: 'rp-gym', transactionId: null, expectedAmount: 45, expectedDate: '2026-10-20', status: 'pending', periodId: 'per-2026-10' },
  { id: 'bo-6', recurringPaymentId: 'rp-car-ins', transactionId: null, expectedAmount: 128.4, expectedDate: '2026-10-25', status: 'pending', periodId: 'per-2026-10' },
  { id: 'bo-7', recurringPaymentId: 'rp-gas', transactionId: null, expectedAmount: 42, expectedDate: '2026-10-28', status: 'pending', periodId: 'per-2026-10' },
];
