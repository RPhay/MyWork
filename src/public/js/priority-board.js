// The priorities board.
//
// A column holds rows of ANY type, dragged in from a typed tab or from Dailies.
// What lands here is a reference to the original record - never a copy - so the
// board is a view onto rows that still belong to their own pages. Everything
// this module can write is therefore deliberately narrow: which column a row is
// in, what order it is in, and whether it is on the board at all. Titles,
// fields and status are edited where the row lives.
//
// The bay is NOT the record's status. See priorityBoardService.js for why: the
// types do not share a status vocabulary, so a bay cannot be one.

const BOARD_BAYS = ['Not Started', 'In Progress', 'Complete'];

let boardItems = [];

// A row on a typed page publishes its type under one of these names when a drag
// starts (genericEntity.js sets `type` and `id` on the dataTransfer). Dailies
// publishes the same shape, which is what makes one drop handler enough.
const ACCEPTS_DROP = (type) => typeof type === 'string' && type.length > 0 && type !== 'priority-strip';

function bayOf(item) {
  return BOARD_BAYS.includes(item.bay) ? item.bay : BOARD_BAYS[0];
}

function itemsInBay(bay) {
  return boardItems.filter(i => bayOf(i) === bay);
}

function renderCard(item) {
  // The type is named on every card. On a mixed board "Renew the certificate"
  // means something different as a Ticket than as an Idea, and the icon alone
  // does not say which.
  return `
    <div class="board-card" data-entity-id="${item.id}" data-type-slug="${app.escapeHtml(item.typeSlug)}" draggable="true">
      <span class="board-card-icon">${item.icon || ''}</span>
      <span class="board-card-body">
        <span class="board-card-title">${app.escapeHtml(item.title)}</span>
        <span class="board-card-meta">
          <span class="board-card-type">${app.escapeHtml(item.typeLabel)}</span>
          ${item.status ? `<span class="board-card-status">${app.escapeHtml(item.status)}</span>` : ''}
        </span>
      </span>
      <button class="btn btn-sm btn-link board-card-remove" data-action="remove"
              data-entity-id="${item.id}" title="Take off the board" aria-label="Take off the board">
        <i class="bi bi-x-lg"></i>
      </button>
    </div>
  `;
}

function renderBoard() {
  BOARD_BAYS.forEach(bay => {
    const el = document.getElementById(`bay-${bay}`);
    if (!el) return;
    const items = itemsInBay(bay);
    el.innerHTML = items.length
      ? items.map(renderCard).join('')
      : '<p class="text-center text-muted small board-empty">Drop anything here</p>';
  });
}

async function loadBoard() {
  try {
    boardItems = (await app.fetchData('/api/priority-board')) || [];
    renderBoard();
  } catch (error) {
    console.error('Error loading the priorities board:', error);
    BOARD_BAYS.forEach(bay => {
      const el = document.getElementById(`bay-${bay}`);
      if (el) el.innerHTML = '<p class="text-center text-danger small">Error loading</p>';
    });
  }
}

