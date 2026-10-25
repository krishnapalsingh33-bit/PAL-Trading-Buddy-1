const { app, BrowserWindow, ipcMain, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

app.setName('PAL Trading Journal');

function dataPaths() {
  const dir = path.join(app.getPath('userData'), 'JournalData');
  return { dir, state: path.join(dir, 'journal-state.json'), backups: path.join(dir, 'Backups') };
}

function parseJournal(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.days && typeof parsed.days === 'object' && !Array.isArray(parsed.days)) return parsed;
  } catch (_) {}
  return null;
}

function isKnownDemoSeed(journal) {
  const keys = Object.keys(journal.days || {});
  if (keys.length !== 1) return false;
  const day = journal.days[keys[0]];
  const trades = ['london', 'newyork'].flatMap((session) => day?.sessions?.[session]?.trades || []);
  if (trades.length !== 1) return false;
  const trade = trades[0];
  return trade.direction === 'BUY' && trade.setup === 'A+' && String(trade.pnl) === '180' &&
    String(trade.note || '').trim() === 'Model aligned. Waited for CISD close.';
}

function writeJsonAtomic(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tempPath, filePath);
}

function migrateNewestDownloadedBackup() {
  const candidates = [];
  for (const dir of [app.getPath('downloads'), app.getPath('desktop')]) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (!/^PAL-Trading-Buddy-Journal(?:-Backup)?-.*\.json$/i.test(name)) continue;
        const filePath = path.join(dir, name);
        try {
          const stat = fs.statSync(filePath);
          if (stat.isFile()) candidates.push({ filePath, mtime: stat.mtimeMs });
        } catch (_) {}
      }
    } catch (_) {}
  }
  candidates.sort((a, b) => b.mtime - a.mtime);
  for (const candidate of candidates) {
    try {
      const journal = parseJournal(fs.readFileSync(candidate.filePath, 'utf8'));
      // Skip the fixed demonstration trade that older empty builds inserted automatically.
      if (!journal || Object.keys(journal.days).length === 0 || isKnownDemoSeed(journal)) continue;
      writeJsonAtomic(dataPaths().state, journal);
      return journal;
    } catch (_) {}
  }
  return null;
}

function loadJournalText() {
  const paths = dataPaths();
  try {
    if (fs.existsSync(paths.state)) {
      const journal = parseJournal(fs.readFileSync(paths.state, 'utf8'));
      if (journal) return JSON.stringify(journal);
    }
  } catch (_) {}
  const migrated = migrateNewestDownloadedBackup();
  return migrated ? JSON.stringify(migrated) : null;
}

ipcMain.on('pal-journal:load-state', (event) => {
  event.returnValue = loadJournalText();
});

ipcMain.on('pal-journal:save-state', (event, raw) => {
  try {
    const journal = parseJournal(raw);
    if (!journal) throw new Error('Journal data is not valid JSON.');
    writeJsonAtomic(dataPaths().state, journal);
    event.returnValue = { ok: true };
  } catch (error) {
    event.returnValue = { ok: false, error: String(error && error.message || error) };
  }
});

ipcMain.on('pal-journal:save-backup', (event, raw) => {
  try {
    const journal = parseJournal(raw);
    if (!journal) throw new Error('Journal data is not valid JSON.');
    const paths = dataPaths();
    writeJsonAtomic(paths.state, journal);
    fs.mkdirSync(paths.backups, { recursive: true });
    const now = new Date();
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    const backupPath = path.join(paths.backups, `PAL-Trading-Buddy-Journal-${stamp}.json`);
    writeJsonAtomic(backupPath, journal);
    event.returnValue = { ok: true, fileName: path.basename(backupPath) };
  } catch (error) {
    event.returnValue = { ok: false, error: String(error && error.message || error) };
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 980, minHeight: 680,
    autoHideMenuBar: true, backgroundColor: '#111214',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, 'PAL-Journal-Desktop.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
