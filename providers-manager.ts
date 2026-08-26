import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { openrouterKeysManager } from './openrouter-keys-manager';

dotenv.config();

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface GeminiConfig {
  preferredModel: string;
}

export interface ProvidersConfig {
  activeProvider: 'gemini' | 'openrouter';
  openrouter: OpenRouterConfig;
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

  public getActiveProvider(): 'gemini' | 'openrouter' {
    return this.config.activeProvider;
  }

  public getOpenRouterKey(): string {
    // Prioridade 1: chave ativa do pool (gerenciada e validada)
    const poolKey = (openrouterKeysManager.getActiveKey() || '').trim().replace(/^["']+|["']+$/g, '');
    if (poolKey) return poolKey;

    // Prioridade 2: chave direta do config (legado)
    const directKey = (this.config.openrouter.apiKey || '').trim().replace(/^["']+|["']+$/g, '');
    if (directKey) return directKey;

    // Prioridade 3: variável de ambiente
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

  public updateConfig(partial: Partial<ProvidersConfig> & { openrouter?: Partial<OpenRouterConfig>; gemini?: Partial<GeminiConfig> }) {
    if (partial.activeProvider) {
      this.config.activeProvider = partial.activeProvider;
    }
    if (partial.openrouter) {
      this.config.openrouter = {
        ...this.config.openrouter,
        ...partial.openrouter,
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
    const rawKey = this.getOpenRouterKey();
    const maskedKey = rawKey && rawKey.length > 8 
      ? `${rawKey.substring(0, 7)}...${rawKey.substring(rawKey.length - 4)}` 
      : (rawKey ? '••••••••' : '');

    return {
      activeProvider: this.config.activeProvider,
      openrouter: {
        hasKey: !!rawKey,
        apiKeyMasked: maskedKey,
        baseUrl: this.getOpenRouterBaseUrl(),
        model: this.getOpenRouterModel(),
      },
      gemini: {
        preferredModel: this.config.gemini.preferredModel,
      }
    };
  }
}

export const providersManager = new ProvidersManager();
