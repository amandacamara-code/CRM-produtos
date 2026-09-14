/* =========================================================
   util.js — helpers de formatação, datas e cálculo
   ========================================================= */
(function (global) {
  'use strict';

  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const BRL0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  const NUM = new Intl.NumberFormat('pt-BR');

  const U = {
    /* ---------- números ---------- */
    money(v) { return BRL.format(Number(v) || 0); },
    money0(v) { return BRL0.format(Number(v) || 0); },
    /** Formato compacto para cards: R$ 1,2 mi / R$ 84,5 mil */
    moneyShort(v) {
      const n = Number(v) || 0;
      const abs = Math.abs(n);
      if (abs >= 1e6) return 'R$ ' + (n / 1e6).toFixed(abs >= 1e7 ? 1 : 2).replace('.', ',') + ' mi';
      if (abs >= 1e4) return 'R$ ' + (n / 1e3).toFixed(1).replace('.', ',') + ' mil';
      return BRL0.format(n);
    },
    num(v) { return NUM.format(Number(v) || 0); },
    pct(v, digits = 1) {
      const n = Number(v);
      if (!isFinite(n)) return '0%';
      return n.toFixed(digits).replace('.', ',') + '%';
    },
    /** variação percentual entre dois valores, com tratamento de base zero */
    delta(atual, anterior) {
      const a = Number(atual) || 0, b = Number(anterior) || 0;
      if (b === 0) return a === 0 ? 0 : 100;
      return ((a - b) / Math.abs(b)) * 100;
    },
    round2(v) { return Math.round((Number(v) || 0) * 100) / 100; },
    /** interpreta "1.250,50", "1250.5", 1250.5 */
    parseMoney(v) {
      if (typeof v === 'number') return v;
      if (!v) return 0;
      let s = String(v).trim().replace(/[R$\s]/g, '');
      if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
      const n = parseFloat(s);
      return isFinite(n) ? n : 0;
    },

    /* ---------- datas (ISO yyyy-mm-dd, sem fuso) ---------- */
    today() { return U.toISO(new Date()); },
    toISO(d) {
      const dt = (d instanceof Date) ? d : new Date(d);
      const p = n => String(n).padStart(2, '0');
      return dt.getFullYear() + '-' + p(dt.getMonth() + 1) + '-' + p(dt.getDate());
    },
    /** Date local a partir de 'yyyy-mm-dd' (evita shift de timezone) */
    parseISO(s) {
      if (!s) return null;
      if (s instanceof Date) return s;
      const m = String(s).slice(0, 10).split('-');
      if (m.length !== 3) return null;
      const d = new Date(Number(m[0]), Number(m[1]) - 1, Number(m[2]));
      return isNaN(d.getTime()) ? null : d;
    },
    fmtDate(s) {
      const d = U.parseISO(s);
      if (!d) return '—';
      const p = n => String(n).padStart(2, '0');
      return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear();
    },
    fmtDateShort(s) {
      const d = U.parseISO(s);
      if (!d) return '—';
      const p = n => String(n).padStart(2, '0');
      return p(d.getDate()) + '/' + p(d.getMonth() + 1);
    },
    fmtMonth(s) {
      const d = U.parseISO(s);
      if (!d) return '—';
      return ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'][d.getMonth()]
        + '/' + String(d.getFullYear()).slice(2);
    },
    monthName(i) {
      return ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho',
        'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][i] || '';
    },
    addDays(iso, n) {
      const d = U.parseISO(iso) || new Date();
      d.setDate(d.getDate() + n);
      return U.toISO(d);
    },
    addMonths(iso, n) {
      const d = U.parseISO(iso) || new Date();
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
      d.setDate(Math.min(day, U.daysInMonth(d.getFullYear(), d.getMonth())));
      return U.toISO(d);
    },
    daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); },
    diffDays(a, b) {
      const da = U.parseISO(a), db = U.parseISO(b);
      if (!da || !db) return 0;
      return Math.round((da - db) / 86400000);
    },
    /** "há 3 dias" / "em 2 dias" */
    relative(iso) {
      const d = U.diffDays(iso, U.today());
      if (d === 0) return 'hoje';
      if (d === 1) return 'amanhã';
      if (d === -1) return 'ontem';
      if (d > 0) return 'em ' + d + ' dias';
      return 'há ' + Math.abs(d) + ' dias';
    },
    monthKey(iso) { return String(iso || '').slice(0, 7); },
    startOfMonth(d) { const x = U.parseISO(d) || new Date(d); return U.toISO(new Date(x.getFullYear(), x.getMonth(), 1)); },
    endOfMonth(d) { const x = U.parseISO(d) || new Date(d); return U.toISO(new Date(x.getFullYear(), x.getMonth() + 1, 0)); },
    startOfWeek(d) {
      const x = U.parseISO(d) || new Date(d);
      const dow = x.getDay(); // 0 dom
      x.setDate(x.getDate() - dow);
      return U.toISO(x);
    },
    quarterOf(m) { return Math.floor(m / 3); },

    /**
     * Converte um preset de período em { de, ate, label }.
     * presets: hoje | semana | mes | trimestre | ano | 12m | tudo | custom
     */
    range(preset, custom) {
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth();
      const iso = U.toISO(now);
      switch (preset) {
        case 'hoje': return { de: iso, ate: iso, label: 'Hoje' };
        case 'ontem': { const o = U.addDays(iso, -1); return { de: o, ate: o, label: 'Ontem' }; }
        case 'semana': return { de: U.startOfWeek(iso), ate: U.addDays(U.startOfWeek(iso), 6), label: 'Esta semana' };
        case 'mes': return { de: U.toISO(new Date(y, m, 1)), ate: U.toISO(new Date(y, m + 1, 0)), label: 'Este mês' };
        case 'mes_anterior': return { de: U.toISO(new Date(y, m - 1, 1)), ate: U.toISO(new Date(y, m, 0)), label: 'Mês anterior' };
        case 'trimestre': { const q = U.quarterOf(m); return { de: U.toISO(new Date(y, q * 3, 1)), ate: U.toISO(new Date(y, q * 3 + 3, 0)), label: 'Este trimestre' }; }
        case 'ano': return { de: U.toISO(new Date(y, 0, 1)), ate: U.toISO(new Date(y, 11, 31)), label: 'Este ano' };
        case '12m': return { de: U.toISO(new Date(y, m - 11, 1)), ate: U.toISO(new Date(y, m + 1, 0)), label: 'Últimos 12 meses' };
        case 'custom': return { de: (custom && custom.de) || U.toISO(new Date(y, m, 1)), ate: (custom && custom.ate) || iso, label: 'Personalizado' };
        default: return { de: '1900-01-01', ate: '2999-12-31', label: 'Todo o período' };
      }
    },
    /** período anterior de mesma duração (para comparativos) */
    previousRange(r) {
      const dias = Math.max(1, U.diffDays(r.ate, r.de) + 1);
      return { de: U.addDays(r.de, -dias), ate: U.addDays(r.de, -1), label: 'Período anterior' };
    },
    inRange(iso, r) {
      if (!iso || !r) return false;
      const s = String(iso).slice(0, 10);
      return s >= r.de && s <= r.ate;
    },

    /* ---------- strings ---------- */
    esc(s) {
      if (s === null || s === undefined) return '';
      return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    },
    initials(name) {
      const parts = String(name || '?').trim().split(/\s+/).filter(Boolean);
      if (!parts.length) return '?';
      if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    },
    slug(s) {
      return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    },
    /** normaliza para busca: minúsculo e sem acentos */
    norm(s) {
      return String(s === null || s === undefined ? '' : s)
        .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    },
    truncate(s, n) {
      const t = String(s || '');
      return t.length > n ? t.slice(0, n - 1) + '…' : t;
    },
    /** cor determinística a partir de um texto (avatares) */
    colorFor(s) {
      const palette = ['#E8400D', '#7c3aed', '#047857', '#B45309', '#0E8C9E', '#BE185D', '#4338CA', '#8A6A2B'];
      let h = 0;
      const str = String(s || '');
      for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
      return palette[h % palette.length];
    },
    maskDoc(v) {
      const d = String(v || '').replace(/\D/g, '');
      if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
      return v || '';
    },
    maskPhone(v) {
      const d = String(v || '').replace(/\D/g, '');
      if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
      if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
      return v || '';
    },
    isEmail(v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim()); },

    /* ---------- coleções ---------- */
    uid(prefix) {
      return (prefix || 'id') + '_' +
        Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    },
    sum(arr, fn) { return (arr || []).reduce((t, x) => t + (Number(fn ? fn(x) : x) || 0), 0); },
    groupBy(arr, fn) {
      const out = {};
      (arr || []).forEach(x => {
        const k = fn(x);
        (out[k] = out[k] || []).push(x);
      });
      return out;
    },
    sortBy(arr, fn, dir) {
      const d = dir === 'asc' ? 1 : -1;
      return (arr || []).slice().sort((a, b) => {
        const va = fn(a), vb = fn(b);
        if (typeof va === 'string' || typeof vb === 'string') {
          return String(va || '').localeCompare(String(vb || ''), 'pt-BR') * d;
        }
        return ((Number(va) || 0) - (Number(vb) || 0)) * d;
      });
    },
    unique(arr) { return Array.from(new Set(arr || [])); },
    clamp(n, min, max) { return Math.min(max, Math.max(min, n)); },
    safeDiv(a, b) { return (Number(b) || 0) === 0 ? 0 : (Number(a) || 0) / Number(b); },

    /* ---------- DOM ---------- */
    el(html) {
      const t = document.createElement('template');
      t.innerHTML = String(html).trim();
      return t.content.firstElementChild;
    },
    debounce(fn, ms) {
      let t;
      return function () {
        const args = arguments, ctx = this;
        clearTimeout(t);
        t = setTimeout(() => fn.apply(ctx, args), ms || 220);
      };
    },

    /* ---------- exportação ---------- */
    download(filename, content, mime) {
      const blob = (content instanceof Blob) ? content : new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 400);
    },
    /** CSV com separador ';' e BOM — abre direto no Excel pt-BR */
    toCSV(headers, rows) {
      const cell = v => {
        if (v === null || v === undefined) return '';
        const s = String(v).replace(/"/g, '""');
        return /[";\n\r]/.test(s) ? '"' + s + '"' : s;
      };
      const lines = [headers.map(cell).join(';')];
      rows.forEach(r => lines.push(r.map(cell).join(';')));
      return '﻿' + lines.join('\r\n');
    },
    exportCSV(filename, headers, rows) {
      U.download(filename.replace(/\.(csv|xlsx?)$/i, '') + '.csv',
        U.toCSV(headers, rows), 'text/csv;charset=utf-8');
    },
    async copy(text) {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          return true;
        }
      } catch (e) { /* fallback abaixo */ }
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
  };

  global.U = U;
})(window);
