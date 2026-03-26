const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('koda', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFolder: (folderPath) => ipcRenderer.invoke('scan-folder', folderPath),
  getMetadata: (filePath) => ipcRenderer.invoke('get-metadata', filePath),
  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  // New:
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  pickImage: () => ipcRenderer.invoke('pick-image'),
});