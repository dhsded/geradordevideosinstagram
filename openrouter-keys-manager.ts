import fs from 'fs';
import path from 'path';

export interface OpenRouterKey {
  id: string;
  key: string;
  label?: string;
  status: 'free' | 'exhausted';
  successCount: number;
  errorCount: number;
  addedAt: string;
  lastVerified?: string;
  lastError?: string;
  creditsRemaining?: number;
}

function getOpenRouterKeysFilePath(): string {
  // Em desenvolvimento, preferir o openrouter-keys.json na raiz do projeto
  if (process.env.NODE_ENV !== 'production' && fs.existsSync(path.join(process.cwd(), 'openrouter-keys.json'))) {
    return path.join(process.cwd(), 'openrouter-keys.json');
  }

  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME || '', 'Library/Preferences') : path.join(process.env.HOME || '', '.config'));
  const writableDir = appData ? path.join(appData, 'postforge') : process.cwd();
  const targetFile = path.join(writableDir, 'openrouter-keys.json');

  if (fs.existsSync(targetFile)) {
    return targetFile;
  }

  // Procurar arquivo seed
  const candidateSeedPaths = [
    path.join(process.cwd(), 'openrouter-keys.json'),
    (process as any).resourcesPath ? path.join((process as any).resourcesPath, 'openrouter-keys.json') : null,
    path.join(__dirname, 'openrouter-keys.json'),
    path.join(__dirname, '..', 'openrouter-keys.json'),
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
    return path.join(process.cwd(), 'openrouter-keys.json');
  }
}

const KEYS_FILE = getOpenRouterKeysFilePath();

export class OpenRouterKeysManager {
  private keys: OpenRouterKey[] = [];

  constructor() {
    this.load();
    this.seedFromEnv();
  }

