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

const KEYS_FILE = path.join(process.cwd(), 'keys.json');

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
      fs.writeFileSync(KEYS_FILE, JSON.stringify(this.keys, null, 2), 'utf-8');
    } catch (error) {
      console.error('Erro ao salvar chaves no arquivo json:', error);
    }
  }

  public getKeys(): GeminiKey[] {
    return this.keys;
  }

  public addKeys(rawKeys: string[]): void {
    const now = new Date().toISOString();
    rawKeys.forEach(rawKey => {
      const trimmed = rawKey.trim();
      if (!trimmed) return;
      // Evitar duplicados
      const exists = this.keys.some(k => k.key === trimmed);
      if (!exists) {
        this.keys.push({
          id: this.generateId(),
          key: trimmed,
          status: 'free',
          successCount: 0,
          errorCount: 0,
          addedAt: now
        });
      }
    });
    this.save();
  }

  public removeKey(idOrMaskedOrReal: string): void {
    this.keys = this.keys.filter(k => 
      k.id !== idOrMaskedOrReal && 
      k.key !== idOrMaskedOrReal && 
      this.mask(k.key) !== idOrMaskedOrReal
    );
    this.save();
  }

  public resetStatuses(): void {
    this.keys = this.keys.map(k => ({
      ...k,
      status: 'free'
    }));
    this.save();
  }

  public clearAll(): void {
    this.keys = [];
    this.save();
  }

  public getNextActiveKey(): string | null {
    const active = this.keys.find(k => k.status === 'free');
    return active ? active.key : null;
  }

  public markExhausted(key: string): void {
    const keyObj = this.keys.find(k => k.key === key);
    if (keyObj) {
      keyObj.status = 'exhausted';
      keyObj.errorCount += 1;
      this.save();
    }
  }

  public recordSuccess(key: string): void {
    const keyObj = this.keys.find(k => k.key === key);
    if (keyObj) {
      keyObj.successCount += 1;
      this.save();
    }
  }

  public recordError(key: string): void {
    const keyObj = this.keys.find(k => k.key === key);
    if (keyObj) {
      keyObj.errorCount += 1;
      this.save();
    }
  }

  public mask(key: string): string {
    if (key.length <= 10) return '***';
    return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
  }

  public getStats() {
    const total = this.keys.length;
    const free = this.keys.filter(k => k.status === 'free').length;
    const exhausted = this.keys.filter(k => k.status === 'exhausted').length;
    const keysList = this.keys.map(k => ({
      id: k.id,
      keyMasked: this.mask(k.key),
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
