import * as db from "../database/homePool.js";
import { ValidationError } from "../config/errors.js";
import * as userService from "./userService.js";
import logger from "../utils/logger.js";

// Maps an Entra identity onto a PROFILE (a row in `users`).
//
// The whole design in one line: signing in SELECTS a profile, it does not
// invent a user. `users` stays (id, name, created_at) and everything Entra
// knows about the person lives in `user_identities` beside it.
//
// This is the thing the previous SSO subsystem got wrong. It wrote
// users.username and users.email against a table with neither column, so
// every login threw on an unknown column - code that looked like a feature
// and could not be reached. Structural tables live in the home pool, which
// is why this file uses homePool and not connectionPool.

const PROVIDER = "entra";

export async function findIdentity(subject, provider = PROVIDER) {
  if (!subject) throw new ValidationError("subject is required");
  return db.queryOne(
    "SELECT * FROM user_identities WHERE provider = ? AND subject = ?",
    [provider, subject],
  );
}

export async function getIdentitiesForUser(userId) {
  return db.query(
    "SELECT * FROM user_identities WHERE user_id = ? ORDER BY created_at ASC",
    [userId],
  );
}

/**
 * Resolve an Entra profile to a MyWork profile id, creating the link (and,
 * only if nothing matches, the profile) as needed.
 *
 * Resolution order, most to least specific:
 *   1. An existing identity for this Entra subject  - the normal path.
 *   2. A profile whose name matches the display name - adopts the profile
 *      you already use, so turning SSO on does not orphan your work.
 *   3. A new profile named after the Entra display name.
 *
 * Step 2 matters more than it looks: without it, the first work-machine
 * login would create a SECOND profile and land you in an empty app with
 * every context still owned by the old one.
 */
export async function resolveIdentityToUser(entraUser) {
  const subject = entraUser?.id;
  if (!subject) {
    throw new ValidationError("Entra profile has no id");
  }

  const displayName = (entraUser.displayName || entraUser.email || "").trim();
  const email = entraUser.email || null;

  const existing = await findIdentity(subject);
  if (existing) {
    await db.update(
      "UPDATE user_identities SET email = ?, display_name = ?, last_login_at = NOW() WHERE id = ?",
      [email, displayName || null, existing.id],
    );
    return { userId: existing.user_id, linked: false, created: false };
  }

  if (!displayName) {
    throw new ValidationError(
      "Entra profile has neither a display name nor an email to match a profile by",
    );
  }

  let user = await db.queryOne("SELECT * FROM users WHERE name = ?", [
    displayName,
  ]);
  let created = false;

  if (!user) {
    user = await userService.createUser(displayName);
    created = true;
    logger.info("SSO created a new profile", { name: displayName });
  }

  await db.insert(
    `INSERT INTO user_identities (user_id, provider, subject, email, display_name, last_login_at)
     VALUES (?, ?, ?, ?, ?, NOW())`,
    [user.id, PROVIDER, subject, email, displayName],
  );

  logger.info("SSO linked an Entra identity to a profile", {
    userId: user.id,
    created,
  });

  return { userId: user.id, linked: true, created };
}

/** Unlink an identity. The profile and its contexts are left alone. */
export async function unlinkIdentity(id) {
  return db.deleteRecord("DELETE FROM user_identities WHERE id = ?", [id]);
}
