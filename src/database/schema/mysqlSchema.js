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
import { RETIRED_TABLES, LEGACY_TABLE_TYPE } from '../retiredTables.js';
import {
  SYSTEM_ENTITY_TYPES,
  resolveTypeRelationships,
  upgradedStatusOptions,
} from '../systemEntityTypes.js';

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) as cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
    [table, column],
  );
  return rows[0].cnt > 0;
}

// dropForeignKeysOnColumn lived here. Its callers were the column-level
// migrations on `priorities` and `tasks`, which went with those tables.

async function indexExists(connection, table, indexName) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) as cnt FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?",
    [table, indexName],
  );
  return rows[0].cnt > 0;
}

// Checks for a single well-known table as a signal that the MyWork schema has
// already been created in the connection's current database.
//
// `entities`, NOT `work_items`. This probe is what app.js uses to decide
// whether to send every page to /setup, and it pointed at a legacy table that
// has now been dropped - which would have redirected the whole app to the setup
// wizard on a perfectly good database. `entities` is the right sentinel
// regardless: it is the table the engine cannot run without.
export async function mysqlSchemaExists(connection) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) as cnt FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entities'",
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

  // The `categories` table is gone - see RETIRED_TABLES at the end of this file.
  // It was a static goal-grouping list, unrelated to the Categories TYPE (slug
  // `category`, formerly `area`), which lives in entities like every other
  // editable type. Nothing read it.

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

  // `priorities` is RETIRED - see RETIRED_TABLES. Projects are entities, all
  // of its rows are migrated, and nothing in src/ reads it. Its CREATE and its
  // three backfills lived here; recreating a table the same run then drops is
  // pure churn. dropRetiredTables removes the foreign keys pointing AT it
  // first, which is what `to_dos.priority_id` needed.
  //
  // The block that moved the `entities` soft-delete backfill out of here still
  // applies to anything added in its place: a backfill can only run after the
  // thing it backfills is created.

  // priority_areas: recreated as a legacy<->entity bridge at the end of this
  // file, after `entities` exists (see "Legacy <-> entity association bridge")

  // priority_goals: recreated as a legacy<->entity bridge at the end of this file

  // The priorities.area_id -> priority_areas migration stood here. It is gone
  // with the `priorities` table itself (RETIRED_TABLES).

  // The `work_items` table is gone - see RETIRED_TABLES at the end of this
  // file. Dailies are entities of type `daily` now; scripts/phase10-migrate-
  // work-items.js moved the rows and repointed the two junctions that used to
  // reference work_items(id).

  // Backfill tracking columns for recurring items (link to source todo/task)
  // Note: This FK creation is moved to after to_dos and tasks tables are created
  // to avoid "Failed to open the referenced table" errors




  // work_source_associations: created further down, alongside
  // work_entity_associations, because its daily_id column now points at
  // `entities` (see "Legacy <-> entity association bridge") - `entities`
  // does not exist yet at this point in the file.



  // Create work_item_templates table (reusable daily presets with pre-associated
  // categories/goals/priorities)
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

  // template_priorities: recreated as a legacy<->entity bridge at the end of
  // this file, for the same reason as its two neighbours above.
  //
  // It used to be created HERE, with `priority_id` referencing `priorities`.
  // Projects stopped living in that table when they became entities, so the
  // constraint demanded an id from a table holding nothing but stale rows,
  // while dailyTemplateService READS the same column with
  // `JOIN entities p ON tp.priority_id = p.id`. Read and write disagreed about
  // what the id meant, and associating a project with a template could only
  // fail. It survived because this machine's database was repointed by hand -
  // so the fault was invisible locally and shipped to every fresh build and
  // every MSSQL install.

  // `to_dos` and `to_do_items` are RETIRED - see RETIRED_TABLES. Their CREATEs
  // and backfills stood here.

  // `tasks` is RETIRED - see RETIRED_TABLES. Tasks are entities, every one of
  // its rows has a matching `task` entity, and nothing in src/ reads the table.
  // Its CREATE and its four backfills stood here. One of those backfills is
  // why it had to go at the same time as `priorities`: it added
  // `tasks.priority_id` REFERENCES priorities(id), so the dead table could not
  // be dropped while this one was still being created.

  // Drop folder tables if they exist (replaced by parent_id nesting on to_dos and tasks)
  if (await indexExists(connection, "to_do_folders", "PRIMARY")) {
    await connection.query("DROP TABLE IF EXISTS to_do_folders");
  }
  if (await indexExists(connection, "task_folders", "PRIMARY")) {
    await connection.query("DROP TABLE IF EXISTS task_folders");
  }



  // Create contexts table (top-level scope toggle, e.g. Work vs Life vs Hobbies -
  // not to be confused with Categories, which are entities of type `category`)
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

  // The `tickets` table is gone - see RETIRED_TABLES at the end of this file.
  // Unrelated to the Tickets TYPE (slug `ticket`), which lives in entities like
  // every other editable type. Nothing read the table.

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
    "work_item_templates",
  ];
  // "work_items", "tickets", "priorities" and "tasks" were here until they were
  // retired - see RETIRED_TABLES. Leaving a dropped table in this list makes the
  // ALTER below throw on every schema run, which is exactly what "priorities"
  // and "tasks" did the first time they were dropped.
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
  // The priorities.title widening stood here, and went with that table.

  // The to_dos <-> tickets cross-links are gone with the `tickets` table. Both
  // sides were FKs into a table nothing read; cross-entity relationships live in
  // entity_relationships now.

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

  // Slug renames, which MUST run before the seed loop below.
  //
  // Seeding matches on slug, so a renamed type looks like a MISSING one: without
  // this the loop would insert a brand new empty `daily` beside the existing
  // `work_item`, and the app would show two Dailies tabs, one of them holding
  // every record and the other nothing.
  //
  // A slug is now the singular of the label - Dailies/daily, Categories/category
  // - so the internal name and the visible one agree. `work_item` and `area`
  // were the pre-migration names and matched neither.
  //
  // The retired, empty `daily` type has to go first because slug is UNIQUE and
  // it is sitting on the name. It is only removed when it really is empty; if a
  // row ever attached itself to it, it is left alone and the rename below is
  // skipped rather than losing anything.
  // `entities` is created LATER in this file, so on a brand new database it does
  // not exist yet and naming it here made the whole schema build fail with
  // "Table 'entities' doesn't exist". Guarded rather than moved: this has to run
  // before the seed loop, and the seed loop comes before entities.
  const [[{ hasEntities }]] = await connection.query(
    `SELECT COUNT(*) AS hasEntities FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entities'`
  );
  await connection.query(
    hasEntities
      ? `DELETE FROM entity_types
          WHERE slug = 'daily' AND deleted_at IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM entities WHERE entities.entity_type_id = entity_types.id)`
      : `DELETE FROM entity_types WHERE slug = 'daily' AND deleted_at IS NOT NULL`
  );
  const renameType = async (from, to, label, labelSingular) => {
    const [clash] = await connection.query('SELECT id FROM entity_types WHERE slug = ?', [to]);
    if (clash.length) return;                       // already renamed, or the name is taken
    // The label moves with the slug. The seed loop below only ever INSERTs, so
    // an existing type keeps whatever label it had - which left the tab reading
    // "Work Items" long after systemEntityTypes.js said "Dailies".
    await connection.query(
      'UPDATE entity_types SET slug = ?, label = ?, label_singular = ? WHERE slug = ?',
      [to, label, labelSingular, from]
    );
  };
  await renameType('work_item', 'daily', 'Dailies', 'Daily');
  await renameType('area', 'category', 'Categories', 'Category');

  // Repair the labels the rename left behind. renameType only fires while the
  // OLD slug is still present, so an install that renamed on an earlier run
  // kept its stale label - the tab read "Work Items" under the slug `daily`.
  // Matched on the exact legacy label so a deliberate rename in Settings is
  // never overwritten.
  await connection.query(
    "UPDATE entity_types SET label = 'Dailies', label_singular = 'Daily' WHERE slug = 'daily' AND label = 'Work Items'",
  );
  await connection.query(
    "UPDATE entity_types SET label_singular = 'Category' WHERE slug = 'category' AND label_singular = 'Area'",
  );

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

  // The old 'daily' type - a read-only day container - used to be retired here
  // on every schema run. That statement is GONE, and must not come back: `daily` is
  // now the slug of the Dailies type itself (renamed from `work_item` above), so
  // re-adding it would soft-delete the live Dailies tab on every restart. The
  // empty retired row it used to target is deleted by the rename block instead.
  await connection.query(
    "UPDATE entity_types SET deleted_at = NULL WHERE slug = 'daily' AND is_system = 1",
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
        'SELECT id, field_options FROM entity_type_fields WHERE entity_type_id = ? AND field_key = ?',
        [typeId, field.field_key]
      );
      if (existing.length === 0) {
        // A NEW field goes on the END, not at its index in this array.
        //
        // Using the array index put it on top of whatever field already held
        // that number, which is half of how `priority` came to hold
        // display_order 1,1,2,2,3,3. Ordering is `display_order, id`, so once
        // values tie the id decides and the field order is arbitrary.
        const [[{ nextOrder }]] = await connection.query(
          'SELECT COALESCE(MAX(display_order), -1) + 1 AS nextOrder FROM entity_type_fields WHERE entity_type_id = ?',
          [typeId]
        );
        await connection.query(
          'INSERT INTO entity_type_fields (entity_type_id, field_key, label, field_type, field_options, required, display_order, show_in_row, is_completion_signal, rollup) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [typeId, field.field_key, field.label, field.field_type, field.field_options ? JSON.stringify(field.field_options) : null, field.required ? 1 : 0, nextOrder, field.show_in_row ? 1 : 0, field.is_completion_signal ? 1 : 0, field.rollup || null]
        );
      } else {
        // Reconcile ONLY `is_completion_signal`, which the type editor does not
        // expose.
        //
        // `display_order` used to be reconciled here too, and that was a bug:
        // it is as user-editable as the fields listed below - dragging a column
        // header writes it, and CLAUDE_REFERENCE.md names it as one value
        // edited from two places. Overwriting it meant every "Fix Schema" threw
        // away the column order the user had arranged, resetting it to the
        // order this array happens to be in.
        //
        // `show_in_row` is deliberately NOT reconciled: it is which columns the
        // page shows, and it is now editable both in this editor and via the
        // column chooser on the page. Overwriting it here would silently reset
        // the user's chosen columns on every schema run.
        //
        // `label`, `field_type` and `field_options` are likewise editable and
        // must not be overwritten.
        await connection.query(
          'UPDATE entity_type_fields SET is_completion_signal = ? WHERE id = ?',
          [field.is_completion_signal ? 1 : 0, existing[0].id]
        );

        // ...and `rollup`, but ONLY where the stored value is NULL.
        //
        // `rollup` IS user-editable - the type editor offers a roll-up mode per
        // field - so this must not overwrite a choice the way display_order
        // once did. It does not have to: "No roll-up" stores the empty string,
        // never NULL, so NULL means the column was added after the field was
        // and nothing has ever written it. Every one of the 130 fields in this
        // database was NULL, which is to say roll-ups were declared in the seed
        // and dead everywhere - a folder's cells came back blank, and
        // rollup-depth.spec failed on a folder that showed "" where its failed
        // grandchild should have surfaced.
        if (field.rollup) {
          await connection.query(
            'UPDATE entity_type_fields SET rollup = ? WHERE id = ? AND rollup IS NULL',
            [field.rollup, existing[0].id]
          );
        }

        // ...and the status vocabulary, where it is safe to - see
        // upgradedStatusOptions. Without `Failed` in the list, a failed child
        // was not classified as a failure and could not surface on its folder.
        const upgraded = upgradedStatusOptions(existing[0].field_options, field.field_options);
        if (upgraded) {
          await connection.query(
            'UPDATE entity_type_fields SET field_options = ? WHERE id = ?',
            [JSON.stringify(upgraded), existing[0].id]
          );
        }
      }
    }
  }

  // Worked Time drifted. `focus_seconds` has been declared as a `duration`
  // labelled "Worked Time" since 2026-08-19, but the loop above only INSERTs and
  // deliberately does NOT reconcile field_type or label (they are user-editable
  // - see the note there), so every database created before that date kept the
  // old `number` / "Focus time (seconds)". CLAUDE.md's rule is that Worked Time
  // is on every type, and as a plain number it does not render as one.
  //
  // Matched on the exact stale pair, so a field a user deliberately retyped or
  // renamed is left alone - the same rule the icon repair follows.
  await connection.query(
    `UPDATE entity_type_fields SET field_type = 'duration', label = 'Worked Time'
      WHERE field_key = 'focus_seconds'
        AND field_type = 'number' AND label = 'Focus time (seconds)'`
  );

  // Remove the orphaned `recurrence` field definitions.
  //
  // Recurrence was withdrawn on 2026-08-19 (a9e720a took its <option> out of the
  // type editor) but the field definitions stayed behind on Todos and Tasks, so
  // the app carried a field type it no longer knows how to edit - which is what
  // entity-type-integrity.spec.js exists to catch.
  //
  // Guarded on having no stored values, so this can only ever remove an EMPTY
  // definition. If a future recurrence implementation puts data here, this stops
  // firing rather than deleting it.
  // Guarded because entity_field_values is created LATER in this file, so on a
  // brand new database it does not exist yet - the same trap the `entities`
  // reference in the rename block above fell into. On a fresh build there are no
  // recurrence fields to clean up anyway.
  const [[{ hasValues }]] = await connection.query(
    `SELECT COUNT(*) AS hasValues FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'entity_field_values'`
  );
  if (hasValues) {
    await connection.query(
      `DELETE FROM entity_type_fields
        WHERE field_type = 'recurrence'
          AND NOT EXISTS (
            SELECT 1 FROM (SELECT DISTINCT field_key FROM entity_field_values) v
             WHERE v.field_key = entity_type_fields.field_key
          )`
    );

    // The other half of the same withdrawal. `recurring_from_todo_id` and
    // `recurring_from_task_id` were how a generated daily pointed back at the
    // to-do or task that produced it. The engine that wrote them was deleted on
    // 2026-08-25, so they are now two number fields nothing can ever fill.
    //
    // Guarded on having no stored values for exactly the same reason as the
    // block above: this may only remove an EMPTY definition. If anything ever
    // put data here, it stops firing rather than deleting it.
    await connection.query(
      `DELETE FROM entity_type_fields
        WHERE field_key IN ('recurring_from_todo_id', 'recurring_from_task_id')
          AND NOT EXISTS (
            SELECT 1 FROM (SELECT DISTINCT field_key FROM entity_field_values) v
             WHERE v.field_key = entity_type_fields.field_key
          )`
    );
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
      legacy_daily_id INT UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
      INDEX idx_type (entity_type_id),
      INDEX idx_context (context_id),
      INDEX idx_type_context (entity_type_id, context_id),
      INDEX idx_legacy (legacy_daily_id)
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

  // Repair duplicate `display_order` values.
  //
  // Dragging a column header used to renumber only the VISIBLE columns 0..n-1
  // and leave hidden fields on the numbers they already had, so the two sets
  // collided - `priority` was found holding 1,1,2,2,3,3. Field order is
  // `ORDER BY display_order, id`, so a tie hands the decision to the id, and
  // the editor's field order then drifts on its own. It also made
  // capture-type-defaults.js non-deterministic.
  //
  // The write path is fixed (generic-entity-init.js renumbers every field
  // now), but installs that already drifted need repairing, so this runs on
  // every schema update. Written as a JS loop rather than one UPDATE with
  // ROW_NUMBER(): that needs MySQL 8 / MariaDB 10.2, and this file still
  // targets older MariaDB elsewhere for the same reason it uses CHANGE COLUMN.
  const [typeRows] = await connection.query(
    'SELECT id FROM entity_types WHERE deleted_at IS NULL'
  );
  for (const type of typeRows) {
    const [fieldRows] = await connection.query(
      'SELECT id, display_order FROM entity_type_fields WHERE entity_type_id = ? ORDER BY display_order, id',
      [type.id]
    );
    const unique = new Set(fieldRows.map((f) => f.display_order)).size;
    if (unique === fieldRows.length) continue;      // already dense enough
    for (const [index, field] of fieldRows.entries()) {
      if (field.display_order === index) continue;
      await connection.query(
        'UPDATE entity_type_fields SET display_order = ? WHERE id = ?',
        [index, field.id]
      );
    }
  }

  // The nesting RULES that said a to-do or task may recur into a daily.
  // Recurrence was withdrawn on 2026-08-19 and the engine deleted on
  // 2026-08-25; these two rows are all that was left of it.
  //
  // Placed HERE, and not beside the recurrence field cleanup a few hundred
  // lines up, because both tables it names are created BELOW that point. That
  // ordering has already broken a fresh build twice in this file - once for
  // `entities`, once for `entity_field_values`. Guarded on no relationship of
  // that kind existing, so it can only remove a rule nothing is using.
  await connection.query(
    `DELETE FROM entity_type_relationships
      WHERE relationship_kind = 'recurrence'
        AND NOT EXISTS (
          SELECT 1 FROM (
            SELECT DISTINCT relationship_kind FROM entity_relationships
          ) r WHERE r.relationship_kind = 'recurrence'
        )`
  );

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
  // (dailyService/priorityService/dailyTemplateService), which is what
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
    // Both columns are ENTITY ids. A project is an entity now, so this is no
    // longer a bridge from a legacy row to an entity - it is entity-to-entity,
    // and `priorities` is not one of its endpoints.
    //
    // It said `priorities` here until 2026-08-25, which emitted
    // `FOREIGN KEY (priority_id) REFERENCES priorities(id)` on every fresh
    // build, while priorityService joins that column against project ENTITY
    // ids. The constraint wanted an id from a table projects had left, so
    // associating a category or a goal with a project could only fail. This
    // machine's database had been repointed by hand, which is exactly why it
    // went unseen: the fault existed only where nobody was looking - fresh
    // builds and MSSQL.
    ["priority_areas", "priority_id", "entities", "area_id"],
    ["priority_goals", "priority_id", "entities", "goal_id"],
    ["template_areas", "template_id", "work_item_templates", "area_id"],
    ["template_goals", "template_id", "work_item_templates", "goal_id"],
    ["template_priorities", "template_id", "work_item_templates", "priority_id"],
  ];

  // ONE junction for every type, including types invented after this was
  // written. The eight per-type junctions it replaced could not hold a type the
  // user created - no table existed for it and none could be added from the app
  // - and having no order column, they could not order a day's children either.
  //
  // daily_id points at `entities`, not the legacy `work_items` table - a
  // "day" is itself a `daily` entity now (see the work_items -> entities
  // migration below), so both columns share one id space. A fresh install
  // never has a legacy work_items row to point at in the first place; an
  // existing install's already-created FK is repointed by
  // scripts/phase10-migrate-work-items.js.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_entity_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      daily_id INT NOT NULL,
      entity_id INT NOT NULL,
      order_index INT DEFAULT 0,
      FOREIGN KEY (daily_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_entity (daily_id, entity_id),
      INDEX idx_wea_work (daily_id),
      INDEX idx_wea_entity (entity_id)
    )
  `);

  // A source is not an entity, so this one stays a plain junction rather than
  // joining the bridge below - but daily_id is the same entities-pointing
  // column as work_entity_associations above, for the same reason.
  await connection.query(`
    CREATE TABLE IF NOT EXISTS work_source_associations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      daily_id INT NOT NULL,
      source_id INT NOT NULL,
      FOREIGN KEY (daily_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
      UNIQUE KEY unique_work_source (daily_id, source_id)
    )
  `);

  // A record put on a day WITHOUT a work item wrapped round it.
  //
  // work_entity_associations requires a daily_id, so until this table
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
  await renameLegacyColumns(connection);
  await dropRetiredTables(connection);
}

// Columns still named after concepts that were renamed: a `work_item` is a
// `daily` now. The tables these live on are permanent, so unlike the *_areas
// bridges (which disappear when `priorities` becomes an entity type) it is
// worth spending the rename on them.
//
// `CHANGE COLUMN` rather than `RENAME COLUMN`: RENAME needs MySQL 8.0+ /
// MariaDB 10.5.2+, and this file has to run on whatever either engine offers.
// The definition is restated exactly - get it wrong and you silently alter the
// column instead of renaming it.
const LEGACY_COLUMN_RENAMES = [
  ['work_entity_associations', 'work_item_id', 'daily_id', 'INT NOT NULL'],
  ['work_source_associations', 'work_item_id', 'daily_id', 'INT NOT NULL'],
  ['entities', 'legacy_work_item_id', 'legacy_daily_id', 'INT NULL'],
];

async function renameLegacyColumns(connection) {
  for (const [table, from, to, definition] of LEGACY_COLUMN_RENAMES) {
    // Guarded on BOTH sides: the old name must still be there and the new one
    // must not, so the rename runs exactly once and a re-run is a no-op.
    if (!(await columnExists(connection, table, from))) continue;
    if (await columnExists(connection, table, to)) continue;
    await connection.query(
      `ALTER TABLE \`${table}\` CHANGE COLUMN \`${from}\` \`${to}\` ${definition}`,
    );
  }
}

