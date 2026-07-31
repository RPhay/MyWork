import * as db from '../database/connectionPool.js';
import { NotFoundError, ValidationError } from '../config/errors.js';

async function attachItems(ideas) {
  if (ideas.length === 0) return ideas;

  const ids = ideas.map(i => i.id);
  const placeholders = ids.map(() => '?').join(',');

  const items = await db.query(
    `SELECT * FROM idea_items WHERE idea_id IN (${placeholders}) ORDER BY order_index ASC, id ASC`,
    ids
  );

  return ideas.map(idea => ({
    ...idea,
    items: items.filter(i => i.idea_id === idea.id),
  }));
}

async function replaceItems(ideaId, items) {
  await db.query('DELETE FROM idea_items WHERE idea_id = ?', [ideaId]);

  if (Array.isArray(items)) {
    for (let i = 0; i < items.length; i++) {
      const { text, is_done } = items[i];
      if (!text) continue;
      await db.insert(
        'INSERT INTO idea_items (idea_id, text, is_done, order_index) VALUES (?, ?, ?, ?)',
        [ideaId, text, !!is_done, i]
      );
    }
  }
}

export async function getAllIdeas(contextId) {
  const ideas = await db.query('SELECT * FROM ideas WHERE context_id = ? ORDER BY created_at DESC', [contextId]);
  return attachItems(ideas);
}

export async function getIdeaById(id) {
  const idea = await db.queryOne('SELECT * FROM ideas WHERE id = ?', [id]);
  if (!idea) {
    throw new NotFoundError('Idea not found');
  }
  const [withItems] = await attachItems([idea]);
  return withItems;
}

export async function createIdea(data, contextId) {
  const { title, notes, folder_id, items } = data;

  if (!title) {
    throw new ValidationError('Idea title is required');
  }

  const ideaId = await db.insert(
    'INSERT INTO ideas (title, notes, folder_id, context_id) VALUES (?, ?, ?, ?)',
    [title, notes ?? null, folder_id || null, contextId]
  );

  if (items !== undefined) {
    await replaceItems(ideaId, items);
  }

  return getIdeaById(ideaId);
}

export async function updateIdea(id, data) {
  const setClauses = [];
  const values = [];

  if (data.title !== undefined) {
    if (!data.title) {
      throw new ValidationError('Idea title is required');
    }
    setClauses.push('title = ?');
    values.push(data.title);
  }
  if (data.notes !== undefined) {
    setClauses.push('notes = ?');
    values.push(data.notes ?? null);
  }

  // Only touch folder_id when the caller explicitly provided it (e.g. drag-to-file),
  // so a plain title/notes edit from the modal leaves the current folder untouched.
  if (data.folder_id !== undefined) {
    setClauses.push('folder_id = ?');
    values.push(data.folder_id || null);
  }

  if (setClauses.length > 0) {
    values.push(id);
    await db.update(`UPDATE ideas SET ${setClauses.join(', ')} WHERE id = ?`, values);
  }

  // Only touch items when the caller explicitly provided them, so operations like
  // drag-to-file (which only sends title/notes/folder_id) don't wipe the checklist.
  if (data.items !== undefined) {
    await replaceItems(id, data.items);
  }

  return getIdeaById(id);
}

export async function deleteIdea(id) {
  const affectedRows = await db.deleteRecord('DELETE FROM ideas WHERE id = ?', [id]);
  return affectedRows > 0;
}
