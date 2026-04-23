# FileHub Server

**Instant file search & preview server — one command to deploy, works everywhere**

A cross-platform file search and preview server built with Node.js and React. Provides a web-based UI for instant file search, preview, and access — accessible from any browser on your local network.

## Why FileHub?

**Stop wasting time searching for files**

- 🔍 **Instant results** — Search 100,000+ files in milliseconds
- 👀 **Preview everything** — PDF, images, video, Office docs, code — no downloading needed
- 🌐 **Access from anywhere** — Phone, tablet, PC on the same Wi-Fi
- 🔒 **100% private** — Your files never leave your network
- 🚀 **One command deploy** — Works on NAS, Raspberry Pi, any server

## Quick Start

### Docker (Recommended)

```bash
docker run -d -p 6543:6543 -v /your/data:/data exiahuang/filehub-server:latest
```

Open `http://localhost:6543` in your browser. **That's it!**

### npm

```bash
npm install -g @exiahuang/filehub
filehub-server
```

### From Source

```bash
git clone https://github.com/filehub1/filehub-server.git
cd filehub-server
npm install
npm run build
npm start
```

## Features

| Feature | Description |
|---------|-------------|
| **Instant Search** | String, Fuzzy, and Regex modes — results in <10ms |
| **File Preview** | PDF, images, video, audio, Office docs, Markdown, code |
| **LAN Access** | Access from any device on the same network |
| **QR Code** | Scan to open on mobile instantly |
| **Dark/Light Theme** | Comfortable in any lighting |
| **REST API** | Integrate with other tools |

## Supported Previews

- **Documents**: PDF, Word (.doc/.docx), Excel (.xlsx), PowerPoint (.pptx)
- **Images**: PNG, JPG, GIF, WebP, SVG
- **Video**: MP4, AVI, MKV (browser playback)
- **Audio**: MP3, WAV, FLAC
- **Code**: 100+ languages with syntax highlighting
- **Text**: Markdown, JSON, XML, CSV, TXT

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

### CLI Overrides

```bash
node dist/main/web-server.cjs --dir=/path/to/files
node dist/main/web-server.cjs --service-address=0.0.0.0:8080
```

## Usage

1. Open `http://localhost:6543` in your browser
2. Press `/` to focus the search box
3. Type to search — results appear instantly
4. Press `Enter` to open a file
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

## REST API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search?query=&searchType=string` | GET | Search files |
| `/api/config` | GET/POST | Get/update config |
| `/api/rebuild` | POST | Rebuild index |
| `/api/preview?path=` | GET | Get file preview |
| `/api/status` | GET | Index status |

## Requirements

- Node.js 18+
- npm 9+

## Download

[![Docker](https://img.shields.io/docker/pulls/exiahuang/filehub-server?style=flat-square)](https://hub.docker.com/r/exiahuang/filehub-server)
[![npm](https://img.shields.io/npm/v/@exiahuang/filehub?style=flat-square)](https://www.npmjs.com/package/@exiahuang/filehub)
[![GitHub](https://img.shields.io/github/v/release/filehub1/filehub-server?include_prereleases&style=flat-square)](https://github.com/filehub1/filehub-server/releases)

## Related Projects

- [Windows App](https://github.com/filehub1/filehub-windows-app) — Native desktop app
- [Android App](https://github.com/filehub1/android) — File manager with built-in server
- [Website](https://filehub1.github.io) — Product overview

## License

MIT