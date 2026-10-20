import { Injectable, computed, inject } from '@angular/core';
import { DataSource } from './data-source';
import { daysBetween, monthEnd, monthKeys } from './dates';
import {
  Account,
  AccountSubtype,
  BillOccurrence,
  BudgetAdjustment,
  BudgetPeriod,
  LifeKind,
  Transaction,
} from './models';

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
  loan: 'Loan',
  property: 'Property',
};

export const ACCOUNT_SUBTYPE_LABEL: Record<AccountSubtype, string> = {
  brokerage: 'Brokerage',
  traditional_ira: 'Traditional IRA',
  roth_ira: 'Roth IRA',
  rollover_ira: 'Rollover IRA',
  '401k': '401(k)',
  roth_401k: 'Roth 401(k)',
  '403b': '403(b)',
  auto: 'Auto loan',
  student: 'Student loan',
  mortgage: 'Mortgage',
  personal: 'Personal loan',
  home: 'Home',
  vehicle: 'Vehicle',
};

/** Tax-advantaged retirement accounts; every other investment subtype counts as personal. */
export const RETIREMENT_SUBTYPES: AccountSubtype[] = [
  'traditional_ira',
  'roth_ira',
  'rollover_ira',
  '401k',
  'roth_401k',
  '403b',
];

export const LIFE_KIND_LABEL: Record<LifeKind, string> = {
  term: 'Term life',
  whole: 'Whole life',
  universal: 'Universal life',
  indexed_universal: 'Indexed universal life',
  variable_universal: 'Variable universal life',
};

/** Types whose value is entered by hand rather than imported. */
const MANUAL_TYPES: Account['type'][] = ['cash', 'property'];

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

export interface InvestmentRow extends AccountRow {
  group: 'retirement' | 'personal';
}

export interface PolicyRow {
  id: string;
  name: string;
  provider: string;
  kindLabel: string;
  cashValue: number;
  cashValueAsOf: string | null;
  deathBenefit: number | null;
  premium: number;
  frequency: string;
}

export interface SheetLine {
  id: string;
  name: string;
  detail: string;
  /** Always positive; the section says whether it's owned or owed. */
  amount: number;
}

export interface SheetGroup {
  key: string;
  label: string;
  lines: SheetLine[];
  total: number;
}

export interface TransactionRow extends Transaction {
  accountName: string;
  categoryName: string;
  signedAmount: number;
  /** CSV file it came from; null when entered by hand. */
  source: string | null;
}

export interface InvestmentMonth {
  month: string;
  /** Month-end balance; null when there's no snapshot yet. */
  balance: number | null;
  /** Money added during the month. */
  contribution: number;
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
  private readonly src = inject(DataSource);

  /** Loading flag and request errors from the data source (e.g. API unreachable). */
  readonly status = this.src.status;
  readonly asOf = this.src.today;

  readonly accounts = computed<AccountRow[]>(() =>
    this.src.accounts().map((account) => {
      const imports = this.src
        .csvImports()
        .filter((i) => i.accountId === account.id)
        .sort((a, b) => b.importedAt.localeCompare(a.importedAt));
      const lastCompleted = imports.find((i) => i.status === 'completed');
      let status: AccountStatus;
      if (imports[0]?.status === 'failed') status = 'failed';
      else if (!imports.length && MANUAL_TYPES.includes(account.type)) status = 'manual';
      else if (!lastCompleted || daysBetween(lastCompleted.importedAt, this.asOf()) > IMPORT_STALE_DAYS)
        status = 'due';
      else status = 'synced';
      return {
        ...account,
        typeLabel: account.subtype
          ? ACCOUNT_SUBTYPE_LABEL[account.subtype]
          : ACCOUNT_TYPE_LABEL[account.type],
        lastImportAt: lastCompleted?.importedAt ?? null,
        status,
      };
    }),
  );

