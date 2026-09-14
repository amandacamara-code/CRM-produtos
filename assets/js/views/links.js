/* =========================================================
   views/links.js — central de links de cadastro + QR Codes
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { busca: '', somenteSem: false };

  Views.links = {
    titulo: '🔗 Links de Cadastro',
    subtitulo: 'Um endereço público por produto — copie, abra ou gere o QR Code',

    render() {
      const pode = Store.podeEditar();
      let produtos = Store.list('produtos');
      const q = U.norm(estado.busca);
      if (q) produtos = produtos.filter(p => U.norm(p.nome).indexOf(q) > -1 || U.norm(p.sku).indexOf(q) > -1);
      if (estado.somenteSem) produtos = produtos.filter(p => !p.link);

      const todos = Store.list('produtos');
      const comLink = todos.filter(p => !!p.link).length;

      const cards = produtos.map(p => {
        const st = Store.L.statusProduto(p.statusId);
        const cat = Store.L.categoria(p.categoriaId);
        return `<div class="card" data-prod="${p.id}">
          <div class="spread mb">
            <div style="min-width:0">
              <div class="strong">${U.esc(p.nome)}</div>
              <div class="tiny muted mono">${U.esc(p.sku)}${cat ? ' · ' + U.esc(cat.nome) : ''}</div>
            </div>
            ${UI.badge(st)}
          </div>
          ${UI.linkBox(p.link, { editavel: pode })}
          <div class="hstack mt">
            ${p.link ? `<button class="btn btn--sm btn--blue" data-link-open="${U.esc(p.link)}">🔗 Abrir Cadastro</button>
                        <button class="btn btn--sm btn--ghost" data-link-qr="${U.esc(p.link)}" data-link-titulo="${U.esc(p.nome)}">⬛ Gerar QR Code</button>`
                      : pode ? `<button class="btn btn--sm btn--fire" data-def="${p.id}">＋ Definir link</button>` : ''}
          </div>
        </div>`;
      }).join('');

      return `
      <div class="grid grid--3 mb">
        ${UI.kpi({ icone: '🔗', titulo: 'Produtos com link', valor: U.num(comLink), cor: 'blue', sub: 'de ' + todos.length + ' produtos' })}
        ${UI.kpi({ icone: '⚠️', titulo: 'Sem link definido', valor: U.num(todos.length - comLink), cor: 'orange' })}
        ${UI.kpi({ icone: '🌐', titulo: 'Domínio base', valor: `<span class="mono" style="font-size:13px">${U.esc(Store.config.baseLinks)}</span>`, cor: 'ink', sub: 'Configurável em Configurações' })}
      </div>

      <div class="card mb">
        <div class="toolbar" style="margin:0">
          <div class="searchbar"><input class="input input--sm" id="busca" placeholder="Buscar produto…" value="${U.esc(estado.busca)}"></div>
          <label class="switch"><input type="checkbox" id="fSem" ${estado.somenteSem ? 'checked' : ''}><span class="small">Só os que não têm link</span></label>
          ${pode ? `<button class="btn btn--sm btn--ghost" data-gerar style="margin-left:auto">✨ Gerar links faltantes</button>` : ''}
        </div>
      </div>

      ${produtos.length ? `<div class="grid grid--2">${cards}</div>`
        : UI.vazio({ icone: '🔗', titulo: 'Nenhum produto encontrado', texto: 'Ajuste a busca ou cadastre um produto.' })}`;
    },

    mount(el) {
      const busca = el.querySelector('#busca');
      if (busca) busca.oninput = U.debounce(e => {
        estado.busca = e.target.value; App.render();
        const b = document.getElementById('busca');
        if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
      }, 260);
      const sem = el.querySelector('#fSem');
      if (sem) sem.onchange = e => { estado.somenteSem = e.target.checked; App.render(); };

      el.querySelectorAll('[data-def]').forEach(b => b.onclick = () => Forms.editarLink(b.getAttribute('data-def')));
      // lápis dentro do linkbox -> edita o link do produto daquele card
      el.querySelectorAll('[data-link-edit]').forEach(b => {
        const card = b.closest('[data-prod]');
        if (card) b.onclick = () => Forms.editarLink(card.getAttribute('data-prod'));
      });

      const gerar = el.querySelector('[data-gerar]');
      if (gerar) gerar.onclick = async () => {
        const faltantes = Store.list('produtos').filter(p => !p.link);
        if (!faltantes.length) return UI.toast('Todos os produtos já possuem link.', 'info');
        const ok = await UI.confirmar({
          titulo: 'Gerar links automaticamente',
          mensagem: `Serão criados links para <b>${faltantes.length}</b> produto(s), usando o domínio base
            <code>${U.esc(Store.config.baseLinks)}</code> + o nome do produto.`,
          confirmar: 'Gerar links'
        });
        if (!ok) return;
        faltantes.forEach(p => Store.upsert('produtos',
          { id: p.id, link: Store.config.baseLinks + U.slug(p.nome) }, { silent: true }));
        Store.save();
        UI.toast(faltantes.length + ' link(s) gerados.', 'ok');
        App.render();
      };
    }
  };
})(window);
