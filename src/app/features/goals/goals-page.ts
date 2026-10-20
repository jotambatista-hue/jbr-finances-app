import { CurrencyPipe, DatePipe, PercentPipe } from '@angular/common';
import { Component, ElementRef, computed, inject, input, signal, viewChild } from '@angular/core';
import {
  FinanceDataService,
  GOAL_SCHEDULE_TOLERANCE,
  GOAL_STATUS,
  GoalRow,
  GoalStatus,
  goalViews,
} from '../../core/finance-data.service';
import { Icon } from '../../shared/icon';

const SORTS = [
  { label: 'Due date', compare: (a: GoalRow, b: GoalRow) => a.targetDate.localeCompare(b.targetDate) },
  { label: 'vs. schedule', compare: (a: GoalRow, b: GoalRow) => a.variance - b.variance },
  { label: '% saved', compare: (a: GoalRow, b: GoalRow) => b.progress - a.progress },
  { label: 'Name', compare: (a: GoalRow, b: GoalRow) => a.name.localeCompare(b.name) },
] as const;

@Component({
  selector: 'app-goals-page',
  imports: [CurrencyPipe, DatePipe, PercentPipe, Icon],
  templateUrl: './goals-page.html',
})
export class GoalsPage {
  protected readonly data = inject(FinanceDataService);

  readonly view = input<string>();

  protected readonly statusMeta = GOAL_STATUS;
  protected readonly tolerance = GOAL_SCHEDULE_TOLERANCE;
  protected readonly statusFilters: (GoalStatus | 'all')[] = ['all', 'ahead', 'on_track', 'behind', 'past_due', 'reached'];

  protected readonly query = signal('');
  protected readonly status = signal<GoalStatus | 'all'>('all');
  private readonly sortIndex = signal(0);
  protected readonly sort = computed(() => SORTS[this.sortIndex()]);

  private readonly views = computed(() => goalViews(this.data.asOf()));

  protected readonly title = computed(() => this.views()[this.view() ?? '']?.title ?? 'Goals');

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const view = this.views()[this.view() ?? ''];
    return this.data
      .goals()
      .filter((g) => !view || view.match(g))
      .filter((g) => this.status() === 'all' || g.status === this.status())
      .filter((g) => !q || g.name.toLowerCase().includes(q))
      .sort(this.sort().compare);
  });

  protected readonly kpis = computed(() => {
    const all = this.data.goals();
    const open = all.filter((g) => g.status !== 'reached');
    const lagging = all.filter((g) => g.status === 'behind' || g.status === 'past_due');
    return {
      saved: all.reduce((t, g) => t + g.saved, 0),
      target: all.reduce((t, g) => t + g.targetAmount, 0),
      monthly: open.reduce((t, g) => t + g.monthlyNeeded, 0),
      openCount: open.length,
      surplus: all.reduce((t, g) => t + this.data.surplus(g), 0),
      aheadCount: all.filter((g) => g.status === 'ahead').length,
      laggingCount: lagging.length,
      gap: lagging.reduce((t, g) => t - Math.min(0, g.variance), 0),
      count: all.length,
    };
  });

  protected statusLabel(s: GoalStatus | 'all') {
    return s === 'all' ? 'All' : GOAL_STATUS[s].label;
  }

  protected cycleSort() {
    this.sortIndex.update((i) => (i + 1) % SORTS.length);
  }

  protected dueLabel(g: GoalRow) {
    const d = g.daysLeft;
    if (d < 0) return `${-d} days late`;
    if (d === 0) return 'due today';
    if (d < 45) return `in ${d} days`;
    return `in ${Math.round(d / 30.4)} months`;
  }

  // ------------------------------------------------------------ Divert dialog

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('divertDialog');
  protected readonly divertFrom = signal<GoalRow | null>(null);
  protected readonly divertTo = signal('');
  protected readonly divertAmount = signal(0);

  /** Goals that can receive funds: not reached, not the source; neediest first. */
  protected readonly divertTargets = computed(() => {
    const from = this.divertFrom();
    return this.data
      .goals()
      .filter((g) => g.id !== from?.id && g.status !== 'reached')
      .sort((a, b) => a.variance - b.variance);
  });

  protected readonly divertMax = computed(() => {
    const from = this.divertFrom();
    return from ? this.data.surplus(from) : 0;
  });

  protected readonly divertValid = computed(
    () => !!this.divertTo() && this.divertAmount() > 0 && this.divertAmount() <= this.divertMax(),
  );

  protected openDivert(g: GoalRow) {
    this.divertError.set(null);
    this.divertFrom.set(g);
    const target = this.divertTargets()[0];
    this.divertTo.set(target?.id ?? '');
    this.divertAmount.set(this.suggestedAmount(target));
    this.dialog().nativeElement.showModal();
  }

  protected chooseTarget(id: string) {
    this.divertTo.set(id);
    this.divertAmount.set(this.suggestedAmount(this.divertTargets().find((g) => g.id === id)));
  }

  /** Enough to put the target back on schedule, capped at the surplus. */
  private suggestedAmount(target: GoalRow | undefined) {
    const gap = target ? Math.ceil(Math.max(0, -target.variance)) : 0;
    return gap > 0 ? Math.min(gap, this.divertMax()) : this.divertMax();
  }

  protected readonly divertError = signal<string | null>(null);
  protected readonly divertSaving = signal(false);

  protected async confirmDivert() {
    const from = this.divertFrom();
    if (!from || this.divertSaving()) return;
    this.divertSaving.set(true);
    this.divertError.set(null);
    try {
      if (await this.data.divert(from.id, this.divertTo(), this.divertAmount())) {
        this.dialog().nativeElement.close();
      } else {
        this.divertError.set('That amount can’t be moved from this goal.');
      }
    } catch {
      this.divertError.set('Couldn’t save the change. Check that the API is running and try again.');
    } finally {
      this.divertSaving.set(false);
    }
  }

  protected closeDivert() {
    this.dialog().nativeElement.close();
  }
}
