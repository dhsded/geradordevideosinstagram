import fs from 'fs';
import path from 'path';

export interface GeminiKey {
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

  private load() {
    try {
      if (fs.existsSync(KEYS_FILE)) {
        const data = fs.readFileSync(KEYS_FILE, 'utf-8');
        this.keys = JSON.parse(data);
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

  public removeKey(maskedKeyOrRealKey: string): void {
    // A remoção pode ser feita combinando a chave real ou a chave mascarada
    this.keys = this.keys.filter(k => k.key !== maskedKeyOrRealKey && this.mask(k.key) !== maskedKeyOrRealKey);
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
