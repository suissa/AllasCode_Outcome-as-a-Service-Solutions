// @ts-nocheck
import { test } from "node:test";
import assert from "node:assert/strict";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { createApiServer } from "../server/api.js";

const databaseUrl = process.env.DATABASE_URL;

test("Chat API sends context to OpenRouter and restores conversation from PostgreSQL", {
  skip: !databaseUrl
}, async () => {
  const calls: Array<{ messages: Array<{ role: string; content: string }> }> = [];
  const fetchImpl: typeof fetch = async (_url, options) => {
    const body = JSON.parse(String(options?.body));
    calls.push(body);
    const contextMessage = body.messages.at(-1)?.content || "";
    const context = JSON.parse(contextMessage.replace("Contexto operacional (não é uma mensagem do usuário): ", ""));
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ reply: "Entendi. " + (context.nextQuestion || "Confira o resumo da missão.") }) } }]
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const sessionId = "test-" + randomUUID();
  const app = createApiServer({
    databaseUrl,
    apiKey: "test-key",
    model: "test/mock",
    fetchImpl
  });
  const sql = postgres(databaseUrl);

  try {
    await app.ready();
    const first = await app.inject({
      method: "POST",
      url: "/api/chat/turn",
      payload: {
        sessionId,
        message: "quero vender mais",
        context: {
          currentStep: "initial-intent",
          nextQuestion: "Em qual setor sua empresa atua?",
          mission: { answers: { desiredOutcome: { value: "quero vender mais" } } }
        }
      }
    });
    assert.equal(first.statusCode, 200);
    assert.match(first.json<{ reply: string }>().reply, /setor/i);

    const second = await app.inject({
      method: "POST",
      url: "/api/chat/turn",
      payload: {
        sessionId,
        message: "Principalmente pelo WhatsApp",
        context: {
          currentStep: "process",
          nextQuestion: "Qual é o tamanho aproximado da operação?",
          mission: { answers: { desiredOutcome: { value: "quero vender mais" } } }
        }
      }
    });
    assert.equal(second.statusCode, 200);
    assert.match(second.json<{ reply: string }>().reply, /tamanho aproximado/i);

    const history = calls[1].messages.map(message => message.content).join("\n");
    assert.match(history, /quero vender mais/);
    assert.match(history, /Entendi\./);

    const persisted = await sql`
      SELECT COUNT(*)::int AS total FROM chat_messages WHERE session_id = ${sessionId}
    `;
    assert.equal(persisted[0]?.total, 4);
  } finally {
    await app.close();
    await sql`DELETE FROM chat_sessions WHERE id = ${sessionId}`;
    await sql.end();
  }
});
