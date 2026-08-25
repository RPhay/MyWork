import * as db from '../database/connectionPool.js';
import { ValidationError } from '../config/errors.js';

export async function getQuotesForObject(objectType, objectId) {
  const quotes = await db.query(
    'SELECT * FROM quotes WHERE object_type = ? AND object_id = ? ORDER BY created_at DESC',
    [objectType, objectId]
  );
  return quotes;
}

export async function createQuote(objectType, objectId, person, quote) {
  if (!objectType || !objectId || !person || !quote) {
    throw new ValidationError('Object type, ID, person, and quote are required');
  }

  const quoteId = await db.insert(
    'INSERT INTO quotes (object_type, object_id, person, quote) VALUES (?, ?, ?, ?)',
    [objectType, objectId, person, quote]
  );

  return db.queryOne('SELECT * FROM quotes WHERE id = ?', [quoteId]);
}

export async function updateQuote(quoteId, person, quote) {
  if (!person || !quote) {
    throw new ValidationError('Person and quote are required');
  }

  const setClauses = [];
  const values = [];

  if (person !== undefined) {
    setClauses.push('person = ?');
    values.push(person);
  }

  if (quote !== undefined) {
    setClauses.push('quote = ?');
    values.push(quote);
  }

  if (setClauses.length > 0) {
    values.push(quoteId);
    await db.update(`UPDATE quotes SET ${setClauses.join(', ')} WHERE id = ?`, values);
  }

  return db.queryOne('SELECT * FROM quotes WHERE id = ?', [quoteId]);
}

export async function deleteQuote(quoteId) {
  const affectedRows = await db.deleteRecord('DELETE FROM quotes WHERE id = ?', [quoteId]);
  return affectedRows > 0;
}
