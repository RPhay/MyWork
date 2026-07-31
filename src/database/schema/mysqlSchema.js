// Single source of truth for the MyWork MySQL schema. Used both by
// `npm run db:init` (against the app's own configured database) and by the
// Database Configuration "Test Connection" flow (against an arbitrary target
// database, to check for / create the schema there).

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    'SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
    [table, column]
  );
  return rows[0].cnt > 0;
}

async function dropForeignKeysOnColumn(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [table, column]
  );
  for (const row of rows) {
    await connection.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
  }
}

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.query(
    'SELECT COUNT(*) as cnt FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
    [table, indexName]
  );
  return rows[0].cnt > 0;
}

// Checks for a single well-known table as a signal that the MyWork schema has
// already been created in the connection's current database.
export async function mysqlSchemaExists(connection) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_items'"
  );
  return rows[0].cnt > 0;
}

// `connection` must already be USE'd into the target database.
export async function createMysqlSchema(connection) {
  // Create sources table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sources (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100) NOT NULL,
      config JSON,
      enabled BOOLEAN DEFAULT TRUE,
      status VARCHAR(50) DEFAULT 'not_configured',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Create categories table (static, goal-only grouping - distinct from Areas)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // A prior revision briefly reused this table for Areas; remove those columns
  // if present so categories stays the plain goal-grouping table it always was.
  if (await columnExists(connection, 'categories', 'description')) {
    await connection.query('ALTER TABLE categories DROP COLUMN description');
  }
  if (await columnExists(connection, 'categories', 'updated_at')) {
    await connection.query('ALTER TABLE categories DROP COLUMN updated_at');
  }

  // Seed the standard goal categories so they're selectable out of the box
  const standardCategories = ['Financial', 'Impact', 'M&A', 'Operational Excellence', 'Other', 'People', 'Technology Excellence'];
  for (const name of standardCategories) {
    await connection.query('INSERT IGNORE INTO categories (name) VALUES (?)', [name]);
  }

  // Create areas table (user-managed, associated with priorities; supports sub-areas via parent_id)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS areas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      description LONGTEXT,
      parent_id INT,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES areas(id) ON DELETE CASCADE
    )
  `);

  // Backfill parent_id for pre-existing areas tables
  if (!(await columnExists(connection, 'areas', 'parent_id'))) {
    await connection.query(
      'ALTER TABLE areas ADD COLUMN parent_id INT, ADD FOREIGN KEY (parent_id) REFERENCES areas(id) ON DELETE CASCADE'
    );
  }

  // Backfill order_index for pre-existing areas tables
  if (!(await columnExists(connection, 'areas', 'order_index'))) {
    await connection.query('ALTER TABLE areas ADD COLUMN order_index INT DEFAULT 0');
  }

  // Create years table (selectable years for Yearly Goals)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS years (
      id INT AUTO_INCREMENT PRIMARY KEY,
      year INT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed the current year so the dropdown isn't empty on a fresh install
  await connection.query('INSERT IGNORE INTO years (year) VALUES (?)', [new Date().getFullYear()]);

  // Create goals table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      year INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      description LONGTEXT,
      measurements LONGTEXT,
      goal_updates LONGTEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
      due_date DATE,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_year (year),
      INDEX idx_status (status),
      UNIQUE KEY unique_year_name (year, name)
    )
  `);

  // Backfill uniqueness for pre-existing goals tables
  if (!(await indexExists(connection, 'goals', 'unique_year_name'))) {
    await connection.query('ALTER TABLE goals ADD UNIQUE KEY unique_year_name (year, name)');
  }

  // Backfill order_index for pre-existing goals tables
  if (!(await columnExists(connection, 'goals', 'order_index'))) {
    await connection.query('ALTER TABLE goals ADD COLUMN order_index INT DEFAULT 0');
  }

  // Create goal_categories junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS goal_categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      goal_id INT NOT NULL,
      category_id INT NOT NULL,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
      UNIQUE KEY unique_goal_category (goal_id, category_id)
    )
  `);

  // Create priorities table (supports sub-projects via parent_id; areas/goals are many-to-many;
  // status + order_index drive the Priority Board's per-bay drag ordering)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS priorities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL UNIQUE,
      source_id INT,
      parent_id INT,
      notes LONGTEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
      order_index INT DEFAULT 0,
      is_weekly BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_id) REFERENCES priorities(id) ON DELETE CASCADE,
      INDEX idx_order (order_index)
    )
  `);

  // Backfill is_weekly for pre-existing priorities tables
  if (!(await columnExists(connection, 'priorities', 'is_weekly'))) {
    await connection.query('ALTER TABLE priorities ADD COLUMN is_weekly BOOLEAN DEFAULT FALSE');
  }

  // Backfill status for pre-existing priorities tables
  if (!(await columnExists(connection, 'priorities', 'status'))) {
    await connection.query("ALTER TABLE priorities ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Not Started'");
  }

  // Backfill parent_id for pre-existing priorities tables
  if (!(await columnExists(connection, 'priorities', 'parent_id'))) {
    await connection.query(
      'ALTER TABLE priorities ADD COLUMN parent_id INT, ADD FOREIGN KEY (parent_id) REFERENCES priorities(id) ON DELETE CASCADE'
    );
  }

  // Backfill uniqueness for pre-existing priorities tables
  if (!(await indexExists(connection, 'priorities', 'title'))) {
    await connection.query('ALTER TABLE priorities ADD UNIQUE KEY title (title)');
  }

  // A prior revision linked priorities to the categories table via category_id;
  // drop it now that priorities link to the dedicated areas table instead.
  if (await columnExists(connection, 'priorities', 'category_id')) {
    await dropForeignKeysOnColumn(connection, 'priorities', 'category_id');
    await connection.query('ALTER TABLE priorities DROP COLUMN category_id');
  }

  // Create priority_areas junction table (a project can span multiple areas)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS priority_areas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      priority_id INT NOT NULL,
      area_id INT NOT NULL,
      FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE,
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
      UNIQUE KEY unique_priority_area (priority_id, area_id)
    )
  `);

  // Create priority_goals junction table (a project can span multiple yearly goals)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS priority_goals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      priority_id INT NOT NULL,
      goal_id INT NOT NULL,
      FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      UNIQUE KEY unique_priority_goal (priority_id, goal_id)
    )
  `);

  // A prior revision linked a priority to a single area via area_id. Migrate any
  // existing values into the new many-to-many priority_areas table, then drop it.
  if (await columnExists(connection, 'priorities', 'area_id')) {
    await connection.query(`
      INSERT IGNORE INTO priority_areas (priority_id, area_id)
      SELECT id, area_id FROM priorities WHERE area_id IS NOT NULL
    `);
    await dropForeignKeysOnColumn(connection, 'priorities', 'area_id');
    await connection.query('ALTER TABLE priorities DROP COLUMN area_id');
  }

  // Create work_items table (time_box_minutes: 15/30/45/60, or NULL for freeform;
  // order_index controls manual drag-to-reorder position within a single date)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      date DATE NOT NULL,
      title VARCHAR(255) NOT NULL,
      description LONGTEXT,
      notes LONGTEXT,
      emoji VARCHAR(16),
      status VARCHAR(50) DEFAULT 'Not Started',
      time_box_minutes INT,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_date (date),
      INDEX idx_status (status)
    )
  `);

  // Backfill notes for pre-existing work_items tables
  if (!(await columnExists(connection, 'work_items', 'notes'))) {
    await connection.query('ALTER TABLE work_items ADD COLUMN notes LONGTEXT');
  }

  // Backfill emoji ("Oh!") for pre-existing work_items tables
  if (!(await columnExists(connection, 'work_items', 'emoji'))) {
    await connection.query('ALTER TABLE work_items ADD COLUMN emoji VARCHAR(16)');
  }

  // Backfill time_box_minutes for pre-existing work_items tables
  if (!(await columnExists(connection, 'work_items', 'time_box_minutes'))) {
    await connection.query('ALTER TABLE work_items ADD COLUMN time_box_minutes INT');
  }

  // Backfill order_index for pre-existing work_items tables
  if (!(await columnExists(connection, 'work_items', 'order_index'))) {
    await connection.query('ALTER TABLE work_items ADD COLUMN order_index INT DEFAULT 0');
  }

  // Create work_goal_associations junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_goal_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      goal_id INT NOT NULL,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_goal (work_item_id, goal_id)
    )
  `);

  // Create work_priority_associations junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_priority_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      priority_id INT NOT NULL,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_priority (work_item_id, priority_id)
    )
  `);

  // Create work_area_associations junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_area_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      area_id INT NOT NULL,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_area (work_item_id, area_id)
    )
  `);

  // Create work_source_associations junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_source_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      source_id INT NOT NULL,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_source (work_item_id, source_id)
    )
  `);

  // Create work_item_templates table (reusable work item presets with pre-associated areas/goals/priorities)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_item_templates (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description LONGTEXT,
      emoji VARCHAR(16),
      source_id INT,
      status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
      time_box_minutes INT,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
    )
  `);

  // Backfill time_box_minutes for pre-existing work_item_templates tables
  if (!(await columnExists(connection, 'work_item_templates', 'time_box_minutes'))) {
    await connection.query('ALTER TABLE work_item_templates ADD COLUMN time_box_minutes INT');
  }

  // Backfill emoji ("Oh!") for pre-existing work_item_templates tables
  if (!(await columnExists(connection, 'work_item_templates', 'emoji'))) {
    await connection.query('ALTER TABLE work_item_templates ADD COLUMN emoji VARCHAR(16)');
  }

  // Backfill order_index for pre-existing work_item_templates tables
  if (!(await columnExists(connection, 'work_item_templates', 'order_index'))) {
    await connection.query('ALTER TABLE work_item_templates ADD COLUMN order_index INT DEFAULT 0');
  }

  // Create template_areas junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS template_areas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_id INT NOT NULL,
      area_id INT NOT NULL,
      FOREIGN KEY (template_id) REFERENCES work_item_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE CASCADE,
      UNIQUE KEY unique_template_area (template_id, area_id)
    )
  `);

  // Create template_goals junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS template_goals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_id INT NOT NULL,
      goal_id INT NOT NULL,
      FOREIGN KEY (template_id) REFERENCES work_item_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
      UNIQUE KEY unique_template_goal (template_id, goal_id)
    )
  `);

  // Create template_priorities junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS template_priorities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      template_id INT NOT NULL,
      priority_id INT NOT NULL,
      FOREIGN KEY (template_id) REFERENCES work_item_templates(id) ON DELETE CASCADE,
      FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE,
      UNIQUE KEY unique_template_priority (template_id, priority_id)
    )
  `);

  // Create to_do_folders table (supports sub-folders via parent_id)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS to_do_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      parent_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES to_do_folders(id) ON DELETE CASCADE
    )
  `);

  // Create to_dos table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS to_dos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      notes LONGTEXT,
      folder_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES to_do_folders(id) ON DELETE SET NULL
    )
  `);

  // Backfill folder_id for pre-existing to_dos tables
  if (!(await columnExists(connection, 'to_dos', 'folder_id'))) {
    await connection.query(
      'ALTER TABLE to_dos ADD COLUMN folder_id INT, ADD FOREIGN KEY (folder_id) REFERENCES to_do_folders(id) ON DELETE SET NULL'
    );
  }

  // Create to_do_items table (a to-do's checklist of 1-n sub-items)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS to_do_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      to_do_id INT NOT NULL,
      text VARCHAR(500) NOT NULL,
      is_done BOOLEAN DEFAULT FALSE,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (to_do_id) REFERENCES to_dos(id) ON DELETE CASCADE
    )
  `);

  // Create idea_folders table (Brainstorming tab; supports sub-folders via parent_id,
  // structurally identical to to_do_folders)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS idea_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      parent_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES idea_folders(id) ON DELETE CASCADE
    )
  `);

  // Create ideas table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ideas (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      notes LONGTEXT,
      folder_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES idea_folders(id) ON DELETE SET NULL
    )
  `);

  // Create idea_items table (an idea's checklist of 1-n sub-items)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS idea_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      idea_id INT NOT NULL,
      text VARCHAR(500) NOT NULL,
      is_done BOOLEAN DEFAULT FALSE,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (idea_id) REFERENCES ideas(id) ON DELETE CASCADE
    )
  `);

  // Create contexts table (top-level scope toggle, e.g. Work vs Life vs Hobbies -
  // distinct from the "areas" table, which backs the unrelated Categories tab)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS contexts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Seed a starting context so the app is never contextless out of the box.
  // It's a normal, renamable/deletable-if-not-last row, not a protected special case.
  const [existingContexts] = await connection.query('SELECT COUNT(*) as cnt FROM contexts');
  if (existingContexts[0].cnt === 0) {
    await connection.query('INSERT INTO contexts (name, order_index) VALUES (?, ?)', ['Default', 0]);
  }

  // Every content entity belongs to exactly one context. Added here (after
  // contexts exists) rather than in each table's own CREATE statement, so
  // this same block works identically for fresh installs and pre-existing
  // tables alike. Existing rows backfill to whichever context was created
  // first (order_index/id ASC) - normally "Default", but not assumed by name
  // since it's renamable.
  const [[firstContext]] = await connection.query('SELECT id FROM contexts ORDER BY order_index ASC, id ASC LIMIT 1');
  const contextTables = [
    'sources', 'areas', 'priorities', 'goals', 'work_items',
    'work_item_templates', 'to_do_folders', 'to_dos', 'idea_folders', 'ideas',
  ];
  for (const table of contextTables) {
    if (!(await columnExists(connection, table, 'context_id'))) {
      await connection.query(
        `ALTER TABLE ${table} ADD COLUMN context_id INT, ADD FOREIGN KEY (context_id) REFERENCES contexts(id)`
      );
      await connection.query(`UPDATE ${table} SET context_id = ? WHERE context_id IS NULL`, [firstContext.id]);
    }
  }

  // A few uniqueness constraints predate contexts and were scoped globally
  // (e.g. only one area could ever be named "Meetings" across the whole app).
  // Widen them to be per-context so the same name can exist in different
  // contexts without colliding.
  if (await indexExists(connection, 'areas', 'name')) {
    await connection.query('ALTER TABLE areas DROP INDEX `name`');
    await connection.query('ALTER TABLE areas ADD UNIQUE KEY unique_context_name (context_id, name)');
  }
  if (await indexExists(connection, 'priorities', 'title')) {
    await connection.query('ALTER TABLE priorities DROP INDEX `title`');
    await connection.query('ALTER TABLE priorities ADD UNIQUE KEY unique_context_title (context_id, title)');
  }
  if (await indexExists(connection, 'goals', 'unique_year_name')) {
    await connection.query('ALTER TABLE goals DROP INDEX unique_year_name');
    await connection.query('ALTER TABLE goals ADD UNIQUE KEY unique_context_year_name (context_id, year, name)');
  }
}
