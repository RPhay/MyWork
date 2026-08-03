/**
 * Shared utility functions for link management across To Dos, Ideas, and Priorities
 */

// Render links list in modal
function renderLinksList(type, links, containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (links.length === 0) {
    container.innerHTML = '<p class="text-muted small">No links yet</p>';
    return;
  }

  container.innerHTML = links.map(link => `
    <div class="d-flex align-items-center gap-2 mb-2 p-2 border rounded" data-link-id="${link.id}">
      <div class="flex-grow-1 min-width-0">
        <a href="${link.url}" target="_blank" rel="noopener noreferrer" class="text-decoration-none" title="${link.url}">
          ${app.escapeHtml(link.title || link.url)}
        </a>
      </div>
      <button type="button" class="btn btn-sm btn-outline-danger delete-link-btn" data-link-id="${link.id}" data-type="${type}">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `).join('');

  // Attach delete listeners
  container.querySelectorAll('.delete-link-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const linkId = btn.dataset.linkId;
      const linkType = btn.dataset.type;

      if (!await app.confirm('Delete this link?')) return;

      try {
        const response = await fetch(`/api/links/${linkType}/${linkId}`, {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': window.APP_CONFIG?.csrfToken }
        });

        const result = await response.json();
        if (result.success) {
          app.notify('Link deleted', 'success');
          // Re-render links for the current entity
          const entityId = document.getElementById(linkType === 'to-do' ? 'toDoId' : linkType === 'idea' ? 'ideaId' : 'priorityId')?.value;
          if (entityId) {
            loadLinksForEntity(linkType, entityId, linkType === 'to-do' ? 'toDoLinksList' : linkType === 'idea' ? 'ideaLinksList' : 'priorityLinksList');
          }
        }
      } catch (error) {
        console.error('Error deleting link:', error);
        app.notify('Error deleting link', 'danger');
      }
    });
  });
}

// Load links for an entity
async function loadLinksForEntity(type, entityId, containerId) {
  if (!entityId) return;

  try {
    const response = await fetch(`/api/links/${type}/${entityId}`);
    const result = await response.json();

    if (result.success) {
      renderLinksList(type, result.data, containerId);
    }
  } catch (error) {
    console.error('Error loading links:', error);
  }
}

// Add link for an entity
async function addLinkToEntity(type, entityId, url, title, listContainerId) {
  if (!url || !url.trim()) {
    app.notify('URL is required', 'warning');
    return;
  }

  try {
    const response = await fetch(`/api/links/${type}/${entityId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': window.APP_CONFIG?.csrfToken
      },
      body: JSON.stringify({
        url: url.trim(),
        title: title?.trim() || null
      })
    });

    const result = await response.json();
    if (result.success) {
      app.notify('Link added', 'success');
      // Reload links display
      loadLinksForEntity(type, entityId, listContainerId);
      return true;
    } else {
      app.notify('Error: ' + result.message, 'danger');
    }
  } catch (error) {
    console.error('Error adding link:', error);
    app.notify('Error adding link', 'danger');
  }

  return false;
}

// Handle drag-drop of URLs
function setupURLDragDrop(type, containerId, getEntityIdFn) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.addEventListener('dragover', (e) => {
    const types = Array.from(e.dataTransfer.types || []);
    if (types.includes('text/uri-list') || types.includes('text/plain')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      container.classList.add('url-drop-target');
    }
  });

  container.addEventListener('dragleave', (e) => {
    if (!container.contains(e.relatedTarget)) {
      container.classList.remove('url-drop-target');
    }
  });

  container.addEventListener('drop', async (e) => {
    e.preventDefault();
    container.classList.remove('url-drop-target');

    const types = Array.from(e.dataTransfer.types || []);
    let url = null;

    if (types.includes('text/uri-list')) {
      url = e.dataTransfer.getData('text/uri-list').trim();
    } else if (types.includes('text/plain')) {
      const text = e.dataTransfer.getData('text/plain').trim();
      // Check if it looks like a URL
      if (text.startsWith('http://') || text.startsWith('https://')) {
        url = text;
      }
    }

    if (url) {
      const entityId = getEntityIdFn();
      const listContainerId = type === 'to-do' ? 'toDoLinksList' : type === 'idea' ? 'ideaLinksList' : 'priorityLinksList';
      await addLinkToEntity(type, entityId, url, null, listContainerId);
    }
  });
}

// Functions are globally available when loaded as a regular script
// export { renderLinksList, loadLinksForEntity, addLinkToEntity, setupURLDragDrop };
