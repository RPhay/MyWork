import * as db from '../database/connectionPool.js';
import { ValidationError } from '../config/errors.js';

// Fixed palettes, validated server-side so a color can go straight into an
// inline style attribute without risking CSS/markup injection from arbitrary
// client-supplied strings. Background uses soft pastels (readable as a fill);
// text uses more saturated colors (readable as foreground text).
export const BACKGROUND_COLORS = [
  { key: 'red', hex: '#ffadad' },
  { key: 'orange', hex: '#ffd6a5' },
  { key: 'yellow', hex: '#fdffb6' },
  { key: 'green', hex: '#caffbf' },
  { key: 'blue', hex: '#9bf6ff' },
  { key: 'indigo', hex: '#a0c4ff' },
  { key: 'purple', hex: '#bdb2ff' },
  { key: 'pink', hex: '#ffc6ff' },
];

export const TEXT_COLORS = [
  { key: 'red', hex: '#e63946' },
  { key: 'orange', hex: '#ff8500' },
  { key: 'yellow', hex: '#ffd60a' },
  { key: 'green', hex: '#06d6a0' },
  { key: 'blue', hex: '#118ab2' },
  { key: 'indigo', hex: '#3a0ca3' },
  { key: 'purple', hex: '#9d4edd' },
  { key: 'pink', hex: '#ff006e' },
];

const VALID_BACKGROUND_HEX = new Set(BACKGROUND_COLORS.map(c => c.hex));
const VALID_TEXT_HEX = new Set(TEXT_COLORS.map(c => c.hex));

export async function getHighlightsByDateRange(startDate, endDate, contextId) {
  return db.query(
    'SELECT date, color, text_color FROM day_highlights WHERE date >= ? AND date <= ? AND context_id = ?',
    [startDate, endDate, contextId]
  );
}

async function getRow(date, contextId) {
  return db.queryOne(
    'SELECT id, color, text_color FROM day_highlights WHERE date = ? AND context_id = ?',
    [date, contextId]
  );
}

// Plain exists-check + insert-or-update rather than an upsert - see
// contextTabSettingsService.js for why (MySQL's ON DUPLICATE KEY UPDATE has
// no MSSQL equivalent, and this only ever touches one row at a time).
export async function setBackgroundColor(date, color, contextId) {
  if (!VALID_BACKGROUND_HEX.has(color)) {
    throw new ValidationError('Invalid highlight color');
  }

  const existing = await getRow(date, contextId);
  if (existing) {
    await db.update('UPDATE day_highlights SET color = ? WHERE id = ?', [color, existing.id]);
  } else {
    await db.insert('INSERT INTO day_highlights (context_id, date, color) VALUES (?, ?, ?)', [contextId, date, color]);
  }

  return { date, color };
}

export async function setTextColor(date, textColor, contextId) {
  if (!VALID_TEXT_HEX.has(textColor)) {
    throw new ValidationError('Invalid text color');
  }

  const existing = await getRow(date, contextId);
  if (existing) {
    await db.update('UPDATE day_highlights SET text_color = ? WHERE id = ?', [textColor, existing.id]);
  } else {
    await db.insert('INSERT INTO day_highlights (context_id, date, text_color) VALUES (?, ?, ?)', [contextId, date, textColor]);
  }

  return { date, text_color: textColor };
}

// Clears both background and text color for a date (the context menu's single
// "Clear Highlight" action).
export async function clearHighlight(date, contextId) {
  await db.deleteRecord('DELETE FROM day_highlights WHERE date = ? AND context_id = ?', [date, contextId]);
}
