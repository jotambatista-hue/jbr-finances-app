import { Injectable, computed, signal } from '@angular/core';
import { Account, BillOccurrence, BudgetAdjustment, GoalContribution } from './models';
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
  RECURRING_PAYMENTS,
  TRANSACTIONS,
} from './mock-data';

/** A completed import older than this many days means the account needs a fresh CSV. */
export const IMPORT_STALE_DAYS = 30;
/** Share of the budget used at which a category starts showing "Nearing limit". */
export const NEARING_LIMIT_RATIO = 0.85;

/** How far saved may drift from the expected-by-today amount and still count as on track. */
export const GOAL_SCHEDULE_TOLERANCE = 0.1;

export type AccountStatus = 'synced' | 'due' | 'failed' | 'manual';
export type BudgetStatus = 'on_track' | 'nearing' | 'over';
export type GoalStatus = 'ahead' | 'on_track' | 'behind' | 'past_due' | 'reached';
export type BillStatus = BillOccurrence['status'];
export type Tone = 'good' | 'warn' | 'crit' | 'info' | 'neutral';

export const ACCOUNT_STATUS: Record<AccountStatus, { label: string; tone: Tone }> = {
  synced: { label: 'Up to date', tone: 'good' },
  due: { label: 'Import due', tone: 'warn' },
  failed: { label: 'Import failed', tone: 'crit' },
  manual: { label: 'Manual', tone: 'neutral' },
};

export const BUDGET_STATUS: Record<BudgetStatus, { label: string; tone: Tone }> = {
  on_track: { label: 'On track', tone: 'good' },
  nearing: { label: 'Nearing limit', tone: 'warn' },
  over: { label: 'Over budget', tone: 'crit' },
};

export const GOAL_STATUS: Record<GoalStatus, { label: string; tone: Tone }> = {
  ahead: { label: 'Ahead of schedule', tone: 'info' },
  on_track: { label: 'On track', tone: 'good' },
  behind: { label: 'Behind schedule', tone: 'warn' },
  past_due: { label: 'Past due', tone: 'crit' },
  reached: { label: 'Reached', tone: 'good' },
};

export const BILL_STATUS: Record<BillStatus, { label: string; tone: Tone }> = {
  paid: { label: 'Paid', tone: 'good' },
  pending: { label: 'Pending', tone: 'warn' },
  missed: { label: 'Missed', tone: 'crit' },
  deferred: { label: 'Deferred', tone: 'neutral' },
};

export const ACCOUNT_TYPE_LABEL: Record<Account['type'], string> = {
  checking: 'Checking',
  savings: 'Savings',
  credit_card: 'Credit card',
  investment: 'Investment',
  cash: 'Cash',
};

export interface AccountRow extends Account {
  typeLabel: string;
  lastImportAt: string | null;
  status: AccountStatus;
}

export interface BudgetRow {
  id: string;
  categoryName: string;
  groupId: string | null;
  amount: number;
  originalAmount: number;
  revision: number;
  actual: number;
  remaining: number;
  /** actual / amount (can exceed 1). */
  ratio: number;
  status: BudgetStatus;
  adjustments: BudgetAdjustment[];
}

export interface GoalRow {
  id: string;
  name: string;
  targetAmount: number;
  saved: number;
  startDate: string;
  targetDate: string;
  /** What should have been saved by today on a straight-line schedule. */
  expected: number;
  /** saved - expected: positive = ahead (surplus), negative = behind (gap). */
  variance: number;
  progress: number;
  expectedProgress: number;
  daysLeft: number;
  /** Per month from now to hit the target on time. */
  monthlyNeeded: number;
  status: GoalStatus;
  /** Account the goal is mostly funded from; diverted funds stay in it. */
  accountId: string;
}

export interface BillRow {
  id: string;
  name: string;
  categoryName: string;
  accountName: string;
  expectedAmount: number;
  expectedDate: string;
  status: BillStatus;
  paidOn: string | null;
  paidAmount: number | null;
}

/** Pending bills due within this many days count as "due this week". */
export const DUE_SOON_DAYS = 7;

