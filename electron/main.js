// Desktop wrapper proof-of-concept (roadmap Phase 2). Loads the exact same
// index.html the browser build serves -- no separate build step, no
// duplicated game code. Security defaults (contextIsolation on, nodeIntegration
// off, sandbox on) are kept even though the game itself never calls a Node or
// Electron API from the renderer; there is no reason to weaken them for a
// page that doesn't need the access.
import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#101918', // matches the game's own background -- avoids a white flash before index.html paints
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