// Tables the app no longer has any code for. Dropped on every schema run, so a
// database that predates their retirement is cleaned up by the same "Fix
// Schema" that builds a new one.
//
// Order matters: a table is only dropped after anything that referenced it, so
// the DROPs cannot be blocked by a foreign key. `entities` is deliberately NOT
// here - it is the schema-exists sentinel now.
//
// A note on names, because two of these are dangerously close to live things:
//   `categories` was a static goal-grouping list. The Categories TYPE is slug
//     `category` (formerly `area`) and lives in `entities`. Untouched.
//   `tickets` was the pre-migration ticket table. The Tickets TYPE is slug
//     `ticket` and lives in `entities`. Untouched.
//   `work_items` held Dailies before they became entities of type `daily`.
//     scripts/phase10-migrate-work-items.js moves those rows; run it BEFORE
//     this drop reaches a database that still has unmigrated ones.
//   `tasks` and `priorities` held Tasks and Projects before those became
//     entities. Both are fully migrated - every row has a matching entity -
//     and NOTHING in src/ reads either table any more; `priorities` was the
//     last thing keeping three junctions pointed at a dead endpoint.
//   `to_dos` / `to_do_items` held Todos and their checklists. Both have been
//     EMPTY since the todos migration; their last reader was toDoService,
//     which reportingService used to build the "Todos & Ideas" report - so
//     that report returned every Idea and not one Todo. It reads to_do
//     ENTITIES now and toDoService is deleted.
// RETIRED_TABLES and LEGACY_TABLE_TYPE are imported from
// ../retiredTables.js - one list, shared with the service behind the
// "Drop Retired Tables" button so a third copy cannot drift.

