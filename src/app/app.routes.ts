import { Routes } from '@angular/router';

const page = (title: string) => `${title} · JBR Finances`;

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: page('Dashboard'),
    loadComponent: () => import('./features/dashboard/dashboard-page').then((m) => m.DashboardPage),
  },
  {
    path: 'accounts',
    title: page('Accounts'),
    loadComponent: () => import('./features/accounts/accounts-page').then((m) => m.AccountsPage),
  },
  {
    path: 'transactions',
    title: page('Transactions'),
    loadComponent: () =>
      import('./features/transactions/transactions-page').then((m) => m.TransactionsPage),
  },
  // CSV imports live inside Transactions now.
  { path: 'imports', redirectTo: () => '/transactions?view=imports' },
  {
    path: 'budgets',
    title: page('Budgets'),
    loadComponent: () => import('./features/budgets/budgets-page').then((m) => m.BudgetsPage),
  },
  {
    path: 'goals',
    title: page('Goals'),
    loadComponent: () => import('./features/goals/goals-page').then((m) => m.GoalsPage),
  },
  {
    path: 'bills',
    title: page('Bills'),
    loadComponent: () => import('./features/bills/bills-page').then((m) => m.BillsPage),
  },
  {
    path: 'investments',
    title: page('Investments & Insurance'),
    loadComponent: () =>
      import('./features/investments/investments-page').then((m) => m.InvestmentsPage),
  },
  { path: 'insurance', redirectTo: 'investments' },
  {
    path: 'net-worth',
    title: page('Net worth'),
    loadComponent: () => import('./features/net-worth/net-worth-page').then((m) => m.NetWorthPage),
  },
  { path: '**', redirectTo: 'dashboard' },
];
