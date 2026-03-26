# Koda — Offline Music Player

A clean, minimal offline music player for Windows. Built with Electron.

---

## Features

- 🎵 **Folder scanning** — point to your music folder, Koda loads everything automatically
- 🎨 **Dynamic theming** — UI accent colors shift to match the current song's album art
- 📂 **Library views** — Songs, Albums, Artists, Genres (each toggleable in Settings)
- 🔀 **Shuffle & Repeat** — repeat off / all / one
- 📋 **Queue management** — see and navigate your play queue
- 🔍 **Search** — filter across title, artist, album, genre
- ⌨️ **Keyboard shortcuts** — Space (play/pause), ←/→ (seek 5s), Ctrl+←/→ (prev/next)
- 💾 **Remembers your settings** — folder, volume, shuffle state persist between sessions

## Supported formats

MP3, FLAC, WAV, AAC, OGG, M4A, WMA, OPUS, AIFF

---

## Setup & Running

### Prerequisites
- [Node.js](https://nodejs.org/) v18 or later
- npm (comes with Node.js)

### Install & Run

```bash
# 1. Install dependencies
npm install

# 2. Run in development
npm start
```

### Build a Windows .exe installer

```bash
# Build installer (produces dist/Koda Setup.exe)
npm run build

# Or build without installer (faster, just the folder)
npm run build:dir
```

The built app will be in the `dist/` folder.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Play / Pause |
| `←` / `→` | Seek back/forward 5 seconds |
| `Ctrl + ←` | Previous track |
| `Ctrl + →` | Next track |
| `↑` / `↓` | Volume up/down |

---

## Project Structure

```
koda/
├── src/
│   ├── main.js       # Electron main process
│   ├── preload.js    # Secure IPC bridge
│   ├── index.html    # App shell
│   ├── styles.css    # All styles
│   └── app.js        # All player logic
├── assets/           # App icons (add icon.ico / icon.png here)
├── package.json
└── README.md
```

---

## Adding an App Icon

Place your icon files in the `assets/` folder:
- `assets/icon.ico` — for the Windows .exe and taskbar
- `assets/icon.png` — for the window (512×512 recommended)

If no icon is provided, Electron will use its default icon.

---

## Notes

- Koda reads metadata (title, artist, album, art) directly from your audio files' embedded ID3/tags using `music-metadata`.
- Settings are saved to your system's app data folder automatically.
- No internet connection required after initial setup (fonts load from Google Fonts on first launch — to make fully offline, download and bundle the fonts manually).
