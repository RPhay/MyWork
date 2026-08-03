import connectionPool from '../database/connectionPool.js';

/**
 * Service for managing links associated with to-dos, ideas, and priorities
 */

const LINK_TABLES = {
  'to-do': 'to_do_links',
  'idea': 'idea_links',
  'priority': 'priority_links'
};

const ID_COLUMNS = {
  'to-do': 'to_do_id',
  'idea': 'idea_id',
  'priority': 'priority_id'
};

export async function getLinks(type, entityId) {
  if (!LINK_TABLES[type]) {
    throw new Error(`Invalid link type: ${type}`);
  }

  const table = LINK_TABLES[type];
  const idColumn = ID_COLUMNS[type];

  const [rows] = await connectionPool.query(
    `SELECT id, url, title, order_index FROM ${table} WHERE ${idColumn} = ? ORDER BY order_index ASC`,
    [entityId]
  );

  return rows;
}

export async function addLink(type, entityId, url, title) {
  if (!LINK_TABLES[type]) {
    throw new Error(`Invalid link type: ${type}`);
  }

  const table = LINK_TABLES[type];
  const idColumn = ID_COLUMNS[type];

  // Get the next order_index
  const [maxRow] = await connectionPool.query(
    `SELECT MAX(order_index) as max_index FROM ${table} WHERE ${idColumn} = ?`,
    [entityId]
  );
  const nextIndex = (maxRow[0].max_index ?? -1) + 1;

  const [result] = await connectionPool.query(
    `INSERT INTO ${table} (${idColumn}, url, title, order_index, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [entityId, url, title || url, nextIndex]
  );

  return {
    id: result.insertId,
    url,
    title: title || url,
    order_index: nextIndex
  };
}

export async function updateLink(type, linkId, url, title) {
  if (!LINK_TABLES[type]) {
    throw new Error(`Invalid link type: ${type}`);
  }

  const table = LINK_TABLES[type];

  await connectionPool.query(
    `UPDATE ${table} SET url = ?, title = ?, updated_at = NOW() WHERE id = ?`,
    [url, title || url, linkId]
  );
}

export async function deleteLink(type, linkId) {
  if (!LINK_TABLES[type]) {
    throw new Error(`Invalid link type: ${type}`);
  }

  const table = LINK_TABLES[type];

  await connectionPool.query(
    `DELETE FROM ${table} WHERE id = ?`,
    [linkId]
  );
}

export async function reorderLinks(type, entityId, linkIds) {
  if (!LINK_TABLES[type]) {
    throw new Error(`Invalid link type: ${type}`);
  }

  const table = LINK_TABLES[type];

  for (let i = 0; i < linkIds.length; i++) {
    await connectionPool.query(
      `UPDATE ${table} SET order_index = ?, updated_at = NOW() WHERE id = ?`,
      [i, linkIds[i]]
    );
  }
}

export async function hasLinks(type, entityId) {
  const links = await getLinks(type, entityId);
  return links.length > 0;
}

export default {
  getLinks,
  addLink,
  updateLink,
  deleteLink,
  reorderLinks,
  hasLinks
};
