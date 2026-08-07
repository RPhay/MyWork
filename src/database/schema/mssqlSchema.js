// T-SQL translation of the MyWork schema (see mysqlSchema.js for the canonical
// MySQL version - this is a from-scratch translation for a fresh MSSQL/Azure SQL
// target, not an incremental-migration script, since there is no prior MSSQL
// install to upgrade from. If the MySQL schema changes, mirror the change here too.
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

  await createTableIfNotExists(
    pool,
    "areas",
    `
    CREATE TABLE [MyWork].[areas] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      description NVARCHAR(MAX),
      parent_id INT NULL,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      -- NO ACTION, not CASCADE: SQL Server rejects a self-referencing cascade
      -- here because areas is also the target of other cascading FKs
      -- (priority_areas, template_areas, work_area_associations) - "may
      -- cause cycles or multiple cascade paths". Deleting an area with
      -- children fails with a clear FK-violation error instead of
      -- recursively deleting them (a real behavior difference from MySQL,
      -- which does cascade this - not worth a recursive app-level delete
      -- for this edge case today).
      CONSTRAINT fk_areas_parent FOREIGN KEY (parent_id) REFERENCES [MyWork].[areas](id) ON DELETE NO ACTION
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "areas");

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

  await createTableIfNotExists(
    pool,
    "goals",
    `
    CREATE TABLE [MyWork].[goals] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      year INT NOT NULL,
      name NVARCHAR(255) NOT NULL,
      description NVARCHAR(MAX),
      measurements NVARCHAR(MAX),
      goal_updates NVARCHAR(MAX),
      status NVARCHAR(50) NOT NULL DEFAULT 'Not Started',
      due_date DATE NULL,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "goals");
  await createIndexIfNotExists(
    pool,
    "idx_goals_year",
    "goals",
    "CREATE INDEX idx_goals_year ON [MyWork].[goals](year)",
  );
  await createIndexIfNotExists(
    pool,
    "idx_goals_status",
    "goals",
    "CREATE INDEX idx_goals_status ON [MyWork].[goals](status)",
  );

  await createTableIfNotExists(
    pool,
    "goal_categories",
    `
    CREATE TABLE [MyWork].[goal_categories] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      goal_id INT NOT NULL,
      category_id INT NOT NULL,
      CONSTRAINT fk_goal_categories_goal FOREIGN KEY (goal_id) REFERENCES [MyWork].[goals](id) ON DELETE CASCADE,
      CONSTRAINT fk_goal_categories_category FOREIGN KEY (category_id) REFERENCES [MyWork].[categories](id) ON DELETE CASCADE,
      CONSTRAINT unique_goal_category UNIQUE (goal_id, category_id)
    )
  `,
  );

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

  await createTableIfNotExists(
    pool,
    "priority_areas",
    `
    CREATE TABLE [MyWork].[priority_areas] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      priority_id INT NOT NULL,
      area_id INT NOT NULL,
      CONSTRAINT fk_priority_areas_priority FOREIGN KEY (priority_id) REFERENCES [MyWork].[priorities](id) ON DELETE CASCADE,
      CONSTRAINT fk_priority_areas_area FOREIGN KEY (area_id) REFERENCES [MyWork].[areas](id) ON DELETE CASCADE,
      CONSTRAINT unique_priority_area UNIQUE (priority_id, area_id)
    )
  `,
  );

  await createTableIfNotExists(
    pool,
    "priority_goals",
    `
    CREATE TABLE [MyWork].[priority_goals] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      priority_id INT NOT NULL,
      goal_id INT NOT NULL,
      CONSTRAINT fk_priority_goals_priority FOREIGN KEY (priority_id) REFERENCES [MyWork].[priorities](id) ON DELETE CASCADE,
      CONSTRAINT fk_priority_goals_goal FOREIGN KEY (goal_id) REFERENCES [MyWork].[goals](id) ON DELETE CASCADE,
      CONSTRAINT unique_priority_goal UNIQUE (priority_id, goal_id)
    )
  `,
  );

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
      order_index INT DEFAULT 0,
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

  await createTableIfNotExists(
    pool,
    "work_goal_associations",
    `
    CREATE TABLE [MyWork].[work_goal_associations] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      work_item_id INT NOT NULL,
      goal_id INT NOT NULL,
      CONSTRAINT fk_wga_work_item FOREIGN KEY (work_item_id) REFERENCES [MyWork].[work_items](id) ON DELETE CASCADE,
      CONSTRAINT fk_wga_goal FOREIGN KEY (goal_id) REFERENCES [MyWork].[goals](id) ON DELETE CASCADE,
      CONSTRAINT unique_work_goal UNIQUE (work_item_id, goal_id)
    )
  `,
  );

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

  await createTableIfNotExists(
    pool,
    "work_area_associations",
    `
    CREATE TABLE [MyWork].[work_area_associations] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      work_item_id INT NOT NULL,
      area_id INT NOT NULL,
      CONSTRAINT fk_waa_work_item FOREIGN KEY (work_item_id) REFERENCES [MyWork].[work_items](id) ON DELETE CASCADE,
      CONSTRAINT fk_waa_area FOREIGN KEY (area_id) REFERENCES [MyWork].[areas](id) ON DELETE CASCADE,
      CONSTRAINT unique_work_area UNIQUE (work_item_id, area_id)
    )
  `,
  );

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
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_templates_source FOREIGN KEY (source_id) REFERENCES [MyWork].[sources](id) ON DELETE SET NULL
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "work_item_templates");

  await createTableIfNotExists(
    pool,
    "template_areas",
    `
    CREATE TABLE [MyWork].[template_areas] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      template_id INT NOT NULL,
      area_id INT NOT NULL,
      CONSTRAINT fk_template_areas_template FOREIGN KEY (template_id) REFERENCES [MyWork].[work_item_templates](id) ON DELETE CASCADE,
      CONSTRAINT fk_template_areas_area FOREIGN KEY (area_id) REFERENCES [MyWork].[areas](id) ON DELETE CASCADE,
      CONSTRAINT unique_template_area UNIQUE (template_id, area_id)
    )
  `,
  );

  await createTableIfNotExists(
    pool,
    "template_goals",
    `
    CREATE TABLE [MyWork].[template_goals] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      template_id INT NOT NULL,
      goal_id INT NOT NULL,
      CONSTRAINT fk_template_goals_template FOREIGN KEY (template_id) REFERENCES [MyWork].[work_item_templates](id) ON DELETE CASCADE,
      CONSTRAINT fk_template_goals_goal FOREIGN KEY (goal_id) REFERENCES [MyWork].[goals](id) ON DELETE CASCADE,
      CONSTRAINT unique_template_goal UNIQUE (template_id, goal_id)
    )
  `,
  );

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
    "to_do_folders",
    `
    CREATE TABLE [MyWork].[to_do_folders] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      parent_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      -- NO ACTION, not CASCADE - see the note on fk_areas_parent above.
      CONSTRAINT fk_to_do_folders_parent FOREIGN KEY (parent_id) REFERENCES [MyWork].[to_do_folders](id) ON DELETE NO ACTION
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "to_do_folders");

  await createTableIfNotExists(
    pool,
    "to_dos",
    `
    CREATE TABLE [MyWork].[to_dos] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      notes NVARCHAR(MAX),
      folder_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_to_dos_folder FOREIGN KEY (folder_id) REFERENCES [MyWork].[to_do_folders](id) ON DELETE SET NULL
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "to_dos");

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

  await createTableIfNotExists(
    pool,
    "idea_folders",
    `
    CREATE TABLE [MyWork].[idea_folders] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      parent_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      -- NO ACTION, not CASCADE - see the note on fk_areas_parent above.
      CONSTRAINT fk_idea_folders_parent FOREIGN KEY (parent_id) REFERENCES [MyWork].[idea_folders](id) ON DELETE NO ACTION
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "idea_folders");

  await createTableIfNotExists(
    pool,
    "ideas",
    `
    CREATE TABLE [MyWork].[ideas] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      notes NVARCHAR(MAX),
      folder_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_ideas_folder FOREIGN KEY (folder_id) REFERENCES [MyWork].[idea_folders](id) ON DELETE SET NULL
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "ideas");

  await createTableIfNotExists(
    pool,
    "idea_items",
    `
    CREATE TABLE [MyWork].[idea_items] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      idea_id INT NOT NULL,
      text NVARCHAR(500) NOT NULL,
      is_done BIT DEFAULT 0,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_idea_items_idea FOREIGN KEY (idea_id) REFERENCES [MyWork].[ideas](id) ON DELETE CASCADE
    )
  `,
  );

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

  await createTableIfNotExists(
    pool,
    "idea_links",
    `
    CREATE TABLE [MyWork].[idea_links] (
      id INT IDENTITY(1,1) PRIMARY KEY,
      idea_id INT NOT NULL,
      url NVARCHAR(2048) NOT NULL,
      title NVARCHAR(255),
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_idea_links_idea FOREIGN KEY (idea_id) REFERENCES [MyWork].[ideas](id) ON DELETE CASCADE
    )
  `,
  );

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
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `,
  );
  await createUpdatedAtTrigger(pool, "tasks");

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

  if (!(await columnExists(pool, "contexts", "folder_id"))) {
    await pool.request().query(`
      ALTER TABLE [MyWork].[contexts] ADD
        folder_id INT NULL CONSTRAINT fk_contexts_folder FOREIGN KEY REFERENCES [MyWork].[context_folders](id) ON DELETE SET NULL
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
    "areas",
    "priorities",
    "goals",
    "work_items",
    "work_item_templates",
    "to_do_folders",
    "to_dos",
    "idea_folders",
    "ideas",
    "tasks",
    "tickets",
  ];
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
  await createIndexIfNotExists(
    pool,
    "unique_context_name",
    "areas",
    "CREATE UNIQUE INDEX unique_context_name ON [MyWork].[areas](context_id, name)",
  );
  await createIndexIfNotExists(
    pool,
    "unique_context_title",
    "priorities",
    "CREATE UNIQUE INDEX unique_context_title ON [MyWork].[priorities](context_id, title)",
  );
  await createIndexIfNotExists(
    pool,
    "unique_context_year_name",
    "goals",
    "CREATE UNIQUE INDEX unique_context_year_name ON [MyWork].[goals](context_id, year, name)",
  );
}
