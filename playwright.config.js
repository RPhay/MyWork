import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',

  // `retired/` is out of the suite, and this line is what puts it there.
  //
  // Its README says retirement works because the config "matches
  // tests/e2e/*.spec.js, and this directory is one level down". That was never
  // true - there is no testMatch here, so Playwright's default recurses, and
  // every retired spec was still being collected. Five of them import a
  // `./setup-test-data.js` that moved out from under them, so collection threw
  // before a single test ran: `npx playwright test` could not run AT ALL.
  //
  // Nobody saw it because the guard set names its specs explicitly and never
  // collects the rest. Only a full run reaches this, and a full run was the one
  // thing that could not happen.
  testIgnore: '**/retired/**',

  // Sweeps leftover ZZZ rows once the suite ends. Specs still clean up after
  // themselves; this catches what their hooks cannot, because a hook that
  // cleans up through `page.evaluate` dies with the page a timeout tore down.
  globalTeardown: './tests/e2e/global-teardown.js',

  // Serial, on purpose, and this is not a performance oversight.
  //
  // Every worker talks to the SAME database - there is one, and it holds the
  // user's real working data. Run in parallel, specs collide over each other's
  // rows: one counts while another is inserting, one takes "the first row"
  // while another deletes it. Measured on this suite: the same seven spec
  // files gave 49 passed with parallel workers and 104 passed, zero failed,
  // run serially. Nothing about the app changed in between.
  //
  // That made a full run worthless as a signal - a red result meant nothing
  // until you re-ran the spec alone, so red stopped meaning anything at all.
  // A slower honest run beats a fast one nobody can act on.
  //
  // The real fix is per-worker data isolation (a context per worker - contexts
  // are already first-class in this app). Until that exists, this stays 1.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
