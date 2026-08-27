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

// The rails. They have no tab pane, so one can never be `currentTab` - that
// is what left the app showing the Dailies rail alone and looking like it had
// failed to load. Choosing one here means "open with this rail on screen",
// which the rail layout in tabs.js handles; it never becomes a tab.
const RAILS = [
  { slug: "daily", label: "Dailies" },
  { slug: "template", label: "Templates" },
];
const RAIL_SLUGS = new Set(RAILS.map((r) => r.slug));

// A type renders a tab unless it is a rail, or excluded from the tab bar the
// way dashboard.ejs excludes them - by type_category, not by a list of slugs.
// Naming slugs is how ado_work_item came to render as a real tab.
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

/**
 * ONE setting: what the app opens on. A rail or a tab, chosen from one list.
 *
 * It was briefly two settings - a tab and a rail - which is one more decision
 * than the question deserves ("open on X" is a single thought) and made
 * "Dailies" look like it meant something different in each.
 *
 * `landingTab`/`landingRail` are read as fallbacks so a value saved under the
 * old shape still applies instead of silently reverting to the default.
 */
export function getStartupView() {
  const prefs = read();
  return prefs.startupView ?? prefs.landingRail ?? prefs.landingTab ?? null;
}

export function getPreferences() {
  return { startupView: getStartupView() };
}

export async function getStartupChoices() {
  const entityTypeService = await import("./entityTypeService.js");
  const types = await entityTypeService.getAllEntityTypes();
  return [
    ...RAILS.map((r) => ({ ...r, kind: "rail" })),
    ...types
      .filter(rendersATab)
      .map((t) => ({ slug: t.slug, label: t.label, kind: "tab" })),
  ];
}

export async function setStartupView(slug) {
  const prefs = read();

  // Old keys are removed whenever this is written, so the fallback in
  // getStartupView() cannot outlive a deliberate change and start
  // contradicting it later.
  delete prefs.landingTab;
  delete prefs.landingRail;

  if (slug === null || slug === "" || slug === undefined) {
    delete prefs.startupView;
    write(prefs);
    return { startupView: null };
  }

  const choices = await getStartupChoices();
  if (!choices.some((c) => c.slug === slug)) {
    throw new ValidationError(`'${slug}' is not something the app can open on`);
  }

  prefs.startupView = slug;
  write(prefs);
  return { startupView: slug };
}

/**
 * What the dashboard should render with.
 *
 * `tab` is ALWAYS a real tab, even when a rail was chosen - the type pane
 * needs a valid tab behind it either way, and `currentTab` must never be a
 * rail. `rail` and `railOnly` say what the layout should do on top of that.
 */
export async function resolveStartup() {
  const choices = await getStartupChoices();
  const tabs = choices.filter((c) => c.kind === "tab");
  const firstTab =
    tabs.find((t) => t.slug === "priority")?.slug || tabs[0]?.slug || null;

  const chosen = getStartupView();

  // No choice, or one naming a type that no longer exists: leave the layout
  // alone entirely. `view: null` is how the client knows not to force
  // anything, so an install that has never touched this setting behaves
  // exactly as it did before it existed.
  if (!chosen || !choices.some((c) => c.slug === chosen)) {
    return { tab: firstTab, view: null, kind: null };
  }

  if (RAIL_SLUGS.has(chosen)) {
    // A rail can never be `currentTab` - that is what left the app showing a
    // rail alone and looking like it had failed to load - so the type pane
    // still gets a real tab behind it, hidden though it will be.
    return { tab: firstTab, view: chosen, kind: "rail" };
  }

  return { tab: chosen, view: chosen, kind: "tab" };
}
