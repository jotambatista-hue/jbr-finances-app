import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { budgetStatus, FinanceDataService } from './core/finance-data.service';

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
    expect(links.length).toBe(9);
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
