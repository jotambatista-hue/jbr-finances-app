/*
  Goals need a start date as well as a due date so the app can tell whether
  saving is ahead of, on, or behind a steady schedule. The due date becomes
  required. goal_contributions.amount may be negative: diverting funds to
  another goal is recorded as -X on the source goal and +X on the target.
*/

USE JBRFinances;
GO

IF COL_LENGTH(N'dbo.goals', N'start_date') IS NULL
    ALTER TABLE dbo.goals
        ADD start_date DATE NOT NULL
            CONSTRAINT df_goals_start_date DEFAULT CAST(SYSUTCDATETIME() AS DATE);
GO

-- Existing goals without a due date get one a year after they started.
UPDATE dbo.goals SET target_date = DATEADD(YEAR, 1, start_date) WHERE target_date IS NULL;
GO

IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.goals') AND name = N'target_date' AND is_nullable = 1
)
    ALTER TABLE dbo.goals ALTER COLUMN target_date DATE NOT NULL;
GO

IF OBJECT_ID(N'dbo.ck_goals_dates', N'C') IS NULL
    ALTER TABLE dbo.goals ADD CONSTRAINT ck_goals_dates CHECK (target_date > start_date);
GO
