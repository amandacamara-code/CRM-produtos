/* =========================================================
   forms.js — formulários de cadastro/edição e telas de detalhe
   ========================================================= */
(function (global) {
  'use strict';

  const S = () => global.Store;
  const cfg = () => S().config;

  function bloqueado() {
    if (!S().podeEditar()) {
      UI.toast('Seu perfil é somente leitura e não pode alterar registros.', 'err');
      return true;
    }
    return false;
  }

  function usuariosAtivos() { return S().list('usuarios').filter(u => u.ativo !== false); }
  function produtosVendaveis() {
    return S().list('produtos').filter(p => !(S().L.statusProduto(p.statusId) || {}).arquivado);
  }

  /* =========================================================
     PRODUTO
     ========================================================= */
  function produto(id) {
    if (bloqueado()) return;
    const p = id ? S().get('produtos', id) : null;
    const novo = !p;
    const d = p || {
      nome: '', sku: '', categoriaId: (cfg().categorias[0] || {}).id, tipoId: (cfg().tiposProduto[0] || {}).id,
      descricao: '', preco: '', custo: '', comissaoPct: 10,
      tipoCobrancaId: (cfg().tiposCobranca[0] || {}).id,
      periodicidadeId: (cfg().periodicidades[0] || {}).id,
      statusId: (cfg().statusProduto[0] || {}).id,
      dataCriacao: U.today(), link: '', responsavelId: (S().currentUser() || {}).id, observacoes: ''
    };

    const form = U.el(`<form class="vstack" novalidate>
      <div class="subhead">Identificação</div>
      <div class="formgrid">
        ${UI.campo({ label: 'Nome do produto', name: 'nome', valor: d.nome, obrigatorio: true, placeholder: 'Ex.: CRM Vendas Pro' })}
        ${UI.campo({ label: 'Código / SKU', name: 'sku', valor: d.sku, obrigatorio: true, placeholder: 'Ex.: CRM-PRO' })}
        ${UI.campo({ label: 'Categoria', name: 'categoriaId', tipo: 'select', opcoes: UI.opcoes(cfg().categorias, d.categoriaId) })}
        ${UI.campo({ label: 'Tipo de produto', name: 'tipoId', tipo: 'select', opcoes: UI.opcoes(cfg().tiposProduto, d.tipoId) })}
        ${UI.campo({ label: 'Descrição', name: 'descricao', tipo: 'textarea', valor: d.descricao, full: true, placeholder: 'O que este produto entrega ao cliente?' })}
      </div>

      <div class="subhead">Precificação</div>
      <div class="formgrid">
        ${UI.campo({ label: 'Preço de venda (R$)', name: 'preco', tipo: 'number', valor: d.preco, obrigatorio: true, attrs: 'step="0.01" min="0" inputmode="decimal"' })}
        ${UI.campo({ label: 'Custo (R$)', name: 'custo', tipo: 'number', valor: d.custo, attrs: 'step="0.01" min="0" inputmode="decimal"' })}
        ${UI.campo({ label: 'Comissão (%)', name: 'comissaoPct', tipo: 'number', valor: d.comissaoPct, attrs: 'step="0.1" min="0" max="100" inputmode="decimal"' })}
        <div class="field">
          <label>Margem calculada</label>
          <input class="input" id="margemCalc" value="—" readonly tabindex="-1" style="background:var(--surface-2);font-weight:700">
          <span class="field__hint">(preço − custo) ÷ preço</span>
        </div>
        ${UI.campo({ label: 'Tipo de cobrança', name: 'tipoCobrancaId', tipo: 'select', opcoes: UI.opcoes(cfg().tiposCobranca, d.tipoCobrancaId) })}
        ${UI.campo({ label: 'Periodicidade', name: 'periodicidadeId', tipo: 'select', opcoes: UI.opcoes(cfg().periodicidades, d.periodicidadeId), hint: 'Define a receita mensal equivalente na carteira.' })}
      </div>

      <div class="subhead">Publicação e responsabilidade</div>
      <div class="formgrid">
        ${UI.campo({ label: 'Status', name: 'statusId', tipo: 'select', opcoes: UI.opcoes(cfg().statusProduto, d.statusId) })}
        ${UI.campo({ label: 'Responsável', name: 'responsavelId', tipo: 'select', opcoes: UI.opcoes(usuariosAtivos(), d.responsavelId) })}
        ${UI.campo({ label: 'Data de criação', name: 'dataCriacao', tipo: 'date', valor: d.dataCriacao })}
        ${UI.campo({
          label: '🔗 Link de cadastro / venda', name: 'link', valor: d.link, full: true,
          placeholder: cfg().baseLinks + 'meu-produto',
          hint: 'Formulário público do produto. Pode ser copiado, aberto e transformado em QR Code.'
        })}
        ${UI.campo({ label: 'Observações', name: 'observacoes', tipo: 'textarea', valor: d.observacoes, full: true })}
      </div>
    </form>`);

    const m = UI.modal({
      titulo: novo ? '📦 Novo Produto' : '✏️ Editar Produto',
      subtitulo: novo ? 'Cadastre um produto sem precisar alterar o código do sistema.' : U.esc(d.nome),
      corpo: form,
      rodape: `<button class="btn btn--soft" data-close>Cancelar</button>
               <button class="btn btn--gold" data-salvar>💾 Salvar produto</button>`
    });

    function atualizarMargem() {
      const preco = U.parseMoney(form.elements.preco.value);
      const custo = U.parseMoney(form.elements.custo.value);
      form.querySelector('#margemCalc').value = preco > 0
        ? U.pct(((preco - custo) / preco) * 100) + '  ·  lucro ' + U.money(preco - custo)
        : '—';
    }
    form.elements.preco.addEventListener('input', atualizarMargem);
    form.elements.custo.addEventListener('input', atualizarMargem);

    // SKU e link são sugeridos a partir do nome, mas param de ser
    // reescritos assim que o usuário digita algo neles.
    let skuManual = !!d.sku, linkManual = !!d.link;
    form.elements.sku.addEventListener('input', () => { skuManual = true; });
    form.elements.link.addEventListener('input', () => { linkManual = true; });
    form.elements.nome.addEventListener('input', () => {
      const nome = form.elements.nome.value.trim();
      if (!nome) return;
      if (!linkManual) form.elements.link.value = cfg().baseLinks + U.slug(nome);
      if (!skuManual) {
        form.elements.sku.value = U.slug(nome).split('-').filter(Boolean).slice(0, 2)
          .map(w => w.slice(0, 3).toUpperCase()).join('-');
      }
    });
    atualizarMargem();

    m.foot.querySelector('[data-salvar]').onclick = () => {
      if (!UI.validar(form, [
        { campo: 'nome', teste: v => v.trim().length >= 2, msg: 'Informe o nome do produto.' },
        { campo: 'sku', teste: v => v.trim().length >= 2, msg: 'Informe o código/SKU.' },
        { campo: 'preco', teste: v => U.parseMoney(v) > 0, msg: 'Informe um preço maior que zero.' }
      ])) return;

      const dados = UI.lerForm(form);
      dados.preco = U.parseMoney(dados.preco);
      dados.custo = U.parseMoney(dados.custo);
      dados.comissaoPct = Number(dados.comissaoPct) || 0;
      if (p) dados.id = p.id;
      const saved = S().upsert('produtos', dados);
      m.close();
      UI.toast(novo ? 'Produto cadastrado com sucesso!' : 'Produto atualizado.', 'ok');
      if (global.App) App.render();
      return saved;
    };
  }

  /* =========================================================
     CADASTRO (cliente + oportunidade no funil)
     ========================================================= */
  function cadastro(id, preset) {
    if (bloqueado()) return;
    const op = id ? S().get('oportunidades', id) : null;
    const cli = op ? S().L.cliente(op.clienteId) : null;
    const novo = !op;
    const etapas = S().etapasFunil();
    const d = {
      nome: cli ? cli.nome : '', documento: cli ? cli.documento : '', email: cli ? cli.email : '',
      telefone: cli ? cli.telefone : '', empresa: cli ? cli.empresa : '',
      produtoId: op ? op.produtoId : ((preset && preset.produtoId) || (produtosVendaveis()[0] || {}).id),
      origem: cli ? cli.origem : (cfg().origens[0] || ''),
      responsavelId: op ? op.responsavelId : (S().currentUser() || {}).id,
      data: op ? op.data : U.today(),
      valor: op ? op.valor : '',
      etapaId: op ? op.etapaId : ((preset && preset.etapaId) || etapas[0].id),
      prioridadeId: op ? op.prioridadeId : (cfg().prioridades[1] || cfg().prioridades[0]).id,
      previsaoFechamento: op ? op.previsaoFechamento : U.addDays(U.today(), 30),
      observacoes: op ? op.observacoes : ''
    };

    const form = U.el(`<form class="vstack" novalidate>
      <div class="subhead">Dados do cliente</div>
      <div class="formgrid">
        ${UI.campo({ label: 'Nome completo', name: 'nome', valor: d.nome, obrigatorio: true, placeholder: 'Ex.: João da Silva' })}
        ${UI.campo({ label: 'CPF / CNPJ', name: 'documento', valor: d.documento, placeholder: '000.000.000-00' })}
        ${UI.campo({ label: 'E-mail', name: 'email', tipo: 'email', valor: d.email, placeholder: 'nome@empresa.com.br' })}
        ${UI.campo({ label: 'Telefone', name: 'telefone', tipo: 'tel', valor: d.telefone, placeholder: '(11) 99999-0000' })}
        ${UI.campo({ label: 'Empresa', name: 'empresa', valor: d.empresa, placeholder: 'Razão social ou nome fantasia' })}
        ${UI.campo({ label: 'Origem', name: 'origem', tipo: 'select', opcoes: UI.opcoes(cfg().origens, d.origem, { vazio: 'Não informada' }) })}
      </div>

      <div class="subhead">Oportunidade</div>
      <div class="formgrid">
        ${UI.campo({ label: 'Produto de interesse', name: 'produtoId', tipo: 'select', obrigatorio: true, opcoes: UI.opcoes(produtosVendaveis(), d.produtoId, { vazio: 'Selecione…' }) })}
        ${UI.campo({ label: 'Valor potencial (R$)', name: 'valor', tipo: 'number', valor: d.valor, obrigatorio: true, attrs: 'step="0.01" min="0" inputmode="decimal"', hint: 'Preenchido automaticamente pelo preço do produto.' })}
        ${UI.campo({ label: 'Consultor / responsável', name: 'responsavelId', tipo: 'select', opcoes: UI.opcoes(usuariosAtivos(), d.responsavelId) })}
        ${UI.campo({ label: 'Data do cadastro', name: 'data', tipo: 'date', valor: d.data })}
        ${UI.campo({ label: 'Status', name: 'etapaId', tipo: 'select', opcoes: UI.opcoes(etapas, d.etapaId), hint: 'Ao marcar PAGO ou FECHADO a venda é registrada automaticamente.' })}
        ${UI.campo({ label: 'Prioridade', name: 'prioridadeId', tipo: 'select', opcoes: UI.opcoes(cfg().prioridades, d.prioridadeId) })}
        ${UI.campo({ label: 'Previsão de fechamento', name: 'previsaoFechamento', tipo: 'date', valor: d.previsaoFechamento })}
        ${UI.campo({ label: 'Observações', name: 'observacoes', tipo: 'textarea', valor: d.observacoes, full: true })}
      </div>
    </form>`);

    const m = UI.modal({
      titulo: novo ? '👤 Novo Cadastro' : '✏️ Editar Cadastro',
      subtitulo: novo ? 'O registro entra no funil e alimenta os indicadores automaticamente.' : U.esc(d.nome),
      corpo: form,
      rodape: `<button class="btn btn--soft" data-close>Cancelar</button>
               <button class="btn btn--gold" data-salvar>💾 Salvar cadastro</button>`
    });

    // sugere o valor a partir do preço do produto
    form.elements.produtoId.addEventListener('change', () => {
      const prod = S().L.produto(form.elements.produtoId.value);
      if (prod && !form.elements.valor.value) form.elements.valor.value = prod.preco;
    });
    if (novo && !d.valor) {
      const prod = S().L.produto(d.produtoId);
      if (prod) form.elements.valor.value = prod.preco;
    }

    m.foot.querySelector('[data-salvar]').onclick = () => {
      if (!UI.validar(form, [
        { campo: 'nome', teste: v => v.trim().length >= 3, msg: 'Informe o nome completo.' },
        { campo: 'produtoId', teste: v => !!v, msg: 'Selecione o produto de interesse.' },
        { campo: 'valor', teste: v => U.parseMoney(v) > 0, msg: 'Informe o valor potencial.' },
        { campo: 'email', teste: v => !v || U.isEmail(v), msg: 'E-mail inválido.' }
      ])) return;

      const f = UI.lerForm(form);

      // 1) cliente
      const dadosCliente = {
        nome: f.nome.trim(), documento: f.documento, email: f.email,
        telefone: f.telefone, empresa: f.empresa, origem: f.origem,
        responsavelId: f.responsavelId,
        dataCadastro: cli ? cli.dataCadastro : f.data,
        statusId: cli ? cli.statusId : (cfg().statusCliente.find(s => !s.ativo) || cfg().statusCliente[0]).id
      };
      if (cli) dadosCliente.id = cli.id;
      const clienteSalvo = S().upsert('clientes', dadosCliente, { silent: true });

      // 2) oportunidade
      const prod = S().L.produto(f.produtoId);
      const dadosOp = {
        id: op ? op.id : undefined,
        clienteId: clienteSalvo.id,
        produtoId: f.produtoId,
        responsavelId: f.responsavelId,
        quantidade: op ? (op.quantidade || 1) : 1,
        valor: U.parseMoney(f.valor),
        prioridadeId: f.prioridadeId,
        origem: f.origem,
        data: f.data,
        previsaoFechamento: f.previsaoFechamento,
        periodicidadeId: (op && op.periodicidadeId) || (prod && prod.periodicidadeId) || '',
        observacoes: f.observacoes,
        vendaId: op ? op.vendaId : '',
        historico: op ? op.historico : [],
        etapaId: op ? op.etapaId : f.etapaId
      };
      const salva = S().upsert('oportunidades', dadosOp, { silent: true });

      // 3) etapa (dispara as regras automáticas)
      const res = S().moverEtapa(salva.id, f.etapaId);
      m.close();
      UI.toast(novo ? 'Cadastro criado com sucesso!' : 'Cadastro atualizado.', 'ok');
      if (res && res.mensagens.length) setTimeout(() => UI.toast(res.mensagens[0], 'info', 4200), 700);
      if (global.App) App.render();
    };
  }

  /* =========================================================
     VENDA
     ========================================================= */
  function venda(id, preset) {
    if (bloqueado()) return;
    const v = id ? S().get('vendas', id) : null;
    const novo = !v;
    const p = preset || {};
    const d = v || {
      clienteId: p.clienteId || (S().list('clientes')[0] || {}).id,
      produtoId: p.produtoId || (produtosVendaveis()[0] || {}).id,
      responsavelId: (S().currentUser() || {}).id,
      quantidade: 1, valorBruto: '', desconto: 0, comissaoPct: '', custo: '',
      formaPagamentoId: (cfg().formasPagamento[0] || {}).id,
      periodicidadeId: '',
      statusId: (cfg().statusVenda[0] || {}).id,
      dataVenda: U.today(), dataPagamento: '', emCarteira: true, observacoes: ''
    };

    const form = U.el(`<form class="vstack" novalidate>
      <div class="subhead">Venda</div>
      <div class="formgrid">
        ${UI.campo({ label: 'Cliente', name: 'clienteId', tipo: 'select', obrigatorio: true, opcoes: UI.opcoes(U.sortBy(S().list('clientes'), c => c.nome, 'asc'), d.clienteId, { vazio: 'Selecione…' }) })}
        ${UI.campo({ label: 'Produto', name: 'produtoId', tipo: 'select', obrigatorio: true, opcoes: UI.opcoes(produtosVendaveis(), d.produtoId, { vazio: 'Selecione…' }) })}
        ${UI.campo({ label: 'Responsável', name: 'responsavelId', tipo: 'select', opcoes: UI.opcoes(usuariosAtivos(), d.responsavelId) })}
        ${UI.campo({ label: 'Quantidade', name: 'quantidade', tipo: 'number', valor: d.quantidade, attrs: 'step="1" min="1"' })}
      </div>

      <div class="subhead">Valores</div>
      <div class="formgrid">
        ${UI.campo({ label: 'Valor bruto (R$)', name: 'valorBruto', tipo: 'number', valor: d.valorBruto, obrigatorio: true, attrs: 'step="0.01" min="0" inputmode="decimal"' })}
        ${UI.campo({ label: 'Desconto (R$)', name: 'desconto', tipo: 'number', valor: d.desconto, attrs: 'step="0.01" min="0" inputmode="decimal"' })}
        ${UI.campo({ label: 'Comissão (%)', name: 'comissaoPct', tipo: 'number', valor: d.comissaoPct, attrs: 'step="0.1" min="0" max="100" inputmode="decimal"', placeholder: 'padrão do produto' })}
        ${UI.campo({ label: 'Custo (R$)', name: 'custo', tipo: 'number', valor: d.custo, attrs: 'step="0.01" min="0" inputmode="decimal"', placeholder: 'padrão do produto' })}
      </div>

      <div class="card" style="background:var(--surface-2);margin-top:4px">
        <div class="spread"><span class="small muted">Faturamento bruto</span><b id="rBruto">—</b></div>
        <div class="spread mt-sm"><span class="small muted">− Desconto</span><b id="rDesc" class="neg">—</b></div>
        <div class="spread mt-sm"><span class="small muted">− Custo</span><b id="rCusto" class="neg">—</b></div>
        <div class="spread mt-sm"><span class="small muted">− Comissão</span><b id="rCom" class="neg">—</b></div>
        <div class="divider" style="margin:10px 0"></div>
        <div class="spread"><span class="small strong">= Faturamento líquido</span><b id="rLiq" class="pos" style="font-size:16px">—</b></div>
        <div class="spread mt-sm"><span class="small muted">Margem</span><b id="rMargem">—</b></div>
      </div>

      <div class="subhead">Condições e status</div>
      <div class="formgrid">
        ${UI.campo({ label: 'Forma de pagamento', name: 'formaPagamentoId', tipo: 'select', opcoes: UI.opcoes(cfg().formasPagamento, d.formaPagamentoId, { vazio: 'Não informada' }) })}
        ${UI.campo({ label: 'Periodicidade', name: 'periodicidadeId', tipo: 'select', opcoes: UI.opcoes(cfg().periodicidades, d.periodicidadeId, { vazio: 'Herdar do produto' }), hint: 'Usada para calcular a receita recorrente.' })}
        ${UI.campo({ label: 'Status', name: 'statusId', tipo: 'select', opcoes: UI.opcoes(cfg().statusVenda, d.statusId), hint: 'PAGA conta como receita recebida; CANCELADA sai dos indicadores.' })}
        ${UI.campo({ label: 'Data da venda', name: 'dataVenda', tipo: 'date', valor: d.dataVenda, obrigatorio: true })}
        ${UI.campo({ label: 'Data do pagamento', name: 'dataPagamento', tipo: 'date', valor: d.dataPagamento })}
        <div class="field">
          <label>Carteira</label>
          <label class="switch"><input type="checkbox" name="emCarteira" ${d.emCarteira !== false ? 'checked' : ''}>
            <span class="small">Contrato ativo na carteira</span></label>
        </div>
        ${UI.campo({ label: 'Observações', name: 'observacoes', tipo: 'textarea', valor: d.observacoes, full: true })}
      </div>
    </form>`);

    const m = UI.modal({
      titulo: novo ? '💰 Nova Venda' : '✏️ Editar Venda',
      subtitulo: 'Os totais de faturamento, carteira e comissões são recalculados na hora.',
      corpo: form,
      rodape: `<button class="btn btn--soft" data-close>Cancelar</button>
               <button class="btn btn--gold" data-salvar>💾 Registrar venda</button>`
    });

    function recalcular() {
      const f = UI.lerForm(form);
      const calc = S().calcVenda({
        produtoId: f.produtoId, quantidade: Number(f.quantidade) || 1,
        valorBruto: f.valorBruto, desconto: f.desconto,
        comissaoPct: f.comissaoPct === '' ? undefined : f.comissaoPct,
        custo: f.custo === '' ? undefined : f.custo
      });
      form.querySelector('#rBruto').textContent = U.money(calc.valorBruto);
      form.querySelector('#rDesc').textContent = U.money(calc.desconto);
      form.querySelector('#rCusto').textContent = U.money(calc.custo);
      form.querySelector('#rCom').textContent = U.money(calc.comissao) + ' (' + U.pct(calc.comissaoPct) + ')';
      form.querySelector('#rLiq').textContent = U.money(calc.valorLiquido);
      const mg = form.querySelector('#rMargem');
      mg.textContent = U.pct(calc.margemPct);
      mg.className = calc.margemPct >= 0 ? 'pos' : 'neg';
    }
    form.addEventListener('input', recalcular);
    form.addEventListener('change', recalcular);
    form.elements.produtoId.addEventListener('change', () => {
      const prod = S().L.produto(form.elements.produtoId.value);
      if (prod) {
        const q = Number(form.elements.quantidade.value) || 1;
        form.elements.valorBruto.value = U.round2(prod.preco * q);
        recalcular();
      }
    });
    if (novo && !d.valorBruto) {
      const prod = S().L.produto(d.produtoId);
      if (prod) form.elements.valorBruto.value = prod.preco;
    }
    recalcular();

    m.foot.querySelector('[data-salvar]').onclick = () => {
      if (!UI.validar(form, [
        { campo: 'clienteId', teste: v => !!v, msg: 'Selecione o cliente.' },
        { campo: 'produtoId', teste: v => !!v, msg: 'Selecione o produto.' },
        { campo: 'valorBruto', teste: v => U.parseMoney(v) > 0, msg: 'Informe o valor bruto.' },
        { campo: 'dataVenda', teste: v => !!v, msg: 'Informe a data da venda.' }
      ])) return;

      const f = UI.lerForm(form);
      f.quantidade = Number(f.quantidade) || 1;
      if (f.comissaoPct === '') delete f.comissaoPct;
      if (f.custo === '') delete f.custo;
      if (v) f.id = v.id;
      else f.oportunidadeId = '';
      S().salvarVenda(f);

      // cliente com venda ativa entra na carteira
      const st = S().L.statusVenda(f.statusId);
      if (st && st.ativa) {
        const cliente = S().L.cliente(f.clienteId);
        const stAtivo = cfg().statusCliente.find(s => s.ativo);
        if (cliente && stAtivo && cliente.statusId !== stAtivo.id) {
          S().upsert('clientes', { id: cliente.id, statusId: stAtivo.id }, { silent: true });
        }
      }
      m.close();
      UI.toast(novo ? 'Venda registrada — indicadores atualizados!' : 'Venda atualizada.', 'ok');
      if (global.App) App.render();
    };
  }

  /* =========================================================
     CLIENTE
     ========================================================= */
  function cliente(id) {
    if (bloqueado()) return;
    const c = id ? S().get('clientes', id) : null;
    const novo = !c;
    const d = c || {
      nome: '', documento: '', email: '', telefone: '', empresa: '',
      origem: cfg().origens[0] || '', responsavelId: (S().currentUser() || {}).id,
      statusId: (cfg().statusCliente[0] || {}).id, dataCadastro: U.today(), observacoes: ''
    };

    const form = U.el(`<form class="formgrid" novalidate>
      ${UI.campo({ label: 'Nome completo', name: 'nome', valor: d.nome, obrigatorio: true })}
      ${UI.campo({ label: 'CPF / CNPJ', name: 'documento', valor: d.documento })}
      ${UI.campo({ label: 'E-mail', name: 'email', tipo: 'email', valor: d.email })}
      ${UI.campo({ label: 'Telefone', name: 'telefone', tipo: 'tel', valor: d.telefone })}
      ${UI.campo({ label: 'Empresa', name: 'empresa', valor: d.empresa })}
      ${UI.campo({ label: 'Origem', name: 'origem', tipo: 'select', opcoes: UI.opcoes(cfg().origens, d.origem, { vazio: 'Não informada' }) })}
      ${UI.campo({ label: 'Responsável', name: 'responsavelId', tipo: 'select', opcoes: UI.opcoes(usuariosAtivos(), d.responsavelId) })}
      ${UI.campo({ label: 'Status', name: 'statusId', tipo: 'select', opcoes: UI.opcoes(cfg().statusCliente, d.statusId) })}
      ${UI.campo({ label: 'Data do cadastro', name: 'dataCadastro', tipo: 'date', valor: d.dataCadastro })}
      ${UI.campo({ label: 'Observações', name: 'observacoes', tipo: 'textarea', valor: d.observacoes, full: true })}
    </form>`);

    const m = UI.modal({
      titulo: novo ? '👥 Novo Cliente' : '✏️ Editar Cliente',
      corpo: form,
      rodape: `<button class="btn btn--soft" data-close>Cancelar</button>
               <button class="btn btn--gold" data-salvar>💾 Salvar</button>`
    });

    m.foot.querySelector('[data-salvar]').onclick = () => {
      if (!UI.validar(form, [
        { campo: 'nome', teste: v => v.trim().length >= 3, msg: 'Informe o nome do cliente.' },
        { campo: 'email', teste: v => !v || U.isEmail(v), msg: 'E-mail inválido.' }
      ])) return;
      const f = UI.lerForm(form);
      if (c) f.id = c.id;
      S().upsert('clientes', f);
      m.close();
      UI.toast(novo ? 'Cliente cadastrado!' : 'Cliente atualizado.', 'ok');
      if (global.App) App.render();
    };
  }

  /* =========================================================
     TAREFA
     ========================================================= */
  function tarefa(id, preset) {
    if (bloqueado()) return;
    const t = id ? S().get('tarefas', id) : null;
    const novo = !t;
    const p = preset || {};
    const d = t || {
      titulo: '', responsavelId: (S().currentUser() || {}).id,
      clienteId: p.clienteId || '', produtoId: p.produtoId || '',
      prazo: U.today(), prioridadeId: (cfg().prioridades[1] || cfg().prioridades[0]).id,
      statusId: (cfg().statusTarefa[0] || {}).id, observacoes: ''
    };

    const form = U.el(`<form class="formgrid" novalidate>
      ${UI.campo({ label: 'Título', name: 'titulo', valor: d.titulo, obrigatorio: true, full: true, placeholder: 'Ex.: Enviar proposta comercial' })}
      ${UI.campo({ label: 'Responsável', name: 'responsavelId', tipo: 'select', opcoes: UI.opcoes(usuariosAtivos(), d.responsavelId) })}
      ${UI.campo({ label: 'Cliente', name: 'clienteId', tipo: 'select', opcoes: UI.opcoes(U.sortBy(S().list('clientes'), c => c.nome, 'asc'), d.clienteId, { vazio: 'Nenhum' }) })}
      ${UI.campo({ label: 'Produto', name: 'produtoId', tipo: 'select', opcoes: UI.opcoes(S().list('produtos'), d.produtoId, { vazio: 'Nenhum' }) })}
      ${UI.campo({ label: 'Prazo', name: 'prazo', tipo: 'date', valor: d.prazo })}
      ${UI.campo({ label: 'Prioridade', name: 'prioridadeId', tipo: 'select', opcoes: UI.opcoes(cfg().prioridades, d.prioridadeId) })}
      ${UI.campo({ label: 'Status', name: 'statusId', tipo: 'select', opcoes: UI.opcoes(cfg().statusTarefa, d.statusId) })}
      ${UI.campo({ label: 'Observações', name: 'observacoes', tipo: 'textarea', valor: d.observacoes, full: true })}
    </form>`);

    const m = UI.modal({
      titulo: novo ? '✅ Nova Tarefa' : '✏️ Editar Tarefa',
      corpo: form,
      rodape: `<button class="btn btn--soft" data-close>Cancelar</button>
               <button class="btn btn--gold" data-salvar>💾 Salvar</button>`
    });

    m.foot.querySelector('[data-salvar]').onclick = () => {
      if (!UI.validar(form, [{ campo: 'titulo', teste: v => v.trim().length >= 3, msg: 'Informe o título da tarefa.' }])) return;
      const f = UI.lerForm(form);
      if (t) f.id = t.id;
      S().upsert('tarefas', f);
      m.close();
      UI.toast(novo ? 'Tarefa criada!' : 'Tarefa atualizada.', 'ok');
      if (global.App) App.render();
    };
  }

  /* =========================================================
     USUÁRIO
     ========================================================= */
  function usuario(id) {
    if (!S().podeConfigurar('usuarios')) { UI.toast('Apenas administradores podem gerenciar usuários.', 'err'); return; }
    const u = id ? S().get('usuarios', id) : null;
    const novo = !u;
    const d = u || { nome: '', email: '', perfil: 'consultor', cargo: '', ativo: true };
    const perfisOpts = Object.keys(S().PERFIS).map(k =>
      `<option value="${k}" ${k === d.perfil ? 'selected' : ''}>${U.esc(S().PERFIS[k].nome)}</option>`).join('');

    const form = U.el(`<form class="formgrid" novalidate>
      ${UI.campo({ label: 'Nome', name: 'nome', valor: d.nome, obrigatorio: true })}
      ${UI.campo({ label: 'E-mail', name: 'email', tipo: 'email', valor: d.email, obrigatorio: true })}
      ${UI.campo({ label: 'Cargo', name: 'cargo', valor: d.cargo })}
      <div class="field">
        <label for="perfil">Perfil de acesso <span class="req">*</span></label>
        <select class="input" name="perfil" id="perfil">${perfisOpts}</select>
        <span class="field__hint" id="perfilDesc"></span>
      </div>
      <div class="field">
        <label>Situação</label>
        <label class="switch"><input type="checkbox" name="ativo" ${d.ativo !== false ? 'checked' : ''}><span class="small">Usuário ativo</span></label>
      </div>
    </form>`);

    const m = UI.modal({
      titulo: novo ? '👤 Novo Usuário' : '✏️ Editar Usuário',
      corpo: form,
      rodape: `<button class="btn btn--soft" data-close>Cancelar</button>
               <button class="btn btn--gold" data-salvar>💾 Salvar</button>`
    });

    const desc = form.querySelector('#perfilDesc');
    const atualizarDesc = () => { desc.textContent = (S().PERFIS[form.elements.perfil.value] || {}).desc || ''; };
    form.elements.perfil.addEventListener('change', atualizarDesc);
    atualizarDesc();

    m.foot.querySelector('[data-salvar]').onclick = () => {
      if (!UI.validar(form, [
        { campo: 'nome', teste: v => v.trim().length >= 3, msg: 'Informe o nome.' },
        { campo: 'email', teste: v => U.isEmail(v), msg: 'Informe um e-mail válido.' }
      ])) return;
      const f = UI.lerForm(form);
      if (u) f.id = u.id;
      S().upsert('usuarios', f);
      m.close();
      UI.toast(novo ? 'Usuário criado!' : 'Usuário atualizado.', 'ok');
      if (global.App) App.render();
    };
  }

  /* =========================================================
     DETALHE DO PRODUTO
     ========================================================= */
  function detalheProduto(id) {
    const p = S().get('produtos', id);
    if (!p) return;
    const st = S().L.statusProduto(p.statusId);
    const cat = S().L.categoria(p.categoriaId);
    const desemp = M.desempenhoProdutos(U.range('12m')).find(d => d.produto.id === p.id) || {};
    const margemUnit = p.preco > 0 ? ((p.preco - (p.custo || 0)) / p.preco) * 100 : 0;
    const per = S().L.periodicidade(p.periodicidadeId);
    const cob = S().L.tipoCobranca(p.tipoCobrancaId);

    const corpo = `
      <div class="hstack mb">${UI.badge(st)} ${cat ? `<span class="badge badge--outline">${U.esc(cat.nome)}</span>` : ''}
        <span class="badge badge--outline mono">${U.esc(p.sku)}</span></div>
      ${p.descricao ? `<p class="small muted mb">${U.esc(p.descricao)}</p>` : ''}

      <div class="subhead">🔗 Link de cadastro</div>
      ${UI.linkBox(p.link, { editavel: S().podeEditar() })}
      ${p.link ? `<button class="btn btn--blue btn--block mt" data-link-open="${U.esc(p.link)}">🔗 Abrir Cadastro</button>` : ''}

      <div class="subhead">Precificação</div>
      <dl class="deflist">
        <div><dt>Preço</dt><dd>${U.money(p.preco)}</dd></div>
        <div><dt>Custo</dt><dd>${U.money(p.custo)}</dd></div>
        <div><dt>Margem unitária</dt><dd class="${margemUnit >= 0 ? 'pos' : 'neg'}">${U.pct(margemUnit)}</dd></div>
        <div><dt>Comissão</dt><dd>${U.pct(p.comissaoPct)}</dd></div>
        <div><dt>Cobrança</dt><dd>${U.esc(cob ? cob.nome : '—')}</dd></div>
        <div><dt>Periodicidade</dt><dd>${U.esc(per ? per.nome : '—')}</dd></div>
      </dl>

      <div class="subhead">Desempenho (últimos 12 meses)</div>
      <dl class="deflist">
        <div><dt>Vendas</dt><dd>${U.num(desemp.vendasQtd || 0)}</dd></div>
        <div><dt>Faturamento</dt><dd>${U.money(desemp.faturamento || 0)}</dd></div>
        <div><dt>Clientes</dt><dd>${U.num(desemp.clientes || 0)}</dd></div>
        <div><dt>Ticket médio</dt><dd>${U.money(desemp.ticketMedio || 0)}</dd></div>
        <div><dt>Margem realizada</dt><dd>${U.pct(desemp.margemPct || 0)}</dd></div>
        <div><dt>Em carteira</dt><dd>${U.money(desemp.carteira || 0)}</dd></div>
        <div><dt>Pipeline</dt><dd>${U.money(desemp.pipelineValor || 0)} · ${desemp.pipelineQtd || 0} oport.</dd></div>
        <div><dt>Participação</dt><dd>${U.pct(desemp.participacaoPct || 0)}</dd></div>
      </dl>

      <div class="subhead">Cadastro</div>
      <dl class="deflist">
        <div><dt>Responsável</dt><dd>${U.esc(S().L.nomeUsuario(p.responsavelId))}</dd></div>
        <div><dt>Criado em</dt><dd>${U.fmtDate(p.dataCriacao)}</dd></div>
      </dl>
      ${p.observacoes ? `<p class="small muted mt">📝 ${U.esc(p.observacoes)}</p>` : ''}
    `;

    const pode = S().podeEditar();
    const m = UI.modal({
      titulo: '📦 ' + U.esc(p.nome),
      subtitulo: 'Ficha completa do produto',
      corpo: corpo,
      rodape: `<button class="btn btn--soft" data-close>Fechar</button>
        ${pode ? `<button class="btn btn--ghost" data-duplicar>⧉ Duplicar</button>
                  <button class="btn btn--ghost" data-venda>💰 Nova venda</button>
                  <button class="btn btn--navy" data-editar>✏️ Editar</button>` : ''}`
    });

    const qs = s => m.el.querySelector(s);
    if (pode) {
      qs('[data-editar]').onclick = () => { m.close(); produto(p.id); };
      qs('[data-venda]').onclick = () => { m.close(); venda(null, { produtoId: p.id }); };
      qs('[data-duplicar]').onclick = () => {
        const copia = Object.assign({}, p);
        delete copia.id; delete copia.criadoEm;
        copia.nome = p.nome + ' (cópia)';
        copia.sku = p.sku + '-2';
        copia.dataCriacao = U.today();
        S().upsert('produtos', copia);
        m.close();
        UI.toast('Produto duplicado.', 'ok');
        if (global.App) App.render();
      };
      const btnLink = m.body.querySelector('[data-link-edit]');
      if (btnLink) btnLink.onclick = () => { m.close(); editarLink(p.id); };
    }
  }

  /** edição rápida só do link do produto */
  function editarLink(id) {
    if (bloqueado()) return;
    const p = S().get('produtos', id);
    if (!p) return;
    const form = U.el(`<form class="vstack" novalidate>
      ${UI.campo({ label: 'Link de cadastro / venda', name: 'link', valor: p.link, full: true, placeholder: cfg().baseLinks + U.slug(p.nome) })}
      <div class="notice">💡 Este é o endereço público do formulário de cadastro deste produto. Depois de salvo você pode copiar, abrir e gerar o QR Code.</div>
    </form>`);
    const m = UI.modal({
      titulo: '🔗 Link de cadastro', subtitulo: U.esc(p.nome), tamanho: 'sm', corpo: form,
      rodape: `<button class="btn btn--soft" data-close>Cancelar</button>
               <button class="btn btn--ghost" data-sugerir>✨ Gerar automático</button>
               <button class="btn btn--gold" data-salvar>💾 Salvar</button>`
    });
    m.foot.querySelector('[data-sugerir]').onclick = () => {
      form.elements.link.value = cfg().baseLinks + U.slug(p.nome);
    };
    m.foot.querySelector('[data-salvar]').onclick = () => {
      S().upsert('produtos', { id: p.id, link: form.elements.link.value.trim() });
      m.close();
      UI.toast('Link atualizado.', 'ok');
      if (global.App) App.render();
    };
  }

  /* =========================================================
     DETALHE DA OPORTUNIDADE / CADASTRO
     ========================================================= */
  function detalheOportunidade(id) {
    const op = S().get('oportunidades', id);
    if (!op) return;
    const cli = S().L.cliente(op.clienteId) || {};
    const prod = S().L.produto(op.produtoId);
    const etapa = S().L.etapa(op.etapaId);
    const prio = S().L.prioridade(op.prioridadeId);
    const etapas = S().etapasFunil();
    const pode = S().podeEditar();

    const historico = (op.historico || []).slice().reverse().slice(0, 8).map(h =>
      `<div class="listrow" style="cursor:default;padding:7px 0">
        <div class="listrow__body"><div class="listrow__sub">${U.fmtDate(h.data)} · ${U.esc(h.de)} → <b>${U.esc(h.para)}</b></div></div>
      </div>`).join('');

    const corpo = `
      <div class="hstack mb">${UI.badge(etapa)} ${UI.badge(prio, '')} ${op.origem ? `<span class="badge badge--outline">${U.esc(op.origem)}</span>` : ''}</div>
      <div class="card mb" style="background:var(--surface-2)">
        <div class="spread"><span class="small muted">Valor potencial</span>
          <b style="font-size:19px">${U.money(op.valor)}</b></div>
      </div>

      <div class="subhead">Cliente</div>
      <dl class="deflist">
        <div><dt>Nome</dt><dd>${U.esc(cli.nome || '—')}</dd></div>
        <div><dt>Empresa</dt><dd>${U.esc(cli.empresa || '—')}</dd></div>
        <div><dt>CPF/CNPJ</dt><dd>${U.esc(cli.documento || '—')}</dd></div>
        <div><dt>E-mail</dt><dd>${cli.email ? `<a href="mailto:${U.esc(cli.email)}">${U.esc(cli.email)}</a>` : '—'}</dd></div>
        <div><dt>Telefone</dt><dd>${cli.telefone ? `<a href="tel:${U.esc(String(cli.telefone).replace(/\D/g, ''))}">${U.esc(cli.telefone)}</a>` : '—'}</dd></div>
      </dl>

      <div class="subhead">Oportunidade</div>
      <dl class="deflist">
        <div><dt>Produto</dt><dd>${U.esc(prod ? prod.nome : '—')}</dd></div>
        <div><dt>Responsável</dt><dd>${U.esc(S().L.nomeUsuario(op.responsavelId))}</dd></div>
        <div><dt>Data do cadastro</dt><dd>${U.fmtDate(op.data)}</dd></div>
        <div><dt>Previsão</dt><dd>${U.fmtDate(op.previsaoFechamento)}</dd></div>
        ${op.dataFechamento ? `<div><dt>Fechamento</dt><dd>${U.fmtDate(op.dataFechamento)}</dd></div>` : ''}
      </dl>
      ${prod && prod.link ? `<div class="mt">${UI.linkBox(prod.link, {})}</div>` : ''}
      ${op.observacoes ? `<div class="subhead">Observações</div><p class="small">${U.esc(op.observacoes)}</p>` : ''}

      ${pode ? `<div class="subhead">Mover para a etapa</div>
      <div class="chips">${etapas.map(e =>
        `<button class="chip ${e.id === op.etapaId ? 'is-active' : ''}" data-etapa="${e.id}">${e.emoji} ${U.esc(e.nome)}</button>`).join('')}</div>` : ''}

      ${historico ? `<div class="subhead">Histórico</div>${historico}` : ''}
    `;

    const m = UI.modal({
      titulo: '👤 ' + U.esc(cli.nome || 'Cadastro'),
      subtitulo: prod ? U.esc(prod.nome) : '',
      corpo: corpo,
      rodape: `<button class="btn btn--soft" data-close>Fechar</button>
        ${pode ? `<button class="btn btn--ghost" data-tarefa>✅ Nova tarefa</button>
                  <button class="btn btn--navy" data-editar>✏️ Editar</button>` : ''}`
    });

    if (pode) {
      m.el.querySelector('[data-editar]').onclick = () => { m.close(); cadastro(op.id); };
      m.el.querySelector('[data-tarefa]').onclick = () => { m.close(); tarefa(null, { clienteId: op.clienteId, produtoId: op.produtoId }); };
      m.body.querySelectorAll('[data-etapa]').forEach(b => {
        b.onclick = () => {
          const res = S().moverEtapa(op.id, b.getAttribute('data-etapa'));
          m.close();
          if (res && res.mensagens.length) res.mensagens.forEach((msg, i) => setTimeout(() => UI.toast(msg, 'ok', 4000), i * 450));
          else UI.toast('Etapa atualizada.', 'ok');
          if (global.App) App.render();
        };
      });
    }
  }

  /* =========================================================
     DETALHE DO CLIENTE
     ========================================================= */
  function detalheCliente(id) {
    const c = S().get('clientes', id);
    if (!c) return;
    const vendas = S().list('vendas').filter(v => v.clienteId === id);
    const ativas = vendas.filter(v => M.isAtiva(v));
    const ops = S().list('oportunidades').filter(o => o.clienteId === id);
    const abertas = ops.filter(o => (S().L.etapa(o.etapaId) || {}).aberto);
    const st = S().L.statusCliente(c.statusId);
    const pode = S().podeEditar();

    const linhasVendas = U.sortBy(vendas, v => v.dataVenda, 'desc').slice(0, 12).map(v =>
      `<div class="listrow" style="cursor:default">
        <div class="listrow__body">
          <div class="listrow__title">${U.esc(S().L.nomeProduto(v.produtoId))}</div>
          <div class="listrow__sub">${U.fmtDate(v.dataVenda)} · ${UI.badge(S().L.statusVenda(v.statusId))}</div>
        </div>
        <div class="listrow__right"><span class="listrow__val">${U.money(v.valorBruto)}</span></div>
      </div>`).join('');

    const corpo = `
      <div class="hstack mb">${UI.badge(st)} ${c.origem ? `<span class="badge badge--outline">${U.esc(c.origem)}</span>` : ''}</div>
      <dl class="deflist">
        <div><dt>Empresa</dt><dd>${U.esc(c.empresa || '—')}</dd></div>
        <div><dt>CPF/CNPJ</dt><dd>${U.esc(c.documento || '—')}</dd></div>
        <div><dt>E-mail</dt><dd>${c.email ? `<a href="mailto:${U.esc(c.email)}">${U.esc(c.email)}</a>` : '—'}</dd></div>
        <div><dt>Telefone</dt><dd>${c.telefone ? `<a href="tel:${U.esc(String(c.telefone).replace(/\D/g, ''))}">${U.esc(c.telefone)}</a>` : '—'}</dd></div>
        <div><dt>Responsável</dt><dd>${U.esc(S().L.nomeUsuario(c.responsavelId))}</dd></div>
        <div><dt>Cliente desde</dt><dd>${U.fmtDate(c.dataCadastro)}</dd></div>
      </dl>

      <div class="subhead">Resumo financeiro</div>
      <dl class="deflist">
        <div><dt>Em carteira</dt><dd>${U.money(U.sum(ativas.filter(v => v.emCarteira !== false), v => v.valorBruto - v.desconto))}</dd></div>
        <div><dt>Total comprado</dt><dd>${U.money(U.sum(ativas, v => v.valorBruto))}</dd></div>
        <div><dt>Contratos ativos</dt><dd>${ativas.length}</dd></div>
        <div><dt>Oportunidades abertas</dt><dd>${abertas.length} · ${U.money(U.sum(abertas, o => o.valor))}</dd></div>
      </dl>

      ${linhasVendas ? `<div class="subhead">Histórico de vendas</div><div class="list">${linhasVendas}</div>` : ''}
      ${c.observacoes ? `<div class="subhead">Observações</div><p class="small">${U.esc(c.observacoes)}</p>` : ''}
    `;

    const m = UI.modal({
      titulo: '👥 ' + U.esc(c.nome),
      subtitulo: U.esc(c.empresa || ''),
      corpo: corpo,
      rodape: `<button class="btn btn--soft" data-close>Fechar</button>
        ${pode ? `<button class="btn btn--ghost" data-venda>💰 Nova venda</button>
                  <button class="btn btn--navy" data-editar>✏️ Editar</button>` : ''}`
    });
    if (pode) {
      m.el.querySelector('[data-editar]').onclick = () => { m.close(); cliente(c.id); };
      m.el.querySelector('[data-venda]').onclick = () => { m.close(); venda(null, { clienteId: c.id }); };
    }
  }

  /* =========================================================
     EXCLUSÃO
     ========================================================= */
  async function excluir(col, id, nome) {
    if (bloqueado()) return false;
    const rotulos = {
      produtos: 'produto', clientes: 'cliente', oportunidades: 'cadastro',
      vendas: 'venda', tarefas: 'tarefa', usuarios: 'usuário'
    };
    const avisos = {
      clientes: 'As oportunidades e vendas vinculadas também serão removidas.',
      oportunidades: 'A venda gerada automaticamente por este cadastro também será removida.',
      produtos: 'O produto será desvinculado das vendas e oportunidades existentes.'
    };
    const ok = await UI.confirmar({
      titulo: 'Excluir ' + (rotulos[col] || 'registro'),
      mensagem: `Tem certeza que deseja excluir <b>${U.esc(nome || '')}</b>?<br>
        ${avisos[col] ? '<span class="muted">' + avisos[col] + '</span><br>' : ''}
        <span class="muted">Esta ação não pode ser desfeita.</span>`,
      confirmar: 'Excluir', perigo: true
    });
    if (!ok) return false;
    S().remove(col, id);
    UI.toast('Registro excluído.', 'ok');
    if (global.App) App.render();
    return true;
  }

  global.Forms = {
    produto, cadastro, venda, cliente, tarefa, usuario,
    detalheProduto, detalheOportunidade, detalheCliente,
    editarLink, excluir
  };
})(window);
