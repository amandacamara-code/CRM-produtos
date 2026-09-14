/* =========================================================
   views/ranking.js — pódio e destaques de produtos
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { periodo: '12m', custom: null };

  function rangeAtual() {
    return estado.periodo === 'custom' && estado.custom
      ? Object.assign({ label: 'Personalizado' }, estado.custom) : U.range(estado.periodo);
  }

  function destaque(titulo, icone, item, valor, sub) {
    if (!item) {
      return `<div class="card"><div class="tiny muted">${icone} ${U.esc(titulo)}</div>
        <div class="muted small mt-sm">Sem dados no período</div></div>`;
    }
    return `<div class="card" data-prod="${item.produto.id}" style="cursor:pointer">
      <div class="tiny muted">${icone} ${U.esc(titulo)}</div>
      <div class="strong mt-sm" style="font-size:15px">${U.esc(item.produto.nome)}</div>
      <div style="font-size:19px;font-weight:750;letter-spacing:-.5px;margin-top:3px">${valor}</div>
      ${sub ? `<div class="tiny muted mt-sm">${sub}</div>` : ''}
    </div>`;
  }

  Views.ranking = {
    titulo: '🏆 Ranking de Produtos',
    subtitulo: 'Quem mais fatura, mais vende, entrega mais margem e mais cresce',

    render() {
      const r = rangeAtual();
      const rk = M.ranking(r);
      const podio = rk.porFaturamento.filter(d => d.faturamento > 0).slice(0, 3);
      const medalhas = ['🥇', '🥈', '🥉'];
      const posicoes = ['1º lugar', '2º lugar', '3º lugar'];

      return `
      <div class="card mb no-print">
        <div class="spread mb"><h2 style="font-size:15px">Período: ${U.esc(r.label)}</h2>
          <span class="small muted">${U.fmtDate(r.de)} a ${U.fmtDate(r.ate)}</span></div>
        ${UI.periodoChips(estado.periodo)}
      </div>

      <section class="section">
        <div class="section__title"><h2>🏆 Pódio por faturamento</h2></div>
        ${podio.length ? `<div class="podium">
          ${podio.map((d, i) => `
            <div class="podium__item podium--${i + 1}" data-prod="${d.produto.id}" data-medal="${medalhas[i]}" style="cursor:pointer">
              <div class="podium__pos">${medalhas[i]} ${posicoes[i]}</div>
              <div class="podium__name">${U.esc(d.produto.nome)}</div>
              <div class="podium__val">${U.money0(d.faturamento)}</div>
              <div class="podium__sub">${d.vendasQtd} vendas · ${d.clientes} clientes · margem ${U.pct(d.margemPct)}</div>
            </div>`).join('')}
        </div>` : UI.vazio({ icone: '🏆', titulo: 'Sem vendas no período', texto: 'Escolha outro período para ver o ranking.' })}
      </section>

      <section class="section">
        <div class="section__title"><h2>⭐ Destaques</h2></div>
        <div class="grid grid--3">
          ${destaque('Produto mais vendido', '🔢', rk.porVendas[0], rk.porVendas[0] ? U.num(rk.porVendas[0].vendasQtd) + ' vendas' : '',
            rk.porVendas[0] ? U.money0(rk.porVendas[0].faturamento) + ' faturados' : '')}
          ${destaque('Maior margem', '📈', rk.porMargem[0], rk.porMargem[0] ? U.pct(rk.porMargem[0].margemPct) : '',
            rk.porMargem[0] ? U.money0(rk.porMargem[0].liquido) + ' de lucro' : '')}
          ${destaque('Maior ticket médio', '🎫', rk.porTicket[0], rk.porTicket[0] ? U.money0(rk.porTicket[0].ticketMedio) : '',
            rk.porTicket[0] ? rk.porTicket[0].vendasQtd + ' vendas' : '')}
          ${destaque('Maior crescimento', '🚀', rk.porCrescimento[0], rk.porCrescimento[0] ? UI.trend(rk.porCrescimento[0].crescimentoPct) : '',
            rk.porCrescimento[0] ? 'de ' + U.money0(rk.porCrescimento[0].faturamentoAnterior) + ' para ' + U.money0(rk.porCrescimento[0].faturamento) : '')}
          ${destaque('Menor desempenho', '⚠️', rk.piorDesempenho[0], rk.piorDesempenho[0] ? U.money0(rk.piorDesempenho[0].faturamento) : '',
            rk.piorDesempenho[0] ? rk.piorDesempenho[0].vendasQtd + ' vendas no período · produto ativo' : '')}
          ${destaque('Maior carteira', '💼', U.sortBy(rk.dados, d => d.carteira, 'desc')[0],
            U.sortBy(rk.dados, d => d.carteira, 'desc')[0] ? U.money0(U.sortBy(rk.dados, d => d.carteira, 'desc')[0].carteira) : '',
            'contratos ativos')}
        </div>
      </section>

      <section class="section">
        <div class="grid grid--2">
          <div class="card card--pad0">
            <div class="card__head"><h2>💰 Ranking por faturamento</h2></div>
            <div class="card__body"><div class="ranklist">
              ${rk.porFaturamento.slice(0, 10).map((d, i) => `
                <div class="rankrow" data-prod="${d.produto.id}" style="cursor:pointer">
                  <div class="rankrow__pos">${i + 1}</div>
                  <div class="rankrow__body">
                    <div class="rankrow__name">${U.esc(d.produto.nome)}</div>
                    <div class="tiny muted">${d.vendasQtd} vendas · ${U.pct(d.participacaoPct)} do total</div>
                  </div>
                  <div class="rankrow__val">${U.money0(d.faturamento)}</div>
                </div>`).join('')}
            </div></div>
          </div>

          <div class="card card--pad0">
            <div class="card__head"><h2>📈 Ranking por margem</h2></div>
            <div class="card__body"><div class="ranklist">
              ${rk.porMargem.slice(0, 10).map((d, i) => `
                <div class="rankrow" data-prod="${d.produto.id}" style="cursor:pointer">
                  <div class="rankrow__pos">${i + 1}</div>
                  <div class="rankrow__body">
                    <div class="rankrow__name">${U.esc(d.produto.nome)}</div>
                    <div class="tiny muted">lucro ${U.money0(d.liquido)}</div>
                  </div>
                  <div class="rankrow__val ${d.margemPct >= 30 ? 'pos' : ''}">${U.pct(d.margemPct)}</div>
                </div>`).join('') || '<p class="small muted center">Sem dados no período.</p>'}
            </div></div>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="card card--pad0">
          <div class="card__head"><h2>📊 Participação no faturamento total</h2>
            <button class="btn btn--sm btn--ghost no-print" data-exportar>📥 Excel</button></div>
          <div class="card__body">
            ${Charts.hbars(rk.porFaturamento.filter(d => d.faturamento > 0).map(d => ({
              label: d.produto.nome, valor: d.faturamento,
              sub: U.pct(d.participacaoPct) + ' · ' + d.vendasQtd + ' vendas'
            })))}
          </div>
        </div>
      </section>`;
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
      el.querySelectorAll('[data-prod]').forEach(b =>
        b.onclick = () => Forms.detalheProduto(b.getAttribute('data-prod')));
      const exp = el.querySelector('[data-exportar]');
      if (exp) exp.onclick = () => {
        const rk = M.ranking(rangeAtual());
        U.exportCSV('ranking-produtos',
          ['Posição', 'Produto', 'Faturamento', 'Participação %', 'Vendas', 'Clientes', 'Ticket médio', 'Margem %', 'Crescimento %', 'Carteira'],
          rk.porFaturamento.map((d, i) => [i + 1, d.produto.nome, d.faturamento, d.participacaoPct,
            d.vendasQtd, d.clientes, d.ticketMedio, d.margemPct, U.round2(d.crescimentoPct), d.carteira]));
        UI.toast('Ranking exportado.', 'ok');
      };
    }
  };
})(window);
