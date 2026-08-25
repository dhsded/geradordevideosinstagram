import fs from 'fs';
import path from 'path';

export interface GeminiKey {
  id: string;
  key: string;
  status: 'free' | 'exhausted';
  successCount: number;
  errorCount: number;
  addedAt: string;
  lastVerified?: string;
  lastError?: string;
}

function getKeysFilePath(): string {
  // Em desenvolvimento, preferir o keys.json na raiz do projeto
  if (process.env.NODE_ENV !== 'production' && fs.existsSync(path.join(process.cwd(), 'keys.json'))) {
    return path.join(process.cwd(), 'keys.json');
  }

  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Preferences') : path.join(process.env.HOME || '', '.config'));
  const writableDir = appData ? path.join(appData, 'postforge') : process.cwd();
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

  public load() {
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
            addedAt: k.addedAt || new Date().toISOString(),
            lastVerified: k.lastVerified,
            lastError: k.lastError
          }));
        } else {
          this.keys = [];
        }
      } else {
        this.keys = [];
      }
      console.log(`[KeysManager] Carregadas ${this.keys.length} chaves de: ${KEYS_FILE}`);
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
      console.log(`[KeysManager] Salvo com sucesso (${this.keys.length} chaves) em: ${KEYS_FILE}`);

      // Sincronizar também com keys.json na raiz do projeto se existir
      const localFile = path.join(process.cwd(), 'keys.json');
      if (localFile !== KEYS_FILE && fs.existsSync(localFile)) {
        try {
          fs.writeFileSync(localFile, JSON.stringify(this.keys, null, 2), 'utf-8');
        } catch (e) {
          // Ignorar se local não for gravável
        }
      }
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

  public getNextActiveKey(): string | null {
    return this.getActiveKey();
  }

  public markExhausted(keyOrId: string, reason?: string) {
    const item = this.keys.find(k => k.key === keyOrId || k.id === keyOrId);
    if (item) {
      item.status = 'exhausted';
      item.errorCount += 1;
      if (reason) item.lastError = reason;
      item.lastVerified = new Date().toISOString();
      this.save();
    }
  }

  public recordSuccess(key: string) {
    const item = this.keys.find(k => k.key === key);
    if (item) {
      item.status = 'free';
      item.successCount += 1;
      item.lastVerified = new Date().toISOString();
      item.lastError = undefined;
      this.save();
    }
  }

  public recordError(key: string, errorMsg?: string) {
    const item = this.keys.find(k => k.key === key);
    if (item) {
      item.errorCount += 1;
      if (errorMsg) item.lastError = errorMsg;
      item.lastVerified = new Date().toISOString();
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
    if (!target) return;
    const clean = target.trim();
    const initialLen = this.keys.length;
    this.keys = this.keys.filter(k => k.id !== clean && k.key !== clean);
    if (this.keys.length !== initialLen) {
      this.save();
    }
  }

  public resetStatuses() {
    this.keys.forEach(k => {
      k.status = 'free';
      k.errorCount = 0;
      k.lastError = undefined;
    });
    this.save();
  }

  public clearAll() {
    this.keys = [];
    this.save();
  }

  /**
   * Testa e verifica a cota de uma chave Gemini individual via API REST leve
   */
  public async verifySingleKey(key: string): Promise<{
    active: boolean;
    status: 'free' | 'exhausted';
    message: string;
    statusCode: number;
  }> {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      const statusCode = res.status;

      if (res.ok) {
        return {
          active: true,
          status: 'free',
          message: 'Chave ativa e com cota disponível',
          statusCode
        };
      }

      const text = await res.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      const errMsg = json?.error?.message || text || `HTTP ${statusCode}`;

      if (statusCode === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource_exhausted')) {
        return {
          active: false,
          status: 'exhausted',
          message: `Cota esgotada (429): ${errMsg.slice(0, 100)}`,
          statusCode
        };
      }

      if (statusCode === 400 || statusCode === 403 || errMsg.toLowerCase().includes('api key not valid')) {
        return {
          active: false,
          status: 'exhausted',
          message: `Chave inválida ou sem permissão (${statusCode}): ${errMsg.slice(0, 100)}`,
          statusCode
        };
      }

      return {
        active: false,
        status: 'exhausted',
        message: `Status HTTP ${statusCode}: ${errMsg.slice(0, 100)}`,
        statusCode
      };
    } catch (err: any) {
      return {
        active: false,
        status: 'exhausted',
        message: `Falha na conexão: ${err.message || 'Erro de rede'}`,
        statusCode: 0
      };
    }
  }

  /**
   * Verifica em paralelo a saúde e cota de TODAS as chaves Gemini cadastradas
   */
  public async verifyAllKeys(): Promise<{
    total: number;
    free: number;
    exhausted: number;
    verifiedAt: string;
    results: Array<{
      id: string;
      keyMasked: string;
      status: 'free' | 'exhausted';
      message: string;
      statusCode: number;
    }>;
  }> {
    console.log(`[KeysManager] Iniciando verificação de cota para ${this.keys.length} chaves Gemini...`);
    const verifiedAt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const checks = this.keys.map(async (k) => {
      const check = await this.verifySingleKey(k.key);
      k.status = check.status;
      k.lastVerified = verifiedAt;
      k.lastError = check.active ? undefined : check.message;
      return {
        id: k.id,
        keyMasked: k.key.length > 10 ? `${k.key.substring(0, 6)}...${k.key.substring(k.key.length - 4)}` : 'Chave inválida',
        status: check.status,
        message: check.message,
        statusCode: check.statusCode
      };
    });

    const results = await Promise.all(checks);
    this.save();

    const freeCount = this.keys.filter(k => k.status === 'free').length;
    const exhaustedCount = this.keys.filter(k => k.status === 'exhausted').length;

    console.log(`[KeysManager] Verificação concluída: ${freeCount} ativas, ${exhaustedCount} esgotadas/inválidas.`);

    return {
      total: this.keys.length,
      free: freeCount,
      exhausted: exhaustedCount,
      verifiedAt,
      results
    };
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
      addedAt: k.addedAt,
      lastVerified: k.lastVerified,
      lastError: k.lastError
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
