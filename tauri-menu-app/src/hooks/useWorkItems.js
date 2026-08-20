import { useState, useEffect, useCallback } from 'react';

const API_URL = 'http://localhost:3000/api';
const WS_URL = 'ws://localhost:3000';

export function useWorkItems() {
  const [items, setItems] = useState([]);
  const [currentItem, setCurrentItem] = useState(null);
  const [warnings, setWarnings] = useState([]);

  // Format date as YYYY-MM-DD
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Fetch today's work items
  const fetchWorkItems = useCallback(async () => {
    try {
      const date = getTodayDate();
      const response = await fetch(`${API_URL}/work/date/${date}`);
      const json = await response.json();

      if (json.success && json.data) {
        const sorted = json.data.sort((a, b) => {
          const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
          const aP = priorityOrder[a.priority?.toLowerCase()] ?? 999;
          const bP = priorityOrder[b.priority?.toLowerCase()] ?? 999;
          return aP - bP;
        });

        setItems(sorted);

        // Set current item (first one or one marked as current)
        const current = sorted.find(i => i.status === 'in-progress') || sorted[0];
        setCurrentItem(current);

        // Generate warnings
        const warns = [];
        sorted.forEach(item => {
          if (item.status === 'overdue') {
            warns.push({ type: 'overdue', label: '1 Overdue item' });
          }
          if (item.is_urgent) {
            warns.push({ type: 'urgent', label: '1 Urgent item' });
          }
        });
        setWarnings(warns);
      }
    } catch (error) {
      console.error('Error fetching work items:', error);
    }
  }, []);

  // Fetch items on mount
  useEffect(() => {
    fetchWorkItems();

    // Poll every 30 seconds if WebSocket not available
    const interval = setInterval(fetchWorkItems, 30000);
    return () => clearInterval(interval);
  }, [fetchWorkItems]);

  // Connect to WebSocket for real-time updates
  useEffect(() => {
    let ws;
    try {
      ws = new WebSocket(`${WS_URL}`);

      ws.onopen = () => {
        console.log('WebSocket connected');
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'work-items-updated') {
          fetchWorkItems();
        }
      };

      ws.onerror = (error) => {
        console.log('WebSocket error, falling back to polling:', error);
      };

      return () => {
        if (ws) ws.close();
      };
    } catch (error) {
      console.log('WebSocket unavailable, using polling');
    }
  }, [fetchWorkItems]);

  const reorderItems = useCallback(async (orderedIds) => {
    try {
      const date = getTodayDate();
      const response = await fetch(`${API_URL}/work/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, orderedIds }),
      });

      const json = await response.json();
      if (json.success) {
        setItems(json.data);
      }
    } catch (error) {
      console.error('Error reordering items:', error);
    }
  }, []);

  const updateStatus = useCallback(async (itemId, status) => {
    try {
      const response = await fetch(`${API_URL}/work/${itemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      const json = await response.json();
      if (json.success) {
        fetchWorkItems();
      }
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }, [fetchWorkItems]);

  return {
    items,
    currentItem,
    warnings,
    reorderItems,
    updateStatus,
  };
}
