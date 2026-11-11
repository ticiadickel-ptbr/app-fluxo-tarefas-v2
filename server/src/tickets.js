// Atendimento: tickets de suporte em formato de conversa. Contrato JSON em inglês, como o de quadros.
// Cada mensagem tem `role`: "user" (quem abriu o ticket) ou "agent" (quem atende).
// Agentes autônomos entram depois pela mesma rota: POST /api/tickets/:id/messages com role "agent".
import { randomUUID } from "node:crypto";
import { invalido, naoEncontrado, texto } from "./http.js";
import { transacao } from "./db.js";

const STATUS = ["open", "closed"];
const ROLES = ["user", "agent"];
const MAX_TITULO = 120;
const MAX_MENSAGEM = 8000;

/** Título automático: primeira linha da mensagem, cortada sem quebrar palavra. */
export function tituloDaMensagem(conteudo) {
  const linha = conteudo.split(/\r?\n/).map((l) => l.trim()).find(Boolean) ?? "Novo ticket";
  const limite = 60;
  if (linha.length <= limite) return linha;
  const corte = linha.slice(0, limite);
  const espaco = corte.lastIndexOf(" ");
  return `${(espaco > 30 ? corte.slice(0, espaco) : corte).trimEnd()}…`;
}

const saidaMensagem = (m) => ({ id: m.id, ticketId: m.ticket_id, role: m.role, author: m.author, content: m.content, createdAt: m.criado_em });

export function rotasDeTickets(app, db) {
  const buscar = (id) => {
    const t = db.prepare("SELECT * FROM ticket WHERE id = ?").get(id);
    if (!t) throw naoEncontrado("Ticket");
    return t;
  };

  /** Ticket com o resumo que a lista lateral precisa: última mensagem e se aguarda resposta. */
  const saidaTicket = (t) => {
    const ultima = db.prepare("SELECT role, content FROM ticket_message WHERE ticket_id = ? ORDER BY criado_em DESC, rowid DESC LIMIT 1").get(t.id);
    return {
      id: t.id,
      title: t.title,
      status: t.status,
      createdAt: t.criado_em,
      updatedAt: t.atualizado_em,
      lastMessage: ultima ? ultima.content.slice(0, 140) : "",
      awaitingReply: ultima?.role === "user" && t.status === "open",
    };
  };

  const mensagens = (ticketId) =>
    db.prepare("SELECT * FROM ticket_message WHERE ticket_id = ? ORDER BY criado_em, rowid").all(ticketId).map(saidaMensagem);

  const inserirMensagem = (ticketId, role, author, content, agora) => {
    const id = randomUUID();
    db.prepare("INSERT INTO ticket_message (id, ticket_id, role, author, content, criado_em) VALUES (?, ?, ?, ?, ?, ?)")
      .run(id, ticketId, role, author, content, agora);
    return saidaMensagem(db.prepare("SELECT * FROM ticket_message WHERE id = ?").get(id));
  };

  const papel = (corpo) => {
    if (corpo.role === undefined) return "user";
    if (!ROLES.includes(corpo.role)) throw invalido(`role deve ser ${ROLES.join(" ou ")}.`);
    return corpo.role;
  };

  app.get("/api/tickets", () => ({
    tickets: db.prepare("SELECT * FROM ticket ORDER BY atualizado_em DESC, rowid DESC").all().map(saidaTicket),
  }));

  /** Abre um ticket já com a primeira mensagem; o título sai dela se não vier um. */
  app.post("/api/tickets", ({ corpo }) => {
    const content = texto(corpo, "content", { max: MAX_MENSAGEM });
    const title = texto(corpo, "title", { max: MAX_TITULO, opcional: true }) ?? tituloDaMensagem(content);
    const agora = new Date().toISOString();
    const id = randomUUID();
    return transacao(db, () => {
      db.prepare("INSERT INTO ticket (id, title, status, criado_em, atualizado_em) VALUES (?, ?, 'open', ?, ?)").run(id, title, agora, agora);
      inserirMensagem(id, "user", "", content, agora);
      return { ticket: saidaTicket(buscar(id)), messages: mensagens(id) };
    });
  });

  app.get("/api/tickets/:id", ({ params }) => {
    const t = buscar(params.id);
    return { ticket: saidaTicket(t), messages: mensagens(t.id) };
  });

  app.patch("/api/tickets/:id", ({ params, corpo }) => {
    const t = buscar(params.id);
    const title = texto(corpo, "title", { max: MAX_TITULO, opcional: true }) ?? t.title;
    let status = t.status;
    if (corpo.status !== undefined) {
      if (!STATUS.includes(corpo.status)) throw invalido(`status deve ser ${STATUS.join(" ou ")}.`);
      status = corpo.status;
    }
    db.prepare("UPDATE ticket SET title = ?, status = ?, atualizado_em = ? WHERE id = ?").run(title, status, new Date().toISOString(), t.id);
    return { ticket: saidaTicket(buscar(t.id)) };
  });

  app.delete("/api/tickets/:id", ({ params }) => {
    const t = buscar(params.id);
    db.prepare("DELETE FROM ticket WHERE id = ?").run(t.id); // mensagens caem em cascata
    return { ok: true };
  });

  /** Nova mensagem na conversa. Mensagem do usuário num ticket resolvido reabre o ticket. */
  app.post("/api/tickets/:id/messages", ({ params, corpo }) => {
    const t = buscar(params.id);
    const role = papel(corpo);
    const content = texto(corpo, "content", { max: MAX_MENSAGEM });
    const author = texto(corpo, "author", { min: 0, max: 120, opcional: true }) ?? "";
    const agora = new Date().toISOString();
    return transacao(db, () => {
      const message = inserirMensagem(t.id, role, author, content, agora);
      const status = role === "user" ? "open" : t.status;
      db.prepare("UPDATE ticket SET status = ?, atualizado_em = ? WHERE id = ?").run(status, agora, t.id);
      return { message, ticket: saidaTicket(buscar(t.id)) };
    });
  });
}
