const TemplateEditor = (() => {
  let splitPane = null;

  const init = (splitPaneInstance) => {
    splitPane = splitPaneInstance;
  };

  const populate = async (templateId) => {
    try {
      const response = await fetch(`/api/work-item-templates/${templateId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();

      if (!result.success || !result.data) {
        app.notify('Error loading template', 'danger');
        return;
      }

      const template = result.data;
      fillForm(template);
      splitPane.showRightPane();
    } catch (error) {
      console.error('Error loading template:', error);
      app.notify('Error loading template', 'danger');
    }
  };

  const fillForm = (template) => {
    document.getElementById('templateEditorId').value = template.id;
    document.getElementById('templateEditorTitle').value = template.title;
    document.getElementById('templateEditorDisplayTitle').textContent = template.title;
    document.getElementById('templateEditorDescription').value = template.description || '';
    document.getElementById('templateEditorEmoji').value = template.emoji || '';
    document.getElementById('templateEditorStartTime').value = template.start_time || '';
    updateEmojiFieldButton('templateEditorEmojiBtn', template.emoji || '');
    setTimeBoxField('templateEditorTimeBox', template.time_box_minutes);
  };

  const setTimeBoxField = (groupId, minutes) => {
    const value = minutes ? String(minutes) : '';
    const input = document.querySelector(`#${groupId} input[value="${value}"]`);
    if (input) input.checked = true;
  };

  const getTimeBoxField = (groupId) => {
    const checked = document.querySelector(`#${groupId} input:checked`);
    return checked && checked.value ? checked.value : null;
  };

  const save = async () => {
    const templateId = document.getElementById('templateEditorId').value;

    const data = {
      title: document.getElementById('templateEditorTitle').value,
      description: document.getElementById('templateEditorDescription').value,
      emoji: document.getElementById('templateEditorEmoji').value,
      start_time: document.getElementById('templateEditorStartTime')?.value || null,
      time_box_minutes: getTimeBoxField('templateEditorTimeBox')
    };

    try {
      const url = templateId ? `/api/work-item-templates/${templateId}` : '/api/work-item-templates';
      const method = templateId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': window.APP_CONFIG?.csrfToken
        },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (result.success) {
        app.notify('Template saved!', 'success');
        return true;
      } else {
        app.notify('Error: ' + result.message, 'danger');
        return false;
      }
    } catch (error) {
      console.error('Error:', error);
      app.notify('Error saving template', 'danger');
      return false;
    }
  };

  const close = () => {
    if (splitPane) {
      splitPane.hideRightPane();
    }
  };

  return {
    init,
    populate,
    fillForm,
    save,
    close
  };
})();
