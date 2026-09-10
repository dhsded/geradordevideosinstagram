const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

// =========================================================================
// 1. SUPRESSÃO DE CHAVE DE ACESSO DO WINDOWS & STEALTH
// =========================================================================
try {
  if (typeof window !== 'undefined') {
    try {
      Object.defineProperty(window, 'PublicKeyCredential', {
        value: undefined,
        configurable: true,
        writable: true
      });
    } catch (e) {}

    if (navigator.credentials) {
      navigator.credentials.get = () => Promise.reject(new DOMException('Passkeys disabled', 'NotSupportedError'));
      navigator.credentials.create = () => Promise.reject(new DOMException('Passkeys disabled', 'NotSupportedError'));
    }

    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });
    } catch (e) {}

    if (!window.chrome) {
      window.chrome = {
        runtime: {},
        app: {},
        loadTimes: function() {},
        csi: function() {}
      };
    }
  }
} catch (e) {}

// =========================================================================
// 2. INJEÇÃO DO INTERCEPTADOR MAIN WORLD (flow_main_world.js)
// =========================================================================
const injectMainWorldInterceptor = () => {
  try {
    const mainWorldPath = path.join(__dirname, 'flow_main_world.js');
    if (fs.existsSync(mainWorldPath)) {
      const code = fs.readFileSync(mainWorldPath, 'utf8');
      const script = document.createElement('script');
      script.textContent = code;
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      console.log('[FLOW Preload] Interceptador Main World injetado com sucesso.');
    }
  } catch (err) {
    console.warn('[FLOW Preload] Erro ao injetar Main World interceptor:', err);
  }
};

if (document.documentElement) {
  injectMainWorldInterceptor();
} else {
  window.addEventListener('DOMContentLoaded', injectMainWorldInterceptor);
}

// =========================================================================
// 3. INJEÇÃO DO MOTOR FlowMacroEngine (macro_engine.js)
// =========================================================================
const injectMacroEngine = () => {
  try {
    const enginePath = path.join(__dirname, 'macro_engine.js');
    if (fs.existsSync(enginePath)) {
      const engineCode = fs.readFileSync(enginePath, 'utf8');
      const script = document.createElement('script');
      script.textContent = engineCode;
      (document.head || document.documentElement).appendChild(script);
      console.log('[FLOW Preload] FlowMacroEngine injetado no contexto da página.');
    }
  } catch (err) {
    console.warn('[FLOW Preload] Erro ao injetar macro_engine.js:', err);
  }
};

// =========================================================================
// 4. PONTE DE COMUNICAÇÃO IPC ENTRE O POSTFORGE E A PÁGINA DO FLOW
// =========================================================================
window.addEventListener('DOMContentLoaded', () => {
  injectMacroEngine();

  const bridgeScript = document.createElement('script');
  bridgeScript.textContent = `
    (function() {
      window.flowMacroInstance = window.flowMacroInstance || new FlowMacroEngine();

      window.flowMacroInstance.subscribe(() => {
        const state = window.flowMacroInstance.getState();
        window.postMessage({
          type: 'FLOW_MACRO_STATE',
          state: {
            state: state.state,
            currentAction: state.currentAction,
            countdown: state.countdown,
            elapsedSeconds: state.elapsedSeconds,
            currentIndex: state.currentIndex,
            totalPrompts: state.totalPrompts,
            completedPrompts: state.completedPrompts,
            errorPrompts: state.errorPrompts,
            prompts: state.prompts
          }
        }, '*');
      });

      const origAddLog = window.flowMacroInstance.addLog.bind(window.flowMacroInstance);
      window.flowMacroInstance.addLog = function(msg, type = 'info') {
        origAddLog(msg, type);
        window.postMessage({
          type: 'FLOW_MACRO_LOG',
          log: {
            message: msg,
            type: type,
            time: new Date().toLocaleTimeString('pt-BR')
          }
        }, '*');
      };

      window.addEventListener('message', (e) => {
        if (!e.data || e.data.type !== 'POSTFORGE_TO_FLOW_MACRO') return;
        const { cmd, payload } = e.data.payload || {};
        const engine = window.flowMacroInstance;
        if (!engine) return;

        if (cmd === 'START') {
          if (payload.prompts) engine.prompts = payload.prompts;
          if (payload.carousels) engine.carousels = payload.carousels;
          if (payload.characters) engine.characters = payload.characters;
          if (payload.config) Object.assign(engine.config, payload.config);
          engine.start();
        } else if (cmd === 'PAUSE') {
          engine.pause();
        } else if (cmd === 'RESUME') {
          engine.resume();
        } else if (cmd === 'STOP') {
          engine.stop();
        } else if (cmd === 'RUN_SINGLE') {
          if (payload.id) engine.runSinglePrompt(payload.id);
        } else if (cmd === 'SYNC_DATA') {
          if (payload.prompts) engine.prompts = payload.prompts;
          if (payload.carousels) engine.carousels = payload.carousels;
          if (payload.characters) engine.characters = payload.characters;
          if (payload.config) Object.assign(engine.config, payload.config);
          engine.notify();
        }
      });
    })();
  `;
  (document.head || document.documentElement).appendChild(bridgeScript);

  ipcRenderer.sendToHost('flow-macro-ready', { url: window.location.href });

  window.addEventListener('message', (event) => {
    if (!event.data || !event.data.type) return;
    if (event.data.type === 'FLOW_MACRO_STATE') {
      ipcRenderer.sendToHost('flow-macro-state', event.data.state);
    } else if (event.data.type === 'FLOW_MACRO_LOG') {
      ipcRenderer.sendToHost('flow-macro-log', event.data.log);
    }
  });

  ipcRenderer.on('flow-macro-cmd', (event, payload) => {
    window.postMessage({ type: 'POSTFORGE_TO_FLOW_MACRO', payload }, '*');
  });
});
