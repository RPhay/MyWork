// Builds a Map of id -> full "Parent\Child\Grandchild" path for a self-referencing
// (parent_id) list of records, e.g. areas or priorities/projects.
//
// Walks iteratively rather than recursively. A cycle in the parent chain
// should be impossible - entityRelationshipService rejects edges that would
// create one, and priorityService does the same for parent_id - but when one
// did exist this function recursed until the stack blew, and a single bad edge
// took out Dailies, Projects and Reporting at once with "Maximum call stack
// size exceeded". Cycles now stop the walk instead, yielding the longest
// non-repeating path.
export function buildPathMap(records, labelField = 'name') {
  const byId = new Map(records.map(r => [r.id, r]));
  const cache = new Map();

  function resolve(startId) {
    if (cache.has(startId)) return cache.get(startId);

    // Walk up to the root (or into a cycle), collecting the chain.
    const chain = [];
    const seen = new Set();
    let current = byId.get(startId);

    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      chain.push(current);
      const parentId = current.parent_id;
      current = parentId && byId.has(parentId) ? byId.get(parentId) : null;
    }

    // chain is child -> ancestor; the path reads ancestor -> child.
    const path = chain
      .reverse()
      .map(r => r[labelField])
      .join('\\');

    cache.set(startId, path);
    return path;
  }

  const result = new Map();
  for (const record of records) {
    result.set(record.id, resolve(record.id));
  }
  return result;
}
