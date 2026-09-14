/* =========================================================
   views/tarefas.js — controle de tarefas
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { busca: '', status: '', responsavel: '', prioridade: '', agrupar: 'prazo' };

  function filtrar() {
    let arr = Store.scope(Store.list('tarefas'));
    const q = U.norm(estado.busca);
    if (q) arr = arr.filter(t => U.norm(t.titulo).indexOf(q) > -1 ||
      U.norm(Store.L.nomeCliente(t.clienteId)).indexOf(q) > -1);
    if (estado.status) arr = arr.filter(t => t.statusId === estado.status);
    if (estado.responsavel) arr = arr.filter(t => t.responsavelId === estado.responsavel);
    if (estado.prioridade) arr = arr.filter(t => t.prioridadeId === estado.prioridade);
    return U.sortBy(arr, t => t.prazo || '9999', 'asc');
  }

  function tarefaHTML(t) {
    const st = Store.L.statusTarefa(t.statusId) || {};
    const prio = Store.L.prioridade(t.prioridadeId) || {};
    const hoje = U.today();
    const atrasada = !st.concluido && t.prazo && t.prazo < hoje;
    const eHoje = !st.concluido && t.prazo === hoje;
    const pode = Store.podeEditar();
    return `<div class="task ${st.concluido ? 'is-done' : ''} ${atrasada ? 'task--late' : eHoje ? 'task--today' : ''}" data-t="${t.id}">
      <button class="task__check ${st.concluido ? 'is-on' : ''}" data-check="${t.id}"
        aria-label="${st.concluido ? 'Reabrir tarefa' : 'Concluir tarefa'}">${st.concluido ? '✓' : ''}</button>
      <div class="task__body">
        <div class="task__title">${U.esc(t.titulo)}</div>
        <div class="task__meta">
          <span>${atrasada ? '🔴' : eHoje ? '🟡' : '📅'} ${U.fmtDate(t.prazo)}${t.prazo ? ' · ' + U.relative(t.prazo) : ''}</span>
          ${t.clienteId ? `<span>👥 ${U.esc(Store.L.nomeCliente(t.clienteId))}</span>` : ''}
          ${t.produtoId ? `<span>📦 ${U.esc(Store.L.nomeProduto(t.produtoId))}</span>` : ''}
          <span>👤 ${U.esc(Store.L.nomeUsuario(t.responsavelId))}</span>
          ${UI.badge(prio)}
          <span class="badge badge--${st.cor || 'gray'}">${U.esc(st.nome || '')}</span>
        </div>
      </div>
      ${pode ? `<div class="tbl__actions">
        <button class="icon-btn" data-editar="${t.id}" title="Editar">✏️</button>
        <button class="icon-btn" data-excluir="${t.id}" title="Excluir">🗑️</button>
      </div>` : ''}
    </div>`;
  }

  Views.tarefas = {
    titulo: '✅ Tarefas',
    subtitulo: 'Acompanhamento de atividades por cliente e produto',

    render() {
      const res = M.resumoTarefas();
      const itens = filtrar();
      const pode = Store.podeEditar();
      const hoje = U.today();

      const grupos = estado.agrupar === 'prazo' ? [
        { titulo: '🔴 Atrasadas', itens: itens.filter(t => !(Store.L.statusTarefa(t.statusId) || {}).concluido && t.prazo && t.prazo < hoje) },
        { titulo: '🟡 Hoje', itens: itens.filter(t => !(Store.L.statusTarefa(t.statusId) || {}).concluido && t.prazo === hoje) },
        { titulo: '📅 Próximas', itens: itens.filter(t => !(Store.L.statusTarefa(t.statusId) || {}).concluido && (!t.prazo || t.prazo > hoje)) },
        { titulo: '✅ Concluídas', itens: itens.filter(t => (Store.L.statusTarefa(t.statusId) || {}).concluido) }
      ] : Store.config.statusTarefa.map(s => ({
        titulo: s.nome, itens: itens.filter(t => t.statusId === s.id)
      }));

      return `
      <div class="grid grid--4 mb">
        ${UI.kpi({ icone: '🔴', titulo: 'Tarefas atrasadas', valor: U.num(res.atrasadas.length), cor: 'red' })}
        ${UI.kpi({ icone: '🟡', titulo: 'Tarefas de hoje', valor: U.num(res.hoje.length), cor: 'gold' })}
        ${UI.kpi({ icone: '📅', titulo: 'Próximas tarefas', valor: U.num(res.proximas.length), cor: 'blue' })}
        ${UI.kpi({ icone: '✅', titulo: 'Concluídas', valor: U.num(res.concluidas), cor: 'green', sub: U.pct(res.total ? (res.concluidas / res.total) * 100 : 0) + ' do total' })}
      </div>

      <div class="card mb">
        <div class="toolbar" style="margin:0">
          <div class="searchbar"><input class="input input--sm" id="busca" placeholder="Buscar tarefa ou cliente…" value="${U.esc(estado.busca)}"></div>
          <select class="input input--sm" id="fStatus" style="max-width:170px">${UI.opcoes(Store.config.statusTarefa, estado.status, { vazio: 'Todos os status' })}</select>
          <select class="input input--sm" id="fResp" style="max-width:190px">${UI.opcoes(Store.list('usuarios'), estado.responsavel, { vazio: 'Todos responsáveis' })}</select>
          <select class="input input--sm" id="fPrio" style="max-width:160px">${UI.opcoes(Store.config.prioridades, estado.prioridade, { vazio: 'Todas prioridades' })}</select>
          <select class="input input--sm" id="fGrupo" style="max-width:170px">
            <option value="prazo" ${estado.agrupar === 'prazo' ? 'selected' : ''}>Agrupar por prazo</option>
            <option value="status" ${estado.agrupar === 'status' ? 'selected' : ''}>Agrupar por status</option>
          </select>
          ${pode ? `<button class="btn btn--sm btn--gold" data-nova style="margin-left:auto">＋ Nova Tarefa</button>` : ''}
        </div>
      </div>

      ${grupos.filter(g => g.itens.length).map(g => `
        <section class="section">
          <div class="section__title"><h2>${g.titulo} <span class="badge badge--gray">${g.itens.length}</span></h2></div>
          <div class="vstack">${g.itens.map(tarefaHTML).join('')}</div>
        </section>`).join('') ||
        UI.vazio({
          icone: '✅', titulo: 'Nenhuma tarefa encontrada',
          texto: 'Crie tarefas para acompanhar propostas, follow-ups e renovações.',
          acao: pode ? `<button class="btn btn--gold" data-nova>＋ Nova Tarefa</button>` : ''
        })}`;
    },

    mount(el) {
      const busca = el.querySelector('#busca');
      if (busca) busca.oninput = U.debounce(e => {
        estado.busca = e.target.value; App.render();
        const b = document.getElementById('busca');
        if (b) { b.focus(); b.setSelectionRange(b.value.length, b.value.length); }
      }, 260);
      const bind = (id, prop) => { const s = el.querySelector(id); if (s) s.onchange = e => { estado[prop] = e.target.value; App.render(); }; };
      bind('#fStatus', 'status'); bind('#fResp', 'responsavel'); bind('#fPrio', 'prioridade'); bind('#fGrupo', 'agrupar');

      el.querySelectorAll('[data-nova]').forEach(b => b.onclick = () => Forms.tarefa());
      el.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => Forms.tarefa(b.getAttribute('data-editar')));
      el.querySelectorAll('[data-excluir]').forEach(b => b.onclick = () => {
        const t = Store.get('tarefas', b.getAttribute('data-excluir'));
        Forms.excluir('tarefas', t.id, t.titulo);
      });
      el.querySelectorAll('[data-check]').forEach(b => b.onclick = () => {
        if (!Store.podeEditar()) return UI.toast('Seu perfil é somente leitura.', 'err');
        const t = Store.get('tarefas', b.getAttribute('data-check'));
        const concluido = Store.config.statusTarefa.find(s => s.concluido);
        const aberto = Store.config.statusTarefa.find(s => !s.concluido);
        const estaConcluida = (Store.L.statusTarefa(t.statusId) || {}).concluido;
        Store.upsert('tarefas', { id: t.id, statusId: estaConcluida ? aberto.id : concluido.id });
        UI.toast(estaConcluida ? 'Tarefa reaberta.' : 'Tarefa concluída! ✅', 'ok');
        App.render();
      });
    }
  };
})(window);
