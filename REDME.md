# Link Manager

A small, modern, client-side **Link Manager** web application built with plain HTML, CSS, and JavaScript. It lets you save URLs, automatically fetches basic metadata, and stores everything in `localStorage` so your links persist across refreshes.

## Features

- **Add links**: Paste any URL and save it.
- **Automatic metadata**:
  - Website title
  - Description (meta description when available)
  - Favicon / logo (with a fallback)
  - Domain name
  - Time and date when the link was added
- **Link cards**:
  - Small logo
  - Title
  - Short description
  - Domain
  - Timestamp
  - Clickable link
- **Manage links**:
  - Search (title, URL, description, domain)
  - Edit title and description inline
  - Delete links
- **Persistence**:
  - All links are stored in `localStorage` and survive page refreshes.

## Project structure

- `index.html` — Main HTML page and layout.
- `styles.css` — Modern, responsive UI styling.
- `js/storage.js` — Local storage helpers and ID generation.
- `js/api.js` — Metadata fetching and URL helpers.
- `js/ui.js` — Rendering logic for link cards and inline edit controls.
- `js/main.js` — Application bootstrap and event wiring.
- `package.json` — Minimal metadata for the project (no external dependencies).

## How metadata fetching works

When you submit a URL:

1. The app normalizes it (adds `https://` if missing).
2. It calls a public metadata API (`https://jsonlink.io/api/extract?url=...`) to read the page title, description, and favicon.
3. If the API is unavailable or blocked by CORS, the app falls back to:
   - Using the URL as the title
   - An empty description
   - A favicon based on the domain via `https://www.google.com/s2/favicons?sz=64&domain=...`

Because this is a purely client-side app, metadata fetching depends on third‑party services that may have rate limits or regional restrictions.

## Running the app

No build step or server is strictly required:

1. Open `index.html` directly in your browser (double‑click or drag into a tab), **or**
2. Serve the folder via a simple static server, e.g. with Node:

   ```bash
   npx serve .
   ```

Your saved links will be kept in the browser's `localStorage` under the key `linkManager.links.v1`.

