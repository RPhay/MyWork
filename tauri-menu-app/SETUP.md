# Setup Instructions

## Prerequisites

Make sure you have:
- Rust installed (for Tauri): `rustc --version`
- Node.js 18+: `node --version`
- Xcode Command Line Tools (for macOS builds)

## Steps

### 1. Install Tauri CLI globally (one-time)
```bash
npm install -g @tauri-apps/cli@1.5
```

### 2. Install dependencies
```bash
npm install
```

### 3. Terminal 1 - Start MyWork dev server
From the root MyWork folder:
```bash
npm run dev
```

Wait for it to say "listening on http://localhost:3000"

### 4. Terminal 2 - Start the menu app
From the tauri-menu-app folder:
```bash
npm run tauri dev
```

This will:
- Start Vite on port 5173 (frontend dev server)
- Launch Tauri and compile the Rust backend
- Open the menu bar app on macOS

### Troubleshooting

**"Tauri CLI not found"**
- Run: `npm install -g @tauri-apps/cli@1.5`
- Or use: `npx tauri dev` instead of `npm run tauri dev`

**"Cannot find module '@tauri-apps/api'"**
- Run: `npm install`
- Make sure you're in the tauri-menu-app folder

**"Connection refused to localhost:3000"**
- Make sure MyWork dev server is running in another terminal
- Check it's on port 3000: `curl http://localhost:3000/health`

**"Window doesn't appear"**
- Check console for errors
- Make sure you're on macOS (this is a macOS-specific app)
- Try `npm run tauri dev` again

## What to expect

1. Tauri will compile (takes 1-2 minutes first time)
2. A small panel appears at the top-center of your screen
3. Shows "Currently: [your first work item]"
4. Click it to expand and see the full dashboard
5. Drag items to reorder
6. Click status buttons to cycle through states

## Testing without full setup

If you just want to test the React UI:
```bash
npm run dev:vite
```

Then visit `http://localhost:5173` in your browser.
