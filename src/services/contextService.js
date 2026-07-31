import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

export async function getAllContexts() {
  return await db.query('SELECT * FROM contexts ORDER BY order_index ASC, name ASC');
}

export async function getContextById(id) {
  const context = await db.queryOne('SELECT * FROM contexts WHERE id = ?', [id]);
  if (!context) {
    throw new NotFoundError('Context not found');
  }
  return context;
}

export async function createContext(data) {
  const { name } = data;

  if (!name) {
    throw new ValidationError('Context name is required');
  }

  const result = await db.queryOne('SELECT MAX(order_index) as maxOrder FROM contexts');
  const nextOrder = (result?.maxOrder ?? -1) + 1;

  try {
    const contextId = await db.insert(
      'INSERT INTO contexts (name, order_index) VALUES (?, ?)',
      [name, nextOrder]
    );
    return getContextById(contextId);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ValidationError('A context with that name already exists');
    }
    throw error;
  }
}

export async function updateContext(id, data) {
  if (data.name !== undefined && !data.name) {
    throw new ValidationError('Context name is required');
  }

  const setClauses = [];
  const values = [];

  if (data.name !== undefined) {
    setClauses.push('name = ?');
    values.push(data.name);
  }
  if (data.order_index !== undefined) {
    setClauses.push('order_index = ?');
    values.push(data.order_index);
  }

  if (setClauses.length === 0) {
    return getContextById(id);
  }

  values.push(id);

  try {
    await db.update(`UPDATE contexts SET ${setClauses.join(', ')} WHERE id = ?`, values);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new ValidationError('A context with that name already exists');
    }
    throw error;
  }

  return getContextById(id);
}

export async function deleteContext(id) {
  const result = await db.queryOne('SELECT COUNT(*) as cnt FROM contexts');
  if (result.cnt <= 1) {
    throw new ValidationError('At least one context must always exist - rename it instead of deleting it');
  }

  const affectedRows = await db.deleteRecord('DELETE FROM contexts WHERE id = ?', [id]);
  return affectedRows > 0;
}
