import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ValidationError } from '../config/errors.js';
import { getContextById, getAllContexts } from './contextService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORE_PATH = path.join(__dirname, '../../data/active-context.json');

function readStore() {
  if (!fs.existsSync(STORE_PATH)) {
    return { activeContextId: null };
  }
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function writeStore(store) {
  fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// Resolves the server's current active context id, persisted across restarts
// (data/active-context.json, not session-based). Falls back to the first
// context (by order_index) if none has been explicitly set yet, or if the
// previously-set one no longer exists (e.g. was deleted).
export async function getActiveContextId() {
  const store = readStore();

  if (store.activeContextId) {
    const contexts = await getAllContexts();
    if (contexts.some(c => c.id === store.activeContextId)) {
      return store.activeContextId;
    }
  }

  const contexts = await getAllContexts();
  if (contexts.length === 0) {
    throw new ValidationError('No contexts exist');
  }
  return contexts[0].id;
}

export async function setActiveContextId(id) {
  // Throws NotFoundError if it doesn't exist
  const context = await getContextById(id);
  writeStore({ activeContextId: context.id });
  return context;
}

export async function getActiveContext() {
  const id = await getActiveContextId();
  return getContextById(id);
}