/** Sidebar views (`?view=`); shared by the goals page and its sidebar menu. */
export function goalViews(asOf: string): Record<string, { title: string; match: (g: GoalRow) => boolean }> {
  const yearEnd = `${asOf.slice(0, 4)}-12-31`;
  return {
    'this-year': { title: 'Due this year', match: (g) => g.targetDate <= yearEnd },
    'long-term': { title: 'Long-term', match: (g) => g.targetDate > yearEnd },
    divertible: { title: 'Can divert funds', match: (g) => g.status === 'ahead' },
  };
}

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS);

const round2 = (n: number) => Math.round(n * 100) / 100;

export function goalStatus(saved: number, expected: number, target: number, pastDue: boolean): GoalStatus {
  if (saved >= target) return 'reached';
  if (pastDue) return 'past_due';
  if (saved >= expected * (1 + GOAL_SCHEDULE_TOLERANCE)) return 'ahead';
  if (saved >= expected * (1 - GOAL_SCHEDULE_TOLERANCE)) return 'on_track';
  return 'behind';
}

export function budgetStatus(ratio: number): BudgetStatus {
  if (ratio > 1) return 'over';
  if (ratio >= NEARING_LIMIT_RATIO) return 'nearing';
  return 'on_track';
}

@Injectable({ providedIn: 'root' })
export class FinanceDataService {
  readonly asOf = signal(AS_OF);

  readonly accounts = computed<AccountRow[]>(() =>
    ACCOUNTS.map((account) => {
      const imports = CSV_IMPORTS.filter((i) => i.accountId === account.id).sort((a, b) =>
        b.importedAt.localeCompare(a.importedAt),
      );
      const lastCompleted = imports.find((i) => i.status === 'completed');
      let status: AccountStatus;
      if (imports[0]?.status === 'failed') status = 'failed';
      else if (!imports.length && account.type === 'cash') status = 'manual';
      else if (!lastCompleted || daysBetween(lastCompleted.importedAt, this.asOf()) > IMPORT_STALE_DAYS)
        status = 'due';
      else status = 'synced';
      return {
        ...account,
        typeLabel: ACCOUNT_TYPE_LABEL[account.type],
        lastImportAt: lastCompleted?.importedAt ?? null,
        status,
      };
    }),
  );

  readonly currentPeriod = computed(
    () =>
      BUDGET_PERIODS.find((p) => p.startDate <= this.asOf() && this.asOf() <= p.endDate) ??
      BUDGET_PERIODS[0],
  );

  /** How far through the current period we are, 0..1. */
  readonly periodProgress = computed(() => {
    const p = this.currentPeriod();
    const total = daysBetween(p.startDate, p.endDate) + 1;
    return Math.min(1, (daysBetween(p.startDate, this.asOf()) + 1) / total);
  });

  readonly periodDay = computed(() => {
    const p = this.currentPeriod();
    return { day: daysBetween(p.startDate, this.asOf()) + 1, of: daysBetween(p.startDate, p.endDate) + 1 };
  });

  readonly pendingBills = computed(
    () =>
      BILL_OCCURRENCES.filter((b) => b.periodId === this.currentPeriod().id && b.status === 'pending')
        .length,
  );

