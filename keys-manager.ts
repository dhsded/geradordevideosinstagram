import fs from 'fs';
import path from 'path';

export interface GeminiKey {
  id: string;
  key: string;
  status: 'free' | 'exhausted';
  successCount: number;
  errorCount: number;
  addedAt: string;
}

function getKeysFilePath(): string {
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Preferences') : path.join(process.env.HOME || '', '.config'));
  const writableDir = appData ? path.join(appData, 'prompter-nano-banana') : process.cwd();
  const targetFile = path.join(writableDir, 'keys.json');

  if (fs.existsSync(targetFile)) {
    return targetFile;
  }

  // Procurar arquivo seed de chaves empacotado com o projeto
  const candidateSeedPaths = [
    path.join(process.cwd(), 'keys.json'),
    (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'keys.json') : null,
    path.join(__dirname, 'keys.json'),
    path.join(__dirname, '..', 'keys.json'),
  ].filter(Boolean) as string[];

  for (const seed of candidateSeedPaths) {
    if (fs.existsSync(seed)) {
      try {
        if (!fs.existsSync(writableDir)) {
          fs.mkdirSync(writableDir, { recursive: true });
        }
        fs.copyFileSync(seed, targetFile);
        return targetFile;
      } catch (e) {
        return seed;
      }
    }
  }

  try {
    if (!fs.existsSync(writableDir)) {
      fs.mkdirSync(writableDir, { recursive: true });
    }
    fs.writeFileSync(targetFile, '[]', 'utf-8');
    return targetFile;
  } catch (e) {
    return path.join(process.cwd(), 'keys.json');
  }
}

const KEYS_FILE = getKeysFilePath();

export class KeysManager {
  private keys: GeminiKey[] = [];

  constructor() {
    this.load();
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  private load() {
    try {
      if (fs.existsSync(KEYS_FILE)) {
        const data = fs.readFileSync(KEYS_FILE, 'utf-8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          this.keys = parsed.map((k: any) => ({
            id: k.id || this.generateId(),
            key: k.key,
            status: k.status || 'free',
            successCount: typeof k.successCount === 'number' ? k.successCount : 0,
            errorCount: typeof k.errorCount === 'number' ? k.errorCount : 0,
            addedAt: k.addedAt || new Date().toISOString()
          }));
        } else {
          this.keys = [];
        }
      } else {
        this.keys = [];
      }
    } catch (error) {
      console.error('Erro ao carregar chaves do arquivo json:', error);
      this.keys = [];
    }
  }

  private save() {
    try {
      const dir = path.dirname(KEYS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(KEYS_FILE, JSON.stringify(this.keys, null, 2), 'utf-8');
    } catch (error) {
      console.error('Erro ao salvar chaves no arquivo json:', error);
    }
  }

  public getKeys(): GeminiKey[] {
    return this.keys;
  }

  public getActiveKey(): string | null {
    const freeKeys = this.keys.filter(k => k.status === 'free');
    if (freeKeys.length === 0) {
      return null;
    }
    // Priorizar chaves com menos erros
    freeKeys.sort((a, b) => a.errorCount - b.errorCount);
    return freeKeys[0].key;
  }

  public markExhausted(keyOrId: string) {
    const item = this.keys.find(k => k.key === keyOrId || k.id === keyOrId);
    if (item) {
      item.status = 'exhausted';
      item.errorCount += 1;
      this.save();
    }
  }

  public recordSuccess(key: string) {
    const item = this.keys.find(k => k.key === key);
    if (item) {
      item.successCount += 1;
      this.save();
    }
  }

  public recordError(key: string) {
    const item = this.keys.find(k => k.key === key);
    if (item) {
      item.errorCount += 1;
      this.save();
    }
  }

  public addKeys(newKeys: string[]) {
    let modified = false;
    for (const rawKey of newKeys) {
      const cleanKey = rawKey.trim();
      if (cleanKey && cleanKey.startsWith('AIzaSy') && !this.keys.some(k => k.key === cleanKey)) {
        this.keys.push({
          id: this.generateId(),
          key: cleanKey,
          status: 'free',
          successCount: 0,
          errorCount: 0,
          addedAt: new Date().toISOString()
        });
        modified = true;
      }
    }
    if (modified) {
      this.save();
    }
  }

  public removeKey(target: string) {
    const initialLen = this.keys.length;
    this.keys = this.keys.filter(k => k.id !== target && k.key !== target);
    if (this.keys.length !== initialLen) {
      this.save();
    }
  }

  public resetStatuses() {
    this.keys.forEach(k => {
      k.status = 'free';
      k.errorCount = 0;
    });
    this.save();
  }

  public clearAll() {
    this.keys = [];
    this.save();
  }

  public getStats() {
    const total = this.keys.length;
    const free = this.keys.filter(k => k.status === 'free').length;
    const exhausted = this.keys.filter(k => k.status === 'exhausted').length;
    
    // Retornar chaves mascaradas para segurança na UI
    const keysList = this.keys.map(k => ({
      id: k.id,
      keyMasked: k.key.length > 10 ? `${k.key.substring(0, 6)}...${k.key.substring(k.key.length - 4)}` : 'Chave inválida',
      status: k.status,
      successCount: k.successCount,
      errorCount: k.errorCount,
      addedAt: k.addedAt
    }));

    return {
      total,
      free,
      exhausted,
      keysList
    };
  }
}

export const keysManager = new KeysManager();
