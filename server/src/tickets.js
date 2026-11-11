// Atendimento: tickets de suporte em formato de conversa. Contrato JSON em inglês, como o de quadros.
// Cada mensagem tem `role`: "user" (quem abriu o ticket) ou "agent" (quem atende).
// Agentes autônomos entram depois pela mesma rota: POST /api/tickets/:id/messages com role "agent".
// Dono: cada navegador recebe um cookie aleatório; o banco guarda só o hash dele em `owner_id`.
// Ticket com dono só é lido por ele. Tickets antigos (owner_id NULL) continuam visíveis como antes.
// Com a integração do GitHub ligada (AGENT_RUNTIME=github-actions), o ticket novo vira issue e
// a resposta vem do workflow; a entrada antiga de agentes (role "agent" pela API) fica suspensa para esses tickets.
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { ErroHttp, invalido, naoEncontrado, texto } from "./http.js";
import { transacao } from "./db.js";

const COOKIE_DONO = "fluxo_dono";
const hash = (t) => createHash("sha256").update(t).digest("hex");

/** Hash do dono deste navegador; cria o cookie na primeira visita. */
function donoDoPedido({ req, res }) {
  const atual = (req.headers.cookie ?? "").split(";").map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE_DONO}=`))?.slice(COOKIE_DONO.length + 1);
  if (atual && /^[a-f0-9]{64}$/.test(atual)) return hash(atual);
  const novo = randomBytes(32).toString("hex");
  res.setHeader("set-cookie", `${COOKIE_DONO}=${novo}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${365 * 86_400}`);
  return hash(novo);
}

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

export function rotasDeTickets(app, db, { github = null } = {}) {
  /** `dono` undefined = sem checagem (uso interno); string = só o dono ou ticket antigo sem dono. */
  const buscar = (id, dono) => {
    const t = db.prepare("SELECT * FROM ticket WHERE id = ?").get(id);
    if (!t || (dono !== undefined && t.owner_id !== null && t.owner_id !== dono)) throw naoEncontrado("Ticket");
    return t;
  };

  /** Traz o resultado do workflow como mensagem do N1. Falha do GitHub nunca derruba a tela. */
  const reconciliar = async (t) => {
    if (!github?.tem(t.id)) return;
    try {
      const novas = await github.reconciliar(t);
      if (!novas.length) return;
      transacao(db, () => {
        for (const m of novas) inserirMensagem(t.id, "agent", "Suporte N1", m.texto.trim().slice(0, MAX_MENSAGEM), new Date().toISOString());
        db.prepare("UPDATE ticket SET atualizado_em = ? WHERE id = ?").run(new Date().toISOString(), t.id);
      });
    } catch (e) {
      github.erro(`reconciliar ticket ${t.id}`, e);
    }
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

  app.get("/api/tickets", (ctx) => {
    const dono = donoDoPedido(ctx);
    return {
      tickets: db.prepare("SELECT * FROM ticket WHERE owner_id IS NULL OR owner_id = ? ORDER BY atualizado_em DESC, rowid DESC").all(dono).map(saidaTicket),
    };
  });

  /** Abre um ticket já com a primeira mensagem; o título sai dela se não vier um. Com GitHub ligado, abre a issue em seguida. */
  app.post("/api/tickets", (ctx) => {
    const { corpo } = ctx;
    const dono = donoDoPedido(ctx);
    const content = texto(corpo, "content", { max: MAX_MENSAGEM });
    const title = texto(corpo, "title", { max: MAX_TITULO, opcional: true }) ?? tituloDaMensagem(content);
    const agora = new Date().toISOString();
    const id = randomUUID();
    const resposta = transacao(db, () => {
      db.prepare("INSERT INTO ticket (id, title, status, owner_id, criado_em, atualizado_em) VALUES (?, ?, 'open', ?, ?, ?)").run(id, title, dono, agora, agora);
      inserirMensagem(id, "user", "", content, agora);
      return { ticket: saidaTicket(buscar(id)), messages: mensagens(id) };
    });
    if (github) github.abrirIssue(resposta.ticket, content).catch((e) => github.erro(`abrir issue do ticket ${id}`, e));
    return resposta;
  });

  app.get("/api/tickets/:id", async (ctx) => {
    let t = buscar(ctx.params.id, donoDoPedido(ctx));
    await reconciliar(t);
    t = buscar(t.id);
    return { ticket: saidaTicket(t), messages: mensagens(t.id) };
  });

  app.patch("/api/tickets/:id", (ctx) => {
    const { corpo } = ctx;
    const t = buscar(ctx.params.id, donoDoPedido(ctx));
    const title = texto(corpo, "title", { max: MAX_TITULO, opcional: true }) ?? t.title;
    let status = t.status;
    if (corpo.status !== undefined) {
      if (!STATUS.includes(corpo.status)) throw invalido(`status deve ser ${STATUS.join(" ou ")}.`);
      status = corpo.status;
    }
    db.prepare("UPDATE ticket SET title = ?, status = ?, atualizado_em = ? WHERE id = ?").run(title, status, new Date().toISOString(), t.id);
    return { ticket: saidaTicket(buscar(t.id)) };
  });

  app.delete("/api/tickets/:id", (ctx) => {
    const t = buscar(ctx.params.id, donoDoPedido(ctx));
    db.prepare("DELETE FROM ticket WHERE id = ?").run(t.id); // mensagens e vínculo com a issue caem em cascata
    return { ok: true };
  });

  /**
   * Nova mensagem na conversa. Mensagem do usuário num ticket resolvido reabre o ticket.
   * `role: "agent"` é a entrada antiga de agentes: continua para tickets sem issue e fica suspensa
   * para tickets acompanhados pelo GitHub Actions (a resposta deles vem só da reconciliação).
   */
  app.post("/api/tickets/:id/messages", (ctx) => {
    const { corpo } = ctx;
    const role = papel(corpo);
    const t = role === "agent" ? buscar(ctx.params.id) : buscar(ctx.params.id, donoDoPedido(ctx));
    if (role === "agent" && github?.tem(t.id)) throw new ErroHttp(409, "Este ticket é respondido pelo workflow do GitHub.");
    const content = texto(corpo, "content", { max: MAX_MENSAGEM });
    const author = texto(corpo, "author", { min: 0, max: 120, opcional: true }) ?? "";
    const agora = new Date().toISOString();
    const resposta = transacao(db, () => {
      const message = inserirMensagem(t.id, role, author, content, agora);
      const status = role === "user" ? "open" : t.status;
      db.prepare("UPDATE ticket SET status = ?, atualizado_em = ? WHERE id = ?").run(status, agora, t.id);
      return { message, ticket: saidaTicket(buscar(t.id)) };
    });
    if (role === "user" && github?.tem(t.id)) github.encaminharMensagem(t.id, content).catch((e) => github.erro(`encaminhar mensagem do ticket ${t.id}`, e));
    return resposta;
  });
}
