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
  protected readonly status = this.data.status;

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
      case 'dashboard':
        return this.dashboardMenu();
      case 'accounts':
        return this.accountsMenu();
      case 'transactions':
        return this.transactionsMenu();
      case 'budgets':
        return this.budgetsMenu();
      case 'goals':
        return this.goalsMenu();
      case 'bills':
        return this.billsMenu();
      case 'investments':
        return this.investmentsMenu();
      case 'net-worth':
        return this.netWorthMenu();
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
        { label: 'Loans', icon: 'bill', view: 'loans', count: ofType('loan') },
        { label: 'Property & vehicles', icon: 'layers', view: 'property', count: ofType('property') },
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

  private investmentsMenu(): SideMenu {
    const inv = this.data.investments();
    const policies = this.data.permanentPolicies();
    const retirement = inv.filter((a) => a.group === 'retirement');
    const total = inv.reduce((t, a) => t + a.balance, 0);
    const retirementTotal = retirement.reduce((t, a) => t + a.balance, 0);
    return {
      eyebrow: 'Wealth',
      title: 'Investments & Insurance',
      blurb: 'Long-term holdings and the cash value of permanent life policies.',
      newLabel: 'Add holding',
      views: [
        { label: 'Everything', icon: 'inbox', count: inv.length + policies.length },
        { label: 'Retirement', icon: 'calendar', view: 'retirement', count: retirement.length },
        { label: 'Personal investments', icon: 'trending', view: 'personal', count: inv.length - retirement.length },
        { label: 'Life insurance', icon: 'shield', view: 'insurance', count: policies.length },
      ],
      manage: [
        { label: 'Update balances', icon: 'upload' },
        { label: 'Record policy value', icon: 'shield' },
      ],
      assist: [{ label: 'Allocation overview', icon: 'budget' }],
      footer: {
        icon: 'chart',
        title: 'Retirement share',
        text: `${Math.round((retirementTotal / (total || 1)) * 100)}% of invested money is in retirement accounts.`,
        progress: total ? retirementTotal / total : 0,
      },
    };
  }

  private netWorthMenu(): SideMenu {
    const s = this.data.balanceSheet();
    const ratio = s.totalOwned ? s.totalOwed / s.totalOwned : 0;
    return {
      eyebrow: 'Wealth',
      title: 'Net worth report',
      blurb: 'Built live from every account balance and policy cash value.',
      newLabel: 'Take snapshot',
      views: [
        { label: 'Full report', icon: 'inbox' },
        { label: 'What I own', icon: 'wallet', view: 'owned', count: s.owned.reduce((t, g) => t + g.lines.length, 0) },
        { label: 'What I owe', icon: 'card', view: 'owed', count: s.owed.reduce((t, g) => t + g.lines.length, 0) },
      ],
      manage: [
        { label: 'Snapshot history', icon: 'history' },
        { label: 'Export report', icon: 'download' },
      ],
      assist: [],
      footer: {
        icon: 'trending',
        title: 'Debt-to-asset',
        text: `You owe ${Math.round(ratio * 1000) / 10}% of what you own.`,
        progress: 1 - ratio,
      },
    };
  }

  private dashboardMenu(): SideMenu {
    const period = this.data.currentPeriod();
    const { day, of } = this.data.periodDay();
    const bills = this.data.pendingBills();
    return {
      eyebrow: 'Overview',
      title: 'Your finances',
      blurb: 'Every chart is built from the same accounts, budgets and goals as the other pages.',
      newLabel: 'Add transaction',
      views: [],
      manage: [
        { label: 'Take net worth snapshot', icon: 'history' },
        { label: 'Import CSV', icon: 'upload' },
      ],
      assist: [],
      footer: {
        icon: 'calendar',
        title: 'Period close',
        text: `${period.label} closes in ${of - day} days. ${bills} bill${bills === 1 ? '' : 's'} still pending.`,
        progress: this.data.periodProgress(),
      },
    };
  }

  private transactionsMenu(): SideMenu {
    const rows = this.data.transactions();
    const imports = this.data.csvImports();
    const failed = imports.filter((i) => i.status === 'failed').length;
    const imported = rows.filter((t) => t.source).length;
    return {
      eyebrow: 'Money',
      title: 'Transactions & imports',
      blurb: 'CSV imports land here as transactions; filter by account to see one at a time.',
      newLabel: 'Add transaction',
      views: [
        { label: 'All transactions', icon: 'inbox', count: rows.length },
        { label: 'Imported', icon: 'upload', view: 'imported', count: imported },
        { label: 'Entered by hand', icon: 'plus', view: 'manual', count: rows.length - imported },
        {
          label: 'Import history',
          icon: 'history',
          view: 'imports',
          count: imports.length,
          tone: failed ? 'crit' : undefined,
        },
      ],
      manage: [
        { label: 'Import CSV', icon: 'upload' },
        { label: 'Categorize', icon: 'layers' },
      ],
      assist: [{ label: 'Import formats', icon: 'sliders' }],
      footer: failed
        ? {
            icon: 'alert',
            title: 'Imports',
            text: `${failed} import${failed === 1 ? '' : 's'} failed. Check Import history.`,
            progress: (imports.length - failed) / imports.length,
          }
        : undefined,
    };
  }
}
