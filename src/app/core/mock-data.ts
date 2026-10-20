import {
  Account,
  BillOccurrence,
  Budget,
  BudgetAdjustment,
  BudgetPeriod,
  Category,
  CsvImport,
  Goal,
  GoalContribution,
  InsurancePolicy,
  RecurringPayment,
  Transaction,
} from './models';

/**
 * Placeholder data until the API is wired to SQL Server.
 * Everything is pinned to this date so the demo reads the same on any day.
 */
export const AS_OF = '2026-10-19';

const account = (
  id: string,
  name: string,
  type: Account['type'],
  subtype: Account['subtype'],
  institution: string | null,
  balance: number,
): Account => ({ id, name, type, subtype, institution, balance, currency: 'USD' });

export const ACCOUNTS: Account[] = [
  account('acc-chk', 'Everyday Checking', 'checking', null, 'Chase', 4820.35),
  account('acc-sav', 'High-Yield Savings', 'savings', null, 'Ally', 18250.0),
  account('acc-emg', 'Emergency Fund', 'savings', null, 'Marcus', 12000.0),
  account('acc-cc1', 'Sapphire Preferred', 'credit_card', null, 'Chase', -1342.18),
  account('acc-cc2', 'Blue Cash Everyday', 'credit_card', null, 'American Express', -486.9),
  account('acc-brk', 'Individual Brokerage', 'investment', 'brokerage', 'Fidelity', 42310.77),
  account('acc-rh', 'Personal Portfolio', 'investment', 'brokerage', 'Robinhood', 3120.55),
  account('acc-ira', 'Roth IRA', 'investment', 'roth_ira', 'Vanguard', 28904.12),
  account('acc-rollover', 'Rollover IRA', 'investment', 'rollover_ira', 'Schwab', 15230.4),
  account('acc-401k', 'Acme Corp 401(k)', 'investment', '401k', 'Fidelity NetBenefits', 68450.32),
  account('acc-csh', 'Wallet', 'cash', null, null, 180.0),
  account('acc-auto', 'Auto Loan', 'loan', 'auto', 'Toyota Financial', -14820.66),
  account('acc-student', 'Student Loan', 'loan', 'student', 'Nelnet', -9340.12),
  account('acc-car', 'Toyota RAV4', 'property', 'vehicle', null, 24500.0),
];

