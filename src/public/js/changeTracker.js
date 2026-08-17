// Shared "unsaved changes" tracking for editor panes: watches a form's inputs,
// enables/disables a save button, and exposes whether anything changed since
// the last reset. Plain global (no ES module system in this app) - load this
// script before any editor script that calls createChangeTracker().
function createChangeTracker({ formId, saveBtnId, selectors }) {
  let hasChanges = false;

  const defaultSelectors = [
    'input[type="text"]', 'textarea', 'input[type="checkbox"]',
    'input[type="radio"]', 'input[type="date"]'
  ];
  const inputSelector = (selectors || defaultSelectors).join(', ');

  const markChanged = () => {
    hasChanges = true;
    const saveBtn = document.getElementById(saveBtnId);
    if (saveBtn) saveBtn.disabled = false;
  };

  const trackFormChanges = () => {
    const form = document.getElementById(formId);
    if (!form) return;

    const inputs = form.querySelectorAll(inputSelector);
    inputs.forEach(input => {
      input.addEventListener('change', markChanged);
      input.addEventListener('input', markChanged);
    });
  };

  const resetChangeTracking = () => {
    hasChanges = false;
    const saveBtn = document.getElementById(saveBtnId);
    if (saveBtn) saveBtn.disabled = true;
  };

  return {
    markChanged,
    trackFormChanges,
    resetChangeTracking,
    get hasChanges() { return hasChanges; },
  };
}
window.createChangeTracker = createChangeTracker;
