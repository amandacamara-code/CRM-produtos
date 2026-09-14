/* =========================================================
   firece-config.js — conexão com o servidor
   =========================================================
   Deixe como está para o sistema rodar apenas neste navegador.

   Para ligar o login e a base compartilhada, preencha os dois
   campos abaixo com os dados do seu projeto no Supabase
   (Project Settings → API) e publique o site de novo:

     window.FIRECE_SUPABASE = {
       url: 'https://xxxxxxxxxxxx.supabase.co',
       anonKey: 'eyJhbGciOi...'
     };

   A chave "anon" é pública por natureza — ela NÃO dá acesso aos
   dados sozinha. Quem decide o que cada pessoa lê e grava são as
   permissões do banco, definidas em supabase/schema.sql.
   Nunca coloque aqui a chave "service_role".

   Também dá para configurar sem mexer no código, pela tela:
   Configurações → Conexão.
   ========================================================= */
window.FIRECE_SUPABASE = {
  url: '',
  anonKey: ''
};
