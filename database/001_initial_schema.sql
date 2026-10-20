/*
  JBRFinances - initial schema (from the preliminary ERD)

  Layers:
    Core        accounts, categories, transactions
    Planning    budget_periods, budgets, budget_adjustments, goals,
                goal_contributions, income_expectations
    Commitments recurring_payments, bill_occurrences, insurance_policies
    Reporting   csv_imports, net_worth_snapshots, dashboard_layouts

  Type mapping: uuid -> UNIQUEIDENTIFIER, numeric -> DECIMAL(19,4),
  string -> NVARCHAR, json -> NVARCHAR(MAX) + ISJSON check,
  enum -> NVARCHAR + CHECK, timestamp -> DATETIME2(3) (UTC).

  Re-runnable: creates the database and each table only if missing.
  All FKs are NO ACTION (SQL Server rejects multiple cascade paths).
*/

IF DB_ID(N'JBRFinances') IS NULL
    CREATE DATABASE JBRFinances;
GO

USE JBRFinances;
GO

/* ---------------------------------------------------------------- Core */

IF OBJECT_ID(N'dbo.accounts', N'U') IS NULL
CREATE TABLE dbo.accounts (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_accounts_id DEFAULT NEWSEQUENTIALID(),
    name        NVARCHAR(100)    NOT NULL,
    type        NVARCHAR(20)     NOT NULL,
    institution NVARCHAR(100)    NULL,
    balance     DECIMAL(19,4)    NOT NULL CONSTRAINT df_accounts_balance DEFAULT 0,
    currency    CHAR(3)          NOT NULL CONSTRAINT df_accounts_currency DEFAULT 'USD',
    CONSTRAINT pk_accounts PRIMARY KEY (id),
    CONSTRAINT ck_accounts_type CHECK (type IN ('checking', 'savings', 'credit_card', 'investment', 'cash'))
);
GO

IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
CREATE TABLE dbo.categories (
    id        UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_categories_id DEFAULT NEWSEQUENTIALID(),
    parent_id UNIQUEIDENTIFIER NULL,
    name      NVARCHAR(100)    NOT NULL,
    type      NVARCHAR(10)     NOT NULL,
    CONSTRAINT pk_categories PRIMARY KEY (id),
    CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES dbo.categories (id),
    CONSTRAINT ck_categories_type CHECK (type IN ('income', 'expense')),
    CONSTRAINT ck_categories_not_own_parent CHECK (parent_id IS NULL OR parent_id <> id)
);
GO

/* ------------------------------------------------- Planning: periods */

IF OBJECT_ID(N'dbo.budget_periods', N'U') IS NULL
CREATE TABLE dbo.budget_periods (
    id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_budget_periods_id DEFAULT NEWSEQUENTIALID(),
    label      NVARCHAR(50)     NOT NULL,
    start_date DATE             NOT NULL,
    end_date   DATE             NOT NULL,
    type       NVARCHAR(10)     NOT NULL,
    CONSTRAINT pk_budget_periods PRIMARY KEY (id),
    CONSTRAINT ck_budget_periods_type CHECK (type IN ('monthly', 'quarterly', 'yearly')),
    CONSTRAINT ck_budget_periods_dates CHECK (end_date >= start_date),
    CONSTRAINT uq_budget_periods_type_start UNIQUE (type, start_date)
);
GO

/* ---------------------------------------------------- Import (CSV) */

