const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('palDesktop', {
  loadState: () => ipcRenderer.sendSync('pal-journal:load-state'),
  saveState: (json) => ipcRenderer.sendSync('pal-journal:save-state', json),
  saveBackup: (json) => ipcRenderer.sendSync('pal-journal:save-backup', json),
});
