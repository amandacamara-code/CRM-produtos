/* =========================================================
   store.js — modelo de dados, persistência e regras

   Dois modos de persistência, com a MESMA interface síncrona
   para as telas (elas não sabem qual está ativo):
     'local' — localStorage, um aparelho só
     'nuvem' — Supabase, com login e permissões no servidor

   No modo nuvem a memória é a fonte de leitura (as telas
   continuam síncronas) e cada gravação sobe para o servidor em
   segundo plano. Um erro de permissão desfaz a alteração local
   e avisa quem está usando.
   ========================================================= */
(function (global) {
  'use strict';

  const KEY = 'crm_produtos_v1';
  const SCHEMA = 1;

  /* ---------------- perfis de acesso ---------------- */
  const PERFIS = {
    admin: {
      nome: 'Administrador',
      desc: 'Acesso total ao sistema, incluindo configurações e usuários.',
      permite: '*',
      proprios: false
    },
    gestor: {
      nome: 'Gestor de Produtos',
      desc: 'Produtos, vendas, carteira, financeiro e relatórios.',
      permite: ['dashboard', 'cadastros', 'funil', 'produtos', 'links', 'desempenho',
        'tarefas', 'carteira', 'financeiro', 'clientes', 'relatorios', 'ranking', 'config'],
      negaConfig: ['usuarios'],
      proprios: false
    },
    consultor: {
      nome: 'Consultor / Vendedor',
      desc: 'Vê e edita apenas os próprios clientes, leads, vendas e tarefas.',
      permite: ['dashboard', 'cadastros', 'funil', 'produtos', 'links', 'tarefas', 'clientes'],
      proprios: true
    },
    leitor: {
      nome: 'Visualizador',
      desc: 'Somente leitura. Não pode criar, editar ou excluir.',
      permite: ['dashboard', 'cadastros', 'funil', 'produtos', 'links', 'desempenho',
        'tarefas', 'carteira', 'financeiro', 'clientes', 'relatorios', 'ranking'],
      somenteLeitura: true,
      proprios: false
    }
  };

  /* ---------------- configuração padrão ---------------- */
  function defaultConfig() {
    return {
      empresa: 'Firece',
      gestor: 'Gestor',
      moeda: 'BRL',
      metaFaturamentoMensal: 180000,
      metaVendasMensal: 25,
      baseLinks: 'https://cadastro.firece.com.br/',

      categorias: [
        { id: 'cat_saas', nome: 'SaaS / Assinatura', cor: '#E8400D' },
        { id: 'cat_consult', nome: 'Consultoria', cor: '#7c3aed' },
        { id: 'cat_treina', nome: 'Treinamento', cor: '#0E9F6E' },
        { id: 'cat_licenca', nome: 'Licenciamento', cor: '#D97706' },
        { id: 'cat_servico', nome: 'Serviços', cor: '#0E8C9E' }
      ],

      tiposProduto: [
        { id: 'tp_digital', nome: 'Produto Digital' },
        { id: 'tp_servico', nome: 'Serviço' },
        { id: 'tp_assinatura', nome: 'Assinatura' },
        { id: 'tp_projeto', nome: 'Projeto' }
      ],

      tiposCobranca: [
        { id: 'cob_unico', nome: 'Pagamento único', recorrente: false },
        { id: 'cob_recorrente', nome: 'Recorrente', recorrente: true },
        { id: 'cob_parcelado', nome: 'Parcelado', recorrente: false }
      ],

      periodicidades: [
        { id: 'per_unica', nome: 'Única', meses: 0 },
        { id: 'per_mensal', nome: 'Mensal', meses: 1 },
        { id: 'per_trimestral', nome: 'Trimestral', meses: 3 },
        { id: 'per_semestral', nome: 'Semestral', meses: 6 },
        { id: 'per_anual', nome: 'Anual', meses: 12 }
      ],

      formasPagamento: [
        { id: 'fp_pix', nome: 'PIX' },
        { id: 'fp_boleto', nome: 'Boleto' },
        { id: 'fp_cartao', nome: 'Cartão de crédito' },
        { id: 'fp_transf', nome: 'Transferência' },
        { id: 'fp_nf', nome: 'Faturado (NF)' }
      ],

      comissoes: [
        { id: 'com_padrao', nome: 'Padrão', percentual: 10 },
        { id: 'com_premium', nome: 'Premium', percentual: 15 },
        { id: 'com_renovacao', nome: 'Renovação', percentual: 5 },
        { id: 'com_zero', nome: 'Sem comissão', percentual: 0 }
      ],

      origens: ['Site', 'Indicação', 'LinkedIn', 'Instagram', 'Evento', 'Prospecção ativa',
        'Google Ads', 'Parceiro', 'Base de clientes'],

      /* status de produto */
      statusProduto: [
        { id: 'sp_ativo', nome: 'Ativo', emoji: '🟢', cor: 'green', ativo: true },
        { id: 'sp_inativo', nome: 'Inativo', emoji: '🔴', cor: 'red', ativo: false },
        { id: 'sp_dev', nome: 'Em desenvolvimento', emoji: '🟡', cor: 'gold', ativo: false },
        { id: 'sp_arquivado', nome: 'Arquivado', emoji: '⚪', cor: 'gray', ativo: false, arquivado: true }
      ],

      /* etapas do funil = status do cadastro/oportunidade */
      etapas: [
        { id: 'et_novo', nome: 'NOVO', emoji: '🔵', cor: 'blue', ordem: 1, aberto: true },
        { id: 'et_contato', nome: 'CONTATO', emoji: '🔵', cor: 'blue', ordem: 2, aberto: true },
        { id: 'et_proposta', nome: 'PROPOSTA', emoji: '🟣', cor: 'purple', ordem: 3, aberto: true },
        { id: 'et_negociacao', nome: 'NEGOCIAÇÃO', emoji: '🟠', cor: 'orange', ordem: 4, aberto: true },
        { id: 'et_pagamento', nome: 'PAGAMENTO', emoji: '🟡', cor: 'gold', ordem: 5, aberto: true },
        { id: 'et_pago', nome: 'PAGO', emoji: '🟢', cor: 'green', ordem: 6, ganho: true, recebido: true },
        { id: 'et_fechado', nome: 'FECHADO', emoji: '🟢', cor: 'green', ordem: 7, ganho: true },
        { id: 'et_cancelado', nome: 'CANCELADO', emoji: '🔴', cor: 'red', ordem: 8, perdido: true }
      ],

      /* status de venda */
      statusVenda: [
        { id: 'sv_fechada', nome: 'FECHADA', emoji: '🟢', cor: 'green', ativa: true, recebida: false },
        { id: 'sv_paga', nome: 'PAGA', emoji: '🟢', cor: 'green', ativa: true, recebida: true },
        { id: 'sv_cancelada', nome: 'CANCELADA', emoji: '🔴', cor: 'red', ativa: false, recebida: false }
      ],

      prioridades: [
        { id: 'pr_alta', nome: 'Alta', emoji: '🔴', cor: 'red', peso: 3 },
        { id: 'pr_media', nome: 'Média', emoji: '🟡', cor: 'gold', peso: 2 },
        { id: 'pr_baixa', nome: 'Baixa', emoji: '🟢', cor: 'green', peso: 1 }
      ],

      statusTarefa: [
        { id: 'st_afazer', nome: 'A fazer', cor: 'gray' },
        { id: 'st_andamento', nome: 'Em andamento', cor: 'blue' },
        { id: 'st_concluido', nome: 'Concluído', cor: 'green', concluido: true }
      ],

      statusCliente: [
        { id: 'sc_ativo', nome: 'Ativo', cor: 'green', ativo: true },
        { id: 'sc_prospect', nome: 'Prospect', cor: 'blue' },
        { id: 'sc_inativo', nome: 'Inativo', cor: 'gray' }
      ]
    };
  }

  const COLLECTIONS = ['usuarios', 'produtos', 'clientes', 'oportunidades', 'vendas', 'tarefas'];

  /* ---------------- estado ---------------- */
  let db = null;
  let modo = 'local';           // 'local' | 'nuvem'
  const listeners = {};

  function emit(evt, payload) {
    (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
    if (evt !== '*') (listeners['*'] || []).forEach(fn => { try { fn(evt, payload); } catch (e) { console.error(e); } });
  }

  function blank() {
    return {
      meta: { schema: SCHEMA, criadoEm: U.today(), usuarioAtivo: null, seed: false },
      config: defaultConfig(),
      usuarios: [], produtos: [], clientes: [], oportunidades: [], vendas: [], tarefas: []
    };
  }

  /* ---------------- persistência ---------------- */
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      // no modo nuvem o localStorage é só cache: estourar a cota não é erro fatal
      if (modo === 'local') {
        console.error('Falha ao salvar', e);
        emit('storage-error', e);
      }
      return false;
    }
  }

  /* ---------------- ponte com o servidor ---------------- */
  /**
   * Sobe uma alteração para o Supabase. Se o servidor recusar
   * (perfil sem permissão, sessão expirada, sem internet), desfaz
   * a alteração local e avisa, para a tela nunca mostrar um dado
   * que o servidor não aceitou.
   */
  function sincronizar(acao, colecao, item, anterior) {
    if (modo !== 'nuvem' || !global.Backend) return;
    const promessa = acao === 'excluir'
      ? Backend.excluir(colecao, item)
      : Backend.salvar(colecao, item);
    promessa.catch(err => {
      desfazer(acao, colecao, item, anterior);
      emit('sync-error', { acao, colecao, mensagem: err.message });
    });
  }

  function desfazer(acao, colecao, item, anterior) {
    const arr = db[colecao];
    if (!arr) return;
    if (acao === 'excluir') {
      if (anterior) arr.push(anterior);
    } else if (anterior) {
      const i = arr.findIndex(x => x.id === anterior.id);
      if (i >= 0) arr[i] = anterior; else arr.push(anterior);
    } else {
      const id = item && item.id;
      const i = arr.findIndex(x => x.id === id);
      if (i >= 0) arr.splice(i, 1);
    }
    save();
    emit('change', { collection: colecao, desfeito: true });
  }

  function sincronizarConfig() {
    if (modo !== 'nuvem' || !global.Backend) return;
    Backend.salvarConfig(db.config).catch(err => {
      emit('sync-error', { acao: 'config', colecao: 'configuracoes', mensagem: err.message });
    });
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { /* modo privado */ }
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        db = migrate(parsed);
        return db;
      } catch (e) {
        console.warn('Dados corrompidos, recriando base de demonstração.', e);
      }
    }
    db = seed(blank());
    save();
    return db;
  }

  /** garante que bases antigas recebam campos de config novos */
  function migrate(data) {
    const base = blank();
    const out = Object.assign({}, base, data);
    out.meta = Object.assign({}, base.meta, data.meta || {});
    out.config = Object.assign({}, base.config, data.config || {});
    // listas de configuração: mantém as do usuário, mas nunca deixa vazio
    Object.keys(base.config).forEach(k => {
      if (Array.isArray(base.config[k]) && (!Array.isArray(out.config[k]) || !out.config[k].length)) {
        out.config[k] = base.config[k];
      }
    });
    COLLECTIONS.forEach(c => { if (!Array.isArray(out[c])) out[c] = []; });
    out.meta.schema = SCHEMA;
    return out;
  }

  /**
   * Entra no modo nuvem: substitui a base em memória pelo que veio
   * do Supabase e passa a identificar quem está usando pelo login.
   */
  function hidratarDaNuvem(dados, usuarioLogado) {
    modo = 'nuvem';
    db = blank();
    db.config = Object.assign(db.config, dados.config || {});
    // listas de configuração nunca podem ficar vazias
    const padrao = defaultConfig();
    Object.keys(padrao).forEach(k => {
      if (Array.isArray(padrao[k]) && (!Array.isArray(db.config[k]) || !db.config[k].length)) {
        db.config[k] = padrao[k];
      }
    });
    COLLECTIONS.forEach(c => { db[c] = Array.isArray(dados[c]) ? dados[c] : []; });
    db.meta.usuarioAtivo = usuarioLogado ? usuarioLogado.id : null;
    db.meta.modo = 'nuvem';
    save();
    emit('change', { collection: '*' });
    return db;
  }

  /** Aplica uma mudança que veio de outra pessoa, em tempo real. */
  function aplicarMudancaRemota(colecao, registro, removido) {
    if (!db[colecao]) return false;
    const arr = db[colecao];
    const i = arr.findIndex(x => x.id === registro.id);
    if (removido) {
      if (i < 0) return false;
      arr.splice(i, 1);
    } else if (i >= 0) {
      arr[i] = registro;
    } else {
      arr.push(registro);
    }
    save();
    emit('change', { collection: colecao, remoto: true });
    return true;
  }

  function aplicarConfigRemota(cfg) {
    if (!cfg) return;
    Object.assign(db.config, cfg);
    save();
    emit('change', { collection: 'config', remoto: true });
  }

  const modoAtual = () => modo;

  function reset(withSeed) {
    db = blank();
    if (withSeed !== false) seed(db);
    save();
    emit('reset');
    emit('change', { collection: '*' });
    return db;
  }

  /* ---------------- CRUD genérico ---------------- */
  function list(col) { return (db && db[col]) || []; }
  function get(col, id) { return list(col).find(x => x.id === id) || null; }

  function upsert(col, obj, opts) {
    const silent = opts && opts.silent;
    const arr = db[col];
    let saved, anterior = null;
    if (obj.id && arr.some(x => x.id === obj.id)) {
      const i = arr.findIndex(x => x.id === obj.id);
      anterior = Object.assign({}, arr[i]);
      saved = Object.assign({}, arr[i], obj, { atualizadoEm: new Date().toISOString() });
      arr[i] = saved;
    } else {
      saved = Object.assign({
        id: U.uid(col.slice(0, 3)),
        criadoEm: new Date().toISOString()
      }, obj);
      if (!saved.id) saved.id = U.uid(col.slice(0, 3));
      arr.push(saved);
    }
    if (!silent) {
      save();
      sincronizar('salvar', col, saved, anterior);
      emit('change', { collection: col, item: saved });
    }
    return saved;
  }

  function remove(col, id) {
    const i = db[col].findIndex(x => x.id === id);
    if (i < 0) return false;
    const item = db[col][i];
    const antesDaCascata = {};
    if (modo === 'nuvem') {
      COLLECTIONS.forEach(c => { antesDaCascata[c] = db[c].map(x => x.id); });
    }
    db[col].splice(i, 1);
    cascade(col, id);
    save();
    if (modo === 'nuvem') {
      sincronizar('excluir', col, id, item);
      // o que a cascata levou junto também precisa sair do servidor
      COLLECTIONS.forEach(c => {
        const agora = new Set(db[c].map(x => x.id));
        antesDaCascata[c].forEach(idAntigo => {
          if (!agora.has(idAntigo) && !(c === col && idAntigo === id)) {
            sincronizar('excluir', c, idAntigo, null);
          }
        });
      });
    }
    emit('change', { collection: col, removed: item });
    return true;
  }

  /** limpa referências órfãs ao excluir um registro */
  function cascade(col, id) {
    if (col === 'produtos') {
      db.oportunidades.forEach(o => { if (o.produtoId === id) o.produtoId = ''; });
      db.vendas.forEach(v => { if (v.produtoId === id) v.produtoId = ''; });
      db.tarefas.forEach(t => { if (t.produtoId === id) t.produtoId = ''; });
    }
    if (col === 'clientes') {
      db.oportunidades = db.oportunidades.filter(o => o.clienteId !== id);
      db.vendas = db.vendas.filter(v => v.clienteId !== id);
      db.tarefas.forEach(t => { if (t.clienteId === id) t.clienteId = ''; });
    }
    if (col === 'oportunidades') {
      db.vendas = db.vendas.filter(v => v.oportunidadeId !== id);
    }
    if (col === 'usuarios') {
      const fallback = (db.usuarios[0] || {}).id || '';
      ['oportunidades', 'vendas', 'tarefas', 'produtos', 'clientes'].forEach(c => {
        db[c].forEach(x => { if (x.responsavelId === id) x.responsavelId = fallback; });
      });
      if (db.meta.usuarioAtivo === id) db.meta.usuarioAtivo = fallback;
    }
  }

  /* ---------------- config (listas editáveis) ---------------- */
  function configList(key) { return (db.config[key] || []); }

  function configUpsert(key, item) {
    const arr = db.config[key] = db.config[key] || [];
    if (item.id && arr.some(x => x.id === item.id)) {
      const i = arr.findIndex(x => x.id === item.id);
      arr[i] = Object.assign({}, arr[i], item);
    } else {
      item.id = item.id || U.uid(key.slice(0, 3));
      arr.push(item);
    }
    save();
    sincronizarConfig();
    emit('change', { collection: 'config', key });
    return item;
  }

  function configRemove(key, id) {
    const arr = db.config[key] || [];
    const i = arr.findIndex(x => x.id === id);
    if (i < 0) return false;
    arr.splice(i, 1);
    save();
    sincronizarConfig();
    emit('change', { collection: 'config', key });
    return true;
  }

  function setConfig(patch) {
    Object.assign(db.config, patch);
    save();
    sincronizarConfig();
    emit('change', { collection: 'config' });
  }

  /* ---------------- lookups ---------------- */
  const find = (arr, id) => (arr || []).find(x => x.id === id) || null;
  const L = {
    produto: id => find(db.produtos, id),
    cliente: id => find(db.clientes, id),
    usuario: id => find(db.usuarios, id),
    oportunidade: id => find(db.oportunidades, id),
    venda: id => find(db.vendas, id),
    categoria: id => find(db.config.categorias, id),
    etapa: id => find(db.config.etapas, id) || db.config.etapas[0],
    statusProduto: id => find(db.config.statusProduto, id) || db.config.statusProduto[0],
    statusVenda: id => find(db.config.statusVenda, id) || db.config.statusVenda[0],
    statusTarefa: id => find(db.config.statusTarefa, id) || db.config.statusTarefa[0],
    statusCliente: id => find(db.config.statusCliente, id) || db.config.statusCliente[0],
    prioridade: id => find(db.config.prioridades, id) || db.config.prioridades[1],
    periodicidade: id => find(db.config.periodicidades, id),
    tipoCobranca: id => find(db.config.tiposCobranca, id),
    comissao: id => find(db.config.comissoes, id),
    nomeProduto: id => (find(db.produtos, id) || {}).nome || '—',
    nomeCliente: id => (find(db.clientes, id) || {}).nome || '—',
    nomeUsuario: id => (find(db.usuarios, id) || {}).nome || '—'
  };

  /** etapas ordenadas do funil (apenas as que aparecem no kanban) */
  function etapasFunil() {
    return U.sortBy(db.config.etapas, e => e.ordem || 0, 'asc');
  }

  /** meses equivalentes de uma venda recorrente (0 = não recorrente) */
  function mesesRecorrencia(venda) {
    const prod = L.produto(venda.produtoId);
    const perId = venda.periodicidadeId || (prod && prod.periodicidadeId);
    const per = L.periodicidade(perId);
    return per ? (Number(per.meses) || 0) : 0;
  }

  /** receita mensal equivalente (MRR) de uma venda recorrente */
  function mrr(venda) {
    const meses = mesesRecorrencia(venda);
    if (!meses) return 0;
    const receita = (Number(venda.valorBruto) || 0) - (Number(venda.desconto) || 0);
    return receita / meses;
  }

  /* ---------------- cálculo de venda ---------------- */
  /**
   * Recalcula desconto/comissão/custo/líquido de uma venda.
   * Fórmula: líquido = bruto - desconto - custo - comissão
   */
  function calcVenda(v) {
    const prod = L.produto(v.produtoId);
    const bruto = U.round2(U.parseMoney(v.valorBruto));
    const desconto = U.round2(U.parseMoney(v.desconto));
    const baseComissionavel = Math.max(0, bruto - desconto);

    let pctCom = v.comissaoPct;
    if (pctCom === '' || pctCom === null || pctCom === undefined) {
      const tab = L.comissao(v.comissaoTabelaId);
      pctCom = tab ? tab.percentual : (prod ? prod.comissaoPct : 0);
    }
    pctCom = Number(pctCom) || 0;
    const comissao = U.round2(baseComissionavel * pctCom / 100);

    let custo = v.custo;
    if (custo === '' || custo === null || custo === undefined) {
      custo = prod ? (Number(prod.custo) || 0) * (Number(v.quantidade) || 1) : 0;
    }
    custo = U.round2(U.parseMoney(custo));

    const liquido = U.round2(bruto - desconto - custo - comissao);
    return Object.assign({}, v, {
      valorBruto: bruto,
      desconto: desconto,
      comissaoPct: pctCom,
      comissao: comissao,
      custo: custo,
      valorLiquido: liquido,
      margemPct: bruto > 0 ? U.round2((liquido / bruto) * 100) : 0
    });
  }

  function salvarVenda(v, opts) {
    const calc = calcVenda(v);
    const st = L.statusVenda(calc.statusId);
    if (st && st.recebida && !calc.dataPagamento) calc.dataPagamento = calc.dataVenda || U.today();
    if (st && !st.recebida) calc.dataPagamento = st.ativa ? (calc.dataPagamento || '') : '';
    if (calc.emCarteira === undefined) calc.emCarteira = !!(st && st.ativa);
    if (st && !st.ativa) calc.emCarteira = false;
    return upsert('vendas', calc, opts);
  }

  /* ---------------- regras automáticas ---------------- */
  /**
   * Aplica a etapa a uma oportunidade e dispara os efeitos:
   *  - etapa de ganho  -> cria/atualiza a venda vinculada (entra em faturamento e carteira)
   *  - etapa "PAGO"    -> marca a venda como recebida
   *  - etapa perdida   -> cancela a venda e remove dos indicadores ativos
   *  - volta para aberta -> desfaz a venda vinculada
   * Retorna { oportunidade, venda, mensagens[] }
   */
  function moverEtapa(oportunidadeId, etapaId, extra) {
    const op = L.oportunidade(oportunidadeId);
    if (!op) return null;
    const etapa = L.etapa(etapaId);
    const antes = L.etapa(op.etapaId);
    const msgs = [];
    const hoje = U.today();

    op.etapaId = etapa.id;
    op.atualizadoEm = new Date().toISOString();
    op.historico = op.historico || [];
    if (!antes || antes.id !== etapa.id) {
      op.historico.push({ data: hoje, de: antes ? antes.nome : '—', para: etapa.nome });
    }
    Object.assign(op, extra || {});

    let venda = op.vendaId ? L.venda(op.vendaId) : null;

    if (etapa.ganho) {
      const stVenda = etapa.recebido
        ? (db.config.statusVenda.find(s => s.recebida) || db.config.statusVenda[0])
        : (db.config.statusVenda.find(s => s.ativa && !s.recebida) || db.config.statusVenda[0]);
      const prod = L.produto(op.produtoId);
      const dados = {
        id: venda ? venda.id : undefined,
        oportunidadeId: op.id,
        clienteId: op.clienteId,
        produtoId: op.produtoId,
        responsavelId: op.responsavelId,
        quantidade: op.quantidade || 1,
        valorBruto: op.valor,
        desconto: (venda && venda.desconto) || 0,
        comissaoPct: (venda && venda.comissaoPct !== undefined) ? venda.comissaoPct : (prod ? prod.comissaoPct : 0),
        custo: (venda && venda.custo !== undefined) ? venda.custo : undefined,
        periodicidadeId: op.periodicidadeId || (prod && prod.periodicidadeId),
        formaPagamentoId: op.formaPagamentoId || (venda && venda.formaPagamentoId) || '',
        statusId: stVenda.id,
        dataVenda: (venda && venda.dataVenda) || op.dataFechamento || hoje,
        dataPagamento: etapa.recebido ? ((venda && venda.dataPagamento) || hoje) : '',
        emCarteira: true,
        observacoes: op.observacoes || ''
      };
      venda = salvarVenda(dados, { silent: true });
      op.vendaId = venda.id;
      op.dataFechamento = venda.dataVenda;
      msgs.push(etapa.recebido
        ? 'Venda registrada como recebida — faturamento e carteira atualizados.'
        : 'Venda registrada — faturamento, carteira e indicadores atualizados.');

      // cliente passa a ativo
      const cli = L.cliente(op.clienteId);
      if (cli) {
        const stAtivo = db.config.statusCliente.find(s => s.ativo);
        if (stAtivo && cli.statusId !== stAtivo.id) { cli.statusId = stAtivo.id; msgs.push('Cliente movido para a carteira ativa.'); }
      }
    } else if (etapa.perdido) {
      if (venda) {
        const stCanc = db.config.statusVenda.find(s => !s.ativa) || null;
        if (stCanc) { venda.statusId = stCanc.id; venda.emCarteira = false; venda.dataPagamento = ''; }
        msgs.push('Venda cancelada — valores retirados da receita ativa e da carteira.');
      } else {
        msgs.push('Oportunidade cancelada — retirada do pipeline.');
      }
    } else {
      // voltou para uma etapa aberta: desfaz a venda gerada automaticamente
      if (venda) {
        const i = db.vendas.findIndex(x => x.id === venda.id);
        if (i >= 0) db.vendas.splice(i, 1);
        op.vendaId = '';
        op.dataFechamento = '';
        venda = null;
        msgs.push('Venda vinculada removida — valor voltou para o pipeline.');
      }
    }

    save();
    emit('change', { collection: 'oportunidades', item: op });
    return { oportunidade: op, venda: venda, mensagens: msgs };
  }

  /* ---------------- usuários / permissões ---------------- */
  function currentUser() {
    const u = L.usuario(db.meta.usuarioAtivo);
    if (u) return u;
    // no modo nuvem a identidade vem do login: nunca "chutar" outro usuário
    if (modo === 'nuvem') return null;
    return db.usuarios.find(x => x.perfil === 'admin') || db.usuarios[0] || null;
  }
  function setUser(id) {
    if (modo === 'nuvem') return;   // quem manda é o login
    db.meta.usuarioAtivo = id;
    save();
    emit('user-change', currentUser());
    emit('change', { collection: 'meta' });
  }
  function perfil() {
    const u = currentUser();
    if (!u) return modo === 'nuvem' ? PERFIS.leitor : PERFIS.admin;
    return PERFIS[u.perfil] || PERFIS.leitor;
  }
  function podeVer(rota) {
    const p = perfil();
    if (p.permite === '*') return true;
    return p.permite.indexOf(rota) > -1;
  }
  function podeEditar() { return !perfil().somenteLeitura; }
  function podeConfigurar(area) {
    const p = perfil();
    if (p.permite === '*') return true;
    if (p.somenteLeitura) return false;
    if (p.negaConfig && area && p.negaConfig.indexOf(area) > -1) return false;
    return podeVer('config');
  }
  /** consultor só enxerga os próprios registros */
  function scope(items, campo) {
    const p = perfil();
    if (!p.proprios) return items;
    const u = currentUser();
    const id = u ? u.id : '';
    const key = campo || 'responsavelId';
    return (items || []).filter(x => x[key] === id);
  }

  /* ---------------- exportar / importar ---------------- */
  function exportJSON() { return JSON.stringify(db, null, 2); }
  function importJSON(text) {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.config) throw new Error('Arquivo inválido: estrutura não reconhecida.');
    db = migrate(parsed);
    save();
    emit('reset');
    emit('change', { collection: '*' });
    return db;
  }

  /* =========================================================
     SEED — dados fictícios de demonstração
     ========================================================= */
  function rng(seedVal) {
    let s = seedVal >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function seed(base) {
    const r = rng(20240914);
    const pick = arr => arr[Math.floor(r() * arr.length) % arr.length];
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const cfg = base.config;
    const hoje = new Date();
    const anoAtual = hoje.getFullYear(), mesAtual = hoje.getMonth();

    /* --- usuários --- */
    const usuarios = [
      { id: 'usr_admin', nome: 'Marina Prado', email: 'marina.prado@empresa.com.br', perfil: 'admin', cargo: 'Head de Produtos', ativo: true },
      { id: 'usr_gestor', nome: 'Rafael Lima', email: 'rafael.lima@empresa.com.br', perfil: 'gestor', cargo: 'Gestor de Produtos', ativo: true },
      { id: 'usr_c1', nome: 'Bianca Torres', email: 'bianca.torres@empresa.com.br', perfil: 'consultor', cargo: 'Consultora de Vendas', ativo: true },
      { id: 'usr_c2', nome: 'Diego Ramos', email: 'diego.ramos@empresa.com.br', perfil: 'consultor', cargo: 'Consultor de Vendas', ativo: true },
      { id: 'usr_c3', nome: 'Carla Menezes', email: 'carla.menezes@empresa.com.br', perfil: 'consultor', cargo: 'Consultora de Vendas', ativo: true },
      { id: 'usr_leitor', nome: 'Paulo Diretoria', email: 'paulo@empresa.com.br', perfil: 'leitor', cargo: 'Diretor', ativo: true }
    ];
    base.usuarios = usuarios;
    base.meta.usuarioAtivo = 'usr_admin';
    const consultores = usuarios.filter(u => u.perfil === 'consultor' || u.perfil === 'gestor');

    /* --- produtos --- */
    const defsProdutos = [
      ['CRM Vendas Pro', 'CRM-PRO', 'cat_saas', 'tp_assinatura', 'cob_recorrente', 'per_anual', 14400, 3600, 12, 'sp_ativo', 'Plataforma completa de gestão comercial com automações e relatórios.'],
      ['CRM Vendas Starter', 'CRM-STR', 'cat_saas', 'tp_assinatura', 'cob_recorrente', 'per_mensal', 590, 140, 10, 'sp_ativo', 'Versão essencial do CRM para times de até 5 vendedores.'],
      ['Implantação Express', 'IMP-EXP', 'cat_servico', 'tp_projeto', 'cob_unico', 'per_unica', 8900, 3100, 8, 'sp_ativo', 'Projeto de implantação assistida em até 30 dias.'],
      ['Consultoria Comercial', 'CON-COM', 'cat_consult', 'tp_servico', 'cob_unico', 'per_unica', 18500, 6400, 15, 'sp_ativo', 'Diagnóstico e redesenho do processo comercial.'],
      ['Academia de Vendas', 'TRE-ACA', 'cat_treina', 'tp_digital', 'cob_unico', 'per_unica', 3200, 640, 20, 'sp_ativo', 'Trilha de treinamento para times de vendas, 12 módulos.'],
      ['Licença API Integra', 'LIC-API', 'cat_licenca', 'tp_digital', 'cob_recorrente', 'per_anual', 9600, 1450, 10, 'sp_ativo', 'Licença anual de uso da API de integração.'],
      ['Suporte Premium', 'SUP-PRE', 'cat_servico', 'tp_assinatura', 'cob_recorrente', 'per_mensal', 1250, 420, 5, 'sp_ativo', 'SLA de 4h com gerente de contas dedicado.'],
      ['Analytics Board', 'ANA-BRD', 'cat_saas', 'tp_assinatura', 'cob_recorrente', 'per_mensal', 890, 210, 12, 'sp_dev', 'Painéis analíticos avançados — lançamento previsto.'],
      ['Workshop Presencial', 'TRE-WKS', 'cat_treina', 'tp_servico', 'cob_unico', 'per_unica', 6800, 2900, 12, 'sp_inativo', 'Workshop de 8 horas na sede do cliente.'],
      ['Migração de Dados', 'SER-MIG', 'cat_servico', 'tp_projeto', 'cob_unico', 'per_unica', 4400, 1500, 8, 'sp_arquivado', 'Serviço descontinuado em favor da Implantação Express.']
    ];
    base.produtos = defsProdutos.map((d, i) => {
      const preco = d[6], custo = d[7];
      return {
        id: 'prd_' + U.slug(d[1]),
        nome: d[0], sku: d[1], categoriaId: d[2], tipoId: d[3],
        tipoCobrancaId: d[4], periodicidadeId: d[5],
        preco: preco, custo: custo, comissaoPct: d[8],
        statusId: d[9], descricao: d[10],
        link: cfg.baseLinks + U.slug(d[0]),
        responsavelId: i % 2 === 0 ? 'usr_gestor' : 'usr_admin',
        observacoes: '',
        dataCriacao: U.toISO(new Date(anoAtual - (i < 4 ? 1 : 0), (i * 2) % 12, 1 + (i * 3) % 25))
      };
    });
    const prodAtivos = base.produtos.filter(p => L2(cfg, 'statusProduto', p.statusId).ativo);

    /* --- clientes --- */
    const nomes = ['João da Silva', 'Maria Santos', 'Carlos Eduardo Nunes', 'Ana Paula Ferreira', 'Roberto Alves',
      'Fernanda Costa', 'Bruno Machado', 'Patrícia Gomes', 'Lucas Andrade', 'Juliana Rocha',
      'Marcelo Pinto', 'Camila Duarte', 'Ricardo Barros', 'Larissa Monteiro', 'Thiago Cardoso',
      'Renata Aguiar', 'Gustavo Freitas', 'Débora Nogueira', 'Felipe Moraes', 'Vanessa Lopes',
      'André Tavares', 'Sofia Bernardes', 'Rodrigo Peixoto', 'Isabela Cunha', 'Eduardo Vasques',
      'Priscila Martins', 'Alexandre Reis', 'Natália Campos', 'Vinícius Prado', 'Tatiane Souza',
      'Leandro Batista', 'Mônica Carvalho', 'Sérgio Fontes', 'Aline Ribeiro', 'Otávio Dias',
      'Beatriz Almeida', 'Henrique Sales', 'Clara Bastos', 'Murilo Teixeira', 'Sandra Vieira',
      'Caio Belmonte', 'Elisa Moreira', 'Fábio Quintana', 'Helena Braga', 'Igor Santana'];
    const empresas = ['Empresa XYZ', 'Alpha Distribuidora', 'Nexus Tecnologia', 'Vertex Consultoria', 'Prisma Varejo',
      'Sigma Logística', 'Órion Serviços', 'Delta Indústria', 'Atlas Educação', 'Vega Saúde',
      'Lumen Engenharia', 'Norte Agro', 'Prime Seguros', 'Rota Transportes', 'Origem Alimentos',
      'Tropos Marketing', 'Cortex Software', 'Bravo Construtora', 'Selo Gráfica', 'Mar Azul Turismo',
      'Ponto Certo Contábil', 'Raízes Cosméticos', 'Forte Metalurgia', 'Zenit Energia', 'Aurora Têxtil',
      'Bora Delivery', 'Clave Música', 'Duna Imobiliária', 'Eco Reciclagem', 'Fluxo Financeira',
      'Garra Esportes', 'Horizonte Viagens', 'Íris Óticas', 'Juno Pet', 'Krono Relógios',
      'Lótus Bem-Estar', 'Meta Farma', 'Nuvem Hosting', 'Opala Joias', 'Pulso Clínicas',
      'Quartzo Mineração', 'Raio Elétrica', 'Serra Café', 'Tucano Papelaria', 'Uirapuru Ambiental'];

    base.clientes = nomes.map((nome, i) => {
      const pj = i % 3 !== 0;
      const doc = pj
        ? String(int(10, 89)) + '.' + String(int(100, 999)) + '.' + String(int(100, 999)) + '/0001-' + String(int(10, 99))
        : String(int(100, 999)) + '.' + String(int(100, 999)) + '.' + String(int(100, 999)) + '-' + String(int(10, 99));
      const mesesAtras = int(0, 15);
      return {
        id: 'cli_' + (i + 1),
        nome: nome,
        documento: doc,
        email: U.slug(nome).replace(/-/g, '.') + '@' + U.slug(empresas[i]).replace(/-/g, '') + '.com.br',
        telefone: '(' + int(11, 85) + ') 9' + int(1000, 9999) + '-' + int(1000, 9999),
        empresa: empresas[i],
        origem: pick(cfg.origens),
        responsavelId: consultores[i % consultores.length].id,
        statusId: 'sc_prospect',
        dataCadastro: U.toISO(new Date(anoAtual, mesAtual - mesesAtras, int(1, 28))),
        observacoes: ''
      };
    });

    /* --- vendas históricas (14 meses) --- */
    const vendas = [];
    let contador = 0;
    for (let m = 13; m >= 0; m--) {
      const ref = new Date(anoAtual, mesAtual - m, 1);
      // curva de crescimento com sazonalidade
      const qtd = U.clamp(Math.round(7 + (13 - m) * 0.55 + Math.sin(m / 2) * 2 + r() * 2.5), 4, 22);
      for (let k = 0; k < qtd; k++) {
        const prod = prodAtivos[Math.floor(r() * prodAtivos.length)];
        const cli = base.clientes[Math.floor(r() * base.clientes.length)];
        const resp = consultores[Math.floor(r() * consultores.length)];
        const dia = U.clamp(int(1, 28), 1, U.daysInMonth(ref.getFullYear(), ref.getMonth()));
        const dataVenda = U.toISO(new Date(ref.getFullYear(), ref.getMonth(), dia));
        if (dataVenda > U.today()) continue;
        const qtdItens = prod.preco > 10000 ? 1 : int(1, 3);
        const bruto = U.round2(prod.preco * qtdItens * (0.92 + r() * 0.25));
        const desconto = r() < 0.35 ? U.round2(bruto * (0.03 + r() * 0.09)) : 0;
        const cancelada = r() < 0.07;
        const paga = !cancelada && (m > 0 ? r() < 0.93 : r() < 0.55);
        const statusId = cancelada ? 'sv_cancelada' : (paga ? 'sv_paga' : 'sv_fechada');
        contador++;
        vendas.push({
          id: 'vnd_' + contador,
          oportunidadeId: '',
          clienteId: cli.id,
          produtoId: prod.id,
          responsavelId: resp.id,
          quantidade: qtdItens,
          valorBruto: bruto,
          desconto: desconto,
          comissaoPct: prod.comissaoPct,
          custo: U.round2(prod.custo * qtdItens),
          periodicidadeId: prod.periodicidadeId,
          formaPagamentoId: pick(cfg.formasPagamento).id,
          statusId: statusId,
          dataVenda: dataVenda,
          dataPagamento: paga ? U.addDays(dataVenda, int(0, 12)) : '',
          emCarteira: !cancelada,
          observacoes: '',
          criadoEm: dataVenda + 'T10:00:00.000Z'
        });
      }
    }
    base.vendas = vendas.map(v => {
      const calc = calcVendaWith(base, v);
      return calc;
    });

    // clientes com venda ativa viram "ativos"
    const ativos = new Set(base.vendas.filter(v => v.statusId !== 'sv_cancelada').map(v => v.clienteId));
    base.clientes.forEach(c => { if (ativos.has(c.id)) c.statusId = 'sc_ativo'; });

    /* --- oportunidades em aberto --- */
    const etapasAbertas = ['et_novo', 'et_contato', 'et_proposta', 'et_negociacao', 'et_pagamento'];
    const distrib = { et_novo: 12, et_contato: 9, et_proposta: 8, et_negociacao: 7, et_pagamento: 4 };
    const ops = [];
    let oc = 0;
    etapasAbertas.forEach(et => {
      for (let k = 0; k < distrib[et]; k++) {
        oc++;
        const prod = prodAtivos[Math.floor(r() * prodAtivos.length)];
        const cli = base.clientes[Math.floor(r() * base.clientes.length)];
        const resp = consultores[Math.floor(r() * consultores.length)];
        const diasAtras = int(0, 55);
        const prio = r() < 0.2 ? 'pr_alta' : (r() < 0.68 ? 'pr_media' : 'pr_baixa');
        ops.push({
          id: 'opt_' + oc,
          clienteId: cli.id,
          produtoId: prod.id,
          responsavelId: resp.id,
          quantidade: 1,
          valor: U.round2(prod.preco * (0.9 + r() * 0.4)),
          etapaId: et,
          prioridadeId: prio,
          origem: cli.origem,
          data: U.addDays(U.today(), -diasAtras),
          previsaoFechamento: U.addDays(U.today(), int(3, 60)),
          periodicidadeId: prod.periodicidadeId,
          formaPagamentoId: '',
          observacoes: '',
          vendaId: '',
          historico: []
        });
      }
    });
    // algumas oportunidades já ganhas/perdidas para dar taxa de conversão
    for (let k = 0; k < 22; k++) {
      oc++;
      const prod = prodAtivos[Math.floor(r() * prodAtivos.length)];
      const cli = base.clientes[Math.floor(r() * base.clientes.length)];
      const resp = consultores[Math.floor(r() * consultores.length)];
      const ganha = r() < 0.62;
      const data = U.addDays(U.today(), -int(10, 120));
      ops.push({
        id: 'opt_' + oc,
        clienteId: cli.id, produtoId: prod.id, responsavelId: resp.id,
        quantidade: 1,
        valor: U.round2(prod.preco * (0.9 + r() * 0.3)),
        etapaId: ganha ? (r() < 0.6 ? 'et_pago' : 'et_fechado') : 'et_cancelado',
        prioridadeId: 'pr_media',
        origem: cli.origem,
        data: data,
        previsaoFechamento: U.addDays(data, 20),
        dataFechamento: U.addDays(data, int(5, 25)),
        periodicidadeId: prod.periodicidadeId,
        formaPagamentoId: '',
        observacoes: '',
        vendaId: '',
        historico: []
      });
    }
    base.oportunidades = ops;

    /* --- tarefas --- */
    const titulos = [
      'Enviar proposta comercial', 'Follow-up da proposta', 'Agendar demonstração',
      'Revisar contrato', 'Cobrar assinatura do contrato', 'Ligar para o cliente',
      'Enviar material do produto', 'Confirmar dados de faturamento', 'Renovação do contrato',
      'Reunião de alinhamento', 'Preparar apresentação de resultados', 'Validar escopo de implantação',
      'Enviar boleto', 'Checar satisfação pós-venda'
    ];
    base.tarefas = titulos.map((t, i) => {
      const op = ops[Math.floor(r() * ops.length)];
      const prazo = U.addDays(U.today(), int(-6, 14));
      const concluida = prazo < U.today() && r() < 0.45;
      return {
        id: 'trf_' + (i + 1),
        titulo: t,
        responsavelId: consultores[i % consultores.length].id,
        clienteId: op.clienteId,
        produtoId: op.produtoId,
        oportunidadeId: op.id,
        prazo: prazo,
        prioridadeId: r() < 0.3 ? 'pr_alta' : (r() < 0.7 ? 'pr_media' : 'pr_baixa'),
        statusId: concluida ? 'st_concluido' : (r() < 0.4 ? 'st_andamento' : 'st_afazer'),
        observacoes: ''
      };
    });

    base.meta.seed = true;
    return base;
  }

  /* helpers usados durante o seed (antes de `db` existir) */
  function L2(cfg, key, id) { return (cfg[key] || []).find(x => x.id === id) || (cfg[key] || [])[0] || {}; }
  function calcVendaWith(base, v) {
    const prod = (base.produtos || []).find(p => p.id === v.produtoId);
    const bruto = U.round2(v.valorBruto);
    const desconto = U.round2(v.desconto || 0);
    const pct = Number(v.comissaoPct !== undefined ? v.comissaoPct : (prod ? prod.comissaoPct : 0)) || 0;
    const comissao = U.round2(Math.max(0, bruto - desconto) * pct / 100);
    const custo = U.round2(v.custo !== undefined ? v.custo : (prod ? prod.custo : 0));
    const liquido = U.round2(bruto - desconto - custo - comissao);
    return Object.assign({}, v, {
      valorBruto: bruto, desconto: desconto, comissaoPct: pct,
      comissao: comissao, custo: custo, valorLiquido: liquido,
      margemPct: bruto > 0 ? U.round2((liquido / bruto) * 100) : 0
    });
  }

  /* ---------------- API pública ---------------- */
  const Store = {
    PERFIS: PERFIS,
    COLLECTIONS: COLLECTIONS,
    get db() { return db; },
    get config() { return db.config; },
    load, save, reset,
    hidratarDaNuvem, aplicarMudancaRemota, aplicarConfigRemota, modo: modoAtual,
    list, get, upsert, remove,
    configList, configUpsert, configRemove, setConfig,
    L: L, lookup: L,
    etapasFunil, calcVenda, salvarVenda, moverEtapa, mrr, mesesRecorrencia,
    currentUser, setUser, perfil, podeVer, podeEditar, podeConfigurar, scope,
    exportJSON, importJSON,
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); return () => Store.off(evt, fn); },
    off(evt, fn) { listeners[evt] = (listeners[evt] || []).filter(f => f !== fn); },
    emit
  };

  global.Store = Store;
})(window);
