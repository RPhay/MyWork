// ESLint flat config.
//
// Two very different bodies of code live under src/:
//
//   src/**            Node ESM - imports, top-level await, server globals. One
//                     file (entityTypeService.js) uses import attributes
//                     (`with { type: 'json' }`), which is why this project is
//                     on ESLint 9: espree 9 could not parse them, so under
//                     ESLint 8 that file was silently skipped entirely.
//   src/public/js/**  35 CLASSIC scripts. No import/export anywhere, no
//                     <script type="module">. They share one global namespace
//                     and call each other's top-level functions directly.
//
// That second group is the reason this config is code rather than data. ESLint
// cannot see the load order (it lives in the EJS templates), so every
// cross-file call looks undefined - 324 false no-undef reports on a clean
// tree. Listing the names by hand means a ~370-entry block that goes stale the
// first time someone adds a function, so they are DERIVED below: a top-level
// declaration in any of those files is, by definition, a global to the others.
//
// no-undef keeps its value that way - it still catches a misspelled reference
// inside a function body, which is the failure it actually earns its place on.
// It found `connectionPool` being called in contextSsoService.js with no
// import at all the first time it ran.

import js from '@eslint/js';
import globals from 'globals';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BROWSER_JS = path.join(here, 'src', 'public', 'js');

// Only column-0 declarations. Anything indented is inside a function or an
// IIFE and is correctly invisible to the other files.
const TOP_LEVEL =
  /^(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*)|class\s+([A-Za-z_$][\w$]*)|window\.([A-Za-z_$][\w$]*)\s*=)/;

function sharedBrowserGlobals() {
  const found = {};
  let files = [];
  try {
    files = fs.readdirSync(BROWSER_JS).filter((f) => f.endsWith('.js'));
  } catch {
    return found;                          // directory moved - fail open, not loud
  }
  for (const file of files) {
    const source = fs.readFileSync(path.join(BROWSER_JS, file), 'utf8');
    for (const line of source.split('\n')) {
      if (/^\s/.test(line)) continue;
      const match = TOP_LEVEL.exec(line);
      if (match) found[match[1] || match[2] || match[3] || match[4]] = 'writable';
    }
  }
  return found;
}

const shared = {
  rules: {
    // An unused import is usually a leftover from a refactor, which is worth
    // seeing; an unused caught error is idiomatic, and is not.
    'no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
    ],
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
};

export default [
  { ignores: ['node_modules/**', 'src/public/vendor/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    ...shared,
  },
  {
    files: ['src/public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        bootstrap: 'readonly',             // both arrive from a plain <script> tag,
        Chart: 'readonly',                 // so nothing in src/ ever declares them
        ...sharedBrowserGlobals(),
      },
    },
    rules: {
      ...shared.rules,
      // The browser globals above are DECLARED by the very files being linted,
      // so counting a config global as a prior declaration reports all ~370.
      'no-redeclare': ['error', { builtinGlobals: false }],
      // `vars: 'local'` is the same blind spot as no-undef, seen from the other
      // side: a top-level function here is called from a SIBLING file or from
      // an onclick= in an EJS template, neither of which ESLint can see, so
      // every one of them reads as unused. Locals and arguments are still
      // checked - those are the ones where "unused" means something.
      'no-unused-vars': [
        'error',
        { vars: 'local', args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
    },
  },
];
