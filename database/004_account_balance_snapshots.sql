/*
  Month-by-month balances, for investment performance on the dashboard.

  accounts.balance only holds today's value. Each balance/positions CSV (401(k),
  IRA, brokerage) or manual update also records a row here, so the app can show
  change in value per month/quarter/year and split it into money added
  (net_contributions) vs. market gain.

  net_worth_snapshots.breakdown is expected to hold {"owned": n, "owed": n}
  so the dashboard can chart owned vs. owed over time.
*/

USE JBRFinances;
GO

IF OBJECT_ID(N'dbo.account_balance_snapshots', N'U') IS NULL
CREATE TABLE dbo.account_balance_snapshots (
    id                UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_account_balance_snapshots_id DEFAULT NEWSEQUENTIALID(),
    account_id        UNIQUEIDENTIFIER NOT NULL,
    as_of_date        DATE             NOT NULL,
    balance           DECIMAL(19,4)    NOT NULL,
    -- Money added minus money withdrawn since the previous snapshot (NULL = unknown).
    net_contributions DECIMAL(19,4)    NULL,
    CONSTRAINT pk_account_balance_snapshots PRIMARY KEY (id),
    CONSTRAINT fk_account_balance_snapshots_account FOREIGN KEY (account_id) REFERENCES dbo.accounts (id),
    CONSTRAINT uq_account_balance_snapshots_account_date UNIQUE (account_id, as_of_date)
);
GO
