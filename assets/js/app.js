/* =========================================================
   app.js — roteamento, menu lateral e ciclo de vida
   ========================================================= */
(function (global) {
  'use strict';

  const MENU = [
    {
      grupo: 'Principal', itens: [
        { rota: 'dashboard', icone: '📊', nome: 'Dashboard' },
        { rota: 'cadastros', icone: '👥', nome: 'Cadastros', badge: () => M.pipeline().qtd },
        { rota: 'funil', icone: '🎯', nome: 'Funil de Vendas' }
      ]
    },
    {
      grupo: 'Produtos', itens: [
        { rota: 'produtos', icone: '📦', nome: 'Produtos', badge: () => M.resumoProdutos().ativos },
        { rota: 'links', icone: '🔗', nome: 'Links de Cadastro' },
        { rota: 'desempenho', icone: '📊', nome: 'Desempenho dos Produtos' }
      ]
    },
    {
      grupo: 'Gestão', itens: [
        { rota: 'tarefas', icone: '✅', nome: 'Tarefas', badge: () => M.resumoTarefas().atrasadas.length, alerta: true },
        { rota: 'carteira', icone: '💼', nome: 'Carteira' },
        { rota: 'financeiro', icone: '💰', nome: 'Financeiro' },
        { rota: 'clientes', icone: '👥', nome: 'Clientes' }
      ]
    },
    {
      grupo: 'Análise', itens: [
        { rota: 'relatorios', icone: '📈', nome: 'Relatórios' },
        { rota: 'ranking', icone: '🏆', nome: 'Ranking de Produtos' }
      ]
    },
    {
      grupo: 'Configurações', itens: [
        { rota: 'config', icone: '⚙️', nome: 'Configurações' }
      ]
    }
  ];

  const App = {
    rota: 'dashboard',

    /* ---------------- inicialização ---------------- */
    iniciar() {
      Store.load();

      // rota da URL (#/produtos)
      const inicial = (location.hash || '').replace(/^#\/?/, '');
      if (inicial && Views[inicial]) this.rota = inicial;
      if (!Store.podeVer(this.rota)) this.rota = 'dashboard';

      this.montarNav();
      this.montarUsuario();
      this.ligarEventosGlobais();
      this.render();

      window.addEventListener('hashchange', () => {
        const r = (location.hash || '').replace(/^#\/?/, '') || 'dashboard';
        if (r !== this.rota && Views[r]) this.go(r, true);
      });

      Store.on('storage-error', () => {
        UI.toast('Não foi possível salvar no navegador (armazenamento cheio ou bloqueado).', 'err', 6000);
      });
    },

    /* ---------------- navegação ---------------- */
    montarNav() {
      const nav = document.getElementById('nav');
      nav.innerHTML = MENU.map(g => {
        const itens = g.itens.filter(i => Store.podeVer(i.rota));
        if (!itens.length) return '';
        return `<div class="nav__group">
          <div class="nav__label">${U.esc(g.grupo)}</div>
          ${itens.map(i => {
            let badge = '';
            try {
              const v = i.badge ? i.badge() : 0;
              if (v) badge = `<span class="nav__badge ${i.alerta ? 'nav__badge--alert' : ''}">${U.num(v)}</span>`;
            } catch (e) { /* ignora */ }
            return `<button class="nav__item ${i.rota === App.rota ? 'is-active' : ''}" data-rota="${i.rota}">
              <span aria-hidden="true">${i.icone}</span><span>${U.esc(i.nome)}</span>${badge}</button>`;
          }).join('')}
        </div>`;
      }).join('');

      nav.querySelectorAll('[data-rota]').forEach(b =>
        b.onclick = () => App.go(b.getAttribute('data-rota')));

      // barra inferior (mobile)
      document.querySelectorAll('.tabbar [data-route]').forEach(b => {
        b.classList.toggle('is-active', b.getAttribute('data-route') === App.rota);
        b.onclick = () => App.go(b.getAttribute('data-route'));
      });
    },

    montarUsuario() {
      const u = Store.currentUser();
      if (!u) return;
      const perfil = Store.PERFIS[u.perfil] || {};
      document.getElementById('userName').textContent = u.nome;
      document.getElementById('userRole').textContent = perfil.nome || u.perfil;
      const av = document.getElementById('userAvatar');
      av.textContent = U.initials(u.nome);
      av.style.background = U.colorFor(u.nome);

      const sel = document.getElementById('userSwitch');
      sel.innerHTML = Store.list('usuarios').filter(x => x.ativo !== false)
        .map(x => `<option value="${x.id}" ${x.id === u.id ? 'selected' : ''}>${U.esc(x.nome)} · ${U.esc((Store.PERFIS[x.perfil] || {}).nome || '')}</option>`).join('');
      sel.onchange = e => {
        Store.setUser(e.target.value);
        this.montarUsuario();
        if (!Store.podeVer(this.rota)) this.rota = 'dashboard';
        this.montarNav();
        this.render();
        const novo = Store.currentUser();
        UI.toast('Acessando como ' + novo.nome + ' (' + (Store.PERFIS[novo.perfil] || {}).nome + ').', 'info', 3600);
      };
    },

    go(rota, semHash) {
      if (!Views[rota]) rota = 'dashboard';
      if (!Store.podeVer(rota)) {
        UI.toast('Seu perfil não tem acesso a esta área.', 'err');
        return;
      }
      this.rota = rota;
      if (!semHash) location.hash = '#/' + rota;
      this.fecharMenu();
      this.montarNav();
      this.render();
      window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    },

    /* ---------------- renderização ---------------- */
    render() {
      const view = Views[this.rota] || Views.dashboard;
      const alvo = document.getElementById('view');

      document.getElementById('pageTitle').textContent = view.titulo;
      document.getElementById('pageSubtitle').textContent = view.subtitulo || '';
      document.title = view.titulo.replace(/^[^\wÀ-ſ]+/, '') + ' · CRM Produtos';

      const scroll = window.scrollY;
      try {
        alvo.innerHTML = view.render();
      } catch (e) {
        console.error(e);
        alvo.innerHTML = UI.vazio({
          icone: '⚠️', titulo: 'Não foi possível carregar esta tela',
          texto: e.message,
          acao: '<button class="btn btn--navy" onclick="location.reload()">Recarregar</button>'
        });
        return;
      }
      if (view.mount) {
        try { view.mount(alvo); } catch (e) { console.error(e); }
      }
      this.montarNav();
      // preserva a posição da rolagem em re-renderizações da mesma tela
      if (scroll > 0) window.scrollTo(0, scroll);
    },

    /* ---------------- menu lateral (mobile) ---------------- */
    abrirMenu() {
      document.getElementById('sidebar').classList.add('is-open');
      document.getElementById('sidebarOverlay').hidden = false;
      document.body.style.overflow = 'hidden';
    },
    fecharMenu() {
      document.getElementById('sidebar').classList.remove('is-open');
      document.getElementById('sidebarOverlay').hidden = true;
      if (!document.querySelector('.modal')) document.body.style.overflow = '';
    },

    /* ---------------- eventos globais ---------------- */
    ligarEventosGlobais() {
      document.getElementById('burger').onclick = () => this.abrirMenu();
      document.getElementById('sidebarClose').onclick = () => this.fecharMenu();
      document.getElementById('sidebarOverlay').onclick = () => this.fecharMenu();

      document.querySelectorAll('[data-action="new-cadastro"]').forEach(b => b.onclick = () => Forms.cadastro());
      document.querySelectorAll('[data-action="new-venda"]').forEach(b => b.onclick = () => Forms.venda());
      document.querySelectorAll('[data-action="goto-config"]').forEach(b => b.onclick = () => this.go('config'));

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') this.fecharMenu();
        // atalhos só fora de campos de texto
        const tag = (e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
        if (e.altKey || e.ctrlKey || e.metaKey) return;
        if (e.key === 'n' || e.key === 'N') { e.preventDefault(); Forms.cadastro(); }
        if (e.key === 'v' || e.key === 'V') { e.preventDefault(); Forms.venda(); }
      });
    }
  };

  global.App = App;

  document.addEventListener('DOMContentLoaded', () => {
    try {
      App.iniciar();
    } catch (e) {
      console.error(e);
      document.getElementById('view').innerHTML =
        `<div class="empty"><div class="empty__icon">⚠️</div>
          <h3>Erro ao iniciar o CRM</h3><p>${U.esc(e.message)}</p>
          <button class="btn btn--navy" onclick="localStorage.removeItem('crm_produtos_v1');location.reload()">
            Recarregar com dados de demonstração</button></div>`;
    }
  });
})(window);
