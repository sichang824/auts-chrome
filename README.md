# Auts – Chrome Extension

This package contains the Chrome extension for Auts. It is built with Vite, React, and TypeScript, and provides the popup, options page, and background service worker used by the application.

### Features

- Popup and Options pages powered by React
- Background service worker for extension logic and storage
- Shared utility library and shadcn/ui components
- Production build outputs an unpacked extension folder

### Prerequisites

- Node.js 20+ and npm
- Google Chrome or Chromium

### Install

```bash
npm install
```

### Standard Development Flow

1. Start a watch build (rebuilds on file changes):

```bash
npm run build -- --watch
```

2. Load the unpacked extension in Chrome:

- Open `chrome://extensions`
- Enable "Developer mode"
- Click "Load unpacked" and select the folder `../dist/extension` (built at repository root)

3. Edit source files under `src/` and refresh the extension from `chrome://extensions` as needed.

### One-off Build

```bash
npm run build
```

Artifacts are written to `../dist/extension/` (repository root).

### Preview (Standalone UI Preview)

Some pages can be previewed with Vite’s preview server:

```bash
npm run preview
```

### Scripts

- `npm run build`: Production build of the extension
- `npm run preview`: Preview the build in a local server (for applicable pages)

### Directory Structure

```
Auts/
  src/
    extension/
      service_worker.ts      # Background service worker
      popup.ts               # Popup entry
      options.ts             # Options page entry
      script_storage.ts      # Storage utilities
      subscription_storage.ts
      visual_indicator.ts
      bridge.ts
    options/
      main.tsx               # Options UI bootstrap
      pages/                 # Options pages
      components/            # Options components
    popup/
      main.tsx               # Popup UI bootstrap
      components/            # Popup components
    lib/                     # Shared utils/types
    components/ui/           # Shadcn UI components
  public/                    # Static assets for extension build
  index.html / popup.html / options.html
```

### Linting & Testing

- ESLint config: `eslint.config.js`
- Testing is not yet configured; integrate your preferred framework (e.g., Vitest) as needed.

### Notes

- The build output is consumed by other parts of the project (e.g., Docker images under `browser/`).
- Source code and comments are in English; user-facing docs may be localized.
