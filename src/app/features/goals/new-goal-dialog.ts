import { CurrencyPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { daysBetween } from '../../core/dates';
import { FinanceDataService } from '../../core/finance-data.service';

/** Form for adding a savings goal. Open it with `open()`. */
@Component({
  selector: 'app-new-goal-dialog',
  imports: [CurrencyPipe],
  templateUrl: './new-goal-dialog.html',
})
export class NewGoalDialog {
  private readonly data = inject(FinanceDataService);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  protected readonly name = signal('');
  protected readonly targetAmount = signal(0);
  protected readonly startDate = signal('');
  protected readonly targetDate = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly saving = signal(false);

  protected readonly datesValid = computed(() => !!this.startDate() && this.targetDate() > this.startDate());

  protected readonly valid = computed(
    () => !!this.name().trim() && this.targetAmount() > 0 && this.datesValid(),
  );

  /** Steady monthly saving that reaches the target on the due date. */
  protected readonly monthly = computed(() => {
    if (!this.valid()) return null;
    const months = Math.max(1, Math.ceil(daysBetween(this.startDate(), this.targetDate()) / 30.4));
    return this.targetAmount() / months;
  });

  open() {
    const today = this.data.asOf();
    this.name.set('');
    this.targetAmount.set(0);
    this.startDate.set(today);
    // A year out; Feb 29 becomes Feb 28 so the date exists.
    this.targetDate.set(`${+today.slice(0, 4) + 1}${today.slice(4).replace('-02-29', '-02-28')}`);
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
      const saved = await this.data.addGoal({
        name: this.name(),
        targetAmount: this.targetAmount(),
        startDate: this.startDate(),
        targetDate: this.targetDate(),
      });
      if (saved) this.close();
      else this.error.set('Check the name, target and dates.');
    } catch {
      this.error.set('Couldn’t save the goal. Check that the API is running and try again.');
    } finally {
      this.saving.set(false);
    }
  }
}
