/**
 * Point an Entra sign-in at the profile that already owns your contexts.
 *
 * THE PROBLEM THIS FIXES
 *
 * Signing in with SSO resolves an Entra account to a profile by, in order:
 * an existing identity, a profile whose `email` matches, a profile NAMED by
 * that address, then the display name (see ssoIdentityService.js). If none
 * matches - which is what happens on a FIRST sign-in against a profile that
 * has no email set - it creates a new profile.
 *
 * A brand-new profile owns no contexts, and a profile owning no contexts is
 * redirected off the dashboard (see CLAUDE.md, "Profiles are a view"). So the
 * symptom is: sign-in succeeds and the app has nothing in it, while all your
 * work sits under the profile you used before.
 *
 * WHAT IT DOES
 *
 * Moves the Entra identity onto the profile that owns the contexts, sets that
 * profile's email so every FUTURE sign-in matches on email and never needs
 * this script again, and deletes the empty profile the sign-in created.
 *
 * It does NOT move contexts between profiles. Re-pointing the identity is a
 * smaller and more reversible change than rewriting ownership of a database,
 * and it leaves `contexts.user_id` exactly as it was.
 *
 * DRY RUN BY DEFAULT. Prints the plan and writes nothing:
 *
 *   node scripts/adopt-sso-profile.js
 *   node scripts/adopt-sso-profile.js --apply
 *
 * Pick the profiles explicitly when the guess is wrong, or when more than one
 * candidate exists:
 *
 *   node scripts/adopt-sso-profile.js --identity-from 2 --into 1 --apply
 *
 * Structural tables live in the home pool, so this reads .env.local's database
 * and is safe to run on one machine without affecting the other.
 */

import * as db from "../src/database/homePool.js";
import * as activeUserService from "../src/services/activeUserService.js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");

function argValue(flag) {
  const i = args.indexOf(flag);
  if (i === -1) return null;
  const v = args[i + 1];
  if (!v || v.startsWith("--")) {
    throw new Error(`${flag} needs a profile id`);
  }
  return Number(v);
}

function line() {
  console.log("-".repeat(72));
}

