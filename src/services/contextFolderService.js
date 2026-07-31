import * as db from "../database/connectionPool.js";
import { NotFoundError, ValidationError } from "../config/errors.js";

export async function getAllFolders() {
  return db.query(
    "SELECT * FROM context_folders ORDER BY order_index ASC, name ASC",
  );
}

export async function getFolderById(id) {
  const folder = await db.queryOne(
    "SELECT * FROM context_folders WHERE id = ?",
    [id],
  );
  if (!folder) throw new NotFoundError("Folder not found");
  return folder;
}

async function getDescendantIds(id) {
  const all = await db.query("SELECT id, parent_id FROM context_folders");
  const descendants = new Set();
  const queue = [Number(id)];
  while (queue.length > 0) {
    const current = queue.pop();
    for (const row of all) {
      if (row.parent_id === current && !descendants.has(row.id)) {
        descendants.add(row.id);
        queue.push(row.id);
      }
    }
  }
  return descendants;
}

export async function createFolder(data) {
  const { name, parent_id } = data;
  if (!name) throw new ValidationError("Folder name is required");

  const result = await db.queryOne(
    "SELECT MAX(order_index) as maxOrder FROM context_folders",
  );
  const nextOrder = (result?.maxOrder ?? -1) + 1;

  const id = await db.insert(
    "INSERT INTO context_folders (name, parent_id, order_index) VALUES (?, ?, ?)",
    [name.trim(), parent_id || null, nextOrder],
  );
  return getFolderById(id);
}

export async function updateFolder(id, data) {
  const setClauses = [];
  const values = [];

  if (data.name !== undefined) {
    if (!data.name) throw new ValidationError("Folder name is required");
    setClauses.push("name = ?");
    values.push(data.name.trim());
  }

  if (data.parent_id !== undefined) {
    const parentId = data.parent_id || null;
    if (parentId) {
      if (Number(parentId) === Number(id))
        throw new ValidationError("A folder cannot be its own parent");
      const descendants = await getDescendantIds(id);
      if (descendants.has(Number(parentId)))
        throw new ValidationError(
          "Cannot set a sub-folder as the parent of its own ancestor",
        );
    }
    setClauses.push("parent_id = ?");
    values.push(parentId);
  }

  if (data.order_index !== undefined) {
    setClauses.push("order_index = ?");
    values.push(data.order_index);
  }

  if (setClauses.length === 0) return getFolderById(id);

  values.push(id);
  await db.update(
    `UPDATE context_folders SET ${setClauses.join(", ")} WHERE id = ?`,
    values,
  );
  return getFolderById(id);
}

export async function deleteFolder(id) {
  const folder = await getFolderById(id);
  // Move contexts in this folder to root before deleting
  await db.update("UPDATE contexts SET folder_id = NULL WHERE folder_id = ?", [
    id,
  ]);
  await db.deleteRecord("DELETE FROM context_folders WHERE id = ?", [id]);
  return folder;
}
