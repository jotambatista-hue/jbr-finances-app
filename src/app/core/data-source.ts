import { HttpClient, HttpErrorResponse, HttpResourceRef, httpResource } from '@angular/common/http';
import { Injectable, InjectionToken, Signal, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Account,
  AccountBalanceSnapshot,
  BillOccurrence,
  Budget,
  BudgetActual,
  BudgetAdjustment,
  BudgetPeriod,
  Category,
  CsvImport,
  Goal,
  GoalContribution,
  InsurancePolicy,
  NetWorthSnapshot,
  RecurringPayment,
  Transaction,
} from './models';

/** Base URL of the jbrfinanceapi backend. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  factory: () => 'http://localhost:5032/api',
});

export interface DataStatus {
  loading: boolean;
  /** One message per request that failed. */
  errors: string[];
}

/**
 * Raw table data the app is built on. FinanceDataService derives every page
 * from these signals, so pages don't care whether data comes from the API or
 * from the mock set.
 */
export abstract class DataSource {
  /** 'YYYY-MM-DD' of the day the app is computing for. */
  abstract readonly today: Signal<string>;
  abstract readonly status: Signal<DataStatus>;

  abstract readonly accounts: Signal<Account[]>;
  abstract readonly csvImports: Signal<CsvImport[]>;
  abstract readonly categories: Signal<Category[]>;
  abstract readonly budgetPeriods: Signal<BudgetPeriod[]>;
  abstract readonly budgets: Signal<Budget[]>;
  abstract readonly budgetAdjustments: Signal<BudgetAdjustment[]>;
  abstract readonly budgetActuals: Signal<BudgetActual[]>;
  abstract readonly transactions: Signal<Transaction[]>;
  abstract readonly recurringPayments: Signal<RecurringPayment[]>;
  abstract readonly billOccurrences: Signal<BillOccurrence[]>;
  abstract readonly goals: Signal<Goal[]>;
  abstract readonly goalContributions: Signal<GoalContribution[]>;
  abstract readonly insurancePolicies: Signal<InsurancePolicy[]>;
  abstract readonly netWorthSnapshots: Signal<NetWorthSnapshot[]>;
  abstract readonly balanceSnapshots: Signal<AccountBalanceSnapshot[]>;

  /** Saves new goal contributions (e.g. both halves of a divert) and refreshes them. */
  abstract addGoalContributions(rows: Omit<GoalContribution, 'id'>[]): Promise<void>;
  /** Saves a new budget period and resolves with it, id included. */
  abstract addBudgetPeriod(row: Omit<BudgetPeriod, 'id'>): Promise<BudgetPeriod>;
  abstract addBudget(row: Omit<Budget, 'id' | 'updatedAt'>): Promise<void>;
  abstract addGoal(row: Omit<Goal, 'id'>): Promise<void>;
  abstract addCategory(row: Omit<Category, 'id'>): Promise<void>;
  abstract updateCategory(row: Category): Promise<void>;
  abstract deleteCategory(id: string): Promise<void>;
}

/** Local calendar date as 'YYYY-MM-DD'. */
export function localToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Most recent transactions loaded for the Transactions page. */
const TRANSACTION_LIMIT = 1000;

function describe(path: string, error: unknown) {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return `Can't reach the API (${path}). Is jbrfinanceapi running?`;
    // The API answers with ProblemDetails; its detail says what actually went wrong.
    const detail = typeof error.error?.detail === 'string' ? error.error.detail : null;
    return `${path}: ${detail ?? `${error.status} ${error.statusText}`}`;
  }
  return `${path}: ${String(error)}`;
}

/** Reads every table from jbrfinanceapi. */
@Injectable()
export class ApiDataSource extends DataSource {
  private readonly base = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);
  private readonly resources: { path: string; ref: HttpResourceRef<unknown> }[] = [];

  private list<T>(path: string): Signal<T[]> {
    const ref = httpResource<T[]>(() => `${this.base}/${path}`);
    this.resources.push({ path, ref });
    // An errored resource has no value; pages render their empty states instead.
    return computed(() => (ref.hasValue() ? ref.value() : []));
  }

  readonly today = signal(localToday());

  readonly accounts = this.list<Account>('accounts');
  readonly csvImports = this.list<CsvImport>('csv-imports');
  readonly categories = this.list<Category>('categories');
  readonly budgetPeriods = this.list<BudgetPeriod>('budget-periods');
  readonly budgets = this.list<Budget>('budgets');
  readonly budgetAdjustments = this.list<BudgetAdjustment>('budget-adjustments');
  readonly budgetActuals = this.list<BudgetActual>('reports/budget-vs-actual');
  readonly transactions = this.list<Transaction>(`transactions?take=${TRANSACTION_LIMIT}`);
  readonly recurringPayments = this.list<RecurringPayment>('recurring-payments');
  readonly billOccurrences = this.list<BillOccurrence>('bill-occurrences');
  readonly goals = this.list<Goal>('goals');
  readonly goalContributions = this.list<GoalContribution>('goal-contributions');
  readonly insurancePolicies = this.list<InsurancePolicy>('insurance-policies');
  readonly netWorthSnapshots = this.list<NetWorthSnapshot>('net-worth-snapshots');
  readonly balanceSnapshots = this.list<AccountBalanceSnapshot>('account-balance-snapshots');

  readonly status = computed<DataStatus>(() => ({
    loading: this.resources.some((r) => r.ref.isLoading()),
    errors: this.resources.filter((r) => r.ref.error()).map((r) => describe(r.path, r.ref.error())),
  }));

  private reload(path: string) {
    this.resources.find((r) => r.path === path)?.ref.reload();
  }

  /** POSTs one row and reloads the matching list; resolves with the saved row. */
  private async create<T>(path: string, row: unknown): Promise<T> {
    const saved = await firstValueFrom(this.http.post<T>(`${this.base}/${path}`, row));
    this.reload(path);
    return saved;
  }

  async addGoalContributions(rows: Omit<GoalContribution, 'id'>[]) {
    for (const row of rows) {
      await firstValueFrom(this.http.post(`${this.base}/goal-contributions`, row));
    }
    this.reload('goal-contributions');
  }

  addBudgetPeriod(row: Omit<BudgetPeriod, 'id'>) {
    return this.create<BudgetPeriod>('budget-periods', row);
  }

  async addBudget(row: Omit<Budget, 'id' | 'updatedAt'>) {
    await this.create('budgets', row);
    // The report only lists categories that have a budget, so it changes too.
    this.reload('reports/budget-vs-actual');
  }

  async addGoal(row: Omit<Goal, 'id'>) {
    await this.create('goals', row);
  }

  async addCategory(row: Omit<Category, 'id'>) {
    await this.create('categories', row);
  }

  async updateCategory(row: Category) {
    await firstValueFrom(this.http.put(`${this.base}/categories/${row.id}`, row));
    this.reload('categories');
  }

  async deleteCategory(id: string) {
    await firstValueFrom(this.http.delete(`${this.base}/categories/${id}`));
    this.reload('categories');
  }
}
