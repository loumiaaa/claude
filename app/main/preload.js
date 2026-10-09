'use strict';
/* ==========================================================================
   Preload (sandbox) : API minimale en liste blanche, exposée en window.lamia.
   Pas d'ipcRenderer brut, pas de chemins arbitraires : les boîtes de dialogue
   et les accès disque sont faits par le main, qui vérifie l'expéditeur.
   ========================================================================== */
const { contextBridge, ipcRenderer } = require('electron');

const EVENTS = ['app:state', 'reminders:due', 'open-task', 'app:flush', 'app:navigate'];

function invoke(channel, payload) { return ipcRenderer.invoke(channel, payload); }

contextBridge.exposeInMainWorld('lamia', {
  app: {
    boot: () => invoke('app:boot'),
    ready: (info) => ipcRenderer.send('app:ready', info || {}),
    setTheme: (theme) => invoke('app:set-theme', theme),
    openDataFolder: () => invoke('app:open-data-folder'),
    showFile: (file) => invoke('app:show-file', file),
    setMachineOptions: (patch) => invoke('app:set-machine-options', patch),
    testNotification: () => invoke('app:test-notification')
  },
  data: {
    save: (doc) => invoke('data:save', doc),
    saveSync: (doc) => ipcRenderer.sendSync('data:save-sync', doc),
    loadDemo: () => invoke('data:load-demo'),
    retryLock: () => invoke('data:retry-lock'),
    forceLock: () => invoke('data:force-lock'),
    reload: () => invoke('data:reload')
  },
  backup: {
    list: () => invoke('backup:list'),
    restore: (id) => invoke('backup:restore', id),
    exportJson: () => invoke('backup:export-json'),
    importPick: () => invoke('backup:import-pick'),
    importApply: (token) => invoke('backup:import-apply', token)
  },
  io: {
    exportCsv: (o) => invoke('io:export-csv', o),
    exportPdf: (o) => invoke('io:export-pdf', o)
  },
  on: (channel, callback) => {
    if (EVENTS.indexOf(channel) < 0 || typeof callback !== 'function') throw new Error('Canal non autorisé : ' + channel);
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  }
});
