import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import {
  BILL_STATUS,
  BillRow,
  BillStatus,
  DUE_SOON_DAYS,
  FinanceDataService,
} from '../../core/finance-data.service';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-bills-page',
  imports: [CurrencyPipe, DatePipe, Icon],
  templateUrl: './bills-page.html',
})
export class BillsPage {
  private readonly data = inject(FinanceDataService);

  /** `?view=due-soon` limits the list to pending bills due in the next week. */
  readonly view = input<string>();

  protected readonly statusMeta = BILL_STATUS;
  protected readonly dueSoonDays = DUE_SOON_DAYS;
  protected readonly statusFilters: (BillStatus | 'all')[] = ['all', 'pending', 'paid'];
  protected readonly period = this.data.currentPeriod;

  protected readonly query = signal('');
  protected readonly status = signal<BillStatus | 'all'>('all');

  protected readonly title = computed(() => (this.view() === 'due-soon' ? 'Due this week' : 'Bills'));

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.data
      .bills()
      .filter((b) => this.view() !== 'due-soon' || this.isDueSoon(b))
      .filter((b) => this.status() === 'all' || b.status === this.status())
      .filter((b) => !q || b.name.toLowerCase().includes(q) || b.categoryName.toLowerCase().includes(q));
  });

  protected readonly kpis = computed(() => {
    const all = this.data.bills();
    const paid = all.filter((b) => b.status === 'paid');
    const pending = all.filter((b) => b.status === 'pending');
    const next = pending.find((b) => this.data.daysUntil(b.expectedDate) >= 0);
    return {
      total: all.reduce((t, b) => t + b.expectedAmount, 0),
      count: all.length,
      paidAmount: paid.reduce((t, b) => t + (b.paidAmount ?? b.expectedAmount), 0),
      paidCount: paid.length,
      pendingAmount: pending.reduce((t, b) => t + b.expectedAmount, 0),
      pendingCount: pending.length,
      next,
    };
  });

  protected statusLabel(s: BillStatus | 'all') {
    return s === 'all' ? 'All' : BILL_STATUS[s].label;
  }

  protected isDueSoon(b: BillRow) {
    const d = this.data.daysUntil(b.expectedDate);
    return b.status === 'pending' && d >= 0 && d <= DUE_SOON_DAYS;
  }

  protected dueLabel(b: BillRow) {
    if (b.status !== 'pending') return '';
    const d = this.data.daysUntil(b.expectedDate);
    if (d < 0) return `${-d} ${d === -1 ? 'day' : 'days'} late`;
    if (d === 0) return 'due today';
    if (d === 1) return 'due tomorrow';
    return `in ${d} days`;
  }

  protected isLate(b: BillRow) {
    return b.status === 'pending' && this.data.daysUntil(b.expectedDate) < 0;
  }
}
