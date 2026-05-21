const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
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
    // Em desenvolvimento, rodamos "npm run dev" que inicia o tsx server.ts
    backendProcess = spawn('cmd.exe', ['/c', 'npm', 'run', 'dev'], {
      cwd: __dirname,
      env: { ...process.env, FORCE_COLOR: 'true' },
      stdio: 'inherit',
      shell: true
    });
  } else {
    console.log('Starting backend server in production mode...');
    // Em produção, rodamos o script compilado dist/server.cjs usando node
    backendProcess = spawn('node', [path.join(__dirname, 'dist', 'server.cjs')], {
      cwd: __dirname,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: 'inherit'
    });
  }

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend process:', err);
  });

  backendProcess.on('exit', (code, signal) => {
    console.log(`Backend process exited with code ${code} and signal ${signal}`);
    if (!isQuitting) {
      // Se o backend cair inesperadamente e não estivermos fechando o app, avisar ou reiniciar
      console.warn('Backend exited unexpectedly.');
    }
  });
}

function pollServerReady(callback) {
  const req = http.request({
    host: '127.0.0.1',
    port: 3000,
    path: '/api/health',
    method: 'GET',
    timeout: 1000
  }, (res) => {
    // Consumir a resposta para liberar o socket de forma limpa
    res.resume();
    res.on('end', () => {
      console.log('Express server is up and running on port 3000!');
      callback();
    });
  });

  req.on('error', () => {
    // Se deu erro de conexão, aguardar 200ms e tentar novamente
    if (!isQuitting) {
      setTimeout(() => pollServerReady(callback), 200);
    }
  });

  req.on('timeout', () => {
    req.destroy();
    if (!isQuitting) {
      setTimeout(() => pollServerReady(callback), 200);
    }
  });

  req.end();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false, // Ocultar até carregar por completo para evitar piscadas
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'Prompter Nano Banana Desktop',
  });

  // Ocultar menu nativo feio do browser (em produção), habilitar atalhos úteis
  if (!isDev) {
    Menu.setApplicationMenu(null);
  } else {
    mainWindow.webContents.openDevTools();
  }

  // Carregar o endereço do Express (que gerencia o Vite ou os estáticos do React)
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
  // 1. Iniciar o processo de backend
  startBackend();

  // 2. Aguardar o servidor estar pronto antes de abrir a janela
  pollServerReady(() => {
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Fechamento da aplicação
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  isQuitting = true;
  if (backendProcess) {
    console.log('Terminating backend process...');
    // Matar processo filho no Windows de forma limpa
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', backendProcess.pid, '/f', '/t']);
    } else {
      backendProcess.kill();
    }
  }
});
