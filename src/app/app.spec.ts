import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { budgetStatus, FinanceDataService, goalStatus } from './core/finance-data.service';
import { niceTicks } from './shared/chart';
import { DataSource } from './core/data-source';
import { MockDataSource } from './core/mock-data-source';
import { BUDGETS } from './core/mock-data';

// Every test runs against the built-in sample data, pinned to Oct 19, 2026.
beforeEach(() => {
  TestBed.configureTestingModule({ providers: [{ provide: DataSource, useClass: MockDataSource }] });
});

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render every module in the top bar', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('.topnav a');
    expect(links.length).toBe(8);
  });
});

describe('budgetStatus', () => {
  it('maps the share of budget used to a status', () => {
    expect(budgetStatus(0.5)).toBe('on_track');
    expect(budgetStatus(0.85)).toBe('nearing');
    expect(budgetStatus(1)).toBe('nearing');
    expect(budgetStatus(1.01)).toBe('over');
  });
});

describe('FinanceDataService', () => {
  it('derives account import status from csv_imports', () => {
    const status = Object.fromEntries(
      TestBed.inject(FinanceDataService)
        .accounts()
        .map((a) => [a.id, a.status]),
    );
    expect(status['acc-chk']).toBe('synced');
    expect(status['acc-emg']).toBe('due');
    expect(status['acc-cc2']).toBe('failed');
    expect(status['acc-csh']).toBe('manual');
  });

  it('sums budget actuals from expense transactions', () => {
    const dining = TestBed.inject(FinanceDataService)
      .budgets()
      .find((b) => b.id === 'bud-dining');
    expect(dining?.actual).toBe(268.75);
    expect(dining?.status).toBe('over');
  });
});

describe('goalStatus', () => {
  it('compares saved with the expected-by-today amount', () => {
    expect(goalStatus(1200, 1000, 5000, false)).toBe('ahead');
    expect(goalStatus(950, 1000, 5000, false)).toBe('on_track');
    expect(goalStatus(800, 1000, 5000, false)).toBe('behind');
    expect(goalStatus(4000, 5000, 5000, true)).toBe('past_due');
    expect(goalStatus(5000, 5000, 5000, true)).toBe('reached');
  });
});

describe('FinanceDataService goals', () => {
  it('diverts surplus from an ahead goal to one that is behind', async () => {
    const data = TestBed.inject(FinanceDataService);
    const japan = () => data.goals().find((g) => g.id === 'goal-japan')!;
    const gifts = () => data.goals().find((g) => g.id === 'goal-gifts')!;
    expect(japan().status).toBe('ahead');
    expect(gifts().status).toBe('behind');

    expect(await data.divert('goal-japan', 'goal-gifts', 200)).toBe(true);
    expect(japan().saved).toBe(4000);
    expect(gifts().saved).toBe(720);
    expect(gifts().status).toBe('on_track');
  });

  it('refuses to divert more than the surplus', async () => {
    const data = TestBed.inject(FinanceDataService);
    expect(await data.divert('goal-japan', 'goal-car', 5000)).toBe(false);
    expect(await data.divert('goal-car', 'goal-gifts', 10)).toBe(false);
  });

  it('lists only the current period bills', () => {
    const bills = TestBed.inject(FinanceDataService).bills();
    expect(bills.length).toBe(10);
    expect(bills.filter((b) => b.status === 'pending').length).toBe(3);
  });
});

describe('FinanceDataService adding', () => {
  class NoSubscriptionsBudget extends MockDataSource {
    override readonly budgets = signal(BUDGETS.filter((b) => b.categoryId !== 'cat-subs'));
  }

  it('adds a budget for a category without one and removes it from the choices', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: DataSource, useClass: NoSubscriptionsBudget }] });
    const data = TestBed.inject(FinanceDataService);
    const open = () => data.unbudgetedCategories().flatMap((g) => g.categories.map((c) => c.id));
    // Groups and categories that already have a budget aren't offered.
    expect(open()).toEqual(['cat-subs']);
    expect(await data.addBudget('cat-subs', 70, '  ')).toBe(true);
    const row = data.budgets().find((b) => b.categoryName === 'Subscriptions')!;
    expect(row).toMatchObject({ amount: 70, originalAmount: 70, revision: 0 });
    expect(open()).toEqual([]);
    expect(await data.addBudget('cat-subs', 50, null)).toBe(false);
  });

  it('refuses a category that already has a budget', async () => {
    expect(await TestBed.inject(FinanceDataService).addBudget('cat-housing', 100, null)).toBe(false);
  });

  it('adds a goal and validates its dates', async () => {
    const data = TestBed.inject(FinanceDataService);
    const goal = { name: ' Boat ', targetAmount: 1200, startDate: '2026-10-19', targetDate: '2027-10-19' };
    expect(await data.addGoal({ ...goal, targetDate: '2026-10-01' })).toBe(false);
    expect(await data.addGoal({ ...goal, name: ' ' })).toBe(false);
    expect(await data.addGoal(goal)).toBe(true);
    expect(data.goals().find((g) => g.name === 'Boat')).toMatchObject({ saved: 0, targetAmount: 1200 });
  });
});