  /** Budget vs. actual for the current period; actuals are always summed from transactions. */
  readonly budgets = computed<BudgetRow[]>(() => {
    const period = this.currentPeriod();
    const spentByCategory = new Map<string, number>();
    for (const t of TRANSACTIONS) {
      if (t.type !== 'expense' || t.date < period.startDate || t.date > period.endDate) continue;
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount);
    }
    return BUDGETS.filter((b) => b.periodId === period.id).map((b) => {
      const category = CATEGORIES.find((c) => c.id === b.categoryId);
      const actual = Math.round((spentByCategory.get(b.categoryId) ?? 0) * 100) / 100;
      const ratio = b.amount > 0 ? actual / b.amount : 0;
      return {
        id: b.id,
        categoryName: category?.name ?? 'Uncategorized',
        groupId: category?.parentId ?? null,
        amount: b.amount,
        originalAmount: b.originalAmount,
        revision: b.revision,
        actual,
        remaining: b.amount - actual,
        ratio,
        status: budgetStatus(ratio),
        adjustments: BUDGET_ADJUSTMENTS.filter((a) => a.budgetId === b.id),
      };
    });
  });

  readonly budgetGroups = computed(() =>
    CATEGORIES.filter((c) => c.type === 'expense' && c.parentId === null),
  );

  private readonly contributions = signal<GoalContribution[]>(GOAL_CONTRIBUTIONS);

  readonly goals = computed<GoalRow[]>(() => {
    const today = this.asOf();
    return GOALS.map((g) => {
      const own = this.contributions().filter((c) => c.goalId === g.id);
      const saved = round2(own.reduce((t, c) => t + c.amount, 0));
      const totalDays = Math.max(1, daysBetween(g.startDate, g.targetDate));
      const elapsed = Math.min(totalDays, Math.max(0, daysBetween(g.startDate, today)));
      const expected = round2((g.targetAmount * elapsed) / totalDays);
      const daysLeft = daysBetween(today, g.targetDate);
      const monthsLeft = Math.max(1, Math.ceil(daysLeft / 30.4));
      const remaining = Math.max(0, g.targetAmount - saved);
      const byAccount = new Map<string, number>();
      for (const c of own) byAccount.set(c.accountId, (byAccount.get(c.accountId) ?? 0) + c.amount);
      return {
        id: g.id,
        name: g.name,
        targetAmount: g.targetAmount,
        saved,
        startDate: g.startDate,
        targetDate: g.targetDate,
        expected,
        variance: round2(saved - expected),
        progress: saved / g.targetAmount,
        expectedProgress: expected / g.targetAmount,
        daysLeft,
        monthlyNeeded: daysLeft > 0 ? round2(remaining / monthsLeft) : remaining,
        status: goalStatus(saved, expected, g.targetAmount, daysLeft < 0),
        accountId: [...byAccount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ACCOUNTS[0].id,
      };
    });
  });

  /** Amount a goal can give away without falling off schedule. */
  surplus(goal: GoalRow) {
    return goal.status === 'ahead' ? Math.floor(goal.variance) : 0;
  }

  /**
   * Re-earmarks money from one goal to another: a negative contribution on the
   * source and a positive one on the target, both against the source's account.
   */
  divert(fromGoalId: string, toGoalId: string, amount: number) {
    const from = this.goals().find((g) => g.id === fromGoalId);
    if (!from || fromGoalId === toGoalId || amount <= 0 || amount > this.surplus(from)) return false;
    const date = this.asOf();
    const stamp = Date.now();
    this.contributions.update((list) => [
      ...list,
      { id: `gc-div-${stamp}-out`, goalId: fromGoalId, accountId: from.accountId, amount: -amount, date },
      { id: `gc-div-${stamp}-in`, goalId: toGoalId, accountId: from.accountId, amount, date },
    ]);
    return true;
  }

  readonly bills = computed<BillRow[]>(() =>
    BILL_OCCURRENCES.filter((b) => b.periodId === this.currentPeriod().id)
      .map((b) => {
        const payment = RECURRING_PAYMENTS.find((r) => r.id === b.recurringPaymentId);
        const paidWith = TRANSACTIONS.find((t) => t.id === b.transactionId);
        return {
          id: b.id,
          name: payment?.name ?? 'Unknown bill',
          categoryName: CATEGORIES.find((c) => c.id === payment?.categoryId)?.name ?? '',
          accountName: ACCOUNTS.find((a) => a.id === payment?.accountId)?.name ?? '',
          expectedAmount: b.expectedAmount,
          expectedDate: b.expectedDate,
          status: b.status,
          paidOn: paidWith?.date ?? null,
          paidAmount: paidWith?.amount ?? null,
        };
      })
      .sort((a, b) => a.expectedDate.localeCompare(b.expectedDate)),
  );

  /** Days from today to a date (negative = in the past). */
  daysUntil(date: string) {
    return daysBetween(this.asOf(), date);
  }
}
