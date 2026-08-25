// Settings > Compare & Sync Contexts.
//
// Two steps on purpose: Compare shows what WOULD change, then you tick the
// types you actually want and Apply. There is no "make them identical" button,
// because the interesting cases are always partial - you want Categories, not
// the six other types you happen to have edited on this machine.
//
// The whole screen is built around one guarantee, stated in the service and
// repeated here so the UI cannot quietly drift from it: **nothing on the target
// is deleted.** Anything the target has and the source does not is shown, in
// grey, labelled "only here - kept", and is not selectable.

(function () {
  const STATUS = {
    only_in_source: { badge: 'success', text: 'will be added' },
    differs: { badge: 'warning', text: 'will be updated' },
    identical: { badge: 'light', text: 'same' },
    only_in_target: { badge: 'secondary', text: 'only here - kept' },
  };

  let lastDiff = null;

  const el = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

  async function loadContexts() {
    const source = el('syncSource');
    const target = el('syncTarget');
    if (!source || !target) return;
    try {
      const contexts = await app.fetchData('/api/contexts');
      const list = Array.isArray(contexts) ? contexts : (contexts?.data || []);
      const options = list
        .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
        .join('');
      source.innerHTML = options;
      target.innerHTML = options;
      // Default the target to something other than the source, so the first
      // Compare is a real comparison rather than an error.
      if (list.length > 1) target.value = String(list[1].id);
    } catch (error) {
      el('syncStatus').innerHTML = alertBox('danger', `Could not load contexts: ${esc(error.message)}`);
    }
  }

  const alertBox = (kind, html) => `<div class="alert alert-${kind}">${html}</div>`;

  function fieldRow(field) {
    const meta = STATUS[field.status] || STATUS.identical;
    const detail = field.changes?.length
      ? field.changes.map((c) => `${esc(c.key)}: <code>${esc(c.target)}</code> &rarr; <code>${esc(c.source)}</code>`).join('<br>')
      : '';
    return `
      <tr class="${field.status === 'identical' ? 'text-muted' : ''}">
        <td class="ps-4"><code>${esc(field.field_key)}</code></td>
        <td>${esc(field.label)}</td>
        <td><span class="badge bg-${meta.badge} ${meta.badge === 'light' ? 'text-dark' : ''}">${meta.text}</span></td>
        <td class="small">${detail}</td>
      </tr>`;
  }

  function typeCard(type) {
    const meta = STATUS[type.status] || STATUS.identical;
    // A type that exists only on the target is not a thing you can sync FROM
    // the source - there is nothing there to send. Shown, not selectable.
    const selectable = type.status !== 'only_in_target' && type.status !== 'identical';
    const interesting = type.fields.filter((f) => f.status !== 'identical');
    const shown = interesting.length ? interesting : type.fields;

    const records = type.records
      ? `<div class="small text-muted mt-1">
           Records: ${type.records.sourceCount} here, ${type.records.targetCount} there
           ${type.records.toAdd ? `&middot; <strong>${type.records.toAdd} would be added</strong>` : '&middot; nothing to add'}
           ${type.records.sample?.length ? `<br><span class="font-monospace">${type.records.sample.map(esc).join('<br>')}</span>` : ''}
         </div>`
      : '';

    return `
      <div class="card mb-2">
        <div class="card-body py-2">
          <div class="d-flex align-items-center gap-2">
            <input class="form-check-input mt-0 sync-type-check" type="checkbox"
                   value="${esc(type.slug)}" ${selectable ? '' : 'disabled'} ${selectable ? 'checked' : ''}>
            <span class="fs-5">${esc(type.icon || '')}</span>
            <strong>${esc(type.label)}</strong>
            <code class="small text-muted">${esc(type.slug)}</code>
            <span class="badge bg-${meta.badge} ${meta.badge === 'light' ? 'text-dark' : ''}">${meta.text}</span>
            ${type.typeChanges.length
    ? `<span class="small text-muted">${type.typeChanges.map((c) => esc(c.key)).join(', ')}</span>`
    : ''}
            <button class="btn btn-sm btn-link ms-auto sync-toggle" type="button">details</button>
          </div>
          ${records}
          <div class="sync-detail d-none mt-2">
            <table class="table table-sm mb-0">
              <thead><tr><th class="ps-4">Field</th><th>Label</th><th>Status</th><th>Change</th></tr></thead>
              <tbody>${shown.map(fieldRow).join('')}</tbody>
            </table>
            ${type.rules?.length
    ? `<div class="small text-muted mt-1">Nesting rules: ${type.rules
      .map((r) => `${esc(r.parent_slug)} &gt; ${esc(r.child_slug)} (${esc(r.status.replace(/_/g, ' '))})`)
      .join(', ')}</div>`
    : ''}
          </div>
        </div>
      </div>`;
  }

  function render(diff) {
    lastDiff = diff;
    const changed = diff.types.filter((t) => t.status !== 'identical');
    const header = `
      <div class="d-flex align-items-center justify-content-between mb-2">
        <div>
          <strong>${esc(diff.source.name)}</strong>
          <span class="badge bg-secondary">${esc(diff.source.dbType)}</span>
          <i class="bi bi-arrow-right mx-2"></i>
          <strong>${esc(diff.target.name)}</strong>
          <span class="badge bg-secondary">${esc(diff.target.dbType)}</span>
        </div>
        <div>
          <button class="btn btn-sm btn-outline-secondary" id="syncSelectNone" type="button">Select none</button>
          <button class="btn btn-sm btn-outline-secondary" id="syncSelectChanged" type="button">Select all changed</button>
        </div>
      </div>`;

    const summary = changed.length
      ? alertBox('info', `${changed.length} type(s) differ. Tick what you want carried over, then Apply.`)
      : alertBox('success', 'These two contexts already match. Nothing to sync.');

    el('syncResults').innerHTML = `
      ${header}
      ${summary}
      ${diff.types.map(typeCard).join('')}
      <div class="d-flex gap-2 mt-3">
        <button class="btn btn-outline-secondary" id="syncDryRunBtn" type="button">
          <i class="bi bi-eye"></i> Preview
        </button>
        <button class="btn btn-primary" id="syncApplyBtn" type="button" ${changed.length ? '' : 'disabled'}>
          <i class="bi bi-arrow-right-circle"></i> Apply to ${esc(diff.target.name)}
        </button>
      </div>`;
  }

  const selected = () => [...document.querySelectorAll('.sync-type-check:checked')].map((c) => c.value);

  async function compare() {
    const source = el('syncSource').value;
    const target = el('syncTarget').value;
    if (source === target) {
      el('syncStatus').innerHTML = alertBox('warning', 'Pick two different contexts.');
      return;
    }
    const records = el('syncIncludeRecords').checked;
    el('syncStatus').innerHTML = alertBox('secondary', 'Comparing...');
    el('syncResults').innerHTML = '';
    try {
      const diff = await app.fetchData(
        `/api/context-sync/compare?source=${encodeURIComponent(source)}`
        + `&target=${encodeURIComponent(target)}&records=${records}`,
      );
      el('syncStatus').innerHTML = '';
      render(diff);
    } catch (error) {
      el('syncStatus').innerHTML = alertBox('danger', esc(error.message));
    }
  }

  async function apply(dryRun) {
    const typeSlugs = selected();
    if (!typeSlugs.length) {
      el('syncStatus').innerHTML = alertBox('warning', 'Tick at least one type.');
      return;
    }
    const includeRecords = el('syncIncludeRecords').checked;

    if (!dryRun) {
      const ok = await app.confirm(
        `Carry ${typeSlugs.length} type(s) from ${lastDiff.source.name} to ${lastDiff.target.name}`
        + `${includeRecords ? ', records included' : ', structure only'}.\n\n`
        + 'Nothing on the target is deleted - this only adds and updates.',
        'Apply to ' + lastDiff.target.name + '?',
      );
      if (!ok) return;
    }

    el('syncStatus').innerHTML = alertBox('secondary', dryRun ? 'Previewing...' : 'Applying...');
    try {
      const result = await app.fetchData('/api/context-sync/apply', {
        method: 'POST',
        body: JSON.stringify({
          source: lastDiff.source.id,
          target: lastDiff.target.id,
          typeSlugs,
          includeRecords,
          dryRun,
        }),
      });
      const lines = result.results.map((r) => {
        const bits = [`<strong>${esc(r.slug)}</strong>: ${esc(r.action)}`];
        if (r.fieldsAdded?.length) bits.push(`fields added: ${r.fieldsAdded.map(esc).join(', ')}`);
        if (r.fieldsUpdated?.length) bits.push(`fields updated: ${r.fieldsUpdated.map(esc).join(', ')}`);
        if (r.rulesAdded?.length) bits.push(`rules added: ${r.rulesAdded.map(esc).join(', ')}`);
        if (r.records) bits.push(`records added: ${r.records.added}`);
        if (r.fields?.length) bits.push(`fields: ${r.fields.map(esc).join(', ')}`);
        return bits.join(' &middot; ');
      });
      el('syncStatus').innerHTML = alertBox(
        dryRun ? 'info' : 'success',
        `<strong>${dryRun ? 'Preview' : 'Done'}</strong><br>${lines.join('<br>')}`,
      );
      if (!dryRun) await compare();      // re-read, so the screen shows the new truth
    } catch (error) {
      el('syncStatus').innerHTML = alertBox('danger', esc(error.message));
    }
  }

  function init() {
    if (!el('syncCompareBtn')) return;
    loadContexts();
    el('syncCompareBtn').addEventListener('click', compare);

    // Delegated: the results are re-rendered on every compare, so binding
    // directly to the buttons inside them would go stale each time.
    el('syncResults').addEventListener('click', (e) => {
      if (e.target.closest('.sync-toggle')) {
        e.target.closest('.card').querySelector('.sync-detail').classList.toggle('d-none');
        return;
      }
      if (e.target.id === 'syncApplyBtn') apply(false);
      if (e.target.id === 'syncDryRunBtn') apply(true);
      if (e.target.id === 'syncSelectNone') {
        document.querySelectorAll('.sync-type-check').forEach((c) => { c.checked = false; });
      }
      if (e.target.id === 'syncSelectChanged') {
        document.querySelectorAll('.sync-type-check:not(:disabled)').forEach((c) => { c.checked = true; });
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
