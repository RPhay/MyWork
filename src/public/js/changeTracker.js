/**
 * createChangeTracker - Reusable change tracking factory
 * Used by all editors (generic and legacy) to track form modifications
 */

function createChangeTracker(formElement, saveButton) {
  let hasChanges = false;

  const markChanged = () => {
    hasChanges = true;
    if (saveButton) saveButton.disabled = false;
  };

  const resetChangeTracking = () => {
    hasChanges = false;
    if (saveButton) saveButton.disabled = true;
  };

  const trackFormChanges = () => {
    if (formElement) {
      formElement.addEventListener('input', markChanged);
      formElement.addEventListener('change', markChanged);
    }
  };

  const hasUnsavedChanges = () => hasChanges;

  return {
    markChanged,
    resetChangeTracking,
    trackFormChanges,
    hasUnsavedChanges
  };
}
