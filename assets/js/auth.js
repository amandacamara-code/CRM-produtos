/* =========================================================
   auth.js — tela de login, cadastro e liberação de acesso
   ========================================================= */
(function (global) {
  'use strict';

  const MARCA = `<svg viewBox="0 0 560 560" class="login__mark" aria-hidden="true">
    <path d="M524 52 C514 138 488 190 452 210 C432 222 408 228 386 230 L250 238 C210 243 184 264 172 298
      L68 494 C60 513 46 521 40 515 C35 510 35 503 38 494 L106 248 C112 214 119 194 133 182
      C154 164 190 150 236 138 Z"/>
    <path d="M241 398 C226 398 222 388 235 383 L454 286 C469 280 478 289 473 303 L453 359
      C445 382 429 398 406 398 Z"/></svg>`;

  let raiz = null;

  function tela(conteudo) {
    if (!raiz) {
      raiz = U.el('<div class="login"></div>');
      document.body.appendChild(raiz);
    }
    document.getElementById('app').hidden = true;
    raiz.hidden = false;
    raiz.innerHTML = `<div class="login__cartao">
      <div class="login__marca">${MARCA}
        <div><strong>FIRECE</strong><small>CRM de Produtos</small></div>
      </div>
      ${conteudo}
    </div>`;
    return raiz;
  }

  function fechar() {
    if (raiz) { raiz.hidden = true; raiz.innerHTML = ''; }
    document.getElementById('app').hidden = false;
  }

  function erro(el, msg) {
    const alvo = el.querySelector('[data-erro]');
    if (!alvo) return;
    alvo.textContent = msg || '';
    alvo.hidden = !msg;
  }

  function ocupado(botao, sim, textoOcupado) {
    botao.disabled = sim;
    if (sim) {
      botao.dataset.textoOriginal = botao.textContent;
      botao.textContent = textoOcupado || 'Aguarde…';
    } else if (botao.dataset.textoOriginal) {
      botao.textContent = botao.dataset.textoOriginal;
    }
  }

  /* ---------------- entrar ---------------- */
  function entrar(aoEntrar) {
    const el = tela(`
      <h1>Entrar</h1>
      <p class="login__sub">Acesse com o e-mail da sua conta.</p>
      <form class="vstack" id="formEntrar" novalidate>
        <div class="field"><label for="lgEmail">E-mail</label>
          <input class="input" type="email" id="lgEmail" autocomplete="username" required></div>
        <div class="field"><label for="lgSenha">Senha</label>
          <input class="input" type="password" id="lgSenha" autocomplete="current-password" required></div>
        <p class="error-msg" data-erro hidden></p>
        <button class="btn btn--fire btn--block" type="submit">Entrar</button>
      </form>
      <div class="login__rodape">
        <button class="linkbtn" data-esqueci>Esqueci minha senha</button>
        <span>·</span>
        <button class="linkbtn" data-criar>Criar conta</button>
      </div>`);

    const form = el.querySelector('#formEntrar');
    form.onsubmit = async e => {
      e.preventDefault();
      const botao = form.querySelector('button[type=submit]');
      const email = form.querySelector('#lgEmail').value;
      const senha = form.querySelector('#lgSenha').value;
      if (!U.isEmail(email)) return erro(el, 'Informe um e-mail válido.');
      if (!senha) return erro(el, 'Informe a senha.');
      erro(el, '');
      ocupado(botao, true, 'Entrando…');
      try {
        await Backend.entrar(email, senha);
        fechar();
        aoEntrar();
      } catch (ex) {
        erro(el, ex.message);
        ocupado(botao, false);
      }
    };
    el.querySelector('[data-esqueci]').onclick = () => esqueci(aoEntrar);
    el.querySelector('[data-criar]').onclick = () => criarConta(aoEntrar);
  }

  /* ---------------- criar conta ---------------- */
  function criarConta(aoEntrar) {
    const el = tela(`
      <h1>Criar conta</h1>
      <p class="login__sub">A primeira conta criada vira a administradora.
        As seguintes entram bloqueadas, até um administrador liberar.</p>
      <form class="vstack" id="formCriar" novalidate>
        <div class="field"><label for="cdNome">Nome completo</label>
          <input class="input" id="cdNome" autocomplete="name" required></div>
        <div class="field"><label for="cdEmail">E-mail</label>
          <input class="input" type="email" id="cdEmail" autocomplete="username" required></div>
        <div class="field"><label for="cdSenha">Senha</label>
          <input class="input" type="password" id="cdSenha" autocomplete="new-password" required>
          <span class="field__hint">Pelo menos 6 caracteres.</span></div>
        <p class="error-msg" data-erro hidden></p>
        <button class="btn btn--fire btn--block" type="submit">Criar conta</button>
      </form>
      <div class="login__rodape"><button class="linkbtn" data-voltar>← Já tenho conta</button></div>`);

    const form = el.querySelector('#formCriar');
    form.onsubmit = async e => {
      e.preventDefault();
      const botao = form.querySelector('button[type=submit]');
      const nome = form.querySelector('#cdNome').value.trim();
      const email = form.querySelector('#cdEmail').value;
      const senha = form.querySelector('#cdSenha').value;
      if (nome.length < 3) return erro(el, 'Informe seu nome completo.');
      if (!U.isEmail(email)) return erro(el, 'Informe um e-mail válido.');
      if (senha.length < 6) return erro(el, 'A senha precisa ter pelo menos 6 caracteres.');
      erro(el, '');
      ocupado(botao, true, 'Criando…');
      try {
        const r = await Backend.cadastrar(nome, email, senha);
        if (r.confirmarEmail) return aviso('📧 Confirme seu e-mail',
          'Enviamos um link de confirmação para <b>' + U.esc(email) + '</b>. Abra o link e depois volte aqui para entrar.',
          () => entrar(aoEntrar));
        fechar();
        aoEntrar();
      } catch (ex) {
        erro(el, ex.message);
        ocupado(botao, false);
      }
    };
    el.querySelector('[data-voltar]').onclick = () => entrar(aoEntrar);
  }

  /* ---------------- esqueci a senha ---------------- */
  function esqueci(aoEntrar) {
    const el = tela(`
      <h1>Recuperar senha</h1>
      <p class="login__sub">Enviaremos um link para você definir uma senha nova.</p>
      <form class="vstack" id="formEsq" novalidate>
        <div class="field"><label for="esEmail">E-mail</label>
          <input class="input" type="email" id="esEmail" autocomplete="username" required></div>
        <p class="error-msg" data-erro hidden></p>
        <button class="btn btn--fire btn--block" type="submit">Enviar link</button>
      </form>
      <div class="login__rodape"><button class="linkbtn" data-voltar>← Voltar</button></div>`);

    const form = el.querySelector('#formEsq');
    form.onsubmit = async e => {
      e.preventDefault();
      const botao = form.querySelector('button[type=submit]');
      const email = form.querySelector('#esEmail').value;
      if (!U.isEmail(email)) return erro(el, 'Informe um e-mail válido.');
      erro(el, '');
      ocupado(botao, true, 'Enviando…');
      try {
        await Backend.recuperarSenha(email);
        aviso('📧 Link enviado',
          'Se existir uma conta com <b>' + U.esc(email) + '</b>, o link de recuperação chegou na caixa de entrada.',
          () => entrar(aoEntrar));
      } catch (ex) { erro(el, ex.message); ocupado(botao, false); }
    };
    el.querySelector('[data-voltar]').onclick = () => entrar(aoEntrar);
  }

  /* ---------------- definir nova senha (volta do e-mail) ---------------- */
  function novaSenha(aoEntrar) {
    const el = tela(`
      <h1>Definir nova senha</h1>
      <p class="login__sub">Escolha a senha que passará a valer para sua conta.</p>
      <form class="vstack" id="formNova" novalidate>
        <div class="field"><label for="nsSenha">Nova senha</label>
          <input class="input" type="password" id="nsSenha" autocomplete="new-password" required></div>
        <p class="error-msg" data-erro hidden></p>
        <button class="btn btn--fire btn--block" type="submit">Salvar senha</button>
      </form>`);
    const form = el.querySelector('#formNova');
    form.onsubmit = async e => {
      e.preventDefault();
      const botao = form.querySelector('button[type=submit]');
      const senha = form.querySelector('#nsSenha').value;
      if (senha.length < 6) return erro(el, 'A senha precisa ter pelo menos 6 caracteres.');
      erro(el, '');
      ocupado(botao, true, 'Salvando…');
      try {
        await Backend.definirNovaSenha(senha);
        history.replaceState(null, '', location.pathname + location.search);
        fechar();
        aoEntrar();
      } catch (ex) { erro(el, ex.message); ocupado(botao, false); }
    };
  }

  /* ---------------- acesso ainda não liberado ---------------- */
  function aguardandoLiberacao(perfil, aoSair) {
    const el = tela(`
      <h1>Acesso aguardando liberação</h1>
      <p class="login__sub">Sua conta foi criada, <b>${U.esc((perfil && perfil.nome) || '')}</b>,
        mas ainda precisa ser liberada por um administrador.</p>
      <div class="notice notice--warn">Peça a quem administra o CRM para abrir
        <b>Configurações → Usuários</b>, marcar sua conta como ativa e escolher seu perfil de acesso.</div>
      <div class="login__rodape mt">
        <button class="linkbtn" data-recarregar>Já liberaram — verificar de novo</button>
        <span>·</span>
        <button class="linkbtn" data-sair>Sair</button>
      </div>`);
    el.querySelector('[data-recarregar]').onclick = () => location.reload();
    el.querySelector('[data-sair]').onclick = async () => { await Backend.sair(); aoSair(); };
  }

  /* ---------------- mensagens e erros ---------------- */
  function aviso(titulo, html, aoFechar) {
    const el = tela(`<h1>${titulo}</h1><p class="login__sub">${html}</p>
      <button class="btn btn--fire btn--block mt" data-ok>Entendi</button>`);
    el.querySelector('[data-ok]').onclick = aoFechar;
  }

  function falhaConexao(msg, aoTentar) {
    const el = tela(`
      <h1>Não foi possível conectar</h1>
      <p class="login__sub">${U.esc(msg)}</p>
      <div class="vstack mt">
        <button class="btn btn--fire btn--block" data-tentar>Tentar de novo</button>
        <button class="btn btn--ghost btn--block" data-local>Usar sem conexão (dados só neste aparelho)</button>
      </div>`);
    el.querySelector('[data-tentar]').onclick = () => location.reload();
    el.querySelector('[data-local]').onclick = () => { fechar(); aoTentar(); };
  }

  function carregando(texto) {
    tela(`<h1>${U.esc(texto || 'Carregando…')}</h1>
      <p class="login__sub">Buscando seus dados no servidor.</p>
      <div class="login__barra"><span></span></div>`);
  }

  global.Auth = { entrar, criarConta, esqueci, novaSenha, aguardandoLiberacao, falhaConexao, carregando, fechar, aviso };
})(window);
