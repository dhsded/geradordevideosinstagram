import React, { useState, useRef } from 'react';
import { Loader2, Copy, Check, Sparkles, Image as ImageIcon, Clapperboard, MessageSquare, Upload, Key, X, FileText, Download, ArrowLeft, ArrowRight, RotateCw, Play, Square, Trash2, Eye, Compass, Terminal, MousePointer, Keyboard, Cpu, Send, Database, Zap, Settings, Bot, Globe, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, KeyRound, ExternalLink, Layers, DollarSign, Activity, Gauge, BarChart3, Images, ListOrdered, FileCheck2, ZoomIn, AlertTriangle, FolderArchive, Grid, SlidersHorizontal, Sparkle, FileUp } from 'lucide-react';
import { jsPDF } from "jspdf";
import JSZip from "jszip";

import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel } from "docx";
import { saveAs } from "file-saver";

// Re-defining Type enum locally to avoid importing from @google/genai in the client
enum Type {
  TYPE_UNSPECIFIED = "TYPE_UNSPECIFIED",
  STRING = "STRING",
  NUMBER = "NUMBER",
  INTEGER = "INTEGER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  OBJECT = "OBJECT",
  NULL = "NULL",
}

const getApiUrl = (endpoint: string): string => {
  if (typeof window !== 'undefined') {
    if (window.location.port === '5173' || !window.location.origin.startsWith('http')) {
      return `http://127.0.0.1:3000${endpoint}`;
    }
  }
  return endpoint;
};

interface GeneratedPrompts {
  scenes: {
    sceneNumber: number;
    duration: number;
    contextPt: string;
    videoPromptEn: string;
    dialoguePt: string;
    dialogueEn: string;
    dialogueEs: string;
    isVoiceOver: boolean;
  }[];
  nanoBananaImagePrompt: string;
  instagramPost: string;
}

interface GeneratedCarousel {
  coverImagePrompt: string;
  slides: {
    slideNumber: number;
    imagePromptEn: string;
    textInBubblesPt: string;
    textInBubblesEn: string;
    textInBubblesEs: string;
    descriptionPt: string;
  }[];
  instagramPost: string;
}

interface ReferencePdfFile {
  name: string;
  data: string;
  mimeType: string;
  size: number;
}

// Interfaces da Auditoria Visual e Organização de Imagens por Roteiro
interface AuditImageItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  dataUrl: string;
  base64: string;
}

interface AuditSlideResult {
  slide_numero: number;
  descricao_esperada: string;
  imagem_arquivo_correspondente: string;
  pontuacao_consistencia: string;
  feedback_visual: string;
  destaque_pontos_fortes?: string[];
  alertas_inconsistencia?: string[];
}

interface AuditSurplusImage {
  nome_arquivo: string;
  motivo_descarte: string;
}

interface AuditResult {
  resumo_geral_consistencia: string;
  pontuacao_media_geral?: string;
  auditoria_imagens: AuditSlideResult[];
  imagens_sobressalentes?: AuditSurplusImage[];
}

const NICHES = ['Fitness', 'Psicologia', 'Psiquiatria', 'Neuropsicologia', 'Top 10 Filmes e Séries'];
const ANIMATION_STYLES = [
  'Stop Motion',
  '3D Pixar / Disney',
  'Anime / Mangá',
  '2D Cartoon Animado',
  'Realista / Cinematográfico',
  'Claymation (Massinha)',
  'Aquarela / Pintura',
  'Cyberpunk / Futurista'
];
const ART_STYLES = [
  'Anime / Mangá',
  'Cartoon Animado',
  'Desenho à Mão (Sketched)',
  'Cómic / HQ',
  '3D Disney / Pixar Style',
  'Minimalista / Flat Design',
  'Pop Art',
  'Pintura Óleo / Estilizada'
];

const NICHE_CAROUSEL_TONES: Record<string, string[]> = {
  'Psicologia': ['Acolhedor / Compassivo', 'Terapêutico / ACT', 'Vulnerável / Íntimo', 'Encorajador / Reparador', 'Psicológico', 'Filosófico', 'Profundidade'],
  'Psiquiatria': ['Acolhedor / Compassivo', 'Terapêutico / ACT', 'Vulnerável / Íntimo', 'Encorajador / Reparador', 'Psicológico', 'Filosófico', 'Profundidade'],
  'Neuropsicologia': ['Acolhedor / Compassivo', 'Terapêutico / ACT', 'Vulnerável / Íntimo', 'Encorajador / Reparador', 'Psicológico', 'Filosófico', 'Profundidade'],
  'Fitness': ['Motivacional', 'Tutorial / Passo a Passo', 'Curiosidades / Mitos'],
  'Top 10 Filmes e Séries': ['Ranking / Top 10', 'Recomendação Secreta', 'Curiosidades / Bastidores']
};

const NICHE_SCRIPT_TONES: Record<string, string[]> = {
  'Psicologia': ['Acolhedor / Compassivo', 'Terapêutico / ACT', 'Vulnerável / Íntimo', 'Encorajador / Reparador', 'Poético', 'Metafórico e Profundo', 'Filosófico'],
  'Psiquiatria': ['Acolhedor / Compassivo', 'Terapêutico / ACT', 'Vulnerável / Íntimo', 'Encorajador / Reparador', 'Poético', 'Metafórico e Profundo', 'Filosófico'],
  'Neuropsicologia': ['Acolhedor / Compassivo', 'Terapêutico / ACT', 'Vulnerável / Íntimo', 'Encorajador / Reparador', 'Poético', 'Metafórico e Profundo', 'Filosófico'],
  'Fitness': ['Motivacional / Foco', 'Instrucional / Passo a Passo', 'Curiosidades'],
  'Top 10 Filmes e Séries': []
};

