import { GoogleGenAI } from "@google/genai";
import { keysManager } from "./keys-manager";
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

export interface AIGenerateResult {
  text: string;
  provider: 'gemini' | 'openrouter';
  model: string;
  failoverUsed?: boolean;
  originalProvider?: 'gemini' | 'openrouter';
  failoverReason?: string;
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
   * Com alternância bidirecional inteligente entre Gemini e OpenRouter caso as cotas se esgotem
   */
  public async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const activeProvider = options.provider || providersManager.getActiveProvider();

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
        return await this.generateWithOpenRouter(execOptions);
      } catch (openrouterErr: any) {
        console.warn(`[Failover] Falha no OpenRouter (${openrouterErr.message}). Verificando disponibilidade do Gemini para failover...`);
        const geminiKeyAvailable = keysManager.getActiveKey() || (process.env.GEMINI_API_KEY || '').trim();
        if (geminiKeyAvailable) {
          console.log(`[Failover Bidirecional] 🔄 Alternando automaticamente para Gemini após esgotamento do OpenRouter...`);
          const geminiResult = await this.generateWithGemini(execOptions);
          return {
            ...geminiResult,
            failoverUsed: true,
            originalProvider: 'openrouter',
            failoverReason: `Cota do OpenRouter esgotada / modelos ocupados (${openrouterErr.message})`
          };
        }
        throw openrouterErr;
      }
    } else {
      try {
        return await this.generateWithGemini(execOptions);
      } catch (geminiErr: any) {
        console.warn(`[Failover] Falha no Gemini (${geminiErr.message}). Verificando disponibilidade do OpenRouter para failover...`);
        const openrouterKeyAvailable = providersManager.getOpenRouterKey();
        if (openrouterKeyAvailable) {
          console.log(`[Failover Bidirecional] 🔄 Alternando automaticamente para OpenRouter após esgotamento de todas as chaves do Gemini...`);
          const openrouterResult = await this.generateWithOpenRouter(execOptions);
          return {
            ...openrouterResult,
            failoverUsed: true,
            originalProvider: 'gemini',
            failoverReason: `Todas as cotas de chaves do Gemini foram esgotadas (${geminiErr.message})`
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
            model: options.model
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
  private async generateWithGemini(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const preferredModel = options.model || providersManager.getConfig().gemini.preferredModel || "gemini-2.5-flash";
    const triedKeys = new Set<string>();

    const modelsToTry = [...new Set([
      preferredModel,
      "gemini-2.5-flash",
      "gemini-3.6-flash",
      "gemini-3.7-flash",
      "gemini-3.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-flash-latest",
      "gemini-2.5-pro"
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
        let modelUnavailable = false;

        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            console.log(`[Gemini] Tentando modelo ${currentModel} com chave ${maskedKey}...`);
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
              break;
            } else {
              throw new Error("Resposta do Gemini sem texto.");
            }
          } catch (error: any) {
            const errorMsg = error.message || error.toString();
            const errorCode = error.status || error.code;
            console.warn(`[Gemini] Erro no modelo ${currentModel} usando chave ${maskedKey}:`, errorMsg);

            if (errorMsg.includes("404") || errorMsg.includes("NOT_FOUND") || errorMsg.includes("is not found") || errorMsg.includes("no longer available")) {
              modelUnavailable = true;
              break;
            }

            if (
              errorCode === 429 ||
              errorMsg.includes("429") ||
              errorMsg.includes("RESOURCE_EXHAUSTED") ||
              errorMsg.includes("quota") ||
              errorMsg.includes("rate limit")
            ) {
              keyIsExhaustedOrInvalid = true;
              break;
            }

            if (
              errorCode === 400 && (
                errorMsg.includes("API_KEY_INVALID") ||
                errorMsg.includes("API key not valid") ||
                errorMsg.includes("key expired")
              ) ||
              errorCode === 401 ||
              errorCode === 403
            ) {
              keyIsExhaustedOrInvalid = true;
              break;
            }

            if (errorCode === 503 || errorMsg.includes("503") || errorMsg.includes("high demand") || errorMsg.includes("UNAVAILABLE")) {
              if (attempt < 2) {
                await new Promise(r => setTimeout(r, 1000));
                continue;
              }
              break;
            }

            break;
          }
        }

        if (success || keyIsExhaustedOrInvalid) {
          break;
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
   * Execução através do OpenRouter API compatível com OpenAI, com suporte a chave universal
   */
  private async generateWithOpenRouter(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const apiKey = providersManager.getOpenRouterKey();
    if (!apiKey) {
      throw new Error("Chave do OpenRouter não configurada. Por favor, cole sua chave OpenRouter (sk-or-v1-...) no Menu de I.As ou no arquivo .env.");
    }

    const baseUrl = providersManager.getOpenRouterBaseUrl();
    const configuredModel = providersManager.getOpenRouterModel();
    const primaryModel = options.model || configuredModel || "minimax/minimax-m3:free";

    // Lista de modelos gratuitos com foco em alta capacidade e escrita
    const modelsToTry = [...new Set([
      primaryModel,
      "minimax/minimax-m3:free",
      "google/gemma-4-26b-a4b-it:free",
      "nvidia/nemotron-3-ultra-550b-a55b:free",
      "nvidia/nemotron-3.5-lightning:free",
      "nvidia/nemotron-3-super:free",
      "meta-llama/llama-3.3-70b-instruct:free",
      "deepseek/deepseek-r1:free",
      "google/gemini-2.0-flash-exp:free",
      "qwen/qwen-2.5-coder-32b-instruct:free"
    ])];

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

    let lastError: any = null;

    for (const currentModel of modelsToTry) {
      console.log(`[OpenRouter] Solicitando geração com modelo: ${currentModel}...`);

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const response = await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "HTTP-Referer": "https://postforge.app",
              "X-Title": "PostForge"
            },
            body: JSON.stringify({
              model: currentModel,
              messages: [systemMessage, userMessage],
              response_format: { type: "json_object" },
              temperature: 0.7,
            })
          });

          if (!response.ok) {
            const errText = await response.text();
            let errJson: any = null;
            try { errJson = JSON.parse(errText); } catch {}
            const errMsg = errJson?.error?.message || errText || `HTTP ${response.status}`;

            console.warn(`[OpenRouter] Erro no modelo ${currentModel} (${response.status}):`, errMsg);

            if (response.status === 401 || response.status === 403 || errMsg.toLowerCase().includes("invalid api key")) {
              throw new Error(`Chave do OpenRouter inválida ou não autorizada (${response.status}): ${errMsg}`);
            }

            lastError = new Error(`OpenRouter ${currentModel}: ${errMsg}`);
            break; // modelo ocupado ou sem cota, tentar próximo modelo da lista
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

          console.log(`[OpenRouter] Geração concluída com sucesso usando modelo ${currentModel}!`);
          return { 
            text: cleanText,
            provider: 'openrouter',
            model: currentModel
          };
        } catch (err: any) {
          lastError = err;
          if (err.message?.includes("Chave do OpenRouter inválida")) {
            throw err;
          }
          console.warn(`[OpenRouter] Falha na tentativa ${attempt + 1} do modelo ${currentModel}:`, err.message);
          if (attempt === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }
    }

    throw lastError || new Error("Falha ao gerar conteúdo com todos os modelos OpenRouter disponíveis.");
  }
}

export const aiService = new AIService();