// Rows of a legacy table that never made it into `entities`.
//
// The same shape of guard as workItemsSafeToDrop below, but matched on TITLE
// rather than on a legacy id column, because only Dailies left one behind
// (`legacy_daily_id`). Weaker evidence, so it is used only for tables that no
// code reads at all - a stale row nobody queries costs nothing, and dropping
// one that was never migrated cannot be undone.


async function legacyTableSafeToDrop(connection, table) {
  const typeSlug = LEGACY_TABLE_TYPE[table];
  if (!typeSlug) return true;
  const [[{ n: rows }]] = await connection.query(`SELECT COUNT(*) AS n FROM \`${table}\``);
  if (rows === 0) return true;
  const [[{ n: orphans }]] = await connection.query(
    `SELECT COUNT(*) AS n FROM \`${table}\` l
      WHERE NOT EXISTS (
        SELECT 1 FROM entities e
          JOIN entity_types t ON t.id = e.entity_type_id
         WHERE t.slug = ? AND e.title = l.title)`,
    [typeSlug],
  );
  return orphans === 0;
}

// Would dropping `work_items` destroy Dailies that were never migrated?
//
// The rows move into `entities` as type `daily` by way of
// scripts/phase10-migrate-work-items.js, which is MySQL-only and has to be run
// by hand. A database where that has not happened yet still holds every daily
// in this table, and the schema runs on every server start - so an unguarded
// DROP would silently destroy them on the first restart after a pull. Each
// migrated row leaves a `legacy_daily_id` on its entity, which is exactly
// the evidence needed.
async function workItemsSafeToDrop(connection) {
  const [[{ n: rows }]] = await connection.query('SELECT COUNT(*) AS n FROM work_items');
  if (rows === 0) return true;                       // nothing to lose
  const [[{ n: migrated }]] = await connection.query(
    'SELECT COUNT(*) AS n FROM entities WHERE legacy_daily_id IS NOT NULL',
  );
  return migrated >= rows;
}