describe('FinanceDataService categories', () => {
  it('adds, renames and deletes an unused category', async () => {
    const data = TestBed.inject(FinanceDataService);
    const find = () => data.categories().find((c) => c.name.startsWith('Pets'));
    expect(await data.saveCategory({ name: ' Pets ', type: 'expense', parentId: 'grp-life' })).toBeNull();
    expect(find()).toMatchObject({ name: 'Pets', parentName: 'Lifestyle', usage: 0 });
    expect(await data.saveCategory({ ...find()!, name: 'Pets & vet' })).toBeNull();
    expect(find()!.name).toBe('Pets & vet');
    expect(await data.deleteCategory(find()!.id)).toBeNull();
    expect(find()).toBeUndefined();
  });

  it('keeps categories two levels deep and types consistent', () => {
    const data = TestBed.inject(FinanceDataService);
    expect(data.categoryProblem({ name: 'Rent', type: 'expense', parentId: 'cat-housing' })).toMatch(/one level/);
    expect(data.categoryProblem({ name: 'Tips', type: 'income', parentId: 'grp-ess' })).toMatch(/expense group/);
    expect(data.categoryProblem({ id: 'grp-ess', name: 'Essentials', type: 'expense', parentId: 'grp-life' })).toMatch(
      /can’t go inside/,
    );
    expect(data.categoryProblem({ name: 'groceries', type: 'expense', parentId: 'grp-ess' })).toMatch(/already/);
    expect(data.categoryProblem({ name: 'Groceries', type: 'expense', parentId: 'grp-life' })).toBeNull();
  });

  it('refuses to delete a group with categories or a category in use', async () => {
    const data = TestBed.inject(FinanceDataService);
    expect(await data.deleteCategory('grp-ess')).toMatch(/first/);
    expect(await data.deleteCategory('cat-groceries')).toMatch(/still used/);
    expect(data.categories().some((c) => c.id === 'cat-groceries')).toBe(true);
  });
});

describe('niceTicks', () => {
  it('produces round ticks covering the range', () => {
    expect(niceTicks(0, 243_167)).toEqual([0, 100_000, 200_000, 300_000]);
    expect(niceTicks(-2_900, 5_300)).toEqual([-5_000, -2_500, 0, 2_500, 5_000, 7_500]);
  });
});

describe('FinanceDataService history', () => {
  it('ends every investment history at the live balance', () => {
    const data = TestBed.inject(FinanceDataService);
    for (const { account, months } of data.investmentHistory()) {
      expect(months.at(-1)!.balance).toBeCloseTo(account.balance, 2);
      expect(months[0].balance).not.toBeNull();
    }
  });

  it('ends net worth history at the live balance sheet', () => {
    const data = TestBed.inject(FinanceDataService);
    const last = data.netWorthHistory().at(-1)!;
    expect(last.owned - last.owed).toBeCloseTo(data.balanceSheet().netWorth, 2);
  });

  it('uses live budgets for the current month', () => {
    const data = TestBed.inject(FinanceDataService);
    const october = data.budgetHistory().filter((b) => b.month === '2026-10');
    expect(october.find((b) => b.categoryId === 'cat-dining')?.actual).toBe(268.75);
  });

  it('marks which transactions came from a CSV import', () => {
    const rows = TestBed.inject(FinanceDataService).transactions();
    expect(rows.find((t) => t.accountId === 'acc-chk')?.source).toBe('chase_checking_2026-10.csv');
    expect(rows.find((t) => t.accountId === 'acc-csh')?.source).toBeNull();
  });
});

describe('FinanceDataService with no data', () => {
  class EmptySource extends MockDataSource {
    override readonly accounts = signal([]);
    override readonly budgetPeriods = signal([]);
    override readonly budgets = signal([]);
    override readonly budgetActuals = signal([]);
    override readonly goals = signal([]);
    override readonly billOccurrences = signal([]);
    override readonly netWorthSnapshots = signal([]);
    override readonly balanceSnapshots = signal([]);
    override readonly insurancePolicies = signal([]);
  }

  it('falls back to the calendar month and renders empty states without throwing', () => {
    TestBed.configureTestingModule({ providers: [{ provide: DataSource, useClass: EmptySource }] });
    const data = TestBed.inject(FinanceDataService);
    expect(data.currentPeriod()).toMatchObject({ id: '', startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(data.budgets()).toEqual([]);
    expect(data.balanceSheet().netWorth).toBe(0);
    expect(data.netWorthChange()).toBeNull();
    expect(data.investmentHistory()).toEqual([]);
  });

  it('creates the current period before its first budget', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: DataSource, useClass: EmptySource }] });
    const data = TestBed.inject(FinanceDataService);
    expect(await data.addBudget('cat-groceries', 400, null)).toBe(true);
    expect(data.currentPeriod().id).not.toBe('');
    expect(data.budgets().map((b) => b.categoryName)).toEqual(['Groceries']);
  });

  it('renders the dashboard with no data', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: DataSource, useClass: EmptySource }] });
    const { DashboardPage } = await import('./features/dashboard/dashboard-page');
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DashboardPage);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No goals yet.');
  });
});
