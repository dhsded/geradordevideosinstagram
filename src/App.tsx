import React, { useState, useRef } from 'react';
import { Loader2, Copy, Check, Sparkles, Image as ImageIcon, Clapperboard, MessageSquare, Upload, Key, X, FileText, Download, ArrowLeft, ArrowRight, RotateCw, Play, Square, Trash2, Eye, Compass, Terminal, MousePointer, Keyboard, Cpu, Send, Database, Zap, Settings, Bot, Globe, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, KeyRound, ExternalLink, Layers, DollarSign, Activity, Gauge, BarChart3, Images, ListOrdered, FileCheck2, ZoomIn, AlertTriangle, FolderArchive, Grid, SlidersHorizontal, Sparkle, FileUp, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, FolderPlus, Maximize2, Minimize2, Filter, CheckSquare, Camera, Workflow, ListChecks, Plus, Pause, FolderOpen, BookOpen, Clock, FileCode, CheckCheck, Save, Palette, Code, Edit2, FileDown, Instagram, Video, Flame, Repeat, Shuffle, Users, GripVertical } from 'lucide-react';
import { jsPDF } from "jspdf";
import JSZip from "jszip";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from 'react-resizable-panels';

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
export type CarouselLayoutMode = 'deep_phrases' | 'dialogue_bubbles';
export type TopTypographyStyle = 'sans_bold' | 'serif_editorial' | 'minimalist_clean';

export const TOP_TYPOGRAPHY_STYLES: Record<TopTypographyStyle, { name: string; fontName: string; description: string; sample: string }> = {
  sans_bold: {
    name: 'Caixa Alta Moderna (Sans-Serif Bold)',
    fontName: 'Montserrat / Inter Bold - All Caps',
    description: 'Texto em maiúsculas, negrito marcante, centralizado no topo com respiro limpo. O estilo viral mais compartilhado do Instagram.',
    sample: 'NINGUÉM TE ENSINOU A SE PERDOAR'
  },
  serif_editorial: {
    name: 'Serifada Editorial & Poética',
    fontName: 'Playfair / Merriweather Semibold',
    description: 'Tipografia clássica, elegante e intimista. Ideal para poesia existencial, reflexões profundas e psicologia refinada.',
    sample: 'O silêncio também é uma forma de resposta'
  },
  minimalist_clean: {
    name: 'Minimalista Clean & Espaçada',
    fontName: 'Helvetica / Roboto Light - Tracking Aberto',
    description: 'Linhas finas, elegantes e com respiro visual equilibrado. Para uma estética sofisticada e contemplativa.',
    sample: 'VOCÊ NÃO PRECISA CARREGAR TUDO SOZINHO'
  }
};

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
  layoutMode?: CarouselLayoutMode;
  typographyStyle?: TopTypographyStyle | string;
  coverImagePrompt?: string;
  slides: {
    slideNumber: number;
    imagePromptEn: string;
    textInBubblesPt?: string;
    textInBubblesEn?: string;
    textInBubblesEs?: string;
    textInBubbles?: string;
    topPhrasePt?: string;
    topPhraseEn?: string;
    topPhraseEs?: string;
    topPhrase?: string;
    typographyStyle?: string;
    layoutMode?: CarouselLayoutMode;
    descriptionPt: string;
    imageUrl?: string;
    originalImagePreview?: string;
    originalImageName?: string;
    originalHadCharacter?: boolean;
    characterReplaced?: string;
  }[];
  instagramPost: string;
  isCloned?: boolean;
}

interface ReferencePdfFile {
  name: string;
  data: string;
  mimeType: string;
  size: number;
  text?: string;
  docType?: 'pdf' | 'docx' | 'txt' | 'doc';
}

export const normalizeImageDataUrl = (dataUrl: string, filename = ''): string => {
  if (!dataUrl) return dataUrl;
  
  const isWebp = dataUrl.includes(';base64,UklGR') || 
                 /\.webp$/i.test(filename) || 
                 dataUrl.startsWith('data:image/webp');

  if (isWebp) {
    if (dataUrl.startsWith('data:image/webp;base64,')) {
      return dataUrl;
    }
    const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    return `data:image/webp;base64,${b64}`;
  }

  if (dataUrl.startsWith('data:;') || dataUrl.startsWith('data:application/octet-stream;')) {
    const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'png' || b64.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${b64}`;
    if (ext === 'jpg' || ext === 'jpeg' || b64.startsWith('/9j/')) return `data:image/jpeg;base64,${b64}`;
    if (ext === 'webp' || b64.startsWith('UklGR')) return `data:image/webp;base64,${b64}`;
    if (ext === 'gif' || b64.startsWith('R0lGOD')) return `data:image/gif;base64,${b64}`;
    return `data:image/jpeg;base64,${b64}`;
  }

  return dataUrl;
};

const optimizeImageForAi = async (
  file: File,
  maxDim = 1024,
  quality = 0.85
): Promise<{ base64: string; dataUrl: string; size: number; mimeType: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      let rawDataUrl = (e.target?.result as string) || '';
      rawDataUrl = normalizeImageDataUrl(rawDataUrl, file.name);

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
        const mimeType = file.type && file.type !== 'application/octet-stream' 
          ? file.type 
          : (file.name.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg');
        resolve({
          dataUrl: rawDataUrl,
          base64,
          size: file.size,
          mimeType
        });
      };
      img.onerror = () => {
        const base64 = rawDataUrl.includes('base64,') ? rawDataUrl.split('base64,')[1] : rawDataUrl;
        const mimeType = file.type && file.type !== 'application/octet-stream' 
          ? file.type 
          : (file.name.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg');
        const safeDataUrl = rawDataUrl.startsWith('data:image/') ? rawDataUrl : `data:${mimeType};base64,${base64}`;
        resolve({
          dataUrl: safeDataUrl,
          base64,
          size: file.size,
          mimeType
        });
      };
      img.src = rawDataUrl;
    };
    reader.onerror = () => {
      resolve({ dataUrl: '', base64: '', size: 0, mimeType: 'image/jpeg' });
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

export type NodeColorType = 'purple' | 'indigo' | 'emerald' | 'amber' | 'rose' | 'cyan' | 'blue' | 'fuchsia';

export interface FlowchartNode {
  id: string;
  macroId: string;
  name: string;
  description?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  color?: NodeColorType;
  connections: string[];
  customParams?: Record<string, string>;
  customCode?: string;
  macroData?: SpyMacro;
}

export interface SpyFlowchart {
  id: string;
  name: string;
  description?: string;
  nodes: FlowchartNode[];
  compiledScript?: {
    puppeteer?: string;
    playwright?: string;
    runnerCjs?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export const NODE_COLORS: Record<NodeColorType, { label: string; bg: string; border: string; accent: string; headerBg: string; line: string; hex: string }> = {
  purple: {
    label: 'Roxo (IA & Lógica)',
    bg: 'from-purple-950/70 via-slate-900 to-slate-900',
    border: 'border-purple-500/60 hover:border-purple-400 shadow-purple-500/10',
    accent: 'text-purple-300 bg-purple-500/20 border-purple-500/40',
    headerBg: 'bg-purple-500/25 text-purple-200 border border-purple-400/40',
    line: '#c084fc',
    hex: '#a855f7'
  },
  indigo: {
    label: 'Índigo (Navegador)',
    bg: 'from-indigo-950/70 via-slate-900 to-slate-900',
    border: 'border-indigo-500/60 hover:border-indigo-400 shadow-indigo-500/10',
    accent: 'text-indigo-300 bg-indigo-500/20 border-indigo-500/40',
    headerBg: 'bg-indigo-500/25 text-indigo-200 border border-indigo-400/40',
    line: '#818cf8',
    hex: '#6366f1'
  },
  emerald: {
    label: 'Verde (Download / Conclusão)',
    bg: 'from-emerald-950/70 via-slate-900 to-slate-900',
    border: 'border-emerald-500/60 hover:border-emerald-400 shadow-emerald-500/10',
    accent: 'text-emerald-300 bg-emerald-500/20 border-emerald-500/40',
    headerBg: 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40',
    line: '#34d399',
    hex: '#10b981'
  },
  amber: {
    label: 'Âmbar (Processamento / Fila)',
    bg: 'from-amber-950/70 via-slate-900 to-slate-900',
    border: 'border-amber-500/60 hover:border-amber-400 shadow-amber-500/10',
    accent: 'text-amber-300 bg-amber-500/20 border-amber-500/40',
    headerBg: 'bg-amber-500/25 text-amber-200 border border-amber-400/40',
    line: '#fbbf24',
    hex: '#f59e0b'
  },
  rose: {
    label: 'Rosa (Validação / Alerta)',
    bg: 'from-rose-950/70 via-slate-900 to-slate-900',
    border: 'border-rose-500/60 hover:border-rose-400 shadow-rose-500/10',
    accent: 'text-rose-300 bg-rose-500/20 border-rose-500/40',
    headerBg: 'bg-rose-500/25 text-rose-200 border border-rose-400/40',
    line: '#fb7185',
    hex: '#f43f5e'
  },
  cyan: {
    label: 'Ciano (Coleta / Scraping)',
    bg: 'from-cyan-950/70 via-slate-900 to-slate-900',
    border: 'border-cyan-500/60 hover:border-cyan-400 shadow-cyan-500/10',
    accent: 'text-cyan-300 bg-cyan-500/20 border-cyan-500/40',
    headerBg: 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40',
    line: '#22d3ee',
    hex: '#06b6d4'
  },
  blue: {
    label: 'Azul (API / Dados)',
    bg: 'from-blue-950/70 via-slate-900 to-slate-900',
    border: 'border-blue-500/60 hover:border-blue-400 shadow-blue-500/10',
    accent: 'text-blue-300 bg-blue-500/20 border-blue-500/40',
    headerBg: 'bg-blue-500/25 text-blue-200 border border-blue-400/40',
    line: '#60a5fa',
    hex: '#3b82f6'
  },
  fuchsia: {
    label: 'Fúcsia (Criatividade / Mídia)',
    bg: 'from-fuchsia-950/70 via-slate-900 to-slate-900',
    border: 'border-fuchsia-500/60 hover:border-fuchsia-400 shadow-fuchsia-500/10',
    accent: 'text-fuchsia-300 bg-fuchsia-500/20 border-fuchsia-500/40',
    headerBg: 'bg-fuchsia-500/25 text-fuchsia-200 border border-fuchsia-400/40',
    line: '#e879f9',
    hex: '#d946ef'
  }
};

export interface ClonedVideoScene {
  numero_cena: number;
  enquadramento: string;
  acao_visual: string;
  fala: string;
  prompt_imagem_en: string;
}

export interface ClonedCarouselSlide {
  slide_numero: number;
  tipo: string;
  titulo_slide: string;
  conteudo_texto: string;
  prompt_imagem_en: string;
}

export interface ClonerResultData {
  transcricao_original: {
    dialogo_completo: string;
    gancho_identificado: string;
    analise_retencao: string;
  };
  roteiro_clonado_video: {
    titulo_sugerido: string;
    gancho_novo: string;
    cenas: ClonedVideoScene[];
    cta_final: string;
  };
  carrossel_adaptado: {
    titulo_carrossel: string;
    slides: ClonedCarouselSlide[];
  };
  legenda_instagram: {
    gancho: string;
    corpo: string;
    cta: string;
    hashtags: string[];
  };
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

export interface AuditDetectedBatch {
  id: string;              // ex: "batch_1"
  projectNumber: number;   // 1, 2, 3...
  title: string;           // ex: "A Descoberta do Amor Próprio"
  niche?: string;          // ex: "Psicologia"
  artStyle?: string;       // ex: "Desenho à Mão (Sketched)"
  slideCount: number;      // ex: 6
  formattedScriptText: string; // Bloco formatado com os slides deste projeto
  selected: boolean;       // Marcado para análise
}

export interface LightboxGalleryItem {
  url: string;
  title: string;
  filename?: string;
  slideNumber?: number;
  totalSlides?: number;
  description?: string;
  dialogue?: string;
  prompt?: string;
  consistencyScore?: string;
  consistencyFeedback?: string;
  layoutMode?: CarouselLayoutMode;
  typographyStyle?: string;
}

export interface ExecutionLogItem {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'ai' | 'image' | 'doc';
  category: string;
  message: string;
  details?: string;
}

const NICHES = [
  'Soluções para o Dia a Dia (Faça Você Mesmo)',
  'Fitness',
  'Psicologia',
  'Psiquiatria',
  'Neuropsicologia',
  'Top 10 Filmes e Séries'
];
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
  'Infográfico 3D Didático (Render Amarelo/Vibrante)',
  'Realista Fotográfico / Obra e Oficina',
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
  'Soluções para o Dia a Dia (Faça Você Mesmo)': [
    'Causa e Efeito (Se Essa Peça Falhar...)',
    'A Falta Disso Causa Isso',
    'Mito vs. Verdade (Com Mascote/Especialista)',
    'Macetes de Mestre / Passo a Passo DIY',
    'Diagnóstico Rápido / Como Identificar'
  ],
  'Psicologia': ['Acolhedor / Compassivo', 'Terapêutico / ACT', 'Vulnerável / Íntimo', 'Encorajador / Reparador', 'Psicológico', 'Filosófico', 'Profundidade'],
  'Psiquiatria': ['Acolhedor / Compassivo', 'Terapêutico / ACT', 'Vulnerável / Íntimo', 'Encorajador / Reparador', 'Psicológico', 'Filosófico', 'Profundidade'],
  'Neuropsicologia': ['Acolhedor / Compassivo', 'Terapêutico / ACT', 'Vulnerável / Íntimo', 'Encorajador / Reparador', 'Psicológico', 'Filosófico', 'Profundidade'],
  'Fitness': ['Motivacional', 'Tutorial / Passo a Passo', 'Curiosidades / Mitos'],
  'Top 10 Filmes e Séries': ['Ranking / Top 10', 'Recomendação Secreta', 'Curiosidades / Bastidores']
};

const NICHE_SCRIPT_TONES: Record<string, string[]> = {
  'Soluções para o Dia a Dia (Faça Você Mesmo)': [
    'Passo a Passo / Macete de Obra',
    'Diagnóstico Rápido Automotivo',
    'Mito vs. Verdade',
    'Faça Você Mesmo (DIY)'
  ],
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

export interface MacroPromptItem {
  id: string;
  title: string;
  prompt: string;
  dialoguePt?: string;
  status: 'pending' | 'running' | 'completed' | 'error' | 'skipped';
  checked: boolean;
  carouselId?: string;
  carouselTitle?: string;
  slideNumber?: number;
  repeatCount?: number;
  completedRepeats?: number;
}

export interface MacroCarouselItem {
  id: string;
  title: string;
  count: number;
}

export interface MacroCharacterItem {
  id: string;
  name: string;
  color?: string;
  features?: string;
  avatar?: string;
  enabled: boolean;
  promptTag?: string;
}

// ======================================================
// TIPOS DO EDITOR DE REELS EM MASSA
// ======================================================
export interface ReelsFrame {
  id: string;
  name: string;
  dataUrl: string;     // para preview na UI
  base64Data: string;  // dados raw para enviar ao backend
  mimeType: string;
}

export interface ReelsVideoItem {
  id: string;
  name: string;
  path: string;        // caminho absoluto no sistema de arquivos (Electron)
  fileRef?: File;      // referência ao File original (fallback para modo web/sem path absoluto)
  size: number;        // bytes
  status: 'pending' | 'processing' | 'done' | 'error';
  errorMsg?: string;
  outputPath?: string;
  outputSize?: number;
  thumbnail?: string;  // data URL do frame capturado para preview
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'script' | 'analysis' | 'carousel' | 'spy' | 'audit' | 'reels'>('script');

  // ======================================================
  // ESTADOS DO EDITOR DE REELS EM MASSA
  // ======================================================
  const [reelsFrames, setReelsFrames] = useState<ReelsFrame[]>([]);
  const [reelsVideoQueue, setReelsVideoQueue] = useState<ReelsVideoItem[]>([]);
  const [reelsTopOffsetPercent, setReelsTopOffsetPercent] = useState<number>(35);
  const [reelsCrf, setReelsCrf] = useState<number>(23);
  const [reelsOutputFolder, setReelsOutputFolder] = useState<string>('');
  const [isReelsProcessing, setIsReelsProcessing] = useState<boolean>(false);
  const [reelsProcessingIndex, setReelsProcessingIndex] = useState<number>(-1);
  const [reelsPreviewVideoIndex, setReelsPreviewVideoIndex] = useState<number>(0);
  const [reelsCancelRef] = useState<{ cancelled: boolean }>({ cancelled: false });
  const [isDragOverReelsFrame, setIsDragOverReelsFrame] = useState<boolean>(false);
  const [isDragOverReelsVideo, setIsDragOverReelsVideo] = useState<boolean>(false);
  const reelsVideoInputRef = React.useRef<HTMLInputElement>(null);
  const reelsVideoFolderRef = React.useRef<HTMLInputElement>(null);

  // Browser FLOW / Robô States
  const webviewRef = React.useRef<any>(null);
  const [spyUrl, setSpyUrl] = useState('https://labs.google/fx/pt/tools/flow');
  const [inputUrl, setInputUrl] = useState('https://labs.google/fx/pt/tools/flow');
  const [flowPreloadPath, setFlowPreloadPath] = useState<string>('');
  const [isFlowConnected, setIsFlowConnected] = useState<boolean>(false);

  // Estados do FLOW Macro Studio (vindo da extensão Baixador)
  const [macroActiveTab, setMacroActiveTab] = useState<'prompts' | 'characters' | 'format' | 'telegram' | 'execution'>('prompts');
  const [macroPrompts, setMacroPrompts] = useState<MacroPromptItem[]>([]);
  const [macroCarousels, setMacroCarousels] = useState<MacroCarouselItem[]>([]);
  const [macroSelectedCarousel, setMacroSelectedCarousel] = useState<string>('all');
  const [macroCharacters, setMacroCharacters] = useState<MacroCharacterItem[]>([]);
  const [macroState, setMacroState] = useState<'idle' | 'running' | 'paused' | 'stopped'>('idle');
  const [macroCurrentAction, setMacroCurrentAction] = useState<string>('');
  const [macroCountdown, setMacroCountdown] = useState<{ remaining: number; total: number; label: string }>({ remaining: 0, total: 0, label: '' });
  const [macroElapsedSeconds, setMacroElapsedSeconds] = useState<number>(0);
  const [macroCurrentSlideIndex, setMacroCurrentSlideIndex] = useState<number>(-1);
  const [macroLogs, setMacroLogs] = useState<{ message: string; type: 'info' | 'success' | 'warning' | 'error'; time: string }[]>([]);

  const [macroConfig, setMacroConfig] = useState({
    mediaType: 'image' as 'image' | 'video',
    aspectRatio: '9:16' as '9:16' | '16:9' | '1:1' | '3:4' | '4:3',
    quantity: 4 as 1 | 2 | 3 | 4,
    model: 'Nano Banana 2',
    delaySeconds: 15,
    carouselDelaySeconds: 25,
    repeatPerPrompt: 1,
    reusePreviousCommand: true,
    autoCreateNewProject: false,
    autoDownload: false,
    telegramEnabled: true,
    telegramBotToken: '8680557957:AAGsOQ9pC49uWXktu4ZCJfnI1IRsNC9sbyk',
    telegramChatId: '6969102297',
    telegramSendCover: true,
    telegramSendDetailed: true
  });

  // Estados de Modais Auxiliares do FLOW Macro Studio
  const [isMacroPasteModalOpen, setIsMacroPasteModalOpen] = useState(false);
  const [macroPasteText, setMacroPasteText] = useState('');
  const [isMacroAddPromptModalOpen, setIsMacroAddPromptModalOpen] = useState(false);
  const [macroNewPromptTitle, setMacroNewPromptTitle] = useState('');
  const [macroNewPromptText, setMacroNewPromptText] = useState('');
  const [macroNewPromptDialogue, setMacroNewPromptDialogue] = useState('');
  const [isMacroAddCharModalOpen, setIsMacroAddCharModalOpen] = useState(false);
  const [macroNewCharName, setMacroNewCharName] = useState('');
  const [macroNewCharColor, setMacroNewCharColor] = useState('');
  const [macroNewCharFeatures, setMacroNewCharFeatures] = useState('');
  const [macroNewCharAvatar, setMacroNewCharAvatar] = useState('');
  const [expandedPromptIds, setExpandedPromptIds] = useState<Record<string, boolean>>({});

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

  // Estados do Espião FLOW com IA, Executor e Fluxograma N8N
  const [spySubTab, setSpySubTab] = useState<'recorder' | 'macro' | 'executor' | 'library' | 'flowchart'>('recorder');
  const [flowchartId, setFlowchartId] = useState<string>(() => `flow_${Date.now()}`);
  const [flowchartName, setFlowchartName] = useState<string>('Meu Fluxo de Automação N8N #1');
  const [flowchartDescription, setFlowchartDescription] = useState<string>('');
  const [flowchartNodes, setFlowchartNodes] = useState<FlowchartNode[]>([]);
  const [savedFlowsList, setSavedFlowsList] = useState<SpyFlowchart[]>([]);
  const [isLoadingFlows, setIsLoadingFlows] = useState(false);
  const [isSavedFlowsModalOpen, setIsSavedFlowsModalOpen] = useState(false);
  const [isCodePreviewModalOpen, setIsCodePreviewModalOpen] = useState(false);
  const [activeCodeNode, setActiveCodeNode] = useState<FlowchartNode | null>(null);
  const [renamingFlowId, setRenamingFlowId] = useState<string | null>(null);
  const [renamingFlowName, setRenamingFlowName] = useState<string>('');
  const [flowchartCompiledTab, setFlowchartCompiledTab] = useState<'puppeteer' | 'json'>('puppeteer');

  // Dragging, Resizing & Connecting
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({x: 0, y: 0});
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ startX: number; startY: number; startW: number; startH: number }>({ startX: 0, startY: 0, startW: 210, startH: 120 });
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [colorPickerNodeId, setColorPickerNodeId] = useState<string | null>(null);
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
  const [speechBubbleMode, setSpeechBubbleMode] = useState<'bubbles-ai-safe' | 'clean-art'>('bubbles-ai-safe');
  const [carouselLayoutMode, setCarouselLayoutMode] = useState<CarouselLayoutMode>('deep_phrases');
  const [topTypographyStyle, setTopTypographyStyle] = useState<TopTypographyStyle>('sans_bold');
  const [analyzingCharacterIndex, setAnalyzingCharacterIndex] = useState<{ [key: number]: boolean }>({});
  const [detectedCharacterDetails, setDetectedCharacterDetails] = useState<({ name: string; color: string; secondaryColors: string[]; features: string; englishDesc: string } | undefined)[]>([]);
  
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

  // Image Cloner states (integrated within the Carousel post creator)
  const [carouselCreationMode, setCarouselCreationMode] = useState<'generate' | 'clone'>('generate');
  const [clonerSourceImages, setClonerSourceImages] = useState<{ data: string; mimeType: string; name: string; preview: string }[]>([]);
  const [isCloningImages, setIsCloningImages] = useState(false);
  const [clonerTargetCharMode, setClonerTargetCharMode] = useState<'active' | 'custom' | 'none'>('active');
  const [customCloneCharName, setCustomCloneCharName] = useState('');
  const [customCloneCharColor, setCustomCloneCharColor] = useState('');
  const [customCloneCharDesc, setCustomCloneCharDesc] = useState('');
  const [customCloneCharImg, setCustomCloneCharImg] = useState<{ data: string; mimeType: string; preview: string } | null>(null);

  // Pollinations FLUX Instant Preview States
  const [generatingSlidePreviews, setGeneratingSlidePreviews] = useState<{ [slideIdx: number]: boolean }>({});
  const [isGeneratingAllPreviews, setIsGeneratingAllPreviews] = useState(false);
  const [previewBatchProgress, setPreviewBatchProgress] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const [showPreviewTextOverlay, setShowPreviewTextOverlay] = useState(true);
  const [generatingVideoCoverPreview, setGeneratingVideoCoverPreview] = useState(false);
  const [videoCoverPreviewUrl, setVideoCoverPreviewUrl] = useState<string | null>(null);

  // Video Analysis & Instagram Cloner states
  const [analysisSubTab, setAnalysisSubTab] = useState<'cloner' | 'local'>('cloner');
  const [clonerInputSource, setClonerInputSource] = useState<'file' | 'link' | 'browser'>('file');
  const [isDragOverClonerVideo, setIsDragOverClonerVideo] = useState(false);
  const [instagramUrl, setInstagramUrl] = useState('');
  const [isFetchingInstagram, setIsFetchingInstagram] = useState(false);
  const [instagramVideoPreview, setInstagramVideoPreview] = useState<{ url?: string; thumbnail?: string; title?: string; sourceUrl?: string; isLocalFile?: boolean; base64Data?: string; mimeType?: string } | null>(null);
  const [clonerNiche, setClonerNiche] = useState(NICHES[0]);
  const [clonerTone, setClonerTone] = useState(NICHE_SCRIPT_TONES['Psicologia']?.[0] || 'Acolhedor / Compassivo');
  const [clonerObjective, setClonerObjective] = useState('Clonagem com adaptação autoral e retenção viral');
  const [clonerTranscriptInput, setClonerTranscriptInput] = useState('');
  const [isCloning, setIsCloning] = useState(false);
  const [clonerResult, setClonerResult] = useState<ClonerResultData | null>(null);
  const [clonerActiveViewTab, setClonerActiveViewTab] = useState<'video' | 'carousel' | 'caption' | 'transcript'>('video');
  const [showInstagramBrowser, setShowInstagramBrowser] = useState(false);
  const [instagramBrowserUrl, setInstagramBrowserUrl] = useState('https://www.instagram.com/reels/');
  const instagramWebviewRef = useRef<any>(null);
  const [isCapturingWebviewVideo, setIsCapturingWebviewVideo] = useState(false);

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
  const [detectedAuditBatches, setDetectedAuditBatches] = useState<AuditDetectedBatch[]>([]);
  const [isExtractingDoc, setIsExtractingDoc] = useState(false);
  const [isDragOverDoc, setIsDragOverDoc] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditResult, setAuditResult] = useState<AuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditImageModalUrl, setAuditImageModalUrl] = useState<{ url: string; title: string } | null>(null);
  const [lightboxGallery, setLightboxGallery] = useState<{ items: LightboxGalleryItem[]; currentIndex: number } | null>(null);
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

  const handleClearResults = () => {
    if (!window.confirm('Tem certeza que deseja limpar todos os resultados gerados? Esta ação não pode ser desfeita.')) return;
    setResult(null);
    setCarouselResult(null);
    setBatchCarouselResults([]);
    setActiveCarouselIndex(0);
    setError(null);
    setLastGenerationMeta(null);
    setGeneratingSlidePreviews({});
    setIsGeneratingAllPreviews(false);
    setVideoCoverPreviewUrl(null);
    addLog('info', 'PROJETO', '🗑️ Resultados limpos com sucesso. Interface pronta para nova geração.');
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
      id: 'google/gemma-4-31b-it:free',
      name: 'Google Gemma 4 31B Instruct (Free)',
      tag: 'Mais Recente • Alta Precisão',
      desc: 'Modelo avançado do Google com raciocínio e síntese rápidos e alta aderência a JSON'
    },
    {
      id: 'google/gemma-4-26b-a4b-it:free',
      name: 'Google Gemma 4 26B Instruct (Free)',
      tag: 'Ultraleve • Gratuito',
      desc: 'Modelo ágil do Google com suporte multimodal e respostas dinâmicas'
    },
    {
      id: 'nvidia/nemotron-3-super-120b-a12b:free',
      name: 'NVIDIA Nemotron 3 Super 120B (Free)',
      tag: '120B Parâmetros • Gratuito',
      desc: 'Alta capacidade para narrativas complexas, diagnósticos e carrosséis educativos'
    },
    {
      id: 'nex-agi/nex-n2.5-pro:free',
      name: 'Nex AGI Nex N2.5 Pro (Free)',
      tag: 'Raciocínio & Roteiros • Gratuito',
      desc: 'Excelente capacidade para escrita criativa e ganchos em português'
    },
    {
      id: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      name: 'NVIDIA Nemotron 3 Ultra (Free)',
      tag: '550B Parâmetros • Gratuito',
      desc: 'Ultra alta capacidade para narrativas profundas e análises ricas'
    }
  ];

  const POPULAR_GROQ_MODELS = [
    {
      id: 'openai/gpt-oss-20b',
      name: 'GPT OSS 20B (Recomendado - Ultra Rápido)',
      tag: '131k Contexto • ~8s Resposta',
      desc: 'Mais estável e rápido no Groq. Excelente precisão para JSON e carrosséis em português'
    },
    {
      id: 'openai/gpt-oss-120b',
      name: 'GPT OSS 120B (Máxima Qualidade)',
      tag: '131k Contexto • OpenAI Open Source',
      desc: 'Modelo open-source de 120B parâmetros da OpenAI, profundidade superior'
    },
    {
      id: 'qwen/qwen3.8-27b',
      name: 'Qwen 3.8 27B (Alibaba Cloud)',
      tag: '131k Contexto • Alta Capacidade',
      desc: 'Potente modelo da Alibaba Cloud com 131k de contexto e riqueza semântica'
    },
    {
      id: 'groq/compound-mini',
      name: 'Groq Compound Mini (Agêntico)',
      tag: '131k Contexto • Groq Nativo',
      desc: 'Motor agêntico nativo do Groq com ferramentas integradas e raciocínio avançado'
    }
  ];

  const GEMINI_AVAILABLE_MODELS = [
    { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash (Padrão Recomendado - Mais Recente)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Ultra Rápido)' },
    { id: 'gemini-flash-latest', name: 'Gemini Flash Latest (Versão Estável)' },
    { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash Lite (Ultraleve)' },
    { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Alta Capacidade / Raciocínio)' },
  ];

  // Estados da Central de I.As e Provedores
  const [activeProvider, setActiveProvider] = useState<'gemini' | 'openrouter' | 'groq'>('gemini');
  const [selectedProviderTab, setSelectedProviderTab] = useState<'gemini' | 'openrouter' | 'groq'>('gemini');
  const [geminiModel, setGeminiModel] = useState<string>('gemini-3.6-flash');
  const [openrouterConfig, setOpenrouterConfig] = useState<{
    hasKey: boolean;
    apiKeyMasked: string;
    baseUrl: string;
    model: string;
  }>({
    hasKey: false,
    apiKeyMasked: '',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'google/gemma-4-31b-it:free'
  });
  const [openrouterKeyInput, setOpenrouterKeyInput] = useState('');
  const [openrouterBaseUrlInput, setOpenrouterBaseUrlInput] = useState('https://openrouter.ai/api/v1');
  const [openrouterModelInput, setOpenrouterModelInput] = useState('google/gemma-4-31b-it:free');
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
    model: 'openai/gpt-oss-20b'
  });
  const [groqKeyInput, setGroqKeyInput] = useState('');
  const [groqBaseUrlInput, setGroqBaseUrlInput] = useState('https://api.groq.com/openai/v1');
  const [groqModelInput, setGroqModelInput] = useState('openai/gpt-oss-20b');
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
        if (lightboxGallery) {
          setLightboxGallery(null);
        } else if (auditImageModalUrl) {
          setAuditImageModalUrl(null);
        } else if (isPreviewModalOpen) {
          setIsPreviewModalOpen(false);
        } else if (isKeyManagerOpen) {
          setIsKeyManagerOpen(false);
        }
      } else if (lightboxGallery && lightboxGallery.items.length > 1) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setLightboxGallery(prev => {
            if (!prev) return null;
            const newIdx = (prev.currentIndex - 1 + prev.items.length) % prev.items.length;
            return { ...prev, currentIndex: newIdx };
          });
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setLightboxGallery(prev => {
            if (!prev) return null;
            const newIdx = (prev.currentIndex + 1) % prev.items.length;
            return { ...prev, currentIndex: newIdx };
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxGallery, auditImageModalUrl, isPreviewModalOpen, isKeyManagerOpen]);

  // Restauração Automática do Estado do Gerador / Prompts Salvos no LocalStorage
  React.useEffect(() => {
    try {
      const saved = localStorage.getItem('postforge_saved_state_v1');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.batchCarouselResults && Array.isArray(data.batchCarouselResults) && data.batchCarouselResults.length > 0) {
          setBatchCarouselResults(data.batchCarouselResults);
          const idx = data.activeCarouselIndex || 0;
          setActiveCarouselIndex(idx < data.batchCarouselResults.length ? idx : 0);
          setCarouselResult(data.batchCarouselResults[idx] || data.batchCarouselResults[0]);
        } else if (data.carouselResult) {
          setCarouselResult(data.carouselResult);
          setBatchCarouselResults([data.carouselResult]);
        }
        if (data.result) setResult(data.result);
        if (data.topic) setTopic(data.topic);
        if (data.niche) setNiche(data.niche);
        if (data.artStyle) setArtStyle(data.artStyle);
        if (data.animationStyle) setAnimationStyle(data.animationStyle);
        if (data.dialogueLanguage) setDialogueLanguage(data.dialogueLanguage);
        if (data.carouselQuantity) setCarouselQuantity(data.carouselQuantity);
        if (data.characterDescription) setCharacterDescription(data.characterDescription);
      }
    } catch (e) {
      console.warn('Aviso: falha ao restaurar dados do localStorage:', e);
    }
  }, []);

  // Auto-salvamento do Estado do Gerador no LocalStorage
  React.useEffect(() => {
    if (carouselResult || (batchCarouselResults && batchCarouselResults.length > 0) || result) {
      try {
        const toSave = {
          result,
          carouselResult,
          batchCarouselResults,
          activeCarouselIndex,
          topic,
          niche,
          artStyle,
          animationStyle,
          dialogueLanguage,
          carouselQuantity,
          characterDescription,
          savedAt: Date.now()
        };
        localStorage.setItem('postforge_saved_state_v1', JSON.stringify(toSave));
      } catch (e) {
        console.warn('Aviso: falha ao salvar dados no localStorage:', e);
      }
    }
  }, [carouselResult, batchCarouselResults, result, activeCarouselIndex, topic, niche, artStyle, animationStyle, dialogueLanguage, carouselQuantity, characterDescription]);

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

  // Buscar caminhos dos preloads do espião e do robô FLOW
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
    const getFlowPreload = async () => {
      try {
        const res = await fetch(getApiUrl('/api/flow-preload-path'));
        if (res.ok) {
          const data = await res.json();
          setFlowPreloadPath(data.path);
        }
      } catch (err) {
        console.error('Erro ao obter flow preload do robô:', err);
      }
    };
    getPreload();
    getFlowPreload();
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

      // Eventos do FLOW Macro Studio (Motor do Robô)
      if (channel === 'flow-macro-ready') {
        setIsFlowConnected(true);
        if (webview && typeof webview.send === 'function') {
          webview.send('flow-macro-cmd', {
            cmd: 'SYNC_DATA',
            payload: {
              prompts: macroPrompts,
              carousels: macroCarousels,
              characters: macroCharacters,
              config: macroConfig
            }
          });
        }
      } else if (channel === 'flow-macro-state') {
        const s = data;
        if (s) {
          if (s.state) setMacroState(s.state);
          if (s.currentAction !== undefined) setMacroCurrentAction(s.currentAction);
          if (s.countdown) setMacroCountdown(s.countdown);
          if (s.elapsedSeconds !== undefined) setMacroElapsedSeconds(s.elapsedSeconds);
          if (s.currentIndex !== undefined) setMacroCurrentSlideIndex(s.currentIndex);
          if (s.prompts && Array.isArray(s.prompts)) {
            setMacroPrompts(prev => {
              return prev.map(p => {
                const updated = s.prompts.find((up: any) => up.id === p.id || up.title === p.title);
                return updated ? { ...p, status: updated.status || p.status, completedRepeats: updated.completedRepeats || p.completedRepeats } : p;
              });
            });
          }
        }
      } else if (channel === 'flow-macro-log') {
        if (data) {
          setMacroLogs(prev => [data, ...prev.slice(0, 199)]);
        }
      } else if (channel === 'spy-hover') {
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

  // ==========================================
  // HANDLERS DO FLUXOGRAMA N8N
  // ==========================================
  const handleSaveFlowchart = async () => {
    try {
      const enrichedNodes = flowchartNodes.map(node => {
        const macro = savedMacrosList.find(m => m.id === node.macroId) || node.macroData;
        return {
          ...node,
          macroData: macro || node.macroData
        };
      });

      const flowPayload: SpyFlowchart = {
        id: flowchartId,
        name: flowchartName.trim() || 'Fluxograma N8N',
        description: flowchartDescription,
        nodes: enrichedNodes,
        updatedAt: new Date().toISOString()
      };

      const response = await fetch(getApiUrl('/api/spy/save-flow'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flowPayload)
      });

      if (response.ok) {
        const data = await response.json();
        addLog('success', 'FLUXOGRAMA', `Fluxograma "${flowPayload.name}" salvo com sucesso (${enrichedNodes.length} nós e código preservado)!`);
        setSyncStatus({ message: `Fluxograma "${flowPayload.name}" salvo com sucesso!`, type: 'success' });
        handleLoadSavedFlows();
      } else {
        throw new Error('Falha ao salvar fluxograma no servidor.');
      }
    } catch (err: any) {
      console.error('Erro ao salvar fluxograma:', err);
      setSyncStatus({ message: `Erro ao salvar fluxograma: ${err.message}`, type: 'error' });
      addLog('error', 'FLUXOGRAMA', `Erro ao salvar fluxograma: ${err.message}`);
    }
  };

  const handleLoadSavedFlows = async () => {
    setIsLoadingFlows(true);
    try {
      const response = await fetch(getApiUrl('/api/spy/list-flows'));
      if (response.ok) {
        const data = await response.json();
        setSavedFlowsList(data.flows || []);
      }
    } catch (err: any) {
      console.warn('Erro ao listar fluxogramas salvos:', err);
    } finally {
      setIsLoadingFlows(false);
    }
  };

  const handleOpenFlow = (flow: SpyFlowchart) => {
    setFlowchartId(flow.id);
    setFlowchartName(flow.name);
    setFlowchartDescription(flow.description || '');
    setFlowchartNodes(flow.nodes || []);
    setIsSavedFlowsModalOpen(false);
    addLog('info', 'FLUXOGRAMA', `Fluxograma "${flow.name}" carregado no canvas (${flow.nodes?.length || 0} nós).`);
  };

  const handleDeleteFlow = async (id: string, name: string) => {
    try {
      const response = await fetch(getApiUrl(`/api/spy/delete-flow/${id}`), {
        method: 'DELETE'
      });
      if (response.ok) {
        addLog('info', 'FLUXOGRAMA', `Fluxograma "${name}" excluído.`);
        handleLoadSavedFlows();
        if (flowchartId === id) {
          handleNewFlowchart();
        }
      }
    } catch (err: any) {
      console.error('Erro ao excluir fluxograma:', err);
    }
  };

  const handleRenameFlow = async (id: string, newName: string) => {
    if (!newName.trim()) return;
    try {
      const response = await fetch(getApiUrl(`/api/spy/rename-flow/${id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      if (response.ok) {
        addLog('success', 'FLUXOGRAMA', `Fluxograma renomeado para "${newName.trim()}".`);
        handleLoadSavedFlows();
        if (flowchartId === id) {
          setFlowchartName(newName.trim());
        }
      }
    } catch (err: any) {
      console.error('Erro ao renomear fluxograma:', err);
    } finally {
      setRenamingFlowId(null);
      setRenamingFlowName('');
    }
  };

  const handleNewFlowchart = () => {
    setFlowchartId(`flow_${Date.now()}`);
    setFlowchartName('Novo Fluxograma N8N');
    setFlowchartDescription('');
    setFlowchartNodes([]);
    addLog('info', 'FLUXOGRAMA', 'Novo fluxograma em branco iniciado.');
  };

  // ==========================================
  // HANDLERS DO CLONADOR DE VÍDEOS DO INSTAGRAM
  // ==========================================
  const handleLocalVideoSelect = (file: File) => {
    if (!file) return;
    if (file.size > 250 * 1024 * 1024) {
      alert('O arquivo selecionado excede o limite máximo recomendado de 250MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1] || base64String;
      const blobUrl = URL.createObjectURL(file);
      
      setInstagramVideoPreview({
        url: blobUrl,
        title: file.name,
        sourceUrl: `Vídeo Local (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
        isLocalFile: true,
        base64Data: base64Data,
        mimeType: file.type || 'video/mp4'
      });
      setVideoFile({
        data: base64Data,
        mimeType: file.type || 'video/mp4'
      });
      addLog('success', 'CLONADOR', `Vídeo "${file.name}" carregado com sucesso (${(file.size / (1024 * 1024)).toFixed(1)} MB)!`);
    };
    reader.readAsDataURL(file);
  };

  const handleFetchInstagramUrl = async () => {
    if (!instagramUrl.trim()) {
      alert('Por favor, insira o link de um Reel ou vídeo do Instagram.');
      return;
    }

    setIsFetchingInstagram(true);
    setError(null);
    try {
      addLog('ai', 'CLONADOR', `Buscando dados do vídeo Instagram: ${instagramUrl.trim()}...`);
      const response = await fetch(getApiUrl('/api/cloner/fetch-instagram'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: instagramUrl.trim() })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao buscar vídeo do Instagram.');
      }

      const data = await response.json();
      if (data.videoUrl) {
        setInstagramVideoPreview({
          url: data.videoUrl,
          thumbnail: data.thumbnailUrl,
          title: data.title,
          sourceUrl: data.sourceUrl
        });
        addLog('success', 'CLONADOR', 'Vídeo do Instagram localizado e pronto para clonagem!');
      } else if (data.loginRequired) {
        setShowInstagramBrowser(true);
        setInstagramBrowserUrl(data.sourceUrl || instagramUrl.trim());
        addLog('info', 'CLONADOR', 'O vídeo requer visualização na plataforma. Abrindo no Navegador Embutido do Instagram...');
      }
    } catch (err: any) {
      console.error(err);
      addLog('warning', 'CLONADOR', `Aviso ao buscar URL direta: ${err.message}. Abrindo navegador embutido.`);
      setShowInstagramBrowser(true);
      setInstagramBrowserUrl(instagramUrl.trim());
    } finally {
      setIsFetchingInstagram(false);
    }
  };

  const handleCaptureFromWebview = async () => {
    if (!instagramWebviewRef.current) return;
    setIsCapturingWebviewVideo(true);
    try {
      addLog('ai', 'CLONADOR', 'Inspecionando vídeo ativo no navegador do Instagram...');
      const script = `
        (() => {
          const videos = Array.from(document.querySelectorAll('video'));
          const playing = videos.find(v => !v.paused && v.currentTime > 0) || videos[0];
          if (playing) {
            return {
              src: playing.src || playing.currentSrc,
              poster: playing.poster,
              duration: playing.duration,
              title: document.title || 'Reel do Instagram'
            };
          }
          return null;
        })()
      `;
      const videoInfo = await instagramWebviewRef.current.executeJavaScript(script);
      if (videoInfo && videoInfo.src) {
        setInstagramVideoPreview({
          url: videoInfo.src,
          thumbnail: videoInfo.poster,
          title: videoInfo.title,
          sourceUrl: instagramBrowserUrl
        });
        setShowInstagramBrowser(false);
        addLog('success', 'CLONADOR', 'Vídeo do Instagram capturado do navegador com sucesso!');
      } else {
        alert('Nenhum vídeo em reprodução detectado. Certifique-se de que o Reel está visível e dando play.');
        addLog('warning', 'CLONADOR', 'Nenhum vídeo em reprodução detectado no navegador.');
      }
    } catch (err: any) {
      console.error(err);
      addLog('error', 'CLONADOR', `Erro ao capturar vídeo do navegador: ${err.message}`);
    } finally {
      setIsCapturingWebviewVideo(false);
    }
  };

  // Injetar supressor de Passkeys (Windows Hello) e Anti-Captcha no Webview do Instagram
  React.useEffect(() => {
    if (!showInstagramBrowser) return;

    const attachWebviewGuards = () => {
      const wv = instagramWebviewRef.current;
      if (!wv) return;

      const injectGuards = () => {
        const antiPasskeyScript = `
          (() => {
            try {
              // 1. Bloquear detecção de Passkey / Chave de Segurança do Windows
              delete window.PublicKeyCredential;
              if (navigator.credentials) {
                navigator.credentials.get = function() {
                  return Promise.reject(new DOMException('Passkeys disabled on this client', 'NotSupportedError'));
                };
                navigator.credentials.create = function() {
                  return Promise.reject(new DOMException('Passkeys disabled on this client', 'NotSupportedError'));
                };
              }
              // 2. Mascarar webdriver e simular Chrome Desktop
              Object.defineProperty(navigator, 'webdriver', { get: function() { return undefined; } });
              if (!window.chrome) {
                window.chrome = { runtime: {}, app: {}, loadTimes: function() {}, csi: function() {} };
              }
            } catch (e) {}
          })()
        `;
        wv.executeJavaScript(antiPasskeyScript).catch(() => {});
      };

      wv.addEventListener('dom-ready', injectGuards);
      wv.addEventListener('did-navigate', injectGuards);
      wv.addEventListener('did-navigate-in-page', injectGuards);
    };

    const timer = setTimeout(attachWebviewGuards, 150);
    return () => clearTimeout(timer);
  }, [showInstagramBrowser]);

  const handleStartCloningProcess = async () => {
    if (!instagramVideoPreview && !videoFile && !clonerTranscriptInput.trim()) {
      alert('Por favor, capture um vídeo do Instagram, faça upload de um arquivo ou forneça a transcrição para clonagem.');
      return;
    }

    setIsCloning(true);
    setError(null);
    try {
      addLog('ai', 'CLONADOR', `Iniciando transcrição de áudio e engenharia reversa com IA (${clonerNiche} • ${clonerTone})...`);
      
      const payload = {
        videoData: videoFile?.data || instagramVideoPreview?.base64Data,
        mimeType: videoFile?.mimeType || instagramVideoPreview?.mimeType || 'video/mp4',
        videoUrl: instagramVideoPreview?.url,
        transcriptInput: clonerTranscriptInput.trim() || undefined,
        targetNiche: clonerNiche,
        targetTone: clonerTone,
        cloneObjective: clonerObjective,
        provider: activeProvider,
        model: activeProvider === 'groq' ? groqModelInput : (activeProvider === 'openrouter' ? openrouterModelInput : geminiModel)
      };

      const response = await fetch(getApiUrl('/api/cloner/transcribe-and-clone'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Falha ao processar clonagem de vídeo.');
      }

      const resJson = await response.json();
      if (resJson.data) {
        setClonerResult(resJson.data);
        addLog('success', 'CLONADOR', 'Vídeo clonado com sucesso! Roteiro de Vídeo, Carrossel e Legenda gerados.');
      } else {
        throw new Error('Formato de resposta inválido.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao clonar vídeo.');
      addLog('error', 'CLONADOR', `Falha na clonagem: ${err.message}`);
    } finally {
      setIsCloning(false);
    }
  };

  const handleTransferClonedToVideo = () => {
    if (!clonerResult || !clonerResult.roteiro_clonado_video) return;
    const cloned = clonerResult.roteiro_clonado_video;
    setTopic(cloned.titulo_sugerido || 'Roteiro Clonado');
    setNiche(clonerNiche);
    
    const scenes = cloned.cenas.map((c, i) => ({
      sceneNumber: c.numero_cena || (i + 1),
      duration: 7,
      camera: c.enquadramento || 'Close-up',
      expression: 'Expressivo',
      contextPt: c.acao_visual,
      dialoguePt: c.fala,
      videoPromptEn: c.prompt_imagem_en
    }));

    setResult({
      topic: cloned.titulo_sugerido,
      scenes
    });
    setActiveTab('script');
    addLog('success', 'CLONADOR', 'Roteiro clonado transferido para a aba de Vídeo!');
  };

  const handleTransferClonedToCarousel = () => {
    if (!clonerResult || !clonerResult.carrossel_adaptado) return;
    const carrossel = clonerResult.carrossel_adaptado;
    setTopic(carrossel.titulo_carrossel || 'Carrossel Clonado');
    setNiche(clonerNiche);

    const slides = carrossel.slides.map((s, i) => ({
      slideNumber: s.slide_numero || (i + 1),
      titlePt: s.titulo_slide || `Slide ${i+1}`,
      descriptionPt: s.conteudo_texto || '',
      imagePromptEn: s.prompt_imagem_en || ''
    }));

    setCarouselResult({
      topic: carrossel.titulo_carrossel,
      slides
    });
    setActiveTab('carousel');
    addLog('success', 'CLONADOR', 'Carrossel clonado transferido para a aba Carrossel!');
  };

  const handleExportClonedDocx = async () => {
    if (!clonerResult) return;
    try {
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            new Paragraph({
              text: `ROTEIRO CLONADO: ${clonerResult.roteiro_clonado_video?.titulo_sugerido || 'Vídeo Instagram'}`,
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER
            }),
            new Paragraph({ text: `Nicho: ${clonerNiche} | Tom: ${clonerTone}` }),
            new Paragraph({ text: "" }),
            new Paragraph({
              text: "1. TRANSCRIÇÃO ORIGINAL DO VÍDEO",
              heading: HeadingLevel.HEADING_2
            }),
            new Paragraph({ text: clonerResult.transcricao_original?.dialogo_completo || "Sem transcrição." }),
            new Paragraph({ text: `Análise de Retenção: ${clonerResult.transcricao_original?.analise_retencao || ""}` }),
            new Paragraph({ text: "" }),
            new Paragraph({
              text: "2. ROTEIRO CLONADO DE VÍDEO (CENAS)",
              heading: HeadingLevel.HEADING_2
            }),
            ...(clonerResult.roteiro_clonado_video?.cenas?.map(c => [
              new Paragraph({ text: `CENA ${c.numero_cena} (${c.enquadramento})`, heading: HeadingLevel.HEADING_3 }),
              new Paragraph({ text: `Ação: ${c.acao_visual}` }),
              new Paragraph({ text: `Fala: "${c.fala}"` }),
              new Paragraph({ text: `Prompt de Imagem (EN): ${c.prompt_imagem_en}` }),
              new Paragraph({ text: "" })
            ]).flat() || []),
            new Paragraph({
              text: "3. LEGENDA & HASHTAGS INSTAGRAM",
              heading: HeadingLevel.HEADING_2
            }),
            new Paragraph({ text: clonerResult.legenda_instagram?.gancho || "" }),
            new Paragraph({ text: clonerResult.legenda_instagram?.corpo || "" }),
            new Paragraph({ text: `CTA: ${clonerResult.legenda_instagram?.cta || ""}` }),
            new Paragraph({ text: clonerResult.legenda_instagram?.hashtags?.join(" ") || "" })
          ]
        }]
      });

      const blob = await Packer.toBlob(doc);
      saveAs(blob, `Roteiro_Clonado_${(clonerResult.roteiro_clonado_video?.titulo_sugerido || 'Instagram').replace(/[^a-z0-9]/gi, '_')}.docx`);
      addLog('success', 'CLONADOR', 'Documento DOCX do Roteiro Clonado baixado com sucesso!');
    } catch (err: any) {
      console.error('Erro ao gerar DOCX:', err);
      alert('Erro ao exportar DOCX.');
    }
  };

  // =========================================================================
  // FUNÇÕES DE AÇÃO DO ROBÔ FLOW (FLOW Macro Studio Pro Integrado)
  // =========================================================================
  const sendMacroCommand = (cmd: string, payload?: any) => {
    if (webviewRef.current && typeof webviewRef.current.send === 'function') {
      webviewRef.current.send('flow-macro-cmd', { cmd, payload });
    }
  };

  // 1. Puxar Carrosséis Gerados do PostForge com 1 Clique
  const handlePullCarouselsToMacro = (sourceOverride?: any[], silent?: boolean) => {
    const sourceCarousels = (sourceOverride && sourceOverride.length > 0)
      ? sourceOverride
      : ((batchCarouselResults && batchCarouselResults.length > 0)
        ? batchCarouselResults
        : (carouselResult ? [carouselResult] : []));

    if (sourceCarousels.length === 0) {
      if (!silent) {
        alert('Nenhum carrossel gerado ou carregado no PostForge ainda! Crie ou gere um carrossel na aba "Carrossel" primeiro.');
      }
      return;
    }

    const newCarousels: MacroCarouselItem[] = [];
    const newPrompts: MacroPromptItem[] = [];

    sourceCarousels.forEach((car, cIdx) => {
      const cId = `carousel_${cIdx + 1}`;
      const cTitle = car.title || car.theme || `Carrossel ${cIdx + 1}`;
      newCarousels.push({
        id: cId,
        title: cTitle,
        count: car.slides?.length || 0
      });

      if (car.slides && Array.isArray(car.slides)) {
        car.slides.forEach((s, sIdx) => {
          const dialogue = s.textInBubblesPt || s.textInBubbles || '';
          newPrompts.push({
            id: `p_${cIdx + 1}_${s.slideNumber || sIdx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: `${cTitle} • Slide ${s.slideNumber || sIdx + 1}`,
            prompt: s.imagePromptEn || '',
            dialoguePt: dialogue,
            status: 'pending',
            checked: true,
            carouselId: cId,
            carouselTitle: cTitle,
            slideNumber: s.slideNumber || sIdx + 1,
            repeatCount: macroConfig.repeatPerPrompt || 1,
            completedRepeats: 0
          });
        });
      }
    });

    setMacroCarousels(newCarousels);
    setMacroPrompts(newPrompts);
    setMacroSelectedCarousel('all');

    sendMacroCommand('SYNC_DATA', {
      prompts: newPrompts,
      carousels: newCarousels,
      characters: macroCharacters,
      config: macroConfig
    });

    setMacroLogs(prev => [{
      message: `⚡ ${newPrompts.length} prompt(s) de ${newCarousels.length} carrossel(is) importados do PostForge com sucesso!`,
      type: 'success',
      time: new Date().toLocaleTimeString('pt-BR')
    }, ...prev]);
  };

  // 2. Sincronizar Personagens do PostForge com 1 Clique
  const handleSyncCharactersToMacro = () => {
    const validChars = characterImages
      .map((img, idx) => ({ img, idx, detail: detectedCharacterDetails[idx] }))
      .filter(item => !!item.img && !!item.img.data);

    if (validChars.length === 0) {
      alert('Nenhum personagem cadastrado com imagem no PostForge! Cadastre personagens na aba "Carrossel" primeiro.');
      return;
    }

    const newChars: MacroCharacterItem[] = validChars.map((item, i) => {
      const name = item.detail?.name || `Personagem ${i + 1}`;
      const avatar = `data:${item.img!.mimeType};base64,${item.img!.data}`;
      return {
        id: `char_${item.idx}_${Date.now()}`,
        name,
        color: item.detail?.color || '',
        features: item.detail?.features || '',
        avatar,
        enabled: true,
        promptTag: name
      };
    });

    setMacroCharacters(newChars);

    sendMacroCommand('SYNC_DATA', {
      prompts: macroPrompts,
      carousels: macroCarousels,
      characters: newChars,
      config: macroConfig
    });

    setMacroLogs(prev => [{
      message: `🎭 ${newChars.length} personagem(ns) sincronizado(s) do PostForge com sucesso!`,
      type: 'success',
      time: new Date().toLocaleTimeString('pt-BR')
    }, ...prev]);
  };

  // 3. Upload e Leitura de Arquivo (PDF, TXT, JSON, CSV, MD)
  const handleMacroUploadFile = async (file: File) => {
    if (!file) return;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      let rawText = '';

      if (ext === 'txt' || ext === 'md' || ext === 'json' || ext === 'csv') {
        rawText = await file.text();
      } else {
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve(b64);
          };
          reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
        });
        reader.readAsDataURL(file);
        const base64 = await base64Promise;

        const mimeType = ext === 'pdf' ? 'application/pdf' : (file.type || 'application/octet-stream');
        const res = await fetch(getApiUrl('/api/extract-document-text'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: base64, filename: file.name, mimeType })
        });
        if (res.ok) {
          const d = await res.json();
          rawText = d.text || '';
        }
      }

      if (!rawText.trim()) {
        alert(`Não foi possível extrair texto legível de "${file.name}".`);
        return;
      }

      const parsed = parsePostForgeDocument(rawText);
      let carouselsToLoad: GeneratedCarousel[] = [];

      if (parsed.type === 'carousel' && parsed.carousels) {
        carouselsToLoad = parsed.carousels;
      } else if (parsed.type === 'json' && parsed.data) {
        if (parsed.data.batchCarouselResults) carouselsToLoad = parsed.data.batchCarouselResults;
        else if (parsed.data.carouselResult) carouselsToLoad = [parsed.data.carouselResult];
      }

      if (carouselsToLoad.length > 0) {
        const newCarousels: MacroCarouselItem[] = [];
        const newPrompts: MacroPromptItem[] = [];

        carouselsToLoad.forEach((car, cIdx) => {
          const cId = `carousel_${cIdx + 1}`;
          const cTitle = car.title || car.theme || `Carrossel ${cIdx + 1}`;
          newCarousels.push({ id: cId, title: cTitle, count: car.slides?.length || 0 });

          (car.slides || []).forEach((s, sIdx) => {
            newPrompts.push({
              id: `p_file_${cIdx + 1}_${s.slideNumber || sIdx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              title: `${cTitle} • Slide ${s.slideNumber || sIdx + 1}`,
              prompt: s.imagePromptEn || '',
              dialoguePt: s.textInBubblesPt || s.textInBubbles || '',
              status: 'pending',
              checked: true,
              carouselId: cId,
              carouselTitle: cTitle,
              slideNumber: s.slideNumber || sIdx + 1,
              repeatCount: macroConfig.repeatPerPrompt || 1,
              completedRepeats: 0
            });
          });
        });

        setMacroCarousels(newCarousels);
        setMacroPrompts(newPrompts);
        setMacroSelectedCarousel('all');

        sendMacroCommand('SYNC_DATA', {
          prompts: newPrompts,
          carousels: newCarousels,
          characters: macroCharacters,
          config: macroConfig
        });

        setMacroLogs(prev => [{
          message: `📄 Arquivo "${file.name}" carregado: ${newPrompts.length} prompts em ${newCarousels.length} carrosséis!`,
          type: 'success',
          time: new Date().toLocaleTimeString('pt-BR')
        }, ...prev]);
      } else {
        const newPrompt: MacroPromptItem = {
          id: `p_raw_${Date.now()}`,
          title: `Prompt de ${file.name}`,
          prompt: rawText.substring(0, 1500),
          status: 'pending',
          checked: true,
          repeatCount: macroConfig.repeatPerPrompt || 1,
          completedRepeats: 0
        };
        const updated = [...macroPrompts, newPrompt];
        setMacroPrompts(updated);
        sendMacroCommand('SYNC_DATA', {
          prompts: updated,
          carousels: macroCarousels,
          characters: macroCharacters,
          config: macroConfig
        });
      }
    } catch (err: any) {
      console.error('Erro ao ler arquivo para Macro:', err);
      alert('Erro ao ler arquivo: ' + err.message);
    }
  };

  // 4. Colar Roteiro
  const handlePasteScriptConfirm = () => {
    if (!macroPasteText.trim()) return;
    const parsed = parsePostForgeDocument(macroPasteText);
    let carouselsToLoad: GeneratedCarousel[] = [];

    if (parsed.type === 'carousel' && parsed.carousels) {
      carouselsToLoad = parsed.carousels;
    } else if (parsed.type === 'json' && parsed.data) {
      if (parsed.data.batchCarouselResults) carouselsToLoad = parsed.data.batchCarouselResults;
      else if (parsed.data.carouselResult) carouselsToLoad = [parsed.data.carouselResult];
    }

    if (carouselsToLoad.length > 0) {
      const newCarousels: MacroCarouselItem[] = [];
      const newPrompts: MacroPromptItem[] = [];

      carouselsToLoad.forEach((car, cIdx) => {
        const cId = `carousel_${cIdx + 1}`;
        const cTitle = car.title || car.theme || `Carrossel ${cIdx + 1}`;
        newCarousels.push({ id: cId, title: cTitle, count: car.slides?.length || 0 });

        (car.slides || []).forEach((s, sIdx) => {
          newPrompts.push({
            id: `p_paste_${cIdx + 1}_${s.slideNumber || sIdx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            title: `${cTitle} • Slide ${s.slideNumber || sIdx + 1}`,
            prompt: s.imagePromptEn || '',
            dialoguePt: s.textInBubblesPt || s.textInBubbles || '',
            status: 'pending',
            checked: true,
            carouselId: cId,
            carouselTitle: cTitle,
            slideNumber: s.slideNumber || sIdx + 1,
            repeatCount: macroConfig.repeatPerPrompt || 1,
            completedRepeats: 0
          });
        });
      });

      setMacroCarousels(newCarousels);
      setMacroPrompts(newPrompts);
      setMacroSelectedCarousel('all');

      sendMacroCommand('SYNC_DATA', {
        prompts: newPrompts,
        carousels: newCarousels,
        characters: macroCharacters,
        config: macroConfig
      });

      setMacroLogs(prev => [{
        message: `📋 Roteiro colado processado: ${newPrompts.length} prompts em ${newCarousels.length} carrosséis!`,
        type: 'success',
        time: new Date().toLocaleTimeString('pt-BR')
      }, ...prev]);
    } else {
      const blocks = macroPasteText.split(/\n\s*\n/).filter(b => b.trim().length > 5);
      const newPrompts: MacroPromptItem[] = blocks.map((b, idx) => ({
        id: `p_pasted_${Date.now()}_${idx}`,
        title: `Prompt ${idx + 1}`,
        prompt: b.trim(),
        status: 'pending',
        checked: true,
        repeatCount: macroConfig.repeatPerPrompt || 1,
        completedRepeats: 0
      }));

      const merged = [...macroPrompts, ...newPrompts];
      setMacroPrompts(merged);
      sendMacroCommand('SYNC_DATA', {
        prompts: merged,
        carousels: macroCarousels,
        characters: macroCharacters,
        config: macroConfig
      });
      setMacroLogs(prev => [{
        message: `📋 ${newPrompts.length} prompt(s) adicionados a partir do texto colado.`,
        type: 'success',
        time: new Date().toLocaleTimeString('pt-BR')
      }, ...prev]);
    }

    setMacroPasteText('');
    setIsMacroPasteModalOpen(false);
  };

  // 5. Execução do Macro
  const handleStartMacro = () => {
    const activePrompts = macroPrompts.filter(p => p.checked);
    if (activePrompts.length === 0) {
      alert('Nenhum prompt marcado para execução! Marque a caixinha de ao menos um prompt.');
      return;
    }
    setMacroState('running');
    setMacroCurrentAction('Iniciando automação no FLOW...');
    sendMacroCommand('START', {
      prompts: macroPrompts.map(p => ({
        id: p.id,
        title: p.title,
        prompt: p.prompt,
        imagePrompt: p.prompt,
        fullText: p.dialoguePt ? `Texto nos balões:\nPT-BR: "${p.dialoguePt}"\n\nPrompt de Imagem (Midjourney / Dall-E):\n${p.prompt}` : p.prompt,
        ptDialogue: p.dialoguePt,
        enabled: p.checked,
        repeatCount: p.repeatCount || macroConfig.repeatPerPrompt || 1,
        completedRepeats: p.completedRepeats || 0,
        status: p.status || 'pending'
      })),
      carousels: macroCarousels,
      characters: macroCharacters.map(c => ({
        id: c.id,
        name: c.name,
        avatarUrl: c.avatar,
        avatar: c.avatar,
        promptTag: c.promptTag || c.name,
        enabled: c.enabled
      })),
      config: macroConfig
    });
    setMacroLogs(prev => [{
      message: `🚀 Macro iniciado com ${activePrompts.length} prompt(s) selecionado(s)...`,
      type: 'info',
      time: new Date().toLocaleTimeString('pt-BR')
    }, ...prev]);
  };

  const handlePauseMacro = () => {
    setMacroState('paused');
    sendMacroCommand('PAUSE');
    setMacroLogs(prev => [{
      message: `⏸ Macro pausado pelo usuário.`,
      type: 'warning',
      time: new Date().toLocaleTimeString('pt-BR')
    }, ...prev]);
  };

  const handleResumeMacro = () => {
    setMacroState('running');
    sendMacroCommand('RESUME');
    setMacroLogs(prev => [{
      message: `▶ Macro retomado.`,
      type: 'info',
      time: new Date().toLocaleTimeString('pt-BR')
    }, ...prev]);
  };

  const handleStopMacro = () => {
    setMacroState('stopped');
    setMacroCurrentAction('Parado pelo usuário');
    setMacroCountdown({ remaining: 0, total: 0, label: '' });
    sendMacroCommand('STOP');
    setMacroLogs(prev => [{
      message: `⏹ Macro interrompido pelo usuário.`,
      type: 'error',
      time: new Date().toLocaleTimeString('pt-BR')
    }, ...prev]);
  };

  const handleRunSingleMacroPrompt = (id: string) => {
    setMacroState('running');
    sendMacroCommand('RUN_SINGLE', { id });
    setMacroLogs(prev => [{
      message: `🎯 Executando prompt individual (${id})...`,
      type: 'info',
      time: new Date().toLocaleTimeString('pt-BR')
    }, ...prev]);
  };

  const handleTogglePromptCheck = (id: string) => {
    setMacroPrompts(prev => prev.map(p => p.id === id ? { ...p, checked: !p.checked } : p));
  };

  const handleDeleteMacroPrompt = (id: string) => {
    setMacroPrompts(prev => prev.filter(p => p.id !== id));
  };

  const handleResetMacroStatus = () => {
    setMacroPrompts(prev => prev.map(p => ({ ...p, status: 'pending', completedRepeats: 0 })));
    setMacroState('idle');
    setMacroCurrentAction('Pronto');
    setMacroCountdown({ remaining: 0, total: 0, label: '' });
    setMacroLogs(prev => [{
      message: `🔄 Status de todos os prompts redefinidos para Pendente.`,
      type: 'info',
      time: new Date().toLocaleTimeString('pt-BR')
    }, ...prev]);
  };

  const handleClearMacroPrompts = () => {
    if (confirm('Tem certeza de que deseja limpar todos os prompts da lista?')) {
      setMacroPrompts([]);
      setMacroCarousels([]);
      setMacroSelectedCarousel('all');
      setMacroLogs(prev => [{
        message: `🗑️ Lista de prompts limpa.`,
        type: 'warning',
        time: new Date().toLocaleTimeString('pt-BR')
      }, ...prev]);
    }
  };

  const handleToggleAllMacroPrompts = () => {
    const allChecked = macroPrompts.every(p => p.checked);
    setMacroPrompts(prev => prev.map(p => ({ ...p, checked: !allChecked })));
  };

  const handleAddManualPrompt = () => {
    if (!macroNewPromptText.trim()) {
      alert('Informe o texto do prompt!');
      return;
    }
    const newPrompt: MacroPromptItem = {
      id: `p_manual_${Date.now()}`,
      title: macroNewPromptTitle.trim() || `Prompt ${macroPrompts.length + 1}`,
      prompt: macroNewPromptText.trim(),
      dialoguePt: macroNewPromptDialogue.trim() || undefined,
      status: 'pending',
      checked: true,
      repeatCount: macroConfig.repeatPerPrompt || 1,
      completedRepeats: 0
    };
    const updated = [...macroPrompts, newPrompt];
    setMacroPrompts(updated);
    sendMacroCommand('SYNC_DATA', {
      prompts: updated,
      carousels: macroCarousels,
      characters: macroCharacters,
      config: macroConfig
    });
    setMacroNewPromptTitle('');
    setMacroNewPromptText('');
    setMacroNewPromptDialogue('');
    setIsMacroAddPromptModalOpen(false);
  };

  const handleAddMacroCharacter = () => {
    if (!macroNewCharName.trim()) {
      alert('Informe o nome do personagem!');
      return;
    }
    const newChar: MacroCharacterItem = {
      id: `char_manual_${Date.now()}`,
      name: macroNewCharName.trim(),
      color: macroNewCharColor.trim(),
      features: macroNewCharFeatures.trim(),
      avatar: macroNewCharAvatar,
      enabled: true,
      promptTag: macroNewCharName.trim()
    };
    const updated = [...macroCharacters, newChar];
    setMacroCharacters(updated);
    sendMacroCommand('SYNC_DATA', {
      prompts: macroPrompts,
      carousels: macroCarousels,
      characters: updated,
      config: macroConfig
    });
    setMacroNewCharName('');
    setMacroNewCharColor('');
    setMacroNewCharFeatures('');
    setMacroNewCharAvatar('');
    setIsMacroAddCharModalOpen(false);
  };

  const handleDeleteMacroCharacter = (id: string) => {
    const updated = macroCharacters.filter(c => c.id !== id);
    setMacroCharacters(updated);
    sendMacroCommand('SYNC_DATA', {
      prompts: macroPrompts,
      carousels: macroCarousels,
      characters: updated,
      config: macroConfig
    });
  };

  const handleExportMacroCharsJson = () => {
    if (macroCharacters.length === 0) {
      alert('Nenhum personagem para exportar!');
      return;
    }
    const blob = new Blob([JSON.stringify(macroCharacters, null, 2)], { type: 'application/json' });
    saveAs(blob, `personagens_flow_macro_${Date.now()}.json`);
  };

  const handleImportMacroCharsJson = async (file: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        setMacroCharacters(parsed);
        sendMacroCommand('SYNC_DATA', {
          prompts: macroPrompts,
          carousels: macroCarousels,
          characters: parsed,
          config: macroConfig
        });
        alert(`✅ ${parsed.length} personagem(ns) importado(s) com sucesso!`);
      }
    } catch (e: any) {
      alert('Erro ao importar JSON de personagens: ' + e.message);
    }
  };

  const handleDetectTelegramChatId = async () => {
    if (!macroConfig.telegramBotToken) {
      alert('Preencha o Token do Bot antes de detectar o Chat ID!');
      return;
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${macroConfig.telegramBotToken}/getUpdates`);
      const data = await res.json();
      if (data.ok && data.result && data.result.length > 0) {
        const lastMsg = data.result[data.result.length - 1];
        const chatId = (lastMsg.message || lastMsg.channel_post)?.chat?.id;
        if (chatId) {
          setMacroConfig(prev => ({ ...prev, telegramChatId: String(chatId) }));
          alert(`✅ Chat ID detectado com sucesso: ${chatId}`);
          return;
        }
      }
      alert('Nenhuma mensagem recente encontrada! Envie qualquer mensagem para o seu bot no Telegram (@Gerador_posts_bot) e tente novamente.');
    } catch (err: any) {
      alert('Erro ao detectar Chat ID: ' + err.message);
    }
  };

  const handleTestTelegramNotification = async () => {
    if (!macroConfig.telegramBotToken || !macroConfig.telegramChatId) {
      alert('Preencha o Bot Token e o Chat ID para testar!');
      return;
    }
    try {
      const text = `🤖 *PostForge Robô FLOW*\n\nConexão estabelecida com sucesso com o seu bot do Telegram!\nVocê receberá o progresso e as imagens de capa dos carrosséis aqui ao vivo.`;
      const res = await fetch(`https://api.telegram.org/bot${macroConfig.telegramBotToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: macroConfig.telegramChatId,
          text,
          parse_mode: 'Markdown'
        })
      });
      const d = await res.json();
      if (d.ok) {
        alert('📲 Mensagem de teste enviada com sucesso para o seu Telegram!');
      } else {
        alert('Erro retornado pelo Telegram: ' + (d.description || JSON.stringify(d)));
      }
    } catch (err: any) {
      alert('Falha ao enviar mensagem de teste: ' + err.message);
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
    setIsCloningImages(false);
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

  const handleResetEntireAudit = () => {
    setUploadedAuditImages([]);
    setAuditReferenceImages([]);
    setAuditScriptInput('');
    setAuditCharacterNotes('');
    setAuditDocumentInfo(null);
    setDetectedAuditBatches([]);
    setAuditResult(null);
    setAuditError(null);
    setOrderedSlidesList([]);
    setSurplusImagesList([]);
    setMultiProjectsResult(null);
    setActiveMultiProjectIndex(0);
    setDownloadSuccessInfo(null);
    addLog('info', 'AUDITORIA', '✨ Auditoria reiniciada com sucesso! Todas as imagens, roteiros e resultados foram limpos.');
  };

  const scanFilesFromDataTransfer = async (items: DataTransferItemList): Promise<File[]> => {
    const fileList: File[] = [];
    const queue: any[] = [];
    for (let i = 0; i < items.length; i++) {
      const entry = (items[i] as any).webkitGetAsEntry ? (items[i] as any).webkitGetAsEntry() : null;
      if (entry) {
        queue.push(entry);
      } else {
        const f = items[i].getAsFile();
        if (f) fileList.push(f);
      }
    }

    const readEntry = async (entry: any): Promise<void> => {
      if (!entry) return;
      if (entry.isFile) {
        return new Promise<void>((resolve) => {
          entry.file((file: File) => {
            if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp|gif)$/i.test(file.name)) {
              fileList.push(file);
            }
            resolve();
          }, () => resolve());
        });
      } else if (entry.isDirectory) {
        const dirReader = entry.createReader();
        const entries: any[] = await new Promise((resolve) => {
          dirReader.readEntries((results: any[]) => resolve(results || []), () => resolve([]));
        });
        for (const child of entries) {
          await readEntry(child);
        }
      }
    };

    while (queue.length > 0) {
      const current = queue.shift();
      await readEntry(current);
    }

    return fileList;
  };

  // Lightbox e Galeria de Slides com Metadados
  const openAuditSlideInLightbox = (index: number) => {
    const galleryItems: LightboxGalleryItem[] = orderedSlidesList.map((item, idx) => {
      const matched = uploadedAuditImages.find(img => 
        img.name.toLowerCase() === item.imagem_arquivo_correspondente.toLowerCase() ||
        img.name.toLowerCase().includes(item.imagem_arquivo_correspondente.toLowerCase()) ||
        item.imagem_arquivo_correspondente.toLowerCase().includes(img.name.toLowerCase())
      );
      return {
        url: matched?.dataUrl || '',
        title: `Slide ${idx + 1} - ${matched?.name || item.imagem_arquivo_correspondente}`,
        filename: matched?.name || item.imagem_arquivo_correspondente,
        slideNumber: idx + 1,
        totalSlides: orderedSlidesList.length,
        description: item.descricao_cenario || item.feedback_consistencia || '',
        dialogue: item.texto_balao || item.dialogo || '',
        prompt: item.prompt_visual_original || '',
        consistencyScore: item.pontuacao_consistencia || '',
        consistencyFeedback: item.feedback_consistencia || ''
      };
    }).filter(item => item.url);

    if (galleryItems.length > 0) {
      const foundIdx = Math.min(Math.max(0, index), galleryItems.length - 1);
      setLightboxGallery({
        items: galleryItems,
        currentIndex: foundIdx
      });
    }
  };

  const openSurplusInLightbox = (index: number) => {
    const galleryItems: LightboxGalleryItem[] = surplusImagesList.map((surplus, idx) => {
      const matched = uploadedAuditImages.find(img => img.name.toLowerCase() === surplus.nome_arquivo.toLowerCase());
      return {
        url: matched?.dataUrl || '',
        title: surplus.nome_arquivo,
        filename: surplus.nome_arquivo,
        slideNumber: idx + 1,
        totalSlides: surplusImagesList.length,
        description: `Motivo de Descarte: ${surplus.motivo_descarte}`
      };
    }).filter(item => item.url);

    if (galleryItems.length > 0) {
      setLightboxGallery({
        items: galleryItems,
        currentIndex: Math.min(Math.max(0, index), galleryItems.length - 1)
      });
    }
  };

  const openCarouselSlideInLightbox = (slideIdx: number) => {
    if (!carouselResult || !carouselResult.slides) return;
    const currentLang = carouselResult.language || dialogueLanguage;
    const galleryItems: LightboxGalleryItem[] = carouselResult.slides.map((s, idx) => {
      let dialogue = s.textInBubblesPt || s.textInBubbles || '';
      if (currentLang === 'en') dialogue = s.textInBubblesEn || s.textInBubbles || '';
      else if (currentLang === 'es') dialogue = s.textInBubblesEs || s.textInBubbles || '';
      else if (currentLang === 'all') {
        dialogue = [
          s.textInBubblesPt ? `PT: ${s.textInBubblesPt}` : '',
          s.textInBubblesEn ? `EN: ${s.textInBubblesEn}` : '',
          s.textInBubblesEs ? `ES: ${s.textInBubblesEs}` : '',
        ].filter(Boolean).join(' | ');
      }

      const refImg = characterImages[0]?.data ? `data:${characterImages[0]?.mimeType};base64,${characterImages[0]?.data}` : '';
      return {
        url: s.imageUrl || s.originalImagePreview || refImg || '',
        title: `Slide ${s.slideNumber || idx + 1} - ${carouselResult.title || 'Carrossel'}`,
        filename: `Slide_${s.slideNumber || idx + 1}`,
        slideNumber: s.slideNumber || idx + 1,
        totalSlides: carouselResult.slides.length,
        description: s.descriptionPt || '',
        dialogue: dialogue,
        prompt: s.imagePromptEn || '',
        layoutMode: s.layoutMode || carouselResult.layoutMode || carouselLayoutMode,
        typographyStyle: s.typographyStyle || carouselResult.typographyStyle || topTypographyStyle
      };
    });

    setLightboxGallery({
      items: galleryItems,
      currentIndex: Math.min(Math.max(0, slideIdx), galleryItems.length - 1)
    });
  };

  const openSingleImageInLightbox = (url: string, title: string, description?: string, dialogue?: string, prompt?: string) => {
    setLightboxGallery({
      items: [{
        url,
        title,
        filename: title,
        slideNumber: 1,
        totalSlides: 1,
        description,
        dialogue,
        prompt
      }],
      currentIndex: 0
    });
  };

  // Funções de Salvar e Carregar Projeto / Prompts
  const handleExportProjectJSON = () => {
    try {
      const projectData = {
        version: '1.2.0',
        appName: 'PostForge',
        exportedAt: new Date().toISOString(),
        activeTab,
        niche,
        artStyle,
        animationStyle,
        visualDynamism,
        scriptTone,
        carouselTone,
        characterCount,
        sceneCount,
        duration,
        topic,
        characterDescription,
        dialogueLanguage,
        carouselQuantity,
        activeCarouselIndex,
        result,
        carouselResult,
        batchCarouselResults,
        lastGenerationMeta
      };

      const cleanTitle = (topic || carouselResult?.title || result?.nanoBananaImagePrompt || 'postforge_projeto')
        .replace(/[^a-zA-Z0-9_-]/g, '_')
        .substring(0, 40)
        .toLowerCase();

      const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json;charset=utf-8' });
      const filename = `postforge_${cleanTitle}_${Date.now()}.json`;
      saveAs(blob, filename);
      addLog('success', 'PROJETO', `💾 Projeto e prompts exportados com sucesso: ${filename}`);
    } catch (err: any) {
      console.error('Erro ao salvar projeto:', err);
      addLog('error', 'PROJETO', `Falha ao exportar projeto: ${err.message}`);
    }
  };

  const parsePostForgeDocument = (text: string) => {
    if (!text || typeof text !== 'string') return { type: 'text' as const, text: '' };

    // Limpeza de cabeçalhos / paginação de PDFs
    const cleanText = text
      .replace(/Página\s+\d+\s+de\s+\d+\s*(?:•|-)?\s*PostForge[^\n\r]*/gi, '')
      .replace(/POSTFORGE\s+•\s+GERADOR\s+ESTRUTURADO\s+DE\s+CONTEÚDO/gi, '')
      .replace(/POSTFORGE\s+LOTE\s+DE\s+\d+\s+CARROSSÉIS/gi, '')
      .replace(/Slide\s+Completo/gi, '')
      .trim();

    // 1. Tentar parse como JSON estruturado
    try {
      const trimmed = cleanText.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        const data = JSON.parse(trimmed);
        return { type: 'json' as const, data };
      }
    } catch {}

    // 2. Tentar parse como Carrossel (Único ou em Lote)
    const hasCarouselKeywords = /(?:CARROSSEL|SLIDE\s*\d+)/i.test(cleanText);
    if (hasCarouselKeywords) {
      const carousels: any[] = [];
      const carSplit = cleanText.split(/(?:(?:^|\n)\s*CARROSSEL\s*(?:\d+)?\s*:\s*)/i);
      const chunks = carSplit.length > 1 ? carSplit.slice(1) : [cleanText];

      chunks.forEach((chunk, cIdx) => {
        const lines = chunk.trim().split('\n').map(l => l.trim()).filter(Boolean);
        let title = `Carrossel ${cIdx + 1}`;

        if (lines.length > 0) {
          const first = lines[0]
            .replace(/^(?:CARROSSEL\s*\d*:\s*)/i, '')
            .replace(/Nicho:.*$/i, '')
            .replace(/•.*$/i, '')
            .trim();
          if (first && !first.toUpperCase().startsWith('SLIDE')) {
            title = first;
          }
        }

        const nicheMatch = chunk.match(/Nicho:\s*(.*?)(?=\s*(?:Estilo|Idioma|\d+\s*Slides|•|\||\n|$))/i);
        const styleMatch = chunk.match(/Estilo:\s*(.*?)(?=\s*(?:Idioma|\d+\s*Slides|•|\||\n|$))/i);
        const langMatch = chunk.match(/Idioma:\s*(.*?)(?=\s*(?:\d+\s*Slides|•|\||\n|$))/i);

        const slideChunks = chunk.split(/(?:^|\n)\s*SLIDE\s*(\d+)[\s:]*/i);
        const slides: any[] = [];

        if (slideChunks.length > 1) {
          for (let i = 1; i < slideChunks.length; i += 2) {
            const slideNum = parseInt(slideChunks[i], 10);
            const sBody = slideChunks[i + 1] || '';

            // Descrição Visual
            let desc = '';
            const descMatch = sBody.match(/(?:CONTEÚDO DO SLIDE(?:\s*\(DESCRIÇÃO VISUAL\))?|Descrição Visual)(?:[^\n:]*)[:\n]?\s*([\s\S]*?)(?=(?:FALA NO BALÃO|Texto nos Balões|PROMPT DE IMAGEM|Prompt de Imagem|SLIDE|LEGENDA|---|(?:\r?\n)*$))/i);
            if (descMatch) {
              desc = descMatch[1].trim();
            }

            // Balões de Diálogo
            let textPt = '', textEn = '', textEs = '', textGeneral = '';
            const ptMatch = sBody.match(/PT:\s*"([^"]*)"/i) || sBody.match(/PT:\s*([^\n]+)/i);
            const enMatch = sBody.match(/EN:\s*"([^"]*)"/i) || sBody.match(/EN:\s*([^\n]+)/i);
            const esMatch = sBody.match(/ES:\s*"([^"]*)"/i) || sBody.match(/ES:\s*([^\n]+)/i);
            const bubbleMatch = sBody.match(/(?:FALA NO BALÃO DE DIÁLOGO|Texto nos Balões)(?:[^\n:]*)[:\n]?\s*(?:(?:PT|EN|ES):\s*)?"?([^"\n]*)"?/i);

            if (ptMatch) textPt = ptMatch[1].trim().replace(/^["']|["']$/g, '');
            if (enMatch) textEn = enMatch[1].trim().replace(/^["']|["']$/g, '');
            if (esMatch) textEs = esMatch[1].trim().replace(/^["']|["']$/g, '');
            if (bubbleMatch && !textPt && !textEn && !textEs) textGeneral = bubbleMatch[1].trim().replace(/^["']|["']$/g, '');

            // Prompt de Imagem
            let prompt = '';
            const promptMatch = sBody.match(/(?:PROMPT DE IMAGEM(?:\s*\(FLOW\s*\/\s*I\.A\))?|Prompt de Imagem)(?:[^\n:]*)[:\n]?\s*([\s\S]*?)(?=(?:---|___|\n\n\n|SLIDE|LEGENDA|(?:\r?\n)*$))/i);
            if (promptMatch) {
              prompt = promptMatch[1].trim().replace(/^[-_\s]+/, '').replace(/[-_\s]+$/, '');
            }

            slides.push({
              slideNumber: slideNum,
              descriptionPt: desc,
              textInBubblesPt: textPt || textGeneral,
              textInBubblesEn: textEn,
              textInBubblesEs: textEs,
              textInBubbles: textPt || textGeneral || textEn || textEs,
              imagePromptEn: prompt
            });
          }
        }

        // Legenda do Instagram
        let igPost = '';
        const igMatch = chunk.match(/LEGENDA DO INSTAGRAM\s*([\s\S]*?)(?=(?:CARROSSEL|(?:\r?\n)*$))/i);
        if (igMatch) {
          igPost = igMatch[1].trim().replace(/^[-_\s]+/, '').replace(/[-_\s]+$/, '');
        }

        if (slides.length > 0) {
          carousels.push({
            title,
            theme: title,
            slides,
            instagramPost: igPost,
            niche: nicheMatch ? nicheMatch[1].trim() : undefined,
            artStyle: styleMatch ? styleMatch[1].trim() : undefined,
            language: langMatch ? (langMatch[1].toLowerCase().includes('ingl') ? 'en' : langMatch[1].toLowerCase().includes('espan') ? 'es' : langMatch[1].toLowerCase().includes('3') ? 'all' : 'pt') : 'pt'
          });
        }
      });

      if (carousels.length > 0) {
        return { type: 'carousel' as const, carousels };
      }
    }

    // 3. Tentar parse como Roteiro de Vídeo
    const hasScriptKeywords = /(?:ROTEIRO|CENA\s*\d+)/i.test(cleanText);
    if (hasScriptKeywords) {
      const sceneChunks = cleanText.split(/(?:^|\n)\s*CENA\s*(\d+)(?:\s*\(([^)]+)\))?[\s:]*/i);
      const scenes: any[] = [];
      if (sceneChunks.length > 1) {
        for (let i = 1; i < sceneChunks.length; i += 3) {
          const sceneNum = parseInt(sceneChunks[i], 10);
          const durationStr = sceneChunks[i + 1] || '5s';
          const sBody = sceneChunks[i + 2] || '';

          let duration = parseInt(durationStr.replace(/\D/g, ''), 10) || 5;
          let ctx = '';
          const ctxMatch = sBody.match(/(?:CONTEXTO VISUAL DA CENA|Contexto)(?:[^\n:]*)[:\n]?\s*([\s\S]*?)(?=(?:NARRAÇÃO|Narração|Falas|Diálogo|PROMPT DE VÍDEO|Prompt de Vídeo|CENA|LEGENDA|---|(?:\r?\n)*$))/i);
          if (ctxMatch) ctx = ctxMatch[1].trim();

          let dialPt = '', dialEn = '', dialEs = '', dialGeneral = '';
          const ptMatch = sBody.match(/PT:\s*"([^"]*)"/i) || sBody.match(/PT:\s*([^\n]+)/i);
          const enMatch = sBody.match(/EN:\s*"([^"]*)"/i) || sBody.match(/EN:\s*([^\n]+)/i);
          const esMatch = sBody.match(/ES:\s*"([^"]*)"/i) || sBody.match(/ES:\s*([^\n]+)/i);
          const dialMatch = sBody.match(/(?:NARRAÇÃO\s*\/\s*DIÁLOGO|Narração|Falas|Diálogo)(?:[^\n:]*)[:\n]?\s*(?:(?:PT|EN|ES):\s*)?"?([^"\n]*)"?/i);

          if (ptMatch) dialPt = ptMatch[1].trim().replace(/^["']|["']$/g, '');
          if (enMatch) dialEn = enMatch[1].trim().replace(/^["']|["']$/g, '');
          if (esMatch) dialEs = esMatch[1].trim().replace(/^["']|["']$/g, '');
          if (dialMatch && !dialPt && !dialEn && !dialEs) dialGeneral = dialMatch[1].trim().replace(/^["']|["']$/g, '');

          let videoPrompt = '';
          const vpMatch = sBody.match(/(?:PROMPT DE VÍDEO|Prompt de Vídeo)(?:[^\n:]*)[:\n]?\s*([\s\S]*?)(?=(?:---|___|\n\n\n|CENA|LEGENDA|(?:\r?\n)*$))/i);
          if (vpMatch) videoPrompt = vpMatch[1].trim().replace(/^[-_\s]+/, '').replace(/[-_\s]+$/, '');

          scenes.push({
            sceneNumber: sceneNum,
            duration,
            contextPt: ctx,
            dialoguePt: dialPt || dialGeneral,
            dialogueEn: dialEn,
            dialogueEs: dialEs,
            dialogue: dialPt || dialGeneral || dialEn || dialEs,
            videoPromptEn: videoPrompt
          });
        }
      }

      let coverPrompt = '';
      const cpMatch = cleanText.match(/PROMPT DA IMAGEM DE CAPA[^\n]*\n([\s\S]*?)(?=(?:CENA\s*1|CENA\s*\d+|(?:\r?\n)*$))/i);
      if (cpMatch) coverPrompt = cpMatch[1].trim().replace(/^[-_\s]+/, '').replace(/[-_\s]+$/, '');

      let igPost = '';
      const igMatch = cleanText.match(/LEGENDA DO INSTAGRAM\s*([\s\S]*?)(?=(?:\r?\n)*$)/i);
      if (igMatch) igPost = igMatch[1].trim().replace(/^[-_\s]+/, '').replace(/[-_\s]+$/, '');

      if (scenes.length > 0) {
        return {
          type: 'script' as const,
          result: {
            nanoBananaImagePrompt: coverPrompt,
            scenes,
            instagramPost: igPost
          }
        };
      }
    }

    return { type: 'text' as const, text: cleanText };
  };

  const formatParsedContentForAudit = (parsed: { type: 'json' | 'carousel' | 'script' | 'text'; data?: any; carousels?: any[]; scenes?: any[]; result?: any; text?: string }): { formattedText: string; characterNotes?: string } => {
    let carouselsToFormat: any[] = [];
    let scriptScenesToFormat: any[] = [];
    let detectedStyle = '';
    let detectedNiche = '';
    let detectedCharacterDesc = '';

    if (parsed.type === 'json' && parsed.data) {
      const d = parsed.data;
      if (Array.isArray(d.batchCarouselResults) && d.batchCarouselResults.length > 0) {
        carouselsToFormat = d.batchCarouselResults;
      } else if (d.carouselResult) {
        carouselsToFormat = [d.carouselResult];
      } else if (Array.isArray(d.carousels) && d.carousels.length > 0) {
        carouselsToFormat = d.carousels;
      } else if (Array.isArray(d.projects) && d.projects.length > 0) {
        carouselsToFormat = d.projects;
      } else if (d.result && Array.isArray(d.result.scenes) && d.result.scenes.length > 0) {
        scriptScenesToFormat = d.result.scenes;
      } else if (Array.isArray(d.scenes) && d.scenes.length > 0) {
        scriptScenesToFormat = d.scenes;
      }

      if (d.artStyle) detectedStyle = d.artStyle;
      if (d.niche) detectedNiche = d.niche;
      if (d.characterDescription) detectedCharacterDesc = d.characterDescription;
    } else if (parsed.type === 'carousel' && Array.isArray(parsed.carousels)) {
      carouselsToFormat = parsed.carousels;
    } else if (parsed.type === 'script' && (Array.isArray(parsed.scenes) || (parsed.result && Array.isArray(parsed.result.scenes)))) {
      scriptScenesToFormat = parsed.scenes || parsed.result.scenes;
    }

    if (carouselsToFormat.length > 0) {
      let scriptText = '';
      carouselsToFormat.forEach((car, cIdx) => {
        const cTitle = car.title || car.theme || `Carrossel ${cIdx + 1}`;
        scriptText += `=== PROJETO ${cIdx + 1}: ${cTitle.toUpperCase()} ===\n`;
        
        const metaParts: string[] = [];
        if (car.niche || detectedNiche) metaParts.push(`Nicho: ${car.niche || detectedNiche}`);
        if (car.artStyle || detectedStyle) metaParts.push(`Estilo: ${car.artStyle || detectedStyle}`);
        if (metaParts.length > 0) {
          scriptText += `${metaParts.join(' • ')}\n`;
        }

        if (car.instagramPost) {
          scriptText += `Contexto/Legenda: ${car.instagramPost.substring(0, 160)}...\n`;
        }
        scriptText += `\n`;

        const slides = car.slides || [];
        slides.forEach((s: any, sIdx: number) => {
          const slideNum = s.slideNumber || sIdx + 1;
          const bubbleText = s.textInBubblesPt || s.textInBubblesEn || s.textInBubblesEs || s.textInBubbles || '';
          const desc = s.descriptionPt || s.description || '';
          const prompt = s.imagePromptEn || s.prompt || '';

          scriptText += `[SLIDE ${slideNum}]\n`;
          if (desc) scriptText += `• Descrição da Cena: ${desc}\n`;
          if (prompt) scriptText += `• Prompt de Imagem (FLOW / I.A): ${prompt}\n`;
          if (bubbleText) scriptText += `• Texto no Balão: "${bubbleText}"\n`;
          scriptText += `\n`;
        });
        scriptText += `----------------------------------------------------\n\n`;
      });

      const firstCar = carouselsToFormat[0];
      const styleToUse = detectedStyle || firstCar.artStyle || '';
      const nicheToUse = detectedNiche || firstCar.niche || '';
      const notesArr = [
        styleToUse ? `Estilo Visual: ${styleToUse}` : '',
        nicheToUse ? `Nicho de Conteúdo: ${nicheToUse}` : '',
        detectedCharacterDesc ? `Personagens: ${detectedCharacterDesc}` : 'Personagens principais com consistência de traço, iluminação e cores'
      ].filter(Boolean);

      return {
        formattedText: scriptText.trim(),
        characterNotes: notesArr.join('\n')
      };
    }

    if (scriptScenesToFormat.length > 0) {
      let scriptText = `=== ROTEIRO / STORYBOARD ESTRUTURADO (${scriptScenesToFormat.length} CENAS) ===\n\n`;
      scriptScenesToFormat.forEach((s: any, sIdx: number) => {
        const sceneNum = s.sceneNumber || sIdx + 1;
        const duration = s.duration ? ` (${s.duration}s)` : '';
        const dialogueText = s.dialoguePt || s.dialogueEn || s.dialogueEs || s.dialogue || '';
        scriptText += `[CENA / SLIDE ${sceneNum}]${duration}\n`;
        if (s.contextPt) scriptText += `• Contexto da Cena: ${s.contextPt}\n`;
        if (s.videoPromptEn) scriptText += `• Prompt Visual de Geração: ${s.videoPromptEn}\n`;
        if (dialogueText) scriptText += `• Diálogo / Narração: "${dialogueText}"\n`;
        scriptText += `\n`;
      });

      return {
        formattedText: scriptText.trim(),
        characterNotes: detectedCharacterDesc || 'Continuidade de figurino, traço e paleta cinematográfica'
      };
    }

    const cleanFallback = (parsed.text || '')
      .replace(/Página\s+\d+\s+de\s+\d+\s*(?:•|-)?\s*PostForge[^\n\r]*/gi, '')
      .replace(/POSTFORGE\s+•\s+GERADOR\s+ESTRUTURADO\s+DE\s+CONTEÚDO/gi, '')
      .replace(/POSTFORGE\s+LOTE\s+DE\s+\d+\s+CARROSSÉIS/gi, '')
      .replace(/Slide\s+Completo/gi, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return { formattedText: cleanFallback };
  };

  const extractAuditBatches = (rawText: string, parsed?: any): AuditDetectedBatch[] => {
    const batches: AuditDetectedBatch[] = [];

    const formatSingleCarousel = (car: any, pNum: number, defaultNiche?: string, defaultStyle?: string): AuditDetectedBatch => {
      const cTitle = car.title || car.theme || `Carrossel ${pNum}`;
      let singleScriptText = `=== PROJETO ${pNum}: ${cTitle.toUpperCase()} ===\n`;
      
      const metaParts: string[] = [];
      const n = car.niche || defaultNiche;
      const s = car.artStyle || defaultStyle;
      if (n) metaParts.push(`Nicho: ${n}`);
      if (s) metaParts.push(`Estilo: ${s}`);
      if (metaParts.length > 0) singleScriptText += `${metaParts.join(' • ')}\n`;

      if (car.instagramPost) {
        singleScriptText += `Contexto/Legenda: ${car.instagramPost.substring(0, 160)}...\n`;
      }
      singleScriptText += `\n`;

      const slides = car.slides || [];
      slides.forEach((slide: any, sIdx: number) => {
        const slideNum = slide.slideNumber || (sIdx + 1);
        const bubbleText = slide.textInBubblesPt || slide.textInBubblesEn || slide.textInBubblesEs || slide.textInBubbles || '';
        const desc = slide.descriptionPt || slide.description || '';
        const prompt = slide.imagePromptEn || slide.prompt || '';

        singleScriptText += `[SLIDE ${slideNum}]\n`;
        if (desc) singleScriptText += `• Descrição da Cena: ${desc}\n`;
        if (prompt) singleScriptText += `• Prompt de Imagem (FLOW / I.A): ${prompt}\n`;
        if (bubbleText) singleScriptText += `• Texto no Balão: "${bubbleText}"\n`;
        singleScriptText += `\n`;
      });
      singleScriptText += `----------------------------------------------------\n`;

      return {
        id: `batch_${pNum}`,
        projectNumber: pNum,
        title: cTitle,
        niche: n,
        artStyle: s,
        slideCount: slides.length,
        formattedScriptText: singleScriptText.trim(),
        selected: true
      };
    };

    // Caso 1: Documento estruturado (JSON, Payload do PDF ou Carrosséis parseados)
    if (parsed) {
      let carousels: any[] = [];
      let defNiche = '';
      let defStyle = '';

      if (parsed.type === 'json' && parsed.data) {
        const d = parsed.data;
        if (Array.isArray(d.batchCarouselResults) && d.batchCarouselResults.length > 0) {
          carousels = d.batchCarouselResults;
        } else if (Array.isArray(d.carousels) && d.carousels.length > 0) {
          carousels = d.carousels;
        } else if (Array.isArray(d.projects) && d.projects.length > 0) {
          carousels = d.projects;
        } else if (d.carouselResult) {
          carousels = [d.carouselResult];
        }
        defNiche = d.niche || '';
        defStyle = d.artStyle || '';
      } else if (parsed.type === 'carousel' && Array.isArray(parsed.carousels)) {
        carousels = parsed.carousels;
      }

      if (carousels.length > 0) {
        carousels.forEach((car, idx) => {
          batches.push(formatSingleCarousel(car, idx + 1, defNiche, defStyle));
        });
        return batches;
      }
    }

    // Caso 2: Texto já formatado ou importado com marcadores === PROJETO X ou === CARROSSEL X
    const targetText = rawText || (parsed && parsed.text) || '';
    if (targetText) {
      const projectRegex = /(?:^|\n)\s*===\s*(?:PROJETO|CARROSSEL)\s*(\d+)[\s:]*([^\n=]*?)\s*===/gi;
      const matches = [...targetText.matchAll(projectRegex)];

      if (matches.length > 1) {
        matches.forEach((m, idx) => {
          const pNum = parseInt(m[1], 10) || (idx + 1);
          const titleCandidate = m[2].trim().replace(/^:\s*/, '') || `Carrossel ${pNum}`;
          
          const startIdx = m.index;
          const nextMatch = matches[idx + 1];
          const endIdx = nextMatch ? nextMatch.index : targetText.length;
          const blockText = targetText.slice(startIdx, endIdx).trim();

          const slideMatches = blockText.match(/(?:\[SLIDE\s*\d+\]|SLIDE\s*\d+)/gi) || [];
          const slideCount = slideMatches.length || 1;

          const nicheMatch = blockText.match(/Nicho:\s*([^•\n\r]+)/i);
          const styleMatch = blockText.match(/Estilo:\s*([^•\n\r]+)/i);

          batches.push({
            id: `batch_${pNum}`,
            projectNumber: pNum,
            title: titleCandidate,
            niche: nicheMatch ? nicheMatch[1].trim() : undefined,
            artStyle: styleMatch ? styleMatch[1].trim() : undefined,
            slideCount,
            formattedScriptText: blockText,
            selected: true
          });
        });
        return batches;
      }
    }

    return batches;
  };

  const handleImportProjectFile = async (file: File) => {
    if (!file) return;
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      addLog('doc', 'PROJETO', `Lendo arquivo "${file.name}" para importar para o PostForge...`);

      let rawText = '';

      if (ext === 'json' || ext === 'postforge') {
        rawText = await file.text();
      } else if (ext === 'txt' || ext === 'md') {
        rawText = await file.text();
      } else {
        // PDF ou Word (.docx / .doc)
        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
            resolve(b64);
          };
          reader.onerror = () => reject(new Error('Falha ao ler arquivo local'));
        });
        reader.readAsDataURL(file);
        const base64 = await base64Promise;

        // 1. Tentar recuperação instantânea direta de metadados POSTFORGE_PAYLOAD incorporados no PDF
        if (ext === 'pdf') {
          try {
            const binaryString = atob(base64);
            const payloadMatch = binaryString.match(/POSTFORGE_PAYLOAD:([A-Za-z0-9+/=]+)/);
            if (payloadMatch) {
              const decodedJson = decodeURIComponent(escape(atob(payloadMatch[1])));
              if (decodedJson && (decodedJson.startsWith('{') || decodedJson.startsWith('['))) {
                rawText = decodedJson;
                addLog('success', 'PROJETO', `✨ Metadados nativos do PostForge encontrados no PDF! Restauração em 100% de fidelidade.`);
              }
            }
          } catch {}
        }

        // 2. Se não houver payload nativo, extrair via backend
        if (!rawText) {
          const mimeType = ext === 'pdf' || file.type === 'application/pdf' ? 'application/pdf' : file.type || 'application/octet-stream';
          
          const res = await fetch(getApiUrl('/api/extract-document-text'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              data: base64,
              filename: file.name,
              mimeType
            })
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || 'Erro ao extrair texto do documento');
          }

          const data = await res.json();
          rawText = data.text || '';
        }
      }

      if (!rawText || !rawText.trim()) {
        throw new Error(`Não foi possível extrair texto legível de "${file.name}".`);
      }

      // Analisar conteúdo e reconstruir estado original da interface
      const parsed = parsePostForgeDocument(rawText);

      if (parsed.type === 'json') {
        const data = parsed.data;
        if (data.topic !== undefined) setTopic(data.topic);
        if (data.niche) setNiche(data.niche);
        if (data.artStyle) setArtStyle(data.artStyle);
        if (data.animationStyle) setAnimationStyle(data.animationStyle);
        if (data.dialogueLanguage) setDialogueLanguage(data.dialogueLanguage);
        if (data.carouselTone) setCarouselTone(data.carouselTone);
        if (data.scriptTone) setScriptTone(data.scriptTone);
        if (data.characterDescription !== undefined) setCharacterDescription(data.characterDescription);
        if (data.sceneCount) setSceneCount(data.sceneCount);
        if (data.duration) setDuration(data.duration);
        if (data.carouselQuantity) setCarouselQuantity(data.carouselQuantity);

        if (data.batchCarouselResults && Array.isArray(data.batchCarouselResults) && data.batchCarouselResults.length > 0) {
          setBatchCarouselResults(data.batchCarouselResults);
          const idx = data.activeCarouselIndex !== undefined && data.activeCarouselIndex < data.batchCarouselResults.length ? data.activeCarouselIndex : 0;
          setActiveCarouselIndex(idx);
          setCarouselResult(data.batchCarouselResults[idx]);
          setActiveTab('carousel');
          addLog('success', 'PROJETO', `📂 Lote de ${data.batchCarouselResults.length} carrosséis carregado com sucesso de "${file.name}"!`);
        } else if (data.carouselResult) {
          setCarouselResult(data.carouselResult);
          setBatchCarouselResults([data.carouselResult]);
          setActiveCarouselIndex(0);
          setActiveTab('carousel');
          addLog('success', 'PROJETO', `📂 Carrossel carregado com sucesso de "${file.name}"!`);
        } else if (data.result) {
          setResult(data.result);
          setActiveTab('script');
          addLog('success', 'PROJETO', `📂 Roteiro de vídeo carregado com sucesso de "${file.name}"!`);
        }
      } else if (parsed.type === 'carousel') {
        setBatchCarouselResults(parsed.carousels);
        setCarouselResult(parsed.carousels[0]);
        setActiveCarouselIndex(0);
        setCarouselQuantity(parsed.carousels.length);

        if (parsed.carousels[0]?.niche) setNiche(parsed.carousels[0].niche);
        if (parsed.carousels[0]?.artStyle) setArtStyle(parsed.carousels[0].artStyle);
        if (parsed.carousels[0]?.language) setDialogueLanguage(parsed.carousels[0].language);

        setActiveTab('carousel');
        addLog('success', 'PROJETO', `✅ ${parsed.carousels.length} carrossel(is) restaurado(s) e organizado(s) na interface a partir de "${file.name}"!`);
      } else if (parsed.type === 'script') {
        setResult(parsed.result);
        if (parsed.result.scenes && parsed.result.scenes.length > 0) {
          setSceneCount(parsed.result.scenes.length);
        }
        setActiveTab('script');
        addLog('success', 'PROJETO', `✅ Roteiro de vídeo (${parsed.result.scenes?.length || 0} cenas) restaurado e organizado na interface a partir de "${file.name}"!`);
      } else {
        setTopic(parsed.text.substring(0, 3000));
        addLog('info', 'PROJETO', `📄 Conteúdo do documento "${file.name}" extraído e carregado no campo de tema.`);
      }
    } catch (err: any) {
      console.error('Erro ao importar projeto:', err);
      addLog('error', 'PROJETO', `Erro ao carregar arquivo de projeto: ${err.message}`);
      alert(`Não foi possível carregar o arquivo: ${err.message}`);
    }
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
      let rawContent = '';
      
      // Para arquivos de texto direto (.txt, .md, .json, .csv, .srt, .vtt, .log, .text, .rtf)
      if (['txt', 'md', 'json', 'csv', 'srt', 'vtt', 'log', 'text', 'rtf'].includes(ext) || file.type.startsWith('text/')) {
        const text = await file.text();
        rawContent = text.trim();
        if (!rawContent) {
          throw new Error('O arquivo de texto selecionado está vazio.');
        }
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
        const fetchTimeout = setTimeout(() => controller.abort(), 25000);

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

          rawContent = data.text;
        } catch (fetchErr: any) {
          clearTimeout(fetchTimeout);
          if (fetchErr.name === 'AbortError') {
            throw new Error('Tempo limite excedido ao processar o documento (timeout de 25s).');
          }
          throw fetchErr;
        }
      }

      // Processar e Estruturar Automaticamente para a Auditoria
      const parsed = parsePostForgeDocument(rawContent);
      const { formattedText, characterNotes } = formatParsedContentForAudit(parsed);

      const finalScriptText = formattedText || rawContent;
      setAuditScriptInput(finalScriptText);

      // Identificar lotes e carrosséis individuais para seleção granular
      const batches = extractAuditBatches(finalScriptText, parsed);
      setDetectedAuditBatches(batches);

      if (characterNotes) {
        setAuditCharacterNotes(prev => {
          if (!prev.trim()) return characterNotes;
          return `${prev}\n\n${characterNotes}`;
        });
      }

      const words = finalScriptText.split(/\s+/).filter(Boolean).length;
      setAuditDocumentInfo({
        filename: file.name,
        size: file.size,
        wordCount: words
      });
      if (batches.length > 1) {
        addLog('success', 'DOCUMENTO', `Documento "${file.name}" processado: ${batches.length} carrosséis detectados (${words} palavras). Selecione os que deseja auditar.`);
      } else {
        addLog('success', 'DOCUMENTO', `Texto do documento "${file.name}" extraído e estruturado para auditoria (${words} palavras).`);
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
    setDetectedAuditBatches([]);
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
          const isDeep = s.layoutMode === 'deep_phrases' || car.layoutMode === 'deep_phrases';
          scriptText += `[SLIDE ${s.slideNumber}]\n`;
          scriptText += `• Descrição da Cena: ${s.descriptionPt}\n`;
          scriptText += `• Prompt de Imagem (FLOW / I.A): ${s.imagePromptEn}\n`;
          if (bubbleText) {
            if (isDeep) {
              const typoKey = s.typographyStyle || car.typographyStyle || 'sans_bold';
              const fontName = TOP_TYPOGRAPHY_STYLES[typoKey as TopTypographyStyle]?.fontName || typoKey;
              scriptText += `• Frase no Topo [Fonte Fixa: ${fontName}]: "${bubbleText}"\n`;
            } else {
              scriptText += `• Texto no Balão: "${bubbleText}"\n`;
            }
          }
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
      const batches = extractAuditBatches(scriptText, { 
        type: 'json', 
        data: { 
          batchCarouselResults, 
          artStyle, 
          niche: selectedNiche,
          characterDescription 
        } 
      });
      setDetectedAuditBatches(batches);
      addLog('info', 'AUDITORIA', `${batchCarouselResults.length} roteiros de carrossel puxados e organizados por projeto (${batches.length} carrosséis detectados para seleção).`);
    } else if (carouselResult && carouselResult.slides && carouselResult.slides.length > 0) {
      setDetectedAuditBatches([]);
      let scriptText = `=== ROTEIRO / STORYBOARD ESTRUTURADO (${carouselResult.slides.length} SLIDES): ${carouselResult.title || topic || 'Carrossel Sem Título'} ===\n\n`;
      carouselResult.slides.forEach((s) => {
        const bubbleText = s.textInBubblesPt || s.textInBubblesEn || s.textInBubblesEs || s.textInBubbles || '';
        const isDeep = s.layoutMode === 'deep_phrases' || carouselResult.layoutMode === 'deep_phrases';
        scriptText += `[SLIDE ${s.slideNumber}]\n`;
        scriptText += `• Descrição da Cena: ${s.descriptionPt}\n`;
        scriptText += `• Prompt de Imagem (FLOW / I.A): ${s.imagePromptEn}\n`;
        if (bubbleText) {
          if (isDeep) {
            const typoKey = s.typographyStyle || carouselResult.typographyStyle || 'sans_bold';
            const fontName = TOP_TYPOGRAPHY_STYLES[typoKey as TopTypographyStyle]?.fontName || typoKey;
            scriptText += `• Frase no Topo [Fonte Fixa: ${fontName}]: "${bubbleText}"\n`;
          } else {
            scriptText += `• Texto no Balão: "${bubbleText}"\n`;
          }
        }
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
      setDetectedAuditBatches([]);
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
      setDetectedAuditBatches([]);
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

  const handleToggleAuditBatch = (batchId: string) => {
    setDetectedAuditBatches(prev => {
      const updated = prev.map(b => b.id === batchId ? { ...b, selected: !b.selected } : b);
      const selected = updated.filter(b => b.selected);
      if (selected.length > 0) {
        setAuditScriptInput(selected.map(b => b.formattedScriptText).join('\n\n'));
      } else {
        setAuditScriptInput('');
      }
      return updated;
    });
  };

  const handleSelectAllAuditBatches = (selected: boolean) => {
    setDetectedAuditBatches(prev => {
      const updated = prev.map(b => ({ ...b, selected }));
      if (selected) {
        setAuditScriptInput(updated.map(b => b.formattedScriptText).join('\n\n'));
      } else {
        setAuditScriptInput('');
      }
      return updated;
    });
  };

  const handleSelectOnlyAuditBatch = (batchId: string) => {
    setDetectedAuditBatches(prev => {
      const updated = prev.map(b => ({ ...b, selected: b.id === batchId }));
      const single = updated.find(b => b.id === batchId);
      if (single) {
        setAuditScriptInput(single.formattedScriptText);
      }
      return updated;
    });
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

    const selectedBatches = detectedAuditBatches.length > 0 ? detectedAuditBatches.filter(b => b.selected) : [];
    if (detectedAuditBatches.length > 0 && selectedBatches.length === 0) {
      setAuditError('Por favor, selecione pelo menos 1 carrossel na lista acima para auditar.');
      addLog('warning', 'AUDITORIA', 'Tentativa de auditoria sem carrosséis selecionados.');
      return;
    }

    let scriptsTextToSend = auditScriptInput.trim();
    if (detectedAuditBatches.length > 0 && selectedBatches.length > 0) {
      if (selectedBatches.length === 1 && selectedBatches.length < detectedAuditBatches.length) {
        scriptsTextToSend = auditScriptInput.trim() || selectedBatches[0].formattedScriptText;
      } else if (selectedBatches.length < detectedAuditBatches.length) {
        scriptsTextToSend = selectedBatches.map(b => b.formattedScriptText).join('\n\n');
      }
    }

    setIsAuditing(true);
    setAuditError(null);
    setAuditResult(null);

    const modelToUse = activeProvider === 'openrouter' ? openrouterModelInput : geminiModel;
    if (detectedAuditBatches.length > 0 && selectedBatches.length > 0) {
      if (selectedBatches.length === 1) {
        addLog('ai', 'AUDITORIA', `⚡ Modo Ultra Rápido: auditando 1 carrossel (#${selectedBatches[0].projectNumber}: ${selectedBatches[0].title}) com ${uploadedAuditImages.length} imagens geradas via ${activeProvider.toUpperCase()} (${modelToUse})...`);
      } else if (selectedBatches.length < detectedAuditBatches.length) {
        addLog('ai', 'AUDITORIA', `⚡ Análise Otimizada: auditando ${selectedBatches.length} de ${detectedAuditBatches.length} carrosséis com ${uploadedAuditImages.length} imagens geradas via ${activeProvider.toUpperCase()} (${modelToUse})...`);
      } else {
        addLog('ai', 'AUDITORIA', `Iniciando Auditoria Visual em Lote: todos os ${detectedAuditBatches.length} carrosséis com ${uploadedAuditImages.length} imagens via ${activeProvider.toUpperCase()} (${modelToUse})...`);
      }
    } else {
      addLog('ai', 'AUDITORIA', `Iniciando Auditoria Visual com IA: ${uploadedAuditImages.length} imagens geradas + ${auditReferenceImages.length} refs de personagem via ${activeProvider.toUpperCase()} (${modelToUse})...`);
    }

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
        scriptsText: scriptsTextToSend,
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
            const isDeep = slide.layoutMode === 'deep_phrases' || car.layoutMode === 'deep_phrases';
            const typoKey = slide.typographyStyle || car.typographyStyle || 'sans_bold';
            const fontName = TOP_TYPOGRAPHY_STYLES[typoKey as TopTypographyStyle]?.fontName || typoKey;
            const textHeader = isDeep ? `Frase no Topo [Fonte: ${fontName}]` : `Texto no Balão`;

            content += `--- SLIDE ${slide.slideNumber} ---\n`;
            content += `Descrição da Cena: ${slide.descriptionPt}\n`;
            if (isEn) {
              content += `${textHeader} (EN): "${slide.textInBubblesEn || slide.textInBubbles || ''}"\n`;
            } else if (isEs) {
              content += `${textHeader} (ES): "${slide.textInBubblesEs || slide.textInBubbles || ''}"\n`;
            } else if (isAll) {
              content += `${textHeader} (PT): "${slide.textInBubblesPt || ''}"\n`;
              content += `${textHeader} (EN): "${slide.textInBubblesEn || ''}"\n`;
              content += `${textHeader} (ES): "${slide.textInBubblesEs || ''}"\n`;
            } else {
              content += `${textHeader} (PT): "${slide.textInBubblesPt || slide.textInBubbles || ''}"\n`;
            }
            content += `[PROMPT DE IMAGEM (FLOW / I.A)]:\n${slide.imagePromptEn || ''}\n\n`;
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
          const isDeep = slide.layoutMode === 'deep_phrases' || carouselResult.layoutMode === 'deep_phrases';
          const typoKey = slide.typographyStyle || carouselResult.typographyStyle || 'sans_bold';
          const fontName = TOP_TYPOGRAPHY_STYLES[typoKey as TopTypographyStyle]?.fontName || typoKey;
          const textHeader = isDeep ? `Frase no Topo [Fonte Fixa: ${fontName}]` : `Texto nos Balões`;

          content += `SLIDE ${slide.slideNumber}\n`;
          content += `Descrição: ${slide.descriptionPt || ''}\n`;
          if (isEn) {
            content += `${textHeader} (EN): ${slide.textInBubblesEn || slide.textInBubbles || ''}\n\n`;
          } else if (isEs) {
            content += `${textHeader} (ES): ${slide.textInBubblesEs || slide.textInBubbles || ''}\n\n`;
          } else if (isAll) {
            content += `${textHeader} (PT): ${slide.textInBubblesPt || ''}\n`;
            content += `${textHeader} (EN): ${slide.textInBubblesEn || ''}\n`;
            content += `${textHeader} (ES): ${slide.textInBubblesEs || ''}\n\n`;
          } else {
            content += `${textHeader} (PT): ${slide.textInBubblesPt || slide.textInBubbles || ''}\n\n`;
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
      let yPos = 14;
      const margin = 12;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const maxLineWidth = pageWidth - margin * 2;
      const cardWidth = maxLineWidth;
      const boxWidth = cardWidth - 10;

      const cleanPdfText = (str: any): string => {
        if (!str) return '';
        return String(str)
          .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu, '')
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
          .replace(/[^\x20-\x7E\xA0-\xFF\u0100-\u017F\u0180-\u024F\n\r\t]/g, ' ')
          .replace(/ +/g, ' ')
          .trim();
      };

      const addHeaderBanner = (mainTitle: string, subtitle: string, tags: string) => {
        const bannerHeight = 25;
        doc.setFillColor(15, 23, 42); // slate-900
        doc.roundedRect(margin, yPos, maxLineWidth, bannerHeight, 2.5, 2.5, 'F');
        
        // Brand tag
        doc.setFillColor(79, 70, 229);
        doc.roundedRect(margin + 4, yPos + 3.5, 22, 4.5, 1, 1, 'F');
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("POSTFORGE", margin + 6, yPos + 6.8);

        // Subtitle / Label
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(199, 210, 254);
        doc.text(cleanPdfText(subtitle), margin + 29, yPos + 6.8);

        // Title
        doc.setFontSize(10.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        const titleLines = doc.splitTextToSize(cleanPdfText(mainTitle), maxLineWidth - 8);
        doc.text(titleLines[0] || cleanPdfText(mainTitle), margin + 4, yPos + 14);

        // Tags / Metadata
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(cleanPdfText(tags), margin + 4, yPos + 20.5);

        yPos += bannerHeight + 4.5;
      };

      if (activeTab === 'script' && result) {
        const selectedLang = result.language || dialogueLanguage || 'pt';
        const langLabel = selectedLang === 'all' ? '3 IDIOMAS (PT, EN, ES)' : selectedLang === 'en' ? 'INGLÊS' : selectedLang === 'es' ? 'ESPANHOL' : 'PORTUGUÊS';
        
        addHeaderBanner(
          "ROTEIRO DE VÍDEO VIRAL",
          "ROTEIRO ESTRUTURADO",
          `Nicho: ${niche.toUpperCase()} • Estilo: ${animationStyle.toUpperCase()} • Idioma: ${langLabel} • ${result.scenes?.length || 0} Cenas`
        );

        if (result.nanoBananaImagePrompt) {
          const coverLines = doc.splitTextToSize(cleanPdfText(result.nanoBananaImagePrompt), boxWidth - 6);
          const coverHeight = Math.max(16, 7 + coverLines.length * 3.5);
          const cardH = coverHeight + 9;

          if (yPos + cardH > pageHeight - margin - 8) {
            doc.addPage();
            yPos = margin + 2;
          }

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(margin, yPos, cardWidth, cardH, 2.5, 2.5, 'FD');
          doc.setFillColor(79, 70, 229);
          doc.rect(margin, yPos + 1, 3, cardH - 2, 'F');

          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(79, 70, 229);
          doc.text("PROMPT DA IMAGEM DE CAPA / BANNER", margin + 6, yPos + 5.5);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(margin + 5, yPos + 7.5, boxWidth, coverHeight, 1.5, 1.5, 'FD');

          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(30, 41, 59);
          let lY = yPos + 12;
          for (const l of coverLines) {
            doc.text(l, margin + 8, lY);
            lY += 3.5;
          }
          yPos += cardH + 4;
        }

        result.scenes?.forEach((scene) => {
          const ctxText = cleanPdfText(scene.contextPt || '');
          const ctxLines = ctxText ? doc.splitTextToSize(ctxText, boxWidth - 6) : [];
          const ctxHeight = ctxLines.length > 0 ? Math.max(12, 6.5 + ctxLines.length * 3.8) : 0;

          let dialText = '';
          if (selectedLang === 'pt') dialText = `PT: "${cleanPdfText(scene.dialoguePt || scene.dialogue || '')}"`;
          else if (selectedLang === 'en') dialText = `EN: "${cleanPdfText(scene.dialogueEn || scene.dialogue || '')}"`;
          else if (selectedLang === 'es') dialText = `ES: "${cleanPdfText(scene.dialogueEs || scene.dialogue || '')}"`;
          else {
            dialText = [
              scene.dialoguePt ? `PT: "${cleanPdfText(scene.dialoguePt)}"` : '',
              scene.dialogueEn ? `EN: "${cleanPdfText(scene.dialogueEn)}"` : '',
              scene.dialogueEs ? `ES: "${cleanPdfText(scene.dialogueEs)}"` : ''
            ].filter(Boolean).join('\n');
          }
          const dialLines = dialText ? doc.splitTextToSize(dialText, boxWidth - 6) : [];
          const dialHeight = dialLines.length > 0 ? Math.max(12, 6.5 + dialLines.length * 3.8) : 0;

          const promptText = cleanPdfText(scene.videoPromptEn || '');
          const promptLines = promptText ? doc.splitTextToSize(promptText, boxWidth - 6) : [];
          const promptHeight = promptLines.length > 0 ? Math.max(12, 6.5 + promptLines.length * 3.5) : 0;

          const cardHeight = 8 + (ctxHeight ? ctxHeight + 2.5 : 0) + (dialHeight ? dialHeight + 2.5 : 0) + (promptHeight ? promptHeight + 2.5 : 0) + 3;

          if (yPos + cardHeight > pageHeight - margin - 8) {
            doc.addPage();
            yPos = margin + 2;
          }

          // Card Outer Box
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(203, 213, 225);
          doc.roundedRect(margin, yPos, cardWidth, cardHeight, 2.5, 2.5, 'FD');
          doc.setFillColor(79, 70, 229);
          doc.rect(margin, yPos + 1, 3, cardHeight - 2, 'F');

          // Header
          doc.setFillColor(79, 70, 229);
          doc.roundedRect(margin + 5, yPos + 2.5, 26, 5, 1.2, 1.2, 'F');
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(255, 255, 255);
          doc.text(`CENA ${String(scene.sceneNumber).padStart(2, '0')} (${scene.duration || 5}s)`, margin + 7, yPos + 6);

          let curY = yPos + 9.5;

          if (ctxHeight > 0) {
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin + 5, curY, boxWidth, ctxHeight, 1.5, 1.5, 'FD');
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(100, 116, 139);
            doc.text("CONTEXTO VISUAL DA CENA", margin + 7, curY + 3.8);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(15, 23, 42);
            let lineY = curY + 7.5;
            for (const l of ctxLines) {
              doc.text(l, margin + 7, lineY);
              lineY += 3.8;
            }
            curY += ctxHeight + 2.5;
          }

          if (dialHeight > 0) {
            doc.setFillColor(255, 247, 237); // orange-50
            doc.setDrawColor(254, 215, 170); // orange-200
            doc.roundedRect(margin + 5, curY, boxWidth, dialHeight, 1.5, 1.5, 'FD');
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(194, 65, 12);
            doc.text("NARRAÇÃO / DIÁLOGO", margin + 7, curY + 3.8);
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(124, 45, 18);
            let lineY = curY + 7.5;
            for (const l of dialLines) {
              doc.text(l, margin + 7, lineY);
              lineY += 3.8;
            }
            curY += dialHeight + 2.5;
          }

          if (promptHeight > 0) {
            doc.setFillColor(240, 253, 244);
            doc.setDrawColor(187, 247, 208);
            doc.roundedRect(margin + 5, curY, boxWidth, promptHeight, 1.5, 1.5, 'FD');
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(5, 150, 105);
            doc.text("PROMPT DE VÍDEO", margin + 7, curY + 3.8);
            doc.setFontSize(7);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(6, 78, 59);
            let lineY = curY + 7.5;
            for (const l of promptLines) {
              doc.text(l, margin + 7, lineY);
              lineY += 3.5;
            }
          }

          yPos += cardHeight + 3.5;
        });

        if (result.instagramPost) {
          const igText = cleanPdfText(result.instagramPost);
          const igLines = doc.splitTextToSize(igText, boxWidth - 6);
          const igHeight = Math.max(16, 7 + igLines.length * 3.8);
          const igCardH = igHeight + 8;

          if (yPos + igCardH > pageHeight - margin - 8) {
            doc.addPage();
            yPos = margin + 2;
          }

          doc.setFillColor(250, 245, 255);
          doc.setDrawColor(216, 180, 254);
          doc.roundedRect(margin, yPos, cardWidth, igCardH, 2.5, 2.5, 'FD');
          doc.setFillColor(168, 85, 247);
          doc.rect(margin, yPos + 1, 3, igCardH - 2, 'F');

          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(126, 34, 206);
          doc.text("LEGENDA DO INSTAGRAM", margin + 6, yPos + 5.5);

          doc.setFillColor(255, 255, 255);
          doc.setDrawColor(243, 232, 255);
          doc.roundedRect(margin + 5, yPos + 7.5, boxWidth, igHeight, 1.5, 1.5, 'FD');

          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(59, 7, 100);
          let lY = yPos + 12;
          for (const l of igLines) {
            doc.text(l, margin + 8, lY);
            lY += 3.8;
          }
          yPos += igCardH + 4;
        }

        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(148, 163, 184);
          doc.text(`Página ${i} de ${totalPages} • PostForge AI Video Generator`, margin, pageHeight - 6);
        }

        const fullExportState = {
          version: "1.2.0",
          timestamp: new Date().toISOString(),
          activeTab: 'script',
          topic,
          niche,
          artStyle,
          animationStyle,
          dialogueLanguage,
          scriptTone,
          characterDescription,
          sceneCount,
          duration,
          result
        };
        try {
          const base64Payload = btoa(unescape(encodeURIComponent(JSON.stringify(fullExportState))));
          doc.setProperties({
            title: 'Roteiro de Vídeo - PostForge',
            subject: `POSTFORGE_PAYLOAD:${base64Payload}`,
            author: 'PostForge v1.2.0'
          });
        } catch {}

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
          const selectedLang = car.language || dialogueLanguage || 'pt';
          const langLabel = selectedLang === 'all' ? '3 IDIOMAS (PT, EN, ES)' : selectedLang === 'en' ? 'INGLÊS' : selectedLang === 'es' ? 'ESPANHOL' : 'PORTUGUÊS';

          addHeaderBanner(
            isBatch ? `CARROSSEL ${cIdx + 1}: ${cTitle.toUpperCase()}` : cTitle.toUpperCase(),
            isBatch ? `LOTE DE ${listToExport.length} CARROSSÉIS` : "CARROSSEL ESTRUTURADO",
            `Nicho: ${niche.toUpperCase()} • Estilo: ${artStyle.toUpperCase()} • Idioma: ${langLabel} • ${car.slides?.length || 0} Slides`
          );

          car.slides?.forEach((slide) => {
            // Visual Description lines & height
            const descText = cleanPdfText(slide.descriptionPt || '');
            const descLines = descText ? doc.splitTextToSize(descText, boxWidth - 6) : [];
            const descHeight = descLines.length > 0 ? Math.max(12, 6.5 + descLines.length * 3.8) : 0;

            // Dialogue lines & height
            let dialText = '';
            if (selectedLang === 'pt') dialText = `PT: "${cleanPdfText(slide.textInBubblesPt || slide.textInBubbles || '')}"`;
            else if (selectedLang === 'en') dialText = `EN: "${cleanPdfText(slide.textInBubblesEn || slide.textInBubbles || '')}"`;
            else if (selectedLang === 'es') dialText = `ES: "${cleanPdfText(slide.textInBubblesEs || slide.textInBubbles || '')}"`;
            else {
              dialText = [
                slide.textInBubblesPt ? `PT: "${cleanPdfText(slide.textInBubblesPt)}"` : '',
                slide.textInBubblesEn ? `EN: "${cleanPdfText(slide.textInBubblesEn)}"` : '',
                slide.textInBubblesEs ? `ES: "${cleanPdfText(slide.textInBubblesEs)}"` : ''
              ].filter(Boolean).join('\n');
            }
            const dialLines = dialText ? doc.splitTextToSize(dialText, boxWidth - 6) : [];
            const dialHeight = dialLines.length > 0 ? Math.max(12, 6.5 + dialLines.length * 3.8) : 0;

            // Image Prompt lines & height
            const promptText = cleanPdfText(slide.imagePromptEn || '');
            const promptLines = promptText ? doc.splitTextToSize(promptText, boxWidth - 6) : [];
            const promptHeight = promptLines.length > 0 ? Math.max(12, 6.5 + promptLines.length * 3.5) : 0;

            // Total Card Height calculation
            const cardHeight = 8 + (descHeight ? descHeight + 2.5 : 0) + (dialHeight ? dialHeight + 2.5 : 0) + (promptHeight ? promptHeight + 2.5 : 0) + 3;

            // Check if card fits on page - never cut cards across pages!
            if (yPos + cardHeight > pageHeight - margin - 8) {
              doc.addPage();
              yPos = margin + 2;
            }

            // Draw Card Container
            doc.setFillColor(248, 250, 252); // slate-50
            doc.setDrawColor(203, 213, 225); // slate-300
            doc.roundedRect(margin, yPos, cardWidth, cardHeight, 2.5, 2.5, 'FD');

            // Left Indigo Accent Bar
            doc.setFillColor(79, 70, 229);
            doc.rect(margin, yPos + 1, 3, cardHeight - 2, 'F');

            // Slide Pill Header
            doc.setFillColor(79, 70, 229);
            doc.roundedRect(margin + 5, yPos + 2.5, 20, 5, 1.2, 1.2, 'F');
            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(255, 255, 255);
            doc.text(`SLIDE ${String(slide.slideNumber).padStart(2, '0')}`, margin + 7, yPos + 6);

            doc.setFillColor(224, 231, 255);
            doc.roundedRect(margin + 26, yPos + 2.5, 24, 5, 1.2, 1.2, 'F');
            doc.setFontSize(6.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(67, 56, 202);
            doc.text("Slide Completo", margin + 28, yPos + 6);

            let curY = yPos + 9.5;

            // Sub-box 1: Visual Description
            if (descHeight > 0) {
              doc.setFillColor(255, 255, 255);
              doc.setDrawColor(226, 232, 240);
              doc.roundedRect(margin + 5, curY, boxWidth, descHeight, 1.5, 1.5, 'FD');

              doc.setFontSize(6.5);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(100, 116, 139);
              doc.text("CONTEÚDO DO SLIDE (DESCRIÇÃO VISUAL)", margin + 7, curY + 3.8);

              doc.setFontSize(7.5);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(15, 23, 42);
              let lineY = curY + 7.5;
              for (const l of descLines) {
                doc.text(l, margin + 7, lineY);
                lineY += 3.8;
              }
              curY += descHeight + 2.5;
            }

            // Sub-box 2: Speech Bubble / Dialogue OR Deep Phrase at Top
            if (dialHeight > 0) {
              const isDeep = slide.layoutMode === 'deep_phrases' || car.layoutMode === 'deep_phrases';
              const typoKey = slide.typographyStyle || car.typographyStyle || 'sans_bold';
              const fontName = TOP_TYPOGRAPHY_STYLES[typoKey as TopTypographyStyle]?.fontName || typoKey;

              if (isDeep) {
                doc.setFillColor(254, 243, 199); // amber-100
                doc.setDrawColor(251, 191, 36); // amber-400
                doc.roundedRect(margin + 5, curY, boxWidth, dialHeight, 1.5, 1.5, 'FD');

                doc.setFontSize(6.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(180, 83, 9); // amber-700
                doc.text(`FRASE DE IMPACTO NO TOPO [FONTE FIXA: ${cleanPdfText(fontName).toUpperCase()}]`, margin + 7, curY + 3.8);

                doc.setFontSize(7.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(120, 53, 15); // amber-900
                let lineY = curY + 7.5;
                for (const l of dialLines) {
                  doc.text(l, margin + 7, lineY);
                  lineY += 3.8;
                }
              } else {
                doc.setFillColor(239, 246, 255); // blue-50
                doc.setDrawColor(191, 219, 254); // blue-200
                doc.roundedRect(margin + 5, curY, boxWidth, dialHeight, 1.5, 1.5, 'FD');

                doc.setFontSize(6.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(29, 78, 216); // blue-700
                doc.text("FALA NO BALÃO DE DIÁLOGO", margin + 7, curY + 3.8);

                doc.setFontSize(7.5);
                doc.setFont("helvetica", "bold");
                doc.setTextColor(30, 58, 138); // blue-900
                let lineY = curY + 7.5;
                for (const l of dialLines) {
                  doc.text(l, margin + 7, lineY);
                  lineY += 3.8;
                }
              }
              curY += dialHeight + 2.5;
            }

            // Sub-box 3: Image Prompt
            if (promptHeight > 0) {
              doc.setFillColor(240, 253, 244); // emerald-50
              doc.setDrawColor(187, 247, 208); // emerald-200
              doc.roundedRect(margin + 5, curY, boxWidth, promptHeight, 1.5, 1.5, 'FD');

              doc.setFontSize(6.5);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(5, 150, 105); // emerald-600
              doc.text("PROMPT DE IMAGEM (FLOW / I.A)", margin + 7, curY + 3.8);

              doc.setFontSize(7);
              doc.setFont("helvetica", "normal");
              doc.setTextColor(6, 78, 59); // emerald-950
              let lineY = curY + 7.5;
              for (const l of promptLines) {
                doc.text(l, margin + 7, lineY);
                lineY += 3.5;
              }
            }

            yPos += cardHeight + 3.5;
          });

          // Instagram Post Card
          if (car.instagramPost) {
            const igText = cleanPdfText(car.instagramPost);
            const igLines = doc.splitTextToSize(igText, boxWidth - 6);
            const igHeight = Math.max(16, 7 + igLines.length * 3.8);
            const igCardH = igHeight + 8;

            if (yPos + igCardH > pageHeight - margin - 8) {
              doc.addPage();
              yPos = margin + 2;
            }

            doc.setFillColor(250, 245, 255); // purple-50
            doc.setDrawColor(216, 180, 254); // purple-300
            doc.roundedRect(margin, yPos, cardWidth, igCardH, 2.5, 2.5, 'FD');
            doc.setFillColor(168, 85, 247); // purple-500
            doc.rect(margin, yPos + 1, 3, igCardH - 2, 'F');

            doc.setFontSize(7.5);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(126, 34, 206);
            doc.text("LEGENDA DO INSTAGRAM", margin + 6, yPos + 5.5);

            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(243, 232, 255);
            doc.roundedRect(margin + 5, yPos + 7.5, boxWidth, igHeight, 1.5, 1.5, 'FD');

            doc.setFontSize(7.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(59, 7, 100);
            let lY = yPos + 12;
            for (const l of igLines) {
              doc.text(l, margin + 8, lY);
              lY += 3.8;
            }
            yPos += igCardH + 4;
          }
        });

        // Add page numbers on all pages
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(148, 163, 184);
          doc.text(`Página ${i} de ${totalPages} • PostForge AI Carousel Generator`, margin, pageHeight - 6);
        }

        const fullExportState = {
          version: "1.2.0",
          timestamp: new Date().toISOString(),
          activeTab: 'carousel',
          topic,
          niche,
          artStyle,
          animationStyle,
          dialogueLanguage,
          carouselTone,
          characterDescription,
          carouselQuantity,
          batchCarouselResults: isBatch ? listToExport : undefined,
          carouselResult: !isBatch ? listToExport[0] : undefined
        };
        try {
          const base64Payload = btoa(unescape(encodeURIComponent(JSON.stringify(fullExportState))));
          doc.setProperties({
            title: isBatch ? `Lote de ${listToExport.length} Carrosséis - PostForge` : (listToExport[0]?.title || 'Carrossel PostForge'),
            subject: `POSTFORGE_PAYLOAD:${base64Payload}`,
            author: 'PostForge v1.2.0'
          });
        } catch {}

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
            const isDeep = slide.layoutMode === 'deep_phrases' || car.layoutMode === 'deep_phrases';
            const typoKey = slide.typographyStyle || car.typographyStyle || 'sans_bold';
            const fontName = TOP_TYPOGRAPHY_STYLES[typoKey as TopTypographyStyle]?.fontName || typoKey;
            const textLabel = isDeep ? `Frase no Topo [Fonte: ${fontName}]` : `Diálogos`;
            const labelColor = isDeep ? "B45309" : "2563EB";

            children.push(new Paragraph({ children: [new TextRun({ text: "Descrição Visual: ", bold: true }), new TextRun({ text: slide.descriptionPt || '' })] }));
            if (isEn) {
              children.push(new Paragraph({ children: [new TextRun({ text: `${textLabel} (EN): `, bold: true, color: labelColor }), new TextRun({ text: slide.textInBubblesEn || slide.textInBubbles || '' })] }));
            } else if (isEs) {
              children.push(new Paragraph({ children: [new TextRun({ text: `${textLabel} (ES): `, bold: true, color: labelColor }), new TextRun({ text: slide.textInBubblesEs || slide.textInBubbles || '' })] }));
            } else if (isAll) {
              children.push(new Paragraph({ children: [new TextRun({ text: `${textLabel} (PT): `, bold: true, color: labelColor }), new TextRun({ text: slide.textInBubblesPt || '' })] }));
              children.push(new Paragraph({ children: [new TextRun({ text: `${textLabel} (EN): `, bold: true, color: labelColor }), new TextRun({ text: slide.textInBubblesEn || '' })] }));
              children.push(new Paragraph({ children: [new TextRun({ text: `${textLabel} (ES): `, bold: true, color: labelColor }), new TextRun({ text: slide.textInBubblesEs || '' })] }));
            } else {
              children.push(new Paragraph({ children: [new TextRun({ text: `${textLabel} (PT): `, bold: true, color: labelColor }), new TextRun({ text: slide.textInBubblesPt || slide.textInBubbles || '' })] }));
            }
            children.push(new Paragraph({ children: [new TextRun({ text: "Prompt de Imagem (FLOW / I.A): ", bold: true, color: "059669" }), new TextRun({ text: slide.imagePromptEn || '' })] }));
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

  const compressImageForVision = (dataUrl: string, maxDim = 512): Promise<{ data: string; mimeType: string }> => {
    return new Promise((resolve) => {
      const safeDataUrl = normalizeImageDataUrl(dataUrl);
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
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
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const [h, b64] = compressedDataUrl.split(',');
          const mime = h.includes(':') ? h.split(':')[1].split(';')[0] : 'image/jpeg';
          resolve({ data: b64, mimeType: mime });
          return;
        }
        const [h, b64] = safeDataUrl.split(',');
        const mime = h.includes(':') ? h.split(':')[1].split(';')[0] : 'image/jpeg';
        resolve({ data: b64 || safeDataUrl, mimeType: mime || 'image/jpeg' });
      };
      img.onerror = () => {
        const [h, b64] = safeDataUrl.split(',');
        const mime = h.includes(':') ? h.split(':')[1].split(';')[0] : 'image/jpeg';
        resolve({ data: b64 || safeDataUrl, mimeType: mime || 'image/jpeg' });
      };
      img.src = safeDataUrl;
    });
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawDataUrl = (event.target?.result as string) || '';
      const dataUrl = normalizeImageDataUrl(rawDataUrl, file.name);
      const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      const header = dataUrl.includes(',') ? dataUrl.split(',')[0] : '';
      const mimeType = header.includes(':') ? header.split(':')[1].split(';')[0] : (file.type || 'image/jpeg');
      
      setCharacterImages(prev => {
        const newImages = [...prev];
        newImages[index] = { data: b64, mimeType: mimeType || 'image/jpeg' };
        return newImages;
      });

      // Análise automática ultrarrápida das cores e traços visuais do personagem
      setAnalyzingCharacterIndex(prev => ({ ...prev, [index]: true }));
      addLog('ai', 'PERSONAGEM', `Analisando cores e características visuais do Personagem ${index + 1}...`);
      
      try {
        const compressed = await compressImageForVision(dataUrl, 512);
        const res = await apiFetch('/api/analyze-character', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: compressed.data, mimeType: compressed.mimeType })
        });
        if (res.ok) {
          const json = await res.json();
          if (json.success && json.data) {
            const { characterName, primaryColor, secondaryColors, visualFeatures, englishPromptDescription } = json.data;
            const secStr = Array.isArray(secondaryColors) && secondaryColors.length > 0 ? ` e ${secondaryColors.join(', ')}` : '';
            const detectedInfo = `${characterName || `Personagem ${index + 1}`} (Cor: ${primaryColor}${secStr} - ${visualFeatures || ''})`;
            
            setDetectedCharacterDetails(prev => {
              const updated = [...prev];
              updated[index] = {
                name: characterName || `Personagem ${index + 1}`,
                color: primaryColor,
                secondaryColors: secondaryColors || [],
                features: visualFeatures,
                englishDesc: englishPromptDescription
              };
              return updated;
            });

            setCharacterDescription(prev => {
              const prefix = `Personagem ${index + 1}: ${detectedInfo}`;
              if (!prev.trim()) return prefix;
              if (prev.includes(`Personagem ${index + 1}:`)) {
                return prev.replace(new RegExp(`Personagem ${index + 1}:[^;\\n]+`, 'g'), prefix);
              }
              return `${prev}; ${prefix}`;
            });

            addLog('success', 'PERSONAGEM', `✨ Personagem ${index + 1} identificado: "${characterName}" com cor principal "${primaryColor}". Consistência ativada.`);
          }
        }
      } catch (err: any) {
        console.warn('Erro ao analisar personagem automaticamente:', err);
      } finally {
        setAnalyzingCharacterIndex(prev => ({ ...prev, [index]: false }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = (index: number) => {
    setCharacterImages(prev => {
      const newImages = [...prev];
      newImages[index] = undefined;
      return newImages;
    });
    setDetectedCharacterDetails(prev => {
      const updated = [...prev];
      updated[index] = undefined;
      return updated;
    });
  };

  const handleContextImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawDataUrl = (event.target?.result as string) || '';
        const dataUrl = normalizeImageDataUrl(rawDataUrl, file.name);
        const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
        const header = dataUrl.includes(',') ? dataUrl.split(',')[0] : '';
        const mimeType = header.includes(':') ? header.split(':')[1].split(';')[0] : (file.type || 'image/jpeg');
        
        setContextImages(prev => [...prev, { data: b64, mimeType: mimeType || 'image/jpeg' }]);
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

  const handleShieldPromptAgainstBlankBubbles = (slideIdx: number) => {
    const isTargetDeep = carouselResult?.slides?.[slideIdx]?.layoutMode === 'deep_phrases' 
      || carouselResult?.layoutMode === 'deep_phrases'
      || batchCarouselResults[activeCarouselIndex]?.slides?.[slideIdx]?.layoutMode === 'deep_phrases'
      || batchCarouselResults[activeCarouselIndex]?.layoutMode === 'deep_phrases'
      || carouselLayoutMode === 'deep_phrases';

    const shieldSnippet = isTargetDeep
      ? ` | STRICT COMPOSITION RULE: ABSOLUTELY NO SPEECH BUBBLES, NO DIALOGUE CLOUDS, NO FLOATING TEXT. The top 25-30% of the image MUST remain clean, uncluttered, and open with negative space for typography overlay. Characters interact through expressive gestures, authentic glances and meaningful cinematic silence.`
      : ` | CRITICAL ANTI-ARTIFACT RULE: STRICTLY FORBID EMPTY OR BLANK SPEECH BUBBLES. Only the speaking character has a speech bubble with the written text. The listening character MUST NOT have any speech bubble, thought bubble, or text above it. Exactly one bubble in the entire frame, with no unfilled bubbles anywhere.`;

    if (carouselResult && carouselResult.slides && carouselResult.slides[slideIdx]) {
      const currentPrompt = carouselResult.slides[slideIdx].imagePromptEn || '';
      if (currentPrompt.includes('CRITICAL ANTI-ARTIFACT RULE') || currentPrompt.includes('STRICT COMPOSITION RULE')) {
        addLog('info', 'PROMPT', `O Slide ${slideIdx + 1} já possui as diretrizes de blindagem aplicadas.`);
        return;
      }
      const updatedSlides = [...carouselResult.slides];
      updatedSlides[slideIdx] = {
        ...updatedSlides[slideIdx],
        imagePromptEn: currentPrompt + shieldSnippet
      };
      setCarouselResult({ ...carouselResult, slides: updatedSlides });
      addLog('success', 'PROMPT', isTargetDeep ? `🛡️ Slide ${slideIdx + 1} blindado com respiro de 25% no topo e zero balões!` : `🛡️ Slide ${slideIdx + 1} blindado contra balões vazios (FLOW / I.A)!`);
      return;
    }

    if (batchCarouselResults.length > 0 && batchCarouselResults[activeCarouselIndex]?.slides?.[slideIdx]) {
      const targetCar = batchCarouselResults[activeCarouselIndex];
      const currentPrompt = targetCar.slides[slideIdx].imagePromptEn || '';
      if (currentPrompt.includes('CRITICAL ANTI-ARTIFACT RULE') || currentPrompt.includes('STRICT COMPOSITION RULE')) {
        addLog('info', 'PROMPT', `O Slide ${slideIdx + 1} já possui as diretrizes de blindagem aplicadas.`);
        return;
      }
      const updatedSlides = [...targetCar.slides];
      updatedSlides[slideIdx] = {
        ...updatedSlides[slideIdx],
        imagePromptEn: currentPrompt + shieldSnippet
      };
      const updatedBatch = [...batchCarouselResults];
      updatedBatch[activeCarouselIndex] = {
        ...targetCar,
        slides: updatedSlides
      };
      setBatchCarouselResults(updatedBatch);
      addLog('success', 'PROMPT', isTargetDeep ? `🛡️ Slide ${slideIdx + 1} do Carrossel ${activeCarouselIndex + 1} blindado com respiro de 25% no topo e zero balões!` : `🛡️ Slide ${slideIdx + 1} do Carrossel ${activeCarouselIndex + 1} blindado contra balões vazios!`);
    }
  };

  /**
   * Helper seguro para download de imagens geradas (tanto Data URL quanto URL HTTP)
   */
  const downloadImageSafe = (url: string, filename: string) => {
    if (!url) return;
    if (url.startsWith('data:')) {
      saveAs(url, filename);
    } else {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  /**
   * Gera preview de imagem gratuito com Pollinations.ai (modelo FLUX.1 com contingência automática)
   * Tenta primeiro via proxy backend (que não sofre bloqueio de Origin/Turnstile do Cloudflare).
   * Se o backend estiver desconectado, usa URL direta compatível com tags <img> no navegador.
   */
  const requestPollinationsFluxPreview = async (
    prompt: string, 
    width = 1080, 
    height = 1350, 
    seed?: number
  ): Promise<string> => {
    const safeSeed = seed || Math.floor(Math.random() * 1000000);
    const cleanPrompt = prompt.trim().slice(0, 1800);

    // 1. Tenta pelo endpoint local /api/generate-preview (resiliente, server-to-server)
    try {
      const resp = await apiFetch('/api/generate-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cleanPrompt, width, height, model: 'flux', seed: safeSeed })
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.dataUrl) return data.dataUrl;
      } else {
        const errJson = await resp.json().catch(() => ({}));
        if (resp.status === 404) {
          throw new Error("O servidor do PostForge precisa ser reiniciado para ativar a nova rota de preview (HTTP 404).");
        }
        if (errJson && errJson.error) {
          throw new Error(errJson.error);
        }
      }
    } catch (backendErr: any) {
      if (backendErr.message && backendErr.message.includes("servidor do PostForge precisa ser reiniciado")) {
        throw backendErr;
      }
      console.warn("Proxy backend de preview não respondeu, utilizando URL direta:", backendErr);
    }

    // 2. Fallback: URL direta de imagem (tags <img> com referrerpolicy="no-referrer" carregam perfeitamente sem bloqueio Turnstile)
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(cleanPrompt)}?width=${width}&height=${height}&nologo=true&seed=${safeSeed}`;
  };

  /**
   * Gera o preview de 1 slide específico do carrossel
   */
  const handleGenerateSlidePreview = async (slideIdx: number, forceNewSeed = false) => {
    const targetSlide = carouselResult?.slides?.[slideIdx] || batchCarouselResults[activeCarouselIndex]?.slides?.[slideIdx];
    if (!targetSlide || !targetSlide.imagePromptEn) {
      addLog('warning', 'PREVIEW', `Slide ${slideIdx + 1} não possui prompt de imagem válido.`);
      return;
    }

    setGeneratingSlidePreviews(prev => ({ ...prev, [slideIdx]: true }));
    addLog('ai', 'PREVIEW', `Gerando arte instantânea do Slide ${slideIdx + 1} com FLUX.1 (Pollinations)...`);

    try {
      const seed = forceNewSeed ? Math.floor(Math.random() * 1000000) : undefined;
      const dataUrl = await requestPollinationsFluxPreview(targetSlide.imagePromptEn, 1080, 1350, seed);

      // Atualiza carouselResult
      if (carouselResult && carouselResult.slides && carouselResult.slides[slideIdx]) {
        const updatedSlides = [...carouselResult.slides];
        updatedSlides[slideIdx] = {
          ...updatedSlides[slideIdx],
          imageUrl: dataUrl
        };
        setCarouselResult({ ...carouselResult, slides: updatedSlides });
      }

      // Atualiza batchCarouselResults
      if (batchCarouselResults.length > 0 && batchCarouselResults[activeCarouselIndex]?.slides?.[slideIdx]) {
        const targetCar = batchCarouselResults[activeCarouselIndex];
        const updatedSlides = [...targetCar.slides];
        updatedSlides[slideIdx] = {
          ...updatedSlides[slideIdx],
          imageUrl: dataUrl
        };
        const updatedBatch = [...batchCarouselResults];
        updatedBatch[activeCarouselIndex] = {
          ...targetCar,
          slides: updatedSlides
        };
        setBatchCarouselResults(updatedBatch);
      }

      addLog('success', 'PREVIEW', `✨ Imagem do Slide ${slideIdx + 1} gerada com sucesso via FLUX.1!`);
    } catch (err: any) {
      console.error(err);
      addLog('error', 'PREVIEW', `Erro ao gerar preview do Slide ${slideIdx + 1}: ${err.message || err}`);
    } finally {
      setGeneratingSlidePreviews(prev => ({ ...prev, [slideIdx]: false }));
    }
  };

  /**
   * Gera os previews de todos os slides do carrossel em sequência
   */
  const handleGenerateAllSlidePreviews = async () => {
    const currentSlides = carouselResult?.slides || batchCarouselResults[activeCarouselIndex]?.slides || [];
    if (currentSlides.length === 0) {
      addLog('warning', 'PREVIEW', 'Nenhum slide disponível para gerar preview.');
      return;
    }

    setIsGeneratingAllPreviews(true);
    setPreviewBatchProgress({ current: 0, total: currentSlides.length });
    addLog('ai', 'PREVIEW', `Iniciando geração em lote de ${currentSlides.length} previews via FLUX.1...`);

    let successCount = 0;
    for (let i = 0; i < currentSlides.length; i++) {
      setPreviewBatchProgress({ current: i + 1, total: currentSlides.length });
      try {
        await handleGenerateSlidePreview(i);
        successCount++;
      } catch (err) {
        console.error(`Erro ao gerar slide ${i + 1}:`, err);
      }
    }

    setIsGeneratingAllPreviews(false);
    addLog('success', 'PREVIEW', `🎉 Lote de previews finalizado: ${successCount} de ${currentSlides.length} imagens geradas com sucesso!`);
  };

  /**
   * Gera o preview da capa do vídeo no Roteiro (Script)
   */
  const handleGenerateVideoCoverPreview = async () => {
    const coverPrompt = result?.nanoBananaImagePrompt;
    if (!coverPrompt) {
      addLog('warning', 'PREVIEW', 'Nenhum prompt de capa de vídeo encontrado.');
      return;
    }

    setGeneratingVideoCoverPreview(true);
    addLog('ai', 'PREVIEW', 'Gerando preview da Capa do Vídeo com FLUX.1...');

    try {
      const dataUrl = await requestPollinationsFluxPreview(coverPrompt, 1080, 1920);
      setVideoCoverPreviewUrl(dataUrl);
      addLog('success', 'PREVIEW', '✨ Preview da Capa do Vídeo gerado com sucesso via FLUX.1!');
    } catch (err: any) {
      console.error(err);
      addLog('error', 'PREVIEW', `Erro ao gerar preview da capa: ${err.message || err}`);
    } finally {
      setGeneratingVideoCoverPreview(false);
    }
  };

  const handleUploadClonerImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray: File[] = Array.from(files);

    const newImages: { data: string; mimeType: string; name: string; preview: string }[] = [];
    for (const file of fileArray) {
      try {
        const rawDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string) || '');
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const dataUrl = normalizeImageDataUrl(rawDataUrl, file.name);
        const compressed = await compressImageForVision(dataUrl, 768);
        const previewUrl = `data:${compressed.mimeType};base64,${compressed.data}`;
        newImages.push({
          data: compressed.data,
          mimeType: compressed.mimeType,
          name: file.name,
          preview: previewUrl || dataUrl
        });
      } catch (err) {
        console.error("Erro ao carregar imagem para clonagem:", file.name, err);
      }
    }

    setClonerSourceImages(prev => [...prev, ...newImages]);
    addLog('info', 'CLONADOR', `${fileArray.length} imagem(ns) adicionada(s) para clonagem. Total: ${clonerSourceImages.length + fileArray.length}`);
    e.target.value = '';
  };

  const handleRemoveClonerImage = (index: number) => {
    setClonerSourceImages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAllClonerImages = () => {
    setClonerSourceImages([]);
  };

  const handleUploadCustomCloneCharImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || '');
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const dataUrl = normalizeImageDataUrl(rawDataUrl, file.name);
      const compressed = await compressImageForVision(dataUrl, 512);
      const previewUrl = `data:${compressed.mimeType};base64,${compressed.data}`;
      setCustomCloneCharImg({
        data: compressed.data,
        mimeType: compressed.mimeType,
        preview: previewUrl || dataUrl
      });
      addLog('info', 'CLONADOR', `Foto do personagem personalizada carregada com sucesso.`);
    } catch (err) {
      console.error("Erro ao carregar avatar do personagem personalizado:", err);
    }
    e.target.value = '';
  };

  const handleExecuteImageClone = async () => {
    if (clonerSourceImages.length === 0) {
      setError('Por favor, carregue pelo menos 1 imagem para clonar.');
      addLog('warning', 'CLONADOR', 'Tentativa de clonagem sem imagens.');
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsCloningImages(true);
    setIsLoading(true);
    setError(null);
    setResult(null);
    setCarouselResult(null);

    try {
      addLog('ai', 'CLONADOR', `Iniciando clonagem de ${clonerSourceImages.length} imagem(ns) com análise de visão computacional Gemini Vision...`);

      let targetCharacterPayload: any = undefined;

      if (clonerTargetCharMode === 'active') {
        const activeChar = characterImages[0];
        const activeDetail = detectedCharacterDetails[0];
        if (activeChar && activeChar.data) {
          targetCharacterPayload = {
            name: activeDetail?.name || "Personagem Principal",
            color: activeDetail?.color || "",
            secondaryColors: activeDetail?.secondaryColors || [],
            features: activeDetail?.features || "",
            englishDesc: activeDetail?.englishDesc || "",
            data: activeChar.data,
            mimeType: activeChar.mimeType
          };
          addLog('info', 'CLONADOR', `Substituição ativada: Usando personagem principal "${targetCharacterPayload.name}" (Cor: ${targetCharacterPayload.color || 'Padrão'}).`);
        } else {
          addLog('info', 'CLONADOR', `Nenhum personagem carregado no app. A IA clonará a cena mantendo fidelidade total.`);
        }
      } else if (clonerTargetCharMode === 'custom') {
        targetCharacterPayload = {
          name: customCloneCharName || "Personagem Personalizado",
          color: customCloneCharColor || "",
          secondaryColors: [],
          features: customCloneCharDesc || "",
          englishDesc: customCloneCharDesc || "",
          data: customCloneCharImg?.data,
          mimeType: customCloneCharImg?.mimeType
        };
        addLog('info', 'CLONADOR', `Substituição ativada: Usando personagem personalizado "${targetCharacterPayload.name}".`);
      } else {
        addLog('info', 'CLONADOR', `Modo sem substituição: Clonagem fiel de cada cena.`);
      }

      const response = await apiFetch('/api/cloner/clone-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: clonerSourceImages.map(img => ({
            data: img.data,
            mimeType: img.mimeType,
            name: img.name
          })),
          targetCharacter: targetCharacterPayload,
          options: {
            dialogueLanguage: 'pt'
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => null);
        throw new Error(errJson?.error || `Erro HTTP ${response.status} ao clonar imagens.`);
      }

      const data = await response.json();
      if (!data.success || !data.data) {
        throw new Error(data.error || 'Resposta inválida do servidor ao clonar imagens.');
      }

      const rawSlides = data.data.slides || [];
      const slidesWithPreview = rawSlides.map((slide: any, idx: number) => ({
        ...slide,
        originalImagePreview: clonerSourceImages[idx]?.preview || (clonerSourceImages[idx]?.data ? `data:${clonerSourceImages[idx].mimeType};base64,${clonerSourceImages[idx].data}` : undefined),
        originalImageName: clonerSourceImages[idx]?.name
      }));

      const clonedCarousel: GeneratedCarousel = {
        title: data.data.title || `Post Clonado (${slidesWithPreview.length} imagens)`,
        theme: `Clonagem Reversa de Imagens (${slidesWithPreview.length} slides)`,
        language: 'pt',
        isCloned: true,
        slides: slidesWithPreview,
        instagramPost: data.data.instagramPost || ''
      };

      setCarouselResult(clonedCarousel);
      setBatchCarouselResults([clonedCarousel]);
      setActiveCarouselIndex(0);
      addLog('success', 'CLONADOR', `🎉 Clonagem finalizada com sucesso! ${slidesWithPreview.length} slides gerados com prompts idênticos em inglês e legendas.`);
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog('warning', 'CLONADOR', 'Clonagem cancelada pelo usuário.');
        return;
      }
      console.error("Cloner error:", err);
      setError(err.message || 'Erro ao clonar imagens.');
      addLog('error', 'CLONADOR', `Falha na clonagem: ${err.message}`);
    } finally {
      setIsCloningImages(false);
      setIsLoading(false);
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
        
        INSTRUÇÕES PARA O DIÁLOGO/NARRAÇÃO E PERSONAGENS:
        - IDENTIFICAÇÃO DE CORES E PERSONAGENS: Se houver imagens de personagens enviadas, analise-as com máxima atenção e identifique as CORES EXATAS e características de cada um (ex: Coração Azul com costuras, Cérebro Cinza com circuitos). No prompt em inglês "videoPromptEn", descreva os personagens mencionando explicitamente suas CORES, QUEM ESTÁ FALANDO e QUEM ESTÁ OUVINDO, ou a fala de cada um segundo suas características.
        - O "videoPromptEn" DEVE SER SEMPRE E INTEGRALMENTE EM INGLÊS.
        - IDENTIFICAÇÃO DE VOZ: Analise as imagens de personagem enviadas. Se houver um personagem feminino proeminente, a voz da narração deve ser FEMININA. Se for masculino, MASCULINA. Se não houver clareza ou não houver fotos, use uma voz que melhor se adapte ao tema.
        - Use PSICOLOGIA e FILOSOFIA para criar falas que toquem na ferida, que façam o espectador se sentir compreendido.
        - O objetivo é gerar identificação visceral. O espectador deve pensar: "Isso foi escrito para mim".
        ${niche !== 'Top 10 Filmes e Séries' && niche !== 'Fitness' && niche !== 'Soluções para o Dia a Dia (Faça Você Mesmo)' ? `
        - ${scriptTone === 'Acolhedor / Compassivo' ? 'Use um tom acolhedor e compassivo: diálogo suave, focado em validação emocional profunda, carinho e acolhimento sem cobranças ou julgamentos, ideal para cura interna e autocompaixão.' : ''}
        - ${scriptTone === 'Terapêutico / ACT' ? 'Use uma abordagem terapêutica baseada em ACT (Terapia de Aceitação e Compromisso): foco na observação consciente dos pensamentos ("você não é seus pensamentos"), aceitação de emoções difíceis sem lutar contra elas e atenção plena ao momento presente.' : ''}
        - ${scriptTone === 'Vulnerável / Íntimo' ? 'Use um tom vulnerável e íntimo: conversas sinceras e abertas sobre carência, medos, sensação de abandono e dor emocional que gerem identificação imediata.' : ''}
        - ${scriptTone === 'Encorajador / Reparador' ? 'Use um tom encorajador e reparador: foco em restaurar a autoestima, perdoar erros do passado, reconstruir o amor-próprio e firmar compromissos pessoais gentis.' : ''}
        - ${scriptTone === 'Poético' ? 'Use rimas suaves, métrica e metáforas visuais delicadas, focando na beleza da dor e da superação.' : ''}
        - ${scriptTone === 'Metafórico e Profundo' ? 'Use analogias com a natureza, o universo ou objetos cotidianos para explicar sentimentos complexos que "quebram" quem lê.' : ''}
        - ${scriptTone === 'Filosófico' ? 'Explore dilemas existenciais, a brevidade da vida e a busca por sentido, citando ou aludindo a grandes pensadores de forma acessível.' : ''}
        ` : ''}
        ${niche === 'Soluções para o Dia a Dia (Faça Você Mesmo)' ? `
        - Para o nicho de Soluções para o Dia a Dia / Faça Você Mesmo:
          * As cenas devem focar em ângulos macro e dinâmicos de ferramentas, peças mecânicas ou materiais de obra em ação prática (ex: chave apertando conector, motor vibrando, aplicação de argamassa, teste de vazamento).
          * A narração em "dialoguePt" deve ser direta, sem enrolação, com autoridade e vocabulário técnico acessível de quem realmente entende do assunto ("Se você notar esse barulho...", "O segredo que nenhum profissional te conta...", "Nunca monte essa peça sem antes...").
          * No "videoPromptEn", detalhe close-ups com iluminação de estúdio/oficina nítida e enquadramentos que mostrem o defeito e o conserto passo a passo.
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
        ${dialogueLanguage === 'pt' ? 'Gere todas as falas/narração estritamente em PORTUGUÊS (Brasil) (PT-BR) no campo "dialoguePt".' : ''}
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
        const isDeepPhrasesMode = carouselLayoutMode === 'deep_phrases';
        const selectedTypoInfo = TOP_TYPOGRAPHY_STYLES[topTypographyStyle] || TOP_TYPOGRAPHY_STYLES.sans_bold;

        const topicInstruction = hasManualTopic
          ? `O tema base é: "${temaFinal}".`
          : (referencePdfs.length > 0 || contextImages.length > 0)
            ? `ATENÇÃO: O usuário NÃO forneceu um tema manual por texto, mas anexou arquivo(s) PDF de referência. Você DEVE extrair a essência, ensinamentos práticos ou reflexões centrais do PDF anexado e utilizá-los como base de todo este carrossel.`
            : `O tema base é: "${temaFinal}".`;

        promptText = `Você é um diretor de criação e engenheiro de prompts de nível mundial, especialista em Carrosséis Virais do Instagram de altíssimo impacto emocional, retenção e compartilhamentos.
        O usuário quer um Carrossel com ${sceneCount} slides.
        O estilo visual de arte DEVE ser estritamente "${artStyle}".
        O nicho do canal é: "${niche}".
        O tom narrativo/emocional dos slides deve ser focado em: "${carouselTone}".
        ${topicInstruction}\n`;

        // 1. DIRETRIZ DE PERSONAGENS (100% DINÂMICA E LIVRE DE VÍCIOS)
        promptText += `\n=== DIRETRIZ DE PERSONAGENS & ELEMENTOS VISUAIS ===\n`;
        if (characterDescription.trim()) {
          promptText += `- PERSONAGEM(NS) DEFINIDO(S) PELO USUÁRIO: "${characterDescription}". Você DEVE representar fielmente e com consistência este(s) personagem(ns) ao longo de todos os slides, integrando suas características ao nicho "${niche}" e ao tom "${carouselTone}".\n`;
        } else if (characterCount > 1) {
          if (niche === 'Fitness') {
            promptText += `- PERSONAGENS DO CONTEXTO FITNESS: Represente dois indivíduos do ecossistema fitness (ex: um treinador e um atleta em evolução, ou duas pessoas superando limites juntos).\n`;
          } else if (niche === 'Top 10 Filmes e Séries') {
            promptText += `- PERSONAGENS DE CINEMA: Represente duas pessoas apaixonadas por histórias e cinematografia debruçadas sobre filmes marcantes.\n`;
          } else if (niche === 'Soluções para o Dia a Dia (Faça Você Mesmo)') {
            promptText += `- PERSONAGENS TÉCNICOS: Um profissional/especialista experiente demonstrando soluções práticas a um aprendiz ou consumidor.\n`;
          } else {
            promptText += `- PERSONAGENS: Represente dois personagens que se encaixem organicamente no tema e no nicho "${niche}" (ex: duas pessoas em momento de acolhimento mútuo, mentor e discípulo, duas almas afins compartilhando silêncio e reflexão, ou arquétipos pertinentes ao tema). IMPORTANTE: NÃO force ou presuma personagens pré-definidos como coração e cérebro a menos que o usuário tenha pedido expressamente.\n`;
          }
        } else {
          if (niche === 'Fitness') {
            promptText += `- PERSONAGEM: Um indivíduo autêntico enfrentando a sua jornada de disciplina e superação física/mental.\n`;
          } else if (niche === 'Top 10 Filmes e Séries') {
            promptText += `- PERSONAGEM: Um amante de cinema ou narrador imerso na atmosfera das produções.\n`;
          } else if (niche === 'Soluções para o Dia a Dia (Faça Você Mesmo)') {
            promptText += `- PERSONAGEM: Um especialista ou praticante focado na resolução manual da tarefa com ferramentas e peças.\n`;
          } else {
            promptText += `- PERSONAGEM: Uma figura humana, personagem expressivo ou silhueta poética que personifique a dor, a busca, o alívio ou o aprendizado do tema "${niche}". IMPORTANTE: Crie um personagem profundo e contextual ao tema. NÃO force personagens estereotipados.\n`;
          }
        }

        // 2. DIRETRIZ DO FORMATO DO CARROSSEL (FRASES NO TOPO VS BALÕES)
        if (isDeepPhrasesMode) {
          promptText += `\n=== MODO EXCLUSIVO: FRASES PROFUNDAS NO TOPO (SEM BALÕES DE DIÁLOGO) ===
          - PROIBIÇÃO TOTAL E ABSOLUTA DE BALÕES DE DIÁLOGO / SPEECH BUBBLES:
            * Os personagens JAMAIS devem ter balões de fala brotando da boca ou pairando na cena como quadrinhos infantis.
            * A arte visual NÃO contém balões de quadrinhos, balões de pensamento ou texto sobreposto no meio da cena.
            * Os personagens VIVENCIAM a cena em silêncio expressivo, com olhares tocantes, linguagem corporal rica, vulnerabilidade palpável e atmosfera cinematográfica.
          
          - ESTRUTURA VIRAL DE FRASES NO TOPO:
            * Cada slide contém RIGOROSAMENTE UMA FRASE DE ALTO IMPACTO EMOCIONAL / EXISTENCIAL / FILOSÓFICO posicionada NO TOPO da imagem.
            * O leitor lê a frase no topo e é arrebatado pela cena visual cinematográfica logo abaixo.
            * PADRONIZAÇÃO TIPOGRÁFICA OBRIGATÓRIA: Todos os slides deste carrossel devem usar SEMPRE A MESMA FONTE e ESTILO:
              Fonte Padronizada: "${selectedTypoInfo.fontName}" (${selectedTypoInfo.name}).
              Estilo Visual: ${selectedTypoInfo.description}.
            * Em cada slide, a frase deve ser projetada para ser diagramada no topo com essa exata tipografia uniforme.

          - PSICOLOGIA DE CONTEÚDO VIRAL (ANTI-CLICHÊ & MÁXIMA PROFUNDIDADE HUMANA):
            * BANIMENTO TOTAL DE AUTOAJUDA RASA E CLICHÊS DE COACH ("o universo conspira", "sorria", "seja sua melhor versão", "permita-se sentir").
            * FOQUE EM DORES REAIS E SILENCIOSAS: O cansaço de ser forte o tempo todo; a exaustão de tentar agradar a todos e se perder no caminho; o medo da rejeição; a saudade de quem a gente era antes de tantas decepções; a solidão acompanhada; a paz difícil de impor limites; o processo lento e doloroso de se perdoar.
            * ESTRUTURA DE RETENÇÃO DO CARROSSEL:
              • Slide 1 (O Gancho Visceral): Uma verdade incômoda, crua e magnética no topo, que quebre o padrão do feed e faça o dedo parar de rolar instantaneamente.
              • Slides Intermediários (O Aprofundamento): Conexão emocional íntima, metáforas cotidianas que tocam o coração do leitor e o fazem pensar "isso foi escrito para mim".
              • Slide Penúltimo (O Ponto de Virada / Acolhimento): Um respiro de alívio, uma virada de chave honesta sem promessas fáceis.
              • Slide Final (O Fechamento / Gancho de Compartilhamento): Uma frase de arremate memorável, daquelas que as pessoas tiram print, salvam na coleção e mandam no privado para quem amam.
          
          - COMPOSIÇÃO VISUAL OBRIGATÓRIA NO "imagePromptEn":
            * Cada prompt em inglês DEVE conter explicitamente a seguinte instrução técnica de composição:
              "Composition rule: Clean upper negative space / generous breathing room at the top 25% of the frame dedicated for typography overlay; strictly NO speech bubbles, NO comic book dialogue balloons, NO text within the illustration; cinematic lighting, evocative depth of field, authentic emotional atmosphere".\n`;
        } else {
          // Modo Diálogos em Balões Clássico
          promptText += `\n=== MODO CLÁSSICO: DIÁLOGOS EM BALÕES DE FALA ===
          - Os personagens conversam entre si através de balões de fala bem pontuados, expressando sentimentos e dinâmicas ricas.
          - BLINDAGEM ANTI-BALÃO VAZIO: Geradores de imagem erram se colocarem balões em branco. O personagem que fala deve ter exatamente um balão com a fala completa. O ouvinte deve estar em silêncio sem balão vazio.
          - DIÁLOGOS NATURAIS E VIVOS: Frases curtas, orais, espontâneas, sem parecer leitura de apostila.\n`;
        }

        // TONS ESPECÍFICOS
        if (carouselTone === 'Profundidade' || carouselTone === 'Acolhedor / Compassivo' || carouselTone === 'Vulnerável / Íntimo') {
          promptText += `Como o tom é "${carouselTone}", você DEVE atingir um patamar verdadeiramente existencial, visceral, poético e comovente.
          - Exemplos do tom e nível de humanidade esperado:
            * "A gente passa metade da vida se escondendo pra não incomodar, e a outra metade se perguntando por que ninguém nos enxerga de verdade."
            * "Não é cansaço do corpo. É o cansaço de ter que sustentar uma armadura que já não cabe mais."
            * "Tem dias em que o silêncio é a única resposta honesta que sobrou."
            * "Você não precisa dar conta de tudo hoje. Só precisa continuar respirando."\n`;
        } else if (carouselTone === 'Terapêutico / ACT' || carouselTone === 'Psicológico' || carouselTone === 'Filosófico') {
          promptText += `Como o tom é "${carouselTone}", una precisão psicológica/filosófica com extrema sensibilidade humana, abordando a relação com os pensamentos, aceitação de cicatrizes e o peso da condição humana.\n`;
        } else if (carouselTone === 'Motivacional') {
          promptText += `Como o tom é Motivacional, fuja de gritos vazios; acenda a determinação real do leitor através da superação de dores e construção da disciplina.\n`;
        } else if (carouselTone === 'Causa e Efeito (Se Essa Peça Falhar...)' || carouselTone === 'A Falta Disso Causa Isso') {
          promptText += `Como o tom é técnico/diagramático ("${carouselTone}"), estruture os slides em formato de causa, sintoma e desastre evitado, com títulos claros em destaque no topo e diagramas explicativos.\n`;
        } else if (carouselTone === 'Ranking / Top 10' || carouselTone === 'Recomendação Secreta' || carouselTone === 'Curiosidades / Bastidores') {
          promptText += `Como o tom é "${carouselTone}", use ganchos de alta curiosidade no topo que despertem debate e paixão pela sétima arte.\n`;
        }

        promptText += `\nREGRA CRÍTICA PARA IDENTIFICAÇÃO DE CORES E PERSONAGENS:
        1. SE HOUVER IMAGENS DE PERSONAGENS ANEXADAS: Inspecione com MÁXIMA ATENÇÃO cada imagem fornecida e descreva suas cores, figurino e traços com total fidelidade em cada prompt.
        2. QUEM ESTÁ FALANDO E QUEM ESTÁ OUVINDO (se for modo balões):
           - Deixe claro quem fala e quem ouve. NUNCA coloque balões vazios no ouvinte.\n`;

        if (!isDeepPhrasesMode) {
          promptText += `DIRETRIZES RIGOROSAS PARA O "imagePromptEn" (PROMPTS DE IMAGEM NO MODO BALÕES):
          1. IDIOMA: O prompt de imagem DEVE ser em Inglês, exceto as palavras do balão de fala que devem vir entre aspas com a indicação do idioma (ex: Brazilian Portuguese (PT-BR): "texto").
          2. BLINDAGEM ANTI-BALÃO VAZIO: Strictly forbid empty or blank speech bubbles.\n`;
          if (speechBubbleMode === 'clean-art') {
            promptText += `- MODO ARTE LIMPA: Não desenhe balões de fala na imagem.\n`;
          }
        }

        const selectedLangInfoCarousel = LANGUAGES.find(l => l.id === dialogueLanguage) || LANGUAGES[0];
        const langNameCarousel = selectedLangInfoCarousel.name;

        promptText += `\nREGRA OBRIGATÓRIA DE IDIOMA:
        O usuário selecionou o idioma: "${langNameCarousel}".
        ${dialogueLanguage === 'pt' ? `Gere os textos ${isDeepPhrasesMode ? 'das frases no topo' : 'dos balões'} estritamente em PORTUGUÊS (Brasil) (PT-BR) no campo "textInBubblesPt".` : ''}
        ${dialogueLanguage === 'en' ? `Gere os textos ${isDeepPhrasesMode ? 'das frases no topo' : 'dos balões'} estritamente em INGLÊS (English) no campo "textInBubblesEn".` : ''}
        ${dialogueLanguage === 'es' ? `Gere os textos ${isDeepPhrasesMode ? 'das frases no topo' : 'dos balões'} estritamente em ESPANHOL (Español) no campo "textInBubblesEs".` : ''}
        ${dialogueLanguage === 'all' ? `Gere os textos nos 3 idiomas: Português ("textInBubblesPt"), Inglês ("textInBubblesEn") e Espanhol ("textInBubblesEs").` : ''}\n\n`;

        promptText += `Para cada slide, forneça:
        1. "slideNumber": número do slide.
        2. "imagePromptEn": Prompt COMPLETO, ALTAMENTE DETALHADO e EXTENSO em Inglês para geradores de imagem modernos (FLOW, Flux, Ideogram, Midjourney). REGRA CRÍTICA: Cada prompt DEVE ter no MÍNIMO 80 palavras e JAMAIS ser cortado, resumido ou truncado. Descreva com riqueza de detalhes: estilo visual (${artStyle}), cenário, iluminação cinematográfica, atmosfera emocional, cores e composição.${isDeepPhrasesMode ? ' OBRIGATÓRIO: inclua a regra de respiro no topo de 25% para tipografia e PROIBIÇÃO total de speech bubbles na arte.' : ''}
        3. ${dialogueLanguage === 'pt' ? `"textInBubblesPt": ${isDeepPhrasesMode ? 'Frase de alto impacto no topo em Português.' : 'Texto no balão em Português.'}` : dialogueLanguage === 'en' ? `"textInBubblesEn": ${isDeepPhrasesMode ? 'Frase de alto impacto no topo em Inglês.' : 'Texto no balão em Inglês.'}` : dialogueLanguage === 'es' ? `"textInBubblesEs": ${isDeepPhrasesMode ? 'Frase de alto impacto no topo em Espanhol.' : 'Texto no balão em Espanhol.'}` : `"textInBubblesPt", "textInBubblesEn", "textInBubblesEs": Frases no topo ou textos nos balões em PT, EN e ES.`}
        4. "descriptionPt": Breve descrição da cena visual em Português.
        
        REGRA ABSOLUTA DE COMPLETUDE: Cada "imagePromptEn" DEVE ser um prompt auto-suficiente, completo e detalhado. NUNCA abrevie ou use referências a slides anteriores.
        Também forneça "instagramPost" com a legenda engajadora e emocionante para o post.`;

        const requiredSlideFields = ["slideNumber", "imagePromptEn", "descriptionPt"];
        if (dialogueLanguage === 'pt') requiredSlideFields.push("textInBubblesPt");
        else if (dialogueLanguage === 'en') requiredSlideFields.push("textInBubblesEn");
        else if (dialogueLanguage === 'es') requiredSlideFields.push("textInBubblesEs");
        else requiredSlideFields.push("textInBubblesPt", "textInBubblesEn", "textInBubblesEs");

        if (carouselQuantity > 1) {
          promptText += `\n=== GERAÇÃO EM LOTE: EXATAMENTE ${carouselQuantity} CARROSSÉIS OBRIGATÓRIOS ===
          REGRA CRÍTICA E INVIOLÁVEL: Você DEVE gerar RIGOROSAMENTE ${carouselQuantity} carrosséis completos no array "carousels". NÃO gere menos que ${carouselQuantity} e NÃO gere mais que ${carouselQuantity}. O número exato é ${carouselQuantity}.
          - Se foi digitado um tema geral ou anexado material de estudo: Crie ${carouselQuantity} carrosséis que abordem ângulos, subtemas, ganchos e metáforas 100% diferentes e complementares.
          - Se foi fornecida uma lista de tópicos (um por linha): Crie 1 carrossel completo para cada tópico da lista (máximo ${carouselQuantity}).
          - Cada um dos ${carouselQuantity} carrosséis DEVE ter: "title" (título descritivo em Português), "theme" (tema central), "slides" (com exatamente ${sceneCount} slides com "slideNumber", "imagePromptEn", "textInBubbles...", "descriptionPt") e "instagramPost" (legenda dedicada).
          - O array "carousels" na resposta DEVE conter exatamente ${carouselQuantity} objetos. Retornar mais ou menos que ${carouselQuantity} é PROIBIDO.
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
          let list = jsonResult.carousels.map((car: any, idx: number) => {
            car.title = car.title || `Carrossel ${idx + 1}`;
            car.language = dialogueLanguage;
            car.layoutMode = carouselLayoutMode;
            car.typographyStyle = topTypographyStyle;
            if (car.slides && Array.isArray(car.slides)) {
              car.slides.forEach((slide: any) => {
                slide.layoutMode = carouselLayoutMode;
                slide.typographyStyle = topTypographyStyle;
                if (dialogueLanguage === 'pt') {
                  slide.textInBubblesPt = slide.textInBubblesPt || slide.textInBubbles || '';
                } else if (dialogueLanguage === 'en') {
                  slide.textInBubblesEn = slide.textInBubblesEn || slide.textInBubbles || '';
                } else if (dialogueLanguage === 'es') {
                  slide.textInBubblesEs = slide.textInBubblesEs || slide.textInBubbles || '';
                }
                if (carouselLayoutMode === 'deep_phrases') {
                  slide.topPhrasePt = slide.textInBubblesPt || slide.textInBubbles || '';
                  slide.topPhraseEn = slide.textInBubblesEn || '';
                  slide.topPhraseEs = slide.textInBubblesEs || '';
                  slide.topPhrase = slide.topPhrasePt || slide.topPhraseEn || slide.topPhraseEs || '';
                }
              });
            }
            return car;
          });

          // Corte rígido de segurança para garantir a quantidade exata solicitada
          if (carouselQuantity > 0 && list.length > carouselQuantity) {
            list = list.slice(0, carouselQuantity);
          }

          setBatchCarouselResults(list);
          setCarouselResult(list[0]);
          setActiveCarouselIndex(0);
          handlePullCarouselsToMacro(list, true);
          if (carouselQuantity > 1 && list.length < carouselQuantity) {
            addLog('warning', 'GERADOR', `⚠️ Foram solicitados ${carouselQuantity} carrosséis, mas a IA retornou apenas ${list.length}. Isso pode ocorrer por limite de tokens do modelo. Tente gerar novamente ou reduza a quantidade de slides por carrossel.`);
          }
          addLog('success', 'GERADOR', `✅ Lote de ${list.length} carrosséis gerado em ${totalSeconds}s via ${data.provider.toUpperCase()} (${data.model})!`);
          addLog('info', 'ROBÔ FLOW', `🤖 ${list.reduce((acc: number, c: any) => acc + (c.slides?.length || 0), 0)} prompts sincronizados automaticamente com o Robô FLOW Studio!`);
        } else if (jsonResult && jsonResult.slides && Array.isArray(jsonResult.slides)) {
          jsonResult.title = jsonResult.title || topic || 'Carrossel';
          jsonResult.language = dialogueLanguage;
          jsonResult.layoutMode = carouselLayoutMode;
          jsonResult.typographyStyle = topTypographyStyle;
          jsonResult.slides.forEach((slide: any) => {
            slide.layoutMode = carouselLayoutMode;
            slide.typographyStyle = topTypographyStyle;
            if (dialogueLanguage === 'pt') {
              slide.textInBubblesPt = slide.textInBubblesPt || slide.textInBubbles || '';
            } else if (dialogueLanguage === 'en') {
              slide.textInBubblesEn = slide.textInBubblesEn || slide.textInBubbles || '';
            } else if (dialogueLanguage === 'es') {
              slide.textInBubblesEs = slide.textInBubblesEs || slide.textInBubbles || '';
            }
            if (carouselLayoutMode === 'deep_phrases') {
              slide.topPhrasePt = slide.textInBubblesPt || slide.textInBubbles || '';
              slide.topPhraseEn = slide.textInBubblesEn || '';
              slide.topPhraseEs = slide.textInBubblesEs || '';
              slide.topPhrase = slide.topPhrasePt || slide.topPhraseEn || slide.topPhraseEs || '';
            }
          });
          setBatchCarouselResults([jsonResult]);
          setCarouselResult(jsonResult);
          setActiveCarouselIndex(0);
          handlePullCarouselsToMacro([jsonResult], true);
          addLog('success', 'GERADOR', `✅ Carrossel gerado em ${totalSeconds}s (${jsonResult.slides?.length || 0} slides) via ${data.provider.toUpperCase()} (${data.model})!`);
          addLog('info', 'ROBÔ FLOW', `🤖 ${jsonResult.slides?.length || 0} prompts sincronizados automaticamente com o Robô FLOW Studio!`);
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

  // ======================================================
  // HANDLERS DO EDITOR DE REELS EM MASSA
  // ======================================================

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleReelsFrameFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    const imageFiles = arr.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;
    const newFrames: ReelsFrame[] = [];
    for (const file of imageFiles) {
      const dataUrl = await readFileAsDataUrl(file);
      const base64Data = dataUrl.split(',')[1];
      newFrames.push({
        id: Math.random().toString(36).substring(2, 9),
        name: file.name,
        dataUrl,
        base64Data,
        mimeType: file.type || 'image/png',
      });
    }
    setReelsFrames(prev => [...prev, ...newFrames]);
  };

  const handleReelsVideoDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverReelsVideo(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;
    handleReelsVideoFiles(files);
  };

  // Captura um frame do vídeo em ~1s para usar como thumbnail na grade
  const captureVideoThumbnail = (file: File): Promise<string> =>
    new Promise((resolve) => {
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        const url = URL.createObjectURL(file);
        video.src = url;
        const cleanup = () => { try { URL.revokeObjectURL(url); } catch (_) {} };
        const timeoutId = setTimeout(() => { cleanup(); resolve(''); }, 6000);

        video.addEventListener('loadedmetadata', () => {
          video.currentTime = Math.min(1.0, (video.duration || 2) / 3);
        }, { once: true });

        video.addEventListener('seeked', () => {
          clearTimeout(timeoutId);
          try {
            const canvas = document.createElement('canvas');
            const aspectRatio = video.videoHeight > 0 ? video.videoHeight / video.videoWidth : 16 / 9;
            canvas.width = 280;
            canvas.height = Math.round(280 * aspectRatio);
            canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
            cleanup();
            resolve(canvas.toDataURL('image/jpeg', 0.75));
          } catch (_) { cleanup(); resolve(''); }
        }, { once: true });

        video.addEventListener('error', () => { clearTimeout(timeoutId); cleanup(); resolve(''); }, { once: true });
      } catch (_) { resolve(''); }
    });

  const handleReelsVideoFiles = async (files: FileList | File[]) => {
    const arr = Array.from(files);
    // Aceitar qualquer arquivo que o sistema entenda como vídeo, OU com extensões comuns de vídeo
    const videoFiles = arr.filter(f => {
      if (f.type.startsWith('video/')) return true;
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      // Lista ampla de extensões de vídeo conhecidas pelo FFmpeg
      return ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v', 'flv', 'wmv', 'ts', 'mts', 'm2ts',
              'mpg', 'mpeg', 'mp2', 'mpe', 'mpv', 'm2v', '3gp', '3g2', 'asf', 'rmvb', 'rm',
              'ogv', 'ogg', 'vob', 'divx', 'xvid', 'f4v', 'hevc', 'h264', 'h265'].includes(ext);
    });
    if (videoFiles.length === 0) {
      addLog('warning', 'REELS', `Nenhum arquivo de vídeo reconhecido nos ${arr.length} arquivo(s) selecionado(s).`);
      return;
    }
    addLog('info', 'REELS', `Carregando ${videoFiles.length} vídeo(s)... Capturando thumbnails para preview.`);

    // Criar os itens imediatamente (sem thumbnail) para aparecerem na grade já
    const newItems: ReelsVideoItem[] = videoFiles.map(f => {
      const absolutePath = (f as any).path || '';
      const hasAbsolutePath = absolutePath && (absolutePath.includes('/') || absolutePath.includes('\\')) && absolutePath !== f.name;
      return {
        id: Math.random().toString(36).substring(2, 9),
        name: f.name,
        path: absolutePath || f.name,
        fileRef: hasAbsolutePath ? undefined : f, // guarda o File original como fallback
        size: f.size,
        status: 'pending',
        thumbnail: undefined,
      };
    });
    setReelsVideoQueue(prev => [...prev, ...newItems]);

    // Definir pasta de saída automaticamente com base no caminho do primeiro vídeo
    if (!reelsOutputFolder) {
      const firstPath = (videoFiles[0] as any).path || '';
      if (firstPath) {
        const dir = firstPath.replace(/\\/g, '/').split('/').slice(0, -1).join('/') + '/ReelsEditados';
        setReelsOutputFolder(dir.replace(/\//g, '\\'));
      }
    }

    // Capturar thumbnails em background (não bloqueia a UI)
    for (let idx = 0; idx < videoFiles.length; idx++) {
      const file = videoFiles[idx];
      const itemId = newItems[idx].id;
      captureVideoThumbnail(file).then(thumbnail => {
        if (thumbnail) {
          setReelsVideoQueue(prev => prev.map(v => v.id === itemId ? { ...v, thumbnail } : v));
        }
      });
    }
  };

  const handleReelsProcessBatch = async () => {
    if (reelsFrames.length === 0) {
      addLog('warning', 'REELS', 'Adicione pelo menos uma moldura PNG antes de processar.');
      return;
    }
    const pendingVideos = reelsVideoQueue.filter(v => v.status === 'pending' || v.status === 'error');
    if (pendingVideos.length === 0) {
      addLog('warning', 'REELS', 'Nenhum vídeo pendente para processar.');
      return;
    }
    if (!reelsOutputFolder) {
      addLog('warning', 'REELS', 'Defina a pasta de saída antes de processar.');
      return;
    }

    reelsCancelRef.cancelled = false;
    setIsReelsProcessing(true);
    addLog('info', 'REELS', `Iniciando processamento de ${pendingVideos.length} vídeo(s) com ${reelsFrames.length} moldura(s)...`);
    addLog('info', 'REELS', `🔒 Limpeza de metadados ATIVA — GPS, câmera, autor e data serão removidos de todos os vídeos.`);

    let doneCount = 0;
    let errorCount = 0;

    for (let i = 0; i < reelsVideoQueue.length; i++) {
      if (reelsCancelRef.cancelled) {
        addLog('warning', 'REELS', 'Processamento cancelado pelo usuário.');
        break;
      }
      const video = reelsVideoQueue[i];
      if (video.status !== 'pending' && video.status !== 'error') continue;

      // Selecionar a moldura em rotação
      const frameIndex = (doneCount + errorCount) % reelsFrames.length;
      const frame = reelsFrames[frameIndex];

      setReelsProcessingIndex(i);
      setReelsVideoQueue(prev => prev.map((v, idx) => idx === i ? { ...v, status: 'processing' } : v));
      addLog('info', 'REELS', `[${doneCount + errorCount + 1}/${pendingVideos.length}] Processando: ${video.name} (moldura: ${frame.name})...`);
      addLog('doc', 'REELS', `🔒 Limpando metadados de: ${video.name}`);

      try {
        const baseName = video.name.replace(/\.[^.]+$/, '');
        const outputFileName = `${baseName}_frame.mp4`;

        // Verificar se temos caminho absoluto (Electron) ou precisamos enviar base64 (modo web)
        const hasAbsPath = video.path && video.path !== video.name &&
          (video.path.includes('/') || video.path.includes('\\'));

        let bodyPayload: Record<string, unknown>;

        if (hasAbsPath) {
          // Modo Electron: usa o caminho do arquivo no disco
          bodyPayload = {
            videoPath: video.path,
            frameBase64: frame.base64Data,
            frameMimeType: frame.mimeType,
            topOffsetPercent: reelsTopOffsetPercent,
            crf: reelsCrf,
            outputFolder: reelsOutputFolder,
            outputFileName,
          };
        } else if (video.fileRef) {
          // Modo Web: lê o arquivo em base64 e envia ao servidor
          addLog('info', 'REELS', `📦 Enviando vídeo via upload (modo web)...`);
          const videoBase64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              resolve(result.includes(',') ? result.split(',')[1] : result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(video.fileRef!);
          });
          const videoMimeType = video.fileRef.type || 'video/mp4';
          bodyPayload = {
            videoBase64,
            videoMimeType,
            videoFileName: video.name,
            frameBase64: frame.base64Data,
            frameMimeType: frame.mimeType,
            topOffsetPercent: reelsTopOffsetPercent,
            crf: reelsCrf,
            outputFolder: reelsOutputFolder,
            outputFileName,
          };
        } else {
          throw new Error(`Caminho do arquivo não encontrado. Tente reabrir o app via Electron.`);
        }

        const resp = await apiFetch('/api/reels-editor/process-one', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });


        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({ error: 'Erro desconhecido' }));
          throw new Error(errData.error || `HTTP ${resp.status}`);
        }

        const data = await resp.json();
        setReelsVideoQueue(prev => prev.map((v, idx) => idx === i ? {
          ...v, status: 'done', outputPath: data.outputPath, outputSize: data.sizeBytes
        } : v));
        addLog('success', 'REELS', `✅ ${video.name} → ${outputFileName} (${(data.sizeBytes / 1024 / 1024).toFixed(1)} MB) | metadados limpos ✓`);
        doneCount++;
      } catch (err: any) {
        setReelsVideoQueue(prev => prev.map((v, idx) => idx === i ? {
          ...v, status: 'error', errorMsg: err.message
        } : v));
        addLog('error', 'REELS', `❌ ${video.name}: ${err.message}`);
        errorCount++;
      }
    }

    setIsReelsProcessing(false);
    setReelsProcessingIndex(-1);
    addLog('success', 'REELS', `Processamento concluído: ${doneCount} ✅ sucesso, ${errorCount} ❌ erro.`);
  };

  const handleReelsCancelProcessing = () => {
    reelsCancelRef.cancelled = true;
    addLog('warning', 'REELS', 'Sinal de cancelamento enviado. O vídeo atual será finalizado antes de parar.');
  };

  const handleOpenReelsOutputFolder = async () => {
    if (!reelsOutputFolder) return;
    await apiFetch('/api/reels-editor/open-output-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath: reelsOutputFolder }),
    });
  };

  const handlePickOutputFolder = async () => {
    try {
      const resp = await apiFetch('/api/pick-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultPath: reelsOutputFolder || '' }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      if (!data.cancelled && data.path) {
        setReelsOutputFolder(data.path);
      }
    } catch (e) {
      addLog('warning', 'REELS', 'Não foi possível abrir o seletor de pasta.');
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
            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-black rounded-md border border-indigo-200/70 uppercase tracking-wider">v1.2.0</span>
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
              className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Instagram className="w-3.5 h-3.5 text-pink-500" />
              <span>Análise e Clonagem</span>
            </button>
            <button 
              onClick={() => setActiveTab('spy')}
              className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'spy' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>🤖 Robô FLOW</span>
            </button>
            <button
              onClick={() => setActiveTab('reels')}
              className={`px-3 sm:px-4 py-1.5 text-[10px] sm:text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'reels' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Video className="w-3.5 h-3.5 text-rose-500" />
              <span>Editor Reels</span>
              {reelsVideoQueue.length > 0 && (
                <span className="px-1.5 py-0.2 bg-rose-100 text-rose-700 text-[9px] font-black rounded-full">
                  {reelsVideoQueue.length}
                </span>
              )}
            </button>
          </nav>

          {/* Botões de Salvar / Carregar Projeto */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleExportProjectJSON}
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-xl text-[10px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Salvar todo o projeto, prompts e configurações em arquivo JSON"
            >
              <Save className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">Salvar Projeto</span>
            </button>

            <label
              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 hover:text-indigo-600 border border-slate-200 hover:border-indigo-300 rounded-xl text-[10px] sm:text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Carregar projeto salvo (.JSON) ou importar roteiro de .PDF / .DOC / .TXT"
            >
              <input
                type="file"
                accept=".json,.postforge,.pdf,.docx,.doc,.txt,.md"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImportProjectFile(e.target.files[0]);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />
              <FolderOpen className="w-3.5 h-3.5 text-indigo-600" />
              <span className="hidden md:inline">Carregar</span>
            </label>
          </div>

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

      <main className={`flex-grow w-full ${(activeTab === 'spy' || activeTab === 'reels') ? 'max-w-none px-4 pb-4 lg:px-6 lg:pb-6 pt-2' : 'max-w-7xl mx-auto p-4 lg:p-6'} grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-64px)] overflow-hidden ${isLogPanelVisible ? (isLogPanelOpen ? 'pb-72' : 'pb-10') : ''}`}>
        

        {activeTab === 'spy' ? (
          <div className="lg:col-span-12 w-full h-full flex flex-col gap-4 overflow-hidden">
            {/* Sub-Navegação do Espião FLOW */}
            <div className="bg-slate-900 border border-slate-800 p-2 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-lg shrink-0">
              <div className="flex items-center gap-2">
                <div className="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-md shadow-indigo-600/30 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>🤖 Robô FLOW Studio</span>
                  {macroPrompts.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-indigo-500/40 text-indigo-200 text-[10px]">
                      {macroPrompts.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Status do Robô FLOW */}
              <div className="flex items-center gap-2 pr-2">
                {macroState === 'running' ? (
                  <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>EXECUTANDO MACRO ({macroPrompts.filter(p => p.status === 'completed').length}/{macroPrompts.length})</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Ambiente FLOW Autônomo</span>
                  </div>
                )}
              </div>
            </div>

            {/* CONTEÚDO DAS SUB-ABAS DO ESPIÃO */}
            <div className="flex-1 overflow-hidden">
              
              {/* SUB-ABA 1: ROBÔ FLOW STUDIO */}
              {spySubTab === 'recorder' && (
                <div className="w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
                  {/* Coluna do Navegador FLOW (Esquerda - 7 colunas) */}
                  <div className="lg:col-span-7 flex flex-col h-full bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
                    {/* Barra de Navegação Superior do FLOW */}
                    <div className="p-3 border-b border-slate-100 flex flex-wrap items-center gap-2 bg-slate-50/80">
                      <div className="flex items-center gap-1">
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
                          title="Atualizar Página"
                        >
                          <RotateCw className={`w-4 h-4 ${isWebviewLoading ? 'animate-spin text-indigo-500' : ''}`} />
                        </button>
                      </div>

                      {/* Atalho FLOW Hub */}
                      <button
                        type="button"
                        onClick={() => {
                          setSpyUrl('https://labs.google/fx/pt/tools/flow');
                          setInputUrl('https://labs.google/fx/pt/tools/flow');
                          if (webviewRef.current) webviewRef.current.loadURL('https://labs.google/fx/pt/tools/flow');
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-indigo-50 hover:text-indigo-600 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 cursor-pointer shadow-2xs"
                        title="Ir para a Página Inicial do Google FLOW"
                      >
                        <span>🏠 FLOW Hub</span>
                      </button>

                      {/* Campo de URL */}
                      <form onSubmit={handleSpyNavigate} className="flex-grow flex items-center gap-2 min-w-[200px]">
                        <div className="flex-grow relative flex items-center">
                          <div className="absolute left-3 text-slate-400">
                            <Compass className="w-3.5 h-3.5" />
                          </div>
                          <input 
                            type="text" 
                            value={inputUrl}
                            onChange={(e) => setInputUrl(e.target.value)}
                            placeholder="URL do Google FLOW (ex: labs.google/fx/pt/tools/flow)"
                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-inner font-mono"
                          />
                        </div>
                        <button 
                          type="submit" 
                          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                        >
                          Ir
                        </button>
                      </form>

                      {/* Status de Conexão com o Motor do Robô */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold border transition shrink-0 bg-white">
                        {isFlowConnected ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-emerald-700">Robô Conectado</span>
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-amber-700">Aguardando FLOW...</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Área do WebView Embutido com Sessão Persistente */}
                    <div className="flex-grow relative bg-slate-100/50">
                      {flowPreloadPath || preloadPath ? (
                        // @ts-ignore
                        <webview
                          ref={webviewRef}
                          src={spyUrl}
                          partition="persist:flow_session"
                          preload={flowPreloadPath || preloadPath}
                          className="absolute inset-0 w-full h-full bg-white"
                          style={{ border: 'none' }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                          <p className="text-sm font-semibold">Iniciando motor do Robô FLOW...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Coluna do Painel de Configurações do Macro Studio (Direita - 5 colunas) */}
                  <div className="lg:col-span-5 flex flex-col h-full bg-slate-900 border border-slate-800 rounded-3xl shadow-xl overflow-hidden text-slate-300">
                    {/* Header do Painel */}
                    <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 flex items-center justify-center text-white shadow-sm font-bold text-sm">
                          🤖
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-xs uppercase tracking-wider text-white">FLOW Macro Studio Pro</h3>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              MOTOR FLOW
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400">Automação de Prompts por PDF & Personagens</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {macroState === 'running' ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 rounded-xl text-[10px] font-bold animate-pulse">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span>Executando</span>
                          </span>
                        ) : macroState === 'paused' ? (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 rounded-xl text-[10px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-yellow-400" />
                            <span>Pausado</span>
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-[10px] font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span>Pronto</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Barra de Abas do Macro Studio */}
                    <div className="flex border-b border-slate-800 bg-slate-950/40 p-1.5 gap-1 overflow-x-auto shrink-0 scrollbar-none">
                      <button
                        type="button"
                        onClick={() => setMacroActiveTab('prompts')}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          macroActiveTab === 'prompts'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>1. Prompts</span>
                        {macroPrompts.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-indigo-400/30 text-white text-[10px]">
                            {macroPrompts.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setMacroActiveTab('characters')}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          macroActiveTab === 'characters'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>2. Personagens</span>
                        {macroCharacters.length > 0 && (
                          <span className="px-1.5 py-0.2 rounded-full bg-pink-400/30 text-white text-[10px]">
                            {macroCharacters.length}
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setMacroActiveTab('format')}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          macroActiveTab === 'format'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'text-slate-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <Settings className="w-3.5 h-3.5" />
                        <span>3. Formato</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMacroActiveTab('telegram')}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          macroActiveTab === 'telegram'
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'text-sky-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>4. Telegram</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setMacroActiveTab('execution')}
                        className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                          macroActiveTab === 'execution'
                            ? 'bg-emerald-600 text-white shadow-md'
                            : 'text-emerald-400 hover:text-white hover:bg-slate-800'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>5. Execução</span>
                        {macroState === 'running' && (
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        )}
                      </button>
                    </div>

                    {/* CONTEÚDO DAS ABAS DO PAINEL */}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5">
                      
                      {/* ========================================================= */}
                      {/* ABA 1: PROMPTS & ROTEIRO */}
                      {/* ========================================================= */}
                      {macroActiveTab === 'prompts' && (
                        <div className="space-y-3">
                          {/* Banner de Ação Rápida: Puxar do Carrossel Ativo */}
                          <div className="p-3 bg-gradient-to-r from-indigo-950/70 via-purple-950/50 to-slate-900 border border-indigo-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                              <Zap className="w-5 h-5 text-amber-400 shrink-0" />
                              <div>
                                <h4 className="text-xs font-bold text-white">Carrossel do PostForge</h4>
                                <p className="text-[10px] text-slate-400">Puxe o carrossel gerado direto para a fila do FLOW</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handlePullCarouselsToMacro}
                              className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 text-white text-xs font-black rounded-xl shadow-lg shadow-indigo-600/30 transition flex items-center gap-1.5 cursor-pointer"
                              title="Puxar todos os slides e prompts do carrossel ativo do PostForge"
                            >
                              <Zap className="w-3.5 h-3.5 text-amber-300" />
                              <span>⚡ Puxar do Carrossel Ativo</span>
                            </button>
                          </div>

                          {/* Barra de Ações Secundárias */}
                          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setIsMacroAddPromptModalOpen(true)}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Prompt</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setIsMacroPasteModalOpen(true)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer border border-slate-700"
                              >
                                <FileCode className="w-3.5 h-3.5" />
                                <span>📋 Colar</span>
                              </button>

                              <label
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold transition flex items-center gap-1 cursor-pointer border border-slate-700"
                                title="Carregar PDF, TXT, JSON ou Roteiro"
                              >
                                <input
                                  type="file"
                                  accept=".pdf,.txt,.json,.csv,.md"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleMacroUploadFile(e.target.files[0]);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                                <span>📁 Arquivo</span>
                              </label>

                              <div className="flex items-center gap-1 px-2 py-1 bg-slate-950 rounded-xl border border-slate-800" title="Repetir cada prompt X vezes">
                                <span className="text-[10px] text-slate-400">🔁 Repetir:</span>
                                <input
                                  type="number"
                                  min={1}
                                  max={50}
                                  value={macroConfig.repeatPerPrompt}
                                  onChange={(e) => {
                                    const val = Math.max(1, parseInt(e.target.value) || 1);
                                    setMacroConfig(prev => ({ ...prev, repeatPerPrompt: val }));
                                  }}
                                  className="w-8 text-center bg-slate-900 border border-slate-700 rounded text-amber-300 font-bold text-xs py-0.5"
                                />
                                <span className="text-[10px] text-slate-400">x</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={handleToggleAllMacroPrompts}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                                title="Marcar / Desmarcar todos"
                              >
                                <CheckSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={handleResetMacroStatus}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                                title="Redefinir status para Pendente"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={handleClearMacroPrompts}
                                disabled={macroPrompts.length === 0}
                                className="p-1.5 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-400 disabled:opacity-40 rounded-lg transition border border-slate-700 cursor-pointer"
                                title="Limpar lista de prompts"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Filtro de Carrosséis Detectados */}
                          {macroCarousels.length > 0 && (
                            <div className="p-2.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-bold text-slate-300">📚 Carrosséis ({macroCarousels.length}):</span>
                                <span className="text-[10px] text-slate-500">Filtre por carrossel ou escolha Todos</span>
                              </div>
                              <div className="flex gap-1.5 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => setMacroSelectedCarousel('all')}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                    macroSelectedCarousel === 'all'
                                      ? 'bg-indigo-600 text-white shadow-sm'
                                      : 'bg-slate-800 text-slate-400 hover:text-white'
                                  }`}
                                >
                                  Todos ({macroPrompts.length})
                                </button>
                                {macroCarousels.map((car, idx) => (
                                  <button
                                    key={car.id}
                                    type="button"
                                    onClick={() => setMacroSelectedCarousel(car.id)}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                      macroSelectedCarousel === car.id
                                        ? 'bg-indigo-600 text-white shadow-sm'
                                        : 'bg-slate-800 text-slate-400 hover:text-white'
                                    }`}
                                  >
                                    C{idx + 1} ({car.count})
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Lista de Prompts da Fila */}
                          <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1">
                            {macroPrompts.length === 0 ? (
                              <div className="py-12 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                                <div className="p-3 rounded-full mb-2 bg-slate-800 text-slate-500">
                                  <FileText className="w-5 h-5" />
                                </div>
                                <p className="text-xs font-bold text-slate-300">Nenhum prompt carregado no Robô</p>
                                <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                                  Clique em <strong>"⚡ Puxar do Carrossel Ativo"</strong> acima ou importe um arquivo PDF / TXT para iniciar.
                                </p>
                              </div>
                            ) : (
                              macroPrompts
                                .filter(p => macroSelectedCarousel === 'all' || p.carouselId === macroSelectedCarousel)
                                .map((prompt, idx) => {
                                  const isExpanded = !!expandedPromptIds[prompt.id];
                                  return (
                                    <div
                                      key={prompt.id}
                                      className={`p-2.5 rounded-xl border transition text-xs space-y-1.5 ${
                                        prompt.status === 'running'
                                          ? 'bg-amber-950/20 border-amber-500/50 shadow-sm'
                                          : prompt.status === 'completed'
                                          ? 'bg-emerald-950/20 border-emerald-500/30'
                                          : prompt.status === 'error'
                                          ? 'bg-rose-950/20 border-rose-500/40'
                                          : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                                      }`}
                                    >
                                      {/* Header da linha do prompt */}
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <input
                                            type="checkbox"
                                            checked={prompt.checked}
                                            onChange={() => handleTogglePromptCheck(prompt.id)}
                                            className="w-3.5 h-3.5 accent-indigo-600 rounded cursor-pointer shrink-0"
                                          />
                                          <span className="px-1.5 py-0.2 rounded bg-slate-800 text-indigo-300 font-mono text-[10px] font-bold shrink-0">
                                            #{prompt.slideNumber || idx + 1}
                                          </span>
                                          <span className="font-bold text-white text-[11px] truncate">
                                            {prompt.title}
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-1.5 shrink-0">
                                          {/* Status Badge */}
                                          {prompt.status === 'running' && (
                                            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black rounded-md flex items-center gap-1 animate-pulse">
                                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                              <span>No FLOW</span>
                                            </span>
                                          )}
                                          {prompt.status === 'completed' && (
                                            <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black rounded-md">
                                              ✓ Concluído
                                            </span>
                                          )}
                                          {prompt.status === 'error' && (
                                            <span className="px-1.5 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[9px] font-black rounded-md">
                                              ✕ Erro
                                            </span>
                                          )}
                                          {prompt.status === 'pending' && (
                                            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-400 text-[9px] font-bold rounded-md">
                                              Pendente
                                            </span>
                                          )}

                                          {/* Botão de Rodar Individual */}
                                          <button
                                            type="button"
                                            onClick={() => handleRunSingleMacroPrompt(prompt.id)}
                                            className="p-1 hover:bg-slate-800 text-emerald-400 rounded-lg transition cursor-pointer"
                                            title="Executar este prompt individualmente no FLOW"
                                          >
                                            <Play className="w-3 h-3 fill-current" />
                                          </button>

                                          {/* Botão de Excluir */}
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteMacroPrompt(prompt.id)}
                                            className="p-1 hover:bg-slate-800 text-slate-500 hover:text-rose-400 rounded-lg transition cursor-pointer"
                                            title="Remover prompt da fila"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Diálogo PT (se houver) */}
                                      {prompt.dialoguePt && (
                                        <div className="px-2 py-1 bg-slate-900/90 rounded-lg border border-slate-800/80 text-[10px] text-amber-300 font-medium">
                                          💬 Fala: "{prompt.dialoguePt}"
                                        </div>
                                      )}

                                      {/* Texto do Prompt de Imagem */}
                                      <div 
                                        onClick={() => setExpandedPromptIds(prev => ({ ...prev, [prompt.id]: !prev[prompt.id] }))}
                                        className="cursor-pointer group/prompt"
                                        title="Clique para expandir/recolher texto completo"
                                      >
                                        <p className={`text-[11px] text-slate-400 font-mono group-hover/prompt:text-slate-200 transition ${isExpanded ? '' : 'line-clamp-2'}`}>
                                          {prompt.prompt}
                                        </p>
                                      </div>
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        </div>
                      )}

                      {/* ========================================================= */}
                      {/* ABA 2: PERSONAGENS */}
                      {/* ========================================================= */}
                      {macroActiveTab === 'characters' && (
                        <div className="space-y-3">
                          {/* Banner de Ação Rápida: Sincronizar Personagens do PostForge */}
                          <div className="p-3 bg-gradient-to-r from-pink-950/70 via-purple-950/50 to-slate-900 border border-pink-500/30 rounded-2xl flex flex-wrap items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                              <Users className="w-5 h-5 text-pink-400 shrink-0" />
                              <div>
                                <h4 className="text-xs font-bold text-white">Personagens do PostForge</h4>
                                <p className="text-[10px] text-slate-400">Sincronize os avatares já cadastrados no carrossel</p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={handleSyncCharactersToMacro}
                              className="px-3 py-1.5 bg-gradient-to-r from-pink-600 via-rose-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-black rounded-xl shadow-lg shadow-pink-600/30 transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <span>🎭 Sincronizar Personagens</span>
                            </button>
                          </div>

                          {/* Ações Secundárias de Personagens */}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setIsMacroAddCharModalOpen(true)}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+ Novo Personagem</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <label
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer border border-slate-700"
                                title="Importar arquivo JSON de personagens"
                              >
                                <input
                                  type="file"
                                  accept=".json"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files && e.target.files[0]) {
                                      handleImportMacroCharsJson(e.target.files[0]);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                                <Upload className="w-3.5 h-3.5 text-cyan-400" />
                                <span>Importar</span>
                              </label>

                              <button
                                type="button"
                                onClick={handleExportMacroCharsJson}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl transition flex items-center gap-1 cursor-pointer border border-slate-700"
                                title="Exportar backup dos personagens em JSON"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Exportar</span>
                              </button>
                            </div>
                          </div>

                          {/* Grid de Personagens Cadastrados */}
                          <div className="space-y-2 max-h-[calc(100vh-360px)] overflow-y-auto pr-1">
                            {macroCharacters.length === 0 ? (
                              <div className="py-12 border border-dashed border-slate-800 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                                <div className="p-3 rounded-full mb-2 bg-slate-800 text-slate-500">
                                  <Users className="w-5 h-5" />
                                </div>
                                <p className="text-xs font-bold text-slate-300">Nenhum personagem cadastrado</p>
                                <p className="text-[10px] text-slate-500 mt-1 max-w-xs">
                                  Clique em <strong>"🎭 Sincronizar Personagens"</strong> acima para carregar automaticamente as fotos dos personagens definidos no PostForge.
                                </p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                {macroCharacters.map((char) => (
                                  <div
                                    key={char.id}
                                    className="p-3 bg-slate-950/80 border border-slate-800 rounded-2xl flex items-start gap-2.5 relative group/char hover:border-slate-700 transition"
                                  >
                                    {/* Thumbnail do Avatar */}
                                    <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 overflow-hidden shrink-0 flex items-center justify-center">
                                      {char.avatar ? (
                                        <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <Users className="w-5 h-5 text-slate-600" />
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0 pr-5">
                                      <h5 className="font-bold text-white text-xs truncate">{char.name}</h5>
                                      {char.color && (
                                        <p className="text-[10px] text-indigo-400 font-semibold truncate">
                                          Cor: {char.color}
                                        </p>
                                      )}
                                      {char.features && (
                                        <p className="text-[10px] text-slate-400 line-clamp-1">
                                          {char.features}
                                        </p>
                                      )}
                                      <label className="mt-1 flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-slate-400">
                                        <input
                                          type="checkbox"
                                          checked={char.enabled}
                                          onChange={() => {
                                            const updated = macroCharacters.map(c => c.id === char.id ? { ...c, enabled: !c.enabled } : c);
                                            setMacroCharacters(updated);
                                            sendMacroCommand('SYNC_DATA', {
                                              prompts: macroPrompts,
                                              carousels: macroCarousels,
                                              characters: updated,
                                              config: macroConfig
                                            });
                                          }}
                                          className="w-3 h-3 accent-indigo-600 rounded"
                                        />
                                        <span>{char.enabled ? 'Ativo no FLOW' : 'Inativo'}</span>
                                      </label>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMacroCharacter(char.id)}
                                      className="absolute top-2 right-2 p-1 text-slate-500 hover:text-rose-400 rounded-lg transition"
                                      title="Remover personagem"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* ========================================================= */}
                      {/* ABA 3: FORMATO & GERAÇÃO */}
                      {/* ========================================================= */}
                      {macroActiveTab === 'format' && (
                        <div className="space-y-3.5 text-xs">
                          {/* Tipo de Mídia (Imagem / Vídeo) */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Mídia de Geração no FLOW:
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setMacroConfig(prev => ({ ...prev, mediaType: 'image' }))}
                                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                                  macroConfig.mediaType === 'image'
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                <ImageIcon className="w-3.5 h-3.5" />
                                <span>Imagem</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setMacroConfig(prev => ({ ...prev, mediaType: 'video' }))}
                                className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer border ${
                                  macroConfig.mediaType === 'video'
                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                }`}
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>Vídeo</span>
                              </button>
                            </div>
                          </div>

                          {/* Proporção (Aspect Ratio) */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Proporção da Imagem:
                            </label>
                            <div className="grid grid-cols-5 gap-1.5">
                              {(['16:9', '4:3', '1:1', '3:4', '9:16'] as const).map((ratio) => (
                                <button
                                  key={ratio}
                                  type="button"
                                  onClick={() => setMacroConfig(prev => ({ ...prev, aspectRatio: ratio }))}
                                  className={`py-2 rounded-xl font-bold text-xs transition cursor-pointer border flex flex-col items-center justify-center gap-1 ${
                                    macroConfig.aspectRatio === ratio
                                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                  }`}
                                >
                                  <span className="text-[11px] font-black">{ratio}</span>
                                  <span className="text-[9px] opacity-70">
                                    {ratio === '9:16' ? 'Reels' : ratio === '1:1' ? 'Feed' : ratio === '3:4' ? 'Carrossel' : 'Wide'}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Quantidade por Prompt */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Variações Geradas por Prompt:
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                              {([1, 2, 3, 4] as const).map((qty) => (
                                <button
                                  key={qty}
                                  type="button"
                                  onClick={() => setMacroConfig(prev => ({ ...prev, quantity: qty }))}
                                  className={`py-1.5 rounded-xl font-black text-xs transition cursor-pointer border ${
                                    macroConfig.quantity === qty
                                      ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm'
                                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                                  }`}
                                >
                                  x{qty}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Modelo no FLOW */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                              Modelo de I.A do FLOW:
                            </label>
                            <select
                              value={macroConfig.model}
                              onChange={(e) => setMacroConfig(prev => ({ ...prev, model: e.target.value }))}
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                            >
                              <option value="Nano Banana 2">🍌 Nano Banana 2 (Padrão Recomendado)</option>
                              <option value="Nano Banana Pro">⚡ Nano Banana Pro (Mais Rápido & Consistente)</option>
                              <option value="Nano Banana 2 Lite">🍃 Nano Banana 2 Lite (Ultra Leve & Rápido)</option>
                              <option value="Imagen 3">🎨 Imagen 3 (Fidelidade Artística Alta)</option>
                            </select>
                          </div>

                          {/* Temporizadores e Delays */}
                          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5">
                            <h5 className="font-bold text-slate-200 text-xs">⏳ Intervalos & Delays (FLOW)</h5>
                            
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Pausa entre Prompts / Slides:</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={5}
                                  max={300}
                                  value={macroConfig.delaySeconds}
                                  onChange={(e) => setMacroConfig(prev => ({ ...prev, delaySeconds: parseInt(e.target.value) || 15 }))}
                                  className="w-14 text-center bg-slate-900 border border-slate-700 rounded-lg text-amber-300 font-bold py-1"
                                />
                                <span className="text-slate-500">seg</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-400">Pausa entre Carrosséis:</span>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={5}
                                  max={600}
                                  value={macroConfig.carouselDelaySeconds}
                                  onChange={(e) => setMacroConfig(prev => ({ ...prev, carouselDelaySeconds: parseInt(e.target.value) || 25 }))}
                                  className="w-14 text-center bg-slate-900 border border-slate-700 rounded-lg text-amber-300 font-bold py-1"
                                />
                                <span className="text-slate-500">seg</span>
                              </div>
                            </div>
                          </div>

                          {/* Toggles de Automação */}
                          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2.5">
                            <h5 className="font-bold text-slate-200 text-xs">⚙️ Ajustes do Motor FLOW</h5>

                            <label className="flex items-center justify-between cursor-pointer">
                              <div>
                                <span className="font-semibold text-white block">Reutilizar Comando (Passo 7)</span>
                                <span className="text-[10px] text-slate-400">Clica em ↪ no FLOW para manter os personagens e só trocar o texto</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={macroConfig.reusePreviousCommand}
                                onChange={(e) => setMacroConfig(prev => ({ ...prev, reusePreviousCommand: e.target.checked }))}
                                className="w-4 h-4 accent-indigo-600 rounded"
                              />
                            </label>

                            <label className="flex items-center justify-between cursor-pointer">
                              <div>
                                <span className="font-semibold text-white block">Novo Projeto a Cada Carrossel</span>
                                <span className="text-[10px] text-slate-400">Cria projeto novo no FLOW ao concluir os slides de um carrossel</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={macroConfig.autoCreateNewProject}
                                onChange={(e) => setMacroConfig(prev => ({ ...prev, autoCreateNewProject: e.target.checked }))}
                                className="w-4 h-4 accent-indigo-600 rounded"
                              />
                            </label>

                            <label className="flex items-center justify-between cursor-pointer">
                              <div>
                                <span className="font-semibold text-white block">Download Automático</span>
                                <span className="text-[10px] text-slate-400">Baixa as imagens geradas diretamente para Downloads/</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={macroConfig.autoDownload}
                                onChange={(e) => setMacroConfig(prev => ({ ...prev, autoDownload: e.target.checked }))}
                                className="w-4 h-4 accent-indigo-600 rounded"
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* ========================================================= */}
                      {/* ABA 4: TELEGRAM BOT */}
                      {/* ========================================================= */}
                      {macroActiveTab === 'telegram' && (
                        <div className="space-y-3.5 text-xs">
                          {/* Card Ativar Telegram */}
                          <div className="p-3 bg-sky-950/40 border border-sky-500/30 rounded-2xl flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Send className="w-5 h-5 text-sky-400 shrink-0" />
                              <div>
                                <h4 className="font-bold text-white text-xs">Notificações ao Vivo no Celular</h4>
                                <p className="text-[10px] text-slate-400">Receba fotos de capa e alertas de cada carrossel gerado</p>
                              </div>
                            </div>
                            <input
                              type="checkbox"
                              checked={macroConfig.telegramEnabled}
                              onChange={(e) => setMacroConfig(prev => ({ ...prev, telegramEnabled: e.target.checked }))}
                              className="w-4 h-4 accent-sky-500 rounded cursor-pointer"
                            />
                          </div>

                          {/* Campos de Configuração do Telegram */}
                          <div className="space-y-2.5">
                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                🤖 Bot Token (@BotFather):
                              </label>
                              <input
                                type="password"
                                value={macroConfig.telegramBotToken}
                                onChange={(e) => setMacroConfig(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                                placeholder="8680557957:AAGsOQ9pC49uWXktu4ZCJfnI1IRsNC9sbyk"
                                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                              />
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                💬 Chat ID do seu Telegram:
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={macroConfig.telegramChatId}
                                  onChange={(e) => setMacroConfig(prev => ({ ...prev, telegramChatId: e.target.value }))}
                                  placeholder="Ex: 6969102297"
                                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                                />
                                <button
                                  type="button"
                                  onClick={handleDetectTelegramChatId}
                                  className="px-3 py-2 bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap"
                                  title="Detectar Chat ID automaticamente via última mensagem enviada ao bot"
                                >
                                  🔍 Auto
                                </button>
                                <button
                                  type="button"
                                  onClick={handleTestTelegramNotification}
                                  className="px-3 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl font-bold text-xs transition cursor-pointer whitespace-nowrap"
                                  title="Enviar mensagem de teste para o celular"
                                >
                                  📲 Testar
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-400 mt-1.5">
                                💡 <strong>Dica:</strong> Abra o bot <strong>@Gerador_posts_bot</strong> no Telegram, clique em <strong>Começar</strong> e depois clique no botão <strong>🔍 Auto</strong> acima!
                              </p>
                            </div>
                          </div>

                          {/* Opções de Envio ao Vivo */}
                          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-2xl space-y-2">
                            <h5 className="font-bold text-sky-400 text-xs">Opções de Relatório no Telegram</h5>
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={macroConfig.telegramSendCover}
                                onChange={(e) => setMacroConfig(prev => ({ ...prev, telegramSendCover: e.target.checked }))}
                                className="w-3.5 h-3.5 accent-sky-500 rounded"
                              />
                              <span className="text-white">📸 Enviar Foto de Capa do Carrossel (Recomendado)</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={macroConfig.telegramSendDetailed}
                                onChange={(e) => setMacroConfig(prev => ({ ...prev, telegramSendDetailed: e.target.checked }))}
                                className="w-3.5 h-3.5 accent-sky-500 rounded"
                              />
                              <span className="text-white">📝 Relatório Detalhado por Prompt Gerado</span>
                            </label>
                          </div>
                        </div>
                      )}

                      {/* ========================================================= */}
                      {/* ABA 5: EXECUÇÃO & LOGS */}
                      {/* ========================================================= */}
                      {macroActiveTab === 'execution' && (
                        <div className="space-y-3.5 text-xs">
                          {/* Barra Principal de Controle: Iniciar / Pausar / Parar */}
                          <div className="flex items-center gap-2">
                            {macroState === 'running' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handlePauseMacro}
                                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-2xl shadow-lg shadow-amber-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Pause className="w-4 h-4 fill-current" />
                                  <span>Pausar Robô</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleStopMacro}
                                  className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-2xl shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Square className="w-4 h-4 fill-current" />
                                  <span>Parar</span>
                                </button>
                              </>
                            ) : macroState === 'paused' ? (
                              <>
                                <button
                                  type="button"
                                  onClick={handleResumeMacro}
                                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Play className="w-4 h-4 fill-current" />
                                  <span>Retomar Robô</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleStopMacro}
                                  className="px-4 py-3 bg-rose-600 hover:bg-rose-500 text-white font-extrabold rounded-2xl shadow-lg shadow-rose-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                                >
                                  <Square className="w-4 h-4 fill-current" />
                                  <span>Parar</span>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={handleStartMacro}
                                disabled={macroPrompts.length === 0}
                                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600 hover:from-emerald-500 hover:to-indigo-500 text-white font-extrabold rounded-2xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                              >
                                <Play className="w-4 h-4 fill-current" />
                                <span>Iniciar Execução no FLOW</span>
                              </button>
                            )}
                          </div>

                          {/* Card de Telemetria e Progresso ao Vivo */}
                          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ação Atual no FLOW:</span>
                              {macroElapsedSeconds > 0 && (
                                <span className="font-mono text-[11px] text-amber-400 font-bold">
                                  ⏱ {Math.floor(macroElapsedSeconds / 60).toString().padStart(2, '0')}:{(macroElapsedSeconds % 60).toString().padStart(2, '0')}
                                </span>
                              )}
                            </div>

                            <p className="font-bold text-white text-xs flex items-center gap-2">
                              {macroState === 'running' && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 shrink-0" />}
                              <span>{macroCurrentAction || 'Aguardando início...'}</span>
                            </p>

                            {/* Contador Regressivo */}
                            {macroCountdown.remaining > 0 && (
                              <div className="p-2 bg-amber-950/30 border border-amber-500/30 rounded-xl text-amber-300 font-bold flex items-center justify-between text-[11px]">
                                <span>⏳ {macroCountdown.label || 'Aguardando geração'}:</span>
                                <span className="font-mono text-xs">{macroCountdown.remaining}s restantes</span>
                              </div>
                            )}

                            {/* Barra de Progresso */}
                            {macroPrompts.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between text-[10px] text-slate-400">
                                  <span>Progresso dos Prompts</span>
                                  <span>
                                    {macroPrompts.filter(p => p.status === 'completed').length} / {macroPrompts.filter(p => p.checked).length} concluídos
                                  </span>
                                </div>
                                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300"
                                    style={{
                                      width: `${
                                        macroPrompts.filter(p => p.checked).length > 0
                                          ? Math.round((macroPrompts.filter(p => p.status === 'completed').length / macroPrompts.filter(p => p.checked).length) * 100)
                                          : 0
                                      }%`
                                    }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Terminal de Logs ao Vivo */}
                          <div className="p-3 bg-slate-950 border border-slate-800 rounded-2xl space-y-2">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              <div className="flex items-center gap-1.5">
                                <Terminal className="w-3 h-3 text-indigo-400" />
                                <span>Terminal de Execução do Robô</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setMacroLogs([])}
                                className="text-slate-500 hover:text-slate-300 transition"
                              >
                                Limpar
                              </button>
                            </div>

                            <div className="h-44 overflow-y-auto font-mono text-[10.5px] space-y-1 pr-1">
                              {macroLogs.length === 0 ? (
                                <p className="text-slate-600 italic">Nenhum evento registrado ainda.</p>
                              ) : (
                                macroLogs.map((log, idx) => (
                                  <div key={idx} className="flex items-start gap-1.5 leading-relaxed">
                                    <span className="text-slate-600 text-[9px] shrink-0 font-mono mt-0.5">{log.time}</span>
                                    <span
                                      className={`break-all ${
                                        log.type === 'success'
                                          ? 'text-emerald-400 font-semibold'
                                          : log.type === 'error'
                                          ? 'text-rose-400 font-semibold'
                                          : log.type === 'warning'
                                          ? 'text-amber-300'
                                          : 'text-slate-300'
                                      }`}
                                    >
                                      {log.message}
                                    </span>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>

                  {/* MODAL 1: Colar Roteiro */}
                  {isMacroPasteModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-lg w-full space-y-4 text-slate-200 shadow-2xl">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-white text-sm flex items-center gap-2">
                            <span>📋 Colar Roteiro ou Prompts</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setIsMacroPasteModalOpen(false)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-slate-400">
                          Cole seu texto de roteiro contendo carrosséis, slides, diálogos e prompts de imagem. O sistema detectará automaticamente a estrutura.
                        </p>
                        <textarea
                          rows={10}
                          value={macroPasteText}
                          onChange={(e) => setMacroPasteText(e.target.value)}
                          placeholder="Cole aqui seu roteiro ou lista de prompts..."
                          className="w-full p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs font-mono text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsMacroPasteModalOpen(false)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handlePasteScriptConfirm}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
                          >
                            Processar e Adicionar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODAL 2: Adicionar Prompt Manual */}
                  {isMacroAddPromptModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 text-slate-200 shadow-2xl">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-white text-sm">
                            <span>+ Adicionar Prompt Manual</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setIsMacroAddPromptModalOpen(false)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Título do Slide / Cena:
                            </label>
                            <input
                              type="text"
                              value={macroNewPromptTitle}
                              onChange={(e) => setMacroNewPromptTitle(e.target.value)}
                              placeholder="Ex: Slide 1 - O Segredo Revelado"
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Texto de Fala nos Balões (Opcional):
                            </label>
                            <input
                              type="text"
                              value={macroNewPromptDialogue}
                              onChange={(e) => setMacroNewPromptDialogue(e.target.value)}
                              placeholder="Ex: Você não vai acreditar no que aconteceu..."
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Prompt de Imagem (Inglês ou Português):
                            </label>
                            <textarea
                              rows={4}
                              value={macroNewPromptText}
                              onChange={(e) => setMacroNewPromptText(e.target.value)}
                              placeholder="Descreva a cena visual em detalhes..."
                              className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsMacroAddPromptModalOpen(false)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleAddManualPrompt}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
                          >
                            Adicionar Prompt
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODAL 3: Adicionar Personagem Manual */}
                  {isMacroAddCharModalOpen && (
                    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
                      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 text-slate-200 shadow-2xl">
                        <div className="flex items-center justify-between">
                          <h3 className="font-extrabold text-white text-sm">
                            <span>+ Novo Personagem</span>
                          </h3>
                          <button
                            type="button"
                            onClick={() => setIsMacroAddCharModalOpen(false)}
                            className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Nome do Personagem:
                            </label>
                            <input
                              type="text"
                              value={macroNewCharName}
                              onChange={(e) => setMacroNewCharName(e.target.value)}
                              placeholder="Ex: Sara, Carlos, Doutor..."
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Cor Predominante:
                            </label>
                            <input
                              type="text"
                              value={macroNewCharColor}
                              onChange={(e) => setMacroNewCharColor(e.target.value)}
                              placeholder="Ex: Camiseta Azul, Jaqueta Vermelha..."
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Traços Físicos / Descrição:
                            </label>
                            <input
                              type="text"
                              value={macroNewCharFeatures}
                              onChange={(e) => setMacroNewCharFeatures(e.target.value)}
                              placeholder="Ex: Cabelo castanho cacheado, olhos castanhos..."
                              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                              Foto / Avatar de Referência:
                            </label>
                            <input
                              type="file"
                              accept="image/*,.webp,image/webp"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  const f = e.target.files[0];
                                  const r = new FileReader();
                                  r.onload = () => {
                                    const raw = (r.result as string) || '';
                                    setMacroNewCharAvatar(normalizeImageDataUrl(raw, f.name));
                                  };
                                  r.readAsDataURL(f);
                                }
                              }}
                              className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                            />
                            {macroNewCharAvatar && (
                              <div className="w-14 h-14 mt-2 rounded-xl overflow-hidden border border-slate-700">
                                <img src={macroNewCharAvatar} alt="Avatar" className="w-full h-full object-cover" />
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setIsMacroAddCharModalOpen(false)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition"
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            onClick={handleAddMacroCharacter}
                            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition"
                          >
                            Salvar Personagem
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          </div>
        ) : activeTab === 'audit' ? (
          <div className="lg:col-span-12 w-full h-full grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
            {/* Coluna Esquerda: Formulário de Auditoria & Upload de Imagens */}
            <aside className="lg:col-span-5 h-full flex flex-col overflow-hidden">
              <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 flex flex-col gap-5 h-full overflow-y-auto">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-2xs">
                      <ListOrdered className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">Auditoria & Organização</h2>
                      <p className="text-[11px] text-slate-400">Consistência de personagens e ordem dos slides</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetEntireAudit}
                    className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Limpar todas as imagens, roteiros e resultados para iniciar uma nova auditoria"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Nova Auditoria</span>
                  </button>
                </div>

                {/* Bloco 1: Upload em Lote de Imagens */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Imagens Geradas em Lote</span>
                    </label>
                    <div className="flex items-center gap-1.5">
                      <label
                        className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer shadow-2xs"
                        title="Selecionar uma pasta inteira com imagens"
                      >
                        <input
                          type="file"
                          // @ts-ignore
                          webkitdirectory=""
                          directory=""
                          multiple
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              handleAuditImagesSelect(e.target.files);
                              e.target.value = '';
                            }
                          }}
                          className="hidden"
                        />
                        <FolderPlus className="w-3 h-3 text-indigo-600" />
                        <span>Selecionar Pasta</span>
                      </label>
                      <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                        {uploadedAuditImages.length} {uploadedAuditImages.length === 1 ? 'imagem' : 'imagens'}
                      </span>
                    </div>
                  </div>

                  {/* Dropzone Drag and Drop */}
                  <div 
                    onDragOver={(e) => { e.preventDefault(); setIsDragOverAudit(true); }}
                    onDragLeave={() => setIsDragOverAudit(false)}
                    onDrop={async (e) => {
                      e.preventDefault();
                      setIsDragOverAudit(false);
                      if (e.dataTransfer.items) {
                        const files = await scanFilesFromDataTransfer(e.dataTransfer.items);
                        if (files.length > 0) {
                          handleAuditImagesSelect(files);
                          return;
                        }
                      }
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
                      accept="image/*,.webp,image/webp" 
                      onChange={(e) => e.target.files && handleAuditImagesSelect(e.target.files)}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <div className="w-10 h-10 rounded-full bg-indigo-100/80 text-indigo-600 flex items-center justify-center shadow-xs">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Arraste imagens ou pastas inteiras aqui
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        PNG, JPG, WEBP • Clique para selecionar arquivos ou use "Selecionar Pasta" acima
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
                        {uploadedAuditImages.map((img, imgIdx) => (
                          <div key={img.id} className="relative group rounded-lg overflow-hidden border border-slate-200 bg-white aspect-square flex items-center justify-center shadow-2xs">
                            <img 
                              src={img.dataUrl} 
                              alt={img.name} 
                              className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                              onClick={() => setLightboxGallery({
                                items: uploadedAuditImages.map((m, i) => ({
                                  url: m.dataUrl,
                                  title: m.name,
                                  filename: m.name,
                                  slideNumber: i + 1,
                                  totalSlides: uploadedAuditImages.length
                                })),
                                currentIndex: imgIdx
                              })}
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

                  {/* Seletor de Carrosséis / Lotes Detectados */}
                  {detectedAuditBatches.length > 1 && (
                    <div className="p-3 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-indigo-50/50 border border-indigo-200/80 rounded-2xl space-y-2.5 animate-in fade-in duration-200 shadow-2xs">
                      {/* Cabeçalho do Seletor */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-100 pb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                            <Layers className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800">
                              Carrosséis no Documento:
                            </span>
                            <span className="text-xs font-semibold text-indigo-700 ml-1.5">
                              {detectedAuditBatches.filter(b => b.selected).length} de {detectedAuditBatches.length} selecionados
                            </span>
                          </div>

                          {/* Badge Indicativo de Velocidade / Tokens */}
                          {detectedAuditBatches.filter(b => b.selected).length === 1 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <Zap className="w-3 h-3 text-emerald-600" />
                              Modo Ultra Rápido (~8-15s • ~800 tokens)
                            </span>
                          ) : detectedAuditBatches.filter(b => b.selected).length < detectedAuditBatches.length ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
                              <Zap className="w-3 h-3 text-blue-600" />
                              Análise Otimizada ({detectedAuditBatches.filter(b => b.selected).length} carrosséis)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-300">
                              Lote Completo ({detectedAuditBatches.length} carrosséis)
                            </span>
                          )}
                        </div>

                        {/* Ações de Seleção Rápida */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSelectAllAuditBatches(true)}
                            className="px-2 py-0.5 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-md transition cursor-pointer shadow-2xs"
                            title="Marcar todos os carrosséis para auditoria"
                          >
                            Selecionar Todos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSelectAllAuditBatches(false)}
                            className="px-2 py-0.5 text-[10px] font-bold text-slate-600 hover:text-slate-800 bg-white hover:bg-slate-100 border border-slate-200 rounded-md transition cursor-pointer shadow-2xs"
                            title="Desmarcar todos os carrosséis"
                          >
                            Desmarcar Todos
                          </button>
                        </div>
                      </div>

                      {/* Lista Scrollável de Carrosséis */}
                      <div className="max-h-52 overflow-y-auto pr-1 space-y-1.5">
                        {detectedAuditBatches.map((batch) => {
                          const isSelected = batch.selected;
                          return (
                            <div
                              key={batch.id}
                              className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2.5 ${
                                isSelected 
                                  ? 'bg-white border-indigo-300 shadow-2xs' 
                                  : 'bg-slate-50/70 border-slate-200/80 opacity-60 hover:opacity-90'
                              }`}
                            >
                              {/* Checkbox + Informações */}
                              <label className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleAuditBatch(batch.id)}
                                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                      isSelected ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
                                    }`}>
                                      #{batch.projectNumber}
                                    </span>
                                    <span className="text-xs font-bold text-slate-800 truncate" title={batch.title}>
                                      {batch.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500 flex-wrap">
                                    <span className="font-semibold text-slate-600">
                                      {batch.slideCount} slides
                                    </span>
                                    {batch.niche && (
                                      <span>• Nicho: <strong className="text-slate-700">{batch.niche}</strong></span>
                                    )}
                                    {batch.artStyle && (
                                      <span>• Estilo: <strong className="text-slate-700">{batch.artStyle}</strong></span>
                                    )}
                                  </div>
                                </div>
                              </label>

                              {/* Botão de Atalho "Apenas Este" */}
                              <button
                                type="button"
                                onClick={() => handleSelectOnlyAuditBatch(batch.id)}
                                className={`shrink-0 px-2 py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                                  isSelected && detectedAuditBatches.filter(b => b.selected).length === 1
                                    ? 'bg-emerald-600 text-white shadow-xs'
                                    : 'bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 border border-slate-200 hover:border-indigo-300'
                                }`}
                                title={`Isolar e analisar apenas o Carrossel #${batch.projectNumber} (Desmarca os outros)`}
                              >
                                <Zap className="w-2.5 h-2.5" />
                                <span>{isSelected && detectedAuditBatches.filter(b => b.selected).length === 1 ? 'Apenas Este (Ativo)' : 'Apenas Este'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Alerta caso nenhum esteja marcado */}
                      {detectedAuditBatches.filter(b => b.selected).length === 0 && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>Nenhum carrossel selecionado. Marque ao menos um acima ou clique em "Selecionar Todos" para auditar.</span>
                        </div>
                      )}
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
                        if (!e.target.value.trim()) {
                          if (auditDocumentInfo) setAuditDocumentInfo(null);
                          if (detectedAuditBatches.length > 0) setDetectedAuditBatches([]);
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
                          accept="image/*,.webp,image/webp"
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
                                onClick={() => setLightboxGallery({
                                  items: auditReferenceImages.map((m, i) => ({
                                    url: m.dataUrl,
                                    title: `Personagem Ref #${i + 1} - ${m.name}`,
                                    filename: m.name,
                                    slideNumber: i + 1,
                                    totalSlides: auditReferenceImages.length,
                                    description: `Imagem de referência ${i + 1} para consistência visual dos personagens.`
                                  })),
                                  currentIndex: idx
                                })}
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
                                    onClick={() => openAuditSlideInLightbox(index)}
                                    className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                                    title="Expandir Imagem e Navegar no Carrossel"
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
                                    onClick={() => openSurplusInLightbox(sIdx)}
                                    className="w-12 h-12 rounded-xl object-cover border border-slate-700 cursor-pointer shrink-0 hover:scale-105 transition-transform"
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
        ) : activeTab === 'reels' ? (
          /* ================================================
             EDITOR DE REELS EM MASSA
          ================================================ */
          <div className="lg:col-span-12 w-full h-full flex flex-col gap-4 overflow-hidden">
            {/* Header da Aba */}
            <div className="bg-gradient-to-r from-rose-600 to-pink-600 rounded-2xl p-4 flex items-center justify-between shadow-sm shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <Video className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-black text-white">Editor de Reels em Massa</h2>
                  <p className="text-[11px] text-rose-100">Limpa metadados e encaixa vídeos na moldura sem cobrir textos</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {reelsVideoQueue.filter(v => v.status === 'done').length > 0 && (
                  <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full">
                    {reelsVideoQueue.filter(v => v.status === 'done').length} ✅ prontos
                  </span>
                )}
                {isReelsProcessing && (
                  <span className="px-3 py-1 bg-white/20 text-white text-xs font-bold rounded-full flex items-center gap-1.5 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Processando {reelsVideoQueue.filter(v => v.status === 'processing').length > 0 ? reelsVideoQueue.find(v => v.status === 'processing')?.name : '...'}
                  </span>
                )}
              </div>
            </div>

            {/* Corpo principal — painéis redimensionáveis */}
            <PanelGroup
              direction="horizontal"
              autoSaveId="reels-layout-h"
              className="flex-1 overflow-hidden min-h-0 gap-0"
            >
              {/* ═══════════════════════════════════════════
                  PAINEL ESQUERDO: Molduras + Grade de Vídeos
              ═══════════════════════════════════════════ */}
              <Panel defaultSize={42} minSize={25} className="flex flex-col overflow-hidden min-h-0">
                <PanelGroup direction="vertical" autoSaveId="reels-layout-left" className="flex-1 overflow-hidden min-h-0">

                  {/* Painel: Molduras */}
                  <Panel defaultSize={30} minSize={15} className="overflow-hidden flex flex-col min-h-0">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-full overflow-y-auto flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-rose-50 rounded-lg flex items-center justify-center">
                        <Images className="w-4 h-4 text-rose-500" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-800">Molduras</h3>
                        <p className="text-[10px] text-slate-400">PNG ou JPEG com o cabeçalho do perfil</p>
                      </div>
                    </div>
                    {reelsFrames.length > 0 && (
                      <button onClick={() => setReelsFrames([])} className="text-[10px] text-slate-400 hover:text-rose-500 transition cursor-pointer">Limpar tudo</button>
                    )}
                  </div>

                  {/* Drop Zone Moldura */}
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOverReelsFrame(true); }}
                    onDragLeave={() => setIsDragOverReelsFrame(false)}
                    onDrop={async e => { e.preventDefault(); setIsDragOverReelsFrame(false); await handleReelsFrameFiles(e.dataTransfer.files); }}
                    className={`border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition mb-3 ${isDragOverReelsFrame ? 'border-rose-400 bg-rose-50' : 'border-slate-200 hover:border-rose-300 hover:bg-rose-50/40'}`}
                  >
                    <label className="cursor-pointer block">
                      <input type="file" accept="image/png,image/jpeg,image/jpg" multiple className="hidden" onChange={e => { if (e.target.files) handleReelsFrameFiles(e.target.files); e.target.value = ''; }} />
                      <Upload className="w-5 h-5 text-rose-400 mx-auto mb-1" />
                      <p className="text-[11px] font-bold text-slate-600">Arraste ou clique para adicionar moldura(s)</p>
                      <p className="text-[10px] text-slate-400">PNG com canal alpha ou JPEG — 1 ou mais</p>
                    </label>
                  </div>

                  {/* Lista de molduras carregadas */}
                  {reelsFrames.length > 0 && (
                    <div className="flex gap-2 flex-wrap">
                      {reelsFrames.map((frame, fi) => (
                        <div key={frame.id} className="relative group">
                          <img src={frame.dataUrl} alt={frame.name} className="w-14 h-20 object-cover rounded-xl border-2 border-rose-200 shadow-xs" title={frame.name} />
                          <span className="absolute bottom-0 left-0 right-0 text-center text-[8px] text-white bg-black/60 rounded-b-xl px-1 py-0.5 truncate">{fi + 1}</span>
                          <button
                            onClick={() => setReelsFrames(prev => prev.filter(f => f.id !== frame.id))}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                 </div>
                  </Panel>

                  {/* Handle vertical entre Molduras e Vídeos */}
                  <PanelResizeHandle className="group flex items-center justify-center h-2 mx-2 cursor-row-resize my-0.5">
                    <div className="w-10 h-1 rounded-full bg-slate-200 group-hover:bg-rose-400 group-active:bg-rose-500 transition-colors" />
                  </PanelResizeHandle>

                  {/* Painel: Grade de Vídeos */}
                  <Panel defaultSize={70} minSize={30} className="overflow-hidden flex flex-col min-h-0">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-full overflow-hidden flex flex-col min-h-0">
                  <div className="flex items-center justify-between mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                        <Clapperboard className="w-4 h-4 text-slate-600" />
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-slate-800">Fila de Vídeos</h3>
                        <p className="text-[10px] text-slate-400">{reelsVideoQueue.length > 0 ? `${reelsVideoQueue.length} vídeo(s) · todos os formatos suportados` : 'MP4, MOV, AVI, MKV, WMV, FLV e mais'}</p>
                      </div>
                    </div>
                    {reelsVideoQueue.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setReelsVideoQueue(prev => prev.map(v => v.status !== 'processing' ? { ...v, status: 'pending', errorMsg: undefined, outputPath: undefined } : v))} className="text-[10px] text-slate-400 hover:text-indigo-600 transition cursor-pointer">Resetar</button>
                        <span className="text-slate-200">|</span>
                        <button onClick={() => setReelsVideoQueue([])} className="text-[10px] text-slate-400 hover:text-rose-500 transition cursor-pointer">Limpar tudo</button>
                      </div>
                    )}
                  </div>

                  {/* Drop Zone Vídeos */}
                  <div
                    onDragOver={e => { e.preventDefault(); setIsDragOverReelsVideo(true); }}
                    onDragLeave={() => setIsDragOverReelsVideo(false)}
                    onDrop={handleReelsVideoDrop}
                    className={`border-2 border-dashed rounded-xl p-3 text-center transition mb-3 shrink-0 ${isDragOverReelsVideo ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}
                  >
                    <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                    <p className="text-[11px] font-bold text-slate-600 mb-1">Arraste vídeos ou pasta aqui</p>
                    <div className="flex items-center justify-center gap-2">
                      <label className="cursor-pointer">
                        <input
                          ref={reelsVideoInputRef}
                          type="file"
                          accept="video/*,.mp4,.mov,.avi,.webm,.mkv,.m4v,.flv,.wmv,.ts,.mts,.mpg,.mpeg,.3gp,.asf,.rmvb,.ogv,.vob,.divx,.f4v"
                          multiple
                          className="hidden"
                          onChange={e => { if (e.target.files) handleReelsVideoFiles(e.target.files); e.target.value = ''; }}
                        />
                        <span className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-bold rounded-lg transition">
                          📄 Arquivos
                        </span>
                      </label>
                      <label className="cursor-pointer">
                        <input
                          ref={reelsVideoFolderRef}
                          type="file"
                          accept="video/*,.mp4,.mov,.avi,.webm,.mkv,.m4v,.flv,.wmv,.ts,.mts,.mpg,.mpeg,.3gp,.asf,.rmvb,.ogv,.vob,.divx,.f4v"
                          multiple
                          // @ts-ignore
                          webkitdirectory=""
                          className="hidden"
                          onChange={e => { if (e.target.files) handleReelsVideoFiles(e.target.files); e.target.value = ''; }}
                        />
                        <span className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold rounded-lg transition cursor-pointer">
                          📁 Pasta Inteira
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Grade de Thumbnails dos Vídeos */}
                  <div className="flex-1 overflow-y-auto min-h-0">
                    {reelsVideoQueue.length === 0 && (
                      <div className="text-center py-8 text-slate-300">
                        <Clapperboard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">Nenhum vídeo adicionado</p>
                        <p className="text-[10px] mt-1 text-slate-400">Suporta todos os formatos: MP4, MKV, MOV, AVI, WMV, FLV...</p>
                      </div>
                    )}
                    {reelsVideoQueue.length > 0 && (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pb-1">
                        {reelsVideoQueue.map((video, vi) => {
                          const assignedFrame = reelsFrames.length > 0 ? reelsFrames[vi % reelsFrames.length] : null;
                          const isProcessing = video.status === 'processing';
                          const isDone = video.status === 'done';
                          const isError = video.status === 'error';
                          const isPending = video.status === 'pending';
                          const isSelectedPreview = reelsPreviewVideoIndex === vi;
                          const hasThumb = !!video.thumbnail;

                          // Anel de borda: selecionado para preview → azul, done → verde, error → vermelho, processing → indigo pulsando, default → cinza
                          const cardRing = isSelectedPreview
                            ? 'ring-2 ring-blue-500 ring-offset-1'
                            : isDone ? 'ring-2 ring-emerald-400'
                            : isError ? 'ring-2 ring-rose-400'
                            : isProcessing ? 'ring-2 ring-indigo-400'
                            : 'ring-1 ring-slate-200 hover:ring-slate-400';

                          return (
                            <div
                              key={video.id}
                              className={`relative rounded-xl overflow-hidden bg-slate-900 group cursor-pointer ${cardRing} transition-all`}
                              style={{ aspectRatio: '9/16' }}
                              onClick={() => setReelsPreviewVideoIndex(vi)}
                              title={`Clique para ver no preview: ${video.name}`}
                            >
                              {/* ── FUNDO: Thumbnail real ou Skeleton ── */}
                              {hasThumb ? (
                                <img src={video.thumbnail} alt={video.name} className="absolute inset-0 w-full h-full object-cover" />
                              ) : (
                                /* Skeleton animado enquanto aguarda captura do frame */
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-700 to-slate-900 gap-1.5 px-1">
                                  {/* Shimmer bars */}
                                  <div className="w-full space-y-1.5 px-1">
                                    <div className="h-1.5 bg-slate-600/80 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                                    <div className="h-1.5 bg-slate-600/60 rounded-full animate-pulse w-4/5" style={{ animationDelay: '150ms' }} />
                                    <div className="h-1.5 bg-slate-600/40 rounded-full animate-pulse w-3/5" style={{ animationDelay: '300ms' }} />
                                  </div>
                                  <Clapperboard className="w-5 h-5 text-slate-500 mt-1" />
                                  {!isProcessing && (
                                    <span className="text-[7px] text-slate-500 text-center leading-tight px-1">Carregando preview...</span>
                                  )}
                                </div>
                              )}

                              {/* ── MOLDURA sobreposta (PNG completo com transparência) ── */}
                              {assignedFrame && (
                                <img
                                  src={assignedFrame.dataUrl}
                                  alt="frame"
                                  className="absolute inset-0 w-full h-full object-contain"
                                  style={{ pointerEvents: 'none' }}
                                />
                              )}

                              {/* ── LINHA de corte da moldura (sempre visível) ── */}
                              {assignedFrame && (
                                <div
                                  className="absolute left-0 right-0"
                                  style={{ top: `${reelsTopOffsetPercent}%`, pointerEvents: 'none' }}
                                >
                                  <div className="border-t border-dashed border-rose-400/70 w-full" />
                                  <div className="flex justify-end pr-0.5 -mt-0">
                                    <span className="text-[6px] bg-rose-500/80 text-white px-0.5 py-px rounded-b font-bold leading-none">{reelsTopOffsetPercent}%</span>
                                  </div>
                                </div>
                              )}

                              {/* ── BADGE de status (canto superior direito) ── */}
                              <div className="absolute top-1 right-1">
                                {isProcessing && (
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" style={{ background: 'rgba(99,102,241,0.85)' }} />
                                )}
                                {isDone && <span className="text-sm drop-shadow-lg">✅</span>}
                                {isError && <span className="text-sm drop-shadow-lg">❌</span>}
                                {isPending && !hasThumb && (
                                  <span className="text-[8px] bg-slate-800/70 text-slate-300 px-1 py-px rounded font-bold">…</span>
                                )}
                                {isPending && hasThumb && (
                                  <span className="text-[8px] bg-black/50 text-white px-1 py-0.5 rounded font-bold">⏳</span>
                                )}
                              </div>

                              {/* ── Indicador "selecionado para preview" ── */}
                              {isSelectedPreview && (
                                <div className="absolute top-1 left-1">
                                  <span className="text-[7px] bg-blue-500 text-white px-1 py-px rounded font-bold leading-none">👁</span>
                                </div>
                              )}

                              {/* ── Tamanho de saída se concluído ── */}
                              {isDone && video.outputSize && (
                                <div className="absolute bottom-0 left-0 right-0 bg-emerald-600/90 px-1 py-0.5 text-center">
                                  <span className="text-[8px] text-white font-bold">{(video.outputSize / 1024 / 1024).toFixed(1)} MB ✓</span>
                                </div>
                              )}

                              {/* ── Hover overlay com detalhes + botão remover ── */}
                              <div className="absolute inset-0 bg-black/0 hover:bg-black/60 transition-all flex flex-col justify-end opacity-0 hover:opacity-100">
                                <div className="p-1.5 pb-2">
                                  <p className="text-[8px] text-white font-bold leading-tight break-all line-clamp-2">{video.name}</p>
                                  <p className="text-[7px] text-white/70">{(video.size / 1024 / 1024).toFixed(1)} MB</p>
                                  {assignedFrame && (
                                    <p className="text-[7px] text-rose-300 mt-0.5">🖼 {assignedFrame.name}</p>
                                  )}
                                  {isError && video.errorMsg && (
                                    <p className="text-[7px] text-rose-300 mt-0.5 line-clamp-2">{video.errorMsg}</p>
                                  )}
                                </div>
                                <button
                                  onClick={e => { e.stopPropagation(); setReelsVideoQueue(prev => prev.filter(v => v.id !== video.id)); }}
                                  className="absolute top-1 left-1 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-[10px] font-bold flex items-center justify-center cursor-pointer shadow"
                                  title="Remover"
                                >
                                  ×
                                </button>
                              </div>

                              {/* ── Número do vídeo (canto inferior esquerdo) ── */}
                              {!(isDone && video.outputSize) && (
                                <div className="absolute bottom-1 left-1 text-[7px] bg-black/60 text-white px-1 py-0.5 rounded font-mono">
                                  {vi + 1}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Barra de progresso global */}
                  {reelsVideoQueue.length > 0 && (
                    <div className="mt-3 shrink-0">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <span>{reelsVideoQueue.filter(v => v.status === 'done').length} / {reelsVideoQueue.length} concluídos</span>
                        <span>{reelsVideoQueue.filter(v => v.status === 'error').length > 0 ? `${reelsVideoQueue.filter(v => v.status === 'error').length} erro(s)` : ''}</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all"
                          style={{ width: `${reelsVideoQueue.length > 0 ? (reelsVideoQueue.filter(v => v.status === 'done').length / reelsVideoQueue.length) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                  </Panel>
                </PanelGroup>
              </Panel>

              {/* Handle horizontal entre Esquerda e Direita */}
              <PanelResizeHandle className="group flex flex-col items-center justify-center w-2 mx-0.5 cursor-col-resize">
                <div className="h-12 w-1 rounded-full bg-slate-200 group-hover:bg-rose-400 group-active:bg-rose-500 transition-colors flex flex-col items-center justify-center gap-0.5">
                  <GripVertical className="w-3 h-3 text-slate-400 group-hover:text-rose-500" />
                </div>
              </PanelResizeHandle>

              {/* ═══════════════════════════════════════════
                  PAINEL DIREITO: Preview + Configurações + Ação
              ═══════════════════════════════════════════ */}
              <Panel defaultSize={58} minSize={30} className="flex flex-col overflow-hidden min-h-0">
                <PanelGroup direction="vertical" autoSaveId="reels-layout-right" className="flex-1 overflow-hidden min-h-0">

                  {/* Painel: Preview da Composição */}
                  <Panel defaultSize={45} minSize={25} className="overflow-hidden flex flex-col min-h-0">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-full overflow-y-auto flex flex-col">
                  <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-rose-500" />
                    Preview da Composição
                    {reelsVideoQueue.length > 0 && (
                      <span className="ml-auto text-[9px] text-slate-400 font-normal">
                        Clique num vídeo da grade para prévia
                      </span>
                    )}
                  </h3>
                  <div className="flex gap-4 items-start">
                    {/* Preview maior e informativo */}
                    {(() => {
                      const previewVideo = reelsVideoQueue[reelsPreviewVideoIndex] ?? reelsVideoQueue[0];
                      const previewFrame = previewVideo && reelsFrames.length > 0
                        ? reelsFrames[reelsPreviewVideoIndex % reelsFrames.length] ?? reelsFrames[0]
                        : reelsFrames[0] ?? null;
                      const hasThumb = !!previewVideo?.thumbnail;

                      return (
                        <>
                          {/* Miniatura do preview */}
                          <div className="relative shrink-0 rounded-xl overflow-hidden border-2 border-slate-200 shadow-md bg-slate-900" style={{ width: 130, aspectRatio: '9/16' }}>
                            {/* Fundo: thumbnail do vídeo selecionado ou skeleton */}
                            {hasThumb ? (
                              <img src={previewVideo.thumbnail} alt="Video preview" className="absolute inset-0 w-full h-full object-cover" />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-b from-slate-700 to-slate-900 flex flex-col items-center justify-center gap-2 px-2">
                                <div className="w-full space-y-1.5">
                                  <div className="h-1.5 bg-slate-600/80 rounded-full animate-pulse" />
                                  <div className="h-1.5 bg-slate-600/60 rounded-full animate-pulse w-4/5" />
                                  <div className="h-1.5 bg-slate-600/40 rounded-full animate-pulse w-3/5" />
                                </div>
                                <Video className="w-6 h-6 text-slate-500 opacity-50" />
                                <span className="text-[8px] text-slate-500 text-center">
                                  {previewVideo ? 'Capturando frame...' : 'Nenhum vídeo'}
                                </span>
                              </div>
                            )}

                            {/* Moldura PNG sobreposta */}
                            {previewFrame ? (
                              <img
                                src={previewFrame.dataUrl}
                                alt="Moldura preview"
                                className="absolute inset-0 w-full h-full object-contain"
                                style={{ pointerEvents: 'none' }}
                              />
                            ) : (
                              <div
                                className="absolute top-0 left-0 right-0 bg-white/90 flex items-center justify-center border-b-2 border-dashed border-rose-300"
                                style={{ height: `${reelsTopOffsetPercent}%` }}
                              >
                                <p className="text-[8px] text-slate-400 text-center px-1">Moldura<br/>aqui</p>
                              </div>
                            )}

                            {/* Linha de corte sempre visível */}
                            <div className="absolute left-0 right-0" style={{ top: `${reelsTopOffsetPercent}%` }}>
                              <div className="border-t-2 border-dashed border-rose-400 w-full" />
                              <div className="flex justify-end pr-1 mt-0.5">
                                <span className="text-[7px] bg-rose-500 text-white px-1 py-0.5 rounded font-bold">{reelsTopOffsetPercent}%</span>
                              </div>
                            </div>

                            {/* Número do vídeo selecionado */}
                            {previewVideo && (
                              <div className="absolute top-1 left-1 bg-blue-500/90 text-white text-[7px] font-bold px-1 py-0.5 rounded">
                                #{(reelsPreviewVideoIndex ?? 0) + 1}
                              </div>
                            )}
                          </div>

                          {/* Painel direito: infos + slider */}
                          <div className="flex-1 min-w-0">
                            {/* Info do vídeo selecionado */}
                            {previewVideo && (
                              <div className="mb-3 p-2 bg-slate-50 rounded-xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-700 truncate" title={previewVideo.name}>
                                  🎬 {previewVideo.name}
                                </p>
                                <p className="text-[9px] text-slate-400">{(previewVideo.size / 1024 / 1024).toFixed(1)} MB</p>
                                {previewFrame && (
                                  <p className="text-[9px] text-rose-600 mt-0.5 truncate" title={previewFrame.name}>
                                    🖼 Moldura: {previewFrame.name}
                                  </p>
                                )}
                                <p className={`text-[9px] mt-0.5 font-bold ${
                                  previewVideo.status === 'done' ? 'text-emerald-600' :
                                  previewVideo.status === 'error' ? 'text-rose-600' :
                                  previewVideo.status === 'processing' ? 'text-indigo-600' : 'text-slate-400'
                                }`}>
                                  {previewVideo.status === 'done' ? `✅ Concluído — ${previewVideo.outputSize ? (previewVideo.outputSize/1024/1024).toFixed(1)+' MB' : ''}` :
                                   previewVideo.status === 'error' ? `❌ ${previewVideo.errorMsg?.slice(0, 40)}` :
                                   previewVideo.status === 'processing' ? '⚙️ Processando...' : '⏳ Aguardando'}
                                </p>
                              </div>
                            )}

                            {/* Slider do offset */}
                            <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between mb-1">
                              <span>Altura da Moldura</span>
                              <span className="text-rose-600 font-black">{reelsTopOffsetPercent}%</span>
                            </label>
                            <input
                              type="range"
                              min={10}
                              max={60}
                              step={1}
                              value={reelsTopOffsetPercent}
                              onChange={e => setReelsTopOffsetPercent(Number(e.target.value))}
                              className="w-full accent-rose-500 mb-2"
                            />
                            {/* Presets */}
                            <div className="flex gap-1.5 flex-wrap">
                              {[25, 30, 35, 40, 45].map(v => (
                                <button
                                  key={v}
                                  onClick={() => setReelsTopOffsetPercent(v)}
                                  className={`px-2 py-1 text-[10px] font-bold rounded-lg transition cursor-pointer ${reelsTopOffsetPercent === v ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-rose-50 hover:text-rose-700'}`}
                                >
                                  {v}%
                                </button>
                              ))}
                            </div>
                            <p className="text-[9px] text-slate-400 mt-2 leading-relaxed">
                              A moldura fica <strong>por cima</strong> do vídeo. A linha tracejada mostra onde o vídeo começa abaixo da moldura.
                            </p>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
                  </Panel>

                  {/* Handle vertical entre Preview e Configurações */}
                  <PanelResizeHandle className="group flex items-center justify-center h-2 mx-2 cursor-row-resize my-0.5">
                    <div className="w-10 h-1 rounded-full bg-slate-200 group-hover:bg-rose-400 group-active:bg-rose-500 transition-colors" />
                  </PanelResizeHandle>

                  {/* Painel: Configurações + Ação */}
                  <Panel defaultSize={55} minSize={30} className="overflow-hidden flex flex-col min-h-0">
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm h-full overflow-y-auto flex flex-col gap-4">
                  <h3 className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    Configurações de Saída
                  </h3>
                  <div className="space-y-3">
                    {/* Qualidade CRF */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between mb-1">
                        <span>Qualidade do Vídeo (CRF)</span>
                        <span className="text-indigo-600 font-black">{reelsCrf} {reelsCrf <= 18 ? '🏆 Alta' : reelsCrf <= 25 ? '⭐ Boa' : '⚡ Rápida'}</span>
                      </label>
                      <input
                        type="range"
                        min={12}
                        max={35}
                        step={1}
                        value={reelsCrf}
                        onChange={e => setReelsCrf(Number(e.target.value))}
                        className="w-full accent-indigo-500"
                      />
                      <div className="flex justify-between text-[9px] text-slate-400 mt-0.5">
                        <span>← Menor arquivo</span>
                        <span>Melhor qualidade →</span>
                      </div>
                    </div>

                    {/* Pasta de saída */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-700 mb-1 block">Pasta de Saída</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={reelsOutputFolder}
                          onChange={e => setReelsOutputFolder(e.target.value)}
                          placeholder="Ex: C:\Users\Diego\Downloads\ReelsEditados"
                          className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-300 placeholder-slate-300 font-mono"
                        />
                        {/* Botão: abrir seletor de pasta nativo */}
                        <button
                          onClick={handlePickOutputFolder}
                          className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                          title="Escolher pasta de saída"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                        {/* Botão: abrir pasta no Explorer (só quando há vídeos prontos) */}
                        {reelsOutputFolder && reelsVideoQueue.some(v => v.status === 'done') && (
                          <button
                            onClick={handleOpenReelsOutputFolder}
                            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0"
                            title="Abrir pasta de saída no Explorer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        Formato de saída: <strong>MP4 (H.264 + AAC)</strong> · 1080×1920 · 9:16 Reels
                      </p>
                    </div>


                    {/* Resumo de metadados */}
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-[10px] text-emerald-700 flex items-start gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-600" />
                      <span>
                        <strong>Limpeza de metadados ativa:</strong> GPS, câmera, data de criação, autor e software serão removidos de todos os vídeos.
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botões de Ação */}
                <div className="space-y-2 shrink-0">
                  {!isReelsProcessing ? (
                    <button
                      onClick={handleReelsProcessBatch}
                      disabled={reelsFrames.length === 0 || reelsVideoQueue.filter(v => v.status === 'pending' || v.status === 'error').length === 0 || !reelsOutputFolder}
                      className="w-full py-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-rose-200 transition flex items-center justify-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <Zap className="w-5 h-5" />
                      <span>
                        ⚡ Processar {reelsVideoQueue.filter(v => v.status === 'pending' || v.status === 'error').length} Vídeo(s)
                        {reelsFrames.length > 1 ? ` com ${reelsFrames.length} Molduras` : reelsFrames.length === 1 ? ' com 1 Moldura' : ''}
                      </span>
                    </button>
                  ) : (
                    <button
                      onClick={handleReelsCancelProcessing}
                      className="w-full py-4 bg-slate-800 hover:bg-slate-700 text-white font-black text-sm rounded-2xl transition flex items-center justify-center gap-2.5 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                      <span>Cancelar Processamento</span>
                    </button>
                  )}

                  {reelsVideoQueue.some(v => v.status === 'done') && reelsOutputFolder && (
                    <button
                      onClick={handleOpenReelsOutputFolder}
                      className="w-full py-2.5 bg-white border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <FolderOpen className="w-4 h-4 text-indigo-500" />
                      <span>📁 Abrir Pasta de Saída</span>
                    </button>
                  )}

                  {/* Dicas */}
                  {reelsFrames.length === 0 && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Adicione pelo menos <strong>1 moldura PNG ou JPEG</strong> antes de processar.</span>
                    </div>
                  )}
                  {reelsFrames.length > 0 && reelsVideoQueue.length > 0 && !reelsOutputFolder && (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 flex items-start gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      <span>Defina a <strong>pasta de saída</strong> acima para salvar os vídeos processados.</span>
                    </div>
                  )}
                </div>
                  </Panel>
                </PanelGroup>
              </Panel>
            </PanelGroup>
          </div>
        ) : activeTab !== 'analysis' ? (
          <>
            {/* Form Sidebar */}
            <aside className="lg:col-span-4 h-full flex flex-col overflow-hidden">
              <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col gap-6 h-full overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                {activeTab === 'carousel' && carouselCreationMode === 'clone' ? 'Clonador de Imagens & Posts' : 'Configurar Geração'}
              </h2>
              {activeTab === 'carousel' && carouselCreationMode === 'clone' && clonerSourceImages.length > 0 && (
                <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
                  {clonerSourceImages.length} {clonerSourceImages.length === 1 ? 'imagem' : 'imagens'}
                </span>
              )}
            </div>

            {/* Alternador de Modo no Carrossel: Criar por IA vs Clonar Imagens */}
            {activeTab === 'carousel' && (
              <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200 gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setCarouselCreationMode('generate')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    carouselCreationMode === 'generate'
                      ? 'bg-white text-indigo-600 shadow-xs border border-slate-200/80 font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>✨ Criar por IA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCarouselCreationMode('clone')}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    carouselCreationMode === 'clone'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-sm font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Repeat className="w-3.5 h-3.5" />
                  <span>🧬 Clonador</span>
                </button>
              </div>
            )}

            {activeTab === 'carousel' && carouselCreationMode === 'clone' ? (
              <div className="flex flex-col gap-5 animate-in fade-in duration-300">
                {/* Dica / Info Box */}
                <div className="p-3.5 bg-gradient-to-br from-indigo-50/90 to-purple-50/70 border border-indigo-200 rounded-2xl">
                  <div className="flex items-start gap-2.5">
                    <Repeat className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                    <div className="text-[11px] text-slate-700 leading-relaxed">
                      <strong>Engenharia Reversa de Imagens & Carrosséis:</strong> Carregue 1 imagem individual ou múltiplos slides sequenciais (ex: 2 a 10 imagens). A IA criará prompts idênticos em inglês para FLOW e substituirá o personagem original pelo seu personagem fornecido (caso haja personagem na imagem).
                    </div>
                  </div>
                </div>

                {/* Upload de Imagens a Clonar (Individual ou Grupo) */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-indigo-600" />
                      <span>Imagens para Clonar (Individuais ou Sequenciais)</span>
                    </label>
                    {clonerSourceImages.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAllClonerImages}
                        className="text-[10px] text-red-500 hover:text-red-700 font-bold hover:underline cursor-pointer"
                      >
                        Limpar Todas
                      </button>
                    )}
                  </div>

                  <label className="cursor-pointer border-2 border-dashed border-indigo-200 hover:border-indigo-400 bg-indigo-50/40 hover:bg-indigo-50/70 rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition group text-center">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        Clique ou arraste imagens aqui
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        Suporta seleção única ou múltipla (JPG, PNG, WebP)
                      </p>
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/*,.webp,image/webp"
                      className="hidden"
                      onChange={handleUploadClonerImages}
                    />
                  </label>

                  {/* Lista de Miniaturas das Imagens Carregadas */}
                  {clonerSourceImages.length > 0 && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                        <span>Sequência de Slides ({clonerSourceImages.length}):</span>
                        <span className="text-[10px] text-indigo-600 font-bold">Ordem dos prompts</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {clonerSourceImages.map((img, idx) => (
                          <div key={idx} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 group aspect-square shadow-2xs">
                            <img
                              src={img.preview}
                              alt={img.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 p-1.5 flex flex-col justify-between">
                              <div className="flex items-center justify-between">
                                <span className="px-1.5 py-0.5 rounded bg-black/70 text-white text-[9px] font-black">
                                  #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveClonerImage(idx)}
                                  className="w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center opacity-80 hover:opacity-100 transition cursor-pointer"
                                  title="Remover imagem"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-[9px] text-white/90 truncate font-mono">
                                {img.name}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Configuração de Substituição de Personagem */}
                <div className="space-y-3 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Palette className="w-4 h-4 text-indigo-600" />
                      <span>Substituição de Personagem (Se Existir)</span>
                    </label>
                  </div>

                  {/* Modos de Personagem */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setClonerTargetCharMode('active')}
                      className={`py-2 px-1 text-[10px] font-bold rounded-xl border transition text-center cursor-pointer ${
                        clonerTargetCharMode === 'active'
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      Personagem Atual
                    </button>
                    <button
                      type="button"
                      onClick={() => setClonerTargetCharMode('custom')}
                      className={`py-2 px-1 text-[10px] font-bold rounded-xl border transition text-center cursor-pointer ${
                        clonerTargetCharMode === 'custom'
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      Personalizado
                    </button>
                    <button
                      type="button"
                      onClick={() => setClonerTargetCharMode('none')}
                      className={`py-2 px-1 text-[10px] font-bold rounded-xl border transition text-center cursor-pointer ${
                        clonerTargetCharMode === 'none'
                          ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
                      }`}
                    >
                      Sem Substituição
                    </button>
                  </div>

                  {/* Modo 1: Personagem Atual do App */}
                  {clonerTargetCharMode === 'active' && (
                    <div className="space-y-2 pt-1">
                      {characterImages[0] && characterImages[0]?.data ? (
                        <div className="flex items-center gap-3 p-2.5 bg-white border border-indigo-100 rounded-xl shadow-2xs">
                          <div className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0">
                            <img
                              src={`data:${characterImages[0].mimeType};base64,${characterImages[0].data}`}
                              alt="Personagem Alvo"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-slate-800 truncate">
                              {detectedCharacterDetails[0]?.name || "Personagem Principal"}
                            </p>
                            <p className="text-[10px] text-indigo-600 font-semibold truncate">
                              Cor: {detectedCharacterDetails[0]?.color || "Detectada automaticamente"}
                            </p>
                            {detectedCharacterDetails[0]?.features && (
                              <p className="text-[9px] text-slate-500 truncate">
                                {detectedCharacterDetails[0]?.features}
                              </p>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center space-y-2">
                          <p className="text-[11px] text-amber-800 font-medium">
                            Nenhum personagem carregado no sistema ainda. Carregue um personagem abaixo ou alterne para "Personalizado":
                          </p>
                          <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Carregar Personagem Principal</span>
                            <input
                              type="file"
                              accept="image/*,.webp,image/webp"
                              className="hidden"
                              onChange={(e) => handleImageUpload(0, e)}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Modo 2: Personagem Personalizado */}
                  {clonerTargetCharMode === 'custom' && (
                    <div className="space-y-2 pt-1">
                      <input
                        type="text"
                        placeholder="Nome do Personagem (ex: Raposa Astronauta 3D)"
                        value={customCloneCharName}
                        onChange={(e) => setCustomCloneCharName(e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Cor Predominante (ex: Laranja vibrante e branco)"
                        value={customCloneCharColor}
                        onChange={(e) => setCustomCloneCharColor(e.target.value)}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <textarea
                        placeholder="Características visuais (ex: Estilo render 3D Pixar, olhos grandes expressivos, vestindo capacete espacial...)"
                        value={customCloneCharDesc}
                        onChange={(e) => setCustomCloneCharDesc(e.target.value)}
                        rows={2}
                        className="w-full p-2 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                      />
                      <label className="cursor-pointer flex items-center justify-center gap-2 p-2 bg-white border border-dashed border-indigo-200 rounded-xl text-xs text-indigo-600 font-bold hover:bg-indigo-50 transition">
                        <Upload className="w-4 h-4" />
                        <span>{customCloneCharImg ? 'Foto do Personagem Carregada ✓' : 'Carregar Foto do Personagem (Opcional)'}</span>
                        <input
                          type="file"
                          accept="image/*,.webp,image/webp"
                          className="hidden"
                          onChange={handleUploadCustomCloneCharImg}
                        />
                      </label>
                    </div>
                  )}

                  {/* Modo 3: Sem Substituição */}
                  {clonerTargetCharMode === 'none' && (
                    <div className="p-2.5 bg-slate-100 rounded-xl text-[11px] text-slate-600">
                      A IA clonará as imagens exatamente como estão no original, gerando o prompt descritivo em inglês fiel à cena.
                    </div>
                  )}
                </div>

                {/* Botão de Ação do Clonador */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={handleExecuteImageClone}
                    disabled={isCloningImages || clonerSourceImages.length === 0}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-black text-sm rounded-2xl shadow-lg shadow-indigo-200 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isCloningImages ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Clonando {clonerSourceImages.length} Imagens com Gemini Vision...</span>
                      </>
                    ) : (
                      <>
                        <Repeat className="w-5 h-5" />
                        <span>Clonar e Gerar Prompts ({clonerSourceImages.length})</span>
                      </>
                    )}
                  </button>

                  {isCloningImages && (
                    <button
                      type="button"
                      onClick={handleCancel}
                      className="w-full py-2 text-slate-500 hover:text-red-500 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Cancelar Clonagem</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
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

                  {/* Seletor de Modo / Formato do Carrossel */}
                  <div className="space-y-2 p-3 bg-gradient-to-br from-indigo-50/90 via-purple-50/40 to-white border border-indigo-200/80 rounded-2xl shadow-2xs">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Formato do Carrossel</span>
                      </label>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {carouselLayoutMode === 'deep_phrases' ? '🌟 Frases no Topo' : '💬 Balões'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => setCarouselLayoutMode('deep_phrases')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                          carouselLayoutMode === 'deep_phrases'
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span>🌟 Frases no Topo</span>
                          </span>
                          {carouselLayoutMode === 'deep_phrases' && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <p className={`text-[9.5px] leading-tight ${carouselLayoutMode === 'deep_phrases' ? 'text-indigo-100' : 'text-slate-500'}`}>
                          Sem balões. Frases virais no topo com mesma fonte em todos os slides.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCarouselLayoutMode('dialogue_bubbles')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1 ${
                          carouselLayoutMode === 'dialogue_bubbles'
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-500/20'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold flex items-center gap-1">
                            <span>💬 Diálogos em Balões</span>
                          </span>
                          {carouselLayoutMode === 'dialogue_bubbles' && <Check className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <p className={`text-[9.5px] leading-tight ${carouselLayoutMode === 'dialogue_bubbles' ? 'text-indigo-100' : 'text-slate-500'}`}>
                          Personagens conversando através de balões de fala clássicos.
                        </p>
                      </button>
                    </div>

                    {/* Seletor de Tipografia Fixa no Topo (apenas no modo deep_phrases) */}
                    {carouselLayoutMode === 'deep_phrases' && (
                      <div className="mt-2 pt-2.5 border-t border-indigo-100/80 space-y-1.5 animate-in fade-in">
                        <label className="block text-[11px] font-bold text-slate-800">
                          Fonte & Estilo Fixo no Topo (Idêntico em Todos os Slides):
                        </label>
                        <div className="space-y-1.5">
                          {(Object.keys(TOP_TYPOGRAPHY_STYLES) as TopTypographyStyle[]).map(styleKey => {
                            const styleInfo = TOP_TYPOGRAPHY_STYLES[styleKey];
                            const isSelected = topTypographyStyle === styleKey;
                            return (
                              <button
                                key={styleKey}
                                type="button"
                                onClick={() => setTopTypographyStyle(styleKey)}
                                className={`w-full p-2 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-white border-indigo-500 shadow-xs ring-1 ring-indigo-500'
                                    : 'bg-white/70 border-slate-200 hover:bg-white'
                                }`}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-bold text-slate-800">
                                      {styleInfo.name}
                                    </span>
                                    <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                                      {styleInfo.fontName.split(' - ')[0]}
                                    </span>
                                  </div>
                                  <p className="text-[9px] text-slate-500 italic truncate mt-0.5">
                                    Ex: "{styleInfo.sample}"
                                  </p>
                                </div>
                                <div className="w-4 h-4 rounded-full border flex items-center justify-center shrink-0 border-indigo-500 bg-white">
                                  {isSelected && <div className="w-2 h-2 rounded-full bg-indigo-600" />}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                    <p className="text-[10px] text-amber-700 font-bold leading-tight">
                      {carouselLayoutMode === 'deep_phrases'
                        ? 'Dica: No modo Frases no Topo, os personagens vivenciam a cena sem balões de fala. O prompt da IA reserva o terço superior limpo para aplicação da tipografia padronizada.'
                        : 'Dica: Se selecionar mais de 1 personagem, a IA criará uma dinâmica de diálogo rica que combina com o nicho e tom escolhidos.'}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-900">
                      {carouselLayoutMode === 'deep_phrases' ? 'Tom Narrativo & Emocional' : 'Tom do Diálogo'}
                    </label>
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
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-900">Referências de Personagens (Opcional)</label>
                  <span className="text-[10px] text-slate-500">IA detecta cores e traços automaticamente</span>
                </div>
                <div className="space-y-2">
                  {Array.from({ length: characterCount }).map((_, i) => (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center gap-3">
                        <label className="relative flex-1 cursor-pointer bg-slate-50 border border-slate-200 rounded-xl p-2 hover:bg-slate-100 transition flex items-center justify-center gap-2 text-xs font-medium text-slate-600">
                          {analyzingCharacterIndex[i] ? (
                            <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          <span className="truncate">
                            {analyzingCharacterIndex[i] 
                              ? 'Identificando cores...' 
                              : characterImages[i] 
                                ? (detectedCharacterDetails[i]?.name || `Personagem ${i + 1} Carregado`) 
                                : `Upload Personagem ${i + 1}`}
                          </span>
                          <input 
                            type="file" 
                            accept="image/*,.webp,image/webp" 
                            className="hidden" 
                            onChange={(e) => handleImageUpload(i, e)}
                          />
                        </label>
                        {characterImages[i] && (
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <div className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 shadow-2xs">
                              <img 
                                src={`data:${characterImages[i]!.mimeType};base64,${characterImages[i]!.data}`} 
                                alt={`Char ref ${i + 1}`} 
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <button 
                              type="button"
                              onClick={() => handleRemoveImage(i)}
                              className="w-9 h-9 flex items-center justify-center bg-red-50 text-red-500 rounded-lg border border-red-100 hover:bg-red-100 transition cursor-pointer"
                              title="Remover personagem"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Badge de Cor e Traços Detectados */}
                      {detectedCharacterDetails[i] && (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50/70 border border-indigo-100 rounded-lg text-[11px] text-indigo-900">
                          <Palette className="w-3 h-3 text-indigo-600 shrink-0" />
                          <span className="truncate">
                            Cor: <strong className="text-indigo-700">{detectedCharacterDetails[i]?.color}</strong>
                            {detectedCharacterDetails[i]?.features ? ` • ${detectedCharacterDetails[i]?.features}` : ''}
                          </span>
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

              {/* Seletor de Modo de Balões de Fala (Prevenção Ativa de Balões Vazios no FLOW) */}
              {activeTab === 'carousel' && (
                <div className="space-y-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Balões de Fala (FLOW / I.A)</span>
                    </label>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-2xs ${
                      speechBubbleMode === 'bubbles-ai-safe' 
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-200' 
                        : 'text-amber-700 bg-amber-50 border-amber-200'
                    }`}>
                      {speechBubbleMode === 'bubbles-ai-safe' ? '🛡️ Anti-Balão Vazio Ativo' : '🖼️ Arte Limpa (Sem Balão)'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSpeechBubbleMode('bubbles-ai-safe')}
                      className={`p-2.5 text-left rounded-xl border transition cursor-pointer select-none flex flex-col gap-1 ${
                        speechBubbleMode === 'bubbles-ai-safe'
                          ? 'bg-white text-indigo-950 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                          : 'bg-white/60 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
                        <span>💬 Balão Integrado</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Protege contra balões vazios. Balão exclusivo no falante com fala em PT-BR.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSpeechBubbleMode('clean-art')}
                      className={`p-2.5 text-left rounded-xl border transition cursor-pointer select-none flex flex-col gap-1 ${
                        speechBubbleMode === 'clean-art'
                          ? 'bg-white text-indigo-950 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                          : 'bg-white/60 text-slate-600 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 text-xs font-bold text-amber-700">
                        <span>🖼️ Arte Limpa</span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Cena 100% limpa sem balões, ideal para inserir no Canva ou CapCut.
                      </p>
                    </button>
                  </div>
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
                      accept="image/*,.webp,image/webp" 
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
            )}
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
                <button 
                  onClick={handleExportProjectJSON} 
                  className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3 py-2 rounded-xl border border-indigo-200 transition cursor-pointer shadow-2xs"
                  title="Salvar projeto completo em JSON (inclui tema, configurações e todos os prompts)"
                >
                  <Save className="w-4 h-4 text-indigo-600" /> Salvar Projeto (.JSON)
                </button>
                <button onClick={exportAsTXT} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition cursor-pointer">
                  <FileText className="w-4 h-4" /> TXT
                </button>
                <button onClick={exportAsDOCX} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-2 rounded-xl border border-blue-700 transition cursor-pointer">
                  <FileText className="w-4 h-4" /> DOCX
                </button>
                <button onClick={exportAsPDF} className="flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-2 rounded-xl transition shadow-sm cursor-pointer">
                  <Download className="w-4 h-4" /> PDF
                </button>
                <button 
                  onClick={handleClearResults} 
                  className="flex items-center gap-2 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white text-xs font-semibold px-3 py-2 rounded-xl border border-slate-600 hover:border-red-500 transition cursor-pointer" 
                  title="Limpar todos os resultados e começar de novo"
                >
                  <Trash2 className="w-4 h-4" /> Limpar
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
                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={handleGenerateVideoCoverPreview}
                      disabled={generatingVideoCoverPreview}
                      className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 px-3 py-1.5 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50"
                      title="Gera instantaneamente a capa de vídeo via I.A FLUX.1 gratuita"
                    >
                      {generatingVideoCoverPreview ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                          <span>Gerando Capa...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                          <span>{videoCoverPreviewUrl ? '🔄 Regenerar Capa' : '⚡ Gerar Preview (FLUX)'}</span>
                        </>
                      )}
                    </button>
                    <button 
                      onClick={() => handleCopy(result.nanoBananaImagePrompt || '', 'cover_prompt')}
                      className="flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-600 bg-white px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition shadow-sm border border-indigo-200"
                    >
                      {copiedStates['cover_prompt'] || copiedStates['nano_banana'] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copiar Prompt
                    </button>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-indigo-200 p-4 relative z-10">
                  <code className="text-[11px] lg:text-xs text-indigo-700 leading-tight block font-mono whitespace-pre-wrap">{result.nanoBananaImagePrompt}</code>
                </div>

                {/* Exibição da Imagem de Capa Gerada via FLUX */}
                {videoCoverPreviewUrl && (
                  <div className="mt-4 pt-4 border-t border-indigo-100 flex flex-col sm:flex-row items-center gap-4 relative z-10">
                    <div className="relative w-36 aspect-[9/16] rounded-xl overflow-hidden shadow-lg border border-indigo-200 bg-black shrink-0 group">
                      <img 
                        src={videoCoverPreviewUrl} 
                        alt="Capa do Vídeo" 
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105" 
                      />
                      <button
                        type="button"
                        onClick={() => openSingleImageInLightbox(videoCoverPreviewUrl, 'Capa do Vídeo - PostForge')}
                        className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white cursor-pointer"
                        title="Ampliar Capa em Tela Cheia"
                      >
                        <ZoomIn className="w-5 h-5" />
                      </button>
                    </div>
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                          <Check className="w-3 h-3 text-emerald-600" /> Capa Gerada com FLUX.1
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">9:16 (1080x1920)</span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Capa vertical em proporção 9:16 pronta para Reels, Shorts e TikTok, renderizada a partir do prompt mestre.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => openSingleImageInLightbox(videoCoverPreviewUrl, 'Capa do Vídeo - PostForge')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span>Ampliar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => downloadImageSafe(videoCoverPreviewUrl, 'Capa_Video_FLUX.jpg')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-bold transition border border-slate-300 cursor-pointer shadow-xs"
                        >
                          <Download className="w-3.5 h-3.5 text-amber-500" />
                          <span>Baixar Capa</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
                  {/* Botão de Geração em Lote de Previews com FLUX (Pollinations) */}
                  <button
                    type="button"
                    onClick={handleGenerateAllSlidePreviews}
                    disabled={isGeneratingAllPreviews}
                    className="flex items-center gap-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 text-xs font-black px-4 py-2 rounded-xl shadow-md transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                    title="Gera instantaneamente as imagens de todos os slides via I.A FLUX.1 gratuita (Pollinations.ai)"
                  >
                    {isGeneratingAllPreviews ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Gerando {previewBatchProgress.current}/{previewBatchProgress.total}...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-slate-950" />
                        <span>⚡ Gerar Todos os Previews (FLUX)</span>
                      </>
                    )}
                  </button>

                  {/* Toggle para ligar/desligar overlay da frase no topo */}
                  <button
                    type="button"
                    onClick={() => setShowPreviewTextOverlay(prev => !prev)}
                    className={`flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border transition cursor-pointer ${
                      showPreviewTextOverlay
                        ? 'bg-amber-950/40 text-amber-300 border-amber-500/50 hover:bg-amber-900/50'
                        : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                    title="Alterna a exibição da frase tipográfica real sobre a imagem no preview"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{showPreviewTextOverlay ? 'Overlay: Ativo' : 'Overlay: Oculto'}</span>
                  </button>

                  <button 
                    onClick={handleExportProjectJSON} 
                    className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-indigo-200 transition cursor-pointer shadow-2xs"
                    title="Salvar lote de carrosséis e configurações em arquivo JSON"
                  >
                    <Save className="w-4 h-4 text-indigo-600" /> Salvar Projeto (.JSON)
                  </button>
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
                  <button 
                    onClick={handleClearResults} 
                    className="flex items-center gap-2 bg-slate-700 hover:bg-red-600 text-slate-300 hover:text-white text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-600 hover:border-red-500 transition cursor-pointer shadow-sm" 
                    title="Limpar todos os carrosséis e resultados para começar de novo"
                  >
                    <Trash2 className="w-4 h-4" /> Limpar
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

              {carouselResult.slides?.map((slide, index) => {
                const isDeepMode = slide.layoutMode === 'deep_phrases' || carouselResult.layoutMode === 'deep_phrases';
                const currentTypoKey = (slide.typographyStyle || carouselResult.typographyStyle || topTypographyStyle || 'sans_bold') as TopTypographyStyle;
                const currentTypoInfo = TOP_TYPOGRAPHY_STYLES[currentTypoKey] || TOP_TYPOGRAPHY_STYLES.sans_bold;
                const currentPhrasePt = slide.topPhrasePt || slide.textInBubblesPt || slide.textInBubbles || '';
                const currentPhraseEn = slide.topPhraseEn || slide.textInBubblesEn || slide.textInBubbles || '';
                const currentPhraseEs = slide.topPhraseEs || slide.textInBubblesEs || slide.textInBubbles || '';

                return (
                  <div key={index} className={`bg-slate-900 rounded-2xl p-6 text-slate-300 flex flex-col gap-4 shadow-inner border-l-4 ${
                    isDeepMode ? 'border-amber-500' : 'border-indigo-500'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <h3 className="text-white font-bold text-lg">Slide {slide.slideNumber}</h3>
                        {isDeepMode && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>Frases no Topo</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openCarouselSlideInLightbox(index)}
                          className="flex items-center gap-1 text-[10px] font-bold py-1 px-2.5 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40 rounded-lg transition cursor-pointer"
                          title="Visualizar em Modo Apresentação / Lightbox com navegação"
                        >
                          <ZoomIn className="w-3 h-3" />
                          <span>Apresentar Slide</span>
                        </button>
                        <span className="text-[10px] font-bold py-1 px-2 bg-indigo-500/20 text-indigo-400 rounded uppercase">Slide Completo</span>
                      </div>
                    </div>

                    {/* Preview Visual da Frase Fixa no Topo (Safe-Zone 25%) */}
                    {isDeepMode && currentPhrasePt && (
                      <div className="p-4 bg-gradient-to-r from-slate-950 via-indigo-950/40 to-slate-950 border border-amber-500/40 rounded-2xl flex flex-col items-center justify-center text-center shadow-md relative overflow-hidden group">
                        <div className="flex items-center justify-between w-full mb-1.5 px-2">
                          <span className="text-[9.5px] font-mono text-amber-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>Preview no Topo do Slide (Safe-Zone 25% Limpa)</span>
                          </span>
                          <span className="text-[9px] font-mono bg-amber-500/20 text-amber-200 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                            Fonte Fixa: {currentTypoInfo.fontName}
                          </span>
                        </div>
                        <div className={`mt-1.5 text-sm sm:text-base md:text-lg font-black text-amber-100 px-4 drop-shadow-md transition leading-relaxed ${
                          currentTypoKey === 'serif_editorial' ? 'font-serif italic text-amber-200 font-semibold' :
                          currentTypoKey === 'minimalist_clean' ? 'font-sans font-light tracking-widest uppercase text-slate-100' :
                          'font-sans uppercase font-black tracking-tight text-white'
                        }`}>
                          "{currentPhrasePt}"
                        </div>
                      </div>
                    )}

                    {/* Banner de Imagem de Referência Clonada & Substituição de Personagem */}
                    {slide.originalImagePreview && (
                      <div className="p-4 bg-slate-800/90 border border-indigo-500/40 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 shrink-0 relative group bg-black/40">
                            <img
                              src={slide.originalImagePreview}
                              alt={slide.originalImageName || `Imagem Original Slide ${slide.slideNumber}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => openCarouselSlideInLightbox(index)}
                              className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white cursor-pointer"
                              title="Ver imagem original em tamanho ampliado"
                            >
                              <ZoomIn className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="space-y-1.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                Referência Original Clonada:
                              </span>
                              <span className="text-xs text-white font-semibold truncate font-mono">
                                {slide.originalImageName || `Slide ${slide.slideNumber}`}
                              </span>
                            </div>
                            <div>
                              {slide.originalHadCharacter ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                  <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                  <span className="truncate">{slide.characterReplaced || "Personagem original substituído"}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span>Cena Técnica Fiel (Sem Personagem na Imagem Original)</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => openCarouselSlideInLightbox(index)}
                          className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-lg text-[11px] font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer border border-slate-600"
                        >
                          <ZoomIn className="w-3.5 h-3.5" />
                          <span>Comparar em Tela Cheia</span>
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-indigo-900/20 rounded-xl p-4 border border-indigo-500/30">
                        <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Conteúdo do Slide</h4>
                        <p className="text-sm text-slate-200 leading-relaxed">{slide.descriptionPt}</p>
                      </div>
                      <div className={`rounded-xl p-4 border ${
                        isDeepMode ? 'bg-amber-950/20 border-amber-500/30' : 'bg-emerald-900/20 border-emerald-500/30'
                      }`}>
                        <div className="flex items-center justify-between mb-3 flex-wrap gap-1.5">
                          <h4 className={`text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 ${
                            isDeepMode ? 'text-amber-300' : 'text-emerald-400'
                          }`}>
                            {isDeepMode ? <Sparkles className="w-3.5 h-3.5 text-amber-400" /> : <MessageSquare className="w-3 h-3" />}
                            <span>{isDeepMode ? 'Copiar Prompt + Frase no Topo' : 'Copiar Prompt + Diálogo'}</span>
                          </h4>
                          {isDeepMode ? (
                            <span className="text-[9px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-400/30">
                              {currentTypoInfo.fontName.split(' - ')[0]}
                            </span>
                          ) : (
                            carouselResult.language && carouselResult.language !== 'all' && (
                              <span className="text-[9px] font-bold text-emerald-300 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-400/30 uppercase">
                                {carouselResult.language === 'en' ? '🇺🇸 Inglês' : carouselResult.language === 'es' ? '🇪🇸 Espanhol' : '🇧🇷 Português'}
                              </span>
                            )
                          )}
                        </div>

                        {/* Se foi gerado para 1 idioma específico */}
                        {(carouselResult.language === 'pt' || (!carouselResult.language && (slide.topPhrasePt || slide.textInBubblesPt) && !slide.textInBubblesEn && !slide.textInBubblesEs)) && (
                          <button 
                            onClick={() => handleCopy(
                              isDeepMode
                                ? `${slide.imagePromptEn}\n\nTop Phrase (PT): "${currentPhrasePt}"`
                                : `${slide.imagePromptEn}\n\nDialogue (PT): "${currentPhrasePt}"`,
                              `cb_pt_${index}`
                            )}
                            className={`w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition border group shadow-sm ${
                              isDeepMode ? 'border-amber-500/30' : 'border-emerald-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                                isDeepMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              }`}>🇧🇷 PT</span>
                              <p className={`text-xs font-medium italic truncate ${isDeepMode ? 'text-amber-100' : 'text-slate-100'}`}>"{currentPhrasePt}"</p>
                            </div>
                            <div className={`flex items-center gap-1.5 text-xs font-bold uppercase shrink-0 px-2.5 py-1 rounded-lg border transition ${
                              isDeepMode
                                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-600 group-hover:text-white'
                                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white'
                            }`}>
                              {copiedStates[`cb_pt_${index}`] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>+ Prompt</span>
                            </div>
                          </button>
                        )}

                        {(carouselResult.language === 'en' || (!carouselResult.language && (slide.topPhraseEn || slide.textInBubblesEn) && !slide.textInBubblesPt && !slide.textInBubblesEs)) && (
                          <button 
                            onClick={() => handleCopy(
                              isDeepMode
                                ? `${slide.imagePromptEn}\n\nTop Phrase (EN): "${currentPhraseEn}"`
                                : `${slide.imagePromptEn}\n\nDialogue (EN): "${currentPhraseEn}"`,
                              `cb_en_${index}`
                            )}
                            className={`w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition border group shadow-sm ${
                              isDeepMode ? 'border-amber-500/30' : 'border-emerald-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                                isDeepMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              }`}>🇺🇸 EN</span>
                              <p className={`text-xs font-medium italic truncate ${isDeepMode ? 'text-amber-100' : 'text-slate-100'}`}>"{currentPhraseEn}"</p>
                            </div>
                            <div className={`flex items-center gap-1.5 text-xs font-bold uppercase shrink-0 px-2.5 py-1 rounded-lg border transition ${
                              isDeepMode
                                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-600 group-hover:text-white'
                                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white'
                            }`}>
                              {copiedStates[`cb_en_${index}`] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>+ Prompt</span>
                            </div>
                          </button>
                        )}

                        {(carouselResult.language === 'es' || (!carouselResult.language && (slide.topPhraseEs || slide.textInBubblesEs) && !slide.textInBubblesPt && !slide.textInBubblesEn)) && (
                          <button 
                            onClick={() => handleCopy(
                              isDeepMode
                                ? `${slide.imagePromptEn}\n\nTop Phrase (ES): "${currentPhraseEs}"`
                                : `${slide.imagePromptEn}\n\nDialogue (ES): "${currentPhraseEs}"`,
                              `cb_es_${index}`
                            )}
                            className={`w-full flex items-center justify-between p-3 rounded-xl bg-slate-800 hover:bg-slate-700 transition border group shadow-sm ${
                              isDeepMode ? 'border-amber-500/30' : 'border-emerald-500/30'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border shrink-0 ${
                                isDeepMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                              }`}>🇪🇸 ES</span>
                              <p className={`text-xs font-medium italic truncate ${isDeepMode ? 'text-amber-100' : 'text-slate-100'}`}>"{currentPhraseEs}"</p>
                            </div>
                            <div className={`flex items-center gap-1.5 text-xs font-bold uppercase shrink-0 px-2.5 py-1 rounded-lg border transition ${
                              isDeepMode
                                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20 group-hover:bg-amber-600 group-hover:text-white'
                                : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 group-hover:bg-emerald-600 group-hover:text-white'
                            }`}>
                              {copiedStates[`cb_es_${index}`] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>+ Prompt</span>
                            </div>
                          </button>
                        )}

                        {/* Modo Trilíngue (PT, EN e ES) — APENAS quando idioma é explicitamente 'all' */}
                        {carouselResult.language === 'all' && (
                          <div className="space-y-2">
                            <button 
                              onClick={() => handleCopy(
                                isDeepMode
                                  ? `${slide.imagePromptEn}\n\nTop Phrase (PT): "${currentPhrasePt}"`
                                  : `${slide.imagePromptEn}\n\nDialogue (PT): "${currentPhrasePt}"`,
                                `cb_pt_${index}`
                              )}
                              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition border border-slate-700 group"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold w-5 ${isDeepMode ? 'text-amber-400' : 'text-emerald-500/70'}`}>PT</span>
                                <p className={`text-xs font-medium italic truncate max-w-[150px] ${isDeepMode ? 'text-amber-100' : 'text-slate-200'}`}>"{currentPhrasePt}"</p>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                                {copiedStates[`cb_pt_${index}`] ? <Check className="w-3" /> : <Copy className="w-3" />}
                                <span>+ Prompt</span>
                              </div>
                            </button>

                            <button 
                              onClick={() => handleCopy(
                                isDeepMode
                                  ? `${slide.imagePromptEn}\n\nTop Phrase (EN): "${currentPhraseEn}"`
                                  : `${slide.imagePromptEn}\n\nDialogue (EN): "${currentPhraseEn}"`,
                                `cb_en_${index}`
                              )}
                              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition border border-slate-700 group"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold w-5 ${isDeepMode ? 'text-amber-400' : 'text-emerald-500/70'}`}>EN</span>
                                <p className="text-xs text-slate-400 font-medium italic truncate max-w-[150px]">"{currentPhraseEn}"</p>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 uppercase">
                                {copiedStates[`cb_en_${index}`] ? <Check className="w-3" /> : <Copy className="w-3" />}
                                <span>+ Prompt</span>
                              </div>
                            </button>

                            <button 
                              onClick={() => handleCopy(
                                isDeepMode
                                  ? `${slide.imagePromptEn}\n\nTop Phrase (ES): "${currentPhraseEs}"`
                                  : `${slide.imagePromptEn}\n\nDialogue (ES): "${currentPhraseEs}"`,
                                `cb_es_${index}`
                              )}
                              className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700 transition border border-slate-700 group"
                            >
                              <div className="flex items-center gap-2">
                                <span className={`text-[9px] font-bold w-5 ${isDeepMode ? 'text-amber-400' : 'text-emerald-500/70'}`}>ES</span>
                                <p className="text-xs text-slate-400 font-medium italic truncate max-w-[150px]">"{currentPhraseEs}"</p>
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

                    {/* Card de Preview da Imagem Gerada via FLUX (Pollinations) */}
                    {slide.imageUrl ? (
                      <div className="bg-slate-950 border border-amber-500/40 rounded-2xl p-4 flex flex-col md:flex-row items-center gap-5 shadow-2xl overflow-hidden relative group">
                        {/* Frame Proporcional 4:5 da Imagem */}
                        <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-[4/5] rounded-xl overflow-hidden shadow-xl border border-slate-700/80 bg-black shrink-0">
                          <img
                            src={slide.imageUrl}
                            alt={`Preview Slide ${slide.slideNumber}`}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                          />

                          {/* Overlay Opcional da Frase de Impacto no Topo (Safe-Zone 25%) */}
                          {showPreviewTextOverlay && isDeepMode && currentPhrasePt && (
                            <div className="absolute top-0 inset-x-0 pt-4 pb-8 px-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex flex-col items-center text-center pointer-events-none z-10">
                              <p className={`text-xs sm:text-sm font-extrabold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] px-1 leading-snug ${
                                currentTypoKey === 'serif_editorial' ? 'font-serif italic text-amber-100 font-semibold' :
                                currentTypoKey === 'minimalist_clean' ? 'font-sans font-light tracking-widest uppercase text-slate-100' :
                                'font-sans uppercase font-black tracking-tight text-white'
                              }`}>
                                "{currentPhrasePt}"
                              </p>
                            </div>
                          )}

                          {/* Badge Flutuante no Canto */}
                          <div className="absolute bottom-2 left-2 bg-slate-900/80 backdrop-blur-md px-2 py-0.5 rounded-md border border-slate-700/80 text-[9px] font-mono font-bold text-amber-400 z-10 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 text-amber-400" />
                            <span>FLUX.1 Preview</span>
                          </div>

                          {/* Botão Flutuante de Zoom */}
                          <button
                            type="button"
                            onClick={() => openCarouselSlideInLightbox(index)}
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white cursor-pointer z-20"
                            title="Visualizar em Tela Cheia no Lightbox"
                          >
                            <div className="p-3 rounded-full bg-slate-900/90 border border-white/20 shadow-2xl flex items-center gap-2 text-xs font-bold">
                              <ZoomIn className="w-4 h-4" />
                              <span>Expandir Slide</span>
                            </div>
                          </button>
                        </div>

                        {/* Detalhes & Ações da Imagem */}
                        <div className="flex-1 w-full space-y-3">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                <Check className="w-3 h-3 text-emerald-400" /> Arte Gerada com Sucesso
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                Proporção 4:5 (1080x1350)
                              </span>
                            </div>
                          </div>

                          <p className="text-xs text-slate-300 leading-relaxed">
                            Esta imagem foi renderizada instantaneamente pelo modelo <strong className="text-amber-300">FLUX.1</strong> a partir do prompt visual e composição estruturada para este slide.
                          </p>

                          <div className="flex items-center flex-wrap gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => openCarouselSlideInLightbox(index)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                            >
                              <ZoomIn className="w-3.5 h-3.5" />
                              <span>Apresentar em Tela Cheia</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => downloadImageSafe(slide.imageUrl!, `Slide_${slide.slideNumber}_FLUX.jpg`)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
                              title="Baixar imagem individual em alta resolução"
                            >
                              <Download className="w-3.5 h-3.5 text-amber-400" />
                              <span>Baixar Imagem</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleGenerateSlidePreview(index, true)}
                              disabled={generatingSlidePreviews[index]}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer disabled:opacity-50"
                              title="Gerar nova variação desta cena com nova semente (seed)"
                            >
                              {generatingSlidePreviews[index] ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                                  <span>Gerando...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                  <span>Nova Variação</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Banner Sugestivo para Gerar Preview */
                      <div className="p-3 bg-slate-800/40 border border-slate-700/60 rounded-xl flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                          <p className="text-xs text-slate-300">
                            Gere a arte visual deste slide instantaneamente com I.A gratuita (FLUX.1).
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleGenerateSlidePreview(index)}
                          disabled={generatingSlidePreviews[index]}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 rounded-lg text-xs font-black transition shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {generatingSlidePreviews[index] ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                              <span>Gerando Arte...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5 text-slate-950" />
                              <span>⚡ Gerar Preview (FLUX)</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    <div className="border-t border-slate-700 pt-4 mt-2">
                      <div className="flex justify-between items-center mb-3">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> Prompt de Imagem (FLOW / I.A)
                        </label>
                        <div className="flex items-center gap-2">
                          <button 
                            type="button"
                            onClick={() => handleGenerateSlidePreview(index)}
                            disabled={generatingSlidePreviews[index]}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 px-2.5 py-1 rounded-lg shadow-xs transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Gera instantaneamente o preview visual desta imagem usando o modelo FLUX.1 (Gratuito via Pollinations)"
                          >
                            {generatingSlidePreviews[index] ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-slate-950" />
                                <span>Gerando...</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3 h-3 text-slate-950" />
                                <span>{slide.imageUrl ? '🔄 Regenerar' : '⚡ Gerar Preview'}</span>
                              </>
                            )}
                          </button>
                          <button 
                            type="button"
                            onClick={() => handleShieldPromptAgainstBlankBubbles(index)}
                            className="flex items-center gap-1 text-[10px] font-bold uppercase text-amber-400 hover:text-amber-300 transition bg-amber-950/40 border border-amber-800/60 px-2 py-1 rounded-lg cursor-pointer"
                            title={isDeepMode ? "Garante 0 balões de fala e reserva de 25-30% no topo para tipografia limpa" : "Garante regras rígidas anti-balão vazio para que o FLOW não desenhe balões em branco no ouvinte"}
                          >
                            <ShieldCheck className="w-3 h-3 text-amber-400" />
                            <span>{isDeepMode ? 'Blindar Topo Limpo (Sem Balões)' : 'Blindar Anti-Vazio'}</span>
                          </button>
                          <button 
                            onClick={() => handleCopy(slide.imagePromptEn || '', `cp_${index}`)}
                            className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-indigo-400 hover:text-white transition cursor-pointer"
                          >
                            {copiedStates[`cp_${index}`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} Copiar Prompt
                          </button>
                        </div>
                      </div>
                      <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700">
                        <code className="text-[11px] lg:text-xs text-green-400 leading-relaxed font-mono block whitespace-pre-wrap">
                          {slide.imagePromptEn}
                        </code>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </>
    ) : (
      <div className="lg:col-span-12 w-full h-full flex flex-col gap-4 overflow-hidden">
        {/* Header Superior do Analisador & Clonador */}
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-pink-500 via-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-pink-500/20 shrink-0">
              <Instagram className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-900">Analisador & Clonador de Vídeo Instagram</h2>
                <span className="px-2 py-0.5 bg-pink-50 text-pink-700 text-[10px] font-black rounded-full border border-pink-200/80 uppercase tracking-wider">
                  IA Multi-Modal
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Baixe ou capture Reels do Instagram, transcreva as falas e clone a estrutura em novos Roteiros, Carrosséis e Legendas.
              </p>
            </div>
          </div>

          {/* Seletor de Modo (Clonador Instagram vs Upload Local) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setAnalysisSubTab('cloner')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                analysisSubTab === 'cloner'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Instagram className="w-3.5 h-3.5 text-pink-500" />
              <span>Clonador Instagram (Reels)</span>
            </button>

            <button
              type="button"
              onClick={() => setAnalysisSubTab('local')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                analysisSubTab === 'local'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Upload className="w-3.5 h-3.5 text-indigo-500" />
              <span>Análise de Vídeo Local (MP4)</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MODO 1: CLONADOR DE VÍDEOS DO INSTAGRAM (REELS & POSTS) */}
        {/* ========================================================================= */}
        {analysisSubTab === 'cloner' ? (
          <div className="w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden">
            {/* Coluna Esquerda: Entrada do Vídeo & Parâmetros de Clonagem (5 Colunas) */}
            <aside className="lg:col-span-5 h-full flex flex-col overflow-hidden">
              <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-xs flex flex-col gap-4 h-full overflow-y-auto">
                {/* 1. Seleção de Entrada do Vídeo (Arquivo Local, Link ou Navegador) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                      <Clapperboard className="w-4 h-4 text-pink-500" />
                      <span>Vídeo para Análise & Clonagem</span>
                    </label>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Passo 1</span>
                  </div>

                  {/* Abas Rápidas de Fonte de Entrada */}
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setClonerInputSource('file')}
                      className={`py-2 px-1 text-[11px] font-extrabold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                        clonerInputSource === 'file'
                          ? 'bg-white text-indigo-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>Vídeo Local</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setClonerInputSource('link')}
                      className={`py-2 px-1 text-[11px] font-extrabold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                        clonerInputSource === 'link'
                          ? 'bg-white text-pink-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Instagram className="w-3.5 h-3.5" />
                      <span>Link Reel</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setClonerInputSource('browser')}
                      className={`py-2 px-1 text-[11px] font-extrabold rounded-xl transition flex flex-col sm:flex-row items-center justify-center gap-1 cursor-pointer ${
                        clonerInputSource === 'browser'
                          ? 'bg-white text-purple-600 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Navegador</span>
                    </button>
                  </div>

                  {/* PAINEL 1: UPLOAD / SELEÇÃO DE ARQUIVO LOCAL (MP4/MOV/WEBM) */}
                  {clonerInputSource === 'file' && (
                    <div className="space-y-2">
                      <label
                        onDragOver={(e) => { e.preventDefault(); setIsDragOverClonerVideo(true); }}
                        onDragLeave={() => setIsDragOverClonerVideo(false)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setIsDragOverClonerVideo(false);
                          if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                            handleLocalVideoSelect(e.dataTransfer.files[0]);
                          }
                        }}
                        className={`block cursor-pointer transition-all duration-200`}
                      >
                        <div
                          className={`w-full py-6 px-4 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center transition ${
                            isDragOverClonerVideo
                              ? 'border-indigo-500 bg-indigo-50/80 scale-[1.01]'
                              : instagramVideoPreview?.isLocalFile
                              ? 'border-emerald-500 bg-emerald-50/60'
                              : 'border-slate-300 bg-slate-50 hover:bg-slate-100/80 hover:border-indigo-400'
                          }`}
                        >
                          <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mb-2 shadow-xs ${
                            instagramVideoPreview?.isLocalFile
                              ? 'bg-emerald-500 text-white'
                              : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
                          }`}>
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-black text-slate-800">
                            {instagramVideoPreview?.isLocalFile
                              ? 'Trocar Vídeo Selecionado'
                              : 'Clique para selecionar ou arraste o vídeo'}
                          </span>
                          <span className="text-[10px] text-slate-500 mt-0.5">
                            Suporta .MP4, .MOV, .WEBM gravados ou baixados (até 250MB)
                          </span>
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                handleLocalVideoSelect(e.target.files[0]);
                              }
                            }}
                          />
                        </div>
                      </label>
                    </div>
                  )}

                  {/* PAINEL 2: LINK DIRETO DO INSTAGRAM */}
                  {clonerInputSource === 'link' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={instagramUrl}
                          onChange={(e) => setInstagramUrl(e.target.value)}
                          placeholder="https://www.instagram.com/reel/..."
                          className="flex-1 px-3 py-2 text-xs bg-slate-50 border border-slate-200 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 rounded-xl text-slate-800 transition"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleFetchInstagramUrl(); }}
                        />
                        <button
                          type="button"
                          onClick={handleFetchInstagramUrl}
                          disabled={isFetchingInstagram || !instagramUrl.trim()}
                          className="px-3.5 py-2 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                        >
                          {isFetchingInstagram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                          <span>Buscar</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">Cole o link público de qualquer Reel ou Post do Instagram.</p>
                    </div>
                  )}

                  {/* PAINEL 3: NAVEGADOR COM LOGIN */}
                  {clonerInputSource === 'browser' && (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => {
                          setShowInstagramBrowser(true);
                          setInstagramBrowserUrl(instagramUrl.trim() || 'https://www.instagram.com/reels/');
                        }}
                        className="w-full py-3 px-4 bg-gradient-to-r from-purple-900/10 via-pink-900/10 to-indigo-900/10 hover:bg-pink-50 text-slate-800 hover:text-pink-700 border border-slate-200 hover:border-pink-300 rounded-2xl text-xs font-black transition flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                      >
                        <Globe className="w-4 h-4 text-pink-500" />
                        <span>Abrir Navegador Instagram (Logar & Capturar com 1 Clique)</span>
                      </button>
                      <p className="text-[10px] text-slate-400 text-center">Navegue pelos Reels e clique no botão de captura no topo da tela.</p>
                    </div>
                  )}
                </div>

                {/* Preview do Vídeo Selecionado (Player HTML5 / Miniatura) */}
                {instagramVideoPreview ? (
                  <div className="bg-slate-900 rounded-2xl p-3.5 border border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-800/60 font-bold flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span>Vídeo Pronto para Clonagem</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setInstagramVideoPreview(null);
                          setVideoFile(null);
                        }}
                        className="text-slate-400 hover:text-rose-400 transition p-1 cursor-pointer"
                        title="Remover vídeo"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {instagramVideoPreview.url ? (
                      <video
                        src={instagramVideoPreview.url}
                        controls
                        className="w-full max-h-48 rounded-xl bg-black object-contain border border-slate-800"
                        poster={instagramVideoPreview.thumbnail}
                      />
                    ) : (
                      <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center">
                        <Clapperboard className="w-8 h-8 text-pink-400 mx-auto mb-1" />
                        <p className="text-xs font-bold text-white truncate">{instagramVideoPreview.title || 'Vídeo Selecionado'}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{instagramVideoPreview.sourceUrl}</p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                      <span className="truncate max-w-[220px] text-slate-300 font-bold">{instagramVideoPreview.title || 'Vídeo'}</span>
                      <span className="text-purple-300">{instagramVideoPreview.sourceUrl}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-1">
                    <p className="text-xs text-slate-500 font-medium">Nenhum vídeo carregado ainda.</p>
                    <p className="text-[10px] text-slate-400">Selecione um arquivo de vídeo acima ou cole um link de Reel para começar.</p>
                  </div>
                )}

                {/* 2. Configurações de Clonagem & Nicho */}
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Configuração da Nova Versão (Clonada)</span>
                  </h3>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700">Nicho de Destino</label>
                    <select
                      value={clonerNiche}
                      onChange={(e) => {
                        const newN = e.target.value;
                        setClonerNiche(newN);
                        if (NICHE_SCRIPT_TONES[newN]?.length > 0) {
                          setClonerTone(NICHE_SCRIPT_TONES[newN][0]);
                        }
                      }}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-purple-500"
                    >
                      {NICHES.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-700">Tom de Voz Desejado</label>
                    <select
                      value={clonerTone}
                      onChange={(e) => setClonerTone(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-1 focus:ring-purple-500"
                    >
                      {(NICHE_SCRIPT_TONES[clonerNiche] || ['Acolhedor / Compassivo', 'Motivacional', 'Profundo']).map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700">Objetivo da Clonagem</label>
                    <input
                      type="text"
                      value={clonerObjective}
                      onChange={(e) => setClonerObjective(e.target.value)}
                      placeholder="Ex: Adaptação autoral mantendo o gancho de retenção..."
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800"
                    />
                  </div>

                  {/* Transcrição Opcional Manual */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-700 flex items-center justify-between">
                      <span>Transcrição / Falas do Vídeo (Opcional)</span>
                      <span className="text-[9px] text-slate-400 font-normal">A IA transcreve direto do vídeo</span>
                    </label>
                    <textarea
                      value={clonerTranscriptInput}
                      onChange={(e) => setClonerTranscriptInput(e.target.value)}
                      placeholder="Se preferir, cole aqui as falas ou o roteiro que você deseja clonar..."
                      rows={2}
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-1 focus:ring-purple-500 resize-none font-mono"
                    />
                  </div>
                </div>

                {/* Botão de Ação Principal: Transcrever & Clonar */}
                <div className="mt-auto pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleStartCloningProcess}
                    disabled={isCloning || (!instagramVideoPreview && !videoFile && !clonerTranscriptInput.trim())}
                    className="w-full py-3.5 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:via-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-purple-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isCloning ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Transcrevendo & Clonando Vídeo com IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Transcrever Diálogos & Clonar com IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </aside>

            {/* Coluna Direita: Resultados da Clonagem (7 Colunas) */}
            <section className="lg:col-span-7 h-full flex flex-col overflow-hidden">
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm flex flex-col gap-4 h-full overflow-hidden text-slate-200">
                {!clonerResult ? (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <div className="text-center space-y-3 max-w-md">
                      <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-pink-500/20 via-purple-500/20 to-indigo-500/20 border-2 border-dashed border-purple-500/40 flex items-center justify-center shadow-lg shadow-purple-500/10">
                        <Flame className="w-8 h-8 text-pink-400" />
                      </div>
                      <div>
                        <h4 className="text-base font-extrabold text-white">Engenharia Reversa de Reels</h4>
                        <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                          Forneça um vídeo do Instagram ao lado e clique em <strong>"Transcrever Diálogos & Clonar"</strong>. A IA irá extrair as falas originais, desconstruir a retenção e gerar 3 formatos autorais prontos para publicar!
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 pt-2 text-[10px] text-slate-400">
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">🎬 Roteiro de Vídeo</div>
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">📑 Carrossel 6-8 Slides</div>
                        <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800">📝 Copywriting & Tags</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-3 overflow-hidden">
                    {/* Header do Resultado Clonado */}
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                          Clonagem Concluída com Sucesso
                        </span>
                        <h3 className="text-sm font-extrabold text-white mt-1 truncate">
                          {clonerResult.roteiro_clonado_video?.titulo_sugerido || 'Roteiro Clonado'}
                        </h3>
                      </div>

                      {/* Botões Rápidos de Transferência e Exportação */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={handleTransferClonedToVideo}
                          className="px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
                          title="Enviar para o Criador de Vídeo e gerar as imagens"
                        >
                          <Clapperboard className="w-3.5 h-3.5" />
                          <span>Enviar p/ Vídeo</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleTransferClonedToCarousel}
                          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 shadow-md shadow-purple-600/20 cursor-pointer"
                          title="Enviar para o Criador de Carrossel"
                        >
                          <Layers className="w-3.5 h-3.5" />
                          <span>Enviar p/ Carrossel</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleExportClonedDocx}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold rounded-xl transition flex items-center gap-1 border border-slate-700 cursor-pointer"
                          title="Baixar em formato Word (.docx)"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                          <span>DOCX</span>
                        </button>
                      </div>
                    </div>

                    {/* Abas de Conteúdo do Resultado */}
                    <div className="flex items-center gap-2 border-b border-slate-800 pb-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setClonerActiveViewTab('video')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          clonerActiveViewTab === 'video'
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <Clapperboard className="w-3.5 h-3.5" />
                        <span>1. Roteiro de Vídeo ({clonerResult.roteiro_clonado_video?.cenas?.length || 0} cenas)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setClonerActiveViewTab('carousel')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          clonerActiveViewTab === 'carousel'
                            ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>2. Carrossel Adaptado ({clonerResult.carrossel_adaptado?.slides?.length || 0} slides)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setClonerActiveViewTab('caption')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          clonerActiveViewTab === 'caption'
                            ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>3. Legenda & Copywriting</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setClonerActiveViewTab('transcript')}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                          clonerActiveViewTab === 'transcript'
                            ? 'bg-slate-800 text-white border border-slate-700'
                            : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>4. Transcrição Original</span>
                      </button>
                    </div>

                    {/* Conteúdo da Aba Ativa */}
                    <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                      {/* ABA 1: ROTEIRO DE VÍDEO CLONADO */}
                      {clonerActiveViewTab === 'video' && (
                        <div className="space-y-3">
                          {clonerResult.roteiro_clonado_video?.gancho_novo && (
                            <div className="p-3.5 bg-gradient-to-r from-indigo-950/60 to-purple-950/60 rounded-2xl border border-indigo-500/40">
                              <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">Gancho de Retenção (Primeiros 3 Segundos):</span>
                              <p className="text-xs font-bold text-white mt-1">"{clonerResult.roteiro_clonado_video.gancho_novo}"</p>
                            </div>
                          )}

                          <div className="space-y-2.5">
                            {clonerResult.roteiro_clonado_video?.cenas?.map((cena, cIdx) => (
                              <div key={cIdx} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 text-xs font-black flex items-center justify-center border border-indigo-500/30">
                                      {cena.numero_cena || (cIdx + 1)}
                                    </span>
                                    <span className="text-xs font-bold text-slate-300">Cena {cena.numero_cena || (cIdx + 1)} • <code className="text-indigo-400">{cena.enquadramento}</code></span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(cena.prompt_imagem_en, `cloner_prompt_${cIdx}`)}
                                    className="text-[10px] font-bold text-indigo-400 hover:text-white transition flex items-center gap-1"
                                  >
                                    {copiedStates[`cloner_prompt_${cIdx}`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                    <span>Copiar Prompt</span>
                                  </button>
                                </div>

                                <p className="text-xs text-slate-400 leading-relaxed"><strong className="text-slate-300">Ação Visual:</strong> {cena.acao_visual}</p>
                                
                                <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800">
                                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">Fala da Cena:</span>
                                  <p className="text-xs text-white font-medium italic mt-0.5">"{cena.fala}"</p>
                                </div>

                                <div className="p-2 bg-slate-900/60 rounded-xl border border-slate-800/80 font-mono text-[11px] text-green-400">
                                  <span className="text-[9px] text-slate-500 uppercase block font-sans">Prompt para Gerador de Imagem:</span>
                                  <p className="mt-0.5">{cena.prompt_imagem_en}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {clonerResult.roteiro_clonado_video?.cta_final && (
                            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                              <span className="text-[10px] font-mono text-pink-400 font-bold uppercase">CTA Final Recomendada:</span>
                              <p className="text-white font-bold mt-0.5">{clonerResult.roteiro_clonado_video.cta_final}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* ABA 2: CARROSSEL ADAPTADO */}
                      {clonerActiveViewTab === 'carousel' && (
                        <div className="space-y-2.5">
                          <div className="p-3 bg-purple-950/40 rounded-2xl border border-purple-800/60">
                            <span className="text-[10px] font-bold text-purple-400 uppercase">Título do Carrossel Adaptado:</span>
                            <h4 className="text-xs font-bold text-white mt-0.5">{clonerResult.carrossel_adaptado?.titulo_carrossel}</h4>
                          </div>

                          <div className="space-y-2">
                            {clonerResult.carrossel_adaptado?.slides?.map((slide, sIdx) => (
                              <div key={sIdx} className="bg-slate-950 p-3.5 rounded-2xl border border-slate-800 space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-purple-300">Slide {slide.slide_numero || (sIdx + 1)} ({slide.tipo || 'Slide'})</span>
                                  <span className="text-[10px] font-bold text-slate-500 font-mono">{slide.titulo_slide}</span>
                                </div>
                                <p className="text-xs text-slate-300 leading-relaxed">{slide.conteudo_texto}</p>
                                {slide.prompt_imagem_en && (
                                  <p className="text-[11px] text-green-400 font-mono bg-slate-900 p-2 rounded-lg border border-slate-800">{slide.prompt_imagem_en}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* ABA 3: LEGENDA & COPYWRITING */}
                      {clonerActiveViewTab === 'caption' && (
                        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-pink-400">Legenda Otimizada para o Instagram</span>
                            <button
                              type="button"
                              onClick={() => {
                                const caption = `${clonerResult.legenda_instagram?.gancho || ''}\n\n${clonerResult.legenda_instagram?.corpo || ''}\n\n${clonerResult.legenda_instagram?.cta || ''}\n\n${clonerResult.legenda_instagram?.hashtags?.join(' ') || ''}`;
                                handleCopy(caption, 'cloner_caption');
                              }}
                              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                            >
                              {copiedStates['cloner_caption'] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{copiedStates['cloner_caption'] ? 'Copiado' : 'Copiar Legenda'}</span>
                            </button>
                          </div>

                          <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs space-y-2 leading-relaxed">
                            <p className="font-bold text-white">{clonerResult.legenda_instagram?.gancho}</p>
                            <p className="text-slate-300 whitespace-pre-wrap">{clonerResult.legenda_instagram?.corpo}</p>
                            <p className="text-pink-300 font-bold">{clonerResult.legenda_instagram?.cta}</p>
                          </div>

                          {clonerResult.legenda_instagram?.hashtags && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {clonerResult.legenda_instagram.hashtags.map((tag, tIdx) => (
                                <span key={tIdx} className="text-[10px] font-mono px-2 py-0.5 bg-slate-900 text-purple-300 rounded-md border border-slate-800">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* ABA 4: TRANSCRIÇÃO ORIGINAL & ANÁLISE DE RETENÇÃO */}
                      {clonerActiveViewTab === 'transcript' && (
                        <div className="space-y-3">
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-bold text-slate-300">Transcrição Fiel do Diálogo Original</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(clonerResult.transcricao_original?.dialogo_completo || '', 'cloner_transcript')}
                                className="text-[10px] font-bold text-indigo-400 hover:text-white transition flex items-center gap-1"
                              >
                                {copiedStates['cloner_transcript'] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                <span>Copiar Transcrição</span>
                              </button>
                            </div>
                            <p className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900 p-3 rounded-xl border border-slate-800 font-mono">
                              {clonerResult.transcricao_original?.dialogo_completo || 'Sem transcrição disponível.'}
                            </p>
                          </div>

                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-1.5">
                            <span className="text-xs font-bold text-yellow-400">Análise da Estrutura de Retenção</span>
                            <p className="text-xs text-slate-300 leading-relaxed">
                              {clonerResult.transcricao_original?.analise_retencao}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : (
          /* ========================================================================= */
          /* MODO 2: ANALISADOR DE VÍDEO LOCAL (UPLOAD MP4) */
          /* ========================================================================= */
          <div className="lg:col-span-12 max-w-2xl mx-auto w-full h-full flex flex-col overflow-hidden">
            <div className="bg-white border border-slate-200 rounded-3xl shadow-xs p-8 flex flex-col gap-6 h-full overflow-y-auto pb-6">
              <div className="text-center">
                <h2 className="text-xl font-black text-slate-900">Analisador de Vídeo Local</h2>
                <p className="text-xs text-slate-500 mt-1">Envie seu vídeo MP4 e deixe a IA criar uma sinopse matadora para o Instagram.</p>
              </div>

              <div className="space-y-4">
                <label className="block">
                  <div className={`w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-colors cursor-pointer ${videoFile ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-indigo-300'}`}>
                    <Upload className={`w-10 h-10 mb-3 ${videoFile ? 'text-emerald-500' : 'text-slate-400'}`} />
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
                        <span>Analisando Vídeo...</span>
                      </>
                    ) : (
                      <>
                        <Clapperboard className="w-5 h-5" />
                        <span>Analisar e Criar Sinopse</span>
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
                      <span>Cancelar Análise</span>
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

        {/* ========================================================================= */}
        {/* MODAL DO NAVEGADOR INSTAGRAM (WEBVIEW COM LOGIN & CAPTURA) */}
        {/* ========================================================================= */}
        {showInstagramBrowser && (
          <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Barra Superior do Navegador */}
              <div className="bg-slate-950 p-3.5 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { if (instagramWebviewRef.current?.canGoBack()) instagramWebviewRef.current.goBack(); }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                    title="Voltar"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (instagramWebviewRef.current?.canGoForward()) instagramWebviewRef.current.goForward(); }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                    title="Avançar"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => { instagramWebviewRef.current?.reload(); }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition cursor-pointer"
                    title="Recarregar"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 max-w-lg">
                  <input
                    type="text"
                    value={instagramBrowserUrl}
                    onChange={(e) => setInstagramBrowserUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && instagramWebviewRef.current) {
                        instagramWebviewRef.current.loadURL(instagramBrowserUrl);
                      }
                    }}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white font-mono"
                    placeholder="https://www.instagram.com/reels/..."
                  />
                </div>

                {/* Botão de Captura Flutuante em Destaque */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureFromWebview}
                    disabled={isCapturingWebviewVideo}
                    className="px-4 py-2 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl shadow-lg shadow-pink-600/30 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isCapturingWebviewVideo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Instagram className="w-4 h-4" />}
                    <span>🎯 Capturar Vídeo Selecionado</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowInstagramBrowser(false)}
                    className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Banner de Segurança Anti-Passkey & Sessão Persistente */}
              <div className="bg-indigo-950/70 px-4 py-2 border-b border-indigo-800/50 flex flex-wrap items-center justify-between gap-2 text-xs text-indigo-200 shrink-0">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    <strong className="text-white">Modo Seguro Ativo:</strong> Chaves do Windows bloqueadas para login direto com usuário e senha. Seus cookies e login são salvos permanentemente.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setInstagramBrowserUrl('https://www.instagram.com/accounts/login/');
                      if (instagramWebviewRef.current) instagramWebviewRef.current.loadURL('https://www.instagram.com/accounts/login/');
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-[11px] font-bold rounded-lg transition border border-slate-700 cursor-pointer"
                  >
                    🔑 Ir para Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setInstagramBrowserUrl('https://www.instagram.com/reels/');
                      if (instagramWebviewRef.current) instagramWebviewRef.current.loadURL('https://www.instagram.com/reels/');
                    }}
                    className="px-2.5 py-1 bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white text-[11px] font-bold rounded-lg transition shadow-xs cursor-pointer"
                  >
                    🎬 Ir para Reels
                  </button>
                </div>
              </div>

              {/* Webview do Instagram */}
              <div className="flex-1 bg-black relative">
                {/* @ts-ignore */}
                <webview
                  ref={instagramWebviewRef}
                  src={instagramBrowserUrl}
                  partition="persist:instagram_session"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
                  allowpopups="true"
                />
              </div>
            </div>
          </div>
        )}
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
                                      onClick={() => openAuditSlideInLightbox(index)}
                                      className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center text-white cursor-pointer"
                                      title="Expandir Imagem e Navegar no Carrossel"
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
                                    onClick={() => openSurplusInLightbox(sIdx)}
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

      {/* Modal de Zoom e Navegação em Carrossel (Lightbox) no Nível Mais Alto (z-[100]) */}
      {((lightboxGallery && lightboxGallery.items.length > 0) || auditImageModalUrl) && (() => {
        const gallery = lightboxGallery && lightboxGallery.items.length > 0
          ? lightboxGallery
          : {
              items: [{
                url: auditImageModalUrl!.url,
                title: auditImageModalUrl!.title,
                filename: auditImageModalUrl!.title,
                slideNumber: 1,
                totalSlides: 1
              }],
              currentIndex: 0
            };

        const currentItem = gallery.items[gallery.currentIndex] || gallery.items[0];
        const totalCount = gallery.items.length;
        const hasPrev = totalCount > 1;
        const hasNext = totalCount > 1;

        const handleClose = () => {
          setLightboxGallery(null);
          setAuditImageModalUrl(null);
        };

        const handlePrev = (e: React.MouseEvent) => {
          e.stopPropagation();
          setLightboxGallery(prev => {
            if (!prev) return null;
            const newIdx = (prev.currentIndex - 1 + prev.items.length) % prev.items.length;
            return { ...prev, currentIndex: newIdx };
          });
        };

        const handleNext = (e: React.MouseEvent) => {
          e.stopPropagation();
          setLightboxGallery(prev => {
            if (!prev) return null;
            const newIdx = (prev.currentIndex + 1) % prev.items.length;
            return { ...prev, currentIndex: newIdx };
          });
        };

        return (
          <div 
            onClick={handleClose}
            className="fixed inset-0 z-[100] bg-slate-950/92 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-150"
          >
            <div 
              onClick={(e) => e.stopPropagation()}
              className="bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden max-w-5xl w-full max-h-[96vh] flex flex-col shadow-2xl animate-in zoom-in-95"
            >
              {/* Header do Lightbox */}
              <div className="p-3 sm:p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
                <div className="flex items-center gap-2.5 min-w-0 pr-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
                    <ZoomIn className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 bg-indigo-600 text-white text-[11px] font-black rounded-lg shadow-xs">
                        Slide {currentItem.slideNumber || gallery.currentIndex + 1} de {totalCount}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-white truncate font-mono">
                        {currentItem.filename || currentItem.title}
                      </h4>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Navegue com as setas ⬅️ ➡️ do teclado ou use os botões • ESC para fechar
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {currentItem.url && (
                    <button
                      type="button"
                      onClick={() => downloadImageSafe(currentItem.url, ((currentItem.filename || currentItem.title).replace(/[^a-zA-Z0-9._-]/g, '_')) + (currentItem.url.includes('.') ? '' : '.jpg'))}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-md"
                      title="Baixar imagem individual"
                    >
                      <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Baixar Imagem</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition cursor-pointer"
                    title="Fechar (ESC)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Área Central da Imagem com Botões de Navegação */}
              <div className="relative flex-1 p-2 sm:p-4 flex items-center justify-center bg-slate-950 overflow-hidden min-h-[300px] max-h-[58vh]">
                {/* Botão Anterior */}
                {hasPrev && (
                  <button
                    type="button"
                    onClick={handlePrev}
                    className="absolute left-3 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-indigo-600 border border-slate-700 text-white flex items-center justify-center shadow-xl backdrop-blur-xs transition cursor-pointer hover:scale-105"
                    title="Slide Anterior (Seta Esquerda)"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                )}

                {/* Imagem Central */}
                {currentItem.url ? (
                  <img 
                    src={currentItem.url} 
                    alt={currentItem.title} 
                    referrerPolicy="no-referrer"
                    className="max-h-[54vh] w-auto max-w-full object-contain rounded-2xl shadow-2xl border border-slate-800 transition-all duration-200"
                  />
                ) : (
                  <div className="w-72 h-72 flex flex-col items-center justify-center text-slate-500 border border-slate-800 rounded-2xl bg-slate-900/50 p-4 text-center">
                    <ImageIcon className="w-12 h-12 mb-2 text-slate-600" />
                    <span className="text-xs font-bold text-slate-300 font-mono">{currentItem.title}</span>
                    <span className="text-[10px] text-slate-500 mt-1">Nenhuma miniatura em alta resolução disponível</span>
                  </div>
                )}

                {/* Botão Próximo */}
                {hasNext && (
                  <button
                    type="button"
                    onClick={handleNext}
                    className="absolute right-3 z-10 w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-indigo-600 border border-slate-700 text-white flex items-center justify-center shadow-xl backdrop-blur-xs transition cursor-pointer hover:scale-105"
                    title="Próximo Slide (Seta Direita)"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                )}
              </div>

              {/* Barra de Miniaturas / Paginação Rápida */}
              {totalCount > 1 && (
                <div className="px-4 py-2 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-center gap-1.5 overflow-x-auto shrink-0">
                  {gallery.items.map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setLightboxGallery(prev => prev ? { ...prev, currentIndex: idx } : null)}
                      className={`h-2.5 rounded-full transition-all cursor-pointer ${
                        idx === gallery.currentIndex 
                          ? 'w-8 bg-indigo-500 shadow-md shadow-indigo-500/50' 
                          : 'w-2.5 bg-slate-700 hover:bg-slate-500'
                      }`}
                      title={`Ir para Slide ${idx + 1}`}
                    />
                  ))}
                </div>
              )}

              {/* Painel Inferior de Metadados e Informações do Slide */}
              <div className="p-4 bg-slate-850 border-t border-slate-800 flex flex-col gap-3 max-h-[28vh] overflow-y-auto shrink-0">
                {/* Diálogo / Fala no Balão ou Frase de Impacto no Topo */}
                {currentItem.dialogue && (
                  <div className={`p-3 rounded-xl flex items-start gap-2.5 ${
                    currentItem.layoutMode === 'deep_phrases'
                      ? 'bg-gradient-to-r from-amber-950/40 via-indigo-950/40 to-slate-900 border border-amber-500/40'
                      : 'bg-indigo-950/50 border border-indigo-500/30'
                  }`}>
                    <div className={`w-6 h-6 rounded-lg text-white flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                      currentItem.layoutMode === 'deep_phrases' ? 'bg-amber-600' : 'bg-indigo-600'
                    }`}>
                      {currentItem.layoutMode === 'deep_phrases' ? <Sparkles className="w-3.5 h-3.5 text-white" /> : <MessageSquare className="w-3.5 h-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between flex-wrap gap-1.5">
                        <span className={`text-[10px] font-black uppercase tracking-wider ${
                          currentItem.layoutMode === 'deep_phrases' ? 'text-amber-300' : 'text-indigo-300'
                        }`}>
                          {currentItem.layoutMode === 'deep_phrases' ? '🌟 Frase de Impacto no Topo (Safe-Zone):' : 'Fala no Balão de Diálogo:'}
                        </span>
                        {currentItem.layoutMode === 'deep_phrases' && currentItem.typographyStyle && (
                          <span className="text-[9px] font-mono bg-amber-500/20 text-amber-200 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                            Fonte Fixa: {TOP_TYPOGRAPHY_STYLES[currentItem.typographyStyle as TopTypographyStyle]?.fontName || currentItem.typographyStyle}
                          </span>
                        )}
                      </div>
                      <p className={`text-xs sm:text-sm font-bold mt-1 leading-relaxed ${
                        currentItem.layoutMode === 'deep_phrases' ? 'text-amber-100' : 'text-indigo-100'
                      }`}>
                        "{currentItem.dialogue}"
                      </p>
                    </div>
                  </div>
                )}

                {/* Descrição Visual do Slide */}
                {currentItem.description && (
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-slate-800 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 border border-slate-700">
                      <Clapperboard className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Descrição da Cena:
                      </span>
                      <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                        {currentItem.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Consistência / Feedback da IA (se disponível) */}
                {(currentItem.consistencyScore || currentItem.consistencyFeedback) && (
                  <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl flex items-start gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-emerald-950 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-800/50">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                          Consistência Visual da IA:
                        </span>
                        {currentItem.consistencyScore && (
                          <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-black rounded-md border border-emerald-500/30">
                            {currentItem.consistencyScore}
                          </span>
                        )}
                      </div>
                      {currentItem.consistencyFeedback && (
                        <p className="text-xs text-slate-300 mt-0.5 leading-relaxed">
                          {currentItem.consistencyFeedback}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Prompt Original da Imagem */}
                {currentItem.prompt && (
                  <div className="p-2.5 bg-slate-900/60 border border-slate-800 rounded-xl flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-[9px] font-mono font-bold uppercase text-slate-400">
                        Prompt de Imagem (FLOW / I.A):
                      </span>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5 line-clamp-2 select-all">
                        {currentItem.prompt}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCopy(currentItem.prompt || '', `lightbox_prompt_${currentItem.slideNumber}`)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-400 text-[10px] font-bold rounded-lg transition shrink-0 border border-slate-700 cursor-pointer flex items-center gap-1"
                      title="Copiar prompt completo"
                    >
                      {copiedStates[`lightbox_prompt_${currentItem.slideNumber}`] ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                      <span>Copiar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
