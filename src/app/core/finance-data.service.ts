import { Injectable, computed, signal } from '@angular/core';
import { Account, BudgetAdjustment } from './models';
import {
  ACCOUNTS,
  AS_OF,
  BILL_OCCURRENCES,
  BUDGETS,
  BUDGET_ADJUSTMENTS,
  BUDGET_PERIODS,
  CATEGORIES,
  CSV_IMPORTS,
  TRANSACTIONS,
} from './mock-data';

/** A completed import older than this many days means the account needs a fresh CSV. */
export const IMPORT_STALE_DAYS = 30;
/** Share of the budget used at which a category starts showing "Nearing limit". */
export const NEARING_LIMIT_RATIO = 0.85;

export type AccountStatus = 'synced' | 'due' | 'failed' | 'manual';
export type BudgetStatus = 'on_track' | 'nearing' | 'over';
export type Tone = 'good' | 'warn' | 'crit' | 'neutral';

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

const DAY_MS = 86_400_000;
const daysBetween = (from: string, to: string) =>
  Math.floor((Date.parse(to) - Date.parse(from)) / DAY_MS);

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
}
