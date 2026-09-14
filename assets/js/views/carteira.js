/* =========================================================
   views/carteira.js — contratos e vendas ativas
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = {
    busca: '', produto: '', cliente: '', responsavel: '', status: '',
    categoria: '', periodo: 'tudo', custom: null,
    ordem: { campo: 'valor', dir: 'desc' }
  };

  function rangeAtual() {
    if (estado.periodo === 'tudo') return null;
    return estado.periodo === 'custom' && estado.custom
      ? Object.assign({ label: 'Personalizado' }, estado.custom) : U.range(estado.periodo);
  }

  function filtros() {
    const f = {
      produtoId: estado.produto, clienteId: estado.cliente,
      responsavelId: estado.responsavel, statusId: estado.status,
      categoriaId: estado.categoria
    };
    const r = rangeAtual();
    if (r) f.range = r;
    return f;
  }

  function itensFiltrados(cart) {
    let arr = cart.itens;
    const q = U.norm(estado.busca);
    if (q) arr = arr.filter(v =>
      U.norm(Store.L.nomeCliente(v.clienteId)).indexOf(q) > -1 ||
      U.norm(Store.L.nomeProduto(v.produtoId)).indexOf(q) > -1);
    const getter = {
      cliente: v => Store.L.nomeCliente(v.clienteId),
      produto: v => Store.L.nomeProduto(v.produtoId),
      valor: v => v.valorBruto - v.desconto,
      data: v => v.dataVenda,
      status: v => (Store.L.statusVenda(v.statusId) || {}).nome,
      responsavel: v => Store.L.nomeUsuario(v.responsavelId),
      mrr: v => Store.mrr(v)
    }[estado.ordem.campo] || (v => v[estado.ordem.campo]);
    return U.sortBy(arr, getter, estado.ordem.dir);
  }

  Views.carteira = {
    titulo: '💼 Carteira',
    subtitulo: 'Tudo o que está ativo hoje — contratos, clientes e receita recorrente',

    render() {
      const cart = M.carteira(filtros());
      const itens = itensFiltrados(cart);
      const pode = Store.podeEditar();
      const visivel = {
        total: U.sum(itens, v => v.valorBruto - v.desconto),
        mrr: U.sum(itens, v => Store.mrr(v))
      };
      const top = M.topClientes(8);

      return `
      <div class="grid grid--kpi mb">
        ${UI.kpi({
          icone: '💼', titulo: 'Carteira Total', cor: 'ink', valor: U.money0(cart.total),
          linhas: [
            { label: 'Contratos ativos', valor: U.num(cart.contratos) },
            { label: 'Recorrente', valor: U.money0(cart.recorrente) },
            { label: 'Pontual', valor: U.money0(cart.pontual) }
          ]
        })}
        ${UI.kpi({
          icone: '👥', titulo: 'Clientes Ativos', cor: 'blue', valor: U.num(cart.clientesAtivos),
          linhas: [
            { label: 'Contratos por cliente', valor: (cart.clientesAtivos ? (cart.contratos / cart.clientesAtivos) : 0).toFixed(1).replace('.', ',') },
            { label: 'Contratos recorrentes', valor: U.num(cart.qtdRecorrentes) }
          ]
        })}
        ${UI.kpi({
          icone: '🔁', titulo: 'Receita Mensal', cor: 'green', valor: U.money0(cart.receitaMensal),
          sub: '<span class="muted">receita recorrente equivalente por mês</span>'
        })}
        ${UI.kpi({
          icone: '📅', titulo: 'Receita Anual Projetada', cor: 'gold', valor: U.money0(cart.receitaAnualProjetada),
          sub: '<span class="muted">receita mensal × 12 · projeção</span>'
        })}
        ${UI.kpi({
          icone: '🎫', titulo: 'Ticket Médio', cor: 'purple', valor: U.money0(cart.ticketMedio),
          linhas: [{ label: 'Por contrato', valor: U.money0(cart.ticketPorContrato) }]
        })}
      </div>

      <div class="card card--pad0 mb">
        <div class="card__head">
          <h2>Contratos e vendas ativas</h2>
          <div class="hstack">
            <button class="btn btn--sm btn--ghost" data-exportar>📥 Excel</button>
            <button class="btn btn--sm btn--ghost" data-pdf>📄 PDF</button>
            ${pode ? `<button class="btn btn--sm btn--fire" data-nova>＋ Nova Venda</button>` : ''}
          </div>
        </div>
        <div class="card__body">
          <div class="toolbar">
            <div class="searchbar"><input class="input input--sm" id="busca" placeholder="Buscar cliente ou produto…" value="${U.esc(estado.busca)}"></div>
          </div>
          <div class="filters">
            <select class="input input--sm" id="fProduto">${UI.opcoes(Store.list('produtos'), estado.produto, { vazio: 'Todos os produtos' })}</select>
            <select class="input input--sm" id="fCliente">${UI.opcoes(U.sortBy(Store.list('clientes'), c => c.nome, 'asc'), estado.cliente, { vazio: 'Todos os clientes' })}</select>
            <select class="input input--sm" id="fResp">${UI.opcoes(Store.list('usuarios'), estado.responsavel, { vazio: 'Todos responsáveis' })}</select>
            <select class="input input--sm" id="fStatus">${UI.opcoes(Store.config.statusVenda.filter(s => s.ativa), estado.status, { vazio: 'Todos os status' })}</select>
            <select class="input input--sm" id="fCat">${UI.opcoes(Store.config.categorias, estado.categoria, { vazio: 'Todas categorias' })}</select>
            <select class="input input--sm" id="fPeriodo">
              <option value="tudo" ${estado.periodo === 'tudo' ? 'selected' : ''}>Todo o período</option>
              ${UI.PERIODOS.filter(p => p.id !== 'tudo').map(p =>
                `<option value="${p.id}" ${estado.periodo === p.id ? 'selected' : ''}>${p.nome}</option>`).join('')}
            </select>
          </div>

          ${UI.tabela({
            itens: itens,
            ordenacao: estado.ordem,
            colunas: [
              {
                titulo: 'Cliente', campo: 'cliente', sortable: true, render: v => {
                  const c = Store.L.cliente(v.clienteId) || {};
                  return `<div class="cellmain"><b>${U.esc(c.nome || '—')}</b><small>${U.esc(c.empresa || '')}</small></div>`;
                }
              },
              { titulo: 'Produto', campo: 'produto', sortable: true, render: v => U.esc(Store.L.nomeProduto(v.produtoId)) },
              { titulo: 'Valor', campo: 'valor', classe: 'num', sortable: true, render: v => `<b>${U.money(v.valorBruto - v.desconto)}</b>` },
              {
                titulo: 'Receita/mês', campo: 'mrr', classe: 'num', sortable: true, render: v => {
                  const m = Store.mrr(v);
                  return m ? U.money(m) : '<span class="tiny muted">pontual</span>';
                }
              },
              { titulo: 'Data', campo: 'data', classe: 'nowrap', sortable: true, render: v => U.fmtDate(v.dataVenda) },
              { titulo: 'Status', campo: 'status', sortable: true, render: v => UI.badge(Store.L.statusVenda(v.statusId)) },
              { titulo: 'Responsável', campo: 'responsavel', sortable: true, render: v => U.esc(Store.L.nomeUsuario(v.responsavelId)) },
              {
                titulo: '', campo: 'acoes', classe: 'num', render: v =>
                  `<div class="tbl__actions">
                    <button class="icon-btn" data-cli="${v.clienteId}" title="Ver cliente">👁️</button>
                    ${pode ? `<button class="icon-btn" data-editar="${v.id}" title="Editar venda">✏️</button>` : ''}
                  </div>`
              }
            ],
            rodape: {
              cliente: '<b>' + itens.length + ' contrato(s)</b>',
              valor: '<b>' + U.money(visivel.total) + '</b>',
              mrr: '<b>' + U.money(visivel.mrr) + '</b>'
            },
            vazio: { icone: '💼', titulo: 'Carteira vazia', texto: 'Registre vendas para começar a formar a carteira.' }
          })}
        </div>
      </div>

      <div class="grid grid--2">
        <div class="card card--pad0">
          <div class="card__head"><h2>🥇 Maiores clientes da carteira</h2></div>
          <div class="card__body">
            ${top.length ? Charts.hbars(top.map(t => ({
              label: t.cliente.nome, valor: t.valor,
              sub: t.contratos + ' contrato(s)' + (t.mrr ? ' · ' + U.money0(t.mrr) + '/mês' : '')
            }))) : UI.vazio({ titulo: 'Sem clientes na carteira' })}
          </div>
        </div>
        <div class="card card--pad0">
          <div class="card__head"><h2>🧩 Carteira por produto</h2></div>
          <div class="card__body">
            ${Charts.donut(
              U.sortBy(Store.list('produtos').map(p => ({
                label: p.nome,
                valor: U.sum(cart.itens.filter(v => v.produtoId === p.id), v => v.valorBruto - v.desconto)
              })).filter(x => x.valor > 0), x => x.valor, 'desc').slice(0, 7),
              { centroSub: 'em carteira' })}
          </div>
        </div>
      </div>`;
    },

    mount(el) {
      const busca = el.querySelector('#busca');
      if (busca) busca.oninput = U.debounce(e => {
        estado.busca = e.target.value; App.render();
        const b = document.getElementById('busca');
        if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
      }, 260);
      const bind = (id, prop) => { const s = el.querySelector(id); if (s) s.onchange = e => { estado[prop] = e.target.value; App.render(); }; };
      bind('#fProduto', 'produto'); bind('#fCliente', 'cliente'); bind('#fResp', 'responsavel');
      bind('#fStatus', 'status'); bind('#fCat', 'categoria');

      const per = el.querySelector('#fPeriodo');
      if (per) per.onchange = e => {
        if (e.target.value === 'custom') {
          return UI.periodoCustom(estado.custom || U.range('mes'),
            c => { estado.custom = c; estado.periodo = 'custom'; App.render(); });
        }
        estado.periodo = e.target.value; App.render();
      };

      el.querySelectorAll('th.sortable').forEach(th => {
        th.onclick = () => {
          const campo = th.getAttribute('data-sort');
          estado.ordem = estado.ordem.campo === campo
            ? { campo: campo, dir: estado.ordem.dir === 'asc' ? 'desc' : 'asc' }
            : { campo: campo, dir: 'desc' };
          App.render();
        };
      });

      el.querySelectorAll('[data-cli]').forEach(b => b.onclick = () => Forms.detalheCliente(b.getAttribute('data-cli')));
      el.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => Forms.venda(b.getAttribute('data-editar')));
      const nova = el.querySelector('[data-nova]');
      if (nova) nova.onclick = () => Forms.venda();
      const pdf = el.querySelector('[data-pdf]');
      if (pdf) pdf.onclick = () => UI.exportarPDF('Carteira — CRM de Produtos da Firece');

      const exp = el.querySelector('[data-exportar]');
      if (exp) exp.onclick = () => {
        const cart = M.carteira(filtros());
        U.exportCSV('carteira',
          ['Cliente', 'Empresa', 'Produto', 'Valor', 'Receita mensal', 'Data', 'Status', 'Responsável'],
          itensFiltrados(cart).map(v => {
            const c = Store.L.cliente(v.clienteId) || {};
            return [c.nome, c.empresa, Store.L.nomeProduto(v.produtoId),
              U.round2(v.valorBruto - v.desconto), U.round2(Store.mrr(v)),
              U.fmtDate(v.dataVenda), (Store.L.statusVenda(v.statusId) || {}).nome,
              Store.L.nomeUsuario(v.responsavelId)];
          }));
        UI.toast('Carteira exportada.', 'ok');
      };
    }
  };
})(window);
