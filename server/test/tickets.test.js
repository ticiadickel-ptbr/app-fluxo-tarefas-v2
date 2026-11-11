import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { criarApp } from "../src/app.js";
import { tituloDaMensagem } from "../src/tickets.js";

let base, servidor;
let cookie = ""; // o mesmo "navegador" em todos os testes: o dono dos tickets criados
const chamar = async (metodo, caminho, corpo) => {
  const r = await fetch(base + caminho, { method: metodo, headers: { "content-type": "application/json", cookie }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
  cookie = r.headers.get("set-cookie")?.split(";")[0] ?? cookie;
  return { status: r.status, dados: r.status === 204 ? null : await r.json() };
};

before(async () => {
  ({ servidor } = criarApp());
  await new Promise((r) => servidor.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

test("o ticket de exemplo existe e já tem uma resposta do agente", async () => {
  const r = await chamar("GET", "/api/tickets");
  assert.equal(r.status, 200);
  const exemplo = r.dados.tickets.find((t) => t.id === "ticket-boas-vindas");
  assert.ok(exemplo);
  assert.equal(exemplo.awaitingReply, false);
  const conversa = (await chamar("GET", "/api/tickets/ticket-boas-vindas")).dados;
  assert.deepEqual(conversa.messages.map((m) => m.role), ["user", "agent"]);
});

test("abrir ticket cria a primeira mensagem e tira o título dela", async () => {
  const r = await chamar("POST", "/api/tickets", { content: "  Não consigo mover cartões\nAparece um erro ao soltar.  " });
  assert.equal(r.status, 201);
  assert.equal(r.dados.ticket.title, "Não consigo mover cartões");
  assert.equal(r.dados.ticket.status, "open");
  assert.equal(r.dados.ticket.awaitingReply, true);
  assert.equal(r.dados.messages.length, 1);
  assert.equal(r.dados.messages[0].role, "user");
  assert.equal(r.dados.messages[0].content, "Não consigo mover cartões\nAparece um erro ao soltar.");

  const comTitulo = await chamar("POST", "/api/tickets", { title: "Fatura", content: "Preciso da segunda via." });
  assert.equal(comTitulo.dados.ticket.title, "Fatura");
  assert.equal((await chamar("POST", "/api/tickets", { content: "   " })).status, 400);
});

test("conversa: agente responde, ticket deixa de aguardar e mensagem do usuário reabre o resolvido", async () => {
  const { ticket } = (await chamar("POST", "/api/tickets", { content: "Dúvida sobre listas" })).dados;
  const resposta = await chamar("POST", `/api/tickets/${ticket.id}/messages`, { role: "agent", author: "Agente", content: "Claro, pode perguntar." });
  assert.equal(resposta.status, 201);
  assert.equal(resposta.dados.message.role, "agent");
  assert.equal(resposta.dados.ticket.awaitingReply, false);

  assert.equal((await chamar("PATCH", `/api/tickets/${ticket.id}`, { status: "closed" })).dados.ticket.status, "closed");
  const volta = await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: "Mais uma coisa" });
  assert.equal(volta.dados.ticket.status, "open");
  assert.equal(volta.dados.ticket.awaitingReply, true);

  const conversa = (await chamar("GET", `/api/tickets/${ticket.id}`)).dados.messages;
  assert.deepEqual(conversa.map((m) => m.content), ["Dúvida sobre listas", "Claro, pode perguntar.", "Mais uma coisa"]);

  assert.equal((await chamar("POST", `/api/tickets/${ticket.id}/messages`, { role: "robo", content: "x" })).status, 400);
  assert.equal((await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: "" })).status, 400);
});

test("lista vem do mais recente para o mais antigo", async () => {
  const a = (await chamar("POST", "/api/tickets", { content: "Primeiro" })).dados.ticket;
  const b = (await chamar("POST", "/api/tickets", { content: "Segundo" })).dados.ticket;
  await chamar("POST", `/api/tickets/${a.id}/messages`, { content: "Atualizei o primeiro" });
  const ids = (await chamar("GET", "/api/tickets")).dados.tickets.map((t) => t.id);
  assert.ok(ids.indexOf(a.id) < ids.indexOf(b.id));
});

test("renomear, validar status e excluir com as mensagens", async () => {
  const { ticket } = (await chamar("POST", "/api/tickets", { content: "Para apagar" })).dados;
  assert.equal((await chamar("PATCH", `/api/tickets/${ticket.id}`, { title: "Novo nome" })).dados.ticket.title, "Novo nome");
  assert.equal((await chamar("PATCH", `/api/tickets/${ticket.id}`, { status: "talvez" })).status, 400);
  assert.deepEqual((await chamar("DELETE", `/api/tickets/${ticket.id}`)).dados, { ok: true });
  assert.equal((await chamar("GET", `/api/tickets/${ticket.id}`)).status, 404);
  assert.equal((await chamar("POST", `/api/tickets/${ticket.id}/messages`, { content: "oi" })).status, 404);
});

test("título automático corta frases longas sem quebrar palavra", () => {
  assert.equal(tituloDaMensagem("\n\n  Olá  \nresto"), "Olá");
  const longo = tituloDaMensagem("Quando eu tento arrastar um cartão para outra lista o quadro inteiro trava e preciso recarregar");
  assert.ok(longo.length <= 61);
  assert.ok(longo.endsWith("…"));
  assert.ok(!longo.slice(0, -1).endsWith(" "));
});