async function main() {
  const explicitFrom = argValue("--identity-from");
  const explicitInto = argValue("--into");

  const users = await db.query("SELECT id, name, email FROM users ORDER BY id");
  const identities = await db.query(
    "SELECT id, user_id, provider, subject, email, display_name FROM user_identities ORDER BY id",
  );
  const contexts = await db.query(
    "SELECT id, name, user_id FROM contexts ORDER BY id",
  );

  const ownedBy = (userId) => contexts.filter((c) => c.user_id === userId);
  const identitiesOf = (userId) =>
    identities.filter((i) => i.user_id === userId);

  console.log("\nPROFILES");
  line();
  for (const u of users) {
    const owned = ownedBy(u.id);
    const ids = identitiesOf(u.id);
    console.log(
      `  #${u.id} ${u.name}` +
        `\n      email      : ${u.email || "(none)"}` +
        `\n      contexts   : ${owned.length ? owned.map((c) => `${c.name} (#${c.id})`).join(", ") : "NONE"}` +
        `\n      identities : ${ids.length ? ids.map((i) => `${i.provider}:${i.display_name || i.email || i.subject}`).join(", ") : "none"}`,
    );
  }
  line();

  if (identities.length === 0) {
    console.log(
      "\nNo Entra identity is linked on this machine yet. Sign in once, then re-run.\n",
    );
    return;
  }

  // The profile to move the identity FROM: one that has an identity but owns
  // no contexts. That is precisely the profile a first sign-in creates.
  const fromCandidates = users.filter(
    (u) => identitiesOf(u.id).length > 0 && ownedBy(u.id).length === 0,
  );
  // The profile to move it INTO: one that owns contexts.
  const intoCandidates = users.filter((u) => ownedBy(u.id).length > 0);

  const from =
    explicitFrom !== null
      ? users.find((u) => u.id === explicitFrom)
      : fromCandidates.length === 1
        ? fromCandidates[0]
        : null;

  const into =
    explicitInto !== null
      ? users.find((u) => u.id === explicitInto)
      : intoCandidates.length === 1
        ? intoCandidates[0]
        : null;

  if (!from || !into) {
    console.log("\nCannot choose the profiles automatically.");
    if (!from) {
      console.log(
        `  --identity-from : ${fromCandidates.length} profile(s) have an identity but no contexts` +
          (fromCandidates.length
            ? ` (${fromCandidates.map((u) => `#${u.id}`).join(", ")})`
            : ""),
      );
    }
    if (!into) {
      console.log(
        `  --into          : ${intoCandidates.length} profile(s) own contexts` +
          (intoCandidates.length
            ? ` (${intoCandidates.map((u) => `#${u.id}`).join(", ")})`
            : ""),
      );
    }
    console.log(
      "\nRe-run naming both, e.g.\n  node scripts/adopt-sso-profile.js --identity-from <id> --into <id>\n",
    );
    return;
  }

  if (from.id === into.id) {
    console.log(
      `\nNothing to do: profile #${from.id} already holds the identity AND the contexts.\n`,
    );
    return;
  }

  // Refuse to strip a profile that still owns something. The script deletes
  // `from` at the end, and a profile owning contexts must never be deleted -
  // its contexts would be orphaned, appearing in nobody's list and unable to
  // be activated, which is data made unreachable rather than deleted.
  if (ownedBy(from.id).length > 0) {
    console.log(
      `\nREFUSING: profile #${from.id} (${from.name}) owns ${ownedBy(from.id).length} context(s).` +
        "\nThis script only removes a profile that owns nothing. Reassign them first.\n",
    );
    return;
  }

  const moving = identitiesOf(from.id);
  const email =
    moving.map((i) => i.email).find(Boolean) || from.email || into.email || null;

  console.log(`\nPLAN${APPLY ? "" : "  (dry run - nothing will be written)"}`);
  line();
  console.log(
    `  move ${moving.length} identity/identities from #${from.id} ${from.name} -> #${into.id} ${into.name}`,
  );
  for (const i of moving) {
    console.log(`      ${i.provider}:${i.subject} (${i.display_name || "?"})`);
  }
  console.log(
    `  set  #${into.id} ${into.name}.email = ${email || "(unchanged - no address available)"}`,
  );
  if (into.email && email && into.email !== email) {
    console.log(
      `       NOTE: overwrites the existing address ${into.email}`,
    );
  }
  console.log(`  delete profile #${from.id} ${from.name} (owns nothing)`);
  console.log(
    `  contexts are NOT touched: ${ownedBy(into.id).map((c) => `${c.name} (#${c.id})`).join(", ")}`,
  );
  line();

  if (!APPLY) {
    console.log("\nRe-run with --apply to write these changes.\n");
    return;
  }

  // ORDER MATTERS, and getting it wrong fails HALFWAY.
  //
  // users.email is UNIQUE, and the address being adopted is usually the one
  // sitting on `from`. Setting it on `into` while `from` still holds it
  // raises ER_DUP_ENTRY - after the identities have already moved, leaving
  // the identity re-pointed, the email unset and the duplicate profile still
  // there. So: move the identities (they must not be attached to `from` when
  // it is deleted, or the FK cascade takes them with it), then delete
  // `from`, which frees the address, and only then claim it.
  for (const i of moving) {
    await db.update("UPDATE user_identities SET user_id = ? WHERE id = ?", [
      into.id,
      i.id,
    ]);
  }

  await db.query("DELETE FROM users WHERE id = ?", [from.id]);

  if (email) {
    await db.update("UPDATE users SET email = ? WHERE id = ?", [
      String(email).trim().toLowerCase(),
      into.id,
    ]);
  }

  // The deleted profile was almost certainly the ACTIVE one - it is the one
  // you signed in as. data/active-user.json still names it, and
  // getActiveUserId() returns null for a profile that no longer exists, which
  // puts the app behind the "Who's using MyWork?" picker with a static
  // backdrop. Repointing it here is the difference between this script
  // finishing the job and handing back a blocked app.
  await activeUserService.setActiveUserId(into.id);
  console.log(`  active profile repointed to #${into.id} ${into.name}`);

  console.log("\nDone. Sign out and sign in again.");
  console.log(
    `The sign-in now resolves to #${into.id} ${into.name}, which owns your contexts.\n`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\nFailed:", error.message);
    process.exit(1);
  });
