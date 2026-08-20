#!/usr/bin/env node

/**
 * Retire the seven per-type work_*_associations junctions.
 *
 * Audit 07 rewrote workItemService to derive every typed list a day exposes
 * (priorities, goals, areas, todos...) from ONE junction, work_entity_
 * associations, and removed the seven per-type tables from both schema files.
 * What it did not do was move the rows. On MySQL that left 20 links sitting in
 * tables nothing read any more: present in the database, invisible in the app,
 * erroring nowhere.
 *
 *   node scripts/migrate-work-junctions.js            # report only
 *   node scripts/migrate-work-junctions.js --migrate  # copy the rows
 *   node scripts/migrate-work-junctions.js --migrate --drop
 *
 * Safe to run on a database with nothing to do: it says so and exits 0.
 *
 * The migration itself lives in schemaMigrationService, not here, because
 * Settings -> Database Configuration -> Analyze & Migrate runs the same thing,
 * drop included. This script exists to SURVEY without acting - which the button
 * cannot do, since it always acts - and for a database you would rather inspect
 * from a terminal than a browser.
 *
 * Neither entry point will drop a table whose rows are not fully accounted for,
 * and on SQL Server both are schema-qualified to [MyWork].
 */

import { getCurrentConfig } from '../src/database/connectionPool.js';
import {
  migrateRetiredWorkJunctions,
  surveyRetiredWorkJunctions,
  dropRetiredTables,
  discoverOrphanTables,
} from '../src/services/schemaMigrationService.js';

// Build a throwaway schema and report anything this database has that a fresh
// one would not. The authoritative way to find retired tables - scanning the
// schema source for CREATE TABLE misses the bridge junctions, which are created
// by a loop, and would report four live tables as junk.
async function discover() {
  const { canonicalCount, liveCount, orphans } = await discoverOrphanTables();
  console.log(`\nBuilt a reference schema: ${canonicalCount} tables. This database has ${liveCount}.`);
  if (orphans.length === 0) {
    console.log('\nNothing here that a fresh schema would not create.');
    return;
  }
  console.log(`\n${orphans.length} table(s) present here but not in a fresh schema:\n`);
  for (const o of orphans) {
    const rows = o.rows === null ? '  ?  ' : String(o.rows).padStart(5);
    console.log(`  ${rows} rows   ${o.table.padEnd(30)} ${o.listed ? '(known retired)' : '<- NOT in RETIRED_TABLES'}`);
  }
  const unlisted = orphans.filter(o => !o.listed);
  if (unlisted.length > 0) {
    console.log('\nThe unlisted ones are not dropped by anything. If they really are');
    console.log('retired, add them to RETIRED_TABLES in schemaMigrationService.js.');
  }
}

async function main() {
  const migrate = process.argv.includes('--migrate');
  const drop = process.argv.includes('--drop');

  const cfg = getCurrentConfig();
  console.log(`\nDatabase: ${cfg.database} on ${cfg.host} (${cfg.type})`);

  if (process.argv.includes('--discover')) {
    await discover();
    process.exit(0);
  }

  if (process.argv.includes('--drop-retired')) {
    const r = await dropRetiredTables({ dryRun: !drop });
    console.log(drop ? '\nDropping retired tables:' : '\nDry run - pass --drop to actually remove:');
    for (const t of r.dropped) console.log(`  ${drop ? 'dropped' : 'would drop'}  ${t}`);
    for (const k of r.keptWithRows) console.log(`  KEPT     ${k.table} - still holds ${k.rows} row(s)`);
    for (const u of r.uncountable) console.log(`  KEPT     ${u} - could not be counted`);
    if (r.dropped.length === 0 && r.keptWithRows.length === 0) console.log('  nothing to do');
    process.exit(0);
  }

  console.log(migrate ? (drop ? 'Mode: migrate + drop\n' : 'Mode: migrate\n') : 'Mode: report only\n');

  const survey = await surveyRetiredWorkJunctions();
  if (survey.skipped) {
    console.log(`${survey.skipped}.`);
    console.log('Update the schema first (Settings -> Database Configuration ->');
    console.log('Analyze & Migrate), then run this again.');
    process.exit(1);
  }

  console.log(`work_entity_associations currently holds ${survey.target} row(s).`);

  if (survey.present.length === 0) {
    console.log('\nNone of the seven retired junctions exist here. Nothing to do.');
    process.exit(0);
  }

  console.log('\nRetired junctions still present:');
  for (const p of survey.present) console.log(`  ${String(p.rows).padStart(6)}  ${p.table}`);

  if (!migrate) {
    console.log('\nReport only. Re-run with --migrate to copy these rows across,');
    console.log('and --drop as well to remove the tables once the copy succeeds.');
    process.exit(0);
  }

  const result = await migrateRetiredWorkJunctions({ drop });

  console.log(`\nMigrated ${result.migrated} link(s)`
    + `${result.alreadyPresent ? `, ${result.alreadyPresent} already present` : ''}`
    + `${result.dangling ? `, skipped ${result.dangling} dangling` : ''}.`);

  if (result.dropped.length > 0) {
    for (const t of result.dropped) console.log(`  dropped ${t}`);
    console.log('\nwork_source_associations deliberately left alone - a source is not an entity.');
  } else if (result.retained.length > 0) {
    console.log(`\nKept ${result.retained.join(', ')} - not every row was accounted for.`);
  } else if (drop) {
    console.log('\nNothing dropped.');
  } else {
    console.log('\nTables left in place. Re-run with --drop to remove them.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
