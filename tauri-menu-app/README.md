# MyWork Menu Bar App

A native macOS menu bar app for MyWork that displays today's work items with real-time updates.

## Features

- **Compact Strip**: Always-visible panel showing current item and warnings
- **Expandable Dashboard**: Click to see full list of today's items
- **Drag to Reorder**: Reorder items by dragging
- **Real-time Updates**: WebSocket connection for instant updates
- **Status Cycling**: Click status icons to cycle through states
- **Smart Snapping**: Window snaps to edges when dragged

## Requirements

- macOS 10.15+
- Node.js 18+
- Rust 1.60+

## Installation

```bash
cd tauri-menu-app
npm install
```

## Development

Start the dev server in the root:
```bash
npm run dev
```

Then in this folder, run the Tauri app:
```bash
npm run tauri dev
```

## Build

```bash
npm run build
```

This creates a `.dmg` file in `src-tauri/target/release/bundle/dmg/`.

## How it Works

The app connects to your MyWork API at `http://localhost:3000` and:
1. Fetches today's work items via HTTP polling
2. Attempts WebSocket connection for real-time updates
3. Displays items sorted by priority
4. Allows drag-to-reorder and status updates

## API Integration

- **Fetch items**: `GET /api/work/date/YYYY-MM-DD`
- **Reorder**: `PATCH /api/work/reorder` with `{ date, orderedIds }`
- **Update status**: `PATCH /api/work/:id/status` with `{ status }`

## WebSocket (Optional)

For real-time updates, your Node backend should emit:
```javascript
ws.send(JSON.stringify({
  type: 'work-items-updated'
}));
```

If WebSocket is unavailable, the app falls back to polling every 30 seconds.
