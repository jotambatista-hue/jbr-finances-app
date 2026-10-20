/*
  Investments & Insurance and the net worth report.

  accounts
    - type gains 'loan' (auto, student, mortgage, personal) and 'property'
      (home, vehicle; valued by hand). Liabilities are stored as negative balances.
    - subtype says what kind of account it is within its type, e.g. Roth IRA vs.
      401(k) vs. taxable brokerage. Retirement vs. personal is derived from it.

  insurance_policies
    - life_kind separates term from permanent life (whole, universal, ...).
    - cash_value / cash_value_as_of: what a permanent policy is worth today;
      counted as an asset in net worth. Term policies leave these NULL.
    - death_benefit: face amount (coverage, not an asset).
*/

USE JBRFinances;
GO

/* ------------------------------------------------------------ accounts */

IF OBJECT_ID(N'dbo.ck_accounts_type', N'C') IS NOT NULL
    ALTER TABLE dbo.accounts DROP CONSTRAINT ck_accounts_type;
GO

ALTER TABLE dbo.accounts ADD CONSTRAINT ck_accounts_type
    CHECK (type IN ('checking', 'savings', 'credit_card', 'investment', 'cash', 'loan', 'property'));
GO

IF COL_LENGTH(N'dbo.accounts', N'subtype') IS NULL
    ALTER TABLE dbo.accounts ADD subtype NVARCHAR(20) NULL;
GO

IF OBJECT_ID(N'dbo.ck_accounts_subtype', N'C') IS NULL
    ALTER TABLE dbo.accounts ADD CONSTRAINT ck_accounts_subtype CHECK (
        subtype IS NULL
        OR (type = 'investment' AND subtype IN ('brokerage', 'traditional_ira', 'roth_ira', 'rollover_ira', '401k', 'roth_401k', '403b'))
        OR (type = 'loan' AND subtype IN ('auto', 'student', 'mortgage', 'personal'))
        OR (type = 'property' AND subtype IN ('home', 'vehicle'))
    );
GO

/* -------------------------------------------------- insurance_policies */

IF COL_LENGTH(N'dbo.insurance_policies', N'life_kind') IS NULL
    ALTER TABLE dbo.insurance_policies ADD
        life_kind        NVARCHAR(20)  NULL,
        cash_value       DECIMAL(19,4) NULL,
        cash_value_as_of DATE          NULL,
        death_benefit    DECIMAL(19,4) NULL;
GO

IF OBJECT_ID(N'dbo.ck_insurance_policies_life_kind', N'C') IS NULL
    ALTER TABLE dbo.insurance_policies ADD CONSTRAINT ck_insurance_policies_life_kind CHECK (
        (type = 'life' AND life_kind IN ('term', 'whole', 'universal', 'indexed_universal', 'variable_universal'))
        OR (type <> 'life' AND life_kind IS NULL)
    );
GO

-- Only permanent life builds cash value, and a value needs a date.
IF OBJECT_ID(N'dbo.ck_insurance_policies_cash_value', N'C') IS NULL
    ALTER TABLE dbo.insurance_policies ADD CONSTRAINT ck_insurance_policies_cash_value CHECK (
        cash_value IS NULL
        OR (life_kind IN ('whole', 'universal', 'indexed_universal', 'variable_universal')
            AND cash_value >= 0 AND cash_value_as_of IS NOT NULL)
    );
GO