IF OBJECT_ID(N'dbo.csv_imports', N'U') IS NULL
CREATE TABLE dbo.csv_imports (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_csv_imports_id DEFAULT NEWSEQUENTIALID(),
    account_id  UNIQUEIDENTIFIER NOT NULL,
    filename    NVARCHAR(260)    NOT NULL,
    imported_at DATETIME2(3)     NOT NULL CONSTRAINT df_csv_imports_imported_at DEFAULT SYSUTCDATETIME(),
    row_count   INT              NOT NULL CONSTRAINT df_csv_imports_row_count DEFAULT 0,
    status      NVARCHAR(10)     NOT NULL CONSTRAINT df_csv_imports_status DEFAULT 'pending',
    CONSTRAINT pk_csv_imports PRIMARY KEY (id),
    CONSTRAINT fk_csv_imports_account FOREIGN KEY (account_id) REFERENCES dbo.accounts (id),
    CONSTRAINT ck_csv_imports_status CHECK (status IN ('pending', 'completed', 'failed')),
    CONSTRAINT ck_csv_imports_row_count CHECK (row_count >= 0)
);
GO

/* --------------------------------------------------- Core: ledger */

IF OBJECT_ID(N'dbo.transactions', N'U') IS NULL
CREATE TABLE dbo.transactions (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_transactions_id DEFAULT NEWSEQUENTIALID(),
    account_id    UNIQUEIDENTIFIER NOT NULL,
    csv_import_id UNIQUEIDENTIFIER NULL,
    date          DATE             NOT NULL,
    amount        DECIMAL(19,4)    NOT NULL,
    description   NVARCHAR(500)    NULL,
    type          NVARCHAR(10)     NOT NULL,
    category_id   UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT pk_transactions PRIMARY KEY (id),
    CONSTRAINT fk_transactions_account FOREIGN KEY (account_id) REFERENCES dbo.accounts (id),
    CONSTRAINT fk_transactions_csv_import FOREIGN KEY (csv_import_id) REFERENCES dbo.csv_imports (id),
    CONSTRAINT fk_transactions_category FOREIGN KEY (category_id) REFERENCES dbo.categories (id),
    CONSTRAINT ck_transactions_type CHECK (type IN ('income', 'expense', 'transfer'))
);
GO

/* ------------------------------------------------------ Commitments */

IF OBJECT_ID(N'dbo.recurring_payments', N'U') IS NULL
CREATE TABLE dbo.recurring_payments (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_recurring_payments_id DEFAULT NEWSEQUENTIALID(),
    name          NVARCHAR(100)    NOT NULL,
    amount        DECIMAL(19,4)    NOT NULL,
    frequency     NVARCHAR(10)     NOT NULL,
    next_due_date DATE             NOT NULL,
    status        NVARCHAR(10)     NOT NULL CONSTRAINT df_recurring_payments_status DEFAULT 'active',
    account_id    UNIQUEIDENTIFIER NOT NULL,
    category_id   UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT pk_recurring_payments PRIMARY KEY (id),
    CONSTRAINT fk_recurring_payments_account FOREIGN KEY (account_id) REFERENCES dbo.accounts (id),
    CONSTRAINT fk_recurring_payments_category FOREIGN KEY (category_id) REFERENCES dbo.categories (id),
    CONSTRAINT ck_recurring_payments_frequency CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
    CONSTRAINT ck_recurring_payments_status CHECK (status IN ('active', 'paused', 'cancelled'))
);
GO

IF OBJECT_ID(N'dbo.insurance_policies', N'U') IS NULL
CREATE TABLE dbo.insurance_policies (
    id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_insurance_policies_id DEFAULT NEWSEQUENTIALID(),
    name                 NVARCHAR(100)    NOT NULL,
    provider             NVARCHAR(100)    NOT NULL,
    type                 NVARCHAR(10)     NOT NULL,
    premium              DECIMAL(19,4)    NOT NULL,
    frequency            NVARCHAR(20)     NOT NULL,
    effective_date       DATE             NOT NULL,
    expiration_date      DATE             NULL,
    recurring_payment_id UNIQUEIDENTIFIER NULL,
    CONSTRAINT pk_insurance_policies PRIMARY KEY (id),
    CONSTRAINT fk_insurance_policies_recurring_payment FOREIGN KEY (recurring_payment_id) REFERENCES dbo.recurring_payments (id),
    CONSTRAINT ck_insurance_policies_type CHECK (type IN ('auto', 'home', 'life', 'health')),
    CONSTRAINT ck_insurance_policies_dates CHECK (expiration_date IS NULL OR expiration_date >= effective_date)
);
GO

