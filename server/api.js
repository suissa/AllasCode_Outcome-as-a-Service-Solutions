import Fastify from "fastify";
import postgres from "postgres";
import { readFile } from "node:fs/promises";

const SYSTEM_PROMPT = await readFile(new URL("../prompts/chat-system.pt-BR.md", import.meta.url), "utf8");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function safeJson(value) {
  try { return JSON.parse(value); } catch { return null; }
}

export function createApiServer({
  databaseUrl = process.env.DATABASE_URL,
  apiKey = process.env.OPENROUTER_API_KEY,
  model = process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
  fetchImpl = globalThis.fetch,
  logger = false
} = {}) {
  const app = Fastify({ logger });
  const sql = databaseUrl ? postgres(databaseUrl, { max: 10, idle_timeout: 20 }) : null;

  app.addHook("onReady", async () => {
    if (!sql) return;
    await sql`
      CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGSERIAL PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
        content TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS chat_messages_session_id_id_idx ON chat_messages(session_id, id)`;
  });

  app.get("/api/health", async () => ({
    status: "ok",
    databaseConfigured: Boolean(sql),
    llmConfigured: Boolean(apiKey),
    model
  }));

  app.post("/api/chat/turn", {
    schema: {
      body: {
        type: "object",
        additionalProperties: false,
        required: ["sessionId", "message", "context"],
        properties: {
          sessionId: { type: "string", minLength: 1, maxLength: 128 },
          message: { type: "string", minLength: 1, maxLength: 8000 },
          context: {
            type: "object",
            additionalProperties: true,
            properties: {
              nextQuestion: { type: "string", maxLength: 1200 },
              currentStep: { type: "string", maxLength: 100 },
              mission: { type: "object" }
            }
          }
        }
      }
    }
  }, async (request, reply) => {
    if (!sql) return reply.code(503).send({ error: "DATABASE_NOT_CONFIGURED" });
    if (!apiKey) return reply.code(503).send({ error: "OPENROUTER_NOT_CONFIGURED" });

    const { sessionId, message, context } = request.body;
    const nextQuestion = String(context.nextQuestion || "").trim();

    await sql`
      INSERT INTO chat_sessions (id) VALUES (${sessionId})
      ON CONFLICT (id) DO UPDATE SET updated_at = NOW()
    `;
    await sql`
      INSERT INTO chat_messages (session_id, role, content)
      VALUES (${sessionId}, 'user', ${message})
    `;

    const history = await sql`
      SELECT role, content FROM chat_messages
      WHERE session_id = ${sessionId}
      ORDER BY id DESC LIMIT 14
    `;
    history.reverse();

    const userContext = {
      instruction: "Responda à mensagem mais recente. Reconheça o que a pessoa informou e continue a descoberta. Faça uma pergunta principal por vez.",
      currentStep: context.currentStep || null,
      nextQuestion: nextQuestion || null,
      mission: context.mission || {}
    };

    let response;
    try {
      response = await fetchImpl(OPENROUTER_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5173",
          "X-Title": "OaaS.Quest"
        },
        body: JSON.stringify({
          model,
          temperature: 0.35,
          max_tokens: 450,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...history.map(item => ({ role: item.role, content: item.content })),
            { role: "user", content: "Contexto operacional (não é uma mensagem do usuário): " + JSON.stringify(userContext) }
          ]
        }),
        signal: AbortSignal.timeout(30000)
      });
    } catch (error) {
      request.log.error({ err: error }, "OpenRouter request failed");
      return reply.code(502).send({ error: "LLM_UNAVAILABLE" });
    }

    if (!response.ok) {
      request.log.error({ status: response.status }, "OpenRouter returned an error");
      return reply.code(502).send({ error: "LLM_REQUEST_FAILED" });
    }

    const payload = await response.json();
    const raw = payload.choices?.[0]?.message?.content;
    const parsed = typeof raw === "string" ? safeJson(raw) : raw;
    let assistantText = typeof parsed?.reply === "string" ? parsed.reply.trim() : "";

    if (!assistantText) return reply.code(502).send({ error: "LLM_INVALID_RESPONSE" });
    if (nextQuestion && !assistantText.includes(nextQuestion)) {
      assistantText = assistantText.replace(/[?!.\s]*$/, "") + " " + nextQuestion;
    }

    await sql`
      INSERT INTO chat_messages (session_id, role, content)
      VALUES (${sessionId}, 'assistant', ${assistantText})
    `;
    await sql`UPDATE chat_sessions SET updated_at = NOW() WHERE id = ${sessionId}`;

    return { sessionId, reply: assistantText, model };
  });

  app.addHook("onClose", async () => {
    if (sql) await sql.end({ timeout: 5 });
  });

  return app;
}

const isMain = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (isMain) {
  const app = createApiServer();
  const port = Number(process.env.API_PORT || 3000);
  const host = process.env.API_HOST || "0.0.0.0";
  await app.listen({ port, host });
}
