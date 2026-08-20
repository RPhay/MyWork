// Form Handling

// Add CSRF token to all forms
document.addEventListener('DOMContentLoaded', () => {
  const csrfToken = window.APP_CONFIG?.csrfToken || document.querySelector('[name="_csrf"]')?.value;

  if (csrfToken) {
    // Add token to all forms that don't already have it
    document.querySelectorAll('form').forEach(form => {
      if (!form.querySelector('[name="_csrf"]')) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = '_csrf';
        input.value = csrfToken;
        form.insertBefore(input, form.firstChild);
      }
    });

    // A global safety net, not the mechanism.
    //
    // window.fetch is patched so that ANY mutating request carries the CSRF
    // token even if its caller forgot. That is deliberate belt-and-braces, but
    // it is also action at a distance: a request works here and fails in a
    // context where this file has not run, with no clue why.
    //
    // The mechanism is app.fetch / app.fetchRaw in main.js, which every call
    // site now goes through. Reach for those; do not rely on this.
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
      const options = args[1] || {};
      if (options.method && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(options.method.toUpperCase())) {
        if (!options.headers) options.headers = {};
        options.headers['X-CSRF-Token'] = csrfToken;
      }
      return originalFetch.apply(this, args);
    };
  }
});

// Enter inside a modal form implicitly submits it (no modal form intercepts
// `submit`), which navigates the page and closes the modal. Block that unless
// focus is on a button, where Enter should activate it as normal.
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;

  const form = e.target.closest('.modal form');
  if (!form) return;

  if (e.target.matches('button, input[type="submit"], input[type="button"], a.btn')) return;

  e.preventDefault();
});

// Form submission helper
async function submitForm(formId, endpoint, options = {}) {
  const form = document.getElementById(formId);
  if (!form) {
    console.error('Form not found:', formId);
    return false;
  }

  try {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);

    const response = await app.fetch(endpoint, {
      method: options.method || 'POST',
      body: JSON.stringify(data),
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.success) {
      app.notify(response.message || 'Success', 'success');
      if (options.onSuccess) {
        options.onSuccess(response);
      }
      return true;
    } else {
      app.notify(response.message || 'An error occurred', 'danger');
      return false;
    }
  } catch (error) {
    console.error('Form submission error:', error);
    app.notify('An error occurred while submitting the form', 'danger');
    return false;
  }
}

// Form validation helper
function validateForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return false;

  const requiredFields = form.querySelectorAll('[required]');
  let isValid = true;

  requiredFields.forEach(field => {
    const value = field.value?.trim();
    if (!value) {
      field.classList.add('is-invalid');
      isValid = false;
    } else {
      field.classList.remove('is-invalid');
    }
  });

  return isValid;
}

// Export functions
window.submitForm = submitForm;
window.validateForm = validateForm;
