// Single source of truth for the MyWork MySQL schema. Used both by
// `npm run db:init` (against the app's own configured database) and by the
// Database Configuration "Test Connection" flow (against an arbitrary target
// database, to check for / create the schema there).
//
// The entity types, their fields and their relationship rules are NOT defined
// here - they come from ../systemEntityTypes.js, which every seeding path
// shares. This file used to carry its own copies of all three, and because
// `npm run db:init` runs this file and never phase 0, those copies are what a
// fresh install actually got. They had drifted to pre-convergence values
// (goal/task/ticket flat, template hierarchical, folder-like icons), which is
// why those settings kept reverting after a schema run.
import {
  SYSTEM_ENTITY_TYPES,
  SPECIAL_ENTITY_TYPES,
  resolveTypeRelationships,
} from '../systemEntityTypes.js';

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

  // goals and goal_categories tables removed in Phase 3 (goals migrated to generic entities)

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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
      FOREIGN KEY (parent_id) REFERENCES priorities(id) ON DELETE CASCADE,
      INDEX idx_order (order_index)
    )
  `);

  // The `entities` soft-delete backfill used to sit HERE, roughly 950 lines
  // before `entities` is created. It has moved to directly after that CREATE.
  // On any database where the table did not already exist, the ALTER ran first
  // and the whole schema build died - on MySQL with "Table 'entities' doesn't
  // exist", on SQL Server with "Cannot find the object 'MyWork.entities'".
  // A backfill can only ever run after the thing it backfills.

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

  // priority_areas: recreated as a legacy<->entity bridge at the end of this
  // file, after `entities` exists (see "Legacy <-> entity association bridge")

  // priority_goals: recreated as a legacy<->entity bridge at the end of this file

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
  // Note: This FK creation is moved to after to_dos and tasks tables are created
  // to avoid "Failed to open the referenced table" errors




  // work_source_associations: created further down, alongside
  // work_entity_associations, because its work_item_id column now points at
  // `entities` (see "Legacy <-> entity association bridge") - `entities`
  // does not exist yet at this point in the file.



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


  // template_areas: recreated as a legacy<->entity bridge at the end of this file

  // template_goals: recreated as a legacy<->entity bridge at the end of this file

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

  // Now that to_dos and tasks tables are created, add the FK from work_items to them
  if (!(await columnExists(connection, "work_items", "recurring_from_todo_id"))) {
    await connection.query(`
      ALTER TABLE work_items
        ADD COLUMN recurring_from_todo_id INT,
        ADD COLUMN recurring_from_task_id INT,
        ADD FOREIGN KEY (recurring_from_todo_id) REFERENCES to_dos(id) ON DELETE SET NULL,
        ADD FOREIGN KEY (recurring_from_task_id) REFERENCES tasks(id) ON DELETE SET NULL
    `);
  }

  // Drop folder tables if they exist (replaced by parent_id nesting on to_dos and tasks)
  if (await indexExists(connection, "to_do_folders", "PRIMARY")) {
    await connection.query("DROP TABLE IF EXISTS to_do_folders");
  }
  if (await indexExists(connection, "task_folders", "PRIMARY")) {
    await connection.query("DROP TABLE IF EXISTS task_folders");
  }



  // Create contexts table (top-level scope toggle, e.g. Work vs Life vs Hobbies -
  // distinct from the "areas" table, which backs the unrelated Categories tab)
  // Note: This must be created BEFORE tickets since tickets references contexts
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

  // Contexts table moved to before tickets table (see below, tickets references contexts)

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
  // (e.g. only one priority could ever be named "Project A" across the whole app).
  // Widen them to be per-context so the same name can exist in different
  // contexts without colliding.
  // Note: areas and goals were migrated to generic entities and no longer have these tables
  if (await indexExists(connection, "priorities", "title")) {
    await connection.query("ALTER TABLE priorities DROP INDEX `title`");
    await connection.query(
      "ALTER TABLE priorities ADD UNIQUE KEY unique_context_title (context_id, title)",
    );
  }

  // Add hierarchical associations for cross-entity relationships
  // Todos can have tickets as children
  if (!(await columnExists(connection, "to_dos", "ticket_id"))) {
    await connection.query(
      "ALTER TABLE to_dos ADD COLUMN ticket_id INT, ADD FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE SET NULL"
    );
  }

  if (!(await columnExists(connection, "tickets", "todo_id"))) {
    await connection.query(
      "ALTER TABLE tickets ADD COLUMN todo_id INT, ADD FOREIGN KEY (todo_id) REFERENCES to_dos(id) ON DELETE SET NULL"
    );
  }

  // Note: areas table was migrated to generic entities and no longer exists

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
      type_category ENUM('editable','template','daily','external') DEFAULT 'editable' COMMENT 'editable=user-managed, template=read-only preset tree, daily=one day work container, external=from integrations',
      external_source VARCHAR(100) COMMENT 'For external types: source system (e.g. outlook_calendar)',
      template_structure JSON COMMENT 'For templates: tree structure of entity types with preset values',
      supports_hierarchy BOOLEAN DEFAULT FALSE,
      -- Whether rows of this type can hold FOLDERS. Hierarchical types
      -- normally can; a template cannot, because the template row is
      -- itself the container and a folder inside it is a pointless
      -- second layer.
      supports_folders BOOLEAN DEFAULT TRUE,
      is_system BOOLEAN DEFAULT FALSE,
      primary_date_field VARCHAR(100),
      order_index INT DEFAULT 0,
      is_visible BOOLEAN DEFAULT TRUE COMMENT 'Whether this type gets a tab on the dashboard; toggled from Settings > Entity Types',
      deleted_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_slug (slug),
      INDEX idx_deleted (deleted_at),
      INDEX idx_type_category (type_category)
    )
  `);

  if (!(await columnExists(connection, "entity_types", "supports_folders"))) {
    await connection.query(
      "ALTER TABLE entity_types ADD COLUMN supports_folders BOOLEAN DEFAULT TRUE",
    );
  }

  // Backfill is_visible for entity_types created before the Settings page could
  // hide a type's tab. Defaults to visible so existing installs are unchanged.
  if (!(await columnExists(connection, "entity_types", "is_visible"))) {
    await connection.query(
      "ALTER TABLE entity_types ADD COLUMN is_visible BOOLEAN DEFAULT TRUE",
    );
  }

  // Backfill type_category column for existing records
  if (!(await columnExists(connection, "entity_types", "type_category"))) {
    await connection.query("ALTER TABLE entity_types ADD COLUMN type_category ENUM('editable','template','daily','external') DEFAULT 'editable'");
  }
  if (!(await columnExists(connection, "entity_types", "external_source"))) {
    await connection.query("ALTER TABLE entity_types ADD COLUMN external_source VARCHAR(100)");
  }
  if (!(await columnExists(connection, "entity_types", "template_structure"))) {
    await connection.query("ALTER TABLE entity_types ADD COLUMN template_structure JSON");
  }

  // Create index for type_category if it doesn't exist
  if (!(await indexExists(connection, "entity_types", "idx_type_category"))) {
    await connection.query("CREATE INDEX idx_type_category ON entity_types(type_category)");
  }

  // Seed system entity types if they don't exist.
  for (const type of SYSTEM_ENTITY_TYPES) {
    const [existing] = await connection.query(
      'SELECT id FROM entity_types WHERE slug = ?',
      [type.slug]
    );
    if (existing.length === 0) {
      await connection.query(
        'INSERT INTO entity_types (slug, label, label_singular, icon, type_category, supports_hierarchy, is_system, primary_date_field, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [type.slug, type.label, type.label_singular, type.icon, 'editable', type.supports_hierarchy ? 1 : 0, 1, type.primary_date_field, SYSTEM_ENTITY_TYPES.indexOf(type)]
      );
    }
  }

  // Repair forbidden icons on existing installs. Seeding only inserts, so a
  // database created before the icons were fixed keeps them forever - which is
  // how Categories went back to 📁 and Tasks to 📂. A folder-like icon is never
  // a legitimate customisation (every hierarchical type can hold is_folder rows
  // rendered with 📁, so a folder-ish type icon makes items and the folders
  // containing them indistinguishable), so overwriting it cannot clobber a
  // deliberate choice. Labels are deliberately NOT reconciled here - renaming a
  // type in Settings is legitimate.
  for (const type of SYSTEM_ENTITY_TYPES) {
    await connection.query(
      "UPDATE entity_types SET icon = ? WHERE slug = ? AND icon IN ('📁', '📂')",
      [type.icon, type.slug]
    );
  }

  // Put back icons destroyed by a previous MSSQL build, which wrote its
  // replacement icon as a VARCHAR literal and so stored every emoji as literal
  // question marks. MySQL never caused that damage, but a context database
  // moved or restored from an MSSQL install carries it, and this file is the
  // twin of mssqlSchema.js - the two stay identical in behaviour so a database
  // is repaired the same way whichever engine it is opened on. '?' is never a
  // legitimate icon, so this cannot clobber a real customisation.
  for (const type of SYSTEM_ENTITY_TYPES) {
    await connection.query(
      "UPDATE entity_types SET icon = ? WHERE slug = ? AND icon <> '' AND icon IS NOT NULL AND icon REGEXP '^[?]+$'",
      [type.icon, type.slug]
    );
  }

  // Seed special types (Daily day container and External integrations).
  // Daily = read-only type representing one complete day's work.
  for (const type of SPECIAL_ENTITY_TYPES) {
    const [existing] = await connection.query(
      'SELECT id FROM entity_types WHERE slug = ?',
      [type.slug]
    );
    if (existing.length === 0) {
      await connection.query(
        'INSERT INTO entity_types (slug, label, label_singular, icon, type_category, external_source, supports_hierarchy, is_system, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [type.slug, type.label, type.label_singular, type.icon, type.type_category, type.external_source, 0, 1, 0]
      );
    }
  }

  // The 'daily' type used to be seeded above too (SPECIAL_ENTITY_TYPES no
  // longer lists it - see systemEntityTypes.js). It was dead configuration:
  // "Dailies" (work_item) already serves the day-grouping role via "+ Daily",
  // which has always created a work_item row, not a row of this type. Retire
  // any already-seeded row the same soft-delete way any other type is removed.
  await connection.query(
    "UPDATE entity_types SET deleted_at = NOW() WHERE slug = 'daily' AND deleted_at IS NULL",
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS entity_type_fields (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type_id INT NOT NULL,
      field_key VARCHAR(100) NOT NULL,
      label VARCHAR(255) NOT NULL,
      field_type ENUM('text','textarea','number','date','url','links','select','radio','status','priority','checkbox','recurrence','emoji','emojis','duration','timebox','notes','worked_with_claude') NOT NULL,
      field_options JSON,
      required BOOLEAN DEFAULT FALSE,
      display_order INT DEFAULT 0,
      show_in_row BOOLEAN DEFAULT FALSE,
      is_completion_signal BOOLEAN DEFAULT FALSE,
      rollup VARCHAR(20) NULL,
      show_column_label BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_type_id) REFERENCES entity_types(id) ON DELETE CASCADE,
      UNIQUE KEY unique_type_field (entity_type_id, field_key),
      INDEX idx_type (entity_type_id)
    )
  `);

  // Where the Title column sits among the field columns. Title is not a field,
  // so it has no display_order of its own; this interleaves with them. 0 puts
  // it first, which is where it has always been.
  if (!(await columnExists(connection, "entity_types", "title_order"))) {
    await connection.query("ALTER TABLE entity_types ADD COLUMN title_order INT NOT NULL DEFAULT 0");
  }

  // How a folder derives this field from the items beneath it: 'status', 'sum',
  // 'min', 'max', 'avg', 'all', 'any'. NULL means the field does not roll up,
  // which is the case for every field type where an aggregate is meaningless
  // (text, links, recurrence, ...). Folders never store a value - the roll-up
  // is computed at render time - so this only declares the rule.
  if (!(await columnExists(connection, "entity_type_fields", "rollup"))) {
    await connection.query("ALTER TABLE entity_type_fields ADD COLUMN rollup VARCHAR(20) NULL");
  }

  // Whether this column's NAME is drawn in the header. A checkbox or emoji
  // column is self-explanatory and its label just eats the width. Defaults to
  // true so nothing changes for fields that predate it.
  if (!(await columnExists(connection, "entity_type_fields", "show_column_label"))) {
    await connection.query("ALTER TABLE entity_type_fields ADD COLUMN show_column_label BOOLEAN DEFAULT TRUE");
  }

  // Widen field_type for tables created before url/links/radio existed. The
  // type editor and entityTypeService already offered 'url' and 'radio' while
  // the ENUM did not list them, so saving such a field silently truncated
  // ("Data truncated for column 'field_type'"). MODIFY COLUMN is idempotent -
  // re-applying the same definition is a no-op.
  // Note: mssqlSchema.js stores this as NVARCHAR(50) with no constraint, so it
  // accepts any value and needs no matching change.
  await connection.query(`
    ALTER TABLE entity_type_fields
    MODIFY COLUMN field_type ENUM('text','textarea','number','date','url','links','select','radio','status','priority','checkbox','recurrence','emoji','emojis','duration','timebox','notes','worked_with_claude') NOT NULL
  `);

  // Seed default fields for system entity types. Array order is display_order.
  for (const type of SYSTEM_ENTITY_TYPES) {
    const [typeResult] = await connection.query(
      'SELECT id FROM entity_types WHERE slug = ?',
      [type.slug]
    );
    if (typeResult.length === 0) continue;
    const typeId = typeResult[0].id;

    for (let i = 0; i < type.fields.length; i++) {
      const field = type.fields[i];
      const [existing] = await connection.query(
        'SELECT id FROM entity_type_fields WHERE entity_type_id = ? AND field_key = ?',
        [typeId, field.field_key]
      );
      if (existing.length === 0) {
        await connection.query(
          'INSERT INTO entity_type_fields (entity_type_id, field_key, label, field_type, field_options, required, display_order, show_in_row, is_completion_signal, rollup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [typeId, field.field_key, field.label, field.field_type, field.field_options ? JSON.stringify(field.field_options) : null, field.required ? 1 : 0, i, field.show_in_row ? 1 : 0, field.is_completion_signal ? 1 : 0, field.rollup || null]
        );
      } else {
        // Reconcile only what the type editor does NOT expose: display_order
        // and is_completion_signal. A field added to a type later gets the
        // index it has here while fields already in the table keep the indexes
        // they were seeded with, so the two collide and the editor renders them
        // in an arbitrary order.
        //
        // `show_in_row` is deliberately NOT reconciled: it is which columns the
        // page shows, and it is now editable both in this editor and via the
        // column chooser on the page. Overwriting it here would silently reset
        // the user's chosen columns on every schema run.
        //
        // `label`, `field_type` and `field_options` are likewise editable and
        // must not be overwritten.
        await connection.query(
          'UPDATE entity_type_fields SET display_order = ?, is_completion_signal = ? WHERE id = ?',
          [i, field.is_completion_signal ? 1 : 0, existing[0].id]
        );
      }
    }
  }

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

  // Seed the type-to-type relationship rules. This file never used to do this
  // at all, so an install created by `db:init` had hierarchical types with no
  // self-nesting rule - which renders a tree whose every drag-to-nest is
  // rejected, and is why `goal -> goal` kept having to be re-added by hand.
  {
    const [typeRows] = await connection.query('SELECT id, slug FROM entity_types');
    const typeIdBySlug = new Map(typeRows.map((r) => [r.slug, r.id]));

    const insertRule = async (parentSlug, childSlug, rel) => {
      const parentId = typeIdBySlug.get(parentSlug);
      const childId = typeIdBySlug.get(childSlug);
      if (!parentId || !childId) return;
      const [existing] = await connection.query(
        'SELECT id FROM entity_type_relationships WHERE parent_type_id = ? AND child_type_id = ? AND relationship_kind = ?',
        [parentId, childId, rel.relationship_kind]
      );
      if (existing.length > 0) return;
      await connection.query(
        'INSERT INTO entity_type_relationships (parent_type_id, child_type_id, relationship_kind, max_children_per_parent, max_parents_per_child) VALUES (?, ?, ?, ?, ?)',
        [parentId, childId, rel.relationship_kind, rel.max_children_per_parent, rel.max_parents_per_child]
      );
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

  await connection.query(`
    CREATE TABLE IF NOT EXISTS entities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      entity_type_id INT NOT NULL,
      context_id INT NOT NULL,
      title VARCHAR(255) NOT NULL,
      order_index INT DEFAULT 0,
      is_folder BOOLEAN DEFAULT FALSE,
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

  // Backfill is_folder for pre-existing entities tables (added after the
  // initial Phase 10 rollout - "+ Folder" previously created an
  // indistinguishable plain entity, so folder rows only looked different
  // once they happened to have children)
  if (!(await columnExists(connection, "entities", "is_folder"))) {
    await connection.query(
      "ALTER TABLE entities ADD COLUMN is_folder BOOLEAN DEFAULT FALSE",
    );
  }

  // Soft delete. Deleting a folder deliberately takes everything inside it, so
  // there has to be a way back - see entityService.deleteEntity and the
  // Recently Deleted view. Reads filter on deleted_at IS NULL.
  //
  // These two blocks must stay BELOW the CREATE TABLE above. They used to sit
  // near the top of this file and broke every build against a database without
  // an `entities` table.
  if (!(await columnExists(connection, "entities", "deleted_at"))) {
    await connection.query(
      "ALTER TABLE entities ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL",
    );
    await connection.query(
      "CREATE INDEX idx_entities_deleted_at ON entities(deleted_at)",
    );
  }

  // Which delete a row went out with. NOT the timestamp: deleted_at is a
  // DATETIME with one-second granularity, so two unrelated deletes in the same
  // second grouped together and restoring one brought back the other.
  if (!(await columnExists(connection, "entities", "deleted_batch"))) {
    await connection.query(
      "ALTER TABLE entities ADD COLUMN deleted_batch VARCHAR(36) NULL DEFAULT NULL",
    );
    await connection.query(
      "CREATE INDEX idx_entities_deleted_batch ON entities(deleted_batch)",
    );
  }

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

  // ===== Legacy <-> entity association bridge =====
  //
  // Areas, goals and ideas live in `entities` (migrated in Phases 1-3), and
  // work items do too as of Phase 10 (scripts/phase10-migrate-work-items.js) -
  // but `priorities` and `work_item_templates` are still their own legacy
  // tables (priorityService.js already reads/writes through entityService,
  // but the physical `priorities` table itself, and everything still keyed to
  // its id, has not moved). The edges between a legacy row and an entity can't
  // live in `entity_relationships`, whose foreign keys point at `entities` on
  // both sides - so these four junctions bridge the two id spaces: the left
  // column is a legacy row id, the right column is an `entities.id`.
  //
  // Phases 1-3 dropped these tables outright without updating their consumers
  // (workItemService/priorityService/workItemTemplateService), which is what
  // left Dailies, Projects and Reporting throwing "a required database table is
  // missing" on every load. They are back deliberately and temporarily.
  //
  // RETIRE THESE when priorities itself becomes entities - at that point every
  // remaining edge collapses into entity_relationships and these four tables
  // can be dropped for good. Until then, do not "re-remove" them.
  //
  // They must be created here, after `entities` exists, rather than beside the
  // legacy tables they also reference, or MySQL raises "Failed to open the
  // referenced table" - the same ordering constraint noted for the other
  // junctions earlier in this file.
  // What is left of the bridge. The eight work_* junctions are gone: every link
  // a day holds is a row in work_entity_associations, which needs no entry per
  // type and so covers types invented later. These four still join a legacy
  // PROJECT or TEMPLATE row to an entity, and go when those two tables become
  // entities themselves.
  const bridgeJunctions = [
    // [table, legacy column, legacy table, entity column]
    ["priority_areas", "priority_id", "priorities", "area_id"],
    ["priority_goals", "priority_id", "priorities", "goal_id"],
    ["template_areas", "template_id", "work_item_templates", "area_id"],
    ["template_goals", "template_id", "work_item_templates", "goal_id"],
  ];

  // ONE junction for every type, including types invented after this was
  // written. The eight per-type junctions it replaced could not hold a type the
  // user created - no table existed for it and none could be added from the app
  // - and having no order column, they could not order a day's children either.
  //
  // work_item_id points at `entities`, not the legacy `work_items` table - a
  // "day" is itself a work_item entity now (see the work_items -> entities
  // migration below), so both columns share one id space. A fresh install
  // never has a legacy work_items row to point at in the first place; an
  // existing install's already-created FK is repointed by
  // scripts/phase10-migrate-work-items.js.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_entity_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      entity_id INT NOT NULL,
      order_index INT DEFAULT 0,
      FOREIGN KEY (work_item_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_entity (work_item_id, entity_id),
      INDEX idx_wea_work (work_item_id),
      INDEX idx_wea_entity (entity_id)
    )
  `);

  // A source is not an entity, so this one stays a plain junction rather than
  // joining the bridge below - but work_item_id is the same entities-pointing
  // column as work_entity_associations above, for the same reason.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_source_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      work_item_id INT NOT NULL,
      source_id INT NOT NULL,
      FOREIGN KEY (work_item_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_source (work_item_id, source_id)
    )
  `);

  // A record put on a day WITHOUT a work item wrapped round it.
  //
  // work_entity_associations requires a work_item_id, so until this table
  // existed nothing could sit on a date unless a work item was created to hold
  // it - dragging an idea onto a day invented a work item named after the idea,
  // whether or not that was wanted. This is the same relationship one level up:
  // the day itself is the parent.
  //
  // No copy/reference column. Whether a row is a copy is already answered by
  // entity_relationships' `instantiated_from` edge (findClonedEntityIds), and
  // recording it twice is how the two answers come to disagree.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS daily_entities (
      id INT AUTO_INCREMENT PRIMARY KEY,
      context_id INT NOT NULL,
      date DATE NOT NULL,
      entity_id INT NOT NULL,
      order_index INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      UNIQUE KEY unique_daily_entity (context_id, date, entity_id),
      INDEX idx_de_date (context_id, date),
      INDEX idx_de_entity (entity_id)
    )
  `);

  for (const [table, legacyCol, legacyTable, entityCol] of bridgeJunctions) {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id INT AUTO_INCREMENT PRIMARY KEY,
        ${legacyCol} INT NOT NULL,
        ${entityCol} INT NOT NULL,
        FOREIGN KEY (${legacyCol}) REFERENCES ${legacyTable}(id) ON DELETE CASCADE,
        FOREIGN KEY (${entityCol}) REFERENCES entities(id) ON DELETE CASCADE,
        UNIQUE KEY unique_${table} (${legacyCol}, ${entityCol}),
        INDEX idx_${table}_legacy (${legacyCol}),
        INDEX idx_${table}_entity (${entityCol})
      )
    `);
  }
}
