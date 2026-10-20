import { Routes } from '@angular/router';
import { SECTIONS } from './sections';

const BUILT = ['accounts', 'budgets'];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'accounts' },
  {
    path: 'accounts',
    title: 'Accounts · JBR Finances',
    loadComponent: () => import('./features/accounts/accounts-page').then((m) => m.AccountsPage),
  },
  {
    path: 'budgets',
    title: 'Budgets · JBR Finances',
    loadComponent: () => import('./features/budgets/budgets-page').then((m) => m.BudgetsPage),
  },
  ...SECTIONS.filter((s) => !BUILT.includes(s.path)).map((s) => ({
    path: s.path,
    title: `${s.label} · JBR Finances`,
    data: { label: s.label },
    loadComponent: () => import('./features/coming-soon').then((m) => m.ComingSoon),
  })),
  { path: '**', redirectTo: 'accounts' },
];
