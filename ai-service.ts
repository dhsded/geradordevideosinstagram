import { GoogleGenAI } from "@google/genai";
import { keysManager } from "./keys-manager";
import { openrouterKeysManager } from "./openrouter-keys-manager";
import { groqKeysManager } from "./groq-keys-manager";
import { providersManager } from "./providers-manager";

export interface AIContentPart {
  text?: string;
  inlineData?: {
    data: string;
    mimeType: string;
  };
}

export interface AIGenerateOptions {
  prompt?: string;
  parts: AIContentPart[];
  responseSchema?: any;
  provider?: 'gemini' | 'openrouter' | 'groq';
  model?: string;
}

export interface AIAnalyzeOptions {
  prompt: string;
  videoData?: string;
  mimeType?: string;
  provider?: 'gemini' | 'openrouter' | 'groq';
  model?: string;
}

export interface AILogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'ai';
  category: string;
  message: string;
  elapsedSeconds?: number;
}

export interface AIGenerateResult {
  text: string;
  provider: 'gemini' | 'openrouter' | 'groq';
  model: string;
  failoverUsed?: boolean;
  originalProvider?: 'gemini' | 'openrouter' | 'groq';
  failoverReason?: string;
  elapsedMs?: number;
  logs?: AILogEntry[];
}

function maskKeyForLog(key: string): string {
  if (!key || key.length <= 10) return '***';
  return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
}

