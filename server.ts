import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { keysManager } from "./keys-manager";
import { providersManager } from "./providers-manager";

dotenv.config();

import { aiService } from "./ai-service";

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

  app.all(["/api/keys/verify-all", "/api/keys/check-all"], async (req, res) => {
    try {
      const results = await keysManager.verifyAllKeys();
      res.json(results);
    } catch (error: any) {
      console.error("Erro ao verificar chaves:", error);
      res.status(500).json({ error: error.message || "Erro ao verificar cotas das chaves" });
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
            "HTTP-Referer": "https://postforge.app",
            "X-Title": "PostForge"
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
        const result = await aiService.generate({
          provider: 'gemini',
          model: model || 'gemini-2.5-flash',
          parts: [{ text: "Responda em JSON: {\"status\": \"ok\"}" }],
          responseSchema: {
            type: "OBJECT",
            properties: { status: { type: "STRING" } },
            required: ["status"]
          }
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

  // Rota para consulta de cota, saldo e limites da chave OpenRouter
  const handleOpenRouterQuota = async (req: express.Request, res: express.Response) => {
    try {
      const queryKey = (req.query.apiKey as string) || (req.body?.apiKey as string);
      const authHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const apiKey = (queryKey || authHeader || providersManager.getOpenRouterKey()).trim();

      if (!apiKey) {
        return res.status(400).json({ 
          success: false,
          error: "Chave da API OpenRouter não configurada. Cole sua chave sk-or-v1-... acima e salve para consultar a cota." 
        });
      }

      const baseUrl = providersManager.getOpenRouterBaseUrl();

      // Consultar status e limites da chave
      const keyRes = await fetch(`${baseUrl}/auth/key`, {
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": "https://postforge.app",
          "X-Title": "PostForge"
        }
      });

      const keyText = await keyRes.text();
      let keyData: any = null;
      try {
        keyData = JSON.parse(keyText);
      } catch {}

      if (!keyRes.ok) {
        return res.status(keyRes.status).json({ 
          success: false,
          error: keyData?.error?.message || keyText || `Erro HTTP ${keyRes.status} ao consultar chave na OpenRouter` 
        });
      }

      // Consultar saldo de créditos
      let creditsData: any = null;
      try {
        const creditsRes = await fetch(`${baseUrl}/credits`, {
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "HTTP-Referer": "https://postforge.app",
            "X-Title": "PostForge"
          }
        });
        if (creditsRes.ok) {
          const creditsText = await creditsRes.text();
          try {
            creditsData = JSON.parse(creditsText);
          } catch {}
        }
      } catch (err: any) {
        console.warn("[OpenRouter Quota] Aviso ao consultar créditos:", err.message);
      }

      return res.json({
        success: true,
        keyInfo: keyData?.data,
        creditsInfo: creditsData?.data
      });
    } catch (error: any) {
      console.error("OpenRouter Quota Error:", error);
      return res.status(500).json({ 
        success: false,
        error: error.message || "Erro ao consultar cota do OpenRouter" 
      });
    }
  };

  app.get("/api/providers/openrouter/quota", handleOpenRouterQuota);
  app.post("/api/providers/openrouter/quota", handleOpenRouterQuota);
  app.get("/api/providers/openrouter-quota", handleOpenRouterQuota);
  app.post("/api/providers/openrouter-quota", handleOpenRouterQuota);

  // API Routes - Modular Multi-Provider Generate & Analyze
  app.post("/api/generate", async (req, res) => {
    try {
      const { parts, responseSchema, prompt, provider: reqProvider, model: reqModel } = req.body;
      const result = await aiService.generate({
        parts,
        responseSchema,
        prompt,
        provider: reqProvider,
        model: reqModel
      });
      res.json({ 
        text: result.text, 
        provider: result.provider, 
        model: result.model,
        failoverUsed: result.failoverUsed,
        originalProvider: result.originalProvider,
        failoverReason: result.failoverReason
      });
    } catch (error: any) {
      console.error("Generate Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { prompt, videoData, mimeType, provider: reqProvider, model: reqModel } = req.body;
      const result = await aiService.analyze({
        prompt,
        videoData,
        mimeType,
        provider: reqProvider,
        model: reqModel
      });
      res.json({ 
        text: result.text, 
        provider: result.provider, 
        model: result.model,
        failoverUsed: result.failoverUsed,
        originalProvider: result.originalProvider,
        failoverReason: result.failoverReason
      });
    } catch (error: any) {
      console.error("Analyze Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // API Route - Extração de Texto de Documentos (.pdf, .docx, .doc, .txt, .json, etc.)
  app.post("/api/extract-document-text", async (req, res) => {
    try {
      const { data, filename, mimeType } = req.body;
      if (!data) {
        return res.status(400).json({ success: false, error: "Nenhum dado de arquivo fornecido." });
      }

      const cleanBase64 = data.includes("base64,") ? data.split("base64,")[1] : data;
      const buffer = Buffer.from(cleanBase64, "base64");
      const name = (filename || "").toLowerCase();
      let extractedText = "";

      if (name.endsWith(".pdf") || mimeType === "application/pdf") {
        const pdfModule: any = await import("pdf-parse");
        const parseFn = pdfModule.default || pdfModule;
        const pdfData = await parseFn(buffer);
        extractedText = pdfData?.text || "";
      } else if (name.endsWith(".docx") || name.endsWith(".doc") || mimeType?.includes("wordprocessingml") || mimeType?.includes("msword")) {
        try {
          const mammothModule: any = await import("mammoth");
          const mammoth = mammothModule.default || mammothModule;
          const result = await mammoth.extractRawText({ buffer });
          extractedText = result.value || "";
        } catch (docxErr: any) {
          console.warn("[Document Extract] Fallback mammoth:", docxErr.message);
          extractedText = buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t\u00C0-\u00FF]/g, " ");
        }
      } else {
        // Arquivos de texto (.txt, .md, .json, .csv, .srt, .vtt, etc.)
        extractedText = buffer.toString("utf-8");
      }

      extractedText = extractedText.trim();
      const wordCount = extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0;

      res.json({
        success: true,
        text: extractedText,
        filename: filename || "documento",
        wordCount
      });
    } catch (error: any) {
      console.error("Extract Document Error:", error);
      res.status(500).json({ 
        success: false, 
        error: error.message || "Erro ao extrair texto do documento." 
      });
    }
  });

  // API Route - Auditoria e Organização Sequencial de Imagens por Roteiro
  app.post("/api/audit-images", async (req, res) => {
    try {
      const { images, scriptContext, characterNotes, provider: reqProvider, model: reqModel } = req.body;
      
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Nenhuma imagem foi fornecida para auditoria." });
      }

      if (!scriptContext || typeof scriptContext !== 'string' || !scriptContext.trim()) {
        return res.status(400).json({ error: "O contexto do roteiro / slides é obrigatório." });
      }

      const parts: any[] = [];

      const promptText = `Você é um Diretor de Arte, Auditor Visual e Especialista em Continuidade Cinematográfica e Consistência de Personagens para Instagram.
Sua missão é realizar uma Auditoria Visual e Organização Sequencial das imagens enviadas com base no roteiro/slides fornecido.

=== ROTEIRO / SEQUÊNCIA DE SLIDES ESPERADA ===
${scriptContext.trim()}

${characterNotes ? `=== DIRETRIZES DE CONSISTÊNCIA DE PERSONAGEM E ESTILO ===\n${characterNotes.trim()}\n` : ''}

=== SUAS TAREFAS DE AUDITORIA ===
1. Examine com atenção cada uma das ${images.length} imagens fornecidas abaixo.
2. Identifique os traços do personagem, estilo visual, paleta de cores, expressão emocional e elementos de cena em cada imagem.
3. Para CADA SLIDE do roteiro (Slide 1, Slide 2, etc.), selecione a melhor imagem correspondente entre as enviadas (identificada exatamente pelo nome do arquivo correspondente).
4. Avalie a consistência visual em porcentagem (ex: "95%", "90%", "85%").
5. Forneça um feedback visual detalhado explicando por que a imagem foi mapeada para aquele slide, destacando a fidelidade à narrativa e ao personagem.
6. Se houver imagens sobressalentes que não foram utilizadas nos slides, liste-as com o motivo pelo qual não foram a melhor escolha para a sequência.
7. Forneça uma análise resumida da consistência geral da coleção de imagens.

Responda ESTRITAMENTE em formato JSON aderente ao esquema fornecido.`;

      parts.push({ text: promptText });

      images.forEach((img: { name: string; mimeType: string; data: string }, index: number) => {
        parts.push({
          text: `\n--- [INÍCIO DA IMAGEM ${index + 1}: ARQUIVO "${img.name}"] ---`
        });
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/png',
            data: img.data.includes('base64,') ? img.data.split('base64,')[1] : img.data
          }
        });
        parts.push({
          text: `--- [FIM DA IMAGEM: ARQUIVO "${img.name}"] ---\n`
        });
      });

      const responseSchema = {
        type: "OBJECT",
        properties: {
          resumo_geral_consistencia: { 
            type: "STRING", 
            description: "Resumo executivo sobre a consistência dos personagens, estilo artístico e iluminação." 
          },
          pontuacao_media_geral: { 
            type: "STRING", 
            description: "Média percentual de consistência de toda a sequência, ex: 92%" 
          },
          auditoria_imagens: {
            type: "ARRAY",
            description: "Lista ordenada sequencialmente de slides com suas respectivas imagens mapeadas",
            items: {
              type: "OBJECT",
              properties: {
                slide_numero: { type: "INTEGER", description: "Número sequencial do slide (1, 2, 3...)" },
                descricao_esperada: { type: "STRING", description: "Resumo do que era esperado neste slide" },
                imagem_arquivo_correspondente: { type: "STRING", description: "Nome exato do arquivo de imagem correspondente que melhor representa este slide" },
                pontuacao_consistencia: { type: "STRING", description: "Porcentagem de correspondência e consistência, ex: 95%" },
                feedback_visual: { type: "STRING", description: "Explicação detalhada da escolha e fidelidade visual" },
                destaque_pontos_fortes: { 
                  type: "ARRAY", 
                  items: { type: "STRING" },
                  description: "Pontos fortes visuais e de consistência" 
                },
                alertas_inconsistencia: { 
                  type: "ARRAY", 
                  items: { type: "STRING" },
                  description: "Eventuais pequenas inconsistências ou sugestões de melhoria" 
                }
              },
              required: ["slide_numero", "descricao_esperada", "imagem_arquivo_correspondente", "pontuacao_consistencia", "feedback_visual"]
            }
          },
          imagens_sobressalentes: {
            type: "ARRAY",
            description: "Imagens que sobraram e não foram alocadas a nenhum slide",
            items: {
              type: "OBJECT",
              properties: {
                nome_arquivo: { type: "STRING", description: "Nome do arquivo não utilizado" },
                motivo_descarte: { type: "STRING", description: "Motivo pelo qual a imagem não entrou na sequência final" }
              },
              required: ["nome_arquivo", "motivo_descarte"]
            }
          }
        },
        required: ["resumo_geral_consistencia", "auditoria_imagens"]
      };

      const result = await aiService.generate({
        parts,
        responseSchema,
        provider: reqProvider,
        model: reqModel
      });

      res.json({
        text: result.text,
        provider: result.provider,
        model: result.model,
        failoverUsed: result.failoverUsed,
        originalProvider: result.originalProvider,
        failoverReason: result.failoverReason
      });
    } catch (error: any) {
      console.error("Audit Images Error:", error);
      res.status(500).json({ error: error.message || "Erro durante auditoria de imagens." });
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
        res.send("PostForge API is online.");
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
