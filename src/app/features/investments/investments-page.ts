import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, input } from '@angular/core';
import { ACCOUNT_STATUS, FinanceDataService, InvestmentRow } from '../../core/finance-data.service';
import { Icon } from '../../shared/icon';

const GROUP_LABEL: Record<InvestmentRow['group'], string> = {
  retirement: 'Retirement',
  personal: 'Personal',
};

@Component({
  selector: 'app-investments-page',
  imports: [CurrencyPipe, DatePipe, PercentPipe, Icon],
  templateUrl: './investments-page.html',
})
export class InvestmentsPage {
  private readonly data = inject(FinanceDataService);

  /** `?view=retirement | personal | insurance`; omitted shows everything. */
  readonly view = input<string>();

  protected readonly groupLabel = GROUP_LABEL;
  protected readonly statusMeta = ACCOUNT_STATUS;
  protected readonly policies = this.data.permanentPolicies;
  protected readonly termPolicies = this.data.termPolicies;

  protected readonly showAccounts = computed(() => this.view() !== 'insurance');
  protected readonly showPolicies = computed(() => !this.view() || this.view() === 'insurance');

  protected readonly title = computed(() => {
    switch (this.view()) {
      case 'retirement':
        return 'Retirement accounts';
      case 'personal':
        return 'Personal investments';
      case 'insurance':
        return 'Permanent life insurance';
      default:
        return 'Investments & Insurance';
    }
  });

  protected readonly accounts = computed(() =>
    this.data
      .investments()
      .filter((a) => !this.view() || a.group === this.view())
      .sort((a, b) => b.balance - a.balance),
  );

  protected readonly kpis = computed(() => {
    const inv = this.data.investments();
    const sum = (rows: InvestmentRow[]) => rows.reduce((t, a) => t + a.balance, 0);
    const retirement = inv.filter((a) => a.group === 'retirement');
    const personal = inv.filter((a) => a.group === 'personal');
    const cashValue = this.policies().reduce((t, p) => t + p.cashValue, 0);
    const invested = sum(inv);
    return {
      total: invested + cashValue,
      invested,
      retirement: sum(retirement),
      retirementCount: retirement.length,
      personal: sum(personal),
      personalCount: personal.length,
      cashValue,
      policyCount: this.policies().length,
    };
  });

  protected share(a: InvestmentRow) {
    const total = this.kpis().invested;
    return total ? a.balance / total : 0;
  }
}
