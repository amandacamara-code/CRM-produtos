# CRM de Produtos da Firece

Sistema web de **gestão de produtos e faturamento**, feito para o responsável pela área
de Produtos controlar produtos comercializados, cadastros, vendas, carteira de clientes
e desempenho financeiro.

Não é um protótipo visual: todos os cards, gráficos, tabelas e indicadores são
calculados a partir dos dados cadastrados. Ao adicionar um produto, cliente ou venda,
o dashboard muda na hora.

---

## Os três números no centro do sistema

O dashboard começa pelos números que respondem "como está a operação?" em 10 segundos:

| | O que responde |
|---|---|
| 💰 **Faturamento** | quanto já entrou |
| 💼 **Carteira** | quanto está ativo hoje |
| 🎯 **Pipeline** | quanto ainda pode entrar |
| 📈 **Faturamento projetado** | carteira + pipeline — sinalizado como **projeção**, não receita recebida |

---

## Publicar na Netlify

O repositório já está pronto para publicar — **não há etapa de build**.

1. Acesse **https://app.netlify.com** → **Add new project** → **Import an existing project**
2. **Deploy with GitHub** → autorize se for pedido
3. Escolha o repositório **`amandacamara-code/CRM-produtos`**
4. **Branch to deploy:** `claude/crm-produtos-web-ad50hx` — já é o branch padrão do
   repositório, então vem selecionado sozinho
5. **Build command:** deixe vazio · **Publish directory:** `.`
6. **Deploy**

O `netlify.toml` na raiz já define a pasta de publicação, os cabeçalhos de segurança
e bloqueia o acesso web a `docs/` e `supabase/`.

> Depois de publicar, confira em *Site configuration → Access control* se o login
> obrigatório do Netlify (SSO) está desligado — com ele ativo, quem não tem conta na
> sua equipe do Netlify não alcança nem a tela de login do CRM.

Publicar coloca o sistema no ar em **modo demonstração**. O login com senha de verdade
começa ao conectar o servidor: veja [docs/CONFIGURAR-LOGIN.md](docs/CONFIGURAR-LOGIN.md).

## Rodar no seu computador

Abra o `index.html` no navegador. Não há build, servidor, dependências nem instalação.

```
git clone <repo> && cd CRM-produtos
# abra index.html no navegador (ou sirva a pasta com qualquer servidor estático)
python3 -m http.server 8080
```

O sistema já vem com dados fictícios de demonstração (10 produtos, 45 clientes,
14 meses de vendas, funil preenchido). Para começar a usar com dados reais:

**Configurações → Backup dos dados → 🗑️ Começar do zero**

---

## Funcionalidades

### Telas

| Menu | Tela | O que faz |
|---|---|---|
| **Principal** | 📊 Dashboard | Visão executiva, 6 cards de indicadores, gráfico de faturamento, funil, prioridades, cadastros recentes e tarefas |
| | 👥 Cadastros | Lista de leads/oportunidades com busca, filtros, ordenação e exportação |
| | 🎯 Funil de Vendas | Kanban com **arrastar e soltar** entre etapas |
| **Produtos** | 📦 Produtos | Catálogo completo: criar, editar, duplicar, desativar, arquivar, excluir |
| | 🔗 Links de Cadastro | Copiar, abrir, editar e **gerar QR Code** do link de cada produto |
| | 📊 Desempenho dos Produtos | Vendas, faturamento, clientes, ticket, margem, participação e crescimento |
| **Gestão** | ✅ Tarefas | Agrupadas por atrasadas / hoje / próximas / concluídas |
| | 💼 Carteira | Carteira total, clientes ativos, receita mensal, projeção anual, ticket médio |
| | 💰 Financeiro | Bruto, descontos, comissões, custos, líquido, margem e comissões por consultor |
| | 👥 Clientes | Base completa com valor comprado, carteira e pipeline por cliente |
| **Análise** | 📈 Relatórios | 9 relatórios com filtro de período e exportação Excel/PDF |
| | 🏆 Ranking de Produtos | Pódio 🥇🥈🥉 e destaques (mais vendido, maior margem, maior crescimento, menor desempenho) |
| **Configurações** | ⚙️ Configurações | Tudo que torna o sistema editável sem código |

