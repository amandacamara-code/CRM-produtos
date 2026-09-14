/* =========================================================
   views/clientes.js — base de clientes
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { busca: '', status: '', responsavel: '', origem: '', ordem: { campo: 'carteira', dir: 'desc' } };

  function enriquecer() {
    const vendas = Store.scope(Store.list('vendas'));
    const ops = Store.scope(Store.list('oportunidades'));
    return Store.scope(Store.list('clientes')).map(c => {
      const vs = vendas.filter(v => v.clienteId === c.id && M.isAtiva(v));
      const carteira = vs.filter(v => v.emCarteira !== false);
      const abertas = ops.filter(o => o.clienteId === c.id && (Store.L.etapa(o.etapaId) || {}).aberto);
      return {
        cliente: c,
        id: c.id,
        compras: vs.length,
        total: U.round2(U.sum(vs, v => v.valorBruto)),
        carteira: U.round2(U.sum(carteira, v => v.valorBruto - v.desconto)),
        mrr: U.round2(U.sum(carteira, v => Store.mrr(v))),
        pipeline: U.round2(U.sum(abertas, o => o.valor)),
        pipelineQtd: abertas.length,
        ultimaCompra: vs.length ? U.sortBy(vs, v => v.dataVenda, 'desc')[0].dataVenda : ''
      };
    });
  }

  function filtrar() {
    let arr = enriquecer();
    const q = U.norm(estado.busca);
    if (q) arr = arr.filter(x => {
      const c = x.cliente;
      return U.norm(c.nome).indexOf(q) > -1 || U.norm(c.empresa).indexOf(q) > -1 ||
        U.norm(c.email).indexOf(q) > -1 || U.norm(c.documento).indexOf(q) > -1;
    });
    if (estado.status) arr = arr.filter(x => x.cliente.statusId === estado.status);
    if (estado.responsavel) arr = arr.filter(x => x.cliente.responsavelId === estado.responsavel);
    if (estado.origem) arr = arr.filter(x => x.cliente.origem === estado.origem);

    const getter = {
      nome: x => x.cliente.nome, empresa: x => x.cliente.empresa || '',
      carteira: x => x.carteira, total: x => x.total, compras: x => x.compras,
      pipeline: x => x.pipeline, data: x => x.cliente.dataCadastro || '',
      status: x => (Store.L.statusCliente(x.cliente.statusId) || {}).nome
    }[estado.ordem.campo] || (x => x[estado.ordem.campo]);
    return U.sortBy(arr, getter, estado.ordem.dir);
  }

  Views.clientes = {
    titulo: '👥 Clientes',
    subtitulo: 'Base completa de clientes e prospects',

    render() {
      const arr = filtrar();
      const res = M.resumoCadastros();
      const pode = Store.podeEditar();
      const carteiraTotal = U.sum(arr, x => x.carteira);

      return `
      <div class="grid grid--4 mb">
        ${UI.kpi({ icone: '👥', titulo: 'Clientes cadastrados', valor: U.num(res.total), cor: 'blue' })}
        ${UI.kpi({ icone: '🟢', titulo: 'Clientes ativos', valor: U.num(res.ativos), cor: 'green', sub: U.pct(res.total ? (res.ativos / res.total) * 100 : 0) + ' da base' })}
        ${UI.kpi({ icone: '🔵', titulo: 'Prospects', valor: U.num(res.prospects), cor: 'purple' })}
        ${UI.kpi({ icone: '📅', titulo: 'Novos no mês', valor: U.num(res.noMes), cor: 'gold' })}
      </div>

      <div class="card card--pad0">
        <div class="card__head">
          <h2>Base de clientes</h2>
          <div class="hstack">
            <button class="btn btn--sm btn--ghost" data-exportar>📥 Excel</button>
            ${pode ? `<button class="btn btn--sm btn--fire" data-novo>＋ Novo Cliente</button>` : ''}
          </div>
        </div>
        <div class="card__body">
          <div class="toolbar">
            <div class="searchbar"><input class="input" id="busca" placeholder="Buscar por nome, empresa, e-mail ou documento…" value="${U.esc(estado.busca)}"></div>
          </div>
          <div class="filters">
            <select class="input input--sm" id="fStatus">${UI.opcoes(Store.config.statusCliente, estado.status, { vazio: 'Todos os status' })}</select>
            <select class="input input--sm" id="fResp">${UI.opcoes(Store.list('usuarios'), estado.responsavel, { vazio: 'Todos responsáveis' })}</select>
            <select class="input input--sm" id="fOrigem">${UI.opcoes(Store.config.origens, estado.origem, { vazio: 'Todas as origens' })}</select>
          </div>

          ${UI.tabela({
            itens: arr,
            ordenacao: estado.ordem,
            colunas: [
              {
                titulo: 'Cliente', campo: 'nome', sortable: true, render: x =>
                  `<div class="hstack" style="flex-wrap:nowrap">${UI.avatar(x.cliente.nome, 32)}
                    <div class="cellmain"><b>${U.esc(x.cliente.nome)}</b><small>${U.esc(x.cliente.empresa || x.cliente.email || '')}</small></div></div>`
              },
              { titulo: 'Contato', campo: 'contato', render: x =>
                  `<div class="cellmain"><small>${U.esc(x.cliente.telefone || '—')}</small><small>${U.esc(U.truncate(x.cliente.email || '', 28))}</small></div>` },
              { titulo: 'Origem', campo: 'origem', render: x => x.cliente.origem ? `<span class="badge badge--outline">${U.esc(x.cliente.origem)}</span>` : '—' },
              { titulo: 'Compras', campo: 'compras', classe: 'num', sortable: true, render: x => U.num(x.compras) },
              { titulo: 'Total comprado', campo: 'total', classe: 'num', sortable: true, render: x => U.money0(x.total) },
              { titulo: 'Em carteira', campo: 'carteira', classe: 'num', sortable: true, render: x => `<b>${U.money0(x.carteira)}</b>` },
              { titulo: 'Pipeline', campo: 'pipeline', classe: 'num', sortable: true, render: x =>
                  x.pipeline ? `<div class="cellmain" style="text-align:right"><b>${U.money0(x.pipeline)}</b><small>${x.pipelineQtd} oport.</small></div>` : '—' },
              { titulo: 'Status', campo: 'status', sortable: true, render: x => UI.badge(Store.L.statusCliente(x.cliente.statusId)) },
              {
                titulo: '', campo: 'acoes', classe: 'num', render: x =>
                  `<div class="tbl__actions">
                    <button class="icon-btn" data-ver="${x.id}" title="Ver ficha">👁️</button>
                    ${pode ? `<button class="icon-btn" data-editar="${x.id}" title="Editar">✏️</button>
                              <button class="icon-btn" data-excluir="${x.id}" title="Excluir">🗑️</button>` : ''}
                  </div>`
              }
            ],
            rodape: {
              nome: '<b>' + arr.length + ' cliente(s)</b>',
              total: '<b>' + U.money0(U.sum(arr, x => x.total)) + '</b>',
              carteira: '<b>' + U.money0(carteiraTotal) + '</b>',
              pipeline: '<b>' + U.money0(U.sum(arr, x => x.pipeline)) + '</b>'
            },
            vazio: {
              icone: '👥', titulo: 'Nenhum cliente encontrado',
              acao: pode ? `<button class="btn btn--fire" data-novo>＋ Novo Cliente</button>` : ''
            }
          })}
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
      bind('#fStatus', 'status'); bind('#fResp', 'responsavel'); bind('#fOrigem', 'origem');

      el.querySelectorAll('th.sortable').forEach(th => {
        th.onclick = () => {
          const campo = th.getAttribute('data-sort');
          estado.ordem = estado.ordem.campo === campo
            ? { campo: campo, dir: estado.ordem.dir === 'asc' ? 'desc' : 'asc' }
            : { campo: campo, dir: 'desc' };
          App.render();
        };
      });

      el.querySelectorAll('[data-novo]').forEach(b => b.onclick = () => Forms.cliente());
      el.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => Forms.detalheCliente(b.getAttribute('data-ver')));
      el.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => Forms.cliente(b.getAttribute('data-editar')));
      el.querySelectorAll('[data-excluir]').forEach(b => b.onclick = () => {
        const c = Store.get('clientes', b.getAttribute('data-excluir'));
        Forms.excluir('clientes', c.id, c.nome);
      });

      const exp = el.querySelector('[data-exportar]');
      if (exp) exp.onclick = () => {
        U.exportCSV('clientes',
          ['Nome', 'CPF/CNPJ', 'E-mail', 'Telefone', 'Empresa', 'Origem', 'Status', 'Responsável', 'Cadastro', 'Compras', 'Total comprado', 'Em carteira', 'Receita mensal', 'Pipeline'],
          filtrar().map(x => {
            const c = x.cliente;
            return [c.nome, c.documento, c.email, c.telefone, c.empresa, c.origem,
              (Store.L.statusCliente(c.statusId) || {}).nome, Store.L.nomeUsuario(c.responsavelId),
              U.fmtDate(c.dataCadastro), x.compras, x.total, x.carteira, x.mrr, x.pipeline];
          }));
        UI.toast('Base de clientes exportada.', 'ok');
      };
    }
  };
})(window);