  /**
   * The monthly period containing today. When none has been created yet, a
   * stand-in for the calendar month keeps the pages working (it has no id, so
   * nothing is attached to it).
   */
  readonly currentPeriod = computed<BudgetPeriod>(() => {
    const today = this.asOf();
    const found = this.src
      .budgetPeriods()
      .find((p) => p.type === 'monthly' && p.startDate <= today && today <= p.endDate);
    if (found) return found;
    const month = today.slice(0, 7);
    return {
      id: '',
      label: new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
        new Date(`${month}-01T00:00:00Z`),
      ),
      startDate: `${month}-01`,
      endDate: monthEnd(month),
      type: 'monthly',
    };
  });

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
      this.src
        .billOccurrences()
        .filter((b) => b.periodId === this.currentPeriod().id && b.status === 'pending').length,
  );

  categoryName(id: string) {
    return this.src.categories().find((c) => c.id === id)?.name ?? 'Uncategorized';
  }

  /** Budget vs. actual for the current period; actuals come from the budget-vs-actual report. */
  readonly budgets = computed<BudgetRow[]>(() => {
    const period = this.currentPeriod();
    const actuals = this.src.budgetActuals().filter((a) => a.periodId === period.id);
    return this.src
      .budgets()
      .filter((b) => b.periodId === period.id)
      .map((b) => {
        const category = this.src.categories().find((c) => c.id === b.categoryId);
        const actual = round2(actuals.find((a) => a.categoryId === b.categoryId)?.actual ?? 0);
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
          adjustments: this.src.budgetAdjustments().filter((a) => a.budgetId === b.id),
        };
      });
  });

  readonly budgetGroups = computed(() =>
    this.src.categories().filter((c) => c.type === 'expense' && c.parentId === null),
  );

  /**
   * Expense categories that can still get a budget this period, under their
   * group. Groups themselves aren't budgeted; a top-level category with no
   * children is, and is listed under "Other".
   */
  readonly unbudgetedCategories = computed(() => {
    const categories = this.src.categories().filter((c) => c.type === 'expense');
    const taken = new Set(
      this.src
        .budgets()
        .filter((b) => b.periodId === this.currentPeriod().id)
        .map((b) => b.categoryId),
    );
    const isGroup = (id: string) => categories.some((c) => c.parentId === id);
    const open = categories.filter((c) => !isGroup(c.id) && !taken.has(c.id));
    const groups = this.budgetGroups()
      .filter((g) => isGroup(g.id))
      .map((g) => ({ name: g.name, categories: open.filter((c) => c.parentId === g.id) }));
    groups.push({ name: 'Other', categories: open.filter((c) => c.parentId === null) });
    return groups.filter((g) => g.categories.length);
  });

  /**
   * Adds a budget for a category in the current period, creating the period
   * first if it doesn't exist yet. Resolves false when the request isn't
   * allowed; rejects if saving fails.
   */
  async addBudget(categoryId: string, amount: number, notes: string | null): Promise<boolean> {
    const allowed = this.unbudgetedCategories().some((g) => g.categories.some((c) => c.id === categoryId));
    if (!allowed || !(amount > 0)) return false;
    let periodId = this.currentPeriod().id;
    if (!periodId) {
      const { id, ...period } = this.currentPeriod();
      periodId = (await this.src.addBudgetPeriod(period)).id;
    }
    await this.src.addBudget({
      categoryId,
      periodId,
      amount: round2(amount),
      originalAmount: round2(amount),
      revision: 0,
      notes: notes?.trim() || null,
    });
    return true;
  }

  readonly goalContributions = this.src.goalContributions;

  readonly goals = computed<GoalRow[]>(() => {
    const today = this.asOf();
    return this.src.goals().map((g) => {
      const own = this.src.goalContributions().filter((c) => c.goalId === g.id);
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
        progress: g.targetAmount > 0 ? saved / g.targetAmount : 0,
        expectedProgress: g.targetAmount > 0 ? expected / g.targetAmount : 0,
        daysLeft,
        monthlyNeeded: daysLeft > 0 ? round2(remaining / monthsLeft) : remaining,
        status: goalStatus(saved, expected, g.targetAmount, daysLeft < 0),
        accountId: [...byAccount].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
      };
    });
  });

  /**
   * Adds a savings goal. Resolves false when the request isn't allowed
   * (blank name, no target, due date not after the start); rejects if saving fails.
   */
  async addGoal(goal: { name: string; targetAmount: number; startDate: string; targetDate: string }) {
    const name = goal.name.trim();
    if (!name || !(goal.targetAmount > 0) || !goal.startDate || !(goal.targetDate > goal.startDate)) return false;
    await this.src.addGoal({
      name,
      targetAmount: round2(goal.targetAmount),
      startDate: goal.startDate,
      targetDate: goal.targetDate,
      categoryId: null,
      periodId: null,
    });
    return true;
  }

  /** Amount a goal can give away without falling off schedule. */
  surplus(goal: GoalRow) {
    return goal.status === 'ahead' ? Math.floor(goal.variance) : 0;
  }

  /**
   * Re-earmarks money from one goal to another: a negative contribution on the
   * source and a positive one on the target, both against the source's account.
   * Resolves false when the request isn't allowed; rejects if saving fails.
   */
  async divert(fromGoalId: string, toGoalId: string, amount: number): Promise<boolean> {
    const from = this.goals().find((g) => g.id === fromGoalId);
    if (!from || !from.accountId || fromGoalId === toGoalId || amount <= 0 || amount > this.surplus(from)) {
      return false;
    }
    const date = this.asOf();
    await this.src.addGoalContributions([
      { goalId: fromGoalId, accountId: from.accountId, amount: -amount, date },
      { goalId: toGoalId, accountId: from.accountId, amount, date },
    ]);
    return true;
  }

  readonly bills = computed<BillRow[]>(() =>
    this.src
      .billOccurrences()
      .filter((b) => b.periodId === this.currentPeriod().id)
      .map((b) => {
        const payment = this.src.recurringPayments().find((r) => r.id === b.recurringPaymentId);
        const paidWith = this.src.transactions().find((t) => t.id === b.transactionId);
        return {
          id: b.id,
          name: payment?.name ?? 'Unknown bill',
          categoryName: payment ? this.categoryName(payment.categoryId) : '',
          accountName: this.src.accounts().find((a) => a.id === payment?.accountId)?.name ?? '',
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

  readonly investments = computed<InvestmentRow[]>(() =>
    this.accounts()
      .filter((a) => a.type === 'investment')
      .map((a) => ({
        ...a,
        group: a.subtype && RETIREMENT_SUBTYPES.includes(a.subtype) ? 'retirement' : 'personal',
      })),
  );

  /** Permanent life policies only: term has no cash value, so it isn't something you own. */
  readonly permanentPolicies = computed<PolicyRow[]>(() =>
    this.src
      .insurancePolicies()
      .filter((p) => p.type === 'life' && p.lifeKind && p.lifeKind !== 'term')
      .map((p) => ({
        id: p.id,
        name: p.name,
        provider: p.provider,
        kindLabel: LIFE_KIND_LABEL[p.lifeKind!],
        cashValue: p.cashValue ?? 0,
        cashValueAsOf: p.cashValueAsOf,
        deathBenefit: p.deathBenefit,
        premium: p.premium,
        frequency: p.frequency,
      })),
  );

  readonly termPolicies = computed(() =>
    this.src.insurancePolicies().filter((p) => p.type === 'life' && p.lifeKind === 'term'),
  );

  /** Everything owned and owed, grouped like a personal balance sheet. */
  readonly balanceSheet = computed(() => {
    const accounts = this.accounts();
    const line = (a: AccountRow): SheetLine => ({
      id: a.id,
      name: a.name,
      detail: [a.typeLabel, a.institution].filter(Boolean).join(' · '),
      amount: Math.abs(a.balance),
    });
    const group = (key: string, label: string, lines: SheetLine[]): SheetGroup => ({
      key,
      label,
      lines: [...lines].sort((x, y) => y.amount - x.amount),
      total: round2(lines.reduce((t, l) => t + l.amount, 0)),
    });
    const investments = this.investments();
    const owned = [
      group('cash', 'Cash & bank', accounts.filter((a) => ['checking', 'savings', 'cash'].includes(a.type)).map(line)),
      group('retirement', 'Retirement accounts', investments.filter((a) => a.group === 'retirement').map(line)),
      group('personal', 'Personal investments', investments.filter((a) => a.group === 'personal').map(line)),
      group(
        'insurance',
        'Life insurance cash value',
        this.permanentPolicies().map((p) => ({
          id: p.id,
          name: p.name,
          detail: `${p.kindLabel} · ${p.provider}`,
          amount: p.cashValue,
        })),
      ),
      group('property', 'Property & vehicles', accounts.filter((a) => a.type === 'property').map(line)),
    ].filter((g) => g.lines.length);
    const owed = [
      group('cards', 'Credit cards', accounts.filter((a) => a.type === 'credit_card').map(line)),
      group('loans', 'Loans', accounts.filter((a) => a.type === 'loan').map(line)),
    ].filter((g) => g.lines.length);
    const totalOwned = round2(owned.reduce((t, g) => t + g.total, 0));
    const totalOwed = round2(owed.reduce((t, g) => t + g.total, 0));
    return { owned, owed, totalOwned, totalOwed, netWorth: round2(totalOwned - totalOwed) };
  });

  // ------------------------------------------------------------- History

  /**
   * 'YYYY-MM' keys from the earliest history row through the current month
   * (at least the last 12 months, so charts have a stable axis).
   */
  readonly months = computed(() => {
    const today = this.asOf();
    const [y, m] = today.slice(0, 7).split('-').map(Number);
    const yearAgo = `${m === 12 ? y : y - 1}-${String((m % 12) + 1).padStart(2, '0')}`;
    const earliest = [
      ...this.src.balanceSnapshots().map((s) => s.asOfDate),
      ...this.src.netWorthSnapshots().map((s) => s.date),
      ...this.src.budgetActuals().map((r) => r.periodStart),
    ]
      .map((d) => d.slice(0, 7))
      .reduce((min, d) => (d < min ? d : min), yearAgo);
    return monthKeys(today, earliest);
  });

  /**
   * Month-end balance and contributions per investment account, from
   * account_balance_snapshots; the current month uses the live balance.
   */
  readonly investmentHistory = computed(() => {
    const months = this.months();
    const current = months[months.length - 1];
    const snapshots = this.src.balanceSnapshots();
    return this.investments().map((account) => {
      const own = snapshots
        .filter((s) => s.accountId === account.id)
        .sort((a, b) => a.asOfDate.localeCompare(b.asOfDate));
      return {
        account,
        months: months.map<InvestmentMonth>((month) => {
          const end = monthEnd(month);
          const last = own.filter((s) => s.asOfDate <= end).at(-1);
          return {
            month,
            balance: month === current ? account.balance : (last?.balance ?? null),
            contribution: own
              .filter((s) => s.asOfDate.startsWith(month))
              .reduce((t, s) => t + (s.netContributions ?? 0), 0),
          };
        }),
      };
    });
  });

  /** Owned vs. owed per month from net_worth_snapshots, plus the current month live. */
  readonly netWorthHistory = computed(() => {
    const months = this.months();
    const current = months[months.length - 1];
    const snapshots = [...this.src.netWorthSnapshots()].sort((a, b) => a.date.localeCompare(b.date));
    const sheet = this.balanceSheet();
    return months
      .map((month) => {
        if (month === current) return { month, owned: sheet.totalOwned, owed: sheet.totalOwed };
        const snap = snapshots.filter((s) => s.date.startsWith(month)).at(-1);
        const parts = parseBreakdown(snap?.breakdown ?? null);
        return parts ? { month, ...parts } : null;
      })
      .filter((r): r is { month: string; owned: number; owed: number } => r !== null);
  });

  /** Net worth now vs. the previous month-end snapshot. */
  readonly netWorthChange = computed(() => {
    const history = this.netWorthHistory();
    const prev = history[history.length - 2];
    if (!prev) return null;
    const prevValue = round2(prev.owned - prev.owed);
    return { month: prev.month, value: prevValue, change: round2(this.balanceSheet().netWorth - prevValue) };
  });

  /** Budget vs. actual per category per month. */
  readonly budgetHistory = computed(() =>
    this.src.budgetActuals().map((r) => ({
      month: r.periodStart.slice(0, 7),
      categoryId: r.categoryId,
      budgeted: r.budgeted,
      actual: r.actual,
    })),
  );

  // -------------------------------------------------------- Transactions

  readonly transactions = computed<TransactionRow[]>(() => {
    const accounts = this.src.accounts();
    const imports = this.src.csvImports();
    return this.src
      .transactions()
      .map((t) => ({
        ...t,
        accountName: accounts.find((a) => a.id === t.accountId)?.name ?? '',
        categoryName: this.categoryName(t.categoryId),
        /** Signed: money in is positive, money out negative. */
        signedAmount: t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : t.amount,
        source: imports.find((i) => i.id === t.csvImportId)?.filename ?? null,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  });

  readonly csvImports = computed(() => {
    const accounts = this.src.accounts();
    return [...this.src.csvImports()]
      .sort((a, b) => b.importedAt.localeCompare(a.importedAt))
      .map((i) => ({ ...i, accountName: accounts.find((a) => a.id === i.accountId)?.name ?? '' }));
  });
}

/** Reads {"owned": n, "owed": n} from a snapshot's breakdown JSON; null if missing or malformed. */
function parseBreakdown(json: string | null): { owned: number; owed: number } | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json);
    return typeof value?.owned === 'number' && typeof value?.owed === 'number'
      ? { owned: value.owned, owed: value.owed }
      : null;
  } catch {
    return null;
  }
}
