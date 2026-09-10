// ============================================================================
// Google FLOW Studio Pro - Main World Script
// Executado no contexto MAIN da página para interceptar chamadas nativas de
// upload (HTMLInputElement.click, showPicker, showOpenFilePicker) e permitir
// upload programático de avatares/mídias sem restrição de User Activation.
// ============================================================================

(function () {
  'use strict';

  if (window.__FLOW_MAIN_WORLD_INJECTED__) return;
  window.__FLOW_MAIN_WORLD_INJECTED__ = true;

  console.log('[FLOW Main World] Interceptador de upload ativado no contexto MAIN.');

  window.__FLOW_PENDING_FILE__ = null;

  // 1. Intercepta HTMLInputElement.prototype.click
  const originalInputClick = HTMLInputElement.prototype.click;
  HTMLInputElement.prototype.click = function () {
    if (this.type === 'file' && window.__FLOW_PENDING_FILE__) {
      const file = window.__FLOW_PENDING_FILE__;
      window.__FLOW_PENDING_FILE__ = null;
      console.log('[FLOW Main World] Interceptado HTMLInputElement.click para arquivo:', file.name);

      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        try {
          this.files = dt.files;
        } catch (e) {
          Object.defineProperty(this, 'files', {
            value: dt.files,
            writable: true,
            configurable: true
          });
        }

        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

        if (typeof this.onchange === 'function') {
          try { this.onchange(new Event('change')); } catch (err) {}
        }

        window.postMessage({ type: 'FLOW_UPLOAD_INTERCEPTED', fileName: file.name, method: 'input.click' }, '*');
        return;
      } catch (err) {
        console.warn('[FLOW Main World] Erro ao injetar arquivo no input:', err);
      }
    }
    return originalInputClick.apply(this, arguments);
  };

  // 2. Intercepta HTMLInputElement.prototype.showPicker
  if (HTMLInputElement.prototype.showPicker) {
    const originalShowPicker = HTMLInputElement.prototype.showPicker;
    HTMLInputElement.prototype.showPicker = function () {
      if (this.type === 'file' && window.__FLOW_PENDING_FILE__) {
        const file = window.__FLOW_PENDING_FILE__;
        window.__FLOW_PENDING_FILE__ = null;
        console.log('[FLOW Main World] Interceptado HTMLInputElement.showPicker para arquivo:', file.name);

        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          try {
            this.files = dt.files;
          } catch (e) {
            Object.defineProperty(this, 'files', {
              value: dt.files,
              writable: true,
              configurable: true
            });
          }

          this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          this.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

          if (typeof this.onchange === 'function') {
            try { this.onchange(new Event('change')); } catch (err) {}
          }

          window.postMessage({ type: 'FLOW_UPLOAD_INTERCEPTED', fileName: file.name, method: 'input.showPicker' }, '*');
          return;
        } catch (err) {
          console.warn('[FLOW Main World] Erro ao injetar em showPicker:', err);
        }
      }
      return originalShowPicker.apply(this, arguments);
    };
  }

  // 3. Intercepta window.showOpenFilePicker (File System Access API)
  if (typeof window.showOpenFilePicker === 'function') {
    const originalShowOpenFilePicker = window.showOpenFilePicker;
    window.showOpenFilePicker = async function (options) {
      if (window.__FLOW_PENDING_FILE__) {
        const file = window.__FLOW_PENDING_FILE__;
        window.__FLOW_PENDING_FILE__ = null;
        console.log('[FLOW Main World] Interceptado window.showOpenFilePicker para arquivo:', file.name);

        window.postMessage({ type: 'FLOW_UPLOAD_INTERCEPTED', fileName: file.name, method: 'showOpenFilePicker' }, '*');

        return [
          {
            kind: 'file',
            name: file.name,
            getFile: async () => file,
            createWritable: async () => { throw new Error('Read only'); }
          }
        ];
      }
      return originalShowOpenFilePicker.apply(this, arguments);
    };
  }

  // 4. Busca recursiva em Shadow DOM
  function findFileInputDeep(node = document.body) {
    if (!node) return null;
    if (node.tagName === 'INPUT' && node.type === 'file' && !node.id?.includes('fd-') && !node.className?.includes('fd-')) {
      return node;
    }
    if (node.shadowRoot) {
      const found = findFileInputDeep(node.shadowRoot);
      if (found) return found;
    }
    for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
      const found = findFileInputDeep(child);
      if (found) return found;
    }
    return null;
  }

  // 5. Helper para disparar sequência de Drag & Drop nativo
  function dispatchNativeDrop(target, file) {
    try {
      if (!target || !file) return false;
      const dt = new DataTransfer();
      dt.items.add(file);

      const enterEvt = new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt });
      const overEvt = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
      const dropEvt = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });

      target.dispatchEvent(enterEvt);
      target.dispatchEvent(overEvt);
      target.dispatchEvent(dropEvt);
      return true;
    } catch (e) {
      return false;
    }
  }

  // 6. Listener de mensagens do macro_engine (isolated world)
  window.addEventListener('message', (event) => {
    if (!event.data || typeof event.data !== 'object') return;

    if (event.data.type === 'FLOW_SET_PENDING_FILE') {
      const data = event.data;
      let file = data.file;
      if (!file && data.blob) {
        file = new File([data.blob], data.name || 'character.jpeg', { type: data.mimeType || 'image/jpeg' });
      }

      if (file) {
        window.__FLOW_PENDING_FILE__ = file;
        console.log('[FLOW Main World] Arquivo pendente configurado:', file.name, file.size, 'bytes');

        // Se já houver input de arquivo no DOM ou Shadow DOM, preenche imediatamente
        const existingInput = findFileInputDeep(document);
        if (existingInput) {
          try {
            const dt = new DataTransfer();
            dt.items.add(file);
            existingInput.files = dt.files;
            existingInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            existingInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
            if (typeof existingInput.onchange === 'function') {
              existingInput.onchange(new Event('change'));
            }
            console.log('[FLOW Main World] Arquivo injetado em input existente no DOM!');
            window.postMessage({ type: 'FLOW_UPLOAD_INTERCEPTED', fileName: file.name, method: 'existing_input' }, '*');
          } catch (e) {}
        }

        // Tenta também Drag & Drop em alvos relevantes
        const targets = [
          document.querySelector('.cdk-overlay-pane'),
          document.querySelector('.upload-text')?.closest('button, div'),
          document.querySelector('main'),
          document.body
        ].filter(Boolean);

        for (const t of targets) {
          dispatchNativeDrop(t, file);
        }

        window.postMessage({ type: 'FLOW_UPLOAD_READY', fileName: file.name }, '*');
      }
    }
  });

})();
