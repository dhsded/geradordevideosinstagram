const { app, BrowserWindow, Menu, session, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow = null;
let backendProcess = null;
let isQuitting = false;

// Determinar se estamos em modo de desenvolvimento
const isDev = !app.isPackaged;

// Helper para verificar rapidamente se o servidor já está respondendo na porta 3000
function checkServerRunning() {
  return new Promise((resolve) => {
    const req = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/health',
      method: 'GET',
      timeout: 300
    }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// Iniciar o backend Express / Vite de forma direta e rápida
async function startBackend() {
  const isAlreadyUp = await checkServerRunning();
  if (isAlreadyUp) {
    console.log('⚡ Backend server already running on port 3000. Reusing existing instance.');
    return;
  }

  if (isDev) {
    console.log('🚀 Starting backend server directly with tsx...');
    // No Windows, executar npx.cmd diretamente evita overhead de múltiplos shells do npm
    const cmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    backendProcess = spawn(cmd, ['tsx', 'server.ts'], {
      cwd: __dirname,
      env: { ...process.env, FORCE_COLOR: 'true' },
      stdio: 'inherit',
      shell: false
    });

    backendProcess.on('error', (err) => {
      console.error('Falha ao iniciar processo backend com tsx, tentando fallback:', err);
      // Fallback para npm run dev caso npx falhe
      const fallbackCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      backendProcess = spawn(fallbackCmd, ['run', 'dev'], {
        cwd: __dirname,
        env: { ...process.env, FORCE_COLOR: 'true' },
        stdio: 'inherit',
        shell: true
      });
    });

    backendProcess.on('exit', (code, signal) => {
      if (!isQuitting) {
        console.log(`Backend process exited with code ${code} and signal ${signal}`);
      }
    });
  } else {
    console.log('📦 Starting internal backend server in production mode...');
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

// Polling rápido e responsivo (intervalo de 100ms)
function pollServerReady(callback) {
  const check = () => {
    if (isQuitting) return;
    const req = http.request({
      host: '127.0.0.1',
      port: 3000,
      path: '/api/health',
      method: 'GET',
      timeout: 500
    }, (res) => {
      res.resume();
      res.on('end', () => {
        console.log('✅ Express backend online on port 3000!');
        callback();
      });
    });

    req.on('error', () => {
      if (!isQuitting) {
        setTimeout(check, 100);
      }
    });

    req.on('timeout', () => {
      req.destroy();
      if (!isQuitting) {
        setTimeout(check, 100);
      }
    });

    req.end();
  };

  check();
}

function createMainWindow() {
  const iconPath = path.join(__dirname, 'build', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 850,
    minWidth: 900,
    minHeight: 650,
    show: true, // Mostra imediatamente a janela para feedback visual instantâneo
    backgroundColor: '#0f172a',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    title: 'PostForge v1.0.0 - Carregando...',
  });

  if (!isDev) {
    Menu.setApplicationMenu(null);
  }

  // Atalho F12 para abrir DevTools sob demanda sem travar a inicialização
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' && input.type === 'keyDown') {
      mainWindow.webContents.toggleDevTools();
      event.preventDefault();
    }
  });

  // Garantir que downloads vão automaticamente para a pasta Downloads
  mainWindow.webContents.session.on('will-download', (event, item) => {
    const downloadsFolder = path.join(os.homedir(), 'Downloads');
    const targetFile = path.join(downloadsFolder, item.getFilename());
    item.setSavePath(targetFile);
    console.log(`[Electron Download] Salvando arquivo para: ${targetFile}`);
  });

  // Exibir tela de Splash instantânea enquanto o backend compila/inicia
  const splashHtml = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          background: #090d16;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          user-select: none;
          overflow: hidden;
        }
        .container {
          text-align: center;
          animation: fadeIn 0.4s ease-out;
        }
        .logo-box {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5);
        }
        .logo-box svg {
          width: 32px;
          height: 32px;
          fill: none;
          stroke: white;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        h1 {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #ffffff;
          margin-bottom: 6px;
        }
        p {
          font-size: 13px;
          color: #94a3b8;
          margin-bottom: 24px;
        }
        .spinner {
          width: 24px;
          height: 24px;
          border: 3px solid rgba(99, 102, 241, 0.2);
          border-top-color: #6366f1;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin: 0 auto;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo-box">
          <svg viewBox="0 0 24 24"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        </div>
        <h1>PostForge</h1>
        <p>Iniciando motores de inteligência e interface...</p>
        <div class="spinner"></div>
      </div>
    </body>
    </html>
  `;

  mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Inicialização principal do Electron
app.whenReady().then(async () => {
  // 1. Abre a janela com splash imediatamente (tempo de resposta percebido < 300ms)
  createMainWindow();

  // 2. Inicia o backend de forma direta
  await startBackend();

  // 3. Assim que a porta 3000 responder, carrega a aplicação
  pollServerReady(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle('PostForge v1.0.0');
      mainWindow.loadURL('http://localhost:3000');
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
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
      if (backendProcess.pid && process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(backendProcess.pid), '/f', '/t'], { shell: true });
      }
    } catch (e) {
      console.error('Error stopping backend:', e);
    }
  }
});
