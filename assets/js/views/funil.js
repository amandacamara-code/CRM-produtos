/* =========================================================
   views/funil.js — kanban do funil de vendas
   Arrastar o card entre etapas dispara as regras automáticas.
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { busca: '', produto: '', responsavel: '', prioridade: '', mostrarEncerradas: false };
  let arrastando = null;

  function oportunidades() {
    let arr = Store.scope(Store.list('oportunidades'));
    const q = U.norm(estado.busca);
    if (q) arr = arr.filter(o => {
      const c = Store.L.cliente(o.clienteId) || {};
      return U.norm(c.nome).indexOf(q) > -1 || U.norm(c.empresa).indexOf(q) > -1 ||
        U.norm(Store.L.nomeProduto(o.produtoId)).indexOf(q) > -1;
    });
    if (estado.produto) arr = arr.filter(o => o.produtoId === estado.produto);
    if (estado.responsavel) arr = arr.filter(o => o.responsavelId === estado.responsavel);
    if (estado.prioridade) arr = arr.filter(o => o.prioridadeId === estado.prioridade);
    return arr;
  }

  function cardHTML(o, pode) {
    const cli = Store.L.cliente(o.clienteId) || {};
    const prio = Store.L.prioridade(o.prioridadeId) || {};
    const corPrio = { red: '#C4183C', gold: '#EAB308', green: '#0E9F6E' }[prio.cor] || '#DACFC7';
    return `<article class="kcard" draggable="${pode ? 'true' : 'false'}" data-id="${o.id}" tabindex="0">
      <div class="prio-bar" style="background:${corPrio}" title="Prioridade ${U.esc(prio.nome || '')}"></div>
      <div class="kcard__top">
        <div style="min-width:0">
          <div class="kcard__name">${U.esc(cli.nome || '—')}</div>
          <div class="kcard__prod">${U.esc(Store.L.nomeProduto(o.produtoId))}</div>
        </div>
      </div>
      <div class="kcard__val">${U.money(o.valor)}</div>
      <div class="kcard__meta">
        <span title="Responsável">👤 ${U.esc(U.truncate(Store.L.nomeUsuario(o.responsavelId), 16))}</span>
        <span title="Data do cadastro">📅 ${U.fmtDateShort(o.data)}</span>
      </div>
      ${pode ? `<div class="kcard__move">
        <button class="btn btn--xs btn--soft" data-mover="-1" title="Etapa anterior">←</button>
        <button class="btn btn--xs btn--soft" style="flex:1" data-ver="${o.id}">Detalhes</button>
        <button class="btn btn--xs btn--soft" data-mover="1" title="Próxima etapa">→</button>
      </div>` : ''}
    </article>`;
  }

  Views.funil = {
    titulo: '🎯 Funil de Vendas',
    subtitulo: 'Arraste os cards entre as etapas — os indicadores se atualizam sozinhos',

    render() {
      const arr = oportunidades();
      const pode = Store.podeEditar();
      const temFiltro = !!(estado.busca || estado.produto || estado.responsavel || estado.prioridade);
      const etapas = Store.etapasFunil().filter(e => estado.mostrarEncerradas ? true : !e.perdido);
      const pipe = M.pipeline();

      const colunas = etapas.map(e => {
        const itens = U.sortBy(arr.filter(o => o.etapaId === e.id), o => o.valor, 'desc');
        const corMap = { blue: '#2563eb', purple: '#7c3aed', orange: '#D97706', gold: '#EAB308', green: '#0E9F6E', red: '#C4183C' };
        return `<section class="kcol" data-etapa="${e.id}">
          <header class="kcol__head">
            <div class="kcol__title">
              <span class="dot" style="background:${corMap[e.cor] || '#64748b'}"></span>
              ${U.esc(e.nome)}
              <span class="kcol__count">${itens.length}</span>
            </div>
            <div class="kcol__sum">${U.money0(U.sum(itens, o => o.valor))}</div>
          </header>
          <div class="kcol__body">
            ${itens.map(o => cardHTML(o, pode)).join('') ||
              `<p class="tiny muted center" style="padding:14px 4px">Nenhuma oportunidade nesta etapa.</p>`}
          </div>
        </section>`;
      }).join('');

      return `
      <div class="grid grid--4 mb">
        ${UI.kpi({ icone: '🎯', titulo: 'Pipeline aberto', valor: U.money0(pipe.valor), cor: 'orange', sub: pipe.qtd + ' oportunidades' })}
        ${UI.kpi({ icone: '📈', titulo: 'Taxa de conversão', valor: U.pct(pipe.taxaConversao), cor: 'green', sub: pipe.ganhas + ' ganhas · ' + pipe.perdidas + ' perdidas' })}
        ${UI.kpi({ icone: '💵', titulo: 'Ticket médio no funil', valor: U.money0(pipe.ticketMedio), cor: 'blue' })}
        ${UI.kpi({ icone: '🏁', titulo: 'Valor já ganho', valor: U.money0(pipe.valorGanho), cor: 'ink' })}
      </div>

      <details class="filtrobox" ${temFiltro ? 'open' : ''}>
        <summary>🔎 Buscar e filtrar${temFiltro ? ' <span class="badge badge--gold">filtros ativos</span>' : ''}</summary>
        <div class="filtrobox__body toolbar" style="margin:0">
          <div class="searchbar"><input class="input input--sm" id="fBusca" placeholder="Buscar cliente ou produto…" value="${U.esc(estado.busca)}"></div>
          <select class="input input--sm" id="fProduto" style="max-width:190px">${UI.opcoes(Store.list('produtos'), estado.produto, { vazio: 'Todos os produtos' })}</select>
          <select class="input input--sm" id="fResp" style="max-width:190px">${UI.opcoes(Store.list('usuarios'), estado.responsavel, { vazio: 'Todos responsáveis' })}</select>
          <select class="input input--sm" id="fPrio" style="max-width:160px">${UI.opcoes(Store.config.prioridades, estado.prioridade, { vazio: 'Todas prioridades' })}</select>
          <label class="switch"><input type="checkbox" id="fEncerradas" ${estado.mostrarEncerradas ? 'checked' : ''}><span class="small">Mostrar canceladas</span></label>
          ${Store.podeEditar() ? `<button class="btn btn--sm btn--fire" data-novo style="margin-left:auto">＋ Nova oportunidade</button>` : ''}
        </div>
      </details>

      <div class="notice mb no-print">💡 Arraste um card para outra etapa (ou use as setas ← →).
        Ao chegar em <b>PAGO</b> ou <b>FECHADO</b>, a venda é registrada e o faturamento, a carteira e os gráficos são atualizados automaticamente.</div>

      <div class="kanban">${colunas}</div>`;
    },

    mount(el) {
      const pode = Store.podeEditar();

      const busca = el.querySelector('#fBusca');
      if (busca) busca.oninput = U.debounce(e => {
        estado.busca = e.target.value; App.render();
        const b = document.getElementById('fBusca');
        if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
      }, 280);
      const bind = (id, prop) => {
        const s = el.querySelector(id);
        if (s) s.onchange = e => { estado[prop] = e.target.value; App.render(); };
      };
      bind('#fProduto', 'produto'); bind('#fResp', 'responsavel'); bind('#fPrio', 'prioridade');
      const chk = el.querySelector('#fEncerradas');
      if (chk) chk.onchange = e => { estado.mostrarEncerradas = e.target.checked; App.render(); };
      const novo = el.querySelector('[data-novo]');
      if (novo) novo.onclick = () => Forms.cadastro();

      el.querySelectorAll('[data-ver]').forEach(b => {
        b.onclick = e => { e.stopPropagation(); Forms.detalheOportunidade(b.getAttribute('data-ver')); };
      });

      el.querySelectorAll('.kcard').forEach(card => {
        const id = card.getAttribute('data-id');
        card.addEventListener('click', e => {
          if (e.target.closest('button')) return;
          Forms.detalheOportunidade(id);
        });
        card.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); Forms.detalheOportunidade(id); }
        });
        if (!pode) return;
        card.addEventListener('dragstart', e => {
          arrastando = id;
          card.classList.add('is-dragging');
          try { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; } catch (err) { /* noop */ }
        });
        card.addEventListener('dragend', () => {
          arrastando = null;
          card.classList.remove('is-dragging');
          el.querySelectorAll('.kcol').forEach(c => c.classList.remove('is-over'));
        });
        // setas para mover em telas sem drag (celular)
        card.querySelectorAll('[data-mover]').forEach(btn => {
          btn.onclick = e => {
            e.stopPropagation();
            const passo = Number(btn.getAttribute('data-mover'));
            const etapas = Store.etapasFunil();
            const op = Store.get('oportunidades', id);
            const idx = etapas.findIndex(x => x.id === op.etapaId);
            const alvo = etapas[U.clamp(idx + passo, 0, etapas.length - 1)];
            if (!alvo || alvo.id === op.etapaId) return;
            aplicar(id, alvo.id);
          };
        });
      });

      if (!pode) return;
      el.querySelectorAll('.kcol').forEach(col => {
        col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('is-over'); e.dataTransfer.dropEffect = 'move'; });
        col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('is-over'); });
        col.addEventListener('drop', e => {
          e.preventDefault();
          col.classList.remove('is-over');
          let id = arrastando;
          try { id = e.dataTransfer.getData('text/plain') || arrastando; } catch (err) { /* noop */ }
          if (!id) return;
          const etapaId = col.getAttribute('data-etapa');
          const op = Store.get('oportunidades', id);
          if (!op || op.etapaId === etapaId) return;
          aplicar(id, etapaId);
        });
      });

      function aplicar(id, etapaId) {
        const res = Store.moverEtapa(id, etapaId);
        if (res) {
          const etapa = Store.L.etapa(etapaId);
          UI.toast('Movido para ' + etapa.nome + '.', 'ok');
          res.mensagens.forEach((msg, i) => setTimeout(() => UI.toast(msg, 'info', 4200), (i + 1) * 550));
        }
        App.render();
      }
    }
  };
})(window);
