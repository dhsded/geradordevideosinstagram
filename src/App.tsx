import React, { useState } from 'react';
import { Loader2, Copy, Check, Sparkles, Image as ImageIcon, Clapperboard, MessageSquare, Upload, Key, X, FileText, Download, ArrowLeft, ArrowRight, RotateCw, Play, Square, Trash2, Eye, Compass, Terminal, MousePointer, Keyboard, Cpu, Send, Database } from 'lucide-react';
import { jsPDF } from "jspdf";

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
  'Psicologia': ['Psicológico', 'Filosófico', 'Profundidade'],
  'Psiquiatria': ['Psicológico', 'Filosófico', 'Profundidade'],
  'Neuropsicologia': ['Psicológico', 'Filosófico', 'Profundidade'],
  'Fitness': ['Motivacional', 'Tutorial / Passo a Passo', 'Curiosidades / Mitos'],
  'Top 10 Filmes e Séries': ['Ranking / Top 10', 'Recomendação Secreta', 'Curiosidades / Bastidores']
};

const NICHE_SCRIPT_TONES: Record<string, string[]> = {
  'Psicologia': ['Poético', 'Metafórico e Profundo', 'Filosófico'],
  'Psiquiatria': ['Poético', 'Metafórico e Profundo', 'Filosófico'],
  'Neuropsicologia': ['Poético', 'Metafórico e Profundo', 'Filosófico'],
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
  const [activeTab, setActiveTab] = useState<'script' | 'analysis' | 'carousel' | 'spy'>('script');
  
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
  const [scriptTone, setScriptTone] = useState('Poético');
  const [includeHook, setIncludeHook] = useState(true);
  const [carouselTone, setCarouselTone] = useState('Psicológico');
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

  const [characterImages, setCharacterImages] = useState<{data: string, mimeType: string}[]>([]);
  const [contextImages, setContextImages] = useState<{data: string, mimeType: string}[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedPrompts | null>(null);
  const [carouselResult, setCarouselResult] = useState<GeneratedCarousel | null>(null);

  // Video Analysis states
  const [videoFile, setVideoFile] = useState<{data: string, mimeType: string} | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  
  const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

  // Estados e manipuladores do Gerenciador de Chaves Rotativas
  const [isKeyManagerOpen, setIsKeyManagerOpen] = useState(false);
  const [keysStats, setKeysStats] = useState<{
    total: number;
    free: number;
    exhausted: number;
    keysList: Array<{
      keyMasked: string;
      status: 'free' | 'exhausted';
      successCount: number;
      errorCount: number;
      addedAt: string;
    }>;
  }>({ total: 0, free: 0, exhausted: 0, keysList: [] });
  const [isUploadingKeys, setIsUploadingKeys] = useState(false);
  const [keyManagerError, setKeyManagerError] = useState<string | null>(null);

  const fetchKeysStats = async () => {
    try {
      const response = await fetch('/api/keys');
      if (response.ok) {
        const data = await response.json();
        setKeysStats(data);
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas de chaves:', err);
    }
  };

  React.useEffect(() => {
    fetchKeysStats();
  }, []);

  // Buscar caminho do preload do espião
  React.useEffect(() => {
    const getPreload = async () => {
      try {
        const res = await fetch('/api/preload-path');
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
      
      const response = await fetch('/api/save-analysis', {
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

        const response = await fetch('/api/keys/upload', {
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

  const handleRemoveKey = async (maskedKey: string) => {
    try {
      const response = await fetch('/api/keys', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: maskedKey })
      });
      if (response.ok) {
        const data = await response.json();
        setKeysStats(data);
      } else {
        const errData = await response.json();
        setKeyManagerError(errData.error || 'Erro ao remover chave.');
      }
    } catch (err: any) {
      console.error(err);
      setKeyManagerError(err.message || 'Erro ao conectar ao servidor.');
    }
  };

  const handleResetKeys = async () => {
    try {
      const response = await fetch('/api/keys/reset', { method: 'POST' });
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
      const response = await fetch('/api/keys/clear', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setKeysStats(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancel = () => {
    setIsCancelled(true);
    setIsLoading(false);
    setIsAnalyzing(false);
    setError('Operação cancelada pelo usuário.');
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
      let content = `--- NANO BANANA COMPONENT ---\n\n`;
      content += `${result.nanoBananaImagePrompt}\n\n`;
      content += `=========================================\n\n`;
      
      result.scenes.forEach((scene) => {
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
      link.download = `roteiro_gerado.txt`;
      link.click();
      URL.revokeObjectURL(url);
    } else if (activeTab === 'carousel' && carouselResult) {
      let content = `--- CARROSSEL INSTAGRAM ---\n\n`;
      
      carouselResult.slides.forEach((slide) => {
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
      link.download = `carrossel_gerado.txt`;
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const exportAsPDF = () => {
    const doc = new jsPDF();
    let yPos = 20;
    const margin = 20;
    const pageWidth = doc.internal.pageSize.width;
    const maxLineWidth = pageWidth - margin * 2;

    const addText = (text: string, fontSize: number, isBold: boolean = false, textColor: [number, number, number] = [0,0,0]) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", isBold ? "bold" : "normal");
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);
      
      const lines = doc.splitTextToSize(text, maxLineWidth);
      
      if (yPos + (lines.length * fontSize * 0.4) > doc.internal.pageSize.height - margin) {
        doc.addPage();
        yPos = margin;
      }
      
      doc.text(lines, margin, yPos);
      yPos += lines.length * fontSize * 0.4 + 5;
    };

    if (activeTab === 'script' && result) {
      addText("ROTEIRO GERADO", 18, true);
      yPos += 5;
      
      addText("NANO BANANA COMPONENT", 12, true, [100, 100, 200]);
      addText(result.nanoBananaImagePrompt, 10);
      yPos += 10;

      result.scenes.forEach((scene) => {
        addText(`CENA ${scene.sceneNumber} (${scene.duration}s)`, 14, true);
        addText("Contexto:", 10, true, [100, 100, 100]);
        addText(scene.contextPt, 10);
        addText("Prompt de Video (EN):", 10, true, [50, 150, 50]);
        addText(scene.videoPromptEn, 10);
        addText("Falas / Dialogo:", 10, true, [200, 100, 50]);
        addText(`PT: ${scene.dialoguePt}`, 10);
        addText(`EN: ${scene.dialogueEn}`, 10);
        addText(`ES: ${scene.dialogueEs}`, 10);
        yPos += 5;
      });

      addText("INSTAGRAM POST", 14, true, [180, 50, 150]);
      addText(result.instagramPost, 10);
      doc.save("roteiro_gerado.pdf");

    } else if (activeTab === 'carousel' && carouselResult) {
      addText("CARROSSEL INSTAGRAM", 18, true);
      addText(`ESTILO: ${artStyle}`, 12, true, [100, 100, 100]);
      yPos += 5;

      carouselResult.slides.forEach((slide) => {
        addText(`SLIDE ${slide.slideNumber}`, 14, true);
        addText("Descrição:", 10, true, [100, 100, 100]);
        addText(slide.descriptionPt, 10);
        addText("Texto nos Balões:", 10, true, [50, 50, 200]);
        addText(`PT: ${slide.textInBubblesPt}`, 10);
        addText(`EN: ${slide.textInBubblesEn}`, 10);
        addText(`ES: ${slide.textInBubblesEs}`, 10);
        addText("Prompt de Imagem (EN):", 10, true, [50, 150, 50]);
        addText(slide.imagePromptEn, 10);
        yPos += 5;
      });

      addText("INSTAGRAM POST", 14, true, [180, 50, 150]);
      addText(carouselResult.instagramPost, 10);
      doc.save("carrossel_gerado.pdf");
    }
  };

  const exportAsDOCX = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: []
      }]
    });

    const children: any[] = [];

    if (activeTab === 'script' && result) {
      children.push(new Paragraph({ text: "ROTEIRO GERADO", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
      children.push(new Paragraph({ text: `Nicho: ${niche.toUpperCase()}`, heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ children: [new TextRun({ text: "Prompt Nano Banana:", bold: true }), new TextRun({ text: ` ${result.nanoBananaImagePrompt}` })] }));
      
      result.scenes.forEach((scene) => {
        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({ text: `CENA ${scene.sceneNumber} (${scene.duration}s)`, heading: HeadingLevel.HEADING_3 }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Contexto: ", bold: true }), new TextRun({ text: scene.contextPt })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Prompt Vídeo: ", bold: true }), new TextRun({ text: scene.videoPromptEn })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Narração (PT): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialoguePt })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Narração (EN): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialogueEn })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Narração (ES): ", bold: true, color: "3333FF" }), new TextRun({ text: scene.dialogueEs })] }));
      });

      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ text: "Legenda Instagram", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: result.instagramPost }));

    } else if (activeTab === 'carousel' && carouselResult) {
      children.push(new Paragraph({ text: "CARROSSEL GERADO", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }));
      children.push(new Paragraph({ text: `Estilo: ${artStyle.toUpperCase()}`, heading: HeadingLevel.HEADING_2 }));

      carouselResult.slides.forEach((slide) => {
        children.push(new Paragraph({ text: "" }));
        children.push(new Paragraph({ text: `SLIDE ${slide.slideNumber}`, heading: HeadingLevel.HEADING_3 }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Descrição: ", bold: true }), new TextRun({ text: slide.descriptionPt })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (PT): ", bold: true, color: "3333FF" }), new TextRun({ text: slide.textInBubblesPt })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (EN): ", bold: true, color: "3333FF" }), new TextRun({ text: slide.textInBubblesEn })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Diálogos (ES): ", bold: true, color: "3333FF" }), new TextRun({ text: slide.textInBubblesEs })] }));
        children.push(new Paragraph({ children: [new TextRun({ text: "Prompt Imagem: ", bold: true }), new TextRun({ text: slide.imagePromptEn })] }));
      });

      children.push(new Paragraph({ text: "" }));
      children.push(new Paragraph({ text: "Legenda Instagram", heading: HeadingLevel.HEADING_2 }));
      children.push(new Paragraph({ text: carouselResult.instagramPost }));
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
      delete newImages[index];
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

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (file.size > 100 * 1024 * 1024) { // 100MB limit for base64
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
    setIsAnalyzing(true);
    setIsCancelled(false);
    setError(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: "Analise este vídeo e crie uma sinopse cativante para uma postagem no Instagram. Inclua gancho inicial, corpo do texto e hashtags relevantes.",
          videoData: videoFile.data,
          mimeType: videoFile.mimeType
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Erro ao analisar vídeo.');
      }

      const data = await response.json();
      if (isCancelled) return;
      if (!data.text) throw new Error('Sem resposta da análise.');
      setAnalysisResult(data.text);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao analisar vídeo.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() && contextImages.length === 0) {
      setError('Por favor, insira o tema da história ou anexe imagens de referência.');
      return;
    }

    setIsLoading(true);
    setIsCancelled(false);
    setError(null);
    setResult(null);
    setCarouselResult(null);

    try {
      const temaFinal = topic.trim() || "Utilize exclusivamente as informações e textos contidos nas imagens de referência anexadas.";
      
      let promptText = "";
      let responseSchema: any = {};

      if (activeTab === 'script') {
        promptText = `Você é um diretor de cinema e roteirista premiado, especialista em vídeos curtos e virais que geram identificação profunda e emocional.
        O nicho do canal é: "${niche}".
        O estilo de animação DEVE ser estritamente "${animationStyle}". Descreva isso claramente em todos os prompts de vídeo.
        O estilo visual dos enquadramentos deve seguir: "${visualDynamism}".
        ${niche !== 'Top 10 Filmes e Séries' ? `O tom da narrativa deve ser estritamente: "${scriptTone}".` : ''}
        O tema do vídeo é: "${temaFinal}".
        ${includeHook ? 'A primeira cena (CENA 1) DEVE conter um "HOOK" (gancho) poderoso que prenda a atenção nos primeiros 3 segundos e gere identificação instantânea.' : 'Não é necessário um gancho comercial na primeira cena; foque no fluxo emocional natural e profundo.'}
        
        INSTRUÇÕES PARA O DIÁLOGO/NARRAÇÃO:
        - IDENTIFICAÇÃO DE VOZ: Analise as imagens de personagem enviadas. Se houver um personagem feminino proeminente, a voz da narração deve ser FEMININA. Se for masculino, MASCULINA. Se não houver clareza ou não houver fotos, use uma voz que melhor se adapte ao tema.
        - Use PSICOLOGIA e FILOSOFIA para criar falas que toquem na ferida, que façam o espectador se sentir compreendido.
        - O objetivo é gerar identificação visceral. O espectador deve pensar: "Isso foi escrito para mim".
        ${niche !== 'Top 10 Filmes e Séries' ? `
        - ${scriptTone === 'Poético' ? 'Use rimas suaves, métrica e metáforas visuais delicadas, focando na beleza da dor e da superação.' : ''}
        - ${scriptTone === 'Metafórico e Profundo' ? 'Use analogias com a natureza, o universo ou objetos cotidianos para explicar sentimentos complexos que "quebram" quem lê.' : ''}
        - ${scriptTone === 'Filosófico' ? 'Explore dilemas existenciais, a brevidade da vida e a busca por sentido, citando ou aludindo a grandes pensadores de forma acessível.' : ''}
        ` : 'Para o nicho de Filmes e Séries, foque em curiosidades, rankings e fatos impactantes do TOP 10, mantendo o dinamismo informativo.'}
        
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
        promptText = `Você é um engenheiro de prompts especialista em Carrosséis do Instagram e geração de imagens por IA.
        O usuário quer um Carrossel com ${sceneCount} imagens (slides).
        O estilo de arte DEVE ser estritamente "${artStyle}".
        O nicho do canal é: "${niche}".
        O tom do diálogo dos slides deve ser focado em: "${carouselTone}".
        O tema base é: "${temaFinal}".\n`;

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

        if (carouselTone === 'Psicológico') {
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
          promptText += `Como o tom é de Recomendação Secreta, recomende uma obra-prima oculta com argumentos brilhantes, criando asco de quem ainda não assistiu e desejo urgente de ver.\n`;
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

      const parts: any[] = [{ text: promptText }];
      
      for (let i = 0; i < characterCount; i++) {
        const img = characterImages[i];
        if (img) parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
      }

      for (const img of contextImages) {
        parts.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
      }

      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          parts,
          responseSchema
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Ocorreu um erro ao gerar.');
      }

      const data = await response.json();
      if (isCancelled) return;
      if (!data.text) throw new Error('Sem resposta da API.');

      const jsonResult = JSON.parse(data.text);
      if (activeTab === 'script') {
        setResult(jsonResult);
      } else {
        setCarouselResult(jsonResult);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao gerar.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans">
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-6 lg:px-8 flex-shrink-0 z-10">
        <div className="flex items-center gap-3 text-indigo-600">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Prompter <span className="text-slate-400 font-normal">Nano Banana</span></h1>
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
            onClick={() => setIsKeyManagerOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-[10px] sm:text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 hover:border-slate-300 rounded-xl shadow-sm transition cursor-pointer select-none"
          >
            <Key className="w-3.5 h-3.5 text-indigo-500" />
            <span className="hidden sm:inline">Chaves</span>
            {keysStats.total > 0 && (
              <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[9px] font-extrabold rounded-full ${keysStats.free > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                {keysStats.free}/{keysStats.total}
              </span>
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
                        <div className="grid grid-cols-3 gap-2">
                          {(NICHE_SCRIPT_TONES[niche] || []).map(tone => (
                            <button
                              key={tone}
                              type="button"
                              onClick={() => setScriptTone(tone)}
                              className={`py-2 px-1 text-[9px] font-bold rounded-lg border transition ${scriptTone === tone ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
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
                    <div className="grid grid-cols-3 gap-2">
                      {(NICHE_CAROUSEL_TONES[niche] || []).map(tone => (
                        <button
                          key={tone}
                          type="button"
                          onClick={() => setCarouselTone(tone)}
                          className={`py-2 px-1 text-[10px] font-bold rounded-lg border transition ${carouselTone === tone ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm' : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
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
                <label className="block text-xs font-semibold text-slate-900">Tema da História / Descrição / Texto para Adaptação</label>
                <textarea 
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Ex: Como lidar com a ansiedade... Ou cole aqui o seu próprio texto para ser adaptado em roteiro."
                  rows={4}
                  className="w-full p-3 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                />
              </div>

              {/* Context/Scenario Images Upload */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-900">Anexar Imagens com Textos de Referência</label>
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
            <div className="bg-slate-900 rounded-2xl shadow-inner h-full min-h-[400px] flex flex-col items-center justify-center text-indigo-400 p-8">
              <Loader2 className="w-10 h-10 animate-spin mb-4 text-indigo-500" />
              <p className="font-medium animate-pulse tracking-wide text-slate-300">Processando com Inteligência Artificial...</p>
            </div>
          )}

          {activeTab === 'script' && result && !isLoading && (
            <div className="flex flex-col gap-4 animate-in fade-in duration-500 h-full overflow-y-auto pb-4 pr-1">
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

              {/* Nano Banana Image Prompt */}
              <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5 flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-center mb-3 relative z-10">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-yellow-400 rounded-md flex items-center justify-center text-xs">🍌</div>
                    <h3 className="text-indigo-900 font-bold text-sm uppercase">Capinha Nano Banana</h3>
                  </div>
                  <button 
                    onClick={() => handleCopy(result.nanoBananaImagePrompt, 'nano_banana')}
                    className="flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-600 bg-white px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition shadow-sm border border-indigo-200"
                  >
                    {copiedStates['nano_banana'] ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
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
                  <button onClick={() => handleCopy(result.instagramPost, 'ig_post')} className="flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-400 bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition border border-slate-700">
                    {copiedStates['ig_post'] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} Copiar Legenda
                  </button>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{result.instagramPost}</p>
                </div>
              </div>

              {result.scenes.map((scene, index) => (
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
                        onClick={() => handleCopy(scene.videoPromptEn, `vp_${index}`)}
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
                  <button onClick={() => handleCopy(carouselResult.instagramPost, 'ig_carousel')} className="flex items-center gap-1.5 text-xs font-bold uppercase text-indigo-400 bg-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-700 transition border border-slate-700">
                    {copiedStates['ig_carousel'] ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />} Copiar Legenda
                  </button>
                </div>
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <p className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap">{carouselResult.instagramPost}</p>
                </div>
              </div>

              {carouselResult.slides.map((slide, index) => (
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
                        onClick={() => handleCopy(slide.imagePromptEn, `cp_${index}`)}
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

      {/* MODAL DO GERENCIADOR DE CHAVES */}
      {isKeyManagerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div 
            className="bg-white border border-slate-200 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header do Modal */}
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                  <Key className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-base font-bold text-slate-900">Gerenciador de Chaves Rotativas</h3>
                  <p className="text-xs text-slate-500">Adicione chaves Gemini (.txt) para rotação automática e resiliência</p>
                </div>
              </div>
              <button 
                onClick={() => setIsKeyManagerOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal (Scrollable) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {keyManagerError && (
                <div className="p-3 text-xs bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-left">
                  <span className="font-bold">Erro:</span> {keyManagerError}
                </div>
              )}

              {/* Cards de Resumo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total de Chaves</p>
                  <p className="text-2xl font-black text-slate-800 mt-1">{keysStats.total}</p>
                </div>
                <div className="p-4 bg-emerald-50/50 border border-emerald-100/80 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-emerald-600/80 uppercase tracking-wider">Chaves Livres</p>
                  <p className="text-2xl font-black text-emerald-600 mt-1">{keysStats.free}</p>
                </div>
                <div className="p-4 bg-amber-50/50 border border-amber-100/80 rounded-2xl text-center">
                  <p className="text-[10px] font-bold text-amber-600/80 uppercase tracking-wider">Esgotadas (429)</p>
                  <p className="text-2xl font-black text-amber-600 mt-1">{keysStats.exhausted}</p>
                </div>
              </div>

              {/* Área de Upload / Entrada */}
              <div className="p-5 border border-dashed border-slate-200 rounded-2xl hover:border-indigo-400 transition bg-slate-50/30 flex flex-col items-center justify-center text-center gap-3">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-full">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Fazer Upload de arquivo .txt</p>
                  <p className="text-[10px] text-slate-400 mt-1">Carregue um arquivo contendo uma chave Gemini por linha (começando com AIzaSy)</p>
                </div>
                
                <label className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow transition cursor-pointer flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Selecionar Arquivo .txt</span>
                  <input 
                    type="file" 
                    accept=".txt" 
                    onChange={handleKeysFileUpload} 
                    className="hidden"
                    disabled={isUploadingKeys}
                  />
                </label>
              </div>

              {/* Tabela / Lista de Chaves */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest text-left">Lista de Chaves Carregadas</h4>
                
                {keysStats.keysList.length === 0 ? (
                  <div className="py-8 text-center border border-slate-100 rounded-2xl bg-slate-50/20">
                    <Key className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-medium">Nenhuma chave rotativa carregada.</p>
                    <p className="text-[10px] text-slate-400/80 mt-0.5">O sistema usará por padrão a chave contida no arquivo .env.</p>
                  </div>
                ) : (
                  <div className="border border-slate-100 rounded-2xl overflow-hidden bg-white shadow-xs">
                    <div className="max-h-48 overflow-y-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-500">
                            <th className="p-3">Chave</th>
                            <th className="p-3">Status</th>
                            <th className="p-3 text-center">Sucesso</th>
                            <th className="p-3 text-center">Falhas</th>
                            <th className="p-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {keysStats.keysList.map((keyObj, i) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition">
                              <td className="p-3 font-mono text-[11px] text-slate-600">{keyObj.keyMasked}</td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${keyObj.status === 'free' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
                                  {keyObj.status === 'free' ? 'Ativa' : 'Esgotada'}
                                </span>
                              </td>
                              <td className="p-3 text-center text-emerald-600 font-bold">{keyObj.successCount}</td>
                              <td className="p-3 text-center text-rose-500 font-bold">{keyObj.errorCount}</td>
                              <td className="p-3 text-right">
                                <button 
                                  onClick={() => handleRemoveKey(keyObj.keyMasked)}
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

            {/* Rodapé do Modal */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
              <div className="flex gap-2">
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
              </div>
              <button 
                onClick={() => setIsKeyManagerOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
