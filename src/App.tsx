import React, { useState, useRef } from 'react';
import { Loader2, Copy, Check, Sparkles, Image as ImageIcon, Clapperboard, MessageSquare, Upload, Key, X, FileText, Download, ArrowLeft, ArrowRight, RotateCw, Play, Square, Trash2, Eye, Compass, Terminal, MousePointer, Keyboard, Cpu, Send, Database, Zap, Settings, Bot, Globe, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, KeyRound, ExternalLink, Layers, DollarSign, Activity, Gauge, BarChart3, Images, ListOrdered, FileCheck2, ZoomIn, AlertTriangle, FolderArchive, Grid, SlidersHorizontal, Sparkle, FileUp, ChevronUp, ChevronDown, Maximize2, Minimize2, Filter, CheckSquare, Camera, Workflow, ListChecks, Plus, Pause, FolderOpen, BookOpen, Clock, FileCode, CheckCheck } from 'lucide-react';
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
    const origin = window.location.origin || '';
    if (window.location.port === '5173' || !origin.startsWith('http') || origin.startsWith('file:')) {
      const host = window.location.hostname && window.location.hostname !== 'localhost' ? window.location.hostname : '127.0.0.1';
      return `http://${host}:3000${endpoint}`;
    }
  }
  return endpoint;
};

const apiFetch = async (endpoint: string, options: RequestInit = {}): Promise<Response> => {
  // 1. Tentar URL direta calculada
  const primaryUrl = getApiUrl(endpoint);
  try {
    const res = await fetch(primaryUrl, options);
    return res;
  } catch (err: any) {
    // 2. Se falhar, tentar endpoints alternativos imediatos (sem esperar 30s)
    const altUrls: string[] = [];
    if (primaryUrl !== endpoint && endpoint.startsWith('/')) {
      altUrls.push(endpoint);
    }
    if (primaryUrl.includes('127.0.0.1:3000')) {
      altUrls.push(primaryUrl.replace('127.0.0.1:3000', 'localhost:3000'));
    } else if (primaryUrl.includes('localhost:3000')) {
      altUrls.push(primaryUrl.replace('localhost:3000', '127.0.0.1:3000'));
    }

    for (const altUrl of altUrls) {
      try {
        const res = await fetch(altUrl, options);
        return res;
      } catch {}
    }
    throw err;
  }
};

export type DialogueLanguage = 'pt' | 'en' | 'es' | 'all';

export const LANGUAGES = [
  { id: 'pt' as const, label: 'Português', flag: '🇧🇷', code: 'PT', name: 'Português (Brasil)' },
  { id: 'en' as const, label: 'Inglês', flag: '🇺🇸', code: 'EN', name: 'Inglês (English)' },
  { id: 'es' as const, label: 'Espanhol', flag: '🇪🇸', code: 'ES', name: 'Espanhol (Español)' },
  { id: 'all' as const, label: 'Trilíngue (PT, EN e ES)', flag: '🌐', code: 'TODOS', name: 'Trilíngue (PT, EN e ES)' },
];

interface GeneratedPrompts {
  language?: DialogueLanguage | string;
  scenes: {
    sceneNumber: number;
    duration: number;
    contextPt: string;
    videoPromptEn: string;
    dialoguePt?: string;
    dialogueEn?: string;
    dialogueEs?: string;
    dialogue?: string;
    isVoiceOver: boolean;
  }[];
  nanoBananaImagePrompt: string;
  instagramPost: string;
}

interface GeneratedCarousel {
  title?: string;
  theme?: string;
  language?: DialogueLanguage | string;
  coverImagePrompt?: string;
  slides: {
    slideNumber: number;
    imagePromptEn: string;
    textInBubblesPt?: string;
    textInBubblesEn?: string;
    textInBubblesEs?: string;
    textInBubbles?: string;
    descriptionPt: string;
  }[];
  instagramPost: string;
}

interface ReferencePdfFile {
  name: string;
  data: string;
  mimeType: string;
  size: number;
  text?: string;
  docType?: 'pdf' | 'docx' | 'txt' | 'doc';
}

const optimizeImageForAi = async (
  file: File,
  maxDim = 1024,
  quality = 0.85
): Promise<{ base64: string; dataUrl: string; size: number; mimeType: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const mimeType = 'image/jpeg';
          const optimizedDataUrl = canvas.toDataURL(mimeType, quality);
          const base64 = optimizedDataUrl.split(',')[1];
          resolve({
            dataUrl: optimizedDataUrl,
            base64,
            size: Math.round((base64.length * 3) / 4),
            mimeType
          });
          return;
        }
        const base64 = rawDataUrl.includes('base64,') ? rawDataUrl.split('base64,')[1] : rawDataUrl;
        resolve({
          dataUrl: rawDataUrl,
          base64,
          size: file.size,
          mimeType: file.type || 'image/png'
        });
      };
      img.onerror = () => {
        const base64 = rawDataUrl.includes('base64,') ? rawDataUrl.split('base64,')[1] : rawDataUrl;
        resolve({
          dataUrl: rawDataUrl,
          base64,
          size: file.size,
          mimeType: file.type || 'image/png'
        });
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      resolve({ dataUrl: '', base64: '', size: 0, mimeType: 'image/png' });
    };
    reader.readAsDataURL(file);
  });
};

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
  elementos_visuais_identificados?: string;
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

// Interfaces do Espião FLOW e Executor RPA em Larga Escala
export interface SpyRecordedStep {
  id: number;
  type: 'click' | 'input' | 'keypress' | 'wait' | 'navigate' | 'screenshot';
  selector: string;
  xpath?: string;
  tagName?: string;
  text?: string;
  name?: string;
  value?: string;
  description: string;
  screenshot?: string;
  timestamp?: string;
}

export interface SpyVariableItem {
  nome_variavel: string;
  valor_original: string;
  descricao: string;
  passo_index: number;
}

export interface SpyMacroStep {
  ordem: number;
  tipo: 'click' | 'fill' | 'wait' | 'navigate' | 'screenshot' | 'keypress';
  seletor: string;
  xpath?: string;
  valor?: string;
  variavel_associada?: string;
  descricao: string;
  tempo_espera_ms?: number;
}

export interface SpyMacro {
  id: string;
  nome_processo: string;
  descricao_processo: string;
  targetUrl: string;
  resumo_passo_a_passo: string[];
  variaveis_identificadas: SpyVariableItem[];
  macro_parametrizado: SpyMacroStep[];
  codigo_puppeteer?: string;
  codigo_playwright?: string;
  updatedAt?: string;
}

export interface ExecutorBatchItem {
  id: string;
  label?: string;
  params: Record<string, string>;
  status: 'pending' | 'running' | 'success' | 'failed';
  log?: string;
  screenshot?: string;
}

export interface AuditMultiProjectItem {
  id: string;
  titulo_projeto: string;
  nome_arquivo_zip_sugerido: string;
  resumo_narrativo: string;
  pontuacao_media: string;
  roteiro_associado?: string;
  slides_ordenados: AuditSlideResult[];
  imagens_sobressalentes: AuditSurplusImage[];
  zipBlob?: Blob;
  savedPath?: string;
}

export interface MultiProjectAuditResponse {
  resumo_geral_auditoria: string;
  projetos: AuditMultiProjectItem[];
  imagens_descartadas_globais?: string[];
}

export interface ExecutionLogItem {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'ai' | 'image' | 'doc';
  category: string;
  message: string;
  details?: string;
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
  const [recordedSteps, setRecordedSteps] = useState<SpyRecordedStep[]>([]);
  const [preloadPath, setPreloadPath] = useState<string>('');
  const [webviewCanGoBack, setWebviewCanGoBack] = useState(false);
  const [webviewCanGoForward, setWebviewCanGoForward] = useState(false);
  const [isWebviewLoading, setIsWebviewLoading] = useState(false);
  const [activeSpyScriptTab, setActiveSpyScriptTab] = useState<'json' | 'puppeteer' | 'playwright'>('json');
  const [syncStatus, setSyncStatus] = useState<{ message: string; type: 'success' | 'error' | '' }>({ message: '', type: '' });

  // Estados do Espião FLOW com IA e Executor em Larga Escala (RPA)
  const [spySubTab, setSpySubTab] = useState<'recorder' | 'macro' | 'executor' | 'library' | 'flowchart'>('recorder');
  const [flowchartNodes, setFlowchartNodes] = useState<Array<{id: string; macroId: string; name: string; x: number; y: number; connections: string[]}>>([]);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({x: 0, y: 0});
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const flowchartRef = useRef<HTMLDivElement>(null);
  const [isFlowchartRunning, setIsFlowchartRunning] = useState(false);
  const [flowchartRunningNodeId, setFlowchartRunningNodeId] = useState<string | null>(null);
  const [isAnalyzingProcess, setIsAnalyzingProcess] = useState(false);
  const [userProcessGoalInput, setUserProcessGoalInput] = useState('');
  const [activeMacro, setActiveMacro] = useState<SpyMacro | null>(null);
  const [savedMacrosList, setSavedMacrosList] = useState<SpyMacro[]>([]);
  const [renamingMacroId, setRenamingMacroId] = useState<string | null>(null);
  const [renamingMacroName, setRenamingMacroName] = useState('');
  const [isLoadingMacros, setIsLoadingMacros] = useState(false);
  
  // Estados do Executor em Larga Escala
  const [executorBatchItems, setExecutorBatchItems] = useState<ExecutorBatchItem[]>([]);
  const [isExecutorRunning, setIsExecutorRunning] = useState(false);
  const [isExecutorPaused, setIsExecutorPaused] = useState(false);
  const [executorCurrentIndex, setExecutorCurrentIndex] = useState(0);
  const [executorCurrentStepIndex, setExecutorCurrentStepIndex] = useState(0);
  const [executorDelayBetweenSteps, setExecutorDelayBetweenSteps] = useState(1500);
  const [executorDelayBetweenItems, setExecutorDelayBetweenItems] = useState(3000);

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
  const [dialogueLanguage, setDialogueLanguage] = useState<DialogueLanguage>('pt');
  
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
  const [carouselQuantity, setCarouselQuantity] = useState<number>(1);
  const [batchCarouselResults, setBatchCarouselResults] = useState<GeneratedCarousel[]>([]);
  const [activeCarouselIndex, setActiveCarouselIndex] = useState<number>(0);

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

  // Estados de Pré-visualização & Ordenação Interativa de Imagens
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<'ordered' | 'surplus' | 'report'>('ordered');
  const [orderedSlidesList, setOrderedSlidesList] = useState<AuditSlideResult[]>([]);
  const [surplusImagesList, setSurplusImagesList] = useState<AuditSurplusImage[]>([]);
  const [downloadSuccessInfo, setDownloadSuccessInfo] = useState<{
    filename: string;
    savedPath: string | null;
    sizeBytes?: number;
    downloadUrl?: string;
  } | null>(null);