IF OBJECT_ID(N'dbo.bill_occurrences', N'U') IS NULL
CREATE TABLE dbo.bill_occurrences (
    id                   UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_bill_occurrences_id DEFAULT NEWSEQUENTIALID(),
    recurring_payment_id UNIQUEIDENTIFIER NOT NULL,
    transaction_id       UNIQUEIDENTIFIER NULL,
    expected_amount      DECIMAL(19,4)    NOT NULL,
    expected_date        DATE             NOT NULL,
    status               NVARCHAR(10)     NOT NULL CONSTRAINT df_bill_occurrences_status DEFAULT 'pending',
    resolved_at          DATETIME2(3)     NULL,
    period_id            UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT pk_bill_occurrences PRIMARY KEY (id),
    CONSTRAINT fk_bill_occurrences_recurring_payment FOREIGN KEY (recurring_payment_id) REFERENCES dbo.recurring_payments (id),
    CONSTRAINT fk_bill_occurrences_transaction FOREIGN KEY (transaction_id) REFERENCES dbo.transactions (id),
    CONSTRAINT fk_bill_occurrences_period FOREIGN KEY (period_id) REFERENCES dbo.budget_periods (id),
    CONSTRAINT ck_bill_occurrences_status CHECK (status IN ('pending', 'paid', 'missed', 'deferred'))
);
GO

/* --------------------------------------------------------- Planning */

IF OBJECT_ID(N'dbo.income_expectations', N'U') IS NULL
CREATE TABLE dbo.income_expectations (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_income_expectations_id DEFAULT NEWSEQUENTIALID(),
    transaction_id  UNIQUEIDENTIFIER NULL,
    source          NVARCHAR(10)     NOT NULL,
    expected_amount DECIMAL(19,4)    NOT NULL,
    actual_amount   DECIMAL(19,4)    NULL,
    status          NVARCHAR(10)     NOT NULL CONSTRAINT df_income_expectations_status DEFAULT 'expected',
    note            NVARCHAR(MAX)    NULL,
    period_id       UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT pk_income_expectations PRIMARY KEY (id),
    CONSTRAINT fk_income_expectations_transaction FOREIGN KEY (transaction_id) REFERENCES dbo.transactions (id),
    CONSTRAINT fk_income_expectations_period FOREIGN KEY (period_id) REFERENCES dbo.budget_periods (id),
    CONSTRAINT ck_income_expectations_source CHECK (source IN ('salary', 'bonus', 'freelance', 'other')),
    CONSTRAINT ck_income_expectations_status CHECK (status IN ('expected', 'received', 'missed', 'adjusted'))
);
GO

IF OBJECT_ID(N'dbo.goals', N'U') IS NULL
CREATE TABLE dbo.goals (
    id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_goals_id DEFAULT NEWSEQUENTIALID(),
    category_id   UNIQUEIDENTIFIER NULL,
    name          NVARCHAR(100)    NOT NULL,
    target_amount DECIMAL(19,4)    NOT NULL,
    target_date   DATE             NULL,
    period_id     UNIQUEIDENTIFIER NULL,
    CONSTRAINT pk_goals PRIMARY KEY (id),
    CONSTRAINT fk_goals_category FOREIGN KEY (category_id) REFERENCES dbo.categories (id),
    CONSTRAINT fk_goals_period FOREIGN KEY (period_id) REFERENCES dbo.budget_periods (id),
    CONSTRAINT ck_goals_target_amount CHECK (target_amount > 0)
);
GO

