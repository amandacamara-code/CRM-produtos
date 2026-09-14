# Ligar o login e compartilhar com o time

Guia completo, do zero. Leva uns **15 minutos**, uma única vez.

Ao final: cada pessoa entra com e-mail e senha, todo mundo trabalha na
mesma base, e um consultor **não consegue** ver os dados dos outros — nem
pela tela, nem chamando a API por fora.

---

## Por que precisa de um servidor

Hoje o CRM guarda tudo no navegador de quem abre. Isso funciona para uma
pessoa, mas não dá para compartilhar: cada aparelho teria uma base
diferente, e não haveria senha nenhuma.

Vamos usar o **Supabase** — um banco de dados Postgres hospedado, com
login pronto. O plano gratuito cobre com folga o uso de um time de
produtos.

> **Por que Supabase e não outro:** as permissões ficam gravadas como
> regras do próprio banco (Row Level Security). Isso é o que torna o
> bloqueio real: mesmo que alguém descubra o endereço da API e a chave
> pública, o banco devolve só as linhas que aquela pessoa pode ver.

---

## Passo 0 — Publicar o CRM num endereço próprio

O modo equipe conversa com o Supabase pela rede. Para isso, o CRM precisa
estar publicado num endereço de verdade — **Netlify**, Vercel, GitHub
Pages, Cloudflare Pages ou o servidor da empresa. Ambientes de
pré-visualização (inclusive a versão hospedada na claude.ai) bloqueiam
chamadas de rede e o login não funcionaria lá.

O caminho mais simples, já com atualização automática a cada alteração:

1. Entre em **https://app.netlify.com** → **Add new project** → **Import an existing project**.
2. Escolha **GitHub** e selecione o repositório `CRM-produtos`.
3. Em **Branch to deploy**, escolha `claude/crm-produtos-web-ad50hx`.
4. Deixe **Build command** vazio e **Publish directory** como `.` — o projeto não precisa de build.
5. **Deploy**.

Em um minuto você recebe um endereço tipo
`https://crm-produtos-firece.netlify.app`. É esse que o time vai usar.

---

## Passo 1 — Criar o projeto no Supabase

1. Entre em **https://supabase.com** e crie uma conta (pode ser com o Google).
2. Clique em **New project**.
3. Preencha:
   - **Name:** `crm-firece`
   - **Database Password:** gere uma senha forte e **guarde num gerenciador de senhas**. Você provavelmente não vai precisar dela de novo, mas não dá para recuperá-la depois.
   - **Region:** `South America (São Paulo)` — deixa o sistema mais rápido no Brasil.
4. Clique em **Create new project** e espere uns 2 minutos.

## Passo 2 — Criar as tabelas e as permissões

1. No menu lateral do Supabase, abra **SQL Editor**.
2. Clique em **New query**.
3. Abra o arquivo **`supabase/schema.sql`** deste projeto, copie **tudo** e cole na janela.
4. Clique em **Run** (ou `Ctrl+Enter`).

Deve aparecer *Success. No rows returned*. Algumas mensagens em cinza
dizendo `does not exist, skipping` são normais — é o script se
certificando de que não há sobras de uma execução anterior.

Pode rodar esse arquivo de novo quando quiser, sem medo: ele não apaga dados.

## Passo 3 — Pegar as chaves

1. No Supabase, vá em **Project Settings** (engrenagem) → **API**.
2. Copie dois valores:
   - **Project URL** — algo como `https://abcdefgh.supabase.co`
   - **anon public** — uma chave longa começando com `eyJ...`

> ⚠️ Copie a chave **anon public**. **Nunca** use a `service_role`: ela
> ignora todas as permissões e daria acesso total a quem a encontrasse.
>
> A chave `anon` é pública por natureza — ela vai no código do site e não
> tem problema. Sozinha ela não abre nada: quem decide o que cada pessoa
> lê e grava são as regras do Passo 2.

## Passo 4 — Conectar o CRM

Há dois caminhos. Escolha um.

### Caminho A — pela tela (mais simples)

