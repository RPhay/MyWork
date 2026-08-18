/**
 * DraggableModal - A reusable draggable modal component
 * Features: movable, maximizable (double-click), closeable with escape
 */
class DraggableModal {
  constructor(options = {}) {
    this.options = {
      title: options.title || 'Modal',
      width: options.width || 600,
      height: options.height || 400,
      content: options.content || '',
      onClose: options.onClose || null,
      ...options
    };

    this.modal = null;
    this.overlay = null;
    this.isMaximized = false;
    this.savedPosition = null;
    this.savedSize = null;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };

    this.create();
  }

  create() {
    // Create overlay
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay';

    // Create modal
    this.modal = document.createElement('div');
    this.modal.className = 'draggable-modal';
    this.modal.style.width = this.options.width + 'px';
    this.modal.style.height = this.options.height + 'px';

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header-bar';
    header.innerHTML = `
      <h3>${this.options.title}</h3>
      <div class="modal-header-actions">
        <button class="modal-maximize-btn" title="Maximize (double-click to toggle)">
          <i class="bi bi-square"></i>
        </button>
        <button class="modal-close-btn" title="Close (or press Escape)">
          <i class="bi bi-x"></i>
        </button>
      </div>
    `;

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    if (typeof this.options.content === 'string') {
      body.innerHTML = this.options.content;
    } else {
      body.appendChild(this.options.content);
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    if (this.options.footer) {
      if (typeof this.options.footer === 'string') {
        footer.innerHTML = this.options.footer;
      } else {
        footer.appendChild(this.options.footer);
      }
    }

    this.modal.appendChild(header);
    this.modal.appendChild(body);
    if (this.options.footer) {
      this.modal.appendChild(footer);
    }

    // Setup event handlers
    this.setupEventHandlers(header);
  }

  setupEventHandlers(header) {
    // Close button
    this.modal.querySelector('.modal-close-btn').addEventListener('click', () => this.close());

    // Maximize button
    const maximizeBtn = this.modal.querySelector('.modal-maximize-btn');
    maximizeBtn.addEventListener('click', () => this.toggleMaximize());

    // Double-click header to maximize
    header.addEventListener('dblclick', (e) => {
      if (e.target.closest('.modal-header-actions')) return;
      this.toggleMaximize();
    });

    // Dragging
    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.modal-header-actions')) return;
      this.startDrag(e);
    });

    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('mouseup', () => this.stopDrag());

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });

    // Click overlay to close (optional)
    this.overlay.addEventListener('click', () => this.close());

    // Prevent overlay click from closing if clicking modal
    this.modal.addEventListener('click', (e) => e.stopPropagation());
  }

  startDrag(e) {
    if (this.isMaximized) return;
    this.isDragging = true;
    this.dragOffset.x = e.clientX - this.modal.offsetLeft;
    this.dragOffset.y = e.clientY - this.modal.offsetTop;
    this.modal.classList.add('dragging');
  }

  drag(e) {
    if (!this.isDragging || this.isMaximized) return;
    e.preventDefault();

    const x = e.clientX - this.dragOffset.x;
    const y = e.clientY - this.dragOffset.y;

    this.modal.style.transform = `translate(${x}px, ${y}px)`;
  }

  stopDrag() {
    this.isDragging = false;
    this.modal.classList.remove('dragging');
  }

  toggleMaximize() {
    if (this.isMaximized) {
      this.restore();
    } else {
      this.maximize();
    }
  }

  maximize() {
    if (this.isMaximized) return;
    this.isMaximized = true;
    this.modal.classList.add('maximized');
    this.modal.style.transform = 'none';
    this.modal.style.width = '100%';
    this.modal.style.height = '100%';
    this.modal.querySelector('.modal-maximize-btn').innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
  }

  restore() {
    if (!this.isMaximized) return;
    this.isMaximized = false;
    this.modal.classList.remove('maximized');
    this.modal.style.width = this.options.width + 'px';
    this.modal.style.height = this.options.height + 'px';
    this.modal.style.transform = `translate(-50%, -50%)`;
    this.modal.querySelector('.modal-maximize-btn').innerHTML = '<i class="bi bi-square"></i>';
  }

  open() {
    document.body.appendChild(this.overlay);
    document.body.appendChild(this.modal);
    document.body.style.overflow = 'hidden';
  }

  close() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    if (this.modal && this.modal.parentNode) {
      this.modal.parentNode.removeChild(this.modal);
    }
    document.body.style.overflow = '';
    if (this.options.onClose) {
      this.options.onClose();
    }
  }

  isOpen() {
    return this.modal && this.modal.parentNode;
  }

  getModal() {
    return this.modal;
  }

  setTitle(title) {
    const titleEl = this.modal.querySelector('.modal-header-bar h3');
    if (titleEl) {
      titleEl.textContent = title;
    }
  }

  setContent(content) {
    const bodyEl = this.modal.querySelector('.modal-body');
    if (bodyEl) {
      if (typeof content === 'string') {
        bodyEl.innerHTML = content;
      } else {
        bodyEl.innerHTML = '';
        bodyEl.appendChild(content);
      }
    }
  }
}
