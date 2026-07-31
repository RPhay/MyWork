// Builds a Map of id -> full "Parent\Child\Grandchild" path for a self-referencing
// (parent_id) list of records, e.g. areas or priorities/projects.
export function buildPathMap(records, labelField = 'name') {
  const byId = new Map(records.map(r => [r.id, r]));
  const cache = new Map();

  function resolve(id) {
    if (cache.has(id)) return cache.get(id);
    const record = byId.get(id);
    if (!record) return '';

    let path = record[labelField];
    if (record.parent_id && byId.has(record.parent_id)) {
      path = `${resolve(record.parent_id)}\\${path}`;
    }

    cache.set(id, path);
    return path;
  }

  const result = new Map();
  for (const record of records) {
    result.set(record.id, resolve(record.id));
  }
  return result;
}