const { app, BrowserWindow, Menu, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;

// Determinar se estamos em modo de desenvolvimento
const isDev = !app.isPackaged;

function startBackend() {
  if (isDev) {
    console.log('Starting backend server in development mode (using Vite middleware)...');
    backendProcess = spawn('cmd.exe', ['/c', 'npm', 'run', 'dev'], {
      cwd: __dirname,
      env: { ...process.env, FORCE_COLOR: 'true' },
      stdio: 'inherit',
      shell: true
    });

    backendProcess.on('error', (err) => {
      console.error('Failed to start backend process in dev mode:', err);
    });

    backendProcess.on('exit', (code, signal) => {
      console.log(`Dev backend process exited with code ${code} and signal ${signal}`);
    });
  } else {
    console.log('Starting internal backend server in production mode...');
    const serverScript = path.join(__dirname, 'dist', 'server.cjs');
    try {
      const serverModule = require(serverScript);
      if (typeof serverModule.startServer === 'function') {
        serverModule.startServer(3000);
      }
    } catch (err) {
      console.error('Failed to start internal server:', err);
    }
  }
}

function pollServerReady(callback) {
  const req = http.request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/health',
    method: 'GET',
    timeout: 1000
  }, (res) => {
    res.resume();
    res.on('end', () => {
      console.log('Express server is up and running on port 3000!');
      callback();
    });
  });

  req.on('error', () => {
    if (!isQuitting) {
      setTimeout(() => pollServerReady(callback), 250);
    }
  });

  req.on('timeout', () => {
    req.destroy();
    if (!isQuitting) {
      setTimeout(() => pollServerReady(callback), 250);
    }
  });

  req.end();
}

function createWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 650,
    show: false,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Prompter Nano Banana Desktop',
  });

  if (!isDev) {
    Menu.setApplicationMenu(null);
  } else {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.loadURL('http://localhost:3000');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicialização do app
app.whenReady().then(() => {
  startBackend();

  pollServerReady(() => {
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  isQuitting = true;
  if (backendProcess) {
    console.log('Terminating backend server process...');
    try {
      if (typeof backendProcess.kill === 'function') {
        backendProcess.kill();
      }
      if (backendProcess.pid && process.platform === 'win32' && isDev) {
        spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
      }
    } catch (e) {
      console.error('Error stopping backend:', e);
    }
  }
});
