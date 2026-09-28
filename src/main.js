const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 1100,
    minHeight: 720,
    frame: false,
    transparent: false,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    icon: path.join(__dirname, '../public/assets/logos/koda-512x512.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ——— IPC Handlers ———

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose your music folder'
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('scan-folder', async (event, folderPath) => {
  const AUDIO_EXTS = ['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.wma', '.opus', '.aiff'];
  const files = [];

  function walk(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (AUDIO_EXTS.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (e) {
      // skip inaccessible dirs
    }
  }

  walk(folderPath);
  return files;
});

ipcMain.handle('get-metadata', async (event, filePath) => {
  try {
    const mm = require('music-metadata');
    const meta = await mm.parseFile(filePath, { skipCovers: false });
    const tags = meta.common;

    let artDataUrl = null;
    if (tags.picture && tags.picture.length > 0) {
      const pic = tags.picture[0];
      const b64 = Buffer.from(pic.data).toString('base64');
      artDataUrl = `data:${pic.format};base64,${b64}`;
    }

    return {
      title: tags.title || path.basename(filePath, path.extname(filePath)),
      artist: tags.artist || tags.albumartist || 'Unknown Artist',
      album: tags.album || 'Unknown Album',
      genre: (tags.genre && tags.genre[0]) || 'Unknown Genre',
      year: tags.year || null,
      trackNumber: tags.track?.no || null,
      duration: meta.format.duration || 0,
      art: artDataUrl,
      path: filePath
    };
  } catch (e) {
    const { basename, extname } = require('path');
    return {
      title: basename(filePath, extname(filePath)),
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      genre: 'Unknown Genre',
      year: null,
      trackNumber: null,
      duration: 0,
      art: null,
      path: filePath
    };
  }
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
});

ipcMain.handle('pick-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const data = fs.readFileSync(filePath);
  const base64 = data.toString('base64');
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return `data:image/${ext};base64,${base64}`;
});

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('window-close', () => mainWindow?.close());

const settingsPath = path.join(app.getPath('userData'), 'koda-settings.json');

ipcMain.handle('load-settings', () => {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      if (!data.playlists) data.playlists = [];
      if (!data.favourites) data.favourites = [];
      return data;
    }
  } catch (e) {}
  return { playlists: [], favourites: [] };
});

ipcMain.handle('save-settings', (event, settings) => {
  try {
    const existing = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, 'utf8')) : {};
    const merged = { ...existing, ...settings };
    fs.writeFileSync(settingsPath, JSON.stringify(merged, null, 2));
    return true;
  } catch (e) {
    return false;
  }
});