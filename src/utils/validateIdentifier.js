import { ValidationError } from '../config/errors.js';

// Database/table/column names end up interpolated directly into DDL (CREATE
// DATABASE, USE, dynamic INSERT column lists) because neither MySQL nor
// MSSQL support parameterizing identifiers the way they do values. Anywhere
// that happens with a name that came from outside this codebase (a form
// field, an uploaded backup file) must run through this first - skipping it
// is a SQL injection hole. Deliberately conservative: real database/column
// names in practice are always plain alphanumeric/underscore.
const SAFE_IDENTIFIER = /^[a-zA-Z0-9_]+$/;

export function validateIdentifier(name, label = 'Name') {
  if (typeof name !== 'string' || !SAFE_IDENTIFIER.test(name)) {
    throw new ValidationError(`${label} may only contain letters, numbers, and underscores`);
  }
  return name;
}
