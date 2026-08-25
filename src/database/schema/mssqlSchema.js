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

// `entities`, NOT `work_items` - see the note on mysqlSchemaExists. This probe
// decides whether app.js redirects every page to /setup, and the legacy table
// it used to name has been dropped.
export async function mssqlSchemaExists(pool) {
  return tableExists(pool, "entities");
}

export async function createMssqlSchema(pool) {
  // Ensure [MyWork] schema exists and set it as the default for this user so
  // all unqualified runtime queries (SELECT * FROM work_items etc.) resolve here.
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'MyWork')
      EXEC('CREATE SCHEMA [MyWork]')
  `);
  // Point this login's default schema at [MyWork] so unqualified runtime queries
  // (SELECT * FROM work_items) resolve here rather than in dbo.
  //
  // dbo cannot be altered - SQL Server rejects it with error 15150 - and that is
  // exactly who you are when you connect as sa or as the database owner. The
  // build used to die on that statement before creating a single table. It is
  // not fatal to the SCHEMA, so it no longer stops the build.
  //
  // It does matter at RUNTIME though: dbo's default schema is dbo, and an
  // unqualified name resolves against the caller's default schema and then dbo,
  // never [MyWork]. So an app connecting as dbo/sa will build a perfectly good
  // schema it then cannot query. Connect as a dedicated user instead - that
  // user can be given the default schema, which is what this statement is for.
  try {
    await pool.request().query(`
      DECLARE @sql NVARCHAR(MAX) = 'ALTER USER [' + USER_NAME() + '] WITH DEFAULT_SCHEMA = [MyWork]'
      EXEC(@sql)
    `);
  } catch (error) {
    if (error.number !== 15150) throw error;
    console.warn(
      '[mssqlSchema] Connected as dbo, whose default schema cannot be changed. '
      + 'The schema will build, but unqualified queries will not find it at runtime. '
      + 'Connect as a dedicated (non-dbo) user for normal operation.'
    );
  }

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

  // The `categories` table is gone - see RETIRED_TABLES at the end of this
  // file. It was a static goal-grouping list, unrelated to the Categories TYPE
  // (slug `category`, formerly `area`), which lives in entities like every
  // other editable type. Nothing read it.

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

  // The `entities` soft-delete backfill used to sit HERE, roughly 950 lines
  // before [MyWork].[entities] is created, and it is what produced "Cannot find
  // the object 'MyWork.entities' because it does not exist or you do not have
  // permissions" on every attempt to build this schema from nothing. It has
  // moved to directly after that CREATE TABLE; see the matching move in
  // mysqlSchema.js, which had the identical fault.

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

  // The `work_items` table is gone - see RETIRED_TABLES at the end of this
  // file. Dailies are entities of type `daily` now; the rows were moved by
  // scripts/phase10-migrate-work-items.js, which also repointed the two
  // junctions that used to reference work_items(id).

  // work_source_associations: created further down, alongside
  // work_entity_associations - see the matching note in mysqlSchema.js. Its
  // daily_id column now points at `entities`, which does not exist yet
  // at this point in the file.



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



  // idea_links table removed in Phase 1 (ideas migrated to generic entities)


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

  // The work_items -> to_dos/tasks recurrence FKs went with the table.

  // Create contexts table (top-level scope toggle, e.g. Work vs Life vs Hobbies -
  // not to be confused with Categories, which are entities of type `category`)
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

  // The `tickets` table is gone - see RETIRED_TABLES at the end of this file.
  // Unrelated to the Tickets TYPE (slug `ticket`), which lives in entities like
  // every other editable type. Nothing read the table.

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
    "work_item_templates",
    "to_dos",
    "tasks",
  ];
  // "work_items" and "tickets" were here until they were retired - see
  // RETIRED_TABLES. Leaving a dropped table in this list makes the ALTER below
  // throw on every schema run.
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

  // Priorities used to be uniquely constrained globally (only one project ever
  // named "Meetings" in the whole app); widened to per-context now that
  // context_id exists, so the same name can exist in different contexts.
  await createIndexIfNotExists(
    pool,
    "unique_context_title",
    "priorities",
    "CREATE UNIQUE INDEX unique_context_title ON [MyWork].[priorities](context_id, title)",
  );

  // The cross-entity FK columns this section used to add are all gone with the
  // tables they joined (areas, goals, tickets). Cross-entity relationships live
  // in entity_relationships now, which has no cycle problem because both sides
  // point at the same table. The cycle rule itself still applies to the
  // self-referencing parent_id columns above - see the note there.

  // The to_dos <-> tickets cross-links went with the `tickets` table. Both sides
  // were FKs into a table nothing read; cross-entity relationships live in
  // entity_relationships now.

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
      supports_folders BIT DEFAULT 1,
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
  const typesCategoryExists = await columnExists(pool, "entity_types", "type_category");
  if (!typesCategoryExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD type_category NVARCHAR(20) DEFAULT 'editable' CHECK (type_category IN ('editable','template','daily','external'))");
  }

  // Backfill for entity_types created before is_visible existed - see mysqlSchema.js
  if (!(await columnExists(pool, "entity_types", "is_visible"))) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD is_visible BIT DEFAULT 1");
  }

  // See mysqlSchema.js for what supports_folders means.
  if (!(await columnExists(pool, "entity_types", "supports_folders"))) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD supports_folders BIT DEFAULT 1");
  }

  const typesExternalSourceExists = await columnExists(pool, "entity_types", "external_source");
  if (!typesExternalSourceExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD external_source NVARCHAR(100)");
  }

  // Where the Title column sits among the field columns - see mysqlSchema.js.
  const typesTitleOrderExists = await columnExists(pool, "entity_types", "title_order");
  if (!typesTitleOrderExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD title_order INT NOT NULL DEFAULT 0");
  }

  const typesTemplateStructureExists = await columnExists(pool, "entity_types", "template_structure");
  if (!typesTemplateStructureExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_types] ADD template_structure NVARCHAR(MAX)");
  }

  // Seed system entity types if they don't exist (MSSQL)
  // Note: work_item represents individual items that can be associated with a Daily
  //
  // EVERY value below is bound as a parameter, never interpolated into the SQL
  // text. That is not only about injection: a T-SQL literal written as '...'
  // is a VARCHAR literal, so an emoji in it is converted to the database code
  // page - which is to say to '?' - on its way into an NVARCHAR column. Icons
  // are emoji, and this is exactly how every icon on an MSSQL install was
  // being replaced by '?' on each server start. request.input() lets the
  // driver bind a JS string as NVarChar, which is Unicode-safe. If you add a
  // statement here, bind its values; do not build the literal yourself.

  // Slug renames - the twin of the block in mysqlSchema.js, and it MUST run
  // before the seed loop below for the same reason: seeding matches on slug, so
  // a renamed type reads as a missing one and would be inserted a second time,
  // giving two Dailies tabs with the records in only one of them.
  //
  // A slug is now the singular of its label (Dailies/daily, Categories/category)
  // rather than the pre-migration name.
  // Guarded because [MyWork].[entities] is created later in this file - see the
  // matching note in mysqlSchema.js. T-SQL resolves table names at compile time
  // for the whole batch, so the reference has to be kept out of the statement
  // entirely, not just out of the executed branch.
  const hasEntities = await tableExists(pool, "entities");
  await pool.request().query(
    hasEntities
      ? `DELETE FROM [MyWork].[entity_types]
          WHERE slug = 'daily' AND deleted_at IS NOT NULL
            AND NOT EXISTS (
              SELECT 1 FROM [MyWork].[entities]
               WHERE [entities].entity_type_id = [entity_types].id
            )`
      : `DELETE FROM [MyWork].[entity_types] WHERE slug = 'daily' AND deleted_at IS NOT NULL`,
  );
  const renameType = async (from, to, label, labelSingular) => {
    const clash = await pool.request()
      .input('slug', to)
      .query('SELECT id FROM [MyWork].[entity_types] WHERE slug = @slug');
    if (clash.recordset.length) return;             // already renamed, or taken
    // The label moves with the slug - the seed loop below only ever INSERTs, so
    // an existing type would otherwise keep its old label forever.
    await pool.request()
      .input('to', to)
      .input('label', label)
      .input('labelSingular', labelSingular)
      .input('from', from)
      .query('UPDATE [MyWork].[entity_types] SET slug = @to, label = @label, label_singular = @labelSingular WHERE slug = @from');
  };
  await renameType('work_item', 'daily', 'Dailies', 'Daily');
  await renameType('area', 'category', 'Categories', 'Category');

  // Label repair - see the matching note in mysqlSchema.js. Matched on the exact
  // legacy label so a deliberate rename in Settings is never overwritten.
  await pool.request().query(
    "UPDATE [MyWork].[entity_types] SET label = 'Dailies', label_singular = 'Daily' WHERE slug = 'daily' AND label = 'Work Items'",
  );
  await pool.request().query(
    "UPDATE [MyWork].[entity_types] SET label_singular = 'Category' WHERE slug = 'category' AND label_singular = 'Area'",
  );

  for (const type of SYSTEM_ENTITY_TYPES) {
    const checkResult = await pool.request()
      .input('slug', type.slug)
      .query('SELECT id FROM [MyWork].[entity_types] WHERE slug = @slug');

    if (checkResult.recordset.length === 0) {
      await pool.request()
        .input('slug', type.slug)
        .input('label', type.label)
        .input('labelSingular', type.label_singular)
        .input('icon', type.icon)
        .input('primaryDateField', type.primary_date_field ?? null)
        .input('supportsHierarchy', type.supports_hierarchy ? 1 : 0)
        .input('orderIndex', SYSTEM_ENTITY_TYPES.indexOf(type))
        .query(`INSERT INTO [MyWork].[entity_types] (slug, label, label_singular, icon, type_category, supports_hierarchy, is_system, primary_date_field, order_index)
                VALUES (@slug, @label, @labelSingular, @icon, 'editable', @supportsHierarchy, 1, @primaryDateField, @orderIndex)`);
    }
  }

  // Seed special types (Daily day container and External integrations) if they don't exist (MSSQL)
  // Repair forbidden icons on existing installs - mirrors mysqlSchema.js. A
  // folder-like icon is never a legitimate customisation, so overwriting it
  // cannot clobber a deliberate choice. Labels are deliberately not touched.
  //
  // The comparison is forced to a binary collation. Legacy (non-_SC) database
  // collations treat every supplementary-plane code point as undefined and
  // therefore equal to every other, so N'📍' IN (N'📁', N'📂') is TRUE and this
  // repair fired on Priorities, Categories, Goals, Tasks, Tickets, Ideas and
  // Templates - every icon outside the BMP - rather than only on the two
  // folder icons it is meant to catch. BIN2 compares by code point, so it
  // matches the two icons named and nothing else.
  for (const type of SYSTEM_ENTITY_TYPES) {
    await pool.request()
      .input('slug', type.slug)
      .input('icon', type.icon)
      .query(`UPDATE [MyWork].[entity_types] SET icon = @icon
              WHERE slug = @slug
                AND icon COLLATE Latin1_General_100_BIN2
                    IN (N'\u{1F4C1}' COLLATE Latin1_General_100_BIN2,
                        N'\u{1F4C2}' COLLATE Latin1_General_100_BIN2)`);
  }

  // Put back icons that a previous build destroyed. Until this was fixed, the
  // repair above wrote its replacement as a VARCHAR literal, so every emoji it
  // touched was stored as literal question marks - one per code unit, so '??'
  // for a supplementary-plane icon. '?' is never a legitimate icon (the type
  // editor offers an emoji picker), so a column that is nothing but question
  // marks is damage, not a choice, and restoring the seed value cannot clobber
  // a real customisation. Without this an affected install stays broken until
  // someone finds Settings > Entity Types > Restore all to defaults.
  for (const type of SYSTEM_ENTITY_TYPES) {
    await pool.request()
      .input('slug', type.slug)
      .input('icon', type.icon)
      .query(`UPDATE [MyWork].[entity_types] SET icon = @icon
              WHERE slug = @slug AND icon IS NOT NULL AND icon != '' AND icon NOT LIKE '%[^?]%'`);
  }

  // Daily = read-only type representing one complete day's work (a tree of all associated items)
  for (const type of SPECIAL_ENTITY_TYPES) {
    const checkResult = await pool.request()
      .input('slug', type.slug)
      .query('SELECT id FROM [MyWork].[entity_types] WHERE slug = @slug');

    if (checkResult.recordset.length === 0) {
      await pool.request()
        .input('slug', type.slug)
        .input('label', type.label)
        .input('labelSingular', type.label_singular)
        .input('icon', type.icon)
        .input('typeCategory', type.type_category)
        .input('externalSource', type.external_source ?? null)
        .query(`INSERT INTO [MyWork].[entity_types] (slug, label, label_singular, icon, type_category, external_source, supports_hierarchy, is_system, order_index)
                VALUES (@slug, @label, @labelSingular, @icon, @typeCategory, @externalSource, 0, 1, 0)`);
    }
  }

  // See the matching note in mysqlSchema.js. The statement that used to retire
  // 'daily' here is GONE and must not come back: `daily` is now the Dailies type
  // itself, so retiring it would soft-delete the live tab on every restart.
  await pool.request().query(
    "UPDATE [MyWork].[entity_types] SET deleted_at = NULL WHERE slug = 'daily' AND is_system = 1",
  );

  await createTableIfNotExists(
    pool,
    "entity_type_fields",
    `
    CREATE TABLE [MyWork].[entity_type_fields] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      entity_type_id INT NOT NULL,
      field_key NVARCHAR(100) NOT NULL,
      label NVARCHAR(255) NOT NULL,
      -- NVARCHAR, not a CHECK list: MySQL keeps this as an ENUM that has to be
      -- widened for every new field type (see mysqlSchema.js), and mirroring
      -- that here as a constraint would mean two places to change and a
      -- migration to alter. A new field type needs no change on this side.
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
  const fieldsRollupExists = await columnExists(pool, "entity_type_fields", "rollup");
  if (!fieldsRollupExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_type_fields] ADD rollup NVARCHAR(20) NULL");
  }

  // Mirrors mysqlSchema.js - see the note there.
  const fieldsShowLabelExists = await columnExists(pool, "entity_type_fields", "show_column_label");
  if (!fieldsShowLabelExists) {
    await pool.request().query("ALTER TABLE [MyWork].[entity_type_fields] ADD show_column_label BIT DEFAULT 1");
  }

  // Seed default fields for system entity types. Array order is display_order.
  // Values are bound, not interpolated - a field label is NVARCHAR and any
  // non-ASCII character in one would be mangled by a VARCHAR literal exactly
  // the way the type icons were. See the note on the entity_types seed above.
  for (const type of SYSTEM_ENTITY_TYPES) {
    const typeResult = await pool.request()
      .input('slug', type.slug)
      .query('SELECT id FROM [MyWork].[entity_types] WHERE slug = @slug');

    if (typeResult.recordset.length === 0) continue;
    const typeId = typeResult.recordset[0].id;

    for (let i = 0; i < type.fields.length; i++) {
      const field = type.fields[i];
      const checkResult = await pool.request()
        .input('typeId', typeId)
        .input('fieldKey', field.field_key)
        .query('SELECT id FROM [MyWork].[entity_type_fields] WHERE entity_type_id = @typeId AND field_key = @fieldKey');

      if (checkResult.recordset.length === 0) {
        await pool.request()
          .input('typeId', typeId)
          .input('fieldKey', field.field_key)
          .input('label', field.label)
          .input('fieldType', field.field_type)
          .input('fieldOptions', field.field_options ? JSON.stringify(field.field_options) : null)
          .input('required', field.required ? 1 : 0)
          .input('displayOrder', i)
          .input('showInRow', field.show_in_row ? 1 : 0)
          .input('isCompletionSignal', field.is_completion_signal ? 1 : 0)
          .input('rollup', field.rollup ?? null)
          .query(`INSERT INTO [MyWork].[entity_type_fields] (entity_type_id, field_key, label, field_type, field_options, required, display_order, show_in_row, is_completion_signal, rollup)
                  VALUES (@typeId, @fieldKey, @label, @fieldType, @fieldOptions, @required, @displayOrder, @showInRow, @isCompletionSignal, @rollup)`);
      } else {
        // Reconcile only what the type editor does not expose - see the same
        // block in mysqlSchema.js. show_in_row is excluded on purpose: it is
        // user-editable now, so overwriting it would reset chosen columns.
        await pool.request()
          .input('displayOrder', i)
          .input('isCompletionSignal', field.is_completion_signal ? 1 : 0)
          .input('id', checkResult.recordset[0].id)
          .query('UPDATE [MyWork].[entity_type_fields] SET display_order = @displayOrder, is_completion_signal = @isCompletionSignal WHERE id = @id');
      }
    }
  }

  // Worked Time drift repair - the twin of the block in mysqlSchema.js. Matched
  // on the exact stale pair so a deliberately retyped field is left alone.
  await pool.request().query(
    `UPDATE [MyWork].[entity_type_fields] SET field_type = 'duration', label = 'Worked Time'
      WHERE field_key = 'focus_seconds'
        AND field_type = 'number' AND label = 'Focus time (seconds)'`,
  );

  // Remove the orphaned `recurrence` field definitions - the twin of the block
  // in mysqlSchema.js. Guarded on having no stored values, so it can only ever
  // remove an EMPTY definition.
  // Guarded because [MyWork].[entity_field_values] is created later in this file
  // - see the matching note in mysqlSchema.js. T-SQL resolves names for the
  // whole batch at compile time, so the reference must be kept out of the
  // statement entirely, not merely out of the branch that runs.
  if (await tableExists(pool, "entity_field_values")) {
    await pool.request().query(
      `DELETE FROM [MyWork].[entity_type_fields]
        WHERE field_type = 'recurrence'
          AND NOT EXISTS (
            SELECT 1 FROM [MyWork].[entity_field_values] v
             WHERE v.field_key = [entity_type_fields].field_key
          )`,
    );
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
      -- Two FKs into the same parent table cannot both cascade: SQL Server
      -- rejects it as "may cause cycles or multiple cascade paths". The parent
      -- side keeps the cascade, the child side is NO ACTION.
      -- Behavioural difference from MySQL: deleting an entity type does NOT
      -- automatically remove rules where it is the CHILD, so entityTypeService
      -- must clear those itself. See the same pattern on entity_relationships.
      FOREIGN KEY (parent_type_id) REFERENCES [MyWork].[entity_types](id) ON DELETE CASCADE,
      FOREIGN KEY (child_type_id) REFERENCES [MyWork].[entity_types](id) ON DELETE NO ACTION,
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
        .input('parentId', parentId)
        .input('childId', childId)
        .input('kind', rel.relationship_kind)
        .query('SELECT id FROM [MyWork].[entity_type_relationships] WHERE parent_type_id = @parentId AND child_type_id = @childId AND relationship_kind = @kind');
      if (existing.recordset.length > 0) return;
      await pool.request()
        .input('parentId', parentId)
        .input('childId', childId)
        .input('kind', rel.relationship_kind)
        .input('maxChildren', rel.max_children_per_parent ?? null)
        .input('maxParents', rel.max_parents_per_child ?? null)
        .query(`INSERT INTO [MyWork].[entity_type_relationships] (parent_type_id, child_type_id, relationship_kind, max_children_per_parent, max_parents_per_child)
                VALUES (@parentId, @childId, @kind, @maxChildren, @maxParents)`);
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
      -- NOT "INT UNIQUE", which is what mysqlSchema.js says and what this file
      -- used to copy. SQL Server counts NULLs as equal to one another in a
      -- UNIQUE constraint, so exactly ONE row may have a NULL here - and every
      -- entity created after the phase-9 migration has NULL, because there is
      -- no legacy work item to point at. On a freshly built MSSQL database the
      -- SECOND record you ever create failed with "Cannot insert duplicate key
      -- ... The duplicate key value is (<NULL>)". The filtered unique index
      -- below restores MySQL's meaning: unique among rows that HAVE a value,
      -- unlimited NULLs.
      legacy_daily_id INT,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      FOREIGN KEY (context_id) REFERENCES [MyWork].[contexts](id) ON DELETE CASCADE
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "entities");

  // Drop the old unconditional UNIQUE constraint on installs that already have
  // it, then add the filtered index. Both halves are idempotent, so this is
  // safe on every schema run.
  await pool.request().query(`
    DECLARE @c SYSNAME = (
      SELECT kc.name FROM sys.key_constraints kc
        JOIN sys.index_columns ic
          ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
        JOIN sys.columns col
          ON col.object_id = ic.object_id AND col.column_id = ic.column_id
       WHERE kc.parent_object_id = OBJECT_ID('[MyWork].[entities]')
         AND kc.type = 'UQ' AND col.name IN ('legacy_daily_id', 'legacy_work_item_id')
    );
    IF @c IS NOT NULL
      EXEC('ALTER TABLE [MyWork].[entities] DROP CONSTRAINT [' + @c + ']');
  `);
  // Only once the column has its NEW name. On an install that predates the
  // rename it is still `legacy_work_item_id` at this point - renameLegacyColumns
  // runs at the end of this file - and naming `legacy_daily_id` here failed the
  // whole build with "Invalid column name". That install gets its index from
  // renameLegacyColumns instead, which recreates it straight after renaming.
  if (await columnExists(pool, "entities", "legacy_daily_id")) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
         WHERE name = 'uq_entities_legacy_daily_id'
           AND object_id = OBJECT_ID('[MyWork].[entities]')
      )
        CREATE UNIQUE INDEX uq_entities_legacy_daily_id
          ON [MyWork].[entities] (legacy_daily_id)
          WHERE legacy_daily_id IS NOT NULL;
    `);
  }

  // Backfill for entities tables created before is_folder existed - see mysqlSchema.js
  if (!(await columnExists(pool, "entities", "is_folder"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[entities] ADD is_folder BIT DEFAULT 0
    `);
  }

  // Soft delete - see the matching block in mysqlSchema.js. These must stay
  // BELOW the CREATE TABLE above; they used to run near the top of this file,
  // against a table that did not exist yet.
  if (!(await columnExists(pool, "entities", "deleted_at"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[entities] ADD deleted_at DATETIME2 NULL
    `);
    await createIndexIfNotExists(
      pool,
      "idx_entities_deleted_at",
      "entities",
      "CREATE INDEX idx_entities_deleted_at ON [MyWork].[entities](deleted_at)",
    );
  }

  // See the matching note in mysqlSchema.js for why the batch is an id.
  if (!(await columnExists(pool, "entities", "deleted_batch"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[entities] ADD deleted_batch NVARCHAR(36) NULL
    `);
    await createIndexIfNotExists(
      pool,
      "idx_entities_deleted_batch",
      "entities",
      "CREATE INDEX idx_entities_deleted_batch ON [MyWork].[entities](deleted_batch)",
    );
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
  // full rationale. Short version: categories, goals, ideas and (as of Phase
  // 10) dailies are entities, but priorities and templates are still legacy
  // tables, so their edges cannot live in entity_relationships (whose FKs are
  // entities on both sides). These junctions bridge the two id spaces and are
  // retired once priorities itself becomes entities.
  //
  // BEHAVIORAL DIFFERENCE FROM MYSQL: MySQL cascades the delete on both FKs.
  // Here the entity side is ON DELETE NO ACTION, because both columns of
  // work_entity_associations/work_source_associations point at `entities` now
  // (a "day" is itself a `daily` entity), and `entities` already cascades
  // from `contexts`, so a second cascading FK into it gives SQL Server "may
  // cause cycles or multiple cascade paths" (the same restriction that forces
  // NO ACTION on the parent_id self-references elsewhere in this file).
  // Deleting an entity therefore
  // does NOT clean these rows up automatically on MSSQL -
  // entityService.js#purgeEntity removes them explicitly (BRIDGE_JUNCTION_COLUMNS),
  // which is what makes the two engines behave the same from the app's point
  // of view.
  const bridgeJunctions = [
    // [table, legacy column, legacy table, entity column]
    ["priority_areas", "priority_id", "priorities", "area_id"],
    ["priority_goals", "priority_id", "priorities", "goal_id"],
    ["template_areas", "template_id", "work_item_templates", "area_id"],
    ["template_goals", "template_id", "work_item_templates", "goal_id"],
    // Todos, tasks and tickets are entities now too, so these three join a
    // work item to an `entities` row like the rest. They previously still
    // referenced the legacy to_dos/tasks/tickets tables while those tabs
    // produced entity ids, so dragging one onto a day created the work item
    // and silently lost the link.
  ];

  // ONE junction for every type, including types invented after this was
  // written - see the note in mysqlSchema.js. daily_id points at
  // `entities`, not the legacy `work_items` table - see the note above this
  // block. Both FKs are NO ACTION for the reason given above; the service
  // tolerates rows surviving an entity delete by joining through entities and
  // cleans them up explicitly on purge.
  await createTableIfNotExists(
    pool,
    "work_entity_associations",
    `
    CREATE TABLE [MyWork].[work_entity_associations] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      daily_id INT NOT NULL,
      entity_id INT NOT NULL,
      order_index INT DEFAULT 0,
      CONSTRAINT fk_wea_work_item FOREIGN KEY (daily_id) REFERENCES [MyWork].[entities](id) ON DELETE NO ACTION,
      CONSTRAINT fk_wea_entity FOREIGN KEY (entity_id) REFERENCES [MyWork].[entities](id) ON DELETE NO ACTION,
      CONSTRAINT unique_work_entity UNIQUE (daily_id, entity_id)
    )
  `,
  );
  await createIndexIfNotExists(
    pool,
    "idx_wea_entity",
    "work_entity_associations",
    "CREATE INDEX idx_wea_entity ON [MyWork].[work_entity_associations] (entity_id)",
  );

  // A source is not an entity, so this one stays a plain junction rather than
  // joining the bridge above - but daily_id is the same entities-pointing,
  // NO-ACTION column as work_entity_associations above, for the same reason.
  await createTableIfNotExists(
    pool,
    "work_source_associations",
    `
    CREATE TABLE [MyWork].[work_source_associations] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      daily_id INT NOT NULL,
      source_id INT NOT NULL,
      CONSTRAINT fk_wsa_work_item FOREIGN KEY (daily_id) REFERENCES [MyWork].[entities](id) ON DELETE NO ACTION,
      CONSTRAINT fk_wsa_source FOREIGN KEY (source_id) REFERENCES [MyWork].[sources](id) ON DELETE CASCADE,
      CONSTRAINT unique_work_source UNIQUE (daily_id, source_id)
    )
  `,
  );

  // A record put on a day WITHOUT a work item wrapped round it. See the same
  // table in mysqlSchema.js for why it exists.
  await createTableIfNotExists(
    pool,
    "daily_entities",
    `
    CREATE TABLE [MyWork].[daily_entities] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      context_id INT NOT NULL,
      date DATE NOT NULL,
      entity_id INT NOT NULL,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      -- NO ACTION, not CASCADE, matching work_entity_associations above:
      -- entities is already the target of a cascading FK, and a second one
      -- gives SQL Server "may cause cycles or multiple cascade paths".
      -- Behavioural difference from MySQL: deleting an entity does NOT remove
      -- its rows here, so entityService.deleteEntity clears them itself - the
      -- same way it already clears the other junctions.
      CONSTRAINT fk_de_entity FOREIGN KEY (entity_id) REFERENCES [MyWork].[entities](id) ON DELETE NO ACTION,
      CONSTRAINT unique_daily_entity UNIQUE (context_id, date, entity_id)
    )
  `,
  );
  await createIndexIfNotExists(
    pool,
    "idx_de_date",
    "daily_entities",
    "CREATE INDEX idx_de_date ON [MyWork].[daily_entities] (context_id, date)",
  );
  await createIndexIfNotExists(
    pool,
    "idx_de_entity",
    "daily_entities",
    "CREATE INDEX idx_de_entity ON [MyWork].[daily_entities] (entity_id)",
  );

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
  await renameLegacyColumns(pool);
  await dropRetiredTables(pool);
}

// The twin of the block in mysqlSchema.js - a `work_item` is a `daily` now.
// SQL Server renames a column through sp_rename, not ALTER TABLE, and takes the
// object as 'schema.table.column'. sp_rename keeps indexes and foreign keys
// pointing at the renamed column, so no constraint work is needed around it.
const LEGACY_COLUMN_RENAMES = [
  ["work_entity_associations", "work_item_id", "daily_id"],
  ["work_source_associations", "work_item_id", "daily_id"],
  ["entities", "legacy_work_item_id", "legacy_daily_id"],
];

async function renameLegacyColumns(pool) {
  for (const [table, from, to] of LEGACY_COLUMN_RENAMES) {
    // Guarded on both sides, so the rename runs once and a re-run is a no-op.
    if (!(await columnExists(pool, table, from))) continue;
    if (await columnExists(pool, table, to)) continue;

    // sp_rename REFUSES to rename a column an index depends on, with
    // "The index '<name>' is dependent on column '<col>'" (error 5074) - the
    // filtered unique index on entities.legacy_work_item_id is exactly such a
    // dependency, so on any existing SQL Server install this rename failed
    // outright until the index was dropped first. Primary keys and unique
    // CONSTRAINTS are left alone: those are not indexes you can simply drop,
    // and none of the columns renamed here carry one.
    const deps = await pool.request()
      .input("t", table)
      .input("c", from)
      .query(`
        SELECT DISTINCT i.name AS name
          FROM sys.indexes i
          JOIN sys.index_columns ic
            ON ic.object_id = i.object_id AND ic.index_id = i.index_id
          JOIN sys.columns col
            ON col.object_id = ic.object_id AND col.column_id = ic.column_id
         WHERE i.object_id = OBJECT_ID('[MyWork].[' + @t + ']')
           AND col.name = @c
           AND i.name IS NOT NULL
           AND i.is_primary_key = 0
           AND i.is_unique_constraint = 0
      `);
    for (const { name } of deps.recordset) {
      await pool.request().query(`DROP INDEX [${name}] ON [MyWork].[${table}]`);
    }

    await pool.request()
      .input("obj", `MyWork.${table}.${from}`)
      .input("to", to)
      .query("EXEC sp_rename @objname = @obj, @newname = @to, @objtype = 'COLUMN'");
  }

  // Put back the filtered unique index the rename above had to drop. It cannot
  // wait for the next schema run: without it two entities could take the same
  // legacy id in the meantime. See the note on the column itself for why the
  // index is filtered rather than a plain UNIQUE.
  if (await columnExists(pool, "entities", "legacy_daily_id")) {
    await pool.request().query(`
      IF NOT EXISTS (
        SELECT 1 FROM sys.indexes
         WHERE name = 'uq_entities_legacy_daily_id'
           AND object_id = OBJECT_ID('[MyWork].[entities]')
      )
        CREATE UNIQUE INDEX uq_entities_legacy_daily_id
          ON [MyWork].[entities] (legacy_daily_id)
          WHERE legacy_daily_id IS NOT NULL;
    `);
  }
}

// The twin of RETIRED_TABLES in mysqlSchema.js - read the note there for what
// each one was and, in particular, why `categories` and `tickets` are NOT the
// Categories and Tickets types. Dropped on every schema run so an existing
// database is cleaned by the same "Fix Schema" that builds a new one.
const RETIRED_TABLES = ["work_items", "tickets", "categories"];

// See the matching note in mysqlSchema.js. This matters MORE on SQL Server:
// phase10-migrate-work-items.js is MySQL-only, so an MSSQL install has to have
// its dailies moved across by hand, and until that happens `work_items` is the
// only place they exist.
async function workItemsSafeToDrop(pool) {
  const rows = (await pool.request()
    .query('SELECT COUNT(*) AS n FROM [MyWork].[work_items]')).recordset[0].n;
  if (rows === 0) return true;
  const migrated = (await pool.request()
    .query('SELECT COUNT(*) AS n FROM [MyWork].[entities] WHERE legacy_daily_id IS NOT NULL'))
    .recordset[0].n;
  return migrated >= rows;
}

async function dropRetiredTables(pool) {
  for (const table of RETIRED_TABLES) {
    if (table === "work_items") {
      if (!(await tableExists(pool, "work_items"))) continue;
      if (!(await workItemsSafeToDrop(pool))) {
        console.warn(
          '[schema] work_items still holds rows with no matching entity - NOT dropping it. '
          + 'Migrate those dailies into `entities` first.',
        );
        continue;
      }
    }
    // SQL Server refuses to drop a table while a foreign key still references
    // it, and unlike MySQL it names every constraint, so drop those first.
    const fks = await pool.request().input("table", table).query(`
      SELECT OBJECT_NAME(fk.parent_object_id) AS t, fk.name AS c
        FROM sys.foreign_keys fk
       WHERE fk.referenced_object_id = OBJECT_ID('[MyWork].[' + @table + ']')
    `);
    for (const { t, c } of fks.recordset) {
      await pool.request().query(`ALTER TABLE [MyWork].[${t}] DROP CONSTRAINT [${c}]`);
    }
    await pool.request().query(`DROP TABLE IF EXISTS [MyWork].[${table}]`);
  }
}
