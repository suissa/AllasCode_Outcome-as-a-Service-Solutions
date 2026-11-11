# Chat API — Front-end, Fastify, PostgreSQL e OpenRouter

## Arquitetura

`Browser → Vite (proxy /api em desenvolvimento) → Fastify → PostgreSQL + OpenRouter`

- O navegador envia o texto, o identificador da missão e o contexto necessário.
- Fastify valida a entrada e persiste a mensagem do usuário no PostgreSQL.
- O servidor recupera o histórico recente da sessão e chama o modelo configurado no OpenRouter.
- A resposta do modelo é validada como JSON, persistida e devolvida ao navegador.
- A chave do OpenRouter existe somente no servidor. Nunca a exponha em variáveis `VITE_*` nem no bundle do navegador.

## Configuração

Copie `.env.example` para `.env`, configure `DATABASE_URL` e `OPENROUTER_API_KEY`. O modelo pode ser alterado em `OPENROUTER_MODEL`.

## Execução local

Em terminais separados:

```bash
npm run dev:api
npm run dev
```

O Vite encaminha `/api/*` para `http://127.0.0.1:3000`. O Fastify cria as tabelas `chat_sessions` e `chat_messages` na inicialização.

## Endpoints

- `GET /api/health`: disponibilidade e configuração do banco/LLM (não expõe segredos).
- `POST /api/chat/turn`: recebe `sessionId`, `message` e `context`; retorna `reply`.

## Roteiro de conversa

O prompt versionado em `prompts/chat-system.pt-BR.md` orienta o modelo a entender objetivo, negócio, processo, obstáculos, prazo e métrica, uma pergunta por vez. O fluxo não deve responder apenas “missão registrada” quando alguém informa seu objetivo.

## Produção

Configure o proxy/reverse proxy da hospedagem para encaminhar `/api/*` ao processo Fastify e servir o front-end estático normalmente. Configure as variáveis de ambiente no ambiente do servidor. Não coloque chaves no código-fonte.
