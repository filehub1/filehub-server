# FileHub Server

A cross-platform file search and preview server built with Node.js and React. Provides a web-based UI for instant file search, preview, and access — accessible from any browser on your local network.

## Features

- **Instant search** — String, Fuzzy, and Regex modes with sub-second results
- **File preview** — PDF, images, video, audio, Office documents (xlsx/docx), Markdown, code with syntax highlighting
- **LAN access** — Share your file index with other devices on the same network
- **QR code** — Scan to open on mobile instantly
- **Configurable indexing** — Specify directories and exclude patterns
- **Dark/Light theme**
- **REST API** — All features accessible via HTTP API

## Requirements

- Node.js 18+
- npm 9+

## Installation

### Option 1: Docker (Recommended)

```bash
# Pull and run the latest version
docker pull exiahuang/filehub-server:latest
docker run -d -p 6543:6543 -v /your/data:/data exiahuang/filehub-server:latest
```

Then open `http://localhost:6543` in your browser.

### Option 2: From Source

```bash
git clone https://github.com/filehub1/filehub-server.git
cd filehub/server
npm install
npm run build
```

## Running

```bash
# Start the server (default port 6543)
npm start

# Development mode with hot reload
npm run dev

# Web-only mode (no Electron)
npm run dev:web
```

## Configuration

Create `~/.filehub` (YAML):

```yaml
indexedDirectories:
  - /home/user/Documents
  - /home/user/Projects
serviceAddress: 0.0.0.0:6543
excludePatterns:
  - node_modules
  - .git
  - dist
  - "*.log"
```

### Configuration Keys

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `indexedDirectories` | `string[]` | `[]` | Directories to index |
| `serviceAddress` | `string` | `0.0.0.0:6543` | Server listen address |
| `uiAddress` | `string` | `0.0.0.0:6544` | Dev UI server address |
| `excludePatterns` | `string[]` | `[]` | File/directory patterns to skip |
| `useAdminMode` | `boolean` | `false` | Enable admin mode |

### Command-line Overrides

```bash
node dist/main/web-server.cjs --dir=/home/user/Documents
node dist/main/web-server.cjs --service-address=0.0.0.0:8080
```

## Usage

1. Open `http://localhost:6543` in your browser
2. Press `/` to focus the search box
3. Type to search — results appear instantly
4. Press `Enter` or `l` to open a file
5. Press `o` to toggle preview panel
6. Press `\` to switch search mode (String / Fuzzy / Regex)

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search |
| `j` / `↓` | Move down |
| `k` / `↑` | Move up |
| `Enter` / `l` | Open file |
| `o` | Toggle preview |
| `O` | Open in explorer |
| `\` | Toggle search type |
| `r` | Rebuild index |
| `s` | Settings |
| `?` | Help |

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search?query=&searchType=string` | GET | Search files |
| `/api/config` | GET | Get current config |
| `/api/config` | POST | Update config |
| `/api/rebuild` | POST | Rebuild index |
| `/api/preview?path=` | GET | Get file preview |
| `/api/status` | GET | Index status |

## Building Native Addon (Windows only)

For faster indexing via Windows MFT/USN Journal:

```bash
cd src/addon
node-gyp configure
node-gyp build
```

## License

MIT
