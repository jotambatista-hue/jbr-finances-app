import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import {
  ACCOUNT_STATUS,
  AccountRow,
  AccountStatus,
  FinanceDataService,
  IMPORT_STALE_DAYS,
} from '../../core/finance-data.service';
import { Icon } from '../../shared/icon';

const VIEW_TYPES: Record<string, AccountRow['type'][]> = {
  bank: ['checking', 'savings'],
  credit: ['credit_card'],
  investment: ['investment'],
  cash: ['cash'],
};

const VIEW_TITLES: Record<string, string> = {
  bank: 'Bank accounts',
  credit: 'Credit cards',
  investment: 'Investments',
  cash: 'Cash',
};

const SORTS = [
  { key: 'balance', label: 'Balance', compare: (a: AccountRow, b: AccountRow) => b.balance - a.balance },
  { key: 'name', label: 'Name', compare: (a: AccountRow, b: AccountRow) => a.name.localeCompare(b.name) },
  { key: 'type', label: 'Type', compare: (a: AccountRow, b: AccountRow) => a.typeLabel.localeCompare(b.typeLabel) },
] as const;

@Component({
  selector: 'app-accounts-page',
  imports: [CurrencyPipe, DatePipe, Icon],
  templateUrl: './accounts-page.html',
})
export class AccountsPage {
  private readonly data = inject(FinanceDataService);

  /** Bound from the `?view=` query param. */
  readonly view = input<string>();

  protected readonly statusMeta = ACCOUNT_STATUS;
  protected readonly staleDays = IMPORT_STALE_DAYS;
  protected readonly statusFilters: (AccountStatus | 'all')[] = ['all', 'synced', 'due', 'failed'];

  protected readonly query = signal('');
  protected readonly status = signal<AccountStatus | 'all'>('all');
  private readonly sortIndex = signal(0);
  protected readonly sort = computed(() => SORTS[this.sortIndex()]);

  protected readonly title = computed(() => VIEW_TITLES[this.view() ?? ''] ?? 'Accounts');

  private readonly inView = computed(() => {
    const types = VIEW_TYPES[this.view() ?? ''];
    return this.data.accounts().filter((a) => !types || types.includes(a.type));
  });

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.inView()
      .filter((a) => this.status() === 'all' || a.status === this.status())
      .filter(
        (a) =>
          !q ||
          a.name.toLowerCase().includes(q) ||
          (a.institution ?? '').toLowerCase().includes(q) ||
          a.typeLabel.toLowerCase().includes(q),
      )
      .sort(this.sort().compare);
  });

  protected readonly kpis = computed(() => {
    const all = this.data.accounts();
    const sum = (rows: AccountRow[]) => rows.reduce((t, a) => t + a.balance, 0);
    const liquid = all.filter((a) => ['checking', 'savings', 'cash'].includes(a.type));
    const cards = all.filter((a) => a.type === 'credit_card');
    const investments = all.filter((a) => a.type === 'investment');
    return {
      net: sum(all),
      accountCount: all.length,
      liquid: sum(liquid),
      liquidCount: liquid.length,
      owed: -sum(cards),
      cardCount: cards.length,
      invested: sum(investments),
      investmentCount: investments.length,
    };
  });

  protected statusLabel(s: AccountStatus | 'all') {
    return s === 'all' ? 'All' : ACCOUNT_STATUS[s].label;
  }

  protected cycleSort() {
    this.sortIndex.update((i) => (i + 1) % SORTS.length);
  }
}