### Regras automáticas

Quando uma oportunidade muda de etapa, o sistema reage sozinho:

- **PAGO / FECHADO** → registra a venda, atualiza faturamento, carteira, número de
  clientes, ticket médio, gráficos e relatórios. Em **PAGO**, também contabiliza como
  receita recebida.
- **CANCELADO** → retira os valores dos indicadores de receita ativa e da carteira.
- **Voltou para uma etapa aberta** → desfaz a venda gerada e o valor retorna ao pipeline.

### Fórmulas

```
Faturamento bruto   = soma das vendas ativas do período
Faturamento líquido = bruto − descontos − custos − comissões
Ticket médio        = faturamento ÷ quantidade de vendas
Margem              = lucro ÷ faturamento × 100
Receita mensal      = valor do contrato ÷ meses da periodicidade
Projeção anual      = receita mensal × 12
```

---

## Editável sem programação

O responsável pela área cria e ajusta tudo pela interface. Em **Configurações**:

- **Geral** — nome da empresa, gestor, meta de faturamento, meta de vendas, domínio base dos links
- **Produtos** — adicionar, editar, duplicar, arquivar e excluir produtos
- **Categorias e listas** — categorias, tipos de produto, origens de cadastro
- **Status e etapas** — etapas do funil, status de produto, de venda, de tarefa, de cliente e prioridades
- **Comissões e pagamentos** — tabelas de comissão, formas de pagamento, tipos de cobrança, periodicidades
- **Usuários e acessos** — usuários e perfis
- **Backup dos dados** — exportar/importar JSON, recarregar demonstração, zerar o sistema

Criar uma etapa nova no funil, por exemplo, faz surgir uma coluna a mais no kanban,
na ordem definida, já contando no pipeline — sem tocar em uma linha de código.

---

## Dois modos de funcionamento

O sistema roda de duas formas, com a **mesma interface**:

| | **Local** (padrão) | **Equipe** (com login) |
|---|---|---|
| Onde ficam os dados | Navegador de quem abre | Supabase (Postgres) |
| Login | Não tem — seletor de perfil para teste | E-mail e senha |
| Compartilhar | Não — cada aparelho tem sua base | Sim — todos na mesma base |
| Permissões | Só escondem botões na tela | **Regras do banco**, valem por fora da tela |
| Tempo real | — | Alteração de um aparece no de todos |

Para ligar o modo equipe: **[docs/CONFIGURAR-LOGIN.md](docs/CONFIGURAR-LOGIN.md)** —
uns 15 minutos, uma vez só. O SQL pronto está em `supabase/schema.sql`.

## Perfis de acesso

| Perfil | Acesso |
|---|---|
| **Administrador** | Total, incluindo configurações e usuários |
| **Gestor de Produtos** | Produtos, vendas, carteira, financeiro e relatórios |
| **Consultor / Vendedor** | Apenas os próprios clientes, leads, vendas e tarefas |
| **Visualizador** | Somente leitura |

**A entrada do sistema é sempre a tela de login**, nos dois modos.

No modo local ela é uma simulação — a própria tela avisa que qualquer senha entra
e que os dados ficam só no navegador — e serve para você percorrer o sistema como
cada perfil, escolhendo a conta na lista. No modo equipe ela vira autenticação de
verdade, e o bloqueio passa a ser do banco de dados.

---

## Estrutura de dados

`usuarios` · `produtos` · `clientes` · `oportunidades` · `vendas` · `tarefas`,
mais a árvore `config` com todas as listas editáveis.

