// Formato combinado entre o backend local e o controlador das Actions.
// O estado da automação vive num único comentário de controle da issue, escrito só pelo bot das Actions.

export const LABEL_ORIGEM = "origin:app";
export const WORKFLOW = "ai-agents.yml";
export const AUTOR_ESTADO = "github-actions[bot]";
export const MARCA_MENSAGEM = "<!-- fluxo-app:mensagem -->";
const MARCA_ESTADO = "<!-- fluxo-estado -->";

/** Marca que o backend põe no corpo da issue: liga a issue ao ticket do SQLite. */
export const marcaTicket = (ticketId) => `<!-- fluxo-app:ticket=${ticketId} -->`;
export function ticketDaIssue(corpo) {
  return /<!-- fluxo-app:ticket=([A-Za-z0-9-]{1,64}) -->/.exec(String(corpo ?? ""))?.[1] ?? null;
}

export function comentarioDeEstado(estado) {
  return `${MARCA_ESTADO}\n**Estado do atendimento automático** (mantido pelo workflow, não edite)\n\n\`\`\`json\n${JSON.stringify(estado, null, 2)}\n\`\`\``;
}

/** Lê o comentário de estado. Só vale o escrito pelo bot das Actions: comentário de outra pessoa é ignorado. */
export function lerEstado(comentarios) {
  const c = (comentarios ?? []).find((x) => x?.user?.login === AUTOR_ESTADO && String(x.body ?? "").startsWith(MARCA_ESTADO));
  if (!c) return { comentarioId: null, estado: null };
  try {
    const json = /```json\n([\s\S]*?)\n```/.exec(c.body)?.[1];
    return { comentarioId: c.id, estado: JSON.parse(json) };
  } catch {
    return { comentarioId: c.id, estado: null };
  }
}
