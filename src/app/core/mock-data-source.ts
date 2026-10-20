import { Injectable, signal } from '@angular/core';
import { DataSource } from './data-source';
import { monthEnd, monthKeys } from './dates';
import { budgetHistory, investmentHistory, netWorthHistory } from './history-mock';
import {
  ACCOUNTS,
  AS_OF,
  BILL_OCCURRENCES,
  BUDGETS,
  BUDGET_ADJUSTMENTS,
  BUDGET_PERIODS,
  CATEGORIES,
  CSV_IMPORTS,
  GOALS,
  GOAL_CONTRIBUTIONS,
  INSURANCE_POLICIES,
  RECURRING_PAYMENTS,
  TRANSACTIONS,
} from './mock-data';
import { AccountBalanceSnapshot, BudgetActual, GoalContribution, NetWorthSnapshot } from './models';

const HISTORY_START = '2025-01';
const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (values: number[]) => values.reduce((t, v) => t + v, 0);

/** Investment balance history, shaped like account_balance_snapshots rows. */
function mockBalanceSnapshots(months: string[]): AccountBalanceSnapshot[] {
  return ACCOUNTS.filter((a) => a.type === 'investment').flatMap((a) =>
    investmentHistory(a.id, a.balance, months).map((m, i) => ({
      id: `abs-${a.id}-${m.month}`,
      accountId: a.id,
      asOfDate: i === months.length - 1 ? AS_OF : monthEnd(m.month),
      balance: m.balance,
      netContributions: m.contribution,
    })),
  );
}

/** Past month-end net worth, shaped like net_worth_snapshots rows. */
function mockNetWorthSnapshots(months: string[], balances: AccountBalanceSnapshot[]): NetWorthSnapshot[] {
  const balanceOf = (types: string[]) => sum(ACCOUNTS.filter((a) => types.includes(a.type)).map((a) => a.balance));
  const invested = months.map((m) =>
    sum(balances.filter((b) => b.asOfDate.startsWith(m)).map((b) => b.balance)),
  );
  const history = netWorthHistory(
    months,
    {
      cash: balanceOf(['checking', 'savings', 'cash']),
      insurance: sum(INSURANCE_POLICIES.map((p) => p.cashValue ?? 0)),
      property: balanceOf(['property']),
      cards: -balanceOf(['credit_card']),
      loans: -balanceOf(['loan']),
    },
    invested,
  );
  // The current month is always computed live, so snapshots stop at last month-end.
  return history.slice(0, -1).map((h) => ({
    id: `nw-${h.month}`,
    date: monthEnd(h.month),
    totalValue: round2(h.owned - h.owed),
    breakdown: JSON.stringify({ owned: h.owned, owed: h.owed }),
  }));
}

/** Budget vs. actual rows, shaped like GET /api/reports/budget-vs-actual. */
function mockBudgetActuals(months: string[]): BudgetActual[] {
  const current = BUDGET_PERIODS[0];
  const past = budgetHistory(
    months.filter((m) => m < current.startDate.slice(0, 7)),
    BUDGETS.map((b) => ({ categoryId: b.categoryId, amount: b.originalAmount })),
  ).map((r) => ({
    periodId: `per-${r.month}`,
    periodStart: `${r.month}-01`,
    categoryId: r.categoryId,
    budgeted: r.budgeted,
    actual: r.actual,
  }));
  const now = BUDGETS.filter((b) => b.periodId === current.id).map((b) => ({
    periodId: current.id,
    periodStart: current.startDate,
    categoryId: b.categoryId,
    budgeted: b.amount,
    actual: round2(
      sum(
        TRANSACTIONS.filter(
          (t) =>
            t.type === 'expense' &&
            t.categoryId === b.categoryId &&
            t.date >= current.startDate &&
            t.date <= current.endDate,
        ).map((t) => t.amount),
      ),
    ),
  }));
  return [...past, ...now];
}

/** The built-in sample data, pinned to AS_OF. Used by tests and for design work without a database. */
@Injectable()
export class MockDataSource extends DataSource {
  private readonly months = monthKeys(AS_OF, HISTORY_START);
  private readonly contributions = signal<GoalContribution[]>(GOAL_CONTRIBUTIONS);
  private readonly snapshots = mockBalanceSnapshots(this.months);

  readonly today = signal(AS_OF);
  readonly status = signal({ loading: false, errors: [] as string[] });

  readonly accounts = signal(ACCOUNTS);
  readonly csvImports = signal(CSV_IMPORTS);
  readonly categories = signal(CATEGORIES);
  readonly budgetPeriods = signal(BUDGET_PERIODS);
  readonly budgets = signal(BUDGETS);
  readonly budgetAdjustments = signal(BUDGET_ADJUSTMENTS);
  readonly budgetActuals = signal(mockBudgetActuals(this.months));
  readonly transactions = signal(TRANSACTIONS);
  readonly recurringPayments = signal(RECURRING_PAYMENTS);
  readonly billOccurrences = signal(BILL_OCCURRENCES);
  readonly goals = signal(GOALS);
  readonly goalContributions = this.contributions.asReadonly();
  readonly insurancePolicies = signal(INSURANCE_POLICIES);
  readonly balanceSnapshots = signal(this.snapshots);
  readonly netWorthSnapshots = signal(mockNetWorthSnapshots(this.months, this.snapshots));

  async addGoalContributions(rows: Omit<GoalContribution, 'id'>[]) {
    const stamp = Date.now();
    this.contributions.update((list) => [...list, ...rows.map((r, i) => ({ ...r, id: `gc-new-${stamp}-${i}` }))]);
  }
}
