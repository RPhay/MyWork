// Machine-wide app preferences that are not a context's business.
//
// Stored in data/app-preferences.json, beside active-user.json and
// focus-monitors.json, for the same reason those are: they describe how THIS
// install behaves, not what is in any context's database, and a context can
// be swapped underneath them without the answer changing.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ValidationError } from "../config/errors.js";
import logger from "../utils/logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE = path.join(__dirname, "../../data/app-preferences.json");

// A landing tab has to be a slug that actually RENDERS a tab, and two
// separate rules decide that:
//
//   - Dailies and Templates are RAILS. They sit beside whichever tab is
//     showing rather than being one, so naming one leaves the tab pane empty
//     and the app looking like it failed to load. Not a style rule: `daily`
//     was the hardcoded fallback in two places and did exactly that.
//   - External types (Outlook Calendar, Azure DevOps Work Items) and
//     `folder` are filtered OUT of the tab bar - see dashboard.ejs, which
//     excludes them by type_category for the same reason.
//
// The second rule is applied by reading type_category rather than listing
// slugs, so a future external type is excluded here automatically, exactly
// as it is in the tab bar. Naming slugs is how ado_work_item came to render
// as a real tab in the first place.
const RAIL_SLUGS = new Set(["daily", "template"]);

function rendersATab(type) {
  return (
    !RAIL_SLUGS.has(type.slug) &&
    type.type_category !== "external" &&
    type.slug !== "folder"
  );
}

function read() {
  try {
    if (!fs.existsSync(STORE)) return {};
    return JSON.parse(fs.readFileSync(STORE, "utf8")) || {};
  } catch (error) {
    logger.warn("Could not read app preferences, using defaults", {
      error: error.message,
    });
    return {};
  }
}

function write(prefs) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(prefs, null, 2));
}

export function getPreferences() {
  const { landingTab = null } = read();
  return { landingTab };
}

/** The stored landing tab, or null when none has been chosen. */
export function getLandingTab() {
  return getPreferences().landingTab;
}

/**
 * Choose the landing tab. Validated against the types that actually exist,
 * so a renamed or deleted type cannot leave the app opening on a tab that
 * is not there - which is the failure this setting exists to end, not to
 * reproduce in a new place.
 */
export async function setLandingTab(slug) {
  const prefs = read();

  if (slug === null || slug === "" || slug === undefined) {
    delete prefs.landingTab;
    write(prefs);
    return { landingTab: null };
  }

  const entityTypeService = await import("./entityTypeService.js");
  const types = await entityTypeService.getAllEntityTypes();
  const allowed = types.filter(rendersATab).map((t) => t.slug);

  if (!allowed.includes(slug)) {
    throw new ValidationError(
      RAIL_SLUGS.has(slug)
        ? `${slug} is a rail, not a tab - it cannot be the landing tab`
        : `'${slug}' does not render a tab, so it cannot be the landing tab`,
    );
  }

  prefs.landingTab = slug;
  write(prefs);
  return { landingTab: slug };
}

/** Which slugs may be offered as a landing tab. */
export async function getLandingTabChoices() {
  const entityTypeService = await import("./entityTypeService.js");
  const types = await entityTypeService.getAllEntityTypes();
  return types
    .filter(rendersATab)
    .map((t) => ({ slug: t.slug, label: t.label }));
}

/**
 * The tab the dashboard should open on: the stored choice if it is still
 * valid, otherwise the first type that is not a rail.
 *
 * Never returns a rail slug, and never returns a hardcoded guess. Both
 * previous fallbacks were the literal string 'daily', which names a rail and
 * therefore has no pane - so the app opened showing the Dailies rail and an
 * empty space where a tab should be.
 */
export async function resolveLandingTab() {
  const choices = await getLandingTabChoices();
  if (choices.length === 0) return null;

  const stored = getLandingTab();
  if (stored && choices.some((c) => c.slug === stored)) return stored;

  const preferred = choices.find((c) => c.slug === "priority");
  return preferred ? preferred.slug : choices[0].slug;
}
