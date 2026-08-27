import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { openrouterKeysManager } from './openrouter-keys-manager';
import { groqKeysManager } from './groq-keys-manager';

dotenv.config();

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface GroqConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface GeminiConfig {
  preferredModel: string;
}

export interface ProvidersConfig {
  activeProvider: 'gemini' | 'openrouter' | 'groq';
  openrouter: OpenRouterConfig;
  groq: GroqConfig;
  gemini: GeminiConfig;
}

function getConfigFilepath(): string {
  const localFile = path.join(process.cwd(), 'providers-config.json');
  if (fs.existsSync(localFile)) {
    return localFile;
  }

  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Preferences') : path.join(process.env.HOME || '', '.config'));
  if (appData) {
    const postforgeDir = path.join(appData, 'postforge');
    const oldDir = path.join(appData, 'prompter-nano-banana');
    if (fs.existsSync(path.join(postforgeDir, 'providers-config.json'))) {
      return path.join(postforgeDir, 'providers-config.json');
    }
    if (fs.existsSync(path.join(oldDir, 'providers-config.json'))) {
      return path.join(oldDir, 'providers-config.json');
    }
    return path.join(postforgeDir, 'providers-config.json');
  }

  return localFile;
}

const CONFIG_FILE = getConfigFilepath();

export class ProvidersManager {
  private config: ProvidersConfig = {
    activeProvider: 'gemini',
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      model: process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    },
    gemini: {
      preferredModel: 'gemini-2.5-flash',
    }
  };

  constructor() {
    this.load();
  }

  public load() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        this.config = {
          activeProvider: parsed.activeProvider || 'gemini',
          openrouter: {
            apiKey: parsed.openrouter?.apiKey || process.env.OPENROUTER_API_KEY || '',
            baseUrl: parsed.openrouter?.baseUrl || process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
            model: parsed.openrouter?.model || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
          },
          groq: {
            apiKey: parsed.groq?.apiKey || process.env.GROQ_API_KEY || '',
            baseUrl: parsed.groq?.baseUrl || process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
            model: parsed.groq?.model || process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
          },
          gemini: {
            preferredModel: parsed.gemini?.preferredModel || 'gemini-2.5-flash',
          }
        };
      }
    } catch (e) {
      console.warn('[ProvidersManager] Não foi possível carregar providers-config.json, usando padrão:', e);
    }
  }

  public save() {
    try {
      const dir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');

      const localFile = path.join(process.cwd(), 'providers-config.json');
      if (localFile !== CONFIG_FILE && fs.existsSync(localFile)) {
        try {
          fs.writeFileSync(localFile, JSON.stringify(this.config, null, 2), 'utf-8');
        } catch {}
      }
    } catch (e) {
      console.error('[ProvidersManager] Erro ao salvar providers-config.json:', e);
    }
  }

  public getConfig(): ProvidersConfig {
    return this.config;
  }

  public getActiveProvider(): 'gemini' | 'openrouter' | 'groq' {
    return this.config.activeProvider;
  }

  public getOpenRouterKey(): string {
    const poolKey = (openrouterKeysManager.getActiveKey() || '').trim().replace(/^["']+|["']+$/g, '');
    if (poolKey) return poolKey;

    const directKey = (this.config.openrouter.apiKey || '').trim().replace(/^["']+|["']+$/g, '');
    if (directKey) return directKey;

    return (process.env.OPENROUTER_API_KEY || '').trim().replace(/^["']+|["']+$/g, '');
  }

  public getOpenRouterBaseUrl(): string {
    let url = this.config.openrouter.baseUrl.trim() || (process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').trim();
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    return url;
  }

  public getOpenRouterModel(): string {
    return this.config.openrouter.model.trim() || (process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free').trim();
  }

  public getGroqKey(): string {
    const poolKey = (groqKeysManager.getActiveKey() || '').trim().replace(/^["']+|["']+$/g, '');
    if (poolKey) return poolKey;

    const directKey = (this.config.groq.apiKey || '').trim().replace(/^["']+|["']+$/g, '');
    if (directKey) return directKey;

    return (process.env.GROQ_API_KEY || '').trim().replace(/^["']+|["']+$/g, '');
  }

  public getGroqBaseUrl(): string {
    let url = this.config.groq.baseUrl.trim() || (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').trim();
    if (url.endsWith('/')) {
      url = url.slice(0, -1);
    }
    return url;
  }

  public getGroqModel(): string {
    return this.config.groq.model.trim() || (process.env.GROQ_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct').trim();
  }

  public updateConfig(partial: Partial<ProvidersConfig> & { openrouter?: Partial<OpenRouterConfig>; groq?: Partial<GroqConfig>; gemini?: Partial<GeminiConfig> }) {
    if (partial.activeProvider) {
      this.config.activeProvider = partial.activeProvider;
    }
    if (partial.openrouter) {
      this.config.openrouter = {
        ...this.config.openrouter,
        ...partial.openrouter,
      };
    }
    if (partial.groq) {
      this.config.groq = {
        ...this.config.groq,
        ...partial.groq,
      };
    }
    if (partial.gemini) {
      this.config.gemini = {
        ...this.config.gemini,
        ...partial.gemini,
      };
    }
    this.save();
  }

  public getPublicConfig() {
    const rawOrKey = this.getOpenRouterKey();
    const maskedOrKey = rawOrKey && rawOrKey.length > 8 
      ? `${rawOrKey.substring(0, 7)}...${rawOrKey.substring(rawOrKey.length - 4)}` 
      : (rawOrKey ? '••••••••' : '');

    const rawGroqKey = this.getGroqKey();
    const maskedGroqKey = rawGroqKey && rawGroqKey.length > 8
      ? `${rawGroqKey.substring(0, 7)}...${rawGroqKey.substring(rawGroqKey.length - 4)}`
      : (rawGroqKey ? '••••••••' : '');

    return {
      activeProvider: this.config.activeProvider,
      openrouter: {
        hasKey: !!rawOrKey,
        apiKeyMasked: maskedOrKey,
        baseUrl: this.getOpenRouterBaseUrl(),
        model: this.getOpenRouterModel(),
      },
      groq: {
        hasKey: !!rawGroqKey,
        apiKeyMasked: maskedGroqKey,
        baseUrl: this.getGroqBaseUrl(),
        model: this.getGroqModel(),
      },
      gemini: {
        preferredModel: this.config.gemini.preferredModel,
      }
    };
  }
}

export const providersManager = new ProvidersManager();
