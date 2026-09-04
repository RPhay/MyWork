import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

export async function getAllSources(contextId) {
  return await db.query('SELECT * FROM sources WHERE context_id = ? ORDER BY created_at ASC', [contextId]);
}

export async function getSourceById(id) {
  const source = await db.queryOne('SELECT * FROM sources WHERE id = ?', [id]);
  if (!source) {
    throw new NotFoundError('Source not found');
  }
  return source;
}

export async function createSource(data, contextId) {
  const { name, type, config, enabled } = data;

  if (!name || !type) {
    throw new ValidationError('Name and type are required');
  }

  const sourceId = await db.insert(
    'INSERT INTO sources (name, type, config, enabled, status, context_id) VALUES (?, ?, ?, ?, ?, ?)',
    [name, type, JSON.stringify(config || {}), enabled !== false, 'not_configured', contextId]
  );

  return getSourceById(sourceId);
}

export async function updateSource(id, data = {}) {
  const { name, type, config, enabled, status } = data;
  await getSourceById(id); // throws NotFoundError if missing

  // Partial-update pattern, like updateUser: only the keys actually SENT are
  // written. Building the SET list unconditionally from a destructure meant
  // any partial request - toggling just `enabled`, say - wrote `undefined`
  // (NULL, or the literal string, depending on the driver) into every column
  // it did not mention, wiping the name/type/config/status that were already
  // there.
  const sets = [];
  const values = [];

  if (name !== undefined) { sets.push('name = ?'); values.push(name); }
  if (type !== undefined) { sets.push('type = ?'); values.push(type); }
  if (config !== undefined) { sets.push('config = ?'); values.push(JSON.stringify(config || {})); }
  if (enabled !== undefined) { sets.push('enabled = ?'); values.push(enabled !== false); }
  if (status !== undefined) { sets.push('status = ?'); values.push(status); }

  if (sets.length) {
    values.push(id);
    await db.update(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`, values);
  }

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
