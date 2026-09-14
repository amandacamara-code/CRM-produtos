/* =========================================================
   views/financeiro.js — faturamento, comissões e margem
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = {
    periodo: 'mes', custom: null, granularidade: 'dia',
    produto: '', responsavel: '', status: '', categoria: '',
    ordem: { campo: 'data', dir: 'desc' }
  };

  function rangeAtual() {
    return estado.periodo === 'custom' && estado.custom
      ? Object.assign({ label: 'Personalizado' }, estado.custom) : U.range(estado.periodo);
  }
  function filtros() {
    return {
      produtoId: estado.produto, responsavelId: estado.responsavel,
      categoriaId: estado.categoria,
      statusId: estado.status,
      somenteAtivas: estado.status ? false : true
    };
  }

  Views.financeiro = {
    titulo: '💰 Financeiro',
    subtitulo: 'Faturamento bruto, descontos, comissões, custos e margem',

    render() {
      const r = rangeAtual();
      const f = filtros();
      const fat = M.faturamento(r, f);
      const comp = M.comparativo(r, f);
      const serie = M.serie(r, estado.granularidade, f);
      const comissoes = M.comissoesPorResponsavel(r);
      const pode = Store.podeEditar();

      const vendas = U.sortBy(fat.vendas, {
        data: v => v.dataVenda,
        cliente: v => Store.L.nomeCliente(v.clienteId),
        produto: v => Store.L.nomeProduto(v.produtoId),
        valor: v => v.valorBruto,
        comissao: v => v.comissao,
        liquido: v => v.valorLiquido,
        status: v => (Store.L.statusVenda(v.statusId) || {}).nome
      }[estado.ordem.campo] || (v => v.dataVenda), estado.ordem.dir);

      return `
      <div class="card mb no-print">
        <div class="spread mb">
          <h2 style="font-size:15px">Período: ${U.esc(r.label)}</h2>
          <span class="small muted">${U.fmtDate(r.de)} a ${U.fmtDate(r.ate)}</span>
        </div>
        ${UI.periodoChips(estado.periodo)}
        <div class="filters mt">
          <select class="input input--sm" id="fProduto">${UI.opcoes(Store.list('produtos'), estado.produto, { vazio: 'Todos os produtos' })}</select>
          <select class="input input--sm" id="fCat">${UI.opcoes(Store.config.categorias, estado.categoria, { vazio: 'Todas categorias' })}</select>
          <select class="input input--sm" id="fResp">${UI.opcoes(Store.list('usuarios'), estado.responsavel, { vazio: 'Todos responsáveis' })}</select>
          <select class="input input--sm" id="fStatus">${UI.opcoes(Store.config.statusVenda, estado.status, { vazio: 'Ativas (padrão)' })}</select>
        </div>
      </div>

      <div class="grid grid--kpi mb">
        ${UI.kpi({
          icone: '💰', titulo: 'Faturamento Bruto', cor: 'gold', valor: U.money0(fat.bruto),
          sub: UI.trend(comp.deltaBruto) + ' <span class="muted">vs. período anterior</span>',
          linhas: [
            { label: 'Vendas', valor: U.num(fat.qtd) },
            { label: 'Ticket médio', valor: U.money0(fat.ticketMedio) }
          ]
        })}
        ${UI.kpi({
          icone: '🧾', titulo: 'Deduções', cor: 'red',
          valor: U.money0(fat.descontos + fat.custos + fat.comissoes),
          linhas: [
            { label: 'Descontos', valor: U.money0(fat.descontos) },
            { label: 'Custos', valor: U.money0(fat.custos) },
            { label: 'Comissões', valor: U.money0(fat.comissoes) }
          ]
        })}
        ${UI.kpi({
          icone: '📗', titulo: 'Faturamento Líquido', cor: 'green', valor: U.money0(fat.liquido),
          sub: UI.trend(comp.deltaLiquido) + ' <span class="muted">vs. período anterior</span>',
          linhas: [{ label: 'Margem', valor: U.pct(fat.margemPct) }]
        })}
        ${UI.kpi({
          icone: '🏦', titulo: 'Recebido / A receber', cor: 'blue', valor: U.money0(fat.recebido),
          linhas: [
            { label: 'A receber no período', valor: U.money0(fat.aReceber) },
            { label: 'A receber (total)', valor: U.money0(fat.aReceberTotal) }
          ]
        })}
      </div>

      <div class="grid grid--2 mb">
        <div class="card card--pad0">
          <div class="card__head">
            <h2>📊 Evolução do faturamento</h2>
            <div class="chips no-print" data-gran>
              ${[['dia', 'Diário'], ['semana', 'Semanal'], ['mes', 'Mensal'], ['ano', 'Anual']].map(g =>
                `<button class="chip ${estado.granularidade === g[0] ? 'is-active' : ''}" data-g="${g[0]}">${g[1]}</button>`).join('')}
            </div>
          </div>
          <div class="card__body">
            ${Charts.faturamento(serie, { h: 250 })}
            <div class="chart-legend">
              <span><i style="background:#2563eb"></i>Bruto</span>
              <span><i style="background:#059669"></i>Líquido</span>
            </div>
          </div>
        </div>

        <div class="card card--pad0">
          <div class="card__head"><h2>🧮 Composição do resultado</h2>
            <p>Líquido = bruto − descontos − custos − comissões</p></div>
          <div class="card__body">
            ${Charts.waterfall([
              { label: 'Faturamento bruto', valor: fat.bruto, cor: '#2563eb' },
              { label: 'Descontos', valor: -fat.descontos, cor: '#f97316' },
              { label: 'Custos', valor: -fat.custos, cor: '#ef4444' },
              { label: 'Comissões', valor: -fat.comissoes, cor: '#8b5cf6' },
              { label: 'Faturamento líquido', valor: fat.liquido, cor: '#10b981' }
            ])}
            <div class="divider"></div>
            <div class="spread"><span class="small muted">Margem do período</span>
              <b style="font-size:18px" class="${fat.margemPct >= 0 ? 'pos' : 'neg'}">${U.pct(fat.margemPct)}</b></div>
            <div class="tiny muted mt-sm">Margem = lucro ÷ faturamento × 100</div>
          </div>
        </div>
      </div>

      <div class="card card--pad0 mb">
        <div class="card__head">
          <h2>🧾 Vendas do período</h2>
          <div class="hstack no-print">
            <button class="btn btn--sm btn--ghost" data-exportar>📥 Excel</button>
            <button class="btn btn--sm btn--ghost" data-pdf>📄 PDF</button>
            ${pode ? `<button class="btn btn--sm btn--gold" data-nova>＋ Nova Venda</button>` : ''}
          </div>
        </div>
        <div class="card__body">
          ${UI.tabela({
            itens: vendas,
            ordenacao: estado.ordem,
            colunas: [
              { titulo: 'Data', campo: 'data', classe: 'nowrap', sortable: true, render: v => U.fmtDate(v.dataVenda) },
              {
                titulo: 'Cliente', campo: 'cliente', sortable: true, render: v => {
                  const c = Store.L.cliente(v.clienteId) || {};
                  return `<div class="cellmain"><b>${U.esc(c.nome || '—')}</b><small>${U.esc(c.empresa || '')}</small></div>`;
                }
              },
              { titulo: 'Produto', campo: 'produto', sortable: true, render: v => U.esc(Store.L.nomeProduto(v.produtoId)) },
              { titulo: 'Valor', campo: 'valor', classe: 'num', sortable: true, render: v => `<b>${U.money(v.valorBruto)}</b>` },
              { titulo: 'Desconto', campo: 'desconto', classe: 'num', render: v => v.desconto ? `<span class="neg">− ${U.money(v.desconto)}</span>` : '—' },
              { titulo: 'Comissão', campo: 'comissao', classe: 'num', sortable: true, render: v => `${U.money(v.comissao)} <span class="tiny muted">(${U.pct(v.comissaoPct)})</span>` },
              { titulo: 'Líquido', campo: 'liquido', classe: 'num', sortable: true, render: v => `<b class="${v.valorLiquido >= 0 ? 'pos' : 'neg'}">${U.money(v.valorLiquido)}</b>` },
              { titulo: 'Status', campo: 'status', sortable: true, render: v => UI.badge(Store.L.statusVenda(v.statusId)) },
              {
                titulo: '', campo: 'acoes', classe: 'num', render: v =>
                  `<div class="tbl__actions">
                    ${pode ? `<button class="icon-btn" data-editar="${v.id}" title="Editar">✏️</button>
                              <button class="icon-btn" data-excluir="${v.id}" title="Excluir">🗑️</button>` : ''}
                  </div>`
              }
            ],
            rodape: {
              data: '<b>TOTAIS</b>',
              valor: '<b>' + U.money(fat.bruto) + '</b>',
              desconto: '<b class="neg">− ' + U.money(fat.descontos) + '</b>',
              comissao: '<b class="neg">− ' + U.money(fat.comissoes) + '</b>',
              liquido: '<b class="pos">' + U.money(fat.liquido) + '</b>',
              status: '<b>' + fat.qtd + ' venda(s)</b>'
            },
            vazio: { icone: '🧾', titulo: 'Sem vendas no período', texto: 'Ajuste o período ou registre uma venda.' }
          })}
        </div>
      </div>

      <div class="card card--pad0">
        <div class="card__head"><h2>👤 Comissões por responsável</h2><p>${U.esc(r.label)}</p></div>
        <div class="card__body">
          ${comissoes.length ? UI.tabela({
            itens: comissoes,
            colunas: [
              { titulo: 'Responsável', campo: 'nome', render: c => `<b>${U.esc(c.usuario.nome)}</b>` },
              { titulo: 'Vendas', campo: 'vendas', classe: 'num', render: c => U.num(c.vendas) },
              { titulo: 'Faturamento', campo: 'faturamento', classe: 'num', render: c => U.money(c.faturamento) },
              { titulo: 'Ticket médio', campo: 'ticketMedio', classe: 'num', render: c => U.money(c.ticketMedio) },
              { titulo: 'Comissão', campo: 'comissao', classe: 'num', render: c => `<b class="gold">${U.money(c.comissao)}</b>` }
            ],
            rodape: {
              nome: '<b>TOTAL</b>',
              vendas: '<b>' + U.num(fat.qtd) + '</b>',
              faturamento: '<b>' + U.money(fat.bruto) + '</b>',
              comissao: '<b>' + U.money(fat.comissoes) + '</b>'
            }
          }) : UI.vazio({ titulo: 'Sem comissões no período' })}
        </div>
      </div>`;
    },

    mount(el) {
      el.querySelectorAll('[data-periodo] .chip').forEach(b => {
        b.onclick = () => {
          const p = b.getAttribute('data-p');
          if (p === 'custom') return UI.periodoCustom(estado.custom || U.range('mes'),
            c => { estado.custom = c; estado.periodo = 'custom'; App.render(); });
          estado.periodo = p;
          const r = U.range(p);
          const dias = U.diffDays(r.ate, r.de);
          estado.granularidade = dias <= 31 ? 'dia' : dias <= 120 ? 'semana' : dias <= 800 ? 'mes' : 'ano';
          App.render();
        };
      });
      el.querySelectorAll('[data-gran] .chip').forEach(b =>
        b.onclick = () => { estado.granularidade = b.getAttribute('data-g'); App.render(); });

      const bind = (id, prop) => { const s = el.querySelector(id); if (s) s.onchange = e => { estado[prop] = e.target.value; App.render(); }; };
      bind('#fProduto', 'produto'); bind('#fResp', 'responsavel'); bind('#fStatus', 'status'); bind('#fCat', 'categoria');

      el.querySelectorAll('th.sortable').forEach(th => {
        th.onclick = () => {
          const campo = th.getAttribute('data-sort');
          estado.ordem = estado.ordem.campo === campo
            ? { campo: campo, dir: estado.ordem.dir === 'asc' ? 'desc' : 'asc' }
            : { campo: campo, dir: 'desc' };
          App.render();
        };
      });

      el.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => Forms.venda(b.getAttribute('data-editar')));
      el.querySelectorAll('[data-excluir]').forEach(b => b.onclick = () => {
        const v = Store.get('vendas', b.getAttribute('data-excluir'));
        Forms.excluir('vendas', v.id, Store.L.nomeCliente(v.clienteId) + ' · ' + Store.L.nomeProduto(v.produtoId));
      });
      const nova = el.querySelector('[data-nova]');
      if (nova) nova.onclick = () => Forms.venda();
      const pdf = el.querySelector('[data-pdf]');
      if (pdf) pdf.onclick = () => UI.exportarPDF('Financeiro — CRM Produtos');

      const exp = el.querySelector('[data-exportar]');
      if (exp) exp.onclick = () => {
        const fat = M.faturamento(rangeAtual(), filtros());
        U.exportCSV('financeiro',
          ['Data', 'Cliente', 'Empresa', 'Produto', 'Qtd', 'Valor bruto', 'Desconto', 'Custo', 'Comissão %', 'Comissão', 'Líquido', 'Margem %', 'Status', 'Pagamento', 'Responsável'],
          U.sortBy(fat.vendas, v => v.dataVenda, 'desc').map(v => {
            const c = Store.L.cliente(v.clienteId) || {};
            return [U.fmtDate(v.dataVenda), c.nome, c.empresa, Store.L.nomeProduto(v.produtoId),
              v.quantidade || 1, v.valorBruto, v.desconto, v.custo, v.comissaoPct, v.comissao,
              v.valorLiquido, v.margemPct, (Store.L.statusVenda(v.statusId) || {}).nome,
              v.dataPagamento ? U.fmtDate(v.dataPagamento) : '', Store.L.nomeUsuario(v.responsavelId)];
          }));
        UI.toast('Relatório financeiro exportado.', 'ok');
      };
    }
  };
})(window);
