import { useEffect } from 'react';
import { appWindow } from '@tauri-apps/api/window';

export function useWindowControl() {
  useEffect(() => {
    const handleResize = async () => {
      try {
        // Center the window horizontally
        const position = await appWindow.outerPosition();
        const size = await appWindow.outerSize();

        // Get the monitor info - we'll use basic screen width
        const screenWidth = window.innerWidth * window.devicePixelRatio + position.x;

        // Keep window centered at top
        const centerX = (screenWidth - size.width) / 2;
        await appWindow.setPosition({ x: centerX, y: 30 });
      } catch (error) {
        console.error('Error adjusting window position:', error);
      }
    };

    handleResize();
  }, []);
}
