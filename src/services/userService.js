import * as db from "../database/homePool.js";
import { isDuplicateKeyError } from "../database/connectionPool.js";
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

// An address is stored and compared LOWERCASED. Entra is free to return
// "Ryan.Phay@example.com" one day and "ryan.phay@example.com" the next, and
// a case-sensitive comparison would then create a second profile rather than
// find the first - the exact failure the email match exists to prevent.
export function normaliseEmail(email) {
  const trimmed = String(email ?? "").trim().toLowerCase();
  return trimmed || null;
}

export async function getUserByEmail(email) {
  const normalised = normaliseEmail(email);
  if (!normalised) return null;
  return db.queryOne("SELECT * FROM users WHERE LOWER(email) = ?", [
    normalised,
  ]);
}

export async function createUser(name, email = null) {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    throw new ValidationError("Name is required");
  }

  try {
    const id = await db.insert(
      "INSERT INTO users (name, email) VALUES (?, ?)",
      [trimmed, normaliseEmail(email)],
    );
    return getUserById(id);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ValidationError(
        "A user with that name or email address already exists",
      );
    }
    throw error;
  }
}

/**
 * Change a profile's name and/or email.
 *
 * The email is what single sign-on matches on, so this is the control that
 * makes SSO land on the RIGHT profile instead of creating a second one. Both
 * fields are optional; passing neither is a no-op rather than an error.
 */
export async function updateUser(id, { name, email } = {}) {
  const user = await getUserById(id);
  if (!user) throw new NotFoundError("User not found");

  const sets = [];
  const values = [];

  if (name !== undefined) {
    const trimmed = String(name || "").trim();
    if (!trimmed) throw new ValidationError("Name cannot be empty");
    sets.push("name = ?");
    values.push(trimmed);
  }

  // An explicit null/empty CLEARS the address, which is how you undo a
  // mistyped one. Distinguished from "not supplied" by the undefined check.
  if (email !== undefined) {
    sets.push("email = ?");
    values.push(normaliseEmail(email));
  }

  if (sets.length === 0) return user;

  values.push(id);
  try {
    await db.update(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`, values);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new ValidationError(
        "Another profile already uses that name or email address",
      );
    }
    throw error;
  }

  return getUserById(id);
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
