const { ipcRenderer } = require('electron');

window.addEventListener('DOMContentLoaded', () => {
  console.log('[Spy Preload] Injetado com sucesso no navegador embutido.');

  let hoveredElement = null;
  let isInspectMode = false;

  // Criar um elemento overlay para destacar o elemento sob o mouse (estilo DevTools)
  const highlight = document.createElement('div');
  highlight.id = 'nano-banana-spy-highlight';
  highlight.style.position = 'absolute';
  highlight.style.border = '2px dashed #6366f1'; // Indigo border
  highlight.style.backgroundColor = 'rgba(99, 102, 241, 0.15)'; // Indigo translucent bg
  highlight.style.pointerEvents = 'none'; // Importante para não bloquear a interação real
  highlight.style.zIndex = '99999999';
  highlight.style.display = 'none';
  highlight.style.transition = 'all 0.08s ease';
  highlight.style.borderRadius = '4px';
  highlight.style.boxShadow = '0 0 8px rgba(99, 102, 241, 0.5)';
  document.body.appendChild(highlight);

  // Função para computar um seletor CSS limpo e legível
  function getCssSelector(el) {
    if (!(el instanceof Element)) return '';
    const path = [];
    let current = el;
    
    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.nodeName.toLowerCase();
      
      if (current.id) {
        // Se tem ID, geralmente é único
        selector += '#' + current.id;
        path.unshift(selector);
        break; 
      } else {
        // Obter classes relevantes
        let className = '';
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).filter(c => !c.includes(':') && !c.startsWith('nano-banana'));
          if (classes.length > 0) {
            className = '.' + classes.slice(0, 3).join('.');
          }
        }
        
        selector += className;
        
        // Determinar índice nth-of-type
        let sibling = current;
        let nth = 1;
        while (sibling = sibling.previousElementSibling) {
          if (sibling.nodeName.toLowerCase() === current.nodeName.toLowerCase()) {
            nth++;
          }
        }
        
        let hasNextSibling = false;
        let nextSibling = current;
        while (nextSibling = nextSibling.nextElementSibling) {
          if (nextSibling.nodeName.toLowerCase() === current.nodeName.toLowerCase()) {
            hasNextSibling = true;
            break;
          }
        }
        
        if (nth > 1 || hasNextSibling) {
          selector += `:nth-of-type(${nth})`;
        }
      }
      path.unshift(selector);
      current = current.parentNode;
    }
    return path.join(' > ');
  }

  // Função para gerar o XPath exato
  function getXPath(el) {
    if (!(el instanceof Element)) return '';
    const paths = [];
    let current = el;
    
    for (; current && current.nodeType === Node.ELEMENT_NODE; current = current.parentNode) {
      let index = 0;
      let hasSiblings = false;
      
      for (let sibling = current.previousSibling; sibling; sibling = sibling.previousSibling) {
        if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
        if (sibling.nodeName === current.nodeName) {
          index++;
        }
      }
      
      for (let sibling = current.nextSibling; sibling; sibling = sibling.nextSibling) {
        if (sibling.nodeName === current.nodeName) {
          hasSiblings = true;
          break;
        }
      }
      
      const tagName = current.nodeName.toLowerCase();
      const pathIndex = (index || hasSiblings) ? `[${index + 1}]` : '';
      paths.unshift(tagName + pathIndex);
    }
    return paths.length ? '/' + paths.join('/') : null;
  }

  // Escutar ordens do host para ligar/desligar modo inspeção
  ipcRenderer.on('toggle-inspect', (event, active) => {
    isInspectMode = active;
    console.log('[Spy Preload] Modo de inspeção alterado:', isInspectMode);
    if (!isInspectMode) {
      highlight.style.display = 'none';
    }
  });

  // Evento mouseover: destaca o elemento e envia informações prévias
  document.addEventListener('mouseover', (e) => {
    if (!isInspectMode) return;
    const el = e.target;
    if (el === highlight || el === document.body || el === document.documentElement || el.id === 'nano-banana-spy-highlight') return;

    hoveredElement = el;
    const rect = el.getBoundingClientRect();
    
    // Atualizar posição do highlight
    highlight.style.left = `${rect.left + window.scrollX}px`;
    highlight.style.top = `${rect.top + window.scrollY}px`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
    highlight.style.display = 'block';

    // Enviar dados preliminares do elemento focado
    ipcRenderer.sendToHost('spy-hover', {
      tagName: el.tagName,
      id: el.id || '',
      className: typeof el.className === 'string' ? el.className : '',
      text: el.innerText ? el.innerText.trim().substring(0, 100) : '',
      selector: getCssSelector(el),
      xpath: getXPath(el)
    });
  });

  document.addEventListener('mouseout', (e) => {
    if (!isInspectMode) return;
    if (e.relatedTarget === null || e.relatedTarget === highlight || e.relatedTarget.id === 'nano-banana-spy-highlight') {
      highlight.style.display = 'none';
    }
  });

  // Interceptar cliques
  document.addEventListener('click', (e) => {
    const el = e.target;
    if (el === highlight || el.id === 'nano-banana-spy-highlight') return;

    // Se estiver em modo de inspeção, prevenir o clique padrão
    if (isInspectMode) {
      e.preventDefault();
      e.stopPropagation();

      ipcRenderer.sendToHost('spy-click', {
        tagName: el.tagName,
        id: el.id || '',
        className: typeof el.className === 'string' ? el.className : '',
        text: el.innerText ? el.innerText.trim().substring(0, 100) : '',
        selector: getCssSelector(el),
        xpath: getXPath(el),
        type: 'inspect'
      });
      return;
    }

    // Mesmo fora do modo de inspeção, se o app estiver gravando, registra o clique do usuário!
    ipcRenderer.sendToHost('spy-click', {
      tagName: el.tagName,
      id: el.id || '',
      className: typeof el.className === 'string' ? el.className : '',
      text: el.innerText ? el.innerText.trim().substring(0, 60) : '',
      selector: getCssSelector(el),
      xpath: getXPath(el),
      type: 'user-click'
    });
  }, true);

  // ==========================================
  // EXECUTOR DE PASSOS AUTOMATIZADOS (RPA)
  // ==========================================
  ipcRenderer.on('spy-exec-step', (event, { actionId, step }) => {
    try {
      let targetEl = null;
      if (step.seletor) {
        try { targetEl = document.querySelector(step.seletor); } catch {}
      }
      if (!targetEl && step.xpath) {
        try {
          const result = document.evaluate(step.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          targetEl = result.singleNodeValue;
        } catch {}
      }

      if (step.tipo === 'wait') {
        setTimeout(() => {
          ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: `Aguardado ${step.tempo_espera_ms || 1000}ms` });
        }, step.tempo_espera_ms || 1000);
        return;
      }

      if (!targetEl && step.tipo !== 'navigate') {
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: false, error: `Elemento não encontrado: "${step.seletor || step.xpath}"` });
        return;
      }

      // Flash visual de execução
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const originalOutline = targetEl.style.outline;
        const originalBg = targetEl.style.backgroundColor;
        targetEl.style.outline = '3px solid #10b981';
        targetEl.style.backgroundColor = 'rgba(16, 185, 129, 0.2)';

        setTimeout(() => {
          targetEl.style.outline = originalOutline;
          targetEl.style.backgroundColor = originalBg;
        }, 1200);
      }

      if (step.tipo === 'click') {
        targetEl.focus();
        targetEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        targetEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        targetEl.click();
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: `Clique executado em: "${step.seletor}"` });
      } else if (step.tipo === 'fill') {
        targetEl.focus();
        if ('value' in targetEl) {
          targetEl.value = step.valor || '';
        } else {
          targetEl.innerText = step.valor || '';
        }
        targetEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        targetEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: `Texto preenchido com sucesso.` });
      } else if (step.tipo === 'keypress') {
        targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: step.valor || 'Enter', code: step.valor || 'Enter', bubbles: true }));
        targetEl.dispatchEvent(new KeyboardEvent('keyup', { key: step.valor || 'Enter', code: step.valor || 'Enter', bubbles: true }));
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: `Tecla pressionada: ${step.valor || 'Enter'}` });
      } else {
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: `Ação ${step.tipo} executada.` });
      }
    } catch (err) {
      console.error('[Spy Preload] Erro ao executar passo:', err);
      ipcRenderer.sendToHost('spy-exec-result', { actionId, success: false, error: err.message });
    }
  });
});
