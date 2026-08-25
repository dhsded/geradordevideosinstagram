import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { keysManager } from "./keys-manager";
import { providersManager } from "./providers-manager";

dotenv.config();

// Helper para mascarar chaves nos logs
function maskKeyForLog(key: string): string {
  if (!key || key.length <= 10) return '***';
  return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
}

// Helper principal para geração com ROTAÇÃO e RESILIÊNCIA de chaves
async function executeWithKeyRotation(preferredModel: string, args: any) {
  const triedKeys = new Set<string>();
  
  while (true) {
    // 1. Obter a próxima chave ativa disponível
    let activeKey = keysManager.getActiveKey();
    let isFallback = false;

    if (!activeKey) {
      // Se não há chaves rotativas livres, usar a chave padrão do .env
      const defaultEnvKey = process.env.GEMINI_API_KEY;
      if (defaultEnvKey) {
        activeKey = defaultEnvKey;
        isFallback = true;
      } else {
        throw new Error("Nenhuma chave Gemini disponível. Por favor, adicione chaves ativas no gerenciador de chaves.");
      }
    }

    // Se já tentamos esta chave específica nesta operação e ela falhou, esgotamos todas as chaves livres!
    if (triedKeys.has(activeKey)) {
      throw new Error("Todas as chaves Gemini livres foram esgotadas ou falharam durante esta geração. Por favor, recarregue ou adicione chaves ativas.");
    }
    
    triedKeys.add(activeKey);

    const maskedKey = maskKeyForLog(activeKey);
    console.log(`[Rotation] Iniciando geração com a chave: ${maskedKey} ${isFallback ? '(Env Fallback)' : ''}`);

    const dynamicAi = new GoogleGenAI({
      apiKey: activeKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    let lastError: any;
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

    let success = false;
    let result: any = null;
    let keyIsExhaustedOrInvalid = false;

    for (const currentModel of modelsToTry) {
      for (let i = 0; i < 2; i++) { // Máximo de 2 tentativas em caso de 503 temporário
        try {
          console.log(`[Rotation] Tentando modelo ${currentModel} (Tentativa ${i + 1}) com chave ${maskedKey}...`);
          result = await dynamicAi.models.generateContent({
            ...args,
            model: currentModel,
          });
          success = true;
          break; // Sucesso!
        } catch (error: any) {
          lastError = error;
          const errMsg = error?.message || String(error);
          console.error(`[Rotation] Erro no modelo ${currentModel} usando chave ${maskedKey}:`, errMsg);

          // 1. Verificar erro de COTA (429 / RESOURCE_EXHAUSTED / Rate Limit)
          const isQuota = 
            error?.status === 429 || 
            errMsg.includes("429") || 
            errMsg.includes("RESOURCE_EXHAUSTED") || 
            errMsg.toLowerCase().includes("quota exceeded") ||
            errMsg.toLowerCase().includes("rate limit");

          // 2. Verificar erro de AUTENTICAÇÃO / CHAVE INVÁLIDA (400 com API_KEY_INVALID / 401 / 403)
          const isInvalidKey = 
            error?.status === 401 || 
            error?.status === 403 ||
            (error?.status === 400 && (errMsg.includes("API_KEY_INVALID") || errMsg.includes("API key not valid"))) ||
            errMsg.includes("API key not valid") || 
            errMsg.includes("API_KEY_INVALID") ||
            errMsg.includes("API key expired");

          if (isQuota || isInvalidKey) {
            keyIsExhaustedOrInvalid = true;
            break; // Chave esgotou cota gratuita ou é inválida, rotacionar chave imediatamente
          }

          // 3. Se for indisponibilidade temporária (503), retenta 1x rapidamente
          const isUnavailable = error?.status === 503 || errMsg.includes("503") || errMsg.includes("UNAVAILABLE");
          if (isUnavailable && i < 1) {
            console.log(`[Rotation] Servidor instável (503). Retentando modelo em 1000ms...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }

          // Modelo 404 (indisponível para esta chave) ou outro erro de modelo: testar próximo modelo imediatamente
          break;
        }
      }

      if (success) break;

      if (keyIsExhaustedOrInvalid) {
        // Se a chave esgotou a cota ou é inválida, rotacionar para a próxima chave
        break;
      }
    }

    if (success) {
      if (!isFallback) {
        keysManager.recordSuccess(activeKey);
      }
      return result;
    } else {
      console.warn(`[Rotation] Chave ${maskedKey} falhou ou esgotou cota. Rotacionando para próxima chave ativa...`);
      if (!isFallback && keyIsExhaustedOrInvalid) {
        keysManager.markExhausted(activeKey);
      } else if (!isFallback) {
        keysManager.recordError(activeKey);
      }
      continue;
    }
  }
}

// Helper para geração através do OPENROUTER API
async function executeWithOpenRouter(args: {
  promptText?: string;
  parts: any[];
  responseSchema?: any;
  preferredModel?: string;
}) {
  const apiKey = providersManager.getOpenRouterKey();
  if (!apiKey) {
    throw new Error("Chave do OpenRouter não configurada. Por favor, adicione sua chave OpenRouter (sk-or-v1-...) no Menu de I.As ou no arquivo .env.");
  }

  const baseUrl = providersManager.getOpenRouterBaseUrl();
  const configuredModel = providersManager.getOpenRouterModel();
  const primaryModel = args.preferredModel || configuredModel || "nvidia/nemotron-3-ultra-550b-a55b:free";

  // Lista de modelos OpenRouter com foco em modelos gratuitos de alto contexto
  const modelsToTry = [...new Set([
    primaryModel,
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "minimax/minimax-m3:free",
    "google/gemma-4-26b-a4b-it:free",
    "nvidia/nemotron-3.5-lightning:free",
    "nvidia/nemotron-3-super:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "deepseek/deepseek-r1:free",
    "google/gemini-2.0-flash-exp:free",
    "qwen/qwen-2.5-coder-32b-instruct:free"
  ])];

  let schemaInstruction = "";
  if (args.responseSchema) {
    schemaInstruction = `\n\nESQUEMA JSON ESTRITO OBRIGATÓRIO (Responda APENAS com um objeto JSON válido estritamente aderente a esta estrutura, sem blocos de texto antes ou depois):\n${JSON.stringify(args.responseSchema, null, 2)}`;
  }

  const systemMessage = {
    role: "system",
    content: `Você é um roteirista premiado e engenheiro de prompts especialista em Instagram. Responda ESTRITAMENTE em formato JSON válido e parseável, sem qualquer texto fora do JSON.${schemaInstruction}`
  };

  const userContentArray: any[] = [];
  let combinedText = "";

  for (const p of args.parts || []) {
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
      } else if (p.inlineData.mimeType === 'application/pdf') {
        userContentArray.push({
          type: "text",
          text: `[Material de Referência / Livro em PDF Anexado: ${p.inlineData.data.length} bytes base64]`
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
    console.log(`[OpenRouter] Tentando geração com modelo: ${currentModel}...`);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://prompter-nano-banana.app",
            "X-Title": "Prompter Nano Banana"
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
        return { text: cleanText };
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

export async function startServer(port = 3000) {
  const app = express();
  const PORT = port || 3000;

  // CORS Middleware para permitir conexões de qualquer porta local
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });

  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));

  // API Routes - Key Management
  app.get("/api/health", (req, res) => {
    res.send("ok");
  });

  app.get("/api/preload-path", (req, res) => {
    try {
      const preloadPath = path.join(process.cwd(), 'spy-preload.cjs');
      const fileUrl = `file:///${preloadPath.replace(/\\/g, '/')}`;
      res.json({ path: fileUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/keys", (req, res) => {
    try {
      res.json(keysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/keys/upload", (req, res) => {
    try {
      const { keys } = req.body;
      if (!Array.isArray(keys)) {
        return res.status(400).json({ error: "O campo 'keys' deve ser uma lista de strings." });
      }
      keysManager.addKeys(keys);
      res.json(keysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/keys/reset", (req, res) => {
    try {
      keysManager.resetStatuses();
      res.json(keysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/keys/clear", (req, res) => {
    try {
      keysManager.clearAll();
      res.json(keysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/keys", (req, res) => {
    try {
      const target = req.body?.id || req.body?.key || req.query?.id || req.query?.key;
      if (!target) {
        return res.status(400).json({ error: "O identificador da chave é obrigatório para exclusão." });
      }
      keysManager.removeKey(String(target));
      res.json(keysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/keys/:id", (req, res) => {
    try {
      const target = req.params.id;
      if (target === "all") {
        keysManager.clearAll();
      } else {
        keysManager.removeKey(target);
      }
      res.json(keysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/save-analysis", (req, res) => {
    try {
      const data = req.body;
      const filePath = path.join(process.cwd(), 'spy-analysis.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[Spy Server] Análise de tela salva em: ${filePath}`);
      res.json({ success: true, path: filePath });
    } catch (error: any) {
      console.error("Save Analysis Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/save-macro", (req, res) => {
    try {
      const data = req.body;
      const filePath = path.join(process.cwd(), 'spy-macro.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`[Spy Server] Macro salvo em: ${filePath}`);
      res.json({ success: true, path: filePath });
    } catch (error: any) {
      console.error("Save Macro Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // API Routes - AI Providers & Settings
  app.get("/api/providers", (req, res) => {
    try {
      res.json({
        ...providersManager.getPublicConfig(),
        geminiStats: keysManager.getStats(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/providers/settings", (req, res) => {
    try {
      const { activeProvider, openrouter, gemini } = req.body;
      providersManager.updateConfig({ activeProvider, openrouter, gemini });
      res.json({
        ...providersManager.getPublicConfig(),
        geminiStats: keysManager.getStats(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/providers/test", async (req, res) => {
    try {
      const { provider, model, apiKey, baseUrl } = req.body;
      const targetProvider = provider || providersManager.getActiveProvider();

      if (targetProvider === "openrouter") {
        const keyToUse = (apiKey || providersManager.getOpenRouterKey()).trim();
        const urlToUse = baseUrl || providersManager.getOpenRouterBaseUrl();
        const modelToUse = model || providersManager.getOpenRouterModel();

        if (!keyToUse) {
          return res.status(400).json({ error: "Chave da API OpenRouter não informada. Insira sua chave sk-or-v1-..." });
        }

        const testRes = await fetch(`${urlToUse}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${keyToUse}`,
            "HTTP-Referer": "https://prompter-nano-banana.app",
            "X-Title": "Prompter Nano Banana"
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [{ role: "user", content: "Responda em formato JSON: {\"status\": \"ok\", \"message\": \"conectado\"}" }],
            response_format: { type: "json_object" },
            max_tokens: 30
          })
        });

        if (!testRes.ok) {
          const errText = await testRes.text();
          let errJson: any = null;
          try { errJson = JSON.parse(errText); } catch {}
          return res.status(testRes.status).json({ 
            error: errJson?.error?.message || errText || `Erro HTTP ${testRes.status}` 
          });
        }

        const data: any = await testRes.json();
        return res.json({ 
          success: true, 
          message: `Conexão bem-sucedida com OpenRouter usando o modelo ${modelToUse}!`,
          sample: data?.choices?.[0]?.message?.content
        });
      } else {
        // Test Gemini
        const result = await executeWithKeyRotation("gemini-2.5-flash", {
          contents: { parts: [{ text: "Responda em JSON: {\"status\": \"ok\"}" }] },
          config: { responseMimeType: "application/json" }
        });
        return res.json({ 
          success: true, 
          message: "Conexão com Gemini estabelecida com sucesso!", 
          sample: result.text 
        });
      }
    } catch (error: any) {
      console.error("Provider Test Error:", error);
      res.status(500).json({ error: error.message || "Erro ao testar provedor" });
    }
  });

  // API Routes - Multi-Provider Generate & Analyze
  app.post("/api/generate", async (req, res) => {
    try {
      const { parts, responseSchema, prompt, provider: reqProvider, model: reqModel } = req.body;
      const activeProvider = reqProvider || providersManager.getActiveProvider();

      if (activeProvider === 'openrouter') {
        const result = await executeWithOpenRouter({
          promptText: prompt,
          parts,
          responseSchema,
          preferredModel: reqModel,
        });
        return res.json({ text: result.text });
      }

      // Default / Gemini
      const geminiModel = reqModel || providersManager.getConfig().gemini.preferredModel || "gemini-2.5-flash";
      const result = await executeWithKeyRotation(geminiModel, {
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Generate Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { prompt, videoData, mimeType, provider: reqProvider, model: reqModel } = req.body;
      const activeProvider = reqProvider || providersManager.getActiveProvider();

      if (activeProvider === 'openrouter') {
        const result = await executeWithOpenRouter({
          promptText: prompt,
          parts: [{ text: prompt }],
          preferredModel: reqModel,
        });
        return res.json({ text: result.text });
      }

      // Default / Gemini
      const geminiModel = reqModel || providersManager.getConfig().gemini.preferredModel || "gemini-2.5-flash";
      const result = await executeWithKeyRotation(geminiModel, {
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: videoData,
                mimeType: mimeType
              }
            }
          ]
        }
      });

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Analyze Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development or Static serving for production
  if (process.env.NODE_ENV !== "production") {
    try {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.warn("Vite middleware could not be loaded, fallback to static serving:", e);
    }
  } else {
    // Determinar caminho correto de arquivos estáticos em produção
    let distPath = path.join(__dirname, 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      if (fs.existsSync(path.join(__dirname, 'index.html'))) {
        distPath = __dirname;
      } else if (fs.existsSync(path.join(process.cwd(), 'dist', 'index.html'))) {
        distPath = path.join(process.cwd(), 'dist');
      }
    }

    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.send("Prompter Nano Banana API is online.");
      }
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${PORT} is already in use. Server is already active.`);
    } else {
      console.error('Server error:', err);
    }
  });

  return server;
}

// Auto-iniciar se executado diretamente
if (process.env.NODE_ENV !== "test") {
  startServer();
}
