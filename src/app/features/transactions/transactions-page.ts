import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FinanceDataService, Tone, TransactionRow } from '../../core/finance-data.service';
import { CsvImport } from '../../core/models';
import { Icon } from '../../shared/icon';

type TypeFilter = 'all' | TransactionRow['type'];

const IMPORT_STATUS: Record<CsvImport['status'], { label: string; tone: Tone }> = {
  completed: { label: 'Completed', tone: 'good' },
  pending: { label: 'Processing', tone: 'warn' },
  failed: { label: 'Failed', tone: 'crit' },
};

@Component({
  selector: 'app-transactions-page',
  imports: [CurrencyPipe, DatePipe, Icon],
  templateUrl: './transactions-page.html',
})
export class TransactionsPage {
  private readonly data = inject(FinanceDataService);
  private readonly router = inject(Router);

  /** `?view=imported | manual | imports` */
  readonly view = input<string>();
  /** `?account=<id>` limits everything on the page to one account. */
  readonly account = input<string>();

  protected readonly importStatus = IMPORT_STATUS;
  protected readonly typeFilters: TypeFilter[] = ['all', 'expense', 'income', 'transfer'];
  protected readonly query = signal('');
  protected readonly type = signal<TypeFilter>('all');

  protected readonly showImports = computed(() => this.view() === 'imports');

  /** Accounts that have transactions or imports, for the account picker. */
  protected readonly accountOptions = computed(() => {
    const ids = new Set([
      ...this.data.transactions().map((t) => t.accountId),
      ...this.data.csvImports().map((i) => i.accountId),
    ]);
    return this.data.accounts().filter((a) => ids.has(a.id));
  });

  protected readonly accountName = computed(
    () => this.data.accounts().find((a) => a.id === this.account())?.name ?? null,
  );

  protected readonly title = computed(() => {
    const base =
      this.view() === 'imports'
        ? 'Import history'
        : this.view() === 'imported'
          ? 'Imported transactions'
          : this.view() === 'manual'
            ? 'Entered by hand'
            : 'Transactions';
    return this.accountName() ? `${base} · ${this.accountName()}` : base;
  });

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.data
      .transactions()
      .filter((t) => !this.account() || t.accountId === this.account())
      .filter((t) => this.view() !== 'imported' || t.source)
      .filter((t) => this.view() !== 'manual' || !t.source)
      .filter((t) => this.type() === 'all' || t.type === this.type())
      .filter(
        (t) =>
          !q ||
          (t.description ?? '').toLowerCase().includes(q) ||
          t.categoryName.toLowerCase().includes(q) ||
          t.accountName.toLowerCase().includes(q),
      );
  });

  protected readonly imports = computed(() =>
    this.data.csvImports().filter((i) => !this.account() || i.accountId === this.account()),
  );

  protected readonly totals = computed(() => {
    const rows = this.rows();
    const moneyIn = rows.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const moneyOut = rows.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
    return { moneyIn, moneyOut, net: moneyIn - moneyOut, count: rows.length };
  });

  protected typeLabel(t: TypeFilter) {
    return t === 'all' ? 'All' : t === 'expense' ? 'Money out' : t === 'income' ? 'Money in' : 'Transfers';
  }

  protected setAccount(id: string) {
    this.router.navigate([], { queryParams: { account: id || null }, queryParamsHandling: 'merge' });
  }
}
