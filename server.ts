import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { keysManager } from "./keys-manager";

dotenv.config();

// Helper para mascarar chaves nos logs
function maskKeyForLog(key: string): string {
  if (key.length <= 10) return '***';
  return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
}

// Helper principal para geração com ROTAÇÃO e RESILIÊNCIA de chaves
async function executeWithKeyRotation(model: string, args: any) {
  const triedKeys = new Set<string>();
  
  while (true) {
    // 1. Obter a próxima chave ativa disponível
    let activeKey = keysManager.getNextActiveKey();
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
    const modelsToTry = [model, "gemini-1.5-flash", "gemini-1.5-pro"];
    let success = false;
    let result: any;

    for (const currentModel of modelsToTry) {
      let isQuotaOrInvalid = false;

      for (let i = 0; i < 3; i++) { // Máximo de 3 tentativas por modelo em caso de erro 503
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
          console.error(`[Rotation] Erro no modelo ${currentModel} usando chave ${maskedKey}:`, error.message || error);

          // Verificar se é erro de cota (429) ou chave inválida
          const isQuota = 
            error.status === 429 || 
            error.message?.includes("429") || 
            error.message?.includes("RESOURCE_EXHAUSTED") || 
            error.message?.includes("Quota exceeded");
            
          const isInvalidKey = 
            error.status === 400 || 
            error.message?.includes("API key not valid") || 
            error.message?.includes("API_KEY_INVALID") ||
            error.message?.includes("not valid");

          if (isQuota || isInvalidKey) {
            isQuotaOrInvalid = true;
            break; // Quebra o loop de tentativas do modelo atual para rotacionar chave
          }

          // Se for indisponibilidade temporária de serviço (503), aguarda com exponencial back-off
          const isUnavailable = error.message?.includes("503") || error.message?.includes("UNAVAILABLE");
          if (isUnavailable && i < 2) {
            const delay = Math.pow(2, i) * 1000;
            console.log(`[Rotation] Servidor instável (503). Retentando em ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }

          break;
        }
      }

      if (success) break;

      if (isQuotaOrInvalid) {
        // Se for erro de cota ou chave inválida, não adianta testar outros modelos com essa chave.
        break;
      }
    }

    if (success) {
      if (!isFallback) {
        keysManager.recordSuccess(activeKey);
      }
      return result;
    } else {
      // Marcar chave como esgotada/com erro e tentar a próxima do loop
      console.warn(`[Rotation] Chave ${maskedKey} falhou ou esgotou cota. Rotacionando para próxima chave ativa...`);
      if (!isFallback) {
        keysManager.markExhausted(activeKey);
      }
      continue;
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '150mb' }));

  // API Routes - Key Management
  app.get("/api/health", (req, res) => {
    res.send("ok");
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
      const { key } = req.body;
      if (!key) {
        return res.status(400).json({ error: "O campo 'key' é obrigatório para exclusão." });
      }
      keysManager.removeKey(key);
      res.json(keysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Routes - Gemini Generate & Analyze
  app.post("/api/generate", async (req, res) => {
    try {
      const { prompt, parts, responseSchema } = req.body;
      
      const result = await executeWithKeyRotation("gemini-3-flash-preview", {
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
      
      const result = await executeWithKeyRotation("gemini-3-flash-preview", {
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
