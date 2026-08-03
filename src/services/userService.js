import * as db from "../database/homePool.js";
import { ValidationError } from "../config/errors.js";

// Deliberately minimal: a user is just a name, no password or session - it
// exists only to be assigned as a context's owner (Settings > Contexts).
// A context with no user assigned can't be activated (see
// activeContextService.js#setActiveContextId). Not real access control
// against a hostile actor (see SECURITY_AUDIT notes).

export async function getAllUsers() {
  return db.query("SELECT * FROM users ORDER BY name ASC");
}

export async function getUserById(id) {
  return db.queryOne("SELECT * FROM users WHERE id = ?", [id]);
}

export async function createUser(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    throw new ValidationError("Name is required");
  }

  try {
    const id = await db.insert("INSERT INTO users (name) VALUES (?)", [
      trimmed,
    ]);
    return getUserById(id);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new ValidationError("A user with that name already exists");
    }
    throw error;
  }
}

// Used when assigning a context's owner: typing an existing name reuses
// that user, typing a new one creates it on the spot.
export async function findOrCreateUser(name) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    throw new ValidationError("Name is required");
  }

  const existing = await db.queryOne("SELECT * FROM users WHERE name = ?", [
    trimmed,
  ]);
  if (existing) return existing;

  return createUser(trimmed);
}