export const CSV_IMPORTS: CsvImport[] = [
  { id: 'imp-1', accountId: 'acc-chk', filename: 'chase_checking_2026-10.csv', importedAt: '2026-10-17T09:12:00Z', rowCount: 42, status: 'completed' },
  { id: 'imp-2', accountId: 'acc-sav', filename: 'ally_savings_2026-10.csv', importedAt: '2026-10-15T18:40:00Z', rowCount: 3, status: 'completed' },
  { id: 'imp-3', accountId: 'acc-emg', filename: 'marcus_2026-08.csv', importedAt: '2026-08-30T11:05:00Z', rowCount: 2, status: 'completed' },
  { id: 'imp-4', accountId: 'acc-cc1', filename: 'sapphire_2026-10.csv', importedAt: '2026-10-18T07:55:00Z', rowCount: 61, status: 'completed' },
  { id: 'imp-5', accountId: 'acc-cc2', filename: 'amex_2026-09.csv', importedAt: '2026-10-02T20:31:00Z', rowCount: 27, status: 'completed' },
  { id: 'imp-6', accountId: 'acc-cc2', filename: 'amex_2026-10.csv', importedAt: '2026-10-18T21:14:00Z', rowCount: 0, status: 'failed' },
  { id: 'imp-7', accountId: 'acc-brk', filename: 'fidelity_positions_2026-10.csv', importedAt: '2026-10-11T13:20:00Z', rowCount: 18, status: 'completed' },
  { id: 'imp-9', accountId: 'acc-401k', filename: 'netbenefits_balances_2026-09.csv', importedAt: '2026-10-03T08:45:00Z', rowCount: 12, status: 'completed' },
  { id: 'imp-10', accountId: 'acc-rollover', filename: 'schwab_positions_2026-10.csv', importedAt: '2026-10-12T17:30:00Z', rowCount: 7, status: 'completed' },
  { id: 'imp-11', accountId: 'acc-auto', filename: 'toyota_statement_2026-10.csv', importedAt: '2026-10-10T10:00:00Z', rowCount: 1, status: 'completed' },
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
/** Which CSV import brought in each account's October transactions (others were entered by hand). */
const TX_IMPORT: Record<string, string> = { 'acc-chk': 'imp-1', 'acc-cc1': 'imp-4' };
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
  csvImportId: TX_IMPORT[accountId] ?? null,
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

const recurring = (
  id: string,
  name: string,
  amount: number,
  nextDueDate: string,
  categoryId: string,
  accountId = 'acc-chk',
): RecurringPayment => ({
  id,
  name,
  amount,
  frequency: 'monthly',
  nextDueDate,
  status: 'active',
  accountId,
  categoryId,
});

export const RECURRING_PAYMENTS: RecurringPayment[] = [
  recurring('rp-rent', 'Rent - Maple Court Apts', 1850, '2026-11-01', 'cat-housing'),
  recurring('rp-netflix', 'Netflix', 22.99, '2026-11-01', 'cat-subs', 'acc-cc1'),
  recurring('rp-spotify', 'Spotify', 11.99, '2026-11-02', 'cat-subs', 'acc-cc1'),
  recurring('rp-internet', 'Comcast Xfinity', 79.99, '2026-11-05', 'cat-internet'),
  recurring('rp-phone', 'Mint Mobile', 60, '2026-11-07', 'cat-internet', 'acc-cc1'),
  recurring('rp-water', 'City Water', 38.1, '2026-11-08', 'cat-utilities'),
  recurring('rp-power', 'PG&E', 58.2, '2026-11-14', 'cat-utilities'),
  recurring('rp-gym', 'Equinox membership', 45, '2026-10-20', 'cat-health', 'acc-cc2'),
  recurring('rp-car-ins', 'Geico auto insurance', 128.4, '2026-10-25', 'cat-transport'),
  recurring('rp-gas', 'SoCal Gas', 42, '2026-10-28', 'cat-utilities'),
];

const bill = (
  n: number,
  recurringPaymentId: string,
  expectedAmount: number,
  expectedDate: string,
  transactionId: string | null = null,
): BillOccurrence => ({
  id: `bo-${n}`,
  recurringPaymentId,
  transactionId,
  expectedAmount,
  expectedDate,
  status: transactionId ? 'paid' : 'pending',
  periodId: 'per-2026-10',
});

export const BILL_OCCURRENCES: BillOccurrence[] = [
  bill(1, 'rp-rent', 1850, '2026-10-01', 'tx-1'),
  bill(2, 'rp-netflix', 22.99, '2026-10-01', 'tx-24'),
  bill(3, 'rp-spotify', 11.99, '2026-10-02', 'tx-25'),
  bill(4, 'rp-internet', 79.99, '2026-10-05', 'tx-16'),
  bill(5, 'rp-phone', 60, '2026-10-07', 'tx-17'),
  bill(6, 'rp-water', 38.1, '2026-10-08', 'tx-14'),
  bill(7, 'rp-power', 58.2, '2026-10-14', 'tx-15'),
  bill(8, 'rp-gym', 45, '2026-10-20'),
  bill(9, 'rp-car-ins', 128.4, '2026-10-25'),
  bill(10, 'rp-gas', 42, '2026-10-28'),
];

const goal = (
  id: string,
  name: string,
  targetAmount: number,
  startDate: string,
  targetDate: string,
): Goal => ({ id, categoryId: null, name, targetAmount, startDate, targetDate, periodId: null });

export const GOALS: Goal[] = [
  goal('goal-emergency', 'Emergency fund top-up', 15000, '2026-01-01', '2026-12-31'),
  goal('goal-japan', 'Japan trip', 6000, '2026-03-01', '2027-04-01'),
  goal('goal-car', 'Car down payment', 10000, '2026-01-15', '2027-06-30'),
  goal('goal-laptop', 'New laptop', 2400, '2026-06-01', '2026-11-30'),
  goal('goal-gifts', 'Holiday gifts', 1200, '2026-08-01', '2026-12-15'),
  goal('goal-office', 'Home office setup', 3000, '2026-04-01', '2026-09-30'),
  goal('goal-roth', 'Max out Roth IRA', 7000, '2026-01-01', '2026-12-31'),
];

let contributionSeq = 0;
const contributions = (
  goalId: string,
  accountId: string,
  entries: [date: string, amount: number][],
): GoalContribution[] =>
  entries.map(([date, amount]) => ({ id: `gc-${++contributionSeq}`, amount, date, accountId, goalId }));

export const GOAL_CONTRIBUTIONS: GoalContribution[] = [
  ...contributions('goal-emergency', 'acc-emg', [
    ['2026-01-31', 3000], ['2026-03-31', 3000], ['2026-06-30', 3000], ['2026-09-30', 3000],
  ]),
  ...contributions('goal-japan', 'acc-sav', [
    ['2026-03-31', 1000], ['2026-05-31', 1200], ['2026-07-31', 1000], ['2026-09-30', 1000],
  ]),
  ...contributions('goal-car', 'acc-sav', [['2026-02-15', 1000], ['2026-05-15', 1100], ['2026-08-15', 1000]]),
  ...contributions('goal-laptop', 'acc-chk', [['2026-06-30', 800], ['2026-07-31', 800], ['2026-08-31', 800]]),
  ...contributions('goal-gifts', 'acc-chk', [['2026-08-31', 260], ['2026-09-30', 260]]),
  ...contributions('goal-office', 'acc-sav', [['2026-04-30', 1000], ['2026-06-30', 1000], ['2026-08-31', 650]]),
  ...contributions('goal-roth', 'acc-ira', [
    ['2026-01-31', 1500], ['2026-04-30', 1500], ['2026-07-31', 1500], ['2026-09-30', 1400],
  ]),
];

export const INSURANCE_POLICIES: InsurancePolicy[] = [
  {
    id: 'pol-whole', name: 'Whole Life', provider: 'Northwestern Mutual', type: 'life', lifeKind: 'whole',
    premium: 312.5, frequency: 'monthly', effectiveDate: '2014-06-01', expirationDate: null,
    cashValue: 18420.55, cashValueAsOf: '2026-09-30', deathBenefit: 250000, recurringPaymentId: null,
  },
  {
    id: 'pol-iul', name: 'Indexed Universal Life', provider: 'Pacific Life', type: 'life', lifeKind: 'indexed_universal',
    premium: 200, frequency: 'monthly', effectiveDate: '2021-03-15', expirationDate: null,
    cashValue: 6980.1, cashValueAsOf: '2026-09-30', deathBenefit: 500000, recurringPaymentId: null,
  },
  {
    id: 'pol-term', name: '20-Year Term', provider: 'State Farm', type: 'life', lifeKind: 'term',
    premium: 38, frequency: 'monthly', effectiveDate: '2019-01-01', expirationDate: '2039-01-01',
    cashValue: null, cashValueAsOf: null, deathBenefit: 1000000, recurringPaymentId: null,
  },
  {
    id: 'pol-auto', name: 'Auto Policy', provider: 'Geico', type: 'auto', lifeKind: null,
    premium: 128.4, frequency: 'monthly', effectiveDate: '2026-01-25', expirationDate: '2027-01-25',
    cashValue: null, cashValueAsOf: null, deathBenefit: null, recurringPaymentId: 'rp-car-ins',
  },
];
