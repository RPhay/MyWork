// Loading Manager - shows a modal during initial page load, hides when complete
window.loadingManager = {
  activeLoads: 0,
  modal: null,
  initialized: false,

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // Show the loading modal immediately on page load
    this.show();
  },

  show() {
    const loadingModalEl = document.getElementById('loadingModal');
    if (!loadingModalEl) return;

    if (!this.modal) {
      this.modal = new bootstrap.Modal(loadingModalEl, {
        backdrop: 'static',
        keyboard: false
      });
    }

    if (!loadingModalEl.classList.contains('show')) {
      this.modal.show();
    }
  },

  hide() {
    const loadingModalEl = document.getElementById('loadingModal');
    if (!loadingModalEl || !this.modal) return;

    if (loadingModalEl.classList.contains('show')) {
      this.modal.hide();
    }
  },

  startLoad() {
    this.activeLoads++;
  },

  endLoad() {
    this.activeLoads = Math.max(0, this.activeLoads - 1);
    if (this.activeLoads === 0) {
      this.hide();
    }
  },

  withLoader(asyncFn) {
    this.startLoad();
    return Promise.resolve(asyncFn()).finally(() => this.endLoad());
  }
};

// Initialize on DOMContentLoaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.loadingManager.init();
  });
} else {
  window.loadingManager.init();
}
