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
  const result = await pool.request().query(`SELECT COUNT(*) as cnt FROM sys.tables WHERE name = '${tableName}'`);
  return result.recordset[0].cnt > 0;
}

async function createTableIfNotExists(pool, tableName, ddl) {
  if (!(await tableExists(pool, tableName))) {
    await pool.request().query(ddl);
  }
}

async function createIndexIfNotExists(pool, indexName, tableName, ddl) {
  const result = await pool.request().query(
    `SELECT COUNT(*) as cnt FROM sys.indexes WHERE name = '${indexName}' AND object_id = OBJECT_ID('${tableName}')`
  );
  if (result.recordset[0].cnt === 0) {
    await pool.request().query(ddl);
  }
}

async function createTriggerIfNotExists(pool, triggerName, ddl) {
  const result = await pool.request().query(`SELECT COUNT(*) as cnt FROM sys.triggers WHERE name = '${triggerName}'`);
  if (result.recordset[0].cnt === 0) {
    await pool.request().query(ddl);
  }
}

// Adds an AFTER UPDATE trigger that bumps `updated_at` to now, mirroring MySQL's
// "ON UPDATE CURRENT_TIMESTAMP" column behavior.
async function createUpdatedAtTrigger(pool, tableName) {
  const triggerName = `trg_${tableName}_updated_at`;
  await createTriggerIfNotExists(pool, triggerName, `
    CREATE TRIGGER ${triggerName} ON ${tableName}
    AFTER UPDATE AS
    BEGIN
      SET NOCOUNT ON;
      UPDATE t SET updated_at = SYSUTCDATETIME()
      FROM ${tableName} t
      INNER JOIN inserted i ON t.id = i.id;
    END
  `);
}

export async function mssqlSchemaExists(pool) {
  return tableExists(pool, 'work_items');
}

