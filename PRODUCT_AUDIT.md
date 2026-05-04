# Life OS - auditoria de produto

## Estado atual

O app evoluiu bastante como PWA pessoal: tem planejamento, check-in, diario, proposito, gamificacao, sincronizacao em nuvem e push via Vercel. O ponto principal e que a arquitetura ainda nasceu single-user e esta sendo migrada agora para multiusuario.

## Pontos sensiveis

1. Usuarios e privacidade
   - Antes desta fase, todos os dados eram gravados no mesmo documento `users/meu-sistema-vida`.
   - A nova base usa documentos por usuario e o acesso legado foi removido apos a migracao dos dados do Bruno.
   - Proximo passo: testar duas contas reais no mesmo navegador e em dispositivos diferentes.

2. Regras de seguranca
   - As regras antigas permitiam qualquer usuario autenticado ler/escrever tudo.
   - As regras agora restringem documentos por `auth.uid`, sem excecao para documento legado.
   - Proximo passo: manter as regras publicadas no Firebase sempre alinhadas ao repositorio.

3. Sincronizacao e conflitos
   - O app usa um estado grande e quase monolitico no Firestore.
   - Isso facilita o desenvolvimento, mas aumenta risco de sobrescrita quando dois dispositivos editam areas diferentes ao mesmo tempo.
   - Proximo passo: separar estado por dominio, como `profile`, `plans`, `habits`, `daily_logs` e `gamification`.

4. Imagens
   - Imagens ainda sao armazenadas como texto/base64 em documento Firestore.
   - Funciona para pouco uso, mas pode ficar pesado e caro.
   - Proximo passo: mover avatar e imagens do Odyssey para Firebase Storage por usuario.

5. Notificacoes
   - Push de habitos existe no servidor.
   - Avisos de cadencia e preenchimento ainda funcionam principalmente ao abrir o app.
   - Proximo passo: criar uma central de notificacoes com categorias, prioridade, historico e preferencias.

6. Produto e onboarding
   - O onboarding agora apresenta Manual e Flow ao usuario inicial.
   - Proximo passo: criar um checklist pos-onboarding para guiar as primeiras 24 horas de uso.

7. Manutencao
   - `app.js` esta grande demais.
   - Proximo passo: quebrar por modulos: auth, sync, notifications, gamification, cadence, views e data adapters.

8. Observabilidade
   - Hoje dependemos de console, Vercel logs e teste manual.
   - Proximo passo: criar diagnostico interno no app e logs de erros importantes, sem gravar dados sensiveis.

## Recomendacao

Prioridade de produto:

1. Testar duas contas reais com dados isolados.
2. Criar checklist pos-onboarding.
3. Separar imagens para Storage.
4. Modularizar `app.js`.
5. Criar central de notificacoes.
6. Adicionar testes minimos para sincronizacao, gamificacao, cadencia e notificacoes.
