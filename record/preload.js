/* جسر آمن بين العملية الرئيسية والواجهة */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deck', {
  getSources:       (types)      => ipcRenderer.invoke('get-sources', types),
  saveVideo:        (buf, ext)   => ipcRenderer.invoke('save-video', buf, ext),
  saveVideoSync:    (buf, ext)   => ipcRenderer.sendSync('save-video-sync', buf, ext),
  saveImage:        (buf, ext)   => ipcRenderer.invoke('save-image', buf, ext),
  openFolder:       ()           => ipcRenderer.invoke('open-folder'),
  getSaveDir:       ()           => ipcRenderer.invoke('get-save-dir'),
  registerShortcuts:(map)        => ipcRenderer.invoke('register-shortcuts', map),
  winControl:       (cmd)        => ipcRenderer.send('win-control', cmd),
  quitDone:         ()           => ipcRenderer.send('quit-done'),
  onShortcut:       (cb)         => ipcRenderer.on('shortcut', (_e, a) => cb(a)),
  onPrepareQuit:    (cb)         => ipcRenderer.on('prepare-quit', () => cb())
});