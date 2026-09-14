/* =========================================================
   metrics.js — indicadores derivados dos dados cadastrados
   Tudo aqui é calculado on-the-fly: ao salvar um produto,
   cliente ou venda, os números mudam automaticamente.
   ========================================================= */
(function (global) {
  'use strict';

  const S = () => global.Store;

  /* ---------- filtros base ---------- */
  function vendas(opts) {
    const o = opts || {};
    let arr = S().scope(S().list('vendas'));
    if (o.range) arr = arr.filter(v => U.inRange(v.dataVenda, o.range));
    if (o.produtoId) arr = arr.filter(v => v.produtoId === o.produtoId);
    if (o.clienteId) arr = arr.filter(v => v.clienteId === o.clienteId);
    if (o.responsavelId) arr = arr.filter(v => v.responsavelId === o.responsavelId);
    if (o.categoriaId) {
      arr = arr.filter(v => {
        const p = S().L.produto(v.produtoId);
        return p && p.categoriaId === o.categoriaId;
      });
    }
    if (o.statusId) arr = arr.filter(v => v.statusId === o.statusId);
    if (o.somenteAtivas !== false) arr = arr.filter(v => isAtiva(v));
    return arr;
  }

  function isAtiva(v) { const st = S().L.statusVenda(v.statusId); return !!(st && st.ativa); }
  function isRecebida(v) { const st = S().L.statusVenda(v.statusId); return !!(st && st.recebida); }
  function isCancelada(v) { return !isAtiva(v); }

  function oportunidades() { return S().scope(S().list('oportunidades')); }
  function clientes() { return S().scope(S().list('clientes')); }
  function tarefas() { return S().scope(S().list('tarefas')); }
  function produtos() { return S().list('produtos'); }

  /* =========================================================
     FATURAMENTO
     Bruto   = soma de todas as vendas ativas do período
     Líquido = bruto - descontos - custos - comissões
     ========================================================= */
  function faturamento(range, filtros) {
    const arr = vendas(Object.assign({ range: range }, filtros || {}));
    const bruto = U.sum(arr, v => v.valorBruto);
    const descontos = U.sum(arr, v => v.desconto);
    const comissoes = U.sum(arr, v => v.comissao);
    const custos = U.sum(arr, v => v.custo);
    const liquido = U.round2(bruto - descontos - custos - comissoes);
    const qtd = arr.length;

    // recebimento acompanha a data de pagamento
    const todas = S().scope(S().list('vendas')).filter(isAtiva);
    const recebido = U.sum(
      todas.filter(v => isRecebida(v) && range && U.inRange(v.dataPagamento, range)),
      v => v.valorBruto - v.desconto
    );
    const aReceberPeriodo = U.sum(arr.filter(v => !isRecebida(v)), v => v.valorBruto - v.desconto);
    const aReceberTotal = U.sum(todas.filter(v => !isRecebida(v)), v => v.valorBruto - v.desconto);

    return {
      bruto: U.round2(bruto),
      descontos: U.round2(descontos),
      comissoes: U.round2(comissoes),
      custos: U.round2(custos),
      liquido: liquido,
      lucro: liquido,
      margemPct: bruto > 0 ? U.round2((liquido / bruto) * 100) : 0,
      qtd: qtd,
      ticketMedio: qtd ? U.round2(bruto / qtd) : 0,
      recebido: U.round2(recebido),
      aReceber: U.round2(aReceberPeriodo),
      aReceberTotal: U.round2(aReceberTotal),
      vendas: arr
    };
  }

  /** comparação entre o período informado e o anterior de mesma duração */
  function comparativo(range, filtros) {
    const atual = faturamento(range, filtros);
    const ant = faturamento(U.previousRange(range), filtros);
    return {
      atual: atual,
      anterior: ant,
      deltaBruto: U.delta(atual.bruto, ant.bruto),
      deltaLiquido: U.delta(atual.liquido, ant.liquido),
      deltaQtd: U.delta(atual.qtd, ant.qtd),
      deltaTicket: U.delta(atual.ticketMedio, ant.ticketMedio)
    };
  }

  /* =========================================================
     CARTEIRA — valor ativo hoje
     ========================================================= */
  function carteira(filtros) {
    const f = filtros || {};
    let arr = S().scope(S().list('vendas')).filter(v => isAtiva(v) && v.emCarteira !== false);
    if (f.produtoId) arr = arr.filter(v => v.produtoId === f.produtoId);
    if (f.clienteId) arr = arr.filter(v => v.clienteId === f.clienteId);
    if (f.responsavelId) arr = arr.filter(v => v.responsavelId === f.responsavelId);
    if (f.statusId) arr = arr.filter(v => v.statusId === f.statusId);
    if (f.range) arr = arr.filter(v => U.inRange(v.dataVenda, f.range));
    if (f.categoriaId) arr = arr.filter(v => {
      const p = S().L.produto(v.produtoId);
      return p && p.categoriaId === f.categoriaId;
    });

    const total = U.sum(arr, v => v.valorBruto - v.desconto);
    const clientesAtivos = U.unique(arr.map(v => v.clienteId)).length;
    const receitaMensal = U.sum(arr, v => S().mrr(v));
    const recorrentes = arr.filter(v => S().mesesRecorrencia(v) > 0);
    const pontuais = arr.filter(v => S().mesesRecorrencia(v) === 0);

    return {
      itens: arr,
      total: U.round2(total),
      clientesAtivos: clientesAtivos,
      contratos: arr.length,
      receitaMensal: U.round2(receitaMensal),
      receitaAnualProjetada: U.round2(receitaMensal * 12),
      ticketMedio: clientesAtivos ? U.round2(total / clientesAtivos) : 0,
      ticketPorContrato: arr.length ? U.round2(total / arr.length) : 0,
      recorrente: U.round2(U.sum(recorrentes, v => v.valorBruto - v.desconto)),
      pontual: U.round2(U.sum(pontuais, v => v.valorBruto - v.desconto)),
      qtdRecorrentes: recorrentes.length
    };
  }

  /* =========================================================
     PIPELINE — quanto ainda pode entrar
     ========================================================= */
  function pipeline(filtros) {
    const f = filtros || {};
    let arr = oportunidades();
    if (f.produtoId) arr = arr.filter(o => o.produtoId === f.produtoId);
    if (f.responsavelId) arr = arr.filter(o => o.responsavelId === f.responsavelId);

    const abertas = arr.filter(o => (S().L.etapa(o.etapaId) || {}).aberto);
    const ganhas = arr.filter(o => (S().L.etapa(o.etapaId) || {}).ganho);
    const perdidas = arr.filter(o => (S().L.etapa(o.etapaId) || {}).perdido);
    const encerradas = ganhas.length + perdidas.length;

    const porEtapa = S().etapasFunil().map(e => {
      const itens = arr.filter(o => o.etapaId === e.id);
      return { etapa: e, qtd: itens.length, valor: U.round2(U.sum(itens, o => o.valor)), itens: itens };
    });

    return {
      itens: abertas,
      valor: U.round2(U.sum(abertas, o => o.valor)),
      qtd: abertas.length,
      ticketMedio: abertas.length ? U.round2(U.sum(abertas, o => o.valor) / abertas.length) : 0,
      ganhas: ganhas.length,
      perdidas: perdidas.length,
      valorGanho: U.round2(U.sum(ganhas, o => o.valor)),
      taxaConversao: encerradas ? U.round2((ganhas.length / encerradas) * 100) : 0,
      porEtapa: porEtapa
    };
  }

  /* =========================================================
     VISÃO EXECUTIVA — os 4 números centrais
     ========================================================= */
  function visaoExecutiva() {
    const rMes = U.range('mes');
    const comp = comparativo(rMes);
    const cart = carteira();
    const pipe = pipeline();
    const projetado = U.round2(cart.total + pipe.valor);

    return {
      range: rMes,
      faturamento: comp.atual,
      faturamentoAnterior: comp.anterior,
      deltaFaturamento: comp.deltaBruto,
      carteira: cart,
      pipeline: pipe,
      projetado: projetado,
      /* explicação da projeção, exibida na interface */
      projecaoDetalhe: { carteira: cart.total, pipeline: pipe.valor }
    };
  }

  /* =========================================================
     SÉRIES PARA GRÁFICO
     granularidade: 'dia' | 'semana' | 'mes' | 'ano'
     ========================================================= */
  function serie(range, granularidade, filtros) {
    const arr = vendas(Object.assign({ range: range }, filtros || {}));
    const buckets = new Map();

    function keyOf(iso) {
      const d = U.parseISO(iso);
      if (!d) return '';
      switch (granularidade) {
        case 'dia': return U.toISO(d);
        case 'semana': return U.startOfWeek(U.toISO(d));
        case 'ano': return String(d.getFullYear());
        default: return U.monthKey(U.toISO(d));
      }
    }
    function labelOf(k) {
      switch (granularidade) {
        case 'dia': return U.fmtDateShort(k);
        case 'semana': return U.fmtDateShort(k);
        case 'ano': return k;
        default: return U.fmtMonth(k + '-01');
      }
    }

    /* Esqueleto de períodos vazios, para o gráfico não "pular" datas sem venda.
       Dois ajustes no intervalo:
        - em períodos abertos ("Tudo"), começa na primeira venda em vez de 1900;
        - não desenha períodos futuros além de hoje (ou da última venda lançada). */
    const datas = arr.map(v => v.dataVenda).filter(Boolean).sort();
    const inicioReal = datas.length ? datas[0] : U.today();
    const fimReal = datas.length ? datas[datas.length - 1] : U.today();
    const aberto = range.de <= '1900-01-01' || range.ate >= '2999-01-01';
    const limiteFim = fimReal > U.today() ? fimReal : U.today();
    const de = U.parseISO(aberto && range.de < inicioReal ? inicioReal : range.de);
    const ate = U.parseISO(range.ate > limiteFim ? limiteFim : range.ate);
    if (de && ate && de <= ate) {
      const limite = 400;
      let cur = new Date(de), n = 0;
      while (cur <= ate && n < limite) {
        buckets.set(keyOf(U.toISO(cur)), { bruto: 0, desconto: 0, comissao: 0, custo: 0, liquido: 0, qtd: 0 });
        if (granularidade === 'dia') cur.setDate(cur.getDate() + 1);
        else if (granularidade === 'semana') cur.setDate(cur.getDate() + 7);
        else if (granularidade === 'ano') cur.setFullYear(cur.getFullYear() + 1);
        else cur.setMonth(cur.getMonth() + 1);
        n++;
      }
    }

    arr.forEach(v => {
      const k = keyOf(v.dataVenda);
      if (!k) return;
      const b = buckets.get(k) || { bruto: 0, desconto: 0, comissao: 0, custo: 0, liquido: 0, qtd: 0 };
      b.bruto += Number(v.valorBruto) || 0;
      b.desconto += Number(v.desconto) || 0;
      b.comissao += Number(v.comissao) || 0;
      b.custo += Number(v.custo) || 0;
      b.liquido += Number(v.valorLiquido) || 0;
      b.qtd += 1;
      buckets.set(k, b);
    });

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] < b[0] ? -1 : 1)
      .map(([k, v]) => ({
        key: k, label: labelOf(k),
        bruto: U.round2(v.bruto), desconto: U.round2(v.desconto),
        comissao: U.round2(v.comissao), custo: U.round2(v.custo),
        liquido: U.round2(v.liquido), qtd: v.qtd
      }));
  }

  /* =========================================================
     DESEMPENHO POR PRODUTO
     ========================================================= */
  function desempenhoProdutos(range, filtros) {
    const base = vendas(Object.assign({ range: range }, filtros || {}));
    const totalBruto = U.sum(base, v => v.valorBruto);
    const pipe = pipeline();

    return produtos().map(p => {
      const vs = base.filter(v => v.produtoId === p.id);
      const bruto = U.sum(vs, v => v.valorBruto);
      const liquido = U.sum(vs, v => v.valorLiquido);
      const custo = U.sum(vs, v => v.custo);
      const comissao = U.sum(vs, v => v.comissao);
      const desconto = U.sum(vs, v => v.desconto);
      const cli = U.unique(vs.map(v => v.clienteId)).length;
      const cart = S().scope(S().list('vendas'))
        .filter(v => v.produtoId === p.id && isAtiva(v) && v.emCarteira !== false);
      const opsAbertas = pipe.itens.filter(o => o.produtoId === p.id);

      return {
        produto: p,
        categoria: S().L.categoria(p.categoriaId),
        status: S().L.statusProduto(p.statusId),
        vendasQtd: vs.length,
        faturamento: U.round2(bruto),
        liquido: U.round2(liquido),
        custo: U.round2(custo),
        comissao: U.round2(comissao),
        desconto: U.round2(desconto),
        clientes: cli,
        ticketMedio: vs.length ? U.round2(bruto / vs.length) : 0,
        margemPct: bruto > 0 ? U.round2((liquido / bruto) * 100) : 0,
        margemUnitaria: p.preco > 0 ? U.round2(((p.preco - (p.custo || 0)) / p.preco) * 100) : 0,
        participacaoPct: totalBruto > 0 ? U.round2((bruto / totalBruto) * 100) : 0,
        carteira: U.round2(U.sum(cart, v => v.valorBruto - v.desconto)),
        pipelineQtd: opsAbertas.length,
        pipelineValor: U.round2(U.sum(opsAbertas, o => o.valor))
      };
    });
  }

  /** crescimento do produto: período atual vs. anterior */
  function crescimentoProdutos(range) {
    const atual = desempenhoProdutos(range);
    const ant = desempenhoProdutos(U.previousRange(range));
    const mapAnt = {};
    ant.forEach(d => { mapAnt[d.produto.id] = d; });
    return atual.map(d => {
      const a = mapAnt[d.produto.id] || { faturamento: 0 };
      return Object.assign({}, d, {
        faturamentoAnterior: a.faturamento,
        crescimentoPct: U.delta(d.faturamento, a.faturamento),
        crescimentoAbs: U.round2(d.faturamento - a.faturamento)
      });
    });
  }

  /* =========================================================
     RANKING
     ========================================================= */
  function ranking(range) {
    const dados = crescimentoProdutos(range);
    const comVenda = dados.filter(d => d.vendasQtd > 0);
    const ordenar = (arr, fn, dir) => U.sortBy(arr, fn, dir || 'desc');
    return {
      dados: dados,
      porFaturamento: ordenar(dados, d => d.faturamento),
      porVendas: ordenar(comVenda, d => d.vendasQtd),
      porMargem: ordenar(comVenda, d => d.margemPct),
      porTicket: ordenar(comVenda, d => d.ticketMedio),
      porCrescimento: ordenar(comVenda, d => d.crescimentoPct),
      piorDesempenho: ordenar(dados.filter(d => (d.status || {}).ativo), d => d.faturamento, 'asc')
    };
  }

  /* =========================================================
     CADASTROS / CLIENTES
     ========================================================= */
  function resumoCadastros() {
    const cls = clientes();
    const rMes = U.range('mes');
    const ativos = cls.filter(c => (S().L.statusCliente(c.statusId) || {}).ativo);
    return {
      total: cls.length,
      noMes: cls.filter(c => U.inRange(c.dataCadastro, rMes)).length,
      ativos: ativos.length,
      prospects: cls.length - ativos.length
    };
  }

  function resumoProdutos() {
    const ps = produtos();
    const st = id => S().L.statusProduto(id) || {};
    return {
      total: ps.length,
      ativos: ps.filter(p => st(p.statusId).ativo).length,
      inativos: ps.filter(p => !st(p.statusId).ativo && !st(p.statusId).arquivado).length,
      arquivados: ps.filter(p => st(p.statusId).arquivado).length
    };
  }

  /** distribuição de oportunidades abertas por prioridade */
  function porPrioridade() {
    const abertas = oportunidades().filter(o => (S().L.etapa(o.etapaId) || {}).aberto);
    const total = abertas.length;
    return S().config.prioridades.map(p => {
      const itens = abertas.filter(o => o.prioridadeId === p.id);
      return {
        prioridade: p,
        qtd: itens.length,
        valor: U.round2(U.sum(itens, o => o.valor)),
        pct: total ? U.round2((itens.length / total) * 100) : 0
      };
    });
  }

  /** últimos cadastros/oportunidades para o feed do dashboard */
  function recentes(limite) {
    return U.sortBy(oportunidades(), o => o.data || '', 'desc').slice(0, limite || 10);
  }

  /* =========================================================
     TAREFAS
     ========================================================= */
  function resumoTarefas() {
    const hoje = U.today();
    const arr = tarefas();
    const pendentes = arr.filter(t => !(S().L.statusTarefa(t.statusId) || {}).concluido);
    return {
      total: arr.length,
      pendentes: pendentes.length,
      hoje: pendentes.filter(t => t.prazo === hoje),
      atrasadas: pendentes.filter(t => t.prazo && t.prazo < hoje),
      proximas: U.sortBy(pendentes.filter(t => t.prazo && t.prazo > hoje), t => t.prazo, 'asc'),
      concluidas: arr.filter(t => (S().L.statusTarefa(t.statusId) || {}).concluido).length
    };
  }

  /* =========================================================
     COMISSÕES POR RESPONSÁVEL
     ========================================================= */
  function comissoesPorResponsavel(range) {
    const arr = vendas({ range: range });
    const grupos = U.groupBy(arr, v => v.responsavelId);
    return Object.keys(grupos).map(id => {
      const vs = grupos[id];
      return {
        usuario: S().L.usuario(id) || { nome: '—' },
        vendas: vs.length,
        faturamento: U.round2(U.sum(vs, v => v.valorBruto)),
        comissao: U.round2(U.sum(vs, v => v.comissao)),
        liquido: U.round2(U.sum(vs, v => v.valorLiquido)),
        ticketMedio: vs.length ? U.round2(U.sum(vs, v => v.valorBruto) / vs.length) : 0
      };
    }).sort((a, b) => b.faturamento - a.faturamento);
  }

  /** faturamento agrupado por categoria (para o gráfico de composição) */
  function porCategoria(range) {
    const arr = vendas({ range: range });
    return S().config.categorias.map(c => {
      const vs = arr.filter(v => {
        const p = S().L.produto(v.produtoId);
        return p && p.categoriaId === c.id;
      });
      return {
        categoria: c,
        valor: U.round2(U.sum(vs, v => v.valorBruto)),
        qtd: vs.length
      };
    }).filter(x => x.qtd > 0).sort((a, b) => b.valor - a.valor);
  }

  /** clientes com maior valor em carteira */
  function topClientes(limite) {
    const cart = carteira();
    const grupos = U.groupBy(cart.itens, v => v.clienteId);
    return Object.keys(grupos).map(id => {
      const vs = grupos[id];
      return {
        cliente: S().L.cliente(id) || { nome: '—' },
        contratos: vs.length,
        valor: U.round2(U.sum(vs, v => v.valorBruto - v.desconto)),
        mrr: U.round2(U.sum(vs, v => S().mrr(v)))
      };
    }).sort((a, b) => b.valor - a.valor).slice(0, limite || 10);
  }

  /** vendas que precisam de acompanhamento (faturadas e ainda não pagas) */
  function acompanhamento() {
    const hoje = U.today();
    const abertas = S().scope(S().list('vendas'))
      .filter(v => isAtiva(v) && !isRecebida(v));
    return U.sortBy(abertas, v => v.dataVenda, 'asc').map(v => ({
      venda: v,
      diasEmAberto: Math.abs(U.diffDays(hoje, v.dataVenda))
    }));
  }

  global.M = {
    vendas, isAtiva, isRecebida, isCancelada,
    faturamento, comparativo, carteira, pipeline, visaoExecutiva,
    serie, desempenhoProdutos, crescimentoProdutos, ranking,
    resumoCadastros, resumoProdutos, porPrioridade, recentes,
    resumoTarefas, comissoesPorResponsavel, porCategoria, topClientes, acompanhamento
  };
})(window);