No modo local, os dados ficam no **localStorage** do navegador. No modo equipe, em
tabelas do Supabase, onde cada registro guarda o objeto inteiro num campo `jsonb` —
o que permite ao gestor criar status, categorias e campos novos pela tela, sem
nenhuma migração de banco.

As telas continuam **síncronas** nos dois modos: a memória é sempre a fonte de
leitura, e a gravação sobe em segundo plano. Se o servidor recusar (perfil sem
permissão, sessão expirada, rede fora), a alteração local é **desfeita** e o
sistema avisa — a tela nunca mostra um dado que o servidor não aceitou.

---

## Arquitetura

Sem framework, sem build, sem dependências externas — abre direto do disco e funciona offline.

```
index.html
assets/css/style.css            Design system da marca Firece (mobile first)
assets/img/firece-mark.svg      Símbolo da marca, usado no menu e no favicon
supabase/schema.sql             Tabelas, permissões (RLS) e criação de perfil no cadastro
docs/CONFIGURAR-LOGIN.md        Passo a passo para ligar o login e liberar o time
assets/js/
  firece-config.js              Onde entram a URL e a chave do Supabase
  backend.js                    Login e sincronização com o servidor
  auth.js                       Telas de entrar, criar conta e liberação de acesso
  util.js                       Formatação (R$, datas pt-BR), períodos, exportação CSV
  qrcode.js                     Gerador de QR Code próprio (modo byte, nível M, v1–12)
  store.js                      Modelo de dados, persistência, permissões e regras automáticas
  metrics.js                    Todos os indicadores derivados
  charts.js                     Gráficos em SVG puro (barras+linha, rosca, funil, sparkline)
  ui.js                         Modais, toasts, tabelas, badges, seletor de período
  forms.js                      Formulários e telas de detalhe
  views/                        Uma tela por arquivo (13 telas)
  app.js                        Roteamento, menu lateral e ciclo de vida
```

**QR Code:** implementação própria, validada byte a byte contra a biblioteca de
referência `qrcode` (npm) — as matrizes geradas são idênticas.

---

## Interface

- **Mobile first**, validado de 360px a 1440px sem overflow horizontal
- No celular: menu pelo botão ☰, barra inferior de atalhos, filtros recolhíveis e cards compactos
- Cards arredondados, sombras suaves, ícones, tipografia moderna, muito espaço em branco
- Paleta da marca Firece: laranja `#E8400D` como cor principal, sobre neutros quentes
  e um escuro amadeirado no menu e no painel executivo
- O laranja da marca é reservado para identidade e ações principais. As cores de
  status ficam deliberadamente afastadas dele, para que nenhum indicador seja
  confundido com elemento de marca: verde para pagamentos, carmim para cancelamentos,
  âmbar para negociações, dourado para pagamento em andamento, roxo para propostas e
  azul para novos cadastros
- Layout de impressão dedicado: o PDF sai sem menu nem filtros, como um relatório de verdade

### Atalhos

`N` novo cadastro · `V` nova venda · `Esc` fecha modais e menu

---

## Perguntas que o sistema responde

Quanto faturamos este mês · quanto temos em carteira · quanto temos a receber ·
quais produtos vendem mais · qual gera mais faturamento · qual tem maior margem ·
quantos clientes temos · quantas vendas estão em negociação · qual o valor potencial
do funil · quanto cada produto representa do total · qual o crescimento sobre o mês
anterior · quem são os clientes ativos · quais vendas precisam de acompanhamento.


---

## Sobre o logotipo

O símbolo em `assets/img/firece-mark.svg` foi **redesenhado em SVG** a partir da
imagem da marca, porque o arquivo original não estava disponível. Ele é fiel ao
traço, mas não é o arquivo oficial. Para usar o vetor original, substitua esse
arquivo e o `<svg class="brand__mark">` no `index.html` — a cor vem de
`--fire-500`, então basta manter `fill="currentColor"` ou o mesmo laranja.
