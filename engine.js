/**
 * engine.js — Premium Kinetic Typography & Lyric Video Animation Engine
 * 
 * Capabilities:
 * 1. High-precision Easing functions (Expo, Back, Spring, Apple-smooth, etc.)
 * 2. LyricToken & Smart Timing Engine:
 *    - Auto-distribution with natural speech rhythms
 *    - Robust multi-format timestamp parser (e.g. `0.1 word`, `[0.1] word`, `0.1: word`, `0.1s word`)
 *    - Inline markup parser: `<red>word</red>`, `<green>word</green>`, `<color:#hex>word</color>`, `*word*`, `_word_`
 *    - Per-token custom colors & 2-color top/bottom vertical blend gradients
 *    - Per-token hold bonus (stay longer on screen)
 *    - Per-token motion style override (multi-motion in one video)
 * 3. Text Effects:
 *    - 2-Color Blend Gradients (Top-side & Bottom-side different colors)
 *    - Text Stroke / Outline (Hormozi / viral reel style)
 *    - Text Drop Shadow (configurable color, blur, offset)
 *    - Subtitle Background Box / Pill (rounded rect with custom opacity & padding)
 * 4. Background Renderer:
 *    - Video Background Upload (with timeline scrubbing & frame-by-frame export sync)
 *    - Image Background Upload
 *    - Video Dimming / Tint overlay
 *    - Cream, Off-white, Dark, Gradient, procedural grain & vignette
 * 5. Layout & Subtitle Placement:
 *    - Vertical Alignment: 'center' (50%), 'bottom' (82% Subtitles), 'top' (20%)
 *    - Manual Y-Offset and X-Offset controls
 * 6. Visual Styles & Multi-Motion Remix:
 *    - multiMotion: Automatically mixes 3+ kinetic motions across words
 *    - perspective3d: 3D Perspective with strict 3-word max, older words blur & disappear
 *    - kineticScroll: Dynamic Kinetic Scroll (Heavy grotesque bold text, green & red accents, upward scroll)
 *    - 6 Distinct One-Word Styles:
 *        * oneWord_slideUpBlur: Apple-style slide up + blur in, slide up + blur out
 *        * oneWord_scalePop: Spring bounce pop-in, hold, smooth scale dissolve
 *        * oneWord_depthZoom: Fly in from deep 3D z-space, hold, fly past camera
 *        * oneWord_horizontalDrift: Lateral slide with motion blur, snap center, exit left
 *        * oneWord_dropBounce: Drop from top with gravity acceleration and damped bounce
 *        * oneWord_punchExpand: Instant hard cut with smooth tracking expansion
 *    - lineStack: Clean minimalist editorial line reveal
 * 7. FrameRenderer: High-DPI canvas composition engine
 * 8. Deterministic WebMWriter: Pure JS frame-by-frame WebM video encoder with exact millisecond duration
 */

// ============================================================
//  1. EASING FUNCTIONS
// ============================================================
const Easing = {
  linear: t => t,
  easeOutCubic: t => 1 - Math.pow(1 - t, 3),
  easeOutExpo: t => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeOutQuint: t => 1 - Math.pow(1 - t, 5),
  easeInOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeInOutQuart: t => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  easeOutBack: (t, s = 1.70158) => {
    const s1 = s + 1;
    return 1 + s1 * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
  },
  spring: (t, damping = 6, frequency = 4.5) => {
    if (t === 0) return 0;
    if (t === 1) return 1;
    return 1 - Math.cos(t * frequency * Math.PI) * Math.exp(-t * damping);
  },
  cinematic: t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  appleSmooth: t => 1 - Math.pow(1 - t, 3.8)
};

// ============================================================
//  2. LYRIC TOKEN & TIMING ENGINE
// ============================================================
let _tokenIdCounter = 0;

class LyricToken {
  constructor(text, startTime, endTime, options = {}) {
    this.id = ++_tokenIdCounter;
    this.text = text;
    this.startTime = Math.max(0, startTime);
    this.endTime = Math.max(this.startTime + 0.08, endTime);
    this.color = options.color || null; // Can be string '#fff' or object { top: '#ff9bb2', bottom: '#ffffff' }
    this.emphasis = options.emphasis || 'normal'; // 'normal' | 'keyword' | 'cta' | 'hero' | 'custom'
    this.lineIndex = options.lineIndex || 0;
    this.wordIndex = options.wordIndex || 0;
    this.size = options.size || null;
    this.weight = options.weight || null;
    this.rotation = options.rotation || 0;
    this.italic = options.italic || false;
    this.letterSpacing = options.letterSpacing || 0;

    // Per-word customization:
    this.holdBonus = options.holdBonus || 0; // Extra seconds to stay on screen
    this.styleOverride = options.styleOverride || null; // E.g. 'oneWord_scalePop', 'oneWord_depthZoom'
  }

  getEffectiveEndTime() {
    return this.endTime + (this.holdBonus || 0);
  }
}

