import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { DUE_SOON_DAYS, FinanceDataService, goalViews } from './core/finance-data.service';
import { SECTIONS } from './sections';
import { Icon, IconName } from './shared/icon';

interface SideView {
  label: string;
  icon: IconName;
  /** `view` query param; undefined = the unfiltered list. */
  view?: string;
  count?: number;
  tone?: 'warn' | 'crit';
}

interface SideMenu {
  eyebrow: string;
  title: string;
  blurb: string;
  newLabel: string;
  views: SideView[];
  manage: { label: string; icon: IconName }[];
  assist: { label: string; icon: IconName }[];
  footer?: { icon: IconName; title: string; text: string; progress: number };
}


@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  private readonly data = inject(FinanceDataService);

  protected readonly sections = SECTIONS;

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly section = computed(() => {
    const segment = this.url().split(/[/?#]/)[1] ?? '';
    return SECTIONS.find((s) => s.path === segment) ?? SECTIONS[0];
  });

  protected readonly activeView = computed(
    () => new URLSearchParams(this.url().split('?')[1] ?? '').get('view') ?? undefined,
  );

  protected readonly menu = computed<SideMenu>(() => {
    switch (this.section().path) {
      case 'accounts':
        return this.accountsMenu();
      case 'budgets':
        return this.budgetsMenu();
      case 'goals':
        return this.goalsMenu();
      case 'bills':
        return this.billsMenu();
      default:
        return {
          eyebrow: this.section().label,
          title: this.section().label,
          blurb: 'This module is not built yet.',
          newLabel: 'New',
          views: [],
          manage: [],
          assist: [],
        };
    }
  });

  private accountsMenu(): SideMenu {
    const rows = this.data.accounts();
    const ofType = (...types: string[]) => rows.filter((r) => types.includes(r.type)).length;
    const importable = rows.filter((r) => r.status !== 'manual');
    const synced = importable.filter((r) => r.status === 'synced').length;
    const needsImport = importable.length - synced;
    return {
      eyebrow: 'Accounts',
      title: 'Balances & sync',
      blurb: 'Every balance here feeds net worth, budgets and goals.',
      newLabel: 'New account',
      views: [
        { label: 'All accounts', icon: 'inbox', count: rows.length },
        { label: 'Bank', icon: 'bank', view: 'bank', count: ofType('checking', 'savings') },
        { label: 'Credit cards', icon: 'card', view: 'credit', count: ofType('credit_card') },
        { label: 'Investments', icon: 'chart', view: 'investment', count: ofType('investment') },
        { label: 'Cash', icon: 'cash', view: 'cash', count: ofType('cash') },
      ],
      manage: [
        { label: 'Import CSV', icon: 'upload' },
        { label: 'Reconcile balances', icon: 'refresh' },
        { label: 'Export statement', icon: 'download' },
      ],
      assist: [{ label: 'Take net worth snapshot', icon: 'trending' }],
      footer: {
        icon: 'upload',
        title: 'Imports',
        text: needsImport
          ? `${needsImport} of ${importable.length} accounts need a fresh CSV import.`
          : 'All imported accounts are up to date.',
        progress: importable.length ? synced / importable.length : 1,
      },
    };
  }

  private budgetsMenu(): SideMenu {
    const rows = this.data.budgets();
    const period = this.data.currentPeriod();
    const { day, of } = this.data.periodDay();
    const bills = this.data.pendingBills();
    return {
      eyebrow: period.label,
      title: 'Plan vs. actual',
      blurb: 'Targets can be adjusted mid-month; actuals always come from transactions.',
      newLabel: 'New budget',
      views: [
        { label: 'All categories', icon: 'inbox', count: rows.length },
        ...this.data.budgetGroups().map<SideView>((g) => ({
          label: g.name,
          icon: 'layers',
          view: g.id,
          count: rows.filter((r) => r.groupId === g.id).length,
        })),
        {
          label: 'Over budget',
          icon: 'alert',
          view: 'over',
          count: rows.filter((r) => r.status === 'over').length,
          tone: 'crit',
        },
      ],
      manage: [
        { label: 'Adjust a budget', icon: 'sliders' },
        { label: 'Copy last month', icon: 'copy' },
        { label: 'Close period', icon: 'lock' },
      ],
      assist: [{ label: 'Adjustment log', icon: 'history' }],
      footer: {
        icon: 'calendar',
        title: 'Period close',
        text: `${period.label} closes in ${of - day} days. ${bills} bill${bills === 1 ? '' : 's'} still pending.`,
        progress: this.data.periodProgress(),
      },
    };
  }

  private goalsMenu(): SideMenu {
    const rows = this.data.goals();
    const views = goalViews(this.data.asOf());
    const count = (key: string) => rows.filter(views[key].match).length;
    const steady = rows.filter((g) => ['ahead', 'on_track', 'reached'].includes(g.status)).length;
    const ahead = rows.filter((g) => g.status === 'ahead');
    return {
      eyebrow: 'Goals',
      title: 'Saving on schedule',
      blurb: 'Each goal is measured against a steady pace from its start date to its due date.',
      newLabel: 'New goal',
      views: [
        { label: 'All goals', icon: 'inbox', count: rows.length },
        { label: 'Due this year', icon: 'calendar', view: 'this-year', count: count('this-year') },
        { label: 'Long-term', icon: 'trending', view: 'long-term', count: count('long-term') },
        { label: 'Can divert funds', icon: 'transactions', view: 'divertible', count: count('divertible') },
      ],
      manage: [
        { label: 'Add contribution', icon: 'plus' },
        { label: 'Divert funds', icon: 'transactions' },
      ],
      assist: [{ label: 'Contribution history', icon: 'history' }],
      footer: {
        icon: 'goal',
        title: 'Schedule',
        text:
          `${steady} of ${rows.length} goals are on schedule.` +
          (ahead.length ? ` ${ahead.map((g) => g.name).join(', ')} can spare funds.` : ''),
        progress: rows.length ? steady / rows.length : 1,
      },
    };
  }

  private billsMenu(): SideMenu {
    const rows = this.data.bills();
    const paid = rows.filter((b) => b.status === 'paid').length;
    const dueSoon = rows.filter((b) => {
      const d = this.data.daysUntil(b.expectedDate);
      return b.status === 'pending' && d >= 0 && d <= DUE_SOON_DAYS;
    }).length;
    return {
      eyebrow: this.data.currentPeriod().label,
      title: 'Bills this period',
      blurb: 'Expected recurring payments, matched to transactions as they clear.',
      newLabel: 'New recurring payment',
      views: [
        { label: 'All bills', icon: 'inbox', count: rows.length },
        { label: 'Due this week', icon: 'calendar', view: 'due-soon', count: dueSoon, tone: 'warn' },
      ],
      manage: [
        { label: 'Match a payment', icon: 'refresh' },
        { label: 'Defer a bill', icon: 'history' },
      ],
      assist: [{ label: 'Recurring payments', icon: 'bill' }],
      footer: {
        icon: 'check-circle',
        title: 'Paid so far',
        text: `${paid} of ${rows.length} bills paid for ${this.data.currentPeriod().label}.`,
        progress: rows.length ? paid / rows.length : 1,
      },
    };
  }
}