const DURATIONS = [5, 6, 7, 8, 10];
const VISUAL_DYNAMISM = [
  'Equilibrado (Vários ângulos)',
  'Foco em Expressão (Close-ups)',
  'Cinematográfico (Planos Largos)',
  'Dinâmico (Movimentos Rápidos)'
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'script' | 'analysis' | 'carousel' | 'spy' | 'audit'>('script');
  
  // Browser Spy states
  const webviewRef = React.useRef<any>(null);
  const [spyUrl, setSpyUrl] = useState('https://midjourney.com'); // default to a popular AI generator interface or google
  const [inputUrl, setInputUrl] = useState('https://midjourney.com');
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<any>(null);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  const [recordedSteps, setRecordedSteps] = useState<any[]>([]);
  const [preloadPath, setPreloadPath] = useState<string>('');
  const [webviewCanGoBack, setWebviewCanGoBack] = useState(false);
  const [webviewCanGoForward, setWebviewCanGoForward] = useState(false);
  const [isWebviewLoading, setIsWebviewLoading] = useState(false);
  const [activeSpyScriptTab, setActiveSpyScriptTab] = useState<'json' | 'puppeteer' | 'playwright'>('json');
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });

  const [niche, setNiche] = useState(NICHES[0]);
  const [animationStyle, setAnimationStyle] = useState(ANIMATION_STYLES[0]);
  const [artStyle, setArtStyle] = useState(ART_STYLES[0]);
  const [visualDynamism, setVisualDynamism] = useState(VISUAL_DYNAMISM[0]);
  const [mixedOffs, setMixedOffs] = useState(false);
  const [characterCount, setCharacterCount] = useState(1);
  const [sceneCount, setSceneCount] = useState(3);
  const [duration, setDuration] = useState(5);
  const [topic, setTopic] = useState('');
  const [scriptTone, setScriptTone] = useState('Acolhedor / Compassivo');
  const [includeHook, setIncludeHook] = useState(true);
  const [carouselTone, setCarouselTone] = useState('Acolhedor / Compassivo');
  const [characterDescription, setCharacterDescription] = useState('');
  
  React.useEffect(() => {
    const availableCarouselTones = NICHE_CAROUSEL_TONES[niche] || [];
    if (availableCarouselTones.length > 0 && !availableCarouselTones.includes(carouselTone)) {
      setCarouselTone(availableCarouselTones[0]);
    }
    const availableScriptTones = NICHE_SCRIPT_TONES[niche] || [];
    if (availableScriptTones.length > 0) {
      if (!availableScriptTones.includes(scriptTone)) {
        setScriptTone(availableScriptTones[0]);
      }
    } else {
      setScriptTone('');
    }
  }, [niche]);

  const [characterImages, setCharacterImages] = useState<({data: string, mimeType: string} | undefined)[]>([]);
  const [contextImages, setContextImages] = useState<{data: string, mimeType: string}[]>([]);
  const [referencePdfs, setReferencePdfs] = useState<ReferencePdfFile[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedPrompts | null>(null);
  const [carouselResult, setCarouselResult] = useState<GeneratedCarousel | null>(null);

  // Video Analysis states
  const [videoFile, setVideoFile] = useState<{data: string, mimeType: string} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  
  // Auditoria Visual e Organização de Imagens por Roteiro states
  const [uploadedAuditImages, setUploadedAuditImages] = useState<AuditImageItem[]>([]);
  const [auditReferenceImages, setAuditReferenceImages] = useState<AuditImageItem[]>([]);
  const [isDragOverRefImages, setIsDragOverRefImages] = useState(false);
  const [auditScriptInput, setAuditScriptInput] = useState<string>('');
  const [auditCharacterNotes, setAuditCharacterNotes] = useState<string>('');
  const [auditDocumentInfo, setAuditDocumentInfo] = useState<{ filename: string; size: number; wordCount?: number } | null>(null);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [isDragOverDoc, setIsDragOverDoc] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditImageModalUrl, setAuditImageModalUrl] = useState<{ url: string; title: string } | null>(null);
  const [isGeneratingZip, setIsGeneratingZip] = useState(false);
  const [isDragOverAudit, setIsDragOverAudit] = useState(false);

  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  // Abort controller ref para cancelamento real das requisições
  const abortControllerRef = useRef<AbortController | null>(null);

  // Constantes de Modelos de I.A
  const POPULAR_OPENROUTER_MODELS = [
    {
      id: 'minimax/minimax-m3:free',
      name: 'MiniMax M3 (Free)',
      tag: 'Criatividade & Roteiros • Gratuito',
      desc: 'Excelente capacidade para escrita criativa e ganchos em português'
    },
    {
      id: 'google/gemma-4-26b-a4b-it:free',
      name: 'Google Gemma 4 26B Instruct (Free)',
      tag: 'Alta Precisão • Gratuito',
      desc: 'Modelo avançado do Google com raciocínio e síntese rápidos'
    },
    {
      id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      name: 'NVIDIA Nemotron 3 Ultra 550B (Free)',
      tag: '550B Parâmetros • Gratuito',
      desc: 'Ultra alta capacidade para narrativas complexas e adaptações profundas'
    },
    {
      id: 'nvidia/nemotron-3.5-lightning:free',
      name: 'NVIDIA Nemotron 3.5 Lightning (Free)',
      tag: 'Ultrarrápido • Gratuito',
      desc: 'Velocidade instantânea para geração de roteiros dinâmicos'
    },
    {
      id: 'nvidia/nemotron-3-super:free',
      name: 'NVIDIA Nemotron 3 Super (Free)',
      tag: 'Alta Performance • Gratuito',
      desc: 'Equilíbrio ideal entre inteligência de escrita e tempo de resposta'
    },
    {
      id: 'deepseek/deepseek-r1:free',
      name: 'DeepSeek R1 (Free)',
      tag: 'Raciocínio Lógico • Gratuito',
      desc: 'Excelente para análises e estruturação de carrosséis educativos'
    },
    {
      id: 'meta-llama/llama-3.3-70b-instruct:free',
      name: 'Meta Llama 3.3 70B Instruct (Free)',
      tag: 'Robusto & Criativo • Gratuito',
      desc: 'Muito criativo para ganchos virais e copywriting de engajamento'
    },
    {
      id: 'google/gemini-2.0-flash-exp:free',
      name: 'Google Gemini 2.0 Flash Exp (Free)',
      tag: 'Experimental • Gratuito',
      desc: 'Modelo ágil do Google via gateway OpenRouter'
    }
  ];

  const GEMINI_AVAILABLE_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Padrão Recomendado)' },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Mais Recente)' },
    { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash' },
    { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Ultraleve)' },
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Alta Capacidade)' },
  ];

  // Estados da Central de I.As e Provedores
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [selectedProviderTab, setSelectedProviderTab] = useState<'gemini' | 'openrouter'>('gemini');
  const [geminiModel, setGeminiModel] = useState<string>('gemini-2.5-flash');
  const [openrouterConfig, setOpenrouterConfig] = useState<{
    hasKey: boolean;
    apiKeyMasked: string;
    baseUrl: string;
    model: string;
  }>({
    hasKey: false,
    apiKeyMasked: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'nvidia/nemotron-3-ultra-550b-a55b:free'
  });
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
  const [openrouterBaseUrlInput, setOpenrouterBaseUrlInput] = useState('https://openrouter.ai/api/v1');
  const [openrouterModelInput, setOpenrouterModelInput] = useState('nvidia/nemotron-3-ultra-550b-a55b:free');
  const [isCustomOpenRouterModel, setIsCustomOpenRouterModel] = useState(false);
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingProviderSettings, setIsSavingProviderSettings] = useState(false);

  // Estados e manipuladores do Gerenciador de Chaves Rotativas Gemini
  const [isKeyManagerOpen, setIsKeyManagerOpen] = useState(false);
  const [openrouterQuota, setOpenrouterQuota] = useState<{
    label?: string;
    usage?: number;
    limit?: number | null;
    is_free_tier?: boolean;
    rate_limit?: {
      requests: number;
      interval: string;
    };
    credits?: number;
    lastUpdated?: string;
  } | null>(null);
  const [isLoadingQuota, setIsLoadingQuota] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);

  const fetchOpenRouterQuota = async (keyOverride?: string) => {
    const keyToUse = (keyOverride !== undefined ? keyOverride : openrouterKeyInput.trim()).trim();
    setIsLoadingQuota(true);
    setQuotaError(null);
    try {
      const url = keyToUse 
        ? getApiUrl(`/api/providers/openrouter/quota?apiKey=${encodeURIComponent(keyToUse)}`)
        : getApiUrl('/api/providers/openrouter/quota');

      const res = await fetch(url);
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Resposta inesperada do servidor (Status HTTP ${res.status}): ${text.slice(0, 100)}`);
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || `Não foi possível obter a cota do OpenRouter (Status ${res.status})`);
      }

      setOpenrouterQuota({
        label: data.keyInfo?.label,
        usage: typeof data.keyInfo?.usage === 'number' ? data.keyInfo?.usage : (typeof data.creditsInfo?.total_usage === 'number' ? data.creditsInfo?.total_usage : 0),
        limit: data.keyInfo?.limit ?? null,
        is_free_tier: data.keyInfo?.is_free_tier ?? true,
        rate_limit: data.keyInfo?.rate_limit,
        credits: typeof data.creditsInfo?.total_credits === 'number' ? data.creditsInfo?.total_credits : (data.keyInfo?.limit ?? undefined),
        lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
    } catch (err: any) {
      console.warn('Erro ao carregar cota OpenRouter:', err);
      setQuotaError(err.message || 'Erro ao carregar cota da chave.');
    } finally {
      setIsLoadingQuota(false);
    }
  };

  const [keysStats, setKeysStats] = useState<{
    total: number;
    free: number;
    exhausted: number;
    keysList: Array<{
      id: string;
      keyMasked: string;
      status: 'free' | 'exhausted';
      successCount: number;
      errorCount: number;
      addedAt: string;
      lastVerified?: string;
      lastError?: string;
    }>;
  }>({ total: 0, free: 0, exhausted: 0, keysList: [] });
  const [isUploadingKeys, setIsUploadingKeys] = useState(false);
  const [isVerifyingKeys, setIsVerifyingKeys] = useState(false);
  const [keyVerificationReport, setKeyVerificationReport] = useState<{
    verifiedAt: string;
    total: number;
    free: number;
    exhausted: number;
  } | null>(null);
  const [lastGenerationMeta, setLastGenerationMeta] = useState<{
    provider?: string;
    model?: string;
    failoverUsed?: boolean;
    originalProvider?: string;
    failoverReason?: string;
  } | null>(null);
  const [keyManagerError, setKeyManagerError] = useState<string | null>(null);

  const handleVerifyAllKeys = async () => {
    setIsVerifyingKeys(true);
    setKeyManagerError(null);
    try {
      const res = await fetch(getApiUrl('/api/keys/verify-all'), { method: 'POST' });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch {}

      if (!res.ok) {
        throw new Error(data?.error || `Erro HTTP ${res.status}`);
      }

      setKeyVerificationReport({
        verifiedAt: data.verifiedAt,
        total: data.total,
        free: data.free,
        exhausted: data.exhausted
      });
      await fetchProvidersAndStats();
      if (openrouterConfig.hasKey || openrouterKeyInput.trim()) {
        fetchOpenRouterQuota();
      }
    } catch (err: any) {
      console.error('Erro na verificação de chaves:', err);
      setKeyManagerError(err.message || 'Erro ao verificar saúde das chaves.');
    } finally {
      setIsVerifyingKeys(false);
    }
  };

  const fetchProvidersAndStats = async () => {
    try {
      const response = await fetch(getApiUrl('/api/providers'));
      if (response.ok) {
        const data = await response.json();
        if (data.activeProvider) {
          setActiveProvider(data.activeProvider);
        }
        if (data.gemini?.preferredModel) {
          setGeminiModel(data.gemini.preferredModel);
        }
        if (data.openrouter) {
          setOpenrouterConfig(data.openrouter);
          setOpenrouterBaseUrlInput(data.openrouter.baseUrl || 'https://openrouter.ai/api/v1');
          setOpenrouterModelInput(data.openrouter.model || 'nvidia/nemotron-3-ultra-550b-a55b:free');
          if (data.openrouter.hasKey) {
            fetchOpenRouterQuota();
          }
        }
        if (data.geminiStats) {
          setKeysStats(data.geminiStats);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas de provedores:', err);
    }
  };

  React.useEffect(() => {
    fetchProvidersAndStats();
  }, []);

  React.useEffect(() => {
    if (isKeyManagerOpen && selectedProviderTab === 'openrouter') {
      fetchOpenRouterQuota();
    }
  }, [isKeyManagerOpen, selectedProviderTab]);

  // Buscar caminho do preload do espião
  React.useEffect(() => {
    const getPreload = async () => {
      try {
        const res = await fetch(getApiUrl('/api/preload-path'));
        if (res.ok) {
          const data = await res.json();
          setPreloadPath(data.path);
        }
      } catch (err) {
        console.error('Erro ao obter preload do espião:', err);
      }
    };
    getPreload();
  }, []);

  // Monitorar e anexar listeners do Webview
  React.useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleIpcMessage = (event: any) => {
      const { channel, args } = event;
      const data = args[0];

      if (channel === 'spy-hover') {
        setHoveredElement(data);
      } else if (channel === 'spy-click') {
        if (data.type === 'inspect') {
          setSelectedElement(data);
          setIsInspectMode(false);
          webview.send('toggle-inspect', false);
        }

        if (isRecording) {
          const stepId = Date.now();
          const desc = data.tagName === 'BUTTON' || data.tagName === 'A' 
            ? `Clicar no botão/link "${data.text || data.id || data.className || 'Sem texto'}"` 
            : `Clicar no elemento <${data.tagName.toLowerCase()}>`;
            
          setRecordedSteps(prev => [...prev, {
            id: stepId,
            type: 'click',
            selector: data.selector,
            xpath: data.xpath,
            tagName: data.tagName,
            text: data.text,
            description: desc
          }]);
        }
      } else if (channel === 'spy-input') {
        if (isRecording) {
          const stepId = Date.now();
          // Agrupar inputs seguidos no mesmo seletor para evitar redundância
          setRecordedSteps(prev => {
            const last = prev[prev.length - 1];
            if (last && last.type === 'input' && last.selector === data.selector) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...last,
                value: data.value,
                description: `Digitar "${data.value}" no campo "${data.name || data.id || 'Sem nome'}"`
              };
              return updated;
            }
            return [...prev, {
              id: stepId,
              type: 'input',
              selector: data.selector,
              xpath: data.xpath,
              tagName: data.tagName,
              name: data.name,
              value: data.value,
              description: `Digitar "${data.value}" no campo "${data.name || data.id || 'Sem nome'}"`
            }];
          });
        }
      }
    };

    const handleDomReady = () => {
      webview.send('toggle-inspect', isInspectMode);
      setInputUrl(webview.getURL());
      setWebviewCanGoBack(webview.canGoBack());
      setWebviewCanGoForward(webview.canGoForward());
    };

    const handleStartLoading = () => setIsWebviewLoading(true);
    const handleStopLoading = () => {
      setIsWebviewLoading(false);
      setInputUrl(webview.getURL());
      setWebviewCanGoBack(webview.canGoBack());
      setWebviewCanGoForward(webview.canGoForward());
    };

    const handleNavigate = (e: any) => {
      setInputUrl(e.url);
      setWebviewCanGoBack(webview.canGoBack());
      setWebviewCanGoForward(webview.canGoForward());
    };

    webview.addEventListener('ipc-message', handleIpcMessage);
    webview.addEventListener('dom-ready', handleDomReady);
    webview.addEventListener('did-start-loading', handleStartLoading);
    webview.addEventListener('did-stop-loading', handleStopLoading);
    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);

    return () => {
      webview.removeEventListener('ipc-message', handleIpcMessage);
      webview.removeEventListener('dom-ready', handleDomReady);
      webview.removeEventListener('did-start-loading', handleStartLoading);
      webview.removeEventListener('did-stop-loading', handleStopLoading);
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
    };
  }, [isRecording, isInspectMode, activeTab]);

  const handleSpyGoBack = () => {
    if (webviewRef.current && webviewRef.current.canGoBack()) {
      webviewRef.current.goBack();
    }
  };

  const handleSpyGoForward = () => {
    if (webviewRef.current && webviewRef.current.canGoForward()) {
      webviewRef.current.goForward();
    }
  };

  const handleSpyReload = () => {
    if (webviewRef.current) {
      webviewRef.current.reload();
    }
  };

  const handleSpyNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    let targetUrl = inputUrl.trim();
    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }
    setSpyUrl(targetUrl);
    setInputUrl(targetUrl);
  };

  const handleToggleInspect = () => {
    const newInspect = !isInspectMode;
    setIsInspectMode(newInspect);
    if (webviewRef.current) {
      webviewRef.current.send('toggle-inspect', newInspect);
    }
  };

  const handleClearSteps = () => {
    setRecordedSteps([]);
    setSelectedElement(null);
  };

  const handleRemoveStep = (id: number) => {
    setRecordedSteps(prev => prev.filter(s => s.id !== id));
  };

  const handleSyncMacroToAi = async () => {
    if (recordedSteps.length === 0) return;
    try {
      setSyncStatus({ message: 'Enviando macro...', type: '' });
      const payload = {
        url: spyUrl,
        timestamp: new Date().toISOString(),
        steps: recordedSteps
      };
      const response = await fetch('/api/save-macro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        setSyncStatus({ message: 'Macro sincronizado com o IA! ("spy-macro.json" salvo)', type: 'success' });
        setTimeout(() => setSyncStatus({ message: '', type: '' }), 5000);
      } else {
        throw new Error('Falha ao salvar macro no servidor.');
      }
    } catch (err: any) {
      setSyncStatus({ message: `Erro ao sincronizar: ${err.message}`, type: 'error' });
      setTimeout(() => setSyncStatus({ message: '', type: '' }), 5000);
    }
  };

  const handleAnalyzePageForAi = async () => {
    if (!webviewRef.current) return;
    try {
      setSyncStatus({ message: 'Analisando DOM da página...', type: '' });
      
      const extractionScript = `
        (() => {
          const interactives = [];
          const allElements = document.querySelectorAll('button, a, input, textarea, select, [role="button"], [onclick]');
          const parsed = new Set();
          
          function getCssSelector(el) {
            if (!(el instanceof Element)) return '';
            const path = [];
            let current = el;
            while (current && current.nodeType === Node.ELEMENT_NODE) {
              let selector = current.nodeName.toLowerCase();
              if (current.id) {
                selector += '#' + current.id;
                path.unshift(selector);
                break;
              } else {
                let className = '';
                if (current.className && typeof current.className === 'string') {
                  const classes = current.className.trim().split(/\\\\s+/).filter(c => !c.includes(':') && !c.startsWith('nano-banana'));
                  if (classes.length > 0) {
                    className = '.' + classes.slice(0, 3).join('.');
                  }
                }
                selector += className;
                let sibling = current;
                let nth = 1;
                while (sibling = sibling.previousElementSibling) {
                  if (sibling.nodeName.toLowerCase() === current.nodeName.toLowerCase()) nth++;
                }
                let hasNextSibling = false;
                let nextSibling = current;
                while (nextSibling = nextSibling.nextElementSibling) {
                  if (nextSibling.nodeName.toLowerCase() === current.nodeName.toLowerCase()) {
                    hasNextSibling = true;
                    break;
                  }
                }
                if (nth > 1 || hasNextSibling) {
                  selector += \`:nth-of-type(\${nth})\`;
                }
              }
              path.unshift(selector);
              current = current.parentNode;
            }
            return path.join(' > ');
          }

          function getXPath(el) {
            if (!(el instanceof Element)) return '';
            const paths = [];
            let current = el;
            for (; current && current.nodeType === Node.ELEMENT_NODE; current = current.parentNode) {
              let index = 0;
              let hasSiblings = false;
              for (let sibling = current.previousSibling; sibling; sibling = sibling.previousSibling) {
                if (sibling.nodeType === Node.DOCUMENT_TYPE_NODE) continue;
                if (sibling.nodeName === current.nodeName) index++;
              }
              for (let sibling = current.nextSibling; sibling; sibling = sibling.nextSibling) {
                if (sibling.nodeName === current.nodeName) {
                  hasSiblings = true;
                  break;
                }
              }
              const tagName = current.nodeName.toLowerCase();
              const pathIndex = (index || hasSiblings) ? \`[\${index + 1}]\` : '';
              paths.unshift(tagName + pathIndex);
            }
            return paths.length ? '/' + paths.join('/') : null;
          }

          allElements.forEach(el => {
            if (parsed.has(el)) return;
            parsed.add(el);
            
            let text = el.innerText || el.textContent || '';
            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
              text = el.placeholder || el.value || '';
            }
            text = text.trim().substring(0, 80);
            
            interactives.push({
              tagName: el.tagName,
              id: el.id || '',
              className: typeof el.className === 'string' ? el.className : '',
              text: text,
              selector: getCssSelector(el),
              xpath: getXPath(el),
              role: el.getAttribute('role') || '',
              type: el.getAttribute('type') || ''
            });
          });
          
          return {
            url: window.location.href,
            title: document.title,
            elements: interactives
          };
        })()
      `;

      const result = await webviewRef.current.executeJavaScript(extractionScript);
      
      const response = await fetch(getApiUrl('/api/save-analysis'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result)
      });

      if (response.ok) {
        setSyncStatus({ message: 'Análise da tela salva! ("spy-analysis.json" criado)', type: 'success' });
        setTimeout(() => setSyncStatus({ message: '', type: '' }), 5000);
      } else {
        throw new Error('Falha ao salvar a análise no servidor.');
      }
    } catch (err: any) {
      setSyncStatus({ message: `Erro ao analisar página: ${err.message}`, type: 'error' });
      setTimeout(() => setSyncStatus({ message: '', type: '' }), 5000);
    }
  };


  const handleKeysFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingKeys(true);
    setKeyManagerError(null);

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const extractedKeys: string[] = [];
        
        lines.forEach(line => {
          const clean = line.trim();
          if (clean && clean.startsWith('AIzaSy')) {
            extractedKeys.push(clean);
          }
        });

        if (extractedKeys.length === 0) {
          setKeyManagerError('Nenhuma chave Gemini válida (iniciando com AIzaSy) foi encontrada no arquivo.');
          setIsUploadingKeys(false);
          return;
        }

        const response = await fetch(getApiUrl('/api/keys/upload'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: extractedKeys })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Erro ao subir chaves.');
        }

        const data = await response.json();
        setKeysStats(data);
      } catch (err: any) {
        console.error(err);
        setKeyManagerError(err.message || 'Ocorreu um erro no processamento do arquivo.');
      } finally {
        setIsUploadingKeys(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleRemoveKey = async (id: string) => {
    try {
      setKeyManagerError(null);
      // Atualização otimista imediata na UI
      setKeysStats(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1),
        free: Math.max(0, prev.free - (prev.keysList.find(k => k.id === id)?.status === 'free' ? 1 : 0)),
        exhausted: Math.max(0, prev.exhausted - (prev.keysList.find(k => k.id === id)?.status === 'exhausted' ? 1 : 0)),
        keysList: prev.keysList.filter(k => k.id !== id)
      }));

      const response = await fetch(getApiUrl(`/api/keys?id=${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      if (response.ok) {
        const data = await response.json();
        setKeysStats(data);
      } else {
        const errData = await response.json();
        setKeyManagerError(errData.error || 'Erro ao remover chave.');
        fetchProvidersAndStats();
      }
    } catch (err: any) {
      console.error(err);
      setKeyManagerError(err.message || 'Erro ao conectar ao servidor.');
      fetchProvidersAndStats();
    }
  };

  const handleResetKeys = async () => {
    try {
      setKeyManagerError(null);
      const response = await fetch(getApiUrl('/api/keys/reset'), { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setKeysStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearKeys = async () => {
    if (!window.confirm('Tem certeza que deseja apagar todas as chaves cadastradas?')) return;
    try {
      setKeyManagerError(null);
      // Atualização otimista imediata na UI
      setKeysStats({ total: 0, free: 0, exhausted: 0, keysList: [] });

      const response = await fetch(getApiUrl('/api/keys/clear'), { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (response.ok) {
        const data = await response.json();
        setKeysStats(data);
      } else {
        const errData = await response.json();
        setKeyManagerError(errData.error || 'Erro ao limpar chaves.');
        fetchProvidersAndStats();
      }
    } catch (err: any) {
      console.error(err);
      setKeyManagerError(err.message || 'Erro ao conectar ao servidor.');
      fetchProvidersAndStats();
    }
  };

  const handleSelectActiveProvider = async (prov: 'gemini' | 'openrouter') => {
    try {
      setKeyManagerError(null);
      const res = await fetch(getApiUrl('/api/providers/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeProvider: prov })
      });
      if (res.ok) {
        const data = await res.json();
        setActiveProvider(data.activeProvider);
      }
    } catch (err: any) {
      console.error('Erro ao alternar provedor:', err);
    }
  };

  const handleSaveOpenRouterSettings = async (makeActive = false) => {
    setIsSavingProviderSettings(true);
    setKeyManagerError(null);
    setTestResult(null);
    const key = openrouterKeyInput.trim();
    try {
      const payload: any = {
        activeProvider: makeActive ? 'openrouter' : activeProvider,
        openrouter: {
          baseUrl: openrouterBaseUrlInput.trim() || 'https://openrouter.ai/api/v1',
          model: openrouterModelInput.trim() || 'nvidia/nemotron-3-ultra-550b-a55b:free',
        }
      };
      if (key) {
        payload.openrouter.apiKey = key;
      }

      const res = await fetch(getApiUrl('/api/providers/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar configurações.');
      }
      const data = await res.json();
      setActiveProvider(data.activeProvider);
      setOpenrouterConfig(data.openrouter);
      setOpenrouterKeyInput('');
      setTestResult({ success: true, message: 'Configurações do OpenRouter salvas com sucesso!' });
      fetchOpenRouterQuota(key || undefined);
    } catch (err: any) {
      setKeyManagerError(err.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSavingProviderSettings(false);
    }
  };

  const handleSelectOpenRouterModel = async (modelId: string) => {
    setOpenrouterModelInput(modelId);
    try {
      await fetch(getApiUrl('/api/providers/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openrouter: { model: modelId }
        })
      });
      setOpenrouterConfig(prev => ({ ...prev, model: modelId }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveOpenRouterKeyOnly = async () => {
    const key = openrouterKeyInput.trim();
    if (!key) return;
    setIsSavingProviderSettings(true);
    setKeyManagerError(null);
    try {
      const res = await fetch(getApiUrl('/api/providers/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openrouter: {
            apiKey: key,
            baseUrl: openrouterBaseUrlInput.trim() || 'https://openrouter.ai/api/v1',
            model: openrouterModelInput.trim() || 'minimax/minimax-m3:free'
          }
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Erro ao salvar chave.');
      }
      const data = await res.json();
      setOpenrouterConfig(data.openrouter);
      setOpenrouterKeyInput('');
      setTestResult({ success: true, message: 'Chave universal do OpenRouter salva com sucesso!' });
      fetchOpenRouterQuota(key);
    } catch (err: any) {
      setKeyManagerError(err.message || 'Erro ao salvar chave.');
    } finally {
      setIsSavingProviderSettings(false);
    }
  };

  const handleSaveGeminiModel = async (model: string) => {
    setGeminiModel(model);
    try {
      await fetch(getApiUrl('/api/providers/settings'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gemini: { preferredModel: model }
        })
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleTestProvider = async (prov: 'gemini' | 'openrouter') => {
    setIsTestingProvider(true);
    setTestResult(null);
    setKeyManagerError(null);
    try {
      const body: any = { provider: prov };
      if (prov === 'openrouter') {
        if (openrouterKeyInput.trim()) body.apiKey = openrouterKeyInput.trim();
        body.baseUrl = openrouterBaseUrlInput.trim();
        body.model = openrouterModelInput.trim();
      } else {
        body.model = geminiModel;
      }
      const res = await fetch(getApiUrl('/api/providers/test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Falha no teste de conexão.');
      }
      setTestResult({ success: true, message: data.message });
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || 'Erro no teste.' });
    } finally {
      setIsTestingProvider(false);
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsAnalyzing(false);
    setIsAuditing(false);
    setError('Operação cancelada pelo usuário.');
    setAuditError('Auditoria cancelada pelo usuário.');
  };

  // Funções da Auditoria Visual e Organização de Imagens
  const handleAuditImagesSelect = (files: FileList | File[]) => {
    setAuditError(null);
    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
        const newItem: AuditImageItem = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'image/png',
          dataUrl,
          base64
        };
        setUploadedAuditImages(prev => {
          const exists = prev.some(p => p.name === file.name && p.size === file.size);
          return exists ? prev : [...prev, newItem];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAuditImage = (id: string) => {
    setUploadedAuditImages(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAllAuditImages = () => {
    setUploadedAuditImages([]);
    setAuditResult(null);
    setAuditError(null);
  };

  // Funções de Imagens de Referência do Personagem / Estilo
  const handleAuditReferenceImagesSelect = (files: FileList | File[]) => {
    setAuditError(null);
    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    fileArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
        const newItem: AuditImageItem = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: file.size,
          mimeType: file.type || 'image/png',
          dataUrl,
          base64
        };
        setAuditReferenceImages(prev => {
          const exists = prev.some(p => p.name === file.name && p.size === file.size);
          return exists ? prev : [...prev, newItem];
        });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveAuditReferenceImage = (id: string) => {
    setAuditReferenceImages(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAllAuditReferenceImages = () => {
    setAuditReferenceImages([]);
  };

  const handlePullReferenceCharactersFromSession = () => {
    const validExisting = characterImages.filter((img): img is { data: string; mimeType: string } => !!img && !!img.data);
    if (validExisting.length === 0) {
      setAuditError('Nenhuma imagem de personagem encontrada no Gerador. Carregue imagens de personagem na aba Vídeo/Carrossel ou adicione diretamente aqui.');
      return;
    }
    const newItems: AuditImageItem[] = validExisting.map((img, idx) => ({
      id: Math.random().toString(36).substring(2, 9),
      name: `Personagem_Ref_${idx + 1}.${img.mimeType.includes('jpeg') || img.mimeType.includes('jpg') ? 'jpg' : 'png'}`,
      size: Math.round((img.data.length * 3) / 4),
      mimeType: img.mimeType || 'image/png',
      dataUrl: `data:${img.mimeType || 'image/png'};base64,${img.data}`,
      base64: img.data
    }));
    setAuditReferenceImages(prev => {
      const existingNames = new Set(prev.map(p => p.name));
      const filtered = newItems.filter(item => !existingNames.has(item.name));
      return [...prev, ...filtered];
    });
  };

  const handleAuditDocumentUpload = async (file: File) => {
    if (!file) return;
    setAuditError(null);
    setIsExtractingDoc(true);

    const safetyTimeout = setTimeout(() => {
      setIsExtractingDoc(false);
    }, 25000);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      // Para arquivos de texto direto (.txt, .md, .json, .csv, .srt, .vtt, .log)
      if (['txt', 'md', 'json', 'csv', 'srt', 'vtt', 'log'].includes(ext)) {
        const text = await file.text();
        const clean = text.trim();
        if (!clean) {
          throw new Error('O arquivo de texto selecionado está vazio.');
        }
        setAuditScriptInput(clean);
        setAuditDocumentInfo({
          filename: file.name,
          size: file.size,
          wordCount: clean.split(/\s+/).filter(Boolean).length
        });
      } else {
        // Para PDF, Word (.docx, .doc), etc. enviamos para o backend de extração
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const b64 = dataUrl.includes('base64,') ? dataUrl.split('base64,')[1] : dataUrl;
            resolve(b64);
          };
          reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
          reader.readAsDataURL(file);
        });

        const base64Data = await base64Promise;
        const controller = new AbortController();
        const fetchTimeout = setTimeout(() => controller.abort(), 20000);

        try {
          const res = await fetch(getApiUrl('/api/extract-document-text'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              data: base64Data,
              filename: file.name,
              mimeType: file.type
            })
          });

          clearTimeout(fetchTimeout);

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Erro HTTP ${res.status} ao extrair documento.`);
          }

          const data = await res.json();
          if (!data.success) {
            throw new Error(data.error || 'Falha ao extrair texto do documento.');
          }

          if (!data.text || !data.text.trim()) {
            throw new Error('Nenhum texto legível pôde ser extraído deste documento.');
          }

          setAuditScriptInput(data.text);
          setAuditDocumentInfo({
            filename: file.name,
            size: file.size,
            wordCount: data.wordCount
          });
        } catch (fetchErr: any) {
          clearTimeout(fetchTimeout);
          if (fetchErr.name === 'AbortError') {
            throw new Error('Tempo limite excedido ao processar o documento (timeout de 20s).');
          }
          throw fetchErr;
        }
      }
    } catch (err: any) {
      console.error('Erro ao processar documento de roteiro:', err);
      setAuditError(`Erro ao carregar documento "${file.name}": ${err.message}`);
    } finally {
      clearTimeout(safetyTimeout);
      setIsExtractingDoc(false);
    }
  };

  const handleClearAuditDocument = () => {
    setAuditDocumentInfo(null);
    setAuditScriptInput('');
  };

  const handlePullScriptFromGeneration = () => {
    setAuditError(null);
    setAuditDocumentInfo(null);
    if (carouselResult && carouselResult.slides && carouselResult.slides.length > 0) {
      let scriptText = `=== CARROSSEL GERADO: ${topic || 'Carrossel Sem Título'} ===\n\n`;
      carouselResult.slides.forEach((s) => {
        scriptText += `Slide ${s.slideNumber}:\n`;
        scriptText += `- Descrição Visual: ${s.descriptionPt}\n`;
        scriptText += `- Prompt de Imagem: ${s.imagePromptEn}\n`;
        scriptText += `- Diálogo / Texto em Balões: "${s.textInBubblesPt}"\n\n`;
      });
      setAuditScriptInput(scriptText.trim());
      
      const charNotes = [
        artStyle ? `Estilo Visual: ${artStyle}` : '',
        carouselTone ? `Tom Narrativo: ${carouselTone}` : '',
        characterDescription ? `Personagens: ${characterDescription}` : 'Personagens principais com consistência de traço, iluminação e cores'
      ].filter(Boolean).join('\n');
      
      setAuditCharacterNotes(charNotes);
    } else if (result && result.scenes && result.scenes.length > 0) {
      let scriptText = `=== ROTEIRO DE VÍDEO GERADO: ${topic || 'Vídeo Sem Título'} ===\n\n`;
      if (result.nanoBananaImagePrompt) {
        scriptText += `Capa do Vídeo (PostForge):\n- Prompt: ${result.nanoBananaImagePrompt}\n\n`;
      }
      result.scenes.forEach((s) => {
        scriptText += `Slide / Cena ${s.sceneNumber} (${s.duration}s):\n`;
        scriptText += `- Contexto da Cena: ${s.contextPt}\n`;
        scriptText += `- Prompt Visual: ${s.videoPromptEn}\n`;
        scriptText += `- Diálogo / Narração: "${s.dialoguePt}"\n\n`;
      });
      setAuditScriptInput(scriptText.trim());

      const charNotes = [
        animationStyle ? `Estilo de Animação: ${animationStyle}` : '',
        scriptTone ? `Tom da Narrativa: ${scriptTone}` : '',
        characterDescription ? `Personagens: ${characterDescription}` : 'Continuidade de figurino, traço e paleta de iluminação cinematográfica'
      ].filter(Boolean).join('\n');

      setAuditCharacterNotes(charNotes);
    } else {
      setAuditError('Nenhum roteiro ou carrossel gerado foi encontrado na sessão. Gere um na aba Vídeo/Carrossel ou carregue um arquivo .PDF / .DOC / .TXT diretamente.');
    }
  };

  const handleRunAudit = async () => {
    if (uploadedAuditImages.length === 0) {
      setAuditError('Por favor, faça o upload de pelo menos 1 imagem para auditoria.');
      return;
    }
    if (!auditScriptInput.trim()) {
      setAuditError('Por favor, informe ou puxe o roteiro dos slides para ordenar as imagens.');
      return;
    }

    setIsAuditing(true);
    setAuditError(null);
    setAuditResult(null);

    try {
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const payload = {
        images: uploadedAuditImages.map(img => ({
          name: img.name,
          mimeType: img.mimeType,
          data: img.base64
        })),
        characterReferenceImages: auditReferenceImages.map(img => ({
          name: img.name,
          mimeType: img.mimeType,
          data: img.base64
        })),
        scriptContext: auditScriptInput,
        characterNotes: auditCharacterNotes,
        provider: activeProvider,
        model: activeProvider === 'openrouter' ? openrouterModelInput : geminiModel
      };

      const response = await fetch(getApiUrl('/api/audit-images'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `Erro HTTP ${response.status} ao auditar imagens.`);
      }

      const data = await response.json();
      if (!data.text) throw new Error('A IA não retornou resposta válida.');

      if (data.failoverUsed) {
        setLastGenerationMeta({
          provider: data.provider,
          model: data.model,
          failoverUsed: true,
          originalProvider: data.originalProvider,
          failoverReason: data.failoverReason
        });
      } else {
        setLastGenerationMeta({
          provider: data.provider,
          model: data.model,
          failoverUsed: false
        });
      }

      let cleanText = data.text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed: AuditResult = JSON.parse(cleanText);
      setAuditResult(parsed);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Erro na auditoria de imagens:', err);
      setAuditError(err.message || 'Ocorreu um erro ao processar a auditoria de imagens.');
    } finally {
      setIsAuditing(false);
      abortControllerRef.current = null;
    }
  };

  const handleDownloadOrderedImagesZip = async () => {
    if (!auditResult || !auditResult.auditoria_imagens || auditResult.auditoria_imagens.length === 0) return;
    setIsGeneratingZip(true);
    try {
      const zip = new JSZip();
      const imagesFolder = zip.folder("imagens_ordenadas");

      auditResult.auditoria_imagens.forEach((item) => {
        const matched = uploadedAuditImages.find(img => 
          img.name.toLowerCase() === item.imagem_arquivo_correspondente.toLowerCase() ||
          img.name.toLowerCase().includes(item.imagem_arquivo_correspondente.toLowerCase()) ||
          item.imagem_arquivo_correspondente.toLowerCase().includes(img.name.toLowerCase())
        );

        if (matched && imagesFolder) {
          const extension = matched.name.split('.').pop() || 'png';
          const cleanName = matched.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
          const sequentialFilename = `Slide_${String(item.slide_numero).padStart(2, '0')}_${cleanName}.${extension}`;
          imagesFolder.file(sequentialFilename, matched.base64, { base64: true });
        }
      });

      if (auditResult.imagens_sobressalentes && auditResult.imagens_sobressalentes.length > 0) {
        const surplusFolder = zip.folder("imagens_sobressalentes");
        auditResult.imagens_sobressalentes.forEach((surplus) => {
          const matched = uploadedAuditImages.find(img => 
            img.name.toLowerCase() === surplus.nome_arquivo.toLowerCase()
          );
          if (matched && surplusFolder) {
            surplusFolder.file(matched.name, matched.base64, { base64: true });
          }
        });
      }

      let reportText = `====================================================\n`;
      reportText += `POSTFORGE - RELATÓRIO DE AUDITORIA & ORDENAÇÃO DE IMAGENS\n`;
      reportText += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
      reportText += `Pontuação Média de Consistência: ${auditResult.pontuacao_media_geral || 'N/A'}\n`;
      reportText += `====================================================\n\n`;
      reportText += `RESUMO GERAL DE CONSISTÊNCIA:\n${auditResult.resumo_geral_consistencia}\n\n`;
      reportText += `----------------------------------------------------\n`;
      reportText += `MAPEAMENTO SEQUENCIAL DOS SLIDES:\n`;
      reportText += `----------------------------------------------------\n\n`;

      auditResult.auditoria_imagens.forEach((item) => {
        reportText += `[SLIDE ${item.slide_numero}] -> Arquivo: "${item.imagem_arquivo_correspondente}" (Consistência: ${item.pontuacao_consistencia})\n`;
        reportText += `Descrição Esperada: ${item.descricao_esperada}\n`;
        reportText += `Feedback Visual da IA: ${item.feedback_visual}\n`;
        if (item.destaque_pontos_fortes && item.destaque_pontos_fortes.length > 0) {
          reportText += `Pontos Fortes: ${item.destaque_pontos_fortes.join(', ')}\n`;
        }
        if (item.alertas_inconsistencia && item.alertas_inconsistencia.length > 0) {
          reportText += `Alertas/Ajustes: ${item.alertas_inconsistencia.join(', ')}\n`;
        }
        reportText += `\n`;
      });

      if (auditResult.imagens_sobressalentes && auditResult.imagens_sobressalentes.length > 0) {
        reportText += `----------------------------------------------------\n`;
        reportText += `IMAGENS SOBRESSALENTES / NÃO UTILIZADAS:\n`;
        reportText += `----------------------------------------------------\n\n`;
        auditResult.imagens_sobressalentes.forEach((surplus) => {
          reportText += `- Arquivo: "${surplus.nome_arquivo}": ${surplus.motivo_descarte}\n`;
        });
      }

      zip.file("relatorio_auditoria_postforge.txt", reportText);
      if (auditScriptInput) {
        zip.file("roteiro_referencia.txt", auditScriptInput);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      saveAs(zipBlob, `PostForge_Imagens_Sequenciais_${Date.now()}.zip`);
    } catch (err: any) {
      console.error('Erro ao gerar ZIP:', err);
      alert('Ocorreu um erro ao gerar o arquivo ZIP: ' + err.message);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  const handleExportAuditReportTXT = () => {
    if (!auditResult) return;
    let reportText = `====================================================\n`;
    reportText += `POSTFORGE - RELATÓRIO DE AUDITORIA DE IMAGENS\n`;
    reportText += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
    reportText += `Pontuação Média de Consistência: ${auditResult.pontuacao_media_geral || 'N/A'}\n`;
    reportText += `====================================================\n\n`;
    reportText += `RESUMO GERAL:\n${auditResult.resumo_geral_consistencia}\n\n`;
    
    auditResult.auditoria_imagens.forEach((item) => {
      reportText += `=====================================\n`;
      reportText += `SLIDE ${item.slide_numero} (Consistência: ${item.pontuacao_consistencia})\n`;
      reportText += `Imagem Mapeada: ${item.imagem_arquivo_correspondente}\n`;
      reportText += `Descrição Esperada: ${item.descricao_esperada}\n`;
      reportText += `Feedback da IA: ${item.feedback_visual}\n`;
      if (item.destaque_pontos_fortes?.length) {
        reportText += `Pontos Fortes:\n  - ${item.destaque_pontos_fortes.join('\n  - ')}\n`;
      }
      if (item.alertas_inconsistencia?.length) {
        reportText += `Alertas:\n  - ${item.alertas_inconsistencia.join('\n  - ')}\n`;
      }
      reportText += `\n`;
    });

    const blob = new Blob([reportText], { type: "text/plain;charset=utf-8" });
    saveAs(blob, `auditoria_imagens_postforge_${Date.now()}.txt`);
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedStates((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates((prev) => ({ ...prev, [id]: false }));
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
  };

  const exportAsTXT = () => {
    if (activeTab === 'script' && result) {
      let content = `--- PROMPT CAPA DO POST (POSTFORGE) ---\n\n`;
      content += `${result.nanoBananaImagePrompt}\n\n`;
      content += `=========================================\n\n`;
      
      result.scenes?.forEach((scene) => {
        content += `CENA ${scene.sceneNumber} (${scene.duration}s)\n`;
        content += `Contexto: ${scene.contextPt}\n\n`;
        content += `[PROMPT DE VÍDEO - INGLÊS]\n`;
        content += `${scene.videoPromptEn}\n\n`;
        content += `--- NARRAÇÃO / DIÁLOGO ---\n`;
        content += `PT: ${scene.dialoguePt}\n\n`;
        content += `EN: ${scene.dialogueEn}\n\n`;
        content += `ES: ${scene.dialogueEs}\n\n`;
        content += `=========================================\n\n`;
      });

      content += `--- INSTAGRAM POST ---\n\n`;
      content += result.instagramPost;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `roteiro_postforge.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (activeTab === 'carousel' && carouselResult) {
      let content = `--- CARROSSEL INSTAGRAM (POSTFORGE) ---\n\n`;
      
      carouselResult.slides?.forEach((slide) => {
        content += `SLIDE ${slide.slideNumber}\n`;
        content += `Descrição: ${slide.descriptionPt}\n`;
        content += `Texto nos Balões (PT): ${slide.textInBubblesPt}\n`;
        content += `Texto nos Balões (EN): ${slide.textInBubblesEn}\n`;
        content += `Texto nos Balões (ES): ${slide.textInBubblesEs}\n\n`;
        content += `[PROMPT DE IMAGEM - INGLÊS]\n`;
        content += `${slide.imagePromptEn}\n\n`;
        content += `=========================================\n\n`;
      });

      content += `--- LEGENDA INSTAGRAM ---\n\n`;
      content += carouselResult.instagramPost;

      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `carrossel_postforge.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const exportAsPDF = () => {
    const doc = new jsPDF();
    let yPos = 20;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const maxLineWidth = pageWidth - margin * 2;

    const addText = (text: string, fontSize: number, isBold: boolean = false, textColor: [number, number, number] = [0,0,0]) => {
      if (!text) return;
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      const lines = doc.splitTextToSize(text, maxLineWidth);
      const lineHeight = fontSize * 0.4 + 1.5;

      for (const line of lines) {
        if (yPos + lineHeight > pageHeight - margin) {
          doc.addPage();
          yPos = margin;
        }
        doc.text(line, margin, yPos);
        yPos += lineHeight;
      }
      yPos += 3;
    };

    if (activeTab === 'script' && result) {
      addText("ROTEIRO GERADO - POSTFORGE", 18, true);
      yPos += 3;
      
      addText("PROMPT DA IMAGEM DE CAPA", 12, true, [100, 100, 200]);
      addText(result.nanoBananaImagePrompt, 10);
      yPos += 5;

      result.scenes?.forEach((scene) => {
        addText(`CENA ${scene.sceneNumber} (${scene.duration}s)`, 14, true);
        addText("Contexto:", 10, true, [100, 100, 100]);
        addText(scene.contextPt, 10);
        addText("Prompt de Vídeo (EN):", 10, true, [50, 150, 50]);
        addText(scene.videoPromptEn, 10);
        addText("Falas / Diálogo:", 10, true, [200, 100, 50]);
        addText(`PT: ${scene.dialoguePt}`, 10);
        addText(`EN: ${scene.dialogueEn}`, 10);
        addText(`ES: ${scene.dialogueEs}`, 10);
        yPos += 4;
      });

      addText("INSTAGRAM POST", 14, true, [180, 50, 150]);
      addText(result.instagramPost, 10);
      doc.save("roteiro_postforge.pdf");

    } else if (activeTab === 'carousel' && carouselResult) {
      addText("CARROSSEL INSTAGRAM - POSTFORGE", 18, true);
      addText(`ESTILO: ${artStyle}`, 12, true, [100, 100, 100]);
      yPos += 3;

      carouselResult.slides?.forEach((slide) => {
        addText(`SLIDE ${slide.slideNumber}`, 14, true);
        addText("Descrição:", 10, true, [100, 100, 100]);
        addText(slide.descriptionPt, 10);
        addText("Texto nos Balões:", 10, true, [50, 50, 200]);
        addText(`PT: ${slide.textInBubblesPt}`, 10);
        addText(`EN: ${slide.textInBubblesEn}`, 10);
        addText(`ES: ${slide.textInBubblesEs}`, 10);
        addText("Prompt de Imagem (EN):", 10, true, [50, 150, 50]);
        addText(slide.imagePromptEn, 10);
        yPos += 4;
      });

      addText("INSTAGRAM POST", 14, true, [180, 50, 150]);
      addText(carouselResult.instagramPost, 10);
      doc.save("carrossel_postforge.pdf");
    }
  };

  const exportAsDOCX = async () => {
    const children: any[] = [];

    if (activeTab === 'script' && result) {
      children.push(new Paragraph({ text: "ROTEIRO GERADO - POSTFORGE", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
      children.push(new Paragraph({ text: `Nicho: ${niche.toUpperCase()}`, heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Prompt Imagem de Capa: ", bold: true }), new TextRun({ text: result.nanoBananaImagePrompt || '' })] }));
      
      result.scenes?.forEach((scene) => {
        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({ text: `CENA ${scene.sceneNumber} (${scene.duration}s)`, heading: HeadingLevel.HEADING_3 }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Contexto: ", bold: true }), new TextRun({ text: scene.contextPt || '' })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Prompt Vídeo: ", bold: true }), new TextRun({ text: scene.videoPromptEn || '' })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Narração (PT): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialoguePt || '' })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Narração (EN): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialogueEn || '' })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Narração (ES): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialogueEs || '' })] }));
      });

      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ text: "Legenda Instagram", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: result.instagramPost || '' }));

    } else if (activeTab === 'carousel' && carouselResult) {
      children.push(new Paragraph({ text: "CARROSSEL GERADO", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
      children.push(new Paragraph({ text: `Estilo: ${artStyle.toUpperCase()}`, heading: HeadingLevel.HEADING_2 }));

      carouselResult.slides?.forEach((slide) => {
        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({ text: `SLIDE ${slide.slideNumber}`, heading: HeadingLevel.HEADING_3 }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Descrição: ", bold: true }), new TextRun({ text: slide.descriptionPt || '' })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (PT): ", bold: true, color: "3333FF" }), new TextRun({ text: slide.textInBubblesPt || '' })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (EN): ", bold: true, color: "3333FF" }), new TextRun({ text: slide.textInBubblesEn || '' })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (ES): ", bold: true, color: "3333FF" }), new TextRun({ text: slide.textInBubblesEs || '' })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Prompt Imagem: ", bold: true }), new TextRun({ text: slide.imagePromptEn || '' })] }));
      });

      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ text: "Legenda Instagram", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: carouselResult.instagramPost || '' }));
    }

    if (children.length > 0) {
      const docx = new Document({
        sections: [{ children }]
      });
      const blob = await Packer.toBlob(docx);
      saveAs(blob, activeTab === 'script' ? "roteiro_gerado.docx" : "carrossel_gerado.docx");
    }
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      
      setCharacterImages(prev => {
        const newImages = [...prev];
        newImages[index] = { data: base64, mimeType };
        return newImages;
      });
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (index: number) => {
    setCharacterImages(prev => {
      const newImages = [...prev];
      newImages[index] = undefined;
      return newImages;
    });
  };

  const handleContextImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const [header, base64] = dataUrl.split(',');
        const mimeType = header.split(':')[1].split(';')[0];
        
        setContextImages(prev => [...prev, { data: base64, mimeType }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveContextImage = (index: number) => {
    setContextImages(prev => prev.filter((_, i) => i !== index));
  };

  const handlePdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
        setError('Por favor, selecione apenas arquivos em formato PDF.');
        return;
      }
      if (file.size > 30 * 1024 * 1024) {
        setError(`O arquivo "${file.name}" ultrapassa o limite de 30MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        const [header, base64] = dataUrl.split(',');
        const mimeType = 'application/pdf';
        
        setReferencePdfs(prev => [...prev, { 
          name: file.name, 
          data: base64, 
          mimeType, 
          size: file.size 
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleRemovePdf = (index: number) => {
    setReferencePdfs(prev => prev.filter((_, i) => i !== index));
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 100 * 1024 * 1024) { // 100MB limit
      setError('Vídeo muito grande. Por favor, use vídeos menores que 100MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const [header, base64] = dataUrl.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      setVideoFile({ data: base64, mimeType });
      setAnalysisResult(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyzeVideo = async () => {
    if (!videoFile) return;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(getApiUrl('/api/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: "Analise este vídeo e crie uma sinopse cativante para uma postagem no Instagram. Inclua gancho inicial, corpo do texto e hashtags relevantes.",
          videoData: videoFile.data,
          mimeType: videoFile.mimeType,
          provider: activeProvider,
          model: activeProvider === 'openrouter' ? openrouterModelInput : geminiModel
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao analisar vídeo.');
      }

      const data = await response.json();
      if (!data.text) throw new Error('Sem resposta da análise.');
      setAnalysisResult(data.text);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message || 'Erro ao analisar vídeo.');
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() && contextImages.length === 0 && referencePdfs.length === 0) {
      setError('Por favor, insira o tema da história ou anexe PDFs/imagens de referência.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsLoading(true);
    setError(null);
    setResult(null);
    setCarouselResult(null);

    try {
      const hasManualTopic = topic.trim().length > 0;
      const temaFinal = hasManualTopic 
        ? topic.trim() 
        : (referencePdfs.length > 0 || contextImages.length > 0)
          ? "Tema e ensinamento central extraídos diretamente do(s) documento(s) PDF e imagens de referência anexados."
          : "Reflexão profunda sobre autoconhecimento e vida cotidiana.";
      
      let promptText = "";
      let responseSchema: any = {};

      if (activeTab === 'script') {
        const topicInstruction = hasManualTopic
          ? `O tema do vídeo é: "${temaFinal}".`
          : (referencePdfs.length > 0 || contextImages.length > 0)
            ? `ATENÇÃO: O usuário NÃO forneceu um tema manual por texto, mas anexou arquivo(s) PDF de referência. Você DEVE ler e analisar profundamente o PDF anexado, extrair dele a principal lição, insight, história ou conceito transformador, e usá-lo como o TEMA CENTRAL e a narrativa deste roteiro.`
            : `O tema do vídeo é: "${temaFinal}".`;

        promptText = `Você é um diretor de cinema e roteirista premiado, especialista em vídeos curtos e virais que geram identificação profunda e emocional.
        O nicho do canal é: "${niche}".
        O estilo de animação DEVE ser estritamente "${animationStyle}". Descreva isso claramente em todos os prompts de vídeo.
        O estilo visual dos enquadramentos deve seguir: "${visualDynamism}".
        ${mixedOffs ? '- DINAMISMO CRIATIVO: Alterne cenas com o personagem em cena e cenas de corte/transição (b-roll, foco no ambiente ou detalhes visuais) com narração em off (isVoiceOver: true).' : ''}
        ${niche !== 'Top 10 Filmes e Séries' ? `O tom da narrativa deve ser estritamente: "${scriptTone}".` : ''}
        ${topicInstruction}
        ${includeHook ? 'A primeira cena (CENA 1) DEVE conter um "HOOK" (gancho) poderoso que prenda a atenção nos primeiros 3 segundos e gere identificação instantânea.' : 'Não é necessário um gancho comercial na primeira cena; foque no fluxo emocional natural e profundo.'}
        
        INSTRUÇÕES PARA O DIÁLOGO/NARRAÇÃO:
        - IDENTIFICAÇÃO DE VOZ: Analise as imagens de personagem enviadas. Se houver um personagem feminino proeminente, a voz da narração deve ser FEMININA. Se for masculino, MASCULINA. Se não houver clareza ou não houver fotos, use uma voz que melhor se adapte ao tema.
        - Use PSICOLOGIA e FILOSOFIA para criar falas que toquem na ferida, que façam o espectador se sentir compreendido.
        - O objetivo é gerar identificação visceral. O espectador deve pensar: "Isso foi escrito para mim".
        ${niche !== 'Top 10 Filmes e Séries' && niche !== 'Fitness' ? `
        - ${scriptTone === 'Acolhedor / Compassivo' ? 'Use um tom acolhedor e compassivo: diálogo suave, focado em validação emocional profunda, carinho e acolhimento sem cobranças ou julgamentos, ideal para cura interna e autocompaixão.' : ''}
        - ${scriptTone === 'Terapêutico / ACT' ? 'Use uma abordagem terapêutica baseada em ACT (Terapia de Aceitação e Compromisso): foco na observação consciente dos pensamentos ("você não é seus pensamentos"), aceitação de emoções difíceis sem lutar contra elas e atenção plena ao momento presente.' : ''}
        - ${scriptTone === 'Vulnerável / Íntimo' ? 'Use um tom vulnerável e íntimo: conversas sinceras e abertas sobre carência, medos, sensação de abandono e dor emocional que gerem identificação imediata.' : ''}
        - ${scriptTone === 'Encorajador / Reparador' ? 'Use um tom encorajador e reparador: foco em restaurar a autoestima, perdoar erros do passado, reconstruir o amor-próprio e firmar compromissos pessoais gentis.' : ''}
        - ${scriptTone === 'Poético' ? 'Use rimas suaves, métrica e metáforas visuais delicadas, focando na beleza da dor e da superação.' : ''}
        - ${scriptTone === 'Metafórico e Profundo' ? 'Use analogias com a natureza, o universo ou objetos cotidianos para explicar sentimentos complexos que "quebram" quem lê.' : ''}
        - ${scriptTone === 'Filosófico' ? 'Explore dilemas existenciais, a brevidade da vida e a busca por sentido, citando ou aludindo a grandes pensadores de forma acessível.' : ''}
        ` : ''}
        ${niche === 'Fitness' ? `
        - ${scriptTone === 'Motivacional / Foco' ? 'Foque em quebra de limites, superação de dores e barreiras mentais, disciplina férrea e mentalidade inabalável.' : ''}
        - ${scriptTone === 'Instrucional / Passo a Passo' ? 'Estruture as falas com orientações técnicas e práticas de alta precisão sobre biomecânica, postura, treino e execução correta.' : ''}
        - ${scriptTone === 'Curiosidades' ? 'Revele dados científicos fascinantes e mitos desmistificados sobre o corpo humano, metabolismo e ganho de rendimento.' : ''}
        ` : ''}
        ${niche === 'Top 10 Filmes e Séries' ? 'Para o nicho de Filmes e Séries, foque em curiosidades, rankings e fatos impactantes do TOP 10, mantendo o dinamismo informativo.' : ''}
        
        O vídeo terá ${sceneCount} cenas, cada uma com aproximadamente ${duration} segundos.
        Crie um prompt (em Inglês) para cada cena focado em um estilo cinematográfico e artístico.
        REGRA IMPORTANTE: No "videoPromptEn", inclua sempre no final a descrição da voz baseada na sua percepção do gênero do personagem: "The narration voice is [Male/Female]".\n\n`;

        promptText += `Para cada cena, forneça:
        1. Um "contextPt" narrando um breve contexto/observação explicando o que acontece na cena (em Português).
        2. Um Prompt de Geração de Vídeo ALTAMENTE DESCRITIVO (Estritamente em Inglês), detalhando a ação, cenário e visual.
        3. Narração ou Diálogo para a cena em PT, EN e ES.
        4. Um campo booleano "isVoiceOver".`;

        responseSchema = {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  duration: { type: Type.INTEGER },
                  contextPt: { type: Type.STRING },
                  videoPromptEn: { type: Type.STRING },
                  dialoguePt: { type: Type.STRING },
                  dialogueEn: { type: Type.STRING },
                  dialogueEs: { type: Type.STRING },
                  isVoiceOver: { type: Type.BOOLEAN },
                },
                required: ["sceneNumber", "duration", "contextPt", "videoPromptEn", "dialoguePt", "dialogueEn", "dialogueEs", "isVoiceOver"],
              },
            },
            nanoBananaImagePrompt: { type: Type.STRING },
            instagramPost: { type: Type.STRING },
          },
          required: ["scenes", "nanoBananaImagePrompt", "instagramPost"],
        };
      } else {
        // CAROUSEL LOGIC
        const topicInstruction = hasManualTopic
          ? `O tema base é: "${temaFinal}".`
          : (referencePdfs.length > 0 || contextImages.length > 0)
            ? `ATENÇÃO: O usuário NÃO forneceu um tema manual por texto, mas anexou arquivo(s) PDF de referência. Você DEVE extrair a essência, ensinamentos práticos ou reflexões centrais do PDF anexado e utilizá-los como base de todo este carrossel.`
            : `O tema base é: "${temaFinal}".`;

        promptText = `Você é um engenheiro de prompts especialista em Carrosséis do Instagram e geração de imagens por IA.
        O usuário quer um Carrossel com ${sceneCount} imagens (slides).
        O estilo de arte DEVE ser estritamente "${artStyle}".
        O nicho do canal é: "${niche}".
        O tom do diálogo dos slides deve ser focado em: "${carouselTone}".
        ${topicInstruction}\n`;

        if (characterCount > 1) {
          if (characterDescription.trim()) {
            promptText += `A dinâmica deve ser obrigatoriamente entre os seguintes personagens descritos pelo usuário: "${characterDescription}". Eles devem conversar ou interagir de forma engajadora, profunda e coerente com o tom "${carouselTone}" e o nicho "${niche}".\n`;
          } else {
            if (niche === 'Fitness') {
              promptText += `A dinâmica deve ser obrigatoriamente entre dois personagens do contexto fitness, como um treinador motivador e um aluno dedicado/desafiado, ou um indivíduo e sua voz interior consciente de esforço e superação. Eles devem conversar ou interagir de forma altamente engajadora.\n`;
            } else if (niche === 'Top 10 Filmes e Séries') {
              promptText += `A dinâmica deve ser obrigatoriamente entre personagens apaixonadas por cinema, como dois cinéfilos debatendo opiniões sobre produções marcantes, ou apresentadores carismáticos de um ranking especial.\n`;
            } else {
              promptText += `A dinâmica deve ser obrigatoriamente entre dois personagens reflexivos (ex: o clássico Cérebro que representa Razão/Lógica e o Coração que representa Emoção/Sentimento, ou terapeuta e participante). Eles devem estar conversando ou debatendo de forma coerente com o tom "${carouselTone}" e o nicho "${niche}". O objetivo é criar profunda conexão com o leitor.\n`;
            }
          }
        } else {
          if (characterDescription.trim()) {
            promptText += `O personagem principal é descrito como: "${characterDescription}". Ele(a) deve expressar pensamentos, reflexões ou falas de forma coerente com o tom "${carouselTone}" e o nicho "${niche}".\n`;
          } else {
            if (niche === 'Fitness') {
              promptText += `O personagem principal é um atleta comprometido ou alguém batalhando pela sua saúde, expressando seus pensamentos ou aprendizados em sintonia com o tom "${carouselTone}".\n`;
            } else if (niche === 'Top 10 Filmes e Séries') {
              promptText += `O personagem principal é um apresentador carismático de cinema ou um fã fanático contando as melhores indicações em sintonia com o tom "${carouselTone}".\n`;
            } else {
              promptText += `O personagem principal deve estar sozinho "falando alto", expressando pensamentos introspectivos e emotivos em sintonia com o tom "${carouselTone}" de forma marcante.\n`;
            }
          }
        }

        if (carouselTone === 'Acolhedor / Compassivo') {
          promptText += `Como o tom é Acolhedor / Compassivo, os diálogos nos balões devem ser suaves, focados em validação emocional, carinho e acolhimento sem cobranças ou julgamento, ideal para processos de cura interna e autocompaixão.\n`;
        } else if (carouselTone === 'Terapêutico / ACT') {
          promptText += `Como o tom é Terapêutico / ACT, foque em observação neutra dos pensamentos ("você não é seus pensamentos"), aceitação de emoções difíceis sem lutar contra elas e presença consciente no momento presente.\n`;
        } else if (carouselTone === 'Vulnerável / Íntimo') {
          promptText += `Como o tom é Vulnerável / Íntimo, foque em conversas sinceras e profundas sobre carência, medos, sensação de abandono e dor emocional crua, gerando forte identificação com o leitor.\n`;
        } else if (carouselTone === 'Encorajador / Reparador') {
          promptText += `Como o tom é Encorajador / Reparador, foque em restaurar a autoestima, perdoar erros passados, reconstrução do amor-próprio e firmar compromissos pessoais positivos.\n`;
        } else if (carouselTone === 'Psicológico') {
          promptText += `Como o tom é Psicológico, foque em comportamentos, traumas, curas internas, autoconhecimento e o funcionamento da mente humana. Use termos que evoquem introspecção científica e emocional.\n`;
        } else if (carouselTone === 'Filosófico') {
          promptText += `Como o tom é Filosófico, foque em grandes questões da existência, verdade, tempo, ética, moral e a natureza do ser. Cite ou aluda a correntes filosóficas de forma poética.\n`;
        } else if (carouselTone === 'Profundidade') {
          promptText += `Como o tom é de Profundidade, foque em sentimentos crus e universais, empatia profunda e conexões humanas viscerais que toquem a alma.\n`;
        } else if (carouselTone === 'Motivacional') {
          promptText += `Como o tom é Motivacional, foque em acender a chama interior do leitor, motivá-lo a tomar decisões saudáveis, superar barreiras mentais e adotar hábitos vigorosos.\n`;
        } else if (carouselTone === 'Tutorial / Passo a Passo') {
          promptText += `Como o tom é de Tutorial / Passo a Passo, estruture cada slide de forma didática, com dicas práticas de treino, dieta ou hábitos que possam ser seguidos facilmente.\n`;
        } else if (carouselTone === 'Curiosidades / Mitos') {
          promptText += `Como o tom é de Curiosidades / Mitos, desminta teorias populares falsas ou traga fatos científicos incríveis que mudem a mentalidade do fitness.\n`;
        } else if (carouselTone === 'Ranking / Top 10') {
          promptText += `Como o tom é de Ranking / Top 10, ordene ou selecione os melhores filmes/séries em formato de ranking cativante, dando motivos e instigando à discussão nos comentários.\n`;
        } else if (carouselTone === 'Recomendação Secreta') {
          promptText += `Como o tom é de Recomendação Secreta, recomende uma obra-prima oculta com argumentos brilhantes, criando o desejo urgente de assistir.\n`;
        } else if (carouselTone === 'Curiosidades / Bastidores') {
          promptText += `Como o tom é de Curiosidades / Bastidores, revele segredos inacreditáveis ocorridos por trás das câmeras, curiosidades sobre roteiros e mistérios de produção.\n`;
        }

        promptText += `REGRA CRÍTICA PARA OS PROMPTS DE IMAGEM: 
        1. Os diálogos DEVEM estar contidos dentro de balões de fala (speech bubbles) integrados na própria imagem. O estilo do balão deve ser PADRONIZADO em todos os slides para manter a identidade visual.
        2. No prompt (em Inglês), descreva detalhadamente o balão (round, elegant, hand-drawn style, etc.), a fonte e a posição, mas **NÃO** escreva o conteúdo final do texto dentro da string do prompt. Use "dialogue placeholder".
        3. Mantenha a CONSISTÊNCIA VISUAL ABSOLUTA: 
           - As cores originais dos personagens DEVEM ser mantidas (ex: o Coração deve manter seus tons vermelhos/vibrantes que o destacam, mesmo que o estilo geral seja "fosco" ou "desenho a mão").
           - As características físicas originais devem ser respeitadas em cada prompt.
           - O estilo de desenho deve ser idêntico em cada slide.`;

        promptText += `Para cada slide, forneça:
        1. "slideNumber": número do slide.
        2. "imagePromptEn": Prompt altamente detalhado em Inglês para geradores de imagem, focado no cenário e personagens, descrevendo onde o balão de fala fica, mas sem o texto literal.
        3. "textInBubblesPt": Texto no balão em Português.
        4. "textInBubblesEn": Texto no balão em Inglês.
        5. "textInBubblesEs": Texto no balão em Espanhol.
        6. "descriptionPt": Breve descrição do que está acontecendo visualmente no slide em Português.
        
        Também forneça "instagramPost" com a legenda engajadora e emocionante.`;

        responseSchema = {
          type: Type.OBJECT,
          properties: {
            slides: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slideNumber: { type: Type.INTEGER },
                  imagePromptEn: { type: Type.STRING },
                  textInBubblesPt: { type: Type.STRING },
                  textInBubblesEn: { type: Type.STRING },
                  textInBubblesEs: { type: Type.STRING },
                  descriptionPt: { type: Type.STRING },
                },
                required: ["slideNumber", "imagePromptEn", "textInBubblesPt", "textInBubblesEn", "textInBubblesEs", "descriptionPt"],
              },
            },
            instagramPost: { type: Type.STRING },
          },
          required: ["slides", "instagramPost"],
        };
      }

      if (referencePdfs.length > 0 || contextImages.length > 0) {
        promptText += `\nINSTRUÇÕES OBRIGATÓRIAS DE ANÁLISE DE DOCUMENTOS E LIVROS DE REFERÊNCIA (PDF / IMAGENS):
        - Foram anexados ${referencePdfs.length} arquivo(s) PDF e ${contextImages.length} imagem(ns) de texto como material de estudo e embasamento teórico.
        - Você DEVE percorrer e analisar detalhadamente o conteúdo desses PDFs e imagens anexadas.
        ${!hasManualTopic ? '- COMO NÃO FOI DIGITADO UM TEMA MANUAL: Identifique a principal mensagem, história ou ensinamento do PDF e crie a postagem do Instagram e todo o roteiro/carrossel baseado 100% no conteúdo do PDF.' : '- Incorpore as ideias, metáforas e ensinamentos do autor de forma fiel, rica e sensível nas falas e cenas para enriquecer o tema solicitado.'}
        - Na legenda "instagramPost", elabore uma descrição cativante que explique o tema central extraído do material, gere identificação com o público e convide a comentar.\n`;
      }

      const parts: any[] = [{ text: promptText }];
      
      for (let i = 0; i < characterCount; i++) {
        const img = characterImages[i];
        if (img) parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
      }

      for (const img of contextImages) {
        parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
      }

      for (const pdf of referencePdfs) {
        parts.push({ inlineData: { data: pdf.data, mimeType: pdf.mimeType } });
      }

      const response = await fetch(getApiUrl('/api/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: promptText,
          parts,
          responseSchema,
          provider: activeProvider,
          model: activeProvider === 'openrouter' ? openrouterModelInput : geminiModel
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Ocorreu um erro ao gerar.');
      }

      const data = await response.json();
      if (!data.text) throw new Error('Sem resposta da API.');

      if (data.failoverUsed) {
        setLastGenerationMeta({
          provider: data.provider,
          model: data.model,
          failoverUsed: true,
          originalProvider: data.originalProvider,
          failoverReason: data.failoverReason
        });
      } else {
        setLastGenerationMeta({
          provider: data.provider,
          model: data.model,
          failoverUsed: false
        });
      }

      let cleanText = data.text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const jsonResult = JSON.parse(cleanText);
      if (activeTab === 'script') {
        setResult(jsonResult);
      } else {
        setCarouselResult(jsonResult);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao gerar.');
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 lg:px-8 flex-shrink-0 z-10">
        <div className="flex items-center gap-3 text-indigo-600">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold shadow-xs">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex items-baseline gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">PostForge</h1>
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-md border border-indigo-200/70 uppercase tracking-wider">v1.0.0</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 sm:gap-4">
          <nav className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button 
              onClick={() => setActiveTab('script')}
              className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition ${activeTab === 'script' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Vídeo
            </button>
            <button 
              onClick={() => setActiveTab('carousel')}
              className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition ${activeTab === 'carousel' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Carrossel
            </button>
            <button 
              onClick={() => setActiveTab('audit')}
              className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'audit' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Images className="w-3.5 h-3.5" />
              <span>Auditoria Visual</span>
              {uploadedAuditImages.length > 0 && (
                <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-full">
                  {uploadedAuditImages.length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setActiveTab('analysis')}
              className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition ${activeTab === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Análise
            </button>
            <button 
              onClick={() => setActiveTab('spy')}
              className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition ${activeTab === 'spy' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Espião Flow
            </button>
          </nav>

          <button 
            onClick={() => {
              setSelectedProviderTab(activeProvider);
              setTestResult(null);
              setKeyManagerError(null);
              setIsKeyManagerOpen(true);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] sm:text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-300 rounded-xl shadow-xs transition cursor-pointer select-none group"
            title="Abrir Central de I.As e Provedores"
          >
            {activeProvider === 'openrouter' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <Cpu className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
                <span className="hidden sm:inline font-bold">OpenRouter</span>
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 max-w-[130px] truncate">
                  {openrouterModelInput.split('/').pop()?.replace(':free', '') || 'Nemotron'}
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline font-bold">Gemini</span>
                {keysStats.total > 0 && (
                  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black rounded-md ${keysStats.free > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    {keysStats.free}/{keysStats.total}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </header>

      <main className={`flex-grow w-full ${activeTab === 'spy' ? 'max-w-none px-4 pb-4 lg:px-6 lg:pb-6 pt-2' : 'max-w-7xl mx-auto p-4 lg:p-6'} grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-64px)] overflow-hidden`}>
        

        {activeTab === 'spy' ? (
          <div className="lg:col-span-12 w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
            {/* Coluna do Navegador (Esquerda) */}
            <div className="lg:col-span-8 flex flex-col h-full bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
              {/* Barra de Navegação */}
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-slate-50/50">
                <div className="flex items-center gap-1.5">
                  <button 
                    onClick={handleSpyGoBack} 
                    disabled={!webviewCanGoBack} 
                    className="p-2 hover:bg-slate-200/80 disabled:opacity-30 rounded-xl text-slate-600 transition"
                    title="Voltar"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleSpyGoForward} 
                    disabled={!webviewCanGoForward} 
                    className="p-2 hover:bg-slate-200/80 disabled:opacity-30 rounded-xl text-slate-600 transition"
                    title="Avançar"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={handleSpyReload} 
                    className="p-2 hover:bg-slate-200/80 rounded-xl text-slate-600 transition"
                    title="Atualizar"
                  >
                    <RotateCw className={`w-4 h-4 ${isWebviewLoading ? 'animate-spin text-indigo-500' : ''}`} />
                  </button>
                </div>

                <form onSubmit={handleSpyNavigate} className="flex-grow flex items-center gap-2">
                  <div className="flex-grow relative flex items-center">
                    <div className="absolute left-3.5 text-slate-400">
                      <Compass className="w-4 h-4" />
                    </div>
                    <input 
                      type="text" 
                      value={inputUrl}
                      onChange={(e) => setInputUrl(e.target.value)}
                      placeholder="Digite a URL para navegar (ex: midjourney.com)"
                      className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner"
                    />
                  </div>
                  <button 
                    type="submit" 
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-sm transition"
                  >
                    Ir
                  </button>
                </form>

                {/* Inspect Target Button */}
                <button 
                  onClick={handleToggleInspect}
                  className={`flex items-center gap-2 px-4 py-2 text-xs font-extrabold rounded-2xl shadow-sm transition cursor-pointer select-none border border-slate-200 ${isInspectMode ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-100 hover:bg-indigo-700' : 'bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300'}`}
                >
                  <Eye className="w-4 h-4" />
                  <span>{isInspectMode ? 'Inspecionando...' : 'Inspecionar'}</span>
                </button>

                {/* Analyze Target Button */}
                <button 
                  type="button"
                  onClick={handleAnalyzePageForAi}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 rounded-2xl shadow-sm transition cursor-pointer select-none"
                  title="Mapeia todos os botões e campos de texto desta tela e envia diretamente para o IA analisá-la!"
                >
                  <Cpu className="w-4 h-4" />
                  <span>Analisar para o IA</span>
                </button>

              </div>

              {/* WebView Area */}
              <div className="flex-grow relative bg-slate-100/50">
                {preloadPath ? (
                  // @ts-ignore
                  <webview
                    ref={webviewRef}
                    src={spyUrl}
                    preload={preloadPath}
                    className="absolute inset-0 w-full h-full bg-white"
                    style={{ border: 'none' }}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                    <p className="text-sm font-semibold">Carregando espião...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Painel do Espião (Direita) */}
            <div className="lg:col-span-4 flex flex-col h-full bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden text-slate-300">
              {/* Header do Painel */}
              <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                  <h3 className="font-bold text-sm uppercase tracking-wider text-white">Console do Espião</h3>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsRecording(!isRecording)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase rounded-xl transition ${isRecording ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse' : 'bg-slate-800 hover:bg-slate-700 text-slate-200'}`}
                  >
                    {isRecording ? (
                      <>
                        <Square className="w-3 h-3 fill-current" />
                        <span>Parar</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3 h-3 fill-current" />
                        <span>Gravar</span>
                      </>
                    )}
                  </button>
                  <button 
                    type="button"
                    onClick={handleSyncMacroToAi}
                    disabled={recordedSteps.length === 0}
                    className="p-1.5 bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-40 rounded-xl transition border border-indigo-700"
                    title="Sincronizar Macro Gravado com o IA"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                  <button 
                    onClick={handleClearSteps}
                    disabled={recordedSteps.length === 0}
                    className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 disabled:opacity-40 rounded-xl transition border border-slate-700"
                    title="Limpar Fluxo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Status de Sincronização */}
              {syncStatus.message && (
                <div className={`px-5 py-2.5 text-xs font-bold border-b transition-all flex items-center gap-2 ${
                  syncStatus.type === 'success' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' : 
                  syncStatus.type === 'error' ? 'bg-rose-950/40 text-rose-400 border-rose-900/50' : 
                  'bg-slate-950 text-indigo-400 border-slate-800'
                }`}>
                  <Database className="w-3.5 h-3.5 animate-pulse" />
                  <span className="truncate">{syncStatus.message}</span>
                </div>
              )}


              {/* Corpo (Abas de Informação e Lista de Passos) */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                
                {/* Elemento Ativamente Focado / Selecionado */}
                <div className="p-4 bg-slate-950/60 rounded-2xl border border-indigo-500/20">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" /> Inspetor de Código
                  </h4>
                  
                  {selectedElement ? (
                    <div className="space-y-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-md font-mono text-[10px]">
                          {selectedElement.tagName}
                        </span>
                        {selectedElement.id && (
                          <span className="text-slate-400 font-mono">#{selectedElement.id}</span>
                        )}
                        {selectedElement.text && (
                          <span className="text-slate-300 italic truncate max-w-[150px]">
                            "{selectedElement.text}"
                          </span>
                        )}
                      </div>
                      
                      {/* Seletor CSS */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Seletor CSS</span>
                          <button 
                            onClick={() => handleCopy(selectedElement.selector, 'css_sel')}
                            className="hover:text-indigo-400 flex items-center gap-1 text-[10px]"
                          >
                            {copiedStates['css_sel'] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            Copiar
                          </button>
                        </div>
                        <code className="block p-2 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 font-mono text-[10px] break-all leading-tight">
                          {selectedElement.selector}
                        </code>
                      </div>

                      {/* XPath */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>XPath</span>
                          <button 
                            onClick={() => handleCopy(selectedElement.xpath, 'xpath_sel')}
                            className="hover:text-indigo-400 flex items-center gap-1 text-[10px]"
                          >
                            {copiedStates['xpath_sel'] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                            Copiar
                          </button>
                        </div>
                        <code className="block p-2 bg-slate-900 border border-slate-800 rounded-lg text-amber-400 font-mono text-[10px] break-all leading-tight">
                          {selectedElement.xpath}
                        </code>
                      </div>
                    </div>
                  ) : hoveredElement ? (
                    <div className="space-y-1.5 text-xs text-slate-400">
                      <p className="text-[11px] text-slate-500 text-left">Passe o mouse ou clique no elemento...</p>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10px] text-indigo-400 bg-indigo-500/10 px-1 py-0.5 rounded">
                          {hoveredElement.tagName}
                        </span>
                        {hoveredElement.id && <span className="font-mono text-slate-500">#{hoveredElement.id}</span>}
                        {hoveredElement.className && <span className="font-mono text-[10px] text-slate-600 truncate max-w-[120px]">.{hoveredElement.className.trim().split(/\s+/)[0]}</span>}
                      </div>
                      <code className="block p-1 text-[9px] font-mono text-slate-500 bg-slate-900/30 rounded truncate text-left">
                        {hoveredElement.selector}
                      </code>
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500 italic py-2 text-left">Nenhum elemento inspecionado. Use a ferramenta "Inspecionar" acima.</p>
                  )}
                </div>

                {/* Histórico do Fluxo Gravado */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">Fluxo Gravado ({recordedSteps.length})</h4>
                  
                  {recordedSteps.length === 0 ? (
                    <div className="py-10 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                      <div className={`p-2.5 rounded-full mb-3 ${isRecording ? 'bg-rose-500/10 text-rose-400' : 'bg-slate-800 text-slate-500'}`}>
                        <Play className="w-5 h-5" />
                      </div>
                      <p className="text-xs font-bold text-slate-400">Ainda não há passos gravados</p>
                      <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">Ative a gravação e interaja com o navegador para capturar suas ações.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                      {recordedSteps.map((step, idx) => (
                        <div key={step.id} className="group flex items-start justify-between p-3 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition text-left text-xs gap-3">
                          <div className="flex gap-2.5 items-start">
                            <div className="mt-0.5 p-1 bg-slate-800 rounded-lg text-slate-400">
                              {step.type === 'click' ? <MousePointer className="w-3.5 h-3.5 text-indigo-400" /> : <Keyboard className="w-3.5 h-3.5 text-emerald-400" />}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-200 text-[11px]">{step.description}</p>
                              <code className="block mt-1 text-[9px] font-mono text-slate-500 truncate max-w-[180px]">
                                {step.selector}
                              </code>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleRemoveStep(step.id)}
                            className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded-lg transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Exibição do Script Gerado para Automação */}
                {recordedSteps.length > 0 && (
                  <div className="pt-2 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest text-left">Código de Automação</h4>
                      <div className="flex bg-slate-800 p-0.5 rounded-lg text-[9px] font-bold">
                        <button 
                          onClick={() => setActiveSpyScriptTab('json')}
                          className={`px-2 py-1 rounded-md transition ${activeSpyScriptTab === 'json' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          JSON
                        </button>
                        <button 
                          onClick={() => setActiveSpyScriptTab('puppeteer')}
                          className={`px-2 py-1 rounded-md transition ${activeSpyScriptTab === 'puppeteer' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          Pup
                        </button>
                        <button 
                          onClick={() => setActiveSpyScriptTab('playwright')}
                          className={`px-2 py-1 rounded-md transition ${activeSpyScriptTab === 'playwright' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          PW
                        </button>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 relative flex flex-col">
                      <div className="absolute right-3 top-3 z-10">
                        <button 
                          onClick={() => {
                            const codeStr = 
                              activeSpyScriptTab === 'json' ? JSON.stringify(recordedSteps, null, 2) :
                              activeSpyScriptTab === 'puppeteer' ? 
                              `const puppeteer = require('puppeteer');\n\n(async () => {\n  const browser = await puppeteer.launch({ headless: false });\n  const page = await browser.newPage();\n  await page.goto('${spyUrl}');\n\n  // Ações Gravadas:\n${recordedSteps.map(s => {
                                if (s.type === 'click') {
                                  return `  await page.waitForSelector('${s.selector}');\n  await page.click('${s.selector}');`;
                                } else {
                                  return `  await page.waitForSelector('${s.selector}');\n  await page.type('${s.selector}', '${s.value}');`;
                                }
                              }).join('\n\n')}\n\n  await browser.close();\n})();` :
                              `const { chromium } = require('playwright');\n\n(async () => {\n  const browser = await chromium.launch({ headless: false });\n  const page = await browser.newPage();\n  await page.goto('${spyUrl}');\n\n  // Ações Gravadas:\n${recordedSteps.map(s => {
                                if (s.type === 'click') {
                                  return `  await page.click('${s.selector}');`;
                                } else {
                                  return `  await page.fill('${s.selector}', '${s.value}');`;
                                }
                              }).join('\n')}\n\n  await browser.close();\n})();`;
                            
                            handleCopy(codeStr, 'gen_script');
                          }}
                          className="flex items-center gap-1 text-[9px] font-black uppercase text-indigo-400 bg-slate-900 border border-slate-800 hover:border-slate-700 px-2 py-1 rounded-lg transition"
                        >
                          {copiedStates['gen_script'] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                          Copiar
                        </button>
                      </div>

                      <div className="max-h-48 overflow-y-auto pr-1">
                        <code className="block text-[10px] text-green-400 font-mono whitespace-pre text-left leading-relaxed">
                          {activeSpyScriptTab === 'json' ? (
                            JSON.stringify(recordedSteps, null, 2)
                          ) : activeSpyScriptTab === 'puppeteer' ? (
                            `const puppeteer = require('puppeteer');\n\n(async () => {\n  const browser = await puppeteer.launch();\n  const page = await browser.newPage();\n  await page.goto('${spyUrl}');\n\n${recordedSteps.map(s => {
                              if (s.type === 'click') {
                                return `  // ${s.description}\n  await page.waitForSelector('${s.selector}');\n  await page.click('${s.selector}');`;
                              } else {
                                return `  // ${s.description}\n  await page.waitForSelector('${s.selector}');\n  await page.type('${s.selector}', '${s.value}');`;
                              }
                            }).join('\n\n')}\n})();`
                          ) : (
                            `const { chromium } = require('playwright');\n\n(async () => {\n  const browser = await chromium.launch();\n  const page = await browser.newPage();\n  await page.goto('${spyUrl}');\n\n${recordedSteps.map(s => {
                              if (s.type === 'click') {
                                return `  // ${s.description}\n  await page.click('${s.selector}');`;
                              } else {
                                return `  // ${s.description}\n  await page.fill('${s.selector}', '${s.value}');`;
                              }
                            }).join('\n')}\n})();`
                          )}
                        </code>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        ) : activeTab === 'audit' ? (
          <div className="lg:col-span-12 w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
            {/* Coluna Esquerda: Formulário de Auditoria & Upload de Imagens */}
            <aside className="lg:col-span-5 h-full flex flex-col overflow-hidden">
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 flex flex-col gap-5 h-full overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <ListOrdered className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">Auditoria & Organização</h2>
                      <p className="text-[11px] text-slate-400">Consistência de personagens e ordem dos slides</p>
                    </div>
                  </div>
                </div>

                {/* Bloco 1: Upload em Lote de Imagens */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Imagens Geradas em Lote</span>
                    </label>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      {uploadedAuditImages.length} {uploadedAuditImages.length === 1 ? 'imagem' : 'imagens'}
                    </span>
                  </div>

                  {/* Dropzone Drag and Drop */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragOverAudit(true); }}
                    onDragLeave={() => setIsDragOverAudit(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOverAudit(false);
                      if (e.dataTransfer.files) {
                        handleAuditImagesSelect(e.dataTransfer.files);
                      }
                    }}
                    className={`relative border-2 border-dashed rounded-2xl p-5 text-center transition-all flex flex-col items-center justify-center gap-2.5 cursor-pointer ${
                      isDragOverAudit 
                        ? 'border-indigo-500 bg-indigo-50/70 scale-[0.99]' 
                        : 'border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-indigo-300'
                    }`}
                  >
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      onChange={(e) => e.target.files && handleAuditImagesSelect(e.target.files)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <div className="w-10 h-10 rounded-full bg-indigo-100/80 text-indigo-600 flex items-center justify-center shadow-xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Arraste e solte várias imagens aqui
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        PNG, JPG, WEBP • Selecione de uma só vez as imagens geradas pela IA
                      </p>
                    </div>
                  </div>

                  {/* Grid de Miniaturas Carregadas */}
                  {uploadedAuditImages.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Miniaturas carregadas ({uploadedAuditImages.length}):</span>
                        <button
                          type="button"
                          onClick={handleClearAllAuditImages}
                          className="text-rose-500 hover:text-rose-700 font-bold hover:underline cursor-pointer flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Limpar Todas
                        </button>
                      </div>
                      <div className="grid grid-cols-4 gap-2 max-h-36 overflow-y-auto p-1.5 bg-slate-100/60 rounded-xl border border-slate-200/70">
                        {uploadedAuditImages.map((img) => (
                          <div key={img.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white aspect-square flex items-center justify-center shadow-2xs">
                            <img 
                              src={img.dataUrl} 
                              alt={img.name} 
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                              onClick={() => setAuditImageModalUrl({ url: img.dataUrl, title: img.name })}
                            />
                            <div className="absolute inset-x-0 bottom-0 bg-slate-900/80 text-white text-[8px] font-mono px-1 py-0.5 truncate text-center">
                              {img.name}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAuditImage(img.id)}
                              className="absolute top-1 right-1 w-4 h-4 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow cursor-pointer"
                              title="Remover imagem"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Bloco 2: Campo de Entrada do Roteiro / Documentos */}
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Roteiro / Slides Esperados</span>
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <label 
                        className={`px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs ${isExtractingDoc ? 'opacity-50 pointer-events-none' : ''}`}
                        title="Carregar roteiro direto de arquivo .PDF, .DOC, .DOCX, .TXT, .JSON ou .MD"
                      >
                        <input 
                          type="file" 
                          accept=".pdf,.docx,.doc,.txt,.json,.md,.csv,.rtf,.odt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleAuditDocumentUpload(e.target.files[0]);
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                        <FileUp className="w-3 h-3 text-indigo-500" />
                        <span>{isExtractingDoc ? 'Lendo...' : 'Carregar PDF / DOC'}</span>
                      </label>
                      <button
                        type="button"
                        onClick={handlePullScriptFromGeneration}
                        className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                        title="Puxar o roteiro ou carrossel gerado anteriormente na aplicação"
                      >
                        <Sparkles className="w-3 h-3 text-indigo-500" />
                        <span>Puxar Roteiro</span>
                      </button>
                    </div>
                  </div>

                  {/* Informação do Documento Carregado */}
                  {auditDocumentInfo && (
                    <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl flex items-center justify-between text-xs animate-in fade-in">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                          <FileText className="w-3.5 h-3.5" />
                        </div>
                        <div className="truncate text-slate-800 text-[11px]">
                          <span className="font-bold">{auditDocumentInfo.filename}</span>
                          <span className="text-slate-400 text-[10px] ml-1.5">
                            ({Math.round(auditDocumentInfo.size / 1024)} KB • ~{auditDocumentInfo.wordCount || 0} palavras)
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleClearAuditDocument}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition cursor-pointer"
                        title="Remover documento e limpar texto"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Dropzone / Textarea de Roteiro */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragOverDoc(true); }}
                    onDragLeave={() => setIsDragOverDoc(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOverDoc(false);
                      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                        handleAuditDocumentUpload(e.dataTransfer.files[0]);
                      }
                    }}
                    className={`relative rounded-xl transition ${isDragOverDoc ? 'ring-2 ring-indigo-500 bg-indigo-50/50' : ''}`}
                  >
                    <textarea
                      rows={5}
                      value={auditScriptInput}
                      onChange={(e) => {
                        setAuditScriptInput(e.target.value);
                        if (auditDocumentInfo && !e.target.value.trim()) {
                          setAuditDocumentInfo(null);
                        }
                      }}
                      placeholder={`Cole aqui o roteiro, arraste um arquivo (.PDF, .DOC, .TXT) aqui dentro, ou clique em "Carregar PDF / DOC".\n\nExemplo:\nSlide 1: Coração vermelho olhando com tristeza para o horizonte...\nSlide 2: Cérebro azul examinando um mapa de pensamentos...`}
                      className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 leading-relaxed resize-y"
                    />
                    {isExtractingDoc && (
                      <div className="absolute inset-0 bg-white/90 backdrop-blur-2xs rounded-xl flex flex-col items-center justify-center gap-2 text-indigo-600 text-xs font-bold z-10 p-3 text-center shadow-xs">
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          <span>Extraindo texto do documento...</span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-normal">Processando estrutura e camadas de texto do arquivo</p>
                        <button
                          type="button"
                          onClick={() => setIsExtractingDoc(false)}
                          className="mt-1 px-2.5 py-0.5 bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 hover:border-rose-200 rounded-md text-[10px] font-semibold transition cursor-pointer"
                        >
                          Cancelar Extração
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bloco 3: Critérios & Imagens de Referência do Personagem / Estilo (Opcional) */}
                <div className="space-y-3 bg-slate-50/80 p-3.5 border border-slate-200/80 rounded-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Critérios & Imagens do Personagem (Opcional)</span>
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <label 
                        className="px-2.5 py-1 bg-white hover:bg-slate-50 text-indigo-600 border border-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Fazer upload de uma ou mais imagens do personagem de referência"
                      >
                        <input 
                          type="file" 
                          multiple 
                          accept="image/*"
                          onChange={(e) => {
                            if (e.target.files) {
                              handleAuditReferenceImagesSelect(e.target.files);
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                        <Images className="w-3 h-3 text-indigo-500" />
                        <span>+ Add Personagem Ref</span>
                      </label>
                      {characterImages.some(img => img && img.data) && (
                        <button
                          type="button"
                          onClick={handlePullReferenceCharactersFromSession}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Importar imagens de personagens já carregadas na aba do Gerador"
                        >
                          <Sparkles className="w-3 h-3 text-indigo-500" />
                          <span>Puxar do Gerador</span>
                        </button>
                      )}
                      {auditReferenceImages.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearAllAuditReferenceImages}
                          className="px-2 py-1 text-slate-400 hover:text-rose-600 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                          title="Remover todas as imagens de referência"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Limpar Refs</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Grid de Imagens de Referência do Personagem */}
                  {auditReferenceImages.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-0.5">
                        <span className="font-bold text-indigo-600">
                          {auditReferenceImages.length} {auditReferenceImages.length === 1 ? 'referência carregada' : 'referências carregadas'}
                        </span>
                        <span className="text-[10px] text-slate-400">A I.A comparará a consistência contra estas referências</span>
                      </div>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[140px] overflow-y-auto p-1.5 bg-white border border-slate-200 rounded-xl">
                        {auditReferenceImages.map((img, idx) => (
                          <div 
                            key={img.id}
                            className="group relative bg-slate-50 border border-slate-200 rounded-lg overflow-hidden flex flex-col items-center justify-center p-1 hover:border-indigo-400 transition shadow-2xs"
                          >
                            <div 
                              className="relative w-full aspect-square rounded-md overflow-hidden bg-slate-100 cursor-pointer"
                              onClick={() => setAuditImageModalUrl({ url: img.dataUrl, title: `Personagem Ref #${idx + 1} - ${img.name}` })}
                            >
                              <img 
                                src={img.dataUrl} 
                                alt={img.name} 
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-200" 
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                <ZoomIn className="w-3.5 h-3.5" />
                              </div>
                              <span className="absolute top-1 left-1 bg-indigo-600/90 text-white text-[8px] font-bold px-1 py-0.5 rounded-sm shadow-xs">
                                Ref #{idx + 1}
                              </span>
                            </div>
                            <div className="w-full mt-1 flex items-center justify-between gap-1 text-[9px] text-slate-600 px-0.5">
                              <span className="truncate max-w-[55px]" title={img.name}>{img.name}</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveAuditReferenceImage(img.id);
                                }}
                                className="text-slate-400 hover:text-rose-600 p-0.5 rounded-sm transition cursor-pointer"
                                title="Remover esta referência"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dropzone de Imagens de Referência caso esteja vazio */}
                  {auditReferenceImages.length === 0 && (
                    <div 
                      onDragOver={(e) => { e.preventDefault(); setIsDragOverRefImages(true); }}
                      onDragLeave={() => setIsDragOverRefImages(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOverRefImages(false);
                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                          handleAuditReferenceImagesSelect(e.dataTransfer.files);
                        }
                      }}
                      className={`border border-dashed rounded-xl p-3 text-center transition flex items-center justify-center gap-2 text-slate-400 text-xs ${isDragOverRefImages ? 'border-indigo-500 bg-indigo-50/60 text-indigo-600' : 'border-slate-300 bg-white/60 hover:bg-white'}`}
                    >
                      <Images className="w-4 h-4 text-indigo-400" />
                      <span>Arraste imagens de referência do personagem aqui ou use <strong>+ Add Personagem Ref</strong></span>
                    </div>
                  )}

                  {/* Textarea de Diretrizes Textuais */}
                  <textarea
                    rows={2}
                    value={auditCharacterNotes}
                    onChange={(e) => setAuditCharacterNotes(e.target.value)}
                    placeholder="Ex: Cérebro Azul estilo 3D Clay, Coração Vermelho, traços suaves, iluminação cinematográfica quente..."
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 leading-relaxed resize-y"
                  />
                </div>

                {/* Erro de Auditoria */}
                {auditError && (
                  <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-left flex items-start gap-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Atenção:</span> {auditError}
                    </div>
                  </div>
                )}

                {/* Botão de Processamento */}
                <div className="mt-auto space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleRunAudit}
                    disabled={isAuditing || uploadedAuditImages.length === 0 || !auditScriptInput.trim()}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-slate-900 text-white font-bold text-sm rounded-2xl shadow-lg shadow-indigo-200 hover:opacity-95 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer group"
                  >
                    {isAuditing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Auditando e Ordenando com IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 text-indigo-300 group-hover:rotate-12 transition-transform" />
                        <span>Analisar e Ordenar Imagens com IA</span>
                      </>
                    )}
                  </button>

                  {isAuditing && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="w-full py-2 text-xs text-slate-500 hover:text-red-500 font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" /> Cancelar Auditoria
                    </button>
                  )}
                </div>

              </div>
            </aside>

            {/* Coluna Direita: Painel de Resultados (Grid Ordenado & Cards Sequenciais) */}
            <section className="lg:col-span-7 h-full flex flex-col overflow-hidden">
              {!auditResult && !isAuditing && (
                <div className="bg-slate-900 rounded-3xl shadow-inner h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 p-8 text-center border border-slate-800">
                  <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center text-indigo-400 mb-4 shadow-inner">
                    <Images className="w-8 h-8" />
                  </div>
                  <p className="text-lg font-bold text-slate-200">Pronto para Auditar suas Imagens!</p>
                  <p className="text-xs mt-2 max-w-md text-slate-400 leading-relaxed">
                    Faça o upload do lote de imagens geradas à esquerda e insira o roteiro dos slides. A IA do PostForge analisará visualmente cada arquivo, verificará a consistência de personagem e organizará a sequência ideal dos slides.
                  </p>
                  <div className="grid grid-cols-3 gap-3 mt-6 text-left max-w-lg w-full">
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                      <span className="text-[10px] font-bold text-indigo-400 block uppercase">Passo 1</span>
                      <span className="text-xs text-slate-300">Carregue as imagens geradas</span>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                      <span className="text-[10px] font-bold text-indigo-400 block uppercase">Passo 2</span>
                      <span className="text-xs text-slate-300">Puxe o roteiro dos slides</span>
                    </div>
                    <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60">
                      <span className="text-[10px] font-bold text-indigo-400 block uppercase">Passo 3</span>
                      <span className="text-xs text-slate-300">Ordene e baixe o .ZIP</span>
                    </div>
                  </div>
                </div>
              )}

              {isAuditing && (
                <div className="bg-slate-900 rounded-3xl shadow-inner h-full min-h-[400px] flex flex-col items-center justify-center text-indigo-400 p-8 text-center border border-slate-800">
                  <Loader2 className="w-12 h-12 animate-spin mb-4 text-indigo-500" />
                  <p className="font-bold tracking-wide text-slate-100 text-lg">
                    Auditando Imagens com Visão Computacional...
                  </p>
                  <p className="text-xs text-slate-400 mt-2 max-w-md leading-relaxed">
                    Comparando traços faciais, iluminação, paleta de cores e expressões dos personagens com cada slide do seu roteiro.
                  </p>
                </div>
              )}

              {auditResult && !isAuditing && (
                <div className="flex flex-col gap-4 animate-in fade-in duration-500 h-full overflow-y-auto pb-4 pr-1">
                  {/* Banner de Failover caso ativo */}
                  {lastGenerationMeta?.failoverUsed && (
                    <div className="p-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white rounded-2xl border border-amber-500/40 flex items-start gap-3 text-left shadow-lg">
                      <RefreshCw className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-amber-200">Alternância Automática de I.A Executada!</h4>
                        <p className="text-[11px] text-amber-100/90 leading-relaxed">
                          A auditoria visual foi concluída com sucesso via <strong>{lastGenerationMeta.provider === 'gemini' ? 'Google Gemini' : 'OpenRouter'}</strong> ({lastGenerationMeta.model}).
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Header Card de Resumo da Auditoria */}
                  <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl border border-indigo-500/30 shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-black rounded-full">
                            AUDITORIA CONCLUÍDA
                          </span>
                          {auditResult.pontuacao_media_geral && (
                            <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-full">
                              Média: {auditResult.pontuacao_media_geral}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-white mt-1.5">
                          Sequência Ordenada ({auditResult.auditoria_imagens?.length || 0} Slides Mapeados)
                        </h3>
                      </div>

                      {/* Botões de Ação Rápida */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportAuditReportTXT}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Exportar Relatório em TXT"
                        >
                          <FileText className="w-3.5 h-3.5" /> TXT
                        </button>
                        <button
                          onClick={handleDownloadOrderedImagesZip}
                          disabled={isGeneratingZip}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                          title="Baixar todas as imagens renomeadas em ordem numérica (.zip)"
                        >
                          <FolderArchive className="w-3.5 h-3.5" />
                          <span>{isGeneratingZip ? 'Gerando ZIP...' : 'Baixar Imagens (.ZIP)'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Resumo Geral da IA */}
                    <div className="p-4 bg-slate-800/60 rounded-2xl border border-slate-700/80 text-xs text-slate-200 leading-relaxed">
                      <p className="font-bold text-indigo-300 mb-1 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Parecer de Continuidade Visual:
                      </p>
                      <p>{auditResult.resumo_geral_consistencia}</p>
                    </div>
                  </div>

                  {/* Grid Sequencial dos Slides Ordenados */}
                  <div className="space-y-4">
                    {auditResult.auditoria_imagens?.map((item) => {
                      const matchedImg = uploadedAuditImages.find(img => 
                        img.name.toLowerCase() === item.imagem_arquivo_correspondente.toLowerCase() ||
                        img.name.toLowerCase().includes(item.imagem_arquivo_correspondente.toLowerCase()) ||
                        item.imagem_arquivo_correspondente.toLowerCase().includes(img.name.toLowerCase())
                      );

                      const scoreNumber = parseInt(item.pontuacao_consistencia.replace(/[^0-9]/g, '')) || 85;
                      const badgeColor = scoreNumber >= 90 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                        : scoreNumber >= 75 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

                      return (
                        <div 
                          key={item.slide_numero}
                          className="bg-slate-900 border border-slate-800 rounded-3xl p-5 text-slate-300 shadow-xl flex flex-col md:flex-row gap-5 relative overflow-hidden group hover:border-indigo-500/40 transition-all"
                        >
                          {/* Coluna da Imagem */}
                          <div className="w-full md:w-56 shrink-0 flex flex-col gap-2">
                            <div className="relative aspect-square rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 shadow-inner group/img">
                              {matchedImg ? (
                                <>
                                  <img 
                                    src={matchedImg.dataUrl} 
                                    alt={item.imagem_arquivo_correspondente} 
                                    className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                  />
                                  <button
                                    onClick={() => setAuditImageModalUrl({ url: matchedImg.dataUrl, title: `Slide ${item.slide_numero} - ${matchedImg.name}` })}
                                    className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                                    title="Expandir Imagem"
                                  >
                                    <div className="p-2 bg-slate-900/80 rounded-xl backdrop-blur-xs flex items-center gap-1.5 text-xs font-bold">
                                      <ZoomIn className="w-4 h-4" /> Expandir
                                    </div>
                                  </button>
                                </>
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-4 text-center">
                                  <ImageIcon className="w-8 h-8 mb-1 text-slate-600" />
                                  <span className="text-[10px]">Arquivo mapeado:</span>
                                  <span className="text-xs font-bold text-slate-300 font-mono mt-0.5 truncate max-w-full">
                                    {item.imagem_arquivo_correspondente}
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
                              <span className="truncate max-w-[130px]" title={item.imagem_arquivo_correspondente}>
                                📁 {item.imagem_arquivo_correspondente}
                              </span>
                              {matchedImg && (
                                <button
                                  onClick={() => saveAs(matchedImg.dataUrl, `Slide_${item.slide_numero}_${matchedImg.name}`)}
                                  className="text-indigo-400 hover:text-indigo-300 p-1 hover:bg-slate-700 rounded-md cursor-pointer transition"
                                  title="Baixar imagem individual"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Coluna de Informações e Feedback da IA */}
                          <div className="flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                    {item.slide_numero}
                                  </span>
                                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                    Slide {item.slide_numero}
                                  </h4>
                                </div>

                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
                                  {item.pontuacao_consistencia} Consistência
                                </span>
                              </div>

                              <div className="space-y-2.5">
                                {/* Descrição esperada */}
                                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 text-xs">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">
                                    Requisito do Roteiro:
                                  </span>
                                  <p className="text-slate-200 leading-relaxed">{item.descricao_esperada}</p>
                                </div>

                                {/* Feedback Visual da IA */}
                                <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/20 text-xs">
                                  <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Análise de Consistência & Traço:
                                  </span>
                                  <p className="text-indigo-100 leading-relaxed">{item.feedback_visual}</p>
                                </div>
                              </div>
                            </div>

                            {/* Tags de Pontos Fortes e Alertas */}
                            {(item.destaque_pontos_fortes?.length || item.alertas_inconsistencia?.length) ? (
                              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-800">
                                {item.destaque_pontos_fortes?.map((forte, fIdx) => (
                                  <span key={fIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-900/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-[10px] font-medium">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {forte}
                                  </span>
                                ))}
                                {item.alertas_inconsistencia?.map((alerta, aIdx) => (
                                  <span key={aIdx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-900/30 text-amber-300 border border-amber-500/30 rounded-lg text-[10px] font-medium">
                                    <AlertTriangle className="w-3 h-3 text-amber-400" /> {alerta}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Seção de Imagens Sobressalentes / Descartadas */}
                  {auditResult.imagens_sobressalentes && auditResult.imagens_sobressalentes.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-300 shadow-xl space-y-4">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400" />
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                          Imagens Sobressalentes / Não Utilizadas ({auditResult.imagens_sobressalentes.length})
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400">
                        Estas imagens foram analisadas mas não foram selecionadas como a melhor representação para a sequência narrativa:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {auditResult.imagens_sobressalentes.map((surplus, sIdx) => {
                          const matchedImg = uploadedAuditImages.find(img => img.name.toLowerCase() === surplus.nome_arquivo.toLowerCase());
                          return (
                            <div key={sIdx} className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/60 flex items-center gap-3">
                              {matchedImg && (
                                <img 
                                  src={matchedImg.dataUrl} 
                                  alt={surplus.nome_arquivo}
                                  onClick={() => setAuditImageModalUrl({ url: matchedImg.dataUrl, title: surplus.nome_arquivo })}
                                  className="w-12 h-12 rounded-xl object-cover border border-slate-700 cursor-pointer shrink-0"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-200 truncate font-mono">{surplus.nome_arquivo}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-tight">{surplus.motivo_descarte}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                </div>
              )}
            </section>
          </div>
        ) : activeTab !== 'analysis' ? (
          <>
            {/* Form Sidebar */}
            <aside className="lg:col-span-4 h-full flex flex-col overflow-hidden">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-6 h-full overflow-y-auto">
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Configurar Geração</h2>
            <form onSubmit={handleGenerate} className="flex flex-col gap-6">
              
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-900">Nicho</label>
                <select 
                  value={niche}
                  onChange={(e) => setNiche(e.target.value)}
                  className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                >
                  {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              {activeTab === 'script' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-900">Estilo de Animação</label>
                    <select 
                      value={animationStyle}
                      onChange={(e) => setAnimationStyle(e.target.value)}
                      className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    >
                      {ANIMATION_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-900">Dinamismo Visual / Câmera</label>
                    <select 
                      value={visualDynamism}
                      onChange={(e) => setVisualDynamism(e.target.value)}
                      className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    >
                      {VISUAL_DYNAMISM.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <input 
                      type="checkbox" 
                      id="mixedOffs"
                      checked={mixedOffs}
                      onChange={(e) => setMixedOffs(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                    />
                    <label htmlFor="mixedOffs" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
                      Dinamismo Criativo (Transições / Off)
                      <p className="text-[10px] text-slate-500 font-normal leading-tight mt-0.5">Alterna cenas com e sem o personagem.</p>
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'script' && (
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-4">
                    {niche !== 'Top 10 Filmes e Séries' && (
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-slate-900">Tom da Narrativa</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {(NICHE_SCRIPT_TONES[niche] || []).map(tone => (
                            <button
                              key={tone}
                              type="button"
                              onClick={() => setScriptTone(tone)}
                              className={`py-2 px-1.5 text-[10px] font-bold rounded-lg border transition leading-tight text-center ${scriptTone === tone ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                            >
                              {tone}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between p-3 bg-violet-50 border border-violet-100 rounded-xl">
                      <div className="flex-1">
                        <label className="text-xs font-semibold text-slate-800">Incluir Hook (Gancho)</label>
                        <p className="text-[9px] text-slate-500">Forçar impacto na primeira cena</p>
                      </div>
                      <input 
                        type="checkbox" 
                        checked={includeHook}
                        onChange={(e) => setIncludeHook(e.target.checked)}
                        className="w-4 h-4 text-violet-600 focus:ring-violet-500 border-slate-300 rounded cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'carousel' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-900">Estilo de Arte</label>
                    <select 
                      value={artStyle}
                      onChange={(e) => setArtStyle(e.target.value)}
                      className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    >
                      {ART_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-[10px] text-amber-700 font-bold leading-tight">
                      Dica: Se selecionar mais de 1 personagem, a IA criará uma dinâmica de diálogo rica que combina com o nicho e tom escolhidos.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-900">Tom do Diálogo</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(NICHE_CAROUSEL_TONES[niche] || []).map(tone => (
                        <button
                          key={tone}
                          type="button"
                          onClick={() => setCarouselTone(tone)}
                          className={`py-2 px-1.5 text-[10px] font-bold rounded-lg border transition leading-tight text-center ${carouselTone === tone ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
                        >
                          {tone}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <div className="space-y-2 w-1/2">
                  <label className="block text-xs font-semibold text-slate-900">Personagens</label>
                  <select 
                    value={characterCount}
                    onChange={(e) => setCharacterCount(Number(e.target.value))}
                    className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  >
                    {[1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>

                <div className="space-y-2 w-1/2">
                  <label className="block text-xs font-semibold text-slate-900">
                    {activeTab === 'script' ? 'Número de Cenas' : 'Número de Slides'}
                  </label>
                  <input 
                    type="number"
                    min="1"
                    max="10"
                    value={sceneCount}
                    onChange={(e) => setSceneCount(Number(e.target.value))}
                    className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-900">
                  Definição dos Personagens (Opcional)
                </label>
                <input 
                  type="text"
                  value={characterDescription}
                  onChange={(e) => setCharacterDescription(e.target.value)}
                  placeholder="Ex: Treinador e aluno; Cérebro e Coração; ou deixe em branco para a IA sugerir"
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              {/* Character Images Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-900">Referências de Personagens (Opcional)</label>
                <div className="space-y-2">
                  {Array.from({ length: characterCount }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <label className="relative flex-1 cursor-pointer bg-slate-50 border border-slate-200 rounded-xl p-2 hover:bg-slate-100 transition flex items-center justify-center gap-2 text-xs font-medium text-slate-600">
                        <Upload className="w-4 h-4" />
                        <span className="truncate">{characterImages[i] ? 'Imagem carregada' : `Upload Personagem ${i + 1}`}</span>
                        <input 
                          type="file" 
                          accept="image/*" 
                          className="hidden" 
                          onChange={(e) => handleImageUpload(i, e)}
                        />
                      </label>
                      {characterImages[i] && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200">
                            <img 
                              src={`data:${characterImages[i]!.mimeType};base64,${characterImages[i]!.data}`} 
                              alt={`Char ref ${i + 1}`} 
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <button 
                            type="button"
                            onClick={() => handleRemoveImage(i)}
                            className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-lg border border-red-100 hover:bg-red-100 transition"
                            title="Remover personagem"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {activeTab === 'script' && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-900">Duração por Cena (segundos)</label>
                  <select 
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                  >
                    {DURATIONS.map(n => <option key={n} value={n}>{n} segundos</option>)}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-900">Tema da História / Descrição / Texto para Adaptação</label>
                  {referencePdfs.length > 0 && !topic.trim() && (
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-200">
                      Modo PDF Automático Ativo
                    </span>
                  )}
                </div>
                <textarea 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={referencePdfs.length > 0 
                    ? "Opcional: O PDF anexado será a fonte principal. Ou insira instruções adicionais aqui..." 
                    : "Ex: Como lidar com a ansiedade... Ou cole aqui o seu próprio texto para ser adaptado em roteiro."}
                  rows={4}
                  className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                />
                {referencePdfs.length > 0 && !topic.trim() && (
                  <p className="text-[11px] text-indigo-600 bg-indigo-50/80 border border-indigo-100 px-3 py-2 rounded-xl flex items-center gap-2 font-medium">
                    <span>💡</span>
                    <span><strong>PDF anexado:</strong> Como o tema está em branco, a IA lerá o PDF e criará o roteiro/carrossel e a legenda baseados no conteúdo do documento.</span>
                  </p>
                )}
              </div>

              {/* Context/Scenario Images Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-900">Anexar Imagens com Textos de Referência <span className="text-slate-400 font-normal">(Opcional)</span></label>
                <div className="grid grid-cols-4 gap-2">
                  <label className="aspect-square cursor-pointer bg-slate-50 border border-slate-200 border-dashed rounded-xl flex flex-col items-center justify-center hover:bg-slate-100 transition text-slate-400">
                    <Upload className="w-5 h-5 mb-1" />
                    <span className="text-[10px] uppercase font-bold text-center">Anexar</span>
                    <input 
                      type="file" 
                      multiple 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleContextImageUpload}
                    />
                  </label>
                  {contextImages.map((img, i) => (
                    <div key={i} className="aspect-square relative rounded-xl overflow-hidden border border-slate-200 group">
                      <img 
                        src={`data:${img.mimeType};base64,${img.data}`} 
                        className="w-full h-full object-cover"
                        alt="Context ref"
                      />
                      <button 
                        type="button"
                        onClick={() => handleRemoveContextImage(i)}
                        className="absolute inset-0 bg-red-600/80 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reference PDFs / Books Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-900">
                    Anexar PDFs de Livros / Artigos de Referência <span className="text-slate-400 font-normal">(Opcional)</span>
                  </label>
                  {referencePdfs.length > 0 && (
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                      {referencePdfs.length} PDF{referencePdfs.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="cursor-pointer bg-slate-50 border border-slate-200 border-dashed rounded-xl p-3 flex items-center justify-center gap-2 hover:bg-slate-100 transition text-slate-500 group">
                    <FileText className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition" />
                    <span className="text-xs font-semibold text-slate-700">Selecionar arquivo PDF para a IA estudar</span>
                    <input 
                      type="file" 
                      multiple 
                      accept="application/pdf,.pdf" 
                      className="hidden" 
                      onChange={handlePdfUpload}
                    />
                  </label>

                  {referencePdfs.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {referencePdfs.map((pdf, i) => (
                        <div 
                          key={i} 
                          className="flex items-center justify-between p-2.5 bg-red-50/60 border border-red-100 rounded-xl text-xs"
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="p-1.5 bg-red-100 text-red-600 rounded-lg shrink-0 font-bold text-[10px]">
                              PDF
                            </div>
                            <div className="truncate">
                              <p className="font-semibold text-slate-800 truncate">{pdf.name}</p>
                              <p className="text-[10px] text-slate-500">
                                {(pdf.size / (1024 * 1024)).toFixed(2)} MB • Material de estudo da IA
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePdf(i)}
                            className="p-1.5 hover:bg-red-200/80 text-red-600 rounded-lg transition shrink-0 ml-2"
                            title="Remover PDF"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:bg-indigo-400 group overflow-hidden relative"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {isLoading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        Gerar Prompts
                      </>
                    )}
                  </span>
                </button>

                {isLoading && (
                  <button 
                    type="button" 
                    onClick={handleCancel}
                    className="w-full py-2 text-slate-500 hover:text-red-500 font-bold transition flex items-center justify-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Cancelar Geração
                  </button>
                )}
              </div>

            </form>
          </div>
        </aside>

        {/* Results Area */}
        <section className="lg:col-span-8 h-full flex flex-col overflow-hidden">
          {!result && !carouselResult && !isLoading && (
            <div className="bg-slate-900 rounded-2xl shadow-inner h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 p-8 text-center">
              <Sparkles className="w-12 h-12 mb-4 text-slate-600" />
              <p className="text-lg font-semibold text-slate-300">Pronto para começar!</p>
              <p className="text-sm mt-2 max-w-md text-slate-500">
                {activeTab === 'script' 
                  ? 'Configure seu vídeo e clique em gerar para criar seus roteiros cinematográficos.' 
                  : 'Configure seu carrossel e crie diálogos profundos entre o Cérebro e o Coração.'}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="bg-slate-900 rounded-2xl shadow-inner h-full min-h-[400px] flex flex-col items-center justify-center text-indigo-400 p-8 text-center">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
              <p className="font-medium animate-pulse tracking-wide text-slate-200 text-base">
                {referencePdfs.length > 0
                  ? 'Analisando documento PDF e gerando postagem com IA...'
                  : 'Processando com Inteligência Artificial...'}
              </p>
              {referencePdfs.length > 0 && !topic.trim() && (
                <p className="text-xs text-slate-400 mt-2 max-w-sm">
                  Extraindo o tema central, metáforas e ensinamentos do seu PDF para criar o conteúdo completo.
                </p>
              )}
            </div>
          )}

          {activeTab === 'script' && result && !isLoading && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-500 h-full overflow-y-auto pb-4 pr-1">
              {/* Notificação de Failover Automático / Alta Disponibilidade */}
              {lastGenerationMeta?.failoverUsed && (
                <div className="p-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white rounded-2xl border border-amber-500/40 flex items-start gap-3 text-left shadow-lg animate-in fade-in">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-400/30">
                    <RefreshCw className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-amber-200">Alternância Automática de I.A Executada com Sucesso!</h4>
                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] font-bold rounded-full border border-amber-500/30 uppercase">Failover Ativo</span>
                    </div>
                    <p className="text-[11px] text-amber-100/90 leading-relaxed">
                      A cota do provedor inicial ({lastGenerationMeta.originalProvider === 'gemini' ? 'Google Gemini' : 'OpenRouter'}) estava esgotada no momento. O PostForge alternou automaticamente para <strong>{lastGenerationMeta.provider === 'gemini' ? 'Google Gemini' : 'OpenRouter'}</strong> (modelo <code>{lastGenerationMeta.model}</code>) e entregou seu roteiro completo sem travar sua produção.
                    </p>
                  </div>
                </div>
              )}

              {/* Export Actions for Video */}
              <div className="flex flex-wrap items-center justify-end gap-2 px-1">
                <button onClick={exportAsTXT} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition">
                  <FileText className="w-4 h-4" /> TXT
                </button>
                <button onClick={exportAsDOCX} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-blue-700 transition">
                  <FileText className="w-4 h-4" /> DOCX
                </button>
                <button onClick={exportAsPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition shadow-sm">
                  <Download className="w-4 h-4" /> PDF
                </button>
              </div>

              {/* Cover Image Prompt */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center text-white">
                      <ImageIcon className="w-3.5 h-3.5" />
                    </div>
                    <h3 className="text-indigo-900 font-bold text-sm uppercase">Prompt Capa de Vídeo (PostForge)</h3>
                  </div>
                  <button 
                    onClick={() => handleCopy(result.nanoBananaImagePrompt || '', 'cover_prompt')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-600 bg-white px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition shadow-sm border border-indigo-200"
                  >
                    {copiedStates['cover_prompt'] || copiedStates['nano_banana'] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    Copiar Prompt
                  </button>
                </div>
                <div className="bg-white rounded-xl border border-indigo-200 p-4 relative z-10">
                  <code className="text-[11px] lg:text-xs text-indigo-700 leading-tight block font-mono whitespace-pre-wrap">{result.nanoBananaImagePrompt}</code>
                </div>
              </div>

              {/* Instagram Post Description */}
              <div className="bg-slate-900 rounded-2xl p-6 text-slate-300 flex flex-col gap-4 shadow-xl border border-indigo-500/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Legenda Vídeo
                  </h3>
                  <button onClick={() => handleCopy(result.instagramPost || '', 'ig_post')} className="flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-400 bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition border border-slate-700">
                    {copiedStates['ig_post'] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} Copiar Legenda
                  </button>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{result.instagramPost}</p>
                </div>
              </div>

              {result.scenes?.map((scene, index) => (
                <div key={index} className="bg-slate-900 rounded-2xl p-6 text-slate-300 flex flex-col gap-4 shadow-inner">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    Cena {scene.sceneNumber} <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded">{scene.duration}s</span>
                  </h3>
                  <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                    <p className="text-sm text-slate-300">{scene.contextPt}</p>
                  </div>
                  <div className="bg-indigo-900/20 rounded-xl p-4 border border-indigo-500/30">
                    <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> Copiar Prompt + Narração
                    </h4>
                    <div className="space-y-2">
                      <button 
                        onClick={() => handleCopy(`${scene.videoPromptEn}\n\nDialogue/Narration (PT): "${scene.dialoguePt}"`, `v_pt_${index}`)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition border border-slate-700 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-indigo-400/70 w-5">PT</span>
                          <p className="text-xs text-slate-200 font-medium italic truncate max-w-[150px]">"{scene.dialoguePt}"</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                          {copiedStates[`v_pt_${index}`] ? <Check className="w-3" /> : <Copy className="w-3" />}
                          <span>+ Prompt</span>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleCopy(`${scene.videoPromptEn}\n\nDialogue/Narration (EN): "${scene.dialogueEn}"`, `v_en_${index}`)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition border border-slate-700 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-indigo-400/70 w-5">EN</span>
                          <p className="text-xs text-slate-400 font-medium italic truncate max-w-[150px]">"{scene.dialogueEn}"</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                          {copiedStates[`v_en_${index}`] ? <Check className="w-3" /> : <Copy className="w-3" />}
                          <span>+ Prompt</span>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleCopy(`${scene.videoPromptEn}\n\nDialogue/Narration (ES): "${scene.dialogueEs}"`, `v_es_${index}`)}
                        className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition border border-slate-700 group"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-indigo-400/70 w-5">ES</span>
                          <p className="text-xs text-slate-400 font-medium italic truncate max-w-[150px]">"{scene.dialogueEs}"</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                          {copiedStates[`v_es_${index}`] ? <Check className="w-3" /> : <Copy className="w-3" />}
                          <span>+ Prompt</span>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-4 mt-2">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <Clapperboard className="w-3.5 h-3.5" /> Prompt de Vídeo (IA)
                      </label>
                      <button 
                        onClick={() => handleCopy(scene.videoPromptEn || '', `vp_${index}`)}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-indigo-400 hover:text-white transition"
                      >
                        {copiedStates[`vp_${index}`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copiar Prompt
                      </button>
                    </div>
                    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
                      <code className="text-[11px] lg:text-xs text-green-400 leading-relaxed font-mono block whitespace-pre-wrap">
                        {scene.videoPromptEn}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'carousel' && carouselResult && !isLoading && (
            <div className="flex flex-col gap-6 animate-in fade-in duration-500 h-full overflow-y-auto pb-4 pr-1">
              
              {/* Notificação de Failover Automático / Alta Disponibilidade */}
              {lastGenerationMeta?.failoverUsed && (
                <div className="p-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white rounded-2xl border border-amber-500/40 flex items-start gap-3 text-left shadow-lg animate-in fade-in">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 border border-amber-400/30">
                    <RefreshCw className="w-4 h-4 text-amber-300" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-amber-200">Alternância Automática de I.A Executada com Sucesso!</h4>
                      <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[9px] font-bold rounded-full border border-amber-500/30 uppercase">Failover Ativo</span>
                    </div>
                    <p className="text-[11px] text-amber-100/90 leading-relaxed">
                      A cota do provedor inicial ({lastGenerationMeta.originalProvider === 'gemini' ? 'Google Gemini' : 'OpenRouter'}) estava esgotada no momento. O PostForge alternou automaticamente para <strong>{lastGenerationMeta.provider === 'gemini' ? 'Google Gemini' : 'OpenRouter'}</strong> (modelo <code>{lastGenerationMeta.model}</code>) e entregou seu carrossel completo sem travar sua produção.
                    </p>
                  </div>
                </div>
              )}

              {/* Export Actions for Carousel */}
              <div className="flex flex-wrap items-center justify-end gap-2 px-1">
                <button onClick={exportAsTXT} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition">
                  <FileText className="w-4 h-4" /> TXT
                </button>
                <button onClick={exportAsDOCX} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-blue-700 transition">
                  <FileText className="w-4 h-4" /> DOCX
                </button>
                <button onClick={exportAsPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition shadow-sm">
                  <Download className="w-4 h-4" /> PDF
                </button>
              </div>

              {/* Instagram Post Description for Carousel */}
              <div className="bg-slate-900 rounded-2xl p-6 text-slate-300 flex flex-col gap-4 shadow-xl border border-indigo-500/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold flex items-center gap-2 text-sm uppercase tracking-wider">
                    <Sparkles className="w-4 h-4 text-indigo-400" /> Legenda Carrossel
                  </h3>
                  <button onClick={() => handleCopy(carouselResult.instagramPost || '', 'ig_carousel')} className="flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-400 bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition border border-slate-700">
                    {copiedStates['ig_carousel'] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} Copiar Legenda
                  </button>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{carouselResult.instagramPost}</p>
                </div>
              </div>

              {carouselResult.slides?.map((slide, index) => (
                <div key={index} className="bg-slate-900 rounded-2xl p-6 text-slate-300 flex flex-col gap-4 shadow-inner border-l-4 border-indigo-500">
                  <div className="flex items-center justify-between">
                    <h3 className="text-white font-bold text-lg">Slide {slide.slideNumber}</h3>
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-bold py-1 px-2 bg-indigo-500/20 text-indigo-400 rounded uppercase">Slide Completo</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-indigo-900/20 rounded-xl p-4 border border-indigo-500/30">
                      <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Conteúdo do Slide</h4>
                      <p className="text-sm text-slate-200 leading-relaxed">{slide.descriptionPt}</p>
                    </div>
                    <div className="bg-emerald-900/20 rounded-xl p-4 border border-emerald-500/30">
                      <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Copiar Prompt + Diálogo
                      </h4>
                      <div className="space-y-2">
                        <button 
                          onClick={() => handleCopy(`${slide.imagePromptEn}\n\nDialogue (PT): "${slide.textInBubblesPt}"`, `cb_pt_${index}`)}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition border border-slate-700 group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-emerald-500/70 w-5">PT</span>
                            <p className="text-xs text-slate-200 font-medium italic truncate max-w-[150px]">"{slide.textInBubblesPt}"</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                            {copiedStates[`cb_pt_${index}`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>+ Prompt</span>
                          </div>
                        </button>

                        <button 
                          onClick={() => handleCopy(`${slide.imagePromptEn}\n\nDialogue (EN): "${slide.textInBubblesEn}"`, `cb_en_${index}`)}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition border border-slate-700 group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-emerald-500/70 w-5">EN</span>
                            <p className="text-xs text-slate-400 font-medium italic truncate max-w-[150px]">"{slide.textInBubblesEn}"</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                            {copiedStates[`cb_en_${index}`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>+ Prompt</span>
                          </div>
                        </button>

                        <button 
                          onClick={() => handleCopy(`${slide.imagePromptEn}\n\nDialogue (ES): "${slide.textInBubblesEs}"`, `cb_es_${index}`)}
                          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition border border-slate-700 group"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-emerald-500/70 w-5">ES</span>
                            <p className="text-xs text-slate-400 font-medium italic truncate max-w-[150px]">"{slide.textInBubblesEs}"</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                            {copiedStates[`cb_es_${index}`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            <span>+ Prompt</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-700 pt-4 mt-2">
                    <div className="flex justify-between items-center mb-3">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5" /> Prompt de Imagem (Midjourney / DALL-E)
                      </label>
                      <button 
                        onClick={() => handleCopy(slide.imagePromptEn || '', `cp_${index}`)}
                        className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-indigo-400 hover:text-white transition"
                      >
                        {copiedStates[`cp_${index}`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copiar Prompt
                      </button>
                    </div>
                    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
                      <code className="text-[11px] lg:text-xs text-green-400 leading-relaxed font-mono block whitespace-pre-wrap">
                        {slide.imagePromptEn}
                      </code>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </>
    ) : (
      <div className="lg:col-span-12 max-w-2xl mx-auto w-full h-full flex flex-col overflow-hidden">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 flex flex-col gap-6 h-full overflow-y-auto pb-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-slate-900">Analisador de Vídeo</h2>
                <p className="text-sm text-slate-500 mt-1">Envie seu vídeo e deixe a IA criar uma sinopse matadora para o Instagram.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <div className={`w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-colors cursor-pointer ${videoFile ? 'border-green-500 bg-green-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-300'}`}>
                    <Upload className={`w-10 h-10 mb-3 ${videoFile ? 'text-green-500' : 'text-slate-400'}`} />
                    <span className="text-sm font-semibold">{videoFile ? 'Vídeo Carregado' : 'Selecione um vídeo (Máx 100MB)'}</span>
                    <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                  </div>
                </label>

                {videoFile && (
                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="text-xs text-slate-500">Vídeo pronto para análise</span>
                    <button onClick={() => setVideoFile(null)} className="text-red-500 hover:bg-red-50 p-1 rounded-lg transition">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <button 
                    onClick={handleAnalyzeVideo}
                    disabled={!videoFile || isAnalyzing}
                    className="w-full py-4 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:bg-indigo-400"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analisando Vídeo...
                      </>
                    ) : (
                      <>
                        <Clapperboard className="w-5 h-5" />
                        Analisar e Criar Sinopse
                      </>
                    )}
                  </button>

                  {isAnalyzing && (
                    <button 
                      type="button" 
                      onClick={handleCancel}
                      className="w-full py-2 text-slate-500 hover:text-red-500 font-bold transition flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancelar Análise
                    </button>
                  )}
                </div>
              </div>

              {analysisResult && (
                <div className="mt-6 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <div className="flex justify-between items-center bg-indigo-600 p-4 rounded-t-2xl">
                    <h3 className="text-white font-bold text-sm uppercase flex items-center gap-2">
                       <Sparkles className="w-4 h-4" /> Sinopse Instagram Gerada
                    </h3>
                    <button 
                      onClick={() => handleCopy(analysisResult, 'analysis_copy')}
                      className="text-white hover:bg-white/20 p-2 rounded-lg transition flex items-center gap-2 text-xs font-bold"
                    >
                      {copiedStates['analysis_copy'] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedStates['analysis_copy'] ? 'Copiado' : 'Copiar'}
                    </button>
                  </div>
                  <div className="bg-slate-900 p-6 rounded-b-2xl shadow-inner border border-slate-800">
                    <p className="text-slate-300 text-sm whitespace-pre-wrap leading-relaxed">
                      {analysisResult}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* MODAL DA CENTRAL DE I.AS E PROVEDORES */}
      {isKeyManagerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div 
            className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md shadow-indigo-100">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">Central de I.As e Provedores</h3>
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Multi-IA
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">Selecione o provedor ativo e configure suas chaves e modelos correspondentes</p>
                </div>
              </div>
              <button 
                onClick={() => setIsKeyManagerOpen(false)}
                className="p-2 hover:bg-slate-200/60 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Abas de Navegação dos Provedores */}
            <div className="px-6 pt-4 pb-2 bg-slate-50/40 border-b border-slate-100 flex gap-2">
              <button
                onClick={() => {
                  setSelectedProviderTab('gemini');
                  setTestResult(null);
                  setKeyManagerError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                  selectedProviderTab === 'gemini'
                    ? 'bg-white text-indigo-700 border-indigo-200/80 shadow-xs'
                    : 'bg-slate-100/70 hover:bg-slate-100 text-slate-600 border-transparent'
                }`}
              >
                <Sparkles className={`w-4 h-4 ${selectedProviderTab === 'gemini' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span>Google Gemini</span>
                {activeProvider === 'gemini' && (
                  <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[9px] font-extrabold rounded-full">
                    Ativo
                  </span>
                )}
                {keysStats.total > 0 && activeProvider !== 'gemini' && (
                  <span className="px-1.5 py-0.5 bg-slate-200/80 text-slate-600 text-[9px] font-bold rounded-full">
                    {keysStats.free} chaves
                  </span>
                )}
              </button>

              <button
                onClick={() => {
                  setSelectedProviderTab('openrouter');
                  setTestResult(null);
                  setKeyManagerError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                  selectedProviderTab === 'openrouter'
                    ? 'bg-white text-amber-700 border-amber-200/80 shadow-xs'
                    : 'bg-slate-100/70 hover:bg-slate-100 text-slate-600 border-transparent'
                }`}
              >
                <Cpu className={`w-4 h-4 ${selectedProviderTab === 'openrouter' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>OpenRouter (Nemotron Free)</span>
                {activeProvider === 'openrouter' && (
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-200 text-[9px] font-extrabold rounded-full">
                    Ativo
                  </span>
                )}
                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black rounded-md">
                  FREE
                </span>
              </button>
            </div>

            {/* Conteúdo da Aba (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {/* Banner de Alta Disponibilidade e Failover Automático Multi-Provedor */}
              <div className="p-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-left shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center shrink-0 border border-indigo-400/20">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      <span>Alta Disponibilidade & Failover Bidirecional</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded-full border border-emerald-500/30">ATIVO</span>
                    </h5>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Se as cotas do Gemini esgotarem (429), o PostForge alterna instantaneamente para OpenRouter (e vice-versa) sem parar sua produção.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleVerifyAllKeys}
                  disabled={isVerifyingKeys}
                  className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50 self-end sm:self-center"
                  title="Testar e medir a cota de todas as chaves cadastradas na API"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isVerifyingKeys ? 'animate-spin' : ''}`} />
                  <span>{isVerifyingKeys ? 'Verificando...' : 'Verificar Saúde das Chaves'}</span>
                </button>
              </div>

              {/* Feedback de Erro Geral */}
              {keyManagerError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-left flex items-start gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Atenção:</span> {keyManagerError}
                  </div>
                </div>
              )}

              {/* Feedback de Teste de Conexão */}
              {testResult && (
                <div className={`p-3.5 text-xs rounded-2xl text-left flex items-start gap-2.5 animate-in fade-in ${
                  testResult.success 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <p className="font-bold">{testResult.success ? 'Conexão Estabelecida!' : 'Erro na Conexão:'}</p>
                    <p className="mt-0.5 text-slate-600">{testResult.message}</p>
                  </div>
                </div>
              )}

              {/* Relatório de Verificação de Saúde das Chaves */}
              {keyVerificationReport && (
                <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs rounded-2xl flex items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      <strong>Verificação concluída às {keyVerificationReport.verifiedAt}:</strong> {keyVerificationReport.free} chaves ativas com cota disponível, {keyVerificationReport.exhausted} esgotadas/inválidas.
                    </span>
                  </div>
                  <button
                    onClick={() => setKeyVerificationReport(null)}
                    className="text-emerald-700 hover:text-emerald-900 text-[10px] font-bold p-1 hover:bg-emerald-100 rounded-lg cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* ======================= ABA GOOGLE GEMINI ======================= */}
              {selectedProviderTab === 'gemini' && (
                <div className="space-y-6 text-left">
                  {/* Card de Status Ativo do Gemini */}
                  <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Provedor Google Gemini</h4>
                        <p className="text-[11px] text-slate-500">
                          {activeProvider === 'gemini' 
                            ? 'Este é o motor atualmente ativo para geração de roteiros e carrosséis.' 
                            : 'Atualmente inativo. Clique ao lado para ativar o Gemini como motor principal.'}
                        </p>
                      </div>
                    </div>

                    {activeProvider === 'gemini' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200">
                        <Check className="w-3.5 h-3.5" /> IA Ativa
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSelectActiveProvider('gemini')}
                        className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Definir Gemini como IA Ativa
                      </button>
                    )}
                  </div>

                  {/* Seletor de Modelo Gemini */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">Modelo Gemini Preferido</label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={geminiModel}
                        onChange={(e) => handleSaveGeminiModel(e.target.value)}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {GEMINI_AVAILABLE_MODELS.map((m) => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleTestProvider('gemini')}
                        disabled={isTestingProvider}
                        className="px-3.5 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        {isTestingProvider ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>Testar Gemini</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400">O sistema rotaciona automaticamente entre os modelos e suas chaves gratuitas em caso de 429 ou sobrecarga.</p>
                  </div>

                  {/* Cards de Resumo de Chaves com Ações de Verificação */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status das Cotas Gemini</h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetKeys}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                          title="Restaurar status de todas as chaves para Livres"
                        >
                          Resetar Status
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyAllKeys}
                          disabled={isVerifyingKeys}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${isVerifyingKeys ? 'animate-spin' : ''}`} />
                          <span>{isVerifyingKeys ? 'Verificando...' : 'Medir Cotas'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Chaves</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">{keysStats.total}</p>
                      </div>
                      <div className="p-3.5 bg-emerald-50/50 border border-emerald-100/80 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider">Chaves Livres</p>
                        <p className="text-2xl font-black text-emerald-600 mt-1">{keysStats.free}</p>
                      </div>
                      <div className="p-3.5 bg-amber-50/50 border border-amber-100/80 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-wider">Esgotadas (429)</p>
                        <p className="text-2xl font-black text-amber-600 mt-1">{keysStats.exhausted}</p>
                      </div>
                    </div>
                  </div>

                  {/* Área de Upload / Entrada de arquivo .txt */}
                  <div className="p-5 border border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 transition bg-slate-50/30 flex flex-col items-center justify-center text-center gap-3">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">Fazer Upload de arquivo .txt de Chaves Gemini</p>
                      <p className="text-[10px] text-slate-400 mt-1">Carregue um arquivo contendo uma chave Gemini por linha (começando com AIzaSy)</p>
                    </div>
                    
                    <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition cursor-pointer flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      <span>{isUploadingKeys ? 'Carregando...' : 'Selecionar Arquivo .txt'}</span>
                      <input 
                        type="file" 
                        accept=".txt" 
                        onChange={handleKeysFileUpload} 
                        className="hidden"
                        disabled={isUploadingKeys}
                      />
                    </label>
                  </div>

                  {/* Tabela de Chaves Carregadas com Status Detalhado */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chaves Rotativas Cadastradas</h4>
                      <span className="text-[10px] text-slate-400">{keysStats.keysList.length} cadastradas</span>
                    </div>
                    
                    {keysStats.keysList.length === 0 ? (
                      <div className="py-8 text-center border border-slate-100 rounded-2xl bg-slate-50/20">
                        <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-medium">Nenhuma chave rotativa carregada.</p>
                        <p className="text-[10px] text-slate-400/80 mt-0.5">O sistema usará por padrão a chave contida no arquivo .env se disponível.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xs">
                        <div className="max-h-52 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500">
                                <th className="p-3">Chave</th>
                                <th className="p-3">Status & Cota</th>
                                <th className="p-3 text-center">Sucessos</th>
                                <th className="p-3 text-center">Falhas</th>
                                <th className="p-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {keysStats.keysList.map((keyObj) => (
                                <tr key={keyObj.id} className="hover:bg-slate-50/50 transition">
                                  <td className="p-3 font-mono text-[11px] text-slate-600">
                                    <div className="font-bold">{keyObj.keyMasked}</div>
                                    {keyObj.lastVerified && (
                                      <div className="text-[9px] text-slate-400 font-sans mt-0.5">Verificada: {keyObj.lastVerified}</div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${keyObj.status === 'free' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                      {keyObj.status === 'free' ? 'Ativa / Livre' : 'Cota Esgotada (429)'}
                                    </span>
                                    {keyObj.lastError && (
                                      <div className="text-[9px] text-amber-700/80 mt-0.5 max-w-[140px] truncate" title={keyObj.lastError}>
                                        {keyObj.lastError}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-3 text-center text-emerald-600 font-bold">{keyObj.successCount}</td>
                                  <td className="p-3 text-center text-rose-500 font-bold">{keyObj.errorCount}</td>
                                  <td className="p-3 text-right">
                                    <button 
                                      onClick={() => handleRemoveKey(keyObj.id)}
                                      className="p-1 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
                                      title="Remover Chave"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ======================= ABA OPENROUTER ======================= */}
              {selectedProviderTab === 'openrouter' && (
                <div className="space-y-6 text-left">
                  {/* Card de Status Ativo do OpenRouter */}
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center">
                        <Cpu className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Provedor OpenRouter API</h4>
                        <p className="text-[11px] text-slate-500">
                          {activeProvider === 'openrouter' 
                            ? 'Este é o motor atualmente ativo para geração de roteiros e carrosséis.' 
                            : 'Atualmente inativo. Clique ao lado para ativar o OpenRouter como motor principal.'}
                        </p>
                      </div>
                    </div>

                    {activeProvider === 'openrouter' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-300">
                        <Check className="w-3.5 h-3.5" /> IA Ativa
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSelectActiveProvider('openrouter')}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Definir OpenRouter como IA Ativa
                      </button>
                    )}
                  </div>

                  {/* Informação e Campo de Chave API Universal OpenRouter */}
                  <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                    <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                      <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Chave Universal OpenRouter:</span> Uma única chave de API funciona para todos os modelos abaixo (MiniMax, Gemma, Nemotron, DeepSeek, etc.). Cole sua chave abaixo e ela ficará salva automaticamente.
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span>Chave da API OpenRouter (sk-or-v1-...)</span>
                      </label>
                      <a 
                        href="https://openrouter.ai/keys" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-indigo-600 hover:underline flex items-center gap-1 font-bold"
                      >
                        <span>Obter chave gratuita no OpenRouter</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="password"
                        value={openrouterKeyInput}
                        onChange={(e) => setOpenrouterKeyInput(e.target.value)}
                        placeholder={openrouterConfig.hasKey ? `Chave salva: ${openrouterConfig.apiKeyMasked}` : 'Cole sua chave: sk-or-v1-...'}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                      />
                      <button
                        onClick={handleSaveOpenRouterKeyOnly}
                        disabled={!openrouterKeyInput.trim() || isSavingProviderSettings}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        {isSavingProviderSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Salvar Chave</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${openrouterConfig.hasKey ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                        {openrouterConfig.hasKey 
                          ? `Chave salva e ativa: ${openrouterConfig.apiKeyMasked}` 
                          : 'Nenhuma chave salva. Cole e clique em Salvar Chave.'}
                      </span>
                      <span className="text-[10px] text-slate-400">Salva no arquivo de configuração e .env</span>
                    </div>
                  </div>

                  {/* Card do Medidor de Cota e Limites da Chave OpenRouter */}
                  <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white rounded-2xl shadow-sm border border-slate-700/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
                          <Gauge className="w-4 h-4" />
                        </div>
                        <div>
                          <h5 className="text-xs font-bold text-slate-200">Medidor de Cota & Uso OpenRouter</h5>
                          <p className="text-[10px] text-slate-400">Métricas em tempo real da chave na API OpenRouter</p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => fetchOpenRouterQuota()}
                        disabled={isLoadingQuota}
                        className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-[10px] font-bold text-amber-400 flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingQuota ? 'animate-spin' : ''}`} />
                        <span>Atualizar Cota</span>
                      </button>
                    </div>

                    {openrouterQuota ? (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Tipo da Conta</span>
                            <span className="text-xs font-bold text-emerald-400 mt-0.5 flex items-center gap-1">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              {openrouterQuota.is_free_tier ? 'Free Tier (Gratuito)' : 'Paga / Padrão'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Uso Acumulado</span>
                            <span className="text-xs font-bold text-amber-300 mt-0.5 block font-mono">
                              {typeof openrouterQuota.usage === 'number' ? `$${openrouterQuota.usage.toFixed(4)} USD` : '$0.0000 USD'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Limite da Chave</span>
                            <span className="text-xs font-bold text-slate-200 mt-0.5 block font-mono">
                              {openrouterQuota.limit ? `$${openrouterQuota.limit.toFixed(2)} USD` : 'Ilimitado'}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-800/80 rounded-xl border border-slate-700/50">
                            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Rate Limit</span>
                            <span className="text-xs font-bold text-slate-200 mt-0.5 block font-mono">
                              {openrouterQuota.rate_limit ? `${openrouterQuota.rate_limit.requests} req / ${openrouterQuota.rate_limit.interval}` : 'Automático'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                          <span className="flex items-center gap-1 text-emerald-400 font-medium">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            Chave verificada e autorizada no OpenRouter
                          </span>
                          {openrouterQuota.lastUpdated && (
                            <span>Atualizado às {openrouterQuota.lastUpdated}</span>
                          )}
                        </div>
                      </div>
                    ) : quotaError ? (
                      <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold block text-rose-200">Não foi possível obter a cota:</span>
                          <span className="text-[11px] text-rose-300/90">{quotaError}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3.5 bg-slate-800/50 rounded-xl text-center text-xs text-slate-400 space-y-1">
                        {isLoadingQuota ? (
                          <div className="flex items-center justify-center gap-2 text-amber-400 font-bold text-xs py-1">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Consultando status e cota na API OpenRouter...</span>
                          </div>
                        ) : openrouterConfig.hasKey || openrouterKeyInput.trim() ? (
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-300">Clique em "Atualizar Cota" para ler os créditos e limites da chave.</span>
                            <button
                              type="button"
                              onClick={() => fetchOpenRouterQuota()}
                              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold shadow-xs transition cursor-pointer"
                            >
                              Consultar Agora
                            </button>
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-400">
                            💡 Cole sua chave <span className="font-mono text-amber-300 font-bold">sk-or-v1-...</span> no campo acima e clique em <span className="font-bold text-slate-200">Salvar Chave</span> para ativar o medidor em tempo real.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Seleção de Modelos Gratuitos */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Selecione o Modelo Desejado (Clique para Ativar)</h4>
                        <p className="text-[10px] text-slate-400">Todos os modelos abaixo utilizam sua mesma chave OpenRouter configurada</p>
                      </div>
                      <button
                        onClick={() => setIsCustomOpenRouterModel(!isCustomOpenRouterModel)}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition"
                      >
                        {isCustomOpenRouterModel ? 'Ver Lista Recomendada' : 'Digitar Outro Modelo'}
                      </button>
                    </div>

                    {!isCustomOpenRouterModel ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {POPULAR_OPENROUTER_MODELS.map((m) => {
                          const isSelected = openrouterModelInput === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectOpenRouterModel(m.id)}
                              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
                                  : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-xs font-bold text-slate-800">{m.name}</span>
                                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] font-black rounded-md">
                                  FREE
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">{m.desc}</p>
                              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] text-slate-400">
                                <span className="font-semibold text-amber-700/90">{m.tag}</span>
                                {isSelected ? (
                                  <span className="font-bold text-amber-700 flex items-center gap-0.5 bg-amber-100 px-2 py-0.5 rounded-md">
                                    <Check className="w-3 h-3" /> Ativo
                                  </span>
                                ) : (
                                  <span className="text-slate-400 group-hover:text-slate-600">Clique para Usar</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
                        <label className="text-xs font-bold text-slate-700">Identificador do Modelo no OpenRouter</label>
                        <input
                          type="text"
                          value={openrouterModelInput}
                          onChange={(e) => handleSelectOpenRouterModel(e.target.value)}
                          placeholder="ex: minimax/minimax-m3:free ou google/gemma-4-26b-a4b-it:free"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                        />
                        <p className="text-[10px] text-slate-400">Consulte os identificadores em openrouter.ai/models.</p>
                      </div>
                    )}
                  </div>

                  {/* Configuração de Base URL */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">Base URL da API OpenRouter</label>
                    <input
                      type="text"
                      value={openrouterBaseUrlInput}
                      onChange={(e) => setOpenrouterBaseUrlInput(e.target.value)}
                      placeholder="https://openrouter.ai/api/v1"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                    />
                  </div>

                  {/* Ações do OpenRouter: Testar e Salvar */}
                  <div className="flex flex-wrap gap-2 justify-end pt-2">
                    <button
                      onClick={() => handleTestProvider('openrouter')}
                      disabled={isTestingProvider}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isTestingProvider ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Testar Conexão</span>
                    </button>

                    <button
                      onClick={() => handleSaveOpenRouterSettings(true)}
                      disabled={isSavingProviderSettings}
                      className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingProviderSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      <span>Salvar e Definir como IA Ativa</span>
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex gap-2">
                {selectedProviderTab === 'gemini' && (
                  <>
                    <button 
                      onClick={handleResetKeys}
                      disabled={keysStats.exhausted === 0}
                      className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:hover:bg-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Reativar Esgotadas
                    </button>
                    <button 
                      onClick={handleClearKeys}
                      disabled={keysStats.total === 0}
                      className="px-3.5 py-1.5 border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 disabled:opacity-50 disabled:hover:bg-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Limpar Tudo
                    </button>
                  </>
                )}
                {selectedProviderTab === 'openrouter' && (
                  <button 
                    onClick={() => handleSaveOpenRouterSettings(false)}
                    disabled={isSavingProviderSettings}
                    className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                  >
                    Salvar Alterações
                  </button>
                )}
              </div>
              <button 
                onClick={() => setIsKeyManagerOpen(false)}
                className="px-5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Zoom de Imagem da Auditoria */}
      {auditImageModalUrl && (
        <div 
          onClick={() => setAuditImageModalUrl(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95"
          >
            <div className="p-4 bg-slate-800/80 border-b border-slate-700 flex items-center justify-between text-white">
              <span className="text-xs font-bold font-mono truncate max-w-[500px]">{auditImageModalUrl.title}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveAs(auditImageModalUrl.url, auditImageModalUrl.title.replace(/[^a-zA-Z0-9._-]/g, '_'))}
                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar
                </button>
                <button
                  onClick={() => setAuditImageModalUrl(null)}
                  className="p-1 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 flex items-center justify-center bg-slate-950 overflow-auto">
              <img 
                src={auditImageModalUrl.url} 
                alt={auditImageModalUrl.title} 
                className="max-h-[75vh] w-auto object-contain rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
