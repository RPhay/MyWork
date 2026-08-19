// T-SQL translation of the MyWork schema (see mysqlSchema.js for the canonical
// MySQL version). CREATE TABLE bodies here reflect the current schema, but
// once a table exists createTableIfNotExists() is a no-op - so any column
// added to a table's CREATE TABLE body needs a matching columnExists()
// backfill block (mirroring mysqlSchema.js's pattern) or it will silently
// never reach MSSQL installs whose tables predate that column. If the MySQL
// schema changes, mirror the change here too, including the backfill.
//
// Notes on the translation:
//   - AUTO_INCREMENT            -> IDENTITY(1,1)
//   - VARCHAR(n)                -> NVARCHAR(n)
//   - LONGTEXT / JSON           -> NVARCHAR(MAX)
//   - BOOLEAN                   -> BIT
//   - TIMESTAMP DEFAULT CURRENT_TIMESTAMP -> DATETIME2 DEFAULT SYSUTCDATETIME()
//   - "ON UPDATE CURRENT_TIMESTAMP" has no T-SQL equivalent column option, so
//     tables with an updated_at column get an AFTER UPDATE trigger instead.
//   - CREATE TRIGGER must be the only statement in its batch, so each one is
//     sent as its own .query() call.
//
// The entity types, their fields and their relationship rules come from
// ../systemEntityTypes.js, shared with mysqlSchema.js and phase 0. This file
// used to carry its own copies, which had drifted to pre-convergence values.
import {
  SYSTEM_ENTITY_TYPES,
  SPECIAL_ENTITY_TYPES,
  resolveTypeRelationships,
} from '../systemEntityTypes.js';

async function tableExists(pool, tableName) {
  const result = await pool
    .request()
    .query(
      `SELECT COUNT(*) as cnt FROM sys.tables WHERE name = '${tableName}' AND SCHEMA_NAME(schema_id) = 'MyWork'`,
    );
  return result.recordset[0].cnt > 0;
}

async function createTableIfNotExists(pool, tableName, ddl) {
  if (!(await tableExists(pool, tableName))) {
    await pool.request().query(ddl);
  }
}

async function createIndexIfNotExists(pool, indexName, tableName, ddl) {
  const result = await pool
    .request()
    .query(
      `SELECT COUNT(*) as cnt FROM sys.indexes WHERE name = '${indexName}' AND object_id = OBJECT_ID('[MyWork].[${tableName}]')`,
    );
  if (result.recordset[0].cnt === 0) {
    await pool.request().query(ddl);
  }
}

async function columnExists(pool, tableName, columnName) {
  const result = await pool
    .request()
    .query(
      `SELECT COUNT(*) as cnt FROM sys.columns WHERE object_id = OBJECT_ID('[MyWork].[${tableName}]') AND name = '${columnName}'`,
    );
  return result.recordset[0].cnt > 0;
}

// A column can't be dropped while a FOREIGN KEY still references it, so drop
// any such constraint(s) first - mirrors mysqlSchema.js's dropForeignKeysOnColumn.
async function dropForeignKeysOnColumn(pool, tableName, columnName) {
  const result = await pool.request().query(`
    SELECT fk.name AS fkName
    FROM sys.foreign_key_columns fkc
    JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
    JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
    WHERE fkc.parent_object_id = OBJECT_ID('[MyWork].[${tableName}]') AND c.name = '${columnName}'
  `);
  for (const row of result.recordset) {
    await pool
      .request()
      .query(
        `ALTER TABLE [MyWork].[${tableName}] DROP CONSTRAINT [${row.fkName}]`,
      );
  }
}

async function createTriggerIfNotExists(pool, triggerName, ddl) {
  const result = await pool
    .request()
    .query(
      `SELECT COUNT(*) as cnt FROM sys.triggers WHERE name = '${triggerName}'`,
    );
  if (result.recordset[0].cnt === 0) {
    await pool.request().query(ddl);
  }
}

// Adds an AFTER UPDATE trigger that bumps `updated_at` to now, mirroring MySQL's
// "ON UPDATE CURRENT_TIMESTAMP" column behavior.
async function createUpdatedAtTrigger(pool, tableName) {
  const triggerName = `trg_${tableName}_updated_at`;
  await createTriggerIfNotExists(
    pool,
    triggerName,
    `
    CREATE TRIGGER ${triggerName} ON [MyWork].[${tableName}]
    AFTER UPDATE AS
    BEGIN
      SET NOCOUNT ON;
      UPDATE t SET updated_at = SYSUTCDATETIME()
      FROM ${tableName} t
      INNER JOIN inserted i ON t.id = i.id;
    END
  `,
  );
}

export async function mssqlSchemaExists(pool) {
  return tableExists(pool, "work_items");
}