const post = (url, method, body) => app.fetchData(url, {
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

/**
 * Splice `movedId` into the board at `targetId`, then persist the whole board's
 * order in one call. The ranking is global across columns, so a row keeps its
 * place relative to everything else when it moves between them.
 */
function orderWith(movedId, bay, targetId, position) {
  const ids = boardItems.map(i => String(i.id)).filter(id => id !== String(movedId));
  if (targetId) {
    const at = ids.indexOf(String(targetId));
    if (at !== -1) {
      ids.splice(position === 'before' ? at : at + 1, 0, String(movedId));
      return ids;
    }
  }
  // Dropped on empty space in a column: sit after whatever is already there.
  const last = itemsInBay(bay).map(i => String(i.id)).filter(id => id !== String(movedId)).pop();
  const at = last ? ids.indexOf(last) : -1;
  ids.splice(at === -1 ? ids.length : at + 1, 0, String(movedId));
  return ids;
}

async function placeAndOrder(entityId, bay, targetId, position) {
  try {
    const known = boardItems.some(i => String(i.id) === String(entityId));
    if (!known) {
      // New to the board: place it first so the reorder has something to rank.
      boardItems = await post('/api/priority-board/items', 'POST', { entityId, bay });
    }
    boardItems = await post('/api/priority-board/reorder', 'PATCH', {
      orderedIds: orderWith(entityId, bay, targetId, position), movedId: entityId, bay,
    });
    renderBoard();
    if (!known) app.notify('Added to priorities', 'success');
  } catch (error) {
    console.error('Error updating the board:', error);
    app.notify(error.message || 'Could not update the board', 'danger');
    loadBoard();
  }
}

async function removeFromBoard(entityId) {
  try {
    boardItems = await post(`/api/priority-board/items/${entityId}`, 'DELETE');
    renderBoard();
    app.notify('Taken off the board', 'success');
  } catch (error) {
    console.error('Error removing from the board:', error);
    app.notify(error.message || 'Could not remove that', 'danger');
  }
}

function clearDropTargets() {
  document.querySelectorAll('.bay-drop-target').forEach(el => el.classList.remove('bay-drop-target'));
  clearDropIndicators();          // dragDropUtils.js - one implementation
}

let cardMenuEl = null;

function closeCardMenu() { cardMenuEl?.remove(); cardMenuEl = null; }

function openCardMenu(x, y, entityId) {
  closeCardMenu();
  cardMenuEl = document.createElement('div');
  cardMenuEl.className = 'context-menu board-context-menu';

  const pinned = window.FocusBar.has(entityId);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'context-menu-item';
  btn.innerHTML = `<span>📌</span><span>${pinned ? 'Already on the focus bar' : 'Pin to focus bar'}</span>`;
  btn.addEventListener('click', async () => {
    closeCardMenu();
    if (pinned) return;
    try {
      await window.FocusBar.add(entityId);
      app.notify('Pinned to the focus bar', 'success');
    } catch (error) {
      app.notify(error.message || 'Could not pin that', 'danger');
    }
  });
  cardMenuEl.appendChild(btn);

  document.body.appendChild(cardMenuEl);
  const rect = cardMenuEl.getBoundingClientRect();
  cardMenuEl.style.left = `${Math.min(x, window.innerWidth - rect.width - 8)}px`;
  cardMenuEl.style.top = `${Math.min(y, window.innerHeight - rect.height - 8)}px`;
}

document.addEventListener('mousedown', (e) => {
  if (!cardMenuEl || e.button === 2) return;
  if (!cardMenuEl.contains(e.target)) closeCardMenu();
});

function initBoardListeners() {
  document.querySelectorAll('.priority-bay').forEach(bay => {
    bay.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.board-card');
      if (!card) return;
      // Effect pairing is the drag protocol's job - see dragDropUtils.js.
      e.dataTransfer.effectAllowed = DRAG_EFFECT_ALLOWED;
      e.dataTransfer.setData('type', 'board-card');
      e.dataTransfer.setData('id', card.dataset.entityId);
      card.classList.add('dragging-item');
    });

    bay.addEventListener('dragend', (e) => {
      const card = e.target.closest('.board-card');
      if (card) card.classList.remove('dragging-item');
      clearDropTargets();
    });

    bay.addEventListener('dragover', (e) => {
      acceptDrop(e, 'copy');
      clearDropTargets();
      const card = e.target.closest('.board-card');
      if (card) {
        card.classList.add(app.getVerticalDropZone(e, card) === 'before'
          ? 'drop-indicator-before' : 'drop-indicator-after');
      } else {
        bay.classList.add('bay-drop-target');
      }
    });

    bay.addEventListener('dragleave', (e) => {
      if (!bay.contains(e.relatedTarget)) clearDropTargets();
    });

    bay.addEventListener('drop', (e) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('type');
      const draggedId = e.dataTransfer.getData('id');
      clearDropTargets();

      // Anything with a type and an id is welcome: a card already on the board
      // being rearranged, or a row arriving from a typed tab or Dailies.
      if (!draggedId || !(type === 'board-card' || ACCEPTS_DROP(type))) return;

      const card = e.target.closest('.board-card');
      const targetId = card && card.dataset.entityId !== draggedId ? card.dataset.entityId : null;
      const position = card ? app.getVerticalDropZone(e, card) : 'after';

      placeAndOrder(draggedId, bay.dataset.status, targetId, position);
    });

    bay.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('[data-action="remove"]');
      if (removeBtn) removeFromBoard(removeBtn.dataset.entityId);
    });

    // Right-click a card to pin it to the focus bar. The board says what
    // matters this week; the focus bar says what you are doing right now.
    bay.addEventListener('contextmenu', (e) => {
      const card = e.target.closest('.board-card');
      if (!card || !window.FocusBar) return;
      e.preventDefault();
      openCardMenu(e.clientX, e.clientY, card.dataset.entityId);
    });
  });

  // A row edited anywhere else is the same record as the card here, so the
  // board has to reflect it immediately - that is what makes these references
  // rather than copies.
  document.addEventListener('entity-saved', () => loadBoard());
}

function initPriorityBoard() {
  initBoardListeners();
  loadBoard();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPriorityBoard);
} else {
  initPriorityBoard();
}
