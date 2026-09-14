/* =========================================================
   backend.js — conexão com o Supabase (login + dados)
   Sem conexão configurada, o sistema continua funcionando
   localmente, como antes.
   ========================================================= */
(function (global) {
  'use strict';

  const CHAVE_CONEXAO = 'crm_firece_conexao';
  const CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.js';

  /* tabelas cujo registro inteiro vai no campo jsonb `dados` */
  const TABELAS_JSON = ['produtos', 'clientes', 'oportunidades', 'vendas', 'tarefas'];

  let cliente = null;
  let usuarioAuth = null;   // sessão do Supabase
  let perfil = null;        // linha de public.usuarios
  let ouvintes = [];

  /* ---------------- configuração ---------------- */
  function config() {
    // 1) arquivo de configuração do deploy  2) o que o admin salvou pela tela
    if (global.FIRECE_SUPABASE && global.FIRECE_SUPABASE.url) return global.FIRECE_SUPABASE;
    try {
      const raw = localStorage.getItem(CHAVE_CONEXAO);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* modo privado */ }
    return {};
  }

  function salvarConfigConexao(url, anonKey) {
    const limpo = { url: String(url || '').trim().replace(/\/+$/, ''), anonKey: String(anonKey || '').trim() };
    localStorage.setItem(CHAVE_CONEXAO, JSON.stringify(limpo));
    return limpo;
  }

  function limparConfigConexao() {
    try { localStorage.removeItem(CHAVE_CONEXAO); } catch (e) { /* noop */ }
  }

  function configurado() {
    const c = config();
    return !!(c.url && c.anonKey);
  }

  /* ---------------- carregamento da biblioteca ---------------- */
  let promessaLib = null;
  function carregarLib() {
    if (global.supabase && global.supabase.createClient) return Promise.resolve(global.supabase);
    if (promessaLib) return promessaLib;
    promessaLib = new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = CDN;
      s.async = true;
      s.onload = () => global.supabase
        ? ok(global.supabase)
        : erro(new Error('Biblioteca do Supabase carregou, mas não inicializou.'));
      s.onerror = () => erro(new Error('Não foi possível carregar a biblioteca do Supabase. Verifique a conexão com a internet.'));
      document.head.appendChild(s);
    });
    return promessaLib;
  }

  /** Cria o cliente e recupera a sessão salva. Retorna true se já há alguém logado. */
  async function iniciar() {
    if (!configurado()) return false;
    const c = config();
    const lib = await carregarLib();
    cliente = lib.createClient(c.url, c.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'crm_firece_sessao' }
    });
    const { data } = await cliente.auth.getSession();
    usuarioAuth = (data && data.session && data.session.user) || null;
    if (usuarioAuth) await carregarPerfil();
    cliente.auth.onAuthStateChange((evento, sessao) => {
      usuarioAuth = (sessao && sessao.user) || null;
      if (!usuarioAuth) perfil = null;
      if (evento === 'SIGNED_OUT') avisar('saiu');
    });
    return !!usuarioAuth;
  }

  /* ---------------- autenticação ---------------- */
  async function entrar(email, senha) {
    const { data, error } = await cliente.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(), password: senha
    });
    if (error) throw new Error(traduzirErro(error.message));
    usuarioAuth = data.user;
    await carregarPerfil();
    return perfil;
  }

  async function cadastrar(nome, email, senha) {
    const { data, error } = await cliente.auth.signUp({
      email: String(email).trim().toLowerCase(),
      password: senha,
      options: { data: { nome: String(nome || '').trim() } }
    });
    if (error) throw new Error(traduzirErro(error.message));
    // com confirmação de e-mail ativada, ainda não existe sessão
    if (!data.session) return { confirmarEmail: true };
    usuarioAuth = data.user;
    await carregarPerfil();
    return { confirmarEmail: false, perfil: perfil };
  }

  async function recuperarSenha(email) {
    const { error } = await cliente.auth.resetPasswordForEmail(
      String(email).trim().toLowerCase(), { redirectTo: location.href.split('#')[0] });
    if (error) throw new Error(traduzirErro(error.message));
  }

  async function definirNovaSenha(senha) {
    const { error } = await cliente.auth.updateUser({ password: senha });
    if (error) throw new Error(traduzirErro(error.message));
  }

  async function sair() {
    if (cliente) await cliente.auth.signOut();
    usuarioAuth = null; perfil = null;
  }

  function traduzirErro(msg) {
    const m = String(msg || '');
    if (/Invalid login credentials/i.test(m)) return 'E-mail ou senha incorretos.';
    if (/Email not confirmed/i.test(m)) return 'Confirme seu e-mail antes de entrar — verifique a caixa de entrada.';
    if (/User already registered/i.test(m)) return 'Já existe uma conta com este e-mail. Faça login.';
    if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
    if (/rate limit|too many/i.test(m)) return 'Muitas tentativas seguidas. Aguarde um minuto e tente de novo.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.';
    return m;
  }

  /* ---------------- perfil da pessoa logada ---------------- */
  async function carregarPerfil() {
    if (!usuarioAuth) { perfil = null; return null; }
    const { data, error } = await cliente.from('usuarios').select('*').eq('id', usuarioAuth.id).maybeSingle();
    if (error) throw new Error('Não foi possível ler seu perfil de acesso: ' + error.message);
    perfil = data || null;
    return perfil;
  }

  const sessao = () => usuarioAuth;
  const meuPerfil = () => perfil;
  const liberado = () => !!(perfil && perfil.ativo);

  /* ---------------- leitura ---------------- */
  const paraApp = linha => Object.assign({}, linha.dados, { id: linha.id });

  /** Busca todas as páginas de uma tabela (o Supabase devolve 1000 por vez). */
  async function buscarTudo(tabela, colunas) {
    const passo = 1000;
    let inicio = 0, saida = [];
    for (;;) {
      const { data, error } = await cliente.from(tabela).select(colunas || '*').range(inicio, inicio + passo - 1);
      if (error) throw new Error('Erro ao ler "' + tabela + '": ' + error.message);
      saida = saida.concat(data || []);
      if (!data || data.length < passo) break;
      inicio += passo;
    }
    return saida;
  }

  /** Traz o banco inteiro no formato que o sistema já usa. */
  async function carregarTudo() {
    const [usuarios, cfgLinhas] = await Promise.all([
      buscarTudo('usuarios'),
      buscarTudo('configuracoes')
    ]);
    const colecoes = await Promise.all(TABELAS_JSON.map(t => buscarTudo(t)));

    const saida = {
      usuarios: (usuarios || []).map(u => ({
        id: u.id, nome: u.nome, email: u.email, cargo: u.cargo || '',
        perfil: u.perfil, ativo: u.ativo
      })),
      config: (cfgLinhas && cfgLinhas[0] && cfgLinhas[0].dados) || null
    };
    TABELAS_JSON.forEach((t, i) => { saida[t] = (colecoes[i] || []).map(paraApp); });
    return saida;
  }

  /* ---------------- escrita ---------------- */
  function paraLinha(item) {
    const dados = Object.assign({}, item);
    delete dados.id;
    return {
      id: item.id,
      responsavel_id: item.responsavelId || null,
      dados: dados
    };
  }

  async function salvar(colecao, item) {
    if (colecao === 'usuarios') return salvarUsuario(item);
    const { error } = await cliente.from(colecao).upsert(paraLinha(item), { onConflict: 'id' });
    if (error) throw new Error(traduzirErroBanco(error, colecao));
  }

  async function excluir(colecao, id) {
    const { error } = await cliente.from(colecao).delete().eq('id', id);
    if (error) throw new Error(traduzirErroBanco(error, colecao));
  }

  async function salvarUsuario(u) {
    const { error } = await cliente.from('usuarios').update({
      nome: u.nome, cargo: u.cargo || '', perfil: u.perfil, ativo: u.ativo !== false
    }).eq('id', u.id);
    if (error) throw new Error(traduzirErroBanco(error, 'usuarios'));
  }

  async function excluirUsuario(id) {
    const { error } = await cliente.from('usuarios').delete().eq('id', id);
    if (error) throw new Error(traduzirErroBanco(error, 'usuarios'));
  }

  async function salvarConfig(cfg) {
    const { error } = await cliente.from('configuracoes')
      .upsert({ id: 1, dados: cfg }, { onConflict: 'id' });
    if (error) throw new Error(traduzirErroBanco(error, 'configuracoes'));
  }

  function traduzirErroBanco(error, colecao) {
    const m = String((error && error.message) || '');
    if (/row-level security|violates row-level/i.test(m)) {
      return 'Seu perfil de acesso não permite esta alteração em "' + colecao + '".';
    }
    if (/JWT|not authenticated|401/i.test(m)) return 'Sua sessão expirou. Entre novamente.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor — a alteração não foi salva.';
    return m;
  }

  /* ---------------- envio da base local para o servidor ---------------- */
  /**
   * Sobe o que está no navegador para o Supabase.
   * `mapaUsuarios` liga o id local (ex.: usr_c1) ao id real de login.
   * Retorna um relatório do que subiu.
   */
  async function migrarParaNuvem(dbLocal, mapaUsuarios, aoProgredir) {
    const relatorio = {};
    const traduzirResp = id => (mapaUsuarios && mapaUsuarios[id]) || null;

    for (const tabela of TABELAS_JSON) {
      const itens = (dbLocal[tabela] || []).map(item => {
        const copia = Object.assign({}, item);
        if (copia.responsavelId) copia.responsavelId = traduzirResp(copia.responsavelId) || null;
        return paraLinha(copia);
      });
      let enviados = 0;
      for (let i = 0; i < itens.length; i += 200) {
        const lote = itens.slice(i, i + 200);
        const { error } = await cliente.from(tabela).upsert(lote, { onConflict: 'id' });
        if (error) throw new Error('Falha ao enviar "' + tabela + '": ' + traduzirErroBanco(error, tabela));
        enviados += lote.length;
        if (aoProgredir) aoProgredir(tabela, enviados, itens.length);
      }
      relatorio[tabela] = enviados;
    }
    if (dbLocal.config) {
      await salvarConfig(dbLocal.config);
      relatorio.config = 1;
    }
    return relatorio;
  }

  /* ---------------- tempo real ---------------- */
  function ouvirMudancas(aoMudar) {
    if (!cliente) return;
    const canal = cliente.channel('crm-firece');
    ['usuarios', 'configuracoes'].concat(TABELAS_JSON).forEach(tabela => {
      canal.on('postgres_changes', { event: '*', schema: 'public', table: tabela }, carga => {
        aoMudar(tabela, carga);
      });
    });
    canal.subscribe();
    return () => cliente.removeChannel(canal);
  }

  function aoEvento(fn) { ouvintes.push(fn); }
  function avisar(evento, dados) { ouvintes.forEach(f => { try { f(evento, dados); } catch (e) { console.error(e); } }); }

  /** Testa url + chave sem gravar nada. */
  async function testarConexao(url, anonKey) {
    const lib = await carregarLib();
    const teste = lib.createClient(url.replace(/\/+$/, ''), anonKey, { auth: { persistSession: false } });
    const { error } = await teste.from('usuarios').select('id').limit(1);
    // sem sessão o RLS devolve vazio, o que é sucesso; erro de tabela/chave, não
    if (error && /relation .* does not exist|schema cache/i.test(error.message)) {
      throw new Error('Conectou no projeto, mas as tabelas não existem. Rode o arquivo supabase/schema.sql no SQL Editor.');
    }
    if (error && /Invalid API key|JWT/i.test(error.message)) throw new Error('Chave anon inválida.');
    if (error && /Failed to fetch/i.test(error.message)) {
      throw new Error('Não foi possível alcançar essa URL. Confira o endereço do projeto — e note que ' +
        'o CRM precisa estar publicado num endereço próprio (Netlify, Vercel, GitHub Pages…): ' +
        'alguns ambientes de pré-visualização bloqueiam chamadas de rede.');
    }
    if (error) throw new Error(error.message);
    return true;
  }

  global.Backend = {
    configurado, config, salvarConfigConexao, limparConfigConexao, testarConexao,
    iniciar, entrar, cadastrar, sair, recuperarSenha, definirNovaSenha,
    sessao, meuPerfil, liberado, carregarPerfil,
    carregarTudo, salvar, excluir, salvarUsuario, excluirUsuario, salvarConfig,
    migrarParaNuvem, ouvirMudancas, aoEvento,
    TABELAS_JSON
  };
})(window);
