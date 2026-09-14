/* =========================================================
   views/produtos.js — catálogo de produtos
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { busca: '', categoria: '', status: '', ordem: { campo: 'nome', dir: 'asc' } };

  function filtrar() {
    let arr = Store.list('produtos');
    const q = U.norm(estado.busca);
    if (q) arr = arr.filter(p => U.norm(p.nome).indexOf(q) > -1 || U.norm(p.sku).indexOf(q) > -1 ||
      U.norm(p.descricao).indexOf(q) > -1);
    if (estado.categoria) arr = arr.filter(p => p.categoriaId === estado.categoria);
    if (estado.status) arr = arr.filter(p => p.statusId === estado.status);

    const getter = {
      nome: p => p.nome, sku: p => p.sku,
      categoria: p => (Store.L.categoria(p.categoriaId) || {}).nome || '',
      preco: p => p.preco, custo: p => p.custo,
      margem: p => p.preco > 0 ? ((p.preco - (p.custo || 0)) / p.preco) * 100 : 0,
      comissao: p => p.comissaoPct,
      status: p => (Store.L.statusProduto(p.statusId) || {}).nome || ''
    }[estado.ordem.campo] || (p => p[estado.ordem.campo]);
    return U.sortBy(arr, getter, estado.ordem.dir);
  }

  Views.produtos = {
    titulo: '📦 Produtos',
    subtitulo: 'Catálogo completo — cadastre novos produtos sem alterar o código',

    render() {
      const itens = filtrar();
      const res = M.resumoProdutos();
      const pode = Store.podeEditar();
      const desemp = M.desempenhoProdutos(U.range('12m'));
      const mapa = {};
      desemp.forEach(d => { mapa[d.produto.id] = d; });

      return `
      <div class="grid grid--4 mb">
        ${UI.kpi({ icone: '📦', titulo: 'Produtos cadastrados', valor: U.num(res.total), cor: 'purple' })}
        ${UI.kpi({ icone: '🟢', titulo: 'Ativos', valor: U.num(res.ativos), cor: 'green' })}
        ${UI.kpi({ icone: '🟡', titulo: 'Inativos / em desenvolvimento', valor: U.num(res.inativos), cor: 'gold' })}
        ${UI.kpi({ icone: '⚪', titulo: 'Arquivados', valor: U.num(res.arquivados), cor: 'navy' })}
      </div>

      <div class="card card--pad0">
        <div class="card__head">
          <h2>Catálogo</h2>
          <div class="hstack">
            <button class="btn btn--sm btn--ghost" data-exportar>📥 Excel</button>
            ${pode ? `<button class="btn btn--sm btn--gold" data-novo>＋ Novo Produto</button>` : ''}
          </div>
        </div>
        <div class="card__body">
          <div class="toolbar">
            <div class="searchbar"><input class="input" id="busca" placeholder="Buscar por nome, SKU ou descrição…" value="${U.esc(estado.busca)}"></div>
          </div>
          <div class="filters">
            <select class="input input--sm" id="fCat">${UI.opcoes(Store.config.categorias, estado.categoria, { vazio: 'Todas as categorias' })}</select>
            <select class="input input--sm" id="fStatus">${UI.opcoes(Store.config.statusProduto, estado.status, { vazio: 'Todos os status' })}</select>
          </div>

          ${UI.tabela({
            itens: itens,
            ordenacao: estado.ordem,
            colunas: [
              {
                titulo: 'Produto', campo: 'nome', sortable: true, render: p =>
                  `<div class="cellmain"><b>${U.esc(p.nome)}</b><small class="mono">${U.esc(p.sku)}</small></div>`
              },
              { titulo: 'Categoria', campo: 'categoria', sortable: true, render: p => {
                  const c = Store.L.categoria(p.categoriaId);
                  return c ? `<span class="badge" style="background:${c.cor}1f;color:${c.cor}">${U.esc(c.nome)}</span>` : '—';
                } },
              { titulo: 'Preço', campo: 'preco', classe: 'num', sortable: true, render: p => `<b>${U.money(p.preco)}</b>` },
              { titulo: 'Custo', campo: 'custo', classe: 'num', sortable: true, render: p => U.money(p.custo) },
              {
                titulo: 'Margem', campo: 'margem', classe: 'num', sortable: true, render: p => {
                  const m = p.preco > 0 ? ((p.preco - (p.custo || 0)) / p.preco) * 100 : 0;
                  return `<b class="${m >= 30 ? 'pos' : m >= 0 ? '' : 'neg'}">${U.pct(m)}</b>`;
                }
              },
              { titulo: 'Comissão', campo: 'comissao', classe: 'num', sortable: true, render: p => U.pct(p.comissaoPct) },
              {
                titulo: 'Vendas (12m)', campo: 'vendas', classe: 'num', render: p => {
                  const d = mapa[p.id] || {};
                  return `<div class="cellmain" style="text-align:right"><b>${U.num(d.vendasQtd || 0)}</b><small>${U.money0(d.faturamento || 0)}</small></div>`;
                }
              },
              { titulo: 'Status', campo: 'status', sortable: true, render: p => UI.badge(Store.L.statusProduto(p.statusId)) },
              {
                titulo: 'Link', campo: 'link', render: p => p.link
                  ? `<div class="hstack" style="gap:3px;flex-wrap:nowrap">
                      <button class="icon-btn" data-link-copy="${U.esc(p.link)}" title="Copiar link">📋</button>
                      <button class="icon-btn" data-link-open="${U.esc(p.link)}" title="Abrir">🔗</button>
                      <button class="icon-btn" data-link-qr="${U.esc(p.link)}" data-link-titulo="${U.esc(p.nome)}" title="QR Code">⬛</button>
                    </div>`
                  : `<span class="tiny muted">—</span>`
              },
              {
                titulo: '', campo: 'acoes', classe: 'num', render: p =>
                  `<div class="tbl__actions">
                    <button class="icon-btn" data-ver="${p.id}" title="Ver ficha">👁️</button>
                    ${pode ? `<button class="icon-btn" data-editar="${p.id}" title="Editar">✏️</button>
                              <button class="icon-btn" data-menu="${p.id}" title="Mais ações">⋯</button>` : ''}
                  </div>`
              }
            ],
            vazio: {
              icone: '📦', titulo: 'Nenhum produto cadastrado',
              texto: 'Cadastre o primeiro produto para começar a registrar vendas.',
              acao: pode ? `<button class="btn btn--gold" data-novo>＋ Novo Produto</button>` : ''
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
      bind('#fCat', 'categoria'); bind('#fStatus', 'status');

      el.querySelectorAll('th.sortable').forEach(th => {
        th.onclick = () => {
          const campo = th.getAttribute('data-sort');
          estado.ordem = estado.ordem.campo === campo
            ? { campo: campo, dir: estado.ordem.dir === 'asc' ? 'desc' : 'asc' }
            : { campo: campo, dir: 'asc' };
          App.render();
        };
      });

      el.querySelectorAll('[data-novo]').forEach(b => b.onclick = () => Forms.produto());
      el.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => Forms.detalheProduto(b.getAttribute('data-ver')));
      el.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => Forms.produto(b.getAttribute('data-editar')));
      el.querySelectorAll('[data-menu]').forEach(b => b.onclick = () => menuProduto(b.getAttribute('data-menu')));

      const exp = el.querySelector('[data-exportar]');
      if (exp) exp.onclick = () => {
        U.exportCSV('produtos',
          ['Nome', 'SKU', 'Categoria', 'Descrição', 'Preço', 'Custo', 'Margem %', 'Comissão %', 'Cobrança', 'Periodicidade', 'Status', 'Link', 'Responsável', 'Criado em'],
          filtrar().map(p => [
            p.nome, p.sku, (Store.L.categoria(p.categoriaId) || {}).nome, p.descricao,
            p.preco, p.custo,
            p.preco > 0 ? U.round2(((p.preco - (p.custo || 0)) / p.preco) * 100) : 0,
            p.comissaoPct,
            (Store.L.tipoCobranca(p.tipoCobrancaId) || {}).nome,
            (Store.L.periodicidade(p.periodicidadeId) || {}).nome,
            (Store.L.statusProduto(p.statusId) || {}).nome,
            p.link, Store.L.nomeUsuario(p.responsavelId), U.fmtDate(p.dataCriacao)
          ]));
        UI.toast('Catálogo exportado.', 'ok');
      };
    }
  };

  /* menu de ações avançadas do produto */
  function menuProduto(id) {
    const p = Store.get('produtos', id);
    if (!p) return;
    const statusArquivado = Store.config.statusProduto.find(s => s.arquivado);
    const statusInativo = Store.config.statusProduto.find(s => !s.ativo && !s.arquivado);

    const m = UI.modal({
      titulo: '⚙️ Ações do produto', subtitulo: U.esc(p.nome), tamanho: 'sm',
      corpo: `<div class="vstack">
        <button class="btn btn--ghost btn--block" data-a="editar">✏️ Editar produto</button>
        <button class="btn btn--ghost btn--block" data-a="duplicar">⧉ Duplicar produto</button>
        <button class="btn btn--ghost btn--block" data-a="link">🔗 Editar link de cadastro</button>
        <button class="btn btn--ghost btn--block" data-a="venda">💰 Registrar venda deste produto</button>
        ${statusInativo ? `<button class="btn btn--ghost btn--block" data-a="desativar">🔴 Desativar</button>` : ''}
        ${statusArquivado ? `<button class="btn btn--ghost btn--block" data-a="arquivar">⚪ Arquivar</button>` : ''}
        <div class="divider"></div>
        <button class="btn btn--red btn--block" data-a="excluir">🗑️ Excluir produto</button>
      </div>`,
      rodape: `<button class="btn btn--soft" data-close>Fechar</button>`
    });

    const acoes = {
      editar: () => Forms.produto(p.id),
      duplicar: () => {
        const c = Object.assign({}, p);
        delete c.id; delete c.criadoEm;
        c.nome = p.nome + ' (cópia)'; c.sku = p.sku + '-2'; c.dataCriacao = U.today();
        Store.upsert('produtos', c);
        UI.toast('Produto duplicado.', 'ok'); App.render();
      },
      link: () => Forms.editarLink(p.id),
      venda: () => Forms.venda(null, { produtoId: p.id }),
      desativar: () => { Store.upsert('produtos', { id: p.id, statusId: statusInativo.id }); UI.toast('Produto desativado.', 'ok'); App.render(); },
      arquivar: () => { Store.upsert('produtos', { id: p.id, statusId: statusArquivado.id }); UI.toast('Produto arquivado.', 'ok'); App.render(); },
      excluir: () => Forms.excluir('produtos', p.id, p.nome)
    };
    m.body.querySelectorAll('[data-a]').forEach(b => {
      b.onclick = () => { m.close(); (acoes[b.getAttribute('data-a')] || function () { })(); };
    });
  }
})(window);
