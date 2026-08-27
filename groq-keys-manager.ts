import fs from 'fs';
import path from 'path';

const _currentDir = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

export interface GroqKey {
  id: string;
  key: string;
  label?: string;
  status: 'free' | 'exhausted';
  successCount: number;
  errorCount: number;
  addedAt: string;
  lastVerified?: string;
  lastError?: string;
  requestsRemaining?: number;
  requestsLimit?: number;
  tokensRemaining?: number;
  tokensLimit?: number;
  resetRequests?: string;
  resetTokens?: string;
}

function getGroqKeysFilePath(): string {
  // Em desenvolvimento, preferir o groq-keys.json na raiz do projeto
  if (process.env.NODE_ENV !== 'production' && fs.existsSync(path.join(process.cwd(), 'groq-keys.json'))) {
    return path.join(process.cwd(), 'groq-keys.json');
  }

  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Preferences') : path.join(process.env.HOME || '', '.config'));
  const writableDir = appData ? path.join(appData, 'postforge') : process.cwd();
  const targetFile = path.join(writableDir, 'groq-keys.json');

  if (fs.existsSync(targetFile)) {
    return targetFile;
  }

  // Procurar arquivo seed
  const candidateSeedPaths = [
    path.join(process.cwd(), 'groq-keys.json'),
    (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'groq-keys.json') : null,
    path.join(_currentDir, 'groq-keys.json'),
    path.join(_currentDir, '..', 'groq-keys.json'),
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
    return path.join(process.cwd(), 'groq-keys.json');
  }
}

const KEYS_FILE = getGroqKeysFilePath();

export class GroqKeysManager {
  private keys: GroqKey[] = [];

  constructor() {
    this.load();
    this.seedFromEnv();
  }

