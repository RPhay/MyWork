import * as db from '../database/connectionPool.js';

// Every main-app tab except Dailies, which is always shown first and can't be
// hidden - so it's deliberately not part of this configurable set at all.
export const CONFIGURABLE_TABS = [
  { key: 'my-priorities', label: 'Projects' },
  { key: 'priority-board', label: 'Priorities' },
  { key: 'areas', label: 'Categories' },
  { key: 'yearly-goals', label: 'Yearly Goals' },
  { key: 'templates', label: 'Templates' },
  { key: 'todos', label: 'To Dos' },
  { key: 'brainstorming', label: 'Brainstorming' },
];

// Returns every configurable tab for a context, visible and in the order
// saved - defaulting any tab that's never been explicitly configured yet to
// visible, in the CONFIGURABLE_TABS declaration order.
export async function getTabSettings(contextId) {
  const rows = await db.query('SELECT tab_key, visible, order_index FROM context_tab_settings WHERE context_id = ?', [contextId]);
  const byKey = new Map(rows.map(r => [r.tab_key, r]));

  return CONFIGURABLE_TABS
    .map((tab, i) => {
      const saved = byKey.get(tab.key);
      return {
        key: tab.key,
        label: tab.label,
        visible: saved ? !!saved.visible : true,
        order_index: saved ? saved.order_index : i,
      };
    })
    .sort((a, b) => a.order_index - b.order_index);
}

// Replaces this context's tab settings wholesale - `settings` is the full
// ordered list as the client wants it saved: [{ key, visible }, ...].
export async function saveTabSettings(contextId, settings) {
  if (!Array.isArray(settings)) return getTabSettings(contextId);

  const validKeys = new Set(CONFIGURABLE_TABS.map(t => t.key));

  for (let i = 0; i < settings.length; i++) {
    const { key, visible } = settings[i];
    if (!validKeys.has(key)) continue;

    await db.query(
      `INSERT INTO context_tab_settings (context_id, tab_key, visible, order_index)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE visible = VALUES(visible), order_index = VALUES(order_index)`,
      [contextId, key, visible !== false, i]
    );
  }

  return getTabSettings(contextId);
}
