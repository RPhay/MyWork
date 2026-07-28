import mysql from 'mysql2/promise.js';
import config from '../src/config/environment.js';
import logger from '../src/utils/logger.js';

async function initDatabase() {
  let connection;
  try {
    logger.info('Initializing database...');

    // Connect to MySQL without specifying database
    connection = await mysql.createConnection({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
    });

    logger.info(`Creating database: ${config.database.name}`);
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${config.database.name}\``);

    // Switch to the database
    await connection.execute(`USE \`${config.database.name}\``);

    logger.info('Creating tables...');

    // Create sources table
    await connection.execute(`
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

    // Create categories table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create goals table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS goals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        year INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description LONGTEXT,
        measurements LONGTEXT,
        goal_updates LONGTEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'Not Started',
        due_date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_year (year),
        INDEX idx_status (status)
      )
    `);

    // Create goal_categories junction table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS goal_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        goal_id INT NOT NULL,
        category_id INT NOT NULL,
        FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
        UNIQUE KEY unique_goal_category (goal_id, category_id)
      )
    `);

    // Create priorities table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS priorities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        source_id INT,
        notes LONGTEXT,
        order_index INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
        INDEX idx_order (order_index)
      )
    `);

    // Create work_items table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_items (
        id INT AUTO_INCREMENT PRIMARY KEY,
        date DATE NOT NULL,
        title VARCHAR(255) NOT NULL,
        description LONGTEXT,
        status VARCHAR(50) DEFAULT 'Not Started',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_date (date),
        INDEX idx_status (status)
      )
    `);

    // Create work_goal_associations junction table
    await connection.execute(`
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
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_priority_associations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_item_id INT NOT NULL,
        priority_id INT NOT NULL,
        FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
        FOREIGN KEY (priority_id) REFERENCES priorities(id) ON DELETE CASCADE,
        UNIQUE KEY unique_work_priority (work_item_id, priority_id)
      )
    `);

    // Create work_source_associations junction table
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS work_source_associations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        work_item_id INT NOT NULL,
        source_id INT NOT NULL,
        FOREIGN KEY (work_item_id) REFERENCES work_items(id) ON DELETE CASCADE,
        FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
        UNIQUE KEY unique_work_source (work_item_id, source_id)
      )
    `);

    logger.info('Database initialization completed successfully!');
    process.exit(0);
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

initDatabase();
