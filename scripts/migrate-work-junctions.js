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
 * Settings -> Database Configuration -> Analyze & Migrate runs the same thing.
 * This script exists for the DROP, which that button deliberately will not do,
 * and for a database you would rather inspect from a terminal than a browser.
 */

import { getCurrentConfig } from '../src/database/connectionPool.js';
import {
  migrateRetiredWorkJunctions,
  surveyRetiredWorkJunctions,
} from '../src/services/schemaMigrationService.js';

async function main() {
  const migrate = process.argv.includes('--migrate');
  const drop = process.argv.includes('--drop');

  const cfg = getCurrentConfig();
  console.log(`\nDatabase: ${cfg.database} on ${cfg.host} (${cfg.type})`);
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
  } else {
    console.log('\nTables left in place. Re-run with --drop once you are satisfied.');
  }

  process.exit(0);
}

main().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
