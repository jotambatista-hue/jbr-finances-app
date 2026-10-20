import { CurrencyPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { FinanceDataService } from '../../core/finance-data.service';

/** Form for adding a budget to the current period. Open it with `open()`. */
@Component({
  selector: 'app-new-budget-dialog',
  imports: [CurrencyPipe],
  templateUrl: './new-budget-dialog.html',
})
export class NewBudgetDialog {
  private readonly data = inject(FinanceDataService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly period = this.data.currentPeriod;
  protected readonly groups = this.data.unbudgetedCategories;
  /** False until at least one expense category exists to budget against. */
  protected readonly hasCategories = computed(() => this.data.budgetGroups().length > 0);

  protected readonly categoryId = signal('');
  protected readonly amount = signal(0);
  protected readonly notes = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  /** What the chosen category cost last month, as a starting point for the amount. */
  protected readonly lastMonth = computed(() => {
    const months = this.data.months();
    const month = months[months.length - 2];
    const row = this.data
      .budgetHistory()
      .find((r) => r.month === month && r.categoryId === this.categoryId());
    if (!row) return null;
    const label = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' }).format(
      new Date(`${month}-01T00:00:00Z`),
    );
    return { label, actual: row.actual };
  });

  protected readonly valid = computed(() => !!this.categoryId() && this.amount() > 0);

  open() {
    this.categoryId.set(this.groups()[0]?.categories[0]?.id ?? '');
    this.amount.set(0);
    this.notes.set('');
    this.error.set(null);
    this.dialog().nativeElement.showModal();
  }

  protected close() {
    this.dialog().nativeElement.close();
  }

  protected async save() {
    if (!this.valid() || this.saving()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      if (await this.data.addBudget(this.categoryId(), this.amount(), this.notes())) {
        this.close();
      } else {
        this.error.set('That category already has a budget this period, or the amount isn’t valid.');
      }
    } catch {
      this.error.set('Couldn’t save the budget. Check that the API is running and try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