IF OBJECT_ID(N'dbo.goal_contributions', N'U') IS NULL
CREATE TABLE dbo.goal_contributions (
    id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_goal_contributions_id DEFAULT NEWSEQUENTIALID(),
    amount     DECIMAL(19,4)    NOT NULL,
    date       DATE             NOT NULL,
    account_id UNIQUEIDENTIFIER NOT NULL,
    goal_id    UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT pk_goal_contributions PRIMARY KEY (id),
    CONSTRAINT fk_goal_contributions_account FOREIGN KEY (account_id) REFERENCES dbo.accounts (id),
    CONSTRAINT fk_goal_contributions_goal FOREIGN KEY (goal_id) REFERENCES dbo.goals (id)
);
GO

IF OBJECT_ID(N'dbo.budgets', N'U') IS NULL
CREATE TABLE dbo.budgets (
    id              UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_budgets_id DEFAULT NEWSEQUENTIALID(),
    category_id     UNIQUEIDENTIFIER NOT NULL,
    period_id       UNIQUEIDENTIFIER NOT NULL,
    amount          DECIMAL(19,4)    NOT NULL,  -- current (adjusted) target
    original_amount DECIMAL(19,4)    NOT NULL,  -- as first planned
    revision        INT              NOT NULL CONSTRAINT df_budgets_revision DEFAULT 0,
    notes           NVARCHAR(MAX)    NULL,
    updated_at      DATETIME2(3)     NOT NULL CONSTRAINT df_budgets_updated_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_budgets PRIMARY KEY (id),
    CONSTRAINT fk_budgets_category FOREIGN KEY (category_id) REFERENCES dbo.categories (id),
    CONSTRAINT fk_budgets_period FOREIGN KEY (period_id) REFERENCES dbo.budget_periods (id),
    CONSTRAINT uq_budgets_period_category UNIQUE (period_id, category_id)
);
GO

-- Append-only audit log of changes to budgets.amount
IF OBJECT_ID(N'dbo.budget_adjustments', N'U') IS NULL
CREATE TABLE dbo.budget_adjustments (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_budget_adjustments_id DEFAULT NEWSEQUENTIALID(),
    category_id UNIQUEIDENTIFIER NOT NULL,
    period_id   UNIQUEIDENTIFIER NOT NULL,
    budget_id   UNIQUEIDENTIFIER NOT NULL,
    old_amount  DECIMAL(19,4)    NOT NULL,
    new_amount  DECIMAL(19,4)    NOT NULL,
    delta       AS (new_amount - old_amount) PERSISTED,
    reason      NVARCHAR(20)     NOT NULL,
    note        NVARCHAR(MAX)    NULL,
    created_at  DATETIME2(3)     NOT NULL CONSTRAINT df_budget_adjustments_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT pk_budget_adjustments PRIMARY KEY (id),
    CONSTRAINT fk_budget_adjustments_category FOREIGN KEY (category_id) REFERENCES dbo.categories (id),
    CONSTRAINT fk_budget_adjustments_period FOREIGN KEY (period_id) REFERENCES dbo.budget_periods (id),
    CONSTRAINT fk_budget_adjustments_budget FOREIGN KEY (budget_id) REFERENCES dbo.budgets (id),
    CONSTRAINT ck_budget_adjustments_reason CHECK (reason IN ('bonus', 'missed_bill', 'reallocation', 'manual', 'csv_import'))
);
GO

/* -------------------------------------------------------- Reporting */

IF OBJECT_ID(N'dbo.net_worth_snapshots', N'U') IS NULL
CREATE TABLE dbo.net_worth_snapshots (
    id          UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_net_worth_snapshots_id DEFAULT NEWSEQUENTIALID(),
    date        DATE             NOT NULL,
    total_value DECIMAL(19,4)    NOT NULL,
    breakdown   NVARCHAR(MAX)    NULL,
    CONSTRAINT pk_net_worth_snapshots PRIMARY KEY (id),
    CONSTRAINT uq_net_worth_snapshots_date UNIQUE (date),
    CONSTRAINT ck_net_worth_snapshots_breakdown CHECK (breakdown IS NULL OR ISJSON(breakdown) = 1)
);
GO

