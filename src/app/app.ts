import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { FinanceDataService } from './core/finance-data.service';
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
}
