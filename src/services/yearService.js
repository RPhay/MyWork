import * as db from '../database/connectionPool.js';
import { ValidationError } from '../config/errors.js';

export async function getAllYears() {
  return await db.query('SELECT * FROM years ORDER BY year ASC');
}

export async function addYear(data) {
  const year = parseInt(data.year, 10);

  if (!year || Number.isNaN(year)) {
    throw new ValidationError('A valid year is required');
  }

  await db.query('INSERT IGNORE INTO years (year) VALUES (?)', [year]);

  return await db.queryOne('SELECT * FROM years WHERE year = ?', [year]);
}