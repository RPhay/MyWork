import './CompactStrip.css';

export default function CompactStrip({ currentItem, warnings, onExpand }) {
  const getPriorityColor = (priority) => {
    const colors = {
      'critical': '#ff0000',
      'high': '#ff6600',
      'medium': '#ffaa00',
      'low': '#00aa00',
    };
    return colors[priority?.toLowerCase()] || '#666';
  };

  const getWarningIcon = () => {
    if (!warnings || warnings.length === 0) return null;

    const urgent = warnings.some(w => w.type === 'overdue' || w.type === 'urgent');
    return urgent ? '⚠️' : 'ℹ️';
  };

  return (
    <div className="compact-strip" onClick={onExpand}>
      <div className="strip-content">
        <div className="current-section">
          {currentItem && (
            <>
              <span
                className="priority-dot"
                style={{ backgroundColor: getPriorityColor(currentItem.priority) }}
              />
              <span className="current-label">Currently:</span>
              <span className="current-item">{currentItem.title}</span>
            </>
          )}
        </div>

        <div className="warnings-section">
          {getWarningIcon() && (
            <>
              <span className="warning-icon">{getWarningIcon()}</span>
              {warnings.map((w, i) => (
                <span key={i} className={`warning ${w.type}`}>
                  {w.label}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="expand-hint">⬇</div>
    </div>
  );
}