export async function createMssqlSchema(pool) {
  // Ensure [MyWork] schema exists and set it as the default for this user so
  // all unqualified runtime queries (SELECT * FROM work_items etc.) resolve here.
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'MyWork')
      EXEC('CREATE SCHEMA [MyWork]')
  `);
  await pool.request().query(`
    DECLARE @sql NVARCHAR(MAX) = 'ALTER USER [' + USER_NAME() + '] WITH DEFAULT_SCHEMA = [MyWork]'
    EXEC(@sql)
  `);

  await createTableIfNotExists(
    pool,
    "sources",
    `
    CREATE TABLE [MyWork].[sources] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      type NVARCHAR(100) NOT NULL,
      config NVARCHAR(MAX),
      enabled BIT DEFAULT 1,
      status NVARCHAR(50) DEFAULT 'not_configured',
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "sources");

  await createTableIfNotExists(
    pool,
    "source_auth",
    `
    CREATE TABLE [MyWork].[source_auth] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      source_id INT NOT NULL,
      auth_type NVARCHAR(50) NOT NULL,
      auth_data_enc NVARCHAR(MAX) NULL,
      auth_metadata NVARCHAR(MAX) NULL,
      authenticated_at DATETIME2 NULL,
      expires_at DATETIME2 NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_source_auth_source FOREIGN KEY (source_id) REFERENCES [MyWork].[sources](id) ON DELETE CASCADE,
      CONSTRAINT unique_source_auth UNIQUE (source_id, auth_type)
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "source_auth");

  await createTableIfNotExists(
    pool,
    "categories",
    `
    CREATE TABLE [MyWork].[categories] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL UNIQUE,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );

  // Seed the standard goal categories so they're selectable out of the box
  const standardCategories = [
    "Financial",
    "Impact",
    "M&A",
    "Operational Excellence",
    "Other",
    "People",
    "Technology Excellence",
  ];
  for (const name of standardCategories) {
    const request = pool.request();
    request.input("name", name);
    await request.query(
      "IF NOT EXISTS (SELECT 1 FROM [MyWork].[categories] WHERE name = @name) INSERT INTO [MyWork].[categories] (name) VALUES (@name)",
    );
  }

  // areas table removed in Phase 2 (areas migrated to generic entities)

  // Backfill statements for areas removed in Phase 2 (areas migrated to generic entities)

  await createTableIfNotExists(
    pool,
    "years",
    `
    CREATE TABLE [MyWork].[years] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      year INT NOT NULL UNIQUE,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );

  // Seed the current year so the dropdown isn't empty on a fresh install
  const currentYear = new Date().getFullYear();
  const yearRequest = pool.request();
  yearRequest.input("year", currentYear);
  await yearRequest.query(`
    IF NOT EXISTS (SELECT 1 FROM [MyWork].[years] WHERE year = @year)
      INSERT INTO [MyWork].[years] (year) VALUES (@year)
  `);

  // goals table removed in Phase 3 (goals migrated to generic entities)

  // goal_categories table removed in Phase 3 (goals migrated to generic entities)

  await createTableIfNotExists(
    pool,
    "priorities",
    `
    CREATE TABLE [MyWork].[priorities] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      source_id INT NULL,
      parent_id INT NULL,
      notes NVARCHAR(MAX),
      status NVARCHAR(50) NOT NULL DEFAULT 'Not Started',
      order_index INT DEFAULT 0,
      is_weekly BIT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_priorities_source FOREIGN KEY (source_id) REFERENCES [MyWork].[sources](id) ON DELETE SET NULL,
      -- NO ACTION, not CASCADE - see the matching note on fk_areas_parent above.
      CONSTRAINT fk_priorities_parent FOREIGN KEY (parent_id) REFERENCES [MyWork].[priorities](id) ON DELETE NO ACTION
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "priorities");
  await createIndexIfNotExists(
    pool,
    "idx_priorities_order",
    "priorities",
    "CREATE INDEX idx_priorities_order ON [MyWork].[priorities](order_index)",
  );

  // Backfill for priorities created before these existed - see mysqlSchema.js
  if (!(await columnExists(pool, "priorities", "is_weekly"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[priorities] ADD is_weekly BIT DEFAULT 0
    `);
  }
  if (!(await columnExists(pool, "priorities", "status"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[priorities] ADD status NVARCHAR(50) NOT NULL DEFAULT 'Not Started'
    `);
  }
  if (!(await columnExists(pool, "priorities", "parent_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[priorities] ADD
        parent_id INT NULL CONSTRAINT fk_priorities_parent FOREIGN KEY REFERENCES [MyWork].[priorities](id) ON DELETE NO ACTION
    `);
  }

  // priority_areas: recreated as a legacy<->entity bridge at the end of this file

  // priority_goals: recreated as a legacy<->entity bridge at the end of this file

  await createTableIfNotExists(
    pool,
    "work_items",
    `
    CREATE TABLE [MyWork].[work_items] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      date DATE NOT NULL,
      title NVARCHAR(255) NOT NULL,
      description NVARCHAR(MAX),
      notes NVARCHAR(MAX),
      emoji NVARCHAR(16),
      status NVARCHAR(50) DEFAULT 'Not Started',
      time_box_minutes INT NULL,
      start_time VARCHAR(5) NULL,
      order_index INT DEFAULT 0,
      worked_with_claude BIT DEFAULT 0,
      recurring_from_todo_id INT NULL,
      recurring_from_task_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "work_items");
  await createIndexIfNotExists(
    pool,
    "idx_work_items_date",
    "work_items",
    "CREATE INDEX idx_work_items_date ON [MyWork].[work_items](date)",
  );
  await createIndexIfNotExists(
    pool,
    "idx_work_items_status",
    "work_items",
    "CREATE INDEX idx_work_items_status ON [MyWork].[work_items](status)",
  );

  // Backfill for work_items created before these existed - see mysqlSchema.js
  if (!(await columnExists(pool, "work_items", "notes"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_items] ADD notes NVARCHAR(MAX)
    `);
  }
  if (!(await columnExists(pool, "work_items", "emoji"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_items] ADD emoji NVARCHAR(16)
    `);
  }
  if (!(await columnExists(pool, "work_items", "time_box_minutes"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_items] ADD time_box_minutes INT NULL
    `);
  }
  if (!(await columnExists(pool, "work_items", "order_index"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_items] ADD order_index INT DEFAULT 0
    `);
  }
  if (!(await columnExists(pool, "work_items", "start_time"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_items] ADD start_time VARCHAR(5) NULL
    `);
  }
  if (!(await columnExists(pool, "work_items", "worked_with_claude"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_items] ADD worked_with_claude BIT DEFAULT 0
    `);
  }
  if (!(await columnExists(pool, "work_items", "recurring_from_todo_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_items] ADD
        recurring_from_todo_id INT NULL CONSTRAINT fk_work_items_recurring_todo FOREIGN KEY REFERENCES [MyWork].[to_dos](id) ON DELETE SET NULL,
        recurring_from_task_id INT NULL CONSTRAINT fk_work_items_recurring_task FOREIGN KEY REFERENCES [MyWork].[tasks](id) ON DELETE SET NULL
    `);
  }

  // work_goal_associations: recreated as a legacy<->entity bridge at the end of this file

  await createTableIfNotExists(
    pool,
    "work_priority_associations",
    `
    CREATE TABLE [MyWork].[work_priority_associations] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      work_item_id INT NOT NULL,
      priority_id INT NOT NULL,
      CONSTRAINT fk_wpa_work_item FOREIGN KEY (work_item_id) REFERENCES [MyWork].[work_items](id) ON DELETE CASCADE,
      CONSTRAINT fk_wpa_priority FOREIGN KEY (priority_id) REFERENCES [MyWork].[priorities](id) ON DELETE CASCADE,
      CONSTRAINT unique_work_priority UNIQUE (work_item_id, priority_id)
    )
  `,
  );

  // work_area_associations: recreated as a legacy<->entity bridge at the end of this file

  await createTableIfNotExists(
    pool,
    "work_source_associations",
    `
    CREATE TABLE [MyWork].[work_source_associations] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      work_item_id INT NOT NULL,
      source_id INT NOT NULL,
      CONSTRAINT fk_wsa_work_item FOREIGN KEY (work_item_id) REFERENCES [MyWork].[work_items](id) ON DELETE CASCADE,
      CONSTRAINT fk_wsa_source FOREIGN KEY (source_id) REFERENCES [MyWork].[sources](id) ON DELETE CASCADE,
      CONSTRAINT unique_work_source UNIQUE (work_item_id, source_id)
    )
  `,
  );

  // work_template_associations moved to after work_item_templates is created (see below)
  // work_todo_associations moved to after to_dos is created (see below)
  // work_task_associations moved to after tasks is created (see below)
  // work_ticket_associations moved to after tickets is created (see below)

  // work_idea_associations: recreated as a legacy<->entity bridge at the end of this file

  await createTableIfNotExists(
    pool,
    "work_item_templates",
    `
    CREATE TABLE [MyWork].[work_item_templates] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      description NVARCHAR(MAX),
      emoji NVARCHAR(16),
      source_id INT NULL,
      status NVARCHAR(50) NOT NULL DEFAULT 'Not Started',
      time_box_minutes INT NULL,
      start_time VARCHAR(5) NULL,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_templates_source FOREIGN KEY (source_id) REFERENCES [MyWork].[sources](id) ON DELETE SET NULL
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "work_item_templates");

  // Backfill for work_item_templates created before these existed - see mysqlSchema.js
  if (!(await columnExists(pool, "work_item_templates", "time_box_minutes"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_item_templates] ADD time_box_minutes INT NULL
    `);
  }
  if (!(await columnExists(pool, "work_item_templates", "emoji"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_item_templates] ADD emoji NVARCHAR(16)
    `);
  }
  if (!(await columnExists(pool, "work_item_templates", "start_time"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_item_templates] ADD start_time VARCHAR(5) NULL
    `);
  }
  if (!(await columnExists(pool, "work_item_templates", "order_index"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_item_templates] ADD order_index INT DEFAULT 0
    `);
  }

  // Now that work_item_templates exists, create work_template_associations junction table
  await createTableIfNotExists(
    pool,
    "work_template_associations",
    `
    CREATE TABLE [MyWork].[work_template_associations] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      work_item_id INT NOT NULL,
      template_id INT NOT NULL,
      CONSTRAINT fk_wta_work_item FOREIGN KEY (work_item_id) REFERENCES [MyWork].[work_items](id) ON DELETE CASCADE,
      CONSTRAINT fk_wta_template FOREIGN KEY (template_id) REFERENCES [MyWork].[work_item_templates](id) ON DELETE CASCADE,
      CONSTRAINT unique_work_template UNIQUE (work_item_id, template_id)
    )
  `,
  );

  // template_areas: recreated as a legacy<->entity bridge at the end of this file

  // template_goals: recreated as a legacy<->entity bridge at the end of this file

  await createTableIfNotExists(
    pool,
    "template_priorities",
    `
    CREATE TABLE [MyWork].[template_priorities] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      template_id INT NOT NULL,
      priority_id INT NOT NULL,
      CONSTRAINT fk_template_priorities_template FOREIGN KEY (template_id) REFERENCES [MyWork].[work_item_templates](id) ON DELETE CASCADE,
      CONSTRAINT fk_template_priorities_priority FOREIGN KEY (priority_id) REFERENCES [MyWork].[priorities](id) ON DELETE CASCADE,
      CONSTRAINT unique_template_priority UNIQUE (template_id, priority_id)
    )
  `,
  );

  await createTableIfNotExists(
    pool,
    "to_dos",
    `
    CREATE TABLE [MyWork].[to_dos] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      notes NVARCHAR(MAX),
      parent_id INT NULL,
      priority_id INT NULL,
      status NVARCHAR(20) NOT NULL DEFAULT 'incomplete',
      recurrence NVARCHAR(MAX),
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      -- NO ACTION, not CASCADE - see the matching note on fk_areas_parent above.
      CONSTRAINT fk_to_dos_parent FOREIGN KEY (parent_id) REFERENCES [MyWork].[to_dos](id) ON DELETE NO ACTION,
      CONSTRAINT fk_to_dos_priority FOREIGN KEY (priority_id) REFERENCES [MyWork].[priorities](id) ON DELETE SET NULL
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "to_dos");

  // Backfill parent_id for pre-existing to_dos tables (migrate from folder_id if it exists)
  if (!(await columnExists(pool, "to_dos", "parent_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[to_dos] ADD parent_id INT NULL
        CONSTRAINT fk_to_dos_parent FOREIGN KEY REFERENCES [MyWork].[to_dos](id) ON DELETE NO ACTION
    `);
    // Set all folder_id references to NULL during migration for safety
    if (await columnExists(pool, "to_dos", "folder_id")) {
      await pool.request().query(`UPDATE [MyWork].[to_dos] SET parent_id = NULL WHERE folder_id IS NOT NULL`);
    }
  }

  // Backfill for to_dos created before status existed.
  if (!(await columnExists(pool, "to_dos", "status"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[to_dos] ADD status NVARCHAR(20) NOT NULL DEFAULT 'incomplete'
    `);
  }

  // Backfill priority_id for pre-existing to_dos tables
  if (!(await columnExists(pool, "to_dos", "priority_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[to_dos] ADD priority_id INT NULL
        CONSTRAINT fk_to_dos_priority FOREIGN KEY REFERENCES [MyWork].[priorities](id) ON DELETE SET NULL
    `);
  }

  // The boolean `completed` column was superseded by the 4-state `status` column
  // above before it shipped; migrate any data and drop it on installs that already
  // picked it up.
  if (await columnExists(pool, "to_dos", "completed")) {
    await pool.request().query(`UPDATE [MyWork].[to_dos] SET status = 'complete' WHERE completed = 1`);
    await pool.request().query(`ALTER TABLE [MyWork].[to_dos] DROP COLUMN completed`);
  }

  // Drop old folder_id column if it still exists on to_dos
  if (await columnExists(pool, "to_dos", "folder_id")) {
    await dropForeignKeysOnColumn(pool, "to_dos", "folder_id");
    await pool.request().query(`ALTER TABLE [MyWork].[to_dos] DROP COLUMN folder_id`);
  }

  // Backfill recurrence for pre-existing to_dos tables
  if (!(await columnExists(pool, "to_dos", "recurrence"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[to_dos] ADD recurrence NVARCHAR(MAX)
    `);
  }

  // Backfill target_date for pre-existing to_dos tables
  if (!(await columnExists(pool, "to_dos", "target_date"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[to_dos] ADD target_date DATE NULL
    `);
  }

  // Backfill importance for pre-existing to_dos tables
  if (!(await columnExists(pool, "to_dos", "importance"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[to_dos] ADD importance NVARCHAR(20) NULL
    `);
  }

  await createTableIfNotExists(
    pool,
    "to_do_items",
    `
    CREATE TABLE [MyWork].[to_do_items] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      to_do_id INT NOT NULL,
      text NVARCHAR(500) NOT NULL,
      is_done BIT DEFAULT 0,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_to_do_items_to_do FOREIGN KEY (to_do_id) REFERENCES [MyWork].[to_dos](id) ON DELETE CASCADE
    )
  `,
  );

  // idea_folders table removed in Phase 1 (ideas migrated to generic entities)

  // ideas table removed in Phase 1 (ideas migrated to generic entities)

  // idea_items table removed in Phase 1 (ideas migrated to generic entities)

  await createTableIfNotExists(
    pool,
    "to_do_links",
    `
    CREATE TABLE [MyWork].[to_do_links] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      to_do_id INT NOT NULL,
      url NVARCHAR(2048) NOT NULL,
      title NVARCHAR(255),
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_to_do_links_to_do FOREIGN KEY (to_do_id) REFERENCES [MyWork].[to_dos](id) ON DELETE CASCADE
    )
  `,
  );

  // work_todo_associations is created with the legacy <-> entity bridge at the end of
  // this file: its todo_id points at [entities], not [to_dos].

  // idea_links table removed in Phase 1 (ideas migrated to generic entities)

  await createTableIfNotExists(
    pool,
    "priority_links",
    `
    CREATE TABLE [MyWork].[priority_links] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      priority_id INT NOT NULL,
      url NVARCHAR(2048) NOT NULL,
      title NVARCHAR(255),
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_priority_links_priority FOREIGN KEY (priority_id) REFERENCES [MyWork].[priorities](id) ON DELETE CASCADE
    )
  `,
  );

  await createTableIfNotExists(
    pool,
    "tasks",
    `
    CREATE TABLE [MyWork].[tasks] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      notes NVARCHAR(MAX),
      parent_id INT NULL,
      priority_id INT NULL,
      status NVARCHAR(20) NOT NULL DEFAULT 'incomplete',
      recurrence NVARCHAR(MAX),
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      -- NO ACTION, not CASCADE - see the matching note on fk_areas_parent above.
      CONSTRAINT fk_tasks_parent FOREIGN KEY (parent_id) REFERENCES [MyWork].[tasks](id) ON DELETE NO ACTION,
      CONSTRAINT fk_tasks_priority FOREIGN KEY (priority_id) REFERENCES [MyWork].[priorities](id) ON DELETE SET NULL
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "tasks");

  // Backfill parent_id/priority_id/status for pre-existing tasks tables
  if (!(await columnExists(pool, "tasks", "parent_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[tasks] ADD parent_id INT NULL
        CONSTRAINT fk_tasks_parent FOREIGN KEY REFERENCES [MyWork].[tasks](id) ON DELETE NO ACTION
    `);
    // Set all folder_id references to NULL during migration for safety
    if (await columnExists(pool, "tasks", "folder_id")) {
      await pool.request().query(`UPDATE [MyWork].[tasks] SET parent_id = NULL WHERE folder_id IS NOT NULL`);
    }
  }
  if (!(await columnExists(pool, "tasks", "priority_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[tasks] ADD priority_id INT NULL
        CONSTRAINT fk_tasks_priority FOREIGN KEY REFERENCES [MyWork].[priorities](id) ON DELETE SET NULL
    `);
  }
  if (!(await columnExists(pool, "tasks", "status"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[tasks] ADD status NVARCHAR(20) NOT NULL DEFAULT 'incomplete'
    `);
  }

  // Drop old folder_id column if it still exists on tasks
  if (await columnExists(pool, "tasks", "folder_id")) {
    await dropForeignKeysOnColumn(pool, "tasks", "folder_id");
    await pool.request().query(`ALTER TABLE [MyWork].[tasks] DROP COLUMN folder_id`);
  }

  // Backfill recurrence for pre-existing tasks tables
  if (!(await columnExists(pool, "tasks", "recurrence"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[tasks] ADD recurrence NVARCHAR(MAX)
    `);
  }

  // Now that to_dos and tasks tables are created, add the FK from work_items to them
  // Use ALTER TABLE instead of adding to CREATE TABLE since those tables didn't exist yet
  try {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_items]
      ADD CONSTRAINT fk_work_items_recurring_todo FOREIGN KEY (recurring_from_todo_id) REFERENCES [MyWork].[to_dos](id) ON DELETE SET NULL
    `);
  } catch (err) {
    // Constraint might already exist, ignore
  }
  try {
    await pool.request().query(`
      ALTER TABLE [MyWork].[work_items]
      ADD CONSTRAINT fk_work_items_recurring_task FOREIGN KEY (recurring_from_task_id) REFERENCES [MyWork].[tasks](id) ON DELETE SET NULL
    `);
  } catch (err) {
    // Constraint might already exist, ignore
  }

  await createTableIfNotExists(
    pool,
    "task_links",
    `
    CREATE TABLE [MyWork].[task_links] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      task_id INT NOT NULL,
      url NVARCHAR(2048) NOT NULL,
      title NVARCHAR(255),
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_task_links_task FOREIGN KEY (task_id) REFERENCES [MyWork].[tasks](id) ON DELETE CASCADE
    )
  `,
  );

  // work_task_associations is created with the legacy <-> entity bridge at the end of
  // this file: its task_id points at [entities], not [tasks].

  // Create contexts table (top-level scope toggle, e.g. Work vs Life vs Hobbies -
  // distinct from the "areas" table, which backs the unrelated Categories tab)
  // Note: This must be created BEFORE tickets since tickets references contexts
  await createTableIfNotExists(
    pool,
    "contexts",
    `
    CREATE TABLE [MyWork].[contexts] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL UNIQUE,
      order_index INT DEFAULT 0,
      icon NVARCHAR(50) NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "contexts");

  // Backfill for contexts created before icon existed.
  if (!(await columnExists(pool, "contexts", "icon"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[contexts] ADD icon NVARCHAR(50) NULL
    `);
  }

  // Seed a starting context so the app is never contextless out of the box.
  const contextCountResult = await pool
    .request()
    .query("SELECT COUNT(*) as cnt FROM [MyWork].[contexts]");
  if (contextCountResult.recordset[0].cnt === 0) {
    await pool
      .request()
      .input("name", "Default")
      .query(
        "INSERT INTO [MyWork].[contexts] (name, order_index) VALUES (@name, 0)",
      );
  }

  await createTableIfNotExists(
    pool,
    "tickets",
    `
    CREATE TABLE [MyWork].[tickets] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      notes NVARCHAR(MAX),
      ticket_type NVARCHAR(50) DEFAULT 'Other',
      context_id INT,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_tickets_context FOREIGN KEY (context_id) REFERENCES [MyWork].[contexts](id)
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "tickets");

  // Backfill priority_id for pre-existing tickets tables (project association) - see mysqlSchema.js
  if (!(await columnExists(pool, "tickets", "priority_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[tickets] ADD
        priority_id INT NULL CONSTRAINT fk_tickets_priority FOREIGN KEY REFERENCES [MyWork].[priorities](id) ON DELETE SET NULL
    `);
  }

  await createTableIfNotExists(
    pool,
    "ticket_links",
    `
    CREATE TABLE [MyWork].[ticket_links] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      ticket_id INT NOT NULL,
      url NVARCHAR(2048) NOT NULL,
      title NVARCHAR(255),
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_ticket_links_ticket FOREIGN KEY (ticket_id) REFERENCES [MyWork].[tickets](id) ON DELETE CASCADE
    )
  `,
  );

  // work_ticket_associations is created with the legacy <-> entity bridge at the end of
  // this file: its ticket_id points at [entities], not [tickets].

  await createTableIfNotExists(
    pool,
    "context_folders",
    `
    CREATE TABLE [MyWork].[context_folders] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      parent_id INT NULL,
      order_index INT DEFAULT 0,
      icon NVARCHAR(50) NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_context_folders_parent FOREIGN KEY (parent_id) REFERENCES [MyWork].[context_folders](id) ON DELETE NO ACTION
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "context_folders");

  // Backfill for context_folders created before icon existed.
  if (!(await columnExists(pool, "context_folders", "icon"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[context_folders] ADD icon NVARCHAR(50) NULL
    `);
  }

  await createTableIfNotExists(
    pool,
    "users",
    `
    CREATE TABLE [MyWork].[users] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL UNIQUE,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );

  await createTableIfNotExists(
    pool,
    "sso_identities",
    `
    CREATE TABLE [MyWork].[sso_identities] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL,
      provider NVARCHAR(50) NOT NULL,
      provider_id NVARCHAR(500) NOT NULL,
      provider_email NVARCHAR(255) NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_sso_identities_user FOREIGN KEY (user_id) REFERENCES [MyWork].[users](id) ON DELETE CASCADE,
      CONSTRAINT unique_provider_identity UNIQUE (provider, provider_id)
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "sso_identities");

  // Contexts table moved to before tickets table (see below, tickets references contexts)

  // Every context belongs to a user once someone's logged in - see the
  // matching note in mysqlSchema.js.
  if (!(await columnExists(pool, "contexts", "user_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[contexts] ADD
        user_id INT NULL CONSTRAINT fk_contexts_user FOREIGN KEY REFERENCES [MyWork].[users](id) ON DELETE SET NULL
    `);
  }

  // Each context owns its own database connection and its own sub-tab
  // ordering for the Settings > Contexts panel - see mysqlSchema.js.
  if (!(await columnExists(pool, "contexts", "db_host"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[contexts] ADD
        db_host NVARCHAR(255) NULL,
        db_port INT NULL,
        db_name NVARCHAR(255) NULL,
        db_user NVARCHAR(255) NULL,
        db_password_enc NVARCHAR(MAX) NULL,
        subtab_order NVARCHAR(MAX) NULL
    `);
  }

  // Separate MSSQL profile alongside the MySQL/MariaDB one above - see
  // mysqlSchema.js for the full rationale (only MySQL/MariaDB is ever live).
  if (!(await columnExists(pool, "contexts", "db_type"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[contexts] ADD
        db_type NVARCHAR(10) DEFAULT 'mysql',
        mssql_host NVARCHAR(255) NULL,
        mssql_port INT NULL,
        mssql_name NVARCHAR(255) NULL,
        mssql_user NVARCHAR(255) NULL,
        mssql_password_enc NVARCHAR(MAX) NULL
    `);
  }

  if (!(await columnExists(pool, "contexts", "db_config_json"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[contexts] ADD db_config_json NVARCHAR(MAX) NULL
    `);
  }

  if (!(await columnExists(pool, "contexts", "snow_instance"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[contexts] ADD
        snow_instance NVARCHAR(500) NULL,
        snow_username_enc NVARCHAR(MAX) NULL,
        snow_password_enc NVARCHAR(MAX) NULL,
        ado_org NVARCHAR(500) NULL,
        ado_project NVARCHAR(255) NULL,
        ado_pat_enc NVARCHAR(MAX) NULL
    `);
  }

  if (!(await columnExists(pool, "contexts", "folder_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[contexts] ADD
        folder_id INT NULL CONSTRAINT fk_contexts_folder FOREIGN KEY REFERENCES [MyWork].[context_folders](id) ON DELETE SET NULL
    `);
  }

  // SSO configuration per context (Microsoft Entra ID, etc.) - see mysqlSchema.js
  if (!(await columnExists(pool, "contexts", "sso_enabled"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[contexts] ADD
        sso_enabled BIT DEFAULT 0,
        sso_provider NVARCHAR(50) NULL,
        sso_tenant_id_enc NVARCHAR(MAX) NULL,
        sso_client_id_enc NVARCHAR(MAX) NULL,
        sso_client_secret_enc NVARCHAR(MAX) NULL,
        sso_redirect_uri NVARCHAR(500) NULL,
        sso_configured_at DATETIME2 NULL
    `);
  }

  await createTableIfNotExists(
    pool,
    "context_tab_settings",
    `
    CREATE TABLE [MyWork].[context_tab_settings] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      context_id INT NOT NULL,
      tab_key NVARCHAR(100) NOT NULL,
      visible BIT DEFAULT 1,
      order_index INT DEFAULT 0,
      CONSTRAINT fk_context_tab_settings_context FOREIGN KEY (context_id) REFERENCES [MyWork].[contexts](id) ON DELETE CASCADE,
      CONSTRAINT unique_context_tab UNIQUE (context_id, tab_key)
    )
  `,
  );

  // Dailies calendar cell background/text color, set via the calendar day's
  // right-click "Highlight Day" / "Text Color" submenus. One row per date per
  // context; either column may be set independently of the other.
  await createTableIfNotExists(
    pool,
    "day_highlights",
    `
    CREATE TABLE [MyWork].[day_highlights] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      context_id INT NOT NULL,
      date DATE NOT NULL,
      color NVARCHAR(20) NULL,
      text_color NVARCHAR(20) NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_day_highlights_context FOREIGN KEY (context_id) REFERENCES [MyWork].[contexts](id) ON DELETE CASCADE,
      CONSTRAINT unique_context_date UNIQUE (context_id, date)
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "day_highlights");

  // Backfill for day_highlights created before text_color existed (color was
  // NOT NULL then; relaxed here since a row may now hold only a text_color).
  if (!(await columnExists(pool, "day_highlights", "text_color"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[day_highlights] ADD text_color NVARCHAR(20) NULL
    `);
    await pool.request().query(`
      ALTER TABLE [MyWork].[day_highlights] ALTER COLUMN color NVARCHAR(20) NULL
    `);
  }

  // Every content entity belongs to exactly one context - see mysqlSchema.js
  // for the full rationale. Added after contexts exists so the FK is valid
  // whether these tables were just created above or already existed.
  const firstContextResult = await pool
    .request()
    .query(
      "SELECT TOP 1 id FROM [MyWork].[contexts] ORDER BY order_index ASC, id ASC",
    );
  const firstContextId = firstContextResult.recordset[0].id;
  const contextTables = [
    "sources",
    "priorities",
    "work_items",
    "work_item_templates",
    "to_dos",
    "tasks",
    "tickets",
  ];
  // Note: "areas", "goals", "idea_folders", "ideas" were migrated to generic entities
  // in Phases 1-3 and no longer exist as separate tables
  for (const table of contextTables) {
    if (!(await columnExists(pool, table, "context_id"))) {
      await pool
        .request()
        .query(
          `ALTER TABLE [MyWork].[${table}] ADD context_id INT NULL CONSTRAINT fk_${table}_context FOREIGN KEY REFERENCES [MyWork].[contexts](id)`,
        );
      await pool
        .request()
        .input("contextId", firstContextId)
        .query(
          `UPDATE [MyWork].[${table}] SET context_id = @contextId WHERE context_id IS NULL`,
        );
    }
  }

  // These three used to be uniquely constrained globally (e.g. only one area
  // ever named "Meetings" in the whole app); widened to per-context now that
  // context_id exists, so the same name can exist in different contexts.
  // Note: areas and goals were migrated to generic entities and no longer have these tables
  await createIndexIfNotExists(
    pool,
    "unique_context_title",
    "priorities",
    "CREATE UNIQUE INDEX unique_context_title ON [MyWork].[priorities](context_id, title)",
  );

  // Hierarchical associations for cross-entity relationships - see mysqlSchema.js,
  // which uses ON DELETE SET NULL for all six columns below. to_dos<->tickets and
  // areas<->to_dos are each mutual pairs (both tables reference each other), and
  // SQL Server rejects a cascading action - CASCADE or SET NULL alike - that forms
  // a cycle ("may cause cycles or multiple cascade paths"), the same restriction
  // already hit by the self-referencing parent_id columns above. So the four
  // columns forming those two mutual pairs use NO ACTION instead; the app must
  // clear the paired column itself before a delete that would otherwise leave a
  // dangling reference. The other two columns (goals.ticket_id, tickets.category_id)
  // aren't part of a cycle and keep MySQL's SET NULL behavior.

  // Todos can have tickets as children
  if (!(await columnExists(pool, "to_dos", "ticket_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[to_dos] ADD
        ticket_id INT NULL CONSTRAINT fk_to_dos_ticket FOREIGN KEY REFERENCES [MyWork].[tickets](id) ON DELETE NO ACTION
    `);
  }
  if (!(await columnExists(pool, "tickets", "todo_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[tickets] ADD
        todo_id INT NULL CONSTRAINT fk_tickets_todo FOREIGN KEY REFERENCES [MyWork].[to_dos](id) ON DELETE NO ACTION
    `);
  }

  // Note: goals and areas tables were migrated to generic entities and no longer exist

  // Create quotes table (person + quote attribution for any object type)
  await createTableIfNotExists(
    pool,
    "quotes",
    `
    CREATE TABLE [MyWork].[quotes] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      object_type NVARCHAR(50) NOT NULL,
      object_id INT NOT NULL,
      person NVARCHAR(255) NOT NULL,
      quote NVARCHAR(MAX) NOT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "quotes");

  // Generic Entity Type System — structural tables
  // These define the types that entities can be; applies globally across all contexts.

  await createTableIfNotExists(
    pool,
    "entity_types",
    `
    CREATE TABLE [MyWork].[entity_types] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      slug NVARCHAR(100) NOT NULL UNIQUE,
      label NVARCHAR(255) NOT NULL,
      label_singular NVARCHAR(255) NOT NULL,
      icon NVARCHAR(50),
      type_category NVARCHAR(20) DEFAULT 'editable' CHECK (type_category IN ('editable','template','daily','external')),
      external_source NVARCHAR(100),
      template_structure NVARCHAR(MAX),
      supports_hierarchy BIT DEFAULT 0,
      is_system BIT DEFAULT 0,
      primary_date_field NVARCHAR(100),
      order_index INT DEFAULT 0,
      is_visible BIT DEFAULT 1,
      deleted_at DATETIME2 NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "entity_types");

  // Backfill type_category column for existing records (MSSQL)
  const typesCategoryExists = await columnExistsAsync(pool, "entity_types", "type_category");
  if (!typesCategoryExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD type_category NVARCHAR(20) DEFAULT 'editable' CHECK (type_category IN ('editable','template','daily','external'))");
  }

  // Backfill for entity_types created before is_visible existed - see mysqlSchema.js
  if (!(await columnExists(pool, "entity_types", "is_visible"))) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD is_visible BIT DEFAULT 1");
  }

  const typesExternalSourceExists = await columnExistsAsync(pool, "entity_types", "external_source");
  if (!typesExternalSourceExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD external_source NVARCHAR(100)");
  }

  // Where the Title column sits among the field columns - see mysqlSchema.js.
  const typesTitleOrderExists = await columnExistsAsync(pool, "entity_types", "title_order");
  if (!typesTitleOrderExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD title_order INT NOT NULL DEFAULT 0");
  }

  const typesTemplateStructureExists = await columnExistsAsync(pool, "entity_types", "template_structure");
  if (!typesTemplateStructureExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD template_structure NVARCHAR(MAX)");
  }

  // Seed system entity types if they don't exist (MSSQL)
  // Note: work_item represents individual items that can be associated with a Daily
  const escapeSQL = (str) => (str ? str.replace(/'/g, "''") : 'NULL');

  for (const type of SYSTEM_ENTITY_TYPES) {
    const checkResult = await pool.request()
      .query(`SELECT id FROM [MyWork].[entity_types] WHERE slug = '${escapeSQL(type.slug)}'`);

    if (checkResult.recordset.length === 0) {
      const primaryDateField = type.primary_date_field ? `'${escapeSQL(type.primary_date_field)}'` : 'NULL';
      await pool.request()
        .query(`INSERT INTO [MyWork].[entity_types] (slug, label, label_singular, icon, type_category, supports_hierarchy, is_system, primary_date_field, order_index)
                VALUES ('${escapeSQL(type.slug)}', '${escapeSQL(type.label)}', '${escapeSQL(type.label_singular)}', '${escapeSQL(type.icon)}', 'editable', ${type.supports_hierarchy ? 1 : 0}, 1, ${primaryDateField}, ${SYSTEM_ENTITY_TYPES.indexOf(type)})`);
    }
  }

  // Seed special types (Daily day container and External integrations) if they don't exist (MSSQL)
  // Repair forbidden icons on existing installs - mirrors mysqlSchema.js. A
  // folder-like icon is never a legitimate customisation, so overwriting it
  // cannot clobber a deliberate choice. Labels are deliberately not touched.
  for (const type of SYSTEM_ENTITY_TYPES) {
    await pool.request()
      .query(`UPDATE [MyWork].[entity_types] SET icon = '${escapeSQL(type.icon)}' WHERE slug = '${escapeSQL(type.slug)}' AND icon IN (N'📁', N'📂')`);
  }

  // Daily = read-only type representing one complete day's work (a tree of all associated items)
  for (const type of SPECIAL_ENTITY_TYPES) {
    const checkResult = await pool.request()
      .query(`SELECT id FROM [MyWork].[entity_types] WHERE slug = '${escapeSQL(type.slug)}'`);

    if (checkResult.recordset.length === 0) {
      const externalSource = type.external_source ? `'${escapeSQL(type.external_source)}'` : 'NULL';
      await pool.request()
        .query(`INSERT INTO [MyWork].[entity_types] (slug, label, label_singular, icon, type_category, external_source, supports_hierarchy, is_system, order_index)
                VALUES ('${escapeSQL(type.slug)}', '${escapeSQL(type.label)}', '${escapeSQL(type.label_singular)}', '${escapeSQL(type.icon)}', '${escapeSQL(type.type_category)}', ${externalSource}, 0, 1, 0)`);
    }
  }

  await createTableIfNotExists(
    pool,
    "entity_type_fields",
    `
    CREATE TABLE [MyWork].[entity_type_fields] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      entity_type_id INT NOT NULL,
      field_key NVARCHAR(100) NOT NULL,
      label NVARCHAR(255) NOT NULL,
      field_type NVARCHAR(50) NOT NULL,
      field_options NVARCHAR(MAX),
      required BIT DEFAULT 0,
      display_order INT DEFAULT 0,
      show_in_row BIT DEFAULT 0,
      is_completion_signal BIT DEFAULT 0,
      rollup NVARCHAR(20) NULL,
      show_column_label BIT DEFAULT 1,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      FOREIGN KEY (entity_type_id) REFERENCES [MyWork].[entity_types](id) ON DELETE CASCADE,
      UNIQUE ([entity_type_id], field_key)
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "entity_type_fields");

  // Backfill the roll-up column for tables that predate it. Mirrors the same
  // block in mysqlSchema.js - createTableIfNotExists is a no-op once the table
  // exists, so the CREATE TABLE body above never reaches an existing install.
  const fieldsRollupExists = await columnExistsAsync(pool, "entity_type_fields", "rollup");
  if (!fieldsRollupExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_type_fields] ADD rollup NVARCHAR(20) NULL");
  }

  // Mirrors mysqlSchema.js - see the note there.
  const fieldsShowLabelExists = await columnExistsAsync(pool, "entity_type_fields", "show_column_label");
  if (!fieldsShowLabelExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_type_fields] ADD show_column_label BIT DEFAULT 1");
  }

  // Seed default fields for system entity types (MSSQL, restored from original schema)
  const escapeSQL2 = (str) => (str ? str.replace(/'/g, "''") : 'NULL');
  const escapeJSON = (obj) => (obj ? escapeSQL2(JSON.stringify(obj)) : 'NULL');

  // Seed default fields for system entity types. Array order is display_order.
  for (const type of SYSTEM_ENTITY_TYPES) {
    const typeResult = await pool.request()
      .query(`SELECT id FROM [MyWork].[entity_types] WHERE slug = '${escapeSQL2(type.slug)}'`);

    if (typeResult.recordset.length === 0) continue;
    const typeId = typeResult.recordset[0].id;

    for (let i = 0; i < type.fields.length; i++) {
      const field = type.fields[i];
      const checkResult = await pool.request()
        .query(`SELECT id FROM [MyWork].[entity_type_fields] WHERE entity_type_id = ${typeId} AND field_key = '${escapeSQL2(field.field_key)}'`);

      if (checkResult.recordset.length === 0) {
        const fieldOptionsStr = field.field_options ? `'${escapeJSON(field.field_options)}'` : 'NULL';
        await pool.request()
          .query(`INSERT INTO [MyWork].[entity_type_fields] (entity_type_id, field_key, label, field_type, field_options, required, display_order, show_in_row, is_completion_signal, rollup)
                  VALUES (${typeId}, '${escapeSQL2(field.field_key)}', '${escapeSQL2(field.label)}', '${escapeSQL2(field.field_type)}', ${fieldOptionsStr}, ${field.required ? 1 : 0}, ${i}, ${field.show_in_row ? 1 : 0}, ${field.is_completion_signal ? 1 : 0}, ${field.rollup ? `'${escapeSQL2(field.rollup)}'` : 'NULL'})`);
      } else {
        // Reconcile only what the type editor does not expose - see the same
        // block in mysqlSchema.js. show_in_row is excluded on purpose: it is
        // user-editable now, so overwriting it would reset chosen columns.
        await pool.request()
          .query(`UPDATE [MyWork].[entity_type_fields] SET display_order = ${i}, is_completion_signal = ${field.is_completion_signal ? 1 : 0} WHERE id = ${checkResult.recordset[0].id}`);
      }
    }
  }

  await createTableIfNotExists(
    pool,
    "entity_type_relationships",
    `
    CREATE TABLE [MyWork].[entity_type_relationships] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      parent_type_id INT NOT NULL,
      child_type_id INT NOT NULL,
      relationship_kind NVARCHAR(50) NOT NULL,
      max_children_per_parent INT,
      max_parents_per_child INT,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      FOREIGN KEY (parent_type_id) REFERENCES [MyWork].[entity_types](id) ON DELETE CASCADE,
      FOREIGN KEY (child_type_id) REFERENCES [MyWork].[entity_types](id) ON DELETE CASCADE,
      UNIQUE (parent_type_id, child_type_id, relationship_kind)
    )
  `,
  );

  // Seed the type-to-type relationship rules, mirroring mysqlSchema.js. Neither
  // schema file used to do this, so an install created by a schema run had
  // hierarchical types with no self-nesting rule - a tree whose every
  // drag-to-nest is rejected.
  {
    const typeRows = await pool.request().query('SELECT id, slug FROM [MyWork].[entity_types]');
    const typeIdBySlug = new Map(typeRows.recordset.map((r) => [r.slug, r.id]));

    const insertRule = async (parentSlug, childSlug, rel) => {
      const parentId = typeIdBySlug.get(parentSlug);
      const childId = typeIdBySlug.get(childSlug);
      if (!parentId || !childId) return;
      const existing = await pool.request()
        .query(`SELECT id FROM [MyWork].[entity_type_relationships] WHERE parent_type_id = ${parentId} AND child_type_id = ${childId} AND relationship_kind = '${escapeSQL2(rel.relationship_kind)}'`);
      if (existing.recordset.length > 0) return;
      const maxChildren = rel.max_children_per_parent ?? 'NULL';
      const maxParents = rel.max_parents_per_child ?? 'NULL';
      await pool.request()
        .query(`INSERT INTO [MyWork].[entity_type_relationships] (parent_type_id, child_type_id, relationship_kind, max_children_per_parent, max_parents_per_child)
                VALUES (${parentId}, ${childId}, '${escapeSQL2(rel.relationship_kind)}', ${maxChildren}, ${maxParents})`);
    };

    for (const rel of resolveTypeRelationships()) {
      if (rel.type_slugs) {
        for (const slug of rel.type_slugs) await insertRule(slug, slug, rel);
      } else {
        const children = Array.isArray(rel.type_slugs_child) ? rel.type_slugs_child : [rel.type_slugs_child];
        for (const childSlug of children) await insertRule(rel.type_slugs_parent, childSlug, rel);
      }
    }
  }

  // Generic Entity Storage — content tables (per-context, context_id scoped)

  await createTableIfNotExists(
    pool,
    "entities",
    `
    CREATE TABLE [MyWork].[entities] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      entity_type_id INT NOT NULL,
      context_id INT NOT NULL,
      title NVARCHAR(255) NOT NULL,
      order_index INT DEFAULT 0,
      is_folder BIT DEFAULT 0,
      legacy_work_item_id INT UNIQUE,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      FOREIGN KEY (context_id) REFERENCES [MyWork].[contexts](id) ON DELETE CASCADE
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "entities");

  // Backfill for entities tables created before is_folder existed - see mysqlSchema.js
  if (!(await columnExists(pool, "entities", "is_folder"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[entities] ADD is_folder BIT DEFAULT 0
    `);
  }

  await createTableIfNotExists(
    pool,
    "entity_field_values",
    `
    CREATE TABLE [MyWork].[entity_field_values] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      entity_id INT NOT NULL,
      field_key NVARCHAR(100) NOT NULL,
      value_text NVARCHAR(500),
      value_long NVARCHAR(MAX),
      value_number DECIMAL(15,2),
      value_date DATE,
      value_bool BIT,
      value_json NVARCHAR(MAX),
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      FOREIGN KEY (entity_id) REFERENCES [MyWork].[entities](id) ON DELETE CASCADE,
      UNIQUE (entity_id, field_key)
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "entity_field_values");

  await createTableIfNotExists(
    pool,
    "entity_relationships",
    `
    CREATE TABLE [MyWork].[entity_relationships] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      context_id INT NOT NULL,
      parent_entity_id INT NOT NULL,
      child_entity_id INT NOT NULL,
      relationship_kind NVARCHAR(50) NOT NULL,
      is_generated BIT DEFAULT 0,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      FOREIGN KEY (context_id) REFERENCES [MyWork].[contexts](id) ON DELETE CASCADE,
      FOREIGN KEY (parent_entity_id) REFERENCES [MyWork].[entities](id) ON DELETE NO ACTION,
      FOREIGN KEY (child_entity_id) REFERENCES [MyWork].[entities](id) ON DELETE NO ACTION,
      UNIQUE (parent_entity_id, child_entity_id, relationship_kind)
    )
  `,
  );

  // ===== Legacy <-> entity association bridge =====
  //
  // Mirrors the block of the same name in mysqlSchema.js - see there for the
  // full rationale. Short version: areas/goals/ideas are entities, but work
  // items, projects and templates are still legacy tables, so their edges
  // cannot live in entity_relationships (whose FKs are entities on both
  // sides). These junctions bridge the two id spaces and are retired once
  // work_items and priorities themselves become entities.
  //
  // BEHAVIORAL DIFFERENCE FROM MYSQL: MySQL cascades the delete on both FKs.
  // Here the entity side is ON DELETE NO ACTION, because `work_items` and
  // `entities` both cascade from `contexts`, so two cascading FKs into one
  // junction give SQL Server "may cause cycles or multiple cascade paths" (the
  // same restriction that forces NO ACTION on the parent_id self-references
  // and the to_dos/tickets/areas cross-references elsewhere in this file).
  // Deleting an entity therefore does NOT clean these rows up automatically on
  // MSSQL - entityService.js#deleteEntity removes them explicitly, which is
  // what makes the two engines behave the same from the app's point of view.
  const bridgeJunctions = [
    // [table, legacy column, legacy table, entity column]
    ["work_area_associations", "work_item_id", "work_items", "area_id"],
    ["work_goal_associations", "work_item_id", "work_items", "goal_id"],
    ["work_idea_associations", "work_item_id", "work_items", "idea_id"],
    ["priority_areas", "priority_id", "priorities", "area_id"],
    ["priority_goals", "priority_id", "priorities", "goal_id"],
    ["template_areas", "template_id", "work_item_templates", "area_id"],
    ["template_goals", "template_id", "work_item_templates", "goal_id"],
    // Todos, tasks and tickets are entities now too, so these three join a
    // work item to an `entities` row like the rest. They previously still
    // referenced the legacy to_dos/tasks/tickets tables while those tabs
    // produced entity ids, so dragging one onto a day created the work item
    // and silently lost the link.
    ["work_todo_associations", "work_item_id", "work_items", "todo_id"],
    ["work_task_associations", "work_item_id", "work_items", "task_id"],
    ["work_ticket_associations", "work_item_id", "work_items", "ticket_id"],
  ];

  for (const [table, legacyCol, legacyTable, entityCol] of bridgeJunctions) {
    await createTableIfNotExists(
      pool,
      table,
      `
      CREATE TABLE [MyWork].[${table}] (
        id INT IDENTITY(1,1) PRIMARY KEY,
        ${legacyCol} INT NOT NULL,
        ${entityCol} INT NOT NULL,
        FOREIGN KEY (${legacyCol}) REFERENCES [MyWork].[${legacyTable}](id) ON DELETE CASCADE,
        FOREIGN KEY (${entityCol}) REFERENCES [MyWork].[entities](id) ON DELETE NO ACTION,
        UNIQUE (${legacyCol}, ${entityCol})
      )
    `,
    );
    await createIndexIfNotExists(
      pool,
      `idx_${table}_entity`,
      table,
      `CREATE INDEX idx_${table}_entity ON [MyWork].[${table}] (${entityCol})`,
    );
  }
}
