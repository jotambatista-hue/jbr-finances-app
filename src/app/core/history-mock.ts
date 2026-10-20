/**
 * Stand-in for the aggregate queries the dashboard will run against SQL Server
 * (month-end balances, budget vs. actual per month, ...). Generated
 * deterministically so it lines up with today's live mock balances: the last
 * month of every series equals the current value.
 */

/** Month keys ('YYYY-MM') from January 2025 through the current month. */
export function monthKeys(asOf: string, from = '2025-01'): string[] {
  const keys: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ey, em] = asOf.slice(0, 7).split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    keys.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return keys;
}

/** Small deterministic PRNG so the generated history never changes between loads. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** Broad-market monthly returns, Jan 2025 onward. */
const MARKET_RETURNS = [
  0.021, -0.014, 0.012, -0.031, 0.024, 0.018, 0.011, -0.006, 0.019, 0.008, 0.027, -0.009,
  0.015, 0.006, -0.022, 0.017, 0.013, 0.021, -0.011, 0.009, 0.014, 0.007,
];

/** Per-account assumptions: monthly contribution and sensitivity to the market. */
const INVESTMENT_PROFILE: Record<string, { contribution: number; beta: number }> = {
  'acc-401k': { contribution: 950, beta: 1.0 },
  'acc-ira': { contribution: 580, beta: 1.1 },
  'acc-brk': { contribution: 400, beta: 1.0 },
  'acc-rh': { contribution: 0, beta: 1.6 },
  'acc-rollover': { contribution: 0, beta: 0.8 },
};

export interface InvestmentMonth {
  month: string;
  /** Month-end balance. */
  balance: number;
  /** Money added during the month. */
  contribution: number;
}

/** Month-end balances for one investment account, ending at its current balance. */
export function investmentHistory(accountId: string, currentBalance: number, months: string[]): InvestmentMonth[] {
  const profile = INVESTMENT_PROFILE[accountId] ?? { contribution: 0, beta: 1 };
  const balances = new Array<number>(months.length);
  balances[months.length - 1] = currentBalance;
  for (let i = months.length - 1; i > 0; i--) {
    const r = MARKET_RETURNS[i % MARKET_RETURNS.length] * profile.beta;
    balances[i - 1] = (balances[i] - profile.contribution) / (1 + r);
  }
  return months.map((month, i) => ({
    month,
    balance: Math.round(balances[i] * 100) / 100,
    contribution: i === 0 ? 0 : profile.contribution,
  }));
}

export interface NetWorthMonth {
  month: string;
  owned: number;
  owed: number;
}

/**
 * Owned/owed per month. Investments come from their own history; the rest
 * drifts back from today's values (cash saved up, loans paid down, car depreciating).
 */
export function netWorthHistory(
  months: string[],
  current: { cash: number; insurance: number; property: number; cards: number; loans: number },
  investmentsByMonth: number[],
): NetWorthMonth[] {
  const rand = prng(7);
  const last = months.length - 1;
  return months.map((month, i) => {
    const back = last - i;
    const wobble = back === 0 ? 0 : (rand() - 0.5) * 1600;
    const cash = current.cash - back * 420 + wobble;
    const insurance = current.insurance - back * 215;
    const property = current.property + back * 260;
    const cards = back === 0 ? current.cards : 900 + rand() * 1900;
    const loans = current.loans + back * 690;
    return {
      month,
      owned: Math.round((cash + insurance + property + investmentsByMonth[i]) * 100) / 100,
      owed: Math.round((cards + loans) * 100) / 100,
    };
  });
}

export interface BudgetMonth {
  month: string;
  categoryId: string;
  budgeted: number;
  actual: number;
}

/** Budget vs. actual per category for every month before the current one. */
export function budgetHistory(
  months: string[],
  plan: { categoryId: string; amount: number }[],
): BudgetMonth[] {
  const rand = prng(42);
  const fixed = new Set(['cat-housing', 'cat-internet', 'cat-subs']);
  const out: BudgetMonth[] = [];
  for (const month of months) {
    const scale = month < '2026-01' ? 0.95 : 1;
    for (const { categoryId, amount } of plan) {
      const budgeted = Math.round((amount * scale) / 5) * 5;
      const factor = fixed.has(categoryId) ? 0.97 + rand() * 0.04 : 0.72 + rand() * 0.46;
      out.push({ month, categoryId, budgeted, actual: Math.round(budgeted * factor * 100) / 100 });
    }
  }
  return out;
}
