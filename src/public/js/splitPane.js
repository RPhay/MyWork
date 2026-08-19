// Resizable split pane utility
class SplitPane {
  constructor(containerId, leftPaneId, dividerId, rightPaneId, initialLeftPercent = 66.66) {
    console.log(`[SplitPane] Creating with containerID=${containerId}`);
    this.container = document.getElementById(containerId);
    this.leftPane = document.getElementById(leftPaneId);
    this.divider = document.getElementById(dividerId);
    this.rightPane = document.getElementById(rightPaneId);
    this.initialLeftPercent = initialLeftPercent;
    this.isDragging = false;

    console.log(`[SplitPane] Found elements: container=${!!this.container}, leftPane=${!!this.leftPane}, divider=${!!this.divider}, rightPane=${!!this.rightPane}`);

    if (!this.container || !this.leftPane || !this.divider || !this.rightPane) {
      console.error('[SplitPane] Missing required elements');
      return;
    }

    console.log(`[SplitPane] Calling init()`);
    this.init();
    console.log(`[SplitPane] Init complete`);
  }

  init() {
    // Ensure right pane is hidden on init
    this.hideRightPane();

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
    // If right pane is hidden, expand left pane to full width
    if (this.rightPane.classList.contains('hidden')) {
      this.leftPane.style.flex = '0 0 100%';
      this.rightPane.style.flex = '0 0 0%';
    } else {
      this.leftPane.style.flex = `0 0 ${percent}%`;
      this.rightPane.style.flex = `0 0 ${rightPercent}%`;
    }
  }

  showRightPane(savedPercent = 33.34) {
    console.log(`[SplitPane] showRightPane called, rightPane exists: ${!!this.rightPane}`);
    if (this.rightPane) {
      this.rightPane.classList.remove('hidden');
      console.log(`[SplitPane] Removed hidden class, has hidden now: ${this.rightPane.classList.contains('hidden')}`);
    }
    this.divider.style.display = 'block';
    const leftPercent = 100 - savedPercent;
    this.setLeftWidth(leftPercent);
    console.log(`[SplitPane] showRightPane complete`);
  }

  hideRightPane() {
    this.rightPane.classList.add('hidden');
    this.divider.style.display = 'none';
    // Re-apply the widths. setLeftWidth() has a branch that gives the left pane
    // the full container once the right one is hidden, but nothing called it
    // here - so closing an editor left the list at the ~66% it had while the
    // editor was open, with the editor's third of the tab as dead space.
    // showRightPane() has always called this; hideRightPane() never did.
    this.setLeftWidth(this.currentLeftPercent());
  }

  // The width the left pane should return to when the right pane comes back.
  currentLeftPercent() {
    const saved = localStorage.getItem(`splitPane-${this.container.id}-left`);
    return saved ? parseFloat(saved) : this.initialLeftPercent;
  }
}