export async function createMssqlSchema(pool) {
  await createTableIfNotExists(pool, 'sources', `
    CREATE TABLE sources (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      type NVARCHAR(100) NOT NULL,
      config NVARCHAR(MAX),
      enabled BIT DEFAULT 1,
      status NVARCHAR(50) DEFAULT 'not_configured',
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `);
  await createUpdatedAtTrigger(pool, 'sources');

  await createTableIfNotExists(pool, 'categories', `
    CREATE TABLE categories (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL UNIQUE,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `);

  // Seed the standard goal categories so they're selectable out of the box
  const standardCategories = ['Financial', 'Impact', 'M&A', 'Operational Excellence', 'Other', 'People', 'Technology Excellence'];
  for (const name of standardCategories) {
    const request = pool.request();
    request.input('name', name);
    await request.query('IF NOT EXISTS (SELECT 1 FROM categories WHERE name = @name) INSERT INTO categories (name) VALUES (@name)');
  }

  await createTableIfNotExists(pool, 'areas', `
    CREATE TABLE areas (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL UNIQUE,
      description NVARCHAR(MAX),
      parent_id INT NULL,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_areas_parent FOREIGN KEY (parent_id) REFERENCES areas(id) ON DELETE CASCADE
    )
  `);
  await createUpdatedAtTrigger(pool, 'areas');

  await createTableIfNotExists(pool, 'years', `
    CREATE TABLE years (
      id INT IDENTITY(1,1) PRIMARY KEY,
      year INT NOT NULL UNIQUE,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `);

  // Seed the current year so the dropdown isn't empty on a fresh install
  const currentYear = new Date().getFullYear();
  const yearRequest = pool.request();
  yearRequest.input('year', currentYear);
  await yearRequest.query(`
    IF NOT EXISTS (SELECT 1 FROM years WHERE year = @year)
      INSERT INTO years (year) VALUES (@year)
  `);

  await createTableIfNotExists(pool, 'goals', `
    CREATE TABLE goals (
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
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT unique_year_name UNIQUE (year, name)
    )
  `);
  await createUpdatedAtTrigger(pool, 'goals');
  await createIndexIfNotExists(pool, 'idx_goals_year', 'goals', 'CREATE INDEX idx_goals_year ON goals(year)');
  await createIndexIfNotExists(pool, 'idx_goals_status', 'goals', 'CREATE INDEX idx_goals_status ON goals(status)');

  await createTableIfNotExists(pool, 'goal_categories', `
    CREATE TABLE goal_categories (
      id INT IDENTITY(1,1) PRIMARY KEY,
      goal_id INT NOT NULL,
      category_id INT NOT NULL,
      CONSTRAINT fk_goal_categories_goal FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      CONSTRAINT fk_goal_categories_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      CONSTRAINT unique_goal_category UNIQUE (goal_id, category_id)
    )
  `);

  await createTableIfNotExists(pool, 'priorities', `
    CREATE TABLE priorities (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL UNIQUE,
      source_id INT NULL,
      parent_id INT NULL,
      notes NVARCHAR(MAX),
      status NVARCHAR(50) NOT NULL DEFAULT 'Not Started',
      order_index INT DEFAULT 0,
      is_weekly BIT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_priorities_source FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
      CONSTRAINT fk_priorities_parent FOREIGN KEY (parent_id) REFERENCES priorities(id) ON DELETE CASCADE
    )
  `);
  await createUpdatedAtTrigger(pool, 'priorities');
  await createIndexIfNotExists(pool, 'idx_priorities_order', 'priorities', 'CREATE INDEX idx_priorities_order ON priorities(order_index)');

  await createTableIfNotExists(pool, 'priority_areas', `
    CREATE TABLE priority_areas (
      id INT IDENTITY(1,1) PRIMARY KEY,
      priority_id INT NOT NULL,
      area_id INT NOT NULL,
      CONSTRAINT fk_priority_areas_priority FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE,
      CONSTRAINT fk_priority_areas_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
      CONSTRAINT unique_priority_area UNIQUE (priority_id, area_id)
    )
  `);

  await createTableIfNotExists(pool, 'priority_goals', `
    CREATE TABLE priority_goals (
      id INT IDENTITY(1,1) PRIMARY KEY,
      priority_id INT NOT NULL,
      goal_id INT NOT NULL,
      CONSTRAINT fk_priority_goals_priority FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE,
      CONSTRAINT fk_priority_goals_goal FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      CONSTRAINT unique_priority_goal UNIQUE (priority_id, goal_id)
    )
  `);

  await createTableIfNotExists(pool, 'work_items', `
    CREATE TABLE work_items (
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
  `);
  await createUpdatedAtTrigger(pool, 'work_items');
  await createIndexIfNotExists(pool, 'idx_work_items_date', 'work_items', 'CREATE INDEX idx_work_items_date ON work_items(date)');
  await createIndexIfNotExists(pool, 'idx_work_items_status', 'work_items', 'CREATE INDEX idx_work_items_status ON work_items(status)');

  await createTableIfNotExists(pool, 'work_goal_associations', `
    CREATE TABLE work_goal_associations (
      id INT IDENTITY(1,1) PRIMARY KEY,
      work_item_id INT NOT NULL,
      goal_id INT NOT NULL,
      CONSTRAINT fk_wga_work_item FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_wga_goal FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      CONSTRAINT unique_work_goal UNIQUE (work_item_id, goal_id)
    )
  `);

  await createTableIfNotExists(pool, 'work_priority_associations', `
    CREATE TABLE work_priority_associations (
      id INT IDENTITY(1,1) PRIMARY KEY,
      work_item_id INT NOT NULL,
      priority_id INT NOT NULL,
      CONSTRAINT fk_wpa_work_item FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_wpa_priority FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE,
      CONSTRAINT unique_work_priority UNIQUE (work_item_id, priority_id)
    )
  `);

  await createTableIfNotExists(pool, 'work_area_associations', `
    CREATE TABLE work_area_associations (
      id INT IDENTITY(1,1) PRIMARY KEY,
      work_item_id INT NOT NULL,
      area_id INT NOT NULL,
      CONSTRAINT fk_waa_work_item FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_waa_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
      CONSTRAINT unique_work_area UNIQUE (work_item_id, area_id)
    )
  `);

  await createTableIfNotExists(pool, 'work_source_associations', `
    CREATE TABLE work_source_associations (
      id INT IDENTITY(1,1) PRIMARY KEY,
      work_item_id INT NOT NULL,
      source_id INT NOT NULL,
      CONSTRAINT fk_wsa_work_item FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      CONSTRAINT fk_wsa_source FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
      CONSTRAINT unique_work_source UNIQUE (work_item_id, source_id)
    )
  `);

  await createTableIfNotExists(pool, 'work_item_templates', `
    CREATE TABLE work_item_templates (
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
      CONSTRAINT fk_templates_source FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
    )
  `);
  await createUpdatedAtTrigger(pool, 'work_item_templates');

  await createTableIfNotExists(pool, 'template_areas', `
    CREATE TABLE template_areas (
      id INT IDENTITY(1,1) PRIMARY KEY,
      template_id INT NOT NULL,
      area_id INT NOT NULL,
      CONSTRAINT fk_template_areas_template FOREIGN KEY (template_id) REFERENCES work_item_templates(id) ON DELETE CASCADE,
      CONSTRAINT fk_template_areas_area FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
      CONSTRAINT unique_template_area UNIQUE (template_id, area_id)
    )
  `);

  await createTableIfNotExists(pool, 'template_goals', `
    CREATE TABLE template_goals (
      id INT IDENTITY(1,1) PRIMARY KEY,
      template_id INT NOT NULL,
      goal_id INT NOT NULL,
      CONSTRAINT fk_template_goals_template FOREIGN KEY (template_id) REFERENCES work_item_templates(id) ON DELETE CASCADE,
      CONSTRAINT fk_template_goals_goal FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      CONSTRAINT unique_template_goal UNIQUE (template_id, goal_id)
    )
  `);

  await createTableIfNotExists(pool, 'template_priorities', `
    CREATE TABLE template_priorities (
      id INT IDENTITY(1,1) PRIMARY KEY,
      template_id INT NOT NULL,
      priority_id INT NOT NULL,
      CONSTRAINT fk_template_priorities_template FOREIGN KEY (template_id) REFERENCES work_item_templates(id) ON DELETE CASCADE,
      CONSTRAINT fk_template_priorities_priority FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE,
      CONSTRAINT unique_template_priority UNIQUE (template_id, priority_id)
    )
  `);

  await createTableIfNotExists(pool, 'to_do_folders', `
    CREATE TABLE to_do_folders (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      parent_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_to_do_folders_parent FOREIGN KEY (parent_id) REFERENCES to_do_folders(id) ON DELETE CASCADE
    )
  `);
  await createUpdatedAtTrigger(pool, 'to_do_folders');

  await createTableIfNotExists(pool, 'to_dos', `
    CREATE TABLE to_dos (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      notes NVARCHAR(MAX),
      folder_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_to_dos_folder FOREIGN KEY (folder_id) REFERENCES to_do_folders(id) ON DELETE SET NULL
    )
  `);
  await createUpdatedAtTrigger(pool, 'to_dos');

  await createTableIfNotExists(pool, 'to_do_items', `
    CREATE TABLE to_do_items (
      id INT IDENTITY(1,1) PRIMARY KEY,
      to_do_id INT NOT NULL,
      text NVARCHAR(500) NOT NULL,
      is_done BIT DEFAULT 0,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_to_do_items_to_do FOREIGN KEY (to_do_id) REFERENCES to_dos(id) ON DELETE CASCADE
    )
  `);

  await createTableIfNotExists(pool, 'idea_folders', `
    CREATE TABLE idea_folders (
      id INT IDENTITY(1,1) PRIMARY KEY,
      name NVARCHAR(255) NOT NULL,
      parent_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_idea_folders_parent FOREIGN KEY (parent_id) REFERENCES idea_folders(id) ON DELETE CASCADE
    )
  `);
  await createUpdatedAtTrigger(pool, 'idea_folders');

  await createTableIfNotExists(pool, 'ideas', `
    CREATE TABLE ideas (
      id INT IDENTITY(1,1) PRIMARY KEY,
      title NVARCHAR(255) NOT NULL,
      notes NVARCHAR(MAX),
      folder_id INT NULL,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      updated_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_ideas_folder FOREIGN KEY (folder_id) REFERENCES idea_folders(id) ON DELETE SET NULL
    )
  `);
  await createUpdatedAtTrigger(pool, 'ideas');

  await createTableIfNotExists(pool, 'idea_items', `
    CREATE TABLE idea_items (
      id INT IDENTITY(1,1) PRIMARY KEY,
      idea_id INT NOT NULL,
      text NVARCHAR(500) NOT NULL,
      is_done BIT DEFAULT 0,
      order_index INT DEFAULT 0,
      created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
      CONSTRAINT fk_idea_items_idea FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
    )
  `);
}
