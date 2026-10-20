import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { budgetStatus, FinanceDataService, goalStatus } from './core/finance-data.service';
import { niceTicks } from './shared/chart';

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
  it('diverts surplus from an ahead goal to one that is behind', () => {
    const data = TestBed.inject(FinanceDataService);
    const japan = () => data.goals().find((g) => g.id === 'goal-japan')!;
    const gifts = () => data.goals().find((g) => g.id === 'goal-gifts')!;
    expect(japan().status).toBe('ahead');
    expect(gifts().status).toBe('behind');

    expect(data.divert('goal-japan', 'goal-gifts', 200)).toBe(true);
    expect(japan().saved).toBe(4000);
    expect(gifts().saved).toBe(720);
    expect(gifts().status).toBe('on_track');
  });

  it('refuses to divert more than the surplus', () => {
    const data = TestBed.inject(FinanceDataService);
    expect(data.divert('goal-japan', 'goal-car', 5000)).toBe(false);
    expect(data.divert('goal-car', 'goal-gifts', 10)).toBe(false);
  });

  it('lists only the current period bills', () => {
    const bills = TestBed.inject(FinanceDataService).bills();
    expect(bills.length).toBe(10);
    expect(bills.filter((b) => b.status === 'pending').length).toBe(3);
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
