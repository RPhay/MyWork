import { query, queryOne, insert } from '../database/connectionPool.js';

/**
 * Service for managing SSO user identities and auto-creation
 * Links Entra ID users to MyWork users
 *
 * NOTE ON `findOrCreateSsoUser`: it is the one function here that CANNOT work,
 * and not for a reason that can be fixed in this file. It reads and writes
 * `users.username` and `users.email`, but this project's `users` table is
 * `(id, name, created_at)` - see mysqlSchema.js - so every one of those
 * statements fails on an unknown column. Giving SSO a real user record means
 * deciding what a user IS here, which is the same decision CLAUDE.md defers
 * under "There is no authentication". Left as-is deliberately rather than
 * papered over, so it fails loudly instead of half-working.
 *
 * Everything else in this file talks only to `sso_identities`, which does
 * exist, and is correct.
 */

export async function findOrCreateSsoUser(provider, providerUser) {
  const { id: providerId, email } = providerUser;

  // First, check if this SSO identity is already linked
  const existingIdentity = await queryOne(
    `SELECT user_id FROM sso_identities WHERE provider = ? AND provider_id = ?`,
    [provider, providerId]
  );

  if (existingIdentity) {
    return existingIdentity.user_id;
  }

  // Check if a user with this email already exists
  const existingUser = await queryOne(
    `SELECT id FROM users WHERE email = ?`,
    [email]
  );

  let userId;
  if (existingUser) {
    // User exists, link this SSO identity to them
    userId = existingUser.id;
    // Update username to email if not already set or if it's a default
    await query(
      `UPDATE users SET username = ?, updated_at = NOW() WHERE id = ? AND (username IS NULL OR username = ?)`,
      [email, userId, `user_${userId}`]
    );
  } else {
    // Create new user with email as username
    userId = await insert(
      `INSERT INTO users (username, email, created_at, updated_at) VALUES (?, ?, NOW(), NOW())`,
      [email, email]
    );
  }

  // Create SSO identity mapping
  await query(
    `INSERT INTO sso_identities (user_id, provider, provider_id, provider_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [userId, provider, providerId, email]
  );

  return userId;
}

export async function getSsoIdentity(provider, providerId) {
  return queryOne(
    `SELECT user_id, provider_email FROM sso_identities WHERE provider = ? AND provider_id = ?`,
    [provider, providerId]
  );
}

export async function linkSsoIdentity(userId, provider, providerUser) {
  const { id: providerId, email } = providerUser;

  // Check if already linked
  const existing = await queryOne(
    `SELECT id FROM sso_identities WHERE user_id = ? AND provider = ?`,
    [userId, provider]
  );

  if (existing) {
    // Update existing identity
    await query(
      `UPDATE sso_identities SET provider_id = ?, provider_email = ?, updated_at = NOW()
       WHERE user_id = ? AND provider = ?`,
      [providerId, email, userId, provider]
    );
  } else {
    // Create new identity link
    await query(
      `INSERT INTO sso_identities (user_id, provider, provider_id, provider_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [userId, provider, providerId, email]
    );
  }
}

export async function unlinkSsoIdentity(userId, provider) {
  await query(
    `DELETE FROM sso_identities WHERE user_id = ? AND provider = ?`,
    [userId, provider]
  );
}

export async function getSsoIdentitiesForUser(userId) {
  const rows = await query(
    `SELECT provider, provider_id, provider_email FROM sso_identities WHERE user_id = ?`,
    [userId]
  );

  const identities = {};
  for (const row of rows) {
    identities[row.provider] = {
      providerId: row.provider_id,
      email: row.provider_email
    };
  }

  return identities;
}

export default {
  findOrCreateSsoUser,
  getSsoIdentity,
  linkSsoIdentity,
  unlinkSsoIdentity,
  getSsoIdentitiesForUser
};
