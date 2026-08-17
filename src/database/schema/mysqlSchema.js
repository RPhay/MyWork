// Single source of truth for the MyWork MySQL schema. Used both by
// `npm run db:init` (against the app's own configured database) and by the
// Database Configuration "Test Connection" flow (against an arbitrary target
// database, to check for / create the schema there).

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  return rows[0].cnt > 0;
}

async function dropForeignKeysOnColumn(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL`,
    [table, column],
  );
  for (const row of rows) {
    await connection.query(
      `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``,
    );
  }
}

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) as cnt FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
    [table, indexName],
  );
  return rows[0].cnt > 0;
}

// Checks for a single well-known table as a signal that the MyWork schema has
// already been created in the connection's current database.
export async function mysqlSchemaExists(connection) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_items'",
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

  // Create source_auth table for storing encrypted auth credentials per source
  await connection.query(`
    CREATE TABLE IF NOT EXISTS source_auth (
      id INT AUTO_INCREMENT PRIMARY KEY,
      source_id INT NOT NULL,
      auth_type VARCHAR(50) NOT NULL COMMENT 'credentials, sso_entra_id, sso_google, sso_github, api_key',
      auth_data_enc LONGTEXT COMMENT 'Encrypted JSON with auth details (password, token, etc)',
      auth_metadata JSON COMMENT 'Non-sensitive metadata (user_email, expiry_time, etc)',
      authenticated_at TIMESTAMP,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
      UNIQUE KEY unique_source_auth (source_id, auth_type)
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
  if (await columnExists(connection, "categories", "description")) {
    await connection.query("ALTER TABLE categories DROP COLUMN description");
  }
  if (await columnExists(connection, "categories", "updated_at")) {
    await connection.query("ALTER TABLE categories DROP COLUMN updated_at");
  }

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
    await connection.query("INSERT IGNORE INTO categories (name) VALUES (?)", [
      name,
    ]);
  }

  // areas table removed in Phase 2 (areas migrated to generic entities)

  // Create years table (selectable years for Yearly Goals)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS years (
      id INT AUTO_INCREMENT PRIMARY KEY,
      year INT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed the current year so the dropdown isn't empty on a fresh install
  await connection.query("INSERT IGNORE INTO years (year) VALUES (?)", [
    new Date().getFullYear(),
  ]);

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

  // Backfill order_index for pre-existing goals tables
  if (!(await columnExists(connection, "goals", "order_index"))) {
    await connection.query(
      "ALTER TABLE goals ADD COLUMN order_index INT DEFAULT 0",
    );
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
  if (!(await columnExists(connection, "priorities", "is_weekly"))) {
    await connection.query(
      "ALTER TABLE priorities ADD COLUMN is_weekly BOOLEAN DEFAULT FALSE",
    );
  }

  // Backfill status for pre-existing priorities tables
  if (!(await columnExists(connection, "priorities", "status"))) {
    await connection.query(
      "ALTER TABLE priorities ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Not Started'",
    );
  }

  // Backfill parent_id for pre-existing priorities tables
  if (!(await columnExists(connection, "priorities", "parent_id"))) {
    await connection.query(
      "ALTER TABLE priorities ADD COLUMN parent_id INT, ADD FOREIGN KEY (parent_id) REFERENCES priorities(id) ON DELETE CASCADE",
    );
  }

  // A prior revision linked priorities to the categories table via category_id;
  // drop it now that priorities link to the dedicated areas table instead.
  if (await columnExists(connection, "priorities", "category_id")) {
    await dropForeignKeysOnColumn(connection, "priorities", "category_id");
    await connection.query("ALTER TABLE priorities DROP COLUMN category_id");
  }

  // priority_areas junction table removed in Phase 2 (areas migrated to generic entities)

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
  if (await columnExists(connection, "priorities", "area_id")) {
    await connection.query(`
      INSERT IGNORE INTO priority_areas (priority_id, area_id)
      SELECT id, area_id FROM priorities WHERE area_id IS NOT NULL
    `);
    await dropForeignKeysOnColumn(connection, "priorities", "area_id");
    await connection.query("ALTER TABLE priorities DROP COLUMN area_id");
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
      worked_with_claude BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_date (date),
      INDEX idx_status (status)
    )
  `);

  // Backfill notes for pre-existing work_items tables
  if (!(await columnExists(connection, "work_items", "notes"))) {
    await connection.query("ALTER TABLE work_items ADD COLUMN notes LONGTEXT");
  }

  // Backfill emoji ("Oh!") for pre-existing work_items tables
  if (!(await columnExists(connection, "work_items", "emoji"))) {
    await connection.query(
      "ALTER TABLE work_items ADD COLUMN emoji VARCHAR(16)",
    );
  }

  // Backfill time_box_minutes for pre-existing work_items tables
  if (!(await columnExists(connection, "work_items", "time_box_minutes"))) {
    await connection.query(
      "ALTER TABLE work_items ADD COLUMN time_box_minutes INT",
    );
  }

  // Backfill order_index for pre-existing work_items tables
  if (!(await columnExists(connection, "work_items", "order_index"))) {
    await connection.query(
      "ALTER TABLE work_items ADD COLUMN order_index INT DEFAULT 0",
    );
  }

  // Backfill start_time for pre-existing work_items tables
  if (!(await columnExists(connection, "work_items", "start_time"))) {
    await connection.query(
      "ALTER TABLE work_items ADD COLUMN start_time VARCHAR(5)",
    );
  }

  // Backfill worked_with_claude for pre-existing work_items tables
  if (!(await columnExists(connection, "work_items", "worked_with_claude"))) {
    await connection.query(
      "ALTER TABLE work_items ADD COLUMN worked_with_claude BOOLEAN DEFAULT FALSE",
    );
  }

  // Backfill tracking columns for recurring items (link to source todo/task)
  if (!(await columnExists(connection, "work_items", "recurring_from_todo_id"))) {
    await connection.query(`
      ALTER TABLE work_items
        ADD COLUMN recurring_from_todo_id INT,
        ADD COLUMN recurring_from_task_id INT,
        ADD FOREIGN KEY (recurring_from_todo_id) REFERENCES to_dos(id) ON DELETE SET NULL,
        ADD FOREIGN KEY (recurring_from_task_id) REFERENCES tasks(id) ON DELETE SET NULL
    `);
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

  // work_area_associations junction table removed in Phase 2 (areas migrated to generic entities)

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

  // Create work_template_associations junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_template_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      template_id INT NOT NULL,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES work_item_templates(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_template (work_item_id, template_id)
    )
  `);

  // Create work_todo_associations junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_todo_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      todo_id INT NOT NULL,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (todo_id) REFERENCES to_dos(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_todo (work_item_id, todo_id)
    )
  `);

  // Create work_task_associations junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_task_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      task_id INT NOT NULL,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_task (work_item_id, task_id)
    )
  `);

  // Create work_ticket_associations junction table
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_ticket_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      ticket_id INT NOT NULL,
      FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_ticket (work_item_id, ticket_id)
    )
  `);

  // work_idea_associations junction table removed in Phase 1 (ideas migrated to generic entities)

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
  if (
    !(await columnExists(connection, "work_item_templates", "time_box_minutes"))
  ) {
    await connection.query(
      "ALTER TABLE work_item_templates ADD COLUMN time_box_minutes INT",
    );
  }

  // Backfill emoji ("Oh!") for pre-existing work_item_templates tables
  if (!(await columnExists(connection, "work_item_templates", "emoji"))) {
    await connection.query(
      "ALTER TABLE work_item_templates ADD COLUMN emoji VARCHAR(16)",
    );
  }

  // Backfill start_time for pre-existing work_item_templates tables
  if (!(await columnExists(connection, "work_item_templates", "start_time"))) {
    await connection.query(
      "ALTER TABLE work_item_templates ADD COLUMN start_time VARCHAR(5)",
    );
  }

  // Backfill order_index for pre-existing work_item_templates tables
  if (!(await columnExists(connection, "work_item_templates", "order_index"))) {
    await connection.query(
      "ALTER TABLE work_item_templates ADD COLUMN order_index INT DEFAULT 0",
    );
  }

  // template_areas junction table removed in Phase 2 (areas migrated to generic entities)

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

  // Create to_dos table (supports nesting via parent_id, recurring via recurrence JSON)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS to_dos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      notes LONGTEXT,
      parent_id INT,
      priority_id INT,
      status VARCHAR(20) NOT NULL DEFAULT 'incomplete',
      recurrence JSON COMMENT 'Recurrence pattern: {enabled:bool, type:string, ...}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES to_dos(id) ON DELETE CASCADE,
      FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL
    )
  `);

  // Backfill recurrence for pre-existing to_dos tables
  if (!(await columnExists(connection, "to_dos", "recurrence"))) {
    await connection.query(
      "ALTER TABLE to_dos ADD COLUMN recurrence JSON COMMENT 'Recurrence pattern: {enabled:bool, type:string, ...}'"
    );
  }

  // Backfill parent_id for pre-existing to_dos tables (migrate from folder_id if it exists)
  if (!(await columnExists(connection, "to_dos", "parent_id"))) {
    await connection.query(
      "ALTER TABLE to_dos ADD COLUMN parent_id INT, ADD FOREIGN KEY (parent_id) REFERENCES to_dos(id) ON DELETE CASCADE",
    );

    // If old folder_id column exists, convert folder rows to parent-child relationships
    if (await columnExists(connection, "to_dos", "folder_id")) {
      // For each to_do with a folder_id that matches a folder's id, create parent relationship
      // This assumes if a to_do references folder_id X, there might be a folder with id X
      // We'll set parent_id to null (unfiled) for now to be safe during migration
      await connection.query("UPDATE to_dos SET parent_id = NULL WHERE folder_id IS NOT NULL");

      // Drop the old folder_id column
      await dropForeignKeysOnColumn(connection, "to_dos", "folder_id");
      await connection.query("ALTER TABLE to_dos DROP COLUMN folder_id");
    }
  }

  // Backfill priority_id for pre-existing to_dos tables. This is a separate column
  // from folder_id (Todos-tab folder) so that a to-do's Projects-tab association is
  // fully independent of its Todos-tab organization - they used to share folder_id,
  // which conflated the two and could violate folder_id's FK to to_do_folders
  // whenever a priority id didn't coincidentally also match a to_do_folders id.
  if (!(await columnExists(connection, "to_dos", "priority_id"))) {
    await connection.query(
      "ALTER TABLE to_dos ADD COLUMN priority_id INT, ADD FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL",
    );
  }

  // Backfill status for pre-existing to_dos tables
  if (!(await columnExists(connection, "to_dos", "status"))) {
    await connection.query(
      "ALTER TABLE to_dos ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'incomplete'",
    );
  }

  // The boolean `completed` column was superseded by the 4-state `status` column
  // above before it shipped; migrate any data and drop it on installs that already
  // picked it up.
  if (await columnExists(connection, "to_dos", "completed")) {
    await connection.query("UPDATE to_dos SET status = 'complete' WHERE completed = TRUE");
    await connection.query("ALTER TABLE to_dos DROP COLUMN completed");
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

  // idea_folders table removed in Phase 1 (ideas migrated to generic entities)

  // ideas table removed in Phase 1 (ideas migrated to generic entities)

  // idea_items table removed in Phase 1 (ideas migrated to generic entities)

  // Create to_do_links table (1-n links associated with to dos)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS to_do_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      to_do_id INT NOT NULL,
      url VARCHAR(2048) NOT NULL,
      title VARCHAR(255),
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (to_do_id) REFERENCES to_dos(id) ON DELETE CASCADE
    )
  `);

  // Backfill target_date for pre-existing to_dos tables
  if (!(await columnExists(connection, "to_dos", "target_date"))) {
    await connection.query(
      "ALTER TABLE to_dos ADD COLUMN target_date DATE"
    );
  }

  // Backfill importance for pre-existing to_dos tables
  if (!(await columnExists(connection, "to_dos", "importance"))) {
    await connection.query(
      "ALTER TABLE to_dos ADD COLUMN importance VARCHAR(20) DEFAULT NULL COMMENT 'low, medium, high, critical'"
    );
  }

  // idea_links table removed in Phase 1 (ideas migrated to generic entities)

  // ALTER TABLE ideas removed in Phase 1 (ideas migrated to generic entities)

  // Create priority_links table (1-n links associated with priorities/projects)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS priority_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      priority_id INT NOT NULL,
      url VARCHAR(2048) NOT NULL,
      title VARCHAR(255),
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE
    )
  `);

  // Create tasks table (supports nesting via parent_id, recurring via recurrence JSON)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      notes LONGTEXT,
      parent_id INT,
      priority_id INT,
      status VARCHAR(20) NOT NULL DEFAULT 'incomplete',
      recurrence JSON COMMENT 'Recurrence pattern: {enabled:bool, type:string, ...}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL
    )
  `);

  // Backfill recurrence for pre-existing tasks tables
  if (!(await columnExists(connection, "tasks", "recurrence"))) {
    await connection.query(
      "ALTER TABLE tasks ADD COLUMN recurrence JSON COMMENT 'Recurrence pattern: {enabled:bool, type:string, ...}'"
    );
  }

  // Backfill parent_id/priority_id/status for pre-existing tasks tables
  if (!(await columnExists(connection, "tasks", "parent_id"))) {
    await connection.query(
      "ALTER TABLE tasks ADD COLUMN parent_id INT, ADD FOREIGN KEY (parent_id) REFERENCES tasks(id) ON DELETE CASCADE",
    );

    // If old folder_id column exists, drop it after migrating to parent_id
    if (await columnExists(connection, "tasks", "folder_id")) {
      await connection.query("UPDATE tasks SET parent_id = NULL WHERE folder_id IS NOT NULL");
      await dropForeignKeysOnColumn(connection, "tasks", "folder_id");
      await connection.query("ALTER TABLE tasks DROP COLUMN folder_id");
    }
  }
  if (!(await columnExists(connection, "tasks", "priority_id"))) {
    await connection.query(
      "ALTER TABLE tasks ADD COLUMN priority_id INT, ADD FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL",
    );
  }
  if (!(await columnExists(connection, "tasks", "status"))) {
    await connection.query(
      "ALTER TABLE tasks ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'incomplete'",
    );
  }

  // Drop folder tables if they exist (replaced by parent_id nesting on to_dos and tasks)
  if (await indexExists(connection, "to_do_folders", "PRIMARY")) {
    await connection.query("DROP TABLE IF EXISTS to_do_folders");
  }
  if (await indexExists(connection, "task_folders", "PRIMARY")) {
    await connection.query("DROP TABLE IF EXISTS task_folders");
  }

  // Create task_links table (1-n links associated with tasks)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS task_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      url VARCHAR(2048) NOT NULL,
      title VARCHAR(255),
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `);

  // Create tickets table (issue/ticket tracking with fixed categories: ServiceNow, Azure DevOps, Other)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      notes LONGTEXT,
      ticket_type VARCHAR(50) NOT NULL DEFAULT 'Other' COMMENT 'ServiceNow, Azure DevOps, or Other',
      context_id INT,
      priority_id INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (context_id) REFERENCES contexts(id),
      FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL
    )
  `);

  // Create ticket_links table (1-n links associated with tickets)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS ticket_links (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_id INT NOT NULL,
      url VARCHAR(2048) NOT NULL,
      title VARCHAR(255),
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
    )
  `);

  // Add priority_id column to tickets table (for project association)
  if (!(await columnExists(connection, "tickets", "priority_id"))) {
    await connection.query(
      "ALTER TABLE tickets ADD COLUMN priority_id INT, ADD FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE SET NULL"
    );
  }

  // Create users table - identity is deliberately minimal (name only, no
  // password): logging in with a name that doesn't exist yet creates it.
  // Good enough to keep each person's contexts (and everything under them)
  // separate; not intended as real access control against a hostile actor.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Folders for grouping contexts (optional; contexts can sit at root or inside a folder)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS context_folders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      parent_id INT,
      order_index INT DEFAULT 0,
      icon VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_id) REFERENCES context_folders(id) ON DELETE CASCADE
    )
  `);

  // Backfill for context_folders created before icon existed.
  if (!(await columnExists(connection, "context_folders", "icon"))) {
    await connection.query(
      "ALTER TABLE context_folders ADD COLUMN icon VARCHAR(50)",
    );
  }

  // Create contexts table (top-level scope toggle, e.g. Work vs Life vs Hobbies -
  // distinct from the "areas" table, which backs the unrelated Categories tab)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS contexts (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      order_index INT DEFAULT 0,
      icon VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  // Backfill for contexts created before icon existed.
  if (!(await columnExists(connection, "contexts", "icon"))) {
    await connection.query("ALTER TABLE contexts ADD COLUMN icon VARCHAR(50)");
  }

  // Seed a starting context so the app is never contextless out of the box.
  // It's a normal, renamable/deletable-if-not-last row, not a protected special case.
  const [existingContexts] = await connection.query(
    "SELECT COUNT(*) as cnt FROM contexts",
  );
  if (existingContexts[0].cnt === 0) {
    await connection.query(
      "INSERT INTO contexts (name, order_index) VALUES (?, ?)",
      ["Default", 0],
    );
  }

  // Every context belongs to exactly one user, once someone's logged in as
  // one - nullable so existing installs (upgrading from a pre-login version)
  // aren't immediately broken. Left NULL, a context is "unclaimed"; the
  // first person to log in after upgrading claims every unclaimed context
  // (see userService.js#findOrCreateUser), so this self-heals on first
  // login rather than needing a real migration/backfill decision here.
  if (!(await columnExists(connection, "contexts", "user_id"))) {
    await connection.query(`
      ALTER TABLE contexts
        ADD COLUMN user_id INT NULL,
        ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    `);
  }

  // Each context owns its own database connection (contexts can point at
  // entirely different physical databases, not just filter rows within a
  // shared one) and its own sub-tab ordering for the Settings > Contexts panel.
  if (!(await columnExists(connection, "contexts", "db_host"))) {
    await connection.query(`
      ALTER TABLE contexts
        ADD COLUMN db_host VARCHAR(255),
        ADD COLUMN db_port INT,
        ADD COLUMN db_name VARCHAR(255),
        ADD COLUMN db_user VARCHAR(255),
        ADD COLUMN db_password_enc TEXT,
        ADD COLUMN subtab_order TEXT
    `);
  }

  // A context can additionally save an MSSQL profile alongside its MySQL/MariaDB
  // one (Settings > Contexts > Database has a type toggle so both can be
  // configured, tested, and schema-created independently, and db_type selects
  // which one is live - see connectionPool.js). The unprefixed db_* columns above are the MySQL/MariaDB
  // profile; these mssql_* columns are the separate MSSQL one.
  if (!(await columnExists(connection, "contexts", "db_type"))) {
    await connection.query(`
      ALTER TABLE contexts
        ADD COLUMN db_type VARCHAR(10) DEFAULT 'mysql',
        ADD COLUMN mssql_host VARCHAR(255),
        ADD COLUMN mssql_port INT,
        ADD COLUMN mssql_name VARCHAR(255),
        ADD COLUMN mssql_user VARCHAR(255),
        ADD COLUMN mssql_password_enc TEXT
    `);
  }

  if (!(await columnExists(connection, "contexts", "folder_id"))) {
    await connection.query(`
      ALTER TABLE contexts
        ADD COLUMN folder_id INT,
        ADD FOREIGN KEY (folder_id) REFERENCES context_folders(id) ON DELETE SET NULL
    `);
  }

  // SSO configuration per context (Microsoft Entra ID, etc.)
  // sso_enabled: whether SSO is required for this context
  // sso_provider: 'entra-id', 'google', etc.
  // sso_*_enc: encrypted credentials
  // sso_redirect_uri: OAuth redirect URI (not secret)
  if (!(await columnExists(connection, "contexts", "sso_enabled"))) {
    await connection.query(`
      ALTER TABLE contexts
        ADD COLUMN sso_enabled BOOLEAN DEFAULT FALSE,
        ADD COLUMN sso_provider VARCHAR(50),
        ADD COLUMN sso_tenant_id_enc TEXT,
        ADD COLUMN sso_client_id_enc TEXT,
        ADD COLUMN sso_client_secret_enc TEXT,
        ADD COLUMN sso_redirect_uri VARCHAR(500),
        ADD COLUMN sso_configured_at TIMESTAMP NULL
    `);
  }

  // Unified database configuration: stores only the ACTIVE connection (mysql or mssql)
  // as encrypted JSON. db_type indicates which type is stored. This enforces
  // exactly one database connection per context, preventing the confusion of
  // having both MySQL and MSSQL configs simultaneously.
  if (!(await columnExists(connection, "contexts", "db_config_json"))) {
    await connection.query(`
      ALTER TABLE contexts
        ADD COLUMN db_config_json TEXT COMMENT 'Encrypted JSON with active db connection config'
    `);

    // Backfill: migrate existing configs to db_config_json
    // If db_type='mysql', move db_* fields to JSON; if 'mssql', move mssql_* to JSON
    const contexts = await connection.query('SELECT id, db_type, db_host, db_port, db_name, db_user, db_password_enc, mssql_host, mssql_port, mssql_name, mssql_user, mssql_password_enc FROM contexts');
    for (const ctx of contexts[0]) {
      if (ctx.db_type === 'mssql' && ctx.mssql_host) {
        const config = {
          host: ctx.mssql_host,
          port: ctx.mssql_port,
          database: ctx.mssql_name,
          user: ctx.mssql_user,
          password_enc: ctx.mssql_password_enc
        };
        await connection.query('UPDATE contexts SET db_config_json = ? WHERE id = ?', [JSON.stringify(config), ctx.id]);
      } else if (ctx.db_type === 'mysql' && ctx.db_host) {
        const config = {
          host: ctx.db_host,
          port: ctx.db_port,
          database: ctx.db_name,
          user: ctx.db_user,
          password_enc: ctx.db_password_enc
        };
        await connection.query('UPDATE contexts SET db_config_json = ? WHERE id = ?', [JSON.stringify(config), ctx.id]);
      }
    }
  }

  // ServiceNow and Azure DevOps API credentials for fetching ticket details
  if (!(await columnExists(connection, "contexts", "snow_instance"))) {
    await connection.query(`
      ALTER TABLE contexts
        ADD COLUMN snow_instance VARCHAR(500),
        ADD COLUMN snow_username_enc TEXT,
        ADD COLUMN snow_password_enc TEXT,
        ADD COLUMN ado_org VARCHAR(500),
        ADD COLUMN ado_project VARCHAR(255),
        ADD COLUMN ado_pat_enc TEXT
    `);
  }

  // Per-context visibility/order for the main app's tabs. Dailies is always
  // shown first and can't be hidden, so it's deliberately not represented here
  // - the dashboard nav always pins it, then lays out whatever this table says
  // for the rest.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS context_tab_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      context_id INT NOT NULL,
      tab_key VARCHAR(100) NOT NULL,
      visible BOOLEAN DEFAULT TRUE,
      order_index INT DEFAULT 0,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
      UNIQUE KEY unique_context_tab (context_id, tab_key)
    )
  `);

  // SSO user identities: maps Entra ID (or other SSO provider) users to MyWork users
  // One row per user per provider, allows same person to be identified across contexts
  await connection.query(`
    CREATE TABLE IF NOT EXISTS sso_identities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      provider VARCHAR(50) NOT NULL,
      provider_id VARCHAR(500) NOT NULL,
      provider_email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_provider_identity (provider, provider_id)
    )
  `);

  // Dailies calendar cell background/text color, set via the calendar day's
  // right-click "Highlight Day" / "Text Color" submenus. One row per date per
  // context; either column may be set independently of the other.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS day_highlights (
      id INT AUTO_INCREMENT PRIMARY KEY,
      context_id INT NOT NULL,
      date DATE NOT NULL,
      color VARCHAR(20),
      text_color VARCHAR(20),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
      UNIQUE KEY unique_context_date (context_id, date)
    )
  `);

  // Backfill for day_highlights created before text_color existed (color was
  // NOT NULL then; relaxed here since a row may now hold only a text_color).
  if (!(await columnExists(connection, "day_highlights", "text_color"))) {
    await connection.query(
      "ALTER TABLE day_highlights ADD COLUMN text_color VARCHAR(20), MODIFY COLUMN color VARCHAR(20) NULL",
    );
  }

  // Every content entity belongs to exactly one context. Added here (after
  // contexts exists) rather than in each table's own CREATE statement, so
  // this same block works identically for fresh installs and pre-existing
  // tables alike. Existing rows backfill to whichever context was created
  // first (order_index/id ASC) - normally "Default", but not assumed by name
  // since it's renamable.
  const [[firstContext]] = await connection.query(
    "SELECT id FROM contexts ORDER BY order_index ASC, id ASC LIMIT 1",
  );
  const contextTables = [
    "sources",
    "areas",
    "priorities",
    "goals",
    "work_items",
    "work_item_templates",
    "to_dos",
    "idea_folders",
    "ideas",
    "tasks",
    "tickets",
  ];
  for (const table of contextTables) {
    if (!(await columnExists(connection, table, "context_id"))) {
      await connection.query(
        `ALTER TABLE ${table} ADD COLUMN context_id INT, ADD FOREIGN KEY (context_id) REFERENCES contexts(id)`,
      );
      await connection.query(
        `UPDATE ${table} SET context_id = ? WHERE context_id IS NULL`,
        [firstContext.id],
      );
    }
  }

  // A few uniqueness constraints predate contexts and were scoped globally
  // (e.g. only one area could ever be named "Meetings" across the whole app).
  // Widen them to be per-context so the same name can exist in different
  // contexts without colliding.
  if (await indexExists(connection, "areas", "name")) {
    await connection.query("ALTER TABLE areas DROP INDEX `name`");
    await connection.query(
      "ALTER TABLE areas ADD UNIQUE KEY unique_context_name (context_id, name)",
    );
  }
  if (await indexExists(connection, "priorities", "title")) {
    await connection.query("ALTER TABLE priorities DROP INDEX `title`");
    await connection.query(
      "ALTER TABLE priorities ADD UNIQUE KEY unique_context_title (context_id, title)",
    );
  }
  if (await indexExists(connection, "goals", "unique_year_name")) {
    await connection.query("ALTER TABLE goals DROP INDEX unique_year_name");
    await connection.query(
      "ALTER TABLE goals ADD UNIQUE KEY unique_context_year_name (context_id, year, name)",
    );
  }

  // Add hierarchical associations for cross-entity relationships
  // Tickets can have todos and goals as children
  if (!(await columnExists(connection, "to_dos", "ticket_id"))) {
    await connection.query(
      "ALTER TABLE to_dos ADD COLUMN ticket_id INT, ADD FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL"
    );
  }

  if (!(await columnExists(connection, "goals", "ticket_id"))) {
    await connection.query(
      "ALTER TABLE goals ADD COLUMN ticket_id INT, ADD FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL"
    );
  }

  // Todos can have categories (areas) and tickets as children
  if (!(await columnExists(connection, "areas", "todo_id"))) {
    await connection.query(
      "ALTER TABLE areas ADD COLUMN todo_id INT, ADD FOREIGN KEY (todo_id) REFERENCES to_dos(id) ON DELETE SET NULL"
    );
  }

  if (!(await columnExists(connection, "tickets", "todo_id"))) {
    await connection.query(
      "ALTER TABLE tickets ADD COLUMN todo_id INT, ADD FOREIGN KEY (todo_id) REFERENCES to_dos(id) ON DELETE SET NULL"
    );
  }

  // Categories (areas) can have tickets and todos as children
  if (!(await columnExists(connection, "tickets", "category_id"))) {
    await connection.query(
      "ALTER TABLE tickets ADD COLUMN category_id INT, ADD FOREIGN KEY (category_id) REFERENCES areas(id) ON DELETE SET NULL"
    );
  }

  if (!(await columnExists(connection, "to_dos", "category_id"))) {
    await connection.query(
      "ALTER TABLE to_dos ADD COLUMN category_id INT, ADD FOREIGN KEY (category_id) REFERENCES areas(id) ON DELETE SET NULL"
    );
  }

  // Create quotes table (person + quote attribution for any object type)
  await connection.query(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      object_type VARCHAR(50) NOT NULL COMMENT 'todo, task, ticket, goal, area, project, idea',
      object_id INT NOT NULL,
      person VARCHAR(255) NOT NULL COMMENT 'Name of person being quoted (freeform for now)',
      quote LONGTEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS entity_types (
      id INT AUTO_INCREMENT PRIMARY KEY,
      slug VARCHAR(100) NOT NULL UNIQUE,
      label VARCHAR(255) NOT NULL,
      label_singular VARCHAR(255) NOT NULL,
      icon VARCHAR(50),
      supports_hierarchy BOOLEAN DEFAULT FALSE,
      is_system BOOLEAN DEFAULT FALSE,
      primary_date_field VARCHAR(100),
      order_index INT DEFAULT 0,
      deleted_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_slug (slug),
      INDEX idx_deleted (deleted_at)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS entity_type_fields (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type_id INT NOT NULL,
      field_key VARCHAR(100) NOT NULL,
      label VARCHAR(255) NOT NULL,
      field_type ENUM('text','textarea','number','date','select','status','checkbox','recurrence') NOT NULL,
      field_options JSON,
      required BOOLEAN DEFAULT FALSE,
      display_order INT DEFAULT 0,
      show_in_row BOOLEAN DEFAULT FALSE,
      is_completion_signal BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_type_id) REFERENCES entity_types(id) ON DELETE CASCADE,
      UNIQUE KEY unique_type_field (entity_type_id, field_key),
      INDEX idx_type (entity_type_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS entity_type_relationships (
      id INT AUTO_INCREMENT PRIMARY KEY,
      parent_type_id INT NOT NULL,
      child_type_id INT NOT NULL,
      relationship_kind ENUM('hierarchy','association','recurrence','instantiated_from') NOT NULL,
      max_children_per_parent INT,
      max_parents_per_child INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (parent_type_id) REFERENCES entity_types(id) ON DELETE CASCADE,
      FOREIGN KEY (child_type_id) REFERENCES entity_types(id) ON DELETE CASCADE,
      UNIQUE KEY unique_relationship (parent_type_id, child_type_id, relationship_kind),
      INDEX idx_parent (parent_type_id),
      INDEX idx_child (child_type_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS entities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type_id INT NOT NULL,
      context_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      order_index INT DEFAULT 0,
      legacy_work_item_id INT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
      INDEX idx_type (entity_type_id),
      INDEX idx_context (context_id),
      INDEX idx_type_context (entity_type_id, context_id),
      INDEX idx_legacy (legacy_work_item_id)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS entity_field_values (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_id INT NOT NULL,
      field_key VARCHAR(100) NOT NULL,
      value_text VARCHAR(500),
      value_long LONGTEXT,
      value_number DECIMAL(15,2),
      value_date DATE,
      value_bool BOOLEAN,
      value_json JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      UNIQUE KEY unique_entity_field (entity_id, field_key),
      INDEX idx_entity (entity_id),
      INDEX idx_field_key_date (field_key, value_date),
      INDEX idx_field_key_text (field_key, value_text)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS entity_relationships (
      id INT AUTO_INCREMENT PRIMARY KEY,
      context_id INT NOT NULL,
      parent_entity_id INT NOT NULL,
      child_entity_id INT NOT NULL,
      relationship_kind ENUM('hierarchy','association','recurrence','instantiated_from') NOT NULL,
      is_generated BOOLEAN DEFAULT FALSE,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_entity_id) REFERENCES entities(id) ON DELETE NO ACTION,
      FOREIGN KEY (child_entity_id) REFERENCES entities(id) ON DELETE NO ACTION,
      UNIQUE KEY unique_relationship (parent_entity_id, child_entity_id, relationship_kind),
      INDEX idx_context (context_id),
      INDEX idx_parent (parent_entity_id),
      INDEX idx_child (child_entity_id),
      INDEX idx_kind (relationship_kind)
    )
  `);
}
