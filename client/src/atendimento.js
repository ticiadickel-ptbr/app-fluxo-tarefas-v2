// Lógica pura da tela de atendimento, testada sem navegador.

const DIA = 86_400_000;
const inicioDoDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Agrupa tickets (já ordenados do mais recente) como o histórico de um chat: Hoje, Ontem, 7 dias, 30 dias, Mais antigos. */
export function agruparPorData(tickets, agora = new Date()) {
  const hoje = inicioDoDia(agora);
  const faixas = [
    { rotulo: "Hoje", desde: hoje },
    { rotulo: "Ontem", desde: hoje - DIA },
    { rotulo: "Últimos 7 dias", desde: hoje - 7 * DIA },
    { rotulo: "Últimos 30 dias", desde: hoje - 30 * DIA },
    { rotulo: "Mais antigos", desde: -Infinity },
  ];
  const grupos = faixas.map((f) => ({ rotulo: f.rotulo, tickets: [] }));
  for (const t of tickets) {
    const quando = new Date(t.updatedAt).getTime();
    const i = faixas.findIndex((f) => quando >= f.desde);
    grupos[i === -1 ? grupos.length - 1 : i].tickets.push(t);
  }
  return grupos.filter((g) => g.tickets.length);
}

/** Hora curta para mensagens de hoje; data e hora para as mais antigas. */
export function horaDaMensagem(iso, agora = new Date()) {
  const d = new Date(iso);
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (inicioDoDia(d) === inicioDoDia(agora)) return hora;
  return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}, ${hora}`;
}

/** Iniciais para o avatar: "Suporte Fluxo" → "SF". */
export function iniciais(nome) {
  const partes = String(nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return (partes[0][0] + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

/** Id do ticket a partir do caminho `/atendimento/:id`. */
export function ticketDoCaminho(caminho) {
  const [, secao, id] = String(caminho ?? "").split("/");
  return secao === "atendimento" && id ? decodeURIComponent(id) : null;
}
