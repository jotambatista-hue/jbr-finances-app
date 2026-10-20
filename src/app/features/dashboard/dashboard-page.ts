import { CurrencyPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BUDGET_STATUS,
  FinanceDataService,
  GOAL_STATUS,
  budgetStatus,
} from '../../core/finance-data.service';
import { Chart, ChartSeries } from '../../shared/chart';
import { Icon } from '../../shared/icon';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const monthShort = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const monthLong = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

const toDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
const signedMoney = (v: number) => (v < 0 ? `−${money.format(-v)}` : money.format(v));

/** Categorical slots, validated against the app's dark surface (see styles.css). */
const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'];
const CONTEXT = 'var(--series-muted)';
const NEGATIVE = 'var(--series-negative)';

type Granularity = 'month' | 'quarter' | 'year';

@Component({
  selector: 'app-dashboard-page',
  imports: [Chart, CurrencyPipe, Icon, PercentPipe, RouterLink],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  protected readonly data = inject(FinanceDataService);

  protected readonly money = (v: number) => signedMoney(v);
  protected readonly compact = (v: number) => (v < 0 ? `−${compact.format(-v)}` : compact.format(v));
  protected readonly budgetStatus = BUDGET_STATUS;
  protected readonly goalStatus = GOAL_STATUS;
  protected readonly palette = SERIES;

  private readonly currentMonth = computed(() => this.data.asOf().slice(0, 7));
  protected readonly years = computed(() => [...new Set(this.data.months().map((m) => m.slice(0, 4)))].reverse());

  // ------------------------------------------------------------------ KPIs

  protected readonly kpis = computed(() => {
    const budgets = this.data.budgets();
    const goals = this.data.goals();
    const budgeted = budgets.reduce((t, b) => t + b.amount, 0);
    const spent = budgets.reduce((t, b) => t + b.actual, 0);
    const ytd = this.investmentPeriods('year').at(-1);
    return {
      netWorth: this.data.balanceSheet().netWorth,
      netWorthChange: this.data.netWorthChange(),
      budgetUsed: budgeted ? spent / budgeted : 0,
      overBudget: budgets.filter((b) => b.status === 'over').length,
      onSchedule: goals.filter((g) => ['ahead', 'on_track', 'reached'].includes(g.status)).length,
      goalCount: goals.length,
      invested: this.data.investments().reduce((t, a) => t + a.balance, 0),
      ytdGain: ytd?.gain ?? 0,
      ytdReturn: ytd?.returnPct ?? 0,
    };
  });

  // ---------------------------------------------------- Owned vs. owed

  protected readonly netWorthRange = signal<12 | 'all'>(12);

  protected readonly netWorthChart = computed(() => {
    const all = this.data.netWorthHistory();
    const rows = this.netWorthRange() === 'all' ? all : all.slice(-12);
    return {
      hasData: rows.some((r) => r.owned !== 0 || r.owed !== 0),
      labels: rows.map((r) => monthShort.format(toDate(r.month)) + (r.month.endsWith('-01') ? ` ’${r.month.slice(2, 4)}` : '')),
      titles: rows.map((r) => monthLong.format(toDate(r.month)) + (r.month === this.currentMonth() ? ' (to date)' : '')),
      series: [
        { name: 'Owned', values: rows.map((r) => r.owned), color: SERIES[0], stack: 'nw' },
        { name: 'Owed', values: rows.map((r) => -r.owed), color: SERIES[1], stack: 'nw' },
        { name: 'Net worth', values: rows.map((r) => r.owned - r.owed), color: SERIES[2], type: 'line' },
      ] satisfies ChartSeries[],
    };
  });

  // ---------------------------------------------------------- Budgets

  protected readonly budgetMode = signal<'month' | 'year'>('month');
  protected readonly budgetMonth = signal<string | null>(null);
  protected readonly budgetYear = signal<string | null>(null);

  protected readonly budgetMonths = computed(() =>
    [...new Set(this.data.budgetHistory().map((b) => b.month))].reverse(),
  );

  protected readonly selectedBudgetMonth = computed(() => this.budgetMonth() ?? this.currentMonth());
  protected readonly selectedBudgetYear = computed(() => this.budgetYear() ?? this.currentMonth().slice(0, 4));

  protected monthLabel(month: string) {
    return monthLong.format(toDate(month)) + (month === this.currentMonth() ? ' (to date)' : '');
  }

  /** Per-category budget vs. actual for one month, largest budget first. */
  protected readonly budgetByCategory = computed(() => {
    const month = this.selectedBudgetMonth();
    const rows = this.data
      .budgetHistory()
      .filter((b) => b.month === month)
      .map((b) => {
        const ratio = b.budgeted ? b.actual / b.budgeted : 0;
        return { ...b, name: this.data.categoryName(b.categoryId), ratio, status: budgetStatus(ratio) };
      })
      .sort((a, b) => b.budgeted - a.budgeted);
    const budgeted = rows.reduce((t, r) => t + r.budgeted, 0);
    const actual = rows.reduce((t, r) => t + r.actual, 0);
    return { rows, budgeted, actual, variance: budgeted - actual };
  });

  /** Monthly totals for one year. */
  protected readonly budgetYearChart = computed(() => {
    const year = this.selectedBudgetYear();
    const months = this.budgetMonths().filter((m) => m.startsWith(year)).reverse();
    const totals = months.map((m) => {
      const rows = this.data.budgetHistory().filter((b) => b.month === m);
      return {
        month: m,
        budgeted: rows.reduce((t, r) => t + r.budgeted, 0),
        actual: rows.reduce((t, r) => t + r.actual, 0),
      };
    });
    const budgeted = totals.reduce((t, r) => t + r.budgeted, 0);
    const actual = totals.reduce((t, r) => t + r.actual, 0);
    return {
      labels: months.map((m) => monthShort.format(toDate(m))),
      titles: months.map((m) => this.monthLabel(m)),
      series: [
        { name: 'Budgeted', values: totals.map((t) => t.budgeted), color: CONTEXT },
        { name: 'Actual', values: totals.map((t) => t.actual), color: SERIES[0] },
      ] satisfies ChartSeries[],
      budgeted,
      actual,
      monthsOver: totals.filter((t) => t.actual > t.budgeted).length,
      monthCount: totals.length,
    };
  });

  // ------------------------------------------------------------ Goals

  protected readonly goalYear = signal<string | null>(null);
  protected readonly selectedGoalYear = computed(() => this.goalYear() ?? this.currentMonth().slice(0, 4));

  protected readonly goalChart = computed(() => {
    const year = this.selectedGoalYear();
    const months = this.data.months().filter((m) => m.startsWith(year));
    const contributions = this.data.goalContributions();
    const goals = this.data.goals();
    const byMonth = months.map((m) => contributions.filter((c) => c.date.startsWith(m)));
    const total = byMonth.flat().reduce((t, c) => t + c.amount, 0);
    return {
      labels: months.map((m) => monthShort.format(toDate(m))),
      titles: months.map((m) => this.monthLabel(m)),
      // Stacked by goal, so each month shows where the money went.
      series: goals
        .map((g, i) => ({
          name: g.name,
          values: byMonth.map((list) => {
            const sum = list.filter((c) => c.goalId === g.id).reduce((t, c) => t + c.amount, 0);
            return sum === 0 ? null : sum;
          }),
          color: `var(--goal-${i % 7})`,
          stack: 'goals',
        }))
        .filter((s) => s.values.some((v) => v !== null)) satisfies ChartSeries[],
      total,
    };
  });

  // ------------------------------------------------------ Investments

  protected readonly granularity = signal<Granularity>('month');

  protected readonly distribution = computed(() => {
    const accounts = [...this.data.investments()].sort((a, b) => b.balance - a.balance);
    const total = accounts.reduce((t, a) => t + a.balance, 0);
    const retirement = accounts.filter((a) => a.group === 'retirement').reduce((t, a) => t + a.balance, 0);
    return {
      total,
      retirementShare: total ? retirement / total : 0,
      items: accounts.map((a, i) => ({
        id: a.id,
        name: a.name,
        kind: a.typeLabel,
        balance: a.balance,
        share: total ? a.balance / total : 0,
        color: SERIES[i % SERIES.length],
      })),
    };
  });

  /**
   * Change in total invested value per period, split into money added and
   * market gain (change minus contributions).
   */
  private investmentPeriods(granularity: Granularity) {
    const history = this.data.investmentHistory();
    const months = this.data.months();
    // Null when no account has a balance for that month yet.
    const totalAt = (i: number) => {
      const known = history.map((h) => h.months[i].balance).filter((b): b is number => b !== null);
      return known.length ? known.reduce((t, b) => t + b, 0) : null;
    };
    const contribAt = (i: number) => history.reduce((t, h) => t + h.months[i].contribution, 0);
    const keyOf = (m: string) => {
      const [y, mo] = m.split('-').map(Number);
      if (granularity === 'year') return `${y}`;
      if (granularity === 'quarter') return `Q${Math.ceil(mo / 3)} ’${String(y).slice(2)}`;
      return m;
    };
    const periods: { key: string; first: number; last: number }[] = [];
    // Month 0 has no prior balance, so changes start from month 1.
    for (let i = 1; i < months.length; i++) {
      const key = keyOf(months[i]);
      const p = periods.at(-1);
      if (p && p.key === key) p.last = i;
      else periods.push({ key, first: i, last: i });
    }
    return periods.flatMap((p) => {
      const start = totalAt(p.first - 1);
      const end = totalAt(p.last);
      // Without a starting and ending balance there's no performance to show.
      if (start === null || end === null) return [];
      let contributions = 0;
      for (let i = p.first; i <= p.last; i++) contributions += contribAt(i);
      const gain = end - start - contributions;
      const partial = p.last === months.length - 1;
      return [{
        key: p.key,
        label:
          granularity === 'month'
            ? monthShort.format(toDate(p.key)) + (p.key.endsWith('-01') ? ` ’${p.key.slice(2, 4)}` : '')
            : p.key + (partial && granularity === 'year' ? ' YTD' : ''),
        title:
          (granularity === 'month' ? monthLong.format(toDate(p.key)) : p.key) + (partial ? ' (to date)' : ''),
        start,
        end,
        contributions,
        gain,
        /** Simple return on the starting balance plus half the money added mid-period. */
        returnPct: gain / (start + contributions / 2 || 1),
      }];
    });
  }

  protected readonly performance = computed(() => {
    const g = this.granularity();
    const all = this.investmentPeriods(g);
    const periods = g === 'month' ? all.slice(-12) : all;
    return {
      periods,
      labels: periods.map((p) => p.label),
      titles: periods.map((p) => p.title),
      changeSeries: [
        { name: 'Money added', values: periods.map((p) => p.contributions), color: CONTEXT, stack: 'chg' },
        { name: 'Market gain', values: periods.map((p) => p.gain), color: SERIES[0], negativeColor: NEGATIVE, stack: 'chg' },
      ] satisfies ChartSeries[],
      valueSeries: [{ name: 'Invested value', values: periods.map((p) => p.end), color: SERIES[0], type: 'line' }] satisfies ChartSeries[],
      gain: periods.reduce((t, p) => t + p.gain, 0),
      contributions: periods.reduce((t, p) => t + p.contributions, 0),
    };
  });
}
