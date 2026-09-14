/* =========================================================
   views/desempenho.js — desempenho por produto
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { periodo: '12m', custom: null, ordem: { campo: 'faturamento', dir: 'desc' }, categoria: '' };

  function rangeAtual() {
    return estado.periodo === 'custom' && estado.custom
      ? Object.assign({ label: 'Personalizado' }, estado.custom) : U.range(estado.periodo);
  }

  const ORDENACOES = [
    { id: 'faturamento', nome: 'Maior faturamento' },
    { id: 'vendasQtd', nome: 'Mais vendas' },
    { id: 'margemPct', nome: 'Maior margem' },
    { id: 'ticketMedio', nome: 'Maior ticket' },
    { id: 'pior', nome: 'Menor desempenho' }
  ];

  function dados() {
    const r = rangeAtual();
    let arr = M.crescimentoProdutos(r);
    if (estado.categoria) arr = arr.filter(d => d.produto.categoriaId === estado.categoria);
    if (estado.ordem.campo === 'pior') return U.sortBy(arr, d => d.faturamento, 'asc');
    return U.sortBy(arr, d => d[estado.ordem.campo], estado.ordem.dir);
  }

  Views.desempenho = {
    titulo: '📊 Desempenho dos Produtos',
    subtitulo: 'Quanto cada produto vende, fatura e entrega de margem',

    render() {
      const r = rangeAtual();
      const arr = dados();
      const fat = M.faturamento(r);
      const totalVendas = U.sum(arr, d => d.vendasQtd);
      const totalFat = U.sum(arr, d => d.faturamento);
      const totalLiq = U.sum(arr, d => d.liquido);

      return `
      <div class="card mb">
        <div class="spread mb"><h2 style="font-size:15px">Período analisado: ${U.esc(r.label)}</h2>
          <span class="small muted">${U.fmtDate(r.de)} a ${U.fmtDate(r.ate)}</span></div>
        ${UI.periodoChips(estado.periodo)}
      </div>

      <div class="grid grid--4 mb">
        ${UI.kpi({ icone: '📦', titulo: 'Produtos com venda', valor: U.num(arr.filter(d => d.vendasQtd > 0).length), cor: 'purple', sub: 'de ' + arr.length + ' cadastrados' })}
        ${UI.kpi({ icone: '🧾', titulo: 'Vendas no período', valor: U.num(totalVendas), cor: 'blue' })}
        ${UI.kpi({ icone: '💰', titulo: 'Faturamento', valor: U.money0(totalFat), cor: 'gold' })}
        ${UI.kpi({ icone: '📈', titulo: 'Margem média', valor: U.pct(totalFat > 0 ? (totalLiq / totalFat) * 100 : 0), cor: 'green' })}
      </div>

      <div class="card card--pad0 mb">
        <div class="card__head">
          <h2>📦 Desempenho dos Produtos</h2>
          <div class="hstack">
            <select class="input input--sm" id="fCat" style="max-width:180px">${UI.opcoes(Store.config.categorias, estado.categoria, { vazio: 'Todas categorias' })}</select>
            <select class="input input--sm" id="fOrd" style="max-width:190px">
              ${ORDENACOES.map(o => `<option value="${o.id}" ${estado.ordem.campo === o.id ? 'selected' : ''}>${o.nome}</option>`).join('')}
            </select>
            <button class="btn btn--sm btn--ghost" data-exportar>📥 Excel</button>
          </div>
        </div>
        <div class="card__body">
          ${UI.tabela({
            itens: arr,
            ordenacao: { campo: estado.ordem.campo, dir: estado.ordem.dir },
            colunas: [
              {
                titulo: 'Produto', campo: 'produto', render: d =>
                  `<div class="cellmain"><b>${U.esc(d.produto.nome)}</b>
                    <small>${U.esc((d.categoria || {}).nome || '')} · ${U.esc((d.status || {}).nome || '')}</small></div>`
              },
              { titulo: 'Vendas', campo: 'vendasQtd', classe: 'num', sortable: true, render: d => U.num(d.vendasQtd) },
              { titulo: 'Faturamento', campo: 'faturamento', classe: 'num', sortable: true, render: d => `<b>${U.money(d.faturamento)}</b>` },
              { titulo: 'Clientes', campo: 'clientes', classe: 'num', render: d => U.num(d.clientes) },
              { titulo: 'Ticket médio', campo: 'ticketMedio', classe: 'num', sortable: true, render: d => U.money(d.ticketMedio) },
              {
                titulo: 'Margem', campo: 'margemPct', classe: 'num', sortable: true, render: d =>
                  `<b class="${d.margemPct >= 30 ? 'pos' : d.margemPct < 0 ? 'neg' : ''}">${U.pct(d.margemPct)}</b>`
              },
              {
                titulo: 'Participação', campo: 'participacaoPct', classe: 'num', render: d =>
                  `<div style="min-width:96px">
                    <div class="tiny" style="text-align:right">${U.pct(d.participacaoPct)}</div>
                    <div class="bar-track" style="height:5px"><div class="bar-fill" style="width:${U.clamp(d.participacaoPct, 0, 100)}%;background:#2563eb"></div></div>
                  </div>`
              },
              {
                titulo: 'Crescimento', campo: 'crescimentoPct', classe: 'num', sortable: true, render: d =>
                  d.faturamentoAnterior || d.faturamento ? UI.trend(d.crescimentoPct) : '<span class="tiny muted">—</span>'
              },
              { titulo: 'Carteira', campo: 'carteira', classe: 'num', render: d => U.money0(d.carteira) },
              { titulo: 'Pipeline', campo: 'pipelineValor', classe: 'num', render: d => `<div class="cellmain" style="text-align:right"><b>${U.money0(d.pipelineValor)}</b><small>${d.pipelineQtd} oport.</small></div>` },
              { titulo: '', campo: 'acoes', classe: 'num', render: d => `<button class="icon-btn" data-ver="${d.produto.id}" title="Ver ficha">👁️</button>` }
            ],
            rodape: {
              produto: '<b>TOTAL</b>',
              vendasQtd: '<b>' + U.num(totalVendas) + '</b>',
              faturamento: '<b>' + U.money(totalFat) + '</b>',
              ticketMedio: '<b>' + U.money(totalVendas ? totalFat / totalVendas : 0) + '</b>',
              margemPct: '<b>' + U.pct(totalFat > 0 ? (totalLiq / totalFat) * 100 : 0) + '</b>',
              participacaoPct: '<b>100%</b>'
            },
            vazio: { icone: '📊', titulo: 'Sem vendas no período', texto: 'Escolha outro período ou registre vendas.' }
          })}
        </div>
      </div>

      <div class="grid grid--2">
        <div class="card card--pad0">
          <div class="card__head"><h2>💰 Faturamento por produto</h2></div>
          <div class="card__body">
            ${Charts.hbars(U.sortBy(arr, d => d.faturamento, 'desc').filter(d => d.faturamento > 0).slice(0, 8)
              .map(d => ({ label: d.produto.nome, valor: d.faturamento, sub: U.pct(d.participacaoPct) + ' do total' })))}
          </div>
        </div>
        <div class="card card--pad0">
          <div class="card__head"><h2>📈 Margem por produto</h2></div>
          <div class="card__body">
            ${Charts.hbars(U.sortBy(arr.filter(d => d.vendasQtd > 0), d => d.margemPct, 'desc').slice(0, 8)
              .map(d => ({ label: d.produto.nome, valor: d.margemPct, cor: d.margemPct >= 30 ? '#047857' : d.margemPct >= 15 ? '#D97706' : '#C4183C' })),
              { formato: v => U.pct(v) })}
          </div>
        </div>
      </div>

      <div class="card card--pad0 mt">
        <div class="card__head"><h2>💵 Faturamento total: ${U.money(fat.bruto)}</h2>
          <p>Líquido ${U.money(fat.liquido)} · margem ${U.pct(fat.margemPct)}</p></div>
      </div>`;
    },

    mount(el) {
      el.querySelectorAll('[data-periodo] .chip').forEach(b => {
        b.onclick = () => {
          const p = b.getAttribute('data-p');
          if (p === 'custom') return UI.periodoCustom(estado.custom || U.range('mes'),
            c => { estado.custom = c; estado.periodo = 'custom'; App.render(); });
          estado.periodo = p; App.render();
        };
      });
      const ord = el.querySelector('#fOrd');
      if (ord) ord.onchange = e => {
        estado.ordem = { campo: e.target.value, dir: e.target.value === 'pior' ? 'asc' : 'desc' };
        App.render();
      };
      const cat = el.querySelector('#fCat');
      if (cat) cat.onchange = e => { estado.categoria = e.target.value; App.render(); };

      el.querySelectorAll('th.sortable').forEach(th => {
        th.onclick = () => {
          const campo = th.getAttribute('data-sort');
          estado.ordem = estado.ordem.campo === campo
            ? { campo: campo, dir: estado.ordem.dir === 'asc' ? 'desc' : 'asc' }
            : { campo: campo, dir: 'desc' };
          App.render();
        };
      });
      el.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => Forms.detalheProduto(b.getAttribute('data-ver')));

      const exp = el.querySelector('[data-exportar]');
      if (exp) exp.onclick = () => {
        U.exportCSV('desempenho-produtos',
          ['Produto', 'Categoria', 'Status', 'Vendas', 'Faturamento', 'Líquido', 'Clientes', 'Ticket médio', 'Margem %', 'Participação %', 'Crescimento %', 'Carteira', 'Pipeline'],
          dados().map(d => [d.produto.nome, (d.categoria || {}).nome, (d.status || {}).nome,
            d.vendasQtd, d.faturamento, d.liquido, d.clientes, d.ticketMedio,
            d.margemPct, d.participacaoPct, U.round2(d.crescimentoPct), d.carteira, d.pipelineValor]));
        UI.toast('Relatório de desempenho exportado.', 'ok');
      };
    }
  };
})(window);
