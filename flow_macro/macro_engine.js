// ============================================================================
// FLOW Macro Studio - Motor Principal de Automação do Google FLOW
// ============================================================================
// Este motor é o cérebro que automatiza a criação em lote de imagens no FLOW:
// - Gerencia a sequência de carrosséis e slides (prompts).
// - Executa os Passos 1 a 7 do fluxograma oficial do Google FLOW.
// - Aplica configurações de imagem (proporção 9:16/16:9, modelo, quantidade de imagens).
// - Anexa personagens de referência via upload ou biblioteca.
// - Reutiliza comandos anteriores para manter consistência de estilo/personagens.
// - Controla os intervalos de tempo (delays) entre slides e carrosséis com contador regressivo.
// - Monitora em tempo real a conclusão da geração das imagens no Canvas.
// - Inclui sistema de auto-recuperação e diagnóstico por I.A (Gemini, Groq, OpenRouter).
// ============================================================================

// Proteção contra conflitos de reconciliação do React 18 / Next.js na página do FLOW
// Evita o erro nativo do DOM: "Failed to execute 'removeChild' on 'Node'" quando a extensão injeta elementos
try {
  if (typeof Node !== 'undefined' && Node.prototype) {
    const origRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function(child) {
      if (child && child.parentNode !== this) {
        return child;
      }
      return origRemoveChild.apply(this, arguments);
    };

    const origInsertBefore = Node.prototype.insertBefore;
    Node.prototype.insertBefore = function(newNode, referenceNode) {
      if (referenceNode && referenceNode.parentNode !== this) {
        return this.appendChild(newNode);
      }
      return origInsertBefore.apply(this, arguments);
    };
  }
} catch (e) { /* ignora se já estiver protegido */ }

(function () {
  'use strict';

  // Evita erro de redeclaração se o script for reinjetado na mesma aba
  if (typeof window !== 'undefined' && window.FlowMacroEngine) {
    return;
  }

class FlowMacroEngine {
  // ============================================================================
  // Banco de Imagens de Referência para Detecção por Similaridade Visual
  // Cada entrada é um data URL base64 (64x64 PNG) que representa visualmente
  // um botão ou elemento da interface do Google FLOW.
  // O macro usa computeImageSimilarity() para comparar esses fingerprints
  // com os elementos reais da página, tornando a detecção resiliente a
  // mudanças de CSS/classes no FLOW.
  // ============================================================================
  static REFERENCE_IMAGES = {
    // Botão circular preto com seta branca (→) que envia o prompt para gerar imagem
    submitButton: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAlbSURBVHhe7VtbbBTXGc5j8WV3vTfv/erYTljbQBVs0oe2ilGhCRCwTR8aIsilAurUD6HFUN5KeWtkjNKA0nBRYgkpUQPUpRJ2ICZ+CJIxVwUbqJXERhAZaIpQjQTav/r/2TNz5p9Zs7Ne8xDvJ/1az5mZc87//ZfznzPyU+l0+hfpdHrXXJWn0un0bpjDQAJ28ca5hCIBRQKKBBQJKBLAG+cSigQUCXhCBNy5cwdOnTwFXV1d0L75t9DW2gbLly2D5hea6XdtWxu0t7dD9+7dMDAwAHfv3uVdzApyJiCdTk97bYZHjx7Bv44fh9+88Sak5s8Ht9MF9nIbOB0V4HG5odLjBZ+3kn7x2ml30H38uz5VB5s2boITJ06YjmXWlg9yJsAqPvn4E/j5T38GFXYHKRwOhiAejUEiFs9IQhLRpgg+FwoE1XeXvtAMR48e5UMUBAUn4PLly7Bq5Spw2Oxk2ThTLhFHQaWTiuDf6rVCRjwe173n9XjAYbdDa0srXL16lQ85IxSUgEOHDkEsEgWnvcKoOCqXUTZJCmvXKhlEgPhbeIlCGvaHHpFMJODw4cN86LxRMAL+uH07lJeWQTgQgqqEUEBWPkmKC9FZPar8GtpZmOD9oD8AtnIb/HnnTj6FvFAQAjo6OqB0XilZX7EYKiIpn1HOSICmrO4eEaaEAg8PFBynrKQUtnVu41OxjBkTsGPHDiidV8ISnN7lhdvLyuuIYPe5mJIQjUFpSQns2jWj6c+MAIz5stIyVXl93CcgkciIrAy75oSIZ/h9DCFdaMTjEI1EwV5uh0///imfWs7Im4DR0RGIhMK0vGnurieAW1JVSAoLVA5zRsAXgGAgSH8bnpfe4Z6AOQF/x8b+zaeYE/IiAIuQ1ateBleFU0l4BgLM415TXor7RJIKH6wZfvL887R0mpGgECFyghAlMeKSu+7Xr/Bp5oS8CDhy5AhlfJyQpphMgOKuXAGNAM3tXQ4nLGlsgsnJSfjm66+hPpUCr9tjSoJCgDKm7AXxKC6RTujrO8Gn+lhYJuDhw4ewtHkpeD1e1QLK5BJK1hYESO36pKeRg9Ze0tQEN25MqP1fHR2FhvoG8gqZBGM/IjSUMbHMfunFF3VzzQWWCejv74cKh0M3uDoZIkC2lphkJoFJBAQDIVjQsADu/se46RkZGaG9gOwJ5sprnoCJ2OP2wJkzZ3h308IyAZs2bqT6XHFDQcD0SU9WQEw6GomR6x46eJAPQcCSt6G+3uAJan9qLtGKLswFW95+m3c1LSwR8N/vv4eGunol82fiWCgvhE80m+C7uIrg7m/ve+/xoQgjI1cMnsBFzj0Bnx8WP/ccTE1N8a6ywhIBAwOfU6wJtxeK8MSWi4hJIwkOuwP27d3LhyOQJ9Rl9wSlLy0MfJU+OHv2LO8mKywR0N3dTRajQamgEdZXwiASDpNCQsLS37wNf9GTwqEQ+H0+KPnRPNjTvYcPSSBPqNM8AYkWZbJCQBLisQQVYhgG+z/4gHeRFZYIeKv9LXBl4l9jXiEA1/PU/BTUpVDqJBFtsrD2+Sl4tvYZOgM4mDUnjFI4CE/Q55RMcRRHAhywrbOTv54VlghY29pGVpDdDiUcDJMS6K63JydpTbcqt2/fhlu3bsH4+HjW0x70BNMlUkqGWJxtWL+ev5oVlghYvmw5xRi3fjgYJOvcu3ePv1JwYAnetLiRwkclQCUhTgZqWbOGv5YVlghY2twM/kqfmgRFAsTJ1NfVkxWfBI7/8zgl43gspgtHzAFYoK1csYK/khWWCPgleoC3ktXk6AEh8oD79+/zVwqOixcvwsIFCyAUDDJDKLtRj9s9ex7wq7a1pjkAszomwEuXLlEM5yMTExMwNjYG169fz5oDLly4AM/U1lIOEJZX5qLVArOaAzp+1wFOh9MwqCIJqK56OkephuqqGl0bLmOV3kr46MMPwUx/tHxtdY1kAP0+RBgEl8Ht23I/KbJEwF/ffZcG0LEvbYUj4Yhh3TcVek55NhqOgN/nB1uZDQ4eOMCHJJw/fx5qnq6m02Ed+SbLMc4v21JqBksEDA4OkgVwIDr9YQTwk2C8NrRJz+PkQ8EQuJxu6On5iA9HQOVra2pooyMrr4yveJ7SlqBjsoDfD+fOnePdZIUlAnCZW7RwIRUsXDGDSMmJi/AeTJ5ulwt6enr4UARUpLqqymh5SWm5X9wL4NnCgwcPeFdZYYkABOYBOp/XhYHigrp4NLinEKVqwzDA6vHYsWN8CAIqz2NeU1o6G5QIwDJ96x+28q6mhWUCTp8+DS6nC5KSJbnIFtKRolZsCfIi3OTcmNAOQwSGh4ep0sM1Xa+8cUzRjkfluESfGx7m3U0LywTgEoWFhrCMmah5gbdLVkvGk+Dz+omEa9euqf2j8jXV1UbLZ4jUxpAklqAzitaWFt1cc4FlAhB4KoRbWNkifILTtknWdLvcVN9jLXDlyldQlUTLc+VNyKT7ijfhwQp65eDgF3yqj0VeBCBeXbeOcgHfowu3l69JMp/GNC/QnkVrNzU2wY8XLcpUmhnlDQrza+yzir4NbN60mU8xJ+RNwMT4OCUpXHa4wvI1F5EbtESmffPDvKA9w2JeJVI7FcY2DKPUsyn47rtbfIo5IW8CEL29/yAvwC80XNHHiXaWJ7cJ0ce98AQeUlhMuV0eOHXyJJ9azpgRAYg93d1gKzem4yj8dK1T0ix2pWdQWVHQ6N8zKs0/lyHp+JX4b++/z6dkCTMmALHzTzvpQwlOqop9BudiiGsTkvjz/D4ep9nKy+Gdd/7Cp2IZBSEAsburC9wVLqrGjImRf0FiSqnxbSRAe0/5jIbnEbgb3Ld3H59CXigYAYje3l6q23FDoktgOkWNFtfFvSieGCGxSIxCDc8d+vr6+NB5o6AEIL799ht44/XXyUryqY2W2PAAlRGgkpCxtKx4NEZ7fKwKcam7efMmH3JGKDgBAp/198Pq1S/TGWKFzUGhgcoYrG8S40gaLot4wosu39baCl/kUeTkglkjQODMl1/C77dsgcbFi4kEXDZRPE4XfRzFQxD8RW/BdgwfVH5J4xI62Dg7NMS7LChyJoAfU/Hrx2Fq6n8wNDREHy06t3bCa+s30NndypdWQMvqNfDahg3UfmD/ftoP8C2t1fFyRc4E/FBRJKBIQJGA/AiYraT0pJE3AT8UFAkoElAkYG7/9/j/AZd6FoWfkQ/WAAAAAElFTkSuQmCC',
    // Botão "+" no canto esquerdo da barra de comando para abrir a biblioteca de mídia/imagens
    plusButton: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADwAAABOCAYAAAB8FnW4AAAGOUlEQVR4AeycW08bRxTH/+srvoAdY64BkpBbpUiU0kTJ54j6HPUtrdrXqlWl9q1qqr62Uj9MWzVvQYkSlCgXLoUYhWDADqyxDTa+dP4jphhsELuLvcYYcXZ2d27nN+fM2cGexQGgbEV6+/rLFy6OlqM9vadCCCx4zf2GQmF0BjuRyaTNNWBDLdPATqcTke4oMtmMDWqb79I08LlzEZRKRRQKBfO921DTFLDL5UYofA7ZbNYGla116TBTPRTqkpYtlxnvzLRgXx1TwMFgF3K5bfu0ttCzYeCOjg643G5pYQv92lbVMLDP5xewO7YpbLVjw8BeYeGdnZMB5qOtu7sb0WgUPp/PKsux6hsH9npRLBaP1fhRhS5duoSbN2/i6tWruHLlCsbHx3Hjxo26gxsG5iPJKvDIyAh6e3uxtraGx48f49GjR5ifn4dfWHl0dBS0/FGDZSXPMLDDYbjKPv0Y9KLRbmxsrEtINXgrKyt4t7QEv9+Pnp4eHPzp6+vDxMQnuH37tvQGDsxH16/LYkwvX74sz3kYHh4G7/GcMjg4iE8nJmRdw9prmsY2TEtnZ6ewoAvpdPX6e3NzE+VSCcFgcF/7nOP0ilwuj4WFBbHgychB8fl9shxTDqS8EAevmHa8J04xMDCAoaEh6KmUHGDDwGzEsogFSz5fHfg4CEWxXD3YfjgcRknEDbr96uoqZmZmBfTxVnmRSARbW1uYm5uTU8geYOElHo/7IJe0rNPhrLpPi+XFk4GKq8zKc3WvVsp+AoGAdGdOh4YD022LxQK6ukJV+oXDITiczip3p3XdbpeYCnuD4Xa5quqrG5q2N+1KpTLY5+TkJCYnJ9Fw4O3tbSQSSQHcBQYepwCkogxKA/0D4m/rjHQ93lOymd4UsC709/fJW3TTynleKBRFvlMKn+fBYECW44GwjP583vPawUOjZXFxEZyLjMa3bt3CnTt3JHxWzDXO06KYr5U6LS/HkUrpGBm5IMvy2V0QXqLK8PHWIRZEbGtsbAyatmfhWCwm/mbP4tq1a9KtbQGmooy2T548wezsrAwoU1NTePnypQwwzK8UDsD09AxevHghyz5//hyVQS8ej/+fxzaePn2GZ8+mZBOs++rVK1A4mLYBUxsqk0wmhYsnaoKyTKUwiicStcsyiDGPZSrrqHNd1+VUsRVYKWMmZSArFkuGq55a4Ndv3oCubZT41AIbBVXl28BqJFo1bVu4VS2ruNoWViPRqmnbwq1qWcXVtrAaidZM0fgPAOweyLZL222BevfftnC9R9ju9tsWttsC9e7/TFnYJT68PzPAbrcbHo/nbCw8CEvhdGl5C9ONFWzLA2uaJt2YoEoc6sTu9O7dz/Db73+A6UnpQusebKtpgA8qZvVa0zRUurJqr2WB1dewClSlLQt82OabswUszNwGFoNQ19979z7HN99+VyVjH4/LfpnWyr9//0twq4MsZOHQcAsPnj+PCyMXq4R7scjBtFb++aFheLxeFrEkDQd+8PNP+PqrL6rk77/+lCBMa+X/+MP3iC8vyzJWDoaBT+Mu+MoBMgxcKhnfZlDZYaPOD9PTMHChsCP3QzVKcbP9nBhwLpc7Y8Db2zXXqGYtUa963BJVq23DLr21lYXL5a7VlqV7yWQCscW3YGqpod3KDK61XlUwDMy9koWdHQF9+ObO3T4NJQ8f/oNff3kApoYqHlG4UOOtOcPAbD+dTsHr7eBpUwutnM/n9+loCljXU9LCmqbta6wZL2jlStc2BcxHk76xLt9PaEbIgzoRmML7poBZcX39AxwOp7Q0r5tdCEz3Ng3MsP9BRNaAf28zdrND071NAxNO1zfA3eqBwP63UJjXjEKdLAGzgcTaqnwX0efz87LpxTIw16yrK3EBWsZpgLYMLEjBgBBffi9fkW929z4RYAW9/H4JXHqGukJNG71PDJjQyr0TiTXp3nxBStM0ZjWNnCiwomL0XowtIJNOgy9k0c1d4rtZlW9nWhdgAvE5TUvH3i4gvanD6/EiFAqDVuf3tM7dF7TQ4J+6ASsOLkOTySRiwuJL7xaR0nUR3Ergi1UcAP4/kEikW3wE2xipO7ACZ8o/LbkkZUSPCcv/OzeD2Zk3mJl+3TBpKDCh7Zb/AAAA//8oXRKFAAAABklEQVQDAMuj2X9cUPOrAAAAAElFTkSuQmCC'
  };

  constructor() {
    // ------------------------------------------------------------------------
    // Estruturas de Dados Principais
    // ------------------------------------------------------------------------
    this.prompts = [];                 // Lista plana de todos os slides/prompts prontos para execução
    this.carousels = [];               // Lista estruturada de carrosséis (lotes) e seus slides filhos
    this.selectedCarouselId = 'all';   // Filtro de execução: 'all' (todos) ou ID específico ('carousel_1', etc.)
    this.characters = [];              // Lista de personagens de referência (nome, avatar, enabled)
    this.aiKeysPool = [];              // Pool de chaves de I.A com rotação automática em caso de cota esgotada
    this.currentIndex = -1;            // Índice do slide atualmente em execução (-1 = nenhum)
    this.state = 'idle';               // Estado atual do motor: 'idle' | 'running' | 'paused' | 'stopped'
    
    // ------------------------------------------------------------------------
    // Controle de Tempo, Ação Atual e Contagem Regressiva
    // ------------------------------------------------------------------------
    this.startTime = 0;                // Timestamp de início da execução do macro
    this.elapsedSeconds = 0;           // Segundos totais decorridos desde o início
    this.tickerInterval = null;        // Intervalo do cronômetro (1 segundo)
    this.currentAction = '';           // Descrição textual da ação em andamento (ex: "⏳ FLOW gerando imagem...")
    this.countdown = { remaining: 0, total: 0, label: '' }; // Objeto da contagem regressiva ao vivo
    this.settingsConfiguredForProject = false; // Flag de controle: configurações do Passo 1 rodam apenas 1x por projeto
    this.lastConfiguredProjectId = null;       // ID do último projeto onde as configurações de formato foram aplicadas
    this.uploadedAvatarsInFlow = new Set();    // Conjunto de avatares já enviados nesta sessão para evitar uploads duplicados

    // ------------------------------------------------------------------------
    // Configurações Globais de Automação (Parâmetros que o usuário pode alterar)
    // ------------------------------------------------------------------------
    this.config = {
      mediaType: 'image',              // Tipo de mídia a ser gerada: 'image' (imagem) ou 'video' (vídeo)
      aspectRatio: '9:16',             // Proporção: '16:9' | '4:3' | '1:1' | '3:4' | '9:16'
      model: 'Nano Banana Pro',        // Modelo de I.A no FLOW
      quantity: 4,                     // Quantidade de variações geradas por prompt: 1 | 2 | 3 | 4
      repeatPerPrompt: 1,              // Número de repetições para o mesmo prompt
      repeatDelaySeconds: 10,          // Intervalo pré-configurado de 10s entre repetições do mesmo prompt
      delaySeconds: 15,                // Intervalo em segundos entre um slide e outro (padrão: 15s)
      carouselDelaySeconds: 25,        // Intervalo em segundos entre um carrossel e outro (padrão: 25s)
      actionDelayMs: 500,              // Micro-intervalo em milissegundos entre ações para o FLOW processar
      waitForCompletion: false,        // Aguardar conclusão explícita
      applyGlobalCharacters: true,     // Se verdadeiro, anexa os personagens de referência configurados
      reusePreviousCommand: true,      // Se verdadeiro, usa o Passo 7 (reutilizar comando anterior) nos slides 2+
      autoCreateNewProjectPerCarousel: false, // Cria novo projeto automaticamente a cada carrossel
      autoDownloadResults: false,      // Baixa as imagens automaticamente após a geração
      carouselFolderMode: 'individual', // 'individual' (subpastas por carrossel) | 'single' (pasta única)
      downloadFolder: 'FLOW_Downloads', // Pasta base de downloads
      // Notificações ao Vivo no Telegram
      telegramEnabled: true,           // Ativa envio de relatórios e progresso no Telegram
      telegramBotToken: '8680557957:AAGsOQ9pC49uWXktu4ZCJfnI1IRsNC9sbyk', // Token do Bot (@BotFather)
      telegramChatId: '6969102297',    // Chat ID do usuário Ares (@suporteares)
      telegramSendCoverPhoto: true,    // 📸 Envia Foto de Capa ao concluir carrossel
      telegramSendDetailedPrompts: true, // 📝 Envia prompt detalhado a cada fluxo concluído
      telegramSendCharacterThumbnails: true, // 🎭 Envia miniatura de personagens no início de cada carrossel
      // Integração com Inteligência Artificial para Auto-Diagnóstico em Tempo Real
      aiProvider: 'gemini',            // Provedor de I.A: 'gemini' | 'groq' | 'openrouter'
      aiApiKey: '',                    // Chave ativa de I.A
      aiModel: 'gemini-1.5-flash',     // Modelo de I.A para análise de erros
      aiAutoHeal: true,                // Tenta corrigir erros automaticamente em tempo real
      aiAutoRotateKeys: true           // Alterna para a próxima chave quando o limite de requisições expirar
    };
    this.listeners = new Set();        // Ouvintes registrados para receber notificações de mudanças de estado
    this.timer = null;                 // Referência para timers assíncronos
    this.logs = [];                    // Histórico de logs de execução com timestamp

    // ------------------------------------------------------------------------
    // Telemetria em Tempo Real e Aprendizado Adaptativo de Seletores do FLOW
    // ------------------------------------------------------------------------
    this.learnedSelectors = {};        // Seletores aprendidos pelo gravador: { promptInput, submitButton, plusButton }
    this.telemetryEvents = [];         // Buffer circular com os últimos eventos capturados no DOM do FLOW
    this.isRecordingTelemetry = true;  // Flag que ativa a gravação contínua de cliques e teclas
    this.isInspectorActive = false;    // Modo de inspeção visual ativado/desativado
    this.telemetryFilter = 'all';      // Filtro de exibição da telemetria ('all', 'input', 'click', 'error')

    // Carrega o estado salvo e inicia o gravador de telemetria
    this.loadState();
    this.initRealtimeRecorder();

    // Listener de confirmação de upload interceptado no Main World
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'FLOW_UPLOAD_INTERCEPTED') {
          this.addLog(`✨ [Passo 3] Upload interceptado e injetado no FLOW via ${event.data.method} (${event.data.fileName})!`, 'success');
        }
      });
    }
  }

  // =========================================================================
  // Persistência de Estado (Duplo Armazenamento: chrome.storage + localStorage)
  // =========================================================================
  
  /**
   * Carrega o estado anterior salvo no storage local da extensão e no localStorage
   */
  async loadState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
        const data = await chrome.storage.local.get([
          'flow_macro_prompts',
          'flow_macro_carousels',
          'flow_macro_characters',
          'flow_macro_config',
          'flow_macro_selected_carousel',
          'flow_macro_ai_keys_pool',
          'flow_macro_learned_selectors'
        ]);

        if (data.flow_macro_carousels && Array.isArray(data.flow_macro_carousels)) {
          this.carousels = data.flow_macro_carousels;
        }
        if (data.flow_macro_prompts && Array.isArray(data.flow_macro_prompts)) {
          this.prompts = data.flow_macro_prompts;
        }
        if (data.flow_macro_selected_carousel) {
          this.selectedCarouselId = data.flow_macro_selected_carousel;
        }
        if (data.flow_macro_characters && Array.isArray(data.flow_macro_characters) && data.flow_macro_characters.length > 0) {
          this.characters = data.flow_macro_characters;
        }
        if (data.flow_macro_ai_keys_pool && Array.isArray(data.flow_macro_ai_keys_pool)) {
          this.aiKeysPool = data.flow_macro_ai_keys_pool;
        }
        if (data.flow_macro_learned_selectors && typeof data.flow_macro_learned_selectors === 'object') {
          this.learnedSelectors = data.flow_macro_learned_selectors;
          delete this.learnedSelectors.newProjectButton;
        }
        if (data.flow_macro_config) {
          this.config = { ...this.config, ...data.flow_macro_config };
        }
      }
    } catch (e) {
      console.warn('[FLOW Macro] Aviso ao ler chrome.storage.local:', e);
    }

    // Fallback de Segurança: Backup no localStorage
    try {
      if ((!this.prompts || this.prompts.length === 0) && typeof localStorage !== 'undefined') {
        const backupPrompts = localStorage.getItem('flow_macro_prompts_backup');
        if (backupPrompts) {
          const parsed = JSON.parse(backupPrompts);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.prompts = parsed;
          }
        }
      }
      if ((!this.carousels || this.carousels.length === 0) && typeof localStorage !== 'undefined') {
        const backupCarousels = localStorage.getItem('flow_macro_carousels_backup');
        if (backupCarousels) {
          const parsed = JSON.parse(backupCarousels);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.carousels = parsed;
          }
        }
      }
      if ((!this.characters || this.characters.length === 0) && typeof localStorage !== 'undefined') {
        const backupChars = localStorage.getItem('flow_macro_characters_backup');
        if (backupChars) {
          const parsed = JSON.parse(backupChars);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.characters = parsed;
          }
        }
      }
      if ((!this.aiKeysPool || this.aiKeysPool.length === 0) && typeof localStorage !== 'undefined') {
        const backupKeys = localStorage.getItem('flow_macro_ai_keys_pool_backup');
        if (backupKeys) {
          const parsed = JSON.parse(backupKeys);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.aiKeysPool = parsed;
          }
        }
      }
      if ((!this.learnedSelectors || Object.keys(this.learnedSelectors).length === 0) && typeof localStorage !== 'undefined') {
        const backupSel = localStorage.getItem('flow_macro_learned_selectors_backup');
        if (backupSel) {
          const parsed = JSON.parse(backupSel);
          if (parsed && typeof parsed === 'object') {
            this.learnedSelectors = parsed;
          }
        }
      }
    } catch (e) {
      console.warn('[FLOW Macro] localStorage read fallback warning:', e);
    }

    this.notify();

    // Verifica se há sessão de auto-recuperação pendente após recarga da página por erro de tela
    setTimeout(() => {
      this.checkAndResumeAutoRecovery();
    }, 1500);
  }

  scheduleSaveState() {
    if (this._saveStateTimer) clearTimeout(this._saveStateTimer);
    this._saveStateTimer = setTimeout(() => {
      this.saveState();
    }, 500);
  }

  async saveState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({
          flow_macro_prompts: this.prompts,
          flow_macro_carousels: this.carousels,
          flow_macro_selected_carousel: this.selectedCarouselId,
          flow_macro_characters: this.characters,
          flow_macro_ai_keys_pool: this.aiKeysPool,
          flow_macro_learned_selectors: this.learnedSelectors,
          flow_macro_config: this.config
        });
      }
    } catch (e) {
      console.warn('[FLOW Macro] chrome.storage.local save warning:', e);
    }

    // Dual Storage Fallback: Mirror essential items to localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('flow_macro_prompts_backup', JSON.stringify(this.prompts || []));
        localStorage.setItem('flow_macro_carousels_backup', JSON.stringify(this.carousels || []));
        localStorage.setItem('flow_macro_characters_backup', JSON.stringify(this.characters || []));
        localStorage.setItem('flow_macro_ai_keys_pool_backup', JSON.stringify(this.aiKeysPool || []));
        localStorage.setItem('flow_macro_learned_selectors_backup', JSON.stringify(this.learnedSelectors || {}));
        localStorage.setItem('flow_macro_config_backup', JSON.stringify(this.config || {}));
      }
    } catch (e) {
      console.warn('[FLOW Macro] localStorage save fallback warning:', e);
    }
  }

  // =========================================================================
  // Telemetria em Tempo Real, Gravador de Eventos e Aprendizado de Seletores
  // =========================================================================

  /**
   * Inicializa o gravador contínuo de eventos do DOM (Cliques do usuário e mudanças de rota)
   * Permite que a extensão aprenda automaticamente os seletores dos botões do FLOW
   */
  initRealtimeRecorder() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    if (this._recorderInitialized) return;
    this._recorderInitialized = true;

    // 1. Captura passiva de cliques do usuário no FLOW (para aprendizado de seletores)
    window.addEventListener('click', (e) => {
      if (!this.isRecordingTelemetry) return;
      const target = e.target;
      // Ignora cliques que ocorram dentro da própria janela da extensão (prefixo fd-)
      if (!target || (target.closest && target.closest('[id*="fd-"], [class*="fd-"]'))) return;

      const fp = this.captureElementFingerprint(target);
      this.recordTelemetry('CLICK', {
        action: 'user_click',
        tag: fp.tag,
        selector: fp.selector,
        xpath: fp.xpath,
        text: fp.text,
        aria: fp.ariaLabel || fp.title || '',
        reactProps: fp.reactPropsSummary,
        rect: fp.rect,
        url: window.location.href
      });

      // Classifica e aprende automaticamente o botão clicado caso seja um elemento do FLOW
      this.autoClassifyAndLearnElement(target, fp);
    }, true);

    // 2. Captura mudanças de URL e rotas da SPA (Single Page Application) do FLOW
    const recordNav = () => {
      if (!this.isRecordingTelemetry) return;
      this.recordTelemetry('NAVIGATION', {
        action: 'route_change',
        url: window.location.href,
        projectId: FlowMacroEngine.getCurrentProjectId() || null,
        isCanvas: FlowMacroEngine.isFlowProjectPage(),
        isCharacters: FlowMacroEngine.isFlowCharactersPage(),
        isHub: FlowMacroEngine.isFlowHubPage()
      });
    };

    window.addEventListener('popstate', recordNav);
    window.addEventListener('hashchange', recordNav);
  }

  /**
   * Registra um evento no buffer circular de telemetria (máximo 150 registros)
   * @param {string} type - Tipo do evento ('CLICK', 'NAVIGATION', 'ERROR', 'MACRO')
   * @param {Object} data - Dados adicionais do evento
   */
  recordTelemetry(type, data = {}) {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    const entry = {
      id: 'tel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      timestamp: now.toISOString(),
      time: timeStr,
      type: type,
      ...data
    };

    this.telemetryEvents.unshift(entry);
    if (this.telemetryEvents.length > 150) {
      this.telemetryEvents.length = 150;
    }
  }

  /**
   * Gera um seletor CSS único e altamente preciso para qualquer elemento do DOM
   * @param {HTMLElement} el - Elemento alvo
   * @returns {string} - Caminho seletor CSS
   */
  getUniqueSelector(el) {
    if (!el || el.nodeType !== 1) return '';

    // Prioridade 1: ID próprio do elemento
    if (el.id && !el.id.startsWith('fd-') && !el.id.match(/\d{5,}/)) {
      return `#${CSS.escape(el.id)}`;
    }

    // Prioridade 2: Atributos de teste (data-testid / data-component)
    const testid = el.getAttribute('data-testid') || el.getAttribute('data-test-id') || el.getAttribute('data-component');
    if (testid) {
      return `[data-testid="${CSS.escape(testid)}"]`;
    }

    // Prioridade 3: Atributo aria-label acessível
    const aria = el.getAttribute('aria-label');
    if (aria && aria.length < 50) {
      return `${el.tagName.toLowerCase()}[aria-label="${CSS.escape(aria)}"]`;
    }

    // Prioridade 4: Role do elemento
    const role = el.getAttribute('role');
    if (role) {
      const sameRole = document.querySelectorAll(`${el.tagName.toLowerCase()}[role="${role}"]`);
      if (sameRole.length === 1) {
        return `${el.tagName.toLowerCase()}[role="${role}"]`;
      }
    }

    // Prioridade 5: Subida hierárquica na árvore DOM (nth-of-type)
    const path = [];
    let curr = el;
    while (curr && curr.nodeType === 1 && curr.tagName !== 'BODY' && curr.tagName !== 'HTML') {
      let selector = curr.tagName.toLowerCase();
      if (curr.id && !curr.id.startsWith('fd-')) {
        selector = `#${CSS.escape(curr.id)}`;
        path.unshift(selector);
        break;
      } else {
        let siblingIndex = 1;
        let sib = curr.previousElementSibling;
        while (sib) {
          if (sib.tagName === curr.tagName) siblingIndex++;
          sib = sib.previousElementSibling;
        }
        selector += `:nth-of-type(${siblingIndex})`;
      }
      path.unshift(selector);
      curr = curr.parentElement;
    }
    return path.join(' > ');
  }

  /**
   * Calcula o caminho XPath absoluto de um elemento no DOM
   * @param {HTMLElement} el - Elemento alvo
   * @returns {string} - Expressão XPath
   */
  getElementXPath(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id && !el.id.startsWith('fd-')) return `//*[@id="${el.id}"]`;

    const parts = [];
    let curr = el;
    while (curr && curr.nodeType === 1) {
      let index = 1;
      let sib = curr.previousSibling;
      while (sib) {
        if (sib.nodeType === 1 && sib.tagName === curr.tagName) {
          index++;
        }
        sib = sib.previousSibling;
      }
      const tag = curr.tagName.toLowerCase();
      parts.unshift(`${tag}[${index}]`);
      curr = curr.parentNode;
    }
    return '/' + parts.join('/');
  }

  /**
   * Inspeciona as propriedades sintéticas e internas do React (Fiber) anexadas ao elemento DOM
   * @param {HTMLElement} el - Elemento alvo
   * @returns {Object} - Propriedades e manipuladores React encontrados
   */
  getElementReactInfo(el) {
    if (!el) return { propsKeys: [], componentName: null, handlers: [] };
    const info = { propsKeys: [], componentName: null, handlers: [] };
    try {
      const propKey = Object.keys(el).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
      if (propKey && el[propKey]) {
        const p = el[propKey];
        info.propsKeys = Object.keys(p).slice(0, 10);
        ['onClick', 'onMouseDown', 'onChange', 'onInput', 'onKeyDown', 'onSubmit'].forEach(h => {
          if (typeof p[h] === 'function') info.handlers.push(h);
        });
      }
      const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (fiberKey && el[fiberKey]) {
        let fiber = el[fiberKey];
        while (fiber) {
          if (fiber.type && typeof fiber.type === 'function' && fiber.type.name) {
            info.componentName = fiber.type.name;
            break;
          }
          fiber = fiber.return;
        }
      }
    } catch (e) { /* ignora */ }
    return info;
  }

  /**
   * Captura uma impressão digital rica (fingerprint) do elemento para identificação resiliente
   * @param {HTMLElement} el - Elemento alvo
   * @returns {Object} - Fingerprint contendo tags, classes, atributos, texto e dimensões
   */
  captureElementFingerprint(el) {
    if (!el || el.nodeType !== 1) return {};
    const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { x: 0, y: 0, width: 0, height: 0 };
    const reactInfo = this.getElementReactInfo(el);

    return {
      tag: el.tagName || '',
      id: el.id || '',
      classes: (el.className || '').toString().trim(),
      ariaLabel: el.getAttribute ? (el.getAttribute('aria-label') || '') : '',
      title: el.getAttribute ? (el.getAttribute('title') || '') : '',
      dataTestId: el.getAttribute ? (el.getAttribute('data-testid') || '') : '',
      role: el.getAttribute ? (el.getAttribute('role') || '') : '',
      selector: this.getUniqueSelector(el),
      xpath: this.getElementXPath(el),
      text: ((el.innerText || el.textContent || '') + '').trim().replace(/\s+/g, ' ').substring(0, 60),
      reactComponentName: reactInfo.componentName,
      reactHandlers: reactInfo.handlers,
      reactPropsSummary: reactInfo.propsKeys.join(', '),
      rect: {
        x: Math.round(rect.x || 0),
        y: Math.round(rect.y || 0),
        width: Math.round(rect.width || 0),
        height: Math.round(rect.height || 0)
      }
    };
  }

  /**
   * Classifica automaticamente se o elemento clicado corresponde a um controle central do FLOW
   * @param {HTMLElement} el - Elemento clicado
   * @param {Object} fp - Fingerprint do elemento
   */
  autoClassifyAndLearnElement(el, fp) {
    if (!el || !fp) return;
    const lowerText = (fp.text || '').toLowerCase();
    const lowerAria = (fp.ariaLabel || '').toLowerCase();

    // 1. Campo de inserção de prompt (Passo 1)
    if (el.tagName === 'TEXTAREA' || el.getAttribute('contenteditable') === 'true' || fp.classes.includes('prompt')) {
      this.learnSelector('promptInput', el);
    }
    // 2. Botão de submissão/criação do FLOW (Passo 6)
    else if (lowerAria.includes('criar') || lowerAria.includes('gerar') || lowerAria.includes('send') || lowerText === 'arrow_forward' || lowerText.includes('gerar')) {
      this.learnSelector('submitButton', el);
    }
    // 3. Botão "+" de anexar mídia/personagens (Passo 3)
    else if ((fp.rect.y > window.innerHeight - 350) && (fp.rect.x > 150) && (lowerText === '+' || lowerText.includes('adicionar') || lowerAria.includes('adicionar') || lowerAria.includes('recurso'))) {
      this.learnSelector('plusButton', el);
    }
    // 4. Botão "Reutilizar comando" (Passo 7)
    else if (lowerAria.includes('reutilizar') || lowerText.includes('replay') || lowerText.includes('edit_note')) {
      this.learnSelector('reuseButton', el);
    }
    // 5. Botão "+ Novo projeto" no Hub inicial (somente botão real, nunca cards de projeto)
    else if (FlowMacroEngine.isFlowHubPage() && el.tagName === 'BUTTON' && !el.querySelector('img') && !el.closest('[class*="card" i]') && (lowerText.includes('add_2') || lowerText.includes('add')) && lowerText.includes('novo projeto')) {
      this.learnSelector('newProjectButton', el);
    }
  }

  /**
   * Salva o seletor aprendido na memória e persiste no storage local
   * @param {string} actionKey - Chave da ação ('promptInput', 'submitButton', 'plusButton', etc.)
   * @param {HTMLElement} el - Elemento identificado
   */
  learnSelector(actionKey, el) {
    if (!el || el.nodeType !== 1) return;
    const fp = this.captureElementFingerprint(el);
    this.learnedSelectors[actionKey] = fp;
    this.scheduleSaveState();
  }

  /**
   * Localiza um elemento na página usando os seletores previamente aprendidos
   * @param {string} actionKey - Chave da ação
   * @returns {HTMLElement|null} - Elemento encontrado ou null
   */
  resolveLearnedSelector(actionKey) {
    const fp = this.learnedSelectors[actionKey];
    if (!fp) return null;

    // Tenta primeiro o seletor CSS
    if (fp.selector) {
      try {
        const el = document.querySelector(fp.selector);
        if (el && FlowMacroEngine.isElementVisible(el) && !el.closest('[id*="fd-"], [class*="fd-"]')) {
          return el;
        }
      } catch (e) { /* ignora */ }
    }

    // Fallback: Tenta XPath
    if (fp.xpath) {
      try {
        const res = document.evaluate(fp.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        if (res.singleNodeValue && FlowMacroEngine.isElementVisible(res.singleNodeValue) && !res.singleNodeValue.closest('[id*="fd-"], [class*="fd-"]')) {
          return res.singleNodeValue;
        }
      } catch (e) { /* ignora */ }
    }

    return null;
  }

  /**
   * Exporta um relatório completo de telemetria e diagnóstico do DOM em formato JSON
   * @returns {boolean}
   */
  exportTelemetryReport() {
    try {
      const seen = new WeakSet();
      const safeReplacer = (key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        if (typeof value === 'function') return undefined;
        if (typeof value === 'string' && value.length > 500000) {
          return value.substring(0, 100) + '... [TRUNCATED]';
        }
        return value;
      };

      const data = {
        title: 'FLOW Macro Studio - Relatório de Telemetria e Diagnóstico DOM',
        exportedAt: new Date().toISOString(),
        url: window.location.href,
        projectId: FlowMacroEngine.getCurrentProjectId(),
        pageType: {
          isProjectPage: FlowMacroEngine.isFlowProjectPage(),
          isCharactersPage: FlowMacroEngine.isFlowCharactersPage(),
          isHubPage: FlowMacroEngine.isFlowHubPage()
        },
        config: this.config,
        charactersCount: (this.characters || []).length,
        learnedSelectors: this.learnedSelectors,
        domDiagnostics: this.diagnoseFlowDOM(),
        recentLogs: this.logs.slice(-50),
        telemetryEvents: (this.telemetryEvents || []).slice(0, 150)
      };

      const jsonString = JSON.stringify(data, safeReplacer, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `flow_telemetria_diagnostico_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();

      setTimeout(() => {
        try {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        } catch (e) { /* ignora */ }
      }, 1000);

      this.addLog('📥 Relatório de telemetria exportado com sucesso!', 'success');
      return true;
    } catch (e) {
      console.error('[FLOW Macro] Erro ao exportar telemetria:', e);
      this.addLog(`❌ Erro ao exportar telemetria: ${e.message}`, 'error');
      return false;
    }
  }

  /**
   * Limpa o buffer de eventos de telemetria
   */
  clearTelemetry() {
    this.telemetryEvents = [];
    this.notify();
  }

  /**
   * Redefine o mapa de seletores aprendidos
   */
  clearLearnedSelectors() {
    this.learnedSelectors = {};
    this.saveState();
    this.notify();
    this.addLog('🧹 Seletores aprendidos foram redefinidos.', 'info');
  }

  /**
   * Exporta toda a biblioteca de personagens para um arquivo JSON baixável
   * @returns {boolean}
   */
  exportCharactersToJson() {
    try {
      const jsonString = JSON.stringify(this.characters || [], null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const dlAnchorElem = document.createElement('a');
      dlAnchorElem.setAttribute("href", url);
      dlAnchorElem.setAttribute("download", `flow_personagens_backup_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(dlAnchorElem);
      dlAnchorElem.click();

      setTimeout(() => {
        try {
          document.body.removeChild(dlAnchorElem);
          URL.revokeObjectURL(url);
        } catch (e) { /* ignora */ }
      }, 1000);

      return true;
    } catch (err) {
      console.error('[FLOW Macro] Erro ao exportar personagens:', err);
      return false;
    }
  }

  /**
   * Importa uma biblioteca de personagens a partir de um JSON
   * @param {string|Array} jsonData - String JSON ou Array de personagens
   * @returns {boolean}
   */
  importCharactersFromJson(jsonData) {
    try {
      const list = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
      if (!Array.isArray(list)) return false;

      // Valida itens obrigatórios
      const valid = list.filter(c => c && typeof c === 'object' && c.name);
      if (valid.length === 0) return false;

      // Mescla evitando duplicados por ID ou nome
      valid.forEach(c => {
        const existingIdx = this.characters.findIndex(item => item.id === c.id || item.name.toLowerCase() === c.name.toLowerCase());
        if (existingIdx !== -1) {
          this.characters[existingIdx] = { ...this.characters[existingIdx], ...c };
        } else {
          this.characters.push({
            id: c.id || `char_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: c.name,
            avatarUrl: c.avatarUrl || '',
            promptTag: c.promptTag || '',
            enabled: c.enabled !== false
          });
        }
      });

      this.saveState();
      return true;
    } catch (err) {
      console.error('[FLOW Macro] Erro ao importar personagens:', err);
      return false;
    }
  }

  // =========================================================================
  // Gerenciamento de Ouvintes (Observers) e Notificações de UI
  // =========================================================================

  /**
   * Inscreve um componente de interface para receber atualizações em tempo real do motor
   * @param {Function} listener - Callback que recebe o estado completo (getState)
   * @returns {Function} - Função de desinscrição (unsubscribe)
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notifica todos os ouvintes inscritos sobre mudanças no estado do motor
   */
  notify() {
    for (const listener of this.listeners) {
      try {
        listener(this.getState());
      } catch (e) {
        console.error('[FLOW Macro Engine] Erro no ouvinte de notificação:', e);
      }
    }
  }

  // =========================================================================
  // Funções Utilitárias de Tempo, Cronômetro e Delays Parametrizados
  // =========================================================================

  /**
   * Formata segundos totais no padrão HH:MM:SS ou MM:SS
   * @param {number} totalSec - Total de segundos
   * @returns {string} - String formatada (ex: "01:15" ou "01:02:40")
   */
  static formatDuration(totalSec) {
    const s = Math.max(0, parseInt(totalSec, 10) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = s % 60;
    if (hrs > 0) {
      return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Inicia o cronômetro ativo da macro (atualiza a cada 1 segundo)
   */
  startTicker() {
    if (this.tickerInterval) clearInterval(this.tickerInterval);
    this.tickerInterval = setInterval(() => {
      if (this.state === 'running' && this.startTime > 0) {
        this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
        this.notify();
      }
    }, 1000);
  }

  /**
   * Para o cronômetro da macro
   */
  stopTicker() {
    if (this.tickerInterval) {
      clearInterval(this.tickerInterval);
      this.tickerInterval = null;
    }
  }

  /**
   * Mantém a aba ativa em segundo plano sem throttling do Google Chrome
   * Utiliza AudioContext com ganho inaudível e Web Worker com heartbeat
   */
  startBackgroundKeepAlive() {
    try {
      if (this._keepAliveActive) return;
      this._keepAliveActive = true;

      // 1. Silent Web Audio: Sinaliza ao Chrome prioridade de reprodução de mídia,
      // isentando a aba de congelamento (Memory Saver) e throttling de temporizadores (1ms de precisão)
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        if (!this._audioCtx || this._audioCtx.state === 'closed') {
          this._audioCtx = new AudioCtx();
        }
        if (this._audioCtx.state === 'suspended') {
          this._audioCtx.resume().catch(() => {});
        }
        const osc = this._audioCtx.createOscillator();
        const gain = this._audioCtx.createGain();
        gain.gain.value = 0.00001; // Inaudível para o usuário, mas registra atividade de áudio no Chrome
        osc.connect(gain);
        gain.connect(this._audioCtx.destination);
        osc.start();
        this._audioOsc = osc;
        this._audioGain = gain;
      }

      // 2. Extension Port Keep-Alive: Mantém o canal de comunicação ativo com o Service Worker da extensão
      // sem violar as regras de CSP (Content Security Policy) do Google FLOW
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.connect) {
          if (!this._keepAlivePort) {
            this._keepAlivePort = chrome.runtime.connect({ name: 'flow-keepalive' });
            this._keepAlivePort.onDisconnect.addListener(() => {
              this._keepAlivePort = null;
            });
          }
        }
      } catch (pErr) {}

      console.log('[FLOW Macro] Keep-Alive de segundo plano ATIVADO (AudioContext + Extension Port).');
    } catch (e) {
      console.warn('[FLOW Macro] Aviso ao iniciar Keep-Alive:', e);
    }
  }

  /**
   * Desativa os recursos de Keep-Alive ao pausar ou parar a macro
   */
  stopBackgroundKeepAlive() {
    try {
      this._keepAliveActive = false;
      if (this._audioOsc) {
        try { this._audioOsc.stop(); } catch (e) {}
        this._audioOsc = null;
      }
      if (this._audioCtx && this._audioCtx.state !== 'closed') {
        try { this._audioCtx.close(); } catch (e) {}
        this._audioCtx = null;
      }
      if (this._keepAlivePort) {
        try { this._keepAlivePort.disconnect(); } catch (e) {}
        this._keepAlivePort = null;
      }
      console.log('[FLOW Macro] Keep-Alive de segundo plano DESATIVADO.');
    } catch (e) {}
  }

  /**
   * Micro-delay de segurança entre ações atômicas dentro do FLOW
   * Permite que o DOM e os hooks do React processem as mudanças visuais
   * @param {number|null} customMs - Milissegundos customizados (opcional, padrão: actionDelayMs)
   * @param {string} actionName - Descrição da ação atual para atualizar a interface
   */
  async stepDelay(customMs = null, actionName = '') {
    if (this.isStopped || this.state !== 'running') return;
    const ms = customMs !== null ? customMs : (parseInt(this.config.actionDelayMs, 10) || 500);
    if (actionName) {
      this.currentAction = actionName;
      this.notify();
    }
    await new Promise(r => { this.timer = setTimeout(r, ms); });
    if (this.isStopped || this.state !== 'running') return;
  }

  /**
   * Contador regressivo ao vivo em tempo real entre um slide e outro ou entre carrosséis
   * Exibe mensagens no log e na barra de progresso (ex: "⏳ Próximo Slide em 15s...")
   * @param {number} seconds - Segundos a aguardar
   * @param {string} label - Rótulo da contagem (ex: "Próximo Slide (2/5)")
   */
  async waitWithCountdown(seconds, label = 'Próxima ação') {
    const total = Math.max(1, parseInt(seconds, 10) || 1);
    this.countdown = { remaining: total, total, label };
    this.currentAction = `⏳ ${label} em ${total}s...`;
    this.notify();

    for (let rem = total; rem > 0; rem--) {
      if (this.isStopped || this.state !== 'running') break;
      this.countdown = { remaining: rem, total, label };
      this.currentAction = `⏳ ${label} em ${rem}s...`;
      this.notify();

      // Registra no log no início, a cada 10s e nos segundos finais (5s, 3s)
      if (rem === total || rem % 10 === 0 || rem === 5 || rem === 3) {
        this.addLog(`⏳ ${label} em ${rem}s...`, 'info');
      }

      await new Promise(r => { this.timer = setTimeout(r, 1000); });
      if (this.isStopped || this.state !== 'running') break;
    }

    this.countdown = { remaining: 0, total: 0, label: '' };
    this.currentAction = '';
    this.notify();
  }

  /**
   * Retorna uma cópia do estado completo do motor para a interface
   * @returns {Object} - Estado consolidado
   */
  getState() {
    // Filtra apenas os slides que serão realmente executados (dos carrosséis ativos)
    let activeSlides = [];
    const activeCarousels = this.carousels.filter(c => c.enabled !== false);
    if (activeCarousels.length > 0) {
      activeCarousels.forEach(c => {
        const slides = (c.slides || []).filter(s => s.enabled !== false);
        activeSlides.push(...slides);
      });
    } else {
      activeSlides = this.prompts.filter(p => p.enabled !== false);
    }

    const totalPrompts = activeSlides.length;
    const completedCount = activeSlides.filter(p => p.status === 'completed').length;
    const defaultRepeats = parseInt(this.config.repeatPerPrompt, 10) || 1;
    const totalGenerations = activeSlides.reduce((acc, p) => {
      const pRep = parseInt(p.repeatCount, 10);
      return acc + ((pRep && pRep > 1) ? pRep : defaultRepeats);
    }, 0);
    const completedGenerations = activeSlides.reduce((acc, p) => acc + (parseInt(p.completedRepeats, 10) || 0), 0);

    const elapsed = this.startTime > 0 ? Math.floor((Date.now() - this.startTime) / 1000) : this.elapsedSeconds;

    return {
      state: this.state,
      currentIndex: this.currentIndex,
      startTime: this.startTime,
      elapsedSeconds: elapsed,
      elapsedFormatted: FlowMacroEngine.formatDuration(elapsed),
      currentAction: this.currentAction,
      countdown: { ...this.countdown },
      totalPrompts,
      completedCount,
      totalGenerations,
      completedGenerations,
      prompts: [...this.prompts],
      characters: [...this.characters],
      config: { ...this.config },
      logs: [...this.logs],
      carousels: [...this.carousels]
    };
  }

  /**
   * Adiciona uma mensagem ao log de execução da extensão com timestamp e tempo decorrido
   * @param {string} message - Mensagem do log
   * @param {string} type - Tipo: 'info' | 'success' | 'warning' | 'error'
   */
  addLog(message, type = 'info') {
    const now = new Date();
    const time = now.toLocaleTimeString();
    const elapsedSec = this.startTime > 0 ? Math.floor((Date.now() - this.startTime) / 1000) : this.elapsedSeconds;
    const elapsedStr = FlowMacroEngine.formatDuration(elapsedSec);
    const timeDisplay = this.startTime > 0 ? `[${time} • +${elapsedStr}]` : `[${time}]`;

    const entry = { 
      time, 
      elapsed: elapsedStr,
      timeDisplay,
      message, 
      type, 
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}` 
    };
    
    this.logs.unshift(entry);
    if (this.logs.length > 150) this.logs.pop(); // Mantém no máximo 150 logs na memória
    this.notify();
  }

  /**
   * Envia uma mensagem formatada para o bot do Telegram configurado
   * @param {string} text - Conteúdo da mensagem em Markdown
   * @returns {Promise<boolean>}
   */
  async sendTelegramNotification(text) {
    if (!this.config || !this.config.telegramEnabled) return false;
    const token = (this.config.telegramBotToken || '').trim();
    const chatId = (this.config.telegramChatId || '').trim();

    if (!token || !chatId) {
      console.warn('[Telegram Notifier] Token ou Chat ID não preenchido.');
      return false;
    }

    let safeText = (text || '').trim();
    if (safeText.length > 4000) {
      safeText = safeText.substring(0, 3950) + '\n\n... [Mensagem longa truncada pelo Telegram]';
    }

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: safeText,
          parse_mode: 'Markdown'
        })
      });

      const data = await res.json();
      if (!data.ok) {
        // Se a falha foi por parsing de entidades markdown no prompt, tenta enviar sem parse_mode
        if ((data.description || '').toLowerCase().includes('entities')) {
          const retryRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: safeText
            })
          });
          const retryData = await retryRes.json();
          if (retryData.ok) return true;
        }

        console.warn('[Telegram Notifier] Erro retornado pela API:', data.description);
        this.addLog(`⚠️ Telegram API: ${data.description}`, 'warning');
        return false;
      }
      return true;
    } catch (e) {
      console.error('[Telegram Notifier] Erro de requisição:', e);
      this.addLog(`⚠️ Erro de conexão com Telegram: ${e.message}`, 'warning');
      return false;
    }
  }

  /**
   * Converte uma fonte de imagem (Data URL, Blob, URL HTTP ou elemento) em um Blob otimizado
   * Se maxDim for fornecido, redimensiona proporcionalmente via Canvas
   * @param {string|Blob|HTMLImageElement} source
   * @param {number} [maxDim=null] - Dimensão máxima (largura/altura)
   * @returns {Promise<Blob|null>}
   */
  async imageSourceToBlob(source, maxDim = null) {
    if (!source) return null;
    if (typeof Blob !== 'undefined' && source instanceof Blob) {
      return source;
    }

    // Se estiver no navegador e puder desenhar via canvas
    if (typeof Image !== 'undefined' && typeof document !== 'undefined') {
      try {
        const blobFromCanvas = await new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            try {
              let w = img.naturalWidth || img.width || 200;
              let h = img.naturalHeight || img.height || 200;

              if (maxDim && (w > maxDim || h > maxDim)) {
                if (w > h) {
                  h = Math.round((h * maxDim) / w);
                  w = maxDim;
                } else {
                  w = Math.round((w * maxDim) / h);
                  h = maxDim;
                }
              }

              // Garante dimensões mínimas aceitas pelo Telegram
              w = Math.max(w, 60);
              h = Math.max(h, 60);

              const canvas = document.createElement('canvas');
              canvas.width = w;
              canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0, w, h);
              canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
            } catch (err) {
              resolve(null);
            }
          };
          img.onerror = () => resolve(null);
          img.src = typeof source === 'string' ? source : (source.src || '');
        });

        if (blobFromCanvas) return blobFromCanvas;
      } catch (e) {}
    }

    // Fallback: fetch direto da URL para blob
    if (typeof source === 'string') {
      try {
        const res = await fetch(source);
        if (res.ok) {
          return await res.blob();
        }
      } catch (e) {}
    }

    return null;
  }

  /**
   * Envia uma foto com legenda para o bot do Telegram usando FormData e Blob binário
   * @param {string|Blob} photoSource - URL, Data URL ou Blob da foto
   * @param {string} caption - Legenda em Markdown (máximo 1000 caracteres)
   * @param {number} [maxDim=null] - Dimensão máxima de redimensionamento
   * @returns {Promise<boolean>}
   */
  async sendTelegramPhoto(photoSource, caption = '', maxDim = null) {
    if (!this.config || !this.config.telegramEnabled) return false;
    const token = (this.config.telegramBotToken || '').trim();
    const chatId = (this.config.telegramChatId || '').trim();

    if (!token || !chatId || !photoSource) {
      return false;
    }

    try {
      let safeCaption = (caption || '').trim();
      if (safeCaption.length > 1000) {
        safeCaption = safeCaption.substring(0, 990) + '...';
      }

      const blob = await this.imageSourceToBlob(photoSource, maxDim);
      const url = `https://api.telegram.org/bot${token}/sendPhoto`;

      // Tentativa 1: Envio via FormData com Blob binário
      if (blob) {
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('photo', blob, 'photo.jpg');
        if (safeCaption) {
          formData.append('caption', safeCaption);
          formData.append('parse_mode', 'Markdown');
        }

        const res = await fetch(url, {
          method: 'POST',
          body: formData
        });

        const data = await res.json();
        if (data.ok) return true;

        // Se falhou por entidades markdown na legenda, tenta novamente sem parse_mode
        if (!data.ok && safeCaption && (data.description || '').toLowerCase().includes('entities')) {
          const retryFormData = new FormData();
          retryFormData.append('chat_id', chatId);
          retryFormData.append('photo', blob, 'photo.jpg');
          retryFormData.append('caption', safeCaption);
          const retryRes = await fetch(url, { method: 'POST', body: retryFormData });
          const retryData = await retryRes.json();
          if (retryData.ok) return true;
        }

        console.warn('[Telegram Notifier] Falha no envio de foto FormData:', data.description);
      }

      // Tentativa 2: Se photoSource for URL HTTP externa, tenta enviar diretamente a URL
      if (typeof photoSource === 'string' && photoSource.startsWith('http')) {
        const jsonBody = {
          chat_id: chatId,
          photo: photoSource
        };
        if (safeCaption) {
          jsonBody.caption = safeCaption;
          jsonBody.parse_mode = 'Markdown';
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonBody)
        });

        const data = await res.json();
        if (data.ok) return true;
      }

      // Se não conseguiu enviar a imagem, garante que a mensagem de texto com o relatório seja entregue
      if (safeCaption) {
        return await this.sendTelegramNotification(safeCaption);
      }

      return false;
    } catch (e) {
      console.warn('[Telegram Notifier] Erro no envio de foto:', e);
      if (caption) {
        return await this.sendTelegramNotification(caption);
      }
      return false;
    }
  }

  /**
   * Identifica os personagens cadastrados envolvidos no carrossel atual
   * @param {Object} carousel
   * @returns {Array<Object>}
   */
  getInvolvedCharactersForCarousel(carousel) {
    if (!this.characters || this.characters.length === 0) return [];

    // Se o carrossel possuir lista explícita de personagens configurada
    if (carousel && Array.isArray(carousel.characters) && carousel.characters.length > 0) {
      return carousel.characters.filter(c => c && c.enabled !== false);
    }

    // Se a configuração de personagens globais estiver ativa
    if (this.config.applyGlobalCharacters !== false) {
      return this.characters.filter(c => c && c.enabled !== false);
    }

    return [];
  }

  /**
   * Envia miniaturas dos personagens envolvidos no início do carrossel para o Telegram
   * @param {Object} carousel - Objeto do carrossel atual
   * @param {number} currentNum - Índice do carrossel atual (1-based)
   * @param {number} totalNum - Total de carrosséis na fila
   */
  async sendTelegramCarouselCharacters(carousel, currentNum, totalNum) {
    if (!this.config || !this.config.telegramEnabled || this.config.telegramSendCharacterThumbnails === false) {
      return;
    }

    const involvedChars = this.getInvolvedCharactersForCarousel(carousel);
    if (!involvedChars || involvedChars.length === 0) return;

    this.addLog(`✈️ [Telegram] Enviando miniaturas de ${involvedChars.length} personagem(ns) do carrossel...`, 'info');

    for (let i = 0; i < involvedChars.length; i++) {
      if (this.isStopped || this.state !== 'running') break;
      const char = involvedChars[i];
      const caption = 
        `🎭 *Personagem do Carrossel*\n` +
        `• *Nome:* ${char.name}\n` +
        `• *Carrossel ${currentNum}/${totalNum}:* ${carousel.title || 'Sem título'}` +
        (char.promptTag ? `\n• *Tag:* \`${char.promptTag}\`` : '');

      if (char.avatarUrl) {
        // Redimensiona para miniatura pequena (~200px)
        await this.sendTelegramPhoto(char.avatarUrl, caption, 200);
      } else {
        await this.sendTelegramNotification(caption);
      }

      // Pequena pausa entre envios para respeitar rate-limit da API do Telegram
      if (i + 1 < involvedChars.length) {
        await new Promise(r => setTimeout(r, 600));
      }
    }
  }

  /**
   * Obtém a URL ou src da imagem gerada mais recente no Canvas do FLOW
   * @returns {string|null}
   */
  findLatestGeneratedImageUrl() {
    try {
      // 1. Tenta usar o utilitário global exposto no content.js
      if (typeof window !== 'undefined' && typeof window.flowFindGeneratedImages === 'function') {
        const items = window.flowFindGeneratedImages();
        if (items && items.length > 0) {
          return items[0].url || items[0].id || (items[0].img ? (items[0].img.currentSrc || items[0].img.src) : null);
        }
      }

      // 2. Fallback direto varrendo imagens do DOM que atendem aos critérios do Canvas
      const allImgs = Array.from(document.querySelectorAll('img')).filter(img => {
        if (!FlowMacroEngine.isElementVisible(img)) return false;
        if (img.closest('[id*="fd-"], [class*="fd-"], [role="dialog"], [class*="modal" i], header, nav')) return false;
        const src = (img.currentSrc || img.src || '').toLowerCase();
        if (!src || src.startsWith('data:image/svg') || src.includes('avatar') || src.includes('profile') || src.includes('icon')) return false;
        if ((img.naturalWidth > 0 && img.naturalWidth < 80) || (img.width > 0 && img.width < 80)) return false;
        return true;
      });

      if (allImgs.length > 0) {
        return allImgs[0].currentSrc || allImgs[0].src;
      }
    } catch (e) {
      console.warn('[FLOW Macro] Erro ao buscar imagem gerada:', e);
    }
    return null;
  }

  /**
   * Tenta detectar automaticamente o Chat ID lendo as atualizações do bot
   * @param {string} [customToken] - Token opcional para teste
   * @returns {Promise<{ chatId: string, firstName: string, username: string }>}
   */
  async detectTelegramChatId(customToken) {
    const token = (customToken || this.config.telegramBotToken || '').trim();
    if (!token) throw new Error('Insira o Bot Token primeiro.');

    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
    const data = await res.json();

    if (!data.ok) {
      throw new Error(data.description || 'Erro ao conectar à API do Telegram');
    }

    if (!data.result || data.result.length === 0) {
      throw new Error('Nenhuma mensagem encontrada! Abra o bot no seu Telegram (@Gerador_posts_bot), clique em "Começar" (ou envie uma mensagem) e tente novamente.');
    }

    // Procura a mensagem mais recente que tenha chat.id
    for (let i = data.result.length - 1; i >= 0; i--) {
      const u = data.result[i];
      const msg = u.message || u.channel_post || u.edited_message || (u.callback_query && u.callback_query.message);
      if (msg && msg.chat && msg.chat.id) {
        return {
          chatId: String(msg.chat.id),
          firstName: msg.chat.first_name || msg.chat.title || '',
          username: msg.chat.username || ''
        };
      }
    }

    throw new Error('Não foi possível identificar o Chat ID nas mensagens recebidas.');
  }

  // =========================================================================
  // Operações na Lista de Prompts e Slides
  // =========================================================================
  
  /**
   * Define a lista de prompts a serem executados
   * @param {Array<Object>} prompts - Lista de prompts
   */
  setPrompts(prompts) {
    this.prompts = prompts.map((p, idx) => ({
      ...p,
      index: idx + 1,
      repeatCount: parseInt(p.repeatCount, 10) || parseInt(this.config.repeatPerPrompt, 10) || 1,
      completedRepeats: 0,
      status: p.status || 'pending',
      enabled: p.enabled !== false
    }));
    this.currentIndex = -1;
    this.addLog(`Carregados ${this.prompts.length} prompts na sequência.`, 'info');
    this.saveState();
  }

  addPrompt(item) {
    const defaultReps = parseInt(this.config.repeatPerPrompt, 10) || 1;
    const pRep = parseInt(item.repeatCount, 10);
    const newItem = {
      id: `prompt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      index: this.prompts.length + 1,
      title: item.title || `Prompt #${this.prompts.length + 1}`,
      fullText: item.fullText || '',
      balloonText: item.balloonText || '',
      imagePrompt: item.imagePrompt || item.fullText || '',
      repeatCount: (pRep && pRep > 1) ? pRep : defaultReps,
      completedRepeats: 0,
      enabled: true,
      status: 'pending',
      characters: item.characters || []
    };
    this.prompts.push(newItem);
    if (Array.isArray(this.carousels) && this.carousels.length > 0) {
      const c = this.carousels[0];
      if (!Array.isArray(c.slides)) c.slides = [];
      c.slides.push(newItem);
      c.slidesCount = c.slides.length;
    }
    this.saveState();
  }

  setGlobalRepeatCount(count) {
    const num = Math.max(1, Math.min(100, parseInt(count, 10) || 1));
    this.config.repeatPerPrompt = num;
    this.prompts.forEach(p => {
      p.repeatCount = num;
    });
    if (Array.isArray(this.carousels)) {
      this.carousels.forEach(c => {
        if (Array.isArray(c.slides)) {
          c.slides.forEach(s => {
            s.repeatCount = num;
          });
        }
      });
    }
    this.addLog(`Repetições globais ajustadas para: ${num}x por prompt.`, 'info');
    this.saveState();
  }

  updatePrompt(id, updates) {
    const idx = this.prompts.findIndex(p => p.id === id);
    if (idx !== -1) {
      this.prompts[idx] = { ...this.prompts[idx], ...updates };
    }
    if (Array.isArray(this.carousels)) {
      this.carousels.forEach(c => {
        if (Array.isArray(c.slides)) {
          const sIdx = c.slides.findIndex(s => s.id === id);
          if (sIdx !== -1) {
            c.slides[sIdx] = { ...c.slides[sIdx], ...updates };
          }
        }
      });
    }
    this.saveState();
    this.notify();
  }

  removePrompt(id) {
    this.prompts = this.prompts.filter(p => p.id !== id);
    this.prompts.forEach((p, idx) => p.index = idx + 1);
    if (Array.isArray(this.carousels)) {
      this.carousels.forEach(c => {
        if (Array.isArray(c.slides)) {
          c.slides = c.slides.filter(s => s.id !== id);
          c.slidesCount = c.slides.length;
        }
      });
    }
    this.saveState();
    this.notify();
  }

  clearPrompts() {
    this.prompts = [];
    this.carousels = [];
    this.currentIndex = -1;
    this.state = 'idle';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('flow_macro_prompts_backup', JSON.stringify([]));
      localStorage.setItem('flow_macro_carousels_backup', JSON.stringify([]));
    }
    this.addLog('Fila de prompts limpa.', 'info');
    this.saveState();
    this.notify();
  }

  resetPromptStatuses() {
    this.prompts.forEach(p => {
      p.status = 'pending';
      p.completedRepeats = 0;
      p.errorMsg = '';
    });
    this.currentIndex = -1;
    this.state = 'idle';
    this.addLog('Status dos prompts e repetições redefinidos para Pendente.', 'info');
    this.saveState();
  }

  // =========================================================================
  // Operações com Personagens de Referência Predefinidos
  // =========================================================================
  
  addCharacter(name, avatarUrl = '', promptTag = '') {
    const char = {
      id: `char_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name || 'Novo Personagem',
      avatarUrl: avatarUrl || '',
      promptTag: promptTag || '',
      enabled: true
    };
    this.characters.push(char);
    this.addLog(`Personagem adicionado: ${char.name}`, 'info');
    this.saveState();
    return char;
  }

  updateCharacter(id, updates) {
    const idx = this.characters.findIndex(c => c.id === id);
    if (idx !== -1) {
      this.characters[idx] = { ...this.characters[idx], ...updates };
      this.saveState();
    }
  }

  removeCharacter(id) {
    this.characters = this.characters.filter(c => c.id !== id);
    this.saveState();
  }

  // =========================================================================
  // Configurações Globais
  // =========================================================================
  
  updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    if ('aspectRatio' in updates || 'mediaType' in updates || 'quantity' in updates || 'model' in updates) {
      this.settingsConfiguredForProject = false;
      this.lastConfiguredProjectId = null;
    }
    if ('repeatPerPrompt' in updates) {
      const num = Math.max(1, Math.min(100, parseInt(updates.repeatPerPrompt, 10) || 1));
      this.config.repeatPerPrompt = num;
      this.prompts.forEach(p => {
        p.repeatCount = num;
      });
      if (Array.isArray(this.carousels)) {
        this.carousels.forEach(c => {
          if (Array.isArray(c.slides)) {
            c.slides.forEach(s => {
              s.repeatCount = num;
            });
          }
        });
      }
    }
    this.saveState();
  }

  // =========================================================================
  // Localizadores de Elementos do DOM do Google FLOW (Resilientes a Atualizações)
  // =========================================================================
  
  /**
   * Localiza o campo de prompt de texto ativo na página do FLOW (Passo 1)
   * Suporta Slate.js, ContentEditable e Textarea
   * @returns {HTMLElement|null}
   */
  findPromptInput() {
    // 0. Verifica primeiro se há um seletor aprendido pelo gravador
    const learned = this.resolveLearnedSelector('promptInput');
    if (learned && FlowMacroEngine.isElementVisible(learned) && !learned.closest('[id*="fd-"], [class*="fd-"]')) {
      const inner = learned.querySelector('[contenteditable="true"], textarea, [role="textbox"]');
      return inner || learned;
    }

    // Prioridade 1: Container exato do editor Slate.js do FLOW gravado no DevTools
    const exactSlate = document.querySelector('div.sc-5c3af813-3 [contenteditable="true"], div.sc-5c3af813-3 textarea, div.sc-5c3af813-3 > div, [data-slate-editor="true"]');
    if (exactSlate && FlowMacroEngine.isElementVisible(exactSlate) && !exactSlate.closest('[id*="fd-"], [class*="fd-"]')) {
      const inner = exactSlate.querySelector('[contenteditable="true"], textarea, [role="textbox"]');
      return inner || exactSlate;
    }

    // Prioridade 2: Textarea com placeholder de prompt
    const textarea = document.querySelector('textarea, [role="textbox"], input[type="text"][placeholder*="prompt" i], input[type="text"][placeholder*="descrever" i]');
    if (textarea && FlowMacroEngine.isElementVisible(textarea)) {
      return textarea;
    }

    // Prioridade 3: Div ContentEditable genérica
    const contentEditable = document.querySelector('[contenteditable="true"], div.ProseMirror, div[role="combobox"]');
    if (contentEditable && FlowMacroEngine.isElementVisible(contentEditable)) {
      return contentEditable;
    }

    // Fallback: Qualquer textarea visível na página fora da extensão
    const allTextareas = Array.from(document.querySelectorAll('textarea'));
    const visibleTextarea = allTextareas.find(el => FlowMacroEngine.isElementVisible(el) && !el.closest('[id*="fd-"], [class*="fd-"]'));
    if (visibleTextarea) {
      return visibleTextarea;
    }

    return null;
  }

  /**
   * Limpa e normaliza strings de prompt para o FLOW (preserva quebras de parágrafo e converte PT isolado para PT-BR)
   * @param {string} text - Texto bruto do prompt
   * @returns {string} - Texto normalizado
   */
  static normalizePromptText(text) {
    if (!text || typeof text !== 'string') return '';
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u201C\u201D]/g, '"')
      .replace(/\bPT\b(?!\s*[-_]?\s*BR\b)/gi, 'PT-BR') // Substitui PT isolado por PT-BR sem duplicar
      .split('\n')
      .map(line => line.trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Sanitiza nomes para subpastas de carrosséis
   * @param {string} name - Nome bruto
   * @returns {string} - Nome de pasta seguro
   */
  static sanitizeFolderName(name) {
    if (!name || typeof name !== 'string') return 'Carrossel';
    return name
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 80);
  }

  /**
   * Compara a similaridade visual entre um elemento de imagem (ou canvas) e uma imagem base64/dataURL de referência
   * Utiliza amostragem de pixels em canvas reduzido (32x32) com cálculo de erro quadrático médio (MSE)
   * @param {HTMLImageElement|HTMLElement} imgEl - Elemento de imagem no DOM
   * @param {string} referenceDataUrl - Data URL da imagem de referência (avatar)
   * @returns {Promise<number>} - Porcentagem de similaridade de 0 a 100
   */
  static async computeImageSimilarity(imgEl, referenceDataUrl) {
    if (!imgEl || !referenceDataUrl) return 0;

    // Timeout de segurança: evita bloquear a macro por CORS ou imagens lentas
    const SIMILARITY_TIMEOUT_MS = 3000;

    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(0), SIMILARITY_TIMEOUT_MS);

      try {
        const targetSrc = imgEl.getAttribute('src') || imgEl.src || '';
        if (!targetSrc) { clearTimeout(timer); return resolve(0); }

        // Rejeita URLs que redirecionam para login do Google (causam CORS)
        if (targetSrc.includes('accounts.google.com') || targetSrc.includes('/ServiceLogin')) {
          clearTimeout(timer);
          return resolve(0);
        }

        const refImg = new Image();
        refImg.crossOrigin = 'anonymous';

        refImg.onload = () => {
          try {
            const size = 32;
            const c1 = document.createElement('canvas');
            c1.width = size;
            c1.height = size;
            const ctx1 = c1.getContext('2d', { willReadFrequently: true });
            ctx1.drawImage(refImg, 0, 0, size, size);
            const d1 = ctx1.getImageData(0, 0, size, size).data;

            const c2 = document.createElement('canvas');
            c2.width = size;
            c2.height = size;
            const ctx2 = c2.getContext('2d', { willReadFrequently: true });

            if (imgEl.tagName === 'IMG' && imgEl.complete && imgEl.naturalWidth > 0) {
              try {
                ctx2.drawImage(imgEl, 0, 0, size, size);
                const d2 = ctx2.getImageData(0, 0, size, size).data;
                const sim = FlowMacroEngine.calculatePixelSimilarity(d1, d2);
                clearTimeout(timer);
                return resolve(sim);
              } catch (e) {
                // Cross-origin taint, continua tentativa via Image()
              }
            }

            const domImg = new Image();
            domImg.crossOrigin = 'anonymous';
            domImg.onload = () => {
              try {
                ctx2.drawImage(domImg, 0, 0, size, size);
                const d2 = ctx2.getImageData(0, 0, size, size).data;
                const sim = FlowMacroEngine.calculatePixelSimilarity(d1, d2);
                clearTimeout(timer);
                resolve(sim);
              } catch (e) {
                clearTimeout(timer);
                resolve(0);
              }
            };
            domImg.onerror = () => { clearTimeout(timer); resolve(0); };

            // Rejeita URLs Google que vão redirecionar para login
            if (targetSrc.includes('googleusercontent.com') && !targetSrc.startsWith('data:')) {
              // Tenta carregar mas com timeout curto (CORS frequente)
              domImg.src = targetSrc;
            } else {
              domImg.src = targetSrc;
            }
          } catch (err) {
            clearTimeout(timer);
            resolve(0);
          }
        };

        refImg.onerror = () => { clearTimeout(timer); resolve(0); };
        refImg.src = referenceDataUrl;
      } catch (err) {
        clearTimeout(timer);
        resolve(0);
      }
    });
  }

  /**
   * Calcula a similaridade entre dois buffers de pixels RGBA (retorna valor de 0 a 100%)
   * @param {Uint8ClampedArray} d1 
   * @param {Uint8ClampedArray} d2 
   * @returns {number}
   */
  static calculatePixelSimilarity(d1, d2) {
    if (!d1 || !d2 || d1.length !== d2.length) return 0;
    let totalDiff = 0;
    const numPixels = d1.length / 4;

    for (let i = 0; i < d1.length; i += 4) {
      if (d1[i + 3] === 0 && d2[i + 3] === 0) continue;

      const rDiff = Math.abs(d1[i] - d2[i]);
      const gDiff = Math.abs(d1[i + 1] - d2[i + 1]);
      const bDiff = Math.abs(d1[i + 2] - d2[i + 2]);
      const aDiff = Math.abs(d1[i + 3] - d2[i + 3]);

      totalDiff += (rDiff + gDiff + bDiff + aDiff) / 4;
    }

    const avgDiff = totalDiff / numPixels;
    const similarity = Math.max(0, 100 - (avgDiff / 2.55));
    return Math.round(similarity * 10) / 10;
  }

  /**
   * Localiza um elemento (botão, ícone, etc.) na página por similaridade visual de pixels
   * Compara a aparência visual de cada candidato com a imagem de referência do banco REFERENCE_IMAGES.
   * @param {string} referenceKey - Chave no banco REFERENCE_IMAGES (ex: 'submitButton')
   * @param {string} [candidateSelector='button, [role="button"], div[tabindex="0"]'] - Seletor CSS dos candidatos
   * @param {number} [minSimilarity=50] - Similaridade mínima para considerar um match (0-100)
   * @returns {Promise<{element: HTMLElement|null, similarity: number}>}
   */
  static async findElementByVisualSimilarity(referenceKey, candidateSelector = 'button, [role="button"], div[tabindex="0"]', minSimilarity = 50) {
    const refDataUrl = FlowMacroEngine.REFERENCE_IMAGES[referenceKey];
    if (!refDataUrl) return { element: null, similarity: 0 };

    const candidates = Array.from(document.querySelectorAll(candidateSelector)).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el)) return false;
      if (el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const rect = el.getBoundingClientRect();
      // Botões muito grandes ou muito pequenos não são o alvo
      if (rect.width < 15 || rect.width > 120 || rect.height < 15 || rect.height > 120) return false;
      // Para o botão "+", o botão fica na barra de comando (metade inferior da tela)
      if (referenceKey === 'plusButton') {
        if (rect.top < 200) return false;
        const text = (el.textContent || el.innerText || '').toLowerCase();
        if (text.includes('banana') || text.includes('agente') || text.includes('agent')) return false;
      }
      return true;
    });

    let bestMatch = null;
    let highestSim = 0;

    for (const el of candidates) {
      try {
        // Captura o visual do elemento via canvas
        const rect = el.getBoundingClientRect();
        const size = 32;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        // Tenta capturar via html2canvas simplificado: desenha o fundo e ícone do elemento
        // Para botões com SVG ou ícone interno, captura a imagem/SVG
        const img = el.querySelector('img, svg');
        if (img && img.tagName === 'IMG' && img.complete && img.naturalWidth > 0) {
          try {
            ctx.drawImage(img, 0, 0, size, size);
          } catch (e) {
            continue;
          }
        } else if (img && img.tagName === 'svg') {
          // Converte SVG para imagem
          try {
            const svgData = new XMLSerializer().serializeToString(img);
            const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const svgImg = await new Promise((resolve, reject) => {
              const i = new Image();
              i.onload = () => resolve(i);
              i.onerror = reject;
              i.src = url;
            });
            ctx.drawImage(svgImg, 0, 0, size, size);
            URL.revokeObjectURL(url);
          } catch (e) {
            continue;
          }
        } else {
          // Sem imagem/svg interno — desenha um retângulo com a cor de fundo do elemento
          try {
            const style = window.getComputedStyle(el);
            ctx.fillStyle = style.backgroundColor || '#ffffff';
            ctx.fillRect(0, 0, size, size);
            // Desenha o ícone de texto (se houver Google Symbols)
            const symbolEl = el.querySelector('.google-symbols, .material-symbols-outlined, i, span');
            if (symbolEl) {
              const symText = (symbolEl.textContent || '').trim();
              ctx.fillStyle = style.color || '#000000';
              ctx.font = `${size * 0.6}px sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(symText.substring(0, 2), size / 2, size / 2);
            }
          } catch (e) {
            continue;
          }
        }

        const elPixels = ctx.getImageData(0, 0, size, size).data;

        // Carrega a referência
        const refPixels = await new Promise((resolve) => {
          const refImg = new Image();
          refImg.onload = () => {
            const refCanvas = document.createElement('canvas');
            refCanvas.width = size;
            refCanvas.height = size;
            const refCtx = refCanvas.getContext('2d', { willReadFrequently: true });
            refCtx.drawImage(refImg, 0, 0, size, size);
            resolve(refCtx.getImageData(0, 0, size, size).data);
          };
          refImg.onerror = () => resolve(null);
          refImg.src = refDataUrl;
        });

        if (!refPixels) continue;

        let sim = FlowMacroEngine.calculatePixelSimilarity(elPixels, refPixels);
        if (referenceKey === 'plusButton') {
          const t = (el.textContent || el.innerText || el.getAttribute('aria-label') || '').toLowerCase();
          if (t.includes('+') || t.includes('add') || t.includes('adicionar') || t.includes('criar')) {
            sim = Math.min(100, sim + 15);
          }
        }
        if (sim > highestSim) {
          highestSim = sim;
          bestMatch = el;
        }
      } catch (e) {
        // Ignora erros de CORS ou canvas tainted
      }
    }

    if (bestMatch && highestSim >= minSimilarity) {
      return { element: bestMatch, similarity: highestSim };
    }

    return { element: null, similarity: highestSim };
  }

  /**
   * Recupera com segurança a instância interna do Slate Editor do React Fiber
   * @param {HTMLElement} element - Elemento DOM do editor
   * @returns {Object|null} - Instância do Slate Editor
   */
  getSlateEditor(element) {
    if (!element) return null;
    try {
      const fiberKey = Object.keys(element).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
      if (fiberKey && element[fiberKey]) {
        let fiber = element[fiberKey];
        for (let i = 0; i < 20 && fiber; i++) {
          if (fiber.memoizedProps && fiber.memoizedProps.editor) {
            return fiber.memoizedProps.editor;
          }
          if (fiber.stateNode && fiber.stateNode.editor) {
            return fiber.stateNode.editor;
          }
          fiber = fiber.return;
        }
      }
      const propsKey = Object.keys(element).find(k => k.startsWith('__reactProps$'));
      if (propsKey && element[propsKey] && element[propsKey].editor) {
        return element[propsKey].editor;
      }
    } catch (e) { /* ignora */ }
    return null;
  }

  /**
   * Apaga completamente qualquer texto anterior presente no campo de prompt
   * Suporta Textarea, Input, Slate.js e ContentEditable com múltiplas camadas de garantia
   * @param {HTMLElement} element - Elemento do campo de prompt
   * @returns {Promise<boolean>}
   */
  async clearPromptInput(element) {
    if (!element) return false;

    try {
      const targetEditable = (element.getAttribute && element.getAttribute('contenteditable') === 'true')
        ? element
        : (element.querySelector('[contenteditable="true"]') || element);

      targetEditable.focus();
      await new Promise(r => setTimeout(r, 40));

      const isInputOrTextarea = targetEditable.tagName.toLowerCase() === 'textarea' || targetEditable.tagName.toLowerCase() === 'input';

      if (isInputOrTextarea) {
        targetEditable.focus();
        targetEditable.select();
        if (typeof targetEditable.setSelectionRange === 'function') {
          targetEditable.setSelectionRange(0, (targetEditable.value || '').length);
        }
        const prototype = Object.getPrototypeOf(targetEditable);
        const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value') ? Object.getOwnPropertyDescriptor(prototype, 'value').set : null;
        if (valueSetter) {
          valueSetter.call(targetEditable, '');
        } else {
          targetEditable.value = '';
        }
        targetEditable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        targetEditable.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      } else {
        // Slate.js / ContentEditable no Google FLOW
        targetEditable.focus();
        await new Promise(r => setTimeout(r, 40));

        // 1. Manipulação direta no Fiber do Slate se acessível (Mais limpo e seguro para React)
        let fiberCleared = false;
        try {
          const editor = this.getSlateEditor(targetEditable);
          if (editor && editor.children && Array.isArray(editor.children)) {
            // Preserva apenas nós reais de chips/anexos de imagens, NUNCA blocos de texto/parágrafos
            const existingChips = editor.children.filter(n => {
              if (!n) return false;
              if (n.type === 'paragraph' || n.type === 'line' || n.type === 'text') return false;
              if (n.children && n.children.length === 1 && typeof n.children[0]?.text === 'string' && !n.url && !n.src && !n.assetId && !n.type) {
                return false;
              }
              return n.type === 'image' || n.type === 'attachment' || n.type === 'asset' || n.type === 'media' || n.type === 'chip' || Boolean(n.url || n.src || n.assetId);
            });
            editor.children = [...existingChips, { type: 'paragraph', children: [{ text: '' }] }];
            if (editor.selection) {
              const pIndex = Math.max(0, editor.children.length - 1);
              editor.selection = {
                anchor: { path: [pIndex, 0], offset: 0 },
                focus: { path: [pIndex, 0], offset: 0 }
              };
            }
            if (typeof editor.onChange === 'function') {
              editor.onChange();
              fiberCleared = true;
            }
          }
        } catch (e) {}

        // Se o editor Slate já foi limpo no Fiber preservando chips, evita o destrutivo selectAll
        if (!fiberCleared) {
          // 2. Simula atalho Ctrl+A / Cmd+A para selecionar tudo
          const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
          targetEditable.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'a',
            code: 'KeyA',
            keyCode: 65,
            which: 65,
            ctrlKey: !isMac,
            metaKey: isMac,
            bubbles: true,
            cancelable: true
          }));

          // 3. Seleção nativa segura (blindada contra DOMException se o nó não estiver no documento)
          try {
            if (targetEditable.isConnected && document.contains(targetEditable) && targetEditable.childNodes.length > 0) {
              const sel = window.getSelection();
              if (sel) {
                const range = document.createRange();
                range.selectNodeContents(targetEditable);
                sel.removeAllRanges();
                sel.addRange(range);
              }
            }
          } catch (e) {
            // Captura e suprime DOMException: 'The given range isn\'t in document'
          }

          // 4. ExecCommand nativo para delete
          try {
            document.execCommand('selectAll', false, null);
            document.execCommand('delete', false, null);
          } catch (e) {}

          // 5. Dispara evento nativo BeforeInput de exclusão (reconhecido pelo Slate)
          try {
            const deleteEvent = new InputEvent('beforeinput', {
              bubbles: true,
              cancelable: true,
              composed: true,
              inputType: 'deleteContentBackward'
            });
            targetEditable.dispatchEvent(deleteEvent);
          } catch (e) {}

          // 6. Simula pressionamento de Backspace
          targetEditable.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'Backspace',
            code: 'Backspace',
            keyCode: 8,
            which: 8,
            bubbles: true,
            cancelable: true
          }));
          targetEditable.dispatchEvent(new KeyboardEvent('keyup', {
            key: 'Backspace',
            code: 'Backspace',
            keyCode: 8,
            which: 8,
            bubbles: true,
            cancelable: true
          }));

          // 7. Esvazia nós de texto residuais no DOM caso ainda permaneçam
          try {
            const currentText = (targetEditable.innerText || targetEditable.textContent || '').trim();
            if (currentText.length > 0) {
              const walker = document.createTreeWalker(targetEditable, NodeFilter.SHOW_TEXT);
              const textNodes = [];
              let node;
              while ((node = walker.nextNode())) textNodes.push(node);
              textNodes.forEach(tn => { tn.nodeValue = ''; });
            }
          } catch (e) {}

          targetEditable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          targetEditable.dispatchEvent(new Event('change', { bubbles: true, composed: true }));

          // Limpa qualquer range remanescente na janela
          try {
            const sel = window.getSelection();
            if (sel) sel.removeAllRanges();
          } catch (e) {}
        }
      }

      await new Promise(r => setTimeout(r, 60));
      return true;
    } catch (err) {
      console.warn('[FLOW Macro] clearPromptInput warning:', err);
      return false;
    }
  }

  /**
   * Insere o texto no campo de prompt do FLOW de forma segura sem quebrar o Slate.js do React
   * (Passo 1 do fluxograma)
   * @param {HTMLElement} element - Campo de prompt
   * @param {string} text - Texto do prompt
   * @returns {Promise<boolean>}
   */
  async setPromptInputValue(element, text) {
    if (!element) return false;

    const cleanText = FlowMacroEngine.normalizePromptText(text);

    try {
      const targetEditable = (element.getAttribute && element.getAttribute('contenteditable') === 'true')
        ? element
        : (element.querySelector('[contenteditable="true"]') || element);

      targetEditable.focus();
      await new Promise(r => setTimeout(r, 40));

      // 1. SEMPRE limpa qualquer conteúdo pré-existente antes de inserir o novo prompt!
      await this.clearPromptInput(targetEditable);
      await new Promise(r => setTimeout(r, 60));

      if (targetEditable.tagName.toLowerCase() === 'textarea' || targetEditable.tagName.toLowerCase() === 'input') {
        const prototype = Object.getPrototypeOf(targetEditable);
        const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value') ? Object.getOwnPropertyDescriptor(prototype, 'value').set : null;
        if (valueSetter) {
          valueSetter.call(targetEditable, cleanText);
        } else {
          targetEditable.value = cleanText;
        }

        targetEditable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        targetEditable.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      } else {
        // Slate.js / ContentEditable no Google FLOW
        targetEditable.focus();
        await new Promise(r => setTimeout(r, 40));

        // 2. Atualização direta no Fiber do Slate Editor se disponível (insere parágrafos limpos)
        let fiberUpdated = false;
        try {
          const editor = this.getSlateEditor(targetEditable);
          if (editor && editor.children && Array.isArray(editor.children)) {
            // Preserva apenas nós reais de chips/anexos de imagens, NUNCA blocos de texto/parágrafos
            const existingChips = editor.children.filter(n => {
              if (!n) return false;
              if (n.type === 'paragraph' || n.type === 'line' || n.type === 'text') return false;
              if (n.children && n.children.length === 1 && typeof n.children[0]?.text === 'string' && !n.url && !n.src && !n.assetId && !n.type) {
                return false;
              }
              return n.type === 'image' || n.type === 'attachment' || n.type === 'asset' || n.type === 'media' || n.type === 'chip' || Boolean(n.url || n.src || n.assetId);
            });
            const lines = cleanText.split('\n');
            const paragraphs = lines.map(line => ({
              type: 'paragraph',
              children: [{ text: line }]
            }));
            editor.children = [...existingChips, ...paragraphs];
            if (editor.selection) {
              const lastLine = Math.max(0, editor.children.length - 1);
              const lastNode = editor.children[lastLine];
              const lastLen = (lastNode?.children?.[0]?.text || '').length;
              editor.selection = {
                anchor: { path: [lastLine, 0], offset: lastLen },
                focus: { path: [lastLine, 0], offset: lastLen }
              };
            }
            if (typeof editor.onChange === 'function') {
              editor.onChange();
              fiberUpdated = true;
            }
          }
        } catch (e) { /* ignora */ }

        // 3. Se o Fiber não foi manipulado diretamente, utiliza evento Paste com DataTransfer
        if (!fiberUpdated) {
          const dt = new DataTransfer();
          dt.setData('text/plain', cleanText);
          const htmlParagraphs = cleanText.split('\n').map(l => `<p>${l || '<br>'}</p>`).join('');
          dt.setData('text/html', htmlParagraphs);

          let pasted = false;
          try {
            const pasteEvent = new ClipboardEvent('paste', {
              bubbles: true,
              cancelable: true,
              composed: true,
              clipboardData: dt
            });
            pasted = targetEditable.dispatchEvent(pasteEvent);
          } catch (e) { /* ignora */ }

          // Fallback: BeforeInput com insertFromPaste ou insertText
          const currentDOMText = (targetEditable.innerText || targetEditable.textContent || '').trim();
          if (!pasted || !currentDOMText.includes(cleanText.substring(0, 15))) {
            try {
              const beforeInput = new InputEvent('beforeinput', {
                bubbles: true,
                cancelable: true,
                composed: true,
                inputType: 'insertFromPaste',
                data: cleanText,
                dataTransfer: dt
              });
              targetEditable.dispatchEvent(beforeInput);
            } catch (e) {
              try {
                const insertTextInput = new InputEvent('beforeinput', {
                  bubbles: true,
                  cancelable: true,
                  composed: true,
                  inputType: 'insertText',
                  data: cleanText
                });
                targetEditable.dispatchEvent(insertTextInput);
              } catch (e2) {}
            }
          }
        }

        // 4. Dispara eventos standard de input e change
        targetEditable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        targetEditable.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
      }

      await new Promise(r => setTimeout(r, 150));
      return true;
    } catch (err) {
      console.warn('[FLOW Macro] setPromptInputValue safe warning:', err);
      return false;
    }
  }

  /**
   * Limpa a lista de logs da interface
   */
  clearLogs() {
    this.logs = [];
    this.notify();
  }

  /**
   * Retorna os logs formatados em texto simples com timestamps para cópia ou exportação
   * @returns {string}
   */
  getFormattedLogs() {
    return this.logs.map(l => `${l.timeDisplay || `[${l.time}]`} ${l.message}`).join('\n');
  }

  /**
   * Localiza o botão circular de envio/criação ("Criar", "arrow_forward", "→") no FLOW (Passo 6)
   * @returns {HTMLElement|null}
   */
  findSubmitButton() {
    // 0. Verifica se há um seletor aprendido previamente
    const learned = this.resolveLearnedSelector('submitButton');
    if (learned && FlowMacroEngine.isElementVisible(learned) && !learned.closest('[id*="fd-"], [class*="fd-"]')) {
      return learned;
    }

    const promptContainer = this.getPromptContainer();

    // Prioridade 1: Seletor exato gravado do botão Criar do FLOW no DevTools
    const exactSubmit = document.querySelector([
      'div.sc-5c3af813-10 > button.sc-e8425ea6-0',
      'div.sc-5c3af813-10 button',
      'button[aria-label*="arrow_forward Criar" i]',
      'button[aria-label*="arrow_forward" i]',
      'button[aria-label*="Criar" i]',
      'button[aria-label*="Gerar" i]',
      'button[aria-label*="Enviar" i]',
      'button[aria-label*="Submit" i]',
      'button[aria-label*="Create" i]'
    ].join(', '));
    if (exactSubmit && FlowMacroEngine.isElementVisible(exactSubmit) && !exactSubmit.closest('[id*="fd-"], [class*="fd-"]')) {
      return exactSubmit;
    }

    // Prioridade 2: Localiza botão contendo ícones Google Symbols de envio
    const symbolElements = Array.from(document.querySelectorAll('i.google-symbols, span.google-symbols, .google-symbols, i, span')).filter(el => {
      const symText = (el.textContent || el.innerText || '').trim().toLowerCase();
      return (symText === 'arrow_forward' || symText === 'send' || symText === 'play_arrow' || symText === 'arrow_right_alt' || symText === 'arrow_forward_ios');
    });

    for (const sym of symbolElements) {
      const btn = sym.closest('button, [role="button"], div[tabindex="0"]');
      if (btn && FlowMacroEngine.isElementVisible(btn) && !btn.closest('[id*="fd-"], [class*="fd-"]')) {
        return btn;
      }
    }

    // Prioridade 3: Botão contendo o texto ou aria-label "Criar", "Gerar", "Create"
    const srElements = Array.from(document.querySelectorAll('button, [role="button"]')).filter(btn => {
      if (!FlowMacroEngine.isElementVisible(btn) || !FlowMacroEngine.isSafeToClick(btn) || btn.closest('[id*="fd-"], [class*="fd-"]')) return false;
      // Rejeita estritamente menus ou filtros externos (permite se estiver dentro do promptContainer)
      if (!promptContainer?.contains(btn) && btn.closest('[role="menu"], [class*="popover" i], [class*="filter" i]')) return false;
      const t = (btn.textContent || btn.innerText || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      return (
        t === 'criar' || t.includes('criar') || t.includes('gerar') || t.includes('create') ||
        aria.includes('criar') || aria.includes('gerar') || aria.includes('enviar') || aria.includes('create')
      );
    });

    if (srElements.length > 0) {
      return srElements[0];
    }

    // Prioridade 4 (Detecção Geométrica Infalível no Prompt Container):
    // O botão circular branco de envio ➔ fica posicionado no canto inferior direito da barra de comandos
    if (promptContainer) {
      const buttons = Array.from(promptContainer.querySelectorAll('button, [role="button"], div[tabindex="0"]')).filter(b => {
        if (!FlowMacroEngine.isElementVisible(b) || b.closest('[id*="fd-"], [class*="fd-"]')) return false;
        const text = (b.textContent || b.innerText || '').trim().toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        if (text.includes('agente') || text.includes('banana') || text.includes('x1') || text.includes('x2') || text.includes('x3') || text.includes('x4') || text === '+') {
          return false;
        }
        if (aria.includes('fechar') || aria.includes('close') || text === '✕' || text === '×' || text === 'close') {
          return false;
        }
        if (b.closest('[class*="chip" i]')) return false;
        return true;
      });

      if (buttons.length > 0) {
        buttons.sort((a, b) => {
          const rA = a.getBoundingClientRect();
          const rB = b.getBoundingClientRect();
          return (rB.right + rB.bottom) - (rA.right + rA.bottom);
        });
        return buttons[0];
      }
    }

    return null;
  }

  /**
   * Dispara o envio completo e confiável do prompt no FLOW (Passo 6)
   * Usa envio duplo: clique no botão "Criar" + tecla Enter no editor Slate
   * @param {HTMLElement|null} submitBtn - Botão de submissão
   * @param {HTMLElement|null} inputEl - Campo de prompt
   * @returns {Promise<boolean>}
   */
  async simulateSubmit(submitBtn, inputEl) {
    if (!submitBtn) {
      submitBtn = this.findSubmitButton();
    }
    // Fallback: busca por similaridade visual de pixels (compara com imagem de referência do botão)
    if (!submitBtn) {
      try {
        const result = await FlowMacroEngine.findElementByVisualSimilarity('submitButton', 'button, [role="button"], div[tabindex="0"]', 45);
        if (result.element) {
          this.addLog(`🎯 [Passo 5] Botão de envio localizado por similaridade visual (${result.similarity}%)!`, 'success');
          submitBtn = result.element;
        }
      } catch (e) { /* ignora */ }
    }
    if (!inputEl) {
      inputEl = this.findPromptInput();
    }

    // Aguarda até 5.0s para o botão de envio ficar habilitado pelo FLOW (evita submeter enquanto anexos estão sendo processados)
    if (submitBtn) {
      for (let wait = 0; wait < 50; wait++) {
        const isDisabled = submitBtn.disabled || submitBtn.getAttribute('aria-disabled') === 'true';
        if (!isDisabled) break;
        await new Promise(r => setTimeout(r, 100));
      }
    }

    let triggered = false;

    if (submitBtn) {
      submitBtn.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      submitBtn.focus();

      const rect = submitBtn.getBoundingClientRect();
      const clientX = rect.left + (rect.width > 0 ? rect.width / 2 : 10);
      const clientY = rect.top + (rect.height > 0 ? rect.height / 2 : 10);

      const eventOpts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX: clientX,
        clientY: clientY,
        button: 0,
        buttons: 1
      };

      // Dispara manipuladores sintéticos do React (onClick / onMouseDown)
      try {
        const propKey = Object.keys(submitBtn).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
        if (propKey && submitBtn[propKey]) {
          if (typeof submitBtn[propKey].onClick === 'function') {
            submitBtn[propKey].onClick({ preventDefault: () => {}, stopPropagation: () => {}, target: submitBtn, currentTarget: submitBtn, nativeEvent: new MouseEvent('click', eventOpts) });
          }
          if (typeof submitBtn[propKey].onMouseDown === 'function') {
            submitBtn[propKey].onMouseDown({ preventDefault: () => {}, stopPropagation: () => {}, target: submitBtn, currentTarget: submitBtn, nativeEvent: new MouseEvent('mousedown', eventOpts) });
          }
        }
      } catch (e) { /* ignora */ }

      // Dispara sequência completa de eventos nativos: pointerdown -> mousedown -> pointerup -> mouseup -> click
      if (typeof PointerEvent !== 'undefined') {
        submitBtn.dispatchEvent(new PointerEvent('pointerdown', { ...eventOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
      }
      submitBtn.dispatchEvent(new MouseEvent('mousedown', eventOpts));

      if (typeof PointerEvent !== 'undefined') {
        submitBtn.dispatchEvent(new PointerEvent('pointerup', { ...eventOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
      }
      submitBtn.dispatchEvent(new MouseEvent('mouseup', eventOpts));

      try {
        submitBtn.click();
      } catch (e) { /* ignora */ }

      triggered = true;
    }

    // Fallback: aciona Enter no inputEl APENAS se o botão de envio NÃO foi acionado (evita envio duplo simultâneo)
    if (!triggered && inputEl) {
      try {
        inputEl.focus();
        inputEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        inputEl.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        triggered = true;
      } catch (e) { /* ignora */ }
    }

    if (triggered) {
      // Rola imediatamente o Canvas para o topo para que o usuário veja a nova imagem gerando
      this.scrollCanvasToTop();
      setTimeout(() => this.scrollCanvasToTop(), 250);
      setTimeout(() => this.scrollCanvasToTop(), 700);
    }

    return triggered;
  }

  /**
   * Localiza o container global que engloba a barra de prompt e os botões inferiores no FLOW
   * @returns {HTMLElement|null}
   */
  getPromptContainer() {
    const promptInput = this.findPromptInput();
    if (!promptInput) return null;

    // 1. Sobe na árvore de pais procurando o container pai mais adequado
    let curr = promptInput.parentElement;
    let bestContainer = curr;
    let depth = 0;

    while (curr && curr !== document.body && depth < 12) {
      if (curr.closest && curr.closest('[id*="fd-"], [class*="fd-"]')) {
        break;
      }
      const btns = curr.querySelectorAll('button, [role="button"], div[tabindex="0"]');
      if (btns.length >= 2) {
        bestContainer = curr;
        const rect = curr.getBoundingClientRect();
        if (rect.width > 280) {
          return curr;
        }
      }
      curr = curr.parentElement;
      depth++;
    }

    return bestContainer;
  }

  /**
   * Retorna os chips de personagens ativos anexados dentro da barra de comando do FLOW
   * @returns {HTMLElement[]}
   */
  getPromptAttachedChips() {
    const promptInput = this.findPromptInput();
    if (!promptInput) return [];

    // Exclusão estrita de modais/diálogos, overlay do CDK, canvas e extensão
    const isExcluded = (el) => {
      if (!el) return true;
      if (el.closest && el.closest('[id*="fd-"], [class*="fd-"]')) return true;
      if (el.closest && el.closest('[role="dialog"], [role="presentation"], .cdk-overlay-pane, [class*="modal" i]')) return true;
      if (el.closest && el.closest('[class*="canvas" i], [data-testid="virtuoso-item-list"], [data-testid="virtuoso-scroller"]')) return true;
      if (el.closest && el.closest('header, [class*="header" i], [class*="navbar" i], [class*="profile" i]')) return true;
      return false;
    };

    const promptContainer = this.getPromptContainer();
    const chipsFound = [];

    // 1. Busca imagens de chips/miniaturas diretamente no promptContainer e containers adjacentes
    const containersToSearch = [];
    if (promptContainer && !isExcluded(promptContainer)) {
      containersToSearch.push(promptContainer);
    }

    if (promptInput && promptInput.parentElement) {
      let p = promptInput.parentElement;
      for (let i = 0; i < 5 && p && p !== document.body; i++) {
        if (!containersToSearch.includes(p) && !isExcluded(p)) {
          containersToSearch.push(p);
        }
        p = p.parentElement;
      }
    }

    for (const container of containersToSearch) {
      const imgs = Array.from(container.querySelectorAll('img')).filter(img => {
        if (!FlowMacroEngine.isElementVisible(img) || isExcluded(img)) return false;

        // Dimensões características dos chips de prompt no FLOW (14px a 140px)
        const rect = img.getBoundingClientRect();
        if (rect.width < 14 || rect.width > 140 || rect.height < 14 || rect.height > 140) return false;

        // Ignora imagens de avatar de perfil do Google
        const src = (img.src || img.getAttribute('src') || '').toLowerCase();
        if (src.includes('googleusercontent.com/a/') || src.includes('accounts.google.com')) return false;

        // Ignora botões de configuração (modelos Banana/Imagen, agente, x4, etc.)
        const parentBtn = img.closest('button, [role="button"], div[class*="pill" i]');
        if (parentBtn) {
          const btnText = (parentBtn.textContent || '').toLowerCase();
          if (btnText.includes('banana') || btnText.includes('imagen') || btnText.includes('pro') ||
              btnText.includes('fast') || btnText.includes('ultra') || btnText.includes('agente') ||
              btnText.includes('agent')) {
            return false;
          }
        }

        // Ignora chips residuais do Canvas com rótulo "Baixar"
        const parentCard = img.closest('div, span');
        if (parentCard) {
          const cardText = (parentCard.textContent || '').toLowerCase();
          if (cardText.includes('baixar') || cardText.includes('download')) return false;
        }

        return true;
      });

      for (const img of imgs) {
        const chipWrapper = img.closest('[role="button"], div[tabindex="0"]') || img.parentElement || img;
        if (!chipsFound.some(c => c === chipWrapper || c === img || c.contains(img) || img.contains(c))) {
          chipsFound.push(chipWrapper);
        }
      }
    }

    // 2. Fallback: Varredura na metade inferior da viewport para dock adjacente
    if (chipsFound.length === 0) {
      const allDockImgs = Array.from(document.querySelectorAll('img')).filter(img => {
        if (!FlowMacroEngine.isElementVisible(img) || isExcluded(img)) return false;

        const rect = img.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.40) return false;
        if (rect.width < 14 || rect.width > 140 || rect.height < 14 || rect.height > 140) return false;

        const src = (img.src || '').toLowerCase();
        if (src.includes('googleusercontent.com/a/')) return false;

        const parentBtn = img.closest('button, [role="button"]');
        if (parentBtn) {
          const btnText = (parentBtn.textContent || '').toLowerCase();
          if (btnText.includes('banana') || btnText.includes('imagen') || btnText.includes('pro') ||
              btnText.includes('agente') || btnText.includes('agent')) {
            return false;
          }
        }

        return true;
      });

      for (const img of allDockImgs) {
        const chipWrapper = img.closest('[role="button"], div[tabindex="0"]') || img.parentElement || img;
        if (!chipsFound.some(c => c === chipWrapper || c === img || c.contains(img) || img.contains(c))) {
          chipsFound.push(chipWrapper);
        }
      }
    }

    return chipsFound;
  }

  /**
   * Verifica com precisão se os chips/miniaturas dos personagens já estão anexados à barra de comando
   * @returns {boolean}
   */
  hasCharacterChipsAttached() {
    const activeChars = (this.characters && this.characters.length > 0)
      ? this.characters.filter(c => c.enabled !== false)
      : [];
    if (activeChars.length === 0) return true;
    const expectedCount = activeChars.length;

    const chips = this.getPromptAttachedChips();
    return chips.length >= expectedCount;
  }

  /**
   * Detecta se o FLOW está no modo de visualização expandida / editor de imagem (Lightbox)
   * NUNCA confunde esse estado com a biblioteca de mídia!
   * @returns {boolean}
   */
  isImageExpanded() {
    // 1. Campo de inpainting / edição com o placeholder característico
    const inpaintingPrompt = document.querySelector([
      'textarea[placeholder*="quer mudar" i]',
      'input[placeholder*="quer mudar" i]',
      '[placeholder*="what do you want to change" i]',
      '[placeholder*="o que você quer mudar" i]'
    ].join(', '));
    if (inpaintingPrompt && FlowMacroEngine.isElementVisible(inpaintingPrompt)) {
      return true;
    }

    // 2. Botão de voltar no canto superior esquerdo acompanhado de nome de arquivo de imagem no topo
    const topBackBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
      if (!FlowMacroEngine.isElementVisible(b)) return false;
      const rect = b.getBoundingClientRect();
      if (rect.left > 120 || rect.top > 80) return false;
      const t = (b.textContent || b.innerText || '').toLowerCase();
      const aria = (b.getAttribute('aria-label') || '').toLowerCase();
      return t.includes('arrow_back') || t.includes('voltar') || t.includes('back') || t.includes('←') || aria.includes('voltar') || aria.includes('back');
    });

    const hasHeaderImageName = Array.from(document.querySelectorAll('header, div[class*="header" i], div[class*="top" i], span, p')).some(el => {
      if (!FlowMacroEngine.isElementVisible(el)) return false;
      const rect = el.getBoundingClientRect();
      if (rect.top > 80) return false;
      const t = (el.textContent || '').toLowerCase();
      return t.includes('.jpeg') || t.includes('.jpg') || t.includes('.png') || t.includes('.webp');
    });

    return !!(topBackBtn && hasHeaderImageName);
  }

  /**
   * Fecha com segurança o modo de imagem expandida e retorna ao Canvas principal do projeto
   */
  async exitExpandedImageView() {
    this.addLog('↩️ Detectada imagem expandida na tela. Retornando com segurança ao Canvas do projeto...', 'info');

    // 1. Envia tecla Escape para window e document
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
    await new Promise(r => setTimeout(r, 400));

    // 2. Localiza e clica no botão de voltar (arrow_back / ←) no topo esquerdo
    const topBackBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
      if (!FlowMacroEngine.isElementVisible(b)) return false;
      const rect = b.getBoundingClientRect();
      if (rect.left > 120 || rect.top > 80) return false;
      return true;
    });

    if (topBackBtn) {
      this.clickElementWithOverlay(topBackBtn);
      await new Promise(r => setTimeout(r, 600));
    }

    await new Promise(r => setTimeout(r, 400));
  }

  /**
   * Localiza o container principal do modal/painel de recursos e biblioteca do FLOW
   * Suporta Angular CDK overlay pane (.cdk-overlay-pane), diálogos nativos, drawers e elementos com .upload-text
   * @returns {HTMLElement|null}
   */
  getLibraryContainer() {
    // 1. Elemento com class upload-text ou texto Carregar multimídia (informado diretamente pelo usuário)
    const uploadSpan = document.querySelector('.upload-text, span.upload-text') ||
      Array.from(document.querySelectorAll('span, div, button, p')).find(el => {
        if (el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        const t = (el.textContent || '').trim().toLowerCase();
        return t === 'carregar multimídia' || t === 'carregar multimidia' || t.includes('carregar multimídia') || t.includes('carregar multimidia');
      });
    if (uploadSpan && FlowMacroEngine.isElementVisible(uploadSpan)) {
      const pane = uploadSpan.closest('.cdk-overlay-pane, div[role="dialog"], div[role="presentation"], div[class*="overlay" i], div[class*="modal" i], div[class*="dialog" i], div[class*="drawer" i], section, aside') || uploadSpan.closest('div[tabindex="-1"], div');
      if (pane) return pane;
    }

    // 2. Campo de busca de recursos
    const searchInput = document.querySelector('input[placeholder*="Pesquisar recursos" i], input[placeholder*="search" i]');
    if (searchInput && FlowMacroEngine.isElementVisible(searchInput) && !searchInput.closest('[id*="fd-"], [class*="fd-"]')) {
      const pane = searchInput.closest('.cdk-overlay-pane, div[role="dialog"], div[role="presentation"], div[class*="overlay" i], div[class*="modal" i], div[class*="dialog" i], div[class*="drawer" i]') || searchInput.parentElement?.parentElement?.parentElement;
      if (pane) return pane;
    }

    // 3. Angular CDK overlay pane ou modais visíveis
    const overlays = Array.from(document.querySelectorAll('.cdk-overlay-pane, div[role="dialog"], div[role="presentation"], div[class*="overlay" i], div[class*="dialog" i]')).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const t = (el.textContent || '').toLowerCase();
      return t.includes('pesquisar recursos') || t.includes('carregar multimídia') || t.includes('carregar multimidia') || t.includes('adicionar ao comando') || t.includes('incluir no comando') || t.includes('carregam') || t.includes('personagens');
    });
    if (overlays.length > 0) return overlays[0];

    return null;
  }

  /**
   * Procura recursivamente por elementos input[type="file"] atravessando inclusive Shadow Roots
   * @param {Node} [node] - Nó raiz de busca
   * @returns {HTMLInputElement|null}
   */
  findFileInputDeep(node = document.body) {
    if (!node) return null;
    if (node.tagName === 'INPUT' && node.type === 'file' && !node.id?.includes('fd-') && !node.className?.includes('fd-')) {
      return node;
    }
    if (node.shadowRoot) {
      const found = this.findFileInputDeep(node.shadowRoot);
      if (found) return found;
    }
    for (let child = node.firstElementChild; child; child = child.nextElementSibling) {
      const found = this.findFileInputDeep(child);
      if (found) return found;
    }
    return null;
  }

  /**
   * Dispara sequência de Drag & Drop sintético em um elemento alvo
   * @param {HTMLElement} target - Elemento de destino
   * @param {File} file - Arquivo a ser enviado
   */
  dispatchSyntheticDrop(target, file) {
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

  /**
   * Verifica se a biblioteca / galeria de mídia do FLOW já está aberta e visível na tela
   * NUNCA confunde com a lista de cards gerados no Canvas nem com imagens expandidas!
   * @returns {boolean}
   */
  isFlowLibraryOpen() {
    if (this.isImageExpanded()) return false;

    // 0. Elemento com class upload-text ou texto Carregar multimídia (informado diretamente pelo usuário)
    const uploadTextEl = document.querySelector('.upload-text, span.upload-text') ||
      Array.from(document.querySelectorAll('span, div, button, p')).find(el => {
        if (el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        const t = (el.textContent || '').trim().toLowerCase();
        return t === 'carregar multimídia' || t === 'carregar multimidia' || t.includes('carregar multimídia') || t.includes('carregar multimidia');
      });
    if (uploadTextEl && FlowMacroEngine.isElementVisible(uploadTextEl)) return true;

    // 1. Campo de busca de recursos (presente na gaveta lateral OU no modal centralizado)
    const searchInput = document.querySelector('input[placeholder*="Pesquisar recursos" i], input[placeholder*="search" i]');
    if (searchInput && FlowMacroEngine.isElementVisible(searchInput) && !searchInput.closest('[id*="fd-"], [class*="fd-"]')) {
      return true;
    }

    // 2. Container da biblioteca ou modal de recursos
    if (this.getLibraryContainer()) return true;

    // 3. Botão "Enviar mídia", "Carregar multimídia" ou "Upload" visível na gaveta de mídia (região esquerda x < 500px)
    const mediaActions = Array.from(document.querySelectorAll('button, [role="button"], div[tabindex="0"], label')).filter(b => {
      if (!FlowMacroEngine.isElementVisible(b) || b.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const rect = b.getBoundingClientRect();
      if (rect.left > 500) return false;
      const t = (b.textContent || b.innerText || '').toLowerCase();
      return t.includes('carregar multimídia') || t.includes('carregar multimidia') || t.includes('enviar mídia') || t.includes('enviar media') || (t.includes('upload') && !t.includes('studio'));
    });
    if (mediaActions.length > 0) return true;

    // 4. Lista virtual de mídias na GAVETA LATERAL (rect.right < 550, NÃO inclui o Canvas central!)
    const lists = Array.from(document.querySelectorAll('[data-testid="virtuoso-item-list"]')).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const rect = el.getBoundingClientRect();
      // Só conta como biblioteca se estiver na gaveta lateral (esquerda da tela)
      // O Canvas principal usa virtuoso-item-list mas fica no centro/direita
      return rect.right < 550;
    });
    if (lists.length > 0) return true;

    // 5. Mensagem de gaveta de mídia vazia ("Nenhum resultado encontrado")
    const emptyMsg = Array.from(document.querySelectorAll('div, p, span')).find(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const rect = el.getBoundingClientRect();
      if (rect.left > 500) return false;
      const t = (el.textContent || el.innerText || '').toLowerCase();
      return t.includes('nenhum resultado encontrado') || t.includes('comece a criar ou adicione');
    });
    if (emptyMsg) return true;

    // 6. Cards de mídia styled-components situados na gaveta esquerda (x < 500)
    const cards = Array.from(document.querySelectorAll('div.sc-b0e5-14, div.sc-a0e2840-0')).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const rect = el.getBoundingClientRect();
      return rect.right < 500;
    });
    return cards.length > 0;
  }

  /**
   * Detecta se o modal centralizado de recursos ("Pesquisar recursos") está aberto no FLOW
   * O FLOW pode exibir a biblioteca como um diálogo modal com categorias e botão "Adicionar ao comando"
   * @returns {boolean}
   */
  _isResourceModalOpen() {
    return !!this.getLibraryContainer();
  }

  /**
   * Retorna os cards de mídia visíveis dentro da biblioteca do FLOW
   * NUNCA retorna cards do Canvas principal!
   * @returns {HTMLElement[]}
   */
  getLibraryMediaCards() {
    if (!this.isFlowLibraryOpen() || this.isImageExpanded()) {
      return [];
    }

    // 1. Procura lista virtuoso na gaveta lateral (rect.right < 550)
    const virtuosoList = Array.from(document.querySelectorAll('[data-testid="virtuoso-item-list"]')).find(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const rect = el.getBoundingClientRect();
      return rect.right < 550;
    });

    if (virtuosoList) {
      const children = Array.from(virtuosoList.children).filter(el => {
        return FlowMacroEngine.isElementVisible(el) && !el.closest('[id*="fd-"], [class*="fd-"]');
      });
      if (children.length > 0) return children;
    }

    // 2. Se o modal centralizado de recursos está aberto, busca cards DENTRO dele
    if (this._isResourceModalOpen()) {
      const modalCards = this._getResourceModalCards();
      if (modalCards.length > 0) return modalCards;

      // 2.1 Procura lista virtuoso DENTRO do modal de recursos (não no Canvas!)
      const resourceModals = [this.getLibraryContainer()].filter(Boolean);
      if (resourceModals.length === 0) {
        resourceModals.push(...Array.from(document.querySelectorAll('.cdk-overlay-pane, div[role="dialog"], div[role="presentation"]')).filter(el => {
          if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
          const t = (el.textContent || '').toLowerCase();
          return (t.includes('pesquisar recursos') || t.includes('adicionar ao comando') || t.includes('carregam') || t.includes('personagens'));
        }));
      }

      for (const modal of resourceModals) {
        const modalVirtuoso = modal.querySelector('[data-testid="virtuoso-item-list"]');
        if (modalVirtuoso && FlowMacroEngine.isElementVisible(modalVirtuoso)) {
          const children = Array.from(modalVirtuoso.children).filter(el => {
            return FlowMacroEngine.isElementVisible(el) && !el.closest('[id*="fd-"], [class*="fd-"]');
          });
          if (children.length > 0) return children;
        }
      }
    }

    // 3. Cards styled-components na gaveta lateral (rect.right < 500)
    const scCards = Array.from(document.querySelectorAll('div.sc-b0e5-14, div.sc-a0e2840-0')).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const rect = el.getBoundingClientRect();
      return rect.right < 500;
    });
    if (scCards.length > 0) return scCards;

    return [];
  }

  /**
   * Retorna cards de mídia/personagens visíveis dentro do modal centralizado de recursos do FLOW
   * O modal exibe os recursos como itens clicáveis no painel central com nome e miniatura
   * @returns {HTMLElement[]}
   */
  _getResourceModalCards() {
    const modal = this.getLibraryContainer();
    if (!modal) return [];

    // Busca itens de lista no modal que possuam thumbnail e título
    const resourceItems = Array.from(modal.querySelectorAll('[role="option"], [role="listitem"], div[tabindex="0"], div.sc-b0e5-14, div.sc-a0e2840-0, div[class*="card" i]')).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const hasImg = el.querySelector('img') !== null;
      const rect = el.getBoundingClientRect();
      // Itens da lista central do modal têm altura entre 20px e 300px e largura > 40px
      return hasImg && rect.height >= 20 && rect.height <= 300 && rect.width >= 40 && rect.width < 600;
    });

    if (resourceItems.length > 0) return resourceItems;

    // Fallback: divs com img dentro da área central do modal
    const genericItems = Array.from(modal.querySelectorAll('div')).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const hasImg = el.querySelector('img') !== null;
      const rect = el.getBoundingClientRect();
      return hasImg && rect.height >= 20 && rect.height <= 300 && rect.width >= 40 && rect.width <= 600;
    });

    return genericItems;
  }

  /**
   * Alterna para a aba desejada no menu lateral do modal de recursos do FLOW
   * (Ex: "Carregamentos", "Personagens", "Avatares", "Tudo")
   * @param {string} tabName - Nome da aba
   * @returns {Promise<boolean>}
   */
  async selectLibraryModalTab(tabName = 'Carregamentos') {
    try {
      const modal = this.getLibraryContainer() || document.body;
      const searchKey = (tabName || '').toLowerCase().trim();

      // Busca na coluna esquerda do modal por botões/divs com o nome da aba
      const candidates = Array.from(modal.querySelectorAll('button, [role="tab"], [role="button"], div[tabindex="0"], div, span, a')).filter(el => {
        if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        const t = (el.textContent || el.innerText || '').trim().toLowerCase();
        if (searchKey.startsWith('carregam') || searchKey.startsWith('upload')) {
          return t.startsWith('carregam') || t.startsWith('upload') || t.includes('carregam');
        }
        if (searchKey.startsWith('personagen') || searchKey.startsWith('character')) {
          return t.startsWith('personagen') || t.startsWith('character') || t.includes('personagen');
        }
        if (searchKey.startsWith('avatar')) {
          return t.startsWith('avatar') || t.includes('avatar');
        }
        if (searchKey === 'tudo' || searchKey === 'all') {
          return t === 'tudo' || t === 'all';
        }
        return t === searchKey || t.includes(searchKey);
      });

      if (candidates.length === 0) {
        if (searchKey.startsWith('personagen')) {
          return await this.selectLibraryModalTab('Avatares');
        }
        return false;
      }

      // Ordena para pegar o menor elemento específico
      candidates.sort((a, b) => (a.textContent || '').trim().length - (b.textContent || '').trim().length);
      const targetTab = candidates[0];
      const clickEl = targetTab.closest('button, [role="tab"], [role="button"], div[tabindex="0"]') || targetTab;

      this.addLog(`📂 [Passo 2] Selecionando aba "${tabName}" na biblioteca do FLOW...`, 'info');
      this.clickElementWithOverlay(clickEl);
      await new Promise(r => setTimeout(r, 600));
      return true;
    } catch (e) {
      console.warn('[FLOW Macro] selectLibraryModalTab warning:', e);
      return false;
    }
  }

  /**
   * Garante a abertura da biblioteca de mídia do Google FLOW
   * Executa EXCLUSIVAMENTE pelo botão "+" na barra de comando (conforme Passo 2 do fluxograma).
   * NUNCA clica na barra lateral nem em imagens do Canvas!
   * @returns {Promise<boolean>}
   */
  async ensureFlowLibraryOpen() {
    // 0. Se a tela estiver com a imagem expandida, fecha a visualização expandida primeiro!
    if (this.isImageExpanded()) {
      await this.exitExpandedImageView();
    }

    if (this.isFlowLibraryOpen()) return true;

    // Prioridade 1: Botão "+" no canto esquerdo da barra de comando (seletores CSS)
    let plusBtn = this.findPlusButton();

    // Prioridade 2: Botão "+" localizado por similaridade visual de pixels (imagem de referência fornecida pelo usuário)
    if (!plusBtn) {
      try {
        const visualRes = await FlowMacroEngine.findElementByVisualSimilarity('plusButton', 'button, [role="button"], div[tabindex="0"], div[role="button"]', 35);
        if (visualRes && visualRes.element) {
          plusBtn = visualRes.element;
          this.addLog(`✨ [Passo 2] Botão "+" localizado por similaridade visual (${visualRes.similarity}% de correspondência)!`, 'success');
        }
      } catch (e) {}
    }

    if (plusBtn) {
      this.addLog('➕ [Passo 2] Clicando no botão "+" no canto esquerdo do comando para abrir biblioteca...', 'info');
      this.clickElementWithOverlay(plusBtn);
      for (let w = 0; w < 10; w++) {
        await new Promise(r => setTimeout(r, 200));
        if (this.isFlowLibraryOpen()) return true;
      }
    }

    // Aguarda até 3 segundos checando abertura da biblioteca
    for (let w = 0; w < 12; w++) {
      await new Promise(r => setTimeout(r, 250));
      if (this.isFlowLibraryOpen()) {
        return true;
      }
    }
    return false;
  }

  /**
   * Localiza o botão "+" (adicionar recursos/personagens) na barra de prompt (Passo 2)
   * Blindado contra qualquer elemento de filtro, busca ou cabeçalho
   * @returns {HTMLElement|null}
   */
  findPlusButton() {
    // 0. Verifica seletor aprendido se válido e na região inferior
    const learned = this.resolveLearnedSelector('plusButton');
    if (learned && FlowMacroEngine.isElementVisible(learned) && FlowMacroEngine.isSafeToClick(learned)) {
      const rect = learned.getBoundingClientRect();
      if (rect.top > 250) {
        return learned;
      }
    }

    const promptContainer = this.getPromptContainer();
    const promptInput = this.findPromptInput();

    // Prioridade 1: Botão "+" exato do FLOW gravado no DevTools (div.sc-5c3af813-2 button)
    const exactSelectors = [
      'div.sc-5c3af813-2 > button.sc-e8425ea6-0',
      'div.sc-5c3af813-2 button',
      'button[aria-label*="add_2 Criar" i]',
      'button[aria-label*="add_2" i]',
      'button[aria-label*="adicionar ao prompt" i]',
      'button[aria-label*="adicionar ao comando" i]'
    ];

    for (const sel of exactSelectors) {
      const candidates = promptContainer
        ? Array.from(promptContainer.querySelectorAll(sel))
        : Array.from(document.querySelectorAll(sel));

      const found = candidates.find(el => {
        if (!FlowMacroEngine.isElementVisible(el) || !FlowMacroEngine.isSafeToClick(el)) return false;
        const rect = el.getBoundingClientRect();
        return rect.top > 250;
      });
      if (found) return found;
    }

    // Prioridade 2: Busca botões dentro do promptContainer
    if (promptContainer) {
      const containerButtons = Array.from(promptContainer.querySelectorAll('button, [role="button"], div[role="button"], div[tabindex="0"]')).filter(b => {
        if (!FlowMacroEngine.isElementVisible(b) || !FlowMacroEngine.isSafeToClick(b)) return false;
        if (b === promptInput || b.contains(promptInput)) return false;
        return true;
      });

      for (const btn of containerButtons) {
        if (this.isPlusButtonMatch(btn, promptInput)) {
          return btn;
        }
      }
    }

    // Prioridade 3: Região inferior da tela (últimos 350px de altura)
    if (promptInput) {
      const nearbyButtons = Array.from(document.querySelectorAll('button, [role="button"], div[tabindex="0"]')).filter(btn => {
        if (!FlowMacroEngine.isElementVisible(btn) || !FlowMacroEngine.isSafeToClick(btn)) return false;
        const rect = btn.getBoundingClientRect();
        if (rect.top < window.innerHeight - 350) return false;
        return this.isPlusButtonMatch(btn, promptInput);
      });

      if (nearbyButtons.length > 0) {
        return nearbyButtons[0];
      }
    }

    return null;
  }

  /**
   * Valida se um elemento é de fato o botão "+" da barra de prompt
   * Rejeita estritamente filtros, ferramentas de pesquisa, cabeçalhos e configurações
   * @param {HTMLElement} btn - Elemento a validar
   * @param {HTMLElement} promptInput - Campo de prompt
   * @returns {boolean}
   */
  isPlusButtonMatch(btn, promptInput) {
    if (!btn || !FlowMacroEngine.isElementVisible(btn)) return false;
    if (btn === promptInput || (promptInput && btn.contains(promptInput))) return false;
    if (!FlowMacroEngine.isSafeToClick(btn)) return false;

    // REJEIÇÃO GEOMÉTRICA: Botões acima da metade inferior da tela nunca são o botão do prompt
    const rect = btn.getBoundingClientRect();
    if (rect.top < 250) return false;

    // REJEIÇÃO ESTRITA POR TAG: Links de navegação
    if (btn.tagName === 'A' || btn.closest('a') || btn.closest('nav, aside, header, [role="navigation"], [class*="sidebar" i], [class*="navbar" i]')) {
      return false;
    }

    const text = (btn.textContent || btn.innerText || '').trim();
    const lowerText = text.toLowerCase();
    const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
    const title = (btn.getAttribute('title') || '').toLowerCase();
    const tooltip = (btn.getAttribute('data-tooltip') || '').toLowerCase();
    const testid = (btn.getAttribute('data-testid') || '').toLowerCase();

    // REJEIÇÃO ABSOLUTA: Agentes (+ Agente adiciona persona, NÃO mídia), Filtros, busca, proporção/banana, submit
    if (
      lowerText.includes('agente') || lowerText.includes('agent') ||
      aria.includes('agente') || aria.includes('agent') ||
      title.includes('agente') || title.includes('agent') ||
      aria.includes('filtro') || aria.includes('filter') || aria.includes('filtrar') ||
      title.includes('filtro') || title.includes('filter') || title.includes('filtrar') ||
      tooltip.includes('filtro') || tooltip.includes('filter') || testid.includes('filter') ||
      aria.includes('ordenar') || aria.includes('sort') ||
      aria.includes('pesquisar') || aria.includes('search') || testid.includes('search') ||
      aria.includes('arrow_forward') || lowerText.includes('arrow_forward') ||
      lowerText.includes('banana') || lowerText.includes('720p') || lowerText.includes('16:9') || lowerText.includes('9:16') || lowerText.includes('1:1') || lowerText.includes('x4') || lowerText.includes('x1') ||
      aria.includes('lixeira') || aria.includes('trash') || aria.includes('delete')
    ) {
      return false;
    }

    // Verifica ícones do Google Symbols / Material Symbols
    const symbolEl = btn.querySelector('.google-symbols, .material-symbols-outlined, i, span');
    const symText = symbolEl ? (symbolEl.textContent || symbolEl.innerText || '').trim().toLowerCase() : '';

    if (['filter_list', 'tune', 'filter_alt', 'search', 'sort', 'arrow_forward', 'send', 'arrow_back', 'close'].includes(symText)) {
      return false;
    }

    const addSymbols = [
      'add', 'add_2', 'add_box', 'add_circle', 'add_photo_alternate', 'add_to_photos',
      'library_add', 'attachment', 'attach_file'
    ];
    if (addSymbols.includes(symText)) return true;

    // Verifica SVG contendo o ícone "+"
    const svg = btn.querySelector('svg');
    if (svg) {
      const svgAria = (svg.getAttribute('aria-label') || '').toLowerCase();
      if (svgAria === 'add' || svgAria.includes('add') || svgAria.includes('adicionar')) return true;
      if (svg.innerHTML && (svg.innerHTML.includes('19 13') || svg.innerHTML.includes('12 4v16') || svg.innerHTML.includes('11 11V5'))) return true;
    }

    // Texto de adição
    if (text === '+' || text.startsWith('+') || lowerText === '+ adicionar' || lowerText === '+ add' || lowerText === 'adicionar' || lowerText === 'add') {
      return true;
    }

    // Aria-labels específicos gravados
    if (
      aria === 'add_2 criar' || aria.includes('add_2') ||
      aria.includes('adicionar referência') || aria.includes('adicionar imagem') || aria.includes('anexar imagem')
    ) {
      return true;
    }

    return false;
  }

  /**
   * Fecha automaticamente banners de onboarding, tutoriais ou avisos que possam obstruir a tela
   */
  dismissFlowOnboardingBanners() {
    try {
      const candidates = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const btn of candidates) {
        if (!FlowMacroEngine.isElementVisible(btn)) continue;
        if (btn.tagName === 'A' || btn.closest('a') || btn.getAttribute('href')) continue;
        if (btn.closest('[id*="fd-"], [class*="fd-"]')) continue;

        const text = (btn.textContent || btn.innerText || '').trim().toLowerCase();
        const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (
          text.includes('entendi') || text.includes('got it') || text.includes('dispensar') ||
          text.includes('fechar') || text.includes('dismiss') || aria.includes('fechar') ||
          aria.includes('close') || aria.includes('dispensar')
        ) {
          const parentText = (btn.parentElement ? (btn.parentElement.textContent || '') : '').toLowerCase();
          if (text.includes('entendi') || text.includes('got it') || parentText.includes('agente') || parentText.includes('flow')) {
            try { btn.click(); } catch (e) {}
          }
        }
      }
    } catch (e) { /* ignora */ }
  }

  /**
   * Converte uma string Base64 em um objeto File para envio ao input de arquivos
   * @param {string} base64Data - Dados em Base64
   * @param {string} filename - Nome do arquivo
   * @returns {File|null}
   */
  static base64ToFile(base64Data, filename = 'character.png') {
    try {
      const arr = base64Data.split(',');
      const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
      const bstr = atob(arr[1] || arr[0]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, { type: mime });
    } catch (e) {
      return null;
    }
  }

  /**
   * Detecta a porcentagem e o status de envio de um card de mídia na biblioteca do FLOW
   * @param {HTMLElement|null} targetCard - Card do virtuoso sendo monitorado
   * @returns {{ isUploading: boolean, percent: number|null, statusText: string, isComplete: boolean }}
   */
  detectUploadProgress(targetCard) {
    const result = {
      isUploading: false,
      percent: null,
      statusText: '',
      isComplete: false
    };

    if (!targetCard) return result;

    // 1. Procura por percentual explícito no card (ex: "35%", "80%", "100%")
    const cardText = (targetCard.textContent || targetCard.innerText || '').trim();
    const pctMatch = cardText.match(/\b(\d{1,3})\s*%/);
    if (pctMatch) {
      const val = parseInt(pctMatch[1], 10);
      if (!isNaN(val)) {
        result.percent = val;
        if (val >= 100) {
          result.isComplete = true;
        } else {
          result.isUploading = true;
        }
      }
    }

    // 2. Procura atributos em barras de progresso nativas ou ARIA (role="progressbar", progress, aria-valuenow)
    const progressEl = targetCard.querySelector('[role="progressbar"], progress, [aria-valuenow], [class*="progress" i]');
    if (progressEl) {
      result.isUploading = true;
      const now = progressEl.getAttribute('aria-valuenow') || progressEl.getAttribute('value');
      const max = progressEl.getAttribute('aria-valuemax') || progressEl.getAttribute('max') || '100';
      if (now !== null) {
        const pNow = parseFloat(now);
        const pMax = parseFloat(max);
        if (!isNaN(pNow) && !isNaN(pMax) && pMax > 0) {
          result.percent = Math.round((pNow / pMax) * 100);
          if (result.percent >= 100) result.isComplete = true;
        }
      }
      const fillEl = progressEl.querySelector('[style*="width"], [class*="fill" i], [class*="bar" i]') || progressEl;
      if (fillEl && fillEl.style && fillEl.style.width && fillEl.style.width.includes('%')) {
        const wVal = parseInt(fillEl.style.width, 10);
        if (!isNaN(wVal)) {
          result.percent = wVal;
          if (wVal >= 100) result.isComplete = true;
        }
      }
    }

    // 3. Procura por spinners de carregamento ou anéis de progresso SVG no card
    const spinner = targetCard.querySelector([
      '[class*="spinner" i]',
      '[class*="loading" i]',
      '[class*="uploading" i]',
      '[data-testid*="loading" i]',
      '[data-testid*="progress" i]',
      'svg[class*="spin" i]',
      'circle[stroke-dashoffset]'
    ].join(', '));
    if (spinner && FlowMacroEngine.isElementVisible(spinner)) {
      result.isUploading = true;
    }

    // 4. Procura por percentual em toda a biblioteca ou gaveta de mídia (caso haja barra global de upload)
    if (!result.isUploading && result.percent === null) {
      const virtuosoList = targetCard.closest('[data-testid="virtuoso-item-list"]') || document.querySelector('[data-testid="virtuoso-item-list"]');
      const drawer = virtuosoList ? virtuosoList.parentElement : null;
      if (drawer) {
        const drawerText = (drawer.textContent || '').trim();
        const drawerPctMatch = drawerText.match(/\b(\d{1,3})\s*%/);
        if (drawerPctMatch) {
          const dVal = parseInt(drawerPctMatch[1], 10);
          if (!isNaN(dVal)) {
            result.percent = dVal;
            if (dVal >= 100) result.isComplete = true;
            else result.isUploading = true;
          }
        }
      }
    }

    // 5. Verifica se há indicadores de conclusão no card (imagem thumbnail renderizada)
    const img = targetCard.querySelector('img');
    const hasLoadedImg = img && img.complete && img.naturalWidth > 0 && !img.src.startsWith('data:image/svg');
    const bgImage = targetCard.style && targetCard.style.backgroundImage && targetCard.style.backgroundImage.includes('url');

    // 6. Verifica texto de status no painel de detalhes do FLOW (ex: "Imagem enviada" conforme Image 1)
    const statusElements = Array.from(document.querySelectorAll('span, p, div')).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const t = (el.textContent || '').trim().toLowerCase();
      return t === 'imagem enviada' || t === 'enviando...' || t === 'upload concluído';
    });
    for (const st of statusElements) {
      const txt = (st.textContent || '').trim().toLowerCase();
      if (txt.includes('imagem enviada') || txt.includes('upload concluído')) {
        result.statusText = 'Imagem enviada';
        result.isComplete = true;
      } else if (txt.includes('enviando')) {
        result.isUploading = true;
        result.statusText = 'Enviando...';
      }
    }

    if (!result.isUploading && (hasLoadedImg || bgImage) && !spinner) {
      result.isComplete = true;
    }

    return result;
  }

  /**
   * Monitora ativamente o progresso de upload da imagem do personagem na biblioteca do FLOW até 100%
   * @param {number} cIdx - Índice do personagem
   * @param {string} charName - Nome do personagem
   * @param {number} maxWaitSeconds - Tempo máximo de espera em segundos (padrão 60s)
   * @returns {Promise<boolean>}
   */
  async waitForCardUploadCompletion(cIdx, charName, maxWaitSeconds = 35) {
    this.addLog(`⏳ [Passo 3] Monitorando envio da imagem de [${charName}] para o FLOW...`, 'info');

    const startTime = Date.now();
    const maxWaitMs = maxWaitSeconds * 1000;
    let lastLoggedPercent = -1;
    let stableCompleteChecks = 0;

    while (Date.now() - startTime < maxWaitMs) {
      if (this.state === 'stopped' || this.state === 'paused') return false;

      // Localiza o card correspondente ao índice ou o mais recente da lista
      const mediaCards = this.getLibraryMediaCards();
      let targetCard = (cIdx < mediaCards.length) ? mediaCards[cIdx] : (mediaCards.length > 0 ? mediaCards[0] : null);

      // Também tenta localizar o card pelo nome do personagem na lista
      if (!targetCard && charName) {
        const nameLower = charName.toLowerCase().replace(/_/g, ' ');
        const nameUnder = charName.toLowerCase().replace(/\s+/g, '_');
        for (const c of mediaCards) {
          const t = (c.textContent || '').toLowerCase();
          if (t.includes(charName.toLowerCase()) || t.includes(nameLower) || t.includes(nameUnder)) {
            targetCard = c;
            break;
          }
        }
      }

      if (!targetCard) {
        targetCard = document.querySelector(`[data-testid='virtuoso-item-list'] > div:nth-of-type(${cIdx + 1}) div.sc-b0e5-14, [data-testid='virtuoso-item-list'] > div:nth-of-type(${cIdx + 1})`);
      }

      // Se não encontrou card por índice, verifica se o modal centralizado de recursos está aberto
      // e tenta detectar progresso de upload diretamente no modal
      if (!targetCard && this._isResourceModalOpen()) {
        const modalProgress = this._detectResourceModalUploadProgress(charName);
        if (modalProgress.isUploading) {
          stableCompleteChecks = 0;
          if (modalProgress.percent !== null && modalProgress.percent !== lastLoggedPercent) {
            lastLoggedPercent = modalProgress.percent;
            this.addLog(`📊 [Upload Modal] [${charName}]: ${modalProgress.percent}% enviado...`, 'info');
          }
          this.currentAction = `⏳ Upload de [${charName}]: ${modalProgress.percent !== null ? modalProgress.percent + '%' : 'em andamento'}...`;
          this.notify();
          await new Promise(r => setTimeout(r, 400));
          continue;
        } else if (modalProgress.isComplete) {
          stableCompleteChecks++;
          if (stableCompleteChecks >= 2) {
            this.addLog(`✅ [Passo 3 Concluído] Imagem de [${charName}] pronta no modal de recursos!`, 'success');
            await new Promise(r => setTimeout(r, 600));
            return true;
          }
          await new Promise(r => setTimeout(r, 400));
          continue;
        }
        await new Promise(r => setTimeout(r, 400));
        continue;
      }

      if (!targetCard) {
        // Card ainda não renderizado na lista, aguarda
        await new Promise(r => setTimeout(r, 400));
        continue;
      }

      // Analisa o progresso do upload no card
      const progress = this.detectUploadProgress(targetCard);

      if (progress.isUploading && progress.percent !== null) {
        stableCompleteChecks = 0;
        if (progress.percent !== lastLoggedPercent && (progress.percent % 10 === 0 || progress.percent - lastLoggedPercent >= 10 || progress.percent >= 90)) {
          lastLoggedPercent = progress.percent;
          this.addLog(`📊 [Upload] [${charName}]: ${progress.percent}% enviado...`, 'info');
        }
        this.currentAction = `⏳ Upload de [${charName}]: ${progress.percent}%...`;
        this.notify();
      } else if (progress.isUploading) {
        stableCompleteChecks = 0;
        this.currentAction = `⏳ Enviando imagem de [${charName}]...`;
        this.notify();
      }

      // Se concluiu o upload (100% ou imagem pronta sem spinners)
      if (progress.isComplete && !progress.isUploading) {
        stableCompleteChecks++;
        if (stableCompleteChecks >= 2) {
          const finalPct = progress.percent !== null ? `${progress.percent}%` : '100%';
          this.addLog(`✅ [Passo 3 Concluído] Imagem de [${charName}] pronta na biblioteca (${finalPct})!`, 'success');
          await new Promise(r => setTimeout(r, 600));
          return true;
        }
      } else {
        stableCompleteChecks = 0;
      }

      await new Promise(r => setTimeout(r, 400));
    }

    this.addLog(`⚠️ [Passo 3] Tempo limite de upload (${maxWaitSeconds}s) atingido para [${charName}]. Tentando prosseguir...`, 'warning');
    return true;
  }

  /**
   * Detecta progresso de upload dentro do modal centralizado de recursos do FLOW
   * Procura por spinners de carregamento, porcentagens e imagens carregadas no modal
   * @param {string} charName - Nome do personagem para log
   * @returns {{isUploading: boolean, percent: number|null, isComplete: boolean}}
   */
  _detectResourceModalUploadProgress(charName) {
    const result = { isUploading: false, percent: null, isComplete: false };

    // Busca todos os elementos dentro do modal de recursos
    const modalElements = [this.getLibraryContainer()].filter(Boolean);
    if (modalElements.length === 0) {
      modalElements.push(...Array.from(document.querySelectorAll('.cdk-overlay-pane, div[role="dialog"], div[role="presentation"]')).filter(el => {
        if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        const t = (el.textContent || '').toLowerCase();
        return t.includes('pesquisar recursos') || t.includes('adicionar ao comando') || t.includes('incluir no comando') || t.includes('carregam') || t.includes('personagens') || t.includes('carregar multimídia');
      }));
    }

    for (const modal of modalElements) {
      const modalText = (modal.textContent || '').trim();

      // Detecta porcentagem de upload no modal
      const pctMatch = modalText.match(/\b(\d{1,3})\s*%/);
      if (pctMatch) {
        const val = parseInt(pctMatch[1], 10);
        if (!isNaN(val) && val >= 0 && val <= 100) {
          result.percent = val;
          if (val >= 100) {
            result.isComplete = true;
          } else {
            result.isUploading = true;
          }
        }
      }

      // Detecta spinners de carregamento no modal
      const spinner = modal.querySelector([
        '[class*="spinner" i]', '[class*="loading" i]', '[class*="uploading" i]',
        'svg[class*="spin" i]', 'circle[stroke-dashoffset]',
        '[data-testid*="loading" i]', '[data-testid*="progress" i]'
      ].join(', '));
      if (spinner && FlowMacroEngine.isElementVisible(spinner)) {
        result.isUploading = true;
      }

      // Detecta barra de progresso no modal
      const progressBar = modal.querySelector('[role="progressbar"], progress, [aria-valuenow]');
      if (progressBar) {
        result.isUploading = true;
        const now = progressBar.getAttribute('aria-valuenow') || progressBar.getAttribute('value');
        const max = progressBar.getAttribute('aria-valuemax') || progressBar.getAttribute('max') || '100';
        if (now !== null) {
          const pNow = parseFloat(now);
          const pMax = parseFloat(max);
          if (!isNaN(pNow) && !isNaN(pMax) && pMax > 0) {
            result.percent = Math.round((pNow / pMax) * 100);
            if (result.percent >= 100) {
              result.isComplete = true;
              result.isUploading = false;
            }
          }
        }
      }

      // Se tem imagem carregada (preview completo) e sem spinners, está completo
      const previewImg = modal.querySelector('img[src]:not([src^="data:image/svg"])');
      if (previewImg && previewImg.complete && previewImg.naturalWidth > 50 && !spinner && !progressBar) {
        result.isComplete = true;
      }
    }

    return result;
  }

  /**
   * Localiza o botão "Incluir no comando" / "Adicionar ao comando" no FLOW
   * @returns {HTMLElement|null}
   */
  findIncludeInCommandButton() {
    // 1. Busca primeiro dentro dos containers de modal ativos (prioridade máxima)
    const modalContainers = [this.getLibraryContainer()].filter(Boolean);
    if (modalContainers.length === 0) {
      modalContainers.push(...Array.from(document.querySelectorAll('.cdk-overlay-pane, div[role="dialog"], div[role="presentation"]')).filter(el => {
        return FlowMacroEngine.isElementVisible(el) && !el.closest('[id*="fd-"], [class*="fd-"]');
      }));
    }

    const isMatch = (el) => {
      if (!FlowMacroEngine.isElementVisible(el)) return false;
      if (el.closest('[id*="fd-"], [class*="fd-"]')) return false;

      // Restringe dimensões para evitar pegar containers grandes
      const rect = el.getBoundingClientRect();
      if (rect.width > 380 || rect.height > 80 || rect.width < 25 || rect.height < 15) return false;

      const t = (el.textContent || el.innerText || '').toLowerCase().trim();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();

      return (
        t === 'adicionar ao comando' || t === 'incluir no comando' ||
        t === 'adicionar ao prompt' || t === 'incluir no prompt' ||
        aria === 'adicionar ao comando' || aria === 'incluir no comando' ||
        aria === 'adicionar ao prompt' || aria === 'incluir no prompt' ||
        t === 'adicionar' || t === 'incluir' ||
        (t.length < 35 && (t.includes('adicionar ao') || t.includes('incluir no')) && (t.includes('comando') || t.includes('prompt')))
      );
    };

    // 1.1 Procura no modal
    for (const modal of modalContainers) {
      const candidates = Array.from(modal.querySelectorAll('button, [role="button"], div[tabindex="0"], div, a, span')).filter(isMatch);
      if (candidates.length > 0) {
        const btn = candidates.find(c => c.tagName === 'BUTTON' || c.getAttribute('role') === 'button');
        return btn || candidates[candidates.length - 1];
      }
    }

    // 1.2 Seletores diretos gravados no DevTools
    const exactSelectors = [
      'button[aria-label*="adicionar ao comando" i]',
      'button[aria-label*="incluir no comando" i]',
      'button[aria-label*="adicionar ao prompt" i]',
      'button[aria-label*="incluir no prompt" i]',
      'div.sc-4da33547-5 button'
    ];

    for (const sel of exactSelectors) {
      const btn = document.querySelector(sel);
      if (btn && FlowMacroEngine.isElementVisible(btn) && !btn.closest('[id*="fd-"], [class*="fd-"]')) {
        return btn;
      }
    }

    // 1.3 Busca em todos os elementos clicáveis da página
    const allCandidates = Array.from(document.querySelectorAll('button, [role="button"], div[tabindex="0"], div, a, span')).filter(isMatch);
    if (allCandidates.length > 0) {
      const btn = allCandidates.find(c => c.tagName === 'BUTTON' || c.getAttribute('role') === 'button');
      return btn || allCandidates[allCandidates.length - 1];
    }

    return null;
  }

  /**
   * Localiza o card correspondente ao personagem na biblioteca do FLOW
   * Prioridade 1: Similaridade visual de pixels (compara avatarUrl do personagem com miniaturas dos cards)
   * Prioridade 2: Nome do arquivo ou nome do personagem no texto do card
   * Prioridade 3: Posição indexada na virtuoso-item-list
   * @param {Object} char - Configuração do personagem
   * @param {number} cIdx - Índice do personagem
   * @returns {Promise<HTMLElement|null>}
   */
  async findCharacterCardInLibrary(char, cIdx) {
    const mediaCards = this.getLibraryMediaCards();
    if (mediaCards.length === 0) return null;

    const rawAvatar = char.avatarUrl || char.avatar || char.imageData || char.image || char.foto || char.src || '';
    const avatarData = rawAvatar.startsWith('data:') || rawAvatar.startsWith('http') || rawAvatar.startsWith('blob:')
      ? rawAvatar
      : (rawAvatar ? `data:image/png;base64,${rawAvatar}` : '');
    const charNameClean = (char.name || '').toLowerCase().trim();

    // Prioridade 1: Busca por texto contendo o nome do personagem na biblioteca
    if (charNameClean) {
      const nameWithSpaces = charNameClean.replace(/_/g, ' ');
      const nameWithUnderscores = charNameClean.replace(/\s+/g, '_');
      for (const card of mediaCards) {
        const cardText = (card.textContent || '').toLowerCase();
        if (
          cardText.includes(charNameClean) ||
          cardText.includes(nameWithSpaces) ||
          cardText.includes(nameWithUnderscores) ||
          cardText.includes(`${charNameClean}_`)
        ) {
          this.addLog(`🎯 [Passo 4] Card de [${char.name}] localizado pelo nome na biblioteca!`, 'info');
          return card;
        }
      }
    }

    // Prioridade 2: Comparação por Similaridade Visual de Imagem / Pixels
    if (avatarData) {
      let bestMatch = null;
      let highestSimilarity = 0;

      for (const card of mediaCards) {
        const imgEl = card.querySelector('img');
        if (imgEl && FlowMacroEngine.isElementVisible(imgEl)) {
          try {
            const sim = await FlowMacroEngine.computeImageSimilarity(imgEl, avatarData);
            if (sim > highestSimilarity) {
              highestSimilarity = sim;
              bestMatch = card;
            }
          } catch (e) {}
        }
      }

      if (bestMatch && highestSimilarity >= 45) {
        this.addLog(`🎯 [Passo 4] Card de [${char.name}] identificado por similaridade de imagem (${highestSimilarity}% de correspondência)!`, 'success');
        return bestMatch;
      }
    }

    // Prioridade 3: Se acabamos de fazer upload deste personagem no FLOW, o primeiro card da aba Carregamentos é ele!
    if (this.uploadedAvatarsInFlow && this.uploadedAvatarsInFlow.has(char.name) && mediaCards.length > 0) {
      this.addLog(`🎯 [Passo 4] Selecionando o primeiro card recente da aba Carregamentos para [${char.name}]...`, 'info');
      return mediaCards[0];
    }

    // Prioridade 4: Posição indexada na lista de mídia
    if (cIdx < mediaCards.length) {
      return mediaCards[cIdx];
    }

    return null;
  }

  /**
   * Valida se o personagem foi anexado à barra de comando (Passo 4)
   * Prioridade 1: Similaridade visual de pixels (compara avatarUrl com as imagens no prompt dock)
   * Prioridade 2: Contagem estrita de chips anexados (promptChips.length >= cIdx + 1)
   * @param {Object} char - Personagem atual
   * @param {number} cIdx - Índice atual
   * @returns {Promise<boolean>}
   */
  async validateCharacterChipAttached(char, cIdx) {
    const promptChips = this.getPromptAttachedChips();
    const rawAvatar = char.avatarUrl || char.avatar || char.imageData || char.image || char.foto || char.src || '';
    const avatarData = rawAvatar.startsWith('data:') || rawAvatar.startsWith('http') || rawAvatar.startsWith('blob:')
      ? rawAvatar
      : (rawAvatar ? `data:image/png;base64,${rawAvatar}` : '');

    // 1. Verificação por Similaridade Visual de Pixels no dock de prompt
    if (avatarData && promptChips.length > 0) {
      for (const chip of promptChips) {
        const imgEl = chip.tagName === 'IMG' ? chip : chip.querySelector('img');
        if (imgEl) {
          try {
            const sim = await FlowMacroEngine.computeImageSimilarity(imgEl, avatarData);
            if (sim >= 45) {
              this.addLog(`✅ [Passo 4 Concluído] Chip de [${char.name}] confirmado visualmente no prompt (${sim}% de similaridade de pixels)!`, 'success');
              return true;
            }
          } catch (e) {}
        }
      }
    }

    // 2. Validação estrita por contagem de chips
    if (promptChips.length >= (cIdx + 1)) {
      return true;
    }

    return false;
  }

  /**
   * Anexa imagens de personagens de referência no FLOW via modal de biblioteca/upload
   * Executa os Passos 2, 3 e 4 do fluxograma oficial:
   * - Passo 2: Clica no botão "+" na barra de prompt para anexar imagens.
   * - Passo 3: Busca na biblioteca do FLOW ou clica em "Enviar Mídia" para fazer upload e aguarda 100%.
   * - Passo 4: Seleciona o card do personagem após upload concluído, clica em "Incluir no comando" e valida o chip.
   * - Loop: Se existir mais de um personagem ativo, processa sequencialmente todos os personagens.
   * @returns {Promise<boolean>}
   */
  /**
   * Remove todos os chips residuais da barra de comandos para iniciar a anexação limpa
   */
  clearAllPromptChips() {
    try {
      const promptContainer = this.getPromptContainer();
      if (!promptContainer) return;

      const submitBtn = this.findSubmitButton();
      const plusBtn = this.findPlusButton();

      // 1. Hover sobre os chips para garantir que botões de fechar/remover fiquem visíveis no DOM
      const chips = this.getPromptAttachedChips();
      for (const chip of chips) {
        try {
          chip.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          chip.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        } catch (e) {}
      }

      // 2. Busca botões de fechar dentro de cada chip ou dentro do promptContainer
      for (const chip of chips) {
        const closeBtn = chip.querySelector('button, [role="button"], svg, [class*="remove" i], [class*="close" i], [aria-label*="remover" i], [aria-label*="remove" i]') || chip;
        if (closeBtn && FlowMacroEngine.isSafeToClick(closeBtn)) {
          this.clickElementWithOverlay(closeBtn);
        }
      }

      const removeBtns = Array.from(promptContainer.querySelectorAll('button, [role="button"], svg, div[tabindex="0"]')).filter(b => {
        if (!FlowMacroEngine.isElementVisible(b) || b.closest('[id*="fd-"], [class*="fd-"]')) return false;
        if (b === submitBtn || b === plusBtn || (submitBtn && submitBtn.contains(b)) || (plusBtn && plusBtn.contains(b))) return false;
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const t = (b.textContent || '').trim().toLowerCase();
        return aria.includes('remover') || aria.includes('remove') || aria.includes('fechar') || aria.includes('close') || aria.includes('delete') || t === '✕' || t === '×';
      });

      for (const btn of removeBtns) {
        this.simulateClick(btn);
      }
    } catch (e) {
      console.warn('[FLOW Macro] clearAllPromptChips warning:', e);
    }
  }

  /**
   * Remove chips residuais de imagens geradas do Canvas (ex: chips com botão "Baixar")
   * Mantendo apenas chips reais de personagens de referência
   */
  cleanupStrayPromptChips() {
    try {
      // 1. Elementos dentro do promptContainer ou no dock de anexos inferior
      const containers = [this.getPromptContainer(), document.body].filter(Boolean);
      const strayCandidates = [];

      for (const container of containers) {
        const els = Array.from(container.querySelectorAll('div, span')).filter(el => {
          if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
          if (el.closest('[class*="canvas" i], [data-testid="virtuoso-scroller"], [data-testid="virtuoso-item-list"]')) return false;
          const rect = el.getBoundingClientRect();
          if (rect.bottom < window.innerHeight - 350) return false;
          const t = (el.textContent || '').toLowerCase();
          const hasImg = el.querySelector('img') !== null;
          return hasImg && (t.includes('baixar') || t.includes('download'));
        });
        strayCandidates.push(...els);
      }

      for (const stray of strayCandidates) {
        const delBtn = stray.querySelector('button, [role="button"], svg, [class*="close" i], [class*="remove" i], [class*="delete" i], [aria-label*="remover" i], [aria-label*="remove" i]');
        if (delBtn && FlowMacroEngine.isSafeToClick(delBtn)) {
          this.clickElementWithOverlay(delBtn);
        }
      }
    } catch (e) {
      console.warn('[FLOW Macro] cleanupStrayPromptChips warning:', e);
    }
  }

  /**
   * Anexa imagens de personagens de referência no FLOW via modal de biblioteca/upload
   * Executa os Passos 2, 3 e 4 do fluxograma oficial:
   * - Passo 2: Clica no botão "+" na barra de prompt para anexar imagens e seleciona a aba "Carregamentos".
   * - Passo 3: Se o personagem ainda não estiver na biblioteca no primeiro slide, faz upload silencioso do avatar e aguarda 100%.
   * - Passo 4: Seleciona o card do personagem, clica em "Adicionar ao comando", valida o chip e fecha o modal.
   * @returns {Promise<boolean>}
   */
  async attachCharactersFromFlowLibrary() {
    // 0. Garante que estamos na tela de Canvas do projeto e não em /characters
    if (FlowMacroEngine.isFlowCharactersPage()) {
      await FlowMacroEngine.ensureOnFlowCanvas();
    }

    // 0. Fecha qualquer banner de onboarding ou tutorial
    this.dismissFlowOnboardingBanners();

    // 0.1 Limpa eventuais chips espúrios de gerações anteriores com rótulo "Baixar"
    this.cleanupStrayPromptChips();

    const activeChars = (this.characters && this.characters.length > 0)
      ? this.characters.filter(c => c.enabled !== false)
      : [];

    if (activeChars.length === 0) {
      return true; // Nenhum personagem configurado, avança imediatamente
    }

    // 0.2 Verifica chips existentes na barra de prompt
    const existingChips = this.getPromptAttachedChips();
    if (existingChips.length > activeChars.length) {
      this.addLog(`🧹 Detectados ${existingChips.length} chips no prompt (esperado: ${activeChars.length}). Removendo chips duplicados...`, 'info');
      await this.clearAllPromptChips();
      await new Promise(r => setTimeout(r, 600));
    } else if (existingChips.length === activeChars.length) {
      this.addLog(`ℹ️ Todos os ${activeChars.length} personagens já anexados na barra de prompt.`, 'info');
      await this.closeResourceModal();
      return true;
    }

    this.addLog(`🎭 [Passos 2, 3 e 4] Anexando ${activeChars.length} personagem(ns) de referência no FLOW...`, 'info');

    // Itera sequencialmente sobre cada personagem ativo (Passos 2 -> 3 -> 4)
    for (let cIdx = 0; cIdx < activeChars.length; cIdx++) {
      const char = activeChars[cIdx];

      this.currentAction = `🎭 Anexando personagem: ${char.name} (${cIdx + 1}/${activeChars.length})...`;
      this.notify();

      // Verifica se este personagem específico já está presente na barra de prompt (validação visual)
      const alreadyAttached = await this.validateCharacterChipAttached(char, cIdx);
      if (alreadyAttached) {
        this.addLog(`ℹ️ Personagem [${char.name}] (${cIdx + 1}/${activeChars.length}) já anexado ao prompt (confirmado visualmente).`, 'info');
        continue;
      }

      let chipConfirmedForChar = false;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          // Antes de re-tentar, verifica se o chip já foi inserido na tentativa anterior
          const alreadyDoneNow = await this.validateCharacterChipAttached(char, cIdx);
          if (alreadyDoneNow) {
            this.addLog(`✅ [Tentativa ${attempt + 1}/3] Chip de [${char.name}] já confirmado! Não é necessário re-tentar.`, 'success');
            chipConfirmedForChar = true;
            break;
          }
          this.addLog(`🔄 [Tentativa ${attempt + 1}/3] Re-tentando anexar [${char.name}]...`, 'warning');
          await new Promise(r => setTimeout(r, 1000));
        }

        this.dismissFlowOnboardingBanners();

        // Passo 2: Garantir que a biblioteca/galeria de mídia do FLOW está aberta
        let libraryOpen = this.isFlowLibraryOpen();

        if (!libraryOpen) {
          this.addLog(`📂 [Passo 2] Abrindo biblioteca do FLOW para [${char.name}] (${cIdx + 1}/${activeChars.length})...`, 'info');
          libraryOpen = await this.ensureFlowLibraryOpen();

          if (!libraryOpen) {
            this.addLog('⚠️ Biblioteca do FLOW não abriu após clicar no botão "+".', 'warning');
            if (attempt < 2) continue;
            this.addLog(`⚠️ Não foi possível acessar a biblioteca do FLOW após 3 tentativas.`, 'warning');
            return false;
          }
        } else {
          this.addLog(`📂 [Passo 2] Biblioteca do FLOW já aberta. Selecionando personagem [${char.name}]...`, 'info');
        }

        // Garante que o campo de busca de recursos está limpo para exibir todos os itens
        const modalEl = this.getLibraryContainer();
        if (modalEl) {
          const searchInput = modalEl.querySelector('input[placeholder*="Pesquisar recursos" i], input[placeholder*="search" i]');
          if (searchInput && searchInput.value) {
            searchInput.value = '';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            searchInput.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }

        // Garante que estamos na aba "Carregamentos" (onde imagens enviadas ficam)
        await this.selectLibraryModalTab('Carregamentos');
        await this.stepDelay(null, `Buscando imagem de [${char.name}] na biblioteca...`);

        // Busca o card na biblioteca do FLOW
        let targetCard = null;
        for (let cWait = 0; cWait < 8; cWait++) {
          targetCard = await this.findCharacterCardInLibrary(char, cIdx);
          if (targetCard) break;
          await new Promise(r => setTimeout(r, 300));
        }

        // Se não encontrou em Carregamentos, verifica também na aba Personagens
        if (!targetCard) {
          const switchedToChars = await this.selectLibraryModalTab('Personagens');
          if (switchedToChars) {
            await new Promise(r => setTimeout(r, 400));
            targetCard = await this.findCharacterCardInLibrary(char, cIdx);
          }
        }

        const avatarData = char.avatarUrl || char.avatar || char.imageData || char.image || char.foto || char.src || '';

        // =========================================================================
        // Passo 3: Se o card NÃO foi encontrado na biblioteca e temos imagem de avatar:
        // Realiza o upload no primeiro slide do projeto via file input silencioso e drop event
        // =========================================================================
        const alreadyUploaded = this.uploadedAvatarsInFlow && this.uploadedAvatarsInFlow.has(char.name);

        // Se já foi enviado antes mas não encontrou, espera mais tempo (card pode estar carregando)
        if (!targetCard && alreadyUploaded) {
          this.addLog(`🔄 [Passo 3] [${char.name}] já foi enviado antes. Aguardando card aparecer na biblioteca...`, 'info');
          await this.selectLibraryModalTab('Carregamentos');
          for (let extraWait = 0; extraWait < 20; extraWait++) {
            targetCard = await this.findCharacterCardInLibrary(char, cIdx);
            if (targetCard) break;
            await new Promise(r => setTimeout(r, 500));
          }
          if (!targetCard) {
            this.addLog(`⚠️ [Passo 3] Card de [${char.name}] não apareceu após espera extra. Verificando aba Personagens...`, 'warning');
            await this.selectLibraryModalTab('Personagens');
            await new Promise(r => setTimeout(r, 600));
            targetCard = await this.findCharacterCardInLibrary(char, cIdx);
          }
        }

        if (!targetCard && !alreadyUploaded) {
          if (avatarData) {
            this.addLog(`📤 [Passo 3] Card para [${char.name}] não encontrado na biblioteca. Fazendo upload do avatar (${Math.round(avatarData.length / 1024)} KB) para o FLOW...`, 'info');

            // Volta para a aba Carregamentos antes de enviar
            await this.selectLibraryModalTab('Carregamentos');
            await new Promise(r => setTimeout(r, 400));

            try {
              // Converte avatarData para Blob e File
              let blob;
              if (avatarData.startsWith('data:') || avatarData.startsWith('blob:') || avatarData.startsWith('http')) {
                blob = await fetch(avatarData).then(r => r.blob());
              } else {
                blob = await fetch(`data:image/png;base64,${avatarData}`).then(r => r.blob());
              }

              const safeName = (char.name || `char_${cIdx + 1}`).replace(/[^\w\d-_]/g, '_');
              const file = new File([blob], `${safeName}.jpeg`, { type: blob.type || 'image/jpeg' });
              const dt = new DataTransfer();
              dt.items.add(file);

              // 1. Envia arquivo para o interceptor Main World (flow_main_world.js)
              if (typeof window !== 'undefined') {
                window.postMessage({
                  type: 'FLOW_SET_PENDING_FILE',
                  file: file,
                  blob: blob,
                  name: file.name,
                  mimeType: file.type
                }, '*');
                await new Promise(r => setTimeout(r, 150));
              }

              // 2. Localiza botão/área de upload pelo seletor exato .upload-text ou texto "Carregar multimídia"
              const uploadSpan = document.querySelector('.upload-text, span.upload-text') ||
                Array.from(document.querySelectorAll('span, div, button, label, [role="button"], p')).find(el => {
                  if (el.closest('[id*="fd-"], [class*="fd-"]')) return false;
                  const t = (el.textContent || '').trim().toLowerCase();
                  return t === 'carregar multimídia' || t === 'carregar multimidia' ||
                         t.includes('carregar multimídia') || t.includes('carregar multimidia') ||
                         t === 'enviar mídia' || t === 'enviar media' || t.includes('upload');
                });

              const uploadBtn = uploadSpan ? (uploadSpan.closest('button, label, [role="button"], div[tabindex="0"]') || uploadSpan) : null;

              // 3. Busca input de arquivo diretamente (inclusive atravessando Shadow Roots)
              let fileInput = this.findFileInputDeep();
              if (!fileInput && uploadBtn) {
                fileInput = uploadBtn.querySelector('input[type="file"]') ||
                            uploadBtn.parentElement?.querySelector('input[type="file"]');
              }

              let uploadDispatched = false;

              if (fileInput) {
                this.addLog(`📤 [Passo 3] Disparando envio de "${file.name}" via input de arquivo localizado...`, 'info');
                fileInput.files = dt.files;
                fileInput.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
                fileInput.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
                if (typeof fileInput.onchange === 'function') {
                  try { fileInput.onchange(new Event('change')); } catch (e) {}
                }
                uploadDispatched = true;
              }

              // 4. Clica no botão de upload (acionando o interceptor Main World para chamadas programáticas de file picker)
              if (uploadBtn) {
                const btnLabel = (uploadBtn.textContent || '').trim().substring(0, 30);
                this.addLog(`📤 [Passo 3] Acionando botão "${btnLabel}" para upload de [${char.name}]...`, 'info');
                this.simulateClick(uploadBtn);
                uploadDispatched = true;
                await new Promise(r => setTimeout(r, 500));
              }

              // 5. Dispara Drag & Drop sintético como reforço na área da modal
              const modalContainer = this.getLibraryContainer() || document.querySelector('.cdk-overlay-pane');
              if (modalContainer) {
                this.dispatchSyntheticDrop(modalContainer, file);
              }
              if (uploadBtn && uploadBtn !== modalContainer) {
                this.dispatchSyntheticDrop(uploadBtn, file);
              }

              if (!uploadDispatched) {
                this.addLog('⚠️ [Passo 3] Não foi possível encontrar input de arquivos nem área de upload no FLOW.', 'warning');
              } else {
                // Monitora ativamente o upload até 100% de conclusão (timeout: 35s)
                await this.waitForCardUploadCompletion(cIdx, char.name, 35);

                if (this.uploadedAvatarsInFlow) {
                  this.uploadedAvatarsInFlow.add(char.name);
                }

                // Garante que estamos na aba Carregamentos onde o arquivo foi enviado
                await this.selectLibraryModalTab('Carregamentos');
                await new Promise(r => setTimeout(r, 600));

                // Localiza o card recém-enviado
                for (let cWait = 0; cWait < 15; cWait++) {
                  targetCard = await this.findCharacterCardInLibrary(char, cIdx);
                  if (targetCard) break;
                  await new Promise(r => setTimeout(r, 400));
                }
              }
            } catch (uploadErr) {
              console.warn('[FLOW Macro] Erro no upload de avatar:', uploadErr);
              this.addLog(`⚠️ [Passo 3] Erro ao enviar avatar de [${char.name}]: ${uploadErr.message}`, 'warning');
            }
          } else {
            this.addLog(`⚠️ [Passo 3] Personagem [${char.name}] não possui foto/avatar cadastrado na extensão! Cadastre a foto na aba "Personagens" da extensão.`, 'warning');
          }
        }

        // Passo 4: Clicar no card correspondente ao personagem atual
        if (targetCard) {
          this.addLog(`🎯 [Passo 4] Clicando no card de [${char.name}] (${cIdx + 1}/${activeChars.length})...`, 'info');

          // NUNCA clicar direto na <img> — isso abre o lightbox/expandido.
          // Prefere o container com role=button, ou o próprio card, mas nunca a img isolada.
          const safeCardClick = (card) => {
            const roleBtn = card.querySelector('[role="button"]:not(img), div[tabindex="0"]:not(img), [data-type="button-overlay"]');
            const target = roleBtn || card;
            target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            this.clickElementWithOverlay(target);
          };

          safeCardClick(targetCard);
          await new Promise(r => setTimeout(r, 800));

          if (this.isImageExpanded()) {
            this.addLog('⚠️ Imagem foi expandida ao invés de selecionada. Retornando ao Canvas e re-tentando...', 'warning');
            await this.exitExpandedImageView();
            await new Promise(r => setTimeout(r, 500));

            targetCard = await this.findCharacterCardInLibrary(char, cIdx);
            if (targetCard) {
              const textLabel = targetCard.querySelector('span, p, div[class*="name" i], div[class*="label" i]');
              if (textLabel && FlowMacroEngine.isElementVisible(textLabel)) {
                this.addLog('🔄 [Passo 4] Tentando selecionar card pelo label de texto...', 'info');
                this.clickElementWithOverlay(textLabel);
              } else {
                safeCardClick(targetCard);
              }
              await new Promise(r => setTimeout(r, 800));

              if (this.isImageExpanded()) {
                await this.exitExpandedImageView();
                await new Promise(r => setTimeout(r, 500));
              }
            }
          }
        } else {
          this.addLog(`⚠️ [Passo 4] Card para [${char.name}] não encontrado na biblioteca. Tentativa ${attempt + 1}/3.`, 'warning');
          if (attempt < 2) continue;
          return false;
        }

        // Passo 4.3: Localiza e clica no botão "Adicionar ao comando" / "Incluir no comando"
        let includeBtn = null;
        for (let bWait = 0; bWait < 55; bWait++) {
          const btn = this.findIncludeInCommandButton();
          if (btn) {
            const isDisabled = btn.disabled || btn.getAttribute('aria-disabled') === 'true';
            if (!isDisabled) {
              includeBtn = btn;
              break;
            } else if (bWait % 5 === 0) {
              this.addLog(`⏳ [Passo 4] Botão "Adicionar ao comando" localizado. Aguardando habilitação no FLOW...`, 'info');
            }
          }

          // Re-seleção segura: nunca usa img, usa o container do card
          if ((bWait === 10 || bWait === 25 || bWait === 40) && targetCard) {
            this.addLog(`🔄 [Passo 4] Re-selecionando card de [${char.name}]...`, 'info');
            const roleBtn = targetCard.querySelector('[role="button"]:not(img), div[tabindex="0"]:not(img), [data-type="button-overlay"]');
            const reClick = roleBtn || targetCard;
            reClick.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            reClick.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
            this.clickElementWithOverlay(reClick);
          }

          await new Promise(r => setTimeout(r, 400));
        }

        if (includeBtn) {
          this.addLog(`✨ [Passo 4] Botão "Adicionar ao comando" pronto! Clicando...`, 'success');
          includeBtn.scrollIntoView({ behavior: 'instant', block: 'nearest' });
          if (includeBtn.focus) includeBtn.focus();
          this.clickElementWithOverlay(includeBtn);
          try { includeBtn.click(); } catch (e) {}
          await new Promise(r => setTimeout(r, 1000));
        } else {
          this.addLog(`⚠️ [Passo 4] Botão "Adicionar ao comando" não encontrado para [${char.name}].`, 'warning');
        }

        // Passo 4.4: Validação do chip anexado na barra de prompt
        this.addLog(`⏳ [Passo 4] Validando anexo do personagem [${char.name}] na barra de comando...`, 'info');
        let chipAttached = false;

        for (let chk = 0; chk < 25; chk++) {
          const isValid = await this.validateCharacterChipAttached(char, cIdx);
          if (isValid) {
            chipAttached = true;
            break;
          }
          await new Promise(r => setTimeout(r, 400));
        }

        if (!chipAttached && includeBtn) {
          // Re-verifica com delay adicional e verificação direta de contagem
          await new Promise(r => setTimeout(r, 800));
          const recheckChips = this.getPromptAttachedChips();
          if (recheckChips.length >= (cIdx + 1)) {
            chipAttached = true;
            this.addLog(`✅ [Passo 4] Chip de [${char.name}] confirmado na re-verificação após botão.`, 'success');
          } else {
            this.addLog(`⚠️ [Passo 4] Botão "Adicionar ao comando" foi clicado mas chip de [${char.name}] não detectado no DOM. Tentando novamente...`, 'warning');
          }
        }

        if (chipAttached) {
          this.addLog(`✅ [Passo 4 Concluído] Personagem [${char.name}] (${cIdx + 1}/${activeChars.length}) anexado com sucesso ao comando!`, 'success');
          chipConfirmedForChar = true;

          // Fecha modal de recursos após anexar o personagem para garantir estado limpo ao próximo
          await this.closeResourceModal();
          await new Promise(r => setTimeout(r, 600));
          break;
        } else {
          this.addLog(`⚠️ [Passo 4] Anexo de [${char.name}] não confirmado na barra de prompt. Tentativa ${attempt + 1}/3.`, 'warning');
          await new Promise(r => setTimeout(r, 600));
        }
      } // fim das tentativas

      if (!chipConfirmedForChar) {
        this.addLog(`⚠️ Não foi possível anexar o personagem [${char.name}] nesta tentativa. O slide tentará novamente na auto-recuperação.`, 'warning');
        return false;
      }

      await new Promise(r => setTimeout(r, 600));
    }

    // Garante que o modal de recursos está fechado ao concluir todos os personagens
    await this.closeResourceModal();
    await new Promise(r => setTimeout(r, 500));

    if (FlowMacroEngine.isFlowCharactersPage()) {
      await FlowMacroEngine.ensureOnFlowCanvas();
    }

    this.addLog(`✨ Todos os ${activeChars.length} personagem(ns) confirmados na barra de comando!`, 'success');
    return true;
  }

  /**
   * Fecha qualquer detalhe ou modal de recursos de forma segura e garantida
   * @param {HTMLElement} [dialogContainer] - Container opcional
   * @returns {Promise<boolean>}
   */
  async closeResourceModal(dialogContainer) {
    try {
      if (!this._isResourceModalOpen() && !dialogContainer) return true;

      // 1. Envia tecla Escape para activeElement, window e document (keydown + keyup)
      const targets = [document.activeElement, window, document].filter(Boolean);
      for (const t of targets) {
        t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
        t.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
      }
      await new Promise(r => setTimeout(r, 250));

      if (!this._isResourceModalOpen()) {
        this.addLog('📂 Modal de recursos fechado.', 'info');
        return true;
      }

      // 2. Tenta localizar botão fechar / close dentro do modal
      const modal = dialogContainer || this.getLibraryContainer() || document.querySelector('div[role="dialog"], div[role="presentation"], .cdk-overlay-pane');
      if (modal && FlowMacroEngine.isElementVisible(modal)) {
        const closeBtn = modal.querySelector('button[aria-label*="fechar" i], button[aria-label*="close" i], button[aria-label*="dismiss" i], button.sc-close, [data-testid*="close" i]') ||
          Array.from(modal.querySelectorAll('button, [role="button"]')).find(b => {
            const icon = b.querySelector('mat-icon, svg, i');
            const iconText = (icon?.textContent || '').trim().toLowerCase();
            const btnText = (b.textContent || '').trim().toLowerCase();
            return iconText === 'close' || btnText === 'close' || btnText === 'fechar' || b.getAttribute('aria-label')?.toLowerCase()?.includes('close');
          });

        if (closeBtn && FlowMacroEngine.isElementVisible(closeBtn)) {
          this.simulateClick(closeBtn);
          await new Promise(r => setTimeout(r, 300));
          if (!this._isResourceModalOpen()) return true;
        }

        // 3. Tenta clicar no backdrop do CDK ou fora do modal
        const cdkBackdrop = document.querySelector('.cdk-overlay-backdrop');
        if (cdkBackdrop && FlowMacroEngine.isElementVisible(cdkBackdrop)) {
          this.simulateClick(cdkBackdrop);
          await new Promise(r => setTimeout(r, 300));
          if (!this._isResourceModalOpen()) return true;
        }

        // Clique físico no backdrop fora do modal (área superior esquerda da tela)
        const rect = modal.getBoundingClientRect();
        const clickX = Math.max(10, Math.floor(rect.left / 2));
        const clickY = Math.max(10, Math.floor(rect.top / 2));
        const outsideEl = document.elementFromPoint(clickX, clickY) || document.body;
        if (outsideEl && !modal.contains(outsideEl) && !outsideEl.closest('[id*="fd-"], [class*="fd-"]')) {
          outsideEl.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: clickX, clientY: clickY }));
          outsideEl.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: clickX, clientY: clickY }));
          outsideEl.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, clientX: clickX, clientY: clickY }));
          outsideEl.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: clickX, clientY: clickY }));
          outsideEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: clickX, clientY: clickY }));
          await new Promise(r => setTimeout(r, 300));
        }
      }

      // 4. Fallback final Escape
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 200));

      return !this._isResourceModalOpen();
    } catch (e) {
      return false;
    }
  }

  /**
   * Verifica em tempo real se o Canvas do Google FLOW está com geração de imagens ativa
   * Detecta porcentagens (ex: 87%), barras de progresso, spinners e placeholders
   * @returns {{ generating: boolean, reason: string }}
   */
  isCanvasGenerating() {
    // 1. Elementos com texto de porcentagem no Canvas (ex: "87%", "15%", "0%")
    const percentageNodes = Array.from(document.querySelectorAll('span, div, p, text, b, strong')).filter(el => {
      if (el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      if (!FlowMacroEngine.isElementVisible(el)) return false;
      const t = (el.textContent || el.innerText || '').trim();
      return /^\d{1,3}\s*%$/.test(t) || /\b\d{1,2}%\b/.test(t);
    });

    if (percentageNodes.length > 0) {
      const pcts = percentageNodes.map(n => n.textContent.trim()).filter(Boolean);
      return { generating: true, reason: `Geração em andamento: ${pcts.slice(0, 4).join(', ')}` };
    }

    // 2. Elementos com papéis ou classes de progresso / carregamento
    const progressEls = Array.from(document.querySelectorAll([
      '[role="progressbar"]',
      'progress',
      'circle[stroke-dasharray]',
      '[class*="shimmer" i]',
      '[class*="skeleton" i]',
      'div[aria-label*="gerando" i]',
      'div[aria-label*="generating" i]',
      'div[aria-label*="criando" i]'
    ].join(', '))).filter(el => {
      if (el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      return FlowMacroEngine.isElementVisible(el);
    });

    if (progressEls.length > 0) {
      return { generating: true, reason: 'Barra de progresso ativa no Canvas' };
    }

    // 3. Botão de submit desabilitado com indicador de loading
    const submitBtn = this.findSubmitButton();
    if (submitBtn) {
      const isSubDisabled = submitBtn.getAttribute('aria-disabled') === 'true' || submitBtn.disabled;
      const hasSpinner = !!submitBtn.querySelector('[class*="spinner" i], [class*="loading" i], [class*="progress" i]');
      if (isSubDisabled && hasSpinner) {
        return { generating: true, reason: 'Botão de envio processando' };
      }
    }

    return { generating: false, reason: '' };
  }

  /**
   * Rola a barra de rolagem do Canvas do Google FLOW para o topo (scrollTop = 0)
   * Garante que os cards mais recentes gerados e a fila de produção fiquem imediatamente visíveis
   * @param {Object} [options] - Opções de rolagem
   * @param {boolean} [options.wait] - Se deve aguardar estabilização do DOM
   * @returns {Promise<boolean>}
   */
  async scrollCanvasToTop(options = { wait: false }) {
    try {
      let scrolledAny = false;

      // 1. Scroller do Virtuoso do Canvas e listas Virtuoso
      const virtuosoScrollers = Array.from(document.querySelectorAll([
        '[data-testid="virtuoso-scroller"]',
        '[data-virtuoso-scroller="true"]',
        'div[data-testid="virtuoso-item-list"]'
      ].join(', '))).filter(el => {
        if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        return true;
      });

      for (const el of virtuosoScrollers) {
        if (el.matches && el.matches('div[data-testid="virtuoso-item-list"]')) {
          let p = el.parentElement;
          while (p && p !== document.body) {
            if (p.scrollTop > 0) {
              p.scrollTop = 0;
              try { p.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {}
              p.dispatchEvent(new Event('scroll', { bubbles: true }));
              scrolledAny = true;
            }
            p = p.parentElement;
          }
          if (el.firstElementChild) {
            try { el.firstElementChild.scrollIntoView({ behavior: 'instant', block: 'start' }); } catch (e) {}
          }
        } else if (el.scrollTop > 0) {
          el.scrollTop = 0;
          try { el.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {}
          el.dispatchEvent(new Event('scroll', { bubbles: true }));
          scrolledAny = true;
        }
      }

      // 2. Outros containers de rolagem conhecidos do Canvas do FLOW
      const scrollableCandidates = Array.from(document.querySelectorAll('main, section, div[class*="canvas" i], div[class*="scroller" i], div[class*="grid" i], div[class*="feed" i], div[class*="stream" i], div[class*="gallery" i]')).filter(el => {
        if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        if (el.closest('[role="dialog"], [role="presentation"], .cdk-overlay-pane')) return false;
        return (el.scrollHeight > el.clientHeight + 40) && (getComputedStyle(el).overflowY !== 'hidden');
      });

      for (const container of scrollableCandidates) {
        if (container.scrollTop > 0) {
          container.scrollTop = 0;
          try { container.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {}
          container.dispatchEvent(new Event('scroll', { bubbles: true }));
          scrolledAny = true;
        }
      }

      // 3. Varredura direta de qualquer elemento no DOM com scrollTop > 0 (garantia universal contra novos layouts do FLOW)
      const allScrolled = Array.from(document.querySelectorAll('*')).filter(el => {
        if (el.closest && el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        return el.scrollTop > 0;
      });
      for (const sc of allScrolled) {
        sc.scrollTop = 0;
        try { sc.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) {}
        sc.dispatchEvent(new Event('scroll', { bubbles: true }));
        scrolledAny = true;
      }

      // 4. Janela e documento raiz
      if (window.scrollY > 0 || document.documentElement.scrollTop > 0 || document.body.scrollTop > 0) {
        window.scrollTo({ top: 0, behavior: 'instant' });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        scrolledAny = true;
      }

      if (options && options.wait) {
        await new Promise(r => setTimeout(r, 250));
      }
      return true;
    } catch (e) {
      console.warn('[FLOW Macro] Erro em scrollCanvasToTop:', e);
      return false;
    }
  }

  // =========================================================================
  // Detecção de Erros de Tela do FLOW e Auto-Recuperação com Atualização de Página
  // =========================================================================

  /**
   * Detecta se existem ERROS PRESENTES NA TELA DO FLOW (toasts de erro, modais, banners, falhas de sistema).
   * IMPORTANTE: Distingue erros de tela/sistema de falhas normais de geração em cards individuais.
   * @returns {{ hasError: boolean, message: string, element: HTMLElement|null }}
   */
  detectFlowScreenError() {
    if (typeof document === 'undefined') return { hasError: false, message: '', element: null };

    const screenErrorKeywords = [
      'algo deu errado',
      'something went wrong',
      'ocorreu um erro',
      'an error occurred',
      'tivemos um problema',
      'we ran into a problem',
      'houve um problema',
      'erro inesperado',
      'unexpected error',
      'limite de cota',
      'limite de geração',
      'limite atingido',
      'quota exceeded',
      'rate limit',
      'too many requests',
      'falha na solicitação',
      'falha de rede',
      'network error',
      'failed to fetch',
      'recarregue a página',
      'recarregar a página',
      'recarregar página',
      'reload the page',
      'please refresh',
      'servidor indisponível',
      'service unavailable',
      'internal server error',
      'não foi possível conectar',
      'unable to connect'
    ];

    // Seletores de alertas, notificações, toasts, banners e caixas de diálogo do FLOW
    const candidateSelectors = [
      '[role="alert"]',
      '[aria-live="assertive"]',
      'div[class*="toast" i]',
      'div[class*="snack" i]',
      'div[class*="banner" i]',
      'div[class*="error" i]',
      'div[class*="Error" i]',
      'div[class*="notification" i]',
      'div[class*="alert" i]',
      'div[role="dialog"]',
      '.cdk-overlay-pane'
    ];

    const errorEls = Array.from(document.querySelectorAll(candidateSelectors.join(', '))).filter(el => {
      // Ignora elementos da própria interface da extensão
      if (el.closest && el.closest('[id*="fd-"], [class*="fd-"]')) return false;

      // Ignora se estiver dentro de um card individual de imagem no Canvas (falhas de imagem são tratadas pelo fluxo de cards)
      if (el.closest && el.closest('[data-testid="virtuoso-item-list"], [role="article"], div.sc-784d6f75-0, div.sc-784d6f75-1')) {
        return false;
      }

      if (!FlowMacroEngine.isElementVisible(el)) return false;

      const rawText = (el.textContent || el.innerText || '').trim().toLowerCase();
      if (!rawText || rawText.length > 350) return false;

      return screenErrorKeywords.some(keyword => rawText.includes(keyword));
    });

    if (errorEls.length > 0) {
      const firstEl = errorEls[0];
      const text = (firstEl.textContent || firstEl.innerText || '').trim().replace(/\s+/g, ' ');
      return {
        hasError: true,
        message: text.length > 100 ? `${text.substring(0, 97)}...` : text,
        element: firstEl
      };
    }

    return { hasError: false, message: '', element: null };
  }

  /**
   * Aciona a auto-recuperação do macro quando um erro de tela for detectado:
   * Salva o estado exato da produção, URL do projeto, carrossel, slide, repetição e cronômetro,
   * exibe aviso na tela e atualiza a página para retornar ao projeto.
   * @param {string} [errorReason] - Mensagem descritiva do erro encontrado na tela
   */
  async triggerAutoRecovery(errorReason = 'Erro detectado na tela do FLOW') {
    if (this._isTriggeringRecovery) return;
    this._isTriggeringRecovery = true;

    this.addLog(`🚨 [Auto-Recuperação] Erro na tela do FLOW detectado: "${errorReason}".`, 'warning');
    this.addLog('💾 Salvando estado da produção e preparando reinício da página...', 'info');

    const projectUrl = window.location.href;
    const projectId = FlowMacroEngine.getCurrentProjectId();

    // Determina carrossel e slide atualmente em execução
    let activeCarouselIndex = 0;
    let activeCarouselId = null;
    let activeSlideIndex = this.currentIndex >= 0 ? this.currentIndex : 0;
    let activeSlideId = null;
    let currentRep = 0;

    const runningCarouselIdx = this.carousels.findIndex(c => c.status === 'running');
    if (runningCarouselIdx !== -1) {
      activeCarouselIndex = runningCarouselIdx;
      activeCarouselId = this.carousels[runningCarouselIdx].id;
      const c = this.carousels[runningCarouselIdx];
      if (c.slides && Array.isArray(c.slides)) {
        const runningSlideIdx = c.slides.findIndex(s => s.status === 'running');
        if (runningSlideIdx !== -1) {
          activeSlideId = c.slides[runningSlideIdx].id;
          currentRep = c.slides[runningSlideIdx].completedRepeats || 0;
        }
      }
    }

    if (!activeSlideId && this.prompts && this.prompts[activeSlideIndex]) {
      activeSlideId = this.prompts[activeSlideIndex].id;
      currentRep = this.prompts[activeSlideIndex].completedRepeats || 0;
    }

    // Leitura do histórico recente de recuperações para evitar loop infinito
    let reloadCount = 1;
    try {
      const stored = (typeof localStorage !== 'undefined') ? localStorage.getItem('flow_macro_recovery_state') : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.slideId === activeSlideId && (Date.now() - (parsed.timestamp || 0)) < 600000) {
          reloadCount = (parsed.reloadCount || 0) + 1;
        }
      }
    } catch (e) {}

    // Proteção Anti-Loop: Se o mesmo slide já provocou mais de 3 recargas
    if (reloadCount > 3) {
      this.addLog(`⚠️ [Auto-Recuperação] O slide atual causou ${reloadCount - 1} recargas consecutivas por erro na tela. Marcando como erro e avançando na fila...`, 'error');
      if (activeSlideId) {
        const targetPrompt = this.prompts.find(p => p.id === activeSlideId);
        if (targetPrompt) {
          targetPrompt.status = 'error';
          targetPrompt.errorMsg = `Erro persistente na tela do FLOW (${errorReason}).`;
        }
        for (const car of this.carousels) {
          const s = (car.slides || []).find(sl => sl.id === activeSlideId);
          if (s) {
            s.status = 'error';
            s.errorMsg = `Erro persistente na tela do FLOW (${errorReason}).`;
          }
        }
      }
      this.saveState();
      this._isTriggeringRecovery = false;

      if (typeof window !== 'undefined' && typeof window.flowShowToast === 'function') {
        window.flowShowToast('⚠️ Erro persistente no slide. Pulando para o próximo da fila...', 'warning');
      }

      this.clearRecoveryState();
      this.dismissDangerousModals();
      return;
    }

    const recoveryData = {
      isRecovering: true,
      projectUrl: projectUrl,
      projectId: projectId,
      carouselIndex: activeCarouselIndex,
      carouselId: activeCarouselId,
      slideIndex: activeSlideIndex,
      slideId: activeSlideId,
      currentRepeat: currentRep,
      prompts: this.prompts,
      carousels: this.carousels,
      elapsedSeconds: this.elapsedSeconds,
      startTime: this.startTime,
      reloadCount: reloadCount,
      errorReason: errorReason,
      timestamp: Date.now()
    };

    // Salva o estado tanto no chrome.storage quanto no localStorage
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ flow_macro_recovery_state: recoveryData });
      }
    } catch (e) {
      console.warn('[FLOW Macro] Falha ao salvar no chrome.storage:', e);
    }
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('flow_macro_recovery_state', JSON.stringify(recoveryData));
      }
    } catch (e) {
      console.warn('[FLOW Macro] Falha ao salvar no localStorage:', e);
    }

    // Toast de notificação na tela
    if (typeof window !== 'undefined' && typeof window.flowShowToast === 'function') {
      window.flowShowToast(`🔄 [Erro na Tela] ${errorReason}. Atualizando página e voltando ao projeto em 3s...`, 'warning');
    }

    // Notificação de alerta no Telegram
    if (this.config.telegramEnabled !== false && this.config.telegramBotToken && this.config.telegramChatId) {
      try {
        await this.sendTelegramNotification(
          `🔄 *[FLOW Studio Pro - Auto-Recuperação]*\n` +
          `🚨 *Erro na tela detectado:* ${errorReason}\n` +
          `• *Tentativa de recarga:* ${reloadCount}/3\n` +
          `• *Slide atual:* ${activeSlideIndex + 1}/${this.prompts.length}\n` +
          `• *Ação:* Atualizando página e retomando projeto na fila...`
        );
      } catch (e) {}
    }

    // Pausa de 2.5s para conclusão das gravações e visualização do usuário
    await new Promise(r => setTimeout(r, 2500));

    // Executa a atualização da página e retorno ao projeto
    if (projectUrl && window.location.href !== projectUrl) {
      window.location.href = projectUrl;
    } else {
      window.location.reload();
    }
  }

  /**
   * Verifica se existe um estado de recuperação pendente após a recarga da página e retoma a execução
   */
  async checkAndResumeAutoRecovery() {
    if (this._recoveryChecked) return;
    this._recoveryChecked = true;

    let recoveryData = null;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const res = await chrome.storage.local.get(['flow_macro_recovery_state']);
        recoveryData = res.flow_macro_recovery_state;
      }
    } catch (e) {}

    if (!recoveryData && typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem('flow_macro_recovery_state');
        if (raw) recoveryData = JSON.parse(raw);
      } catch (e) {}
    }

    if (!recoveryData || !recoveryData.isRecovering) return;

    // Se o estado salvo tiver mais de 15 minutos, descarta
    if (Date.now() - (recoveryData.timestamp || 0) > 15 * 60 * 1000) {
      this.clearRecoveryState();
      return;
    }

    this.addLog('🔄 [Auto-Recuperação] Sessão anterior interrompida por erro de tela detectada!', 'warning');
    this.addLog(`🔄 [Auto-Recuperação] Motivo: "${recoveryData.errorReason || 'Erro na tela'}". Retomando projeto...`, 'info');

    // Verifica se a URL atual corresponde ao projeto salvo
    const targetUrl = recoveryData.projectUrl;
    const currentProjectId = FlowMacroEngine.getCurrentProjectId();

    if (recoveryData.projectId && currentProjectId !== recoveryData.projectId && targetUrl) {
      this.addLog(`🔄 [Auto-Recuperação] Redirecionando para a URL do projeto anterior: ${targetUrl}`, 'info');
      await new Promise(r => setTimeout(r, 1200));
      window.location.href = targetUrl;
      return;
    }

    // Aguarda a interface do FLOW carregar (prompt input, virtuoso scroller e canvas prontos)
    this.addLog('⏳ [Auto-Recuperação] Aguardando Canvas e interface do FLOW carregarem...', 'info');
    const flowReady = await this.waitForFlowReady(35);
    if (!flowReady) {
      this.addLog('⚠️ [Auto-Recuperação] Interface do FLOW demorou para responder. Aguardando mais alguns instantes...', 'warning');
      await new Promise(r => setTimeout(r, 3000));
    }

    // Restaura o estado salvo da fila de produção
    if (recoveryData.prompts && Array.isArray(recoveryData.prompts)) {
      this.prompts = recoveryData.prompts;
    }
    if (recoveryData.carousels && Array.isArray(recoveryData.carousels)) {
      this.carousels = recoveryData.carousels;
    }
    if (recoveryData.elapsedSeconds) {
      this.elapsedSeconds = recoveryData.elapsedSeconds;
    }
    if (recoveryData.startTime) {
      this.startTime = recoveryData.startTime;
    }
    if (recoveryData.slideIndex !== undefined) {
      this.currentIndex = recoveryData.slideIndex;
    }

    this.addLog(`✅ [Auto-Recuperação] Estado restaurado: Carrossel ${(recoveryData.carouselIndex || 0) + 1}, Slide ${(recoveryData.slideIndex || 0) + 1} (Repetição ${(recoveryData.currentRepeat || 0) + 1}).`, 'success');

    if (typeof window !== 'undefined' && typeof window.flowShowToast === 'function') {
      window.flowShowToast('🔄 [Auto-Recuperação] Conexão com o projeto restaurada! Retomando fila de produção...', 'success');
    }

    // Limpa a flag isRecovering para evitar re-disparos em caso de recarga normal
    recoveryData.isRecovering = false;
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        await chrome.storage.local.set({ flow_macro_recovery_state: recoveryData });
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('flow_macro_recovery_state', JSON.stringify(recoveryData));
      }
    } catch (e) {}

    // Rola para o topo imediatamente
    await this.scrollCanvasToTop({ wait: true });

    // Inicia a execução mantendo o estado restaurado
    await new Promise(r => setTimeout(r, 1800));
    this.start();
  }

  /**
   * Aguarda a interface e os elementos de controle do FLOW ficarem prontos após recarga
   * @param {number} [maxSeconds=35] - Tempo limite em segundos
   * @returns {Promise<boolean>}
   */
  async waitForFlowReady(maxSeconds = 35) {
    const start = Date.now();
    const maxMs = maxSeconds * 1000;
    while (Date.now() - start < maxMs) {
      this.dismissFlowOnboardingBanners();
      this.dismissDangerousModals();

      const inputEl = this.findPromptInput();
      const submitBtn = this.findSubmitButton();
      const hasCanvas = document.querySelector('[data-testid="virtuoso-item-list"], [data-testid="virtuoso-scroller"], div[class*="canvas" i]');

      if (inputEl && (submitBtn || hasCanvas)) {
        return true;
      }
      await new Promise(r => setTimeout(r, 800));
    }
    return false;
  }

  /**
   * Limpa o estado de recuperação salvo do storage
   */
  clearRecoveryState() {
    try {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.remove('flow_macro_recovery_state');
      }
    } catch (e) {}
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('flow_macro_recovery_state');
      }
    } catch (e) {}
  }

  /**
   * Detecta se existem cards com falha explícita de geração de imagem no Canvas do FLOW
   * Mensagem: "Falhou - Lamentamos, mas não foi possível gerar esta imagem. Não lhe foi cobrado nenhum valor por esta geração."
   * @returns {{ failed: boolean, count: number, elements: HTMLElement[] }}
   */
  hasCanvasFailedGenerations() {
    const failureKeywords = [
      'não foi possível gerar esta imagem',
      'não foi possível gerar',
      'lamentamos, mas não foi possível',
      'não lhe foi cobrado nenhum valor',
      'failed to generate',
      'couldn\'t generate this image'
    ];

    const failedEls = Array.from(document.querySelectorAll('div, p, span, h3, h4, section, article')).filter(el => {
      if (el.closest && el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      if (el.closest && el.closest('[role="dialog"], [role="presentation"], .cdk-overlay-pane')) return false;
      if (!FlowMacroEngine.isElementVisible(el)) return false;
      const t = (el.textContent || el.innerText || '').trim().toLowerCase();
      if (t.length > 250) return false;
      return failureKeywords.some(k => t.includes(k)) || t === 'falhou' || t.startsWith('falhou -') || t.startsWith('falhou:');
    });

    if (failedEls.length === 0) {
      return { failed: false, count: 0, elements: [] };
    }

    const cards = failedEls.map(el => {
      // Sobe pela árvore do DOM para encontrar o container pai do card que contenha o botão de exclusão
      let curr = el;
      for (let depth = 0; depth < 8; depth++) {
        if (!curr.parentElement || curr.parentElement === document.body) break;
        curr = curr.parentElement;
        if (curr.querySelector('button, [role="button"], svg, [aria-label*="delete" i], [aria-label*="excluir" i]')) {
          return curr;
        }
      }
      return el.closest('[class*="card" i], [role="article"], [class*="item" i], div[tabindex]') || el.parentElement || el;
    });

    const uniqueCards = Array.from(new Set(cards));

    return {
      failed: uniqueCards.length > 0,
      count: uniqueCards.length,
      elements: uniqueCards
    };
  }

  /**
   * Exclui ou descarta os cards com falha no Canvas clicando no botão de lixeira [🗑] do card
   * Sobe o Canvas para o topo para garantir que os cards mais recentes com erro fiquem visíveis no Virtuoso
   * @returns {Promise<number>} Quantidade de cards descartados
   */
  async dismissFailedCards() {
    // 1. Sobe o Canvas para o topo antes de buscar os cards com erro
    await this.scrollCanvasToTop();

    const failedCheck = this.hasCanvasFailedGenerations();
    if (!failedCheck.failed) return 0;

    let dismissed = 0;
    for (const card of failedCheck.elements) {
      try {
        card.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        if (card.focus) card.focus();
        card.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        card.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        const btns = Array.from(card.querySelectorAll('button, [role="button"], div[role="button"], svg, [tabindex="0"]')).filter(b => FlowMacroEngine.isElementVisible(b));
        let trashBtn = btns.find(b => {
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          const title = (b.getAttribute('title') || '').toLowerCase();
          const html = (b.innerHTML || '').toLowerCase();
          const t = (b.textContent || '').trim().toLowerCase();
          return aria.includes('delete') || aria.includes('excluir') || aria.includes('remover') || aria.includes('descartar') || aria.includes('trash') ||
                 title.includes('delete') || title.includes('excluir') || title.includes('remover') ||
                 html.includes('delete') || html.includes('trash') || html.includes('excluir') ||
                 t === 'delete' || t === 'excluir' || t === 'remover';
        });

        // Fallback geográfico: no FLOW o botão de lixeira fica localizado no canto inferior direito do card
        if (!trashBtn && btns.length > 0) {
          const cardRect = card.getBoundingClientRect();
          const candidateBtns = btns.filter(b => {
            const r = b.getBoundingClientRect();
            return r.top >= cardRect.top + cardRect.height * 0.4 && r.left >= cardRect.left + cardRect.width * 0.4;
          });
          if (candidateBtns.length > 0) {
            trashBtn = candidateBtns[candidateBtns.length - 1];
          } else {
            trashBtn = btns[btns.length - 1];
          }
        }

        if (trashBtn) {
          const clickTarget = trashBtn.closest('button, [role="button"]') || trashBtn;
          clickTarget.focus();
          this.simulateClick(clickTarget);
          clickTarget.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          try { clickTarget.click(); } catch (e) {}

          // Dispara handler React direto se presente
          try {
            const propKey = Object.keys(clickTarget).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
            if (propKey && clickTarget[propKey] && typeof clickTarget[propKey].onClick === 'function') {
              clickTarget[propKey].onClick({ preventDefault: () => {}, stopPropagation: () => {}, target: clickTarget, currentTarget: clickTarget });
            }
          } catch(e) {}
          dismissed++;
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (e) {
        console.warn('[FLOW Macro] Erro ao descartar card com falha:', e);
      }
    }

    // Se abrir confirmação de exclusão (ex: modal "Excluir"), confirma imediatamente
    const confirmBtn = Array.from(document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')).find(b => {
      const t = (b.textContent || '').trim().toLowerCase();
      return t.includes('excluir') || t.includes('delete') || t.includes('confirm') || t.includes('sim') || t.includes('ok');
    });
    if (confirmBtn) {
      this.simulateClick(confirmBtn);
      try { confirmBtn.click(); } catch (e) {}
    }

    if (dismissed > 0) {
      await new Promise(r => setTimeout(r, 400));
      await this.scrollCanvasToTop();
    }

    return dismissed;
  }

  /**
   * Monitora e aguarda a conclusão da geração da imagem no Canvas do FLOW
   * Detecta porcentagens (ex: 87%), cancelamento por STOP e falhas explícitas ("Falhou")
   * @param {number} maxWaitSeconds - Tempo máximo de espera em segundos (padrão: 60s)
   * @returns {Promise<boolean>}
   */
  async waitForGenerationToComplete(maxWaitSeconds = 60) {
    this.addLog('⏳ [FLOW] Aguardando geração da imagem ser concluída no Canvas...', 'info');
    const startTime = Date.now();
    const maxMs = maxWaitSeconds * 1000;

    // Rola o Canvas para o topo imediatamente
    await this.scrollCanvasToTop({ wait: true });

    // Registra a contagem de cards com erro já existentes no Canvas antes do novo envio
    const initialFailCount = this.hasCanvasFailedGenerations().count;

    // Período de carência inicial: mantém no topo e monitora erros de tela imediatos
    for (let g = 0; g < 5; g++) {
      if (this.isStopped || this.state !== 'running') return false;
      await this.scrollCanvasToTop();

      const screenError = this.detectFlowScreenError();
      if (screenError.hasError) {
        this.addLog(`🚨 [FLOW] Erro de tela detectado logo após o envio: "${screenError.message}"`, 'warning');
        await this.triggerAutoRecovery(screenError.message);
        return false;
      }
      await new Promise(r => { this.timer = setTimeout(r, 500); });
    }

    let sawGenerating = false;
    let consecutiveIdleChecks = 0;
    let loopCount = 0;

    while (Date.now() - startTime < maxMs) {
      if (this.isStopped || this.state !== 'running') return false;
      loopCount++;

      // Rola continuamente o Canvas para o topo a cada segundo para que o usuário acompanhe as imagens
      await this.scrollCanvasToTop();

      // 0. Verifica se há ERRO PRESENTE NA TELA DO FLOW (Toasts, Modais, Banners, Erro de Sistema)
      const screenError = this.detectFlowScreenError();
      if (screenError.hasError) {
        this.addLog(`🚨 [FLOW] Erro presente na tela detectado durante geração: "${screenError.message}"`, 'warning');
        await this.triggerAutoRecovery(screenError.message);
        return false;
      }

      // 1. Verifica se surgiram NOVOS cards com falha explícita no Canvas gerados por este envio
      const failCheck = this.hasCanvasFailedGenerations();
      if (failCheck.failed && failCheck.count > initialFailCount) {
        this.addLog(`⚠️ [FLOW] Falha na geração detectada no Canvas (${failCheck.count - initialFailCount} novo(s) card(s) com erro: "Falhou").`, 'warning');
        return false;
      }

      // 2. Verifica se o Canvas ainda está processando
      const check = this.isCanvasGenerating();

      if (check.generating) {
        sawGenerating = true;
        consecutiveIdleChecks = 0;
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        this.currentAction = `⏳ ${check.reason} (${elapsed}s)...`;
        this.notify();
      } else {
        // Se a geração já esteve em andamento ou se já se passaram pelo menos 8 segundos
        if (sawGenerating || (Date.now() - startTime > 8000)) {
          consecutiveIdleChecks++;
          // Exige 3 verificações consecutivas vazias (3s de estabilidade confirmada)
          if (consecutiveIdleChecks >= 3) {
            const totalElapsed = Math.round((Date.now() - startTime) / 1000);

            // Re-verifica se ao finalizar as porcentagens não surgiu novo card de falha
            await this.scrollCanvasToTop({ wait: true });
            const postFailCheck = this.hasCanvasFailedGenerations();
            if (postFailCheck.failed && postFailCheck.count > initialFailCount) {
              this.addLog(`⚠️ [FLOW] Imagem finalizou com status de falha (${postFailCheck.count - initialFailCount} novo(s) card(s) "Falhou").`, 'warning');
              return false;
            }

            this.addLog(`✨ [FLOW] Geração de imagens concluída no Canvas (${totalElapsed}s)!`, 'success');
            await new Promise(r => { this.timer = setTimeout(r, 1500); });
            return true;
          }
        }
      }

      await new Promise(r => { this.timer = setTimeout(r, 1000); });
    }

    await this.scrollCanvasToTop({ wait: true });
    const finalFail = this.hasCanvasFailedGenerations();
    if (finalFail.failed && finalFail.count > initialFailCount) return false;

    this.addLog('⏱️ Tempo de espera da geração concluído.', 'info');
    return true;
  }

  /**
   * Localiza todos os botões de "Reutilizar comando" nos cards gerados no Canvas do FLOW
   * @returns {Array<HTMLElement>}
   */
  findReuseCommandButtons() {
    // Seletor exato gravado no DevTools do FLOW para o botão de reutilização no card
    const directMatches = Array.from(document.querySelectorAll([
      '[data-testid="virtuoso-item-list"] div.sc-784d6f75-5 button',
      'div.sc-784d6f75-5 button',
      'div.sc-452db337-2 button',
      '[data-testid="virtuoso-item-list"] button:has(i)',
      '[data-testid="virtuoso-item-list"] button:has(svg)'
    ].join(', '))).filter(el => FlowMacroEngine.isElementVisible(el) && !el.closest('[id*="fd-"], [class*="fd-"]') && FlowMacroEngine.isSafeToClick(el));

    if (directMatches.length > 0) {
      return directMatches;
    }

    const candidates = Array.from(document.querySelectorAll('button, [role="button"], div[tabindex="0"], a, i, span')).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el)) return false;
      if (el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      return true;
    });

    const matches = [];

    for (const el of candidates) {
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();
      const tooltip = (el.getAttribute('data-tooltip') || '').toLowerCase();
      const testid = (el.getAttribute('data-testid') || '').toLowerCase();
      const text = (el.innerText || el.textContent || '').trim().toLowerCase();

      const isReuseIcon = [
        'undo', 'reply', 'rotate_left', 'replay', 'arrow_back', 'cached', 'refresh',
        'history_toggle_drop_down', 'edit', 'edit_note', 'content_copy', 'auto_fix_high',
        'published_with_changes', 'prompt', 'cycle', 'swap_horiz', 'restore', 'repeat',
        'subdirectory_arrow_left', 'restart_alt', 'redo', '↩', '↪', '🔄'
      ].includes(text);

      const isReuseText = (
        aria.includes('reutilizar') || aria.includes('reuse') || aria.includes('usar como') ||
        aria.includes('use as') || aria.includes('editar comando') || aria.includes('edit prompt') ||
        title.includes('reutilizar') || title.includes('reuse') || title.includes('usar como') ||
        tooltip.includes('reutilizar') || tooltip.includes('reuse') || tooltip.includes('usar como') ||
        testid.includes('reuse') || testid.includes('prompt-reuse') ||
        text.includes('reutilizar comando') || text.includes('reuse prompt') || text.includes('reutilizar') || text.includes('reuse')
      );

      if (isReuseIcon || isReuseText) {
        const btn = el.tagName.toLowerCase() === 'button' ? el : (el.closest('button, [role="button"], div[tabindex="0"]') || el);
        if (!matches.includes(btn) && FlowMacroEngine.isSafeToClick(btn)) {
          matches.push(btn);
        }
      }
    }

    return matches;
  }

  /**
   * Reutiliza o comando da imagem gerada anteriormente no Canvas (Passo 7 do fluxograma)
   * Permite preservar os personagens e configurações sem precisar reanexar do zero
   * @returns {Promise<boolean>}
   */
  async reuseLatestCommand() {
    this.addLog('🔁 [Passo 7] Localizando card gerado para reutilizar comando anterior...', 'info');

    // 1. Tenta localizar diretamente o botão de reutilizar visível
    let reuseBtns = this.findReuseCommandButtons();

    // 2. Se não encontrar direto, foca e clica no último card gerado no Canvas para abrir a barra de ações
    if (reuseBtns.length === 0) {
      const generatedCards = Array.from(document.querySelectorAll([
        '[data-testid="virtuoso-item-list"] > div',
        'div.sc-784d6f75-0',
        'div.sc-784d6f75-1',
        'div.sc-784d6f75-5',
        'div[class*="generation" i]',
        'div[class*="card" i]:has(img)',
        'img[src*="googleusercontent"]'
      ].join(', '))).filter(el => FlowMacroEngine.isElementVisible(el) && !el.closest('[id*="fd-"], [class*="fd-"]'));

      if (generatedCards.length > 0) {
        const latestCard = generatedCards[generatedCards.length - 1];
        try {
          latestCard.scrollIntoView({ behavior: 'instant', block: 'center' });
          latestCard.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          latestCard.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
          latestCard.click();
          await new Promise(r => setTimeout(r, 600));
        } catch (e) { /* ignora */ }
      }

      reuseBtns = this.findReuseCommandButtons();
    }

    if (reuseBtns.length > 0) {
      const latestBtn = reuseBtns[reuseBtns.length - 1];
      this.simulateClick(latestBtn);
      await new Promise(r => setTimeout(r, 1200));
      this.cleanupStrayPromptChips();

      // Valida se a reutilização de fato manteve os personagens na barra
      if (this.hasCharacterChipsAttached()) {
        this.addLog('🔁 [Passo 7 - Reutilizar Comando] Personagens e configurações reaproveitados com sucesso do FLOW.', 'success');
        return true;
      } else {
        this.addLog('⚠️ [Passo 7] Reutilizar comando não preservou os personagens. Re-anexando da biblioteca...', 'warning');
        return false;
      }
    }

    // Se os personagens já estiverem anexados no prompt, considera sucesso
    if (this.hasCharacterChipsAttached()) {
      this.addLog('🔁 [Passo 7 - Reaproveitamento] Personagens já ativos no comando.', 'info');
      return true;
    }

    return false;
  }

  /**
   * Dispara uma sequência completa e realista de eventos de mouse, ponteiro e foco em um elemento
   * @param {HTMLElement} element - Elemento a ser clicado
   * @returns {boolean}
   */
  simulateClick(element) {
    if (!element) return false;
    try {
      element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      element.focus();

      const rect = element.getBoundingClientRect();
      const clientX = rect.left + (rect.width > 0 ? rect.width / 2 : 10);
      const clientY = rect.top + (rect.height > 0 ? rect.height / 2 : 10);

      const eventOpts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX,
        clientY,
        button: 0,
        buttons: 1
      };

      // Dispara: pointerdown -> mousedown -> pointerup -> mouseup -> click
      if (typeof PointerEvent !== 'undefined') {
        element.dispatchEvent(new PointerEvent('pointerdown', { ...eventOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
      }
      element.dispatchEvent(new MouseEvent('mousedown', eventOpts));

      if (typeof PointerEvent !== 'undefined') {
        element.dispatchEvent(new PointerEvent('pointerup', { ...eventOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
      }
      element.dispatchEvent(new MouseEvent('mouseup', eventOpts));

      try { element.click(); } catch (e) {}
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Clica em um elemento garantindo suporte ao data-type="button-overlay" do Google FLOW e handlers sintéticos do React
   * @param {HTMLElement} element - Elemento alvo
   * @returns {boolean}
   */
  clickElementWithOverlay(element) {
    if (!element) return false;
    try {
      element.scrollIntoView({ behavior: 'instant', block: 'nearest' });
      if (element.focus) element.focus();

      const overlay = element.querySelector ? element.querySelector('[data-type="button-overlay"]') : null;
      const target = overlay || element;

      const rect = target.getBoundingClientRect();
      const clientX = rect.left + (rect.width > 0 ? rect.width / 2 : 10);
      const clientY = rect.top + (rect.height > 0 ? rect.height / 2 : 10);
      const eventOpts = {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        clientX,
        clientY,
        button: 0,
        buttons: 1
      };

      if (typeof PointerEvent !== 'undefined') {
        target.dispatchEvent(new PointerEvent('pointerdown', { ...eventOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
      }
      target.dispatchEvent(new MouseEvent('mousedown', eventOpts));

      // Invoca manipuladores sintéticos do React se presentes (testa tanto no element raiz quanto no target)
      try {
        const handlerHost = element[Object.keys(element).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'))] ? element : target;
        const propKey = Object.keys(handlerHost).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
        if (propKey && handlerHost[propKey]) {
          if (typeof handlerHost[propKey].onMouseDown === 'function') {
            handlerHost[propKey].onMouseDown({ preventDefault: () => {}, stopPropagation: () => {}, target, currentTarget: handlerHost });
          }
          if (typeof handlerHost[propKey].onClick === 'function') {
            handlerHost[propKey].onClick({ preventDefault: () => {}, stopPropagation: () => {}, target, currentTarget: handlerHost });
          }
        }
      } catch (e) {}

      if (typeof PointerEvent !== 'undefined') {
        target.dispatchEvent(new PointerEvent('pointerup', { ...eventOpts, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
      }
      target.dispatchEvent(new MouseEvent('mouseup', eventOpts));

      try { target.click(); } catch (e) {}
      if (target !== element) {
        try { element.click(); } catch (e) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Helper para verificar se um botão/pílula de opção está ativo/selecionado no FLOW
   * @param {HTMLElement} btn - Botão a testar
   * @returns {boolean}
   */
  isButtonSelected(btn) {
    if (!btn) return false;
    const candidates = [btn, btn.closest('button, [role="button"], [role="radio"], [role="tab"], [data-state]'), btn.parentElement].filter(Boolean);
    for (const el of candidates) {
      if (el.getAttribute('aria-selected') === 'true' || el.getAttribute('aria-checked') === 'true') return true;
      if (el.getAttribute('data-state') === 'active' || el.getAttribute('data-state') === 'on' || el.getAttribute('data-state') === 'checked') return true;
      if (el.classList.contains('active') || el.classList.contains('selected') || el.classList.contains('checked')) return true;

      // Checa brilho da cor de fundo (botão selecionado tem fundo destacado/branco no modo escuro do FLOW, > 180)
      try {
        const style = window.getComputedStyle(el);
        const bg = style.backgroundColor;
        if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          const rgb = bg.match(/\d+/g);
          if (rgb && rgb.length >= 3) {
            const brightness = (parseInt(rgb[0]) * 299 + parseInt(rgb[1]) * 587 + parseInt(rgb[2]) * 114) / 1000;
            if (brightness > 180) return true;
          }
        }
      } catch (e) { /* ignora */ }
    }
    return false;
  }

  /**
   * Fecha de forma garantida o popover de configurações (Nano Banana) no FLOW
   * NUNCA clica no campo de prompt para evitar abrir a tela cheia do editor de texto
   * @param {HTMLElement} settingsTrigger - Pílula que abriu o popover
   * @param {HTMLElement} popover - Container do popover aberto
   */
  async closeSettingsPopover(settingsTrigger, popover) {
    const isPopoverStillOpen = () => {
      if (popover && popover.isConnected && FlowMacroEngine.isElementVisible(popover)) return true;
      const open = Array.from(document.querySelectorAll('[role="dialog"], [role="menu"], [class*="popover" i], [data-radix-popper-content-wrapper], [data-side]')).find(el => {
        if (el.closest && el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        if (!FlowMacroEngine.isElementVisible(el)) return false;
        const t = (el.textContent || '').toLowerCase();
        return t.includes('1:1') || t.includes('16:9') || t.includes('9:16') || t.includes('banana') || t.includes('proporç');
      });
      return !!open;
    };

    if (!isPopoverStillOpen()) return;

    // 1. Envia tecla Escape para o popover, document e window
    [popover, document, window].forEach(target => {
      if (!target) return;
      target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
      target.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true, cancelable: true }));
    });
    await new Promise(r => setTimeout(r, 200));

    // 2. Se ainda estiver aberto, clica no gatilho que o abriu (no FLOW é um botão de alternância toggle)
    if (isPopoverStillOpen() && settingsTrigger && FlowMacroEngine.isElementVisible(settingsTrigger)) {
      this.clickElementWithOverlay(settingsTrigger);
      await new Promise(r => setTimeout(r, 250));
    }

    // 3. Se ainda persistir, clica em um ponto vazio do Canvas (disparando o onPointerDownOutside do Radix)
    if (isPopoverStillOpen()) {
      document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
      document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 50, clientY: 50 }));
      await new Promise(r => setTimeout(r, 200));
    }
  }

  /**
   * Verifica se o projeto atual já teve seu formato e configurações de imagem validados no 1º slide.
   * REGRA DE OURO: A verificação de formato de imagem acontece EXCLUSIVAMENTE no 1º slide de cada projeto!
   * @returns {boolean}
   */
  isCurrentProjectConfigured() {
    const currentProjectId = FlowMacroEngine.getCurrentProjectId();
    if (!this.settingsConfiguredForProject) {
      return false;
    }
    // Se mudou de projeto na URL, precisa reconfigurar no 1º slide do novo projeto
    if (currentProjectId && this.lastConfiguredProjectId && currentProjectId !== this.lastConfiguredProjectId) {
      this.settingsConfiguredForProject = false;
      this.lastConfiguredProjectId = null;
      this.uploadedAvatarsInFlow = new Set();
      return false;
    }
    return true;
  }

  /**
   * Ajusta as configurações do FLOW (Passo 1 do fluxograma oficial):
   * Localiza o botão de proporção na barra inferior, define 1:1 (ou ratio desejado) e fecha a janela.
   * REGRA DE OURO: Executa no 1º slide de cada projeto ou quando ainda não configurado!
   * @returns {Promise<boolean>}
   */
  async applyFlowSettings() {
    const currentProjectId = FlowMacroEngine.getCurrentProjectId();

    try {
      this.dismissFlowOnboardingBanners();

      const targetRatio = this.config.aspectRatio || '1:1';
      const targetQuantity = `x${this.config.quantity || 4}`;

      const promptInput = this.findPromptInput();
      const promptContainer = this.getPromptContainer();

      if (!promptContainer) return true;

      // 1. Coleta elementos interativos dentro do container de prompt (excluindo extensão, textarea, submit e plus)
      const submitBtn = this.findSubmitButton();
      const plusBtn = this.findPlusButton();

      const promptClickables = Array.from(promptContainer.querySelectorAll('button, [role="button"], div[tabindex="0"], div[class*="pill" i], div[class*="setting" i], span[role="button"]')).filter(el => {
        if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        if (el === promptInput || el.contains(promptInput)) return false;
        if (submitBtn && (el === submitBtn || el.contains(submitBtn))) return false;
        if (plusBtn && (el === plusBtn || el.contains(plusBtn))) return false;
        const t = (el.textContent || el.innerText || '').toLowerCase();
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        if (t.includes('agente') || aria.includes('agente') || aria.includes('arrow_forward') || aria.includes('arrow_upward') || aria.includes('criar') || t.includes('enviar')) return false;
        if (t.includes('adicionar') || aria.includes('adicionar') || t === '+' || aria === '+') return false;
        return true;
      });

      // 2. Localiza especificamente o gatilho da PROPORÇÃO (ícone [ ] entre modelo e x4 na pílula do FLOW)
      let ratioTrigger = promptClickables.find(b => {
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        const title = (b.getAttribute('title') || '').toLowerCase();
        const t = (b.textContent || b.innerText || '').trim().toLowerCase();
        return (
          aria.includes('proporç') || aria.includes('aspect') || aria.includes('ratio') || aria.includes('crop') ||
          aria.includes('formato') || aria.includes('tamanho') || aria.includes('dimens') ||
          title.includes('proporç') || title.includes('aspect') || title.includes('ratio') || title.includes('crop') ||
          t === '1:1' || t === '9:16' || t === '16:9' || t === '4:3' || t === '3:4' ||
          aria.includes('1:1') || aria.includes('9:16') || aria.includes('16:9') ||
          aria.includes('portrait') || aria.includes('square') || aria.includes('landscape')
        );
      });

      if (!ratioTrigger) {
        ratioTrigger = promptClickables.find(b => {
          const html = b.innerHTML.toLowerCase();
          return html.includes('crop_') || html.includes('aspect') || html.includes('crop-') || html.includes('square') || html.includes('portrait') || html.includes('landscape');
        });
      }

      // Se há o botão do modelo ('banana') e botão de quantidade ('x4'), o botão intermediário é a proporção!
      if (!ratioTrigger) {
        const modelBtn = promptClickables.find(b => {
          const t = (b.textContent || '').toLowerCase();
          return t.includes('banana') || t.includes('nano') || t.includes('pro');
        });
        const qtyBtn = promptClickables.find(b => {
          const t = (b.textContent || '').trim().toLowerCase();
          return /^x[1-4]$/i.test(t) || /^[1-4]$/.test(t);
        });
        if (modelBtn && qtyBtn) {
          ratioTrigger = promptClickables.find(b => b !== modelBtn && b !== qtyBtn && !b.contains(modelBtn) && !b.contains(qtyBtn));
        }
      }

      // Fallback
      if (!ratioTrigger) {
        ratioTrigger = promptClickables.find(el => {
          const t = (el.textContent || '').toLowerCase();
          const aria = (el.getAttribute('aria-label') || '').toLowerCase();
          return t.includes('banana') || t.includes('1:1') || t.includes('9:16') || t.includes('16:9') || aria.includes('banana') || aria.includes('crop_') || aria.includes('proporção');
        }) || promptClickables[0];
      }

      const ratioAliases = {
        '1:1': ['1:1', '1 : 1', '1x1', '1/1', 'crop_square', 'square', 'quadrado', 'quadrada'],
        '9:16': ['9:16', '9 : 16', '9x16', '9/16', 'crop_9_16', 'crop_portrait', 'portrait', 'retrato', 'vertical', '9_16', 'story', 'stories', 'reels'],
        '16:9': ['16:9', '16 : 9', '16x9', '16/9', 'crop_16_9', 'crop_landscape', 'landscape', 'paisagem', 'horizontal', 'widescreen', '16_9'],
        '3:4': ['3:4', 'crop_portrait', 'crop_3_4', 'portrait', 'retrato', '3_4', '3:4', '3x4', '3/4'],
        '4:3': ['4:3', 'crop_landscape', 'crop_4_3', 'landscape', 'paisagem', '4_3', '4:3', '4x3', '4/3']
      };
      const currentRatioAliases = ratioAliases[targetRatio] || [targetRatio];

      // 3. Abre o menu da Proporção
      let popover = null;
      if (ratioTrigger) {
        this.addLog(`⚙️ [Passo 1] Abrindo seletor de proporção no FLOW...`, 'info');
        this.clickElementWithOverlay(ratioTrigger);
        await new Promise(r => setTimeout(r, 600));

        // Busca o popover aberto (sem rejeitar popovers montados próximos à barra de prompt)
        for (let w = 0; w < 10; w++) {
          const allCandidates = Array.from(document.querySelectorAll(
            '[role="dialog"], [role="menu"], [role="listbox"], [class*="popover" i], [class*="menu" i], [class*="dropdown" i], [data-radix-popper-content-wrapper], [data-radix-popper-content], [data-side]'
          )).filter(el => {
            if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
            if (el.id === 'fd-macro-studio-modal' || el.querySelector('#fd-macro-studio-modal')) return false;
            if (el === promptContainer || el === promptInput) return false;

            const t = (el.textContent || '').toLowerCase();
            const aria = (el.getAttribute('aria-label') || '').toLowerCase();
            const combined = `${t} ${aria}`;

            const hasRatios = ['16:9', '9:16', '1:1', '4:3', '3:4', 'crop_square', 'square', 'quadrad', 'landscape', 'portrait'].some(k => combined.includes(k));
            const hasQuantity = ['x1', 'x2', 'x3', 'x4'].some(k => combined.includes(k));
            const hasModeTabs = (combined.includes('imagem') || combined.includes('image')) && (combined.includes('vídeo') || combined.includes('video'));

            return hasRatios || hasQuantity || hasModeTabs;
          });

          if (allCandidates.length > 0) {
            popover = allCandidates[0];
            break;
          }
          await new Promise(r => setTimeout(r, 150));
        }
      }

      // Se ainda não abriu o popover com o gatilho isolado, tenta os demais botões da pílula
      if (!popover) {
        for (const candidate of promptClickables) {
          if (candidate === ratioTrigger) continue;
          this.clickElementWithOverlay(candidate);
          await new Promise(r => setTimeout(r, 500));
          const found = Array.from(document.querySelectorAll('[role="dialog"], [role="menu"], [class*="popover" i], [data-radix-popper-content-wrapper]')).find(el => {
            if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
            const t = (el.textContent || '').toLowerCase();
            return t.includes('1:1') || t.includes('16:9') || t.includes('9:16') || t.includes('square');
          });
          if (found) {
            popover = found;
            break;
          }
        }
      }

      if (popover && FlowMacroEngine.isElementVisible(popover)) {
        this.addLog('📋 [Passo 1] Menu de configurações/proporção aberto. Aplicando seleção...', 'info');

        const POPOVER_CLICKABLE_SELECTOR = 'button, [role="button"], [role="tab"], [role="option"], [role="menuitemradio"], [role="menuitem"], [role="radio"], div[role="radio"], div[tabindex], span[tabindex], label[tabindex], [data-state], [data-value]';
        let allButtons = Array.from(popover.querySelectorAll(POPOVER_CLICKABLE_SELECTOR)).filter(b =>
          FlowMacroEngine.isElementVisible(b) && !b.closest('[id*="fd-"], [class*="fd-"]')
        );

        // Se houver abas de Imagem / Vídeo, garante Imagem
        const imageBtn = allButtons.find(b => {
          const t = (b.textContent || b.innerText || '').trim().toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          return (t === 'imagem' || t === 'image' || aria.includes('imagem') || aria.includes('image')) && !t.includes('vídeo') && !t.includes('video');
        });
        if (imageBtn && !this.isButtonSelected(imageBtn)) {
          this.addLog('⚙️ [Passo 1] Selecionando aba "Imagem"...', 'info');
          const elClick = imageBtn.closest('button, [role="button"], [role="tab"]') || imageBtn;
          this.clickElementWithOverlay(elClick);
          await new Promise(r => setTimeout(r, 600));
          allButtons = Array.from(popover.querySelectorAll(POPOVER_CLICKABLE_SELECTOR)).filter(b =>
            FlowMacroEngine.isElementVisible(b) && !b.closest('[id*="fd-"], [class*="fd-"]')
          );
        }

        // 4. Seleciona a Proporção desejada (ex: 1:1) com algoritmo de nós-folha e hit-testing físico
        await this.selectAspectRatioInPopover(popover, targetRatio);

        // 5. Quantidade de Imagens (ex: x4)
        await this.selectQuantityInPopover(popover, targetQuantity);

        // 6. Fecha o popover com segurança
        await this.closeSettingsPopover(ratioTrigger, popover);
      } else {
        this.addLog('ℹ️ [Passo 1] Configurações já aplicadas ou menu não necessário.', 'info');
      }

      this.settingsConfiguredForProject = true;
      this.lastConfiguredProjectId = currentProjectId || FlowMacroEngine.getCurrentProjectId();
      this.addLog(`✨ [Passo 1 Concluído] Modo: Imagem | Proporção: ${targetRatio} | Quantidade: ${targetQuantity}`, 'success');
      return true;
    } catch (e) {
      console.warn('[FLOW Macro] applyFlowSettings warning:', e);
      return false;
    }
  }

  /**
   * Localiza e seleciona a proporção exata dentro do popover do FLOW
   * Utiliza algoritmo baseado em nós-folha de texto e irmãos da linha de proporções
   * @param {HTMLElement} popover - O elemento do popover
   * @param {string} targetRatio - A proporção desejada ('1:1', '9:16', '16:9', '4:3', '3:4')
   * @returns {Promise<boolean>}
   */
  async selectAspectRatioInPopover(popover, targetRatio = '1:1') {
    const allRatios = ['16:9', '4:3', '1:1', '3:4', '9:16'];
    if (!popover || !FlowMacroEngine.isElementVisible(popover)) return false;

    // Aguarda animação de abertura do popover estabilizar
    await new Promise(r => setTimeout(r, 250));

    // 1. Localiza todos os nós interativos dentro do popover
    const candidateElements = Array.from(popover.querySelectorAll(
      'button, [role="button"], [role="radio"], [role="tab"], div[tabindex], span[tabindex], [data-state], [data-value]'
    )).filter(el => FlowMacroEngine.isElementVisible(el) && !el.closest('[id*="fd-"], [class*="fd-"]'));

    // 2. Procura o botão/item específico que contém EXCLUSIVAMENTE o targetRatio (ex: '1:1')
    // e que NÃO contém nenhum dos outros 4 ratios (evitando containers pais que agrupam todos os botões)
    const otherRatios = allRatios.filter(r => r !== targetRatio);

    let targetBtn = candidateElements.find(el => {
      const txt = (el.textContent || '').trim();
      const aria = (el.getAttribute('aria-label') || '').trim();
      const val = (el.getAttribute('data-value') || '').trim();
      const combined = `${txt} ${aria} ${val}`;

      if (!combined.includes(targetRatio)) return false;
      // Garante que não é um container pai que engloba outros ratios
      if (otherRatios.some(r => combined.includes(r))) return false;
      return true;
    });

    // Fallback: se não encontrou em botões/radios, busca em nós folha com o texto exato
    if (!targetBtn) {
      const allTextNodes = Array.from(popover.querySelectorAll('*')).filter(el => {
        if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        const txt = (el.textContent || '').trim();
        return txt === targetRatio;
      });
      allTextNodes.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
      if (allTextNodes.length > 0) {
        const leaf = allTextNodes[0];
        targetBtn = leaf.closest('button, [role="button"], [role="radio"], [role="tab"], div[tabindex]') || leaf;
      }
    }

    if (!targetBtn) {
      this.addLog(`⚠️ [Passo 1] Botão da proporção ${targetRatio} não encontrado no popover.`, 'warning');
      return false;
    }

    this.addLog(`⚙️ [Passo 1] Botão da proporção ${targetRatio} localizado. Aplicando seleção direta...`, 'info');

    // 3. Executa o clique DIRETO no elemento alvo (NUNCA usa document.elementFromPoint que pode desviar para 4:3)
    targetBtn.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    if (targetBtn.focus) targetBtn.focus();

    // Dispara sequências completas de eventos no botão e em seus filhos estruturais
    const targetsToClick = Array.from(new Set([
      targetBtn,
      targetBtn.querySelector('span, svg, [data-type="button-overlay"]'),
      targetBtn.firstElementChild
    ])).filter(Boolean);

    for (const el of targetsToClick) {
      try {
        if (typeof PointerEvent !== 'undefined') {
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
        }
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));

        if (typeof PointerEvent !== 'undefined') {
          el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 }));
        }
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        if (typeof el.click === 'function') {
          el.click();
        }

        // Handlers sintéticos do React (__reactProps$ / __reactEventHandlers$)
        const propKey = Object.keys(el).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
        if (propKey && el[propKey]) {
          const props = el[propKey];
          if (typeof props.onClick === 'function') props.onClick({ preventDefault: () => {}, stopPropagation: () => {}, target: el, currentTarget: el });
          if (typeof props.onChange === 'function') props.onChange({ target: el, currentTarget: el });
        }
      } catch (e) {}
    }

    await new Promise(r => setTimeout(r, 400));
    this.addLog(`✅ [Passo 1] Proporção ${targetRatio} selecionada com sucesso!`, 'success');
    return true;
  }

  /**
   * Localiza e seleciona a quantidade de imagens dentro do popover do FLOW (x1, x2, x3, x4)
   * @param {HTMLElement} popover - O elemento do popover
   * @param {string} targetQuantityStr - Quantidade desejada (ex: 'x4')
   * @returns {Promise<boolean>}
   */
  async selectQuantityInPopover(popover, targetQuantityStr = 'x4') {
    if (!popover || !FlowMacroEngine.isElementVisible(popover)) return false;
    const qtyNum = targetQuantityStr.replace(/\D/g, '') || '4';
    const targetTxt = `x${qtyNum}`;

    const matching = Array.from(popover.querySelectorAll('*')).filter(el => {
      if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
      const t = (el.textContent || '').trim().toLowerCase();
      return t === targetTxt || t === qtyNum || t === `×${qtyNum}`;
    });

    if (matching.length === 0) return false;

    matching.sort((a, b) => a.querySelectorAll('*').length - b.querySelectorAll('*').length);
    let qtyBox = matching[0];

    for (let depth = 0; depth < 3; depth++) {
      const parent = qtyBox.parentElement;
      if (!parent || parent === popover) break;
      if (parent.matches('button, [role="button"], [role="radio"], [role="tab"], div[tabindex]')) {
        qtyBox = parent;
        break;
      }
      qtyBox = parent;
    }

    qtyBox.scrollIntoView({ behavior: 'instant', block: 'nearest' });
    const rect = qtyBox.getBoundingClientRect();
    const clientX = Math.round(rect.left + rect.width / 2);
    const clientY = Math.round(rect.top + rect.height / 2);
    const hitElement = (clientX > 0 && clientY > 0) ? (document.elementFromPoint(clientX, clientY) || qtyBox) : qtyBox;

    this.clickElementWithOverlay(hitElement);
    this.clickElementWithOverlay(qtyBox);
    try { hitElement.click(); } catch (e) {}
    try { qtyBox.click(); } catch (e) {}

    await new Promise(r => setTimeout(r, 200));
    this.addLog(`✅ [Passo 1] Quantidade ${targetQuantityStr} selecionada.`, 'info');
    return true;
  }

  // =========================================================================
  // Diagnóstico do DOM em Tempo Real e Espião FLOW
  // =========================================================================

  /**
   * Realiza uma varredura completa no DOM do FLOW e retorna um relatório estruturado
   * Identifica campo de prompt, botão de envio, botão +, chips de personagens e proporções
   * @returns {Object} - Relatório do estado do DOM
   */
  diagnoseFlowDOM() {
    const promptInput = this.findPromptInput();
    const submitBtn = this.findSubmitButton();
    const plusBtn = this.findPlusButton();
    const hasChips = this.hasCharacterChipsAttached();

    const ratios = ['16:9', '4:3', '1:1', '3:4', '9:16'].map(ratio => {
      const btn = Array.from(document.querySelectorAll('button, [role="button"], div[role="radio"], span'))
        .find(el => el.innerText.trim() === ratio || el.innerText.trim().includes(ratio));
      return {
        label: ratio,
        found: !!btn,
        active: btn ? (btn.classList.contains('active') || btn.getAttribute('aria-checked') === 'true' || btn.getAttribute('aria-selected') === 'true') : false
      };
    });

    const quantities = [1, 2, 3, 4].map(q => {
      const btn = Array.from(document.querySelectorAll('button, [role="button"], div[role="radio"], span'))
        .find(el => el.innerText.trim() === `x${q}` || el.innerText.trim() === `${q}`);
      return {
        label: `x${q}`,
        found: !!btn,
        active: btn ? (btn.classList.contains('active') || btn.getAttribute('aria-checked') === 'true' || btn.getAttribute('aria-selected') === 'true') : false
      };
    });

    const fileInput = document.querySelector('input[type="file"]');
    const images = Array.from(document.querySelectorAll('img')).filter(img => (img.naturalWidth > 50 || img.width > 50) && !img.src.includes('avatar'));
    const reuseBtns = this.findReuseCommandButtons();

    return {
      promptInput: {
        found: !!promptInput,
        tag: promptInput ? promptInput.tagName.toLowerCase() : 'Não encontrado',
        selector: promptInput ? (promptInput.id ? `#${promptInput.id}` : promptInput.className || 'textarea') : 'Nenhum',
        value: promptInput ? (promptInput.value || promptInput.innerText || '').substring(0, 50) : ''
      },
      submitButton: {
        found: !!submitBtn,
        tag: submitBtn ? submitBtn.tagName.toLowerCase() : 'Não encontrado',
        disabled: submitBtn ? !!submitBtn.disabled : false,
        text: submitBtn ? (submitBtn.innerText || submitBtn.getAttribute('aria-label') || 'Ícone de Envio (➔)') : 'Nenhum'
      },
      plusButton: {
        found: !!plusBtn,
        tag: plusBtn ? plusBtn.tagName.toLowerCase() : 'Não encontrado',
        text: plusBtn ? (plusBtn.getAttribute('aria-label') || plusBtn.innerText || 'Botão "+" / Adicionar') : 'Não detectado'
      },
      attachedChips: {
        found: hasChips,
        label: hasChips ? 'Personagens/Chips anexados detectados' : 'Nenhum chip anexado no momento'
      },
      reuseCommand: {
        found: reuseBtns.length > 0,
        count: reuseBtns.length,
        label: reuseBtns.length > 0 ? `${reuseBtns.length} botão(ões) "Reutilizar comando" detectado(s)` : 'Nenhum card detectado ainda'
      },
      aspectRatioButtons: ratios,
      quantityButtons: quantities,
      characterUploadSlot: {
        found: !!fileInput || !!plusBtn,
        type: fileInput ? 'Input File Nativo' : (plusBtn ? 'Botão "+" da Biblioteca FLOW' : 'Dropzone / Container de Imagens')
      },
      detectedImagesCount: images.length
    };
  }

  /**
   * Retorna um snapshot completo do estado do Espião formatado para exportação e cópia com 1 clique
   * @returns {string} - JSON legível contendo todos os dados capturados
   */
  getDiagnosticSnapshot() {
    const dom = this.diagnoseFlowDOM();
    const snapshot = {
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : '',
      pageType: FlowMacroEngine.isFlowProjectPage() ? 'Canvas do Projeto' : (FlowMacroEngine.isFlowHubPage() ? 'Hub Inicial do FLOW' : 'Outra'),
      projectId: FlowMacroEngine.getCurrentProjectId(),
      macroState: this.state,
      currentSlide: `${this.currentIndex + 1}/${this.prompts.length}`,
      carouselsCount: this.carousels.length,
      domElements: dom,
      recentLogs: this.logs.slice(-20)
    };
    return JSON.stringify(snapshot, null, 2);
  }

  // =========================================================================
  // Pool de Chaves de IA e Sistema Multi-Provedor com Rotação Automática
  // =========================================================================

  /**
   * Adiciona uma nova chave de API de IA ao pool gerenciado
   * @param {string} keyString - Texto da chave de API
   * @param {string} providerHint - Provedor sugerido (gemini | groq | openrouter)
   * @param {string} modelHint - Modelo específico
   * @param {string} labelHint - Rótulo para identificação
   * @returns {Object|null}
   */
  addAIKey(keyString, providerHint = '', modelHint = '', labelHint = '') {
    if (!keyString || typeof keyString !== 'string') return null;
    const parsed = FlowPdfExtractor.parseAIKeysFromText(keyString);
    if (parsed.length === 0) return null;

    const newKey = parsed[0];
    if (providerHint) newKey.provider = providerHint;
    if (modelHint) newKey.model = modelHint;
    if (labelHint) newKey.label = labelHint;

    const existingIdx = this.aiKeysPool.findIndex(k => k.key === newKey.key);
    if (existingIdx !== -1) {
      this.aiKeysPool[existingIdx] = { ...this.aiKeysPool[existingIdx], ...newKey, status: 'active' };
    } else {
      this.aiKeysPool.push(newKey);
    }

    this.saveState();
    this.notify();
    return newKey;
  }

  /**
   * Importa múltiplas chaves de IA de uma lista
   * @param {Array<Object>} keysList - Lista de objetos de chave
   * @returns {number} - Quantidade de chaves adicionadas
   */
  importAIKeys(keysList) {
    if (!Array.isArray(keysList)) return 0;
    let addedCount = 0;
    keysList.forEach(k => {
      if (!k.key) return;
      const existing = this.aiKeysPool.find(item => item.key === k.key);
      if (!existing) {
        this.aiKeysPool.push(k);
        addedCount++;
      } else {
        existing.status = 'active';
      }
    });

    this.saveState();
    this.notify();
    return addedCount;
  }

  removeAIKey(id) {
    this.aiKeysPool = this.aiKeysPool.filter(k => k.id !== id);
    this.saveState();
    this.notify();
  }

  toggleAIKey(id) {
    const item = this.aiKeysPool.find(k => k.id === id);
    if (item) {
      item.enabled = !item.enabled;
      this.saveState();
      this.notify();
    }
  }

  resetAIKeysStatus() {
    this.aiKeysPool.forEach(k => {
      k.status = 'active';
      k.errorCount = 0;
    });
    this.saveState();
    this.notify();
  }

  clearAIKeysPool() {
    this.aiKeysPool = [];
    this.saveState();
    this.notify();
  }

  /**
   * Proxy universal de requisições HTTP roteado via Background Service Worker
   * Permite contornar restrições de CORS e CSP da página do Google
   * @param {string} url - URL de destino
   * @param {Object} options - Opções do fetch (headers, body, method)
   * @returns {Promise<Response|Object>}
   */
  static async fetchProxy(url, options = {}) {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage && chrome.runtime.id) {
      try {
        const resp = await new Promise((resolve) => {
          chrome.runtime.sendMessage({ action: 'CALL_AI_PROXY', url, options }, (response) => {
            if (chrome.runtime.lastError || !response) {
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });
        if (resp && resp.data !== undefined) {
          return {
            status: resp.status,
            ok: resp.ok,
            json: async () => resp.data,
            text: async () => (typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data))
          };
        }
      } catch (e) { /* fallback para fetch local */ }
    }
    return await fetch(url, options);
  }

  /**
   * Executa o auto-diagnóstico do DOM do Google FLOW com rotação automática de chaves de IA
   * Prioriza chaves já validadas e rotaciona automaticamente se atingir limites de cota (429)
   * @param {string} userQuery - Dúvida ou contexto adicional do usuário
   * @returns {Promise<Object>} - Resultado da análise da IA
   */
  async callAIDiagnostics(userQuery = '') {
    // 1. Constrói fila de prioridade: chaves validadas primeiro, ativas depois
    let candidates = [];
    if (this.aiKeysPool && this.aiKeysPool.length > 0) {
      const validKeys = this.aiKeysPool.filter(k => k.enabled !== false && k.status === 'valid');
      const activeKeys = this.aiKeysPool.filter(k => k.enabled !== false && k.status === 'active');
      const otherKeys = this.aiKeysPool.filter(k => k.enabled !== false && k.status !== 'valid' && k.status !== 'active');
      candidates = [...validKeys, ...activeKeys, ...otherKeys];
    }

    if (candidates.length === 0 && this.config.aiApiKey) {
      candidates.push({
        id: 'manual_key',
        key: this.config.aiApiKey,
        provider: this.config.aiProvider || 'gemini',
        model: this.config.aiModel || (this.config.aiProvider === 'groq' ? 'llama-3.3-70b-versatile' : this.config.aiProvider === 'openrouter' ? 'meta-llama/llama-3.2-3b-instruct:free' : 'gemini-2.5-flash'),
        status: 'active',
        label: `${(this.config.aiProvider || 'GEMINI').toUpperCase()} (Manual)`
      });
    }

    if (candidates.length === 0) {
      return {
        success: false,
        error: 'Nenhuma chave de API configurada. Carregue um arquivo (PDF, TXT, DOCX) ou insira sua chave na aba Espião FLOW.'
      };
    }

    const domDiag = this.diagnoseFlowDOM();
    const recentLogs = this.logs.slice(-15).map(l => `[${l.type.toUpperCase()}] ${l.message}`).join('\n');
    const currentUrl = (typeof window !== 'undefined' ? window.location.href : '');
    const isProject = FlowMacroEngine.isFlowProjectPage();
    const projectId = FlowMacroEngine.getCurrentProjectId();

    const systemPrompt = `Você é o Agente Especialista de Diagnóstico e Auto-Recuperação do FLOW Macro Studio Pro para o Google Flow (labs.google/fx/pt/tools/flow).
Seu objetivo é analisar o estado da página, o DOM, a barra de prompt, os botões e os logs recentes, orientando o usuário em português brasileiro de forma direta e concisa.

REGRAS DE ARQUITETURA DO GOOGLE FLOW:
1. No 'Hub Inicial do FLOW' (URL sem /project/): É perfeitamente NORMAL e ESPERADO que o botão de envio (Criar/➔) e o botão + de personagens não estejam presentes, pois a geração de imagens só acontece DENTRO DE UM PROJETO (/project/ID).
2. Se o usuário estiver no Hub Inicial, explique que a interface está pronta e que basta clicar em 'Iniciar Macro' no Studio (a macro executa o Passo A automaticamente, criando e entrando no Canvas do projeto) ou clicar em '+ Novo projeto'.
3. Somente aponte como bloqueio a falta do botão Criar/➔ ou do botão + se a página já estiver 'Dentro do Projeto' (/project/ID).`;

    const userPrompt = `
ESTADO ATUAL DO GOOGLE FLOW:
- URL: ${currentUrl}
- Tipo de Página: ${isProject ? 'Dentro do Projeto (' + projectId + ')' : 'Hub Inicial do FLOW'}
- Estado do Macro: ${this.state} (Slide atual: ${this.currentIndex + 1}/${this.prompts.length})
- Campo de Prompt: ${domDiag.promptInput.found ? 'ENCONTRADO (' + domDiag.promptInput.tag + ')' : 'NÃO DETECTADO'}
- Botão de Envio (Criar/➔): ${domDiag.submitButton.found ? (domDiag.submitButton.disabled ? 'ENCONTRADO (DESABILITADO)' : 'ENCONTRADO (HABILITADO)') : 'NÃO DETECTADO'}
- Botão "Reutilizar Comando": ${domDiag.reuseCommand.found ? 'ENCONTRADO (' + domDiag.reuseCommand.count + ' botões)' : 'NÃO DETECTADO'}
- Imagens/Chips Anexados: ${this.hasCharacterChipsAttached() ? 'SIM (2+ chips detectados)' : 'NÃO'}
- Últimos Logs:
${recentLogs}

PERGUNTA / CONTEXTO ADICIONAL:
${userQuery || 'Analise o status atual do Google FLOW, verifique se há bloqueios, seletor travado ou erro e sugira a ação de auto-recuperação.'}
`;

    let lastError = '';

    // Loop de tentativas com rotação automática entre as chaves do pool
    for (let i = 0; i < candidates.length; i++) {
      const cand = candidates[i];
      const provider = cand.provider || 'gemini';
      const apiKey = cand.key;
      const model = cand.model || (provider === 'gemini' ? 'gemini-2.5-flash' : provider === 'groq' ? 'llama-3.3-70b-versatile' : 'meta-llama/llama-3.2-3b-instruct:free');

      try {
        let responseText = '';

        if (provider === 'gemini') {
          const candidateGeminiModels = [
            'gemini-2.5-flash',
            'gemini-flash-latest',
            'gemini-2.5-flash-lite',
            'gemini-2.0-flash',
            'gemini-3-flash-preview',
            'gemini-1.5-flash-latest',
            'gemini-1.5-flash',
            'gemini-1.5-pro'
          ];

          let geminiSuccess = null;
          let lastGeminiError = null;

          const tryCallGemini = async (modelName, version = 'v1beta') => {
            const cleanModel = modelName.replace(/^models\//, '');
            const url = `https://generativelanguage.googleapis.com/${version}/models/${cleanModel}:generateContent?key=${apiKey}`;
            const res = await FlowMacroEngine.fetchProxy(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
                generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
              })
            });
            return await res.json();
          };

          // 1. Tenta modelos prioritários
          for (const m of candidateGeminiModels) {
            try {
              const data = await tryCallGemini(m, 'v1beta');
              if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                geminiSuccess = data.candidates[0].content.parts[0].text;
                cand.model = m;
                break;
              }
              if (data.error) {
                lastGeminiError = data.error;
                const errStr = (data.error.message || '').toLowerCase();
                if (data.error.code === 400 && errStr.includes('api key not valid')) {
                  break;
                }
                if (data.error.code === 429 || (data.error.status === 'RESOURCE_EXHAUSTED' && errStr.includes('quota'))) {
                  break; // Cota esgotada
                }
              }
            } catch (e) {
              lastGeminiError = e;
            }
          }

          // 2. Se falhar, busca modelos disponíveis via listModels
          if (!geminiSuccess && lastGeminiError && !(lastGeminiError.code === 429 || (lastGeminiError.status === 'RESOURCE_EXHAUSTED')) && !(lastGeminiError.code === 400 && (lastGeminiError.message || '').includes('API key not valid'))) {
            try {
              const listRes = await FlowMacroEngine.fetchProxy(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
              const listData = await listRes.json();
              if (listData.models && Array.isArray(listData.models)) {
                const supported = listData.models.filter(sm => Array.isArray(sm.supportedGenerationMethods) && sm.supportedGenerationMethods.includes('generateContent'));
                for (const sm of supported) {
                  const mName = sm.name || '';
                  const data = await tryCallGemini(mName, 'v1beta');
                  if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
                    geminiSuccess = data.candidates[0].content.parts[0].text;
                    cand.model = mName;
                    break;
                  }
                }
              }
            } catch (err) { /* ignora */ }
          }

          if (!geminiSuccess) {
            const errStr = lastGeminiError ? (lastGeminiError.message || JSON.stringify(lastGeminiError)) : 'Falha na API Gemini';
            if (lastGeminiError && (lastGeminiError.code === 429 || (lastGeminiError.status === 'RESOURCE_EXHAUSTED' && errStr.toLowerCase().includes('quota')))) {
              cand.status = 'exhausted';
              this.addLog(`⚠️ Chave [${cand.label || 'Gemini'}] esgotou a cota diária. Rotacionando automaticamente para a próxima chave...`, 'warning');
              this.saveState();
              this.notify();
              lastError = `Cota excedida na chave Gemini: ${errStr}`;
              continue;
            }
            if (lastGeminiError && (lastGeminiError.code === 400 && errStr.toLowerCase().includes('api key not valid'))) {
              cand.status = 'error';
              this.addLog(`❌ Chave [${cand.label || 'Gemini'}] inválida. Pulando para a próxima chave...`, 'warning');
              this.saveState();
              this.notify();
              lastError = `Chave inválida: ${errStr}`;
              continue;
            }
            throw new Error(errStr);
          }

          responseText = geminiSuccess;
        } else if (provider === 'groq') {
          const url = 'https://api.groq.com/openai/v1/chat/completions';
          const groqModels = [
            'llama-3.3-70b-versatile',
            'llama-3.1-8b-instant',
            'mixtral-8x7b-32768',
            'gemma2-9b-it'
          ];
          let groqSuccess = null;
          let lastGroqError = null;

          for (const gModel of groqModels) {
            try {
              const res = await FlowMacroEngine.fetchProxy(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
                body: JSON.stringify({
                  model: gModel,
                  messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                  temperature: 0.2,
                  max_tokens: 1000
                })
              });

              const data = await res.json();
              if (data.choices?.[0]?.message?.content) {
                groqSuccess = data.choices[0].message.content;
                cand.model = gModel;
                break;
              }

              if (data.error) {
                lastGroqError = data.error;
                const errStr = (data.error.message || '').toLowerCase();
                if (data.error.code === 429 || errStr.includes('rate_limit') || errStr.includes('quota')) {
                  break;
                }
                if (errStr.includes('not found') || errStr.includes('deprecated') || errStr.includes('unavailable')) {
                  continue;
                }
              }
            } catch (e) {
              lastGroqError = e;
            }
          }

          if (!groqSuccess) {
            const errStr = lastGroqError ? (lastGroqError.message || JSON.stringify(lastGroqError)) : 'Falha na API Groq';
            if (lastGroqError && (lastGroqError.code === 429 || errStr.toLowerCase().includes('rate_limit') || errStr.toLowerCase().includes('quota'))) {
              cand.status = 'exhausted';
              this.addLog(`⚠️ Chave [${cand.label || 'Groq'}] esgotou a cota. Rotacionando automaticamente para a próxima chave...`, 'warning');
              this.saveState();
              this.notify();
              lastError = `Cota excedida na chave Groq: ${errStr}`;
              continue;
            }
            throw new Error(errStr);
          }

          responseText = groqSuccess;
        } else if (provider === 'openrouter') {
          const url = 'https://openrouter.ai/api/v1/chat/completions';
          const freeModels = [
            'meta-llama/llama-3.2-3b-instruct:free',
            'meta-llama/llama-3.1-8b-instruct:free',
            'mistralai/mistral-7b-instruct:free',
            'google/gemini-2.0-flash-thinking-exp:free',
            'deepseek/deepseek-r1:free',
            'openrouter/auto'
          ];

          let successResponse = null;
          let lastOrError = null;

          for (const targetModel of freeModels) {
            try {
              const res = await FlowMacroEngine.fetchProxy(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${apiKey}`,
                  'HTTP-Referer': 'https://labs.google/fx/pt/tools/flow',
                  'X-Title': 'FLOW Macro Studio Pro'
                },
                body: JSON.stringify({
                  model: targetModel,
                  messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
                  temperature: 0.2,
                  max_tokens: 1000
                })
              });

              const data = await res.json();
              if (data.choices?.[0]?.message?.content) {
                successResponse = data.choices[0].message.content;
                cand.model = targetModel;
                break;
              }

              if (data.error) {
                lastOrError = data.error;
                const errStr = (data.error.message || '').toLowerCase();
                if (errStr.includes('unavailable') || errStr.includes('no endpoints') || errStr.includes('slug instead') || errStr.includes('not found') || errStr.includes('paid version')) {
                  continue;
                }
                if (data.error.code === 429 || errStr.includes('quota') || errStr.includes('rate')) {
                  break;
                }
              }
            } catch (e) {
              lastOrError = e;
            }
          }

          if (!successResponse) {
            const errStr = lastOrError ? (lastOrError.message || JSON.stringify(lastOrError)) : 'Falha ao consultar OpenRouter';
            if (lastOrError && (lastOrError.code === 429 || errStr.toLowerCase().includes('rate') || errStr.toLowerCase().includes('quota'))) {
              cand.status = 'exhausted';
              this.addLog(`⚠️ Chave [${cand.label || 'OpenRouter'}] esgotou a cota. Rotacionando automaticamente para a próxima chave...`, 'warning');
              this.saveState();
              this.notify();
              lastError = `Cota excedida na chave OpenRouter: ${errStr}`;
              continue;
            }
            throw new Error(errStr);
          }

          responseText = successResponse;
        }

        // Sucesso: marca chave como válida e retorna resposta
        cand.status = 'valid';
        cand.lastUsed = Date.now();
        this.saveState();
        this.notify();

        return {
          success: true,
          provider: provider,
          model: model,
          keyUsed: cand.label || cand.key.substring(0, 8) + '...',
          analysis: responseText
        };
      } catch (err) {
        cand.status = 'error';
        cand.errorCount = (cand.errorCount || 0) + 1;
        lastError = err.message || 'Erro na requisição';
        this.addLog(`❌ Falha na chave [${cand.label || provider}]: ${lastError}`, 'warning');
      }
    }

    return {
      success: false,
      error: `Todas as ${candidates.length} chave(s) no Pool falharam ou esgotaram cota. Último erro: ${lastError}`
    };
  }

  /**
   * Constrói o texto limpo do prompt do slide (somente a descrição visual)
   * Personagens são anexados via imagens no FLOW (chips), nunca embutidos no texto.
   * @param {Object} promptItem - Item do slide
   * @returns {string} - Texto do prompt normalizado
   */
  composePromptText(promptItem) {
    const raw = promptItem.fullText || promptItem.imagePrompt || '';
    return FlowMacroEngine.normalizePromptText(raw);
  }

  // =========================================================================
  // Motor de Execução da Automação (Play, Pause, Stop, Step)
  // =========================================================================
  
  /**
   * Inicia ou retoma a execução sequencial dos carrosséis e slides
   */
  async start() {
    // Popula a lista de prompts a partir dos carrosséis configurados
    if (this.carousels && this.carousels.length > 0) {
      const activeCarousels = this.carousels.filter(c => c.enabled !== false);
      const allSlides = [];
      const defaultReps = parseInt(this.config.repeatPerPrompt, 10) || 1;
      activeCarousels.forEach(c => {
        if (c.slides && Array.isArray(c.slides)) {
          c.slides.filter(s => s.enabled !== false).forEach(s => {
            const pRep = parseInt(s.repeatCount, 10);
            if (!pRep || pRep === 1) {
              s.repeatCount = defaultReps;
            }
            allSlides.push(s);
          });
        }
      });
      if (allSlides.length > 0) {
        this.prompts = allSlides;
      }
    }

    // Pré-cria as pastas dos carrosséis no disco (Downloads) assim que começar a rodar o programa
    if (this.carousels && this.carousels.length > 0) {
      this.prepareCarouselFoldersInDownloads();
    }

    if (this.prompts.length === 0) {
      this.addLog('⚠️ Nenhum prompt disponível para executar. Cole um roteiro ou carregue um PDF.', 'warning');
      return;
    }

    if (this.state === 'running') return;

    this.isStopped = false;
    this.state = 'running';
    if (!this.startTime) {
      this.startTime = Date.now();
    }
    this.startTicker();
    this.startBackgroundKeepAlive();
    this.addLog('▶️ Macro iniciada com controle de tempo e Keep-Alive de segundo plano ativos.', 'success');
    this.notify();

    // Dispara notificação de início no Telegram se habilitado
    this.sendTelegramNotification(
      `🚀 *[FLOW Studio Pro]*\n` +
      `🎬 *Início de Execução!*\n` +
      `• *Total de Prompts:* ${this.prompts.length}\n` +
      `• *Carrosséis na Fila:* ${this.carousels && this.carousels.length > 0 ? this.carousels.length : 1}\n` +
      `• *Horário de Início:* ${new Date().toLocaleTimeString()}`
    );

    // Inicia a partir do primeiro slide pendente se não estiver retomando
    if (this.currentIndex === -1 || this.currentIndex >= this.prompts.length) {
      const firstPending = this.prompts.findIndex(p => p.enabled && p.status !== 'completed');
      this.currentIndex = firstPending !== -1 ? firstPending : 0;
      if (this.currentIndex === 0) {
        this.settingsConfiguredForProject = false;
        this.lastConfiguredProjectId = null;
        this.uploadedAvatarsInFlow = new Set();
      }
    }

    // Fecha banners ou modais obstrutivos antes de iniciar
    this.dismissFlowOnboardingBanners();

    this.runLoop();
  }

  /**
   * Pré-cria as pastas no disco em Downloads para cada carrossel ativo
   * Chamado automaticamente assim que o programa começa a rodar
   */
  async prepareCarouselFoldersInDownloads() {
    if (!this.carousels || this.carousels.length === 0) return;
    const activeCarousels = this.carousels.filter(c => c.enabled !== false);
    if (activeCarousels.length === 0) return;

    this.addLog(`📁 Pré-criando ${activeCarousels.length} pastas de carrossel em Downloads...`, 'info');

    const folderList = activeCarousels.map((c, idx) => {
      const folderName = `Carrossel_${c.index || (idx + 1)}`;
      return {
        folderName: folderName,
        title: c.title || `Carrossel ${idx + 1}`,
        slidesCount: (c.slides || []).length
      };
    });

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id) {
        chrome.runtime.sendMessage({
          action: 'PREPARE_CAROUSEL_FOLDERS',
          folders: folderList,
          baseFolder: this.config.downloadFolder || 'FLOW_Downloads',
          useBaseFolder: false
        }, () => {
          if (chrome.runtime.lastError) {
            // Ignora se contexto não responder
          }
        });
      }
      this.addLog(`✅ ${folderList.length} pastas de carrossel pré-criadas no disco: ${folderList.map(f => f.folderName).join(', ')}`, 'success');
    } catch (err) {
      console.warn('[FLOW Macro] Aviso ao pré-criar pastas de carrossel:', err);
    }
  }

  /**
   * Pausa a execução da macro mantendo o progresso e o cronômetro
   */
  pause() {
    this.state = 'paused';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.stopTicker();
    this.stopBackgroundKeepAlive();
    this.countdown = { remaining: 0, total: 0, label: '' };
    this.currentAction = 'Pausado';
    this.addLog('⏸️ Macro pausada pelo usuário.', 'warning');
    this.notify();
  }

  /**
   * Retoma a execução caso esteja pausada
   */
  resume() {
    if (this.state === 'paused') {
      this.start();
    }
  }

  /**
   * Interrompe totalmente a execução da macro imediatamente e reseta o cronômetro e os status dos slides
   */
  stop() {
    this.isStopped = true;
    this.state = 'idle';
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.stopTicker();
    this.stopBackgroundKeepAlive();
    this.startTime = 0;
    this.elapsedSeconds = 0;
    this.countdown = { remaining: 0, total: 0, label: '' };
    this.settingsConfiguredForProject = false;
    this.lastConfiguredProjectId = null;
    this.currentAction = 'Parado';
    this.currentIndex = -1;

    // Reseta o progresso em todos os prompts e slides
    this.prompts.forEach(p => {
      p.completedRepeats = 0;
      p.status = 'pending';
      p.errorMsg = '';
    });

    // Reseta o status de todos os carrosséis
    this.carousels.forEach(c => {
      c.status = 'pending';
      if (c.slides && Array.isArray(c.slides)) {
        c.slides.forEach(s => {
          s.completedRepeats = 0;
          s.status = 'pending';
          s.errorMsg = '';
        });
      }
    });

    this.saveState();
    this.addLog('⏹️ Macro interrompida pelo usuário. Execução cancelada imediatamente.', 'warning');
    this.notify();
  }

  // =========================================================================
  // Gerenciamento de Múltiplos Carrosséis em Lote e Troca de Projetos
  // =========================================================================
  
  setCarousels(carousels) {
    this.carousels = carousels || [];
    this.prompts = [];
    const defaultReps = parseInt(this.config.repeatPerPrompt, 10) || 1;
    this.carousels.forEach(c => {
      (c.slides || []).forEach(s => {
        const pRep = parseInt(s.repeatCount, 10);
        if (!pRep || pRep === 1) {
          s.repeatCount = defaultReps;
        }
        this.prompts.push(s);
      });
    });
    this.saveState();
    this.notify();
  }

  selectCarouselFilter(filterId) {
    this.selectedCarouselId = filterId || 'all';
    this.carousels.forEach(c => {
      const match = filterId === 'all' || c.id === filterId;
      c.enabled = match;
      c.slides.forEach(s => {
        s.enabled = match;
      });
    });
    this.saveState();
  }

  /**
   * Retorna a URL limpa da página inicial (Hub) do Google FLOW respeitando o domínio atual (flow.google.com ou labs.google)
   * @returns {string} - URL do Hub (ex: "https://flow.google.com/" ou "https://labs.google/fx/pt/tools/flow")
   */
  static getHubUrl() {
    if (typeof window === 'undefined') return 'https://flow.google.com/';
    const origin = window.location.origin || 'https://flow.google.com';
    const host = (window.location.hostname || '').toLowerCase();
    if (host.includes('flow.google')) {
      return `${origin}/`;
    }
    const pathname = window.location.pathname || '';
    const match = pathname.match(/(\/fx(?:\/[a-zA-Z-]+)?\/tools\/flow)/i);
    if (match) {
      return `${origin}${match[1]}`;
    }
    return `${origin}/`;
  }

  /**
   * Valida se uma URL pertence estritamente ao Google FLOW
   * @param {string} url - URL a testar
   * @returns {boolean}
   */
  static isValidFlowUrl(url) {
    if (!url || typeof url !== 'string') return true;
    try {
      const parsed = new URL(url, window.location.origin);
      const host = parsed.hostname.toLowerCase();
      if (!host.includes('flow.google') && !host.includes('labs.google') && !host.includes('withgoogle.com')) return false;
      const p = parsed.pathname.toLowerCase();
      const isHub = (host.includes('flow.google') && (p === '/' || p === '')) || ((p.includes('/tools/flow') || p.endsWith('/flow')) && !p.includes('/project/'));
      const isProject = p.includes('/project/');
      return isHub || isProject;
    } catch (e) {
      return false;
    }
  }

  /**
   * Verifica com máxima precisão se um elemento DOM está visível na tela
   * Suporta nativamente modais com position: fixed, Radix UI portals e shadow DOM
   * @param {HTMLElement} element - Elemento a testar
   * @returns {boolean}
   */
  static isElementVisible(element) {
    if (!element) return false;
    if (element.closest && element.closest('[id*="fd-"], [class*="fd-"]')) return false;
    if (typeof element.checkVisibility === 'function') {
      try {
        return element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
      } catch (e) {}
    }
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;
    try {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    } catch (e) {}
    return true;
  }

  /**
   * Verifica se um elemento é seguro para clique (evita links externos, menus laterais e perigos)
   * @param {HTMLElement} element - Elemento DOM
   * @returns {boolean}
   */
  static isSafeToClick(element) {
    if (!element) return false;
    
    // Nunca clica dentro da interface da própria extensão
    if (element.closest('[id*="fd-"], [class*="fd-"]')) return false;

    // NUNCA clica em filtros, ordenação ou ferramentas de busca do FLOW
    const text = (element.textContent || element.innerText || '').toLowerCase().trim();
    const aria = (element.getAttribute('aria-label') || '').toLowerCase();
    const title = (element.getAttribute('title') || '').toLowerCase();
    const testid = (element.getAttribute('data-testid') || '').toLowerCase();

    if (
      aria.includes('filtro') || aria.includes('filter') || aria.includes('filtrar') ||
      title.includes('filtro') || title.includes('filter') || title.includes('filtrar') ||
      aria.includes('ordenar') || aria.includes('sort') ||
      aria.includes('pesquisar') || aria.includes('search') ||
      text === 'filtros' || text === 'filter' || text === 'filters' ||
      testid.includes('filter') || testid.includes('search')
    ) {
      return false;
    }

    // Verifica se possui ícones de filtro ou busca do Google Symbols
    const symbol = element.querySelector('.google-symbols, .material-symbols-outlined, i, span');
    if (symbol) {
      const sym = (symbol.textContent || symbol.innerText || '').trim().toLowerCase();
      if (['filter_list', 'tune', 'filter_alt', 'search', 'sort'].includes(sym)) {
        return false;
      }
    }

    // Bloqueia cliques em links ou navegação global do site
    if (element.closest('nav, [role="navigation"], [class*="navbar" i]')) {
      return false;
    }

    // Bloqueia qualquer elemento posicionado no cabeçalho superior de busca (Y < 120px)
    try {
      const rect = element.getBoundingClientRect();
      if (rect.top < 120 && rect.left < window.innerWidth - 80) {
        return false;
      }
    } catch (e) {}

    // Nunca clica em links que saiam do editor para /characters, /assets, /gallery, etc.
    const aTag = element.closest('a');
    if (aTag) {
      const href = (aTag.getAttribute('href') || aTag.href || '').toLowerCase();
      if (!FlowMacroEngine.isValidFlowUrl(href)) return false;
      if (href.includes('/characters') || href.includes('/assets') || href.includes('/gallery') || href.includes('/settings') || href.includes('/templates') || href.includes('/projects')) {
        return false;
      }
    }

    const anyHref = (element.getAttribute('href') || element.getAttribute('data-href') || '').toLowerCase();
    if (anyHref.includes('/characters') || anyHref.includes('/assets') || anyHref.includes('/gallery')) {
      return false;
    }

    return true;
  }

  /**
   * Retorna verdadeiro se o usuário estiver no Hub inicial do FLOW (onde fica o botão "+ Novo projeto")
   * @returns {boolean}
   */
  static isFlowHubPage() {
    if (typeof window === 'undefined') return false;
    const host = (window.location.hostname || '').toLowerCase();
    const path = (window.location.pathname || '').toLowerCase();
    if (host.includes('flow.google')) {
      return !path.includes('/project/');
    }
    return (path.includes('/tools/flow') || path.endsWith('/flow')) && !path.includes('/project/');
  }

  /**
   * Retorna verdadeiro se o usuário estiver dentro de um projeto ativo (Canvas de geração)
   * @returns {boolean}
   */
  static isFlowProjectPage() {
    if (typeof window === 'undefined') return false;
    const path = (window.location.pathname || '').toLowerCase();
    return (path.includes('/tools/flow/project/') || path.includes('/project/')) && !path.includes('/characters') && !path.includes('/assets');
  }

  /**
   * Retorna verdadeiro se o usuário estiver na sub-página de gerenciamento de personagens
   * @returns {boolean}
   */
  static isFlowCharactersPage() {
    if (typeof window === 'undefined') return false;
    const path = (window.location.pathname || '').toLowerCase();
    return path.includes('/characters') || path.includes('/assets');
  }

  /**
   * Recupera o ID do projeto atual do FLOW na URL
   * @returns {string|null} - ID do projeto
   */
  static getCurrentProjectId() {
    if (typeof window === 'undefined') return null;
    const match = window.location.pathname.match(/\/project\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  /**
   * Garante que o navegador esteja na tela principal do Canvas do projeto e não em subpáginas
   */
  static async ensureOnFlowCanvas() {
    if (typeof window === 'undefined') return true;
    const path = window.location.pathname || '';
    if (!path.includes('/characters') && !path.includes('/assets')) {
      return true;
    }

    const projectId = FlowMacroEngine.getCurrentProjectId();

    // 1. Tenta clicar no botão "Canvas" ou "Editor" na barra lateral
    const canvasLink = Array.from(document.querySelectorAll('a, button, [role="button"], [role="tab"]')).find(el => {
      if (!FlowMacroEngine.isElementVisible(el)) return false;
      const href = (el.getAttribute('href') || el.href || '').toLowerCase();
      const text = (el.textContent || el.innerText || '').toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();

      const isCanvasHref = href && href.includes('/project/') && !href.includes('/characters') && !href.includes('/assets');
      const isCanvasText = text === 'canvas' || text.includes('canvas') || text === 'fluxo' || text === 'editor';
      const isCanvasAria = aria.includes('canvas') || aria.includes('fluxo') || aria.includes('editor');
      const isCanvasTitle = title.includes('canvas') || title.includes('fluxo') || title.includes('editor');

      return isCanvasHref || isCanvasText || isCanvasAria || isCanvasTitle;
    });

    if (canvasLink) {
      try {
        canvasLink.click();
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) { /* ignora */ }
    }

    // 2. Fallback: navegação limpa por pushState na URL
    if (window.location.pathname.includes('/characters') || window.location.pathname.includes('/assets')) {
      const cleanPath = window.location.pathname.replace(/\/characters(\/.*)?$/i, '').replace(/\/assets(\/.*)?$/i, '');
      const cleanUrl = window.location.origin + cleanPath + window.location.search;

      try {
        window.history.pushState(null, '', cleanUrl);
        window.dispatchEvent(new PopStateEvent('popstate'));
        await new Promise(r => setTimeout(r, 600));
      } catch (e) { /* ignora */ }

      if (window.location.pathname.includes('/characters') || window.location.pathname.includes('/assets')) {
        window.location.href = cleanUrl;
        await new Promise(r => setTimeout(r, 1800));
      }
    }

    return true;
  }

  /**
   * Detecta e cancela automaticamente modais perigosos (como "Você quer mesmo excluir este projeto?")
   * Clica imediatamente em "Cancelar" e envia Escape para proteger os projetos do usuário
   * @returns {boolean}
   */
  dismissDangerousModals() {
    try {
      const dangerNodes = Array.from(document.querySelectorAll([
        '[role="dialog"]',
        '[role="alertdialog"]',
        'div[class*="modal" i]',
        'div[class*="dialog" i]',
        'h1, h2, h3, h4, div, p, span'
      ].join(', '))).filter(el => {
        if (el.closest('[id*="fd-"], [class*="fd-"]')) return false;
        const t = (el.textContent || el.innerText || '').toLowerCase();
        return t.includes('excluir este projeto') ||
               t.includes('você quer mesmo excluir') ||
               t.includes('voce quer mesmo excluir') ||
               t.includes('todos os seus clipes') ||
               t.includes('delete this project') ||
               t.includes('excluir o projeto') ||
               t.includes('deseja excluir');
      });

      if (dangerNodes.length > 0) {
        const cancelBtn = Array.from(document.querySelectorAll('button, [role="button"]')).find(b => {
          if (b.closest('[id*="fd-"], [class*="fd-"]')) return false;
          const t = (b.textContent || b.innerText || '').trim().toLowerCase();
          const aria = (b.getAttribute('aria-label') || '').toLowerCase();
          return t === 'cancelar' || t === 'cancel' || aria.includes('cancelar') || aria.includes('cancel');
        });

        if (cancelBtn) {
          cancelBtn.focus();
          cancelBtn.click();
          this.simulateClick(cancelBtn);
          this.addLog('🛡️ [Proteção Ativa] Modal "Você quer mesmo excluir este projeto?" detectado e CANCELADO imediatamente!', 'warning');
        }

        // Garante fechamento enviando tecla Escape
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
        return true;
      }
    } catch (e) { /* ignora */ }
    return false;
  }

  /**
   * Localiza o botão "+ Novo projeto" estritamente na tela do Hub inicial do Google FLOW
   * Prioriza a busca textual direta pela expressão "Novo projeto" (conforme solicitado pelo usuário).
   * @returns {HTMLElement|null}
   */
  findNewProjectButton() {
    // Cancela qualquer popup perigoso imediatamente
    this.dismissDangerousModals();

    // 0. NUNCA procura botão de Novo Projeto dentro do Canvas de um projeto aberto
    if (FlowMacroEngine.isFlowProjectPage()) {
      return null;
    }

    // =========================================================================
    // PRIORIDADE 1: Busca textual direta pelas palavras "novo projeto" ou "new project"
    // Varre todos os botões, links, spans e divs interativos da página
    // =========================================================================
    const candidateElements = Array.from(document.querySelectorAll('button, [role="button"], a, div[tabindex="0"], span, div, p'));
    for (const el of candidateElements) {
      if (!FlowMacroEngine.isElementVisible(el)) continue;
      if (el.closest('[id*="fd-"], [class*="fd-"]')) continue;

      const text = (el.textContent || el.innerText || '').trim().toLowerCase();
      const aria = (el.getAttribute('aria-label') || '').toLowerCase();
      const title = (el.getAttribute('title') || '').toLowerCase();

      const hasTextMatch = text.includes('novo projeto') || text.includes('new project') ||
                           aria.includes('novo projeto') || aria.includes('new project') ||
                           title.includes('novo projeto') || title.includes('new project');

      if (!hasTextMatch) continue;

      // SEGURANÇA: Rejeita rigorosamente menus de opções, cards de projetos com thumbnail e exclusão
      if (
        text.includes('excluir') || text.includes('delete') || text.includes('apagar') ||
        text.includes('remover') || text.includes('certeza') || text.includes('exclusão') ||
        text.includes('more_vert')
      ) {
        continue;
      }

      if (el.querySelector('img') || el.closest('[class*="card" i]:has(img), [role="gridcell"]:has(img)')) {
        continue;
      }

      // Se encontrou o texto dentro de um span/div/ícone, sobe até o botão clicável pai
      const clickableBtn = el.closest('button, [role="button"], a, div[tabindex="0"]') || el;
      if (clickableBtn && FlowMacroEngine.isElementVisible(clickableBtn) && !clickableBtn.querySelector('img')) {
        this.addLog('✨ [Passo A] Botão "Novo projeto" localizado via busca textual direta!', 'info');
        return clickableBtn;
      }
    }

    // =========================================================================
    // PRIORIDADE 2: Busca por XPath textual direto no DOM
    // =========================================================================
    try {
      const xpath = "//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'novo projeto') and not(self::script) and not(self::style)]";
      const result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
      for (let i = 0; i < result.snapshotLength; i++) {
        const node = result.snapshotItem(i);
        if (!FlowMacroEngine.isElementVisible(node) || node.closest('[id*="fd-"], [class*="fd-"]')) continue;
        if (node.querySelector('img') || node.closest('[class*="card" i]:has(img)')) continue;
        const text = (node.textContent || '').toLowerCase();
        if (text.includes('excluir') || text.includes('apagar')) continue;

        const clickable = node.closest('button, [role="button"], a, div[tabindex="0"]') || node;
        if (FlowMacroEngine.isElementVisible(clickable)) {
          this.addLog('✨ [Passo A] Botão "Novo projeto" localizado via XPath textual!', 'info');
          return clickable;
        }
      }
    } catch (e) { /* ignora */ }

    // =========================================================================
    // PRIORIDADE 3: Classes oficiais gravadas do FLOW (Fallback)
    // =========================================================================
    const exactClassSelectors = [
      'button.cgdjfr',
      'button.iofibh',
      'button.sc-16c4830a-1',
      'button.sc-a38764c7-0',
      'button.sc-1c6805c6-1',
      'button:has(div[data-type="button-overlay"])'
    ];

    for (const sel of exactClassSelectors) {
      const candidates = Array.from(document.querySelectorAll(sel)).filter(b => {
        if (!FlowMacroEngine.isElementVisible(b)) return false;
        if (b.closest('[id*="fd-"], [class*="fd-"]')) return false;
        if (b.querySelector('img') || b.closest('[class*="card" i]:has(img), [role="gridcell"]')) return false;
        const text = (b.textContent || b.innerText || '').toLowerCase();
        return text.includes('novo projeto') || text.includes('new project') || text.includes('add_2');
      });

      if (candidates.length > 0) {
        return candidates[0];
      }
    }

    return null;
  }

  /**
   * Cria um novo projeto no Google FLOW de forma automática e segura (Passo A do fluxograma)
   * @returns {Promise<boolean>}
   */
  async createNewFlowProject() {
    this.dismissDangerousModals();
    this.settingsConfiguredForProject = false;
    this.lastConfiguredProjectId = null;
    this.uploadedAvatarsInFlow = new Set();
    this.addLog('📁 [Passo A] Preparando criação de novo projeto no FLOW...', 'info');

    const hubUrl = FlowMacroEngine.getHubUrl();

    // 1. Se estiver dentro de um projeto (/project/...), retorna ao Hub
    if (FlowMacroEngine.isFlowProjectPage()) {
      this.addLog('↩️ Navegando para o Hub inicial do FLOW...', 'info');
      
      const homeLink = Array.from(document.querySelectorAll('a, button, [role="button"]')).find(a => {
        const href = (a.getAttribute('href') || a.href || '').toLowerCase();
        const aria = (a.getAttribute('aria-label') || '').toLowerCase();
        const text = (a.textContent || '').toLowerCase();
        return (
          href.endsWith('/tools/flow') || href.endsWith('/tools/flow/') || href.endsWith('/pt/tools/flow') ||
          href === '/' || href.endsWith('flow.google.com/') || href.endsWith('flow.google.com') ||
          aria.includes('início') || aria.includes('home') || aria.includes('projetos') ||
          text.includes('projetos') || text.includes('flow')
        );
      });

      if (homeLink) {
        homeLink.click();
        await new Promise(r => setTimeout(r, 1200));
      }

      if (FlowMacroEngine.isFlowProjectPage()) {
        window.location.href = hubUrl;
        return true;
      }
    }

    // Aguarda confirmação de carregamento do Hub
    for (let h = 0; h < 10; h++) {
      this.dismissDangerousModals();
      if (FlowMacroEngine.isFlowHubPage() && !FlowMacroEngine.isFlowProjectPage()) {
        break;
      }
      await new Promise(r => setTimeout(r, 500));
    }

    // 2. Localiza o botão "+ Novo projeto" no Hub
    let newProjBtn = this.findNewProjectButton();

    if (!newProjBtn) {
      for (let w = 0; w < 8; w++) {
        await new Promise(r => setTimeout(r, 500));
        this.dismissDangerousModals();
        newProjBtn = this.findNewProjectButton();
        if (newProjBtn) break;
      }
    }

    if (newProjBtn) {
      newProjBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
      newProjBtn.focus();

      const overlay = newProjBtn.querySelector('[data-type="button-overlay"]') || newProjBtn;

      // 1. Simula clique no overlay (que captura eventos pointer no Next.js/styled-components)
      if (overlay && overlay !== newProjBtn) {
        this.simulateClick(overlay);
        try { overlay.click(); } catch(e) {}
      }

      // 2. Simula clique no botão nativo
      this.simulateClick(newProjBtn);
      try { newProjBtn.click(); } catch(e) {}

      // 3. Aciona o handler React direto no botão e no overlay de forma limpa
      [newProjBtn, overlay].forEach(el => {
        try {
          const propKey = Object.keys(el).find(k => k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$'));
          if (propKey && el[propKey]) {
            if (typeof el[propKey].onClick === 'function') {
              el[propKey].onClick({ preventDefault: () => {}, stopPropagation: () => {}, target: el, currentTarget: el });
            }
          }
        } catch (e) {}
      });

      this.addLog('✨ Botão "Novo projeto" clicado! Aguardando o FLOW inicializar o projeto...', 'success');
      await new Promise(r => setTimeout(r, 1500));

      // Aguarda até 20s para o novo Canvas ser carregado (/project/...)
      for (let i = 0; i < 40; i++) {
        this.dismissDangerousModals();
        if (FlowMacroEngine.isFlowCharactersPage()) {
          await FlowMacroEngine.ensureOnFlowCanvas();
        }
        if (this.findPromptInput() && FlowMacroEngine.isFlowProjectPage()) {
          this.addLog(`📍 Novo projeto carregado: ${FlowMacroEngine.getCurrentProjectId() || 'ID ativo'}`, 'success');
          await new Promise(r => setTimeout(r, 800));
          return true;
        }
        await new Promise(r => setTimeout(r, 500));
      }
      return true;
    }

    this.addLog('⚠️ Botão "Novo projeto" não encontrado na tela do Hub.', 'warning');
    return false;
  }

  /**
   * Executa um único prompt isoladamente (modo de teste manual)
   * @param {string} id - ID do prompt
   */
  async runSinglePrompt(id) {
    const item = this.prompts.find(p => p.id === id);
    if (!item) return;

    this.isStopped = false;
    this.state = 'running';
    const prevIndex = this.currentIndex;
    this.currentIndex = this.prompts.indexOf(item);
    const needConfig = !this.isCurrentProjectConfigured();
    await this.executeSlide(item, needConfig, item.index, 1, item.carouselTitle || 'Carrossel');
    this.currentIndex = prevIndex;
    if (this.state === 'running') {
      this.state = 'idle';
    }
    this.notify();
  }

  /**
   * Loop mestre de execução: itera sobre todos os carrosséis e slides da sequência
   * Respeita os tempos entre slides (15s padrão) e carrosséis (25s padrão)
   */
  async runLoop() {
    // 0. Detecta se está no Hub ou dentro do projeto
    if (FlowMacroEngine.isFlowHubPage() || !FlowMacroEngine.isFlowProjectPage()) {
      this.addLog('🏠 [Passo A] Página Inicial / Hub do FLOW detectada: criando novo projeto no Canvas...', 'info');
      const created = await this.createNewFlowProject();
      if (!created && !FlowMacroEngine.isFlowProjectPage()) {
        this.addLog('❌ Não foi possível entrar no Canvas de um projeto do FLOW. Abra um projeto e tente novamente.', 'error');
        this.stop();
        return;
      }
    } else {
      this.addLog(`📍 [Dentro do Projeto] ID: ${FlowMacroEngine.getCurrentProjectId() || 'ativo'} - Execução direta no Canvas.`, 'info');
      // Fecha eventuais modais ou gavetas de detalhes residuais para limpar o Canvas
      this.dismissDangerousModals();
      this.closeResourceModal();
    }

    // Determina os carrosséis habilitados
    const activeCarousels = this.carousels.filter(c => c.enabled !== false);
    const carouselsToRun = activeCarousels.length > 0 ? activeCarousels : [{ id: 'carousel_1', title: 'Carrossel Principal', slides: this.prompts.filter(p => p.enabled !== false) }];

    this.addLog(`🎬 Iniciando execução em lote: ${carouselsToRun.length} carrossel(is) na fila.`, 'info');

    for (let cIdx = 0; cIdx < carouselsToRun.length; cIdx++) {
      if (this.isStopped || this.state !== 'running') break;
      const carousel = carouselsToRun[cIdx];

      // Se este carrossel já foi concluído com sucesso anteriormente (ex: em retomada pós-recarga)
      if (carousel.status === 'completed') {
        this.addLog(`⏭️ [Carrossel ${cIdx + 1}/${carouselsToRun.length}] "${carousel.title}" já concluído anteriormente. Avançando...`, 'info');
        continue;
      }

      carousel.status = 'running';

      this.addLog(`\n========================================\n🌟 [Carrossel ${cIdx + 1}/${carouselsToRun.length}] Iniciando: ${carousel.title}\n========================================`, 'info');
      this.notify();

      // Envia miniaturas dos personagens envolvidos no início do carrossel para o Telegram
      await this.sendTelegramCarouselCharacters(carousel, cIdx + 1, carouselsToRun.length);

      // Se for um novo carrossel subsequente e a opção de criar novo projeto estiver ativa
      if (cIdx > 0 && this.config.autoCreateNewProjectPerCarousel) {
        if (this.isStopped || this.state !== 'running') break;
        this.addLog('🏠 [Passo A - Novo Carrossel] Acessando o Hub do FLOW para criar um novo projeto...', 'info');
        await this.createNewFlowProject();
      }

      const activeSlides = carousel.slides.filter(s => s.enabled !== false);

      for (let sIdx = 0; sIdx < activeSlides.length; sIdx++) {
        if (this.isStopped || this.state !== 'running') break;
        const slide = activeSlides[sIdx];

        const defaultRepeats = parseInt(this.config.repeatPerPrompt, 10) || 1;
        const pRep = parseInt(slide.repeatCount, 10);
        const targetRepeats = Math.max(1, (pRep && pRep > 1) ? pRep : defaultRepeats);

        // Se este slide já foi concluído anteriormente (todas as repetições finalizadas)
        if (slide.status === 'completed' && (slide.completedRepeats || 0) >= targetRepeats) {
          this.addLog(`⏭️ [Slide ${sIdx + 1}/${activeSlides.length}] "${slide.slideTitle || slide.title}" já finalizado (${slide.completedRepeats}/${targetRepeats}). Pulando...`, 'info');
          continue;
        }

        // O 1º slide de cada carrossel anexa os personagens e aplica as configurações iniciais
        // Se os slides anteriores foram pulados, o primeiro slide ativo que rodar atuará como o inicial
        const isFirstSlideOfCarousel = (sIdx === 0 || activeSlides.slice(0, sIdx).every(s => s.status === 'completed'));

        // Atualiza o índice do prompt global para refletir o slide atual na barra de status
        const globalSlideIdx = this.prompts.indexOf(slide);
        if (globalSlideIdx !== -1) {
          this.currentIndex = globalSlideIdx;
        }
        this.saveState();

        await this.executeSlide(slide, isFirstSlideOfCarousel, sIdx + 1, activeSlides.length, carousel.title);

        if (this.isStopped || this.state !== 'running') break;

        // Intervalo entre slides do mesmo carrossel com cronômetro regressivo (Padrão: 15s)
        if (sIdx + 1 < activeSlides.length && !this.isStopped && this.state === 'running') {
          const slideDelay = parseInt(this.config.delaySeconds, 10) || 15;
          await this.waitWithCountdown(slideDelay, `Próximo Slide (${sIdx + 2}/${activeSlides.length})`);
        }
      }

      if (this.isStopped || this.state !== 'running') break;

      const hasFailedSlides = carousel.slides.some(s => s.status === 'error' || (s.enabled !== false && (s.completedRepeats || 0) === 0));
      if (hasFailedSlides) {
        carousel.status = 'failed';
        this.addLog(`\n================================================================\n⚠️ [CARROSSEL FINALIZADO COM ALERTAS]\n• Carrossel ${cIdx + 1}/${carouselsToRun.length}: "${carousel.title}"\n• Alguns slides apresentaram pendências.\n================================================================\n`, 'warning');
        if (typeof window !== 'undefined' && typeof window.flowShowToast === 'function') {
          window.flowShowToast(`⚠️ Carrossel ${cIdx + 1}/${carouselsToRun.length} ("${carousel.title}") finalizado com alertas`, 'info');
        }
      } else {
        carousel.status = 'completed';
        this.addLog(`\n================================================================\n🎉 [CARROSSEL FINALIZADO COM SUCESSO!]\n• Carrossel ${cIdx + 1}/${carouselsToRun.length}: "${carousel.title}"\n• Total de slides gerados: ${activeSlides.length}\n================================================================\n`, 'success');
        if (typeof window !== 'undefined' && typeof window.flowShowToast === 'function') {
          window.flowShowToast(`🎉 Carrossel ${cIdx + 1}/${carouselsToRun.length} ("${carousel.title}") concluído com sucesso!`, 'success');
        }
      }
      this.saveState();

      // Notificação ao Vivo no Telegram a cada Carrossel Concluído
      const statusIcon = hasFailedSlides ? '⚠️' : '🎉';
      const statusLabel = hasFailedSlides ? 'Finalizado com Alertas' : 'Concluído com Sucesso';
      const carouselReport = 
        `${statusIcon} *[Carrossel ${cIdx + 1}/${carouselsToRun.length}] ${statusLabel}*\n` +
        `📚 *Título:* ${carousel.title}\n` +
        `🖼️ *Slides gerados:* ${activeSlides.length}\n` +
        `⏱️ *Tempo decorrido:* ${FlowMacroEngine.formatDuration(this.elapsedSeconds)}`;

      // Se a imagem de capa ainda não foi definida, busca a última imagem gerada no Canvas
      if (!carousel.coverImageUrl) {
        carousel.coverImageUrl = this.findLatestGeneratedImageUrl();
      }

      // 📸 Envia Foto de Capa do Carrossel com relatório na legenda (se habilitado)
      if (this.config.telegramSendCoverPhoto !== false && carousel.coverImageUrl) {
        this.addLog(`✈️ [Telegram] Enviando foto de capa do carrossel "${carousel.title}"...`, 'info');
        const photoSent = await this.sendTelegramPhoto(carousel.coverImageUrl, carouselReport, 1280);
        if (!photoSent) {
          await this.sendTelegramNotification(carouselReport);
        }
      } else {
        await this.sendTelegramNotification(carouselReport);
      }

      // =======================================================================
      // Gatilho de Download Automático por Carrossel (Individual ou Pasta Única)
      // Executa ANTES de transicionar ou navegar para novo projeto do FLOW
      // =======================================================================
      const shouldAutoDownload = Boolean(
        this.config.autoDownloadResults ||
        (typeof window !== 'undefined' && window.flowSettings && window.flowSettings.autoDownload)
      );

      if (shouldAutoDownload && !this.isStopped && typeof window !== 'undefined' && typeof window.flowStartBatchDownload === 'function') {
        const baseFolder = this.config.downloadFolder || (window.flowSettings && window.flowSettings.downloadFolder) || 'FLOW_Downloads';
        let targetFolder = baseFolder;

        if (this.config.carouselFolderMode !== 'single') {
          // Modo Pastas Individuais por Carrossel
          const cleanCTitle = FlowMacroEngine.sanitizeFolderName(carousel.title || `Carrossel_${cIdx + 1}`);
          targetFolder = `${baseFolder}/${cleanCTitle}`;
        }

        this.addLog(`📥 [Download do Carrossel ${cIdx + 1}/${carouselsToRun.length}] Baixando imagens geradas em "${targetFolder}"...`, 'info');
        try {
          await new Promise(r => setTimeout(r, 1200));
          await this.scrollCanvasToTop();
          await new Promise(r => setTimeout(r, 800));
          await window.flowStartBatchDownload(targetFolder, { onlyNew: true });
        } catch (dlErr) {
          console.error('[FLOW Macro] Erro no download automático do carrossel:', dlErr);
          this.addLog(`⚠️ Alerta no download automático do carrossel: ${dlErr.message}`, 'warning');
        }
      }

      // Intervalo entre o fim de um carrossel e o início do próximo (Padrão: 25s)
      if (cIdx + 1 < carouselsToRun.length && !this.isStopped && this.state === 'running') {
        const carouselDelay = parseInt(this.config.carouselDelaySeconds, 10) || 25;
        this.addLog(`\n⏳ [Transição de Carrossel] Aguardando ${carouselDelay}s antes de abrir o próximo carrossel...`, 'info');
        await this.waitWithCountdown(carouselDelay, `Próximo Carrossel (${cIdx + 2}/${carouselsToRun.length})`);
      }
    }

    if (!this.isStopped && this.state === 'running') {
      this.state = 'idle';
      this.stopTicker();
      this.stopBackgroundKeepAlive();
      this.countdown = { remaining: 0, total: 0, label: '' };
      this.currentAction = 'Concluído';
      const totalElapsed = FlowMacroEngine.formatDuration(this.elapsedSeconds);
      const anyCarouselFailed = carouselsToRun.some(c => c.status === 'failed');

      if (anyCarouselFailed) {
        this.addLog(`\n================================================================\n⚠️ [FLUXO FINALIZADO COM ALERTAS]\n• Duração total: ${totalElapsed}\n• Verifique os logs para detalhes sobre eventuais slides pendentes.\n================================================================\n`, 'warning');
        if (typeof window !== 'undefined' && typeof window.flowShowToast === 'function') {
          window.flowShowToast(`⚠️ Execução finalizada com alertas. Tempo total: ${totalElapsed}`, 'info');
        }
      } else {
        this.addLog(`\n================================================================\n🏆 [FLUXO 100% FINALIZADO COM SUCESSO!]\n• Todos os ${carouselsToRun.length} carrosséis e slides foram gerados no FLOW!\n• Duração total da execução: ${totalElapsed}\n================================================================\n`, 'success');
        if (typeof window !== 'undefined' && typeof window.flowShowToast === 'function') {
          window.flowShowToast(`🏆 Fluxo 100% Concluído! Todos os prompts gerados (${totalElapsed})!`, 'success');
        }
      }
      this.saveState();

      // Notificação Final no Telegram
      if (anyCarouselFailed) {
        this.sendTelegramNotification(
          `⚠️ *[FLOW Studio Pro - Finalizado com Alertas]*\n` +
          `• Duração total: *${totalElapsed}*\n` +
          `• Alguns slides apresentaram pendências. Verifique o painel.`
        );
      } else {
        this.sendTelegramNotification(
          `🏆 *[FLOW Studio Pro - 100% CONCLUÍDO!]*\n` +
          `• Todos os *${carouselsToRun.length} carrosséis* foram gerados no FLOW!\n` +
          `• Duração total: *${totalElapsed}*\n` +
          `• Todas as imagens foram processadas e salvas!`
        );
      }

      // =======================================================================
      // Gatilho de Download Automático em Lote ao Concluir Tudo
      // =======================================================================
      const shouldAutoDownload = Boolean(
        this.config.autoDownloadResults ||
        (typeof window !== 'undefined' && window.flowSettings && window.flowSettings.autoDownload)
      );

      if (shouldAutoDownload && typeof window !== 'undefined' && typeof window.flowStartBatchDownload === 'function') {
        this.addLog(`\n📥 [Download Automático Ativo] Todos os prompts foram gerados! Rolando o Canvas até o topo e baixando todas as imagens geradas...`, 'info');
        if (typeof window.flowShowToast === 'function') {
          window.flowShowToast('📥 Rolando Canvas e baixando todas as imagens em lote...', 'info');
        }

        // Aguarda estabilização final do Canvas do FLOW
        await new Promise(r => setTimeout(r, 1500));
        await this.scrollCanvasToTop();
        await new Promise(r => setTimeout(r, 1000));

        const targetFolder = this.config.downloadFolder || (window.flowSettings && window.flowSettings.downloadFolder) || 'FLOW_Downloads';
        try {
          await window.flowStartBatchDownload(targetFolder);
        } catch (dlErr) {
          console.error('[FLOW Macro] Erro no download automático ao concluir:', dlErr);
          this.addLog(`⚠️ Erro ao disparar download automático: ${dlErr.message}`, 'warning');
        }
      }
    }
  }

  /**
   * Executa um slide individual seguindo a sequência exata de Passos do Fluxograma:
   * - Slide 1: Passo 1 (Prompt) -> Passo 2 (Configurações 1x) -> Passos 3, 4, 5 (Personagens) -> Passo 6 (Envio & Espera)
   * - Slide 2+: Passo 7 (Reutilizar Comando & Substituir Prompt) -> Passo 6 (Envio & Espera)
   * @param {Object} item - Objeto do slide a ser gerado
   * @param {boolean} isFirstSlideOfCarousel - Se é o primeiro slide do projeto
   * @param {number} slideNum - Número do slide atual
   * @param {number} totalSlides - Total de slides do carrossel
   * @param {string} carouselTitle - Título do carrossel
   */
  async executeSlide(item, isFirstSlideOfCarousel, slideNum, totalSlides, carouselTitle) {
    item.status = 'running';
    const defaultRepeats = parseInt(this.config.repeatPerPrompt, 10) || 1;
    const pRep = parseInt(item.repeatCount, 10);
    const targetRepeats = Math.max(1, (pRep && pRep > 1) ? pRep : defaultRepeats);
    const startRep = parseInt(item.completedRepeats, 10) || 0;

    for (let rep = startRep; rep < targetRepeats; rep++) {
      if (this.isStopped || this.state !== 'running') break;

      const isRepetition = (rep > 0);

      this.addLog(`🚀 [Slide ${slideNum}/${totalSlides}] ${carouselTitle} • ${item.slideTitle || item.title} (${isRepetition ? `Repetição ${rep + 1}/${targetRepeats}` : `Inserção 1/${targetRepeats}`})`, 'info');
      if (isRepetition) {
        this.addLog(`🔁 [Repetição ${rep + 1}/${targetRepeats}] Iniciando repetição: preparando para reenviar o mesmo prompt com as mesmas imagens no FLOW...`, 'info');
      }
      this.notify();

      try {
        if (this.isStopped || this.state !== 'running') return;

        // 0. Garante que o Canvas do FLOW não está com geração ativa em andamento antes de iniciar
        const activeGenCheck = this.isCanvasGenerating();
        if (activeGenCheck.generating) {
          this.addLog(`⏳ [Canvas Ocupado] ${activeGenCheck.reason}. Aguardando conclusão da geração anterior...`, 'info');
          await this.waitForGenerationToComplete(90);
          await new Promise(r => setTimeout(r, 2000));
        }

        if (this.isStopped || this.state !== 'running') return;

        // Garante que estamos na tela do Canvas
        if (FlowMacroEngine.isFlowCharactersPage()) {
          this.addLog('↩️ Corrigindo página: retornando da tela de personagens para o Canvas do projeto...', 'info');
          await FlowMacroEngine.ensureOnFlowCanvas();
        }

        if (FlowMacroEngine.isFlowHubPage() || !FlowMacroEngine.isFlowProjectPage()) {
          this.addLog('🏠 [Passo A] Detectado Hub inicial: criando/acessando projeto antes do slide...', 'info');
          await this.createNewFlowProject();
        }

        // Se a tela estiver em modo de imagem expandida (editor de imagem/lightbox), fecha e volta ao Canvas
        if (this.isImageExpanded()) {
          await this.exitExpandedImageView();
        }

        if (this.isStopped || this.state !== 'running') return;

        let reused = false;

        // Passo 7: Reutiliza comando anterior APENAS na transição entre slides diferentes (NUNCA em repetições do mesmo prompt!)
        if (!isFirstSlideOfCarousel && !isRepetition && this.config.reusePreviousCommand !== false) {
          this.currentAction = '🔁 Reutilizando comando do slide anterior...';
          this.notify();
          for (let rTry = 0; rTry < 3; rTry++) {
            if (this.isStopped || this.state !== 'running') return;
            reused = await this.reuseLatestCommand();
            if (reused) break;
            if (rTry < 2) await new Promise(r => setTimeout(r, 1000));
          }
          await this.stepDelay(null, 'Aguardando FLOW carregar comando...');
        }

        if (this.isStopped || this.state !== 'running') return;

        // Se for o 1º slide, ou se for repetição do mesmo prompt, ou se a reutilização não foi possível:
        if (!reused) {
          this.dismissFlowOnboardingBanners();

          // Passo 1: Inserir o primeiro prompt de texto
          // Aguarda até 15s para o campo de prompt aparecer (o Canvas pode demorar a carregar após "Novo projeto")
          let inputEl = null;
          for (let waitInput = 0; waitInput < 30; waitInput++) {
            if (this.isStopped || this.state !== 'running') return;
            inputEl = this.findPromptInput();
            if (inputEl) break;
            if (waitInput === 0) {
              this.addLog('⏳ Aguardando campo de prompt do FLOW carregar...', 'info');
            }
            await new Promise(r => setTimeout(r, 500));
          }
          if (!inputEl) {
            throw new Error('Campo de prompt do Flow não encontrado na página após 15s de espera.');
          }

          if (this.isStopped || this.state !== 'running') return;

          // Se for repetição do mesmo prompt, limpa resíduos antes de reinserir o texto
          if (isRepetition) {
            await this.clearPromptInput(inputEl);
            await new Promise(r => setTimeout(r, 200));
          }

          this.currentAction = isRepetition
            ? `📝 [Repetição ${rep + 1}/${targetRepeats}] Reinserindo o mesmo prompt...`
            : '📝 Inserindo texto do prompt inicial...';
          this.notify();
          const composedText = this.composePromptText(item);
          await this.setPromptInputValue(inputEl, composedText);
          this.addLog(`📝 [${isRepetition ? `Repetição ${rep + 1}/${targetRepeats}` : 'Passo 1'}] ${isRepetition ? 'Mesmo prompt reinserido no campo de texto.' : 'Prompt inserido no campo de texto.'}`, 'info');
          await this.stepDelay(null, isRepetition ? 'Reanexando personagens...' : 'Verificando configurações...');

          if (this.isStopped || this.state !== 'running') return;

          // Passo 1 (Continuação): Configuração de formato e proporção de imagem
          // Executa se o projeto ainda não foi configurado OU no 1º slide do carrossel, NUNCA em repetições
          const needSettingsConfig = (!this.isCurrentProjectConfigured() || isFirstSlideOfCarousel) && !isRepetition;
          if (needSettingsConfig) {
            this.currentAction = '⚙️ [Passo 1] Configurando proporção e formato de imagem do carrossel...';
            this.notify();
            await this.applyFlowSettings();
            await this.stepDelay(null, 'Verificando personagens...');
          }

          if (this.isStopped || this.state !== 'running') return;

          // Passos 2, 3 e 4: Anexar personagens de referência (botão +, buscar na biblioteca, incluir no comando)
          if (this.config.applyGlobalCharacters !== false && this.characters && this.characters.length > 0) {
            this.currentAction = isRepetition
              ? `🎭 [Repetição ${rep + 1}/${targetRepeats}] Reanexando imagens de referência para enviar novamente...`
              : '🎭 Anexando personagens de referência...';
            this.notify();
            if (isRepetition) {
              this.addLog(`🎭 [Repetição ${rep + 1}/${targetRepeats}] Reanexando imagens de referência da biblioteca para enviar novamente o mesmo prompt...`, 'info');
            }
            const charsAttached = await this.attachCharactersFromFlowLibrary();

            if (this.isStopped || this.state !== 'running') return;

            // Se os personagens NÃO foram anexados, interrompe a execução do slide
            if (!charsAttached) {
              throw new Error(`Falha ao anexar personagens de referência. Os chips não foram confirmados na barra de prompt.`);
            }

            // Pausa de segurança pós-chips para o React estabilizar completamente
            await new Promise(r => setTimeout(r, 1500));
            this.addLog(`✅ Personagens confirmados na barra de prompt${isRepetition ? ` para repetição ${rep + 1}` : ''}. Preparando envio...`, 'success');

            // Verifica se o prompt de texto ainda está presente após anexar personagens
            const postCharInputEl = this.findPromptInput();
            const postCharText = postCharInputEl ? (postCharInputEl.value || postCharInputEl.innerText || postCharInputEl.textContent || '').trim() : '';
            if (!postCharText || postCharText.length < 10) {
              this.addLog('⚠️ Prompt de texto foi removido durante anexação de personagens! Re-inserindo...', 'warning');
              const composedText = this.composePromptText(item);
              await this.setPromptInputValue(postCharInputEl, composedText);
              await new Promise(r => setTimeout(r, 500));
              this.addLog('📝 Prompt de texto re-inserido com sucesso.', 'info');
            }

            await this.stepDelay(null, 'Validando prompt completo...');
          }
        } else {
          // Passo 7: Comando reutilizado com sucesso (personagens já anexados).
          // Agora substituir o texto do prompt pelo prompt do slide seguinte:
          const inputEl = this.findPromptInput();
          if (!inputEl) {
            throw new Error('Campo de prompt do Flow não encontrado na página.');
          }
          this.currentAction = `📝 Atualizando prompt para slide ${slideNum}...`;
          this.notify();

          this.addLog(`🧹 [Passo 7] Apagando prompt anterior do comando reutilizado...`, 'info');
          await this.clearPromptInput(inputEl);
          await new Promise(r => setTimeout(r, 200));

          const composedText = this.composePromptText(item);
          await this.setPromptInputValue(inputEl, composedText);
          this.addLog(`📝 [Passo 7] Prompt do slide ${slideNum} atualizado no comando reutilizado.`, 'info');
          await this.stepDelay(null, 'Preparando envio...');
        }

        if (this.isStopped || this.state !== 'running') return;

        this.dismissFlowOnboardingBanners();

        // Garante que nenhum dialog/menu externo ficou aberto antes de enviar (sem fechar o promptContainer)
        for (let closeWait = 0; closeWait < 3; closeWait++) {
          const promptContainer = this.getPromptContainer();
          const unwanted = Array.from(document.querySelectorAll('[role="dialog"], [role="menu"], [class*="popover" i], [class*="modal" i], [data-radix-popper-content-wrapper]')).filter(el => {
            if (!FlowMacroEngine.isElementVisible(el) || el.closest('[id*="fd-"], [class*="fd-"]')) return false;
            if (promptContainer && (promptContainer === el || promptContainer.contains(el) || el.contains(promptContainer))) return false;
            return true;
          });
          if (unwanted.length === 0) break;
          this.addLog('⚠️ Popover/menu externo detectado antes do envio. Fechando...', 'info');
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true, cancelable: true }));
          await new Promise(r => setTimeout(r, 400));
        }

        // Verifica que o campo de prompt contém texto antes de enviar
        const inputEl = this.findPromptInput();
        const promptText = inputEl ? (inputEl.value || inputEl.innerText || inputEl.textContent || '').trim() : '';
        if (!promptText) {
          this.addLog('⚠️ Campo de prompt está vazio! Re-inserindo texto...', 'warning');
          if (inputEl) {
            const composedText = this.composePromptText(item);
            await this.setPromptInputValue(inputEl, composedText);
            await new Promise(r => setTimeout(r, 500));
          }
        }

        // Garante que os personagens de referência continuam anexados na barra de prompt antes do envio
        if (this.config.applyGlobalCharacters !== false && this.characters && this.characters.length > 0) {
          if (!this.hasCharacterChipsAttached()) {
            this.addLog('🎭 [Pré-Envio] Imagens de personagens não detectadas na barra de prompt! Anexando da biblioteca...', 'info');
            await this.attachCharactersFromFlowLibrary();
            await new Promise(r => setTimeout(r, 600));
          }
        }

        if (this.isStopped || this.state !== 'running') return;

        // Garante que o Canvas está 100% desocupado antes de clicar no botão de envio
        const preSubmitGen = this.isCanvasGenerating();
        if (preSubmitGen.generating) {
          this.addLog(`⏳ [Aguardando Canvas Livre] FLOW ainda gerando imagens (${preSubmitGen.reason}). Aguardando término antes de enviar...`, 'info');
          await this.waitForGenerationToComplete(90);
          await new Promise(r => setTimeout(r, 1500));
        }

        if (this.isStopped || this.state !== 'running') return;

        // Sobe o Canvas para o topo e limpa cards com falha residuais antes do envio
        await this.scrollCanvasToTop();
        await this.dismissFailedCards();

        // =========================================================================
        // Tentativas de Execução do Prompt (Máximo 3 tentativas por slide)
        // Se as 3 falharem, o macro avança para o próximo slide/prompt sem travar!
        // =========================================================================
        const maxAttemptsPerPrompt = 3;
        let attempt = 1;
        let genSuccess = false;

        // Tentativa 1: Envio inicial do prompt
        this.currentAction = isRepetition
          ? `🚀 [Repetição ${rep + 1}/${targetRepeats}] Enviando prompt no FLOW...`
          : `🚀 [Tentativa 1/${maxAttemptsPerPrompt}] Enviando prompt para geração no FLOW...`;
        this.notify();
        if (isRepetition) {
          this.addLog(`🚀 [Repetição ${rep + 1}/${targetRepeats}] Enviando novamente o mesmo prompt para geração no FLOW...`, 'info');
        } else {
          this.addLog(`🚀 [Tentativa 1/${maxAttemptsPerPrompt}] Enviando prompt no FLOW: ${item.slideTitle || item.title}`, 'info');
        }

        const submitBtn = this.findSubmitButton();
        const submitted = await this.simulateSubmit(submitBtn, inputEl);

        if (!submitted) {
          throw new Error('Não foi possível acionar o botão de envio nem a tecla Enter no FLOW.');
        }

        this.addLog(`✅ [Tentativa 1/${maxAttemptsPerPrompt}] ${isRepetition ? `Mesmo prompt enviado (${rep + 1}/${targetRepeats})` : `Inserção 1/${targetRepeats} disparada`} no FLOW: ${item.slideTitle || item.title}`, 'success');

        // Rola imediatamente para o topo e mantém fixado para o usuário ver a imagem gerada
        await this.scrollCanvasToTop({ wait: true });
        setTimeout(() => this.scrollCanvasToTop(), 250);
        setTimeout(() => this.scrollCanvasToTop(), 700);

        // Aguarda a geração da imagem ser concluída no Canvas do FLOW (timeout: 60s)
        genSuccess = await this.waitForGenerationToComplete(60);

        if (this.isStopped || this.state !== 'running') {
          this.addLog('⏹️ Execução interrompida durante a geração.', 'warning');
          return;
        }

        // Auto-Recuperação: Se falhou na tentativa 1, tenta até mais 2 vezes (totalizando 3 tentativas)
        while (!genSuccess && attempt < maxAttemptsPerPrompt && !this.isStopped && this.state === 'running') {
          attempt++;
          this.addLog(`⚠️ [Tentativa ${attempt}/${maxAttemptsPerPrompt}] Falha na geração anterior. Iniciando recuperação do slide ${slideNum}...`, 'warning');

          // 1. Sobe a barra de rolagem para o topo do Canvas para expor os cards com erro
          await this.scrollCanvasToTop();

          // 2. Remove os cards com erro do Canvas
          this.addLog(`🗑️ [Tentativa ${attempt}/${maxAttemptsPerPrompt}] Apagando card(s) com erro do Canvas...`, 'info');
          const dismissedCount = await this.dismissFailedCards();
          if (dismissedCount > 0) {
            this.addLog(`✅ [Tentativa ${attempt}/${maxAttemptsPerPrompt}] ${dismissedCount} card(s) com erro removido(s) do Canvas.`, 'info');
          }
          await new Promise(r => setTimeout(r, 1200));
          this.dismissDangerousModals();

          if (this.isStopped || this.state !== 'running') return;

          // 3. Aguarda Canvas estabilizar se ainda houver processamento residual
          const activeCheck = this.isCanvasGenerating();
          if (activeCheck.generating) {
            this.addLog(`⏳ [Tentativa ${attempt}/${maxAttemptsPerPrompt}] Aguardando Canvas desocupar...`, 'info');
            await this.waitForGenerationToComplete(20);
          }

          if (this.isStopped || this.state !== 'running') return;

          // 4. Re-insere texto do prompt
          this.addLog(`📝 [Tentativa ${attempt}/${maxAttemptsPerPrompt}] Re-inserindo o texto do prompt...`, 'info');
          let retryInput = this.findPromptInput();
          if (retryInput) {
            await this.clearPromptInput(retryInput);
            await new Promise(r => setTimeout(r, 250));
            const composedText = this.composePromptText(item);
            await this.setPromptInputValue(retryInput, composedText);
            await new Promise(r => setTimeout(r, 400));
          }

          // 5. Re-anexa personagens da biblioteca se necessário
          if (this.config.applyGlobalCharacters !== false && this.characters && this.characters.length > 0) {
            if (!this.hasCharacterChipsAttached()) {
              this.addLog(`🎭 [Tentativa ${attempt}/${maxAttemptsPerPrompt}] Reanexando personagens da biblioteca...`, 'info');
              await this.attachCharactersFromFlowLibrary();
              await new Promise(r => setTimeout(r, 800));

              retryInput = this.findPromptInput();
              const txt = retryInput ? (retryInput.value || retryInput.innerText || retryInput.textContent || '').trim() : '';
              if (!txt || txt.length < 10) {
                const composedText = this.composePromptText(item);
                await this.setPromptInputValue(retryInput, composedText);
                await new Promise(r => setTimeout(r, 400));
              }
            }
          }

          if (this.isStopped || this.state !== 'running') return;

          // Sobe para o topo mais uma vez antes de disparar
          await this.scrollCanvasToTop();

          // 6. Reenvia prompt
          this.currentAction = `🚀 [Tentativa ${attempt}/${maxAttemptsPerPrompt}] Reenviando prompt...`;
          this.notify();
          this.addLog(`🚀 [Tentativa ${attempt}/${maxAttemptsPerPrompt}] Reenviando prompt no FLOW após limpar falhas...`, 'info');
          const retrySubmitBtn = this.findSubmitButton();
          const retrySubmitted = await this.simulateSubmit(retrySubmitBtn, retryInput);

          if (retrySubmitted) {
            this.addLog(`✅ [Tentativa ${attempt}/${maxAttemptsPerPrompt}] Prompt reenviado. Aguardando geração...`, 'success');
            await this.scrollCanvasToTop({ wait: true });
            setTimeout(() => this.scrollCanvasToTop(), 250);
            setTimeout(() => this.scrollCanvasToTop(), 700);
            genSuccess = await this.waitForGenerationToComplete(60);
          } else {
            this.addLog(`⚠️ [Tentativa ${attempt}/${maxAttemptsPerPrompt}] Não foi possível acionar o botão de envio.`, 'warning');
            await new Promise(r => setTimeout(r, 1500));
          }
        }

        if (this.isStopped || this.state !== 'running') return;

        // Se após as 3 tentativas ainda não concluiu a geração:
        if (!genSuccess) {
          this.addLog(`⚠️ [Avanço Automático] Slide ${slideNum} atingiu o limite de ${maxAttemptsPerPrompt} tentativas sem sucesso. Prosseguindo para o próximo slide/prompt...`, 'warning');
          item.status = 'error';
          item.errorMsg = `Falha na geração após ${maxAttemptsPerPrompt} tentativas.`;
          this.saveState();

          // Notificação de alerta no Telegram
          if (this.config.telegramSendDetailedPrompts !== false) {
            const promptDetail = this.composePromptText(item) || item.fullText || item.imagePrompt || item.title || '';
            this.sendTelegramNotification(
              `⚠️ *[Alerta no Slide ${slideNum}/${totalSlides}]*\n` +
              `📚 *Carrossel:* ${carouselTitle}\n` +
              `❌ *Status:* Falha após ${maxAttemptsPerPrompt} tentativas\n` +
              `📝 *Prompt:*\n\`\`\`\n${promptDetail.trim()}\n\`\`\`\n` +
              `⏩ Avançando automaticamente para o próximo slide.`
            );
          }

          // Limpa campo de prompt para não misturar no próximo slide
          const cleanupInput = this.findPromptInput();
          if (cleanupInput) {
            await this.clearPromptInput(cleanupInput);
          }
          // Retorna permitindo que o loop do carrossel siga imediatamente para o próximo slide!
          return;
        }

        // Geração concluída com sucesso!
        item.completedRepeats = rep + 1;
        this.saveState();

        this.addLog(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n✅ [SLIDE CONCLUÍDO COM SUCESSO!]\n• Slide ${slideNum}/${totalSlides}: "${item.title || ('Slide ' + slideNum)}"\n• Carrossel: "${carouselTitle}"${targetRepeats > 1 ? `\n• Repetição: ${rep + 1}/${targetRepeats}` : ''}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`, 'success');
        if (typeof window !== 'undefined' && typeof window.flowShowToast === 'function') {
          window.flowShowToast(`✅ Slide ${slideNum}/${totalSlides} concluído!`, 'success');
        }

        // =======================================================================
        // Download Automático Imediato do Slide Concluído
        // =======================================================================
        const shouldAutoDownloadSlide = Boolean(
          this.config.autoDownloadResults ||
          (typeof window !== 'undefined' && window.flowSettings && window.flowSettings.autoDownload)
        );

        if (shouldAutoDownloadSlide && typeof window !== 'undefined' && typeof window.flowStartBatchDownload === 'function') {
          const baseFolder = this.config.downloadFolder || (window.flowSettings && window.flowSettings.downloadFolder) || 'FLOW_Downloads';
          let slideFolder = baseFolder;
          if (this.config.carouselFolderMode !== 'single') {
            const cleanCTitle = FlowMacroEngine.sanitizeFolderName(carouselTitle || `Carrossel`);
            slideFolder = `${baseFolder}/${cleanCTitle}`;
          }

          try {
            this.addLog(`📥 [Auto-Download] Coletando e salvando imagem gerada do slide ${slideNum}...`, 'info');
            await window.flowStartBatchDownload(slideFolder, { onlyNew: true, quick: true });
          } catch (dlErr) {
            console.warn('[FLOW Macro] Aviso ao baixar imagem gerada do slide:', dlErr);
          }
        }

        // 📸 Captura imagem de capa do carrossel ao concluir o 1º slide
        if (isFirstSlideOfCarousel || slideNum === 1) {
          try {
            const coverUrl = this.findLatestGeneratedImageUrl();
            if (coverUrl) {
              const targetCarousel = (this.carousels || []).find(c => c.title === carouselTitle || (c.slides && c.slides.includes(item)));
              if (targetCarousel) {
                targetCarousel.coverImageUrl = coverUrl;
              }
            }
          } catch (covErr) {
            console.warn('[FLOW Macro] Erro ao registrar capa do slide 1:', covErr);
          }
        }

        // 📝 Notificação detalhada de cada fluxo/prompt concluído no Telegram
        if (this.config.telegramSendDetailedPrompts !== false) {
          const promptDetail = this.composePromptText(item) || item.fullText || item.imagePrompt || item.title || '';
          const dialogueText = item.dialogue ? `\n💬 *Fala/Diálogo:* ${item.dialogue}` : '';
          const repText = targetRepeats > 1 ? ` (Repetição ${rep + 1}/${targetRepeats})` : '';

          await this.sendTelegramNotification(
            `✅ *[Fluxo Concluído - Slide ${slideNum}/${totalSlides}${repText}]*\n` +
            `📚 *Carrossel:* ${carouselTitle}\n` +
            `🎬 *Slide:* ${item.slideTitle || item.title || `Slide ${slideNum}`}\n` +
            (dialogueText ? dialogueText + '\n' : '') +
            `📝 *Prompt Detalhado:*\n\`\`\`\n${promptDetail.trim()}\n\`\`\``
          );
        }

        // Se houver repetições configuradas para o mesmo slide, aguarda delay pré-configurado
        if (rep + 1 < targetRepeats && !this.isStopped && this.state === 'running') {
          const repDelay = Math.max(10, parseInt(this.config.repeatDelaySeconds, 10) || 15);
          this.addLog(`⏳ [Aguardando Repetição] Geração concluída com sucesso no Canvas! Aguardando ${repDelay}s para repetir e enviar novamente o mesmo prompt (${rep + 2}/${targetRepeats})...`, 'info');
          await this.waitWithCountdown(repDelay, `Aguardando para repetir e enviar novamente o mesmo prompt (${rep + 2}/${targetRepeats})`);
        }
      } catch (err) {
        if (this.isStopped || this.state !== 'running') {
          return;
        }
        item.status = 'error';
        item.errorMsg = err.message || 'Erro ao executar prompt';
        this.addLog(`❌ Falha no ${item.title} (rep ${rep + 1}): ${item.errorMsg}`, 'error');
        this.addLog(`⏩ Prosseguindo para o próximo slide/prompt...`, 'info');

        // Auto-diagnóstico em tempo real por I.A se habilitado
        if (this.config.aiAutoHeal !== false && this.config.aiApiKey) {
          this.addLog('🤖 [I.A Auto-Diagnóstico] Analisando a causa do erro em tempo real...', 'info');
          try {
            const aiRes = await this.callAIDiagnostics(`O slide ${slideNum} falhou com o seguinte erro: "${err.message}". Identifique o que impediu o envio no DOM.`);
            if (aiRes.success) {
              this.addLog(`💡 [Diagnóstico I.A]: ${aiRes.analysis.substring(0, 250)}...`, 'info');
            }
          } catch (aiErr) { /* ignora */ }
        }

        this.saveState();
        return;
      }
    }

    if (item.completedRepeats >= targetRepeats) {
      item.status = 'completed';
      item.errorMsg = '';
      this.saveState();
    }
  }
}

  // =========================================================================
  // Inicialização e Exportação Global da Instância do Motor
  // =========================================================================
  if (typeof window !== 'undefined') {
    window.FlowMacroEngine = FlowMacroEngine;
    if (!window.flowMacroInstance) {
      window.flowMacroInstance = new FlowMacroEngine();
    }
  }
})();

var FlowMacroEngine = (typeof window !== 'undefined') ? window.FlowMacroEngine : undefined;
var flowMacroInstance = (typeof window !== 'undefined') ? window.flowMacroInstance : undefined;