const TimingEngine = {
  parseWordMarkup(rawWord) {
    let text = rawWord.trim();
    let color = null;
    let emphasis = 'normal';
    let italic = false;

    // 1. Check <red>...</red>
    const redMatch = text.match(/^<red>(.*?)<\/red>$/i);
    if (redMatch) return { text: redMatch[1], color: '#e63946', emphasis: 'cta', italic: false };

    // 2. Check <green>...</green>
    const greenMatch = text.match(/^<green>(.*?)<\/green>$/i);
    if (greenMatch) return { text: greenMatch[1], color: '#00e600', emphasis: 'keyword', italic: true };

    // 3. Check <color:#hex>...</color>
    const customMatch = text.match(/^<color:(#[0-9a-fA-F]{3,8})>(.*?)<\/color>$/i);
    if (customMatch) return { text: customMatch[2], color: customMatch[1], emphasis: 'custom', italic: false };

    // 4. Check *word* -> red CTA
    if (text.startsWith('*') && text.endsWith('*') && text.length > 2) {
      return { text: text.slice(1, -1), color: '#e63946', emphasis: 'cta', italic: false };
    }

    // 5. Check _word_ -> green Keyword
    if (text.startsWith('_') && text.endsWith('_') && text.length > 2) {
      return { text: text.slice(1, -1), color: '#00e600', emphasis: 'keyword', italic: true };
    }

    // 6. Keywords
    const cleanLower = text.toLowerCase().replace(/[^a-z]/g, '');
    if (['want', 'then', 'trending', 'contents', 'challenging'].includes(cleanLower)) {
      emphasis = 'keyword';
      color = '#00e600';
      italic = true;
    } else if (['subscribe', 'subscribed', 'motion', 'graphics', 'friday', 'coming'].includes(cleanLower)) {
      emphasis = 'cta';
      color = '#e63946';
    } else if (text === text.toUpperCase() && text.length >= 3 && !/[0-9.,!?;:]/.test(text)) {
      emphasis = 'hero';
    }

    return { text, color, emphasis, italic };
  },

  autoDistribute(lyricsText, totalDuration, style = 'normal') {
    const rawLines = lyricsText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (rawLines.length === 0) return [];

    const allWords = [];
    let globalIdx = 0;

    for (let l = 0; l < rawLines.length; l++) {
      const line = rawLines[l];
      const rawWords = line.split(/\s+/).filter(w => w.length > 0);

      for (let w = 0; w < rawWords.length; w++) {
        const parsed = this.parseWordMarkup(rawWords[w]);

        let weightFactor = 1.0;
        if (/[.!?]$/.test(parsed.text)) weightFactor += 0.8;
        else if (/[,;:]$/.test(parsed.text)) weightFactor += 0.4;
        if (w === rawWords.length - 1 && l < rawLines.length - 1) weightFactor += 0.6;

        const speedMult = { fast: 0.65, normal: 1.0, slow: 1.5, natural: 1.1, beat: 0.85 }[style] || 1.0;
        weightFactor *= speedMult;

        allWords.push({
          text: parsed.text,
          lineIndex: l,
          wordIndex: globalIdx++,
          weight: weightFactor,
          emphasis: parsed.emphasis,
          color: parsed.color,
          italic: parsed.italic
        });
      }
    }

    if (allWords.length === 0) return [];

    const totalWeight = allWords.reduce((sum, item) => sum + item.weight, 0);
    const startPadding = Math.min(0.2, totalDuration * 0.025);
    const endPadding = Math.min(0.4, totalDuration * 0.04);
    const usableTime = Math.max(0.5, totalDuration - startPadding - endPadding);

    let currentTime = startPadding;
    const tokens = [];

    for (let i = 0; i < allWords.length; i++) {
      const w = allWords[i];
      const slotDuration = (w.weight / totalWeight) * usableTime;
      const holdTime = slotDuration * 0.9;

      tokens.push(new LyricToken(w.text, currentTime, currentTime + holdTime, {
        lineIndex: w.lineIndex,
        wordIndex: w.wordIndex,
        emphasis: w.emphasis,
        color: w.color,
        italic: w.italic
      }));

      currentTime += slotDuration;
    }

    return tokens;
  },

  parseTimedInput(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const entries = [];

    for (const line of lines) {
      // 1. LRC [mm:ss.xx]
      const lrcMatch = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/);
      if (lrcMatch && lrcMatch[3].trim()) {
        const time = parseInt(lrcMatch[1], 10) * 60 + parseFloat(lrcMatch[2]);
        entries.push({ time, text: lrcMatch[3].trim() });
        continue;
      }

      // 2. Bracketed [0.1]
      const bracketMatch = line.match(/^\[(\d+(?:\.\d+)?)\s*s?\]\s*(.*)/);
      if (bracketMatch && bracketMatch[2].trim()) {
        const time = parseFloat(bracketMatch[1]);
        entries.push({ time, text: bracketMatch[2].trim() });
        continue;
      }

      // 3. Range 0.1 - 0.5 text
      const rangeMatch = line.match(/^(\d+(?:\.\d+)?)\s*s?\s*[-–—:]\s*(?:\d+(?:\.\d+)?\s*s?\s*)?[-–—:|]?\s*(.*)/);
      if (rangeMatch && rangeMatch[2].trim()) {
        const time = parseFloat(rangeMatch[1]);
        entries.push({ time, text: rangeMatch[2].trim() });
        continue;
      }

      // 4. Direct 0.1 Word
      const directMatch = line.match(/^(\d+(?:\.\d+)?)\s*s?\s*[:|]?\s+(.*)/);
      if (directMatch && directMatch[2].trim()) {
        const time = parseFloat(directMatch[1]);
        entries.push({ time, text: directMatch[2].trim() });
        continue;
      }
    }

    const tokens = [];
    for (let i = 0; i < entries.length; i++) {
      const cur = entries[i];
      const nextTime = i < entries.length - 1 ? entries[i + 1].time : cur.time + 1.8;
      const parsed = this.parseWordMarkup(cur.text);

      tokens.push(new LyricToken(parsed.text, cur.time, nextTime, {
        wordIndex: i,
        color: parsed.color,
        emphasis: parsed.emphasis,
        italic: parsed.italic
      }));
    }
    return tokens;
  },

  splitWords(text, interval = 0.4) {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return words.map((w, i) => {
      const parsed = this.parseWordMarkup(w);
      return new LyricToken(parsed.text, i * interval, (i + 1) * interval, {
        wordIndex: i,
        emphasis: parsed.emphasis,
        color: parsed.color,
        italic: parsed.italic
      });
    });
  }
};

// ============================================================
//  3. BACKGROUND RENDERER
// ============================================================
let _cachedNoisePattern = null;

function _getNoisePattern() {
  if (_cachedNoisePattern) return _cachedNoisePattern;
  const cvs = document.createElement('canvas');
  cvs.width = 256;
  cvs.height = 256;
  const ctx = cvs.getContext('2d');
  const imgData = ctx.createImageData(256, 256);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const val = Math.floor(Math.random() * 255);
    data[i] = val;
    data[i + 1] = val;
    data[i + 2] = val;
    data[i + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  _cachedNoisePattern = cvs;
  return _cachedNoisePattern;
}

const BackgroundRenderer = {
  render(ctx, width, height, settings = {}) {
    const video = settings.videoElement;
    const image = settings.imageElement;

    if (video && video.readyState >= 2) {
      this._drawImageCover(ctx, video, width, height);
      const dim = typeof settings.overlayDim === 'number' ? settings.overlayDim : 0.35;
      if (dim > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${dim})`;
        ctx.fillRect(0, 0, width, height);
      }
      return;
    }

    if (image && image.complete && image.naturalWidth > 0) {
      this._drawImageCover(ctx, image, width, height);
      const dim = typeof settings.overlayDim === 'number' ? settings.overlayDim : 0.3;
      if (dim > 0) {
        ctx.fillStyle = `rgba(0, 0, 0, ${dim})`;
        ctx.fillRect(0, 0, width, height);
      }
      return;
    }

    const type = settings.type || 'cream';
    const c1 = settings.color1 || '#fdf6e3';
    const c2 = settings.color2 || '#faf3e0';

    if (type === 'cream') {
      ctx.fillStyle = '#fdf6e3';
      ctx.fillRect(0, 0, width, height);
    } else if (type === 'offwhite') {
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(0, 0, width, height);
    } else if (type === 'dark') {
      ctx.fillStyle = '#0f0f12';
      ctx.fillRect(0, 0, width, height);
    } else if (type === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, width * 0.2, height);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else if (type === 'radial') {
      const grad = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) * 0.7);
      grad.addColorStop(0, c1);
      grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    } else {
      ctx.fillStyle = c1;
      ctx.fillRect(0, 0, width, height);
    }

    if (settings.grain && settings.grain > 0) {
      const pat = _getNoisePattern();
      ctx.save();
      ctx.globalAlpha = Math.min(0.12, settings.grain * 0.08);
      ctx.globalCompositeOperation = 'overlay';
      for (let y = 0; y < height; y += pat.height) {
        for (let x = 0; x < width; x += pat.width) {
          ctx.drawImage(pat, x, y);
        }
      }
      ctx.restore();
    }

    if (settings.vignette && settings.vignette > 0) {
      const rad = ctx.createRadialGradient(
        width / 2, height / 2, Math.min(width, height) * 0.25,
        width / 2, height / 2, Math.max(width, height) * 0.75
      );
      rad.addColorStop(0, 'rgba(0,0,0,0)');
      rad.addColorStop(1, `rgba(0,0,0,${settings.vignette * 0.4})`);
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, width, height);
    }
  },

  _drawImageCover(ctx, media, targetW, targetH) {
    const mw = media.videoWidth || media.naturalWidth || targetW;
    const mh = media.videoHeight || media.naturalHeight || targetH;

    const mediaRatio = mw / mh;
    const targetRatio = targetW / targetH;

    let sx = 0, sy = 0, sw = mw, sh = mh;

    if (mediaRatio > targetRatio) {
      sw = mh * targetRatio;
      sx = (mw - sw) / 2;
    } else {
      sh = mw / targetRatio;
      sy = (mh - sh) / 2;
    }

    ctx.drawImage(media, sx, sy, sw, sh, 0, 0, targetW, targetH);
  }
};

// ============================================================
//  4. POSITION HELPER
// ============================================================
function getBaseCoordinates(W, H, settings = {}) {
  let baseY = H * 0.5;

  if (settings.verticalAlign === 'bottom') {
    baseY = H * 0.82; // Subtitles / Lower third
  } else if (settings.verticalAlign === 'top') {
    baseY = H * 0.22; // Header
  }

  const cy = baseY + (settings.yOffset || 0);
  const cx = W * 0.5 + (settings.xOffset || 0);

  return { cx, cy };
}

// ============================================================
//  5. ANIMATION STYLES
// ============================================================

// Style 1: 3D Perspective (Clean 3-word max)
class Perspective3DStyle {
  getState(token, currentTime, allTokens, W, H, settings) {
    const pastTokens = allTokens
      .filter(t => t.startTime <= currentTime)
      .sort((a, b) => b.startTime - a.startTime);

    const age = pastTokens.indexOf(token);
    if (age === -1 || age > 3) return { visible: false };

    const timeSinceStart = currentTime - token.startTime;
    const entryDuration = 0.42;
    const entryT = Math.min(1, Math.max(0, timeSinceStart / entryDuration));
    const easeEntry = Easing.easeOutExpo(entryT);

    const { cx, cy } = getBaseCoordinates(W, H, settings);
    const baseFontSize = settings.font.size || 86;

    let x = cx;
    let y = cy;
    let scale = 1.0;
    let rotation = 0;
    let opacity = 1.0;
    let blur = 0;

    if (age === 0) {
      scale = 0.35 + 0.65 * easeEntry;
      y = cy + (1 - easeEntry) * H * 0.16;
      x = cx + (token.id % 2 === 0 ? 1 : -1) * (1 - easeEntry) * W * 0.12;
      rotation = (token.id % 2 === 0 ? 3 : -3) * (1 - easeEntry);
      opacity = easeEntry;
      blur = (1 - easeEntry) * 8;
    } else if (age === 1) {
      scale = 0.72;
      y = cy - H * 0.085;
      x = cx - W * 0.04;
      rotation = -6;
      opacity = 0.9;
    } else if (age === 2) {
      scale = 0.52;
      y = cy - H * 0.155;
      x = cx - W * 0.075;
      rotation = -12;
      opacity = 0.7;
      blur = 1.5;
    } else if (age === 3) {
      const activeToken = pastTokens[0];
      const activeElapsed = currentTime - activeToken.startTime;
      const exitProgress = Math.min(1, Math.max(0, activeElapsed / 0.35));

      scale = 0.38 * (1 - exitProgress * 0.3);
      y = cy - H * 0.22 - exitProgress * 40;
      x = cx - W * 0.11;
      rotation = -18;
      opacity = Math.max(0, 0.5 * (1 - exitProgress));
      blur = 4 + exitProgress * 20;

      if (opacity <= 0.02 || exitProgress >= 1) return { visible: false };
    }

    let color = token.color || settings.colors.primary || '#1a1a1a';
    if (!token.color && (token.emphasis === 'cta' || token.emphasis === 'hero')) {
      color = settings.colors.accent || '#c0392b';
    }

    let fontSize = baseFontSize;
    if (token.emphasis === 'cta' || token.emphasis === 'hero') fontSize *= 1.15;

    return { x, y, scale, rotation, opacity, blur, color, fontSize, visible: opacity > 0.01 && scale > 0.05 };
  }
}

// Style 2: Dynamic Kinetic Scroll
class KineticScrollStyle {
  getState(token, currentTime, allTokens, W, H, settings) {
    if (currentTime < token.startTime) return { visible: false };

    const timeSince = currentTime - token.startTime;
    const entryT = Math.min(1, Math.max(0, timeSince / 0.35));
    const easeEntry = Easing.easeOutExpo(entryT);

    let activeIdx = 0;
    for (let i = 0; i < allTokens.length; i++) {
      if (allTokens[i].startTime <= currentTime) activeIdx = i;
    }

    const { cx, cy } = getBaseCoordinates(W, H, settings);
    const lineSpacing = Math.min(130, H * 0.08);
    const scrollY = activeIdx * lineSpacing;
    const targetY = cy + lineSpacing * 1.5 - scrollY;

    const currentY = targetY + (token.wordIndex * lineSpacing);
    const y = currentY + (1 - easeEntry) * 45;
    const opacity = easeEntry;

    if (y < -H * 0.35 || y > H * 1.2) return { visible: false };

    const baseSize = settings.font.size || 88;
    let fontSize = baseSize;
    let color = token.color || settings.colors.primary || '#111111';
    let weight = 800;
    let italic = token.italic;

    if (!token.color) {
      if (token.emphasis === 'cta' || token.text.toUpperCase() === 'SUBSCRIBE') {
        color = '#e63946';
        fontSize = baseSize * 1.35;
        weight = 900;
      } else if (token.emphasis === 'keyword' || ['want', 'then', 'trending', 'contents'].includes(token.text.toLowerCase())) {
        color = '#00e600';
        fontSize = baseSize * 1.15;
        italic = true;
        weight = 800;
      } else if (token.emphasis === 'hero' || (token.text.length <= 3 && token.text === token.text.toUpperCase())) {
        fontSize = baseSize * 1.45;
        weight = 900;
      } else if (token.text.length > 8) {
        fontSize = baseSize * 0.82;
        weight = 700;
      }
    }

    const xOffset = ((token.wordIndex % 3) - 1) * (W * 0.06);
    const x = cx + xOffset - W * 0.04;

    return { x, y, scale: 1.0, rotation: token.rotation || 0, opacity, blur: (1 - easeEntry) * 5, color, fontSize, weight, italic, visible: opacity > 0.05 };
  }
}

// 6 One-Word Styles (Respecting effectiveEndTime for per-word hold bonus):
class OneWordSlideUpBlurStyle {
  getState(token, currentTime, allTokens, W, H, settings) {
    const end = token.getEffectiveEndTime();
    if (currentTime < token.startTime || currentTime > end) return { visible: false };

    const duration = end - token.startTime;
    const progress = (currentTime - token.startTime) / duration;
    const { cx, cy } = getBaseCoordinates(W, H, settings);

    let y = cy, blur = 0, opacity = 1.0, scale = 1.0;

    if (progress < 0.28) {
      const t = Easing.easeOutExpo(progress / 0.28);
      y = cy + 90 * (1 - t);
      blur = 24 * (1 - t);
      opacity = t;
      scale = 0.94 + 0.06 * t;
    } else if (progress > 0.78) {
      const t = Easing.easeOutCubic((progress - 0.78) / 0.22);
      y = cy - 45 * t;
      blur = 14 * t;
      opacity = 1 - t;
      scale = 1.0 - 0.04 * t;
    }

    const fontSize = Math.max(48, Math.min(140, W * 0.15));
    const color = token.color || (token.emphasis === 'cta' || token.emphasis === 'hero' ? settings.colors.accent : settings.colors.primary);

    return { x: cx, y, scale, rotation: 0, opacity, blur, color, fontSize, visible: opacity > 0.01 };
  }
}

class OneWordScalePopStyle {
  getState(token, currentTime, allTokens, W, H, settings) {
    const end = token.getEffectiveEndTime();
    if (currentTime < token.startTime || currentTime > end) return { visible: false };

    const duration = end - token.startTime;
    const progress = (currentTime - token.startTime) / duration;
    const { cx, cy } = getBaseCoordinates(W, H, settings);

    let scale = 1.0, opacity = 1.0;

    if (progress < 0.32) {
      const t = Easing.easeOutBack(progress / 0.32, 2.2);
      scale = 0.3 + 0.7 * t;
      opacity = Math.min(1, (progress / 0.32) * 1.5);
    } else if (progress > 0.8) {
      const t = Easing.easeOutCubic((progress - 0.8) / 0.2);
      scale = 1.0 + 0.18 * t;
      opacity = 1 - t;
    }

    const fontSize = Math.max(48, Math.min(140, W * 0.15));
    const color = token.color || (token.emphasis === 'cta' || token.emphasis === 'hero' ? settings.colors.accent : settings.colors.primary);

    return { x: cx, y: cy, scale, rotation: 0, opacity, blur: 0, color, fontSize, visible: opacity > 0.01 };
  }
}

class OneWordDepthZoomStyle {
  getState(token, currentTime, allTokens, W, H, settings) {
    const end = token.getEffectiveEndTime();
    if (currentTime < token.startTime || currentTime > end) return { visible: false };

    const duration = end - token.startTime;
    const progress = (currentTime - token.startTime) / duration;
    const { cx, cy } = getBaseCoordinates(W, H, settings);

    let scale = 1.0, opacity = 1.0, blur = 0;

    if (progress < 0.32) {
      const t = Easing.easeOutExpo(progress / 0.32);
      scale = 0.15 + 0.85 * t;
      opacity = t;
      blur = 28 * (1 - t);
    } else if (progress > 0.76) {
      const t = Easing.easeOutCubic((progress - 0.76) / 0.24);
      scale = 1.0 + 0.55 * t;
      opacity = 1 - t;
      blur = 18 * t;
    }

    const fontSize = Math.max(48, Math.min(140, W * 0.15));
    const color = token.color || (token.emphasis === 'cta' || token.emphasis === 'hero' ? settings.colors.accent : settings.colors.primary);

    return { x: cx, y: cy, scale, rotation: 0, opacity, blur, color, fontSize, visible: opacity > 0.01 };
  }
}

class OneWordHorizontalDriftStyle {
  getState(token, currentTime, allTokens, W, H, settings) {
    const end = token.getEffectiveEndTime();
    if (currentTime < token.startTime || currentTime > end) return { visible: false };

    const duration = end - token.startTime;
    const progress = (currentTime - token.startTime) / duration;
    const { cx, cy } = getBaseCoordinates(W, H, settings);

    let x = cx, blur = 0, opacity = 1.0;

    if (progress < 0.3) {
      const t = Easing.easeOutExpo(progress / 0.3);
      x = cx + 130 * (1 - t);
      blur = 18 * (1 - t);
      opacity = t;
    } else if (progress > 0.78) {
      const t = Easing.easeOutCubic((progress - 0.78) / 0.22);
      x = cx - 70 * t;
      blur = 14 * t;
      opacity = 1 - t;
    }

    const fontSize = Math.max(48, Math.min(140, W * 0.15));
    const color = token.color || (token.emphasis === 'cta' || token.emphasis === 'hero' ? settings.colors.accent : settings.colors.primary);

    return { x, y: cy, scale: 1.0, rotation: 0, opacity, blur, color, fontSize, visible: opacity > 0.01 };
  }
}

class OneWordDropBounceStyle {
  getState(token, currentTime, allTokens, W, H, settings) {
    const end = token.getEffectiveEndTime();
    if (currentTime < token.startTime || currentTime > end) return { visible: false };

    const duration = end - token.startTime;
    const progress = (currentTime - token.startTime) / duration;
    const { cx, cy } = getBaseCoordinates(W, H, settings);

    let y = cy, opacity = 1.0;

    if (progress < 0.38) {
      const t = Easing.spring(progress / 0.38, 5.5, 4.0);
      y = cy - 160 * (1 - t);
      opacity = Math.min(1, (progress / 0.38) * 2);
    } else if (progress > 0.8) {
      const t = Easing.easeOutCubic((progress - 0.8) / 0.2);
      y = cy + 85 * t;
      opacity = 1 - t;
    }

    const fontSize = Math.max(48, Math.min(140, W * 0.15));
    const color = token.color || (token.emphasis === 'cta' || token.emphasis === 'hero' ? settings.colors.accent : settings.colors.primary);

    return { x: cx, y, scale: 1.0, rotation: 0, opacity, blur: 0, color, fontSize, visible: opacity > 0.01 };
  }
}

class OneWordPunchExpandStyle {
  getState(token, currentTime, allTokens, W, H, settings) {
    const end = token.getEffectiveEndTime();
    if (currentTime < token.startTime || currentTime > end) return { visible: false };

    const duration = end - token.startTime;
    const progress = (currentTime - token.startTime) / duration;
    const { cx, cy } = getBaseCoordinates(W, H, settings);

    const tracking = progress * 14;
    const scale = 1.0 + progress * 0.05;
    let opacity = 1.0;

    if (progress > 0.9) {
      opacity = (1.0 - progress) / 0.1;
    }

    const fontSize = Math.max(48, Math.min(140, W * 0.15));
    const color = token.color || (token.emphasis === 'cta' || token.emphasis === 'hero' ? settings.colors.accent : settings.colors.primary);

    return { x: cx, y: cy, scale, rotation: 0, opacity, blur: 0, color, fontSize, letterSpacing: tracking, visible: opacity > 0.01 };
  }
}

class LineStackStyle {
  getState(token, currentTime, allTokens, W, H, settings) {
    const end = token.getEffectiveEndTime();
    if (currentTime < token.startTime - 0.1 || currentTime > end + 0.6) return { visible: false };

    const timeSince = currentTime - token.startTime;
    const entryT = Math.min(1, Math.max(0, timeSince / 0.3));
    const ease = Easing.easeOutExpo(entryT);

    let opacity = ease;
    if (currentTime > end) {
      const exitT = Math.min(1, (currentTime - end) / 0.5);
      opacity = 1 - Easing.easeOutCubic(exitT);
    }

    const { cx, cy } = getBaseCoordinates(W, H, settings);
    const fontSize = settings.font.size || 76;

    return { x: cx, y: cy + (1 - ease) * 20, scale: 1.0, rotation: 0, opacity, blur: 0, color: token.color || settings.colors.primary || '#1a1a1a', fontSize, visible: opacity > 0.01 };
  }
}

// ============================================================
//  6. MAIN FRAME RENDERER (With Stroke, Shadow, Box, & Gradients)
// ============================================================
class FrameRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.styles = {
      perspective3d: new Perspective3DStyle(),
      kineticScroll: new KineticScrollStyle(),
      oneWord_slideUpBlur: new OneWordSlideUpBlurStyle(),
      oneWord_scalePop: new OneWordScalePopStyle(),
      oneWord_depthZoom: new OneWordDepthZoomStyle(),
      oneWord_horizontalDrift: new OneWordHorizontalDriftStyle(),
      oneWord_dropBounce: new OneWordDropBounceStyle(),
      oneWord_punchExpand: new OneWordPunchExpandStyle(),
      lineStack: new LineStackStyle()
    };
    this.settings = null;
  }

  configure(settings) {
    this.settings = {
      tokens: settings.tokens || [],
      style: settings.style || 'kineticScroll',
      font: settings.font || { family: 'Inter', weight: 800, size: 84 },
      colors: settings.colors || { primary: '#111111', accent: '#00e600' },
      background: settings.background || { type: 'offwhite', grain: 0.2, vignette: 0.15 },
      verticalAlign: settings.verticalAlign || 'center',
      yOffset: settings.yOffset || 0,
      xOffset: settings.xOffset || 0,
      width: settings.width || 1080,
      height: settings.height || 1920,
      uppercase: !!settings.uppercase,
      letterSpacing: settings.letterSpacing || 0,

      // Effects: Shadow, Stroke & Subtitle Box
      shadow: settings.shadow || { enabled: false, color: 'rgba(0,0,0,0.8)', blur: 12, offsetX: 3, offsetY: 4 },
      stroke: settings.stroke || { enabled: false, color: '#000000', width: 6 },
      box: settings.box || { enabled: false, color: 'rgba(0,0,0,0.7)', radius: 10, paddingX: 20, paddingY: 10 }
    };

    if (this.canvas.width !== this.settings.width) this.canvas.width = this.settings.width;
    if (this.canvas.height !== this.settings.height) this.canvas.height = this.settings.height;
  }

  renderFrame(currentTime) {
    if (!this.settings) return;

    const { width, height, tokens, style, background, font, uppercase, letterSpacing, shadow, stroke, box } = this.settings;
    const ctx = this.ctx;

    // 1. Background
    ctx.clearRect(0, 0, width, height);
    BackgroundRenderer.render(ctx, width, height, background);

    // 2. Compute state for all tokens (Support Multi-Motion Remix & per-token style overrides)
    const remixStyles = ['oneWord_slideUpBlur', 'oneWord_scalePop', 'oneWord_depthZoom', 'oneWord_punchExpand', 'oneWord_dropBounce'];
    const renderItems = [];

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];

      let targetStyle = token.styleOverride;
      if (!targetStyle) {
        if (style === 'multiMotion') {
          targetStyle = remixStyles[token.wordIndex % remixStyles.length];
        } else {
          targetStyle = style;
        }
      }

      const styleInstance = this.styles[targetStyle] || this.styles.kineticScroll;
      const state = styleInstance.getState(token, currentTime, tokens, width, height, this.settings);
      if (state && state.visible) {
        renderItems.push({ token, state, index: i });
      }
    }

    // 3. Depth sort
    renderItems.sort((a, b) => a.state.scale - b.state.scale);

    // 4. Render typography
    for (const { token, state } of renderItems) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, state.opacity));

      ctx.translate(state.x, state.y);
      if (state.rotation) ctx.rotate((state.rotation * Math.PI) / 180);
      if (state.scale !== 1) ctx.scale(state.scale, state.scale);

      if (state.blur > 0.5) {
        ctx.filter = `blur(${state.blur.toFixed(1)}px)`;
      } else {
        ctx.filter = 'none';
      }

      const weight = state.weight || font.weight || 800;
      const family = font.family || 'Inter';
      const size = state.fontSize || font.size || 84;
      const styleTag = state.italic ? 'italic ' : '';

      ctx.font = `${styleTag}${weight} ${size}px "${family}", "Inter", -apple-system, BlinkMacSystemFont, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      let text = token.text;
      if (uppercase) text = text.toUpperCase();

      const effLetterSpacing = (state.letterSpacing || 0) + (letterSpacing || 0);

      // Measure for background box
      let textWidth = 0;
      if (effLetterSpacing > 0) {
        const chars = [...text];
        const widths = chars.map(c => ctx.measureText(c).width);
        textWidth = widths.reduce((s, w) => s + w, 0) + effLetterSpacing * (chars.length - 1);
      } else {
        textWidth = ctx.measureText(text).width;
      }

      // DRAW SUBTITLE BACKGROUND BOX (if enabled)
      if (box && box.enabled) {
        ctx.save();
        ctx.fillStyle = box.color || 'rgba(0,0,0,0.7)';
        const padX = box.paddingX || 20;
        const padY = box.paddingY || 10;
        const boxW = textWidth + padX * 2;
        const boxH = size * 1.25 + padY * 2;
        this._drawRoundedRect(ctx, -boxW / 2, -boxH / 2, boxW, boxH, box.radius || 10);
        ctx.fill();
        ctx.restore();
      }

      // RESOLVE FILL STYLE: Check if state.color is an object with { top, bottom } for 2-color gradient blend!
      let fillStyle = state.color;
      if (state.color && typeof state.color === 'object' && state.color.top && state.color.bottom) {
        const grad = ctx.createLinearGradient(0, -size * 0.45, 0, size * 0.45);
        grad.addColorStop(0, state.color.top);
        grad.addColorStop(1, state.color.bottom);
        fillStyle = grad;
      }

      // APPLY SHADOW (if enabled)
      if (shadow && shadow.enabled) {
        ctx.shadowColor = shadow.color || 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = shadow.blur || 12;
        ctx.shadowOffsetX = shadow.offsetX || 3;
        ctx.shadowOffsetY = shadow.offsetY || 4;
      } else {
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
      }

      // APPLY STROKE / OUTLINE (if enabled)
      if (stroke && stroke.enabled && stroke.width > 0) {
        ctx.lineWidth = stroke.width;
        ctx.strokeStyle = stroke.color || '#000000';
        ctx.lineJoin = 'round';
        ctx.miterLimit = 2;

        if (effLetterSpacing > 0) {
          this._drawSpacedText(ctx, text, 0, 0, effLetterSpacing, true);
        } else {
          ctx.strokeText(text, 0, 0);
        }
      }

      // DRAW FILL TEXT
      ctx.fillStyle = fillStyle;
      if (effLetterSpacing > 0) {
        this._drawSpacedText(ctx, text, 0, 0, effLetterSpacing, false);
      } else {
        ctx.fillText(text, 0, 0);
      }

      ctx.filter = 'none';
      ctx.restore();
    }
  }

  _drawSpacedText(ctx, text, x, y, spacing, isStroke = false) {
    const chars = [...text];
    const widths = chars.map(c => ctx.measureText(c).width);
    const totalW = widths.reduce((s, w) => s + w, 0) + spacing * (chars.length - 1);
    let cx = x - totalW / 2;
    for (let i = 0; i < chars.length; i++) {
      if (isStroke) {
        ctx.strokeText(chars[i], cx + widths[i] / 2, y);
      } else {
        ctx.fillText(chars[i], cx + widths[i] / 2, y);
      }
      cx += widths[i] + spacing;
    }
  }

  _drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}

// ============================================================
//  7. DETERMINISTIC WEBM WRITER
// ============================================================
class DeterministicWebMWriter {
  constructor(fps, quality = 0.85) {
    this.fps = fps;
    this.quality = quality;
    this.frames = [];
    this.width = 0;
    this.height = 0;
  }

  addFrame(canvas) {
    this.width = canvas.width;
    this.height = canvas.height;
    const dataUrl = canvas.toDataURL('image/webp', this.quality);
    const vp8 = this._parseWebP(dataUrl);
    if (vp8) {
      this.frames.push(vp8);
    }
  }

  _parseWebP(dataUrl) {
    const binStr = atob(dataUrl.split(',')[1]);
    const len = binStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binStr.charCodeAt(i);

    const riff = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    const webp = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
    if (riff !== 'RIFF' || webp !== 'WEBP') return null;

    let offset = 12;
    while (offset < len) {
      const chunkFourCC = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
      const chunkSize = bytes[offset + 4] | (bytes[offset + 5] << 8) | (bytes[offset + 6] << 16) | (bytes[offset + 7] << 24);
      if (chunkFourCC === 'VP8 ') {
        return bytes.subarray(offset + 8, offset + 8 + chunkSize);
      }
      offset += 8 + chunkSize + (chunkSize & 1);
    }
    return null;
  }

  toBlob() {
    if (this.frames.length === 0) return null;
    const frameDurationMs = 1000 / this.fps;
    const totalDurationMs = this.frames.length * frameDurationMs;

    const ebml = this._buildEBML(this.frames, this.width, this.height, frameDurationMs, totalDurationMs);
    return new Blob([ebml], { type: 'video/webm' });
  }

  _buildEBML(frames, width, height, frameDurationMs, totalDurationMs) {
    const toVInt = num => {
      if (num < 0x7f) return new Uint8Array([0x80 | num]);
      if (num < 0x3fff) return new Uint8Array([0x40 | (num >> 8), num & 0xff]);
      if (num < 0x1fffff) return new Uint8Array([0x20 | (num >> 16), (num >> 8) & 0xff, num & 0xff]);
      return new Uint8Array([0x10 | (num >> 24), (num >> 16) & 0xff, (num >> 8) & 0xff, num & 0xff]);
    };

    const makeElem = (idBytes, dataBytes) => {
      const vLen = toVInt(dataBytes.length);
      const res = new Uint8Array(idBytes.length + vLen.length + dataBytes.length);
      res.set(idBytes, 0);
      res.set(vLen, idBytes.length);
      res.set(dataBytes, idBytes.length + vLen.length);
      return res;
    };

    const concat = arrs => {
      const total = arrs.reduce((s, a) => s + a.length, 0);
      const out = new Uint8Array(total);
      let pos = 0;
      for (const a of arrs) {
        out.set(a, pos);
        pos += a.length;
      }
      return out;
    };

    const uintBytes = (val, minBytes = 1) => {
      const b = [];
      while (val > 0 || b.length < minBytes) {
        b.unshift(val & 0xff);
        val = val >> 8;
      }
      return new Uint8Array(b);
    };

    const strBytes = str => new TextEncoder().encode(str);

    const ebmlHeader = makeElem(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), concat([
      makeElem(new Uint8Array([0x42, 0x86]), new Uint8Array([1])),
      makeElem(new Uint8Array([0x42, 0xf7]), new Uint8Array([1])),
      makeElem(new Uint8Array([0x42, 0xf2]), new Uint8Array([4])),
      makeElem(new Uint8Array([0x42, 0xf3]), new Uint8Array([8])),
      makeElem(new Uint8Array([0x42, 0x82]), strBytes('webm')),
      makeElem(new Uint8Array([0x42, 0x87]), new Uint8Array([2])),
      makeElem(new Uint8Array([0x42, 0x85]), new Uint8Array([2]))
    ]));

    const durView = new DataView(new ArrayBuffer(8));
    durView.setFloat64(0, totalDurationMs);
    const info = makeElem(new Uint8Array([0x15, 0x49, 0xa9, 0x66]), concat([
      makeElem(new Uint8Array([0x2a, 0xd7, 0xb1]), uintBytes(1000000, 3)),
      makeElem(new Uint8Array([0x4d, 0x80]), strBytes("Sachin's Text Editor")),
      makeElem(new Uint8Array([0x57, 0x41]), strBytes("Sachin's Text Editor")),
      makeElem(new Uint8Array([0x44, 0x89]), new Uint8Array(durView.buffer))
    ]));

    const videoSettings = makeElem(new Uint8Array([0xe0]), concat([
      makeElem(new Uint8Array([0xb0]), uintBytes(width)),
      makeElem(new Uint8Array([0xba]), uintBytes(height))
    ]));

    const trackEntry = makeElem(new Uint8Array([0xae]), concat([
      makeElem(new Uint8Array([0xd7]), new Uint8Array([1])),
      makeElem(new Uint8Array([0x73, 0xc5]), new Uint8Array([1])),
      makeElem(new Uint8Array([0x83]), new Uint8Array([1])),
      makeElem(new Uint8Array([0x86]), strBytes('V_VP8')),
      videoSettings
    ]));

    const tracks = makeElem(new Uint8Array([0x16, 0x54, 0xae, 0x6b]), trackEntry);

    const clusterElements = [];
    const framesPerCluster = Math.max(30, Math.floor(this.fps * 4));

    for (let c = 0; c < frames.length; c += framesPerCluster) {
      const clusterStartFrame = c;
      const clusterStartTimeMs = Math.round(clusterStartFrame * frameDurationMs);
      const clusterBlocks = [];

      clusterBlocks.push(makeElem(new Uint8Array([0xe7]), uintBytes(clusterStartTimeMs)));

      const endFrame = Math.min(frames.length, c + framesPerCluster);
      for (let f = clusterStartFrame; f < endFrame; f++) {
        const frameData = frames[f];
        const relTimeMs = Math.round((f - clusterStartFrame) * frameDurationMs);

        const blockHeader = new Uint8Array([
          0x81,
          (relTimeMs >> 8) & 0xff,
          relTimeMs & 0xff,
          0x80
        ]);

        const fullBlock = concat([blockHeader, frameData]);
        clusterBlocks.push(makeElem(new Uint8Array([0xa3]), fullBlock));
      }

      clusterElements.push(makeElem(new Uint8Array([0x1f, 0x43, 0xb6, 0x75]), concat(clusterBlocks)));
    }

    const segment = makeElem(new Uint8Array([0x18, 0x53, 0x80, 0x67]), concat([
      info,
      tracks,
      concat(clusterElements)
    ]));

    return concat([ebmlHeader, segment]);
  }
}

window.Easing = Easing;
window.LyricToken = LyricToken;
window.TimingEngine = TimingEngine;
window.BackgroundRenderer = BackgroundRenderer;
window.Perspective3DStyle = Perspective3DStyle;
window.KineticScrollStyle = KineticScrollStyle;
window.OneWordSlideUpBlurStyle = OneWordSlideUpBlurStyle;
window.OneWordScalePopStyle = OneWordScalePopStyle;
window.OneWordDepthZoomStyle = OneWordDepthZoomStyle;
window.OneWordHorizontalDriftStyle = OneWordHorizontalDriftStyle;
window.OneWordDropBounceStyle = OneWordDropBounceStyle;
window.OneWordPunchExpandStyle = OneWordPunchExpandStyle;
window.LineStackStyle = LineStackStyle;
window.FrameRenderer = FrameRenderer;
window.DeterministicWebMWriter = DeterministicWebMWriter;
