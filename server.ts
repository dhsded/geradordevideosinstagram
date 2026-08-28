import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import { exec } from "child_process";
import JSZip from "jszip";
import { createServer as createViteServer } from "vite";

const _currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { keysManager } from "./keys-manager";
import { openrouterKeysManager } from "./openrouter-keys-manager";
import { groqKeysManager } from "./groq-keys-manager";
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

  // ==========================================
  // OPENROUTER MULTI-KEYS ENDPOINTS
  // ==========================================
  app.get("/api/openrouter-keys", (req, res) => {
    try {
      res.json(openrouterKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/openrouter-keys/upload", (req, res) => {
    try {
      const { keys, labelPrefix } = req.body;
      if (!Array.isArray(keys)) {
        return res.status(400).json({ error: "O campo 'keys' deve ser uma lista de strings (sk-or-v1-...)." });
      }
      const addedCount = openrouterKeysManager.addKeys(keys, labelPrefix);
      res.json({
        ...openrouterKeysManager.getStats(),
        addedCount
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/openrouter-keys", (req, res) => {
    try {
      const { keys, labelPrefix } = req.body;
      if (!Array.isArray(keys)) {
        return res.status(400).json({ error: "O campo 'keys' deve ser uma lista de strings (sk-or-v1-...)." });
      }
      const addedCount = openrouterKeysManager.addKeys(keys, labelPrefix);
      res.json({
        ...openrouterKeysManager.getStats(),
        addedCount
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/openrouter-keys/reset", (req, res) => {
    try {
      openrouterKeysManager.resetStatuses();
      res.json(openrouterKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.all(["/api/openrouter-keys/verify-all", "/api/openrouter-keys/check-all"], async (req, res) => {
    try {
      const results = await openrouterKeysManager.verifyAllKeys();
      res.json(results);
    } catch (error: any) {
      console.error("Erro ao verificar chaves OpenRouter:", error);
      res.status(500).json({ error: error.message || "Erro ao verificar cotas das chaves OpenRouter" });
    }
  });

  app.post("/api/openrouter-keys/clear", (req, res) => {
    try {
      openrouterKeysManager.clearAll();
      res.json(openrouterKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/openrouter-keys", (req, res) => {
    try {
      const target = req.body?.id || req.body?.key || req.query?.id || req.query?.key;
      if (!target) {
        return res.status(400).json({ error: "O identificador da chave é obrigatório para exclusão." });
      }
      openrouterKeysManager.removeKey(String(target));
      res.json(openrouterKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/openrouter-keys/:id", (req, res) => {
    try {
      const target = req.params.id;
      if (target === "all") {
        openrouterKeysManager.clearAll();
      } else {
        openrouterKeysManager.removeKey(target);
      }
      res.json(openrouterKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // GROQ CLOUD MULTI-KEYS ENDPOINTS
  // ==========================================
  app.get("/api/groq-keys", (req, res) => {
    try {
      res.json(groqKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/groq-keys/upload", (req, res) => {
    try {
      const { keys, labelPrefix } = req.body;
      if (!Array.isArray(keys)) {
        return res.status(400).json({ error: "O campo 'keys' deve ser uma lista de strings (gsk_...)." });
      }
      const addedCount = groqKeysManager.addKeys(keys, labelPrefix);
      res.json({
        ...groqKeysManager.getStats(),
        addedCount
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/groq-keys", (req, res) => {
    try {
      const { keys, labelPrefix } = req.body;
      if (!Array.isArray(keys)) {
        return res.status(400).json({ error: "O campo 'keys' deve ser uma lista de strings (gsk_...)." });
      }
      const addedCount = groqKeysManager.addKeys(keys, labelPrefix);
      res.json({
        ...groqKeysManager.getStats(),
        addedCount
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/groq-keys/reset", (req, res) => {
    try {
      groqKeysManager.resetStatuses();
      res.json(groqKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.all(["/api/groq-keys/verify-all", "/api/groq-keys/check-all"], async (req, res) => {
    try {
      const results = await groqKeysManager.verifyAllKeys();
      res.json(results);
    } catch (error: any) {
      console.error("Erro ao verificar chaves Groq:", error);
      res.status(500).json({ error: error.message || "Erro ao verificar cotas das chaves Groq" });
    }
  });

  app.post("/api/groq-keys/clear", (req, res) => {
    try {
      groqKeysManager.clearAll();
      res.json(groqKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/groq-keys", (req, res) => {
    try {
      const target = req.body?.id || req.body?.key || req.query?.id || req.query?.key;
      if (!target) {
        return res.status(400).json({ error: "O identificador da chave é obrigatório para exclusão." });
      }
      groqKeysManager.removeKey(String(target));
      res.json(groqKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/groq-keys/:id", (req, res) => {
    try {
      const target = req.params.id;
      if (target === "all") {
        groqKeysManager.clearAll();
      } else {
        groqKeysManager.removeKey(target);
      }
      res.json(groqKeysManager.getStats());
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // ESPIÃO FLOW & RPA EXECUTOR ENDPOINTS
  // ==========================================
  const MACROS_DIR = path.join(process.cwd(), 'macros');
  if (!fs.existsSync(MACROS_DIR)) {
    fs.mkdirSync(MACROS_DIR, { recursive: true });
  }

  // 1. Compreensão de Processos com IA (Visão Computacional + LLM)
  app.post("/api/spy/understand-process", async (req, res) => {
    try {
      const { steps, targetUrl, userGoal, provider: reqProvider, model: reqModel } = req.body;

      if (!Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: "Nenhum passo gravado foi fornecido para análise." });
      }

      const parts: any[] = [];
      const promptText = `Você é um Engenheiro Sênior de RPA (Robotic Process Automation), Especialista em Automação Web e Visão Computacional.
Sua missão é analisar a sequência de ações do usuário (cliques, digitações, navegações e capturas de tela) gravadas no Espião FLOW e:

1. COMPREENDER O PROCESSO: Descubra qual ferramenta ou fluxo o usuário operou (ex: "Geração de imagens no Midjourney/Leonardo/Flux", "Criação de Carrossel no Canva", "Postagem no Instagram", etc.).
2. IDENTIFICAR VARIÁVEIS DINÂMICAS: Encontre onde o usuário digitou textos ou prompts que podem ser parametrizados (ex: o usuário digitou "Um coração fofo com óculos...", converta em variável "{prompt_imagem}").
3. SINTETIZAR O MACRO PARAMETRIZADO: Crie um fluxo de execução robusto, indicando seletores precisos, ações e tempos de espera adequados para replicação em larga escala.
4. GERAR CÓDIGOS DE EXECUÇÃO: Forneça scripts limpos, comentados e autônomos em Puppeteer e Playwright.

=== URL DO PROCESSO ===
${targetUrl || 'Navegador Web'}

${userGoal ? `=== OBJETIVO DECLARADO PELO USUÁRIO ===\n${userGoal}\n` : ''}

=== SEQUÊNCIA DE PASSOS GRAVADOS (${steps.length} PASSOS) ===
${steps.map((s: any, idx: number) => {
  return `[Passo ${idx + 1}] Tipo: ${s.type.toUpperCase()} | Seletor: "${s.selector || ''}" | XPath: "${s.xpath || ''}" | Valor/Texto: "${s.value || ''}" | Descrição: "${s.description || ''}"`;
}).join('\n')}

Responda ESTRITAMENTE em formato JSON aderente ao esquema fornecido.`;

      parts.push({ text: promptText });

      // Adicionar capturas de tela anexadas aos passos (se houver)
      steps.forEach((s: any, idx: number) => {
        if (s.screenshot) {
          parts.push({
            text: `\n--- [SCREENSHOT DO PASSO ${idx + 1}: AÇÃO "${s.type.toUpperCase()}" NO SELETOR "${s.selector || ''}"] ---`
          });
          parts.push({
            inlineData: {
              mimeType: 'image/png',
              data: s.screenshot.includes('base64,') ? s.screenshot.split('base64,')[1] : s.screenshot
            }
          });
          parts.push({
            text: `--- [FIM DO SCREENSHOT DO PASSO ${idx + 1}] ---\n`
          });
        }
      });

      const responseSchema = {
        type: "OBJECT",
        properties: {
          nome_processo: { 
            type: "STRING", 
            description: "Nome claro e descritivo do processo identificado, ex: Geração Automatizada de Imagens no Midjourney" 
          },
          descricao_processo: { 
            type: "STRING", 
            description: "Explicação técnica e resumida do fluxo identificado e sua finalidade" 
          },
          resumo_passo_a_passo: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Resumo executivo das etapas do processo"
          },
          variaveis_identificadas: {
            type: "ARRAY",
            description: "Lista de campos e variáveis que podem ser substituídos dinamicamente em lote",
            items: {
              type: "OBJECT",
              properties: {
                nome_variavel: { type: "STRING", description: "Nome da variável em formato de tag, ex: {prompt_slide_1} ou {termo_pesquisa}" },
                valor_original: { type: "STRING", description: "Texto original que o usuário havia digitado no passo" },
                descricao: { type: "STRING", description: "Explicação sobre o que este parâmetro representa no fluxo" },
                passo_index: { type: "INTEGER", description: "Índice do passo associado (1-indexed)" }
              },
              required: ["nome_variavel", "valor_original", "descricao", "passo_index"]
            }
          },
          macro_parametrizado: {
            type: "ARRAY",
            description: "Sequência de passos de automação com suporte a variáveis e tolerância a atrasos",
            items: {
              type: "OBJECT",
              properties: {
                ordem: { type: "INTEGER", description: "Número sequencial da ação" },
                tipo: { type: "STRING", description: "Tipo de ação: click, fill, wait, navigate, screenshot ou keypress" },
                seletor: { type: "STRING", description: "Seletor CSS otimizado" },
                xpath: { type: "STRING", description: "XPath do elemento" },
                valor: { type: "STRING", description: "Valor ou texto da ação (pode conter tags de variáveis como {prompt})" },
                variavel_associada: { type: "STRING", description: "Nome da variável se aplicável" },
                descricao: { type: "STRING", description: "Explicação amigável da ação" },
                tempo_espera_ms: { type: "INTEGER", description: "Tempo de espera recomendado em milissegundos após a ação" }
              },
              required: ["ordem", "tipo", "seletor", "descricao"]
            }
          },
          codigo_puppeteer: { 
            type: "STRING", 
            description: "Script executável completo em Node.js com Puppeteer para rodar o macro" 
          },
          codigo_playwright: { 
            type: "STRING", 
            description: "Script executável completo em Node.js com Playwright para rodar o macro" 
          }
        },
        required: ["nome_processo", "descricao_processo", "resumo_passo_a_passo", "variaveis_identificadas", "macro_parametrizado", "codigo_puppeteer", "codigo_playwright"]
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
        failoverUsed: result.failoverUsed
      });
    } catch (error: any) {
      console.error("Understand Process Error:", error);
      res.status(500).json({ error: error.message || "Erro ao compreender processo com IA." });
    }
  });

  // 2. Salvar Macro na Biblioteca
  app.post("/api/spy/save-macro", (req, res) => {
    try {
      const macro = req.body;
      const macroId = macro.id || `macro_${Date.now()}`;
      macro.id = macroId;
      macro.updatedAt = new Date().toISOString();

      const macroFilePath = path.join(MACROS_DIR, `${macroId}.json`);
      fs.writeFileSync(macroFilePath, JSON.stringify(macro, null, 2), 'utf-8');
      
      // Também salvar o último em spy-macro.json para compatibilidade
      fs.writeFileSync(path.join(process.cwd(), 'spy-macro.json'), JSON.stringify(macro, null, 2), 'utf-8');

      res.json({ success: true, macroId, path: macroFilePath });
    } catch (error: any) {
      console.error("Save Macro Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Listar Macros Salvos
  app.get("/api/spy/list-macros", (req, res) => {
    try {
      if (!fs.existsSync(MACROS_DIR)) {
        return res.json({ macros: [] });
      }

      const files = fs.readdirSync(MACROS_DIR).filter(f => f.endsWith('.json'));
      const macros = files.map(file => {
        try {
          const content = fs.readFileSync(path.join(MACROS_DIR, file), 'utf-8');
          return JSON.parse(content);
        } catch {
          return null;
        }
      }).filter(Boolean);

      // Ordenar do mais recente para o mais antigo
      macros.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());

      res.json({ macros });
    } catch (error: any) {
      console.error("List Macros Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 4. Excluir Macro
  app.delete("/api/spy/delete-macro/:id", (req, res) => {
    try {
      const macroId = req.params.id;
      const macroFilePath = path.join(MACROS_DIR, `${macroId}.json`);
      if (fs.existsSync(macroFilePath)) {
        fs.unlinkSync(macroFilePath);
        res.json({ success: true, message: "Macro excluído com sucesso." });
      } else {
        res.status(404).json({ error: "Macro não encontrado." });
      }
    } catch (error: any) {
      console.error("Delete Macro Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 5. Renomear Macro
  app.patch("/api/spy/rename-macro/:id", (req, res) => {
    try {
      const macroId = req.params.id;
      const { nome_processo } = req.body;
      if (!nome_processo || !nome_processo.trim()) {
        return res.status(400).json({ error: "Nome do processo é obrigatório." });
      }
      const macroFilePath = path.join(MACROS_DIR, `${macroId}.json`);
      if (!fs.existsSync(macroFilePath)) {
        return res.status(404).json({ error: "Macro não encontrado." });
      }
      const content = fs.readFileSync(macroFilePath, 'utf-8');
      const macro = JSON.parse(content);
      macro.nome_processo = nome_processo.trim();
      macro.updatedAt = new Date().toISOString();
      fs.writeFileSync(macroFilePath, JSON.stringify(macro, null, 2), 'utf-8');
      res.json({ success: true, macro });
    } catch (error: any) {
      console.error("Rename Macro Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ==========================================
  // FLUXOGRAMAS N8N (WORKFLOWS PERSISTENTES)
  // ==========================================
  const FLOWS_DIR = path.join(process.cwd(), 'flows');
  if (!fs.existsSync(FLOWS_DIR)) {
    fs.mkdirSync(FLOWS_DIR, { recursive: true });
  }

  function generateFlowCompiledScript(flow: any) {
    const nodes = flow.nodes || [];
    const flowName = flow.name || 'Fluxo sem Nome';
    
    let puppeteerCode = `/**
 * FLUXOGRAMA AUTOMATIZADO - N8N POSTFORGE
 * Nome do Fluxo: ${flowName}
 * Total de Módulos (Nós): ${nodes.length}
 * Gerado em: ${new Date().toISOString()}
 * 
 * Este código unificado encadeia todos os macros na sequência do fluxograma.
 * Pode ser executado diretamente com Node.js ou empacotado em um executável Electron com interface gráfica.
 */

const puppeteer = require('puppeteer');

async function runCompleteWorkflow() {
  console.log("🚀 [PostForge N8N] Iniciando execução do Fluxo: '${flowName}'...");
  const browser = await puppeteer.launch({
    headless: false,
    defaultViewport: null,
    args: ['--start-maximized']
  });
  const page = await browser.newPage();

  try {
`;

    nodes.forEach((node: any, idx: number) => {
      puppeteerCode += `
    // =========================================================================
    // ETAPA ${idx + 1}/${nodes.length}: ${node.name || `Nó ${idx + 1}`} (ID: ${node.id})
    // Cor de Identificação: ${node.color || 'padrão'}
    // =========================================================================
    console.log("▶ [Etapa ${idx + 1}/${nodes.length}] Executando nó: '${node.name}'...");
`;
      if (node.macroData && Array.isArray(node.macroData.macro_parametrizado)) {
        if (node.macroData.targetUrl) {
          puppeteerCode += `    console.log("  Navegando para: ${node.macroData.targetUrl}");\n    await page.goto("${node.macroData.targetUrl}", { waitUntil: 'networkidle2' }).catch(() => null);\n    await page.waitForTimeout(2000);\n`;
        }
        node.macroData.macro_parametrizado.forEach((step: any, sIdx: number) => {
          puppeteerCode += `    // Passo ${sIdx + 1}: ${step.descricao || step.tipo}\n`;
          if (step.tipo === 'click' && step.seletor) {
            puppeteerCode += `    await page.waitForSelector("${step.seletor}", { timeout: 6000 }).catch(() => null);\n    await page.click("${step.seletor}").catch(() => null);\n    await page.waitForTimeout(${step.tempo_espera_ms || 1000});\n`;
          } else if (step.tipo === 'fill' && step.seletor) {
            puppeteerCode += `    await page.waitForSelector("${step.seletor}", { timeout: 6000 }).catch(() => null);\n    await page.type("${step.seletor}", "${step.valor || ''}").catch(() => null);\n    await page.waitForTimeout(${step.tempo_espera_ms || 800});\n`;
          } else if (step.tipo === 'wait') {
            puppeteerCode += `    await page.waitForTimeout(${step.tempo_espera_ms || 1500});\n`;
          }
        });
      } else if (node.customCode) {
        puppeteerCode += `    // Código customizado do nó:\n${node.customCode}\n`;
      } else {
        puppeteerCode += `    await page.waitForTimeout(2000);\n`;
      }
      puppeteerCode += `    console.log("  ✅ Etapa ${idx + 1} ('${node.name}') concluída.");\n`;
    });

    puppeteerCode += `
    console.log("🎉 [PostForge N8N] Fluxograma '${flowName}' concluído com sucesso absoluto!");
  } catch (error) {
    console.error("❌ Erro durante a execução do fluxograma:", error);
  } finally {
    // console.log("Fechando navegador...");
    // await browser.close();
  }
}

if (require.main === module) {
  runCompleteWorkflow();
}

module.exports = { runCompleteWorkflow };
`;

    return {
      puppeteer: puppeteerCode,
      runnerCjs: puppeteerCode
    };
  }

  // 1. Salvar Fluxograma na pasta flows/
  app.post("/api/spy/save-flow", (req, res) => {
    try {
      const flow = req.body;
      const flowId = flow.id || `flow_${Date.now()}`;
      flow.id = flowId;
      flow.updatedAt = new Date().toISOString();
      if (!flow.createdAt) flow.createdAt = new Date().toISOString();

      // Gerar script compilado automático
      flow.compiledScript = generateFlowCompiledScript(flow);

      const flowFilePath = path.join(FLOWS_DIR, `${flowId}.json`);
      fs.writeFileSync(flowFilePath, JSON.stringify(flow, null, 2), 'utf-8');

      res.json({ success: true, flowId, path: flowFilePath, flow });
    } catch (error: any) {
      console.error("Save Flow Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 2. Listar Fluxogramas Salvos
  app.get("/api/spy/list-flows", (req, res) => {
    try {
      if (!fs.existsSync(FLOWS_DIR)) {
        return res.json({ flows: [] });
      }
      const files = fs.readdirSync(FLOWS_DIR).filter(f => f.endsWith('.json'));
      const flows = files.map(file => {
        try {
          const content = fs.readFileSync(path.join(FLOWS_DIR, file), 'utf-8');
          return JSON.parse(content);
        } catch {
          return null;
        }
      }).filter(Boolean);

      flows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
      res.json({ flows });
    } catch (error: any) {
      console.error("List Flows Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 3. Obter Fluxograma por ID
  app.get("/api/spy/get-flow/:id", (req, res) => {
    try {
      const flowId = req.params.id;
      const flowFilePath = path.join(FLOWS_DIR, `${flowId}.json`);
      if (fs.existsSync(flowFilePath)) {
        const flow = JSON.parse(fs.readFileSync(flowFilePath, 'utf-8'));
        res.json({ flow });
      } else {
        res.status(404).json({ error: "Fluxograma não encontrado." });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // 4. Excluir Fluxograma
  app.delete("/api/spy/delete-flow/:id", (req, res) => {
    try {
      const flowId = req.params.id;
      const flowFilePath = path.join(FLOWS_DIR, `${flowId}.json`);
      if (fs.existsSync(flowFilePath)) {
        fs.unlinkSync(flowFilePath);
        res.json({ success: true, message: "Fluxograma excluído com sucesso." });
      } else {
        res.status(404).json({ error: "Fluxograma não encontrado." });
      }
    } catch (error: any) {
      console.error("Delete Flow Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // 5. Renomear Fluxograma
  app.patch("/api/spy/rename-flow/:id", (req, res) => {
    try {
      const flowId = req.params.id;
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Nome do fluxograma é obrigatório." });
      }
      const flowFilePath = path.join(FLOWS_DIR, `${flowId}.json`);
      if (!fs.existsSync(flowFilePath)) {
        return res.status(404).json({ error: "Fluxograma não encontrado." });
      }
      const flow = JSON.parse(fs.readFileSync(flowFilePath, 'utf-8'));
      flow.name = name.trim();
      flow.updatedAt = new Date().toISOString();
      flow.compiledScript = generateFlowCompiledScript(flow);
      fs.writeFileSync(flowFilePath, JSON.stringify(flow, null, 2), 'utf-8');
      res.json({ success: true, flow });
    } catch (error: any) {
      console.error("Rename Flow Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Salvar análise simples
  app.post("/api/save-analysis", (req, res) => {
    try {
      const data = req.body;
      const filePath = path.join(process.cwd(), 'spy-analysis.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      res.json({ success: true, path: filePath });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/save-macro", (req, res) => {
    try {
      const data = req.body;
      const filePath = path.join(process.cwd(), 'spy-macro.json');
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      res.json({ success: true, path: filePath });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Routes - AI Providers & Settings
  app.get("/api/providers", (req, res) => {
    try {
      res.json({
        ...providersManager.getPublicConfig(),
        geminiStats: keysManager.getStats(),
        openrouterStats: openrouterKeysManager.getStats(),
        groqStats: groqKeysManager.getStats(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/providers/settings", (req, res) => {
    try {
      const { activeProvider, openrouter, groq, gemini } = req.body;
      if (openrouter?.apiKey) {
        const cleanKey = String(openrouter.apiKey).trim().replace(/^["']+|["']+$/g, '');
        if (cleanKey && cleanKey.length >= 8) {
          openrouterKeysManager.addKeys([cleanKey], 'Chave Principal');
        }
      }
      if (groq?.apiKey) {
        const cleanKey = String(groq.apiKey).trim().replace(/^["']+|["']+$/g, '');
        if (cleanKey && cleanKey.length >= 8) {
          groqKeysManager.addKeys([cleanKey], 'Chave Principal');
        }
      }
      providersManager.updateConfig({ activeProvider, openrouter, groq, gemini });
      res.json({
        ...providersManager.getPublicConfig(),
        geminiStats: keysManager.getStats(),
        openrouterStats: openrouterKeysManager.getStats(),
        groqStats: groqKeysManager.getStats(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/providers/test", async (req, res) => {
    try {
      const { provider, model, apiKey, baseUrl } = req.body;
      const targetProvider = provider || providersManager.getActiveProvider();

      if (targetProvider === "groq") {
        const keyToUse = (apiKey || providersManager.getGroqKey() || groqKeysManager.getActiveKey() || '').trim().replace(/^["']+|["']+$/g, '');
        const urlToUse = baseUrl || providersManager.getGroqBaseUrl();
        const modelToUse = model || providersManager.getGroqModel();

        if (!keyToUse) {
          return res.status(400).json({ error: "Chave da API Groq não informada. Insira sua chave (gsk_...) no campo ou cadastre no pool de chaves." });
        }

        const t0 = Date.now();
        const testRes = await fetch(`${urlToUse}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${keyToUse}`
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [{ role: "user", content: "Responda em formato JSON: {\"status\": \"ok\", \"message\": \"conectado\"}" }],
            response_format: { type: "json_object" },
            max_tokens: 30
          }),
          signal: AbortSignal.timeout(12000)
        });

        const elapsed = ((Date.now() - t0) / 1000).toFixed(2);

        if (!testRes.ok) {
          const errText = await testRes.text();
          let errJson: any = null;
          try { errJson = JSON.parse(errText); } catch {}
          const rawMsg = errJson?.error?.message || errJson?.message || errText || `Erro HTTP ${testRes.status}`;

          if (testRes.status === 401 || rawMsg.toLowerCase().includes('invalid api key')) {
            return res.status(401).json({
              error: "Chave Groq inválida ou não autorizada. Acesse console.groq.com/keys para obter uma chave gratuita."
            });
          }

          if (testRes.status === 429 || rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('quota')) {
            return res.status(429).json({
              error: `Limite de taxa temporário no Groq (429): ${rawMsg.slice(0, 150)}`
            });
          }

          return res.status(testRes.status).json({ error: rawMsg });
        }

        const data: any = await testRes.json();
        return res.json({ 
          success: true, 
          message: `Conexão ultra rápida com Groq Cloud estabelecida em ${elapsed}s usando ${modelToUse}!`,
          sample: data?.choices?.[0]?.message?.content
        });
      } else if (targetProvider === "openrouter") {
        const keyToUse = (apiKey || providersManager.getOpenRouterKey() || openrouterKeysManager.getActiveKey() || '').trim().replace(/^["']+|["']+$/g, '');
        const urlToUse = baseUrl || providersManager.getOpenRouterBaseUrl();
        const modelToUse = model || providersManager.getOpenRouterModel();

        if (!keyToUse) {
          return res.status(400).json({ error: "Chave da API OpenRouter não informada. Insira sua chave (sk-or-v1-...) no campo ou cadastre no pool de chaves." });
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
          }),
          signal: AbortSignal.timeout(12000)
        });

        if (!testRes.ok) {
          const errText = await testRes.text();
          let errJson: any = null;
          try { errJson = JSON.parse(errText); } catch {}
          const rawMsg = errJson?.error?.message || errJson?.message || errText || `Erro HTTP ${testRes.status}`;

          if (rawMsg.toLowerCase().includes('user not found') || testRes.status === 401) {
            return res.status(401).json({
              error: "Chave OpenRouter não encontrada ou não autorizada na sua conta ('User not found'). Acesse openrouter.ai/keys para criar ou copiar uma chave válida e ativa."
            });
          }

          if (testRes.status === 429 || rawMsg.toLowerCase().includes('rate limit') || rawMsg.toLowerCase().includes('quota')) {
            return res.status(429).json({
              error: `Cota ou limite excedido no OpenRouter (429): ${rawMsg.slice(0, 150)}`
            });
          }

          return res.status(testRes.status).json({ 
            error: rawMsg
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
      let rawKey = (queryKey || authHeader || '').trim().replace(/^["']+|["']+$/g, '');

      // Se nenhuma chave foi passada explicitamente, tentar a chave ativa do pool ou da configuração
      if (!rawKey) {
        rawKey = (openrouterKeysManager.getActiveKey() || providersManager.getOpenRouterKey() || '').trim().replace(/^["']+|["']+$/g, '');
      }

      if (!rawKey) {
        return res.json({ 
          success: false,
          notConfigured: true,
          error: "Nenhuma chave OpenRouter cadastrada. Adicione uma chave (sk-or-v1-...) para ver as métricas.",
          openrouterStats: openrouterKeysManager.getStats()
        });
      }

      let baseUrl = (providersManager.getOpenRouterBaseUrl() || 'https://openrouter.ai/api/v1').trim();
      if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
      if (!baseUrl.includes('/api/v1')) {
        baseUrl = `${baseUrl}/api/v1`;
      }

      // Preparar lista de chaves a tentar: chave solicitada primeiro, seguida das demais chaves ativas do pool
      const poolKeys = openrouterKeysManager.getAllFreeKeys();
      const keysToTry = [rawKey, ...poolKeys].filter((k, i, self) => k && k.length >= 8 && self.indexOf(k) === i);

      let keyData: any = null;
      let creditsData: any = null;
      let lastErrorMessage = '';
      let successfulKey = '';

      for (const currentKey of keysToTry) {
        try {
          const keyRes = await fetch(`${baseUrl}/auth/key`, {
            method: 'GET',
            headers: {
              "Authorization": `Bearer ${currentKey}`,
              "HTTP-Referer": "https://postforge.app",
              "X-Title": "PostForge"
            },
            signal: AbortSignal.timeout(8000)
          });

          const keyText = await keyRes.text();
          let parsed: any = null;
          try { parsed = JSON.parse(keyText); } catch {}

          if (keyRes.ok) {
            keyData = parsed?.data || parsed;
            successfulKey = currentKey;
            lastErrorMessage = '';

            // Consultar saldo de créditos (/credits)
            try {
              const creditsRes = await fetch(`${baseUrl}/credits`, {
                method: 'GET',
                headers: {
                  "Authorization": `Bearer ${currentKey}`,
                  "HTTP-Referer": "https://postforge.app",
                  "X-Title": "PostForge"
                },
                signal: AbortSignal.timeout(6000)
              });
              if (creditsRes.ok) {
                const credText = await creditsRes.text();
                const credParsed = JSON.parse(credText);
                creditsData = credParsed?.data || credParsed;
              }
            } catch (err: any) {
              console.warn("[OpenRouter Quota] Aviso ao consultar créditos:", err.message);
            }

            break; // Chave válida encontrada!
          } else {
            const rawMsg = parsed?.error?.message || parsed?.message || keyText || `HTTP ${keyRes.status}`;
            if (keyRes.status === 401 || rawMsg.toLowerCase().includes('user not found')) {
              openrouterKeysManager.markExhausted(currentKey, 'Chave não encontrada na conta (User not found)');
              lastErrorMessage = "Chave OpenRouter não encontrada ou não autorizada na sua conta ('User not found'). Verifique suas chaves no painel openrouter.ai/keys.";
            } else if (keyRes.status === 429 || rawMsg.toLowerCase().includes('quota') || rawMsg.toLowerCase().includes('rate limit')) {
              openrouterKeysManager.markExhausted(currentKey, `Cota esgotada (429): ${rawMsg.slice(0, 100)}`);
              lastErrorMessage = `Cota esgotada na chave OpenRouter (429): ${rawMsg.slice(0, 150)}`;
            } else {
              lastErrorMessage = rawMsg;
            }
          }
        } catch (fetchErr: any) {
          lastErrorMessage = fetchErr.name === 'TimeoutError' ? 'Tempo limite esgotado ao contatar OpenRouter (8s)' : (fetchErr.message || 'Falha de conexão com a API OpenRouter');
        }
      }

      if (!keyData && !creditsData) {
        return res.json({
          success: false,
          error: lastErrorMessage || 'Não foi possível validar a chave junto ao OpenRouter. Verifique se as chaves sk-or-v1-... estão corretas no painel openrouter.ai/keys.',
          openrouterStats: openrouterKeysManager.getStats()
        });
      }

      return res.json({
        success: true,
        keyInfo: keyData,
        creditsInfo: creditsData,
        activeKey: successfulKey ? (successfulKey.length > 10 ? `${successfulKey.substring(0, 8)}...${successfulKey.substring(successfulKey.length - 4)}` : 'Ativa') : undefined,
        openrouterStats: openrouterKeysManager.getStats()
      });
    } catch (error: any) {
      console.error("OpenRouter Quota Handler Error:", error);
      return res.json({ 
        success: false, 
        error: error.message || "Erro ao consultar cota do OpenRouter" 
      });
    }
  };

  app.get("/api/providers/openrouter/quota", handleOpenRouterQuota);
  app.post("/api/providers/openrouter/quota", handleOpenRouterQuota);
  app.get("/api/providers/openrouter-quota", handleOpenRouterQuota);
  app.post("/api/providers/openrouter-quota", handleOpenRouterQuota);

  // Rota para consulta de cota, saldo e limites da chave Groq Cloud
  const handleGroqQuota = async (req: express.Request, res: express.Response) => {
    try {
      const queryKey = (req.query.apiKey as string) || (req.body?.apiKey as string);
      const authHeader = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      let rawKey = (queryKey || authHeader || '').trim().replace(/^["']+|["']+$/g, '');

      if (!rawKey) {
        rawKey = (groqKeysManager.getActiveKey() || providersManager.getGroqKey() || '').trim().replace(/^["']+|["']+$/g, '');
      }

      if (!rawKey) {
        return res.json({ 
          success: false,
          notConfigured: true,
          error: "Nenhuma chave Groq cadastrada. Adicione uma chave (gsk_...) para ver as métricas.",
          groqStats: groqKeysManager.getStats()
        });
      }

      const verifyResult = await groqKeysManager.verifySingleKey(rawKey);

      return res.json({
        success: verifyResult.active,
        error: verifyResult.active ? undefined : verifyResult.message,
        keyInfo: {
          status: verifyResult.status,
          message: verifyResult.message,
          requestsRemaining: verifyResult.requestsRemaining,
          requestsLimit: verifyResult.requestsLimit,
          tokensRemaining: verifyResult.tokensRemaining,
          tokensLimit: verifyResult.tokensLimit,
          resetRequests: verifyResult.resetRequests,
          resetTokens: verifyResult.resetTokens
        },
        activeKey: rawKey.length > 10 ? `${rawKey.substring(0, 7)}...${rawKey.substring(rawKey.length - 4)}` : 'Ativa',
        groqStats: groqKeysManager.getStats()
      });
    } catch (error: any) {
      console.error("Groq Quota Handler Error:", error);
      return res.json({ 
        success: false, 
        error: error.message || "Erro ao consultar cota do Groq" 
      });
    }
  };

  app.get("/api/providers/groq/quota", handleGroqQuota);
  app.post("/api/providers/groq/quota", handleGroqQuota);
  app.get("/api/providers/groq-quota", handleGroqQuota);
  app.post("/api/providers/groq-quota", handleGroqQuota);

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
        failoverReason: result.failoverReason,
        elapsedMs: result.elapsedMs,
        logs: result.logs
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
        failoverReason: result.failoverReason,
        elapsedMs: result.elapsedMs,
        logs: result.logs
      });
    } catch (error: any) {
      console.error("Analyze Error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // ==========================================
  // CLONADOR DE VÍDEOS DO INSTAGRAM (REELS & POSTS)
  // ==========================================
  
  // 1. Buscar Metadados / Link Direto do Vídeo do Instagram
  app.post("/api/cloner/fetch-instagram", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ error: "URL do Instagram é obrigatória." });
      }

      const cleanUrl = url.trim().split('?')[0];
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      };

      try {
        const response = await fetch(cleanUrl, { headers, redirect: 'follow' });
        const html = await response.text();

        // Extrair meta tags OpenGraph
        const videoMatch = html.match(/<meta\s+(?:property|name)=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:video(?::secure_url)?["']/i);
        const imageMatch = html.match(/<meta\s+(?:property|name)=["']og:image["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["']og:image["']/i);
        const titleMatch = html.match(/<meta\s+(?:property|name)=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                           html.match(/<title>([^<]+)<\/title>/i);

        let videoUrl = videoMatch ? videoMatch[1].replace(/&amp;/g, '&') : null;
        const thumbnailUrl = imageMatch ? imageMatch[1].replace(/&amp;/g, '&') : null;
        const title = titleMatch ? titleMatch[1].replace(/&amp;/g, '&') : "Vídeo do Instagram";

        // Tentar extrair do JSON embutido se não achou no meta
        if (!videoUrl) {
          const jsonVideoMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/i) || html.match(/"browser_native_hd_url"\s*:\s*"([^"]+)"/i) || html.match(/"browser_native_sd_url"\s*:\s*"([^"]+)"/i);
          if (jsonVideoMatch) {
            videoUrl = JSON.parse(`"${jsonVideoMatch[1]}"`);
          }
        }

        if (videoUrl) {
          return res.json({
            success: true,
            videoUrl,
            thumbnailUrl,
            title,
            sourceUrl: cleanUrl
          });
        }
      } catch (scrapeErr: any) {
        console.warn("[Cloner Fetch] Aviso ao tentar scrape público:", scrapeErr.message);
      }

      // Se não encontrou o vídeo diretamente pelo HTML (exige login do Instagram), retorna instrução para captura via Webview
      return res.json({
        success: true,
        loginRequired: true,
        title: "Reel / Post do Instagram",
        sourceUrl: cleanUrl,
        message: "O Instagram protegeu este vídeo para visualização interna. Utilize o Navegador Embutido ao lado para assistir e capturar com 1 clique!"
      });
    } catch (error: any) {
      console.error("Fetch Instagram Error:", error);
      res.status(500).json({ error: error.message || "Erro ao consultar URL do Instagram." });
    }
  });

  // 2. Transcrever Diálogos & Clonar Conteúdo com IA
  app.post("/api/cloner/transcribe-and-clone", async (req, res) => {
    try {
      const {
        videoData,
        mimeType,
        transcriptInput,
        targetNiche = "Psicologia",
        targetTone = "Acolhedor / Compassivo",
        cloneObjective = "Clonagem com adaptação autoral e retenção viral",
        provider: reqProvider,
        model: reqModel
      } = req.body;

      let prompt = `Você é o maior especialista e estrategista do mundo em Engenharia Reversa de Conteúdo Viral e Roteirização para Instagram (Reels, Vídeos Curtos e Carrosséis).

Sua missão é realizar a CLONAGEM INTELIGENTE deste vídeo.
${videoData ? "1. Analise o áudio, expressões e todas as falas deste vídeo para transcrever fielmente todos os diálogos." : transcriptInput ? `1. Analise a seguinte transcrição/conteúdo original fornecido:\n\"\"\"\n${transcriptInput}\n\"\"\"` : "1. Analise o conteúdo fornecido."}

2. DESCONSTRUA o padrão viral do vídeo:
   - Gancho inicial (primeiros 3 segundos que retêm o espectador)
   - Gatilho emocional / Ponto de virada
   - Tese principal de aprendizado
   - Call to action (CTA)

3. CRIE A VERSÃO CLONADA E OTIMIZADA (AUTORAL):
   - Nicho de Destino: "${targetNiche}"
   - Tom de Voz Desejado: "${targetTone}"
   - Objetivo: "${cloneObjective}"
   - REGRA OBRIGATÓRIA: Nas falas dos diálogos, NUNCA coloque prefixos com nomes de personagens (ex: NÃO faça "Coração: ..."). O balão/fala deve conter APENAS o texto falado. A indicação de quem fala deve ir na descrição da cena!

Retorne sua resposta ESTRITAMENTE em formato JSON VÁLIDO (sem comentários e sem texto fora do JSON) com esta estrutura exata:
{
  "transcricao_original": {
    "dialogo_completo": "Transcrição integral e fiel de todas as falas do narrador ou personagens no vídeo...",
    "gancho_identificado": "A frase ou gancho inicial que abriu o vídeo original...",
    "analise_retencao": "Explicação estratégica de por que este vídeo engaja e como retém o público..."
  },
  "roteiro_clonado_video": {
    "titulo_sugerido": "Título forte e magnético do novo roteiro",
    "gancho_novo": "Gancho inicial de abertura para os primeiros 3 segundos",
    "cenas": [
      {
        "numero_cena": 1,
        "enquadramento": "Close-up / Médio / Amplo",
        "acao_visual": "Descrição detalhada do cenário, personagens, postura e emoções...",
        "fala": "Texto falado nesta cena com impacto e naturalidade...",
        "prompt_imagem_en": "Detailed cinematic prompt in English for AI image generator matching the scene, photorealistic or consistent animation style, highly detailed, 8k..."
      }
    ],
    "cta_final": "Chamada para ação final de alto engajamento"
  },
  "carrossel_adaptado": {
    "titulo_carrossel": "Título do Carrossel adaptado",
    "slides": [
      {
        "slide_numero": 1,
        "tipo": "Capa",
        "titulo_slide": "Frase de impacto da capa do carrossel",
        "conteudo_texto": "Texto curto de apoio...",
        "prompt_imagem_en": "Prompt em inglês para imagem da capa..."
      },
      {
        "slide_numero": 2,
        "tipo": "Desenvolvimento",
        "titulo_slide": "Passo 1 / Insight Central",
        "conteudo_texto": "Explicação profunda e direta ao ponto...",
        "prompt_imagem_en": "Prompt em inglês para imagem do slide..."
      },
      {
        "slide_numero": 3,
        "tipo": "Desenvolvimento",
        "titulo_slide": "Passo 2 / Quebra de Padrão",
        "conteudo_texto": "Explicação adicional...",
        "prompt_imagem_en": "Prompt em inglês..."
      },
      {
        "slide_numero": 4,
        "tipo": "CTA",
        "titulo_slide": "Salve para não esquecer",
        "conteudo_texto": "Comente abaixo o que você achou e compartilhe com alguém que precisa ouvir isso.",
        "prompt_imagem_en": "Prompt em inglês para slide final..."
      }
    ]
  },
  "legenda_instagram": {
    "gancho": "Primeira linha irresistível da legenda (para fazer clicar em 'mais')...",
    "corpo": "Texto completo da legenda com quebras de linha elegantes, espaçamento limpo e emojis estratégicos...",
    "cta": "Chamada clara para comentar ou salvar...",
    "hashtags": ["#nicho", "#instagram", "#viral", "#conteudo"]
  }
}`;

      const result = await aiService.analyze({
        prompt,
        videoData,
        mimeType: mimeType || 'video/mp4',
        provider: reqProvider,
        model: reqModel
      });

      // Tratar e converter o texto retornado para JSON
      let cleanedJson = result.text.trim();
      if (cleanedJson.startsWith("```json")) {
        cleanedJson = cleanedJson.replace(/^```json\s*/, "").replace(/\s*```$/, "");
      } else if (cleanedJson.startsWith("```")) {
        cleanedJson = cleanedJson.replace(/^```\s*/, "").replace(/\s*```$/, "");
      }

      let parsedData: any = null;
      try {
        parsedData = JSON.parse(cleanedJson);
      } catch (parseErr) {
        // Tentar extrair primeiro bloco JSON
        const firstBrace = cleanedJson.indexOf('{');
        const lastBrace = cleanedJson.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          try {
            parsedData = JSON.parse(cleanedJson.substring(firstBrace, lastBrace + 1));
          } catch {}
        }
      }

      if (!parsedData) {
        parsedData = {
          raw_text: result.text,
          transcricao_original: {
            dialogo_completo: result.text.substring(0, 500) + "...",
            gancho_identificado: "Gancho extraído da análise",
            analise_retencao: "Vídeo analisado pela IA com foco em retenção."
          },
          roteiro_clonado_video: {
            titulo_sugerido: "Roteiro Clonado",
            gancho_novo: "Você já se sentiu assim?",
            cenas: [
              {
                numero_cena: 1,
                enquadramento: "Close-up",
                acao_visual: "Personagem expressivo",
                fala: "Este é o novo roteiro adaptado para o seu público.",
                prompt_imagem_en: "Cinematic portrait, expressive character, high resolution"
              }
            ],
            cta_final: "Siga para mais reflexões."
          },
          carrossel_adaptado: {
            titulo_carrossel: "Carrossel Clonado",
            slides: []
          },
          legenda_instagram: {
            gancho: "Você precisa ler isso hoje.",
            corpo: result.text,
            cta: "Salve este post.",
            hashtags: ["#conteudo", "#psicologia"]
          }
        };
      }

      res.json({
        success: true,
        data: parsedData,
        provider: result.provider,
        model: result.model,
        failoverUsed: result.failoverUsed,
        elapsedMs: result.elapsedMs
      });
    } catch (error: any) {
      console.error("Transcribe and Clone Error:", error);
      res.status(500).json({ error: error.message || "Erro ao transcrever e clonar vídeo." });
    }
  });

  // Funções Auxiliares de Extração Resiliente de Documentos
  async function extractPdfTextSafe(buffer: Buffer): Promise<string> {
    try {
      // 0. Verificação instantânea de payload lossless incorporado do PostForge
      const rawText = buffer.toString("binary");
      const payloadMatch = rawText.match(/POSTFORGE_PAYLOAD:([A-Za-z0-9+/=]+)/);
      if (payloadMatch) {
        try {
          const decodedJson = Buffer.from(payloadMatch[1], "base64").toString("utf-8");
          if (decodedJson && (decodedJson.startsWith("{") || decodedJson.startsWith("["))) {
            return decodedJson;
          }
        } catch {}
      }

      const parsePromise = (async () => {
        const pdfModule: any = await import("pdf-parse");
        const PDFParseClass = pdfModule.PDFParse || (pdfModule.default && pdfModule.default.PDFParse) || (typeof pdfModule.default === 'function' && pdfModule.default.prototype?.getText ? pdfModule.default : null) || pdfModule;
        
        if (PDFParseClass && typeof PDFParseClass === 'function') {
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
        }

        const parseFn = typeof pdfModule === 'function' 
          ? pdfModule 
          : (typeof pdfModule.default === 'function' ? pdfModule.default : (pdfModule.pdf || pdfModule.default?.pdf));

        if (typeof parseFn === 'function') {
          const pdfData = await parseFn(buffer);
          if (pdfData && pdfData.text && pdfData.text.trim()) {
            return pdfData.text.trim();
          }
        }

        return "";
      })();

      const timeoutPromise = new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error("Timeout ao processar PDF via pdf-parse (8s)")), 8000)
      );

      const parsedText = await Promise.race([parsePromise, timeoutPromise]);
      if (parsedText && parsedText.trim().length > 0) {
        return parsedText.trim();
      }
    } catch (err: any) {
      console.warn("[PDF Parser] Aviso no extrator principal:", err.message);
    }

    // Fallback de descompressão de streams FlateDecode com zlib
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
          // Capturar operadores Tj diretos: (Texto) Tj
          const tjRegex = /\(([^()]{1,800})\)\s*T[jJ]/g;
          let m: RegExpExecArray | null;
          while ((m = tjRegex.exec(decompressed)) !== null) {
            if (m[1]) extractedChunks.push(m[1]);
          }

          // Capturar matrizes TJ: [(Texto) -10 (Mais)] TJ com espaçamento adequado entre palavras
          const tjArrayRegex = /\[([^\[\]]{1,1500})\]\s*TJ/g;
          while ((m = tjArrayRegex.exec(decompressed)) !== null) {
            const inner = m[1];
            const innerMatches = inner.match(/\(([^()]+)\)/g);
            if (innerMatches) {
              extractedChunks.push(innerMatches.map(im => im.slice(1, -1)).join(" "));
            }
          }
        }
      }

      if (extractedChunks.length > 0) {
        const decoded = extractedChunks
          .join(" ")
          .replace(/\\([0-9]{3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
          .replace(/\\[rnbtf]/g, " ")
          .replace(/\\/g, "")
          .replace(/ +/g, " ")
          .trim();
        if (decoded.length > 10) {
          return decoded;
        }
      }
    } catch (rawErr: any) {
      console.warn("[PDF Parser] Falha no fallback direto:", rawErr.message);
    }

    return "";
  }

  async function extractDocxTextSafe(buffer: Buffer): Promise<string> {
    try {
      const mammothModule: any = await import("mammoth");
      const mammoth = mammothModule.default || mammothModule;
      const result = await mammoth.extractRawText({ buffer });
      if (result && result.value && result.value.trim()) {
        return result.value.trim();
      }
    } catch (docxErr: any) {
      console.warn("[DOCX Parser] Fallback mammoth:", docxErr.message);
    }

    try {
      const jszipModule: any = await import("jszip");
      const JSZip = jszipModule.default || jszipModule;
      const zip = await JSZip.loadAsync(buffer);
      const docXml = await zip.file("word/document.xml")?.async("string");
      if (docXml) {
        const text = docXml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        if (text) return text;
      }
    } catch (zipErr: any) {
      console.warn("[DOCX Parser] Fallback jszip:", zipErr.message);
    }

    return buffer.toString("utf-8").replace(/[^\x20-\x7E\n\r\t\u00C0-\u00FF]/g, " ").trim();
  }

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
        extractedText = await extractPdfTextSafe(buffer);
      } else if (name.endsWith(".docx") || name.endsWith(".doc") || mimeType?.includes("wordprocessingml") || mimeType?.includes("msword")) {
        extractedText = await extractDocxTextSafe(buffer);
      } else {
        // Arquivos de texto (.txt, .md, .json, .csv, .srt, .vtt, etc.)
        extractedText = buffer.toString("utf-8");
      }

      extractedText = extractedText.trim();
      const wordCount = extractedText ? extractedText.split(/\s+/).filter(Boolean).length : 0;

      if (!extractedText) {
        return res.status(400).json({
          success: false,
          error: `Não foi possível extrair texto legível de "${filename || 'documento'}". Certifique-se de que o documento não esteja protegido por senha ou contenha apenas imagens escaneadas sem camada de texto.`
        });
      }

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
      const { images, characterReferenceImages, scriptContext, characterNotes, provider: reqProvider, model: reqModel } = req.body;
      
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Nenhuma imagem foi fornecida para auditoria." });
      }

      if (!scriptContext || typeof scriptContext !== 'string' || !scriptContext.trim()) {
        return res.status(400).json({ error: "O contexto do roteiro / slides é obrigatório." });
      }

      const parts: any[] = [];
      const hasReferenceImages = Array.isArray(characterReferenceImages) && characterReferenceImages.length > 0;

      const promptText = `Você é um Diretor de Arte Cinematográfico, Auditor Visual Sênior e Especialista em Storyboard e Consistência de Personagens para Instagram.
Sua missão é realizar uma Auditoria Visual e Mapeamento de Alta Precisão das imagens geradas, associando cada imagem ao Slide/Cena exato do roteiro que ela representa${hasReferenceImages ? ' e avaliando a consistência anatômica/estilística contra as IMAGENS DE REFERÊNCIA OFICIAIS DO PERSONAGEM enviadas' : ''}.

=== ROTEIRO / SEQUÊNCIA DE SLIDES ESPERADA ===
${scriptContext.trim()}

${characterNotes ? `=== DIRETRIZES DE ESTILO E PERSONAGEM ===\n${characterNotes.trim()}\n` : ''}

=== PROTOCOLO DE ALTA PRECISÃO PARA MAPEAMENTO E AUDITORIA ===
⚠️ ATENÇÃO CRÍTICA:
1. NÃO ASSUMA QUE A IMAGEM 1 É O SLIDE 1: As imagens geradas foram enviadas em ordem arbitrária/aleatória. Você DEVE inspecionar profundamente o conteúdo visual de CADA imagem e cruzar com os requisitos de cada slide.
2. CRITÉRIOS DE CORRESPONDÊNCIA OBRIGATÓRIOS:
   - PERSONAGENS & EXPRESSÕES: Verifique quem está na imagem (Coração, Cérebro, Humano, etc.) e a emoção retratada (choro, sorriso, espanto, serenidade, raiva, dúvida).
   - AÇÕES & OBJETOS EM CENA: Verifique adereços e ações específicos descritos no prompt de cada slide (ex: segurando lupa, mapa, espelho, debaixo de chuva, na frente de uma porta, olhando as estrelas).
   - CENÁRIO & ILUMINAÇÃO: Verifique o ambiente (quarto escuro, rua movimentada, floresta, fundo minimalista, luz dourada, tempestade).
   - PROGRESSÃO DRAMÁTICA: A sequência 1 -> 2 -> 3... deve contar a história do roteiro do começo ao fim sem saltos temporais incoerentes.
3. REGRA DE EXCLUSIVIDADE: Cada imagem do lote só pode ser alocada a no máximo 1 slide. Não repita o mesmo arquivo de imagem em slides diferentes.
4. IMAGENS SOBRESSALENTES: Se houver mais imagens do que slides (ou imagens de testes/descartes), aloque apenas as melhores para os slides e liste as restantes na seção "imagens_sobressalentes" com o motivo claro.
5. JUSTIFICATIVA EXPLÍCITA: No campo "elementos_visuais_identificados", liste os elementos específicos vistos na imagem que comprovam a escolha daquele slide.

Responda ESTRITAMENTE em formato JSON aderente ao esquema fornecido.`;

      parts.push({ text: promptText });

      // Se houver imagens de referência do personagem, adicioná-las primeiro
      if (hasReferenceImages) {
        parts.push({
          text: `\n=== IMAGENS DE REFERÊNCIA OFICIAIS DO PERSONAGEM / ESTILO ===\nEstas são as imagens modelo de referência OFICIAL fornecidas pelo criador para balizar o personagem principal:\n`
        });
        characterReferenceImages.forEach((refImg: { name: string; mimeType: string; data: string }, rIdx: number) => {
          parts.push({
            text: `\n--- [PERSONAGEM DE REFERÊNCIA OFICIAL ${rIdx + 1}: ARQUIVO "${refImg.name}"] ---`
          });
          parts.push({
            inlineData: {
              mimeType: refImg.mimeType || 'image/png',
              data: refImg.data.includes('base64,') ? refImg.data.split('base64,')[1] : refImg.data
            }
          });
          parts.push({
            text: `--- [FIM DO PERSONAGEM DE REFERÊNCIA ${rIdx + 1}] ---\n`
          });
        });
      }

      // Imagens do lote a serem auditadas e organizadas
      parts.push({
        text: `\n=== LOTE DE IMAGENS GERADAS A SEREM AUDITADAS E MAPEADAS (${images.length} IMAGENS) ===\nInspecione cada arquivo detalhadamente antes de decidir para qual slide ele pertence:\n`
      });

      images.forEach((img: { name: string; mimeType: string; data: string }, index: number) => {
        parts.push({
          text: `\n--- [INÍCIO DA IMAGEM GERADA #${index + 1} | NOME DO ARQUIVO: "${img.name}"] ---`
        });
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/png',
            data: img.data.includes('base64,') ? img.data.split('base64,')[1] : img.data
          }
        });
        parts.push({
          text: `--- [FIM DA IMAGEM GERADA #${index + 1}: "${img.name}"] ---\n`
        });
      });

      const responseSchema = {
        type: "OBJECT",
        properties: {
          nome_sugerido_projeto: {
            type: "STRING",
            description: "Slug limpo sem acentos ou caracteres especiais para nomear o arquivo ZIP, ex: Ansiedade_Guia_Pratico"
          },
          resumo_geral_consistencia: { 
            type: "STRING", 
            description: "Resumo executivo sobre a consistência dos personagens, estilo artístico, paleta e iluminação de toda a sequência." 
          },
          pontuacao_media_geral: { 
            type: "STRING", 
            description: "Média percentual de consistência e alinhamento de toda a sequência, ex: 94%" 
          },
          auditoria_imagens: {
            type: "ARRAY",
            description: "Lista ordenada sequencialmente dos slides (1, 2, 3...) com suas respectivas imagens mapeadas com máxima precisão",
            items: {
              type: "OBJECT",
              properties: {
                slide_numero: { type: "INTEGER", description: "Número sequencial do slide (1, 2, 3...)" },
                descricao_esperada: { type: "STRING", description: "Resumo do que era esperado neste slide de acordo com o roteiro/prompt" },
                imagem_arquivo_correspondente: { type: "STRING", description: "Nome exato do arquivo de imagem correspondente selecionado para este slide" },
                elementos_visuais_identificados: { type: "STRING", description: "Elementos visuais concretos encontrados na imagem que comprovam a correspondência com o slide (personagem, objetos, emoção, cenário)" },
                pontuacao_consistencia: { type: "STRING", description: "Porcentagem de correspondência e consistência, ex: 95%" },
                feedback_visual: { type: "STRING", description: "Análise crítica da fidelidade visual e narrativa da imagem em relação ao roteiro" },
                destaque_pontos_fortes: { 
                  type: "ARRAY", 
                  items: { type: "STRING" },
                  description: "Pontos fortes visuais, de consistência e impacto" 
                },
                alertas_inconsistencia: { 
                  type: "ARRAY", 
                  items: { type: "STRING" },
                  description: "Eventuais pequenas divergências visuais ou recomendações" 
                }
              },
              required: ["slide_numero", "descricao_esperada", "imagem_arquivo_correspondente", "elementos_visuais_identificados", "pontuacao_consistencia", "feedback_visual"]
            }
          },
          imagens_sobressalentes: {
            type: "ARRAY",
            description: "Imagens que sobraram e não foram alocadas a nenhum slide",
            items: {
              type: "OBJECT",
              properties: {
                nome_arquivo: { type: "STRING", description: "Nome do arquivo não utilizado" },
                motivo_descarte: { type: "STRING", description: "Motivo detalhado pelo qual a imagem foi descartada ou substituída na sequência final" }
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

  // API Route - SUPER AUDITOR MULTI-PROJETOS (Separa múltiplos roteiros e distribui imagens misturadas)
  app.post("/api/audit-multi-projects", async (req, res) => {
    try {
      const { images, characterReferenceImages, scriptsText, characterNotes, provider: reqProvider, model: reqModel } = req.body;
      
      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Nenhuma imagem foi fornecida para auditoria multi-projetos." });
      }

      if (!scriptsText || typeof scriptsText !== 'string' || !scriptsText.trim()) {
        return res.status(400).json({ error: "O texto dos roteiros é obrigatório." });
      }

      const parts: any[] = [];
      const promptText = `Você é um Diretor de Arte Executivo Sênior e Especialista em Clusterização Semântica e Visão Computacional.
O usuário enviou um LOTE GERAL com VÁRIAS IMAGENS MISTURADAS (${images.length} imagens) e UM OU MÚLTIPLOS ROTEIROS DE CARROSSEL / VÍDEO.

Sua missão é executar o PROTOCOLO DE AUTO-SEPARAÇÃO & CLUSTERIZAÇÃO EM LARGA ESCALA:
1. IDENTIFICAÇÃO DE PROJETOS: Analise o texto de entrada e identifique quantos projetos/roteiros distintos foram fornecidos. Dê um "titulo_projeto" claro e um "nome_arquivo_zip_sugerido" (slug limpo, sem acentos ou espaços, ex: "Ansiedade_Guia_Pratico", "Treino_Hipertrofia_Iniciante", "Top10_Filmes_Suspense").
2. CLUSTERIZAÇÃO DE IMAGENS: Para CADA projeto identificado, inspecione todas as imagens do lote geral e descubra quais imagens pertencem especificamente àquele roteiro (personagens, cenário, estilo e contexto).
3. ORDENAÇÃO CRONOLÓGICA: Ordene as imagens de cada projeto exatamente na sequência de slides 1, 2, 3... da sua narrativa.
4. ELEMENTOS IDENTIFICADOS: Preencha o campo "elementos_visuais_identificados" com os traços visuais concretos que comprovam a alocação daquela imagem naquele slide.
5. SOBRESSALENTES: Se houver imagens extras do mesmo tema que não entraram nos slides principais, coloque na lista "imagens_sobressalentes" daquele projeto.
6. EXCLUSIVIDADE ABSOLUTA: Cada arquivo de imagem só pode ser atribuído a no máximo 1 slide de 1 projeto.

=== TEXTO DOS ROTEIROS FORNECIDOS ===
${scriptsText.trim()}

${characterNotes ? `=== DIRETRIZES DE PERSONAGENS / NOTAS GERAIS ===\n${characterNotes.trim()}\n` : ''}

=== LOTE GERAL DE IMAGENS A SEREM CLUSTERIZADAS E ORDENADAS (${images.length} IMAGENS) ===
Analise cada imagem abaixo e distribua entre os projetos identificados:`;

      parts.push({ text: promptText });

      // Se houver imagens de referência
      if (Array.isArray(characterReferenceImages) && characterReferenceImages.length > 0) {
        parts.push({
          text: `\n=== IMAGENS DE REFERÊNCIA OFICIAIS DE PERSONAGENS ===\n`
        });
        characterReferenceImages.forEach((refImg: any, rIdx: number) => {
          parts.push({ text: `\n[REFERÊNCIA OFICIAL ${rIdx + 1}: "${refImg.name}"]` });
          parts.push({
            inlineData: {
              mimeType: refImg.mimeType || 'image/png',
              data: refImg.data.includes('base64,') ? refImg.data.split('base64,')[1] : refImg.data
            }
          });
        });
      }

      // Adicionar todas as imagens enviadas
      images.forEach((img: { name: string; mimeType: string; data: string }, index: number) => {
        parts.push({
          text: `\n--- [IMAGEM DO LOTE #${index + 1} | ARQUIVO: "${img.name}"] ---`
        });
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/png',
            data: img.data.includes('base64,') ? img.data.split('base64,')[1] : img.data
          }
        });
        parts.push({
          text: `--- [FIM DA IMAGEM #${index + 1}: "${img.name}"] ---\n`
        });
      });

      const responseSchema = {
        type: "OBJECT",
        properties: {
          resumo_geral_auditoria: { 
            type: "STRING", 
            description: "Visão geral sobre a clusterização, quantidade de projetos identificados e aproveitamento das imagens." 
          },
          projetos: {
            type: "ARRAY",
            description: "Lista de todos os projetos/roteiros identificados com suas respectivas imagens clusterizadas e ordenadas",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING", description: "ID único do projeto, ex: proj_1, proj_2" },
                titulo_projeto: { type: "STRING", description: "Título claro do roteiro/projeto identificado, ex: Psicologia: Ansiedade Infantil" },
                nome_arquivo_zip_sugerido: { type: "STRING", description: "Slug limpo sem acentos ou caracteres especiais para nomear o arquivo .zip, ex: Ansiedade_Infantil_Guia" },
                resumo_narrativo: { type: "STRING", description: "Breve resumo do que este projeto/carrossel trata" },
                pontuacao_media: { type: "STRING", description: "Pontuação média de consistência deste projeto, ex: 94%" },
                roteiro_associado: { type: "STRING", description: "Trecho do roteiro identificado que pertence a este projeto" },
                slides_ordenados: {
                  type: "ARRAY",
                  description: "Sequência cronológica de slides deste projeto",
                  items: {
                    type: "OBJECT",
                    properties: {
                      slide_numero: { type: "INTEGER", description: "Número sequencial do slide (1, 2, 3...)" },
                      imagem_arquivo_correspondente: { type: "STRING", description: "Nome exato do arquivo de imagem selecionado para este slide" },
                      descricao_esperada: { type: "STRING", description: "Descrição do que ocorre neste slide" },
                      feedback_visual: { type: "STRING", description: "Análise crítica de por que esta imagem foi alocada aqui" },
                      elementos_visuais_identificados: { type: "STRING", description: "Elementos visuais identificados na imagem (personagem, emoção, cenário, objetos)" },
                      pontuacao_consistencia: { type: "STRING", description: "Pontuação de consistência, ex: 95%" }
                    },
                    required: ["slide_numero", "imagem_arquivo_correspondente", "descricao_esperada", "feedback_visual", "elementos_visuais_identificados", "pontuacao_consistencia"]
                  }
                },
                imagens_sobressalentes: {
                  type: "ARRAY",
                  description: "Imagens que pertencem ao tema deste projeto mas não entraram na sequência ativa",
                  items: {
                    type: "OBJECT",
                    properties: {
                      nome_arquivo: { type: "STRING", description: "Nome do arquivo" },
                      motivo_descarte: { type: "STRING", description: "Motivo de ter ficado como sobressalente" }
                    },
                    required: ["nome_arquivo", "motivo_descarte"]
                  }
                }
              },
              required: ["id", "titulo_projeto", "nome_arquivo_zip_sugerido", "resumo_narrativo", "pontuacao_media", "slides_ordenados"]
            }
          },
          imagens_descartadas_globais: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Imagens que não pertencem a nenhum dos roteiros fornecidos"
          }
        },
        required: ["resumo_geral_auditoria", "projetos"]
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
      console.error("Audit Multi Projects Error:", error);
      res.status(500).json({ error: error.message || "Erro durante auditoria multi-projetos." });
    }
  });

  // API Route - Export Ordered Images ZIP & Save to Downloads
  app.post("/api/export-ordered-zip", async (req, res) => {
    try {
      const { images, surplusImages, reportText, scriptText, customZipName } = req.body;
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ error: "Nenhuma imagem informada para exportação." });
      }

      const zip = new JSZip();
      const imagesFolder = zip.folder("imagens_ordenadas");

      // Adicionar imagens ordenadas
      for (const img of images) {
        if (!img.base64 || !img.filename) continue;
        const cleanBase64 = img.base64.includes('base64,') ? img.base64.split('base64,')[1] : img.base64;
        const safeName = img.filename.replace(/[<>:"/\\|?*]/g, '_');
        imagesFolder?.file(safeName, Buffer.from(cleanBase64, 'base64'));
      }

      // Adicionar imagens sobressalentes se houver
      if (surplusImages && Array.isArray(surplusImages) && surplusImages.length > 0) {
        const surplusFolder = zip.folder("imagens_sobressalentes");
        for (const s of surplusImages) {
          if (!s.base64 || !s.filename) continue;
          const cleanBase64 = s.base64.includes('base64,') ? s.base64.split('base64,')[1] : s.base64;
          const safeName = s.filename.replace(/[<>:"/\\|?*]/g, '_');
          surplusFolder?.file(safeName, Buffer.from(cleanBase64, 'base64'));
        }
      }

      // Adicionar relatório em texto
      if (reportText) {
        zip.file("relatorio_auditoria_postforge.txt", reportText);
      }

      // Adicionar roteiro de referência
      if (scriptText) {
        zip.file("roteiro_referencia.txt", scriptText);
      }

      const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
      const now = new Date();
      const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const zipName = customZipName || `PostForge_Imagens_Sequenciais_${timestamp}.zip`;

      // Salvar na pasta Downloads do usuário
      const userDownloads = path.join(os.homedir(), 'Downloads');
      let savedPath: string | null = null;

      try {
        if (!fs.existsSync(userDownloads)) {
          fs.mkdirSync(userDownloads, { recursive: true });
        }
        const targetFile = path.join(userDownloads, zipName);
        fs.writeFileSync(targetFile, zipBuffer);
        savedPath = targetFile;
        console.log(`[Export Server] ZIP salvo automaticamente na pasta Downloads: ${targetFile}`);
      } catch (saveErr: any) {
        console.warn(`[Export Server] Aviso ao salvar direto em Downloads:`, saveErr.message);
      }

      // Também salvar uma cópia temporária na pasta do projeto se necessário
      const localTempDir = path.join(process.cwd(), 'temp_exports');
      try {
        if (!fs.existsSync(localTempDir)) {
          fs.mkdirSync(localTempDir, { recursive: true });
        }
        fs.writeFileSync(path.join(localTempDir, zipName), zipBuffer);
      } catch {}

      res.json({
        success: true,
        filename: zipName,
        savedPath,
        sizeBytes: zipBuffer.length,
        downloadUrl: `/api/download-temp-zip?file=${encodeURIComponent(zipName)}`
      });
    } catch (error: any) {
      console.error("Export Ordered Zip Error:", error);
      res.status(500).json({ error: error.message || "Erro ao gerar arquivo ZIP das imagens." });
    }
  });

  // Salvar ZIP diretamente via stream binário ultra-rápido (< 20ms)
  app.post("/api/save-zip-stream", express.raw({ type: "*/*", limit: "300mb" }), (req, res) => {
    try {
      const filename = (req.query.name as string) || `PostForge_Imagens_${Date.now()}.zip`;
      const safeName = path.basename(filename).replace(/[<>:"/\\|?*]/g, '_');
      const userDownloads = path.join(os.homedir(), 'Downloads');
      
      if (!fs.existsSync(userDownloads)) {
        fs.mkdirSync(userDownloads, { recursive: true });
      }

      const targetPath = path.join(userDownloads, safeName);
      fs.writeFileSync(targetPath, req.body);
      console.log(`[Export Server Stream] ZIP gravado instantaneamente em Downloads: ${targetPath}`);

      // Salvar temp copy
      const localTempDir = path.join(process.cwd(), 'temp_exports');
      if (!fs.existsSync(localTempDir)) {
        fs.mkdirSync(localTempDir, { recursive: true });
      }
      fs.writeFileSync(path.join(localTempDir, safeName), req.body);

      res.json({
        success: true,
        filename: safeName,
        savedPath: targetPath,
        sizeBytes: (req.body as Buffer).length,
        downloadUrl: `/api/download-temp-zip?file=${encodeURIComponent(safeName)}`
      });
    } catch (err: any) {
      console.error("Save Zip Stream Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // API Route - Baixar arquivo gerado via link HTTP direto
  app.get("/api/download-temp-zip", (req, res) => {
    try {
      const filename = req.query.file as string;
      if (!filename) return res.status(400).send("Filename missing");
      
      const cleanFilename = path.basename(filename);
      const userDownloads = path.join(os.homedir(), 'Downloads');
      const targetDownloads = path.join(userDownloads, cleanFilename);
      const targetTemp = path.join(process.cwd(), 'temp_exports', cleanFilename);

      let targetPath = fs.existsSync(targetDownloads) ? targetDownloads : fs.existsSync(targetTemp) ? targetTemp : null;

      if (targetPath) {
        res.download(targetPath, cleanFilename);
      } else {
        res.status(404).send("Arquivo não encontrado.");
      }
    } catch (e: any) {
      res.status(500).send(e.message);
    }
  });

  // API Route - Abrir pasta de Downloads / Arquivo no Explorer
  app.post("/api/open-folder", (req, res) => {
    try {
      const { targetPath } = req.body;
      const pathToOpen = targetPath || path.join(os.homedir(), 'Downloads');
      
      if (process.platform === 'win32') {
        if (fs.existsSync(pathToOpen) && fs.statSync(pathToOpen).isFile()) {
          exec(`explorer.exe /select,"${pathToOpen.replace(/\//g, '\\')}"`);
        } else {
          exec(`explorer.exe "${pathToOpen.replace(/\//g, '\\')}"`);
        }
      } else if (process.platform === 'darwin') {
        exec(`open "${pathToOpen}"`);
      } else {
        exec(`xdg-open "${pathToOpen}"`);
      }
      res.json({ success: true, opened: pathToOpen });
    } catch (e: any) {
      console.error("Open Folder Error:", e);
      res.status(500).json({ error: e.message });
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
    let distPath = path.join(_currentDir, 'dist');
    if (!fs.existsSync(path.join(distPath, 'index.html'))) {
      if (fs.existsSync(path.join(_currentDir, 'index.html'))) {
        distPath = _currentDir;
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