async function dropRetiredTables(connection) {
  for (const table of RETIRED_TABLES) {
    // The one table that can still hold data worth keeping - see above. Left in
    // place, loudly, rather than dropped: a table nobody reads is harmless, and
    // a lost day of work is not.
    if (LEGACY_TABLE_TYPE[table]) {
      const [exists] = await connection.query(
        `SELECT COUNT(*) AS n FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
        [table],
      );
      if (!exists[0].n) continue;
      if (!(await legacyTableSafeToDrop(connection, table))) {
        console.warn(
          `[schema] ${table} still holds rows with no matching entity - NOT dropping it.`,
        );
        continue;
      }
    }

    if (table === 'work_items') {
      const [exists] = await connection.query(
        `SELECT COUNT(*) AS n FROM information_schema.TABLES
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'work_items'`,
      );
      if (!exists[0].n) continue;
      if (!(await workItemsSafeToDrop(connection))) {
        console.warn(
          '[schema] work_items still holds rows with no matching entity - NOT dropping it. '
          + 'Run scripts/phase10-migrate-work-items.js first.',
        );
        continue;
      }
    }

    // Drop the foreign keys this table declares first. MySQL will not drop a
    // table whose FKs are still referenced, and a half-dropped schema is worse
    // than an untouched one.
    const [fks] = await connection.query(
      `SELECT TABLE_NAME t, CONSTRAINT_NAME c FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ?`,
      [table],
    );
    for (const { t, c } of fks) {
      await connection.query(`ALTER TABLE \`${t}\` DROP FOREIGN KEY \`${c}\``);
    }
    await connection.query(`DROP TABLE IF EXISTS \`${table}\``);
  }
}