export class AIService {
  /**
   * Extrai texto de buffers PDF para alimentar qualquer LLM como texto de contexto
   */
  public async extractPdfText(base64Data: string): Promise<string> {
    try {
      const cleanBase64 = base64Data.includes("base64,") ? base64Data.split("base64,")[1] : base64Data;
      const buffer = Buffer.from(cleanBase64, 'base64');
      const pdfModule: any = await import("pdf-parse");

      // 1. Tentar como classe PDFParse (pdf-parse v2)
      const PDFParseClass = pdfModule.PDFParse || (pdfModule.default && pdfModule.default.PDFParse) || (typeof pdfModule.default === 'function' && pdfModule.default.prototype?.getText ? pdfModule.default : null) || pdfModule;
      if (PDFParseClass && typeof PDFParseClass === 'function') {
        try {
          const parser = new PDFParseClass({ data: new Uint8Array(buffer) });
          const result = await parser.getText();
          if (typeof parser.destroy === 'function') {
            await parser.destroy().catch(() => {});
          }
          if (result && result.text && result.text.trim()) {
            return result.text
              .replace(/-- \d+ of \d+ --/g, "")
              .replace(/\r\n/g, "\n")
              .trim();
          }
        } catch (v2Err: any) {
          console.warn('[AIService] Aviso PDFParse v2:', v2Err.message);
        }
      }

      // 2. Tentar como função direta (pdf-parse v1)
      const parseFn = typeof pdfModule === 'function' 
        ? pdfModule 
        : (typeof pdfModule.default === 'function' ? pdfModule.default : (pdfModule.pdf || pdfModule.default?.pdf));

      if (typeof parseFn === 'function') {
        const data = await parseFn(buffer);
        if (data && data.text && data.text.trim()) {
          return data.text.trim();
        }
      }

      // 3. Fallback de descompressão de streams FlateDecode com zlib
      try {
        const zlib = await import("zlib");
        const raw = buffer.toString("latin1");
        const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
        let streamMatch: RegExpExecArray | null;
        const extractedChunks: string[] = [];

        while ((streamMatch = streamRegex.exec(raw)) !== null) {
          const streamData = Buffer.from(streamMatch[1], "latin1");
          let decompressed: string = "";
          try {
            decompressed = zlib.inflateSync(streamData).toString("utf-8");
          } catch {
            try {
              decompressed = zlib.inflateRawSync(streamData).toString("utf-8");
            } catch {
              decompressed = streamData.toString("latin1");
            }
          }

          if (decompressed) {
            const tjRegex = /\(([^()]{1,800})\)\s*T[jJ]/g;
            let m: RegExpExecArray | null;
            while ((m = tjRegex.exec(decompressed)) !== null) {
              if (m[1]) extractedChunks.push(m[1]);
            }

            const tjArrayRegex = /\[([^\[\]]{1,1500})\]\s*TJ/g;
            while ((m = tjArrayRegex.exec(decompressed)) !== null) {
              const inner = m[1];
              const innerMatches = inner.match(/\(([^()]+)\)/g);
              if (innerMatches) {
                extractedChunks.push(innerMatches.map(im => im.slice(1, -1)).join(""));
              }
            }
          }
        }

        if (extractedChunks.length > 0) {
          const clean = extractedChunks
            .join(" ")
            .replace(/\\([0-9]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
            .replace(/\\[rnbtf]/g, " ")
            .replace(/\\/g, "")
            .replace(/\s+/g, " ")
            .trim();
          if (clean.length > 10) return clean;
        }
      } catch {}

      return '';
    } catch (err: any) {
      console.warn('[AIService] Aviso ao extrair texto do PDF:', err.message);
      return '';
    }
  }

  /**
   * Processa as partes de entrada e unifica a extração de PDFs para alimentar o prompt
   */
  private async processInputParts(parts: AIContentPart[]): Promise<{
    processedParts: AIContentPart[];
    extractedPdfContext: string;
  }> {
    const processedParts: AIContentPart[] = [];
    let extractedPdfContext = '';

    for (const part of parts) {
      if (part.text) {
        processedParts.push(part);
      } else if (part.inlineData) {
        if (part.inlineData.mimeType === 'application/pdf') {
          const pdfText = await this.extractPdfText(part.inlineData.data);
          if (pdfText) {
            extractedPdfContext += (extractedPdfContext ? '\n\n' : '') + 
              `=== CONTEÚDO EXTRAÍDO DO LIVRO / DOCUMENTO PDF ANEXADO ===\n${pdfText}\n=== FIM DO CONTEÚDO PDF ===`;
          }
          processedParts.push(part);
        } else {
          processedParts.push(part);
        }
      }
    }

    return { processedParts, extractedPdfContext };
  }

  /**
   * Ponto de entrada unificado para geração de conteúdo (Roteiros de Vídeo e Carrosséis)
   * Com alternância inteligente entre Gemini, Groq e OpenRouter caso as cotas se esgotem
   */
  public async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const activeProvider = options.provider || providersManager.getActiveProvider();
    const collectedLogs: AILogEntry[] = [];
    const tStart = Date.now();

    const addLocalLog = (level: 'info' | 'success' | 'warning' | 'error' | 'ai', category: string, message: string) => {
      const now = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      collectedLogs.push({
        timestamp: now,
        level,
        category,
        message,
        elapsedSeconds: Number(((Date.now() - tStart) / 1000).toFixed(1))
      });
    };

    // 1. Processar PDFs e extrair texto completo de contexto
    const { processedParts, extractedPdfContext } = await this.processInputParts(options.parts || []);

    // 2. Se houver texto extraído de PDF, injetar nas instruções de prompt
    const partsWithPdf: AIContentPart[] = [...processedParts];
    if (extractedPdfContext) {
      partsWithPdf.unshift({
        text: `INFORMAÇÃO IMPORTANTE - MATERIAL DE BASE:\n${extractedPdfContext}\n\nUse o material acima como referência e base para a criação do roteiro/carrossel conforme as instruções.`
      });
    }

    const execOptions = {
      ...options,
      parts: partsWithPdf
    };

    // --- ROTA 1: GROQ CLOUD ---
    if (activeProvider === 'groq') {
      try {
        addLocalLog('ai', 'GROQ', `Iniciando geração via Groq Cloud (${options.model || providersManager.getGroqModel()})...`);
        const result = await this.generateWithGroq(execOptions, addLocalLog);
        const totalElapsed = Date.now() - tStart;
        addLocalLog('success', 'GROQ', `Geração concluída com sucesso no Groq em ${(totalElapsed / 1000).toFixed(1)}s!`);
        return {
          ...result,
          elapsedMs: totalElapsed,
          logs: [...collectedLogs, ...(result.logs || [])]
        };
      } catch (groqErr: any) {
        const groqElapsed = ((Date.now() - tStart) / 1000).toFixed(1);
        addLocalLog('warning', 'FAILOVER', `Groq atingiu limite/erro (${groqElapsed}s: ${groqErr.message}). Tentando failover com Google Gemini...`);
        console.warn(`[Failover] Groq falhou (${groqErr.message}). Verificando Gemini...`);

        // Failover 1: Gemini
        const geminiKeyAvailable = keysManager.getActiveKey() || (process.env.GEMINI_API_KEY || '').trim();
        if (geminiKeyAvailable) {
          try {
            const tGeminiStart = Date.now();
            const geminiOptions: AIGenerateOptions = {
              ...execOptions,
              provider: 'gemini',
              model: providersManager.getConfig().gemini.preferredModel || 'gemini-2.5-flash'
            };
            addLocalLog('ai', 'GEMINI', `Solicitando geração via Google Gemini (${geminiOptions.model})...`);
            const geminiResult = await this.generateWithGemini(geminiOptions, addLocalLog);
            const geminiElapsed = ((Date.now() - tGeminiStart) / 1000).toFixed(1);
            addLocalLog('success', 'GEMINI', `Google Gemini respondeu com sucesso em ${geminiElapsed}s!`);
            
            const totalElapsed = Date.now() - tStart;
            return {
              ...geminiResult,
              failoverUsed: true,
              originalProvider: 'groq',
              failoverReason: `Groq congestionado (${groqElapsed}s). Geração concluída com sucesso via Google Gemini em ${geminiElapsed}s!`,
              elapsedMs: totalElapsed,
              logs: [...collectedLogs, ...(geminiResult.logs || [])]
            };
          } catch (gemErr: any) {
            addLocalLog('warning', 'FAILOVER', `Google Gemini também atingiu limite. Tentando OpenRouter...`);
          }
        }

        // Failover 2: OpenRouter
        const openrouterKeyAvailable = openrouterKeysManager.getActiveKey() || providersManager.getOpenRouterKey();
        if (openrouterKeyAvailable) {
          const openrouterOptions: AIGenerateOptions = {
            ...execOptions,
            provider: 'openrouter',
            model: providersManager.getOpenRouterModel() || 'minimax/minimax-m3:free'
          };
          const orResult = await this.generateWithOpenRouter(openrouterOptions, addLocalLog);
          const totalElapsed = Date.now() - tStart;
          return {
            ...orResult,
            failoverUsed: true,
            originalProvider: 'groq',
            failoverReason: `Groq e Gemini indisponíveis. Geração concluída via OpenRouter.`,
            elapsedMs: totalElapsed,
            logs: [...collectedLogs, ...(orResult.logs || [])]
          };
        }
        throw groqErr;
      }
    }

    // --- ROTA 2: OPENROUTER ---
    if (activeProvider === 'openrouter') {
      try {
        addLocalLog('ai', 'OPENROUTER', `Iniciando geração via OpenRouter (${options.model || 'modelo padrão'})...`);
        const result = await this.generateWithOpenRouter(execOptions, addLocalLog);
        const totalElapsed = Date.now() - tStart;
        addLocalLog('success', 'OPENROUTER', `Geração concluída com sucesso no OpenRouter em ${(totalElapsed / 1000).toFixed(1)}s!`);
        return {
          ...result,
          elapsedMs: totalElapsed,
          logs: [...collectedLogs, ...(result.logs || [])]
        };
      } catch (openrouterErr: any) {
        const orElapsed = ((Date.now() - tStart) / 1000).toFixed(1);
        addLocalLog('warning', 'FAILOVER', `OpenRouter atingiu limite/demora (${orElapsed}s: ${openrouterErr.message}). Alternando imediatamente para Groq ou Gemini...`);

        // Tentar Groq se houver chave
        const groqKeyAvailable = groqKeysManager.getActiveKey() || providersManager.getGroqKey();
        if (groqKeyAvailable) {
          try {
            const groqOptions: AIGenerateOptions = {
              ...execOptions,
              provider: 'groq',
              model: providersManager.getGroqModel() || 'llama-3.3-70b-versatile'
            };
            addLocalLog('ai', 'GROQ', `Tentando failover com Groq Cloud (${groqOptions.model})...`);
            const groqResult = await this.generateWithGroq(groqOptions, addLocalLog);
            const totalElapsed = Date.now() - tStart;
            return {
              ...groqResult,
              failoverUsed: true,
              originalProvider: 'openrouter',
              failoverReason: `OpenRouter falhou. Concluído com sucesso via Groq Cloud!`,
              elapsedMs: totalElapsed,
              logs: [...collectedLogs, ...(groqResult.logs || [])]
            };
          } catch (gErr: any) {
            console.warn('[Failover] Groq também falhou:', gErr.message);
          }
        }

        // Tentar Gemini
        const geminiKeyAvailable = keysManager.getActiveKey() || (process.env.GEMINI_API_KEY || '').trim();
        if (geminiKeyAvailable) {
          const tGeminiStart = Date.now();
          const geminiOptions: AIGenerateOptions = {
            ...execOptions,
            provider: 'gemini',
            model: providersManager.getConfig().gemini.preferredModel || 'gemini-2.5-flash'
          };
          addLocalLog('ai', 'GEMINI', `Solicitando geração via Google Gemini (${geminiOptions.model})...`);
          const geminiResult = await this.generateWithGemini(geminiOptions, addLocalLog);
          const geminiElapsed = ((Date.now() - tGeminiStart) / 1000).toFixed(1);
          addLocalLog('success', 'GEMINI', `Google Gemini respondeu com sucesso em ${geminiElapsed}s!`);
          
          const totalElapsed = Date.now() - tStart;
          return {
            ...geminiResult,
            failoverUsed: true,
            originalProvider: 'openrouter',
            failoverReason: `OpenRouter congestionado/indisponível (${orElapsed}s). Geração concluída com sucesso via Google Gemini em ${geminiElapsed}s!`,
            elapsedMs: totalElapsed,
            logs: [...collectedLogs, ...(geminiResult.logs || [])]
          };
        }
        throw openrouterErr;
      }
    }

    // --- ROTA 3: GEMINI (PADRÃO) ---
    try {
      addLocalLog('ai', 'GEMINI', `Iniciando geração via Google Gemini (${options.model || 'gemini-2.5-flash'})...`);
      const result = await this.generateWithGemini(execOptions, addLocalLog);
      const totalElapsed = Date.now() - tStart;
      addLocalLog('success', 'GEMINI', `Geração concluída com sucesso no Google Gemini em ${(totalElapsed / 1000).toFixed(1)}s!`);
      return {
        ...result,
        elapsedMs: totalElapsed,
        logs: [...collectedLogs, ...(result.logs || [])]
      };
    } catch (geminiErr: any) {
      addLocalLog('warning', 'FAILOVER', `Google Gemini atingiu limite (${geminiErr.message}). Tentando failover com Groq Cloud ou OpenRouter...`);
      
      // Tentar Groq primeiro
      const groqKeyAvailable = groqKeysManager.getActiveKey() || providersManager.getGroqKey();
      if (groqKeyAvailable) {
        try {
          const groqOptions: AIGenerateOptions = {
            ...execOptions,
            provider: 'groq',
            model: providersManager.getGroqModel() || 'llama-3.3-70b-versatile'
          };
          addLocalLog('ai', 'GROQ', `Tentando failover com Groq Cloud (${groqOptions.model})...`);
          const groqResult = await this.generateWithGroq(groqOptions, addLocalLog);
          const totalElapsed = Date.now() - tStart;
          return {
            ...groqResult,
            failoverUsed: true,
            originalProvider: 'gemini',
            failoverReason: `Chaves do Gemini atingiram limite. Geração concluída com sucesso via Groq Cloud!`,
            elapsedMs: totalElapsed,
            logs: [...collectedLogs, ...(groqResult.logs || [])]
          };
        } catch (gErr: any) {
          console.warn('[Failover] Groq falhou no failover do Gemini:', gErr.message);
        }
      }

      // Tentar OpenRouter
      const openrouterKeyAvailable = openrouterKeysManager.getActiveKey() || providersManager.getOpenRouterKey();
      if (openrouterKeyAvailable) {
        const openrouterOptions: AIGenerateOptions = {
          ...execOptions,
          provider: 'openrouter',
          model: providersManager.getOpenRouterModel() || 'minimax/minimax-m3:free'
        };
        const openrouterResult = await this.generateWithOpenRouter(openrouterOptions, addLocalLog);
        const totalElapsed = Date.now() - tStart;
        return {
          ...openrouterResult,
          failoverUsed: true,
          originalProvider: 'gemini',
          failoverReason: `Todas as chaves do Gemini atingiram o limite de cotas (${geminiErr.message})`,
          elapsedMs: totalElapsed,
          logs: [...collectedLogs, ...(openrouterResult.logs || [])]
        };
      }
      throw geminiErr;
    }
  }

  /**
   * Ponto de entrada unificado para análise de vídeos e posts
   */
  public async analyze(options: AIAnalyzeOptions): Promise<AIGenerateResult> {
    const activeProvider = options.provider || providersManager.getActiveProvider();
    const preferredModel = options.model || providersManager.getConfig().gemini.preferredModel || "gemini-2.5-flash";
    const parts: AIContentPart[] = [{ text: options.prompt }];

    if (options.videoData && options.mimeType) {
      parts.push({
        inlineData: {
          data: options.videoData,
          mimeType: options.mimeType
        }
      });
    }

    if (activeProvider === 'groq') {
      try {
        return await this.generateWithGroq({
          prompt: options.prompt,
          parts: [{ text: options.prompt }],
          model: options.model
        });
      } catch (groqErr: any) {
        const geminiKeyAvailable = keysManager.getActiveKey() || (process.env.GEMINI_API_KEY || '').trim();
        if (geminiKeyAvailable) {
          const geminiResult = await this.generateWithGemini({
            parts,
            model: preferredModel
          });
          return {
            ...geminiResult,
            failoverUsed: true,
            originalProvider: 'groq',
            failoverReason: `Cota do Groq esgotada (${groqErr.message})`
          };
        }
        throw groqErr;
      }
    }

    if (activeProvider === 'openrouter') {
      try {
        return await this.generateWithOpenRouter({
          prompt: options.prompt,
          parts: [{ text: options.prompt }],
          model: options.model
        });
      } catch (openrouterErr: any) {
        const geminiKeyAvailable = keysManager.getActiveKey() || (process.env.GEMINI_API_KEY || '').trim();
        if (geminiKeyAvailable) {
          const geminiResult = await this.generateWithGemini({
            parts,
            model: preferredModel
          });
          return {
            ...geminiResult,
            failoverUsed: true,
            originalProvider: 'openrouter',
            failoverReason: `Cota do OpenRouter esgotada (${openrouterErr.message})`
          };
        }
        throw openrouterErr;
      }
    }

    // Padrão Gemini
    try {
      return await this.generateWithGemini({
        parts,
        model: preferredModel
      });
    } catch (geminiErr: any) {
      const groqKeyAvailable = groqKeysManager.getActiveKey() || providersManager.getGroqKey();
      if (groqKeyAvailable) {
        const groqResult = await this.generateWithGroq({
          prompt: options.prompt,
          parts: [{ text: options.prompt }],
          model: providersManager.getGroqModel() || "llama-3.3-70b-versatile"
        });
        return {
          ...groqResult,
          failoverUsed: true,
          originalProvider: 'gemini',
          failoverReason: `Gemini esgotado. Análise concluída via Groq Cloud.`
        };
      }

      const openrouterKeyAvailable = providersManager.getOpenRouterKey();
      if (openrouterKeyAvailable) {
        const openrouterResult = await this.generateWithOpenRouter({
          prompt: options.prompt,
          parts: [{ text: options.prompt }],
          model: providersManager.getOpenRouterModel() || "minimax/minimax-m3:free"
        });
        return {
          ...openrouterResult,
          failoverUsed: true,
          originalProvider: 'gemini',
          failoverReason: `Todas as chaves Gemini esgotadas (${geminiErr.message})`
        };
      }
      throw geminiErr;
    }
  }

  /**
   * Executa a geração utilizando o Google Gemini com rotação de chaves no pool
   */
  private async generateWithGemini(
    options: AIGenerateOptions,
    logger?: (level: 'info' | 'success' | 'warning' | 'error' | 'ai', category: string, message: string) => void
  ): Promise<AIGenerateResult> {
    const preferredModel = options.model || providersManager.getConfig().gemini.preferredModel || "gemini-2.5-flash";
    const modelsToTry = [preferredModel];
    if (!modelsToTry.includes("gemini-2.5-flash")) modelsToTry.push("gemini-2.5-flash");
    if (!modelsToTry.includes("gemini-3.6-flash")) modelsToTry.push("gemini-3.6-flash");

    let currentModelIndex = 0;
    const triedKeys = new Set<string>();

    while (true) {
      let activeKey = keysManager.getActiveKey();
      let isFallback = false;

      if (!activeKey) {
        activeKey = (process.env.GEMINI_API_KEY || "").trim();
        isFallback = true;
      }

      if (!activeKey) {
        throw new Error("Nenhuma chave Gemini disponível. Por favor, adicione suas chaves no Gerenciador de Chaves ou configure a variável GEMINI_API_KEY no arquivo .env.");
      }

      if (triedKeys.has(activeKey)) {
        throw new Error("Todas as chaves do Gemini cadastradas atingiram o limite temporário ou esgotamento de cotas.");
      }

      triedKeys.add(activeKey);

      const maskedKey = maskKeyForLog(activeKey);
      const ai = new GoogleGenAI({ apiKey: activeKey });
      let currentModel = modelsToTry[currentModelIndex];

      if (logger) logger('ai', 'GEMINI', `Tentando modelo ${currentModel} com a chave ${maskedKey}...`);
      console.log(`[Gemini] Tentando com a chave ${maskedKey} no modelo ${currentModel}...`);

      const config: any = {
        temperature: 0.7,
      };

      if (options.responseSchema) {
        config.responseMimeType = "application/json";
        config.responseSchema = options.responseSchema;
      }

      const contents = options.parts.map(p => {
        if (p.text) return { text: p.text };
        if (p.inlineData) return { inlineData: p.inlineData };
        return { text: "" };
      });

      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: contents,
          config: config
        });

        const text = response.text || "";
        if (!text) {
          throw new Error("Gemini retornou resposta vazia.");
        }

        if (logger) logger('success', 'GEMINI', `Modelo ${currentModel} gerou conteúdo com sucesso!`);
        keysManager.recordSuccess(activeKey);

        return {
          text,
          provider: 'gemini',
          model: currentModel
        };
      } catch (err: any) {
        const errorMessage = err.message || "";
        const isQuotaError = 
          errorMessage.includes("429") || 
          errorMessage.includes("RESOURCE_EXHAUSTED") || 
          errorMessage.includes("quota") ||
          errorMessage.includes("rate limit") ||
          errorMessage.includes("limit exceeded");

        const isInvalidKey = 
          errorMessage.includes("API_KEY_INVALID") || 
          errorMessage.includes("invalid API key") ||
          errorMessage.includes("API key not valid");

        const isModelNotFoundError = 
          errorMessage.includes("404") || 
          errorMessage.includes("NOT_FOUND") || 
          errorMessage.includes("models/");

        console.warn(`[Gemini] Erro na chave ${maskedKey} (${currentModel}):`, errorMessage);

        if (isModelNotFoundError && currentModelIndex < modelsToTry.length - 1) {
          currentModelIndex++;
          triedKeys.delete(activeKey);
          if (logger) logger('warning', 'GEMINI', `Modelo ${currentModel} indisponível. Alternando para ${modelsToTry[currentModelIndex]}...`);
          continue;
        }

        if (isQuotaError || isInvalidKey) {
          const reason = isInvalidKey ? 'Chave de API Inválida' : 'Cota Diária/Minuto Esgotada (429)';
          keysManager.markExhausted(activeKey, reason);
          if (logger) logger('warning', 'GEMINI', `Chave ${maskedKey} esgotada/inválida. Rotacionando para próxima chave do pool...`);
          if (isFallback) {
            throw new Error(`A chave principal do Gemini atingiu o limite ou é inválida: ${errorMessage}`);
          }
          continue;
        }

        keysManager.recordError(activeKey, errorMessage);
        if (isFallback) {
          throw err;
        }
        continue;
      }
    }
  }

  /**
   * Executa a geração utilizando o Groq Cloud (LPU ultra rápida e modelos Llama 3.3 / Gemma / Mixtral)
   */
  private async generateWithGroq(
    options: AIGenerateOptions,
    logger?: (level: 'info' | 'success' | 'warning' | 'error' | 'ai', category: string, message: string) => void
  ): Promise<AIGenerateResult> {
    const triedKeys = new Set<string>();
    const baseUrl = providersManager.getGroqBaseUrl();
    const configuredModel = providersManager.getGroqModel();
    const primaryModel = options.model || configuredModel || "llama-3.3-70b-versatile";

    const modelsToTry = [
      primaryModel,
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
      "mixtral-8x7b-32768"
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let schemaInstruction = "";
    if (options.responseSchema) {
      schemaInstruction = `\n\nESQUEMA JSON ESTRITO OBRIGATÓRIO (Responda APENAS com um objeto JSON válido estritamente aderente a esta estrutura, sem blocos de texto antes ou depois):\n${JSON.stringify(options.responseSchema, null, 2)}`;
    }

    const systemMessage = {
      role: "system",
      content: `Você é um roteirista premiado, diretor criativo e especialista em Instagram de altíssimo engajamento. Responda ESTRITAMENTE em formato JSON válido e parseável, sem qualquer texto fora do JSON.${schemaInstruction}`
    };

    let combinedText = "";
    for (const p of options.parts || []) {
      if (p.text) {
        combinedText += (combinedText ? "\n\n" : "") + p.text;
      }
    }

    const userMessage = {
      role: "user",
      content: combinedText + "\n\nIMPORTANTE: Retorne APENAS o JSON válido."
    };

    while (true) {
      let activeKey = groqKeysManager.getActiveKey();
      let isFallback = false;

      if (!activeKey) {
        activeKey = providersManager.getGroqKey();
        isFallback = true;
      }

      if (!activeKey) {
        throw new Error("Nenhuma chave Groq Cloud configurada. Por favor, adicione suas chaves Groq (gsk_...) no Menu de I.As ou no arquivo .env.");
      }

      if (triedKeys.has(activeKey)) {
        throw new Error("Todas as chaves do Groq cadastradas atingiram o limite temporário ou esgotamento de cotas.");
      }

      triedKeys.add(activeKey);

      const maskedKey = maskKeyForLog(activeKey);
      let success = false;
      let keyIsExhaustedOrInvalid = false;
      let exhaustionReason = '';
      let resultText = '';
      let usedModel = primaryModel;
      let lastError: any = null;

      for (const currentModel of modelsToTry) {
        const t0 = Date.now();
        if (logger) logger('ai', 'GROQ', `Tentando modelo ${currentModel} (chave ${maskedKey})...`);
        console.log(`[Groq] Solicitando modelo ${currentModel} com chave ${maskedKey}...`);

        try {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${activeKey}`
            },
            signal: AbortSignal.timeout(15000),
            body: JSON.stringify({
              model: currentModel,
              messages: [systemMessage, userMessage],
              temperature: 0.7,
              response_format: { type: "json_object" }
            })
          });

          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          const headers = response.headers;

          // Atualizar contadores de taxa com os headers retornados pelo Groq
          const reqRemaining = headers.get('x-ratelimit-remaining-requests') ? parseInt(headers.get('x-ratelimit-remaining-requests')!, 10) : undefined;
          const tokRemaining = headers.get('x-ratelimit-remaining-tokens') ? parseInt(headers.get('x-ratelimit-remaining-tokens')!, 10) : undefined;

          if (!response.ok) {
            const errText = await response.text();
            let errJson: any = null;
            try { errJson = JSON.parse(errText); } catch {}
            const errMsg = errJson?.error?.message || errText || `HTTP ${response.status}`;

            console.warn(`[Groq] Erro no modelo ${currentModel} (${response.status}, ${elapsed}s) com chave ${maskedKey}:`, errMsg);

            if (response.status === 401 || errMsg.toLowerCase().includes("invalid api key") || errMsg.toLowerCase().includes("unauthorized")) {
              keyIsExhaustedOrInvalid = true;
              exhaustionReason = `Chave Groq inválida (${response.status}): ${errMsg}`;
              if (logger) logger('warning', 'GROQ', `Chave ${maskedKey} inválida (${response.status}).`);
              break;
            }

            if (response.status === 429 || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("quota")) {
              if (logger) logger('warning', 'GROQ', `Chave ${maskedKey} atingiu Rate Limit no Groq (${response.status}, ${elapsed}s). Rotacionando chave...`);
              keyIsExhaustedOrInvalid = true;
              exhaustionReason = `Rate limit (429): ${errMsg}`;
              break;
            }

            if (logger) logger('warning', 'GROQ', `Modelo ${currentModel} retornou erro (${response.status}, ${elapsed}s).`);
            lastError = new Error(`Groq ${currentModel}: ${errMsg}`);
            continue;
          }

          const data: any = await response.json();
          const rawContent = data?.choices?.[0]?.message?.content;
          if (!rawContent) {
            throw new Error(`Groq retornou resposta vazia no modelo ${currentModel}.`);
          }

          let cleanText = rawContent.trim();
          if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          try {
            JSON.parse(cleanText);
          } catch (parseErr) {
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cleanText = jsonMatch[0];
              JSON.parse(cleanText);
            } else {
              throw new Error(`Modelo ${currentModel} no Groq não retornou um JSON válido: ${cleanText.substring(0, 100)}...`);
            }
          }

          console.log(`[Groq] Geração concluída com sucesso usando modelo ${currentModel} (${elapsed}s, chave ${maskedKey})!`);
          if (logger) logger('success', 'GROQ', `Modelo ${currentModel} respondeu com sucesso em ${elapsed}s!`);
          resultText = cleanText;
          usedModel = currentModel;
          success = true;
          break;
        } catch (err: any) {
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          lastError = err;
          if (err.message?.includes("Chave Groq inválida") || err.message?.includes("Rate limit")) {
            keyIsExhaustedOrInvalid = true;
            exhaustionReason = err.message;
            break;
          }
          if (err.name === 'TimeoutError' || err.message?.includes('aborted')) {
            if (logger) logger('warning', 'GROQ', `Modelo ${currentModel} demorou mais de 15s no Groq.`);
          } else {
            if (logger) logger('warning', 'GROQ', `Falha no modelo ${currentModel} (${elapsed}s): ${err.message}`);
          }
          console.warn(`[Groq] Falha no modelo ${currentModel}:`, err.message);
        }
      }

      if (success) {
        groqKeysManager.recordSuccess(activeKey);
        return { 
          text: resultText,
          provider: 'groq',
          model: usedModel
        };
      } else {
        if (keyIsExhaustedOrInvalid) {
          groqKeysManager.markExhausted(activeKey, exhaustionReason);
        } else {
          groqKeysManager.recordError(activeKey);
        }
        if (isFallback) {
          throw lastError || new Error("Groq falhou.");
        }
        continue;
      }
    }
  }

  /**
   * Executa a geração utilizando o gateway OpenRouter
   */
  private async generateWithOpenRouter(
    options: AIGenerateOptions,
    logger?: (level: 'info' | 'success' | 'warning' | 'error' | 'ai', category: string, message: string) => void
  ): Promise<AIGenerateResult> {
    const triedKeys = new Set<string>();
    const baseUrl = providersManager.getOpenRouterBaseUrl();
    const configuredModel = providersManager.getOpenRouterModel();
    const primaryModel = options.model || configuredModel || "minimax/minimax-m3:free";

    const hasImages = (options.parts || []).some(p => p.inlineData?.mimeType?.startsWith('image/'));

    const visionModels = [
      "google/gemini-2.0-flash-exp:free",
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.2-11b-vision-instruct:free",
      "qwen/qwen-2-vl-72b-instruct:free"
    ];

    const textModels = [
      primaryModel,
      "minimax/minimax-m3:free",
      "google/gemma-4-26b-a4b-it:free",
      "nvidia/nemotron-3-super-120b-a12b:free",
      "liquid/lfm-2.5-2.6b:free"
    ];

    const modelsToTry = (hasImages
      ? [...new Set([primaryModel, ...visionModels])]
      : [...new Set([primaryModel, ...textModels])]).slice(0, 3);

    let schemaInstruction = "";
    if (options.responseSchema) {
      schemaInstruction = `\n\nESQUEMA JSON ESTRITO OBRIGATÓRIO (Responda APENAS com um objeto JSON válido estritamente aderente a esta estrutura, sem blocos de texto antes ou depois):\n${JSON.stringify(options.responseSchema, null, 2)}`;
    }

    const systemMessage = {
      role: "system",
      content: `Você é um roteirista premiado, diretor criativo e especialista em Instagram. Responda ESTRITAMENTE em formato JSON válido e parseável, sem qualquer texto fora do JSON.${schemaInstruction}`
    };

    const userContentArray: any[] = [];
    let combinedText = "";

    for (const p of options.parts || []) {
      if (p.text) {
        combinedText += (combinedText ? "\n\n" : "") + p.text;
      } else if (p.inlineData) {
        if (p.inlineData.mimeType?.startsWith('image/')) {
          userContentArray.push({
            type: "image_url",
            image_url: {
              url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`
            }
          });
        }
      }
    }

    if (combinedText) {
      userContentArray.unshift({
        type: "text",
        text: combinedText + "\n\nIMPORTANTE: Retorne APENAS o JSON válido."
      });
    }

    const userMessage = {
      role: "user",
      content: userContentArray.length === 1 && userContentArray[0].type === "text"
        ? userContentArray[0].text
        : userContentArray
    };

    while (true) {
      let activeKey = openrouterKeysManager.getActiveKey();
      let isFallback = false;

      if (!activeKey) {
        activeKey = providersManager.getOpenRouterKey();
        isFallback = true;
      }

      if (!activeKey) {
        throw new Error("Nenhuma chave OpenRouter configurada. Por favor, adicione suas chaves OpenRouter (sk-or-v1-...) no Menu de I.As ou no arquivo .env.");
      }

      if (triedKeys.has(activeKey)) {
        throw new Error("Todas as chaves do OpenRouter cadastradas atingiram o limite temporário ou esgotamento de cotas.");
      }

      triedKeys.add(activeKey);

      const maskedKey = maskKeyForLog(activeKey);
      let success = false;
      let keyIsExhaustedOrInvalid = false;
      let exhaustionReason = '';
      let resultText = '';
      let usedModel = primaryModel;
      let lastError: any = null;

      for (const currentModel of modelsToTry) {
        const t0 = Date.now();
        if (logger) logger('ai', 'OPENROUTER', `Tentando modelo ${currentModel} (chave ${maskedKey})...`);
        console.log(`[OpenRouter] Solicitando modelo ${currentModel} com chave ${maskedKey}...`);

        try {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${activeKey}`,
              "HTTP-Referer": "https://postforge.app",
              "X-Title": "PostForge"
            },
            signal: AbortSignal.timeout(6000),
            body: JSON.stringify({
              model: currentModel,
              messages: [systemMessage, userMessage],
              temperature: 0.7,
            })
          });

          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

          if (!response.ok) {
            const errText = await response.text();
            let errJson: any = null;
            try { errJson = JSON.parse(errText); } catch {}
            const errMsg = errJson?.error?.message || errText || `HTTP ${response.status}`;

            console.warn(`[OpenRouter] Erro no modelo ${currentModel} (${response.status}, ${elapsed}s) com chave ${maskedKey}:`, errMsg);

            if (response.status === 401 || response.status === 403 || errMsg.toLowerCase().includes("invalid api key") || errMsg.toLowerCase().includes("user not found")) {
              keyIsExhaustedOrInvalid = true;
              exhaustionReason = `Chave inválida (${response.status}): ${errMsg}`;
              if (logger) logger('warning', 'OPENROUTER', `Chave ${maskedKey} inválida (${response.status}).`);
              break;
            }

            if (response.status === 402 || errMsg.toLowerCase().includes("insufficient") || errMsg.toLowerCase().includes("credit")) {
              keyIsExhaustedOrInvalid = true;
              exhaustionReason = `Crédito insuficiente (${response.status}): ${errMsg}`;
              if (logger) logger('warning', 'OPENROUTER', `Chave ${maskedKey} sem créditos suficientes (${response.status}).`);
              break;
            }

            if (response.status === 429 || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("quota")) {
              if (logger) logger('warning', 'OPENROUTER', `Modelo ${currentModel} em rate limit (${response.status}, ${elapsed}s).`);
              continue;
            }

            if (logger) logger('warning', 'OPENROUTER', `Modelo ${currentModel} retornou erro (${response.status}, ${elapsed}s).`);
            lastError = new Error(`OpenRouter ${currentModel}: ${errMsg}`);
            continue;
          }

          const data: any = await response.json();
          const rawContent = data?.choices?.[0]?.message?.content;
          if (!rawContent) {
            throw new Error(`OpenRouter retornou resposta vazia no modelo ${currentModel}.`);
          }

          let cleanText = rawContent.trim();
          if (cleanText.startsWith('```json')) {
            cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
          } else if (cleanText.startsWith('```')) {
            cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
          }

          try {
            JSON.parse(cleanText);
          } catch (parseErr) {
            const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              cleanText = jsonMatch[0];
              JSON.parse(cleanText);
            } else {
              throw new Error(`Modelo ${currentModel} não retornou um JSON válido: ${cleanText.substring(0, 100)}...`);
            }
          }

          console.log(`[OpenRouter] Geração concluída com sucesso usando modelo ${currentModel} (${elapsed}s, chave ${maskedKey})!`);
          if (logger) logger('success', 'OPENROUTER', `Modelo ${currentModel} respondeu com sucesso em ${elapsed}s!`);
          resultText = cleanText;
          usedModel = currentModel;
          success = true;
          break;
        } catch (err: any) {
          const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
          lastError = err;
          if (err.message?.includes("Chave inválida") || err.message?.includes("Crédito insuficiente")) {
            keyIsExhaustedOrInvalid = true;
            exhaustionReason = err.message;
            break;
          }
          if (err.name === 'TimeoutError' || err.message?.includes('aborted')) {
            if (logger) logger('warning', 'OPENROUTER', `Modelo ${currentModel} demorou mais de 6s (tempo limite esgotado).`);
          } else {
            if (logger) logger('warning', 'OPENROUTER', `Falha no modelo ${currentModel} (${elapsed}s): ${err.message}`);
          }
          console.warn(`[OpenRouter] Falha no modelo ${currentModel}:`, err.message);
        }
      }

      if (success) {
        openrouterKeysManager.recordSuccess(activeKey);
        return { 
          text: resultText,
          provider: 'openrouter',
          model: usedModel
        };
      } else {
        if (keyIsExhaustedOrInvalid) {
          openrouterKeysManager.markExhausted(activeKey, exhaustionReason);
        } else {
          openrouterKeysManager.recordError(activeKey);
        }
        if (isFallback) {
          throw lastError || new Error("OpenRouter falhou.");
        }
        continue;
      }
    }
  }
}

export const aiService = new AIService();