1. Abra o CRM.
2. Vá em **Configurações → Conexão e equipe**.
3. Cole a **Project URL** e a **chave anon**.
4. Clique em **Testar conexão** — precisa aparecer o visto verde.
5. Clique em **Conectar e enviar meus dados**.

O sistema recarrega e pede para você criar a conta. Os dados que estavam
no seu navegador sobem para o servidor nesse momento.

> Se a base ainda for a de demonstração, antes disso use
> **Configurações → Backup dos dados → Começar do zero**, para não subir
> produtos e clientes fictícios.

### Caminho B — no código (vale para todo mundo que abrir o site)

Edite **`assets/js/firece-config.js`**:

```js
window.FIRECE_SUPABASE = {
  url: 'https://abcdefgh.supabase.co',
  anonKey: 'eyJhbGciOi...'
};
```

Publique o site de novo. Assim todo mundo já cai direto na tela de login,
sem precisar configurar nada.

## Passo 5 — Criar a conta de administrador

Na tela de login, clique em **Criar conta** e preencha seus dados.

**A primeira conta criada vira automaticamente a administradora** e já
entra liberada. É você.

## Passo 6 — Liberar o time

Para cada pessoa:

1. Ela abre o **mesmo endereço** do CRM e clica em **Criar conta**.
2. Ela entra **bloqueada** — isso é proposital, para ninguém entrar sozinho.
3. Você abre **Configurações → Usuários**, encontra a pessoa, clica no
   lápis, marca **Usuário ativo** e escolhe o **perfil de acesso**.
4. A pessoa recarrega a página e já está dentro.

### Os quatro perfis

| Perfil | O que enxerga e faz |
|---|---|
| **Administrador** | Tudo, incluindo configurações e gestão de usuários |
| **Gestor de Produtos** | Todos os dados da operação; edita o catálogo, vendas, carteira e financeiro. Não mexe em usuários |
| **Consultor / Vendedor** | **Apenas os próprios** clientes, cadastros, vendas e tarefas |
| **Visualizador** | Vê tudo, não altera nada |

---

## Recomendações de segurança

Depois que o time todo estiver dentro, no painel do Supabase:

**Authentication → Providers → Email**
- Deixe **Confirm email** ligado, para garantir que o e-mail é real.

**Authentication → Sign In / Providers**
- Depois que todos criarem conta, desligue **Allow new users to sign up**.
  Aí ninguém mais consegue nem criar conta. Para incluir alguém depois,
  ligue, a pessoa se cadastra, e desligue de novo.

**Authentication → URL Configuration**
- Em **Site URL**, coloque o endereço real do CRM. É para lá que o link de
  recuperação de senha leva.

---

## Perguntas comuns

**As permissões são de verdade ou só escondem botões na tela?**
De verdade. Estão gravadas como regras do banco. Testamos exatamente
isso: um consultor tentando ler, alterar e apagar registro de outro
consultor recebe "nenhuma linha" ou erro — mesmo chamando a API
diretamente, sem passar pela tela.

**Desativar alguém corta o acesso na hora?**
Sim, inclusive aos registros em que a pessoa era a responsável. Basta
desmarcar **Usuário ativo**.

**E se a internet cair?**
A tela continua funcionando com o que já estava carregado, mas gravações
falham e o sistema avisa, desfazendo a alteração para não mostrar um dado
que o servidor não aceitou.

**Dá para voltar atrás?**
Dá. Em **Configurações → Backup dos dados → Exportar backup** você leva
tudo num arquivo JSON. Para desconectar, limpe os campos em
**Configurações → Conexão**, ou apague o conteúdo de `firece-config.js`.

**Quanto custa?**
O plano gratuito do Supabase atende de sobra. Ele pausa projetos sem
nenhum acesso por uma semana — basta reativar no painel. Com uso normal
do time, isso não acontece.

**Quantos registros aguenta?**
O sistema carrega a base inteira na memória ao abrir, o que deixa todas
as telas instantâneas. Isso vai bem até uns 10 mil registros. Acima
disso, vale paginar as telas de lista.
