// Resizable split pane utility
class SplitPane {
  constructor(containerId, leftPaneId, dividerId, rightPaneId, initialLeftPercent = 66.66) {
    this.container = document.getElementById(containerId);
    this.leftPane = document.getElementById(leftPaneId);
    this.divider = document.getElementById(dividerId);
    this.rightPane = document.getElementById(rightPaneId);
    this.initialLeftPercent = initialLeftPercent;
    this.isDragging = false;

    if (!this.container || !this.leftPane || !this.divider || !this.rightPane) {
      console.error('[SplitPane] Missing required elements');
      return;
    }

    this.init();
  }

  init() {
    // Restore saved width from localStorage
    const savedWidth = localStorage.getItem(`splitPane-${this.container.id}-left`);
    if (savedWidth) {
      this.setLeftWidth(parseFloat(savedWidth));
    } else {
      this.setLeftWidth(this.initialLeftPercent);
    }

    this.divider.addEventListener('mousedown', (e) => this.startDrag(e));
    document.addEventListener('mousemove', (e) => this.drag(e));
    document.addEventListener('mouseup', () => this.stopDrag());
  }

  startDrag(e) {
    this.isDragging = true;
    this.startX = e.clientX;
    this.startLeftWidth = this.leftPane.offsetWidth;
    this.containerWidth = this.container.offsetWidth;
    this.divider.classList.add('dragging');
  }

  drag(e) {
    if (!this.isDragging) return;

    const diff = e.clientX - this.startX;
    const newLeftWidth = this.startLeftWidth + diff;
    const percent = (newLeftWidth / this.containerWidth) * 100;

    // Constrain between 30% and 80%
    if (percent >= 30 && percent <= 80) {
      this.setLeftWidth(percent);
    }
  }

  stopDrag() {
    if (this.isDragging) {
      this.isDragging = false;
      this.divider.classList.remove('dragging');

      // Save width to localStorage
      const percent = (this.leftPane.offsetWidth / this.container.offsetWidth) * 100;
      localStorage.setItem(`splitPane-${this.container.id}-left`, percent.toString());
    }
  }

  setLeftWidth(percent) {
    const rightPercent = 100 - percent;
    this.leftPane.style.flex = `0 0 ${percent}%`;
    // Only set flex on right pane if it's not hidden
    if (!this.rightPane.classList.contains('hidden')) {
      this.rightPane.style.flex = `0 0 ${rightPercent}%`;
    }
  }

  showRightPane(savedPercent = 33.34) {
    this.rightPane.classList.remove('hidden');
    const totalPercent = 100;
    const leftPercent = totalPercent - savedPercent;
    this.setLeftWidth(leftPercent);
  }

  hideRightPane() {
    this.rightPane.classList.add('hidden');
    this.rightPane.style.flex = '0 0 0%';
    this.leftPane.style.flex = '0 0 100%';
  }
}