  // Estados de Auditoria Multi-Projetos & Multi-Roteiros
  const [multiProjectsResult, setMultiProjectsResult] = useState<MultiProjectAuditResponse | null>(null);
  const [activeMultiProjectIndex, setActiveMultiProjectIndex] = useState<number>(0);
  const [isDownloadingAllZips, setIsDownloadingAllZips] = useState<boolean>(false);

  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  // Console de Logs de Execução em Tempo Real (Rodapé Global)
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogItem[]>([
    {
      id: 'init-0',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level: 'info',
      category: 'SISTEMA',
      message: 'PostForge inicializado. Monitor de execução em tempo real ativo.'
    }
  ]);
  const [isLogPanelOpen, setIsLogPanelOpen] = useState(false);
  const [isLogPanelVisible, setIsLogPanelVisible] = useState(true);
  const [logFilter, setLogFilter] = useState<'all' | 'ai' | 'audit' | 'doc' | 'error'>('all');
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (
    level: 'info' | 'success' | 'warning' | 'error' | 'ai' | 'image' | 'doc',
    category: string,
    message: string,
    details?: string
  ) => {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const item: ExecutionLogItem = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp,
      level,
      category,
      message,
      details
    };
    setExecutionLogs(prev => {
      const next = [...prev, item];
      if (next.length > 500) return next.slice(next.length - 500);
      return next;
    });
  };

  const handleClearLogs = () => {
    setExecutionLogs([]);
  };

  const handleCopyLogs = () => {
    const text = executionLogs.map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.category}] ${l.message}${l.details ? `\n  Det: ${l.details}` : ''}`).join('\n');
    navigator.clipboard.writeText(text);
    handleCopy(text, 'all_logs');
  };

  React.useEffect(() => {
    if (autoScrollLogs && isLogPanelOpen && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [executionLogs, isLogPanelOpen, autoScrollLogs]);

  // Abort controller ref para cancelamento real das requisições
  const abortControllerRef = useRef<AbortController | null>(null);

  // Constantes de Modelos de I.A
  const POPULAR_OPENROUTER_MODELS = [
    {
      id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      name: 'NVIDIA Nemotron 3 Ultra (Free)',
      tag: '550B Parâmetros • Gratuito',
      desc: 'Ultra alta capacidade para narrativas complexas e adaptações profundas'
    },
    {
      id: 'google/gemma-4-26b-a4b-it:free',
      name: 'Google Gemma 4 26B Instruct (Free)',
      tag: 'Alta Precisão • Gratuito',
      desc: 'Modelo avançado do Google com raciocínio e síntese rápidos'
    },
    {
      id: 'deepseek/deepseek-r1:free',
      name: 'DeepSeek R1 (Free)',
      tag: 'Raciocínio Lógico • Gratuito',
      desc: 'Excelente para análises e estruturação de carrosséis educativos'
    },
    {
      id: 'minimax/minimax-m3:free',
      name: 'MiniMax M3 (Free)',
      tag: 'Criatividade & Roteiros • Gratuito',
      desc: 'Excelente capacidade para escrita criativa e ganchos em português'
    },
    {
      id: 'google/gemini-2.0-flash-exp:free',
      name: 'Google Gemini 2.0 Flash Exp (Free)',
      tag: 'Experimental • Gratuito',
      desc: 'Modelo ágil do Google via gateway OpenRouter'
    }
  ];

  const POPULAR_GROQ_MODELS = [
    {
      id: 'qwen/qwen3.8-27b',
      name: 'Qwen 3.8 27B (Recomendado)',
      tag: '131k Contexto • Alibaba Cloud',
      desc: 'Modelo mais recente e potente do Qwen, ideal para roteiros e carrosséis em português com 131k de contexto'
    },
    {
      id: 'qwen/qwen3.6-27b',
      name: 'Qwen 3.6 27B',
      tag: '131k Contexto • Alta Qualidade',
      desc: 'Excelente para geração de textos longos e coerentes com alto contexto'
    },
    {
      id: 'openai/gpt-oss-120b',
      name: 'GPT OSS 120B (Máxima Qualidade)',
      tag: '131k Contexto • OpenAI Open Source',
      desc: 'Modelo open-source de 120B parâmetros da OpenAI, qualidade comparável ao GPT-4'
    },
    {
      id: 'openai/gpt-oss-20b',
      name: 'GPT OSS 20B (Ultra Rápido)',
      tag: '131k Contexto • Velocidade Extrema',
      desc: 'Versão compacta e ultra-rápida do GPT OSS, perfeito para legendas e prompts'
    },
    {
      id: 'groq/compound-mini',
      name: 'Groq Compound Mini (Agêntico)',
      tag: '131k Contexto • Groq Nativo',
      desc: 'Motor agêntico nativo do Groq com ferramentas integradas e raciocínio avançado'
    }
  ];

  const GEMINI_AVAILABLE_MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Padrão Recomendado - Ultra Rápido)' },
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Mais Recente)' },
    { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash Lite (Ultraleve)' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Alta Capacidade / Raciocínio)' },
  ];

  // Estados da Central de I.As e Provedores
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'openrouter' | 'groq'>('gemini');
  const [selectedProviderTab, setSelectedProviderTab] = useState<'gemini' | 'openrouter' | 'groq'>('gemini');
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

  const [groqConfig, setGroqConfig] = useState<{
    hasKey: boolean;
    apiKeyMasked: string;
    baseUrl: string;
    model: string;
  }>({
    hasKey: false,
    apiKeyMasked: '',
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'qwen/qwen3.8-27b'
  });
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [groqBaseUrlInput, setGroqBaseUrlInput] = useState('https://api.groq.com/openai/v1');
  const [groqModelInput, setGroqModelInput] = useState('qwen/qwen3.8-27b');
  const [isCustomGroqModel, setIsCustomGroqModel] = useState(false);

  // Estados de Múltiplas Chaves Groq com Pool Rotativo
  const [groqKeysStats, setGroqKeysStats] = useState<{
    total: number;
    free: number;
    exhausted: number;
    keysList: Array<{
      id: string;
      keyMasked: string;
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
    }>;
  }>({ total: 0, free: 0, exhausted: 0, keysList: [] });
  const [groqMultiKeysInput, setGroqMultiKeysInput] = useState('');
  const [isUploadingGroqKeys, setIsUploadingGroqKeys] = useState(false);
  const [isVerifyingGroqKeys, setIsVerifyingGroqKeys] = useState(false);
  const [groqVerificationReport, setGroqVerificationReport] = useState<{
    verifiedAt: string;
    total: number;
    free: number;
    exhausted: number;
  } | null>(null);

  const [groqQuota, setGroqQuota] = useState<{
    status?: string;
    message?: string;
    requestsRemaining?: number;
    requestsLimit?: number;
    tokensRemaining?: number;
    tokensLimit?: number;
    resetRequests?: string;
    resetTokens?: string;
    lastUpdated?: string;
  } | null>(null);
  const [isLoadingGroqQuota, setIsLoadingGroqQuota] = useState(false);
  const [groqQuotaError, setGroqQuotaError] = useState<string | null>(null);

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

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (auditImageModalUrl) {
          setAuditImageModalUrl(null);
        } else if (isPreviewModalOpen) {
          setIsPreviewModalOpen(false);
        } else if (isKeyManagerOpen) {
          setIsKeyManagerOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [auditImageModalUrl, isPreviewModalOpen, isKeyManagerOpen]);

  const fetchOpenRouterQuota = async (keyOverride?: string) => {
    const keyToUse = (keyOverride !== undefined ? keyOverride : openrouterKeyInput.trim()).trim();
    setIsLoadingQuota(true);
    setQuotaError(null);
    addLog('info', 'COTA', 'Consultando saldo e limites na API OpenRouter...');
    try {
      const endpoint = keyToUse 
        ? `/api/providers/openrouter/quota?apiKey=${encodeURIComponent(keyToUse)}`
        : '/api/providers/openrouter/quota';

      const res = await apiFetch(endpoint, {
        signal: AbortSignal.timeout(15000)
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Resposta inesperada do servidor (Status HTTP ${res.status}): ${text.slice(0, 100)}`);
      }

      if (data.openrouterStats) {
        setOpenrouterKeysStats(data.openrouterStats);
      }

      if (data?.notConfigured) {
        setOpenrouterQuota(null);
        setQuotaError(null);
        return;
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || `Não foi possível obter a cota do OpenRouter (Status ${res.status})`);
      }

      const quotaObj = {
        label: data.keyInfo?.label || (data.activeKey ? `Chave ${data.activeKey}` : undefined),
        usage: typeof data.keyInfo?.usage === 'number' ? data.keyInfo?.usage : (typeof data.creditsInfo?.total_usage === 'number' ? data.creditsInfo?.total_usage : 0),
        limit: data.keyInfo?.limit ?? null,
        is_free_tier: data.keyInfo?.is_free_tier ?? true,
        rate_limit: data.keyInfo?.rate_limit,
        credits: typeof data.creditsInfo?.total_credits === 'number' ? data.creditsInfo?.total_credits : (data.keyInfo?.limit ?? undefined),
        lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      setOpenrouterQuota(quotaObj);
      addLog('success', 'COTA', `Métricas OpenRouter: Uso $${quotaObj.usage.toFixed(4)} USD | Conta ${quotaObj.is_free_tier ? 'Free Tier' : 'Padrão'} | Limite: ${quotaObj.limit ? `$${quotaObj.limit}` : 'Ilimitado'}`);
    } catch (err: any) {
      const errorMsg = err.name === 'TimeoutError' ? 'Tempo limite esgotado ao consultar OpenRouter (15s).' : (err.message || 'Erro ao carregar cota da chave.');
      console.warn('Erro ao carregar cota OpenRouter:', err);
      setQuotaError(errorMsg);
      addLog('error', 'COTA', `Falha ao consultar cota OpenRouter: ${errorMsg}`);
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

  // Estados de Múltiplas Chaves OpenRouter com Pool Rotativo
  const [openrouterKeysStats, setOpenrouterKeysStats] = useState<{
    total: number;
    free: number;
    exhausted: number;
    keysList: Array<{
      id: string;
      keyMasked: string;
      label?: string;
      status: 'free' | 'exhausted';
      successCount: number;
      errorCount: number;
      addedAt: string;
      lastVerified?: string;
      lastError?: string;
      creditsRemaining?: number;
    }>;
  }>({ total: 0, free: 0, exhausted: 0, keysList: [] });
  const [openrouterMultiKeysInput, setOpenrouterMultiKeysInput] = useState('');
  const [isUploadingOpenRouterKeys, setIsUploadingOpenRouterKeys] = useState(false);
  const [isVerifyingOpenRouterKeys, setIsVerifyingOpenRouterKeys] = useState(false);
  const [openrouterVerificationReport, setOpenrouterVerificationReport] = useState<{
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

  const fetchOpenRouterKeys = async () => {
    try {
      const res = await apiFetch('/api/openrouter-keys');
      if (res.ok) {
        const data = await res.json();
        setOpenrouterKeysStats(data);
      }
    } catch (e) {
      console.warn('Erro ao buscar chaves OpenRouter:', e);
    }
  };

  const handleAddOpenRouterMultiKeys = async () => {
    if (!openrouterMultiKeysInput.trim()) return;
    const rawKeys = openrouterMultiKeysInput
      .split(/[\r\n,;]+/)
      .map(k => k.trim().replace(/^["']+|["']+$/g, '').trim())
      .filter(Boolean);
    if (rawKeys.length === 0) return;

    setIsUploadingOpenRouterKeys(true);
    setKeyManagerError(null);
    try {
      const res = await apiFetch('/api/openrouter-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: rawKeys, labelPrefix: 'Conta' }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setOpenrouterKeysStats(data);
        setOpenrouterMultiKeysInput('');
        addLog('success', 'OPENROUTER', `${data.addedCount || rawKeys.length} chave(s) OpenRouter adicionada(s) ao pool com sucesso!`);
        await fetchOpenRouterKeys();
        await fetchProvidersAndStats();
      } else {
        throw new Error(data.error || `Erro HTTP ${res.status} ao adicionar chaves.`);
      }
    } catch (err: any) {
      const msg = err.name === 'TimeoutError' ? 'Tempo limite esgotado ao contatar o backend (30s).' : (err.message || 'Erro ao adicionar chaves.');
      setKeyManagerError(`Erro ao adicionar chaves OpenRouter: ${msg}`);
      addLog('error', 'OPENROUTER', `Falha ao adicionar chaves: ${msg}`);
    } finally {
      setIsUploadingOpenRouterKeys(false);
    }
  };

  const handleOpenRouterKeysFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingOpenRouterKeys(true);
    setKeyManagerError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text
          .split(/[\r\n,;]+/)
          .map(l => l.trim().replace(/^["']+|["']+$/g, '').trim())
          .filter(l => l && !l.startsWith('#'));
        if (lines.length === 0) {
          alert('Nenhuma chave encontrada no arquivo .txt selecionado.');
          setIsUploadingOpenRouterKeys(false);
          return;
        }
        const res = await apiFetch('/api/openrouter-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: lines, labelPrefix: 'Arquivo' }),
          signal: AbortSignal.timeout(30000)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setOpenrouterKeysStats(data);
          addLog('success', 'OPENROUTER', `${data.addedCount || lines.length} chave(s) OpenRouter importada(s) com sucesso.`);
          await fetchOpenRouterKeys();
          await fetchProvidersAndStats();
        } else {
          throw new Error(data.error || `Erro HTTP ${res.status} ao importar arquivo.`);
        }
      } catch (err: any) {
        const msg = err.name === 'TimeoutError' ? 'Tempo limite esgotado ao contatar o backend (30s).' : (err.message || 'Erro ao carregar arquivo de chaves.');
        setKeyManagerError(`Erro ao carregar arquivo de chaves OpenRouter: ${msg}`);
        addLog('error', 'OPENROUTER', `Falha ao carregar arquivo de chaves OpenRouter: ${msg}`);
      } finally {
        setIsUploadingOpenRouterKeys(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetOpenRouterKeys = async () => {
    try {
      const res = await apiFetch('/api/openrouter-keys/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setOpenrouterKeysStats(data);
        addLog('success', 'OPENROUTER', 'Todas as chaves OpenRouter foram reativadas (status: Livre).');
      }
    } catch (e: any) {
      setKeyManagerError(e.message);
    }
  };

  const handleRemoveOpenRouterKey = async (id: string) => {
    try {
      const res = await apiFetch(`/api/openrouter-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setOpenrouterKeysStats(data);
        addLog('info', 'OPENROUTER', 'Chave OpenRouter removida.');
      }
    } catch (e: any) {
      setKeyManagerError(e.message);
    }
  };

  const handleVerifyAllOpenRouterKeys = async () => {
    setIsVerifyingOpenRouterKeys(true);
    setKeyManagerError(null);
    addLog('info', 'OPENROUTER', 'Iniciando verificação de cotas de todas as chaves OpenRouter...');
    try {
      const res = await apiFetch('/api/openrouter-keys/verify-all', { method: 'POST', signal: AbortSignal.timeout(30000) });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch {}

      if (!res.ok) {
        throw new Error(data?.error || `Erro HTTP ${res.status}`);
      }

      setOpenrouterVerificationReport({
        verifiedAt: data.verifiedAt,
        total: data.total,
        free: data.free,
        exhausted: data.exhausted
      });
      await fetchOpenRouterKeys();
      addLog('success', 'OPENROUTER', `Verificação de cotas OpenRouter concluída: ${data.free} ativas, ${data.exhausted} esgotadas/inválidas.`);
    } catch (err: any) {
      console.error('Erro na verificação de chaves OpenRouter:', err);
      setKeyManagerError(err.message || 'Erro ao verificar chaves OpenRouter.');
      addLog('error', 'OPENROUTER', `Falha ao testar chaves OpenRouter: ${err.message}`);
    } finally {
      setIsVerifyingOpenRouterKeys(false);
    }
  };

  const handleClearOpenRouterKeys = async () => {
    if (!confirm('Deseja realmente remover todas as chaves OpenRouter cadastradas?')) return;
    try {
      const res = await apiFetch('/api/openrouter-keys/clear', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setOpenrouterKeysStats(data);
        addLog('info', 'OPENROUTER', 'Todas as chaves OpenRouter foram removidas.');
      }
    } catch (e: any) {
      setKeyManagerError(e.message);
    }
  };

  // ==========================================
  // MÉTODOS GROQ CLOUD (MULTI-KEYS & QUOTA)
  // ==========================================
  const fetchGroqQuota = async (keyOverride?: string) => {
    const keyToUse = (keyOverride !== undefined ? keyOverride : groqKeyInput.trim()).trim();
    setIsLoadingGroqQuota(true);
    setGroqQuotaError(null);
    addLog('info', 'COTA', 'Consultando saldo e limites na API Groq Cloud...');
    try {
      const endpoint = keyToUse 
        ? `/api/providers/groq/quota?apiKey=${encodeURIComponent(keyToUse)}`
        : '/api/providers/groq/quota';

      const res = await apiFetch(endpoint, {
        signal: AbortSignal.timeout(15000)
      });
      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Resposta inesperada do servidor (Status HTTP ${res.status}): ${text.slice(0, 100)}`);
      }

      if (data.groqStats) {
        setGroqKeysStats(data.groqStats);
      }

      if (data?.notConfigured) {
        setGroqQuota(null);
        setGroqQuotaError(null);
        return;
      }

      if (!data || data.success === false) {
        throw new Error(data?.error || `Não foi possível obter a cota do Groq (Status ${res.status})`);
      }

      const quotaObj = {
        status: data.keyInfo?.status || 'free',
        message: data.keyInfo?.message,
        requestsRemaining: data.keyInfo?.requestsRemaining,
        requestsLimit: data.keyInfo?.requestsLimit,
        tokensRemaining: data.keyInfo?.tokensRemaining,
        tokensLimit: data.keyInfo?.tokensLimit,
        resetRequests: data.keyInfo?.resetRequests,
        resetTokens: data.keyInfo?.resetTokens,
        lastUpdated: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      };

      setGroqQuota(quotaObj);
      addLog('success', 'COTA', `Métricas Groq: ${quotaObj.requestsRemaining !== undefined ? `${quotaObj.requestsRemaining}/${quotaObj.requestsLimit || '?'}` : 'Ativa'} reqs restantes | ${quotaObj.tokensRemaining !== undefined ? `${Math.round(quotaObj.tokensRemaining / 1000)}k` : '?'} tokens livres`);
    } catch (err: any) {
      const errorMsg = err.name === 'TimeoutError' ? 'Tempo limite esgotado ao consultar Groq (15s).' : (err.message || 'Erro ao carregar cota da chave.');
      console.warn('Erro ao carregar cota Groq:', err);
      setGroqQuotaError(errorMsg);
      addLog('error', 'COTA', `Falha ao consultar cota Groq: ${errorMsg}`);
    } finally {
      setIsLoadingGroqQuota(false);
    }
  };

  const fetchGroqKeys = async () => {
    try {
      const res = await apiFetch('/api/groq-keys');
      if (res.ok) {
        const data = await res.json();
        setGroqKeysStats(data);
      }
    } catch (e) {
      console.warn('Erro ao buscar chaves Groq:', e);
    }
  };

  const handleAddGroqMultiKeys = async () => {
    if (!groqMultiKeysInput.trim()) return;
    const rawKeys = groqMultiKeysInput
      .split(/[\r\n,;]+/)
      .map(k => k.trim().replace(/^["']+|["']+$/g, '').trim())
      .filter(Boolean);
    if (rawKeys.length === 0) return;

    setIsUploadingGroqKeys(true);
    setKeyManagerError(null);
    try {
      const res = await apiFetch('/api/groq-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: rawKeys, labelPrefix: 'Chave Groq' }),
        signal: AbortSignal.timeout(30000)
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setGroqKeysStats(data);
        setGroqMultiKeysInput('');
        addLog('success', 'GROQ', `${data.addedCount || rawKeys.length} chave(s) Groq adicionada(s) ao pool com sucesso!`);
        await fetchGroqKeys();
        await fetchProvidersAndStats();
      } else {
        throw new Error(data.error || `Erro HTTP ${res.status} ao adicionar chaves.`);
      }
    } catch (err: any) {
      const msg = err.name === 'TimeoutError' ? 'Tempo limite esgotado ao contatar o backend (30s).' : (err.message || 'Erro ao adicionar chaves.');
      setKeyManagerError(`Erro ao adicionar chaves Groq: ${msg}`);
      addLog('error', 'GROQ', `Falha ao adicionar chaves: ${msg}`);
    } finally {
      setIsUploadingGroqKeys(false);
    }
  };

  const handleGroqKeysFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingGroqKeys(true);
    setKeyManagerError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text
          .split(/[\r\n,;]+/)
          .map(l => l.trim().replace(/^["']+|["']+$/g, '').trim())
          .filter(l => l && !l.startsWith('#'));
        if (lines.length === 0) {
          alert('Nenhuma chave encontrada no arquivo .txt selecionado.');
          setIsUploadingGroqKeys(false);
          return;
        }
        const res = await apiFetch('/api/groq-keys', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: lines, labelPrefix: 'Arquivo' }),
          signal: AbortSignal.timeout(30000)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setGroqKeysStats(data);
          addLog('success', 'GROQ', `${data.addedCount || lines.length} chave(s) Groq importada(s) com sucesso.`);
          await fetchGroqKeys();
          await fetchProvidersAndStats();
        } else {
          throw new Error(data.error || `Erro HTTP ${res.status} ao importar arquivo.`);
        }
      } catch (err: any) {
        const msg = err.name === 'TimeoutError' ? 'Tempo limite esgotado ao contatar o backend (30s).' : (err.message || 'Erro ao carregar arquivo de chaves.');
        setKeyManagerError(`Erro ao carregar arquivo de chaves Groq: ${msg}`);
        addLog('error', 'GROQ', `Falha ao carregar arquivo de chaves Groq: ${msg}`);
      } finally {
        setIsUploadingGroqKeys(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetGroqKeys = async () => {
    try {
      const res = await apiFetch('/api/groq-keys/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setGroqKeysStats(data);
        addLog('success', 'GROQ', 'Todas as chaves Groq foram reativadas (status: Livre).');
      }
    } catch (e: any) {
      setKeyManagerError(e.message);
    }
  };

  const handleRemoveGroqKey = async (id: string) => {
    try {
      const res = await apiFetch(`/api/groq-keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setGroqKeysStats(data);
        addLog('info', 'GROQ', 'Chave Groq removida.');
      }
    } catch (e: any) {
      setKeyManagerError(e.message);
    }
  };

  const handleVerifyAllGroqKeys = async () => {
    setIsVerifyingGroqKeys(true);
    setKeyManagerError(null);
    addLog('info', 'GROQ', 'Iniciando verificação de cotas de todas as chaves Groq...');
    try {
      const res = await apiFetch('/api/groq-keys/verify-all', { method: 'POST', signal: AbortSignal.timeout(30000) });
      const text = await res.text();
      let data: any = null;
      try { data = JSON.parse(text); } catch {}

      if (!res.ok) {
        throw new Error(data?.error || `Erro HTTP ${res.status}`);
      }

      setGroqVerificationReport({
        verifiedAt: data.verifiedAt,
        total: data.total,
        free: data.free,
        exhausted: data.exhausted
      });
      await fetchGroqKeys();
      addLog('success', 'GROQ', `Verificação de cotas Groq concluída: ${data.free} ativas, ${data.exhausted} esgotadas/inválidas.`);
    } catch (err: any) {
      console.error('Erro na verificação de chaves Groq:', err);
      setKeyManagerError(err.message || 'Erro ao verificar chaves Groq.');
      addLog('error', 'GROQ', `Falha ao testar chaves Groq: ${err.message}`);
    } finally {
      setIsVerifyingGroqKeys(false);
    }
  };

  const handleClearGroqKeys = async () => {
    if (!confirm('Deseja realmente remover todas as chaves Groq cadastradas?')) return;
    try {
      const res = await apiFetch('/api/groq-keys/clear', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setGroqKeysStats(data);
        addLog('info', 'GROQ', 'Todas as chaves Groq foram removidas.');
      }
    } catch (e: any) {
      setKeyManagerError(e.message);
    }
  };

  const handleKeysFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingKeys(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text
          .split(/[\r\n,;]+/)
          .map(l => l.trim().replace(/^["']+|["']+$/g, '').trim())
          .filter(l => l && !l.startsWith('#'));
        if (lines.length === 0) {
          alert('Nenhuma chave encontrada no arquivo .txt selecionado.');
          setIsUploadingKeys(false);
          return;
        }
        const res = await apiFetch('/api/keys/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: lines }),
          signal: AbortSignal.timeout(30000)
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setKeysStats(data);
          addLog('success', 'CHAVES', `${data.total || lines.length} chave(s) Gemini carregada(s) com sucesso.`);
          await fetchProvidersAndStats();
        } else {
          throw new Error(data.error || `Erro HTTP ${res.status} ao importar chaves Gemini.`);
        }
      } catch (err: any) {
        setKeyManagerError(`Erro ao carregar arquivo de chaves Gemini: ${err.message}`);
      } finally {
        setIsUploadingKeys(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetKeys = async () => {
    try {
      const res = await apiFetch('/api/keys/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setKeysStats(data);
        addLog('success', 'CHAVES', 'Todas as chaves Gemini foram reativadas (status: Livre).');
      }
    } catch (e: any) {
      setKeyManagerError(e.message);
    }
  };

  const handleRemoveKey = async (id: string) => {
    try {
      const res = await apiFetch(`/api/keys/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        setKeysStats(data);
        addLog('info', 'CHAVES', 'Chave Gemini removida.');
      }
    } catch (e: any) {
      setKeyManagerError(e.message);
    }
  };

  const handleClearKeys = async () => {
    if (!confirm('Deseja realmente remover todas as chaves Gemini cadastradas?')) return;
    try {
      const res = await apiFetch('/api/keys/clear', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setKeysStats(data);
        addLog('info', 'CHAVES', 'Todas as chaves Gemini foram removidas.');
      }
    } catch (e: any) {
      setKeyManagerError(e.message);
    }
  };

  const handleVerifyAllKeys = async () => {
    setIsVerifyingKeys(true);
    setKeyManagerError(null);
    addLog('info', 'CHAVES', 'Iniciando teste de saúde de todas as chaves Gemini...');
    try {
      const res = await apiFetch('/api/keys/verify-all', { method: 'POST', signal: AbortSignal.timeout(30000) });
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
      addLog('success', 'CHAVES', `Saúde das chaves: ${data.free} livres / com cota, ${data.exhausted} esgotadas (total: ${data.total}).`);
      await fetchProvidersAndStats();
      if (openrouterConfig.hasKey || openrouterKeyInput.trim()) {
        fetchOpenRouterQuota();
      }
    } catch (err: any) {
      console.error('Erro na verificação de chaves:', err);
      setKeyManagerError(err.message || 'Erro ao verificar saúde das chaves.');
      addLog('error', 'CHAVES', `Falha ao testar chaves: ${err.message}`);
    } finally {
      setIsVerifyingKeys(false);
    }
  };

  const fetchProvidersAndStats = async () => {
    try {
      const response = await apiFetch('/api/providers');
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
        if (data.groq) {
          setGroqConfig(data.groq);
          setGroqBaseUrlInput(data.groq.baseUrl || 'https://api.groq.com/openai/v1');
          setGroqModelInput(data.groq.model || 'qwen/qwen3.8-27b');
          if (data.groq.hasKey) {
            fetchGroqQuota();
          }
        }
        if (data.geminiStats) {
          setKeysStats(data.geminiStats);
        }
        if (data.openrouterStats) {
          setOpenrouterKeysStats(data.openrouterStats);
        }
        if (data.groqStats) {
          setGroqKeysStats(data.groqStats);
        }
      }
      await fetchOpenRouterKeys();
      await fetchGroqKeys();
    } catch (err) {
      console.error('Erro ao buscar estatísticas de provedores:', err);
    }
  };

  React.useEffect(() => {
    fetchProvidersAndStats();
    fetchOpenRouterKeys();
    fetchGroqKeys();
  }, []);

  React.useEffect(() => {
    if (isKeyManagerOpen) {
      if (selectedProviderTab === 'openrouter') {
        fetchOpenRouterQuota();
      } else if (selectedProviderTab === 'groq') {
        fetchGroqQuota();
      }
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

  // Helper para capturar snapshot visual do Webview
  const captureWebviewSnapshot = async (): Promise<string | undefined> => {
    try {
      const webview = webviewRef.current;
      if (!webview) return undefined;
      if (typeof webview.capturePage === 'function') {
        const nativeImg = await webview.capturePage();
        return nativeImg.toDataURL();
      }
    } catch (e) {
      console.warn('Erro ao capturar snapshot do webview:', e);
    }
    return undefined;
  };

  // Monitorar e anexar listeners do Webview
  React.useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleIpcMessage = async (event: any) => {
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

          const snapshot = await captureWebviewSnapshot();
            
          setRecordedSteps(prev => [...prev, {
            id: stepId,
            type: 'click',
            selector: data.selector,
            xpath: data.xpath,
            tagName: data.tagName,
            text: data.text,
            description: desc,
            screenshot: snapshot,
            timestamp: new Date().toLocaleTimeString('pt-BR')
          }]);
        }
      } else if (channel === 'spy-input') {
        if (isRecording) {
          const stepId = Date.now();
          const snapshot = await captureWebviewSnapshot();
          // Agrupar inputs seguidos no mesmo seletor para evitar redundância
          setRecordedSteps(prev => {
            const last = prev[prev.length - 1];
            if (last && last.type === 'input' && last.selector === data.selector) {
              const updated = [...prev];
              updated[updated.length - 1] = {
                ...last,
                value: data.value,
                description: `Digitar "${data.value}" no campo "${data.name || data.id || 'Sem nome'}"`,
                screenshot: snapshot || last.screenshot
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
              description: `Digitar "${data.value}" no campo "${data.name || data.id || 'Sem nome'}"`,
              screenshot: snapshot,
              timestamp: new Date().toLocaleTimeString('pt-BR')
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

  const handleUnderstandProcessWithAi = async () => {
    if (recordedSteps.length === 0) {
      alert('Grave pelo menos uma ação no navegador antes de analisar o processo com IA.');
      return;
    }
    setIsAnalyzingProcess(true);
    setSyncStatus({ message: 'A IA está analisando seu fluxo e identificando o macro...', type: '' });
    addLog('ai', 'ESPIÃO', `Iniciando análise com IA de ${recordedSteps.length} passos gravados...`);

    try {
      const modelToUse = activeProvider === 'groq' ? groqModelInput : (activeProvider === 'openrouter' ? openrouterModelInput : geminiModel);
      const response = await fetch(getApiUrl('/api/spy/understand-process'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: recordedSteps,
          targetUrl: spyUrl,
          userGoal: userProcessGoalInput,
          provider: activeProvider,
          model: modelToUse
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Erro HTTP ${response.status}`);
      }

      const data = await response.json();
      let cleanText = data.text.trim();
      if (cleanText.startsWith('```json')) cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      else if (cleanText.startsWith('```')) cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');

      const parsed: SpyMacro = JSON.parse(cleanText);
      parsed.id = `macro_${Date.now()}`;
      parsed.targetUrl = spyUrl;
      parsed.updatedAt = new Date().toISOString();

      setActiveMacro(parsed);
      setSpySubTab('macro');
      setSyncStatus({ message: `Processo "${parsed.nome_processo}" sintetizado com sucesso!`, type: 'success' });
      addLog('success', 'ESPIÃO', `Processo "${parsed.nome_processo}" sintetizado com sucesso pela IA (${parsed.variaveis_identificadas?.length || 0} variáveis detectadas)!`);
    } catch (err: any) {
      console.error('Erro na análise de processo:', err);
      setSyncStatus({ message: `Erro ao analisar processo: ${err.message}`, type: 'error' });
      addLog('error', 'ESPIÃO', `Falha ao compreender processo: ${err.message}`);
    } finally {
      setIsAnalyzingProcess(false);
    }
  };

  const handleSaveActiveMacro = async () => {
    if (!activeMacro) return;
    try {
      const response = await fetch(getApiUrl('/api/spy/save-macro'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeMacro)
      });
      if (response.ok) {
        setSyncStatus({ message: 'Macro salvo na biblioteca com sucesso!', type: 'success' });
        addLog('success', 'ESPIÃO', `Macro "${activeMacro.nome_processo}" salvo na biblioteca.`);
        handleLoadMacrosList();
      }
    } catch (err: any) {
      setSyncStatus({ message: `Erro ao salvar macro: ${err.message}`, type: 'error' });
    }
  };

  const handleLoadMacrosList = async () => {
    setIsLoadingMacros(true);
    try {
      const response = await fetch(getApiUrl('/api/spy/list-macros'));
      if (response.ok) {
        const data = await response.json();
        setSavedMacrosList(data.macros || []);
      }
    } catch (err: any) {
      console.warn('Erro ao carregar macros:', err);
    } finally {
      setIsLoadingMacros(false);
    }
  };

  const handleDeleteMacro = async (macroId: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/spy/delete-macro/${macroId}`), {
        method: 'DELETE'
      });
      if (response.ok) {
        addLog('info', 'ESPIÃO', `Macro excluído da biblioteca.`);
        handleLoadMacrosList();
        if (activeMacro?.id === macroId) setActiveMacro(null);
      }
    } catch (err: any) {
      console.warn('Erro ao excluir macro:', err);
    }
  };

  const handleRenameMacro = async (macroId: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const response = await fetch(getApiUrl(`/api/spy/rename-macro/${macroId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_processo: newName.trim() })
      });
      if (response.ok) {
        addLog('success', 'ESPIÃO', `Macro renomeado para "${newName.trim()}".`);
        handleLoadMacrosList();
        if (activeMacro?.id === macroId) {
          setActiveMacro({ ...activeMacro, nome_processo: newName.trim() });
        }
      }
    } catch (err: any) {
      console.warn('Erro ao renomear macro:', err);
    } finally {
      setRenamingMacroId(null);
      setRenamingMacroName('');
    }
  };

  const handlePullItemsFromPostForge = () => {
    if (carouselResult && carouselResult.slides && carouselResult.slides.length > 0) {
      const items: ExecutorBatchItem[] = carouselResult.slides.map(s => ({
        id: `slide_${s.slideNumber}`,
        label: `Slide ${s.slideNumber}`,
        params: {
          "{prompt_imagem}": s.imagePromptEn || '',
          "{prompt}": s.imagePromptEn || '',
          "{texto_slide}": s.descriptionPt || '',
          "{titulo}": topic || '',
          "{numero_slide}": String(s.slideNumber)
        },
        status: 'pending'
      }));
      setExecutorBatchItems(items);
      setSpySubTab('executor');
      addLog('info', 'EXECUTOR', `${items.length} slides importados do Carrossel para o Executor em Lote.`);
    } else if (result && result.scenes && result.scenes.length > 0) {
      const items: ExecutorBatchItem[] = result.scenes.map(s => ({
        id: `scene_${s.sceneNumber}`,
        label: `Cena ${s.sceneNumber} (${s.duration}s)`,
        params: {
          "{prompt_imagem}": s.videoPromptEn || '',
          "{prompt}": s.videoPromptEn || '',
          "{texto_slide}": s.contextPt || '',
          "{titulo}": topic || '',
          "{numero_slide}": String(s.sceneNumber)
        },
        status: 'pending'
      }));
      setExecutorBatchItems(items);
      setSpySubTab('executor');
      addLog('info', 'EXECUTOR', `${items.length} cenas importadas do Vídeo para o Executor em Lote.`);
    } else {
      alert('Nenhum carrossel ou vídeo foi gerado na sessão atual. Você pode adicionar itens manualmente na tabela.');
    }
  };

  const handleStartBatchExecution = async () => {
    if (!activeMacro || !activeMacro.macro_parametrizado || activeMacro.macro_parametrizado.length === 0) {
      alert('Selecione ou gere um Macro com IA antes de iniciar o executor.');
      setSpySubTab('macro');
      return;
    }
    if (executorBatchItems.length === 0) {
      alert('Adicione pelo menos um item para execução em lote.');
      return;
    }

    setIsExecutorRunning(true);
    setIsExecutorPaused(false);
    addLog('ai', 'EXECUTOR', `Iniciando Execução em Larga Escala: ${executorBatchItems.length} itens no macro "${activeMacro.nome_processo}"...`);

    for (let i = 0; i < executorBatchItems.length; i++) {
      setExecutorCurrentIndex(i);
      const currentItem = executorBatchItems[i];

      setExecutorBatchItems(prev => {
        const next = [...prev];
        next[i] = { ...next[i], status: 'running', log: 'Iniciando execução do item...' };
        return next;
      });

      addLog('info', 'EXECUTOR', `[Item ${i + 1}/${executorBatchItems.length}] Executando: "${currentItem.label || `Item ${i + 1}`}"`);

      try {
        for (let sIdx = 0; sIdx < activeMacro.macro_parametrizado.length; sIdx++) {
          setExecutorCurrentStepIndex(sIdx);
          const step = activeMacro.macro_parametrizado[sIdx];

          // Substituir variáveis dinâmicas no valor do step
          let resolvedValue = step.valor || '';
          if (resolvedValue) {
            Object.entries(currentItem.params).forEach(([varName, varVal]) => {
              resolvedValue = resolvedValue.split(varName).join(varVal);
            });
            if (resolvedValue.includes('{prompt}') && currentItem.params['{prompt_imagem}']) {
              resolvedValue = resolvedValue.split('{prompt}').join(currentItem.params['{prompt_imagem}']);
            }
          }

          const resolvedStep = { ...step, valor: resolvedValue };

          // Disparar ação para o Webview
          if (webviewRef.current) {
            const actionId = `act_${Date.now()}_${sIdx}`;
            webviewRef.current.send('spy-exec-step', { actionId, step: resolvedStep });
          }

          // Aguardar tempo de delay configurado
          const delay = Math.max(step.tempo_espera_ms || 1000, executorDelayBetweenSteps);
          await new Promise(r => setTimeout(r, delay));
        }

        // Capturar screenshot final do item
        const finalScreenshot = await captureWebviewSnapshot();

        setExecutorBatchItems(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'success', log: 'Concluído com sucesso.', screenshot: finalScreenshot };
          return next;
        });

        addLog('success', 'EXECUTOR', `[Item ${i + 1}/${executorBatchItems.length}] Concluído com sucesso!`);

        if (i < executorBatchItems.length - 1) {
          await new Promise(r => setTimeout(r, executorDelayBetweenItems));
        }
      } catch (err: any) {
        setExecutorBatchItems(prev => {
          const next = [...prev];
          next[i] = { ...next[i], status: 'failed', log: `Erro: ${err.message}` };
          return next;
        });
        addLog('error', 'EXECUTOR', `[Item ${i + 1}/${executorBatchItems.length}] Falha: ${err.message}`);
      }
    }

    setIsExecutorRunning(false);
    addLog('success', 'EXECUTOR', 'Execução em lote finalizada!');
  };

  const handleStopBatchExecution = () => {
    setIsExecutorRunning(false);
    addLog('warning', 'EXECUTOR', 'Execução em lote interrompida pelo usuário.');
  };

  const handleAnalyzePage = async () => {
    if (!webviewRef.current) return;
    try {
      setSyncStatus({ message: 'Analisando elementos da página...', type: 'info' });
      const extractionScript = `
        (function() {
          const allElements = Array.from(document.querySelectorAll('button, a, input, textarea, select, [role="button"], [role="link"]'));
          const interactives = [];
          const parsed = new Set();
          
          function getCssSelector(el) {
            if (!(el instanceof Element)) return;
            const path = [];
            while (el.nodeType === Node.ELEMENT_NODE) {
              let selector = el.nodeName.toLowerCase();
              if (el.id) {
                selector += '#' + el.id;
                path.unshift(selector);
                break;
              } else {
                let sibling = el;
                let nth = 1;
                while (sibling = sibling.previousElementSibling) {
                  if (sibling.nodeName.toLowerCase() === selector) nth++;
                }
                selector += ':nth-of-type(' + nth + ')';
              }
              path.unshift(selector);
              el = el.parentElement;
            }
            return path.join(' > ');
          }

          function getXPath(current) {
            const paths = [];
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
              const pathIndex = (index || hasSiblings) ? '[' + (index + 1) + ']' : '';
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

  const handleSelectActiveProvider = async (prov: 'gemini' | 'openrouter' | 'groq') => {
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
    const key = openrouterKeyInput.trim().replace(/^["']+|["']+$/g, '');
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

      const res = await apiFetch('/api/providers/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar configurações.');
      }
      const data = await res.json();
      setActiveProvider(data.activeProvider);
      setOpenrouterConfig(data.openrouter);
      if (data.openrouterStats) {
        setOpenrouterKeysStats(data.openrouterStats);
      }
      setOpenrouterKeyInput('');
      setTestResult({ success: true, message: 'Configurações do OpenRouter salvas com sucesso!' });
      addLog('success', 'OPENROUTER', 'Configurações salvas e pool sincronizado!');
      fetchOpenRouterQuota(key || undefined);
      await fetchOpenRouterKeys();
    } catch (err: any) {
      setKeyManagerError(err.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSavingProviderSettings(false);
    }
  };

  const handleSelectOpenRouterModel = async (modelId: string) => {
    setOpenrouterModelInput(modelId);
    try {
      await apiFetch('/api/providers/settings', {
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
    const key = openrouterKeyInput.trim().replace(/^["']+|["']+$/g, '');
    if (!key) return;
    setIsSavingProviderSettings(true);
    setKeyManagerError(null);
    try {
      const res = await apiFetch('/api/providers/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          openrouter: {
            apiKey: key,
            baseUrl: openrouterBaseUrlInput.trim() || 'https://openrouter.ai/api/v1',
            model: openrouterModelInput.trim() || 'nvidia/nemotron-3-ultra-550b-a55b:free'
          }
        }),
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar chave.');
      }
      const data = await res.json();
      setOpenrouterConfig(data.openrouter);
      if (data.openrouterStats) {
        setOpenrouterKeysStats(data.openrouterStats);
      }
      setOpenrouterKeyInput('');
      setTestResult({ success: true, message: 'Chave do OpenRouter salva com sucesso!' });
      addLog('success', 'OPENROUTER', 'Chave OpenRouter configurada e adicionada ao pool com sucesso!');
      fetchOpenRouterQuota(key);
      await fetchOpenRouterKeys();
    } catch (err: any) {
      setKeyManagerError(err.message || 'Erro ao salvar chave.');
      addLog('error', 'OPENROUTER', `Erro ao salvar chave: ${err.message}`);
    } finally {
      setIsSavingProviderSettings(false);
    }
  };

  const handleSaveGroqSettings = async (makeActive = false) => {
    setIsSavingProviderSettings(true);
    setKeyManagerError(null);
    setTestResult(null);
    const key = groqKeyInput.trim().replace(/^["']+|["']+$/g, '');
    try {
      const payload: any = {
        activeProvider: makeActive ? 'groq' : activeProvider,
        groq: {
          baseUrl: groqBaseUrlInput.trim() || 'https://api.groq.com/openai/v1',
          model: groqModelInput.trim() || 'qwen/qwen3.8-27b',
        }
      };
      if (key) {
        payload.groq.apiKey = key;
      }

      const res = await apiFetch('/api/providers/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar configurações.');
      }
      const data = await res.json();
      setActiveProvider(data.activeProvider);
      setGroqConfig(data.groq);
      if (data.groqStats) {
        setGroqKeysStats(data.groqStats);
      }
      setGroqKeyInput('');
      setTestResult({ success: true, message: 'Configurações do Groq Cloud salvas com sucesso!' });
      addLog('success', 'GROQ', 'Configurações salvas e pool Groq sincronizado!');
      fetchGroqQuota(key || undefined);
      await fetchGroqKeys();
    } catch (err: any) {
      setKeyManagerError(err.message || 'Erro ao salvar configurações.');
    } finally {
      setIsSavingProviderSettings(false);
    }
  };

  const handleSelectGroqModel = async (modelId: string) => {
    setGroqModelInput(modelId);
    try {
      await apiFetch('/api/providers/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groq: { model: modelId }
        })
      });
      setGroqConfig(prev => ({ ...prev, model: modelId }));
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveGroqKeyOnly = async () => {
    const key = groqKeyInput.trim().replace(/^["']+|["']+$/g, '');
    if (!key) return;
    setIsSavingProviderSettings(true);
    setKeyManagerError(null);
    try {
      const res = await apiFetch('/api/providers/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groq: {
            apiKey: key,
            baseUrl: groqBaseUrlInput.trim() || 'https://api.groq.com/openai/v1',
            model: groqModelInput.trim() || 'qwen/qwen3.8-27b'
          }
        }),
        signal: AbortSignal.timeout(30000)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao salvar chave.');
      }
      const data = await res.json();
      setGroqConfig(data.groq);
      if (data.groqStats) {
        setGroqKeysStats(data.groqStats);
      }
      setGroqKeyInput('');
      setTestResult({ success: true, message: 'Chave do Groq Cloud salva com sucesso!' });
      addLog('success', 'GROQ', 'Chave Groq configurada e adicionada ao pool com sucesso!');
      fetchGroqQuota(key);
      await fetchGroqKeys();
    } catch (err: any) {
      setKeyManagerError(err.message || 'Erro ao salvar chave.');
      addLog('error', 'GROQ', `Erro ao salvar chave: ${err.message}`);
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

  const handleTestProvider = async (prov: 'gemini' | 'openrouter' | 'groq') => {
    setIsTestingProvider(true);
    setTestResult(null);
    setKeyManagerError(null);
    addLog('info', 'TESTE', `Iniciando teste de conexão com o provedor ${prov.toUpperCase()}...`);
    try {
      if (prov === 'openrouter') {
        // Para OpenRouter, testar TODAS as chaves do pool individualmente
        const poolKeys = openrouterKeysStats?.keysList || [];
        if (poolKeys.length === 0) {
          throw new Error('Nenhuma chave OpenRouter cadastrada no pool. Adicione pelo menos uma chave (sk-or-v1-...) antes de testar.');
        }

        addLog('info', 'TESTE', `Verificando ${poolKeys.length} chave(s) OpenRouter no pool...`);
        const res = await apiFetch('/api/openrouter-keys/verify-all', {
          method: 'POST',
          signal: AbortSignal.timeout(60000)
        });
        const text = await res.text();
        let data: any = null;
        try { data = JSON.parse(text); } catch {}

        if (!res.ok) {
          throw new Error(data?.error || `Erro HTTP ${res.status} ao verificar chaves.`);
        }

        // Atualizar relatório e stats
        setOpenrouterVerificationReport({
          verifiedAt: data.verifiedAt,
          total: data.total,
          free: data.free,
          exhausted: data.exhausted
        });
        await fetchOpenRouterKeys();

        if (data.free > 0) {
          const details = (data.results || [])
            .map((r: any) => `${r.label || r.keyMasked}: ${r.status === 'free' ? '✅' : '❌'} ${r.message}`)
            .join('\n');
          setTestResult({
            success: true,
            message: `${data.free}/${data.total} chave(s) OpenRouter ativa(s) e prontas para uso!\n${details}`
          });
          addLog('success', 'TESTE', `Conexão OpenRouter validada: ${data.free}/${data.total} chaves ativas.`);
        } else {
          const details = (data.results || [])
            .map((r: any) => `${r.label || r.keyMasked}: ${r.message}`)
            .join(' | ');
          throw new Error(`Nenhuma das ${data.total} chave(s) OpenRouter está ativa. Detalhes: ${details}`);
        }
      } else if (prov === 'groq') {
        // Para Groq, testar TODAS as chaves do pool individualmente
        const poolKeys = groqKeysStats?.keysList || [];
        if (poolKeys.length === 0) {
          throw new Error('Nenhuma chave Groq cadastrada no pool. Adicione pelo menos uma chave (gsk_...) antes de testar.');
        }

        addLog('info', 'TESTE', `Verificando ${poolKeys.length} chave(s) Groq no pool...`);
        const res = await apiFetch('/api/groq-keys/verify-all', {
          method: 'POST',
          signal: AbortSignal.timeout(60000)
        });
        const text = await res.text();
        let data: any = null;
        try { data = JSON.parse(text); } catch {}

        if (!res.ok) {
          throw new Error(data?.error || `Erro HTTP ${res.status} ao verificar chaves Groq.`);
        }

        // Atualizar relatório e stats
        setGroqVerificationReport({
          verifiedAt: data.verifiedAt,
          total: data.total,
          free: data.free,
          exhausted: data.exhausted
        });
        await fetchGroqKeys();

        if (data.free > 0) {
          const details = (data.results || [])
            .map((r: any) => `${r.label || r.keyMasked}: ${r.status === 'free' ? '✅' : '❌'} ${r.message}`)
            .join('\n');
          setTestResult({
            success: true,
            message: `${data.free}/${data.total} chave(s) Groq ativa(s) e com cota disponível!\n${details}`
          });
          addLog('success', 'TESTE', `Conexão Groq validada: ${data.free}/${data.total} chaves ativas.`);
        } else {
          const details = (data.results || [])
            .map((r: any) => `${r.label || r.keyMasked}: ${r.message}`)
            .join(' | ');
          throw new Error(`Nenhuma das ${data.total} chave(s) Groq está ativa. Detalhes: ${details}`);
        }
      } else {
        // Teste Gemini (inalterado)
        const body: any = { provider: prov, model: geminiModel };
        const res = await apiFetch('/api/providers/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000)
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || `Falha no teste de conexão (Status HTTP ${res.status}).`);
        }
        setTestResult({ success: true, message: data.message });
        addLog('success', 'TESTE', `Conexão com ${prov.toUpperCase()} validada com sucesso!`);
      }
    } catch (err: any) {
      const errorMsg = err.name === 'TimeoutError'
        ? 'Tempo limite esgotado ao testar conexão (60s).'
        : (err.message || 'Erro no teste de conexão.');
      setTestResult({ success: false, message: errorMsg });
      addLog('error', 'TESTE', `Falha no teste do ${prov.toUpperCase()}: ${errorMsg}`);
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
  const handleAuditImagesSelect = async (files: FileList | File[]) => {
    setAuditError(null);
    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name));
    if (fileArray.length === 0) return;

    addLog('image', 'AUDITORIA', `Processando ${fileArray.length} imagem(ns) para auditoria...`);

    for (const file of fileArray) {
      try {
        const opt = await optimizeImageForAi(file, 1024, 0.85);
        const newItem: AuditImageItem = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: opt.size,
          mimeType: opt.mimeType,
          dataUrl: opt.dataUrl,
          base64: opt.base64
        };
        setUploadedAuditImages(prev => {
          const exists = prev.some(p => p.name === file.name);
          return exists ? prev : [...prev, newItem];
        });
        addLog('image', 'AUDITORIA', `Imagem "${file.name}" otimizada: ${Math.round(file.size / 1024)} KB -> ${Math.round(opt.size / 1024)} KB (Canvas 1024px JPEG).`);
      } catch (err: any) {
        console.warn('Erro ao otimizar imagem de auditoria:', err);
        addLog('warning', 'AUDITORIA', `Aviso na otimização de "${file.name}": ${err.message}`);
      }
    }
  };

  const handleRemoveAuditImage = (id: string) => {
    const item = uploadedAuditImages.find(i => i.id === id);
    setUploadedAuditImages(prev => prev.filter(i => i.id !== id));
    if (item) addLog('info', 'AUDITORIA', `Imagem "${item.name}" removida.`);
  };

  const handleClearAllAuditImages = () => {
    setUploadedAuditImages([]);
    setAuditResult(null);
    setAuditError(null);
    addLog('info', 'AUDITORIA', 'Todas as imagens de auditoria foram limpas.');
  };

  // Funções de Imagens de Referência do Personagem / Estilo
  const handleAuditReferenceImagesSelect = async (files: FileList | File[]) => {
    setAuditError(null);
    const fileArray = Array.from(files).filter(file => file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name));
    if (fileArray.length === 0) return;

    addLog('image', 'AUDITORIA', `Processando ${fileArray.length} imagem(ns) de referência do personagem...`);

    for (const file of fileArray) {
      try {
        const opt = await optimizeImageForAi(file, 1024, 0.85);
        const newItem: AuditImageItem = {
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          size: opt.size,
          mimeType: opt.mimeType,
          dataUrl: opt.dataUrl,
          base64: opt.base64
        };
        setAuditReferenceImages(prev => {
          const exists = prev.some(p => p.name === file.name);
          return exists ? prev : [...prev, newItem];
        });
        addLog('image', 'AUDITORIA', `Referência de personagem "${file.name}" carregada (${Math.round(opt.size / 1024)} KB).`);
      } catch (err: any) {
        console.warn('Erro ao otimizar imagem de referência:', err);
        addLog('warning', 'AUDITORIA', `Aviso ao carregar referência "${file.name}": ${err.message}`);
      }
    }
  };

  const handleRemoveAuditReferenceImage = (id: string) => {
    setAuditReferenceImages(prev => prev.filter(item => item.id !== id));
  };

  const handleClearAllAuditReferenceImages = () => {
    setAuditReferenceImages([]);
    addLog('info', 'AUDITORIA', 'Imagens de referência do personagem limpas.');
  };

  const handlePullReferenceCharactersFromSession = () => {
    const validExisting = characterImages.filter((img): img is { data: string; mimeType: string } => !!img && !!img.data);
    if (validExisting.length === 0) {
      setAuditError('Nenhuma imagem de personagem encontrada no Gerador. Carregue imagens de personagem na aba Vídeo/Carrossel ou adicione diretamente aqui.');
      addLog('warning', 'AUDITORIA', 'Nenhum personagem de referência encontrado no Gerador para importar.');
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
    addLog('success', 'AUDITORIA', `${validExisting.length} imagem(ns) de personagem importada(s) do Gerador para a Auditoria.`);
  };

  const handleAuditDocumentUpload = async (file: File) => {
    if (!file) return;
    setAuditError(null);
    setIsExtractingDoc(true);
    addLog('doc', 'DOCUMENTO', `Carregando arquivo de roteiro "${file.name}" (${Math.round(file.size / 1024)} KB)...`);

    const safetyTimeout = setTimeout(() => {
      setIsExtractingDoc(false);
    }, 25000);

    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      
      // Para arquivos de texto direto (.txt, .md, .json, .csv, .srt, .vtt, .log, .text, .rtf)
      if (['txt', 'md', 'json', 'csv', 'srt', 'vtt', 'log', 'text', 'rtf'].includes(ext) || file.type.startsWith('text/')) {
        const text = await file.text();
        const clean = text.trim();
        if (!clean) {
          throw new Error('O arquivo de texto selecionado está vazio.');
        }
        const words = clean.split(/\s+/).filter(Boolean).length;
        setAuditScriptInput(clean);
        setAuditDocumentInfo({
          filename: file.name,
          size: file.size,
          wordCount: words
        });
        addLog('success', 'DOCUMENTO', `Arquivo de texto "${file.name}" lido instantaneamente (${words} palavras).`);
      } else {
        // Para PDF, Word (.docx, .doc), etc. enviamos para o backend de extração
        addLog('doc', 'DOCUMENTO', `Enviando "${file.name}" para extração via PDFParse/Mammoth no backend...`);
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
          addLog('success', 'DOCUMENTO', `Texto extraído com sucesso de "${file.name}": ${data.wordCount || 0} palavras.`);
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
      addLog('error', 'DOCUMENTO', `Falha ao processar "${file.name}": ${err.message}`);
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

    if (batchCarouselResults && batchCarouselResults.length > 1) {
      let scriptText = '';
      batchCarouselResults.forEach((car, cIdx) => {
        const cTitle = car.title || car.theme || `Carrossel ${cIdx + 1}`;
        scriptText += `=== PROJETO ${cIdx + 1}: ${cTitle.toUpperCase()} ===\n`;
        if (car.instagramPost) {
          scriptText += `Contexto/Legenda: ${car.instagramPost.substring(0, 140)}...\n\n`;
        }
        car.slides?.forEach((s) => {
          const bubbleText = s.textInBubblesPt || s.textInBubblesEn || s.textInBubblesEs || s.textInBubbles || '';
          scriptText += `[SLIDE ${s.slideNumber}]\n`;
          scriptText += `• Descrição da Cena: ${s.descriptionPt}\n`;
          scriptText += `• Prompt Visual de Geração (Midjourney / DALL-E): ${s.imagePromptEn}\n`;
          if (bubbleText) scriptText += `• Texto no Balão: "${bubbleText}"\n`;
          scriptText += `\n`;
        });
        scriptText += `----------------------------------------------------\n\n`;
      });
      setAuditScriptInput(scriptText.trim());
      
      const charNotes = [
        artStyle ? `Estilo Visual: ${artStyle}` : '',
        carouselTone ? `Tom Narrativo: ${carouselTone}` : '',
        characterDescription ? `Personagens: ${characterDescription}` : 'Personagens principais com consistência de traço, iluminação e cores'
      ].filter(Boolean).join('\n');
      
      setAuditCharacterNotes(charNotes);
      addLog('info', 'AUDITORIA', `${batchCarouselResults.length} roteiros de carrossel puxados e organizados por projeto.`);
    } else if (carouselResult && carouselResult.slides && carouselResult.slides.length > 0) {
      let scriptText = `=== ROTEIRO / STORYBOARD ESTRUTURADO (${carouselResult.slides.length} SLIDES): ${carouselResult.title || topic || 'Carrossel Sem Título'} ===\n\n`;
      carouselResult.slides.forEach((s) => {
        const bubbleText = s.textInBubblesPt || s.textInBubblesEn || s.textInBubblesEs || s.textInBubbles || '';
        scriptText += `[SLIDE ${s.slideNumber}]\n`;
        scriptText += `• Descrição da Cena: ${s.descriptionPt}\n`;
        scriptText += `• Prompt Visual de Geração (Midjourney / DALL-E): ${s.imagePromptEn}\n`;
        if (bubbleText) scriptText += `• Texto no Balão: "${bubbleText}"\n`;
        scriptText += `\n`;
      });
      setAuditScriptInput(scriptText.trim());
      
      const charNotes = [
        artStyle ? `Estilo Visual: ${artStyle}` : '',
        carouselTone ? `Tom Narrativo: ${carouselTone}` : '',
        characterDescription ? `Personagens: ${characterDescription}` : 'Personagens principais com consistência de traço, iluminação e cores'
      ].filter(Boolean).join('\n');
      
      setAuditCharacterNotes(charNotes);
      addLog('info', 'AUDITORIA', `Roteiro de ${carouselResult.slides.length} slides puxado do Carrossel com prompts visuais completos.`);
    } else if (result && result.scenes && result.scenes.length > 0) {
      let scriptText = `=== ROTEIRO / STORYBOARD ESTRUTURADO (${result.scenes.length} CENAS): ${topic || 'Vídeo Sem Título'} ===\n\n`;
      if (result.nanoBananaImagePrompt) {
        scriptText += `[CAPA DO VÍDEO]\n• Prompt Visual: ${result.nanoBananaImagePrompt}\n\n`;
      }
      result.scenes.forEach((s) => {
        const dialogueText = s.dialoguePt || s.dialogueEn || s.dialogueEs || s.dialogue || '';
        scriptText += `[CENA / SLIDE ${s.sceneNumber}] (${s.duration}s)\n`;
        scriptText += `• Contexto da Cena: ${s.contextPt}\n`;
        scriptText += `• Prompt Visual de Geração: ${s.videoPromptEn}\n`;
        if (dialogueText) scriptText += `• Diálogo / Narração: "${dialogueText}"\n`;
        scriptText += `\n`;
      });
      setAuditScriptInput(scriptText.trim());

      const charNotes = [
        animationStyle ? `Estilo de Animação: ${animationStyle}` : '',
        scriptTone ? `Tom da Narrativa: ${scriptTone}` : '',
        characterDescription ? `Personagens: ${characterDescription}` : 'Continuidade de figurino, traço e paleta de iluminação cinematográfica'
      ].filter(Boolean).join('\n');

      setAuditCharacterNotes(charNotes);
      addLog('info', 'AUDITORIA', `Roteiro de ${result.scenes.length} cenas puxado do Vídeo com prompts visuais completos.`);
    } else {
      setAuditError('Nenhum roteiro ou carrossel gerado foi encontrado na sessão. Gere um na aba Vídeo/Carrossel ou carregue um arquivo .PDF / .DOC / .TXT diretamente.');
    }
  };

  const handleSelectCarouselIndex = (index: number) => {
    if (batchCarouselResults[index]) {
      setActiveCarouselIndex(index);
      setCarouselResult(batchCarouselResults[index]);
    }
  };

  const handleSendAllCarouselsToAudit = () => {
    handlePullScriptFromGeneration();
    setActiveTab('audit');
    addLog('info', 'AUDITORIA', 'Todos os roteiros foram enviados para a Auditoria Visual! Agora faça o upload das imagens para separação e download.');
  };

  const handleRunAudit = async () => {
    if (uploadedAuditImages.length === 0) {
      setAuditError('Por favor, faça o upload de pelo menos 1 imagem para auditoria.');
      addLog('warning', 'AUDITORIA', 'Tentativa de auditoria sem imagens.');
      return;
    }
    if (!auditScriptInput.trim()) {
      setAuditError('Por favor, informe ou puxe o roteiro dos slides para ordenar as imagens.');
      addLog('warning', 'AUDITORIA', 'Tentativa de auditoria sem texto de roteiro.');
      return;
    }

    setIsAuditing(true);
    setAuditError(null);
    setAuditResult(null);

    const modelToUse = activeProvider === 'openrouter' ? openrouterModelInput : geminiModel;
    addLog('ai', 'AUDITORIA', `Iniciando Auditoria Visual com IA: ${uploadedAuditImages.length} imagens geradas + ${auditReferenceImages.length} refs de personagem via ${activeProvider.toUpperCase()} (${modelToUse})...`);

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
        scriptsText: auditScriptInput,
        characterNotes: auditCharacterNotes,
        provider: activeProvider,
        model: modelToUse
      };

      const response = await fetch(getApiUrl('/api/audit-multi-projects'), {
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
        addLog('warning', 'FAILOVER', `Failover ativado na auditoria: alternado de ${data.originalProvider} para ${data.provider} (${data.failoverReason})`);
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

      const parsed: MultiProjectAuditResponse = JSON.parse(cleanText);
      setMultiProjectsResult(parsed);
      setActiveMultiProjectIndex(0);

      const firstProj = parsed.projetos?.[0];
      if (firstProj) {
        setOrderedSlidesList(firstProj.slides_ordenados || []);
        setSurplusImagesList(firstProj.imagens_sobressalentes || []);
        setAuditResult({
          resumo_geral_consistencia: parsed.resumo_geral_auditoria || firstProj.resumo_narrativo,
          pontuacao_media_geral: firstProj.pontuacao_media,
          auditoria_imagens: firstProj.slides_ordenados || [],
          imagens_sobressalentes: firstProj.imagens_sobressalentes || []
        });
      }

      setDownloadSuccessInfo(null);
      setIsPreviewModalOpen(true); // Abre o preview automaticamente após organizar as imagens
      addLog('success', 'AUDITORIA', `Auditoria Multi-Projetos concluída! ${parsed.projetos?.length || 0} projeto(s) identificado(s) e separado(s) com sucesso.`);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog('warning', 'AUDITORIA', 'Auditoria cancelada pelo usuário.');
        return;
      }
      console.error('Erro na auditoria de imagens:', err);
      setAuditError(err.message || 'Ocorreu um erro ao processar a auditoria de imagens.');
      addLog('error', 'AUDITORIA', `Falha na auditoria visual: ${err.message}`);
    } finally {
      setIsAuditing(false);
      abortControllerRef.current = null;
    }
  };

  const handleSelectMultiProject = (index: number) => {
    if (!multiProjectsResult?.projetos || !multiProjectsResult.projetos[index]) return;
    const proj = multiProjectsResult.projetos[index];
    setActiveMultiProjectIndex(index);
    setOrderedSlidesList(proj.slides_ordenados || []);
    setSurplusImagesList(proj.imagens_sobressalentes || []);
    setAuditResult({
      resumo_geral_consistencia: proj.resumo_narrativo || multiProjectsResult.resumo_geral_auditoria,
      pontuacao_media_geral: proj.pontuacao_media,
      auditoria_imagens: proj.slides_ordenados || [],
      imagens_sobressalentes: proj.imagens_sobressalentes || []
    });
    addLog('info', 'AUDITORIA', `Projeto ativo alterado para: "${proj.titulo_projeto}" (${proj.slides_ordenados?.length || 0} slides).`);
  };

  const handleMoveSlideUp = (index: number) => {
    if (index <= 0) return;
    setOrderedSlidesList(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = { ...next[index], slide_numero: index };
      next[index] = { ...temp, slide_numero: index + 1 };
      return next;
    });
    addLog('info', 'AUDITORIA', `Slide ${index + 1} movido para a posição ${index}.`);
  };

  const handleMoveSlideDown = (index: number) => {
    if (index >= orderedSlidesList.length - 1) return;
    setOrderedSlidesList(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = { ...next[index], slide_numero: index + 2 };
      next[index] = { ...temp, slide_numero: index + 1 };
      return next;
    });
    addLog('info', 'AUDITORIA', `Slide ${index + 1} movido para a posição ${index + 2}.`);
  };

  const handleRemoveSlideToSurplus = (index: number) => {
    const item = orderedSlidesList[index];
    if (!item) return;
    setOrderedSlidesList(prev => {
      const updated = prev.filter((_, i) => i !== index);
      return updated.map((s, idx) => ({ ...s, slide_numero: idx + 1 }));
    });
    setSurplusImagesList(prev => [
      ...prev,
      { nome_arquivo: item.imagem_arquivo_correspondente, motivo_descarte: 'Descartado manualmente da sequência pelo usuário' }
    ]);
    addLog('warning', 'AUDITORIA', `Imagem "${item.imagem_arquivo_correspondente}" movida para sobressalentes.`);
  };

  const handlePromoteSurplusToSlide = (surplus: AuditSurplusImage) => {
    setSurplusImagesList(prev => prev.filter(s => s.nome_arquivo !== surplus.nome_arquivo));
    setOrderedSlidesList(prev => [
      ...prev,
      {
        slide_numero: prev.length + 1,
        descricao_esperada: 'Slide adicionado manualmente pelo usuário',
        imagem_arquivo_correspondente: surplus.nome_arquivo,
        pontuacao_consistencia: '100%',
        feedback_visual: 'Imagem promovida manualmente para a sequência de slides.'
      }
    ]);
    addLog('success', 'AUDITORIA', `Imagem sobressalente "${surplus.nome_arquivo}" adicionada como Slide ${orderedSlidesList.length + 1}.`);
  };

  const handleSwapSlideImage = (slideIndex: number, newImageName: string) => {
    const currentSlide = orderedSlidesList[slideIndex];
    if (!currentSlide || currentSlide.imagem_arquivo_correspondente === newImageName) return;

    const oldImageName = currentSlide.imagem_arquivo_correspondente;

    setOrderedSlidesList(prev => {
      const next = [...prev];
      next[slideIndex] = {
        ...next[slideIndex],
        imagem_arquivo_correspondente: newImageName,
        feedback_visual: `Imagem associada manualmente pelo usuário: "${newImageName}".`
      };
      return next;
    });

    // Se a nova imagem estava em sobressalentes, removemos de sobressalentes e colocamos a antiga
    setSurplusImagesList(prev => {
      const filtered = prev.filter(s => s.nome_arquivo !== newImageName);
      if (oldImageName && !filtered.some(s => s.nome_arquivo === oldImageName)) {
        return [...filtered, { nome_arquivo: oldImageName, motivo_descarte: `Substituída manualmente no Slide ${slideIndex + 1}` }];
      }
      return filtered;
    });

    addLog('info', 'AUDITORIA', `Slide ${slideIndex + 1} alterado manualmente para a imagem "${newImageName}".`);
  };

  const handleOpenFolder = async (targetPath?: string | null) => {
    try {
      const res = await fetch(getApiUrl('/api/open-folder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPath: targetPath || undefined })
      });
      if (res.ok) {
        addLog('info', 'SISTEMA', `Pasta aberta no gerenciador de arquivos.`);
      }
    } catch (err: any) {
      console.warn('Erro ao abrir pasta:', err);
    }
  };

  // Gerar e Baixar .ZIP de um projeto específico
  const handleDownloadSingleProjectZip = async (project?: AuditMultiProjectItem) => {
    const targetProject = project || (multiProjectsResult?.projetos ? multiProjectsResult.projetos[activeMultiProjectIndex] : null);
    const currentSlides = targetProject?.slides_ordenados || (orderedSlidesList.length > 0 ? orderedSlidesList : auditResult?.auditoria_imagens);
    
    if (!currentSlides || currentSlides.length === 0) {
      alert('Nenhuma imagem ordenada encontrada para download.');
      return;
    }

    setIsGeneratingZip(true);
    setDownloadSuccessInfo(null);
    
    const projSlug = targetProject?.nome_arquivo_zip_sugerido || targetProject?.titulo_projeto?.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Sequenciais';
    const cleanSlug = projSlug.replace(/^PostForge_/i, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    const zipName = `PostForge_${cleanSlug}.zip`;

    addLog('info', 'EXPORTAÇÃO', `Gerando arquivo "${zipName}" com ${currentSlides.length} slides...`);

    try {
      const zip = new JSZip();
      const imagesFolder = zip.folder("imagens_ordenadas");

      // 1. Adicionar imagens ordenadas
      currentSlides.forEach((item, idx) => {
        const slideNum = item.slide_numero || idx + 1;
        const matched = uploadedAuditImages.find(img => 
          img.name.toLowerCase() === item.imagem_arquivo_correspondente.toLowerCase() ||
          img.name.toLowerCase().includes(item.imagem_arquivo_correspondente.toLowerCase()) ||
          item.imagem_arquivo_correspondente.toLowerCase().includes(img.name.toLowerCase())
        );

        if (matched && imagesFolder) {
          const extension = matched.name.split('.').pop() || 'png';
          const cleanName = matched.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_");
          const sequentialFilename = `Slide_${String(slideNum).padStart(2, '0')}_${cleanName}.${extension}`;
          const cleanBase64 = matched.base64.includes('base64,') ? matched.base64.split('base64,')[1] : matched.base64;
          imagesFolder.file(sequentialFilename, cleanBase64, { base64: true });
        }
      });

      // 2. Mapear sobressalentes
      const currentSurplus = targetProject?.imagens_sobressalentes || (surplusImagesList.length > 0 ? surplusImagesList : auditResult?.imagens_sobressalentes || []);
      if (currentSurplus.length > 0) {
        const surplusFolder = zip.folder("imagens_sobressalentes");
        currentSurplus.forEach((surplus) => {
          const matched = uploadedAuditImages.find(img => 
            img.name.toLowerCase() === surplus.nome_arquivo.toLowerCase()
          );
          if (matched && surplusFolder) {
            const cleanBase64 = matched.base64.includes('base64,') ? matched.base64.split('base64,')[1] : matched.base64;
            surplusFolder.file(matched.name, cleanBase64, { base64: true });
          }
        });
      }

      // 3. Montar Relatório
      let reportText = `====================================================\n`;
      reportText += `POSTFORGE - RELATÓRIO DE AUDITORIA & ORDENAÇÃO: ${targetProject?.titulo_projeto || 'Carrossel'}\n`;
      reportText += `Data: ${new Date().toLocaleString('pt-BR')}\n`;
      reportText += `Pontuação Média de Consistência: ${targetProject?.pontuacao_media || auditResult?.pontuacao_media_geral || 'N/A'}\n`;
      reportText += `====================================================\n\n`;
      reportText += `RESUMO DO PROJETO:\n${targetProject?.resumo_narrativo || auditResult?.resumo_geral_consistencia || 'Sequência ordenada pelo usuário.'}\n\n`;
      reportText += `----------------------------------------------------\n`;
      reportText += `MAPEAMENTO SEQUENCIAL DOS SLIDES:\n`;
      reportText += `----------------------------------------------------\n\n`;

      currentSlides.forEach((item, idx) => {
        const slideNum = item.slide_numero || idx + 1;
        reportText += `[SLIDE ${slideNum}] -> Arquivo: "${item.imagem_arquivo_correspondente}" (Consistência: ${item.pontuacao_consistencia})\n`;
        reportText += `Descrição Esperada: ${item.descricao_esperada}\n`;
        reportText += `Feedback Visual da IA: ${item.feedback_visual}\n`;
        if (item.elementos_visuais_identificados) {
          reportText += `Elementos Identificados: ${item.elementos_visuais_identificados}\n`;
        }
        reportText += `\n`;
      });

      if (currentSurplus.length > 0) {
        reportText += `----------------------------------------------------\n`;
        reportText += `IMAGENS SOBRESSALENTES / NÃO UTILIZADAS:\n`;
        reportText += `----------------------------------------------------\n\n`;
        currentSurplus.forEach((surplus) => {
          reportText += `- Arquivo: "${surplus.nome_arquivo}": ${surplus.motivo_descarte}\n`;
        });
      }

      zip.file("relatorio_auditoria_postforge.txt", reportText);
      if (targetProject?.roteiro_associado || auditScriptInput) {
        zip.file("roteiro_referencia.txt", targetProject?.roteiro_associado || auditScriptInput);
      }

      const zipBlob = await zip.generateAsync({ 
        type: "blob", 
        compression: "STORE"
      });

      saveAs(zipBlob, zipName);

      setDownloadSuccessInfo({
        filename: zipName,
        savedPath: 'Salvo automaticamente na pasta Downloads',
        sizeBytes: zipBlob.size,
        downloadUrl: undefined
      });

      // Gravar em background em Downloads via backend
      try {
        const streamRes = await fetch(getApiUrl(`/api/save-zip-stream?name=${encodeURIComponent(zipName)}`), {
          method: 'POST',
          body: zipBlob
        });
        if (streamRes.ok) {
          const streamData = await streamRes.json();
          if (streamData.savedPath) {
            setDownloadSuccessInfo({
              filename: zipName,
              savedPath: streamData.savedPath,
              sizeBytes: zipBlob.size,
              downloadUrl: streamData.downloadUrl
            });
          }
        }
      } catch (streamErr) {
        console.warn('Gravação em background na pasta Downloads via stream:', streamErr);
      }

      addLog('success', 'EXPORTAÇÃO', `Arquivo ZIP "${zipName}" salvo com sucesso!`);
    } catch (err: any) {
      console.error('Erro ao gerar ZIP:', err);
      alert('Ocorreu um erro ao gerar o arquivo ZIP: ' + err.message);
      addLog('error', 'EXPORTAÇÃO', `Falha ao gerar arquivo ZIP: ${err.message}`);
    } finally {
      setIsGeneratingZip(false);
    }
  };

  // Baixar TODOS os .ZIPs de todos os projetos separados de uma única vez
  const handleDownloadAllProjectsZips = async () => {
    if (!multiProjectsResult?.projetos || multiProjectsResult.projetos.length === 0) {
      handleDownloadSingleProjectZip();
      return;
    }

    setIsDownloadingAllZips(true);
    addLog('info', 'EXPORTAÇÃO', `Iniciando geração em lote de ${multiProjectsResult.projetos.length} arquivos .ZIP separados...`);

    try {
      for (let i = 0; i < multiProjectsResult.projetos.length; i++) {
        const proj = multiProjectsResult.projetos[i];
        await handleDownloadSingleProjectZip(proj);
        // Pequena pausa entre arquivos para não sobrecarregar disparos do navegador
        await new Promise(r => setTimeout(r, 400));
      }
      addLog('success', 'EXPORTAÇÃO', `Todos os ${multiProjectsResult.projetos.length} arquivos .ZIP foram gerados e salvos com seus respectivos nomes na pasta Downloads!`);
    } catch (err: any) {
      console.error('Erro ao baixar todos os ZIPs:', err);
      addLog('error', 'EXPORTAÇÃO', `Erro no download em lote: ${err.message}`);
    } finally {
      setIsDownloadingAllZips(false);
    }
  };

  const handleDownloadOrderedImagesZip = () => {
    handleDownloadSingleProjectZip();
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
      const isEn = result.language === 'en' || (result.scenes[0]?.dialogueEn && !result.scenes[0]?.dialoguePt && !result.scenes[0]?.dialogueEs);
      const isEs = result.language === 'es' || (result.scenes[0]?.dialogueEs && !result.scenes[0]?.dialoguePt && !result.scenes[0]?.dialogueEn);
      const isAll = result.language === 'all' || (result.scenes[0]?.dialoguePt && result.scenes[0]?.dialogueEn && result.scenes[0]?.dialogueEs);

      let content = `--- PROMPT CAPA DO POST (POSTFORGE) ---\n\n`;
      content += `${result.nanoBananaImagePrompt}\n\n`;
      content += `=========================================\n\n`;
      
      result.scenes?.forEach((scene) => {
        content += `CENA ${scene.sceneNumber} (${scene.duration}s)\n`;
        content += `Contexto: ${scene.contextPt}\n\n`;
        content += `[PROMPT DE VÍDEO - INGLÊS]\n`;
        content += `${scene.videoPromptEn}\n\n`;
        content += `--- NARRAÇÃO / DIÁLOGO ---\n`;
        if (isEn) {
          content += `EN: ${scene.dialogueEn || scene.dialogue}\n\n`;
        } else if (isEs) {
          content += `ES: ${scene.dialogueEs || scene.dialogue}\n\n`;
        } else if (isAll) {
          content += `PT: ${scene.dialoguePt}\n`;
          content += `EN: ${scene.dialogueEn}\n`;
          content += `ES: ${scene.dialogueEs}\n\n`;
        } else {
          content += `PT: ${scene.dialoguePt || scene.dialogue}\n\n`;
        }
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
    } else if (activeTab === 'carousel' && (batchCarouselResults.length > 0 || carouselResult)) {
      const listToExport = batchCarouselResults && batchCarouselResults.length > 1 
        ? batchCarouselResults 
        : (carouselResult ? [carouselResult] : []);

      if (listToExport.length > 1) {
        let content = `====================================================\n`;
        content += `   POSTFORGE - LOTE DE ${listToExport.length} CARROSSÉIS ESTRUTURADOS\n`;
        content += `====================================================\n\n`;

        listToExport.forEach((car, cIdx) => {
          const cTitle = car.title || car.theme || `Carrossel ${cIdx + 1}`;
          const isEn = car.language === 'en' || (car.slides?.[0]?.textInBubblesEn && !car.slides?.[0]?.textInBubblesPt && !car.slides?.[0]?.textInBubblesEs);
          const isEs = car.language === 'es' || (car.slides?.[0]?.textInBubblesEs && !car.slides?.[0]?.textInBubblesPt && !car.slides?.[0]?.textInBubblesEn);
          const isAll = car.language === 'all' || (car.slides?.[0]?.textInBubblesPt && car.slides?.[0]?.textInBubblesEn && car.slides?.[0]?.textInBubblesEs);

          content += `####################################################\n`;
          content += `PROJETO ${cIdx + 1}: ${cTitle.toUpperCase()}\n`;
          content += `####################################################\n\n`;

          car.slides?.forEach((slide) => {
            content += `--- SLIDE ${slide.slideNumber} ---\n`;
            content += `Descrição da Cena: ${slide.descriptionPt}\n`;
            if (isEn) {
              content += `Texto no Balão (EN): "${slide.textInBubblesEn || slide.textInBubbles || ''}"\n`;
            } else if (isEs) {
              content += `Texto no Balão (ES): "${slide.textInBubblesEs || slide.textInBubbles || ''}"\n`;
            } else if (isAll) {
              content += `Texto no Balão (PT): "${slide.textInBubblesPt || ''}"\n`;
              content += `Texto no Balão (EN): "${slide.textInBubblesEn || ''}"\n`;
              content += `Texto no Balão (ES): "${slide.textInBubblesEs || ''}"\n`;
            } else {
              content += `Texto no Balão (PT): "${slide.textInBubblesPt || slide.textInBubbles || ''}"\n`;
            }
            content += `[PROMPT MIDJOURNEY / DALL-E]:\n${slide.imagePromptEn || ''}\n\n`;
          });

          content += `--- LEGENDA DO INSTAGRAM ---\n`;
          content += `${car.instagramPost || ''}\n\n\n`;
        });

        const filename = `lote_${listToExport.length}_carrosseis_postforge.txt`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addLog('success', 'DOWNLOAD', `Arquivo TXT (${listToExport.length} carrosséis) exportado com sucesso: ${filename}`);
      } else if (carouselResult) {
        const isEn = carouselResult.language === 'en' || (carouselResult.slides?.[0]?.textInBubblesEn && !carouselResult.slides?.[0]?.textInBubblesPt && !carouselResult.slides?.[0]?.textInBubblesEs);
        const isEs = carouselResult.language === 'es' || (carouselResult.slides?.[0]?.textInBubblesEs && !carouselResult.slides?.[0]?.textInBubblesPt && !carouselResult.slides?.[0]?.textInBubblesEn);
        const isAll = carouselResult.language === 'all' || (carouselResult.slides?.[0]?.textInBubblesPt && carouselResult.slides?.[0]?.textInBubblesEn && carouselResult.slides?.[0]?.textInBubblesEs);

        let content = `--- CARROSSEL INSTAGRAM: ${carouselResult.title || 'POSTFORGE'} ---\n\n`;
        
        carouselResult.slides?.forEach((slide) => {
          content += `SLIDE ${slide.slideNumber}\n`;
          content += `Descrição: ${slide.descriptionPt || ''}\n`;
          if (isEn) {
            content += `Texto nos Balões (EN): ${slide.textInBubblesEn || slide.textInBubbles || ''}\n\n`;
          } else if (isEs) {
            content += `Texto nos Balões (ES): ${slide.textInBubblesEs || slide.textInBubbles || ''}\n\n`;
          } else if (isAll) {
            content += `Texto nos Balões (PT): ${slide.textInBubblesPt || ''}\n`;
            content += `Texto nos Balões (EN): ${slide.textInBubblesEn || ''}\n`;
            content += `Texto nos Balões (ES): ${slide.textInBubblesEs || ''}\n\n`;
          } else {
            content += `Texto nos Balões (PT): ${slide.textInBubblesPt || slide.textInBubbles || ''}\n\n`;
          }
          content += `[PROMPT DE IMAGEM - INGLÊS]\n`;
          content += `${slide.imagePromptEn || ''}\n\n`;
          content += `=========================================\n\n`;
        });

        content += `--- LEGENDA INSTAGRAM ---\n\n`;
        content += carouselResult.instagramPost || '';

        const filename = `carrossel_${(carouselResult.title || 'postforge').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}.txt`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addLog('success', 'DOWNLOAD', `Arquivo TXT exportado com sucesso: ${filename}`);
      }
    }
  };

  const exportAsPDF = () => {
    try {
      const doc = new jsPDF();
      let yPos = 20;
      const margin = 15;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const maxLineWidth = pageWidth - margin * 2;

      const addText = (text: string, fontSize: number, isBold: boolean = false, textColor: [number, number, number] = [0,0,0]) => {
        if (!text) return;
        doc.setFontSize(fontSize);
        doc.setFont("helvetica", isBold ? "bold" : "normal");
        doc.setTextColor(textColor[0], textColor[1], textColor[2]);
        
        const lines = doc.splitTextToSize(String(text), maxLineWidth);
        const lineHeight = fontSize * 0.45 + 1.5;

        for (const line of lines) {
          if (yPos + lineHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(line, margin, yPos);
          yPos += lineHeight;
        }
        yPos += 2;
      };

      if (activeTab === 'script' && result) {
        const isEn = result.language === 'en' || (result.scenes[0]?.dialogueEn && !result.scenes[0]?.dialoguePt && !result.scenes[0]?.dialogueEs);
        const isEs = result.language === 'es' || (result.scenes[0]?.dialogueEs && !result.scenes[0]?.dialoguePt && !result.scenes[0]?.dialogueEn);
        const isAll = result.language === 'all' || (result.scenes[0]?.dialoguePt && result.scenes[0]?.dialogueEn && result.scenes[0]?.dialogueEs);

        addText("ROTEIRO GERADO - POSTFORGE", 18, true, [30, 41, 59]);
        addText(`Nicho: ${niche.toUpperCase()}`, 11, true, [99, 102, 241]);
        yPos += 3;
        
        addText("PROMPT DA IMAGEM DE CAPA", 12, true, [79, 70, 229]);
        addText(result.nanoBananaImagePrompt, 10);
        yPos += 4;

        result.scenes?.forEach((scene) => {
          addText(`CENA ${scene.sceneNumber} (${scene.duration}s)`, 13, true, [15, 23, 42]);
          addText("Contexto:", 10, true, [100, 116, 139]);
          addText(scene.contextPt, 10);
          addText("Prompt de Vídeo (EN):", 10, true, [16, 185, 129]);
          addText(scene.videoPromptEn, 10);
          addText("Falas / Diálogo:", 10, true, [234, 88, 12]);
          if (isEn) {
            addText(`EN: ${scene.dialogueEn || scene.dialogue || ''}`, 10);
          } else if (isEs) {
            addText(`ES: ${scene.dialogueEs || scene.dialogue || ''}`, 10);
          } else if (isAll) {
            addText(`PT: ${scene.dialoguePt || ''}`, 10);
            addText(`EN: ${scene.dialogueEn || ''}`, 10);
            addText(`ES: ${scene.dialogueEs || ''}`, 10);
          } else {
            addText(`PT: ${scene.dialoguePt || scene.dialogue || ''}`, 10);
          }
          yPos += 3;
        });

        addText("LEGENDA DO INSTAGRAM", 13, true, [217, 70, 239]);
        addText(result.instagramPost, 10);
        doc.save("roteiro_postforge.pdf");
        addLog('success', 'DOWNLOAD', 'Arquivo PDF do roteiro exportado com sucesso: roteiro_postforge.pdf');

      } else if (activeTab === 'carousel' && (batchCarouselResults.length > 0 || carouselResult)) {
        const listToExport = batchCarouselResults && batchCarouselResults.length > 1 
          ? batchCarouselResults 
          : (carouselResult ? [carouselResult] : []);

        const isBatch = listToExport.length > 1;

        listToExport.forEach((car, cIdx) => {
          if (cIdx > 0) {
            doc.addPage();
            yPos = margin;
          }

          const cTitle = car.title || car.theme || `Carrossel ${cIdx + 1}`;
          const isEn = car.language === 'en' || (car.slides?.[0]?.textInBubblesEn && !car.slides?.[0]?.textInBubblesPt && !car.slides?.[0]?.textInBubblesEs);
          const isEs = car.language === 'es' || (car.slides?.[0]?.textInBubblesEs && !car.slides?.[0]?.textInBubblesPt && !car.slides?.[0]?.textInBubblesEn);
          const isAll = car.language === 'all' || (car.slides?.[0]?.textInBubblesPt && car.slides?.[0]?.textInBubblesEn && car.slides?.[0]?.textInBubblesEs);

          addText(isBatch ? `CARROSSEL ${cIdx + 1}: ${cTitle.toUpperCase()}` : `CARROSSEL: ${cTitle.toUpperCase()}`, 16, true, [30, 41, 59]);
          addText(`Estilo: ${artStyle.toUpperCase()} | Nicho: ${niche.toUpperCase()}`, 10, true, [99, 102, 241]);
          yPos += 3;

          car.slides?.forEach((slide) => {
            addText(`SLIDE ${slide.slideNumber}`, 12, true, [15, 23, 42]);
            addText("Descrição Visual:", 9, true, [100, 116, 139]);
            addText(slide.descriptionPt || '', 9);
            
            addText("Texto nos Balões:", 9, true, [37, 99, 235]);
            if (isEn) {
              addText(`EN: "${slide.textInBubblesEn || slide.textInBubbles || ''}"`, 9);
            } else if (isEs) {
              addText(`ES: "${slide.textInBubblesEs || slide.textInBubbles || ''}"`, 9);
            } else if (isAll) {
              addText(`PT: "${slide.textInBubblesPt || ''}"`, 9);
              addText(`EN: "${slide.textInBubblesEn || ''}"`, 9);
              addText(`ES: "${slide.textInBubblesEs || ''}"`, 9);
            } else {
              addText(`PT: "${slide.textInBubblesPt || slide.textInBubbles || ''}"`, 9);
            }

            addText("Prompt de Imagem (Midjourney / Dall-E):", 9, true, [5, 150, 105]);
            addText(slide.imagePromptEn || '', 9);
            yPos += 2;
          });

          addText("LEGENDA DO INSTAGRAM", 12, true, [217, 70, 239]);
          addText(car.instagramPost || '', 9);
        });

        const filename = isBatch ? `lote_${listToExport.length}_carrosseis_postforge.pdf` : `carrossel_postforge.pdf`;
        doc.save(filename);
        addLog('success', 'DOWNLOAD', `Arquivo PDF (${listToExport.length} carrosséis) exportado com sucesso: ${filename}`);
      }
    } catch (pdfErr: any) {
      console.error("PDF Export Error:", pdfErr);
      addLog('error', 'DOWNLOAD', `Erro ao gerar PDF: ${pdfErr.message}`);
    }
  };

  const exportAsDOCX = async () => {
    try {
      const children: any[] = [];

      if (activeTab === 'script' && result) {
        const isEn = result.language === 'en' || (result.scenes[0]?.dialogueEn && !result.scenes[0]?.dialoguePt && !result.scenes[0]?.dialogueEs);
        const isEs = result.language === 'es' || (result.scenes[0]?.dialogueEs && !result.scenes[0]?.dialoguePt && !result.scenes[0]?.dialogueEn);
        const isAll = result.language === 'all' || (result.scenes[0]?.dialoguePt && result.scenes[0]?.dialogueEn && result.scenes[0]?.dialogueEs);

        children.push(new Paragraph({ text: "ROTEIRO GERADO - POSTFORGE", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
        children.push(new Paragraph({ text: `Nicho: ${niche.toUpperCase()}`, heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Prompt Imagem de Capa: ", bold: true }), new TextRun({ text: result.nanoBananaImagePrompt || '' })] }));
        
        result.scenes?.forEach((scene) => {
          children.push(new Paragraph({ text: "" }));
          children.push(new Paragraph({ text: `CENA ${scene.sceneNumber} (${scene.duration}s)`, heading: HeadingLevel.HEADING_3 }));
          children.push(new Paragraph({ children: [new TextRun({ text: "Contexto: ", bold: true }), new TextRun({ text: scene.contextPt || '' })] }));
          children.push(new Paragraph({ children: [new TextRun({ text: "Prompt Vídeo: ", bold: true }), new TextRun({ text: scene.videoPromptEn || '' })] }));
          if (isEn) {
            children.push(new Paragraph({ children: [new TextRun({ text: "Narração (EN): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialogueEn || scene.dialogue || '' })] }));
          } else if (isEs) {
            children.push(new Paragraph({ children: [new TextRun({ text: "Narração (ES): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialogueEs || scene.dialogue || '' })] }));
          } else if (isAll) {
            children.push(new Paragraph({ children: [new TextRun({ text: "Narração (PT): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialoguePt || '' })] }));
            children.push(new Paragraph({ children: [new TextRun({ text: "Narração (EN): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialogueEn || '' })] }));
            children.push(new Paragraph({ children: [new TextRun({ text: "Narração (ES): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialogueEs || '' })] }));
          } else {
            children.push(new Paragraph({ children: [new TextRun({ text: "Narração (PT): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialoguePt || scene.dialogue || '' })] }));
          }
        });

        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({ text: "Legenda Instagram", heading: HeadingLevel.HEADING_2 }));
        children.push(new Paragraph({ text: result.instagramPost || '' }));

        const docx = new Document({ sections: [{ children }] });
        const blob = await Packer.toBlob(docx);
        saveAs(blob, "roteiro_gerado.docx");
        addLog('success', 'DOWNLOAD', 'Arquivo Word (.DOCX) exportado com sucesso: roteiro_gerado.docx');

      } else if (activeTab === 'carousel' && (batchCarouselResults.length > 0 || carouselResult)) {
        const listToExport = batchCarouselResults && batchCarouselResults.length > 1 
          ? batchCarouselResults 
          : (carouselResult ? [carouselResult] : []);

        const isBatch = listToExport.length > 1;

        children.push(new Paragraph({ 
          text: isBatch ? `LOTE DE ${listToExport.length} CARROSSÉIS ESTRUTURADOS - POSTFORGE` : "CARROSSEL GERADO - POSTFORGE", 
          heading: HeadingLevel.HEADING_1, 
          alignment: AlignmentType.CENTER 
        }));
        children.push(new Paragraph({ text: `Estilo: ${artStyle.toUpperCase()} | Nicho: ${niche.toUpperCase()}`, heading: HeadingLevel.HEADING_2 }));

        listToExport.forEach((car, cIdx) => {
          const cTitle = car.title || car.theme || `Carrossel ${cIdx + 1}`;
          const isEn = car.language === 'en' || (car.slides?.[0]?.textInBubblesEn && !car.slides?.[0]?.textInBubblesPt && !car.slides?.[0]?.textInBubblesEs);
          const isEs = car.language === 'es' || (car.slides?.[0]?.textInBubblesEs && !car.slides?.[0]?.textInBubblesPt && !car.slides?.[0]?.textInBubblesEn);
          const isAll = car.language === 'all' || (car.slides?.[0]?.textInBubblesPt && car.slides?.[0]?.textInBubblesEn && car.slides?.[0]?.textInBubblesEs);

          children.push(new Paragraph({ text: "" }));
          children.push(new Paragraph({ text: `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, heading: HeadingLevel.HEADING_3 }));
          children.push(new Paragraph({ text: isBatch ? `PROJETO ${cIdx + 1}: ${cTitle.toUpperCase()}` : cTitle.toUpperCase(), heading: HeadingLevel.HEADING_2 }));

          car.slides?.forEach((slide) => {
            children.push(new Paragraph({ text: "" }));
            children.push(new Paragraph({ text: `SLIDE ${slide.slideNumber}`, heading: HeadingLevel.HEADING_3 }));
            children.push(new Paragraph({ children: [new TextRun({ text: "Descrição Visual: ", bold: true }), new TextRun({ text: slide.descriptionPt || '' })] }));
            if (isEn) {
              children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (EN): ", bold: true, color: "2563EB" }), new TextRun({ text: slide.textInBubblesEn || slide.textInBubbles || '' })] }));
            } else if (isEs) {
              children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (ES): ", bold: true, color: "2563EB" }), new TextRun({ text: slide.textInBubblesEs || slide.textInBubbles || '' })] }));
            } else if (isAll) {
              children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (PT): ", bold: true, color: "2563EB" }), new TextRun({ text: slide.textInBubblesPt || '' })] }));
              children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (EN): ", bold: true, color: "2563EB" }), new TextRun({ text: slide.textInBubblesEn || '' })] }));
              children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (ES): ", bold: true, color: "2563EB" }), new TextRun({ text: slide.textInBubblesEs || '' })] }));
            } else {
              children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (PT): ", bold: true, color: "2563EB" }), new TextRun({ text: slide.textInBubblesPt || slide.textInBubbles || '' })] }));
            }
            children.push(new Paragraph({ children: [new TextRun({ text: "Prompt Imagem (Midjourney / Dall-E): ", bold: true, color: "059669" }), new TextRun({ text: slide.imagePromptEn || '' })] }));
          });

          children.push(new Paragraph({ text: "" }));
          children.push(new Paragraph({ text: "Legenda Instagram:", heading: HeadingLevel.HEADING_3 }));
          children.push(new Paragraph({ text: car.instagramPost || '' }));
        });

        const filename = isBatch ? `lote_${listToExport.length}_carrosseis_postforge.docx` : `carrossel_gerado.docx`;
        const docx = new Document({ sections: [{ children }] });
        const blob = await Packer.toBlob(docx);
        saveAs(blob, filename);
        addLog('success', 'DOWNLOAD', `Arquivo Word (.DOCX) exportado com sucesso: ${filename}`);
      }
    } catch (docxErr: any) {
      console.error("DOCX Export Error:", docxErr);
      addLog('error', 'DOWNLOAD', `Erro ao gerar DOCX: ${docxErr.message}`);
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

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files) as File[]) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const allowedExts = ['pdf', 'docx', 'doc', 'txt', 'md', 'json', 'csv', 'text'];
      
      if (!allowedExts.includes(ext) && file.type !== 'application/pdf' && !file.type.startsWith('text/')) {
        setError(`Formato do arquivo "${file.name}" não suportado. Use PDF, DOC, DOCX ou TXT.`);
        continue;
      }

      if (file.size > 30 * 1024 * 1024) {
        setError(`O arquivo "${file.name}" ultrapassa o limite de 30MB.`);
        continue;
      }

      // Se for arquivo de texto direto (.txt, .md, .json, .csv)
      if (['txt', 'md', 'json', 'csv', 'text'].includes(ext) || file.type.startsWith('text/')) {
        try {
          const text = await file.text();
          const mimeType = 'text/plain';
          setReferencePdfs(prev => [...prev, {
            name: file.name,
            data: Buffer.from(text).toString('base64'),
            mimeType,
            size: file.size,
            text: text.trim(),
            docType: 'txt'
          }]);
        } catch (err: any) {
          setError(`Erro ao ler arquivo de texto "${file.name}": ${err.message}`);
        }
      } else {
        // PDF ou Word (.docx / .doc)
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target?.result as string;
          const [header, base64] = dataUrl.split(',');
          const mimeType = ext === 'pdf' || file.type === 'application/pdf' ? 'application/pdf' : file.type || 'application/octet-stream';
          
          let extractedText: string | undefined;
          if (ext === 'docx' || ext === 'doc' || ext === 'pdf') {
            try {
              const res = await fetch(getApiUrl('/api/extract-document-text'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ data: base64, filename: file.name, mimeType })
              });
              if (res.ok) {
                const data = await res.json();
                if (data.text) extractedText = data.text;
              }
            } catch {}
          }

          setReferencePdfs(prev => [...prev, { 
            name: file.name, 
            data: base64, 
            mimeType, 
            size: file.size,
            text: extractedText,
            docType: ext === 'pdf' ? 'pdf' : ext.includes('doc') ? 'docx' : 'txt'
          }]);
        };
        reader.readAsDataURL(file);
      }
    }
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
      addLog('ai', 'ANÁLISE', `Enviando vídeo (${videoFile.mimeType}) para análise da IA...`);
      const response = await fetch(getApiUrl('/api/analyze'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: "Analise este vídeo e crie uma sinopse cativante para uma postagem no Instagram. Inclua gancho inicial, corpo do texto e hashtags relevantes.",
          videoData: videoFile.data,
          mimeType: videoFile.mimeType,
          provider: activeProvider,
          model: activeProvider === 'groq' ? groqModelInput : (activeProvider === 'openrouter' ? openrouterModelInput : geminiModel)
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Erro ao analisar vídeo.');
      }

      const data = await response.json();
      if (!data.text) throw new Error('Sem resposta da análise.');
      setAnalysisResult(data.text);
      addLog('success', 'ANÁLISE', 'Análise de vídeo concluída com sucesso!');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog('warning', 'ANÁLISE', 'Análise cancelada pelo usuário.');
        return;
      }
      console.error(err);
      setError(err.message || 'Erro ao analisar vídeo.');
      addLog('error', 'ANÁLISE', `Falha na análise: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
      abortControllerRef.current = null;
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() && contextImages.length === 0 && referencePdfs.length === 0) {
      setError('Por favor, insira o tema da história ou anexe PDFs/imagens de referência.');
      addLog('warning', 'GERADOR', 'Tentativa de geração sem tema nem referências.');
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

    const modelName = activeProvider === 'groq' ? groqModelInput : (activeProvider === 'openrouter' ? openrouterModelInput : geminiModel);
    addLog('ai', 'GERADOR', `Iniciando geração de ${activeTab === 'script' ? 'Roteiro de Vídeo' : 'Carrossel'} (Nicho: ${niche}, Idioma: ${dialogueLanguage.toUpperCase()}) via ${activeProvider.toUpperCase()} (${modelName})...`);

    const genStartTime = Date.now();
    let timerInterval: any = null;

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

        const selectedLangInfo = LANGUAGES.find(l => l.id === dialogueLanguage) || LANGUAGES[0];
        const langName = selectedLangInfo.name;

        promptText += `\nREGRA OBRIGATÓRIA DE IDIOMA PARA AS FALAS/NARRAÇÃO:
        O usuário selecionou o idioma: "${langName}".
        ${dialogueLanguage === 'pt' ? 'Gere todas as falas/narração estritamente em PORTUGUÊS (Brasil) no campo "dialoguePt".' : ''}
        ${dialogueLanguage === 'en' ? 'Gere todas as falas/narração estritamente em INGLÊS (English) no campo "dialogueEn".' : ''}
        ${dialogueLanguage === 'es' ? 'Gere todas as falas/narração estritamente em ESPANHOL (Español) no campo "dialogueEs".' : ''}
        ${dialogueLanguage === 'all' ? 'Gere as falas/narração nos 3 idiomas: Português ("dialoguePt"), Inglês ("dialogueEn") e Espanhol ("dialogueEs").' : ''}\n\n`;

        promptText += `Para cada cena, forneça:
        1. Um "contextPt" narrando um breve contexto/observação explicando o que acontece na cena (em Português).
        2. Um Prompt de Geração de Vídeo ALTAMENTE DESCRITIVO (Estritamente em Inglês), detalhando a ação, cenário e visual.
        3. Narração ou Diálogo para a cena ${dialogueLanguage === 'pt' ? 'estritamente em Português ("dialoguePt")' : dialogueLanguage === 'en' ? 'estritamente em Inglês ("dialogueEn")' : dialogueLanguage === 'es' ? 'estritamente em Espanhol ("dialogueEs")' : 'em PT ("dialoguePt"), EN ("dialogueEn") e ES ("dialogueEs")'}.
        4. Um campo booleano "isVoiceOver".`;

        const requiredSceneFields = ["sceneNumber", "duration", "contextPt", "videoPromptEn", "isVoiceOver"];
        if (dialogueLanguage === 'pt') requiredSceneFields.push("dialoguePt");
        else if (dialogueLanguage === 'en') requiredSceneFields.push("dialogueEn");
        else if (dialogueLanguage === 'es') requiredSceneFields.push("dialogueEs");
        else requiredSceneFields.push("dialoguePt", "dialogueEn", "dialogueEs");

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
                  dialogue: { type: Type.STRING },
                  isVoiceOver: { type: Type.BOOLEAN },
                },
                required: requiredSceneFields,
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
           - O estilo de desenho deve ser idêntico em cada slide.
        REGRA SOBRE NOMES NOS DIÁLOGOS:
        - Os textos dos balões de fala (textInBubblesPt/En/Es) NUNCA devem conter o nome do personagem como prefixo (ex: NÃO faça "Coração: Você precisa..." ou "Cérebro: Pense bem...").
        - O balão deve conter APENAS a frase dita, sem identificação de quem fala (ex: "Você precisa se permitir sentir.").
        - A identificação de qual personagem está falando deve ir APENAS no campo "descriptionPt", que descreve a cena (ex: "O Coração, com expressão acolhedora, diz ao Cérebro...").
        - Isso é OBRIGATÓRIO porque o nome do personagem ficará visualmente indicado na própria imagem, e repetir no balão polui a experiência.`;

        const selectedLangInfoCarousel = LANGUAGES.find(l => l.id === dialogueLanguage) || LANGUAGES[0];
        const langNameCarousel = selectedLangInfoCarousel.name;

        promptText += `\nREGRA OBRIGATÓRIA DE IDIOMA PARA OS BALÕES DE DIÁLOGO:
        O usuário selecionou o idioma: "${langNameCarousel}".
        ${dialogueLanguage === 'pt' ? 'Gere todos os textos dos balões estritamente em PORTUGUÊS (Brasil) no campo "textInBubblesPt".' : ''}
        ${dialogueLanguage === 'en' ? 'Gere todos os textos dos balões estritamente em INGLÊS (English) no campo "textInBubblesEn".' : ''}
        ${dialogueLanguage === 'es' ? 'Gere todos os textos dos balões estritamente em ESPANHOL (Español) no campo "textInBubblesEs".' : ''}
        ${dialogueLanguage === 'all' ? 'Gere os textos dos balões nos 3 idiomas: Português ("textInBubblesPt"), Inglês ("textInBubblesEn") e Espanhol ("textInBubblesEs").' : ''}\n\n`;

        promptText += `Para cada slide, forneça:
        1. "slideNumber": número do slide.
        2. "imagePromptEn": Prompt altamente detalhado em Inglês para geradores de imagem, focado no cenário e personagens, descrevendo onde o balão de fala fica, mas sem o texto literal.
        3. ${dialogueLanguage === 'pt' ? '"textInBubblesPt": Texto no balão em Português.' : dialogueLanguage === 'en' ? '"textInBubblesEn": Texto no balão em Inglês.' : dialogueLanguage === 'es' ? '"textInBubblesEs": Texto no balão em Espanhol.' : '"textInBubblesPt", "textInBubblesEn", "textInBubblesEs": Textos nos balões em PT, EN e ES.'}
        4. "descriptionPt": Breve descrição do que está acontecendo visualmente no slide em Português.
        
        Também forneça "instagramPost" com a legenda engajadora e emocionante.`;

        const requiredSlideFields = ["slideNumber", "imagePromptEn", "descriptionPt"];
        if (dialogueLanguage === 'pt') requiredSlideFields.push("textInBubblesPt");
        else if (dialogueLanguage === 'en') requiredSlideFields.push("textInBubblesEn");
        else if (dialogueLanguage === 'es') requiredSlideFields.push("textInBubblesEs");
        else requiredSlideFields.push("textInBubblesPt", "textInBubblesEn", "textInBubblesEs");

        if (carouselQuantity > 1) {
          promptText += `\n=== GERAÇÃO EM LOTE: EXATAMENTE ${carouselQuantity} CARROSSÉIS OBRIGATÓRIOS ===
          REGRA CRÍTICA E INVIOLÁVEL: Você DEVE gerar EXATAMENTE ${carouselQuantity} carrosséis completos no array "carousels". NÃO gere menos que ${carouselQuantity}. NÃO gere mais que ${carouselQuantity}. O número exato é ${carouselQuantity}.
          - Se foi digitado um tema geral ou anexado material de estudo: Crie ${carouselQuantity} carrosséis que abordem ângulos, subtemas, ganchos e metáforas 100% diferentes e complementares.
          - Se foi fornecida uma lista de tópicos (um por linha): Crie 1 carrossel completo para cada tópico da lista.
          - Cada um dos ${carouselQuantity} carrosséis DEVE ter: "title" (título descritivo em Português), "theme" (tema central), "slides" (com exatamente ${sceneCount} slides com "slideNumber", "imagePromptEn", "textInBubbles...", "descriptionPt") e "instagramPost" (legenda dedicada).
          - O array "carousels" na resposta DEVE conter exatamente ${carouselQuantity} objetos. Retornar menos que ${carouselQuantity} é PROIBIDO.
          LEMBRETE FINAL: carousels.length === ${carouselQuantity}. Gere TODOS os ${carouselQuantity} carrosséis completos.`;

          responseSchema = {
            type: Type.OBJECT,
            properties: {
              carousels: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    theme: { type: Type.STRING },
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
                          textInBubbles: { type: Type.STRING },
                          descriptionPt: { type: Type.STRING },
                        },
                        required: requiredSlideFields,
                      },
                    },
                    instagramPost: { type: Type.STRING },
                  },
                  required: ["title", "slides", "instagramPost"],
                },
              },
            },
            required: ["carousels"],
          };
        } else {
          responseSchema = {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
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
                    textInBubbles: { type: Type.STRING },
                    descriptionPt: { type: Type.STRING },
                  },
                  required: requiredSlideFields,
                },
              },
              instagramPost: { type: Type.STRING },
            },
            required: ["slides", "instagramPost"],
          };
        }
      }

      if (referencePdfs.length > 0 || contextImages.length > 0) {
        promptText += `\nINSTRUÇÕES OBRIGATÓRIAS DE ANÁLISE DE DOCUMENTOS E LIVROS DE REFERÊNCIA (PDF / DOC / TXT / IMAGENS):
        - Foram anexados ${referencePdfs.length} documento(s) e ${contextImages.length} imagem(ns) de texto como material de estudo e embasamento teórico.
        - Você DEVE percorrer e analisar detalhadamente o conteúdo desses documentos e imagens anexadas.
        ${!hasManualTopic ? '- COMO NÃO FOI DIGITADO UM TEMA MANUAL: Identifique a principal mensagem, história ou ensinamento dos documentos e crie a postagem do Instagram e todo o roteiro/carrossel baseado 100% no conteúdo deles.' : '- Incorpore as ideias, metáforas e ensinamentos do autor de forma fiel, rica e sensível nas falas e cenas para enriquecer o tema solicitado.'}
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

      for (const doc of referencePdfs) {
        if (doc.text) {
          parts.push({
            text: `\n=== CONTEÚDO DO DOCUMENTO "${doc.name}" ===\n${doc.text}\n=== FIM DO DOCUMENTO ===\n`
          });
        } else if (doc.mimeType === 'application/pdf') {
          parts.push({ inlineData: { data: doc.data, mimeType: doc.mimeType } });
        } else {
          parts.push({ inlineData: { data: doc.data, mimeType: doc.mimeType } });
        }
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
          model: activeProvider === 'groq' ? groqModelInput : (activeProvider === 'openrouter' ? openrouterModelInput : geminiModel)
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Ocorreu um erro ao gerar.');
      }

      const data = await response.json();
      if (!data.text) throw new Error('Sem resposta da API.');

      if (Array.isArray(data.logs) && data.logs.length > 0) {
        data.logs.forEach((l: any) => {
          addLog(l.level || 'info', l.category || 'IA', l.message);
        });
      }

      const totalSeconds = ((Date.now() - genStartTime) / 1000).toFixed(1);

      if (data.failoverUsed) {
        addLog('warning', 'FAILOVER', `⚡ Failover ativado: alternado de ${data.originalProvider} para ${data.provider} (${data.failoverReason})`);
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
        if (jsonResult && jsonResult.scenes && Array.isArray(jsonResult.scenes)) {
          jsonResult.language = dialogueLanguage;
          jsonResult.scenes.forEach((scene: any) => {
            if (dialogueLanguage === 'pt') {
              scene.dialoguePt = scene.dialoguePt || scene.dialogue || '';
            } else if (dialogueLanguage === 'en') {
              scene.dialogueEn = scene.dialogueEn || scene.dialogue || '';
            } else if (dialogueLanguage === 'es') {
              scene.dialogueEs = scene.dialogueEs || scene.dialogue || '';
            }
          });
        }
        setResult(jsonResult);
        addLog('success', 'GERADOR', `✅ Roteiro de vídeo gerado em ${totalSeconds}s (${jsonResult.scenes?.length || 0} cenas) via ${data.provider.toUpperCase()} (${data.model})!`);
      } else {
        if (jsonResult && jsonResult.carousels && Array.isArray(jsonResult.carousels) && jsonResult.carousels.length > 0) {
          const list = jsonResult.carousels.map((car: any, idx: number) => {
            car.title = car.title || `Carrossel ${idx + 1}`;
            car.language = dialogueLanguage;
            if (car.slides && Array.isArray(car.slides)) {
              car.slides.forEach((slide: any) => {
                if (dialogueLanguage === 'pt') {
                  slide.textInBubblesPt = slide.textInBubblesPt || slide.textInBubbles || '';
                } else if (dialogueLanguage === 'en') {
                  slide.textInBubblesEn = slide.textInBubblesEn || slide.textInBubbles || '';
                } else if (dialogueLanguage === 'es') {
                  slide.textInBubblesEs = slide.textInBubblesEs || slide.textInBubbles || '';
                }
              });
            }
            return car;
          });
          setBatchCarouselResults(list);
          setCarouselResult(list[0]);
          setActiveCarouselIndex(0);
          if (carouselQuantity > 1 && list.length < carouselQuantity) {
            addLog('warning', 'GERADOR', `⚠️ Foram solicitados ${carouselQuantity} carrosséis, mas a IA retornou apenas ${list.length}. Isso pode ocorrer por limite de tokens do modelo. Tente gerar novamente ou reduza a quantidade de slides por carrossel.`);
          }
          addLog('success', 'GERADOR', `✅ Lote de ${list.length} carrosséis gerado em ${totalSeconds}s via ${data.provider.toUpperCase()} (${data.model})!`);
        } else if (jsonResult && jsonResult.slides && Array.isArray(jsonResult.slides)) {
          jsonResult.title = jsonResult.title || topic || 'Carrossel';
          jsonResult.language = dialogueLanguage;
          jsonResult.slides.forEach((slide: any) => {
            if (dialogueLanguage === 'pt') {
              slide.textInBubblesPt = slide.textInBubblesPt || slide.textInBubbles || '';
            } else if (dialogueLanguage === 'en') {
              slide.textInBubblesEn = slide.textInBubblesEn || slide.textInBubbles || '';
            } else if (dialogueLanguage === 'es') {
              slide.textInBubblesEs = slide.textInBubblesEs || slide.textInBubbles || '';
            }
          });
          setBatchCarouselResults([jsonResult]);
          setCarouselResult(jsonResult);
          setActiveCarouselIndex(0);
          addLog('success', 'GERADOR', `✅ Carrossel gerado em ${totalSeconds}s (${jsonResult.slides?.length || 0} slides) via ${data.provider.toUpperCase()} (${data.model})!`);
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog('warning', 'GERADOR', 'Geração cancelada pelo usuário.');
        return;
      }
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao gerar.');
      addLog('error', 'GERADOR', `Falha na geração: ${err.message}`);
    } finally {
      clearInterval(timerInterval);
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
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-md border border-indigo-200/70 uppercase tracking-wider">v1.1.0</span>
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
            {activeProvider === 'groq' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                <Zap className="w-3.5 h-3.5 text-orange-500 group-hover:scale-110 transition-transform" />
                <span className="hidden sm:inline font-bold">Groq Cloud</span>
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded-md bg-orange-50 text-orange-700 border border-orange-200/80 max-w-[130px] truncate">
                  {groqModelInput.replace('qwen/qwen3.8-27b', 'Qwen 3.8 27B').replace('qwen/qwen3.6-27b', 'Qwen 3.6 27B').replace('openai/gpt-oss-120b', 'GPT OSS 120B').replace('openai/gpt-oss-20b', 'GPT OSS 20B').replace('groq/compound-mini', 'Compound Mini')}
                </span>
                {groqKeysStats.total > 0 && (
                  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black rounded-md ${groqKeysStats.free > 0 ? 'bg-orange-100 text-orange-800 border border-orange-200' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    {groqKeysStats.free}/{groqKeysStats.total}
                  </span>
                )}
              </>
            ) : activeProvider === 'openrouter' ? (
              <>
                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                <Cpu className="w-3.5 h-3.5 text-amber-500 group-hover:rotate-12 transition-transform" />
                <span className="hidden sm:inline font-bold">OpenRouter</span>
                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-black rounded-md bg-amber-50 text-amber-700 border border-amber-200/80 max-w-[130px] truncate">
                  {openrouterModelInput.split('/').pop()?.replace(':free', '') || 'Nemotron'}
                </span>
                {openrouterKeysStats.total > 0 && (
                  <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-black rounded-md ${openrouterKeysStats.free > 0 ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                    {openrouterKeysStats.free}/{openrouterKeysStats.total}
                  </span>
                )}
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

      <main className={`flex-grow w-full ${activeTab === 'spy' ? 'max-w-none px-4 pb-4 lg:px-6 lg:pb-6 pt-2' : 'max-w-7xl mx-auto p-4 lg:p-6'} grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-64px)] overflow-hidden ${isLogPanelVisible ? (isLogPanelOpen ? 'pb-72' : 'pb-10') : ''}`}>
        

        {activeTab === 'spy' ? (
          <div className="lg:col-span-12 w-full h-full flex flex-col gap-4 overflow-hidden">
            {/* Sub-Navegação do Espião FLOW */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg shrink-0">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSpySubTab('recorder')}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    spySubTab === 'recorder'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Eye className="w-4 h-4 text-indigo-300" />
                  <span>1. Gravador & Navegador</span>
                  {recordedSteps.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/40 text-indigo-200 text-[10px]">
                      {recordedSteps.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSpySubTab('macro')}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    spySubTab === 'macro'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Workflow className="w-4 h-4 text-emerald-400" />
                  <span>2. Macro com IA & Variáveis</span>
                  {activeMacro && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setSpySubTab('executor')}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    spySubTab === 'executor'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>3. Executor em Larga Escala (RPA)</span>
                  {executorBatchItems.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/30 text-amber-300 text-[10px]">
                      {executorBatchItems.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setSpySubTab('library'); handleLoadMacrosList(); }}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    spySubTab === 'library'
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>4. Biblioteca de Macros</span>
                </button>

                <button
                  type="button"
                  onClick={() => { setSpySubTab('flowchart'); handleLoadMacrosList(); }}
                  className={`px-3 sm:px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer ${
                    spySubTab === 'flowchart'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-md shadow-purple-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Workflow className="w-4 h-4 text-pink-400" />
                  <span>5. Fluxograma N8N</span>
                  {flowchartNodes.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-pink-500/30 text-pink-300 text-[10px]">
                      {flowchartNodes.length}
                    </span>
                  )}
                </button>
              </div>

              {/* Status do Espião */}
              <div className="flex items-center gap-2 pr-2">
                {isRecording && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-xl text-xs font-bold animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span>GRAVANDO TELA & AÇÕES</span>
                  </div>
                )}
                {isExecutorRunning && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl text-xs font-bold animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>EXECUTOR ATIVO</span>
                  </div>
                )}
              </div>
            </div>

            {/* CONTEÚDO DAS SUB-ABAS DO ESPIÃO */}
            <div className="flex-1 overflow-hidden">
              
              {/* SUB-ABA 1: GRAVADOR & NAVEGADOR */}
              {spySubTab === 'recorder' && (
                <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
                  {/* Coluna do Navegador (Esquerda) */}
                  <div className="lg:col-span-8 flex flex-col h-full bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                    {/* Barra de Navegação */}
                    <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-slate-50/50">
                      <div className="flex items-center gap-1.5">
                        <button 
                          onClick={handleSpyGoBack} 
                          disabled={!webviewCanGoBack} 
                          className="p-2 hover:bg-slate-200/80 disabled:opacity-30 rounded-xl text-slate-600 transition cursor-pointer"
                          title="Voltar"
                        >
                          <ArrowLeft className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={handleSpyGoForward} 
                          disabled={!webviewCanGoForward} 
                          className="p-2 hover:bg-slate-200/80 disabled:opacity-30 rounded-xl text-slate-600 transition cursor-pointer"
                          title="Avançar"
                        >
                          <ArrowRight className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={handleSpyReload} 
                          className="p-2 hover:bg-slate-200/80 rounded-xl text-slate-600 transition cursor-pointer"
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
                            placeholder="Digite a URL para navegar (ex: midjourney.com, leonardo.ai, canva.com)"
                            className="w-full pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner font-mono text-xs"
                          />
                        </div>
                        <button 
                          type="submit" 
                          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-sm transition cursor-pointer"
                        >
                          Ir
                        </button>
                      </form>

                      {/* Botão de Inspecionar */}
                      <button 
                        onClick={handleToggleInspect}
                        className={`flex items-center gap-2 px-3.5 py-2 text-xs font-extrabold rounded-2xl shadow-sm transition cursor-pointer select-none border border-slate-200 ${
                          isInspectMode ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-100 hover:bg-indigo-700' : 'bg-white hover:bg-slate-50 text-slate-700 hover:border-slate-300'
                        }`}
                        title="Modo Inspetor de Elementos e Seletores"
                      >
                        <Eye className="w-4 h-4" />
                        <span>{isInspectMode ? 'Inspecionando...' : 'Inspecionar'}</span>
                      </button>

                      {/* Botão de Tirar Snapshot */}
                      <button 
                        type="button"
                        onClick={async () => {
                          const snap = await captureWebviewSnapshot();
                          if (snap) {
                            setRecordedSteps(prev => [...prev, {
                              id: Date.now(),
                              type: 'screenshot',
                              selector: 'body',
                              description: 'Captura manual de tela',
                              screenshot: snap,
                              timestamp: new Date().toLocaleTimeString('pt-BR')
                            }]);
                            addLog('image', 'ESPIÃO', 'Snapshot de tela capturado e anexado ao fluxo.');
                          }
                        }}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-extrabold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-2xl transition cursor-pointer"
                        title="Tirar foto snapshot da tela atual e anexar aos passos"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Snapshot</span>
                      </button>
                    </div>

                    {/* Área do WebView */}
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
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
                        <h3 className="font-bold text-xs uppercase tracking-wider text-white">Gravador de Ações</h3>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setIsRecording(!isRecording)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase rounded-xl transition cursor-pointer ${
                            isRecording ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md'
                          }`}
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
                          onClick={handleClearSteps}
                          disabled={recordedSteps.length === 0}
                          className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 disabled:opacity-40 rounded-xl transition border border-slate-700 cursor-pointer"
                          title="Limpar Fluxo Gravado"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Status de Sincronização / Análise */}
                    {syncStatus.message && (
                      <div className={`px-4 py-2 text-xs font-bold border-b transition-all flex items-center gap-2 ${
                        syncStatus.type === 'success' ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/50' : 
                        syncStatus.type === 'error' ? 'bg-rose-950/40 text-rose-400 border-rose-900/50' : 
                        'bg-slate-950 text-indigo-400 border-slate-800'
                      }`}>
                        <Database className="w-3.5 h-3.5 animate-pulse shrink-0" />
                        <span className="truncate">{syncStatus.message}</span>
                      </div>
                    )}

                    {/* Timeline de Ações & Inspetor */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      
                      {/* Inspetor de Elementos */}
                      {selectedElement && (
                        <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-indigo-500/30 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-md font-mono text-[10px]">
                              {selectedElement.tagName}
                            </span>
                            <span className="text-[10px] text-slate-400">Elemento Inspecionado</span>
                          </div>
                          <code className="block p-1.5 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 font-mono text-[10px] break-all">
                            {selectedElement.selector}
                          </code>
                        </div>
                      )}

                      {/* Campo Opcional: Objetivo do Processo */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          🎯 Objetivo do Processo (Opcional):
                        </label>
                        <input
                          type="text"
                          value={userProcessGoalInput}
                          onChange={(e) => setUserProcessGoalInput(e.target.value)}
                          placeholder="Ex: Gerar imagem no Midjourney e baixar"
                          className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Linha do Tempo dos Passos */}
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <span>Linha do Tempo ({recordedSteps.length} passos)</span>
                          {recordedSteps.length > 0 && <span>Com Screenshots 📸</span>}
                        </div>

                        {recordedSteps.length === 0 ? (
                          <div className="py-8 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                            <div className="p-2.5 rounded-full mb-2 bg-slate-800 text-slate-500">
                              <Play className="w-4 h-4" />
                            </div>
                            <p className="text-xs font-bold text-slate-400">Nenhum passo gravado</p>
                            <p className="text-[10px] text-slate-500 mt-1">Clique em "Gravar" e use o navegador à esquerda.</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                            {recordedSteps.map((step, idx) => (
                              <div 
                                key={step.id} 
                                className="p-2.5 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl transition text-left text-xs flex gap-2.5 items-start group"
                              >
                                {/* Thumbnail do Snapshot */}
                                {step.screenshot ? (
                                  <div 
                                    onClick={() => setAuditImageModalUrl({ url: step.screenshot!, title: `Passo ${idx + 1}: ${step.description}` })}
                                    className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden shrink-0 cursor-pointer hover:border-indigo-500 transition group/img relative"
                                    title="Ver captura de tela em tela cheia"
                                  >
                                    <img src={step.screenshot} alt="Step" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 flex items-center justify-center text-white">
                                      <ZoomIn className="w-3 h-3" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-12 h-12 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                                    {step.type === 'click' ? <MousePointer className="w-4 h-4 text-indigo-400" /> : <Keyboard className="w-4 h-4 text-emerald-400" />}
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 mb-0.5">
                                    <span className="font-bold text-[10px] px-1 py-0.5 bg-slate-800 text-indigo-300 rounded font-mono">
                                      #{idx + 1}
                                    </span>
                                    <span className="font-bold text-white text-[11px] truncate">
                                      {step.type === 'click' ? 'CLIQUE' : step.type === 'input' ? 'DIGITAÇÃO' : step.type.toUpperCase()}
                                    </span>
                                    {step.timestamp && (
                                      <span className="text-[9px] text-slate-500 ml-auto font-mono">{step.timestamp}</span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-300 line-clamp-1">{step.description}</p>
                                  {step.value && (
                                    <p className="text-[10px] font-mono text-emerald-400 truncate bg-slate-900/60 px-1.5 py-0.5 rounded mt-1">
                                      📝 "{step.value}"
                                    </p>
                                  )}
                                </div>

                                <button 
                                  onClick={() => handleRemoveStep(step.id)}
                                  className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                                  title="Remover este passo"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Botão de Análise com IA */}
                      {recordedSteps.length > 0 && (
                        <div className="pt-2 border-t border-slate-800">
                          <button
                            type="button"
                            onClick={handleUnderstandProcessWithAi}
                            disabled={isAnalyzingProcess}
                            className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                          >
                            {isAnalyzingProcess ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>IA Analisando Processo e Visão...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4" />
                                <span>🧠 Analisar Processo & Criar Macro com IA</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              )}

              {/* SUB-ABA 2: MACRO COM IA & VARIÁVEIS */}
              {spySubTab === 'macro' && (
                <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-y-auto text-slate-200 space-y-6">
                  {!activeMacro ? (
                    <div className="py-20 text-center space-y-3">
                      <Workflow className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <h3 className="text-lg font-bold text-white">Nenhum Macro Ativo no Momento</h3>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Grave suas ações no navegador na aba "1. Gravador & Navegador" e clique em "Analisar Processo com IA" para gerar um macro parametrizado com variáveis.
                      </p>
                      <button
                        type="button"
                        onClick={() => setSpySubTab('recorder')}
                        className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-2xl transition shadow-md"
                      >
                        Ir para o Gravador
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {/* Header do Macro */}
                      <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                        <div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 uppercase">
                            Macro Sintetizado por IA
                          </span>
                          <h2 className="text-lg font-extrabold text-white mt-1">{activeMacro.nome_processo}</h2>
                          <p className="text-xs text-slate-400 mt-0.5 max-w-2xl">{activeMacro.descricao_processo}</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleSaveActiveMacro}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer border border-slate-700"
                          >
                            <Download className="w-3.5 h-3.5 text-cyan-400" />
                            <span>Salvar na Biblioteca</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              handlePullItemsFromPostForge();
                            }}
                            className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-extrabold rounded-xl transition shadow-lg flex items-center gap-1.5 cursor-pointer"
                          >
                            <Zap className="w-4 h-4 text-amber-300" />
                            <span>Enviar para o Executor (RPA)</span>
                          </button>
                        </div>
                      </div>

                      {/* Grade de 2 Colunas: Variáveis Identificadas + Resumo do Processo */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Coluna 1: Variáveis Dinâmicas */}
                        <div className="lg:col-span-6 bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
                              Variáveis Parametrizadas ({activeMacro.variaveis_identificadas?.length || 0})
                            </h4>
                            <span className="text-[10px] text-slate-500">Substituíveis em lote</span>
                          </div>

                          <div className="space-y-2.5">
                            {activeMacro.variaveis_identificadas?.map((v, idx) => (
                              <div key={idx} className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 text-xs">
                                <div className="flex items-center justify-between">
                                  <code className="font-mono text-emerald-400 font-bold text-xs bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    {v.nome_variavel}
                                  </code>
                                  <span className="text-[10px] text-slate-500">Passo #{v.passo_index}</span>
                                </div>
                                <p className="text-[11px] text-slate-300">{v.descricao}</p>
                                <p className="text-[10px] text-slate-500 font-mono truncate">Exemplo original: "{v.valor_original}"</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Coluna 2: Resumo Executivo */}
                        <div className="lg:col-span-6 bg-slate-950/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                          <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                            <ListOrdered className="w-4 h-4 text-emerald-400" />
                            Etapas do Processo
                          </h4>
                          <div className="space-y-2">
                            {activeMacro.resumo_passo_a_passo?.map((etapa, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-xs p-2 bg-slate-900/80 rounded-xl border border-slate-800/80">
                                <span className="w-5 h-5 rounded-full bg-indigo-600/30 text-indigo-300 font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-slate-300 text-[11px] leading-relaxed">{etapa}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Sequência de Passos Parametrizados */}
                      <div className="space-y-3">
                        <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                          <Terminal className="w-4 h-4 text-cyan-400" />
                          Sequência de Execução ({activeMacro.macro_parametrizado?.length || 0} ações)
                        </h4>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {activeMacro.macro_parametrizado?.map((step) => (
                            <div key={step.ordem} className="p-3.5 bg-slate-950 border border-slate-800 rounded-2xl space-y-2 text-xs">
                              <div className="flex items-center justify-between">
                                <span className="w-6 h-6 rounded-lg bg-slate-800 text-white font-bold text-[10px] flex items-center justify-center">
                                  {step.ordem}
                                </span>
                                <span className="font-bold text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono uppercase">
                                  {step.tipo}
                                </span>
                              </div>
                              <p className="font-bold text-slate-200 text-[11px]">{step.descricao}</p>
                              {step.valor && (
                                <div className="p-1.5 bg-slate-900 rounded-lg text-[10px] font-mono text-emerald-400 break-all">
                                  📝 {step.valor}
                                </div>
                              )}
                              <div className="text-[10px] text-slate-500 font-mono truncate">
                                📍 {step.seletor}
                              </div>
                              {step.tempo_espera_ms && (
                                <div className="text-[9px] text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-amber-400" /> Espera: {step.tempo_espera_ms}ms
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Códigos Exportáveis */}
                      <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white flex items-center gap-2">
                            <FileCode className="w-4 h-4 text-indigo-400" />
                            Scripts Autônomos em Node.js
                          </span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(activeMacro.codigo_puppeteer || '', 'pup_code')}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                              {copiedStates['pup_code'] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                              Puppeteer
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(activeMacro.codigo_playwright || '', 'pw_code')}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                              {copiedStates['pw_code'] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                              Playwright
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              )}

              {/* SUB-ABA 3: EXECUTOR EM LARGA ESCALA (RPA) */}
              {spySubTab === 'executor' && (
                <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-y-auto text-slate-200 space-y-6">
                  {/* Topo do Executor */}
                  <div className="flex flex-wrap items-center justify-between gap-4 p-5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                        Motor de Execução em Lote (RPA)
                      </span>
                      <h2 className="text-lg font-extrabold text-white mt-1">Executor em Larga Escala</h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Macro ativo: <strong className="text-emerald-400">{activeMacro?.nome_processo || 'Nenhum macro selecionado'}</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handlePullItemsFromPostForge}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                      >
                        <Images className="w-3.5 h-3.5" />
                        <span>Puxar Slides do PostForge</span>
                      </button>

                      {isExecutorRunning ? (
                        <button
                          type="button"
                          onClick={handleStopBatchExecution}
                          className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-extrabold rounded-xl transition shadow flex items-center gap-1.5 cursor-pointer"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>Interromper Execução</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleStartBatchExecution}
                          disabled={executorBatchItems.length === 0 || !activeMacro}
                          className="px-6 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl transition shadow-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                        >
                          <Play className="w-4 h-4 fill-current" />
                          <span>Iniciar Execução em Lote</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra de Progresso em Tempo Real */}
                  {isExecutorRunning && (
                    <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-amber-300 flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                          Executando item {executorCurrentIndex + 1} de {executorBatchItems.length}
                        </span>
                        <span className="font-mono text-slate-400">
                          {Math.round(((executorCurrentIndex + 1) / executorBatchItems.length) * 100)}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                          style={{ width: `${((executorCurrentIndex + 1) / executorBatchItems.length) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Tabela de Itens em Lote */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-extrabold text-white uppercase tracking-wider flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-indigo-400" />
                        Fila de Itens para Execução ({executorBatchItems.length})
                      </h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const newId = `item_${Date.now()}`;
                            setExecutorBatchItems(prev => [...prev, {
                              id: newId,
                              label: `Item ${prev.length + 1}`,
                              params: { "{prompt_imagem}": "", "{texto_slide}": "" },
                              status: 'pending'
                            }]);
                          }}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" /> Adicionar Item
                        </button>
                        <button
                          type="button"
                          onClick={() => setExecutorBatchItems([])}
                          disabled={executorBatchItems.length === 0}
                          className="px-3 py-1 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 text-xs rounded-lg transition disabled:opacity-30 cursor-pointer"
                        >
                          Limpar Fila
                        </button>
                      </div>
                    </div>

                    {executorBatchItems.length === 0 ? (
                      <div className="py-16 text-center border border-dashed border-slate-800 rounded-2xl space-y-2">
                        <Zap className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                        <p className="font-bold text-slate-400 text-xs">Fila de execução vazia</p>
                        <p className="text-[11px] text-slate-500">Clique em "Puxar Slides do PostForge" ou adicione itens manualmente para rodar em lote.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {executorBatchItems.map((item, idx) => {
                          const statusBadge = item.status === 'success' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
                                              item.status === 'running' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse' :
                                              item.status === 'failed' ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' :
                                              'bg-slate-800 text-slate-400 border-slate-700';

                          return (
                            <div 
                              key={item.id}
                              className={`p-4 bg-slate-950 border rounded-2xl transition flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
                                item.status === 'running' ? 'border-amber-500/50 shadow-md shadow-amber-500/10' : 'border-slate-800'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-800 text-white font-black text-xs flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>

                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-white text-xs">{item.label || `Item ${idx + 1}`}</h5>
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${statusBadge}`}>
                                      {item.status === 'success' ? '✓ Concluído' :
                                       item.status === 'running' ? '⚡ Executando...' :
                                       item.status === 'failed' ? '✗ Falhou' : 'Pendente'}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 truncate font-mono">
                                    {item.params['{prompt_imagem}'] || item.params['{prompt}'] || 'Sem prompt definido'}
                                  </p>
                                  {item.log && (
                                    <p className="text-[10px] text-slate-400">{item.log}</p>
                                  )}
                                </div>
                              </div>

                              {/* Snapshot do Resultado */}
                              {item.screenshot && (
                                <div 
                                  onClick={() => setAuditImageModalUrl({ url: item.screenshot!, title: `Resultado: ${item.label}` })}
                                  className="w-14 h-14 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 cursor-pointer hover:border-indigo-500 transition relative group/snap"
                                  title="Ver captura final em tela cheia"
                                >
                                  <img src={item.screenshot} alt="Result" className="w-full h-full object-cover" />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-snap:hover:opacity-100 flex items-center justify-center text-white">
                                    <ZoomIn className="w-3.5 h-3.5" />
                                  </div>
                                </div>
                              )}

                              <button
                                type="button"
                                onClick={() => setExecutorBatchItems(prev => prev.filter((_, i) => i !== idx))}
                                className="p-1.5 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded-xl transition cursor-pointer"
                                title="Remover item da fila"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SUB-ABA 4: BIBLIOTECA DE MACROS */}
              {spySubTab === 'library' && (
                <div className="w-full h-full bg-slate-900 border border-slate-800 rounded-3xl p-6 overflow-y-auto text-slate-200 space-y-6">
                  <div className="flex items-center justify-between p-5 bg-slate-950/80 border border-slate-800 rounded-2xl">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase">
                        Biblioteca Persistente de Automações
                      </span>
                      <h2 className="text-lg font-extrabold text-white mt-1">Macros Salvos em Disco</h2>
                      <p className="text-xs text-slate-400 mt-0.5">Seus padrões de automação salvos na pasta <code className="text-cyan-400">macros/</code></p>
                    </div>

                    <button
                      type="button"
                      onClick={handleLoadMacrosList}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${isLoadingMacros ? 'animate-spin' : ''}`} />
                      <span>Atualizar Lista</span>
                    </button>
                  </div>

                  {savedMacrosList.length === 0 ? (
                    <div className="py-20 text-center space-y-3">
                      <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-2" />
                      <h4 className="text-sm font-bold text-slate-400">Nenhum macro salvo na biblioteca</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Grave suas ações, gere um macro com IA e clique em "Salvar na Biblioteca" para reaproveitá-lo sempre que quiser.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {savedMacrosList.map((macro) => (
                        <div 
                          key={macro.id}
                          className="bg-slate-950 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 flex flex-col justify-between gap-4 transition shadow-md group"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-slate-500">
                                {macro.updatedAt ? new Date(macro.updatedAt).toLocaleDateString('pt-BR') : 'Recente'}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-mono">
                                {macro.macro_parametrizado?.length || 0} ações
                              </span>
                            </div>

                            {renamingMacroId === macro.id ? (
                              <form onSubmit={(e) => { e.preventDefault(); handleRenameMacro(macro.id, renamingMacroName); }} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={renamingMacroName}
                                  onChange={(e) => setRenamingMacroName(e.target.value)}
                                  autoFocus
                                  onBlur={() => { if (renamingMacroName.trim()) handleRenameMacro(macro.id, renamingMacroName); else { setRenamingMacroId(null); setRenamingMacroName(''); } }}
                                  onKeyDown={(e) => { if (e.key === 'Escape') { setRenamingMacroId(null); setRenamingMacroName(''); } }}
                                  className="w-full px-2 py-1 text-sm font-bold bg-slate-800 border border-indigo-500 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                  placeholder="Nome do macro..."
                                />
                              </form>
                            ) : (
                              <h3 
                                className="font-extrabold text-white text-sm group-hover:text-indigo-300 transition cursor-pointer"
                                onDoubleClick={() => { setRenamingMacroId(macro.id); setRenamingMacroName(macro.nome_processo); }}
                                title="Clique duplo para renomear"
                              >
                                {macro.nome_processo}
                              </h3>
                            )}
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                              {macro.descricao_processo}
                            </p>

                            <div className="pt-2 flex flex-wrap gap-1.5">
                              {macro.variaveis_identificadas?.slice(0, 3).map((v, i) => (
                                <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-emerald-400 rounded">
                                  {v.nome_variavel}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMacro(macro);
                                setSpySubTab('macro');
                                addLog('info', 'ESPIÃO', `Macro "${macro.nome_processo}" carregado.`);
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer flex-1 justify-center"
                            >
                              <Play className="w-3 h-3 fill-current" /> Carregar Macro
                            </button>
                            <button
                              type="button"
                              onClick={() => { setRenamingMacroId(macro.id); setRenamingMacroName(macro.nome_processo); }}
                              className="p-1.5 bg-slate-900 hover:bg-indigo-950 text-slate-500 hover:text-indigo-400 rounded-xl transition cursor-pointer"
                              title="Renomear macro"
                            >
                              <Settings className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteMacro(macro.id)}
                              className="p-1.5 bg-slate-900 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded-xl transition cursor-pointer"
                              title="Excluir macro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />  
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ========== ABA 5: FLUXOGRAMA N8N ========== */}
              {spySubTab === 'flowchart' && (
                <div className="w-full h-full flex gap-4 overflow-hidden">
                  {/* Sidebar — Lista de Macros para Arrastar */}
                  <div className="w-64 shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 overflow-y-auto">
                    <div className="pb-3 border-b border-slate-800">
                      <h3 className="text-sm font-black text-white flex items-center gap-2">
                        <Workflow className="w-4 h-4 text-pink-400" />
                        Macros Disponíveis
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-1">Arraste um macro para o canvas</p>
                    </div>

                    {savedMacrosList.length === 0 ? (
                      <div className="py-10 text-center">
                        <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-xs text-slate-500">Nenhum macro salvo.</p>
                        <p className="text-[10px] text-slate-600 mt-1">Salve macros na Biblioteca primeiro.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {savedMacrosList.map(macro => (
                          <div
                            key={macro.id}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData('macroId', macro.id);
                              e.dataTransfer.setData('macroName', macro.nome_processo);
                              e.dataTransfer.effectAllowed = 'copy';
                            }}
                            className="bg-slate-800/80 border border-slate-700 hover:border-purple-500/50 rounded-xl p-3 cursor-grab active:cursor-grabbing transition group"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                                <Cpu className="w-3.5 h-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-white truncate group-hover:text-purple-300 transition">{macro.nome_processo}</p>
                                <p className="text-[9px] text-slate-500 font-mono">{macro.macro_parametrizado?.length || 0} ações</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ações do Fluxograma */}
                    {flowchartNodes.length > 0 && (
                      <div className="mt-auto pt-3 border-t border-slate-800 space-y-2">
                        <button
                          type="button"
                          onClick={async () => {
                            if (flowchartNodes.length === 0 || isFlowchartRunning) return;
                            setIsFlowchartRunning(true);
                            addLog('ai', 'FLUXOGRAMA', `Iniciando execução sequencial de ${flowchartNodes.length} nós...`);
                            
                            // Build execution order: BFS from nodes with no incoming connections
                            const visited = new Set<string>();
                            const queue: string[] = [];
                            const incomingMap: Record<string, number> = {};
                            flowchartNodes.forEach(n => { incomingMap[n.id] = 0; });
                            flowchartNodes.forEach(n => {
                              n.connections.forEach(cId => {
                                incomingMap[cId] = (incomingMap[cId] || 0) + 1;
                              });
                            });
                            flowchartNodes.forEach(n => {
                              if (incomingMap[n.id] === 0) queue.push(n.id);
                            });
                            const executionOrder: typeof flowchartNodes = [];
                            while (queue.length > 0) {
                              const nodeId = queue.shift()!;
                              if (visited.has(nodeId)) continue;
                              visited.add(nodeId);
                              const node = flowchartNodes.find(n => n.id === nodeId);
                              if (node) {
                                executionOrder.push(node);
                                node.connections.forEach(cId => {
                                  if (!visited.has(cId)) queue.push(cId);
                                });
                              }
                            }
                            // Add any unvisited nodes
                            flowchartNodes.forEach(n => {
                              if (!visited.has(n.id)) executionOrder.push(n);
                            });

                            for (let i = 0; i < executionOrder.length; i++) {
                              const node = executionOrder[i];
                              setFlowchartRunningNodeId(node.id);
                              const macro = savedMacrosList.find(m => m.id === node.macroId);
                              if (macro) {
                                addLog('info', 'FLUXOGRAMA', `[${i+1}/${executionOrder.length}] Executando: "${macro.nome_processo}"`);
                                setActiveMacro(macro);
                                // Simulate execution delay per step count
                                await new Promise(r => setTimeout(r, (macro.macro_parametrizado?.length || 1) * 1500));
                                addLog('success', 'FLUXOGRAMA', `[${i+1}/${executionOrder.length}] "${macro.nome_processo}" concluído.`);
                              } else {
                                addLog('warning', 'FLUXOGRAMA', `Macro "${node.name}" não encontrado na biblioteca.`);
                              }
                            }

                            setFlowchartRunningNodeId(null);
                            setIsFlowchartRunning(false);
                            addLog('success', 'FLUXOGRAMA', 'Fluxo completo executado com sucesso!');
                          }}
                          disabled={isFlowchartRunning}
                          className={`w-full px-4 py-2.5 text-xs font-black rounded-xl transition flex items-center gap-2 justify-center cursor-pointer ${
                            isFlowchartRunning
                              ? 'bg-amber-600/30 text-amber-300 border border-amber-500/30 cursor-wait'
                              : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white shadow-lg shadow-emerald-600/20'
                          }`}
                        >
                          {isFlowchartRunning ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Executando Fluxo...</>
                          ) : (
                            <><Play className="w-3.5 h-3.5 fill-current" /> Executar Fluxo ({flowchartNodes.length})</>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => { setFlowchartNodes([]); addLog('info', 'FLUXOGRAMA', 'Canvas limpo.'); }}
                          className="w-full px-3 py-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 text-xs font-bold rounded-xl transition flex items-center gap-2 justify-center cursor-pointer border border-slate-700"
                        >
                          <Trash2 className="w-3 h-3" /> Limpar Canvas
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Canvas — Área de Drag & Drop */}
                  <div
                    ref={flowchartRef}
                    className="flex-1 bg-slate-950/80 border border-slate-800 rounded-2xl relative overflow-hidden"
                    style={{ backgroundImage: 'radial-gradient(circle, rgba(99,102,241,0.08) 1px, transparent 1px)', backgroundSize: '24px 24px' }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                    onDrop={(e) => {
                      e.preventDefault();
                      const macroId = e.dataTransfer.getData('macroId');
                      const macroName = e.dataTransfer.getData('macroName');
                      if (!macroId) return;
                      const rect = flowchartRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const x = e.clientX - rect.left - 90;
                      const y = e.clientY - rect.top - 30;
                      const newNode = {
                        id: `node_${Date.now()}`,
                        macroId,
                        name: macroName,
                        x: Math.max(0, Math.min(x, rect.width - 180)),
                        y: Math.max(0, Math.min(y, rect.height - 60)),
                        connections: [] as string[]
                      };
                      setFlowchartNodes(prev => [...prev, newNode]);
                      addLog('info', 'FLUXOGRAMA', `Nó "${macroName}" adicionado ao canvas.`);
                    }}
                    onMouseMove={(e) => {
                      if (!draggingNodeId) return;
                      const rect = flowchartRef.current?.getBoundingClientRect();
                      if (!rect) return;
                      const x = e.clientX - rect.left - dragOffset.x;
                      const y = e.clientY - rect.top - dragOffset.y;
                      setFlowchartNodes(prev => prev.map(n => 
                        n.id === draggingNodeId 
                          ? { ...n, x: Math.max(0, Math.min(x, rect.width - 180)), y: Math.max(0, Math.min(y, rect.height - 60)) }
                          : n
                      ));
                    }}
                    onMouseUp={() => { setDraggingNodeId(null); }}
                    onMouseLeave={() => { setDraggingNodeId(null); setConnectingFrom(null); }}
                  >
                    {/* Placeholder quando vazio */}
                    {flowchartNodes.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center space-y-3">
                          <div className="w-16 h-16 mx-auto rounded-2xl bg-purple-500/10 border-2 border-dashed border-purple-500/30 flex items-center justify-center">
                            <Workflow className="w-8 h-8 text-purple-500/50" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-slate-400">Arraste macros para cá</h4>
                            <p className="text-[10px] text-slate-600 mt-1 max-w-xs mx-auto">
                              Arraste macros da sidebar esquerda para criar nós. Clique no conector (●) de um nó e depois em outro para conectar.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SVG para as linhas de conexão */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
                      <defs>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                          <polygon points="0 0, 10 3.5, 0 7" fill="#818cf8" />
                        </marker>
                      </defs>
                      {flowchartNodes.map(node => 
                        node.connections.map(targetId => {
                          const target = flowchartNodes.find(n => n.id === targetId);
                          if (!target) return null;
                          const x1 = node.x + 180;
                          const y1 = node.y + 30;
                          const x2 = target.x;
                          const y2 = target.y + 30;
                          const midX = (x1 + x2) / 2;
                          return (
                            <path
                              key={`${node.id}-${targetId}`}
                              d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                              stroke={flowchartRunningNodeId === node.id || flowchartRunningNodeId === targetId ? '#10b981' : '#818cf8'}
                              strokeWidth="2"
                              fill="none"
                              strokeDasharray={flowchartRunningNodeId === node.id ? '8 4' : 'none'}
                              markerEnd="url(#arrowhead)"
                              className={flowchartRunningNodeId === node.id ? 'animate-pulse' : ''}
                            />
                          );
                        })
                      )}
                    </svg>

                    {/* Nós do Fluxograma */}
                    {flowchartNodes.map((node, idx) => {
                      const isRunning = flowchartRunningNodeId === node.id;
                      return (
                        <div
                          key={node.id}
                          className={`absolute select-none transition-shadow duration-200 ${
                            isRunning ? 'z-20' : 'z-10'
                          }`}
                          style={{ left: node.x, top: node.y, width: 180 }}
                        >
                          <div 
                            className={`bg-slate-900 border-2 rounded-xl p-3 cursor-move shadow-lg flex flex-col gap-1.5 transition-all ${
                              isRunning
                                ? 'border-emerald-400 shadow-emerald-500/30 ring-2 ring-emerald-400/30 animate-pulse'
                                : connectingFrom === node.id
                                  ? 'border-pink-500 shadow-pink-500/20'
                                  : 'border-slate-700 hover:border-indigo-500/60 hover:shadow-indigo-500/10'
                            }`}
                            onMouseDown={(e) => {
                              if ((e.target as HTMLElement).closest('[data-connector]')) return;
                              e.preventDefault();
                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                              setDraggingNodeId(node.id);
                            }}
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className={`w-5 h-5 rounded-md text-[9px] font-black flex items-center justify-center ${
                                  isRunning ? 'bg-emerald-500/30 text-emerald-300' : 'bg-purple-500/20 text-purple-400'
                                }`}>{idx + 1}</span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {savedMacrosList.find(m => m.id === node.macroId)?.macro_parametrizado?.length || '?'} ações
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFlowchartNodes(prev => {
                                    const updated = prev.filter(n => n.id !== node.id);
                                    return updated.map(n => ({ ...n, connections: n.connections.filter(c => c !== node.id) }));
                                  });
                                }}
                                className="p-0.5 text-slate-600 hover:text-rose-400 transition cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            
                            {/* Nome */}
                            <p className="text-xs font-bold text-white leading-snug line-clamp-2">{node.name}</p>

                            {/* Conectores */}
                            <div className="flex items-center justify-between mt-1">
                              {/* Entrada (esquerda) */}
                              <div 
                                data-connector="in"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (connectingFrom && connectingFrom !== node.id) {
                                    setFlowchartNodes(prev => prev.map(n => 
                                      n.id === connectingFrom && !n.connections.includes(node.id)
                                        ? { ...n, connections: [...n.connections, node.id] }
                                        : n
                                    ));
                                    addLog('info', 'FLUXOGRAMA', `Conexão criada → ${node.name}`);
                                    setConnectingFrom(null);
                                  }
                                }}
                                className={`w-4 h-4 rounded-full border-2 cursor-pointer transition ${
                                  connectingFrom && connectingFrom !== node.id
                                    ? 'border-pink-400 bg-pink-500/30 scale-125 animate-pulse'
                                    : 'border-slate-600 bg-slate-800 hover:border-indigo-400 hover:bg-indigo-500/20'
                                }`}
                                title="Entrada — clique para conectar"
                              />
                              
                              {/* Saída (direita) */}
                              <div 
                                data-connector="out"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (connectingFrom === node.id) {
                                    setConnectingFrom(null);
                                  } else {
                                    setConnectingFrom(node.id);
                                    addLog('info', 'FLUXOGRAMA', `Conectando a partir de "${node.name}"... Clique no nó destino.`);
                                  }
                                }}
                                className={`w-4 h-4 rounded-full border-2 cursor-pointer transition ${
                                  connectingFrom === node.id
                                    ? 'border-pink-400 bg-pink-500 scale-125'
                                    : 'border-indigo-500 bg-indigo-500/30 hover:bg-indigo-500/50 hover:scale-110'
                                }`}
                                title="Saída — clique para iniciar conexão"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

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
                        <span>{isExtractingDoc ? 'Lendo...' : 'Carregar PDF / DOC / TXT'}</span>
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
                          {multiProjectsResult?.projetos && multiProjectsResult.projetos.length > 1 && (
                            <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold rounded-full">
                              {multiProjectsResult.projetos.length} Projetos Separados
                            </span>
                          )}
                          {auditResult.pontuacao_media_geral && (
                            <span className="px-2.5 py-0.5 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold rounded-full">
                              Média: {auditResult.pontuacao_media_geral}
                            </span>
                          )}
                        </div>
                        <h3 className="text-lg font-bold text-white mt-1.5">
                          {multiProjectsResult?.projetos?.[activeMultiProjectIndex]?.titulo_projeto || `Sequência Ordenada (${orderedSlidesList.length} Slides Mapeados)`}
                        </h3>
                      </div>

                      {/* Botões de Ação Rápida */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setIsPreviewModalOpen(true)}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
                          title="Abrir Pré-visualização Completa dos Slides Ordenados e Sobressalentes"
                        >
                          <Eye className="w-4 h-4" />
                          <span>Preview da Sequência</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleExportAuditReportTXT}
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          title="Exportar Relatório em TXT"
                        >
                          <FileText className="w-3.5 h-3.5" /> TXT
                        </button>

                        {/* Se houver múltiplos projetos, botão para baixar todos os .ZIPs nomeados */}
                        {multiProjectsResult?.projetos && multiProjectsResult.projetos.length > 1 ? (
                          <>
                            <button
                              type="button"
                              onClick={handleDownloadAllProjectsZips}
                              disabled={isDownloadingAllZips || isGeneratingZip}
                              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
                              title="Baixar todos os projetos separados em arquivos .ZIP diferentes com nomes inteligentes dados pela IA"
                            >
                              {isDownloadingAllZips ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderArchive className="w-3.5 h-3.5" />}
                              <span>{isDownloadingAllZips ? 'Baixando Todos...' : `Baixar Todos os .ZIPs (${multiProjectsResult.projetos.length})`}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDownloadSingleProjectZip()}
                              disabled={isGeneratingZip || isDownloadingAllZips}
                              className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                              title="Baixar apenas o .ZIP do projeto selecionado"
                            >
                              {isGeneratingZip ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                              <span>Baixar este .ZIP</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDownloadSingleProjectZip()}
                            disabled={isGeneratingZip}
                            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                            title="Baixar todas as imagens renomeadas em ordem numérica (.zip) diretamente para Downloads"
                          >
                            {isGeneratingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderArchive className="w-3.5 h-3.5" />}
                            <span>{isGeneratingZip ? 'Gerando ZIP...' : 'Baixar Imagens (.ZIP)'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Seletor de Projetos Identificados pela IA (se houver mais de 1) */}
                    {multiProjectsResult?.projetos && multiProjectsResult.projetos.length > 1 && (
                      <div className="pt-2 border-t border-indigo-500/20">
                        <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Projetos & Roteiros Separados pela IA:</span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {multiProjectsResult.projetos.map((proj, pIdx) => {
                            const isSelected = activeMultiProjectIndex === pIdx;
                            return (
                              <button
                                key={proj.id || pIdx}
                                type="button"
                                onClick={() => handleSelectMultiProject(pIdx)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                                  isSelected 
                                    ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-500/30' 
                                    : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-700 hover:bg-slate-850'
                                }`}
                              >
                                <span>🎯 {pIdx + 1}. {proj.titulo_projeto}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${isSelected ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                  {proj.slides_ordenados?.length || 0} slides
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Banner de Sucesso pós-download com link para abrir a pasta */}
                    {downloadSuccessInfo && (
                      <div className="p-3.5 bg-emerald-950/80 text-emerald-200 border border-emerald-500/50 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg animate-in fade-in">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <div className="truncate">
                            <h4 className="text-xs font-bold text-emerald-300">Arquivo ZIP Salvo com Sucesso!</h4>
                            <p className="text-[10px] text-emerald-200/80 font-mono truncate">
                              📁 {downloadSuccessInfo.savedPath || downloadSuccessInfo.filename}
                            </p>
                          </div>
                        </div>
                        {downloadSuccessInfo.savedPath && (
                          <button
                            type="button"
                            onClick={() => handleOpenFolder(downloadSuccessInfo.savedPath)}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shrink-0 cursor-pointer shadow-xs"
                            title="Abrir pasta de Downloads no Windows Explorer"
                          >
                            <FolderArchive className="w-3.5 h-3.5" /> Abrir Pasta
                          </button>
                        )}
                      </div>
                    )}

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
                    {orderedSlidesList.map((item, index) => {
                      const matchedImg = uploadedAuditImages.find(img => 
                        img.name.toLowerCase() === item.imagem_arquivo_correspondente.toLowerCase() ||
                        img.name.toLowerCase().includes(item.imagem_arquivo_correspondente.toLowerCase()) ||
                        item.imagem_arquivo_correspondente.toLowerCase().includes(img.name.toLowerCase())
                      );

                      const scoreNumber = parseInt((item.pontuacao_consistencia || '85').replace(/[^0-9]/g, '')) || 85;
                      const badgeColor = scoreNumber >= 90 
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                        : scoreNumber >= 75 
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

                      const ext = matchedImg?.name.split('.').pop() || 'png';
                      const cleanBase = matchedImg?.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || 'slide';
                      const sequentialName = `Slide_${String(index + 1).padStart(2, '0')}_${cleanBase}.${ext}`;

                      return (
                        <div 
                          key={`${item.slide_numero}-${index}`}
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
                                    onClick={() => setAuditImageModalUrl({ url: matchedImg.dataUrl, title: `Slide ${index + 1} - ${matchedImg.name}` })}
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

                            <div className="flex flex-col gap-1 text-[10px] text-slate-400 font-mono bg-slate-800/60 p-2 rounded-xl border border-slate-700/60">
                              <div className="flex items-center justify-between">
                                <span className="truncate max-w-[130px]" title={item.imagem_arquivo_correspondente}>
                                  📁 {item.imagem_arquivo_correspondente}
                                </span>
                                {matchedImg && (
                                  <button
                                    onClick={() => saveAs(matchedImg.dataUrl, sequentialName)}
                                    className="text-indigo-400 hover:text-indigo-300 p-1 hover:bg-slate-700 rounded-md cursor-pointer transition"
                                    title="Baixar imagem individual renomeada"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                              <span className="text-emerald-400 text-[9px] truncate" title={`Nome no ZIP: ${sequentialName}`}>
                                📦 {sequentialName}
                              </span>
                            </div>
                          </div>

                          {/* Coluna de Informações e Feedback da IA */}
                          <div className="flex-1 flex flex-col justify-between gap-3">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="w-7 h-7 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                    {index + 1}
                                  </span>
                                  <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                                    Slide {index + 1}
                                  </h4>
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Controles de Reordenação Manual */}
                                  <div className="flex items-center bg-slate-800/80 p-0.5 rounded-lg border border-slate-700">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveSlideUp(index)}
                                      disabled={index === 0}
                                      className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 rounded-md transition cursor-pointer"
                                      title="Mover Slide para Cima"
                                    >
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveSlideDown(index)}
                                      disabled={index === orderedSlidesList.length - 1}
                                      className="p-1 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 rounded-md transition cursor-pointer"
                                      title="Mover Slide para Baixo"
                                    >
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveSlideToSurplus(index)}
                                      className="p-1 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 rounded-md transition cursor-pointer"
                                      title="Mover Imagem para Sobressalentes (Descartar deste Slide)"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeColor}`}>
                                    {item.pontuacao_consistencia} Consistência
                                  </span>
                                </div>
                              </div>

                              <div className="space-y-2.5">
                                {/* Descrição esperada */}
                                <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/60 text-xs">
                                  <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider mb-0.5">
                                    Requisito do Roteiro:
                                  </span>
                                  <p className="text-slate-200 leading-relaxed">{item.descricao_esperada}</p>
                                </div>

                                {/* Elementos Visuais Identificados */}
                                {item.elementos_visuais_identificados && (
                                  <div className="p-3 bg-emerald-950/40 rounded-xl border border-emerald-500/30 text-xs">
                                    <span className="text-[10px] font-bold text-emerald-400 block uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Elementos Identificados na Imagem:
                                    </span>
                                    <p className="text-emerald-100 leading-relaxed">{item.elementos_visuais_identificados}</p>
                                  </div>
                                )}

                                {/* Feedback Visual da IA */}
                                <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-500/20 text-xs">
                                  <span className="text-[10px] font-bold text-indigo-400 block uppercase tracking-wider mb-0.5 flex items-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Análise de Consistência & Traço:
                                  </span>
                                  <p className="text-indigo-100 leading-relaxed">{item.feedback_visual}</p>
                                </div>

                                {/* Seletor Rápido para Trocar Imagem do Slide */}
                                <div className="flex items-center justify-between p-2 bg-slate-800/40 rounded-xl border border-slate-700/50 text-xs">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 text-indigo-400" /> Trocar Imagem:
                                  </span>
                                  <select
                                    value={item.imagem_arquivo_correspondente}
                                    onChange={(e) => handleSwapSlideImage(index, e.target.value)}
                                    className="bg-slate-900 border border-slate-700 hover:border-indigo-500 text-slate-200 text-xs rounded-lg px-2 py-1 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer max-w-[200px] truncate"
                                  >
                                    <option value={item.imagem_arquivo_correspondente}>Atual: {item.imagem_arquivo_correspondente}</option>
                                    {uploadedAuditImages
                                      .filter(img => img.name !== item.imagem_arquivo_correspondente)
                                      .map(img => (
                                        <option key={img.id} value={img.name}>{img.name}</option>
                                      ))}
                                  </select>
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
                  {surplusImagesList.length > 0 && (
                    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-slate-300 shadow-xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          <h4 className="text-sm font-bold text-white uppercase tracking-wider">
                            Imagens Sobressalentes / Não Utilizadas ({surplusImagesList.length})
                          </h4>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">
                        Estas imagens foram analisadas mas não foram selecionadas como a melhor representação para a sequência narrativa:
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {surplusImagesList.map((surplus, sIdx) => {
                          const matchedImg = uploadedAuditImages.find(img => img.name.toLowerCase() === surplus.nome_arquivo.toLowerCase());
                          return (
                            <div key={sIdx} className="p-3 bg-slate-800/50 rounded-2xl border border-slate-700/60 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
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
                              <button
                                type="button"
                                onClick={() => handlePromoteSurplusToSlide(surplus)}
                                className="px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-xl text-[10px] font-bold transition shrink-0 cursor-pointer flex items-center gap-1"
                                title="Adicionar esta imagem à sequência de slides"
                              >
                                <Sparkles className="w-3 h-3" /> Usar
                              </button>
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
                    {activeTab === 'script' ? 'Número de Cenas' : 'Slides por Post'}
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

              {/* Seletor de Quantidade de Carrosséis em Lote (1 a 30) */}
              {activeTab === 'carousel' && (
                <div className="space-y-2.5 p-3.5 bg-gradient-to-br from-indigo-50/90 to-purple-50/70 border border-indigo-200 rounded-2xl shadow-xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-600" />
                      <span>Quantidade de Carrosséis (1 a 30)</span>
                    </label>
                    <span className="text-xs font-black text-indigo-600 bg-white px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
                      {carouselQuantity} {carouselQuantity === 1 ? 'Carrossel' : 'Carrosséis'}
                    </span>
                  </div>

                  {/* Atalhos Rápidos */}
                  <div className="grid grid-cols-6 gap-1.5 pt-0.5">
                    {[1, 3, 5, 10, 15, 30].map(qty => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setCarouselQuantity(qty)}
                        className={`py-1.5 text-xs font-black rounded-xl border transition flex items-center justify-center cursor-pointer ${
                          carouselQuantity === qty
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-500/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {qty}x
                      </button>
                    ))}
                  </div>

                  {/* Slider & Input */}
                  <div className="pt-1 flex items-center gap-3">
                    <input 
                      type="range"
                      min="1"
                      max="30"
                      value={carouselQuantity}
                      onChange={(e) => setCarouselQuantity(Number(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer h-2 bg-indigo-100 rounded-lg"
                    />
                    <input 
                      type="number"
                      min="1"
                      max="30"
                      value={carouselQuantity}
                      onChange={(e) => setCarouselQuantity(Math.max(1, Math.min(30, Number(e.target.value))))}
                      className="w-14 p-1 text-center font-black text-xs bg-white border border-indigo-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <p className="text-[10.5px] text-indigo-950/80 leading-snug">
                    {carouselQuantity === 1 
                      ? 'Gera 1 carrossel completo com o tema e configurações acima.' 
                      : `A IA gerará ${carouselQuantity} carrosséis completos de uma vez (explorando diferentes ganchos/ângulos do tema ou 1 carrossel para cada linha da sua lista).`}
                  </p>
                </div>
              )}

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

              {/* Seletor de Idioma dos Diálogos / Narração */}
              <div className="space-y-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Idioma dos Diálogos / Narração</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 uppercase bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 shadow-2xs">
                    {dialogueLanguage === 'pt' ? '🇧🇷 Português' : dialogueLanguage === 'en' ? '🇺🇸 Inglês' : dialogueLanguage === 'es' ? '🇪🇸 Espanhol' : '🌐 Trilíngue'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {LANGUAGES.filter(l => l.id !== 'all').map(lang => (
                    <button
                      key={lang.id}
                      type="button"
                      onClick={() => setDialogueLanguage(lang.id as DialogueLanguage)}
                      className={`py-2 px-2 text-xs font-bold rounded-xl border transition flex items-center justify-center gap-1.5 cursor-pointer select-none ${
                        dialogueLanguage === lang.id
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white border-indigo-700 shadow-sm ring-2 ring-indigo-500/20 scale-[1.02]'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  ))}
                </div>
                <div className="pt-0.5">
                  <button
                    type="button"
                    onClick={() => setDialogueLanguage(dialogueLanguage === 'all' ? 'pt' : 'all')}
                    className={`w-full py-1.5 px-2 text-[11px] font-semibold rounded-xl border transition flex items-center justify-center gap-1.5 cursor-pointer ${
                      dialogueLanguage === 'all'
                        ? 'bg-slate-900 text-white border-slate-800 shadow-xs'
                        : 'bg-white/80 text-slate-500 border-slate-200 hover:text-slate-800 hover:bg-white'
                    }`}
                  >
                    <span>🌐</span>
                    <span>{dialogueLanguage === 'all' ? '✓ Modo Trilíngue Ativo (PT, EN e ES)' : 'Gerar nos 3 Idiomas Simultaneamente (PT, EN e ES)'}</span>
                  </button>
                </div>
              </div>

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
                    : activeTab === 'carousel' && carouselQuantity > 1
                      ? `Ex: Digite um tema geral (a IA criará ${carouselQuantity} carrosséis com abordagens diferentes) OU cole uma lista de tópicos (1 por linha) para gerar 1 carrossel por item.`
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

              {/* Reference Documents / Books Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-900">
                    Anexar Documentos de Estudo <span className="text-slate-400 font-normal">(PDF, DOC, TXT)</span>
                  </label>
                  {referencePdfs.length > 0 && (
                    <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full font-medium">
                      {referencePdfs.length} doc{referencePdfs.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="cursor-pointer bg-slate-50 border border-slate-200 border-dashed rounded-xl p-3 flex items-center justify-center gap-2 hover:bg-slate-100 transition text-slate-500 group">
                    <FileText className="w-4 h-4 text-indigo-500 group-hover:scale-110 transition" />
                    <span className="text-xs font-semibold text-slate-700">Selecionar PDF, DOC ou TXT para a IA estudar</span>
                    <input 
                      type="file" 
                      multiple 
                      accept=".pdf,.docx,.doc,.txt,.json,.md,.csv,text/plain,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" 
                      className="hidden" 
                      onChange={handlePdfUpload}
                    />
                  </label>

                  {referencePdfs.length > 0 && (
                    <div className="grid grid-cols-1 gap-2 pt-1">
                      {referencePdfs.map((doc, i) => {
                        const isPdf = doc.docType === 'pdf' || doc.mimeType === 'application/pdf';
                        const isDocx = doc.docType === 'docx' || doc.name.toLowerCase().endsWith('.docx') || doc.name.toLowerCase().endsWith('.doc');
                        const badgeLabel = isPdf ? 'PDF' : isDocx ? 'DOC' : 'TXT';
                        const badgeBg = isPdf ? 'bg-red-100 text-red-700' : isDocx ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700';
                        const cardBg = isPdf ? 'bg-red-50/60 border-red-100' : isDocx ? 'bg-blue-50/60 border-blue-100' : 'bg-emerald-50/60 border-emerald-100';

                        return (
                          <div 
                            key={i} 
                            className={`flex items-center justify-between p-2.5 border rounded-xl text-xs ${cardBg}`}
                          >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                              <div className={`p-1.5 rounded-lg shrink-0 font-bold text-[10px] uppercase ${badgeBg}`}>
                                {badgeLabel}
                              </div>
                              <div className="truncate">
                                <p className="font-semibold text-slate-800 truncate">{doc.name}</p>
                                <p className="text-[10px] text-slate-500">
                                  {(doc.size / (1024 * 1024)).toFixed(2)} MB • Material de estudo da IA
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemovePdf(i)}
                              className="p-1.5 hover:bg-slate-200/80 text-slate-500 hover:text-rose-600 rounded-lg transition shrink-0 ml-2 cursor-pointer"
                              title="Remover documento"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
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
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" /> Copiar Prompt + Narração
                      </h4>
                      {result.language && result.language !== 'all' && (
                        <span className="text-[9px] font-bold text-indigo-300 bg-indigo-500/20 px-1.5 py-0.5 rounded border border-indigo-400/30 uppercase">
                          {result.language === 'en' ? '🇺🇸 Inglês' : result.language === 'es' ? '🇪🇸 Espanhol' : '🇧🇷 Português'}
                        </span>
                      )}
                    </div>

                    {/* Se foi gerado para 1 idioma específico */}
                    {(result.language === 'pt' || (!result.language && scene.dialoguePt && !scene.dialogueEn && !scene.dialogueEs)) && (
                      <button 
                        onClick={() => handleCopy(`${scene.videoPromptEn}\n\nDialogue/Narration (PT): "${scene.dialoguePt || scene.dialogue}"`, `v_pt_${index}`)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition border border-indigo-500/30 group shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">🇧🇷 PT</span>
                          <p className="text-xs text-slate-100 font-medium italic truncate">"{scene.dialoguePt || scene.dialogue}"</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase shrink-0 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:text-white transition">
                          {copiedStates[`v_pt_${index}`] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>+ Prompt</span>
                        </div>
                      </button>
                    )}

                    {(result.language === 'en' || (!result.language && scene.dialogueEn && !scene.dialoguePt && !scene.dialogueEs)) && (
                      <button 
                        onClick={() => handleCopy(`${scene.videoPromptEn}\n\nDialogue/Narration (EN): "${scene.dialogueEn || scene.dialogue}"`, `v_en_${index}`)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition border border-indigo-500/30 group shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">🇺🇸 EN</span>
                          <p className="text-xs text-slate-100 font-medium italic truncate">"{scene.dialogueEn || scene.dialogue}"</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase shrink-0 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:text-white transition">
                          {copiedStates[`v_en_${index}`] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>+ Prompt</span>
                        </div>
                      </button>
                    )}

                    {(result.language === 'es' || (!result.language && scene.dialogueEs && !scene.dialoguePt && !scene.dialogueEn)) && (
                      <button 
                        onClick={() => handleCopy(`${scene.videoPromptEn}\n\nDialogue/Narration (ES): "${scene.dialogueEs || scene.dialogue}"`, `v_es_${index}`)}
                        className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition border border-indigo-500/30 group shadow-sm"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20 shrink-0">🇪🇸 ES</span>
                          <p className="text-xs text-slate-100 font-medium italic truncate">"{scene.dialogueEs || scene.dialogue}"</p>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-400 uppercase shrink-0 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20 group-hover:bg-indigo-600 group-hover:text-white transition">
                          {copiedStates[`v_es_${index}`] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>+ Prompt</span>
                        </div>
                      </button>
                    )}

                    {/* Modo Trilíngue (PT, EN e ES) */}
                    {(result.language === 'all' || (scene.dialoguePt && scene.dialogueEn && scene.dialogueEs)) && (
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
                    )}
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

              {/* Seletor de Carrosséis em Lote (se houver mais de 1 carrossel gerado) */}
              {batchCarouselResults && batchCarouselResults.length > 1 && (
                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950/50 border border-indigo-500/30 rounded-2xl p-5 shadow-2xl flex flex-col gap-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-700/60">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/20 shrink-0">
                        <Layers className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <h3 className="text-base font-black text-white tracking-tight">Lote de Carrosséis Gerados</h3>
                          <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-black rounded-lg">
                            {batchCarouselResults.length} carrosséis
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          Selecione um carrossel para visualizar, editar ou exportar.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleSendAllCarouselsToAudit}
                      className="px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer border border-indigo-400/30"
                      title="Enviar todos os roteiros para a esteira de Auditoria e Separação de Imagens"
                    >
                      <Sparkles className="w-4 h-4 text-yellow-300 animate-pulse" />
                      <span>⚡ Enviar Todos para Auditoria ({batchCarouselResults.length})</span>
                    </button>
                  </div>

                  {/* Grade de Carrosséis */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {batchCarouselResults.map((car, cIdx) => {
                      const isSelected = activeCarouselIndex === cIdx;
                      const title = car.title || car.theme || `Carrossel ${cIdx + 1}`;
                      return (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => handleSelectCarouselIndex(cIdx)}
                          className={`p-4 rounded-xl text-left transition-all duration-200 flex flex-col gap-2.5 cursor-pointer border ${
                            isSelected
                              ? 'bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-indigo-400/60 shadow-lg shadow-indigo-600/25 ring-2 ring-indigo-400/30 scale-[1.02]'
                              : 'bg-slate-800/80 text-slate-300 hover:text-white border-slate-700/60 hover:border-indigo-500/40 hover:bg-slate-800 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className={`w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-white/20 text-white' : 'bg-slate-700/80 text-slate-300'
                              }`}>
                                {cIdx + 1}
                              </span>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                                isSelected ? 'bg-white/15 text-indigo-100' : 'bg-slate-900/80 text-slate-400 border border-slate-700/60'
                              }`}>
                                {car.slides?.length || 0} slides
                              </span>
                            </div>
                            {isSelected && (
                              <span className="text-[9px] font-black uppercase bg-white/20 px-2 py-0.5 rounded-md text-white/80">Ativo</span>
                            )}
                          </div>
                          <p className={`text-sm font-bold leading-snug line-clamp-2 ${
                            isSelected ? 'text-white' : 'text-slate-200'
                          }`} title={title}>
                            {title}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Barra de Ações e Exportação com Alto Contraste */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm md:text-base font-black text-white truncate max-w-md">
                      {carouselResult.title ? `📑 ${carouselResult.title}` : '📑 Carrossel Estruturado'}
                    </h4>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-md border border-emerald-500/30">
                        {carouselResult.slides?.length || 0} Slides
                      </span>
                      <span className="px-2 py-0.5 bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold rounded-md border border-indigo-500/30">
                        Estilo: {artStyle}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center flex-wrap gap-2">
                  {(!batchCarouselResults || batchCarouselResults.length <= 1) && (
                    <button
                      type="button"
                      onClick={handleSendAllCarouselsToAudit}
                      className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-indigo-500/40 shadow-sm transition cursor-pointer"
                      title="Enviar este roteiro para a Auditoria Visual"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" /> Enviar para Auditoria
                    </button>
                  )}
                  <button 
                    onClick={exportAsTXT} 
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-700 hover:border-slate-600 transition cursor-pointer shadow-sm" 
                    title={batchCarouselResults.length > 1 ? `Exportar todos os ${batchCarouselResults.length} carrosséis em arquivo TXT` : 'Exportar TXT'}
                  >
                    <FileText className="w-4 h-4 text-slate-400" /> {batchCarouselResults.length > 1 ? `TXT (${batchCarouselResults.length} Carrosséis)` : 'TXT'}
                  </button>
                  <button 
                    onClick={exportAsDOCX} 
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-blue-500 transition cursor-pointer shadow-sm"
                    title={batchCarouselResults.length > 1 ? `Exportar todos os ${batchCarouselResults.length} carrosséis em Word (.DOCX)` : 'Exportar DOCX'}
                  >
                    <FileText className="w-4 h-4" /> DOCX
                  </button>
                  <button 
                    onClick={exportAsPDF} 
                    className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-red-500 transition shadow-sm cursor-pointer"
                    title={batchCarouselResults.length > 1 ? `Exportar todos os ${batchCarouselResults.length} carrosséis em PDF` : 'Exportar PDF'}
                  >
                    <Download className="w-4 h-4" /> PDF
                  </button>
                </div>
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
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Copiar Prompt + Diálogo
                        </h4>
                        {carouselResult.language && carouselResult.language !== 'all' && (
                          <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30 uppercase">
                            {carouselResult.language === 'en' ? '🇺🇸 Inglês' : carouselResult.language === 'es' ? '🇪🇸 Espanhol' : '🇧🇷 Português'}
                          </span>
                        )}
                      </div>

                      {/* Se foi gerado para 1 idioma específico */}
                      {(carouselResult.language === 'pt' || (!carouselResult.language && slide.textInBubblesPt && !slide.textInBubblesEn && !slide.textInBubblesEs)) && (
                        <button 
                          onClick={() => handleCopy(`${slide.imagePromptEn}\n\nDialogue (PT): "${slide.textInBubblesPt || slide.textInBubbles}"`, `cb_pt_${index}`)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition border border-emerald-500/30 group shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">🇧🇷 PT</span>
                            <p className="text-xs text-slate-100 font-medium italic truncate">"{slide.textInBubblesPt || slide.textInBubbles}"</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase shrink-0 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition">
                            {copiedStates[`cb_pt_${index}`] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>+ Prompt</span>
                          </div>
                        </button>
                      )}

                      {(carouselResult.language === 'en' || (!carouselResult.language && slide.textInBubblesEn && !slide.textInBubblesPt && !slide.textInBubblesEs)) && (
                        <button 
                          onClick={() => handleCopy(`${slide.imagePromptEn}\n\nDialogue (EN): "${slide.textInBubblesEn || slide.textInBubbles}"`, `cb_en_${index}`)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition border border-emerald-500/30 group shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">🇺🇸 EN</span>
                            <p className="text-xs text-slate-100 font-medium italic truncate">"{slide.textInBubblesEn || slide.textInBubbles}"</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase shrink-0 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition">
                            {copiedStates[`cb_en_${index}`] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>+ Prompt</span>
                          </div>
                        </button>
                      )}

                      {(carouselResult.language === 'es' || (!carouselResult.language && slide.textInBubblesEs && !slide.textInBubblesPt && !slide.textInBubblesEn)) && (
                        <button 
                          onClick={() => handleCopy(`${slide.imagePromptEn}\n\nDialogue (ES): "${slide.textInBubblesEs || slide.textInBubbles}"`, `cb_es_${index}`)}
                          className="w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition border border-emerald-500/30 group shadow-sm"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">🇪🇸 ES</span>
                            <p className="text-xs text-slate-100 font-medium italic truncate">"{slide.textInBubblesEs || slide.textInBubbles}"</p>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase shrink-0 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white transition">
                            {copiedStates[`cb_es_${index}`] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>+ Prompt</span>
                          </div>
                        </button>
                      )}

                      {/* Modo Trilíngue (PT, EN e ES) — APENAS quando idioma é explicitamente 'all' */}
                      {carouselResult.language === 'all' && (
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
                              {copiedStates[`cb_pt_${index}`] ? <Check className="w-3" /> : <Copy className="w-3" />}
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
                              {copiedStates[`cb_en_${index}`] ? <Check className="w-3" /> : <Copy className="w-3" />}
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
                              {copiedStates[`cb_es_${index}`] ? <Check className="w-3" /> : <Copy className="w-3" />}
                              <span>+ Prompt</span>
                            </div>
                          </button>
                        </div>
                      )}
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
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
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
                  setSelectedProviderTab('groq');
                  setTestResult(null);
                  setKeyManagerError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                  selectedProviderTab === 'groq'
                    ? 'bg-white text-orange-700 border-orange-200/80 shadow-xs'
                    : 'bg-slate-100/70 hover:bg-slate-100 text-slate-600 border-transparent'
                }`}
              >
                <Zap className={`w-4 h-4 ${selectedProviderTab === 'groq' ? 'text-orange-600' : 'text-slate-400'}`} />
                <span>Groq Cloud (Ultra Rápido)</span>
                {activeProvider === 'groq' && (
                  <span className="px-1.5 py-0.5 bg-orange-100 text-orange-800 border border-orange-200 text-[9px] font-extrabold rounded-full">
                    Ativo
                  </span>
                )}
                {groqKeysStats.total > 0 && activeProvider !== 'groq' && (
                  <span className="px-1.5 py-0.5 bg-slate-200/80 text-slate-600 text-[9px] font-bold rounded-full">
                    {groqKeysStats.free} chaves
                  </span>
                )}
                <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black rounded-md">
                  FREE
                </span>
              </button>

              <button
                onClick={() => {
                  setSelectedProviderTab('openrouter');
                  setTestResult(null);
                  setKeyManagerError(null);
                }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all cursor-pointer border ${
                  selectedProviderTab === 'openrouter'
                    ? 'bg-white text-amber-700 border-amber-200/80 shadow-xs'
                    : 'bg-slate-100/70 hover:bg-slate-100 text-slate-600 border-transparent'
                }`}
              >
                <Cpu className={`w-4 h-4 ${selectedProviderTab === 'openrouter' ? 'text-amber-600' : 'text-slate-400'}`} />
                <span>OpenRouter (Nemotron)</span>
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
                      <span>Alta Disponibilidade & Failover Triplo (Gemini ⇄ Groq ⇄ OpenRouter)</span>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[9px] font-black rounded-full border border-emerald-500/30">ATIVO</span>
                    </h5>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Se as cotas do seu provedor ativo esgotarem (429), o PostForge alterna instantaneamente para Groq Cloud, Gemini ou OpenRouter sem parar seu fluxo de produção.
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
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{testResult.success ? 'Conexão Estabelecida!' : 'Erro na Conexão:'}</p>
                    {testResult.message.split('\n').map((line, idx) => (
                      <p key={idx} className={`${idx === 0 ? 'mt-1 font-semibold' : 'mt-0.5'} text-slate-600 text-[11px] break-words`}>{line}</p>
                    ))}
                  </div>
                  <button
                    onClick={() => setTestResult(null)}
                    className={`${testResult.success ? 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-100' : 'text-rose-700 hover:text-rose-900 hover:bg-rose-100'} text-[10px] font-bold p-1 rounded-lg cursor-pointer shrink-0`}
                  >
                    <X className="w-3 h-3" />
                  </button>
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

                  {/* Relatório de Verificação de Saúde das Chaves OpenRouter */}
                  {openrouterVerificationReport && (
                    <div className="p-3.5 bg-amber-50/90 border border-amber-200 text-amber-900 text-xs rounded-2xl flex items-center justify-between gap-2 text-left animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>Verificação OpenRouter concluída às {openrouterVerificationReport.verifiedAt}:</strong> {openrouterVerificationReport.free} chaves ativas com cota disponível, {openrouterVerificationReport.exhausted} esgotadas/inválidas.
                        </span>
                      </div>
                      <button
                        onClick={() => setOpenrouterVerificationReport(null)}
                        className="text-amber-700 hover:text-amber-900 text-[10px] font-bold p-1 hover:bg-amber-100 rounded-lg cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Cards de Resumo das Chaves OpenRouter com Ações de Verificação */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status do Pool de Chaves OpenRouter</h4>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetOpenRouterKeys}
                          className="text-[10px] font-bold text-slate-500 hover:text-slate-700 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                          title="Restaurar status de todas as chaves OpenRouter para Livres"
                        >
                          Resetar Status
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyAllOpenRouterKeys}
                          disabled={isVerifyingOpenRouterKeys}
                          className="text-[10px] font-bold text-amber-700 hover:text-amber-900 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-lg transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${isVerifyingOpenRouterKeys ? 'animate-spin' : ''}`} />
                          <span>{isVerifyingOpenRouterKeys ? 'Verificando...' : 'Medir Cotas de Todas'}</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Contas/Chaves</p>
                        <p className="text-2xl font-black text-slate-800 mt-1">{openrouterKeysStats.total}</p>
                      </div>
                      <div className="p-3.5 bg-emerald-50/50 border border-emerald-100/80 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider">Chaves Ativas</p>
                        <p className="text-2xl font-black text-emerald-600 mt-1">{openrouterKeysStats.free}</p>
                      </div>
                      <div className="p-3.5 bg-amber-50/50 border border-amber-100/80 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-wider">Esgotadas / 429</p>
                        <p className="text-2xl font-black text-amber-600 mt-1">{openrouterKeysStats.exhausted}</p>
                      </div>
                    </div>
                  </div>

                  {/* Informação e Campo de Cadastro de Múltiplas Chaves OpenRouter */}
                  <div className="p-5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                    <div className="p-3 bg-amber-50/80 border border-amber-200/60 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
                      <KeyRound className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Pool de Múltiplas Contas / Chaves:</span> Cadastre quantas chaves OpenRouter desejar (<span className="font-mono font-bold">sk-or-v1-...</span>). Quando a cota de uma conta se esgotar (429), o sistema alternará automaticamente para a próxima chave, e se todas esgotarem fará failover para o Gemini!
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span>Adicionar Chaves OpenRouter (cole uma por linha ou separadas por vírgula)</span>
                      </label>
                      <a 
                        href="https://openrouter.ai/keys" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-[10px] text-amber-700 hover:underline flex items-center gap-1 font-bold"
                      >
                        <span>Obter chave no OpenRouter</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    </div>

                    <div className="space-y-2">
                      <textarea
                        value={openrouterMultiKeysInput}
                        onChange={(e) => setOpenrouterMultiKeysInput(e.target.value)}
                        placeholder="Cole aqui suas chaves OpenRouter (uma por linha):&#10;sk-or-v1-conta1...&#10;sk-or-v1-conta2..."
                        rows={2}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
                      />
                      
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-slate-500" />
                          <span>{isUploadingOpenRouterKeys ? 'Carregando...' : 'Importar Arquivo .txt'}</span>
                          <input 
                            type="file" 
                            accept=".txt" 
                            onChange={handleOpenRouterKeysFileUpload} 
                            className="hidden"
                            disabled={isUploadingOpenRouterKeys}
                          />
                        </label>

                        <button
                          onClick={handleAddOpenRouterMultiKeys}
                          disabled={!openrouterMultiKeysInput.trim() || isUploadingOpenRouterKeys}
                          className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          {isUploadingOpenRouterKeys ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                          <span>Adicionar Chaves ao Pool</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Chaves OpenRouter Carregadas com Status Detalhado */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Chaves Rotativas OpenRouter Cadastradas</h4>
                      <span className="text-[10px] text-slate-400">{openrouterKeysStats.keysList.length} cadastradas</span>
                    </div>
                    
                    {openrouterKeysStats.keysList.length === 0 ? (
                      <div className="py-6 text-center border border-slate-100 rounded-2xl bg-slate-50/20">
                        <Key className="w-7 h-7 text-slate-300 mx-auto mb-2" />
                        <p className="text-xs text-slate-400 font-medium">Nenhuma chave OpenRouter adicionada ao pool.</p>
                        <p className="text-[10px] text-slate-400/80 mt-0.5">Cole uma ou mais chaves acima para ativar a alternância inteligente.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xs">
                        <div className="max-h-52 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500">
                                <th className="p-3">Chave OpenRouter</th>
                                <th className="p-3">Status & Cota</th>
                                <th className="p-3 text-center">Sucessos</th>
                                <th className="p-3 text-center">Falhas</th>
                                <th className="p-3 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {openrouterKeysStats.keysList.map((keyObj) => (
                                <tr key={keyObj.id} className="hover:bg-slate-50/50 transition">
                                  <td className="p-3 font-mono text-[11px] text-slate-600">
                                    <div className="font-bold flex items-center gap-1.5">
                                      <span>{keyObj.keyMasked}</span>
                                      {keyObj.label && (
                                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 text-[9px] font-sans font-medium rounded-md">
                                          {keyObj.label}
                                        </span>
                                      )}
                                    </div>
                                    {keyObj.lastVerified && (
                                      <div className="text-[9px] text-slate-400 font-sans mt-0.5">Verificada: {keyObj.lastVerified}</div>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${keyObj.status === 'free' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                      {keyObj.status === 'free' ? 'Ativa / Livre' : 'Cota Esgotada (429)'}
                                    </span>
                                    {keyObj.creditsRemaining !== undefined && (
                                      <div className="text-[9px] text-emerald-700 font-semibold mt-0.5 font-mono">
                                        Saldo: ~${keyObj.creditsRemaining.toFixed(2)} USD
                                      </div>
                                    )}
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
                                      onClick={() => handleRemoveOpenRouterKey(keyObj.id)}
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

              {/* ======================= ABA GROQ CLOUD ======================= */}
              {selectedProviderTab === 'groq' && (
                <div className="space-y-6 text-left">
                  {/* Card de Status Ativo do Groq */}
                  <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-orange-600 text-white flex items-center justify-center">
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Provedor Groq Cloud (LPU Ultra-Fast)</h4>
                        <p className="text-[11px] text-slate-500">
                          {activeProvider === 'groq' 
                            ? 'Este é o motor atualmente ativo para geração de roteiros e carrosséis com altíssima velocidade.' 
                            : 'Atualmente inativo. Clique ao lado para ativar o Groq Cloud como motor principal.'}
                        </p>
                      </div>
                    </div>

                    {activeProvider === 'groq' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-100 text-orange-800 text-xs font-bold rounded-xl border border-orange-300">
                        <Check className="w-3.5 h-3.5" /> IA Ativa
                      </span>
                    ) : (
                      <button
                        onClick={() => handleSelectActiveProvider('groq')}
                        className="px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Definir Groq como IA Ativa
                      </button>
                    )}
                  </div>

                  {/* Feedback de Relatório de Verificação de Chaves Groq */}
                  {groqVerificationReport && (
                    <div className="p-3.5 bg-orange-50 border border-orange-200 text-orange-950 text-xs rounded-2xl flex items-center justify-between gap-2 text-left animate-in fade-in">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-orange-600 shrink-0" />
                        <span>
                          <strong>Cotas Groq auditadas às {groqVerificationReport.verifiedAt}:</strong> {groqVerificationReport.free} chaves com cota ativa, {groqVerificationReport.exhausted} esgotadas/inválidas.
                        </span>
                      </div>
                      <button
                        onClick={() => setGroqVerificationReport(null)}
                        className="text-orange-700 hover:text-orange-900 text-[10px] font-bold p-1 hover:bg-orange-100 rounded-lg cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}

                  {/* Card de Medidor de Cota em Tempo Real do Groq */}
                  <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        <span className="text-xs font-bold tracking-wide uppercase text-slate-300">Telemetria de Cota Groq (LPU Headers)</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => fetchGroqQuota()}
                        disabled={isLoadingGroqQuota}
                        className="text-[10px] font-bold text-orange-300 hover:text-orange-200 bg-orange-500/20 hover:bg-orange-500/30 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3 h-3 ${isLoadingGroqQuota ? 'animate-spin' : ''}`} />
                        <span>{isLoadingGroqQuota ? 'Consultando...' : 'Atualizar Cota'}</span>
                      </button>
                    </div>

                    {groqQuota ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Requisições Restantes (RPM)</p>
                          <p className="text-xl font-black text-emerald-400 mt-0.5">
                            {groqQuota.requestsRemaining !== undefined ? groqQuota.requestsRemaining.toLocaleString() : 'Ilimitado'}
                            {groqQuota.requestsLimit ? <span className="text-xs text-slate-400 font-normal"> / {groqQuota.requestsLimit}</span> : null}
                          </p>
                          {groqQuota.resetRequests && (
                            <p className="text-[9px] text-slate-400 mt-1">Reseta em: {groqQuota.resetRequests}</p>
                          )}
                        </div>
                        <div className="p-3 bg-slate-800/80 rounded-xl border border-slate-700/80">
                          <p className="text-[10px] uppercase font-bold text-slate-400">Tokens Restantes (TPM)</p>
                          <p className="text-xl font-black text-orange-400 mt-0.5">
                            {groqQuota.tokensRemaining !== undefined ? `${(groqQuota.tokensRemaining / 1000).toFixed(0)}k` : 'Ilimitado'}
                            {groqQuota.tokensLimit ? <span className="text-xs text-slate-400 font-normal"> / ${(groqQuota.tokensLimit / 1000).toFixed(0)}k</span> : null}
                          </p>
                          {groqQuota.resetTokens && (
                            <p className="text-[9px] text-slate-400 mt-1">Reseta em: {groqQuota.resetTokens}</p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-slate-800/50 rounded-xl border border-slate-700/50 text-center">
                        <p className="text-xs text-slate-400 font-medium">
                          {groqQuotaError || 'Adicione suas chaves Groq (gsk_...) para monitorar as cotas em tempo real.'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Cadastro e Upload de Múltiplas Chaves Groq */}
                  <div className="p-4 bg-orange-50/40 border border-orange-200/70 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-orange-600" />
                          <span>Pool de Chaves Groq Cloud (Multi-Chaves)</span>
                        </h4>
                        <p className="text-[10px] text-slate-500">Cole uma ou mais chaves (gsk_...) ou carregue um arquivo .txt</p>
                      </div>
                      
                      <label className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5">
                        <Upload className="w-3 h-3 text-orange-600" />
                        <span>{isUploadingGroqKeys ? 'Importando...' : 'Importar .txt'}</span>
                        <input 
                          type="file" 
                          accept=".txt" 
                          onChange={handleGroqKeysFileUpload} 
                          className="hidden" 
                          disabled={isUploadingGroqKeys}
                        />
                      </label>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2">
                      <textarea
                        value={groqMultiKeysInput}
                        onChange={(e) => setGroqMultiKeysInput(e.target.value)}
                        placeholder="Cole uma ou várias chaves Groq (gsk_...) separadas por linha..."
                        rows={2}
                        className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20 resize-none"
                      />
                      <button
                        type="button"
                        onClick={handleAddGroqMultiKeys}
                        disabled={!groqMultiKeysInput.trim() || isUploadingGroqKeys}
                        className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 shrink-0 self-stretch sm:self-auto"
                      >
                        {isUploadingGroqKeys ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                        <span>Adicionar ao Pool</span>
                      </button>
                    </div>
                  </div>

                  {/* Tabela de Chaves Groq com Telemetria e Estatísticas */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chaves no Pool Groq</h4>
                        <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[10px] font-black rounded-full">
                          {groqKeysStats.free}/{groqKeysStats.total} Ativas
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleResetGroqKeys}
                          className="text-[10px] font-bold text-slate-600 hover:text-slate-800 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                        >
                          Reativar Esgotadas
                        </button>
                        <button
                          type="button"
                          onClick={handleVerifyAllGroqKeys}
                          disabled={isVerifyingGroqKeys}
                          className="text-[10px] font-bold text-orange-700 hover:text-orange-900 px-2.5 py-1 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition cursor-pointer flex items-center gap-1 disabled:opacity-50"
                        >
                          <RefreshCw className={`w-3 h-3 ${isVerifyingGroqKeys ? 'animate-spin' : ''}`} />
                          <span>{isVerifyingGroqKeys ? 'Auditando...' : 'Medir Cotas de Todas'}</span>
                        </button>
                      </div>
                    </div>

                    {groqKeysStats.keysList.length === 0 ? (
                      <div className="py-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                        <Key className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                        <p className="text-xs text-slate-500 font-medium">Nenhuma chave Groq cadastrada no pool.</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Adicione chaves gratuitas obtidas em console.groq.com/keys para rotacionar.</p>
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                        <div className="max-h-48 overflow-y-auto">
                          <table className="w-full text-left text-xs border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                                <th className="p-2.5">Chave / Label</th>
                                <th className="p-2.5">Status</th>
                                <th className="p-2.5">Cota Restante</th>
                                <th className="p-2.5 text-center">Sucessos</th>
                                <th className="p-2.5 text-center">Falhas</th>
                                <th className="p-2.5 text-right">Ação</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700">
                              {groqKeysStats.keysList.map((keyObj) => (
                                <tr key={keyObj.id} className="hover:bg-orange-50/30 transition">
                                  <td className="p-2.5 font-mono text-[11px] text-slate-600">
                                    <div className="font-bold text-slate-800">{keyObj.label || keyObj.keyMasked}</div>
                                    <div className="text-[9px] text-slate-400 font-mono">{keyObj.keyMasked}</div>
                                  </td>
                                  <td className="p-2.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                      keyObj.status === 'free' 
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                                    }`}>
                                      {keyObj.status === 'free' ? 'Ativa / Livre' : 'Cota Esgotada (429)'}
                                    </span>
                                  </td>
                                  <td className="p-2.5 text-[10px] text-slate-600 font-mono">
                                    {keyObj.requestsRemaining !== undefined ? (
                                      <div>{keyObj.requestsRemaining} reqs • {keyObj.tokensRemaining ? `${Math.round(keyObj.tokensRemaining / 1000)}k tok` : ''}</div>
                                    ) : (
                                      <span className="text-slate-400">Não testada</span>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center text-emerald-600 font-bold">{keyObj.successCount}</td>
                                  <td className="p-2.5 text-center text-rose-500 font-bold">{keyObj.errorCount}</td>
                                  <td className="p-2.5 text-right">
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveGroqKey(keyObj.id)}
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

                  {/* Seleção de Modelos Groq Cloud */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-800">Selecione o Modelo Groq Desejado (Clique para Ativar)</h4>
                        <p className="text-[10px] text-slate-400">Todos os modelos abaixo operam na infraestrutura LPU ultra-rápida do Groq</p>
                      </div>
                      <button
                        onClick={() => setIsCustomGroqModel(!isCustomGroqModel)}
                        className="text-[10px] font-bold text-orange-600 hover:text-orange-800 transition cursor-pointer"
                      >
                        {isCustomGroqModel ? 'Ver Lista Recomendada' : 'Digitar Outro Modelo'}
                      </button>
                    </div>

                    {!isCustomGroqModel ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {POPULAR_GROQ_MODELS.map((m) => {
                          const isSelected = groqModelInput === m.id;
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectGroqModel(m.id)}
                              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'bg-orange-50/80 border-orange-400 ring-2 ring-orange-500/20 shadow-xs'
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
                                <span className="font-semibold text-orange-700/90">{m.tag}</span>
                                {isSelected ? (
                                  <span className="font-bold text-orange-700 flex items-center gap-0.5 bg-orange-100 px-2 py-0.5 rounded-md">
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
                        <label className="text-xs font-bold text-slate-700">Identificador do Modelo no Groq</label>
                        <input
                          type="text"
                          value={groqModelInput}
                          onChange={(e) => handleSelectGroqModel(e.target.value)}
                          placeholder="ex: qwen/qwen3.8-27b ou openai/gpt-oss-120b"
                          className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                        />
                        <p className="text-[10px] text-slate-400">Consulte os modelos disponíveis em console.groq.com/docs/models.</p>
                      </div>
                    )}
                  </div>

                  {/* Configuração de Base URL do Groq */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <label className="text-xs font-bold text-slate-700 block">Base URL da API Groq</label>
                    <input
                      type="text"
                      value={groqBaseUrlInput}
                      onChange={(e) => setGroqBaseUrlInput(e.target.value)}
                      placeholder="https://api.groq.com/openai/v1"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                    />
                  </div>

                  {/* Ações do Groq: Testar e Salvar */}
                  <div className="flex flex-wrap gap-2 justify-end pt-2">
                    <button
                      onClick={() => handleTestProvider('groq')}
                      disabled={isTestingProvider}
                      className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isTestingProvider ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Testar Conexão</span>
                    </button>

                    <button
                      onClick={() => handleSaveGroqSettings(true)}
                      disabled={isSavingProviderSettings}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
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
                {selectedProviderTab === 'groq' && (
                  <>
                    <button 
                      onClick={handleResetGroqKeys}
                      disabled={groqKeysStats.exhausted === 0}
                      className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:hover:bg-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Reativar Esgotadas
                    </button>
                    <button 
                      onClick={handleClearGroqKeys}
                      disabled={groqKeysStats.total === 0}
                      className="px-3.5 py-1.5 border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 disabled:opacity-50 disabled:hover:bg-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Limpar Tudo
                    </button>
                    <button 
                      onClick={() => handleSaveGroqSettings(false)}
                      disabled={isSavingProviderSettings}
                      className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Salvar Alterações
                    </button>
                  </>
                )}
                {selectedProviderTab === 'openrouter' && (
                  <>
                    <button 
                      onClick={handleResetOpenRouterKeys}
                      disabled={openrouterKeysStats.exhausted === 0}
                      className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 disabled:hover:bg-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Reativar Esgotadas
                    </button>
                    <button 
                      onClick={handleClearOpenRouterKeys}
                      disabled={openrouterKeysStats.total === 0}
                      className="px-3.5 py-1.5 border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 disabled:opacity-50 disabled:hover:bg-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Limpar Tudo
                    </button>
                    <button 
                      onClick={() => handleSaveOpenRouterSettings(false)}
                      disabled={isSavingProviderSettings}
                      className="px-3.5 py-1.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-50 text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
                    >
                      Salvar Alterações
                    </button>
                  </>
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

      {/* Modal de Pré-visualização Completa dos Slides Ordenados e Separados */}
      {isPreviewModalOpen && (
        <div 
          onClick={() => setIsPreviewModalOpen(false)}
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700/80 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95"
          >
            {/* Header do Modal */}
            <div className="p-4 sm:p-5 bg-slate-850 border-b border-slate-800 flex flex-col gap-3 text-white">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <Images className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                        {multiProjectsResult?.projetos && multiProjectsResult.projetos.length > 1
                          ? `Preview: ${multiProjectsResult.projetos[activeMultiProjectIndex]?.titulo_projeto || 'Projeto'}`
                          : 'Preview da Sequência de Imagens Separadas & Ordenadas'}
                      </h3>
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black rounded-full">
                        {orderedSlidesList.length} Slides Prontos
                      </span>
                      {surplusImagesList.length > 0 && (
                        <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold rounded-full">
                          {surplusImagesList.length} Sobressalentes
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      {multiProjectsResult?.projetos && multiProjectsResult.projetos.length > 1
                        ? `Projeto ${activeMultiProjectIndex + 1} de ${multiProjectsResult.projetos.length} identificado pela IA.`
                        : 'Confira o storyboard organizado pela IA, ajuste a ordem dos slides se desejar e baixe o pacote pronto.'}
                    </p>
                  </div>
                </div>

                {/* Botões do Topo */}
                <div className="flex items-center gap-2 flex-wrap">
                  {multiProjectsResult?.projetos && multiProjectsResult.projetos.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={handleDownloadAllProjectsZips}
                        disabled={isDownloadingAllZips || isGeneratingZip}
                        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
                        title="Baixar todos os projetos separados em arquivos .ZIP diferentes com nomes inteligentes dados pela IA"
                      >
                        {isDownloadingAllZips ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderArchive className="w-4 h-4" />}
                        <span>{isDownloadingAllZips ? 'Baixando Todos...' : `Baixar Todos os .ZIPs (${multiProjectsResult.projetos.length})`}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadSingleProjectZip()}
                        disabled={isGeneratingZip || isDownloadingAllZips}
                        className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 transition flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        title="Baixar apenas o .ZIP deste projeto"
                      >
                        {isGeneratingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        <span>Baixar este .ZIP</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={handleDownloadOrderedImagesZip}
                      disabled={isGeneratingZip}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md disabled:opacity-50"
                      title="Baixar lote ordenado direto para Downloads"
                    >
                      {isGeneratingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderArchive className="w-4 h-4" />}
                      <span>{isGeneratingZip ? 'Baixando...' : 'Baixar ZIP para Downloads'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setIsPreviewModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    title="Fechar Preview (ESC)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Seletor de Projetos no Modal (se houver mais de 1) */}
              {multiProjectsResult?.projetos && multiProjectsResult.projetos.length > 1 && (
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2 overflow-x-auto pb-1">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" /> Roteiros/Projetos:
                  </span>
                  {multiProjectsResult.projetos.map((proj, pIdx) => {
                    const isSelected = activeMultiProjectIndex === pIdx;
                    return (
                      <button
                        key={proj.id || pIdx}
                        type="button"
                        onClick={() => handleSelectMultiProject(pIdx)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shrink-0 border ${
                          isSelected 
                            ? 'bg-indigo-600 text-white border-indigo-400 shadow-md ring-2 ring-indigo-500/30' 
                            : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        <span>🎯 {pIdx + 1}. {proj.titulo_projeto}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${isSelected ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-400'}`}>
                          {proj.slides_ordenados?.length || 0} slides
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Abas Internas do Preview */}
            <div className="px-4 sm:px-6 pt-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPreviewTab('ordered')}
                  className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer border-b-2 ${
                    previewTab === 'ordered'
                      ? 'bg-slate-800/80 text-indigo-400 border-indigo-500 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/40'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                  <span>Sequência Ordenada ({orderedSlidesList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('surplus')}
                  className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer border-b-2 ${
                    previewTab === 'surplus'
                      ? 'bg-slate-800/80 text-amber-400 border-amber-500 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/40'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Sobressalentes / Descarte ({surplusImagesList.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPreviewTab('report')}
                  className={`px-3 sm:px-4 py-2 text-xs font-bold rounded-t-xl transition flex items-center gap-2 cursor-pointer border-b-2 ${
                    previewTab === 'report'
                      ? 'bg-slate-800/80 text-emerald-400 border-emerald-500 shadow-xs'
                      : 'text-slate-400 hover:text-slate-200 border-transparent hover:bg-slate-800/40'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Parecer & Roteiro</span>
                </button>
              </div>

              {auditResult?.pontuacao_media_geral && (
                <div className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-300 font-bold">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Consistência Média: {auditResult.pontuacao_media_geral}</span>
                </div>
              )}
            </div>

            {/* Conteúdo das Abas */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-950/60">
              
              {/* ABA 1: Sequência Ordenada */}
              {previewTab === 'ordered' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                    <span>Ordem cronológica dos slides. Use os botões ⬆️ ⬇️ em cada card para reposicionar:</span>
                    <span className="font-mono text-[11px] text-slate-500">{orderedSlidesList.length} arquivos mapeados</span>
                  </div>

                  {orderedSlidesList.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 space-y-2">
                      <Images className="w-10 h-10 mx-auto text-slate-600 mb-2" />
                      <p className="font-bold text-slate-400">Nenhum slide na sequência ativa</p>
                      <p className="text-xs">Promova imagens da aba "Sobressalentes" ou execute uma nova auditoria.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {orderedSlidesList.map((item, index) => {
                        const matchedImg = uploadedAuditImages.find(img => 
                          img.name.toLowerCase() === item.imagem_arquivo_correspondente.toLowerCase() ||
                          img.name.toLowerCase().includes(item.imagem_arquivo_correspondente.toLowerCase()) ||
                          item.imagem_arquivo_correspondente.toLowerCase().includes(img.name.toLowerCase())
                        );

                        const ext = matchedImg?.name.split('.').pop() || 'png';
                        const cleanBase = matchedImg?.name.replace(/\.[^/.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_") || 'slide';
                        const sequentialName = `Slide_${String(index + 1).padStart(2, '0')}_${cleanBase}.${ext}`;

                        const scoreNumber = parseInt((item.pontuacao_consistencia || '85').replace(/[^0-9]/g, '')) || 85;
                        const badgeColor = scoreNumber >= 90 
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                          : scoreNumber >= 75 
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' 
                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30';

                        return (
                          <div 
                            key={`${item.slide_numero}-${index}`}
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md hover:border-indigo-500/40 transition group"
                          >
                            {/* Topo do Card */}
                            <div>
                              <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                    {index + 1}
                                  </span>
                                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                                    Slide {index + 1}
                                  </h4>
                                </div>

                                {/* Controles de Ordem */}
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveSlideUp(index)}
                                    disabled={index === 0}
                                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-20 rounded-md transition cursor-pointer"
                                    title="Mover para esquerda/cima"
                                  >
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveSlideDown(index)}
                                    disabled={index === orderedSlidesList.length - 1}
                                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-20 rounded-md transition cursor-pointer"
                                    title="Mover para direita/baixo"
                                  >
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveSlideToSurplus(index)}
                                    className="p-1 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 rounded-md transition cursor-pointer"
                                    title="Descartar deste slide"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>

                              {/* Imagem do Slide */}
                              <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800 mb-3 group/img">
                                {matchedImg ? (
                                  <>
                                    <img 
                                      src={matchedImg.dataUrl} 
                                      alt={item.imagem_arquivo_correspondente} 
                                      className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                                    />
                                    <button
                                      onClick={() => setAuditImageModalUrl({ url: matchedImg.dataUrl, title: `Slide ${index + 1} - ${matchedImg.name}` })}
                                      className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                                      title="Expandir Imagem"
                                    >
                                      <div className="p-1.5 bg-slate-900/80 rounded-lg text-[10px] font-bold flex items-center gap-1">
                                        <ZoomIn className="w-3.5 h-3.5" /> Ver Grande
                                      </div>
                                    </button>
                                  </>
                                ) : (
                                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs p-3 text-center">
                                    <ImageIcon className="w-6 h-6 mb-1 text-slate-600" />
                                    <span className="truncate max-w-full font-mono text-[10px]">{item.imagem_arquivo_correspondente}</span>
                                  </div>
                                )}
                              </div>

                              {/* Nomes dos Arquivos */}
                              <div className="space-y-1 mb-2.5 text-[10px] font-mono">
                                <div className="text-slate-400 truncate" title={`Original: ${item.imagem_arquivo_correspondente}`}>
                                  📁 Original: {item.imagem_arquivo_correspondente}
                                </div>
                                <div className="text-emerald-400 font-bold truncate" title={`Nome no ZIP: ${sequentialName}`}>
                                  📦 No ZIP: {sequentialName}
                                </div>
                              </div>

                              {/* Descrição e Análise */}
                              <div className="space-y-1.5 text-xs">
                                <div className="p-2 bg-slate-950/60 rounded-lg border border-slate-800 text-slate-300 text-[11px] leading-relaxed">
                                  <span className="font-bold text-slate-400 block text-[9px] uppercase">Roteiro:</span>
                                  <p className="line-clamp-2">{item.descricao_esperada}</p>
                                </div>

                                {item.elementos_visuais_identificados && (
                                  <div className="p-2 bg-emerald-950/30 rounded-lg border border-emerald-500/20 text-emerald-200 text-[10px] leading-relaxed">
                                    <span className="font-bold text-emerald-400 block text-[9px] uppercase flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Elementos Identificados:
                                    </span>
                                    <p className="line-clamp-2">{item.elementos_visuais_identificados}</p>
                                  </div>
                                )}

                                {item.feedback_visual && (
                                  <div className="p-2 bg-indigo-950/30 rounded-lg border border-indigo-500/20 text-indigo-200 text-[10px] leading-relaxed">
                                    <span className="font-bold text-indigo-400 block text-[9px] uppercase">IA:</span>
                                    <p className="line-clamp-2">{item.feedback_visual}</p>
                                  </div>
                                )}

                                {/* Trocar Imagem no Preview */}
                                <div className="flex items-center justify-between p-1.5 bg-slate-950/50 rounded-lg border border-slate-800 text-[10px]">
                                  <span className="text-slate-400 font-bold uppercase flex items-center gap-1">
                                    <RefreshCw className="w-3 h-3 text-indigo-400" /> Trocar:
                                  </span>
                                  <select
                                    value={item.imagem_arquivo_correspondente}
                                    onChange={(e) => handleSwapSlideImage(index, e.target.value)}
                                    className="bg-slate-900 border border-slate-700 text-slate-300 text-[10px] rounded px-1.5 py-0.5 font-mono max-w-[150px] truncate focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                  >
                                    <option value={item.imagem_arquivo_correspondente}>Atual: {item.imagem_arquivo_correspondente}</option>
                                    {uploadedAuditImages
                                      .filter(img => img.name !== item.imagem_arquivo_correspondente)
                                      .map(img => (
                                        <option key={img.id} value={img.name}>{img.name}</option>
                                      ))}
                                  </select>
                                </div>
                              </div>
                            </div>

                            {/* Rodapé do Card */}
                            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${badgeColor}`}>
                                {item.pontuacao_consistencia}
                              </span>
                              {matchedImg && (
                                <button
                                  type="button"
                                  onClick={() => saveAs(matchedImg.dataUrl, sequentialName)}
                                  className="text-slate-400 hover:text-indigo-300 text-[10px] flex items-center gap-1 font-bold transition cursor-pointer"
                                  title="Baixar este slide isolado"
                                >
                                  <Download className="w-3 h-3" /> Baixar
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 2: Sobressalentes / Descarte */}
              {previewTab === 'surplus' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                    <span>Imagens que não foram incluídas na sequência principal. Clique em <strong>"+ Usar como Slide"</strong> para reintegrá-las:</span>
                    <span className="font-mono text-[11px] text-slate-500">{surplusImagesList.length} arquivos</span>
                  </div>

                  {surplusImagesList.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 space-y-2">
                      <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
                      <p className="font-bold text-slate-300">Todas as imagens foram utilizadas!</p>
                      <p className="text-xs text-slate-500">Nenhuma imagem sobressalente descartada.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {surplusImagesList.map((surplus, sIdx) => {
                        const matchedImg = uploadedAuditImages.find(img => img.name.toLowerCase() === surplus.nome_arquivo.toLowerCase());
                        return (
                          <div 
                            key={sIdx} 
                            className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-md"
                          >
                            <div className="space-y-2.5">
                              {matchedImg && (
                                <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950 border border-slate-800">
                                  <img 
                                    src={matchedImg.dataUrl} 
                                    alt={surplus.nome_arquivo}
                                    onClick={() => setAuditImageModalUrl({ url: matchedImg.dataUrl, title: surplus.nome_arquivo })}
                                    className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                                  />
                                </div>
                              )}
                              <div>
                                <p className="text-xs font-bold text-slate-200 font-mono truncate">{surplus.nome_arquivo}</p>
                                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                                  {surplus.motivo_descarte}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handlePromoteSurplusToSlide(surplus)}
                              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Adicionar como Slide {orderedSlidesList.length + 1}</span>
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ABA 3: Parecer & Roteiro */}
              {previewTab === 'report' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Resumo da IA */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-400" /> Parecer de Continuidade Visual da IA
                    </h4>
                    <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-200 leading-relaxed max-h-72 overflow-y-auto">
                      {auditResult?.resumo_geral_consistencia || 'Nenhum resumo disponível.'}
                    </div>
                  </div>

                  {/* Roteiro de Referência */}
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-400" /> Roteiro Utilizado na Auditoria
                    </h4>
                    <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap max-h-72 overflow-y-auto">
                      {auditScriptInput || 'Nenhum roteiro inserido.'}
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Rodapé do Modal com Informações de Download e Botões */}
            <div className="p-4 sm:p-5 bg-slate-850 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              {/* Lado Esquerdo: Info de Download */}
              <div className="flex items-center gap-2 min-w-0">
                {downloadSuccessInfo ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold truncate">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="truncate">Salvo em: {downloadSuccessInfo.savedPath || downloadSuccessInfo.filename}</span>
                    {downloadSuccessInfo.savedPath && (
                      <button
                        type="button"
                        onClick={() => handleOpenFolder(downloadSuccessInfo.savedPath)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold transition shrink-0 cursor-pointer shadow-xs ml-1 flex items-center gap-1"
                      >
                        <FolderArchive className="w-3 h-3" /> Abrir Pasta
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">
                    O arquivo ZIP conterá a pasta <strong>imagens_ordenadas</strong> com cada slide numerado.
                  </span>
                )}
              </div>

              {/* Lado Direito: Ações */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Fechar Preview
                </button>

                {multiProjectsResult?.projetos && multiProjectsResult.projetos.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={handleDownloadAllProjectsZips}
                      disabled={isDownloadingAllZips || isGeneratingZip}
                      className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                      title="Baixar todos os projetos separados em arquivos .ZIP diferentes"
                    >
                      {isDownloadingAllZips ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderArchive className="w-4 h-4" />}
                      <span>{isDownloadingAllZips ? 'Baixando Todos...' : `Baixar Todos os .ZIPs (${multiProjectsResult.projetos.length})`}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSingleProjectZip()}
                      disabled={isGeneratingZip || isDownloadingAllZips || orderedSlidesList.length === 0}
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 transition flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50"
                      title="Baixar apenas o .ZIP do projeto selecionado"
                    >
                      {isGeneratingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      <span>Baixar este .ZIP</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={handleDownloadOrderedImagesZip}
                    disabled={isGeneratingZip || orderedSlidesList.length === 0}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {isGeneratingZip ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderArchive className="w-4 h-4" />}
                    <span>{isGeneratingZip ? 'Gerando e Salvando ZIP...' : 'Baixar Imagens (.ZIP)'}</span>
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Console Global de Logs e Execução no Rodapé */}
      {isLogPanelVisible ? (
        <div 
          className={`fixed bottom-0 left-0 right-0 z-40 bg-slate-950 border-t border-slate-800 text-slate-300 shadow-2xl backdrop-blur-md transition-all duration-300 flex flex-col ${
            isLogPanelOpen ? 'h-64 sm:h-72' : 'h-8.5'
          }`}
        >
          {/* Barra de Título / Status Bar */}
          <div 
            onClick={() => setIsLogPanelOpen(prev => !prev)}
            className="h-8.5 px-4 bg-slate-900/90 hover:bg-slate-900 flex items-center justify-between cursor-pointer select-none transition border-b border-slate-800/60"
          >
            {/* Lado Esquerdo: Indicador e Última Mensagem */}
            <div className="flex items-center gap-2.5 overflow-hidden pr-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-[11px] font-bold text-slate-200 tracking-wide font-mono">
                  LOGS
                </span>
                {executionLogs.some(l => l.level === 'error') ? (
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                ) : isAuditing || isLoading || isExtractingDoc || isLoadingQuota ? (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </div>

              {/* Última linha de log resumida */}
              {executionLogs.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 truncate">
                  <span className="text-slate-500 text-[10px]">[{executionLogs[executionLogs.length - 1].timestamp}]</span>
                  <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 text-[9px] rounded font-bold uppercase tracking-wider">
                    {executionLogs[executionLogs.length - 1].category}
                  </span>
                  <span className={`truncate ${
                    executionLogs[executionLogs.length - 1].level === 'error' ? 'text-rose-400 font-semibold' :
                    executionLogs[executionLogs.length - 1].level === 'warning' ? 'text-amber-300' :
                    executionLogs[executionLogs.length - 1].level === 'success' ? 'text-emerald-400' :
                    'text-slate-300'
                  }`}>
                    {executionLogs[executionLogs.length - 1].message}
                  </span>
                </div>
              )}
            </div>

            {/* Lado Direito: Contadores e Ações */}
            <div 
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-2 shrink-0 text-slate-400 text-xs"
            >
              {/* Badge de Contagem */}
              <div className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="px-1.5 py-0.5 bg-slate-800/80 rounded text-slate-300">
                  {executionLogs.length} logs
                </span>
                {executionLogs.filter(l => l.level === 'error').length > 0 && (
                  <span className="px-1.5 py-0.5 bg-rose-950/80 border border-rose-800/60 rounded text-rose-400 font-bold">
                    {executionLogs.filter(l => l.level === 'error').length} erros
                  </span>
                )}
              </div>

              {/* Botão Copiar */}
              <button
                onClick={handleCopyLogs}
                title="Copiar todos os logs"
                className="p-1 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              >
                {copiedStates['all_logs'] ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Botão Limpar */}
              <button
                onClick={handleClearLogs}
                title="Limpar logs"
                className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              {/* Botão Alternar Abrir/Fechar Gaveta */}
              <button
                onClick={() => setIsLogPanelOpen(prev => !prev)}
                title={isLogPanelOpen ? "Recolher Console" : "Expandir Console"}
                className="p-1 hover:text-white hover:bg-slate-800 rounded transition cursor-pointer"
              >
                {isLogPanelOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>

              {/* Botão Ocultar Barra Completamente */}
              <button
                onClick={() => setIsLogPanelVisible(false)}
                title="Ocultar console do rodapé"
                className="p-1 hover:text-rose-400 hover:bg-slate-800 rounded transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Conteúdo Expandido do Terminal */}
          {isLogPanelOpen && (
            <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
              {/* Filtros e Opções */}
              <div className="px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-3 text-xs">
                {/* Abas de Filtro */}
                <div className="flex items-center gap-1 overflow-x-auto py-0.5">
                  <button
                    onClick={() => setLogFilter('all')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition cursor-pointer ${
                      logFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    Todos ({executionLogs.length})
                  </button>
                  <button
                    onClick={() => setLogFilter('ai')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition cursor-pointer ${
                      logFilter === 'ai' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    🤖 IA & Modelos ({executionLogs.filter(l => ['IA', 'GERADOR', 'ANÁLISE', 'COTA', 'FAILOVER', 'CHAVES', 'CONFIG'].includes(l.category)).length})
                  </button>
                  <button
                    onClick={() => setLogFilter('audit')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition cursor-pointer ${
                      logFilter === 'audit' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    🔍 Auditoria ({executionLogs.filter(l => l.category === 'AUDITORIA').length})
                  </button>
                  <button
                    onClick={() => setLogFilter('doc')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition cursor-pointer ${
                      logFilter === 'doc' ? 'bg-sky-600 text-white shadow-xs' : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    📄 Documentos & Imagens ({executionLogs.filter(l => ['DOCUMENTO', 'IMAGEM', 'EXPORTAÇÃO'].includes(l.category)).length})
                  </button>
                  <button
                    onClick={() => setLogFilter('error')}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition cursor-pointer ${
                      logFilter === 'error' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                    }`}
                  >
                    🚨 Erros ({executionLogs.filter(l => l.level === 'error').length})
                  </button>
                </div>

                {/* Auto Scroll Checkbox */}
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 select-none cursor-pointer hover:text-slate-300">
                  <input
                    type="checkbox"
                    checked={autoScrollLogs}
                    onChange={(e) => setAutoScrollLogs(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-0 w-3 h-3 cursor-pointer"
                  />
                  <span>Auto-scroll</span>
                </label>
              </div>

              {/* Lista de Linhas do Console Monospace */}
              <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1.5 select-text">
                {executionLogs
                  .filter(item => {
                    if (logFilter === 'all') return true;
                    if (logFilter === 'ai') return ['IA', 'GERADOR', 'ANÁLISE', 'COTA', 'FAILOVER', 'CHAVES', 'CONFIG'].includes(item.category);
                    if (logFilter === 'audit') return item.category === 'AUDITORIA';
                    if (logFilter === 'doc') return ['DOCUMENTO', 'IMAGEM', 'EXPORTAÇÃO'].includes(item.category);
                    if (logFilter === 'error') return item.level === 'error';
                    return true;
                  })
                  .map((log) => {
                    let badgeColor = 'bg-slate-800 text-slate-300';
                    if (log.category === 'AUDITORIA') badgeColor = 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/40';
                    else if (['IA', 'GERADOR', 'ANÁLISE'].includes(log.category)) badgeColor = 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/40';
                    else if (log.category === 'COTA') badgeColor = 'bg-amber-950/80 text-amber-300 border border-amber-800/40';
                    else if (log.category === 'DOCUMENTO') badgeColor = 'bg-sky-950/80 text-sky-300 border border-sky-800/40';
                    else if (log.category === 'IMAGEM') badgeColor = 'bg-violet-950/80 text-violet-300 border border-violet-800/40';
                    else if (log.category === 'FAILOVER') badgeColor = 'bg-yellow-950/80 text-yellow-300 border border-yellow-800/40';
                    else if (log.category === 'EXPORTAÇÃO') badgeColor = 'bg-fuchsia-950/80 text-fuchsia-300 border border-fuchsia-800/40';
                    else if (log.category === 'ESPIAO') badgeColor = 'bg-orange-950/80 text-orange-300 border border-orange-800/40';

                    let textColor = 'text-slate-300';
                    if (log.level === 'error') textColor = 'text-rose-400 font-medium';
                    else if (log.level === 'warning') textColor = 'text-amber-300';
                    else if (log.level === 'success') textColor = 'text-emerald-300';

                    return (
                      <div key={log.id} className="flex items-start gap-2 hover:bg-slate-900/60 p-0.5 rounded transition">
                        <span className="text-slate-500 text-[10px] shrink-0 select-none">[{log.timestamp}]</span>
                        <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded shrink-0 uppercase tracking-wider ${badgeColor}`}>
                          {log.category}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className={`${textColor} break-all`}>{log.message}</span>
                          {log.details && (
                            <pre className="mt-1 p-2 bg-slate-900/90 border border-slate-800 rounded text-[10px] text-slate-400 overflow-x-auto whitespace-pre-wrap">
                              {log.details}
                            </pre>
                          )}
                        </div>
                      </div>
                    );
                  })}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Botão Flutuante para Reabrir os Logs */
        <button
          onClick={() => { setIsLogPanelVisible(true); setIsLogPanelOpen(true); }}
          className="fixed bottom-3 right-4 z-40 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-850 border border-slate-700 text-slate-200 hover:text-white rounded-full shadow-xl text-xs font-mono flex items-center gap-2 backdrop-blur-sm transition cursor-pointer group"
          title="Exibir Console de Execução e Logs"
        >
          <Terminal className="w-3.5 h-3.5 text-indigo-400 group-hover:rotate-12 transition-transform" />
          <span>Logs ({executionLogs.length})</span>
          {executionLogs.some(l => l.level === 'error') && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>
      )}

      {/* Modal de Zoom em Alta Resolução (Lightbox) no Nível Mais Alto (z-[100]) */}
      {auditImageModalUrl && (
        <div 
          onClick={() => setAuditImageModalUrl(null)}
          className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95"
          >
            {/* Header do Lightbox */}
            <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5 min-w-0 pr-3">
                <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                  <ZoomIn className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-white truncate font-mono">
                    {auditImageModalUrl.title}
                  </h4>
                  <p className="text-[10px] text-slate-400">Pressione ESC ou clique fora para fechar</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => saveAs(auditImageModalUrl.url, auditImageModalUrl.title.replace(/[^a-zA-Z0-9._-]/g, '_'))}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
                  title="Baixar imagem individual"
                >
                  <Download className="w-3.5 h-3.5" /> <span>Baixar Imagem</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAuditImageModalUrl(null)}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                  title="Fechar (ESC)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Imagem em Tamanho Grande */}
            <div 
              onClick={() => setAuditImageModalUrl(null)}
              className="flex-1 p-4 sm:p-6 flex items-center justify-center bg-slate-950 overflow-auto cursor-zoom-out"
            >
              <img 
                src={auditImageModalUrl.url} 
                alt={auditImageModalUrl.title} 
                onClick={(e) => e.stopPropagation()}
                className="max-h-[78vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