  private generateId(): string {
    return 'groq_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  private seedFromEnv() {
    const envKey = (process.env.GROQ_API_KEY || '').trim().replace(/^["']+|["']+$/g, '');
    if (envKey && envKey.length >= 10 && !this.keys.some(k => k.key === envKey)) {
      this.keys.push({
        id: this.generateId(),
        key: envKey,
        label: 'Chave Principal (.env)',
        status: 'free',
        successCount: 0,
        errorCount: 0,
        addedAt: new Date().toISOString()
      });
      this.save();
    }
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
            label: k.label,
            status: k.status || 'free',
            successCount: typeof k.successCount === 'number' ? k.successCount : 0,
            errorCount: typeof k.errorCount === 'number' ? k.errorCount : 0,
            addedAt: k.addedAt || new Date().toISOString(),
            lastVerified: k.lastVerified,
            lastError: k.lastError,
            requestsRemaining: typeof k.requestsRemaining === 'number' ? k.requestsRemaining : undefined,
            requestsLimit: typeof k.requestsLimit === 'number' ? k.requestsLimit : undefined,
            tokensRemaining: typeof k.tokensRemaining === 'number' ? k.tokensRemaining : undefined,
            tokensLimit: typeof k.tokensLimit === 'number' ? k.tokensLimit : undefined,
            resetRequests: k.resetRequests,
            resetTokens: k.resetTokens
          }));
        } else {
          this.keys = [];
        }
      } else {
        this.keys = [];
      }
      console.log(`[GroqKeysManager] Carregadas ${this.keys.length} chaves de: ${KEYS_FILE}`);
    } catch (error) {
      console.error('[GroqKeysManager] Erro ao carregar chaves do arquivo json:', error);
      this.keys = [];
    }
  }

  public save() {
    try {
      const dir = path.dirname(KEYS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(KEYS_FILE, JSON.stringify(this.keys, null, 2), 'utf-8');
      console.log(`[GroqKeysManager] Salvo com sucesso (${this.keys.length} chaves) em: ${KEYS_FILE}`);

      // Sincronizar também com groq-keys.json na raiz do projeto
      const localFile = path.join(process.cwd(), 'groq-keys.json');
      if (localFile !== KEYS_FILE) {
        try {
          fs.writeFileSync(localFile, JSON.stringify(this.keys, null, 2), 'utf-8');
        } catch (e) {
          // Ignorar se local não for gravável
        }
      }
    } catch (error) {
      console.error('[GroqKeysManager] Erro ao salvar chaves no arquivo json:', error);
    }
  }

  public getKeys(): GroqKey[] {
    return this.keys;
  }

  public getActiveKey(): string | null {
    const freeKeys = this.keys.filter(k => k.status === 'free');
    if (freeKeys.length === 0) {
      // Fallback para .env se não houver chaves livres no pool
      const envKey = (process.env.GROQ_API_KEY || '').trim();
      return envKey || null;
    }
    // Priorizar chaves com menos erros
    freeKeys.sort((a, b) => a.errorCount - b.errorCount);
    return freeKeys[0].key;
  }

  public getAllFreeKeys(): string[] {
    const freeKeys = this.keys.filter(k => k.status === 'free');
    freeKeys.sort((a, b) => a.errorCount - b.errorCount);
    const keys = freeKeys.map(k => k.key);
    const envKey = (process.env.GROQ_API_KEY || '').trim();
    if (envKey && !keys.includes(envKey)) {
      keys.push(envKey);
    }
    return keys;
  }

  public markExhausted(keyOrId: string, reason?: string) {
    const item = this.keys.find(k => k.key === keyOrId || k.id === keyOrId);
    if (item) {
      item.status = 'exhausted';
      item.errorCount += 1;
      if (reason) item.lastError = reason;
      item.lastVerified = new Date().toISOString();
      this.save();
      console.log(`[GroqKeysManager] Chave ${item.id} marcada como esgotada: ${reason || 'Sem motivo especificado'}`);
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

  public addKeys(newKeys: string[], labelPrefix?: string): number {
    let countAdded = 0;
    for (const rawKey of newKeys) {
      let cleanKey = String(rawKey || '')
        .trim()
        .replace(/^["']+|["']+$/g, '')
        .replace(/^Bearer\s+/i, '')
        .replace(/[\/\/#].*$/, '')
        .trim();

      if (cleanKey && cleanKey.length >= 8) {
        const existing = this.keys.find(k => k.key === cleanKey);
        if (existing) {
          // Reativar chave caso já estivesse no pool mas marcada como esgotada
          existing.status = 'free';
          existing.lastError = undefined;
          if (labelPrefix && !existing.label) {
            existing.label = `${labelPrefix} ${this.keys.indexOf(existing) + 1}`;
          }
          countAdded++;
        } else {
          this.keys.push({
            id: this.generateId(),
            key: cleanKey,
            label: labelPrefix ? `${labelPrefix} ${this.keys.length + 1}` : `Chave Groq ${this.keys.length + 1}`,
            status: 'free',
            successCount: 0,
            errorCount: 0,
            addedAt: new Date().toISOString()
          });
          countAdded++;
        }
      }
    }
    if (countAdded > 0) {
      this.save();
    }
    return countAdded;
  }

  public removeKey(target: string): boolean {
    if (!target) return false;
    const clean = target.trim();
    const initialLen = this.keys.length;
    this.keys = this.keys.filter(k => k.id !== clean && k.key !== clean);
    if (this.keys.length !== initialLen) {
      this.save();
      return true;
    }
    return false;
  }

  public resetStatuses() {
    this.keys.forEach(k => {
      k.status = 'free';
      k.errorCount = 0;
      k.lastError = undefined;
    });
    this.save();
    console.log(`[GroqKeysManager] Todas as ${this.keys.length} chaves foram reativadas (status: free).`);
  }

  public clearAll() {
    this.keys = [];
    this.save();
  }

  /**
   * Testa e verifica a cota de uma chave Groq individual via endpoint /models e /chat/completions
   */
  public async verifySingleKey(key: string): Promise<{
    active: boolean;
    status: 'free' | 'exhausted';
    message: string;
    statusCode: number;
    requestsRemaining?: number;
    requestsLimit?: number;
    tokensRemaining?: number;
    tokensLimit?: number;
    resetRequests?: string;
    resetTokens?: string;
  }> {
    const baseUrl = 'https://api.groq.com/openai/v1';
    try {
      // 1. Testar autenticação e capturar headers de rate-limit via chamada ultra leve
      const testRes = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${key}`
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1
        }),
        signal: AbortSignal.timeout(8000)
      });

      const statusCode = testRes.status;
      const headers = testRes.headers;

      // Ler cabeçalhos de rate limit retornados nativamente pela Groq
      const reqRemaining = headers.get('x-ratelimit-remaining-requests') ? parseInt(headers.get('x-ratelimit-remaining-requests')!, 10) : undefined;
      const reqLimit = headers.get('x-ratelimit-limit-requests') ? parseInt(headers.get('x-ratelimit-limit-requests')!, 10) : undefined;
      const tokRemaining = headers.get('x-ratelimit-remaining-tokens') ? parseInt(headers.get('x-ratelimit-remaining-tokens')!, 10) : undefined;
      const tokLimit = headers.get('x-ratelimit-limit-tokens') ? parseInt(headers.get('x-ratelimit-limit-tokens')!, 10) : undefined;
      const resetReq = headers.get('x-ratelimit-reset-requests') || undefined;
      const resetTok = headers.get('x-ratelimit-reset-tokens') || undefined;

      if (testRes.ok) {
        let msg = 'Chave Groq ativa e conectada com sucesso.';
        if (reqRemaining !== undefined && reqLimit !== undefined) {
          msg = `Ativa • ${reqRemaining}/${reqLimit} reqs restantes`;
        }
        if (tokRemaining !== undefined) {
          msg += ` | ${(tokRemaining / 1000).toFixed(0)}k tokens livres`;
        }

        return {
          active: true,
          status: 'free',
          message: msg,
          statusCode,
          requestsRemaining: reqRemaining,
          requestsLimit: reqLimit,
          tokensRemaining: tokRemaining,
          tokensLimit: tokLimit,
          resetRequests: resetReq,
          resetTokens: resetTok
        };
      }

      const text = await testRes.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      const errMsg = json?.error?.message || json?.message || text || `HTTP ${statusCode}`;

      if (statusCode === 401 || errMsg.toLowerCase().includes('invalid api key')) {
        return {
          active: false,
          status: 'exhausted',
          message: `Chave inválida ou não autorizada no Groq (401). Verifique em console.groq.com/keys`,
          statusCode
        };
      }

      if (statusCode === 429 || errMsg.toLowerCase().includes('rate limit') || errMsg.toLowerCase().includes('quota')) {
        return {
          active: false,
          status: 'exhausted',
          message: `Limite de taxa temporário atingido (429): ${errMsg.slice(0, 100)}`,
          statusCode,
          requestsRemaining: reqRemaining,
          requestsLimit: reqLimit,
          tokensRemaining: tokRemaining,
          tokensLimit: tokLimit,
          resetRequests: resetReq,
          resetTokens: resetTok
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
        message: `Falha na conexão com Groq: ${err.message || 'Erro de rede'}`,
        statusCode: 0
      };
    }
  }

  /**
   * Verifica em paralelo a saúde e cotas de TODAS as chaves Groq cadastradas
   */
  public async verifyAllKeys(): Promise<{
    total: number;
    free: number;
    exhausted: number;
    verifiedAt: string;
    results: Array<{
      id: string;
      keyMasked: string;
      label?: string;
      status: 'free' | 'exhausted';
      message: string;
      statusCode: number;
      requestsRemaining?: number;
      requestsLimit?: number;
      tokensRemaining?: number;
      tokensLimit?: number;
    }>;
  }> {
    console.log(`[GroqKeysManager] Iniciando verificação de cota para ${this.keys.length} chaves Groq...`);
    const verifiedAt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const checks = this.keys.map(async (k) => {
      const check = await this.verifySingleKey(k.key);
      k.status = check.status;
      k.lastVerified = verifiedAt;
      k.lastError = check.active ? undefined : check.message;
      if (check.requestsRemaining !== undefined) k.requestsRemaining = check.requestsRemaining;
      if (check.requestsLimit !== undefined) k.requestsLimit = check.requestsLimit;
      if (check.tokensRemaining !== undefined) k.tokensRemaining = check.tokensRemaining;
      if (check.tokensLimit !== undefined) k.tokensLimit = check.tokensLimit;
      if (check.resetRequests !== undefined) k.resetRequests = check.resetRequests;
      if (check.resetTokens !== undefined) k.resetTokens = check.resetTokens;

      return {
        id: k.id,
        keyMasked: k.key.length > 10 ? `${k.key.substring(0, 7)}...${k.key.substring(k.key.length - 4)}` : 'Chave inválida',
        label: k.label,
        status: check.status,
        message: check.message,
        statusCode: check.statusCode,
        requestsRemaining: check.requestsRemaining,
        requestsLimit: check.requestsLimit,
        tokensRemaining: check.tokensRemaining,
        tokensLimit: check.tokensLimit
      };
    });

    const results = await Promise.all(checks);
    this.save();

    const freeCount = this.keys.filter(k => k.status === 'free').length;
    const exhaustedCount = this.keys.filter(k => k.status === 'exhausted').length;

    console.log(`[GroqKeysManager] Verificação concluída: ${freeCount} ativas, ${exhaustedCount} esgotadas/inválidas.`);

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
      keyMasked: k.key.length > 10 ? `${k.key.substring(0, 7)}...${k.key.substring(k.key.length - 4)}` : 'Chave inválida',
      label: k.label,
      status: k.status,
      successCount: k.successCount,
      errorCount: k.errorCount,
      addedAt: k.addedAt,
      lastVerified: k.lastVerified,
      lastError: k.lastError,
      requestsRemaining: k.requestsRemaining,
      requestsLimit: k.requestsLimit,
      tokensRemaining: k.tokensRemaining,
      tokensLimit: k.tokensLimit,
      resetRequests: k.resetRequests,
      resetTokens: k.resetTokens
    }));

    return {
      total,
      free,
      exhausted,
      keysList
    };
  }
}

export const groqKeysManager = new GroqKeysManager();
