/* =========================================================
   views/relatorios.js — central de relatórios e exportações
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { periodo: 'mes', custom: null, tipo: 'faturamento' };

  function rangeAtual() {
    return estado.periodo === 'custom' && estado.custom
      ? Object.assign({ label: 'Personalizado' }, estado.custom) : U.range(estado.periodo);
  }

  /* ---- definição de cada relatório: colunas, linhas e resumo ---- */
  const RELATORIOS = {
    faturamento: {
      nome: 'Faturamento', icone: '💰',
      desc: 'Evolução do faturamento bruto, deduções e resultado líquido.',
      build(r) {
        const serie = M.serie(r, escolherGranularidade(r));
        const fat = M.faturamento(r);
        return {
          resumo: [
            { label: 'Faturamento bruto', valor: U.money(fat.bruto) },
            { label: 'Descontos', valor: '− ' + U.money(fat.descontos), cls: 'neg' },
            { label: 'Custos', valor: '− ' + U.money(fat.custos), cls: 'neg' },
            { label: 'Comissões', valor: '− ' + U.money(fat.comissoes), cls: 'neg' },
            { label: 'Faturamento líquido', valor: U.money(fat.liquido), cls: 'pos' },
            { label: 'Margem', valor: U.pct(fat.margemPct) }
          ],
          grafico: Charts.faturamento(serie, { h: 250 }),
          colunas: ['Período', 'Vendas', 'Bruto', 'Descontos', 'Custos', 'Comissões', 'Líquido'],
          linhas: serie.map(s => [s.label, s.qtd, s.bruto, s.desconto, s.custo, s.comissao, s.liquido]),
          formato: [null, 'num', 'money', 'money', 'money', 'money', 'money'],
          total: ['TOTAL', fat.qtd, fat.bruto, fat.descontos, fat.custos, fat.comissoes, fat.liquido]
        };
      }
    },

    vendas: {
      nome: 'Vendas', icone: '🧾',
      desc: 'Todas as vendas do período, com valores, comissões e status.',
      build(r) {
        const fat = M.faturamento(r);
        const vendas = U.sortBy(fat.vendas, v => v.dataVenda, 'desc');
        return {
          resumo: [
            { label: 'Vendas', valor: U.num(fat.qtd) },
            { label: 'Valor total', valor: U.money(fat.bruto) },
            { label: 'Ticket médio', valor: U.money(fat.ticketMedio) },
            { label: 'Recebido', valor: U.money(fat.recebido), cls: 'pos' },
            { label: 'A receber', valor: U.money(fat.aReceber) }
          ],
          colunas: ['Data', 'Cliente', 'Produto', 'Valor', 'Comissão', 'Líquido', 'Status', 'Responsável'],
          linhas: vendas.map(v => [U.fmtDate(v.dataVenda), Store.L.nomeCliente(v.clienteId),
            Store.L.nomeProduto(v.produtoId), v.valorBruto, v.comissao, v.valorLiquido,
            (Store.L.statusVenda(v.statusId) || {}).nome, Store.L.nomeUsuario(v.responsavelId)]),
          formato: [null, null, null, 'money', 'money', 'money', null, null],
          total: ['TOTAL', '', '', fat.bruto, fat.comissoes, fat.liquido, fat.qtd + ' venda(s)', '']
        };
      }
    },

    produtos: {
      nome: 'Produtos', icone: '📦',
      desc: 'Desempenho comparativo de cada produto no período.',
      build(r) {
        const dados = U.sortBy(M.crescimentoProdutos(r), d => d.faturamento, 'desc');
        const totalFat = U.sum(dados, d => d.faturamento);
        const totalLiq = U.sum(dados, d => d.liquido);
        return {
          resumo: [
            { label: 'Produtos com venda', valor: U.num(dados.filter(d => d.vendasQtd > 0).length) },
            { label: 'Faturamento', valor: U.money(totalFat) },
            { label: 'Margem média', valor: U.pct(totalFat ? (totalLiq / totalFat) * 100 : 0) }
          ],
          grafico: Charts.hbars(dados.filter(d => d.faturamento > 0).slice(0, 10)
            .map(d => ({ label: d.produto.nome, valor: d.faturamento, sub: U.pct(d.participacaoPct) }))),
          colunas: ['Produto', 'Categoria', 'Vendas', 'Faturamento', 'Clientes', 'Ticket médio', 'Margem %', 'Participação %'],
          linhas: dados.map(d => [d.produto.nome, (d.categoria || {}).nome || '', d.vendasQtd,
            d.faturamento, d.clientes, d.ticketMedio, d.margemPct, d.participacaoPct]),
          formato: [null, null, 'num', 'money', 'num', 'money', 'pct', 'pct'],
          total: ['TOTAL', '', U.sum(dados, d => d.vendasQtd), totalFat, '', '', '', 100]
        };
      }
    },

    clientes: {
      nome: 'Clientes', icone: '👥',
      desc: 'Base de clientes com valor comprado, carteira e pipeline.',
      build(r) {
        const vendas = Store.scope(Store.list('vendas'));
        const dados = Store.scope(Store.list('clientes')).map(c => {
          const vs = vendas.filter(v => v.clienteId === c.id && M.isAtiva(v) && U.inRange(v.dataVenda, r));
          const cart = vendas.filter(v => v.clienteId === c.id && M.isAtiva(v) && v.emCarteira !== false);
          return {
            c: c, compras: vs.length,
            total: U.round2(U.sum(vs, v => v.valorBruto)),
            carteira: U.round2(U.sum(cart, v => v.valorBruto - v.desconto))
          };
        }).sort((a, b) => b.carteira - a.carteira);
        const res = M.resumoCadastros();
        return {
          resumo: [
            { label: 'Clientes na base', valor: U.num(res.total) },
            { label: 'Ativos', valor: U.num(res.ativos), cls: 'pos' },
            { label: 'Prospects', valor: U.num(res.prospects) },
            { label: 'Novos no mês', valor: U.num(res.noMes) }
          ],
          colunas: ['Cliente', 'Empresa', 'E-mail', 'Telefone', 'Origem', 'Status', 'Compras no período', 'Valor no período', 'Em carteira'],
          linhas: dados.map(d => [d.c.nome, d.c.empresa || '', d.c.email || '', d.c.telefone || '',
            d.c.origem || '', (Store.L.statusCliente(d.c.statusId) || {}).nome,
            d.compras, d.total, d.carteira]),
          formato: [null, null, null, null, null, null, 'num', 'money', 'money'],
          total: ['TOTAL', '', '', '', '', '', U.sum(dados, d => d.compras), U.sum(dados, d => d.total), U.sum(dados, d => d.carteira)]
        };
      }
    },

    carteira: {
      nome: 'Carteira', icone: '💼',
      desc: 'Contratos ativos, receita recorrente e projeção anual.',
      build() {
        const cart = M.carteira();
        return {
          resumo: [
            { label: 'Carteira total', valor: U.money(cart.total) },
            { label: 'Clientes ativos', valor: U.num(cart.clientesAtivos) },
            { label: 'Receita mensal', valor: U.money(cart.receitaMensal) },
            { label: 'Projeção anual', valor: U.money(cart.receitaAnualProjetada) },
            { label: 'Ticket médio', valor: U.money(cart.ticketMedio) }
          ],
          colunas: ['Cliente', 'Produto', 'Valor', 'Receita mensal', 'Data', 'Status', 'Responsável'],
          linhas: U.sortBy(cart.itens, v => v.valorBruto - v.desconto, 'desc').map(v => [
            Store.L.nomeCliente(v.clienteId), Store.L.nomeProduto(v.produtoId),
            U.round2(v.valorBruto - v.desconto), U.round2(Store.mrr(v)),
            U.fmtDate(v.dataVenda), (Store.L.statusVenda(v.statusId) || {}).nome,
            Store.L.nomeUsuario(v.responsavelId)]),
          formato: [null, null, 'money', 'money', null, null, null],
          total: ['TOTAL', cart.contratos + ' contrato(s)', cart.total, cart.receitaMensal, '', '', '']
        };
      }
    },

    conversao: {
      nome: 'Conversão', icone: '🎯',
      desc: 'Funil por etapa, taxa de conversão e valor potencial.',
      build() {
        const pipe = M.pipeline();
        return {
          resumo: [
            { label: 'Pipeline aberto', valor: U.money(pipe.valor) },
            { label: 'Oportunidades', valor: U.num(pipe.qtd) },
            { label: 'Ganhas', valor: U.num(pipe.ganhas), cls: 'pos' },
            { label: 'Perdidas', valor: U.num(pipe.perdidas), cls: 'neg' },
            { label: 'Taxa de conversão', valor: U.pct(pipe.taxaConversao) }
          ],
          grafico: Charts.funil(pipe.porEtapa),
          colunas: ['Etapa', 'Oportunidades', 'Valor', 'Ticket médio', '% do funil'],
          linhas: pipe.porEtapa.map(e => [
            (e.etapa.emoji || '') + ' ' + e.etapa.nome, e.qtd, e.valor,
            e.qtd ? U.round2(e.valor / e.qtd) : 0,
            pipe.valor ? U.round2((e.valor / pipe.valor) * 100) : 0]),
          formato: [null, 'num', 'money', 'money', 'pct'],
          total: ['TOTAL', pipe.qtd, pipe.valor, pipe.ticketMedio, '']
        };
      }
    },

    comissoes: {
      nome: 'Comissões', icone: '🤝',
      desc: 'Comissão gerada por consultor no período.',
      build(r) {
        const dados = M.comissoesPorResponsavel(r);
        const fat = M.faturamento(r);
        return {
          resumo: [
            { label: 'Comissão total', valor: U.money(fat.comissoes) },
            { label: 'Faturamento', valor: U.money(fat.bruto) },
            { label: '% sobre faturamento', valor: U.pct(fat.bruto ? (fat.comissoes / fat.bruto) * 100 : 0) }
          ],
          grafico: Charts.hbars(dados.map(d => ({ label: d.usuario.nome, valor: d.comissao, sub: d.vendas + ' vendas' }))),
          colunas: ['Responsável', 'Vendas', 'Faturamento', 'Ticket médio', 'Comissão'],
          linhas: dados.map(d => [d.usuario.nome, d.vendas, d.faturamento, d.ticketMedio, d.comissao]),
          formato: [null, 'num', 'money', 'money', 'money'],
          total: ['TOTAL', fat.qtd, fat.bruto, fat.ticketMedio, fat.comissoes]
        };
      }
    },

    margem: {
      nome: 'Margem', icone: '📈',
      desc: 'Margem realizada por produto e por categoria.',
      build(r) {
        const dados = U.sortBy(M.desempenhoProdutos(r).filter(d => d.vendasQtd > 0), d => d.margemPct, 'desc');
        const fat = M.faturamento(r);
        return {
          resumo: [
            { label: 'Margem geral', valor: U.pct(fat.margemPct) },
            { label: 'Lucro no período', valor: U.money(fat.liquido), cls: 'pos' },
            { label: 'Custos + comissões', valor: U.money(fat.custos + fat.comissoes), cls: 'neg' }
          ],
          grafico: Charts.hbars(dados.slice(0, 10).map(d => ({
            label: d.produto.nome, valor: d.margemPct,
            cor: d.margemPct >= 30 ? '#059669' : d.margemPct >= 15 ? '#f0b429' : '#ef4444'
          })), { formato: v => U.pct(v) }),
          colunas: ['Produto', 'Faturamento', 'Custos', 'Comissões', 'Líquido', 'Margem %'],
          linhas: dados.map(d => [d.produto.nome, d.faturamento, d.custo, d.comissao, d.liquido, d.margemPct]),
          formato: [null, 'money', 'money', 'money', 'money', 'pct'],
          total: ['TOTAL', fat.bruto, fat.custos, fat.comissoes, fat.liquido, fat.margemPct]
        };
      }
    },

    periodo: {
      nome: 'Desempenho por período', icone: '📅',
      desc: 'Comparativo entre o período escolhido e o anterior.',
      build(r) {
        const comp = M.comparativo(r);
        const ant = U.previousRange(r);
        return {
          resumo: [
            { label: 'Faturamento atual', valor: U.money(comp.atual.bruto) },
            { label: 'Período anterior', valor: U.money(comp.anterior.bruto) },
            { label: 'Variação', valor: UI.trend(comp.deltaBruto) }
          ],
          colunas: ['Indicador', 'Período atual', 'Período anterior', 'Variação %'],
          linhas: [
            ['Faturamento bruto', comp.atual.bruto, comp.anterior.bruto, U.round2(comp.deltaBruto)],
            ['Faturamento líquido', comp.atual.liquido, comp.anterior.liquido, U.round2(comp.deltaLiquido)],
            ['Descontos', comp.atual.descontos, comp.anterior.descontos, U.round2(U.delta(comp.atual.descontos, comp.anterior.descontos))],
            ['Comissões', comp.atual.comissoes, comp.anterior.comissoes, U.round2(U.delta(comp.atual.comissoes, comp.anterior.comissoes))],
            ['Custos', comp.atual.custos, comp.anterior.custos, U.round2(U.delta(comp.atual.custos, comp.anterior.custos))],
            ['Quantidade de vendas', comp.atual.qtd, comp.anterior.qtd, U.round2(comp.deltaQtd)],
            ['Ticket médio', comp.atual.ticketMedio, comp.anterior.ticketMedio, U.round2(comp.deltaTicket)]
          ],
          formato: [null, 'auto', 'auto', 'pct'],
          nota: 'Período anterior: ' + U.fmtDate(ant.de) + ' a ' + U.fmtDate(ant.ate)
        };
      }
    }
  };

  function escolherGranularidade(r) {
    const dias = U.diffDays(r.ate, r.de);
    return dias <= 31 ? 'dia' : dias <= 120 ? 'semana' : dias <= 800 ? 'mes' : 'ano';
  }

  function fmtCell(v, tipo) {
    if (tipo === 'money') return U.money(v);
    if (tipo === 'num') return U.num(v);
    if (tipo === 'pct') return v === '' ? '' : U.pct(v);
    if (tipo === 'auto') return typeof v === 'number' && v > 999 ? U.money(v) : U.num(v);
    return U.esc(v);
  }

  Views.relatorios = {
    titulo: '📈 Relatórios',
    subtitulo: 'Gere, visualize e exporte os relatórios da operação',

    render() {
      const r = rangeAtual();
      const def = RELATORIOS[estado.tipo] || RELATORIOS.faturamento;
      const rel = def.build(r);

      const linhasHTML = rel.linhas.map(l =>
        `<tr>${l.map((c, i) => {
          const t = (rel.formato || [])[i];
          return `<td class="${t && t !== 'auto' ? 'num' : ''}">${fmtCell(c, t)}</td>`;
        }).join('')}</tr>`).join('');

      const totalHTML = rel.total
        ? `<tfoot><tr>${rel.total.map((c, i) => {
            const t = (rel.formato || [])[i];
            return `<td class="${t && t !== 'auto' ? 'num' : ''}"><b>${typeof c === 'number' ? fmtCell(c, t) : U.esc(c)}</b></td>`;
          }).join('')}</tr></tfoot>`
        : '';

      return `
      <div class="card mb no-print">
        <div class="spread mb"><h2 style="font-size:15px">Período do relatório</h2>
          <span class="small muted">${U.fmtDate(r.de)} a ${U.fmtDate(r.ate)}</span></div>
        ${UI.periodoChips(estado.periodo)}
      </div>

      <div class="card mb no-print">
        <div class="small strong mb">Escolha o relatório</div>
        <div class="grid grid--4">
          ${Object.keys(RELATORIOS).map(k => {
            const d = RELATORIOS[k];
            const on = k === estado.tipo;
            return `<button class="card" data-rel="${k}" style="text-align:left;cursor:pointer;border:1px solid ${on ? 'var(--navy-700)' : 'var(--line)'};
              background:${on ? 'var(--navy-700)' : 'var(--surface)'};color:${on ? '#fff' : 'inherit'}">
              <div style="font-size:19px">${d.icone}</div>
              <div class="strong mt-sm" style="font-size:13.5px">${U.esc(d.nome)}</div>
              <div class="tiny ${on ? '' : 'muted'}" style="${on ? 'opacity:.82' : ''}">${U.esc(d.desc)}</div>
            </button>`;
          }).join('')}
        </div>
      </div>

      <div class="card card--pad0">
        <div class="card__head">
          <div><h2>${def.icone} Relatório de ${U.esc(def.nome)}</h2>
            <p>${U.esc(r.label)} · ${U.fmtDate(r.de)} a ${U.fmtDate(r.ate)} · emitido em ${U.fmtDate(U.today())}</p></div>
          <div class="hstack no-print">
            <button class="btn btn--sm btn--ghost" data-excel>📥 Exportar Excel</button>
            <button class="btn btn--sm btn--navy" data-pdf>📄 Exportar PDF</button>
          </div>
        </div>
        <div class="card__body">
          <div class="grid grid--4 mb">
            ${rel.resumo.map(x => `<div>
              <div class="tiny muted">${U.esc(x.label).toUpperCase()}</div>
              <div class="strong ${x.cls || ''}" style="font-size:18px">${x.valor}</div>
            </div>`).join('')}
          </div>
          ${rel.nota ? `<div class="notice mb">📌 ${U.esc(rel.nota)}</div>` : ''}
          ${rel.grafico ? `<div class="mb">${rel.grafico}</div>` : ''}
          ${rel.linhas.length ? `<div class="tablewrap"><table class="tbl">
            <thead><tr>${rel.colunas.map((c, i) =>
              `<th class="${(rel.formato || [])[i] && (rel.formato || [])[i] !== 'auto' ? 'num' : ''}">${U.esc(c)}</th>`).join('')}</tr></thead>
            <tbody>${linhasHTML}</tbody>${totalHTML}</table></div>`
            : UI.vazio({ icone: '📄', titulo: 'Sem dados no período', texto: 'Escolha outro período para gerar o relatório.' })}
        </div>
        <div class="card__foot tiny muted">
          CRM Produtos · ${U.esc(Store.config.empresa)} · relatório gerado automaticamente a partir dos dados cadastrados.
        </div>
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
      el.querySelectorAll('[data-rel]').forEach(b =>
        b.onclick = () => { estado.tipo = b.getAttribute('data-rel'); App.render(); });

      const pdf = el.querySelector('[data-pdf]');
      if (pdf) pdf.onclick = () => {
        const def = RELATORIOS[estado.tipo];
        UI.exportarPDF('Relatório de ' + def.nome + ' — ' + rangeAtual().label);
      };

      const excel = el.querySelector('[data-excel]');
      if (excel) excel.onclick = () => {
        const r = rangeAtual();
        const def = RELATORIOS[estado.tipo];
        const rel = def.build(r);
        const linhas = rel.linhas.slice();
        if (rel.total) linhas.push(rel.total);
        U.exportCSV('relatorio-' + U.slug(def.nome) + '-' + r.de + '-a-' + r.ate, rel.colunas, linhas);
        UI.toast('Relatório de ' + def.nome + ' exportado.', 'ok');
      };
    }
  };
})(window);
