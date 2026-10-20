import { IconName } from './shared/icon';

export interface Section {
  path: string;
  label: string;
  icon: IconName;
  /** Shown as two stacked words in the top bar instead of `label`. */
  stacked?: [string, string];
  /** Has its own page and sidebar but no top-bar link (reached from another module). */
  hidden?: boolean;
}

/** Top-level modules, in top-bar order. */
export const SECTIONS: Section[] = [
  { path: 'dashboard', label: 'Dashboard', icon: 'dashboard' },
  { path: 'accounts', label: 'Accounts', icon: 'wallet' },
  { path: 'transactions', label: 'Transactions', icon: 'transactions' },
  { path: 'budgets', label: 'Budgets', icon: 'budget' },
  { path: 'goals', label: 'Goals', icon: 'goal' },
  { path: 'bills', label: 'Bills', icon: 'bill' },
  {
    path: 'investments',
    label: 'Investments & Insurance',
    icon: 'chart',
    stacked: ['Investments', 'Insurance'],
  },
  { path: 'net-worth', label: 'Net worth', icon: 'trending' },
  { path: 'categories', label: 'Categories', icon: 'layers', hidden: true },
];
