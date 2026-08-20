import { useState, useEffect } from 'react';
import { useWorkItems } from './hooks/useWorkItems';
import CompactStrip from './components/CompactStrip';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { items, currentItem, warnings, reorderItems, updateStatus } = useWorkItems();

  return (
    <div className="app">
      {isExpanded ? (
        <Dashboard
          items={items}
          currentItem={currentItem}
          onClose={() => setIsExpanded(false)}
          onReorder={reorderItems}
          onStatusChange={updateStatus}
        />
      ) : (
        <CompactStrip
          currentItem={currentItem}
          warnings={warnings}
          onExpand={() => setIsExpanded(true)}
        />
      )}
    </div>
  );
}

export default App;
