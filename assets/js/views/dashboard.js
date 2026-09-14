/* =========================================================
   views/dashboard.js — visão executiva
   ========================================================= */
(function (global) {
  'use strict';
  const Views = global.Views = global.Views || {};

  const estado = { periodo: '12m', granularidade: 'mes', custom: null };

  function rangeAtual() {
    return estado.periodo === 'custom' && estado.custom
      ? Object.assign({ label: 'Personalizado' }, estado.custom)
      : U.range(estado.periodo);
  }

  Views.dashboard = {
    titulo: '💎 CRM Produtos',
    subtitulo: 'Gestão de Produtos e Faturamento',

    render() {
      const ex = M.visaoExecutiva();
      const cad = M.resumoCadastros();
      const prod = M.resumoProdutos();
      const tar = M.resumoTarefas();
      const usuario = Store.currentUser() || { nome: 'Gestor' };
      const primeiroNome = String(usuario.nome).split(' ')[0];

      const r = rangeAtual();
      const serie = M.serie(r, estado.granularidade);
      const fat = M.faturamento(r);
      const compMes = M.comparativo(U.range('mes'));
      const prioridades = M.porPrioridade();
      const recentes = M.recentes(10);
      const categorias = M.porCategoria(U.range('12m'));

      const mesNome = U.monthName(new Date().getMonth());
      const metaMes = Number(Store.config.metaFaturamentoMensal) || 0;
      const pctMeta = metaMes ? U.clamp((ex.faturamento.bruto / metaMes) * 100, 0, 100) : 0;

      return `
      <!-- ===== HERO: os números que resumem a operação ===== -->
      <section class="hero">
        <div class="hero__greet">
          <h2>Olá, ${U.esc(primeiroNome)} 👋</h2>
          <p>Aqui está o resumo da operação de produtos — ${mesNome.toLowerCase()} de ${new Date().getFullYear()}.</p>
        </div>

        <div class="hero__grid">
          <div class="hero__card hero__card--accent">
            <div class="hero__k">💰 Faturamento <span class="tiny" style="text-transform:none;letter-spacing:0">· já entrou</span></div>
            <div class="hero__v">${U.moneyShort(ex.faturamento.bruto)}</div>
            <div class="hero__s">${UI.trend(ex.deltaFaturamento)} vs. mês anterior</div>
          </div>

          <div class="hero__card">
            <div class="hero__k">💼 Carteira <span class="tiny" style="text-transform:none;letter-spacing:0">· ativo hoje</span></div>
            <div class="hero__v">${U.moneyShort(ex.carteira.total)}</div>
            <div class="hero__s">${ex.carteira.contratos} contratos · ${ex.carteira.clientesAtivos} clientes</div>
          </div>

          <div class="hero__card">
            <div class="hero__k">🎯 Pipeline <span class="tiny" style="text-transform:none;letter-spacing:0">· pode entrar</span></div>
            <div class="hero__v">${U.moneyShort(ex.pipeline.valor)}</div>
            <div class="hero__s">${ex.pipeline.qtd} oportunidades · conversão ${U.pct(ex.pipeline.taxaConversao)}</div>
          </div>

          <div class="hero__card hero__card--dashed">
            <div class="hero__k">📈 Faturamento projetado</div>
            <div class="hero__v">${U.moneyShort(ex.projetado)}</div>
            <div class="hero__s">carteira + pipeline · <b style="color:#fbcf5a">projeção, não é receita recebida</b></div>
          </div>
        </div>

        <div class="hero__mini">
          <div class="hero__minicard"><small>Faturamento do mês</small><b>${U.money0(ex.faturamento.bruto)}</b></div>
          <div class="hero__minicard"><small>Vendas fechadas</small><b>${U.num(ex.faturamento.qtd)}</b></div>
          <div class="hero__minicard"><small>Produtos ativos</small><b>${U.num(prod.ativos)}</b></div>
          <div class="hero__minicard"><small>Clientes ativos</small><b>${U.num(cad.ativos)}</b></div>
          <div class="hero__minicard"><small>A receber</small><b>${U.money0(ex.faturamento.aReceberTotal)}</b></div>
          <div class="hero__minicard"><small>Ticket médio</small><b>${U.money0(ex.faturamento.ticketMedio)}</b></div>
        </div>
      </section>

      ${metaMes ? `<div class="card mb">
        <div class="spread mb">
          <span class="small strong">🎯 Meta de faturamento · ${U.esc(mesNome)}</span>
          <span class="small"><b>${U.money(ex.faturamento.bruto)}</b> <span class="muted">de ${U.money(metaMes)}</span></span>
        </div>
        <div class="bar-track" style="height:9px"><div class="bar-fill" style="width:${pctMeta.toFixed(1)}%;background:linear-gradient(90deg,#f0b429,#d99e0b)"></div></div>
        <div class="spread mt-sm tiny muted"><span>${U.pct(pctMeta)} da meta</span>
          <span>faltam ${U.money(Math.max(0, metaMes - ex.faturamento.bruto))}</span></div>
      </div>` : ''}

      <!-- ===== CARDS DE INDICADORES ===== -->
      <section class="section">
        <div class="section__title"><h2>Indicadores principais</h2>
          <p class="muted small">Atualizados automaticamente a cada cadastro, venda ou mudança de status.</p></div>
        <div class="grid grid--kpi">
          ${UI.kpi({
            icone: '👥', titulo: 'Total de Cadastros', cor: 'blue',
            valor: U.num(cad.total),
            linhas: [
              { label: 'Cadastrados no mês', valor: U.num(cad.noMes) },
              { label: 'Cadastros ativos', valor: U.num(cad.ativos) },
              { label: 'Prospects', valor: U.num(cad.prospects) }
            ]
          })}
          ${UI.kpi({
            icone: '📦', titulo: 'Produtos Ativos', cor: 'purple',
            valor: U.num(prod.ativos),
            linhas: [
              { label: 'Produtos cadastrados', valor: U.num(prod.total) },
              { label: 'Inativos / em desenv.', valor: U.num(prod.inativos) },
              { label: 'Arquivados', valor: U.num(prod.arquivados) }
            ]
          })}
          ${UI.kpi({
            icone: '💰', titulo: 'Faturamento do Mês', cor: 'gold',
            valor: U.money0(ex.faturamento.bruto),
            sub: UI.trend(compMes.deltaBruto) + ' <span class="muted">vs. ' + U.money0(ex.faturamentoAnterior.bruto) + ' no mês anterior</span>',
            linhas: [
              { label: 'Faturamento bruto', valor: U.money0(ex.faturamento.bruto) },
              { label: 'Faturamento líquido', valor: U.money0(ex.faturamento.liquido) },
              { label: 'Recebido no mês', valor: U.money0(ex.faturamento.recebido) }
            ]
          })}
          ${UI.kpi({
            icone: '💼', titulo: 'Valor em Carteira', cor: 'navy',
            valor: U.money0(ex.carteira.total),
            linhas: [
              { label: 'Clientes ativos', valor: U.num(ex.carteira.clientesAtivos) },
              { label: 'Receita recorrente/mês', valor: U.money0(ex.carteira.receitaMensal) },
              { label: 'Projeção anual', valor: U.money0(ex.carteira.receitaAnualProjetada) }
            ]
          })}
          ${UI.kpi({
            icone: '✅', titulo: 'Vendas Fechadas', cor: 'green',
            valor: U.num(ex.faturamento.qtd),
            sub: '<span class="muted">no mês corrente</span>',
            linhas: [
              { label: 'Valor total vendido', valor: U.money0(ex.faturamento.bruto) },
              { label: 'Ticket médio', valor: U.money0(ex.faturamento.ticketMedio) },
              { label: 'Variação de volume', valor: UI.trend(compMes.deltaQtd) }
            ]
          })}
          ${UI.kpi({
            icone: '⏳', titulo: 'Vendas em Negociação', cor: 'orange',
            valor: U.num(ex.pipeline.qtd),
            sub: '<span class="muted">oportunidades abertas no funil</span>',
            linhas: [
              { label: 'Valor potencial', valor: U.money0(ex.pipeline.valor) },
              { label: 'Taxa de conversão', valor: U.pct(ex.pipeline.taxaConversao) },
              { label: 'Ticket médio', valor: U.money0(ex.pipeline.ticketMedio) }
            ]
          })}
        </div>
      </section>

      <!-- ===== GRÁFICO DE FATURAMENTO ===== -->
      <section class="section">
        <div class="card card--pad0">
          <div class="card__head">
            <div><h2>📊 Faturamento</h2><p>${U.esc(r.label)} · ${U.fmtDate(r.de)} a ${U.fmtDate(r.ate)}</p></div>
            <div class="chips" data-gran>
              ${[['dia', 'Diário'], ['semana', 'Semanal'], ['mes', 'Mensal'], ['ano', 'Anual']].map(g =>
                `<button class="chip ${estado.granularidade === g[0] ? 'is-active' : ''}" data-g="${g[0]}">${g[1]}</button>`).join('')}
            </div>
          </div>
          <div class="card__body">
            ${UI.periodoChips(estado.periodo)}
            <div class="mt">${Charts.faturamento(serie)}</div>
            <div class="chart-legend">
              <span><i style="background:#2563eb"></i>Faturamento bruto</span>
              <span><i style="background:#059669"></i>Faturamento líquido</span>
            </div>
            <div class="divider"></div>
            <div class="grid grid--4">
              <div><div class="tiny muted">FATURAMENTO BRUTO</div><div class="strong" style="font-size:17px">${U.money(fat.bruto)}</div></div>
              <div><div class="tiny muted">DESCONTOS</div><div class="strong neg" style="font-size:17px">− ${U.money(fat.descontos)}</div></div>
              <div><div class="tiny muted">COMISSÕES</div><div class="strong neg" style="font-size:17px">− ${U.money(fat.comissoes)}</div></div>
              <div><div class="tiny muted">CUSTOS</div><div class="strong neg" style="font-size:17px">− ${U.money(fat.custos)}</div></div>
              <div><div class="tiny muted">FATURAMENTO LÍQUIDO</div><div class="strong pos" style="font-size:17px">${U.money(fat.liquido)}</div></div>
              <div><div class="tiny muted">MARGEM</div><div class="strong" style="font-size:17px">${U.pct(fat.margemPct)}</div></div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== FUNIL + PRIORIDADE ===== -->
      <section class="section">
        <div class="grid grid--2">
          <div class="card card--pad0">
            <div class="card__head"><h2>🎯 Funil de Vendas</h2>
              <button class="btn btn--xs btn--ghost" data-goto="funil">Ver funil →</button></div>
            <div class="card__body">
              ${Charts.funil(ex.pipeline.porEtapa)}
              <div class="divider"></div>
              <div class="spread small"><span class="muted">Valor potencial no funil</span><b>${U.money(ex.pipeline.valor)}</b></div>
              <div class="spread small mt-sm"><span class="muted">Taxa de conversão histórica</span><b>${U.pct(ex.pipeline.taxaConversao)}</b></div>
            </div>
          </div>

          <div class="card card--pad0">
            <div class="card__head"><h2>🔥 Cadastros por Prioridade</h2></div>
            <div class="card__body">
              ${prioridades.map(p => `
                <div class="progress-row">
                  <div class="progress-row__top">
                    <span>${p.prioridade.emoji} <b>${U.esc(p.prioridade.nome)}</b>
                      <span class="muted">— ${p.qtd} cadastro${p.qtd === 1 ? '' : 's'}</span></span>
                    <b>${U.pct(p.pct)}</b>
                  </div>
                  <div class="bar-track"><div class="bar-fill" style="width:${p.pct}%;background:${
                    { red: '#ef4444', gold: '#f0b429', green: '#10b981' }[p.prioridade.cor] || '#64748b'}"></div></div>
                  <div class="tiny muted">${U.money(p.valor)} em potencial</div>
                </div>`).join('')}
              <div class="divider"></div>
              <div class="spread small"><span class="muted">Total de oportunidades abertas</span>
                <b>${U.num(U.sum(prioridades, p => p.qtd))}</b></div>
            </div>
          </div>
        </div>
      </section>

      <!-- ===== RECENTES + TAREFAS ===== -->
      <section class="section">
        <div class="grid grid--2">
          <div class="card card--pad0">
            <div class="card__head"><h2>🕐 Cadastros Recentes</h2>
              <button class="btn btn--xs btn--ghost" data-goto="cadastros">Ver todos →</button></div>
            <div class="card__body" style="padding:8px">
              ${recentes.length ? `<div class="list">${recentes.map(o => {
                const cli = Store.L.cliente(o.clienteId) || {};
                const etapa = Store.L.etapa(o.etapaId);
                return `<div class="listrow" data-op="${o.id}">
                  ${UI.avatar(cli.nome)}
                  <div class="listrow__body">
                    <div class="listrow__title">${U.esc(cli.nome || '—')}</div>
                    <div class="listrow__sub">${U.esc(Store.L.nomeProduto(o.produtoId))} · ${U.relative(o.data)}</div>
                  </div>
                  <div class="listrow__right">
                    ${UI.badge(etapa)}
                    <span class="listrow__val">${U.money0(o.valor)}</span>
                  </div>
                </div>`;
              }).join('')}</div>` : UI.vazio({ icone: '🕐', titulo: 'Nenhum cadastro ainda', texto: 'Use o botão "Novo Cadastro" para começar.' })}
            </div>
          </div>

          <div class="card card--pad0">
            <div class="card__head"><h2>✅ Tarefas</h2>
              <button class="btn btn--xs btn--ghost" data-goto="tarefas">Ver todas →</button></div>
            <div class="card__body">
              <div class="grid grid--mini mb">
                <div class="card" style="padding:12px;background:${tar.atrasadas.length ? 'var(--red-100)' : 'var(--surface-2)'};border:0">
                  <div class="tiny muted">ATRASADAS</div>
                  <div style="font-size:21px;font-weight:750;${tar.atrasadas.length ? 'color:var(--red-600)' : ''}">${tar.atrasadas.length}</div>
                </div>
                <div class="card" style="padding:12px;background:var(--gold-100);border:0">
                  <div class="tiny muted">HOJE</div>
                  <div style="font-size:21px;font-weight:750;color:var(--gold-600)">${tar.hoje.length}</div>
                </div>
                <div class="card" style="padding:12px;background:var(--surface-2);border:0">
                  <div class="tiny muted">PRÓXIMAS</div>
                  <div style="font-size:21px;font-weight:750">${tar.proximas.length}</div>
                </div>
              </div>
              ${[].concat(tar.atrasadas.slice(0, 3), tar.hoje.slice(0, 3), tar.proximas.slice(0, 3)).slice(0, 6).map(t => {
                const atrasada = t.prazo < U.today();
                const hoje = t.prazo === U.today();
                return `<div class="task ${atrasada ? 'task--late' : hoje ? 'task--today' : ''}" style="margin-bottom:7px" data-task="${t.id}">
                  <button class="task__check" data-check="${t.id}" aria-label="Concluir tarefa"></button>
                  <div class="task__body">
                    <div class="task__title">${U.esc(t.titulo)}</div>
                    <div class="task__meta">
                      <span>${atrasada ? '🔴' : hoje ? '🟡' : '📅'} ${U.fmtDate(t.prazo)} · ${U.relative(t.prazo)}</span>
                      <span>${U.esc(Store.L.nomeCliente(t.clienteId))}</span>
                    </div>
                  </div>
                </div>`;
              }).join('') || `<p class="small muted center">Nenhuma tarefa pendente. 🎉</p>`}
            </div>
          </div>
        </div>
      </section>

      <!-- ===== COMPOSIÇÃO + TOP PRODUTOS ===== -->
      <section class="section">
        <div class="grid grid--2">
          <div class="card card--pad0">
            <div class="card__head"><h2>🧩 Faturamento por Categoria</h2><p>12 meses</p></div>
            <div class="card__body">
              ${Charts.donut(categorias.map(c => ({ label: c.categoria.nome, valor: c.valor, cor: c.categoria.cor })),
                { centroSub: 'faturado' })}
            </div>
          </div>

          <div class="card card--pad0">
            <div class="card__head"><h2>🏆 Top Produtos</h2>
              <button class="btn btn--xs btn--ghost" data-goto="ranking">Ranking completo →</button></div>
            <div class="card__body">
              ${Charts.hbars(
                M.ranking(U.range('12m')).porFaturamento.slice(0, 6)
                  .map(d => ({ label: d.produto.nome, valor: d.faturamento, sub: d.vendasQtd + ' vendas' })))}
            </div>
          </div>
        </div>
      </section>`;
    },

    mount(el) {
      el.querySelectorAll('[data-periodo] .chip').forEach(b => {
        b.onclick = () => {
          const p = b.getAttribute('data-p');
          if (p === 'custom') {
            UI.periodoCustom(estado.custom || U.range('mes'), c => {
              estado.custom = c; estado.periodo = 'custom'; App.render();
            });
            return;
          }
          estado.periodo = p;
          // ajusta a granularidade ao tamanho do período
          const r = U.range(p);
          const dias = U.diffDays(r.ate, r.de);
          estado.granularidade = dias <= 31 ? 'dia' : dias <= 120 ? 'semana' : dias <= 800 ? 'mes' : 'ano';
          App.render();
        };
      });
      el.querySelectorAll('[data-gran] .chip').forEach(b => {
        b.onclick = () => { estado.granularidade = b.getAttribute('data-g'); App.render(); };
      });
      el.querySelectorAll('[data-goto]').forEach(b => {
        b.onclick = () => App.go(b.getAttribute('data-goto'));
      });
      el.querySelectorAll('[data-op]').forEach(row => {
        row.onclick = () => Forms.detalheOportunidade(row.getAttribute('data-op'));
      });
      el.querySelectorAll('[data-check]').forEach(b => {
        b.onclick = e => {
          e.stopPropagation();
          const id = b.getAttribute('data-check');
          const concluido = Store.config.statusTarefa.find(s => s.concluido);
          if (concluido) {
            Store.upsert('tarefas', { id: id, statusId: concluido.id });
            UI.toast('Tarefa concluída! ✅', 'ok');
            App.render();
          }
        };
      });
    }
  };
})(window);