IF OBJECT_ID(N'dbo.dashboard_layouts', N'U') IS NULL
CREATE TABLE dbo.dashboard_layouts (
    id         UNIQUEIDENTIFIER NOT NULL CONSTRAINT df_dashboard_layouts_id DEFAULT NEWSEQUENTIALID(),
    name       NVARCHAR(100)    NOT NULL,
    widgets    NVARCHAR(MAX)    NOT NULL CONSTRAINT df_dashboard_layouts_widgets DEFAULT N'[]',
    is_default BIT              NOT NULL CONSTRAINT df_dashboard_layouts_is_default DEFAULT 0,
    CONSTRAINT pk_dashboard_layouts PRIMARY KEY (id),
    CONSTRAINT ck_dashboard_layouts_widgets CHECK (ISJSON(widgets) = 1)
);
GO

/* ---------------------------------------------------------- Indexes */

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ux_dashboard_layouts_single_default')
    CREATE UNIQUE INDEX ux_dashboard_layouts_single_default ON dbo.dashboard_layouts (is_default) WHERE is_default = 1;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_categories_parent_id')
    CREATE INDEX ix_categories_parent_id ON dbo.categories (parent_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_csv_imports_account_id')
    CREATE INDEX ix_csv_imports_account_id ON dbo.csv_imports (account_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_transactions_account_date')
    CREATE INDEX ix_transactions_account_date ON dbo.transactions (account_id, date);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_transactions_category_date')
    CREATE INDEX ix_transactions_category_date ON dbo.transactions (category_id, date) INCLUDE (amount, type);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_transactions_csv_import_id')
    CREATE INDEX ix_transactions_csv_import_id ON dbo.transactions (csv_import_id) WHERE csv_import_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_recurring_payments_account_id')
    CREATE INDEX ix_recurring_payments_account_id ON dbo.recurring_payments (account_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_recurring_payments_category_id')
    CREATE INDEX ix_recurring_payments_category_id ON dbo.recurring_payments (category_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_insurance_policies_recurring_payment_id')
    CREATE INDEX ix_insurance_policies_recurring_payment_id ON dbo.insurance_policies (recurring_payment_id) WHERE recurring_payment_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bill_occurrences_recurring_payment_id')
    CREATE INDEX ix_bill_occurrences_recurring_payment_id ON dbo.bill_occurrences (recurring_payment_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bill_occurrences_period_status')
    CREATE INDEX ix_bill_occurrences_period_status ON dbo.bill_occurrences (period_id, status);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_bill_occurrences_transaction_id')
    CREATE INDEX ix_bill_occurrences_transaction_id ON dbo.bill_occurrences (transaction_id) WHERE transaction_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_income_expectations_period_id')
    CREATE INDEX ix_income_expectations_period_id ON dbo.income_expectations (period_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_income_expectations_transaction_id')
    CREATE INDEX ix_income_expectations_transaction_id ON dbo.income_expectations (transaction_id) WHERE transaction_id IS NOT NULL;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_goals_category_id')
    CREATE INDEX ix_goals_category_id ON dbo.goals (category_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_goals_period_id')
    CREATE INDEX ix_goals_period_id ON dbo.goals (period_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_goal_contributions_goal_id')
    CREATE INDEX ix_goal_contributions_goal_id ON dbo.goal_contributions (goal_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_goal_contributions_account_id')
    CREATE INDEX ix_goal_contributions_account_id ON dbo.goal_contributions (account_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_budgets_category_id')
    CREATE INDEX ix_budgets_category_id ON dbo.budgets (category_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_budget_adjustments_budget_id')
    CREATE INDEX ix_budget_adjustments_budget_id ON dbo.budget_adjustments (budget_id, created_at);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'ix_budget_adjustments_period_category')
    CREATE INDEX ix_budget_adjustments_period_category ON dbo.budget_adjustments (period_id, category_id);
GO
