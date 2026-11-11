import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparPorData, iniciais, ticketDoCaminho } from "../src/atendimento.js";

const agora = new Date(2026, 10, 11, 15, 0);
const em = (dias, hora = 10) => new Date(2026, 10, 11 - dias, hora).toISOString();

test("agrupa tickets por data como o histórico de um chat, sem grupos vazios", () => {
  const tickets = [
    { id: "a", updatedAt: em(0) },
    { id: "b", updatedAt: em(0, 0) },
    { id: "c", updatedAt: em(1, 23) },
    { id: "d", updatedAt: em(5) },
    { id: "e", updatedAt: em(90) },
  ];
  const grupos = agruparPorData(tickets, agora);
  assert.deepEqual(grupos.map((g) => g.rotulo), ["Hoje", "Ontem", "Últimos 7 dias", "Mais antigos"]);
  assert.deepEqual(grupos.map((g) => g.tickets.map((t) => t.id)), [["a", "b"], ["c"], ["d"], ["e"]]);
  assert.deepEqual(agruparPorData([], agora), []);
});

test("iniciais do avatar", () => {
  assert.equal(iniciais("Suporte Fluxo"), "SF");
  assert.equal(iniciais("ana"), "A");
  assert.equal(iniciais("  "), "?");
});

test("id do ticket vem do caminho /atendimento/:id", () => {
  assert.equal(ticketDoCaminho("/atendimento/abc-1"), "abc-1");
  assert.equal(ticketDoCaminho("/atendimento"), null);
  assert.equal(ticketDoCaminho("/atendimento/"), null);
  assert.equal(ticketDoCaminho("/quadro"), null);
});
