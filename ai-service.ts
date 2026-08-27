import { GoogleGenAI } from "@google/genai";
import { keysManager } from "./keys-manager";
import { openrouterKeysManager } from "./openrouter-keys-manager";
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
  provider?: 'gemini' | 'openrouter';
  model?: string;
}

export interface AIAnalyzeOptions {
  prompt: string;
  videoData?: string;
  mimeType?: string;
  provider?: 'gemini' | 'openrouter';
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
  provider: 'gemini' | 'openrouter';
  model: string;
  failoverUsed?: boolean;
  originalProvider?: 'gemini' | 'openrouter';
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
          // Mantém a parte inline para o Gemini poder ler nativamente caso deseje
          processedParts.push(part);
        } else {
          // Imagens de personagens, estilo ou contexto
          processedParts.push(part);
        }
      }
    }

    return { processedParts, extractedPdfContext };
  }

  /**
   * Ponto de entrada unificado para geração de conteúdo (Roteiros de Vídeo e Carrosséis)
   * Com alternância bidirecional inteligente entre Gemini e OpenRouter caso todas as cotas se esgotem
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
        addLocalLog('warning', 'FAILOVER', `OpenRouter atingiu limite/demora (${orElapsed}s: ${openrouterErr.message}). Alternando imediatamente para Google Gemini...`);
        console.warn(`[Failover] OpenRouter falhou (${openrouterErr.message}). Verificando Gemini...`);

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
    } else {
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
        addLocalLog('warning', 'FAILOVER', `Google Gemini atingiu limite (${geminiErr.message}). Tentando failover com OpenRouter...`);
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
  }

  /**
   * Ponto de entrada unificado para análise de vídeos e posts
   * Com alternância bidirecional inteligente em caso de esgotamento de cotas
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

    if (activeProvider === 'openrouter') {
      try {
        return await this.generateWithOpenRouter({
          prompt: options.prompt,
          parts: [{ text: options.prompt }],
          model: options.model
        });
      } catch (openrouterErr: any) {
        console.warn(`[Failover Análise] Falha no OpenRouter (${openrouterErr.message}). Tentando failover com Gemini...`);
        const geminiKeyAvailable = keysManager.getActiveKey() || (process.env.GEMINI_API_KEY || '').trim();
        if (geminiKeyAvailable) {
          const geminiResult = await this.generateWithGemini({
            parts,
            model: providersManager.getConfig().gemini.preferredModel || "gemini-2.5-flash"
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
    } else {
      try {
        return await this.generateWithGemini({
          parts,
          model: preferredModel
        });
      } catch (geminiErr: any) {
        console.warn(`[Failover Análise] Falha no Gemini (${geminiErr.message}). Tentando failover com OpenRouter...`);
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
            failoverReason: `Cotas do Gemini esgotadas (${geminiErr.message})`
          };
        }
        throw geminiErr;
      }
    }
  }

  /**
   * Execução através do Google Gemini SDK com rotação automática de chaves gratuitas
   */
  private async generateWithGemini(options: AIGenerateOptions, logger?: (level: any, cat: string, msg: string) => void): Promise<AIGenerateResult> {
    const configModel = providersManager.getConfig().gemini.preferredModel || "gemini-2.5-flash";
    const requestedModel = (options.model && !options.model.includes('/')) ? options.model : configModel;
    const preferredModel = requestedModel || "gemini-2.5-flash";
    const triedKeys = new Set<string>();

    const modelsToTry = [...new Set([
      preferredModel,
      "gemini-2.5-flash",
      "gemini-3.6-flash",
      "gemini-3.5-flash-lite",
      "gemini-3.1-pro-preview"
    ])];

    while (true) {
      let activeKey = keysManager.getActiveKey();
      let isFallback = false;

      if (!activeKey) {
        activeKey = (process.env.GEMINI_API_KEY || '').trim();
        isFallback = true;
      }

      if (!activeKey) {
        throw new Error("Nenhuma chave Gemini disponível. Por favor, adicione chaves no Menu de I.As ou no arquivo .env.");
      }

      if (!isFallback && triedKeys.has(activeKey)) {
        throw new Error("Todas as chaves rotativas do Gemini configuradas foram testadas e atingiram o limite temporário (429/cota). Tente usar o OpenRouter ou adicione novas chaves.");
      }

      if (!isFallback) {
        triedKeys.add(activeKey);
      }

      const maskedKey = maskKeyForLog(activeKey);
      let success = false;
      let keyIsExhaustedOrInvalid = false;
      let resultText = '';
      let usedModel = preferredModel;

      for (const currentModel of modelsToTry) {
        try {
          const t0 = Date.now();
          if (logger) logger('ai', 'GEMINI', `Consultando modelo ${currentModel} (chave ${maskedKey})...`);
          const ai = new GoogleGenAI({ apiKey: activeKey });
          
          const response = await ai.models.generateContent({
            model: currentModel,
            contents: { parts: options.parts },
            config: {
              responseMimeType: "application/json",
              responseSchema: options.responseSchema,
            }
          });

          if (response && response.text) {
            resultText = response.text;
            usedModel = currentModel;
            success = true;
            const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
            if (logger) logger('success', 'GEMINI', `Modelo ${currentModel} respondeu com sucesso em ${elapsed}s!`);
            break;
          } else {
            throw new Error("Resposta do Gemini sem texto.");
          }
        } catch (error: any) {
          const errorMsg = error.message || error.toString();
          const errorCode = error.status || error.code;
          console.warn(`[Gemini] Erro no modelo ${currentModel} usando chave ${maskedKey}:`, errorMsg);

          if (errorMsg.includes("404") || errorMsg.includes("NOT_FOUND") || errorMsg.includes("is not found") || errorMsg.includes("no longer available")) {
            continue; // Pular diretamente para o próximo modelo válido
          }

          if (
            errorCode === 429 ||
            errorMsg.includes("429") ||
            errorMsg.includes("RESOURCE_EXHAUSTED") ||
            errorMsg.includes("quota") ||
            errorMsg.includes("rate limit")
          ) {
            keyIsExhaustedOrInvalid = true;
            if (logger) logger('warning', 'GEMINI', `Chave ${maskedKey} atingiu limite de cota (429). Rotacionando para próxima chave...`);
            break;
          }

          if (
            (errorCode === 400 && (
              errorMsg.includes("API_KEY_INVALID") ||
              errorMsg.includes("API key not valid") ||
              errorMsg.includes("key expired")
            )) ||
            errorCode === 401 ||
            errorCode === 403
          ) {
            keyIsExhaustedOrInvalid = true;
            if (logger) logger('warning', 'GEMINI', `Chave ${maskedKey} inválida ou expirada. Rotacionando para próxima chave...`);
            break;
          }
        }
      }

      if (success) {
        if (!isFallback) {
          keysManager.recordSuccess(activeKey);
        }
        return {
          text: resultText,
          provider: 'gemini',
          model: usedModel
        };
      } else {
        if (!isFallback && keyIsExhaustedOrInvalid) {
          keysManager.markExhausted(activeKey);
        } else if (!isFallback) {
          keysManager.recordError(activeKey);
        }
        continue;
      }
    }
  }

  /**
   * Execução através do OpenRouter API compatível com OpenAI, com suporte a pool rotativo de múltiplas chaves
   */
  private async generateWithOpenRouter(options: AIGenerateOptions, logger?: (level: any, cat: string, msg: string) => void): Promise<AIGenerateResult> {
    const triedKeys = new Set<string>();
    const baseUrl = providersManager.getOpenRouterBaseUrl();
    const configuredModel = providersManager.getOpenRouterModel();
    const primaryModel = options.model || configuredModel || "minimax/minimax-m3:free";

    const hasImages = (options.parts || []).some(p => p.inlineData?.mimeType?.startsWith('image/'));

    // Modelos de alta taxa de sucesso no OpenRouter
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

      // Prevenir loop infinito: se a chave (pool ou fallback) já foi tentada, encerrar
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
            signal: AbortSignal.timeout(6000), // Timeout rápido de 6s para failover instantâneo
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
