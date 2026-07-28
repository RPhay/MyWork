import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

export async function getAllSources() {
  return await db.query('SELECT * FROM sources ORDER BY created_at ASC');
}

export async function getSourceById(id) {
  const source = await db.queryOne('SELECT * FROM sources WHERE id = ?', [id]);
  if (!source) {
    throw new NotFoundError('Source not found');
  }
  return source;
}

export async function createSource(data) {
  const { name, type, config, enabled } = data;

  if (!name || !type) {
    throw new ValidationError('Name and type are required');
  }

  const sourceId = await db.insert(
    'INSERT INTO sources (name, type, config, enabled, status) VALUES (?, ?, ?, ?, ?)',
    [name, type, JSON.stringify(config || {}), enabled !== false, 'not_configured']
  );

  return getSourceById(sourceId);
}

export async function updateSource(id, data) {
  const { name, type, config, enabled, status } = data;

  await db.update(
    'UPDATE sources SET name = ?, type = ?, config = ?, enabled = ?, status = ? WHERE id = ?',
    [name, type, JSON.stringify(config || {}), enabled !== false, status, id]
  );

  return getSourceById(id);
}

export async function deleteSource(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM sources WHERE id = ?', [id]);
  return affectedRows > 0;
}

export async function testSourceConnection(id) {
  const source = await getSourceById(id);

  // Placeholder for actual connection testing
  // In a real implementation, this would test the actual data source connection
  return {
    success: true,
    message: `Connection to ${source.name} would be tested here`,
    source
  };
}
