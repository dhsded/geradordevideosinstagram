import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { keysManager } from "./keys-manager";

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
      "gemini-2.0-flash",
      "gemini-1.5-flash",
      "gemini-1.5-pro"
    ])];

    let success = false;
    let result: any = null;
    let keyIsExhaustedOrInvalid = false;

    for (const currentModel of modelsToTry) {
      let modelFailedPermanently = false;

      for (let i = 0; i < 3; i++) { // Máximo de 3 tentativas por modelo em caso de 503
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

          // 1. Verificar erro de COTA (429 / RESOURCE_EXHAUSTED)
          const isQuota = 
            error?.status === 429 || 
            errMsg.includes("429") || 
            errMsg.includes("RESOURCE_EXHAUSTED") || 
            errMsg.toLowerCase().includes("quota exceeded");

          // 2. Verificar erro de AUTENTICAÇÃO / CHAVE INVÁLIDA (401 / 403 / API_KEY_INVALID)
          const isInvalidKey = 
            error?.status === 401 || 
            error?.status === 403 ||
            errMsg.includes("API key not valid") || 
            errMsg.includes("API_KEY_INVALID") ||
            errMsg.includes("API key expired");

          if (isQuota || isInvalidKey) {
            keyIsExhaustedOrInvalid = true;
            break; // Chave não tem mais cota ou é inválida, rotacionar chave imediatamente
          }

          // 3. Se for indisponibilidade temporária de serviço (503), aguarda com exponencial back-off
          const isUnavailable = error?.status === 503 || errMsg.includes("503") || errMsg.includes("UNAVAILABLE");
          if (isUnavailable && i < 2) {
            const delay = Math.pow(2, i) * 1000;
            console.log(`[Rotation] Servidor instável (503). Retentando modelo em ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          // Erro específico do modelo (404 modelo inexistente, ou erro 400 de parâmetros), tentar próximo modelo da lista
          modelFailedPermanently = true;
          break;
        }
      }

      if (success) break;

      if (keyIsExhaustedOrInvalid) {
        // Se a chave esgotou cota ou é inválida, não adianta testar outros modelos com essa chave.
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

  // API Routes - Gemini Generate & Analyze
  app.post("/api/generate", async (req, res) => {
    try {
      const { parts, responseSchema } = req.body;
      
      const result = await executeWithKeyRotation("gemini-2.5-flash", {
        contents: { parts },
        config: {
          responseMimeType: "application/json",
          responseSchema: responseSchema,
        },
      });

      res.json({ text: result.text });
    } catch (error: any) {
      console.error("Gemini Generate Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { prompt, videoData, mimeType } = req.body;
      
      const result = await executeWithKeyRotation("gemini-2.5-flash", {
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
      console.error("Gemini Analyze Error:", error);
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
