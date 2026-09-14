/* =========================================================
   views/config.js — configurações do sistema
   Tudo que o gestor precisa para adaptar o CRM sem tocar no código.
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { aba: 'geral' };

  const ABAS = [
    { id: 'geral', nome: '⚙️ Geral' },
    { id: 'produtos', nome: '📦 Produtos' },
    { id: 'listas', nome: '🏷️ Categorias e listas' },
    { id: 'status', nome: '🚦 Status e etapas' },
    { id: 'comissoes', nome: '🤝 Comissões e pagamentos' },
    { id: 'usuarios', nome: '👤 Usuários e acessos' },
    { id: 'dados', nome: '💾 Backup dos dados' }
  ];

  /* ---------- editor genérico de lista de configuração ---------- */
  function editorLista(chave, titulo, campos, descricao) {
    const itens = Store.configList(chave);
    const pode = Store.podeConfigurar();
    return `<div class="card card--pad0 mb">
      <div class="card__head">
        <div><h3>${titulo}</h3>${descricao ? `<p>${U.esc(descricao)}</p>` : ''}</div>
        ${pode ? `<button class="btn btn--sm btn--ghost" data-add="${chave}">＋ Adicionar</button>` : ''}
      </div>
      <div class="card__body">
        ${itens.length ? `<div class="vstack">${itens.map(it => `
          <div class="spread" style="padding:9px 11px;border:1px solid var(--line);border-radius:10px">
            <div class="hstack" style="min-width:0">
              ${it.cor && String(it.cor).startsWith('#')
                ? `<span class="dot" style="background:${U.esc(it.cor)};width:11px;height:11px;flex-basis:11px"></span>` : ''}
              ${it.emoji ? `<span>${it.emoji}</span>` : ''}
              <div>
                <div class="strong" style="font-size:13px">${U.esc(it.nome)}</div>
                <div class="tiny muted">${campos.filter(c => c.name !== 'nome' && it[c.name] !== undefined && it[c.name] !== '')
                  .map(c => c.label + ': ' + (c.tipo === 'checkbox' ? (it[c.name] ? 'sim' : 'não') : it[c.name])).join(' · ')}</div>
              </div>
            </div>
            ${pode ? `<div class="tbl__actions">
              <button class="icon-btn" data-edit="${chave}|${it.id}" title="Editar">✏️</button>
              <button class="icon-btn" data-del="${chave}|${it.id}" title="Remover">🗑️</button>
            </div>` : ''}
          </div>`).join('')}</div>`
          : `<p class="small muted center">Nenhum item cadastrado.</p>`}
      </div>
    </div>`;
  }

  /* definição dos campos de cada lista configurável */
  const DEFS = {
    categorias: { titulo: '🏷️ Categorias de produto', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'cor', label: 'Cor', tipo: 'color', valorPadrao: '#2563eb' }] },
    tiposProduto: { titulo: '📐 Tipos de produto', campos: [{ name: 'nome', label: 'Nome', obrigatorio: true }] },
    origens: { titulo: '📣 Origens do cadastro', campos: [{ name: 'nome', label: 'Nome', obrigatorio: true }], simples: true },
    formasPagamento: { titulo: '💳 Formas de pagamento', campos: [{ name: 'nome', label: 'Nome', obrigatorio: true }] },
    tiposCobranca: { titulo: '🔄 Tipos de cobrança', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'recorrente', label: 'Recorrente', tipo: 'checkbox' }] },
    periodicidades: { titulo: '📅 Periodicidades', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'meses', label: 'Meses', tipo: 'number', hint: '0 = pagamento único. Usado para calcular a receita mensal.' }] },
    comissoes: { titulo: '🤝 Tabelas de comissão', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'percentual', label: 'Percentual (%)', tipo: 'number' }] },
    statusProduto: { titulo: '📦 Status de produto', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'emoji', label: 'Emoji' },
      { name: 'cor', label: 'Cor', tipo: 'select', opcoes: ['fire', 'green', 'red', 'gold', 'blue', 'purple', 'orange', 'gray', 'ink'] },
      { name: 'ativo', label: 'Conta como ativo', tipo: 'checkbox' },
      { name: 'arquivado', label: 'Arquivado', tipo: 'checkbox' }] },
    etapas: { titulo: '🎯 Etapas do funil', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'emoji', label: 'Emoji' },
      { name: 'cor', label: 'Cor', tipo: 'select', opcoes: ['blue', 'purple', 'orange', 'gold', 'green', 'red', 'fire', 'gray', 'ink'] },
      { name: 'ordem', label: 'Ordem', tipo: 'number' },
      { name: 'aberto', label: 'Conta no pipeline', tipo: 'checkbox' },
      { name: 'ganho', label: 'Gera venda (ganho)', tipo: 'checkbox' },
      { name: 'recebido', label: 'Marca como pago', tipo: 'checkbox' },
      { name: 'perdido', label: 'Perdido / cancelado', tipo: 'checkbox' }] },
    statusVenda: { titulo: '💰 Status de venda', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'emoji', label: 'Emoji' },
      { name: 'cor', label: 'Cor', tipo: 'select', opcoes: ['green', 'red', 'gold', 'blue', 'gray'] },
      { name: 'ativa', label: 'Conta no faturamento', tipo: 'checkbox' },
      { name: 'recebida', label: 'Receita recebida', tipo: 'checkbox' }] },
    prioridades: { titulo: '🔥 Prioridades', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'emoji', label: 'Emoji' },
      { name: 'cor', label: 'Cor', tipo: 'select', opcoes: ['red', 'gold', 'green', 'blue', 'gray'] },
      { name: 'peso', label: 'Peso', tipo: 'number' }] },
    statusTarefa: { titulo: '✅ Status de tarefa', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'cor', label: 'Cor', tipo: 'select', opcoes: ['gray', 'blue', 'green', 'gold', 'red'] },
      { name: 'concluido', label: 'Marca como concluída', tipo: 'checkbox' }] },
    statusCliente: { titulo: '👥 Status de cliente', campos: [
      { name: 'nome', label: 'Nome', obrigatorio: true },
      { name: 'cor', label: 'Cor', tipo: 'select', opcoes: ['green', 'blue', 'gray', 'gold', 'red'] },
      { name: 'ativo', label: 'Conta como cliente ativo', tipo: 'checkbox' }] }
  };

  /* ---------- modal de edição de item de lista ---------- */
  function editarItem(chave, id) {
    if (!Store.podeConfigurar()) return UI.toast('Seu perfil não pode alterar configurações.', 'err');
    const def = DEFS[chave];
    if (!def) return;

    // listas simples (array de strings), como origens
    if (def.simples) {
      const atual = id !== null && id !== undefined ? Store.config[chave][id] : '';
      const form = U.el(`<form class="vstack">${UI.campo({ label: 'Nome', name: 'nome', valor: atual, obrigatorio: true })}</form>`);
      const m = UI.modal({
        titulo: def.titulo, tamanho: 'sm', corpo: form,
        rodape: `<button class="btn btn--soft" data-close>Cancelar</button><button class="btn btn--fire" data-ok>💾 Salvar</button>`
      });
      m.foot.querySelector('[data-ok]').onclick = () => {
        const v = form.elements.nome.value.trim();
        if (!v) return UI.toast('Informe o nome.', 'err');
        const arr = Store.config[chave];
        if (id !== null && id !== undefined) arr[id] = v; else arr.push(v);
        Store.setConfig({ [chave]: arr });
        m.close(); UI.toast('Lista atualizada.', 'ok'); App.render();
      };
      return;
    }

    const item = id ? (Store.configList(chave).find(x => x.id === id) || {}) : {};
    const campos = def.campos.map(c => {
      if (c.tipo === 'checkbox') {
        return `<div class="field"><label>${U.esc(c.label)}</label>
          <label class="switch"><input type="checkbox" name="${c.name}" ${item[c.name] ? 'checked' : ''}><span class="small">Sim</span></label></div>`;
      }
      if (c.tipo === 'color') {
        return `<div class="field"><label>${U.esc(c.label)}</label>
          <input class="input" type="color" name="${c.name}" value="${U.esc(item[c.name] || c.valorPadrao || '#2563eb')}" style="height:38px;padding:3px"></div>`;
      }
      if (c.tipo === 'select') {
        return UI.campo({
          label: c.label, name: c.name, tipo: 'select',
          opcoes: c.opcoes.map(o => `<option value="${o}" ${item[c.name] === o ? 'selected' : ''}>${o}</option>`).join('')
        });
      }
      return UI.campo({ label: c.label, name: c.name, tipo: c.tipo || 'text', valor: item[c.name], obrigatorio: c.obrigatorio, hint: c.hint });
    }).join('');

    const form = U.el(`<form class="formgrid">${campos}</form>`);
    const m = UI.modal({
      titulo: (id ? 'Editar' : 'Adicionar') + ' — ' + def.titulo, tamanho: 'sm', corpo: form,
      rodape: `<button class="btn btn--soft" data-close>Cancelar</button><button class="btn btn--fire" data-ok>💾 Salvar</button>`
    });
    m.foot.querySelector('[data-ok]').onclick = () => {
      const f = UI.lerForm(form);
      if (!String(f.nome || '').trim()) return UI.toast('Informe o nome.', 'err');
      def.campos.forEach(c => { if (c.tipo === 'number') f[c.name] = Number(f[c.name]) || 0; });
      if (id) f.id = id;
      Store.configUpsert(chave, f);
      m.close(); UI.toast('Configuração salva.', 'ok'); App.render();
    };
  }

  /* ---------- abas ---------- */
  function abaGeral() {
    const c = Store.config;
    const pode = Store.podeConfigurar();
    return `<div class="card card--pad0 mb">
      <div class="card__head"><h3>⚙️ Dados gerais</h3><p>Identificação da empresa e metas do período</p></div>
      <div class="card__body">
        <form class="formgrid" id="formGeral">
          ${UI.campo({ label: 'Nome da empresa', name: 'empresa', valor: c.empresa })}
          ${UI.campo({ label: 'Nome do gestor', name: 'gestor', valor: c.gestor })}
          ${UI.campo({ label: 'Meta de faturamento mensal (R$)', name: 'metaFaturamentoMensal', tipo: 'number', valor: c.metaFaturamentoMensal, attrs: 'step="100" min="0"' })}
          ${UI.campo({ label: 'Meta de vendas no mês', name: 'metaVendasMensal', tipo: 'number', valor: c.metaVendasMensal, attrs: 'step="1" min="0"' })}
          ${UI.campo({ label: 'Domínio base dos links de cadastro', name: 'baseLinks', valor: c.baseLinks, full: true, hint: 'Usado ao gerar automaticamente os links dos produtos.' })}
        </form>
        ${pode ? `<button class="btn btn--fire mt" data-salvar-geral>💾 Salvar configurações</button>`
               : `<div class="notice mt">🔒 Seu perfil não permite alterar as configurações.</div>`}
      </div>
    </div>`;
  }

  function abaProdutos() {
    const produtos = Store.list('produtos');
    const pode = Store.podeEditar();
    return `
      <div class="notice mb">💡 Aqui o responsável cria e mantém o catálogo — nenhum ajuste de código é necessário para lançar um produto novo.</div>
      <div class="card card--pad0 mb">
        <div class="card__head">
          <div><h3>📦 Produtos cadastrados</h3><p>${produtos.length} produto(s)</p></div>
          ${pode ? `<button class="btn btn--sm btn--fire" data-novo-produto>＋ Adicionar Produto</button>` : ''}
        </div>
        <div class="card__body">
          ${produtos.length ? `<div class="vstack">${produtos.map(p => `
            <div class="spread" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px">
              <div style="min-width:0">
                <div class="strong" style="font-size:13.5px">${U.esc(p.nome)}</div>
                <div class="tiny muted">${U.esc(p.sku)} · ${U.money(p.preco)} · ${U.esc((Store.L.categoria(p.categoriaId) || {}).nome || '')}</div>
              </div>
              <div class="hstack" style="flex-wrap:nowrap">
                ${UI.badge(Store.L.statusProduto(p.statusId))}
                ${pode ? `<div class="tbl__actions">
                  <button class="icon-btn" data-p-edit="${p.id}" title="Editar">✏️</button>
                  <button class="icon-btn" data-p-dup="${p.id}" title="Duplicar">⧉</button>
                  <button class="icon-btn" data-p-arq="${p.id}" title="Arquivar">⚪</button>
                  <button class="icon-btn" data-p-del="${p.id}" title="Excluir">🗑️</button>
                </div>` : ''}
              </div>
            </div>`).join('')}</div>` : `<p class="small muted center">Nenhum produto cadastrado.</p>`}
        </div>
      </div>`;
  }

  function abaUsuarios() {
    const pode = Store.podeConfigurar('usuarios');
    const usuarios = Store.list('usuarios');
    const atual = Store.currentUser() || {};
    return `
      <div class="card card--pad0 mb">
        <div class="card__head">
          <div><h3>👤 Usuários</h3><p>Perfis definem o que cada pessoa enxerga e pode editar</p></div>
          ${pode ? `<button class="btn btn--sm btn--fire" data-novo-usuario>＋ Novo Usuário</button>` : ''}
        </div>
        <div class="card__body">
          <div class="vstack">
            ${usuarios.map(u => `
              <div class="spread" style="padding:10px 12px;border:1px solid var(--line);border-radius:10px;
                ${u.id === atual.id ? 'border-color:var(--ink-500);background:var(--surface-2)' : ''}">
                <div class="hstack" style="min-width:0">
                  ${UI.avatar(u.nome, 34)}
                  <div>
                    <div class="strong" style="font-size:13.5px">${U.esc(u.nome)}
                      ${u.id === atual.id ? '<span class="badge badge--ink">você</span>' : ''}</div>
                    <div class="tiny muted">${U.esc(u.email)}${u.cargo ? ' · ' + U.esc(u.cargo) : ''}</div>
                  </div>
                </div>
                <div class="hstack" style="flex-wrap:nowrap">
                  <span class="badge badge--${u.perfil === 'admin' ? 'gold' : u.perfil === 'gestor' ? 'blue' : u.perfil === 'consultor' ? 'green' : 'gray'}">
                    ${U.esc((Store.PERFIS[u.perfil] || {}).nome || u.perfil)}</span>
                  ${u.ativo === false ? '<span class="badge badge--red">inativo</span>' : ''}
                  ${pode ? `<div class="tbl__actions">
                    <button class="icon-btn" data-u-edit="${u.id}" title="Editar">✏️</button>
                    ${u.id !== atual.id ? `<button class="icon-btn" data-u-del="${u.id}" title="Excluir">🗑️</button>` : ''}
                  </div>` : ''}
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>

      <div class="card card--pad0">
        <div class="card__head"><h3>🔐 O que cada perfil acessa</h3></div>
        <div class="card__body"><div class="vstack">
          ${Object.keys(Store.PERFIS).map(k => {
            const p = Store.PERFIS[k];
            return `<div style="padding:11px 13px;border:1px solid var(--line);border-radius:10px">
              <div class="strong" style="font-size:13.5px">${U.esc(p.nome)}</div>
              <div class="tiny muted mt-sm">${U.esc(p.desc)}</div>
              <div class="tiny muted mt-sm">${p.permite === '*' ? 'Todas as áreas do sistema.'
                : 'Áreas: ' + p.permite.join(', ') + '.'}${p.somenteLeitura ? ' Somente leitura.' : ''}${p.proprios ? ' Vê apenas os próprios registros.' : ''}</div>
            </div>`;
          }).join('')}
        </div></div>
      </div>`;
  }

  function abaDados() {
    const db = Store.db;
    const contagens = Store.COLLECTIONS.map(c => `<div><dt>${c}</dt><dd>${U.num((db[c] || []).length)}</dd></div>`).join('');
    const pode = Store.podeEditar();
    return `
      <div class="card card--pad0 mb">
        <div class="card__head"><h3>💾 Dados armazenados</h3>
          <p>Tudo fica salvo no navegador deste dispositivo (localStorage)</p></div>
        <div class="card__body">
          <dl class="deflist mb">${contagens}</dl>
          <div class="notice mb">ℹ️ Os dados <b>não</b> são enviados para nenhum servidor. Para usar em outro computador, exporte o backup aqui e importe lá.</div>
          <div class="hstack">
            <button class="btn btn--ghost" data-backup>📥 Exportar backup (JSON)</button>
            ${pode ? `<button class="btn btn--ghost" data-restaurar>📤 Importar backup</button>` : ''}
            <input type="file" id="arquivoBackup" accept="application/json,.json" hidden>
          </div>
        </div>
      </div>

      ${pode ? `<div class="card card--pad0">
        <div class="card__head"><h3>⚠️ Zona de risco</h3></div>
        <div class="card__body">
          <p class="small muted mb">Estas ações apagam informações e não podem ser desfeitas.</p>
          <div class="hstack">
            <button class="btn btn--ghost" data-resetar-demo>🔄 Recarregar dados de demonstração</button>
            <button class="btn btn--red" data-limpar>🗑️ Começar do zero (apagar tudo)</button>
          </div>
        </div>
      </div>` : ''}`;
  }

  Views.config = {
    titulo: '⚙️ Configurações',
    subtitulo: 'Adapte o CRM à sua operação sem alterar o código',

    render() {
      const abasVisiveis = ABAS.filter(a => a.id !== 'usuarios' || Store.podeConfigurar('usuarios') || Store.perfil().permite === '*');
      let conteudo = '';

      switch (estado.aba) {
        case 'geral': conteudo = abaGeral(); break;
        case 'produtos': conteudo = abaProdutos(); break;
        case 'listas':
          conteudo = editorLista('categorias', DEFS.categorias.titulo, DEFS.categorias.campos, 'Agrupam os produtos nos relatórios e gráficos.')
            + editorLista('tiposProduto', DEFS.tiposProduto.titulo, DEFS.tiposProduto.campos)
            + editorLista('origens', DEFS.origens.titulo, DEFS.origens.campos, 'De onde vêm os cadastros.');
          break;
        case 'status':
          conteudo = editorLista('etapas', DEFS.etapas.titulo, DEFS.etapas.campos,
            'As colunas do funil. Marque "Gera venda" para que a etapa registre o faturamento automaticamente.')
            + editorLista('statusProduto', DEFS.statusProduto.titulo, DEFS.statusProduto.campos)
            + editorLista('statusVenda', DEFS.statusVenda.titulo, DEFS.statusVenda.campos)
            + editorLista('prioridades', DEFS.prioridades.titulo, DEFS.prioridades.campos)
            + editorLista('statusTarefa', DEFS.statusTarefa.titulo, DEFS.statusTarefa.campos)
            + editorLista('statusCliente', DEFS.statusCliente.titulo, DEFS.statusCliente.campos);
          break;
        case 'comissoes':
          conteudo = editorLista('comissoes', DEFS.comissoes.titulo, DEFS.comissoes.campos, 'Tabelas aplicáveis às vendas.')
            + editorLista('formasPagamento', DEFS.formasPagamento.titulo, DEFS.formasPagamento.campos)
            + editorLista('tiposCobranca', DEFS.tiposCobranca.titulo, DEFS.tiposCobranca.campos)
            + editorLista('periodicidades', DEFS.periodicidades.titulo, DEFS.periodicidades.campos,
              'O campo "meses" define a receita mensal equivalente na carteira.');
          break;
        case 'usuarios': conteudo = abaUsuarios(); break;
        case 'dados': conteudo = abaDados(); break;
      }

      return `
        <div class="chips chips--scroll mb" data-abas>
          ${abasVisiveis.map(a => `<button class="chip ${a.id === estado.aba ? 'is-active' : ''}" data-aba="${a.id}">${a.nome}</button>`).join('')}
        </div>
        ${conteudo}`;
    },

    mount(el) {
      el.querySelectorAll('[data-aba]').forEach(b =>
        b.onclick = () => { estado.aba = b.getAttribute('data-aba'); App.render(); });

      /* geral */
      const salvarGeral = el.querySelector('[data-salvar-geral]');
      if (salvarGeral) salvarGeral.onclick = () => {
        const f = UI.lerForm(el.querySelector('#formGeral'));
        f.metaFaturamentoMensal = U.parseMoney(f.metaFaturamentoMensal);
        f.metaVendasMensal = Number(f.metaVendasMensal) || 0;
        Store.setConfig(f);
        UI.toast('Configurações salvas.', 'ok');
        App.render();
      };

      /* listas */
      el.querySelectorAll('[data-add]').forEach(b =>
        b.onclick = () => editarItem(b.getAttribute('data-add'), null));
      el.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
        const [chave, id] = b.getAttribute('data-edit').split('|');
        editarItem(chave, DEFS[chave] && DEFS[chave].simples ? Number(id) : id);
      });
      el.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
        const [chave, id] = b.getAttribute('data-del').split('|');
        const simples = DEFS[chave] && DEFS[chave].simples;
        const nome = simples ? Store.config[chave][Number(id)] : (Store.configList(chave).find(x => x.id === id) || {}).nome;
        const ok = await UI.confirmar({
          titulo: 'Remover item', perigo: true, confirmar: 'Remover',
          mensagem: `Remover <b>${U.esc(nome || '')}</b> da lista?<br><span class="muted">Registros que já usam este item mantêm o valor salvo, mas ele deixa de aparecer nas opções.</span>`
        });
        if (!ok) return;
        if (simples) {
          const arr = Store.config[chave].slice();
          arr.splice(Number(id), 1);
          Store.setConfig({ [chave]: arr });
        } else {
          Store.configRemove(chave, id);
        }
        UI.toast('Item removido.', 'ok');
        App.render();
      });

      /* produtos */
      const np = el.querySelector('[data-novo-produto]');
      if (np) np.onclick = () => Forms.produto();
      el.querySelectorAll('[data-p-edit]').forEach(b => b.onclick = () => Forms.produto(b.getAttribute('data-p-edit')));
      el.querySelectorAll('[data-p-dup]').forEach(b => b.onclick = () => {
        const p = Store.get('produtos', b.getAttribute('data-p-dup'));
        const c = Object.assign({}, p);
        delete c.id; delete c.criadoEm;
        c.nome = p.nome + ' (cópia)'; c.sku = p.sku + '-2'; c.dataCriacao = U.today();
        Store.upsert('produtos', c);
        UI.toast('Produto duplicado.', 'ok'); App.render();
      });
      el.querySelectorAll('[data-p-arq]').forEach(b => b.onclick = () => {
        const arq = Store.config.statusProduto.find(s => s.arquivado);
        if (!arq) return UI.toast('Crie um status "arquivado" em Status e etapas.', 'warn');
        Store.upsert('produtos', { id: b.getAttribute('data-p-arq'), statusId: arq.id });
        UI.toast('Produto arquivado.', 'ok'); App.render();
      });
      el.querySelectorAll('[data-p-del]').forEach(b => b.onclick = () => {
        const p = Store.get('produtos', b.getAttribute('data-p-del'));
        Forms.excluir('produtos', p.id, p.nome);
      });

      /* usuários */
      const nu = el.querySelector('[data-novo-usuario]');
      if (nu) nu.onclick = () => Forms.usuario();
      el.querySelectorAll('[data-u-edit]').forEach(b => b.onclick = () => Forms.usuario(b.getAttribute('data-u-edit')));
      el.querySelectorAll('[data-u-del]').forEach(b => b.onclick = () => {
        const u = Store.get('usuarios', b.getAttribute('data-u-del'));
        Forms.excluir('usuarios', u.id, u.nome);
      });

      /* backup */
      const bk = el.querySelector('[data-backup]');
      if (bk) bk.onclick = () => {
        U.download('crm-produtos-backup-' + U.today() + '.json', Store.exportJSON(), 'application/json');
        UI.toast('Backup exportado.', 'ok');
      };
      const rest = el.querySelector('[data-restaurar]');
      const arquivo = el.querySelector('#arquivoBackup');
      if (rest && arquivo) {
        rest.onclick = () => arquivo.click();
        arquivo.onchange = () => {
          const file = arquivo.files && arquivo.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async () => {
            const ok = await UI.confirmar({
              titulo: 'Importar backup', perigo: true, confirmar: 'Substituir dados',
              mensagem: 'Todos os dados atuais serão <b>substituídos</b> pelo conteúdo do arquivo. Continuar?'
            });
            if (!ok) { arquivo.value = ''; return; }
            try {
              Store.importJSON(String(reader.result));
              UI.toast('Backup importado com sucesso.', 'ok');
              App.render(); App.montarNav();
            } catch (e) {
              UI.toast('Não foi possível importar: ' + e.message, 'err', 5000);
            }
            arquivo.value = '';
          };
          reader.readAsText(file);
        };
      }

      const demo = el.querySelector('[data-resetar-demo]');
      if (demo) demo.onclick = async () => {
        const ok = await UI.confirmar({
          titulo: 'Recarregar demonstração', perigo: true, confirmar: 'Recarregar',
          mensagem: 'Os dados atuais serão apagados e substituídos pelos dados fictícios de demonstração. Continuar?'
        });
        if (!ok) return;
        Store.reset(true);
        UI.toast('Dados de demonstração recarregados.', 'ok');
        App.render(); App.montarNav();
      };

      const limpar = el.querySelector('[data-limpar]');
      if (limpar) limpar.onclick = async () => {
        const ok = await UI.confirmar({
          titulo: 'Apagar todos os dados', perigo: true, confirmar: 'Apagar tudo',
          mensagem: 'Produtos, clientes, cadastros, vendas e tarefas serão <b>apagados</b>, deixando o sistema pronto para os dados reais.<br><span class="muted">Faça um backup antes se quiser guardar o que existe hoje.</span>'
        });
        if (!ok) return;
        Store.reset(false);
        Store.upsert('usuarios', {
          id: 'usr_admin', nome: Store.config.gestor || 'Gestor',
          email: 'gestor@empresa.com.br', perfil: 'admin', cargo: 'Responsável de Produtos', ativo: true
        }, { silent: true });
        Store.setUser('usr_admin');
        UI.toast('Sistema zerado. Cadastre seu primeiro produto!', 'ok', 4500);
        App.go('produtos'); App.montarNav();
      };
    }
  };
})(window);
