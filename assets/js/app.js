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
    /**
     * Com conexão configurada, exige login e carrega do servidor.
     * Sem conexão, funciona local, como antes.
     */
    async iniciar() {
      if (global.Backend && Backend.configurado()) {
        const ok = await this.iniciarNaNuvem();
        if (!ok) return;           // a tela de login assume daqui
      } else {
        Store.load();
        // sem servidor o login também vem primeiro, para a entrada do
        // sistema ser sempre a mesma
        const sessao = Auth.sessaoLocal();
        const usuario = sessao ? Store.get('usuarios', sessao) : null;
        if (!usuario || usuario.ativo === false) {
          Auth.limparSessaoLocal();
          Auth.entrarLocal(() => this.montarTela());
          return;
        }
        Store.setUser(usuario.id);
      }
      this.montarTela();
    },

    async iniciarNaNuvem() {
      const seguirLocal = () => { Store.load(); this.montarTela(); };
      try {
        Auth.carregando('Conectando…');
        const logado = await Backend.iniciar();

        // volta do e-mail de recuperação de senha
        if (/type=recovery/.test(location.hash)) {
          Auth.novaSenha(() => this.entrarNaNuvem());
          return false;
        }
        if (!logado) {
          Auth.entrar(() => this.entrarNaNuvem());
          return false;
        }
        return await this.entrarNaNuvem(true);
      } catch (e) {
        console.error(e);
        Auth.falhaConexao(e.message, seguirLocal);
        return false;
      }
    },

    /** Já autenticado: confere liberação, baixa os dados e monta a tela. */
    async entrarNaNuvem(jaMontando) {
      try {
        Auth.carregando('Carregando seus dados…');
        if (!Backend.meuPerfil()) await Backend.carregarPerfil();
        const perfil = Backend.meuPerfil();

        if (!perfil) {
          Auth.aviso('Conta sem perfil de acesso',
            'Sua conta existe, mas não tem perfil no CRM. Peça a um administrador para liberar o acesso.',
            async () => { await Backend.sair(); Auth.entrar(() => this.entrarNaNuvem()); });
          return false;
        }
        if (!perfil.ativo) {
          Auth.aguardandoLiberacao(perfil, () => Auth.entrar(() => this.entrarNaNuvem()));
          return false;
        }

        let dados = await Backend.carregarTudo();

        // primeira conexão: sobe o que estava neste navegador
        if (sessionStorage.getItem('crm_firece_migrar') === '1') {
          sessionStorage.removeItem('crm_firece_migrar');
          // 'usuarios' fica de fora: a conta de quem está migrando sempre existe
          const vazio = Backend.TABELAS_JSON.every(c => !(dados[c] || []).length);
          if (vazio && perfil.perfil === 'admin') {
            Auth.carregando('Enviando seus dados para o servidor…');
            await this.migrarBaseLocal(perfil);
            dados = await Backend.carregarTudo();
          }
        }

        Store.hidratarDaNuvem(dados, perfil);
        this.ligarTempoReal();
        Auth.fechar();
        if (!jaMontando) this.montarTela();
        return true;
      } catch (e) {
        console.error(e);
        Auth.falhaConexao(e.message, () => { Store.load(); this.montarTela(); });
        return false;
      }
    },

    /**
     * Envia a base local para o servidor na primeira conexão.
     * Todo registro passa a ter como responsável quem está migrando,
     * porque os usuários de demonstração não têm login de verdade.
     */
    async migrarBaseLocal(perfil) {
      let local = null;
      try {
        const raw = localStorage.getItem('crm_produtos_v1');
        if (raw) local = JSON.parse(raw);
      } catch (e) { /* sem base local */ }
      if (!local) return;

      const mapa = {};
      (local.usuarios || []).forEach(u => { mapa[u.id] = perfil.id; });
      try {
        const relatorio = await Backend.migrarParaNuvem(local, mapa);
        const total = Object.keys(relatorio).reduce((t, k) => t + (relatorio[k] || 0), 0);
        setTimeout(() => UI.toast('✅ ' + U.num(total) + ' registros enviados para o servidor.', 'ok', 6000), 900);
      } catch (e) {
        console.error(e);
        setTimeout(() => UI.toast('Alguns dados não subiram: ' + e.message, 'err', 9000), 900);
      }
    },

    /** Mudanças feitas por outra pessoa entram na tela sozinhas. */
    ligarTempoReal() {
      Backend.ouvirMudancas((tabela, carga) => {
        try {
          if (tabela === 'configuracoes') {
            Store.aplicarConfigRemota(carga.new && carga.new.dados);
          } else if (tabela === 'usuarios') {
            const u = carga.new;
            if (carga.eventType === 'DELETE') {
              Store.aplicarMudancaRemota('usuarios', carga.old, true);
            } else if (u) {
              Store.aplicarMudancaRemota('usuarios', {
                id: u.id, nome: u.nome, email: u.email, cargo: u.cargo || '',
                perfil: u.perfil, ativo: u.ativo
              });
            }
          } else {
            if (carga.eventType === 'DELETE') {
              Store.aplicarMudancaRemota(tabela, carga.old, true);
            } else if (carga.new) {
              Store.aplicarMudancaRemota(tabela,
                Object.assign({}, carga.new.dados, { id: carga.new.id }));
            }
          }
          this.render();
        } catch (e) { console.error('mudança remota', e); }
      });
    },

    montarTela() {
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

      Store.on('sync-error', info => {
        UI.toast(info.mensagem, 'err', 7000);
        this.render();
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

      // Quem está usando vem do login, nos dois modos. Um seletor de
      // usuário aqui deixaria o login sem propósito, então o rodapé
      // oferece apenas a saída.
      document.getElementById('userSwitchArea').innerHTML =
        `<button class="btn btn--sm btn--ghost btn--block" id="btnSair">Sair da conta</button>`;
      document.getElementById('btnSair').onclick = async () => {
        const ok = await UI.confirmar({
          titulo: 'Sair da conta', confirmar: 'Sair',
          mensagem: 'Você precisará entrar de novo com e-mail e senha.'
        });
        if (!ok) return;
        if (Store.modo() === 'nuvem') await Backend.sair();
        Auth.limparSessaoLocal();
        location.reload();
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
      const nomeTela = view.titulo.replace(/^[^\wÀ-ſ]+/, '').trim();
      const marca = 'CRM de Produtos da Firece';
      document.title = nomeTela === marca ? marca : nomeTela + ' · Firece';

      const scroll = window.scrollY;
      try {
        alvo.innerHTML = view.render();
      } catch (e) {
        console.error(e);
        alvo.innerHTML = UI.vazio({
          icone: '⚠️', titulo: 'Não foi possível carregar esta tela',
          texto: e.message,
          acao: '<button class="btn btn--ink" onclick="location.reload()">Recarregar</button>'
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
      Promise.resolve(App.iniciar()).catch(e => {
        console.error(e);
        UI.toast('Erro ao iniciar: ' + e.message, 'err', 8000);
      });
    } catch (e) {
      console.error(e);
      document.getElementById('view').innerHTML =
        `<div class="empty"><div class="empty__icon">⚠️</div>
          <h3>Erro ao iniciar o CRM</h3><p>${U.esc(e.message)}</p>
          <button class="btn btn--ink" onclick="localStorage.removeItem('crm_produtos_v1');location.reload()">
            Recarregar com dados de demonstração</button></div>`;
    }
  });
})(window);
