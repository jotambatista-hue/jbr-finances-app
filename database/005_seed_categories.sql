/*
  Standard income and expense categories, two levels deep: a group
  (parent_id NULL) and the categories under it. Budgets are set on the
  categories; groups only organise them.

  Re-runnable: a group is matched by name and type, a category by name under
  its group, and only missing rows are inserted. Renamed or extra categories
  you've added are left alone.
*/

USE JBRFinances;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @seed TABLE (
    group_name NVARCHAR(100) NOT NULL,
    name       NVARCHAR(100) NOT NULL,
    type       NVARCHAR(10)  NOT NULL
);

INSERT INTO @seed (group_name, name, type) VALUES
    -- Expense
    (N'Housing',           N'Rent or mortgage',           N'expense'),
    (N'Housing',           N'Property tax',               N'expense'),
    (N'Housing',           N'Home or renters insurance',  N'expense'),
    (N'Housing',           N'HOA fees',                   N'expense'),
    (N'Housing',           N'Home maintenance',           N'expense'),
    (N'Utilities',         N'Electricity',                N'expense'),
    (N'Utilities',         N'Water & sewer',              N'expense'),
    (N'Utilities',         N'Gas & heating',              N'expense'),
    (N'Utilities',         N'Trash & recycling',          N'expense'),
    (N'Utilities',         N'Internet',                   N'expense'),
    (N'Utilities',         N'Mobile phone',               N'expense'),
    (N'Food',              N'Groceries',                  N'expense'),
    (N'Food',              N'Dining out',                 N'expense'),
    (N'Food',              N'Coffee & snacks',            N'expense'),
    (N'Transportation',    N'Fuel',                       N'expense'),
    (N'Transportation',    N'Car payment',                N'expense'),
    (N'Transportation',    N'Auto insurance',             N'expense'),
    (N'Transportation',    N'Car maintenance',            N'expense'),
    (N'Transportation',    N'Parking & tolls',            N'expense'),
    (N'Transportation',    N'Public transit & rideshare', N'expense'),
    (N'Health',            N'Health insurance',           N'expense'),
    (N'Health',            N'Doctor & dental',            N'expense'),
    (N'Health',            N'Pharmacy',                   N'expense'),
    (N'Health',            N'Fitness',                    N'expense'),
    (N'Personal & family', N'Clothing',                   N'expense'),
    (N'Personal & family', N'Personal care',              N'expense'),
    (N'Personal & family', N'Childcare',                  N'expense'),
    (N'Personal & family', N'Education',                  N'expense'),
    (N'Personal & family', N'Pets',                       N'expense'),
    (N'Personal & family', N'Gifts & donations',          N'expense'),
    (N'Lifestyle',         N'Entertainment',              N'expense'),
    (N'Lifestyle',         N'Subscriptions',              N'expense'),
    (N'Lifestyle',         N'Hobbies',                    N'expense'),
    (N'Lifestyle',         N'Shopping',                   N'expense'),
    (N'Lifestyle',         N'Travel',                     N'expense'),
    (N'Financial',         N'Loan payments',              N'expense'),
    (N'Financial',         N'Credit card interest',       N'expense'),
    (N'Financial',         N'Bank fees',                  N'expense'),
    (N'Financial',         N'Life insurance',             N'expense'),
    (N'Financial',         N'Taxes',                      N'expense'),
    (N'Miscellaneous',     N'Other expenses',             N'expense'),
    -- Income
    (N'Earned income',     N'Salary',                     N'income'),
    (N'Earned income',     N'Bonus',                      N'income'),
    (N'Earned income',     N'Freelance & side income',    N'income'),
    (N'Other income',      N'Interest',                   N'income'),
    (N'Other income',      N'Dividends',                  N'income'),
    (N'Other income',      N'Refunds & reimbursements',   N'income'),
    (N'Other income',      N'Gifts received',             N'income'),
    (N'Other income',      N'Other income',               N'income');

BEGIN TRANSACTION;

-- Groups first, so the categories have a parent to point at.
INSERT INTO dbo.categories (parent_id, name, type)
SELECT DISTINCT NULL, s.group_name, s.type
FROM @seed AS s
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.categories AS c
    WHERE c.parent_id IS NULL AND c.name = s.group_name AND c.type = s.type
);

INSERT INTO dbo.categories (parent_id, name, type)
SELECT g.id, s.name, s.type
FROM @seed AS s
JOIN dbo.categories AS g
    ON g.parent_id IS NULL AND g.name = s.group_name AND g.type = s.type
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.categories AS c
    WHERE c.parent_id = g.id AND c.name = s.name
);

COMMIT TRANSACTION;

-- What's there now, group by group.
SELECT c.type, g.name AS group_name, c.name
FROM dbo.categories AS c
LEFT JOIN dbo.categories AS g ON g.id = c.parent_id
ORDER BY c.type, COALESCE(g.name, c.name), CASE WHEN g.id IS NULL THEN 0 ELSE 1 END, c.name;
GO
