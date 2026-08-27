import * as db from "../database/homePool.js";
import { ValidationError, NotFoundError } from "../config/errors.js";

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

/**
 * Remove a profile.
 *
 * REFUSES while the user still owns contexts, rather than cascading. A
 * context's rows live in that context's own database, so deleting the owner
 * cannot tidy them up - it would only orphan the context, which then appears
 * in nobody's list and cannot be activated, because activation requires an
 * owner. That is data made unreachable rather than deleted, which is worse
 * than either.
 *
 * Reassign or delete the contexts first, and the intent stays explicit.
 */
export async function deleteUser(id) {
  const user = await getUserById(id);
  if (!user) throw new NotFoundError("User not found");

  const owned = await db.query("SELECT name FROM contexts WHERE user_id = ?", [id]);
  if (owned.length > 0) {
    throw new ValidationError(
      `${user.name} still owns ${owned.length} context(s): ${owned.map(c => c.name).join(", ")}. `
      + "Reassign or delete them first.",
    );
  }

  await db.query("DELETE FROM users WHERE id = ?", [id]);
  return true;
}
