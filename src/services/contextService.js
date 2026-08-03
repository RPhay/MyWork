import * as db from "../database/homePool.js";
import { NotFoundError, ValidationError } from "../config/errors.js";
import { VALID_CONTEXT_ICONS } from "../config/contextIcons.js";

// The encrypted DB password blobs must never reach the browser - callers only
// learn whether one has been set. Everything else about the DB config
// (host/port/name/user) isn't sensitive and stays visible. Both the
// MySQL/MariaDB and MSSQL profiles have their own blob (see
// contextDatabaseConfigService.js) - both get stripped here.
function maskContext(context) {
  if (!context) return context;
  const { db_password_enc, mssql_password_enc, ...rest } = context;
  return {
    ...rest,
    hasDbPassword: !!db_password_enc,
    hasMssqlPassword: !!mssql_password_enc,
  };
}

async function attachUserNames(contexts) {
  const userIds = [...new Set(contexts.map((c) => c.user_id).filter(Boolean))];
  if (userIds.length === 0)
    return contexts.map((c) => ({ ...c, userName: null }));

  const placeholders = userIds.map(() => "?").join(",");
  const users = await db.query(
    `SELECT id, name FROM users WHERE id IN (${placeholders})`,
    userIds,
  );
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  return contexts.map((c) => ({
    ...c,
    userName: c.user_id ? nameById.get(c.user_id) || null : null,
  }));
}

export async function getAllContexts() {
  const rows = await db.query(
    "SELECT * FROM contexts ORDER BY order_index ASC, name ASC",
  );
  return attachUserNames(rows.map(maskContext));
}

export async function getContextById(id) {
  const context = await db.queryOne("SELECT * FROM contexts WHERE id = ?", [
    id,
  ]);
  if (!context) {
    throw new NotFoundError("Context not found");
  }
  const [withUserName] = await attachUserNames([maskContext(context)]);
  return withUserName;
}

export async function createContext(data) {
  const { name } = data;

  if (!name) {
    throw new ValidationError("Context name is required");
  }

  const result = await db.queryOne(
    "SELECT MAX(order_index) as maxOrder FROM contexts",
  );
  const nextOrder = (result?.maxOrder ?? -1) + 1;

  try {
    const contextId = await db.insert(
      "INSERT INTO contexts (name, order_index) VALUES (?, ?)",
      [name, nextOrder],
    );
    return getContextById(contextId);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new ValidationError("A context with that name already exists");
    }
    throw error;
  }
}

export async function updateContext(id, data) {
  if (data.name !== undefined && !data.name) {
    throw new ValidationError("Context name is required");
  }

  const setClauses = [];
  const values = [];

  if (data.name !== undefined) {
    setClauses.push("name = ?");
    values.push(data.name);
  }
  if (data.order_index !== undefined) {
    setClauses.push("order_index = ?");
    values.push(data.order_index);
  }
  if (data.user_id !== undefined) {
    setClauses.push("user_id = ?");
    values.push(data.user_id || null);
  }
  if (data.folder_id !== undefined) {
    setClauses.push("folder_id = ?");
    values.push(data.folder_id || null);
  }
  if (data.icon !== undefined) {
    if (data.icon && !VALID_CONTEXT_ICONS.has(data.icon)) {
      throw new ValidationError("Invalid icon");
    }
    setClauses.push("icon = ?");
    values.push(data.icon || null);
  }

  if (setClauses.length === 0) {
    return getContextById(id);
  }

  values.push(id);

  try {
    await db.update(
      `UPDATE contexts SET ${setClauses.join(", ")} WHERE id = ?`,
      values,
    );
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new ValidationError("A context with that name already exists");
    }
    throw error;
  }

  return getContextById(id);
}

export async function reorderContexts(orderedIds) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db.update("UPDATE contexts SET order_index = ? WHERE id = ?", [
      i,
      orderedIds[i],
    ]);
  }
  return getAllContexts();
}

export async function deleteContext(id) {
  const result = await db.queryOne("SELECT COUNT(*) as cnt FROM contexts");
  if (result.cnt <= 1) {
    throw new ValidationError(
      "At least one context must always exist - rename it instead of deleting it",
    );
  }

  const affectedRows = await db.deleteRecord(
    "DELETE FROM contexts WHERE id = ?",
    [id],
  );
  return affectedRows > 0;
}
