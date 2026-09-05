const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  resizeWindow: (width, height) => ipcRenderer.send('resize-window', width, height),
  hideWindow: () => ipcRenderer.send('hide-window'),
  showWindow: () => ipcRenderer.send('show-window'),
  togglePin: (isPinned) => ipcRenderer.send('toggle-pin', isPinned),
  triggerPaste: (text) => ipcRenderer.send('trigger-paste', text),
  
  // Listeners from main process
  onToggleRecordShortcut: (callback) => {
    ipcRenderer.on('toggle-record-shortcut', () => callback());
  },
  onCheckCanHide: (callback) => {
    ipcRenderer.on('check-can-hide', () => callback());
  },
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  }
});
