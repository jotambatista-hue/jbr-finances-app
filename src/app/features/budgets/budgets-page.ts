import { CurrencyPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import {
  BUDGET_STATUS,
  BudgetRow,
  BudgetStatus,
  FinanceDataService,
  NEARING_LIMIT_RATIO,
} from '../../core/finance-data.service';
import { Icon } from '../../shared/icon';
import { NewBudgetDialog } from './new-budget-dialog';

const SORTS = [
  { label: '% used', compare: (a: BudgetRow, b: BudgetRow) => b.ratio - a.ratio },
  { label: 'Remaining', compare: (a: BudgetRow, b: BudgetRow) => a.remaining - b.remaining },
  { label: 'Name', compare: (a: BudgetRow, b: BudgetRow) => a.categoryName.localeCompare(b.categoryName) },
] as const;

@Component({
  selector: 'app-budgets-page',
  imports: [CurrencyPipe, PercentPipe, Icon, NewBudgetDialog],
  templateUrl: './budgets-page.html',
})
export class BudgetsPage {
  private readonly data = inject(FinanceDataService);

  /** Bound from the `?view=` query param: a category group id, or `over`. */
  readonly view = input<string>();

  protected readonly statusMeta = BUDGET_STATUS;
  protected readonly nearingRatio = NEARING_LIMIT_RATIO;
  protected readonly statusFilters: (BudgetStatus | 'all')[] = ['all', 'on_track', 'nearing', 'over'];

  protected readonly period = this.data.currentPeriod;
  protected readonly periodDay = this.data.periodDay;
  protected readonly pace = this.data.periodProgress;

  protected readonly query = signal('');
  protected readonly status = signal<BudgetStatus | 'all'>('all');
  private readonly sortIndex = signal(0);
  protected readonly sort = computed(() => SORTS[this.sortIndex()]);

  protected readonly title = computed(() => {
    const v = this.view();
    if (v === 'over') return 'Over budget';
    return this.data.budgetGroups().find((g) => g.id === v)?.name ?? 'Budgets';
  });

  private readonly inView = computed(() => {
    const v = this.view();
    return this.data
      .budgets()
      .filter((b) => !v || (v === 'over' ? b.status === 'over' : b.groupId === v));
  });

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.inView()
      .filter((b) => this.status() === 'all' || b.status === this.status())
      .filter((b) => !q || b.categoryName.toLowerCase().includes(q))
      .sort(this.sort().compare);
  });

  protected readonly kpis = computed(() => {
    const all = this.data.budgets();
    const budgeted = all.reduce((t, b) => t + b.amount, 0);
    const planned = all.reduce((t, b) => t + b.originalAmount, 0);
    const spent = all.reduce((t, b) => t + b.actual, 0);
    const over = all.filter((b) => b.status === 'over');
    return {
      budgeted,
      revisedBy: budgeted - planned,
      spent,
      spentRatio: budgeted ? spent / budgeted : 0,
      remaining: budgeted - spent,
      overCount: over.length,
      overBy: over.reduce((t, b) => t - b.remaining, 0),
      categoryCount: all.length,
    };
  });

  protected statusLabel(s: BudgetStatus | 'all') {
    return s === 'all' ? 'All' : BUDGET_STATUS[s].label;
  }

  protected cycleSort() {
    this.sortIndex.update((i) => (i + 1) % SORTS.length);
  }

  /** Fill width for the meter, capped at the track. */
  protected fill(row: BudgetRow) {
    return Math.min(row.ratio, 1) * 100;
  }
}
