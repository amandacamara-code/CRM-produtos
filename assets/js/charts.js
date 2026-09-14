/* =========================================================
   charts.js — gráficos em SVG puro (sem bibliotecas)
   Todos responsivos via viewBox e legíveis em telas pequenas.
   ========================================================= */
(function (global) {
  'use strict';

  const PALETTE = ['#E8400D', '#2563eb', '#0E9F6E', '#7c3aed', '#D97706', '#0E8C9E', '#C4183C', '#3A2A20'];
  const AXIS = '#94a3b8';
  const GRID = '#e6eaf2';
  const TEXT = '#64748b';

  const esc = s => U.esc(s);

  /** escala "bonita" para o eixo Y */
  function niceMax(v) {
    if (!v || v <= 0) return 100;
    const exp = Math.floor(Math.log10(v));
    const base = Math.pow(10, exp);
    const n = v / base;
    const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * base;
  }

  function yTicks(max, count) {
    const t = [];
    for (let i = 0; i <= count; i++) t.push((max / count) * i);
    return t;
  }

  function abbrev(v) {
    const n = Number(v) || 0;
    const a = Math.abs(n);
    if (a >= 1e6) return (n / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + 'M';
    if (a >= 1e3) return (n / 1e3).toFixed(a >= 1e4 ? 0 : 1).replace('.', ',') + 'k';
    return String(Math.round(n));
  }

  /* =========================================================
     Gráfico combinado: barras (bruto) + linha (líquido)
     data: [{label, bruto, liquido, ...}]
     ========================================================= */
  function faturamento(data, opts) {
    const o = Object.assign({ h: 280, serieLinha: 'liquido', serieBarra: 'bruto',
      labelBarra: 'Faturamento bruto', labelLinha: 'Faturamento líquido' }, opts || {});
    if (!data || !data.length) return vazio('Sem vendas no período selecionado.');

    const W = 860, H = o.h;
    const pad = { t: 18, r: 14, b: 42, l: 58 };
    const iw = W - pad.l - pad.r;
    const ih = H - pad.t - pad.b;

    const maxVal = data.reduce((max, d) =>
      Math.max(max, Number(d[o.serieBarra]) || 0, Number(d[o.serieLinha]) || 0), 0);
    const max = niceMax(maxVal * 1.1) || 100;
    const n = data.length;
    const slot = iw / n;
    const bw = Math.max(5, Math.min(44, slot * 0.56));

    const x = i => pad.l + slot * i + slot / 2;
    const y = v => pad.t + ih - (U.clamp((Number(v) || 0) / max, 0, 1) * ih);

    let s = '';
    // grade + eixo Y
    yTicks(max, 4).forEach(t => {
      const yy = y(t);
      s += `<line x1="${pad.l}" y1="${yy.toFixed(1)}" x2="${W - pad.r}" y2="${yy.toFixed(1)}" stroke="${GRID}" stroke-width="1"/>`;
      s += `<text x="${pad.l - 8}" y="${(yy + 4).toFixed(1)}" text-anchor="end" font-size="10.5" fill="${TEXT}">${abbrev(t)}</text>`;
    });

    // barras
    const passo = Math.ceil(n / (n > 24 ? 12 : n > 12 ? 8 : n));
    data.forEach((d, i) => {
      const v = Number(d[o.serieBarra]) || 0;
      const yy = y(v);
      const hh = Math.max(v > 0 ? 2 : 0, pad.t + ih - yy);
      s += `<rect x="${(x(i) - bw / 2).toFixed(1)}" y="${yy.toFixed(1)}" width="${bw.toFixed(1)}" height="${hh.toFixed(1)}" rx="${Math.min(4, bw / 3).toFixed(1)}" fill="url(#gradBar)">`;
      s += `<title>${esc(d.label)} — ${o.labelBarra}: ${U.money(v)}${d.qtd !== undefined ? ' · ' + d.qtd + ' venda(s)' : ''}</title></rect>`;
      if (i % passo === 0 || i === n - 1) {
        s += `<text x="${x(i).toFixed(1)}" y="${H - 22}" text-anchor="middle" font-size="10.5" fill="${TEXT}">${esc(d.label)}</text>`;
      }
    });

    // linha do líquido
    if (o.serieLinha) {
      const pts = data.map((d, i) => [x(i), y(d[o.serieLinha])]);
      const path = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
      s += `<path d="${path}" fill="none" stroke="#047857" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
      pts.forEach((p, i) => {
        s += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${n > 20 ? 2 : 3.4}" fill="#fff" stroke="#047857" stroke-width="2">`;
        s += `<title>${esc(data[i].label)} — ${o.labelLinha}: ${U.money(data[i][o.serieLinha])}</title></circle>`;
      });
    }

    // eixo X
    s += `<line x1="${pad.l}" y1="${pad.t + ih}" x2="${W - pad.r}" y2="${pad.t + ih}" stroke="${AXIS}" stroke-width="1"/>`;

    const defs = `<defs><linearGradient id="gradBar" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F26522"/><stop offset="100%" stop-color="#C4350A"/></linearGradient></defs>`;

    return svg(W, H, defs + s, 'Gráfico de faturamento por período');
  }

  /* =========================================================
     Barras horizontais (ex.: faturamento por produto)
     items: [{label, valor, cor?, sub?}]
     ========================================================= */
  function hbars(items, opts) {
    const o = Object.assign({ formato: U.money, altura: 30 }, opts || {});
    if (!items || !items.length) return vazio('Sem dados para exibir.');
    const max = Math.max.apply(null, items.map(i => Number(i.valor) || 0)) || 1;

    return '<div class="vstack">' + items.map((it, idx) => {
      const pct = U.clamp(((Number(it.valor) || 0) / max) * 100, 0, 100);
      const cor = it.cor || PALETTE[idx % PALETTE.length];
      return `<div class="progress-row">
        <div class="progress-row__top">
          <span>${esc(it.label)}${it.sub ? ' <span class="muted tiny">· ' + esc(it.sub) + '</span>' : ''}</span>
          <b>${o.formato(it.valor)}</b>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${cor}"></div></div>
      </div>`;
    }).join('') + '</div>';
  }

  /* =========================================================
     Donut — composição (ex.: faturamento por categoria)
     items: [{label, valor, cor?}]
     ========================================================= */
  function donut(items, opts) {
    const o = Object.assign({ size: 190, thickness: 30, centro: '', centroSub: '' }, opts || {});
    const dados = (items || []).filter(i => (Number(i.valor) || 0) > 0);
    if (!dados.length) return vazio('Sem dados para compor o gráfico.');

    const total = U.sum(dados, d => d.valor);
    const R = o.size / 2;
    const r = R - o.thickness / 2;
    const C = 2 * Math.PI * r;
    let acc = 0;
    let arcs = '';

    dados.forEach((d, i) => {
      const frac = (Number(d.valor) || 0) / total;
      const len = C * frac;
      const cor = d.cor || PALETTE[i % PALETTE.length];
      arcs += `<circle cx="${R}" cy="${R}" r="${r}" fill="none" stroke="${cor}" stroke-width="${o.thickness}"
        stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}"
        stroke-dashoffset="${(-acc).toFixed(2)}" transform="rotate(-90 ${R} ${R})">
        <title>${esc(d.label)}: ${U.money(d.valor)} (${U.pct(frac * 100)})</title></circle>`;
      acc += len;
    });

    const centro = o.centro || U.moneyShort(total);
    const chart = `<svg viewBox="0 0 ${o.size} ${o.size}" width="${o.size}" height="${o.size}" role="img" aria-label="Composição">
      ${arcs}
      <text x="${R}" y="${R - 2}" text-anchor="middle" font-size="17" font-weight="700" fill="#0f172a">${esc(centro)}</text>
      <text x="${R}" y="${R + 15}" text-anchor="middle" font-size="10" fill="${TEXT}">${esc(o.centroSub || 'total')}</text>
    </svg>`;

    const legenda = dados.map((d, i) => {
      const cor = d.cor || PALETTE[i % PALETTE.length];
      const pct = U.pct(((Number(d.valor) || 0) / total) * 100);
      return `<span><i style="background:${cor}"></i>${esc(d.label)} <b class="muted">${pct}</b></span>`;
    }).join('');

    return `<div class="hstack" style="gap:18px;align-items:center;justify-content:center">
      <div class="chartbox" style="flex:0 0 auto">${chart}</div>
      <div class="chart-legend" style="flex-direction:column;gap:7px;margin:0">${legenda}</div>
    </div>`;
  }

  /* =========================================================
     Funil — etapas do pipeline
     stages: [{etapa:{nome,cor}, qtd, valor}]
     ========================================================= */
  function funil(stages) {
    const dados = (stages || []).filter(s => s.etapa.aberto || s.etapa.ganho);
    if (!dados.length) return vazio('Sem oportunidades no funil.');
    const max = Math.max.apply(null, dados.map(d => d.valor || 0)) || 1;
    const corMap = { blue: '#2563eb', purple: '#7c3aed', orange: '#D97706', gold: '#EAB308', green: '#0E9F6E', red: '#C4183C', fire: '#E8400D' };

    return '<div class="vstack">' + dados.map((d, i) => {
      const pct = U.clamp(((d.valor || 0) / max) * 100, 2, 100);
      const cor = corMap[d.etapa.cor] || PALETTE[i % PALETTE.length];
      return `<div class="progress-row">
        <div class="progress-row__top">
          <span>${d.etapa.emoji || ''} <b>${esc(d.etapa.nome)}</b> <span class="muted">· ${d.qtd} oport.</span></span>
          <b>${U.money(d.valor)}</b>
        </div>
        <div class="bar-track" style="height:11px"><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:linear-gradient(90deg,${cor},${cor}cc)"></div></div>
      </div>`;
    }).join('') + '</div>';
  }

  /* =========================================================
     Sparkline — mini tendência
     ========================================================= */
  function sparkline(values, opts) {
    const o = Object.assign({ w: 130, h: 36, cor: '#2563eb' }, opts || {});
    const vals = (values || []).map(v => Number(v) || 0);
    if (vals.length < 2) return '';
    const max = Math.max.apply(null, vals) || 1;
    const min = Math.min.apply(null, vals);
    const span = (max - min) || 1;
    const step = o.w / (vals.length - 1);
    const pts = vals.map((v, i) => [i * step, o.h - 3 - ((v - min) / span) * (o.h - 8)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = line + ` L${o.w} ${o.h} L0 ${o.h} Z`;
    return `<svg viewBox="0 0 ${o.w} ${o.h}" width="${o.w}" height="${o.h}" preserveAspectRatio="none" aria-hidden="true">
      <path d="${area}" fill="${o.cor}" opacity=".12"/>
      <path d="${line}" fill="none" stroke="${o.cor}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }

  /* =========================================================
     Barras empilhadas — composição do faturamento líquido
     ========================================================= */
  function waterfall(itens) {
    const total = Math.max.apply(null, itens.map(i => Math.abs(i.valor))) || 1;
    return '<div class="vstack">' + itens.map(it => {
      const pct = U.clamp((Math.abs(it.valor) / total) * 100, 1, 100);
      return `<div class="progress-row">
        <div class="progress-row__top">
          <span>${esc(it.label)}</span>
          <b class="${it.valor < 0 ? 'neg' : ''}">${it.valor < 0 ? '− ' : ''}${U.money(Math.abs(it.valor))}</b>
        </div>
        <div class="bar-track"><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${it.cor}"></div></div>
      </div>`;
    }).join('') + '</div>';
  }

  function svg(w, h, inner, label) {
    return `<div class="chartbox"><svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(label || '')}"
      style="max-height:${h}px">${inner}</svg></div>`;
  }

  function vazio(msg) {
    return `<div class="empty"><div class="empty__icon">📉</div><p>${esc(msg)}</p></div>`;
  }

  global.Charts = { faturamento, hbars, donut, funil, sparkline, waterfall, PALETTE, abbrev };
})(window);
