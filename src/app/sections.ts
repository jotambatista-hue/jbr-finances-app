import { IconName } from './shared/icon';

export interface Section {
  path: string;
  label: string;
  icon: IconName;
}

/** Top-level modules, in top-bar order. */
export const SECTIONS: Section[] = [
  { path: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: 'accounts', label: 'Accounts', icon: 'wallet' },
  { path: 'transactions', label: 'Transactions', icon: 'transactions' },
  { path: 'budgets', label: 'Budgets', icon: 'budget' },
  { path: 'goals', label: 'Goals', icon: 'goal' },
  { path: 'bills', label: 'Bills', icon: 'bill' },
  { path: 'insurance', label: 'Insurance', icon: 'shield' },
  { path: 'net-worth', label: 'Net worth', icon: 'trending' },
  { path: 'imports', label: 'Imports', icon: 'upload' },
];
