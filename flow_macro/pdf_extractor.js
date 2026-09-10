// ============================================================================
// FLOW Macro Studio - Extrator e Parser Inteligente de PDFs e Documentos
// ============================================================================
// Este módulo é responsável por:
// 1. Extrair texto puro de arquivos PDF diretamente no navegador (100% offline, sem bibliotecas externas).
// 2. Descomprimir streams FlateDecode nativamente usando a API DecompressionStream do browser.
// 3. Suportar outros formatos de documentos (Word .docx, .txt, .md, .json, .csv).
// 4. Analisar e estruturar roteiros em Carrosséis (Lotes) e Slides com diálogos e prompts de imagem.
// 5. Detectar e catalogar chaves de API de I.A (Gemini, Groq, OpenRouter) coladas pelo usuário.
// ============================================================================
(function () {
  'use strict';

  // Evita erro de redeclaração se o script for reinjetado na mesma aba
  if (typeof window !== 'undefined' && window.FlowPdfExtractor) {
    return;
  }

  class FlowPdfExtractor {
  /**
   * Extrai o texto completo de um arquivo ou buffer de PDF
   * @param {File|ArrayBuffer|Uint8Array} source - Arquivo PDF recebido do input ou drag-and-drop
   * @returns {Promise<{text: string, pages: string[]}>} - Objeto contendo o texto completo e array de páginas
   */
  static async extractText(source) {
    let arrayBuffer;
    // Converte a fonte para ArrayBuffer binário
    if (source instanceof File || source instanceof Blob) {
      arrayBuffer = await source.arrayBuffer();
    } else if (source instanceof Uint8Array) {
      arrayBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    } else {
      arrayBuffer = source;
    }

    const uint8 = new Uint8Array(arrayBuffer);
    const textDecoder = new TextDecoder('latin1');
    const rawPdf = textDecoder.decode(uint8);

    const pages = [];
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let match;

    // Localiza todos os blocos de streams binários no arquivo PDF
    const streamIndices = [];
    let searchPos = 0;
    const streamMarker = new TextEncoder().encode('stream');
    const endstreamMarker = new TextEncoder().encode('endstream');

    while (searchPos < uint8.length) {
      const idx = FlowPdfExtractor.indexOfSubarray(uint8, streamMarker, searchPos);
      if (idx === -1) break;

      // Pula quebra de linha após a palavra-chave 'stream'
      let streamStart = idx + 6;
      if (uint8[streamStart] === 13 && uint8[streamStart + 1] === 10) {
        streamStart += 2;
      } else if (uint8[streamStart] === 10 || uint8[streamStart] === 13) {
        streamStart += 1;
      }

      const endIdx = FlowPdfExtractor.indexOfSubarray(uint8, endstreamMarker, streamStart);
      if (endIdx === -1) break;

      // Ajusta final do stream caso haja \r\n antes de 'endstream'
      let streamEnd = endIdx;
      if (streamEnd > streamStart && uint8[streamEnd - 1] === 10) streamEnd--;
      if (streamEnd > streamStart && uint8[streamEnd - 1] === 13) streamEnd--;

      streamIndices.push({ start: streamStart, end: streamEnd });
      searchPos = endIdx + 9;
    }

    let allExtractedText = [];

    // Processa e descompacta cada stream individualmente
    for (const { start, end } of streamIndices) {
      const chunk = uint8.subarray(start, end);
      let decompressed = null;

      // Tenta descompressão nativa com DecompressionStream('deflate')
      try {
        if (typeof DecompressionStream !== 'undefined') {
          let deflateChunk = chunk;
          const ds = new DecompressionStream('deflate');
          const writer = ds.writable.getWriter();
          const reader = ds.readable.getReader();

          // Envia o chunk para o descompressor
          const writePromise = writer.write(deflateChunk).then(() => writer.close()).catch(() => {});

          const chunks = [];
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              chunks.push(value);
            }
          } catch (readErr) {
            // Ignora erro de header/checksum se o chunk não for deflate
          }

          await writePromise;

          if (chunks.length > 0) {
            let totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
            let merged = new Uint8Array(totalLen);
            let offset = 0;
            for (const c of chunks) {
              merged.set(c, offset);
              offset += c.length;
            }
            decompressed = new TextDecoder('utf-8', { fatal: false }).decode(merged);
          }
        }
      } catch (e) {
        // Fallback: decodifica o stream diretamente caso não esteja comprimido
        try {
          decompressed = textDecoder.decode(chunk);
        } catch (err) {}
      }

      if (decompressed) {
        const streamText = FlowPdfExtractor.parsePdfOperators(decompressed);
        if (streamText && streamText.trim().length > 0) {
          allExtractedText.push(streamText.trim());
        }
      }
    }

    // Fallback 1: Extração direta dos operadores do texto bruto do PDF
    if (allExtractedText.join('\n\n').trim().length < 10) {
      const rawText = FlowPdfExtractor.parsePdfOperators(rawPdf);
      if (rawText.trim().length > 0) {
        allExtractedText.push(rawText.trim());
      }
    }

    // Fallback 2: Regex para strings literais entre parênteses (ex: (Prompt de Imagem))
    if (allExtractedText.join('\n\n').trim().length < 10) {
      const literalStrings = [];
      const strRegex = /\(((?:[^()\\]|\\.)*)\)/g;
      let strMatch;
      while ((strMatch = strRegex.exec(rawPdf)) !== null) {
        const str = FlowPdfExtractor.unescapePdfString(strMatch[1]);
        if (str && str.length > 2 && !str.includes('Font') && !str.includes('PDF')) {
          literalStrings.push(str);
        }
      }
      if (literalStrings.length > 0) {
        allExtractedText.push(literalStrings.join(' '));
      }
    }

    const fullText = allExtractedText.join('\n\n');
    return {
      text: fullText,
      pages: allExtractedText
    };
  }

  /**
   * Localiza a posição de uma sequência de bytes (subarray) dentro de um array binário
   * @param {Uint8Array} haystack - Array onde pesquisar
   * @param {Uint8Array} needle - Sequência de bytes a encontrar
   * @param {number} startIndex - Índice inicial da busca
   * @returns {number} - Posição encontrada ou -1 se não existir
   */
  static indexOfSubarray(haystack, needle, startIndex = 0) {
    const hLen = haystack.length;
    const nLen = needle.length;
    if (nLen === 0) return 0;
    if (hLen < nLen) return -1;

    for (let i = startIndex; i <= hLen - nLen; i++) {
      let found = true;
      for (let j = 0; j < nLen; j++) {
        if (haystack[i + j] !== needle[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    return -1;
  }

  /**
   * Converte sequências de escape do padrão PDF para caracteres normais
   * Ex: \( \) \\ \n \r \t \ooo
   * @param {string} str - String bruta do PDF
   * @returns {string} - String desescapada e legível
   */
  static unescapePdfString(str) {
    if (!str) return '';
    return str
      .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\b/g, '\b')
      .replace(/\\f/g, '\f')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\\\/g, '\\');
  }

  /**
   * Interpreta operadores de texto nativos do padrão PDF (BT, ET, Tj, TJ, ', ")
   * @param {string} streamContent - Conteúdo do stream descompactado
   * @returns {string} - Texto legível reconstruído
   */
  static parsePdfOperators(streamContent) {
    if (!streamContent) return '';
    let result = '';
    
    // Extrai blocos entre BT (Begin Text) e ET (End Text)
    const btBlocks = streamContent.match(/BT[\s\S]*?ET/g) || [streamContent];

    for (const block of btBlocks) {
      let blockText = '';
      
      // Operador TJ (Array de strings e espaçamentos): [(Texto1) -120 (Texto2)] TJ
      const tjArrayRegex = /\[((?:[^\(\]]*|\([^\)]*\))*?)\]\s*TJ/gi;
      let match;
      while ((match = tjArrayRegex.exec(block)) !== null) {
        const inner = match[1];
        const strRegex = /\(([^)]*)\)/g;
        let sMatch;
        let subText = '';
        while ((sMatch = strRegex.exec(inner)) !== null) {
          subText += FlowPdfExtractor.unescapePdfString(sMatch[1]);
        }
        if (subText) blockText += subText + ' ';
      }

      // Operador Tj (String única): (Texto) Tj
      const tjSingleRegex = /\(((?:[^()\\]|\\.)*)\)\s*Tj/gi;
      while ((match = tjSingleRegex.exec(block)) !== null) {
        blockText += FlowPdfExtractor.unescapePdfString(match[1]) + '\n';
      }

      // Operadores de aspas ' ou ": (Texto) '
      const quoteRegex = /\(((?:[^()\\]|\\.)*)\)\s*['"]/gi;
      while ((match = quoteRegex.exec(block)) !== null) {
        blockText += '\n' + FlowPdfExtractor.unescapePdfString(match[1]) + '\n';
      }

      if (blockText.trim()) {
        result += blockText.trim() + '\n\n';
      }
    }

    return result.trim();
  }

  /**
   * Limpa e normaliza o texto do prompt de imagem para envio ao FLOW
   * Remove quebras de linha excessivas e normaliza aspas
   * @param {string} str - Texto bruto do prompt
   * @returns {string} - Prompt limpo em linha única
   */
  static cleanPrompt(str) {
    if (!str || typeof str !== 'string') return '';
    return str
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[\u2018\u2019]/g, "'") // Aspas simples curvas para retas
      .replace(/[\u201C\u201D]/g, '"') // Aspas duplas curvas para retas
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join(' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  /**
   * Converte ocorrências isoladas de PT para PT-BR nos prompts e balões, preservando quando já for PT-BR, pt-br ou ptbr
   * @param {string} str - Texto a normalizar
   * @returns {string} - Texto com PT-BR
   */
  static normalizeLanguageTags(str) {
    if (!str || typeof str !== 'string') return '';
    return str.replace(/\bPT\b(?!\s*[-_]?\s*BR\b)/gi, 'PT-BR');
  }

  /**
   * Analisa um roteiro completo e o divide estruturadamente em Carrosséis (Lotes) com seus respectivos Slides
   * Suporta:
   * - Identificação de "CARROSSEL 1", "CARROSSEL 2", "LOTE 1", "POST 1"
   * - Identificação de "SLIDE 1", "CENA 1", "QUADRO 1"
   * - Extração de "Texto nos Balões: PT: ..." e "Prompt de Imagem: ..."
   * - Captura de Estilo/Nicho e Legendas do Instagram
   * @param {string} rawText - Texto bruto do roteiro
   * @param {string[]} pages - Páginas extraídas do PDF (opcional)
   * @returns {Array<Object>} - Lista de objetos de carrosséis estruturados
   */
  static parseCarouselsFromScript(rawText, pages = []) {
    if (!rawText || !rawText.trim()) return [];
    let text = rawText.replace(/\r\n/g, '\n').trim();

    // 1. Remove footers de páginas do PDF (ex: "Página 1 de 30 • PostForge AI Carousel Generator")
    text = text.replace(/(?:Página|Pagina|Page)\s*\d+\s*(?:de|\/|of)\s*\d+[^\n]*/gi, '');
    text = text.replace(/PostForge\s+AI\s+Carousel\s+Generator[^\n]*/gi, '');

    // 2. Remove cabeçalhos de lote repetidos no topo das páginas (ex: "POSTFORGE LOTE DE 15 CARROSSÉIS")
    text = text.replace(/POSTFORGE\s+LOTE\s+DE\s+\d+\s+CARROSS[EÉ]IS[^\n]*/gi, '');

    // 3. Localiza o primeiro carrossel e remove qualquer preâmbulo anterior
    const firstCarouselIdx = text.search(/(?:^|\n)(?:CARROSSEL|CAROUSEL)\s*#?\s*\d+/i);
    if (firstCarouselIdx !== -1) {
      text = text.substring(firstCarouselIdx).trim();
    }

    // 4. Divide o texto em blocos de carrosséis individuais
    const carouselHeaderRegex = /(?:^|\n)(?=(?:CARROSSEL|CAROUSEL)\s*#?\s*\d+)/i;
    const hasMultipleCarousels = carouselHeaderRegex.test(text);

    let rawCarousels = [];
    if (hasMultipleCarousels) {
      rawCarousels = text.split(carouselHeaderRegex).map(c => c.trim()).filter(c => c.length > 20);
    } else {
      // Fallback para outros padrões de lote caso não use a palavra "CARROSSEL"
      const altHeaderRegex = /(?:^|\n)(?=(?:LOTE|POST)\s*#?\s*\d+(?!\s+DE\s+\d+))/i;
      if (altHeaderRegex.test(text)) {
        rawCarousels = text.split(altHeaderRegex).map(c => c.trim()).filter(c => c.length > 20);
      } else {
        rawCarousels = [text];
      }
    }

    const carousels = [];

    rawCarousels.forEach((cText, cIdx) => {
      let title = `Carrossel ${cIdx + 1}`;
      let styleInfo = '';
      let caption = '';

      // Extrai título do carrossel (ex: "CARROSSEL 1: VULNERABILIDADE E CURA")
      const cTitleMatch = cText.match(/^(?:CARROSSEL|CAROUSEL|LOTE|POST)\s*#?\s*\d+[^\n]*/i);
      if (cTitleMatch) {
        title = cTitleMatch[0].trim();
      }

      // Extrai informações de Estilo / Nicho / Idioma
      const styleMatch = cText.match(/(?:Nicho|Niche|Estilo|Style|Idioma)\s*:\s*[^\n]+/i);
      if (styleMatch) {
        const fullMetaLine = cText.match(/^(?:Nicho[^\n]+|Estilo[^\n]+)/im);
        styleInfo = fullMetaLine ? fullMetaLine[0].trim() : styleMatch[0].trim();
      }

      // Extrai Legenda do Instagram completa (incluindo hashtags até o fim do carrossel)
      const captionMatch = cText.match(/(?:LEGENDA\s+DO\s+INSTAGRAM|LEGENDA\s+INSTAGRAM|LEGENDA|CAPTION)\s*[\:\n]([\s\S]*?)(?=(?:\n\s*(?:CARROSSEL|CAROUSEL)\s*#?\s*\d+|$))/i);
      if (captionMatch) {
        caption = captionMatch[1].trim();
      }

      // Isola o corpo dos slides removendo cabeçalhos e legenda do carrossel
      let slidesBody = cText;
      if (cTitleMatch) slidesBody = slidesBody.replace(cTitleMatch[0], '');
      if (styleInfo) slidesBody = slidesBody.replace(styleInfo, '');
      if (captionMatch) slidesBody = slidesBody.replace(captionMatch[0], '');

      // Divide os slides dentro deste carrossel (apenas SLIDE, CENA, SCENE, QUADRO, PAINEL)
      // NOTA: PÁGINA e PAGE NÃO são slides e foram removidos do regex!
      const slideSplitRegex = /(?:^|\n)(?=(?:SLIDE|CENA|SCENE|QUADRO|PAINEL)\s*#?\s*\d+)/i;
      let slideBlocks = [];
      if (slideSplitRegex.test(slidesBody)) {
        slideBlocks = slidesBody.split(slideSplitRegex).map(s => s.trim()).filter(s => s.length > 15);
      } else {
        const balloonSplitRegex = /(?:^|\n)(?=(?:Texto\s+(?:nos?\s+)?Bal(?:ão|ões)|Bal(?:ão|ões)|Diálogo|Dialogue|FALA\s+NO\s+BALÃO)\s*[\:\n])/i;
        if (balloonSplitRegex.test(slidesBody)) {
          slideBlocks = slidesBody.split(balloonSplitRegex).map(s => s.trim()).filter(s => s.length > 15);
        } else {
          slideBlocks = [slidesBody];
        }
      }

      // Constrói os objetos de cada slide
      const slides = slideBlocks.map((block, sIdx) => {
        let slideTitle = `Slide ${sIdx + 1}`;
        const titleMatch = block.match(/^(?:(?:SLIDE|CENA|SCENE|QUADRO|PAINEL)\s*#?\s*\d+[^\n]*)/i);
        if (titleMatch) {
          slideTitle = titleMatch[0].replace(/\s*Slide\s+Completo\b/i, '').trim();
        }

        // Extrai texto dos balões em Português
        let ptDialogue = '';
        let balloonText = '';
        const balloonMatch = block.match(/(?:FALA\s+NO\s+BALÃO\s+DE\s+DIÁLOGO|Texto\s+(?:nos?\s+)?Bal(?:ão|ões)|Bal(?:ão|ões)|Diálogo|Dialogue)\s*[\:\n]([\s\S]*?)(?=(?:PROMPT\s+DE\s+IMAGEM|Prompt\s+de\s+Imagem|Image\s+Prompt|Visual\s+Prompt|$))/i);
        if (balloonMatch) {
          balloonText = balloonMatch[1].trim();
          const ptMatch = balloonText.match(/PT\s*:\s*["“]?([^"”\n\r]+)["”]?/i) || balloonText.match(/["“]([^"”]+)["”]/);
          if (ptMatch) {
            ptDialogue = ptMatch[1].trim();
          } else {
            ptDialogue = balloonText.split('\n')[0].replace(/^(?:PT|BR|Texto|Fala)\s*:\s*/i, '').trim();
          }
          ptDialogue = ptDialogue.replace(/^["“'”]+|["“'”]+$/g, '').trim();
        }

        // Extrai prompt de imagem (descrição visual)
        let imagePrompt = '';
        const promptMatch = block.match(/(?:PROMPT\s+DE\s+IMAGEM[^\n\:]*|Prompt\s+de\s+Imagem[^\n\:]*|Image\s+Prompt|Visual\s+Prompt)\s*[\:\n]\s*([\s\S]*?)(?=(?:LEGENDA|$))/i);
        if (promptMatch) {
          imagePrompt = promptMatch[1].trim();
        } else {
          imagePrompt = block
            .replace(titleMatch ? titleMatch[0] : '', '')
            .replace(balloonMatch ? balloonMatch[0] : '', '')
            .replace(/CONTEÚDO\s+DO\s+SLIDE[^\n]*\n?/gi, '')
            .trim();
        }

        // Limpa espaços no prompt de imagem e normaliza tags de idioma
        imagePrompt = FlowPdfExtractor.normalizeLanguageTags(FlowPdfExtractor.cleanPrompt(imagePrompt));
        if (ptDialogue) {
          ptDialogue = FlowPdfExtractor.normalizeLanguageTags(ptDialogue);
        }

        // Formata o prompt completo correspondendo à estrutura padrão do FLOW com PT-BR
        let fullFormattedText = '';
        if (ptDialogue) {
          fullFormattedText = `Texto nos balões:\nPT-BR: "${ptDialogue}"\n\nPrompt de Imagem (Midjourney / Dall-E):\n${imagePrompt}`;
        } else {
          fullFormattedText = FlowPdfExtractor.normalizeLanguageTags(imagePrompt || block);
        }

        return {
          id: `slide_${cIdx + 1}_${sIdx + 1}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          index: sIdx + 1,
          globalIndex: 0, // Será atribuído após o loop
          carouselIndex: cIdx + 1,
          carouselTitle: title,
          title: `${title} • ${slideTitle}`,
          slideTitle: slideTitle,
          balloonText: balloonText,
          ptDialogue: ptDialogue,
          imagePrompt: imagePrompt,
          fullText: fullFormattedText,
          enabled: true,
          repeatCount: 1,
          completedRepeats: 0,
          status: 'pending',
          errorMsg: ''
        };
      }).filter(s => (s.imagePrompt && s.imagePrompt.length > 10) || (s.ptDialogue && s.ptDialogue.length > 3));

      carousels.push({
        id: `carousel_${cIdx + 1}`,
        index: cIdx + 1,
        title: title,
        styleInfo: styleInfo,
        caption: caption,
        slidesCount: slides.length,
        slides: slides,
        enabled: true,
        status: 'pending'
      });
    });

    // Atribui índices globais contínuos para todos os slides de todos os carrosséis
    let gIdx = 1;
    carousels.forEach(c => {
      c.slides.forEach(s => {
        s.globalIndex = gIdx++;
      });
    });

    return carousels;
  }

  /**
   * Converte o roteiro em uma lista plana (flat) de todos os prompts de slides
   * @param {string} rawText - Texto bruto
   * @param {string[]} pages - Páginas do PDF
   * @returns {Array<Object>} - Lista plana de slides prontos para execução
   */
  static parsePromptsFromScript(rawText, pages = []) {
    const carousels = FlowPdfExtractor.parseCarouselsFromScript(rawText, pages);
    const flatPrompts = [];
    carousels.forEach(c => {
      c.slides.forEach(s => flatPrompts.push(s));
    });
    return flatPrompts;
  }

  /**
   * Cria um item de prompt a partir de um bloco de texto individual
   * @param {string} blockText - Texto do bloco
   * @param {number} index - Posição do slide
   * @returns {Object|null} - Item de prompt formatado
   */
  static createPromptItemFromBlock(blockText, index) {
    if (!blockText || blockText.trim().length === 0) return null;

    let title = `Slide #${index}`;
    let balloonText = '';
    let imagePrompt = '';
    let rawCleaned = blockText.trim();

    // 1. Extrai título do slide ou cena (ex: "Slide 1", "Cena 2")
    const titleMatch = rawCleaned.match(/^(?:(?:Slide|Cena|Scene|Quadro|Painel|Prompt|Item)\s*#?\s*\d+[^\n]*)/i);
    if (titleMatch) {
      title = titleMatch[0].replace(/\s*Slide\s+Completo\b/i, '').trim();
    }

    // 2. Extrai texto dos balões
    const balloonHeaderRegex = /(?:FALA\s+NO\s+BALÃO\s+DE\s+DIÁLOGO|Texto\s+(?:nos?\s+)?Bal(?:ão|ões)|Bal(?:ão|ões)|Diálogo|Dialogue)\s*[\:\n]([\s\S]*?)(?=(?:PROMPT\s+DE\s+IMAGEM|Prompt\s+de\s+Imagem[^\n\:]*|Image\s+Prompt|Visual\s+Prompt|Prompt\s*[\:\n]|$))/i;
    const balloonMatch = rawCleaned.match(balloonHeaderRegex);
    if (balloonMatch) {
      balloonText = balloonMatch[1].trim();
    }

    // 3. Extrai prompt de imagem
    const promptHeaderRegex = /(?:Prompt\s+de\s+Imagem[^\n\:]*|Image\s+Prompt|Visual\s+Prompt|Prompt)\s*[\:\n]\s*([\s\S]*)$/i;
    const promptMatch = rawCleaned.match(promptHeaderRegex);
    if (promptMatch) {
      imagePrompt = promptMatch[1].trim();
    } else {
      if (balloonMatch) {
        imagePrompt = rawCleaned.replace(balloonMatch[0], '').replace(titleMatch ? titleMatch[0] : '', '').trim();
      } else {
        imagePrompt = rawCleaned.replace(titleMatch ? titleMatch[0] : '', '').trim();
      }
    }

    // 4. Extrai fala em português
    let ptDialogue = '';
    if (balloonText) {
      const ptMatch = balloonText.match(/PT\s*:\s*["“]?([^"”\n\r]+)["”]?/i) || balloonText.match(/["“]([^"”]+)["”]/);
      if (ptMatch) {
        ptDialogue = ptMatch[1].trim();
      } else {
        ptDialogue = balloonText.split('\n')[0].replace(/^(?:PT|BR|Texto|Fala)\s*:\s*/i, '').trim();
      }
    }

    // 5. Monta o prompt composto completo
    imagePrompt = FlowPdfExtractor.normalizeLanguageTags(FlowPdfExtractor.cleanPrompt(imagePrompt));

    let fullFormattedText = '';
    if (ptDialogue) {
      ptDialogue = FlowPdfExtractor.normalizeLanguageTags(ptDialogue.replace(/^["“'”]+|["“'”]+$/g, '').trim());
      fullFormattedText = `Texto nos balões:\nPT-BR: "${ptDialogue}"\n\nPrompt de Imagem (Midjourney / Dall-E):\n${imagePrompt}`;
    } else {
      fullFormattedText = FlowPdfExtractor.normalizeLanguageTags(imagePrompt || rawCleaned);
    }

    if (title === `Slide #${index}` && ptDialogue) {
      const shortSnippet = ptDialogue.length > 35 ? ptDialogue.substring(0, 35) + '...' : ptDialogue;
      title = `Slide #${index} - "${shortSnippet}"`;
    }

    return {
      id: `prompt_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 7)}`,
      index: index,
      title: title,
      balloonText: balloonText,
      ptDialogue: ptDialogue,
      imagePrompt: imagePrompt,
      fullText: fullFormattedText,
      enabled: true,
      repeatCount: 1,
      completedRepeats: 0,
      status: 'pending',
      errorMsg: '',
      characters: []
    };
  }

  /**
   * Extrator Universal de texto compatível com PDF, DOCX, TXT, MD, JSON e CSV
   * @param {File} file - Arquivo enviado pelo usuário
   * @returns {Promise<string>} - Texto extraído do arquivo
   */
  static async extractTextFromAnyDocument(file) {
    if (!file) return '';

    const name = (file.name || '').toLowerCase();

    // 1. Arquivos de texto puro / Markdown / JSON / CSV
    if (name.endsWith('.txt') || name.endsWith('.md') || name.endsWith('.json') || name.endsWith('.csv') || name.endsWith('.rtf') || file.type?.startsWith('text/')) {
      return await file.text();
    }

    // 2. Arquivos PDF
    if (name.endsWith('.pdf') || file.type === 'application/pdf') {
      const res = await FlowPdfExtractor.extractText(file);
      return res.text || '';
    }

    // 3. Documentos do Microsoft Word (.docx)
    if (name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      return await FlowPdfExtractor.extractTextFromDocx(file);
    }

    // Fallback padrão: leitura como texto
    try {
      return await file.text();
    } catch (e) {
      return '';
    }
  }

  /**
   * Extrator leve em Javascript puro para arquivos DOCX (OpenXML)
   * @param {File} file - Arquivo .docx
   * @returns {Promise<string>} - Texto contido nas tags <w:t> do XML
   */
  static async extractTextFromDocx(file) {
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      const decoder = new TextDecoder('utf-8', { fatal: false });
      const rawText = decoder.decode(bytes);

      const textChunks = [];
      const wtRegex = /<w:t(?:\s[^>]*)?>([^<]+)<\/w:t>/g;
      let match;
      while ((match = wtRegex.exec(rawText)) !== null) {
        if (match[1]) textChunks.push(match[1]);
      }

      if (textChunks.length > 0) {
        return textChunks.join('\n');
      }

      return '';
    } catch (e) {
      console.warn('[FLOW Extractor] extractTextFromDocx warning:', e);
      return '';
    }
  }

  /**
   * Identifica e cataloga chaves de API de Inteligência Artificial inseridas pelo usuário
   * Suporta Google Gemini, Groq e OpenRouter
   * @param {string} rawText - Texto contendo as chaves coladas (uma por linha ou com prefixo)
   * @returns {Array<Object>} - Lista de objetos de chaves de IA formatadas com provedor e modelo
   */
  static parseAIKeysFromText(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];

    const lines = rawText.split(/[\r\n;,]+/);
    const keys = [];
    const seen = new Set();

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      // Detecta dicas de provedor no prefixo (ex: "gemini: AIza...", "groq: gsk_...")
      let providerHint = '';
      if (/^gemini[:=\s]/i.test(line)) {
        providerHint = 'gemini';
        line = line.replace(/^gemini[:=\s]+/i, '').trim();
      } else if (/^groq[:=\s]/i.test(line)) {
        providerHint = 'groq';
        line = line.replace(/^groq[:=\s]+/i, '').trim();
      } else if (/^openrouter[:=\s]/i.test(line)) {
        providerHint = 'openrouter';
        line = line.replace(/^openrouter[:=\s]+/i, '').trim();
      }

      // Remove aspas ou crases envolventes
      line = line.replace(/^["'`]+|["'`]+$/g, '').trim();

      // Extrai o token da chave
      const keyToken = (line.match(/[A-Za-z0-9_-]{20,}/) || [])[0] || line;

      if (!keyToken || keyToken.length < 15 || seen.has(keyToken)) continue;
      seen.add(keyToken);

      // Auto-identifica o provedor de IA pelo prefixo característico da chave
      let provider = providerHint;
      let model = 'gemini-2.5-flash';

      if (!provider) {
        if (keyToken.startsWith('gsk_')) {
          provider = 'groq';
          model = 'llama-3.3-70b-versatile';
        } else if (keyToken.startsWith('AIzaSy') || keyToken.startsWith('AIza')) {
          provider = 'gemini';
          model = 'gemini-2.5-flash';
        } else if (keyToken.startsWith('sk-or-v1-') || keyToken.startsWith('sk-or-')) {
          provider = 'openrouter';
          model = 'meta-llama/llama-3.2-3b-instruct:free';
        } else if (keyToken.startsWith('sk-')) {
          provider = 'openrouter';
          model = 'meta-llama/llama-3.2-3b-instruct:free';
        } else {
          provider = 'gemini';
          model = 'gemini-2.5-flash';
        }
      } else {
        if (provider === 'groq') model = 'llama-3.3-70b-versatile';
        else if (provider === 'openrouter') model = 'meta-llama/llama-3.2-3b-instruct:free';
        else model = 'gemini-2.5-flash';
      }

      keys.push({
        id: `ai_key_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        key: keyToken,
        provider: provider,
        model: model,
        status: 'active', // Estados: 'active' | 'exhausted' | 'valid' | 'error'
        label: `${provider.toUpperCase()} (${keyToken.substring(0, 7)}...${keyToken.slice(-4)})`,
        enabled: true,
        errorCount: 0,
        lastUsed: null
      });
    }

    return keys;
  }
}

  // Torna o extrator disponível globalmente no escopo do navegador
  if (typeof window !== 'undefined') {
    window.FlowPdfExtractor = FlowPdfExtractor;
  }
})();

var FlowPdfExtractor = (typeof window !== 'undefined') ? window.FlowPdfExtractor : undefined;
