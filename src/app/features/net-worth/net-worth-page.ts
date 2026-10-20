import { CurrencyPipe, DOCUMENT, DatePipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { FinanceDataService } from '../../core/finance-data.service';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-net-worth-page',
  imports: [CurrencyPipe, DatePipe, PercentPipe, Icon],
  templateUrl: './net-worth-page.html',
})
export class NetWorthPage {
  private readonly data = inject(FinanceDataService);
  private readonly document = inject(DOCUMENT);

  /** `?view=owned | owed` shows one side of the report. */
  readonly view = input<string>();

  protected readonly asOf = this.data.asOf;
  protected readonly sheet = this.data.balanceSheet;
  protected readonly change = this.data.netWorthChange;

  protected readonly showOwned = computed(() => this.view() !== 'owed');
  protected readonly showOwed = computed(() => this.view() !== 'owned');

  /** Owed as a share of owned (debt-to-asset ratio). */
  protected readonly debtRatio = computed(() => {
    const s = this.sheet();
    return s.totalOwned ? s.totalOwed / s.totalOwned : 0;
  });

  protected print() {
    this.document.defaultView?.print();
  }
}
