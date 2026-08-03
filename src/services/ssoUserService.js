import connectionPool from '../database/connectionPool.js';

/**
 * Service for managing SSO user identities and auto-creation
 * Links Entra ID users to MyWork users
 */

export async function findOrCreateSsoUser(provider, providerUser) {
  const { id: providerId, email, displayName } = providerUser;

  // First, check if this SSO identity is already linked
  const [existingIdentity] = await connectionPool.query(
    `SELECT user_id FROM sso_identities WHERE provider = ? AND provider_id = ?`,
    [provider, providerId]
  );

  if (existingIdentity.length > 0) {
    return existingIdentity[0].user_id;
  }

  // Check if a user with this email already exists
  const [existingUsers] = await connectionPool.query(
    `SELECT id FROM users WHERE email = ?`,
    [email]
  );

  let userId;
  if (existingUsers.length > 0) {
    // User exists, link this SSO identity to them
    userId = existingUsers[0].id;
    // Update username to email if not already set or if it's a default
    await connectionPool.query(
      `UPDATE users SET username = ?, updated_at = NOW() WHERE id = ? AND (username IS NULL OR username = ?)`,
      [email, userId, `user_${userId}`]
    );
  } else {
    // Create new user with email as username
    const [result] = await connectionPool.query(
      `INSERT INTO users (username, email, created_at, updated_at) VALUES (?, ?, NOW(), NOW())`,
      [email, email]
    );
    userId = result.insertId;
  }

  // Create SSO identity mapping
  await connectionPool.query(
    `INSERT INTO sso_identities (user_id, provider, provider_id, provider_email, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [userId, provider, providerId, email]
  );

  return userId;
}

export async function getSsoIdentity(provider, providerId) {
  const [rows] = await connectionPool.query(
    `SELECT user_id, provider_email FROM sso_identities WHERE provider = ? AND provider_id = ?`,
    [provider, providerId]
  );

  return rows.length > 0 ? rows[0] : null;
}

export async function linkSsoIdentity(userId, provider, providerUser) {
  const { id: providerId, email } = providerUser;

  // Check if already linked
  const [existing] = await connectionPool.query(
    `SELECT id FROM sso_identities WHERE user_id = ? AND provider = ?`,
    [userId, provider]
  );

  if (existing.length > 0) {
    // Update existing identity
    await connectionPool.query(
      `UPDATE sso_identities SET provider_id = ?, provider_email = ?, updated_at = NOW()
       WHERE user_id = ? AND provider = ?`,
      [providerId, email, userId, provider]
    );
  } else {
    // Create new identity link
    await connectionPool.query(
      `INSERT INTO sso_identities (user_id, provider, provider_id, provider_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, NOW(), NOW())`,
      [userId, provider, providerId, email]
    );
  }
}

export async function unlinkSsoIdentity(userId, provider) {
  await connectionPool.query(
    `DELETE FROM sso_identities WHERE user_id = ? AND provider = ?`,
    [userId, provider]
  );
}

export async function getSsoIdentitiesForUser(userId) {
  const [rows] = await connectionPool.query(
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
