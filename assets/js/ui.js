/* =========================================================
   ui.js — modais, toasts e componentes reutilizáveis
   ========================================================= */
(function (global) {
  'use strict';

  const root = () => document.getElementById('modalRoot');
  const toastRoot = () => document.getElementById('toastRoot');
  const stack = [];

  /* ---------------- toasts ---------------- */
  function toast(msg, tipo, ms) {
    const el = U.el(`<div class="toast ${tipo ? 'toast--' + tipo : ''}">
      <span>${tipo === 'ok' ? '✅' : tipo === 'err' ? '⚠️' : tipo === 'warn' ? '🔔' : 'ℹ️'}</span>
      <span>${U.esc(msg)}</span></div>`);
    toastRoot().appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 260);
    }, ms || 3000);
  }

  /* ---------------- modal genérico ---------------- */
  /**
   * modal({ titulo, subtitulo, corpo, rodape, tamanho, aoAbrir })
   * corpo/rodape aceitam string HTML ou HTMLElement.
   */
  function modal(cfg) {
    const o = Object.assign({ titulo: '', subtitulo: '', corpo: '', rodape: '', tamanho: '' }, cfg || {});
    const wrap = U.el(`<div class="modal" role="dialog" aria-modal="true" aria-label="${U.esc(o.titulo)}">
      <div class="modal__backdrop" data-close></div>
      <div class="modal__panel ${o.tamanho ? 'modal__panel--' + o.tamanho : ''}">
        <div class="modal__grab" data-close></div>
        <div class="modal__head">
          <div>
            <h2>${o.titulo}</h2>
            ${o.subtitulo ? `<p>${o.subtitulo}</p>` : ''}
          </div>
          <button class="icon-btn" data-close aria-label="Fechar">✕</button>
        </div>
        <div class="modal__body"></div>
        <div class="modal__foot"></div>
      </div>
    </div>`);

    const body = wrap.querySelector('.modal__body');
    const foot = wrap.querySelector('.modal__foot');
    append(body, o.corpo);
    append(foot, o.rodape);
    if (!foot.childNodes.length) foot.remove();

    root().appendChild(wrap);
    document.body.style.overflow = 'hidden';
    stack.push(wrap);

    const close = () => {
      wrap.remove();
      const i = stack.indexOf(wrap);
      if (i > -1) stack.splice(i, 1);
      if (!stack.length) document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
    function onKey(e) { if (e.key === 'Escape' && stack[stack.length - 1] === wrap) close(); }
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', e => { if (e.target.hasAttribute('data-close')) close(); });

    const api = { el: wrap, body: body, foot: foot, close: close };
    if (o.aoAbrir) o.aoAbrir(api);

    // foco no primeiro campo
    setTimeout(() => {
      const f = wrap.querySelector('input:not([type=hidden]),select,textarea');
      if (f && window.matchMedia('(min-width:1024px)').matches) f.focus();
    }, 90);

    return api;
  }

  function append(parent, content) {
    if (!content) return;
    if (typeof content === 'string') parent.innerHTML = content;
    else if (Array.isArray(content)) content.forEach(c => append(parent, c));
    else parent.appendChild(content);
  }

  /* ---------------- confirmação ---------------- */
  function confirmar(cfg) {
    const o = Object.assign({
      titulo: 'Confirmar', mensagem: 'Deseja continuar?',
      confirmar: 'Confirmar', cancelar: 'Cancelar', perigo: false
    }, cfg || {});
    return new Promise(resolve => {
      const m = modal({
        titulo: o.titulo, tamanho: 'sm',
        corpo: `<p class="small">${o.mensagem}</p>`,
        rodape: `<button class="btn btn--soft" data-no>${U.esc(o.cancelar)}</button>
                 <button class="btn ${o.perigo ? 'btn--red' : 'btn--ink'}" data-yes>${U.esc(o.confirmar)}</button>`
      });
      m.foot.querySelector('[data-no]').onclick = () => { m.close(); resolve(false); };
      m.foot.querySelector('[data-yes]').onclick = () => { m.close(); resolve(true); };
    });
  }

  /* ---------------- badges e rótulos ---------------- */
  function badge(cfgItem, extra) {
    if (!cfgItem) return '<span class="badge">—</span>';
    return `<span class="badge badge--${cfgItem.cor || 'gray'}">${cfgItem.emoji ? cfgItem.emoji + ' ' : ''}${U.esc(cfgItem.nome)}${extra ? ' ' + extra : ''}</span>`;
  }

  function avatar(nome, size) {
    const cor = U.colorFor(nome);
    const s = size || 36;
    return `<div class="listrow__avatar" style="background:${cor};width:${s}px;height:${s}px;flex-basis:${s}px;font-size:${Math.round(s / 2.7)}px">${U.esc(U.initials(nome))}</div>`;
  }

  function trend(valorPct, opts) {
    const o = opts || {};
    const v = Number(valorPct) || 0;
    const cls = Math.abs(v) < 0.05 ? 'flat' : (v > 0 ? 'up' : 'down');
    const seta = cls === 'up' ? '▲' : cls === 'down' ? '▼' : '■';
    const inverter = o.inverter && cls !== 'flat';
    const clsFinal = inverter ? (cls === 'up' ? 'down' : 'up') : cls;
    return `<span class="trend trend--${clsFinal}">${seta} ${U.pct(Math.abs(v))}</span>`;
  }

  /* ---------------- KPI card ---------------- */
  /** kpi({icone, titulo, valor, cor, linhas:[{label,valor}], rodape}) */
  function kpi(o) {
    const cores = {
      fire: ['#E8400D', '#FDE8DD'],
      blue: ['#2563eb', '#dbeafe'], green: ['#047857', '#d1fae5'], gold: ['#B45309', '#FEF3C7'],
      red: ['#A31031', '#FCE4EA'], purple: ['#6D28D9', '#ede9fe'], orange: ['#B45309', '#FEF0D9'],
      ink: ['#2A1E17', '#EFE7E1'], cyan: ['#0891b2', '#cffafe']
    };
    const c = cores[o.cor || 'blue'] || cores.blue;
    const linhas = (o.linhas || []).map(l =>
      `<div class="kpi__row"><span>${l.label}</span><b>${l.valor}</b></div>`).join('');
    return `<div class="kpi" style="--kpi-c:${c[0]};--kpi-bg:${c[1]}">
      <div class="kpi__top">
        <div class="kpi__icon">${o.icone || '📊'}</div>
        <div><div class="kpi__title">${U.esc(o.titulo)}</div></div>
      </div>
      <div class="kpi__value">${o.valor}</div>
      ${o.sub ? `<div class="small muted mt-sm">${o.sub}</div>` : ''}
      ${linhas ? `<div class="kpi__rows">${linhas}</div>` : ''}
    </div>`;
  }

  /* ---------------- estado vazio ---------------- */
  function vazio(o) {
    const c = Object.assign({ icone: '📭', titulo: 'Nada por aqui ainda', texto: '', acao: '' }, o || {});
    return `<div class="empty">
      <div class="empty__icon">${c.icone}</div>
      <h3>${U.esc(c.titulo)}</h3>
      ${c.texto ? `<p>${U.esc(c.texto)}</p>` : ''}
      ${c.acao || ''}
    </div>`;
  }

  /* ---------------- tabela ---------------- */
  /**
   * tabela({colunas:[{titulo, campo, classe, render(item), sortable}], itens, ordenacao, vazio})
   * Retorna HTML. A ordenação é controlada pela view.
   */
  function tabela(cfg) {
    const cols = cfg.colunas || [];
    const itens = cfg.itens || [];
    if (!itens.length) return vazio(cfg.vazio || { titulo: 'Nenhum registro encontrado' });

    const head = cols.map(c =>
      `<th class="${c.classe || ''} ${c.sortable ? 'sortable' : ''}" ${c.sortable ? `data-sort="${c.campo}"` : ''}>
        ${U.esc(c.titulo)}${c.sortable && cfg.ordenacao && cfg.ordenacao.campo === c.campo
          ? (cfg.ordenacao.dir === 'asc' ? ' ▲' : ' ▼') : ''}
      </th>`).join('');

    const body = itens.map((it, idx) => {
      const tds = cols.map(c => `<td class="${c.classe || ''}">${c.render ? c.render(it, idx) : U.esc(it[c.campo])}</td>`).join('');
      return `<tr data-id="${U.esc(it.id || '')}" data-idx="${idx}">${tds}</tr>`;
    }).join('');

    const foot = cfg.rodape
      ? `<tfoot><tr>${cols.map(c => `<td class="${c.classe || ''}">${cfg.rodape[c.campo] !== undefined ? cfg.rodape[c.campo] : ''}</td>`).join('')}</tr></tfoot>`
      : '';

    return `<div class="tablewrap"><table class="tbl">
      <thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></div>`;
  }

  /* ---------------- seletor de período ---------------- */
  const PERIODOS = [
    { id: 'hoje', nome: 'Hoje' },
    { id: 'semana', nome: 'Esta semana' },
    { id: 'mes', nome: 'Este mês' },
    { id: 'trimestre', nome: 'Este trimestre' },
    { id: 'ano', nome: 'Este ano' },
    { id: '12m', nome: '12 meses' },
    { id: 'tudo', nome: 'Tudo' },
    { id: 'custom', nome: 'Personalizado' }
  ];

  function periodoChips(ativo) {
    return `<div class="chips chips--scroll" data-periodo>
      ${PERIODOS.map(p => `<button class="chip ${p.id === ativo ? 'is-active' : ''}" data-p="${p.id}">${p.nome}</button>`).join('')}
    </div>`;
  }

  /** abre o seletor de datas personalizado */
  function periodoCustom(atual, onOk) {
    const m = modal({
      titulo: '📅 Período personalizado', tamanho: 'sm',
      corpo: `<div class="formgrid">
        <div class="field"><label>De</label><input type="date" class="input" id="pcDe" value="${U.esc(atual.de)}"></div>
        <div class="field"><label>Até</label><input type="date" class="input" id="pcAte" value="${U.esc(atual.ate)}"></div>
      </div>`,
      rodape: `<button class="btn btn--soft" data-close>Cancelar</button><button class="btn btn--ink" data-ok>Aplicar</button>`
    });
    m.foot.querySelector('[data-ok]').onclick = () => {
      const de = m.body.querySelector('#pcDe').value;
      const ate = m.body.querySelector('#pcAte').value;
      if (!de || !ate) return toast('Informe as duas datas.', 'err');
      if (de > ate) return toast('A data inicial deve ser anterior à final.', 'err');
      m.close();
      onOk({ de: de, ate: ate, label: U.fmtDate(de) + ' a ' + U.fmtDate(ate) });
    };
  }

  /* ---------------- link + QR Code ---------------- */
  function linkBox(url, opts) {
    const o = opts || {};
    if (!url) {
      return `<div class="linkbox"><code class="muted">Nenhum link de cadastro definido</code>
        ${o.editavel ? `<button class="btn btn--xs btn--ghost" data-link-edit>✏️ Definir</button>` : ''}</div>`;
    }
    return `<div class="linkbox">
      <code>${U.esc(url)}</code>
      <button class="btn btn--xs btn--ghost" data-link-copy="${U.esc(url)}" title="Copiar link">📋 Copiar</button>
      <button class="btn btn--xs btn--ghost" data-link-open="${U.esc(url)}" title="Abrir link">🔗 Abrir</button>
      <button class="btn btn--xs btn--ghost" data-link-qr="${U.esc(url)}" title="Gerar QR Code">⬛ QR</button>
      ${o.editavel ? `<button class="btn btn--xs btn--ghost" data-link-edit title="Editar link">✏️</button>` : ''}
    </div>`;
  }

  function abrirQR(url, titulo) {
    let conteudo;
    try {
      conteudo = `<div class="qrbox">${QRCode.toSVG(url, { scale: 5, margin: 3 })}
        <code class="mono muted center" style="word-break:break-all">${U.esc(url)}</code></div>`;
    } catch (e) {
      conteudo = `<div class="notice notice--warn">⚠️ ${U.esc(e.message)}</div>`;
    }
    const m = modal({
      titulo: '⬛ QR Code', subtitulo: titulo ? U.esc(titulo) : 'Aponte a câmera para abrir o cadastro',
      tamanho: 'sm', corpo: conteudo,
      rodape: `<button class="btn btn--soft" data-close>Fechar</button>
               <button class="btn btn--ghost" data-baixar>📥 Baixar SVG</button>
               <button class="btn btn--ink" data-copiar>📋 Copiar link</button>`
    });
    const b = m.foot.querySelector('[data-baixar]');
    if (b) b.onclick = () => {
      try {
        U.download('qrcode-' + U.slug(titulo || 'cadastro') + '.svg', QRCode.toSVG(url, { scale: 8, margin: 4 }), 'image/svg+xml');
        toast('QR Code baixado.', 'ok');
      } catch (e) { toast(e.message, 'err'); }
    };
    const c = m.foot.querySelector('[data-copiar]');
    if (c) c.onclick = async () => {
      const ok = await U.copy(url);
      toast(ok ? 'Link copiado!' : 'Não foi possível copiar.', ok ? 'ok' : 'err');
    };
  }

  /** delegação global das ações de link */
  document.addEventListener('click', async function (e) {
    const copy = e.target.closest('[data-link-copy]');
    if (copy) {
      const ok = await U.copy(copy.getAttribute('data-link-copy'));
      toast(ok ? 'Link copiado para a área de transferência!' : 'Não foi possível copiar o link.', ok ? 'ok' : 'err');
      return;
    }
    const open = e.target.closest('[data-link-open]');
    if (open) {
      const url = open.getAttribute('data-link-open');
      window.open(/^https?:\/\//i.test(url) ? url : 'https://' + url, '_blank', 'noopener');
      return;
    }
    const qr = e.target.closest('[data-link-qr]');
    if (qr) { abrirQR(qr.getAttribute('data-link-qr'), qr.getAttribute('data-link-titulo') || ''); }
  });

  /* ---------------- exportação ---------------- */
  function exportarPDF(titulo) {
    toast('Abrindo a janela de impressão — escolha "Salvar como PDF".', 'info', 4200);
    const antes = document.title;
    document.title = titulo || 'CRM de Produtos da Firece — Relatório';
    setTimeout(() => {
      window.print();
      document.title = antes;
    }, 320);
  }

  /* ---------------- helpers de formulário ---------------- */
  function opcoes(lista, selecionado, opts) {
    const o = opts || {};
    const itens = (lista || []).map(x => {
      const val = typeof x === 'string' ? x : x.id;
      const txt = typeof x === 'string' ? x : ((x.emoji ? x.emoji + ' ' : '') + x.nome);
      return `<option value="${U.esc(val)}" ${val === selecionado ? 'selected' : ''}>${U.esc(txt)}</option>`;
    }).join('');
    return (o.vazio ? `<option value="">${U.esc(o.vazio)}</option>` : '') + itens;
  }

  function campo(o) {
    const id = o.id || o.name;
    const req = o.obrigatorio ? ' <span class="req">*</span>' : '';
    let controle;
    if (o.tipo === 'select') {
      controle = `<select class="input" name="${o.name}" id="${id}" ${o.obrigatorio ? 'required' : ''} ${o.attrs || ''}>${o.opcoes}</select>`;
    } else if (o.tipo === 'textarea') {
      controle = `<textarea class="input" name="${o.name}" id="${id}" placeholder="${U.esc(o.placeholder || '')}" ${o.attrs || ''}>${U.esc(o.valor || '')}</textarea>`;
    } else {
      controle = `<input class="input" type="${o.tipo || 'text'}" name="${o.name}" id="${id}"
        value="${U.esc(o.valor === undefined || o.valor === null ? '' : o.valor)}"
        placeholder="${U.esc(o.placeholder || '')}" ${o.obrigatorio ? 'required' : ''} ${o.attrs || ''}>`;
    }
    return `<div class="field ${o.full ? 'field--full' : ''}">
      <label for="${id}">${U.esc(o.label)}${req}</label>
      ${controle}
      ${o.hint ? `<span class="field__hint">${o.hint}</span>` : ''}
    </div>`;
  }

  /** lê um <form> como objeto simples */
  function lerForm(form) {
    const out = {};
    new FormData(form).forEach((v, k) => {
      if (out[k] !== undefined) {
        if (!Array.isArray(out[k])) out[k] = [out[k]];
        out[k].push(v);
      } else out[k] = v;
    });
    form.querySelectorAll('input[type=checkbox]').forEach(c => { out[c.name] = c.checked; });
    return out;
  }

  function validar(form, regras) {
    let ok = true;
    form.querySelectorAll('.is-error').forEach(e => e.classList.remove('is-error'));
    form.querySelectorAll('.error-msg').forEach(e => e.remove());
    (regras || []).forEach(r => {
      const el = form.querySelector('[name="' + r.campo + '"]');
      if (!el) return;
      const val = el.value;
      if (!r.teste(val)) {
        ok = false;
        el.classList.add('is-error');
        const msg = U.el(`<span class="error-msg">${U.esc(r.msg)}</span>`);
        el.parentNode.appendChild(msg);
      }
    });
    if (!ok) {
      const first = form.querySelector('.is-error');
      if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
    }
    return ok;
  }

  global.UI = {
    toast, modal, confirmar, badge, avatar, trend, kpi, vazio, tabela,
    periodoChips, periodoCustom, PERIODOS, linkBox, abrirQR, exportarPDF,
    opcoes, campo, lerForm, validar
  };
})(window);