  private generateId(): string {
    return 'or_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }

  private seedFromEnv() {
    const envKey = (process.env.OPENROUTER_API_KEY || '').trim().replace(/^["']+|["']+$/g, '');
    if (envKey && envKey.length >= 20 && (envKey.startsWith('sk-or-v1-') || envKey.startsWith('sk-')) && !this.keys.some(k => k.key === envKey)) {
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
            creditsRemaining: typeof k.creditsRemaining === 'number' ? k.creditsRemaining : undefined
          }));
        } else {
          this.keys = [];
        }
      } else {
        this.keys = [];
      }
      console.log(`[OpenRouterKeysManager] Carregadas ${this.keys.length} chaves de: ${KEYS_FILE}`);
    } catch (error) {
      console.error('[OpenRouterKeysManager] Erro ao carregar chaves do arquivo json:', error);
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
      console.log(`[OpenRouterKeysManager] Salvo com sucesso (${this.keys.length} chaves) em: ${KEYS_FILE}`);

      // Sincronizar também com openrouter-keys.json na raiz do projeto se existir
      const localFile = path.join(process.cwd(), 'openrouter-keys.json');
      if (localFile !== KEYS_FILE && fs.existsSync(localFile)) {
        try {
          fs.writeFileSync(localFile, JSON.stringify(this.keys, null, 2), 'utf-8');
        } catch (e) {
          // Ignorar se local não for gravável
        }
      }
    } catch (error) {
      console.error('[OpenRouterKeysManager] Erro ao salvar chaves no arquivo json:', error);
    }
  }

  public getKeys(): OpenRouterKey[] {
    return this.keys;
  }

  public getActiveKey(): string | null {
    const freeKeys = this.keys.filter(k => k.status === 'free');
    if (freeKeys.length === 0) {
      // Fallback para .env se não houver chaves livres no pool
      const envKey = (process.env.OPENROUTER_API_KEY || '').trim();
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
    const envKey = (process.env.OPENROUTER_API_KEY || '').trim();
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
      console.log(`[OpenRouterKeysManager] Chave ${item.id} marcada como esgotada: ${reason || 'Sem motivo especificado'}`);
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
      const cleanKey = String(rawKey || '').trim().replace(/^["']+|["']+$/g, '').trim();
      if (cleanKey && cleanKey.length >= 8 && !this.keys.some(k => k.key === cleanKey)) {
        this.keys.push({
          id: this.generateId(),
          key: cleanKey,
          label: labelPrefix ? `${labelPrefix} ${this.keys.length + 1}` : undefined,
          status: 'free',
          successCount: 0,
          errorCount: 0,
          addedAt: new Date().toISOString()
        });
        countAdded++;
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
    console.log(`[OpenRouterKeysManager] Todas as ${this.keys.length} chaves foram reativadas (status: free).`);
  }

  public clearAll() {
    this.keys = [];
    this.save();
  }

  /**
   * Testa e verifica a cota de uma chave OpenRouter individual via endpoint /auth/key e /credits
   */
  public async verifySingleKey(key: string): Promise<{
    active: boolean;
    status: 'free' | 'exhausted';
    message: string;
    statusCode: number;
    creditsRemaining?: number;
  }> {
    const baseUrl = 'https://openrouter.ai/api/v1';
    try {
      // 1. Testar autenticação da chave
      const authRes = await fetch(`${baseUrl}/auth/key`, {
        method: 'GET',
        headers: {
          "Authorization": `Bearer ${key}`,
          "HTTP-Referer": "https://postforge.app",
          "X-Title": "PostForge"
        },
        signal: AbortSignal.timeout(8000)
      });

      const statusCode = authRes.status;

      if (authRes.ok) {
        let credits: number | undefined = undefined;
        try {
          const authData = await authRes.json();
          if (authData?.data?.limit_remaining !== undefined) {
            credits = authData.data.limit_remaining;
          }
        } catch {}

        // Tentar obter créditos detalhados
        try {
          const credRes = await fetch(`${baseUrl}/credits`, {
            method: 'GET',
            headers: {
              "Authorization": `Bearer ${key}`,
              "HTTP-Referer": "https://postforge.app",
              "X-Title": "PostForge"
            },
            signal: AbortSignal.timeout(6000)
          });
          if (credRes.ok) {
            const credData = await credRes.json();
            const totalCredits = credData?.data?.total_credits;
            const totalUsage = credData?.data?.total_usage;
            if (typeof totalCredits === 'number') {
              credits = totalCredits - (totalUsage || 0);
            }
          }
        } catch {}

        return {
          active: true,
          status: 'free',
          message: credits !== undefined ? `Chave ativa (Saldo restante: ~$${credits.toFixed(2)})` : 'Chave ativa e pronta para uso',
          statusCode,
          creditsRemaining: credits
        };
      }

      const text = await authRes.text();
      let json: any = null;
      try { json = JSON.parse(text); } catch {}
      const errMsg = json?.error?.message || json?.message || text || `HTTP ${statusCode}`;

      if (errMsg.toLowerCase().includes('user not found') || statusCode === 401) {
        return {
          active: false,
          status: 'exhausted',
          message: `Chave não encontrada na conta OpenRouter ('User not found'). Verifique se a chave foi copiada corretamente de openrouter.ai/keys.`,
          statusCode
        };
      }

      if (statusCode === 429 || errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('rate limit')) {
        return {
          active: false,
          status: 'exhausted',
          message: `Cota esgotada / Rate limit (429): ${errMsg.slice(0, 100)}`,
          statusCode
        };
      }

      if (statusCode === 403 || errMsg.toLowerCase().includes('invalid api key')) {
        return {
          active: false,
          status: 'exhausted',
          message: `Chave inválida ou não autorizada (${statusCode}): ${errMsg.slice(0, 100)}`,
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
   * Verifica em paralelo a saúde e cotas de TODAS as chaves OpenRouter cadastradas
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
      creditsRemaining?: number;
    }>;
  }> {
    console.log(`[OpenRouterKeysManager] Iniciando verificação de cota para ${this.keys.length} chaves OpenRouter...`);
    const verifiedAt = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const checks = this.keys.map(async (k) => {
      const check = await this.verifySingleKey(k.key);
      k.status = check.status;
      k.lastVerified = verifiedAt;
      k.lastError = check.active ? undefined : check.message;
      if (check.creditsRemaining !== undefined) {
        k.creditsRemaining = check.creditsRemaining;
      }
      return {
        id: k.id,
        keyMasked: k.key.length > 10 ? `${k.key.substring(0, 9)}...${k.key.substring(k.key.length - 4)}` : 'Chave inválida',
        label: k.label,
        status: check.status,
        message: check.message,
        statusCode: check.statusCode,
        creditsRemaining: check.creditsRemaining
      };
    });

    const results = await Promise.all(checks);
    this.save();

    const freeCount = this.keys.filter(k => k.status === 'free').length;
    const exhaustedCount = this.keys.filter(k => k.status === 'exhausted').length;

    console.log(`[OpenRouterKeysManager] Verificação concluída: ${freeCount} ativas, ${exhaustedCount} esgotadas/inválidas.`);

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
      keyMasked: k.key.length > 10 ? `${k.key.substring(0, 9)}...${k.key.substring(k.key.length - 4)}` : 'Chave inválida',
      label: k.label,
      status: k.status,
      successCount: k.successCount,
      errorCount: k.errorCount,
      addedAt: k.addedAt,
      lastVerified: k.lastVerified,
      lastError: k.lastError,
      creditsRemaining: k.creditsRemaining
    }));

    return {
      total,
      free,
      exhausted,
      keysList
    };
  }
}

export const openrouterKeysManager = new OpenRouterKeysManager();
