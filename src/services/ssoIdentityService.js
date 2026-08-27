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
 *   1. An existing identity for this Entra subject - the normal path, and
 *      the only one that runs after the first successful sign-in.
 *   2. A profile whose `email` matches the Entra address. THE MATCH THAT
 *      MATTERS: set users.email on the profile you already use and the first
 *      work-machine login adopts it instead of creating a second one.
 *   3. A profile whose NAME is that email address - covers profiles that
 *      were named by address before users.email existed.
 *   4. A profile whose name matches the Entra display name.
 *   5. A new profile, carrying both the display name and the address.
 *
 * Steps 2-4 exist for one reason: without them the first login creates a
 * SECOND profile and lands you in an empty app with every context still
 * owned by the old one. Email is checked before name because a display name
 * is not unique and can be changed by whoever administers the tenant.
 */
export async function resolveIdentityToUser(entraUser) {
  const subject = entraUser?.id;
  if (!subject) {
    throw new ValidationError("Entra profile has no id");
  }

  const displayName = (entraUser.displayName || entraUser.email || "").trim();

  // Every address this account is known by, most-recognisable first. A tenant
  // whose UPN differs from its mail address would otherwise match only
  // whichever of the two happened to be typed into "Email for SSO".
  const candidateEmails = [
    ...new Set(
      [entraUser.mail, entraUser.userPrincipalName, entraUser.email]
        .map(userService.normaliseEmail)
        .filter(Boolean),
    ),
  ];
  const email = candidateEmails[0] || null;

  const existing = await findIdentity(subject);
  if (existing) {
    await db.update(
      "UPDATE user_identities SET email = ?, display_name = ?, last_login_at = NOW() WHERE id = ?",
      [email, displayName || null, existing.id],
    );
    return { userId: existing.user_id, linked: false, created: false };
  }

  if (!displayName && candidateEmails.length === 0) {
    throw new ValidationError(
      "Entra profile has neither a display name nor an email to match a profile by",
    );
  }

  // Step 2: the address on the profile itself - ANY of the account's
  // addresses, so it does not matter which one was entered.
  let user = null;
  let matchedBy = null;
  for (const candidate of candidateEmails) {
    user = await userService.getUserByEmail(candidate);
    if (user) {
      matchedBy = "email";
      break;
    }
  }

  // Step 3: a profile NAMED by one of those addresses.
  if (!user) {
    for (const candidate of candidateEmails) {
      user = await db.queryOne("SELECT * FROM users WHERE LOWER(name) = ?", [
        candidate,
      ]);
      if (user) {
        matchedBy = "name-as-email";
        break;
      }
    }
  }

  // Step 4: the display name.
  if (!user && displayName) {
    user = await db.queryOne("SELECT * FROM users WHERE name = ?", [
      displayName,
    ]);
    if (user) matchedBy = "display-name";
  }

  let created = false;

  if (!user) {
    user = await userService.createUser(displayName || email, email);
    created = true;
    matchedBy = "created";
    logger.info("SSO created a new profile", { name: displayName || email });
  } else if (email && !user.email) {
    // Matched by NAME, and the profile carries no address yet. Store it, so
    // the next sign-in matches at step 2 and stops depending on a display
    // name the tenant administrator can rename out from under it.
    await userService.updateUser(user.id, { email });
    logger.info("SSO backfilled a profile's email from Entra", {
      userId: user.id,
    });
  }

  logger.info("SSO resolved an Entra identity to a profile", {
    userId: user.id,
    matchedBy,
  });

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
