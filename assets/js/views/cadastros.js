/* =========================================================
   views/cadastros.js — lista de cadastros / leads
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { busca: '', etapa: '', produto: '', responsavel: '', prioridade: '', ordem: { campo: 'data', dir: 'desc' } };

  function filtrar() {
    let arr = Store.scope(Store.list('oportunidades'));
    const q = U.norm(estado.busca);
    if (q) {
      arr = arr.filter(o => {
        const cli = Store.L.cliente(o.clienteId) || {};
        return U.norm(cli.nome).indexOf(q) > -1 || U.norm(cli.empresa).indexOf(q) > -1 ||
          U.norm(cli.email).indexOf(q) > -1 || U.norm(Store.L.nomeProduto(o.produtoId)).indexOf(q) > -1;
      });
    }
    if (estado.etapa) arr = arr.filter(o => o.etapaId === estado.etapa);
    if (estado.produto) arr = arr.filter(o => o.produtoId === estado.produto);
    if (estado.responsavel) arr = arr.filter(o => o.responsavelId === estado.responsavel);
    if (estado.prioridade) arr = arr.filter(o => o.prioridadeId === estado.prioridade);

    const campo = estado.ordem.campo;
    const getter = {
      cliente: o => (Store.L.cliente(o.clienteId) || {}).nome || '',
      produto: o => Store.L.nomeProduto(o.produtoId),
      valor: o => o.valor,
      data: o => o.data || '',
      etapa: o => (Store.L.etapa(o.etapaId) || {}).ordem || 0,
      responsavel: o => Store.L.nomeUsuario(o.responsavelId)
    }[campo] || (o => o[campo]);
    return U.sortBy(arr, getter, estado.ordem.dir);
  }

  Views.cadastros = {
    titulo: '👥 Cadastros',
    subtitulo: 'Todos os leads e oportunidades registrados',

    render() {
      const itens = filtrar();
      const pode = Store.podeEditar();
      const total = U.sum(itens, o => o.valor);
      const abertos = itens.filter(o => (Store.L.etapa(o.etapaId) || {}).aberto);

      return `
      <div class="grid grid--4 mb">
        ${UI.kpi({ icone: '👥', titulo: 'Cadastros listados', valor: U.num(itens.length), cor: 'blue' })}
        ${UI.kpi({ icone: '🎯', titulo: 'Em aberto', valor: U.num(abertos.length), cor: 'orange', sub: U.money0(U.sum(abertos, o => o.valor)) })}
        ${UI.kpi({ icone: '💰', titulo: 'Valor total', valor: U.money0(total), cor: 'gold' })}
        ${UI.kpi({ icone: '📊', titulo: 'Ticket médio', valor: U.money0(itens.length ? total / itens.length : 0), cor: 'ink' })}
      </div>

      <div class="card card--pad0">
        <div class="card__head">
          <h2>Lista de cadastros</h2>
          <div class="hstack">
            <button class="btn btn--sm btn--ghost" data-exportar>📥 Excel</button>
            ${pode ? `<button class="btn btn--sm btn--fire" data-novo>＋ Novo Cadastro</button>` : ''}
          </div>
        </div>
        <div class="card__body">
          <div class="toolbar">
            <div class="searchbar"><input class="input" id="busca" placeholder="Buscar por cliente, empresa, e-mail ou produto…" value="${U.esc(estado.busca)}"></div>
          </div>
          <div class="filters">
            <select class="input input--sm" id="fEtapa">${UI.opcoes(Store.etapasFunil(), estado.etapa, { vazio: 'Todos os status' })}</select>
            <select class="input input--sm" id="fProduto">${UI.opcoes(Store.list('produtos'), estado.produto, { vazio: 'Todos os produtos' })}</select>
            <select class="input input--sm" id="fResp">${UI.opcoes(Store.list('usuarios'), estado.responsavel, { vazio: 'Todos os responsáveis' })}</select>
            <select class="input input--sm" id="fPrio">${UI.opcoes(Store.config.prioridades, estado.prioridade, { vazio: 'Todas as prioridades' })}</select>
          </div>

          ${UI.tabela({
            itens: itens,
            ordenacao: estado.ordem,
            colunas: [
              {
                titulo: 'Cliente', campo: 'cliente', sortable: true, render: o => {
                  const c = Store.L.cliente(o.clienteId) || {};
                  return `<div class="cellmain"><b>${U.esc(c.nome || '—')}</b><small>${U.esc(c.empresa || c.email || '')}</small></div>`;
                }
              },
              { titulo: 'Produto', campo: 'produto', sortable: true, render: o => U.esc(Store.L.nomeProduto(o.produtoId)) },
              { titulo: 'Valor', campo: 'valor', classe: 'num', sortable: true, render: o => `<b>${U.money(o.valor)}</b>` },
              { titulo: 'Status', campo: 'etapa', sortable: true, render: o => UI.badge(Store.L.etapa(o.etapaId)) },
              { titulo: 'Prioridade', campo: 'prioridade', render: o => UI.badge(Store.L.prioridade(o.prioridadeId)) },
              { titulo: 'Responsável', campo: 'responsavel', sortable: true, render: o => U.esc(Store.L.nomeUsuario(o.responsavelId)) },
              { titulo: 'Data', campo: 'data', classe: 'nowrap', sortable: true, render: o => U.fmtDate(o.data) },
              {
                titulo: '', campo: 'acoes', classe: 'num', render: o =>
                  `<div class="tbl__actions">
                    <button class="icon-btn" data-ver="${o.id}" title="Ver detalhes">👁️</button>
                    ${pode ? `<button class="icon-btn" data-editar="${o.id}" title="Editar">✏️</button>
                              <button class="icon-btn" data-excluir="${o.id}" title="Excluir">🗑️</button>` : ''}
                  </div>`
              }
            ],
            vazio: { icone: '🔍', titulo: 'Nenhum cadastro encontrado', texto: 'Ajuste os filtros ou crie um novo cadastro.' }
          })}
        </div>
      </div>`;
    },

    mount(el) {
      const busca = el.querySelector('#busca');
      if (busca) {
        busca.oninput = U.debounce(e => { estado.busca = e.target.value; App.render(); manterFoco(); }, 260);
      }
      const bind = (id, prop) => {
        const s = el.querySelector(id);
        if (s) s.onchange = e => { estado[prop] = e.target.value; App.render(); };
      };
      bind('#fEtapa', 'etapa'); bind('#fProduto', 'produto');
      bind('#fResp', 'responsavel'); bind('#fPrio', 'prioridade');

      el.querySelectorAll('th.sortable').forEach(th => {
        th.onclick = () => {
          const campo = th.getAttribute('data-sort');
          estado.ordem = (estado.ordem.campo === campo)
            ? { campo: campo, dir: estado.ordem.dir === 'asc' ? 'desc' : 'asc' }
            : { campo: campo, dir: 'desc' };
          App.render();
        };
      });

      el.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => Forms.detalheOportunidade(b.getAttribute('data-ver')));
      el.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => Forms.cadastro(b.getAttribute('data-editar')));
      el.querySelectorAll('[data-excluir]').forEach(b => b.onclick = () => {
        const op = Store.get('oportunidades', b.getAttribute('data-excluir'));
        Forms.excluir('oportunidades', op.id, Store.L.nomeCliente(op.clienteId));
      });
      const novo = el.querySelector('[data-novo]');
      if (novo) novo.onclick = () => Forms.cadastro();

      const exp = el.querySelector('[data-exportar]');
      if (exp) exp.onclick = () => {
        const itens = filtrar();
        U.exportCSV('cadastros',
          ['Cliente', 'Empresa', 'CPF/CNPJ', 'E-mail', 'Telefone', 'Produto', 'Valor', 'Status', 'Prioridade', 'Origem', 'Responsável', 'Data', 'Observações'],
          itens.map(o => {
            const c = Store.L.cliente(o.clienteId) || {};
            return [c.nome, c.empresa, c.documento, c.email, c.telefone,
              Store.L.nomeProduto(o.produtoId), o.valor,
              (Store.L.etapa(o.etapaId) || {}).nome, (Store.L.prioridade(o.prioridadeId) || {}).nome,
              o.origem, Store.L.nomeUsuario(o.responsavelId), U.fmtDate(o.data), o.observacoes];
          }));
        UI.toast('Arquivo exportado para Excel (CSV).', 'ok');
      };

      function manterFoco() {
        const b = document.getElementById('busca');
        if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
      }
    }
  };
})(window);
