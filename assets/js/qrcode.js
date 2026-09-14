/* =========================================================
   qrcode.js — gerador de QR Code (modo byte, nível M)
   Implementação própria, sem dependências externas.
   Suporta versões 1..12 (até 287 bytes) — suficiente para URLs.
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------- GF(256) ---------- */
  const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
  (function initGF() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  const gmul = (a, b) => (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];

  /* polinômio gerador de `deg` coeficientes de correção */
  function rsPoly(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    const gen = rsPoly(ecLen);
    const res = new Array(ecLen).fill(0);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ res[0];
      res.shift();
      res.push(0);
      if (factor !== 0) {
        for (let j = 0; j < ecLen; j++) res[j] ^= gmul(gen[j + 1], factor);
      }
    }
    return res;
  }

  /* ---------- tabelas (nível de correção M) ----------
     [capacidade em bytes, ec por bloco, g1 blocos, g1 dados, g2 blocos, g2 dados] */
  const VER = {
    1:  [14,  10, 1, 16, 0, 0],
    2:  [26,  16, 1, 28, 0, 0],
    3:  [42,  26, 1, 44, 0, 0],
    4:  [62,  18, 2, 32, 0, 0],
    5:  [84,  24, 2, 43, 0, 0],
    6:  [106, 16, 4, 27, 0, 0],
    7:  [122, 18, 4, 31, 0, 0],
    8:  [152, 22, 2, 38, 2, 39],
    9:  [180, 22, 3, 36, 2, 37],
    10: [213, 26, 4, 43, 1, 44],
    11: [251, 30, 1, 50, 4, 51],
    12: [287, 22, 6, 36, 2, 37]
  };
  const ALIGN = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
    7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
    11: [6, 30, 54], 12: [6, 32, 58]
  };

  /* ---------- BCH para format/version info ---------- */
  function bchFormat(data) { // 5 bits -> 15 bits
    let d = data << 10;
    for (let i = 4; i >= 0; i--) {
      if (d & (1 << (i + 10))) d ^= 0x537 << i;
    }
    return ((data << 10) | d) ^ 0x5412;
  }
  function bchVersion(ver) { // 6 bits -> 18 bits
    let d = ver << 12;
    for (let i = 5; i >= 0; i--) {
      if (d & (1 << (i + 12))) d ^= 0x1f25 << i;
    }
    return (ver << 12) | d;
  }

  /* ---------- utf-8 ---------- */
  function toBytes(str) {
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f)); }
      else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        const c2 = str.charCodeAt(++i);
        const cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f)); }
    }
    return out;
  }

  /* ---------- matriz ---------- */
  function makeMatrix(size) {
    const m = [], r = [];
    for (let i = 0; i < size; i++) {
      m.push(new Int8Array(size).fill(-1));   // -1 = livre
      r.push(new Uint8Array(size));           // 1 = reservado (função)
    }
    return { m, r };
  }

  function placeFunctionPatterns(mx, size, version) {
    const { m, r } = mx;
    const set = (x, y, v) => { if (x >= 0 && y >= 0 && x < size && y < size) { m[y][x] = v; r[y][x] = 1; } };

    // finders + separadores
    [[0, 0], [size - 7, 0], [0, size - 7]].forEach(([ox, oy]) => {
      for (let y = -1; y <= 7; y++) {
        for (let x = -1; x <= 7; x++) {
          const inBox = x >= 0 && x <= 6 && y >= 0 && y <= 6;
          const dark = inBox && ((x === 0 || x === 6 || y === 0 || y === 6) ||
            (x >= 2 && x <= 4 && y >= 2 && y <= 4));
          set(ox + x, oy + y, dark ? 1 : 0);
        }
      }
    });

    // timing
    for (let i = 8; i < size - 8; i++) {
      set(i, 6, i % 2 === 0 ? 1 : 0);
      set(6, i, i % 2 === 0 ? 1 : 0);
    }

    // alinhamento
    const pos = ALIGN[version] || [];
    pos.forEach(py => pos.forEach(px => {
      const isFinder = (px <= 8 && py <= 8) || (px >= size - 9 && py <= 8) || (px <= 8 && py >= size - 9);
      if (isFinder) return;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dark = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
          set(px + dx, py + dy, dark ? 1 : 0);
        }
      }
    }));

    // módulo escuro fixo
    set(8, size - 8, 1);

    // reserva áreas de formato
    for (let i = 0; i <= 8; i++) {
      if (i !== 6) { if (m[8][i] === -1) { m[8][i] = 0; } r[8][i] = 1; }
      if (i !== 6) { if (m[i][8] === -1) { m[i][8] = 0; } r[i][8] = 1; }
    }
    for (let i = 0; i < 8; i++) {
      if (m[size - 1 - i][8] === -1) m[size - 1 - i][8] = 0;
      r[size - 1 - i][8] = 1;
      if (m[8][size - 1 - i] === -1) m[8][size - 1 - i] = 0;
      r[8][size - 1 - i] = 1;
    }

    // info de versão (>= 7)
    if (version >= 7) {
      const bits = bchVersion(version);
      for (let i = 0; i < 18; i++) {
        const b = (bits >> i) & 1;
        const a = Math.floor(i / 3), c = i % 3;
        set(a, size - 11 + c, b);
        set(size - 11 + c, a, b);
      }
    }
  }

  function placeData(mx, size, bytes) {
    const { m, r } = mx;
    let bitIdx = 0;
    const total = bytes.length * 8;
    const nextBit = () => {
      if (bitIdx >= total) { bitIdx++; return 0; } // bits restantes = 0
      const b = (bytes[bitIdx >> 3] >> (7 - (bitIdx & 7))) & 1;
      bitIdx++;
      return b;
    };
    let up = true;
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col = 5; // pula coluna de timing
      for (let i = 0; i < size; i++) {
        const row = up ? size - 1 - i : i;
        for (let c = 0; c < 2; c++) {
          const x = col - c;
          if (r[row][x]) continue;
          m[row][x] = nextBit();
        }
      }
      up = !up;
    }
  }

  const MASKS = [
    (i, j) => (i + j) % 2 === 0,
    (i) => i % 2 === 0,
    (i, j) => j % 3 === 0,
    (i, j) => (i + j) % 3 === 0,
    (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
    (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
    (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
    (i, j) => (((i + j) % 2) + ((i * j) % 3)) % 2 === 0
  ];

  function applyMaskAndFormat(base, size, maskId) {
    const m = base.m.map(row => Int8Array.from(row));
    const r = base.r;
    const fn = MASKS[maskId];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (r[y][x]) continue;
        if (fn(y, x)) m[y][x] ^= 1;
      }
    }
    // format info (nível M = 00) — m[linha][coluna]
    const bits = bchFormat((0 << 3) | maskId);
    const bit = i => (bits >> i) & 1;
    // cópia 1: coluna 8 (topo) + linha 8 (esquerda)
    for (let i = 0; i <= 5; i++) m[i][8] = bit(i);
    m[7][8] = bit(6);
    m[8][8] = bit(7);
    m[8][7] = bit(8);
    for (let i = 9; i < 15; i++) m[8][14 - i] = bit(i);
    // cópia 2: linha 8 (direita) + coluna 8 (base)
    for (let i = 0; i < 8; i++) m[8][size - 1 - i] = bit(i);
    for (let i = 8; i < 15; i++) m[size - 15 + i][8] = bit(i);
    m[size - 8][8] = 1; // módulo escuro fixo
    return m;
  }

  function penalty(m, size) {
    let score = 0;
    // regra 1 — sequências de 5+
    for (let y = 0; y < size; y++) {
      let runR = 1, runC = 1;
      for (let x = 1; x < size; x++) {
        runR = (m[y][x] === m[y][x - 1]) ? runR + 1 : 1;
        if (runR === 5) score += 3; else if (runR > 5) score += 1;
        runC = (m[x][y] === m[x - 1][y]) ? runC + 1 : 1;
        if (runC === 5) score += 3; else if (runC > 5) score += 1;
      }
    }
    // regra 2 — blocos 2x2
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const v = m[y][x];
        if (v === m[y][x + 1] && v === m[y + 1][x] && v === m[y + 1][x + 1]) score += 3;
      }
    }
    // regra 3 — padrão 1:1:3:1:1
    const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    const match = (get, i) => {
      let a = true, b = true;
      for (let k = 0; k < 11; k++) {
        const v = get(i + k);
        if (v !== pat1[k]) a = false;
        if (v !== pat2[k]) b = false;
      }
      return a || b;
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x <= size - 11; x++) {
        if (match(i => m[y][i], x)) score += 40;
        if (match(i => m[i][y], x)) score += 40;
      }
    }
    // regra 4 — proporção de módulos escuros
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) dark += m[y][x];
    const ratio = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(ratio - 50) / 5) * 10;
    return score;
  }

  /** Gera a matriz booleana do QR. Retorna { size, modules:[[0|1]] } */
  function encode(text, maskOverride) {
    const data = toBytes(String(text == null ? '' : text));
    let version = 0;
    for (let v = 1; v <= 12; v++) {
      if (data.length <= VER[v][0]) { version = v; break; }
    }
    if (!version) throw new Error('Conteúdo muito longo para gerar QR Code (máx. 287 caracteres).');

    const [, ecLen, g1, d1, g2, d2] = VER[version];
    const totalData = g1 * d1 + g2 * d2;

    /* --- bitstream --- */
    const bits = [];
    const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); };
    push(0b0100, 4);                                   // modo byte
    push(data.length, version >= 10 ? 16 : 8);         // contador
    data.forEach(b => push(b, 8));
    const cap = totalData * 8;
    for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0); // terminador
    while (bits.length % 8 !== 0) bits.push(0);
    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
      codewords.push(b);
    }
    const PAD = [0xec, 0x11];
    let p = 0;
    while (codewords.length < totalData) codewords.push(PAD[p++ % 2]);

    /* --- blocos + correção de erro --- */
    const blocks = [], ecBlocks = [];
    let off = 0;
    for (let i = 0; i < g1 + g2; i++) {
      const len = i < g1 ? d1 : d2;
      const blk = codewords.slice(off, off + len);
      off += len;
      blocks.push(blk);
      ecBlocks.push(rsEncode(blk, ecLen));
    }
    // intercalação
    const finalBytes = [];
    const maxData = Math.max(d1, d2);
    for (let i = 0; i < maxData; i++) {
      blocks.forEach(b => { if (i < b.length) finalBytes.push(b[i]); });
    }
    for (let i = 0; i < ecLen; i++) {
      ecBlocks.forEach(b => finalBytes.push(b[i]));
    }

    /* --- matriz --- */
    const size = version * 4 + 17;
    const mx = makeMatrix(size);
    placeFunctionPatterns(mx, size, version);
    placeData(mx, size, finalBytes);

    let best = null, bestScore = Infinity, bestMask = 0;
    if (maskOverride !== undefined && maskOverride !== null) {
      best = applyMaskAndFormat(mx, size, maskOverride);
      bestMask = maskOverride;
    } else {
      for (let mask = 0; mask < 8; mask++) {
        const cand = applyMaskAndFormat(mx, size, mask);
        const sc = penalty(cand, size);
        if (sc < bestScore) { bestScore = sc; best = cand; bestMask = mask; }
      }
    }
    return { size, version, modules: best, mask: bestMask };
  }

  /** SVG string do QR Code */
  function toSVG(text, opts) {
    const o = Object.assign({ scale: 6, margin: 4, dark: '#0d1b33', light: '#ffffff' }, opts || {});
    const qr = encode(text);
    const total = qr.size + o.margin * 2;
    const px = o.scale;
    let path = '';
    for (let y = 0; y < qr.size; y++) {
      for (let x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) {
          path += 'M' + (x + o.margin) + ' ' + (y + o.margin) + 'h1v1h-1z';
        }
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (total * px) + '" height="' + (total * px) +
      '" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img" aria-label="QR Code">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + o.light + '"/>' +
      '<path d="' + path + '" fill="' + o.dark + '"/></svg>';
  }

  global.QRCode = { encode, toSVG };
})(window);
