const { ipcRenderer } = require('electron');

// =========================================================================
// 1. SUPRESSÃO DE CHAVE DE ACESSO DO WINDOWS (PASSKEYS / WEBAUTHN) & STEALTH
// =========================================================================
// Desativa WebAuthn/Passkeys para impedir o popup "Segurança do Windows: Salvar ou usar chave de acesso"
// e mascara atributos de automação para evitar desafios de Captcha no Instagram/Meta.
try {
  if (typeof window !== 'undefined') {
    // 1. Bloquear detecção de Passkey / Windows Hello
    try {
      Object.defineProperty(window, 'PublicKeyCredential', {
        value: undefined,
        configurable: true,
        writable: true
      });
    } catch (e) {}

    if (navigator.credentials) {
      navigator.credentials.get = () => Promise.reject(new DOMException('Passkeys disabled on this client', 'NotSupportedError'));
      navigator.credentials.create = () => Promise.reject(new DOMException('Passkeys disabled on this client', 'NotSupportedError'));
    }

    // 2. Mascarar webdriver e flags de automação
    try {
      Object.defineProperty(navigator, 'webdriver', {
        get: () => undefined,
        configurable: true
      });
    } catch (e) {}

    // 3. Simular runtime padrão do Google Chrome
    if (!window.chrome) {
      window.chrome = {
        runtime: {},
        app: {},
        loadTimes: function() {},
        csi: function() {}
      };
    }

    // 4. Idiomas padrão
    try {
      Object.defineProperty(navigator, 'languages', {
        get: () => ['pt-BR', 'pt', 'en-US', 'en'],
        configurable: true
      });
    } catch (e) {}
  }
} catch (stealthErr) {
  console.warn('[Preload Stealth] Aviso:', stealthErr);
}

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
  
  // Função auxiliar: buscar elemento por texto visível (fallback robusto)
  function findElementByText(searchText, tagFilter) {
    if (!searchText) return null;
    const candidates = tagFilter 
      ? document.querySelectorAll(tagFilter)
      : document.querySelectorAll('button, a, div, span, li, [role="menuitem"], [role="option"], [role="button"]');
    
    // Primeira passagem: match exato
    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      const aria = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      if (text === searchText || aria === searchText || title === searchText) return el;
    }
    // Segunda passagem: match parcial
    for (const el of candidates) {
      const text = (el.textContent || '').trim();
      const aria = el.getAttribute('aria-label') || '';
      const title = el.getAttribute('title') || '';
      if (text.includes(searchText) || aria.includes(searchText) || title.includes(searchText)) return el;
    }
    return null;
  }

  // Função auxiliar: buscar botão de menu (três pontos) por posição no card
  function findMenuButtonByIndex(cardIndex) {
    const allMenuBtns = Array.from(document.querySelectorAll('button')).filter(btn => {
      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const hasIcon = btn.querySelector('svg');
      return hasIcon && (ariaLabel.includes('mais') || ariaLabel.includes('more') || ariaLabel.includes('opç') || 
                         title.includes('mais') || title.includes('more') || title.includes('opç') ||
                         btn.hasAttribute('data-radix-collection-item') || (btn.id && btn.id.startsWith('radix-')));
    });
    if (allMenuBtns[cardIndex]) return allMenuBtns[cardIndex];
    
    // Fallback: todos os botões com id radix
    const radixBtns = Array.from(document.querySelectorAll('button[id^="radix-"]'));
    return radixBtns[cardIndex] || null;
  }

  ipcRenderer.on('spy-exec-step', (event, { actionId, step }) => {
    try {
      let targetEl = null;
      
      // 1. Tentar CSS selector
      if (step.seletor) {
        try { targetEl = document.querySelector(step.seletor); } catch {}
      }
      
      // 2. Tentar XPath
      if (!targetEl && step.xpath) {
        try {
          const result = document.evaluate(step.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
          targetEl = result.singleNodeValue;
        } catch {}
      }
      
      // 3. Fallback inteligente por texto da descrição
      if (!targetEl && step.descricao) {
        const desc = step.descricao.toLowerCase();
        
        // Detectar clique em "Mais opções" de um card específico
        if (desc.includes('mais opções') || desc.includes('more options') || desc.includes('três pontos')) {
          const cardMatch = desc.match(/(?:card|imagem|image)\s*(\d+)/i) || desc.match(/(?:primeiro|segundo|terceiro|1|2|3)/i);
          let cardIndex = 0;
          if (cardMatch) {
            const val = cardMatch[1] || cardMatch[0];
            if (val === 'primeiro' || val === '1') cardIndex = 0;
            else if (val === 'segundo' || val === '2') cardIndex = 1;
            else if (val === 'terceiro' || val === '3') cardIndex = 2;
            else cardIndex = parseInt(val) - 1 || 0;
          }
          targetEl = findMenuButtonByIndex(cardIndex);
        }
        // Detectar clique em "Baixar" / "Download"
        else if (desc.includes('baixar') || desc.includes('download')) {
          targetEl = findElementByText('Baixar') || findElementByText('Download') || findElementByText('Fazer download');
        }
        // Detectar seleção de resolução (1K, 2K, 4K)
        else if (desc.includes('resolução') || desc.includes('tamanho original') || desc.includes('1k') || desc.includes('2k') || desc.includes('4k')) {
          const quality = step.valor || '1K';
          targetEl = findElementByText(quality) || findElementByText('Tamanho original') || findElementByText('Original size');
        }
        // Detectar "Voltar"
        else if (desc.includes('voltar') || desc.includes('back')) {
          targetEl = findElementByText('Voltar', 'button') || findElementByText('Back', 'button');
          if (!targetEl) {
            targetEl = document.querySelector('button[aria-label*="Voltar"], button[aria-label*="Back"], button[aria-label*="voltar"]');
          }
        }
      }

      // Ação de espera
      if (step.tipo === 'wait') {
        setTimeout(() => {
          ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: 'Aguardado ' + (step.tempo_espera_ms || 1000) + 'ms' });
        }, step.tempo_espera_ms || 1000);
        return;
      }

      if (!targetEl && step.tipo !== 'navigate') {
        ipcRenderer.sendToHost('spy-exec-result', { 
          actionId, 
          success: false, 
          error: 'Elemento não encontrado: "' + (step.descricao || step.seletor || step.xpath) + '". Tente regravar o macro na página atual.'
        });
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
        // Dispatch hover first (important for dropdown menus like Google Flow)
        targetEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
        targetEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
        targetEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
        targetEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
        targetEl.click();
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: 'Clique executado em: "' + (step.descricao || step.seletor) + '"' });
      } else if (step.tipo === 'hover') {
        targetEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window }));
        targetEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true, cancelable: true, view: window }));
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: 'Hover executado em: "' + (step.descricao || step.seletor) + '"' });
      } else if (step.tipo === 'fill') {
        targetEl.focus();
        if ('value' in targetEl) {
          targetEl.value = step.valor || '';
        } else {
          targetEl.innerText = step.valor || '';
        }
        targetEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
        targetEl.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: 'Texto preenchido com sucesso.' });
      } else if (step.tipo === 'keypress') {
        targetEl.dispatchEvent(new KeyboardEvent('keydown', { key: step.valor || 'Enter', code: step.valor || 'Enter', bubbles: true }));
        targetEl.dispatchEvent(new KeyboardEvent('keyup', { key: step.valor || 'Enter', code: step.valor || 'Enter', bubbles: true }));
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: 'Tecla pressionada: ' + (step.valor || 'Enter') });
      } else {
        ipcRenderer.sendToHost('spy-exec-result', { actionId, success: true, message: 'Ação ' + step.tipo + ' executada.' });
      }
    } catch (err) {
      console.error('[Spy Preload] Erro ao executar passo:', err);
      ipcRenderer.sendToHost('spy-exec-result', { actionId, success: false, error: err.message });
    }
  });
});
