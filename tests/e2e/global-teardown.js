// Last-resort sweep of test rows, run once after the whole suite.
//
// Every spec is still expected to clean up after itself - this is not a licence
// to skip that. It exists because per-spec teardown CANNOT be made reliable on
// its own: the hooks clean up by calling `page.evaluate`, so when a test times
// out and Playwright tears the page down, the cleanup goes with it. The
// 2026-08-25 baseline run proved it - `template-drops`, `row-context-behaviour`,
// `rollup-depth`, `board-time`, `worked-time` and `time-box` each have a proper
// `afterEach` AND a hard delete, and every one of them still leaked.
//
// This runs in Node against the database directly, so it does not care whether
// a browser is left alive.
//
// It deletes ONLY rows whose title starts with ZZZ. That prefix is the
// convention precisely so a blind sweep like this one is safe; a spec that
// names its fixtures anything else is not covered and must clean up its own.
import { query } from '../../src/database/connectionPool.js';

export default async function globalTeardown() {
  let rows;
  try {
    rows = await query("SELECT id, title FROM entities WHERE title LIKE 'ZZZ%'");
  } catch (err) {
    // Never fail the run over cleanup - a red teardown would mask the results
    // the run exists to produce.
    console.warn(`[teardown] could not query entities: ${err.message}`);
    return;
  }

  await sweepTestFields();
  await sweepTestUsers();
  await sweepFixtureTypes();

  if (!rows.length) return;

  const ids = rows.map((r) => r.id).join(',');
  try {
    // Children first: both reference entities.id.
    await query(
      `DELETE FROM entity_relationships
       WHERE parent_entity_id IN (${ids}) OR child_entity_id IN (${ids})`,
    );
    await query(`DELETE FROM entity_field_values WHERE entity_id IN (${ids})`);
    await query(`DELETE FROM entities WHERE id IN (${ids})`);
    console.log(`[teardown] swept ${rows.length} leftover ZZZ row(s)`);
  } catch (err) {
    console.warn(`[teardown] sweep failed: ${err.message}`);
  }
}

/**
 * Field DEFINITIONS a spec added to an existing type and never removed.
 *
 * field-sync-matrix adds one field per interactive type and deletes them in a
 * `finally`, which is correct and still not enough: the delete runs through
 * `page.evaluate`, and when that test hits its 180s timeout the page goes away
 * before the finally can finish. Six of them - zzz_status, zzz_priority,
 * zzz_check, zzz_select, zzz_radio, zzz_emojis - were left on the Ideas type.
 *
 * That is worse than a leftover row. A stray field definition changes what
 * every Ideas row RENDERS: `zzz_priority` gave every row a second priority
 * cell, so priority-field.spec asked for one and found two, and the failure
 * read as a duplicate-rendering bug in the engine.
 *
 * Matched on the `zzz` key prefix, the same convention as the titles.
 */
async function sweepTestFields() {
  try {
    const fields = await query(
      "SELECT id, field_key FROM entity_type_fields WHERE field_key LIKE 'zzz%'",
    );
    if (!fields.length) return;
    const keys = fields.map((f) => f.field_key);
    const placeholders = keys.map(() => '?').join(',');
    await query(`DELETE FROM entity_field_values WHERE field_key IN (${placeholders})`, keys);
    await query(
      `DELETE FROM entity_type_fields WHERE id IN (${fields.map((f) => f.id).join(',')})`,
    );
    console.log(`[teardown] swept ${fields.length} leftover test field definition(s)`);
  } catch (err) {
    console.warn(`[teardown] field sweep failed: ${err.message}`);
  }
}

/**
 * Leftover test PROFILES.
 *
 * user-profiles.spec creates a `ZZZ Profile Probe` to prove that a second
 * profile sees none of the first one's contexts, and removes it in an
 * `afterAll` - which, like every other teardown that runs through the page,
 * cannot finish if the page is already gone. Same failure mode that left six
 * `zzz` field definitions on the Ideas type.
 *
 * A stray profile is not as damaging as a stray field definition - it renders
 * nothing - but it does show up in the switcher, and the switcher is a list of
 * real people. Somebody else's test artefact sitting in it is confusing in a
 * way a hidden row is not.
 *
 * Only profiles owning NO contexts are swept, which is the same rule
 * userService.deleteUser enforces: a profile that owns a context is either
 * real, or a test failure that needs looking at rather than tidying away.
 */
async function sweepTestUsers() {
  try {
    const users = await query(
      "SELECT u.id, u.name FROM users u"
      + " LEFT JOIN contexts c ON c.user_id = u.id"
      + " WHERE u.name LIKE 'ZZZ%' AND c.id IS NULL",
    );
    if (!users.length) return;
    await query(`DELETE FROM users WHERE id IN (${users.map((u) => u.id).join(',')})`);
    console.log(`[teardown] swept ${users.length} leftover test profile(s)`);
  } catch (err) {
    console.warn(`[teardown] profile sweep failed: ${err.message}`);
  }
}

/**
 * The `tests` fixture type, removed at the END of the run.
 *
 * Five spec files need "a type the user created" to exist, and helpers/
 * fixtures.js makes one. It used to be left behind on purpose, because
 * deleting a type reserved its slug for ever and the next run could not
 * recreate it - so the fixture sat in the user's app as a real tab called
 * "Tests", indistinguishable from something they had made.
 *
 * softDeleteEntityType() moves the slug aside now, so the name comes free and
 * the next run makes it again. Swept here rather than per-spec: the type has
 * to outlive every file that uses it, and this is the only hook that runs
 * after all of them.
 */
async function sweepFixtureTypes() {
  try {
    const types = await query(
      "SELECT id, slug FROM entity_types WHERE slug = 'tests' AND deleted_at IS NULL",
    );
    for (const type of types) {
      const rows = await query('SELECT id FROM entities WHERE entity_type_id = ?', [type.id]);
      if (rows.length) {
        const ids = rows.map((r) => r.id).join(',');
        await query(
          `DELETE FROM entity_relationships
           WHERE parent_entity_id IN (${ids}) OR child_entity_id IN (${ids})`,
        );
        await query(`DELETE FROM entity_field_values WHERE entity_id IN (${ids})`);
        await query(`DELETE FROM entities WHERE id IN (${ids})`);
      }
      await query('DELETE FROM entity_type_relationships WHERE parent_type_id = ? OR child_type_id = ?', [type.id, type.id]);
      await query('DELETE FROM entity_type_fields WHERE entity_type_id = ?', [type.id]);
      await query('DELETE FROM entity_types WHERE id = ?', [type.id]);
      console.log(`[teardown] removed fixture type '${type.slug}' and ${rows.length} row(s)`);
    }
  } catch (err) {
    console.warn(`[teardown] fixture type sweep failed: ${err.message}`);
  }
}
