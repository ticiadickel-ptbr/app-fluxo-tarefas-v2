import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { api } from "./api.js";
import { agruparPorData, horaDaMensagem, iniciais, ticketDoCaminho } from "./atendimento.js";
import { BarraLateral } from "./BarraLateral.jsx";
import { Botao } from "./componentes/Botao.jsx";
import { Campo } from "./componentes/Campo.jsx";
import { Confirmar } from "./componentes/Confirmar.jsx";
import { Dialogo } from "./componentes/Dialogo.jsx";
import { Icone } from "./componentes/Icone.jsx";
import { Menu } from "./componentes/Menu.jsx";

/** Enquanto o atendimento trabalha ou aguarda resposta, a conversa é consultada neste intervalo (o backend vai buscar na issue). */
const INTERVALO_CONSULTA = 4000;

const SUGESTOES = [
  "Não consigo mover um cartão entre listas",
  "Como organizo um quadro para a minha equipe?",
  "Encontrei um erro no sistema",
  "Quero sugerir uma melhoria",
];

/* ---------------------------------------------------------------- composer */

/** Campo de mensagem no estilo chat: cresce com o texto, Enter envia e Shift+Enter quebra a linha. */
function Compositor({ valor, aoMudar, aoEnviar, enviando, placeholder, autoFoco, campoRef }) {
  const ref = useRef(null);
  const alvo = campoRef ?? ref;

  useLayoutEffect(() => {
    const el = alvo.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [valor, alvo]);

  const podeEnviar = valor.trim().length > 0 && !enviando;
  const enviar = (e) => {
    e?.preventDefault();
    if (podeEnviar) aoEnviar(valor.trim());
  };

  return (
    <form className="compositor" onSubmit={enviar}>
      <label className="compositor-caixa">
        <span className="visualmente-oculto">Mensagem</span>
        <textarea
          ref={alvo}
          className="compositor-texto"
          rows={1}
          value={valor}
          maxLength={8000}
          placeholder={placeholder}
          autoFocus={autoFoco}
          onChange={(e) => aoMudar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) enviar(e);
          }}
        />
        <button type="submit" className="compositor-enviar" aria-label="Enviar mensagem" disabled={!podeEnviar}>
          <Icone nome="enviar" tamanho={18} />
        </button>
      </label>
      <p className="compositor-dica">Enter envia · Shift + Enter quebra a linha</p>
    </form>
  );
}

/* ---------------------------------------------------------------- mensagens */

function Mensagem({ mensagem }) {
  if (mensagem.role === "user") {
    return (
      <li className="msg msg-usuario" data-pendente={mensagem.pendente ? "" : undefined}>
        <div className="msg-balao">{mensagem.content}</div>
        <span className="msg-meta">{mensagem.pendente ? "Enviando…" : horaDaMensagem(mensagem.createdAt)}</span>
      </li>
    );
  }
  const autor = mensagem.author || "Atendimento";
  return (
    <li className="msg msg-agente">
      <span className="msg-avatar" aria-hidden="true">{mensagem.author ? iniciais(mensagem.author) : <Icone nome="suporte" tamanho={16} />}</span>
      <div className="msg-corpo">
        <p className="msg-autor">
          {autor} <span className="msg-meta">{horaDaMensagem(mensagem.createdAt)}</span>
        </p>
        <div className="msg-texto">{mensagem.content}</div>
      </div>
    </li>
  );
}

/** Andamento do atendimento automático. Descreve o que está acontecendo; NÃO é uma mensagem de agente. */
const ANDAMENTO = {
  "criando-issue": "Enviando o pedido ao atendimento…",
  "issue-criada": "Pedido enviado. Aguardando o atendimento começar…",
  "aguardando-ia": "Pedido enviado. Aguardando o atendimento começar…",
  "chamando-ia": "O atendimento está analisando o pedido…",
  "proposta-pronta": "Mudança proposta. Preparando a conferência…",
  "pr-aberto": "Conferindo a mudança (build e testes)…",
  "correcao-solicitada": "A conferência pediu um ajuste. Corrigindo a mudança…",
  entregando: "Finalizando a resposta…",
  "pr-pronto": "Mudança conferida. Aguardando a equipe integrá-la.",
  "aguardando-regras": "Mudança conferida, mas as regras do repositório impedem a integração. Aguardando a equipe.",
  "pendente-instrutor": "Aguardando decisão da equipe.",
  "pr-fechado": "A mudança proposta foi encerrada sem integração. Aguardando a equipe.",
  incerto: "A análise ficou incerta e precisa ser retomada pela equipe.",
  ensaio: "Atendimento automático em modo de ensaio: nenhum agente de IA analisou esta mensagem, então não há resposta.",
};

function Andamento({ automacao }) {
  const texto = ANDAMENTO[automacao?.phase];
  if (!texto) return null;
  return (
    <li className="andamento" data-em-curso={automacao.working ? "" : undefined} role="status">
      <span className="andamento-ponto" aria-hidden="true" />
      <span>{texto}</span>
    </li>
  );
}

/* ---------------------------------------------------------------- histórico lateral */

function HistoricoTickets({ tickets, ticketId, aoAbrir, aoNovo, aoRenomear, aoAlternarStatus, aoExcluir }) {
  return (
    <div className="historico">
      <Botao variante="suave" className="botao-bloco historico-novo" icone="novo-balao" onClick={aoNovo} aria-current={ticketId ? undefined : "page"}>
        Novo ticket
      </Botao>

      {tickets === null ? (
        <p className="lateral-vazio">Carregando tickets…</p>
      ) : tickets.length === 0 ? (
        <p className="lateral-vazio">Nenhum ticket ainda. Escreva sua dúvida para abrir o primeiro.</p>
      ) : (
        agruparPorData(tickets).map((grupo) => (
          <section key={grupo.rotulo} className="historico-grupo" aria-label={grupo.rotulo}>
            <h2 className="lateral-titulo historico-rotulo">{grupo.rotulo}</h2>
            <ul className="historico-lista">
              {grupo.tickets.map((t) => (
                <li key={t.id}>
                  <div className="lateral-item historico-item" data-ativo={t.id === ticketId ? "" : undefined}>
                    <span className="historico-status" data-status={t.awaitingReply ? "aguardando" : t.status} aria-hidden="true" />
                    <button
                      type="button"
                      className="lateral-escolha"
                      aria-current={t.id === ticketId ? "page" : undefined}
                      title={t.title}
                      onClick={() => aoAbrir(t.id)}
                    >
                      {t.title}
                      <span className="visualmente-oculto">
                        {t.status === "closed" ? " (resolvido)" : t.awaitingReply ? " (aguardando resposta)" : " (aberto)"}
                      </span>
                    </button>
                    <span className="lateral-acoes">
                      <Menu
                        rotulo={`Ações do ticket ${t.title}`}
                        itens={[
                          { rotulo: "Renomear", icone: "lapis", aoClicar: () => aoRenomear(t) },
                          t.status === "open"
                            ? { rotulo: "Marcar como resolvido", icone: "check", aoClicar: () => aoAlternarStatus(t) }
                            : { rotulo: "Reabrir ticket", icone: "atualizar", aoClicar: () => aoAlternarStatus(t) },
                          { rotulo: "Excluir", icone: "lixeira", perigo: true, aoClicar: () => aoExcluir(t) },
                        ]}
                      />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- tela */

export function Atendimento({ caminho, navegar }) {
  const ticketId = ticketDoCaminho(caminho);
  const [tickets, setTickets] = useState(null);
  const [conversa, setConversa] = useState(null); // { ticket, messages }
  const [naoEncontrado, setNaoEncontrado] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [tentativa, setTentativa] = useState(0);
  const fimRef = useRef(null);
  const campoRef = useRef(null);
  const recemCriado = useRef(null); // ticket aberto agora: a conversa já está em memória, não precisa buscar

  const abrir = (id) => navegar(id ? `/atendimento/${encodeURIComponent(id)}` : "/atendimento");

  /** Coloca o ticket atualizado no topo do histórico (ou o insere, se for novo). */
  const atualizarNoHistorico = (ticket) =>
    setTickets((atual) => {
      const antigo = (atual ?? []).find((t) => t.id === ticket.id);
      if (antigo && JSON.stringify(antigo) === JSON.stringify(ticket)) return atual; // nada mudou: não redesenha a lateral
      return [ticket, ...(atual ?? []).filter((t) => t.id !== ticket.id)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });

  // Histórico de tickets.
  useEffect(() => {
    let vivo = true;
    api.tickets
      .listar()
      .then((d) => { if (vivo) { setTickets(d?.tickets ?? []); setErro(null); } })
      .catch((e) => { if (vivo) { setErro(e.message); setTickets((t) => t ?? []); } });
    return () => { vivo = false; };
  }, [tentativa]);

  // Conversa aberta: carrega quando o id do caminho muda (a recém-criada já vem pronta).
  useEffect(() => {
    setNaoEncontrado(false);
    if (!ticketId) {
      setConversa(null);
      return;
    }
    if (recemCriado.current === ticketId) {
      recemCriado.current = null;
      return;
    }
    let vivo = true;
    setConversa(null);
    api.tickets
      .detalhe(ticketId)
      .then((d) => { if (vivo) { setConversa(d); setErro(null); } })
      .catch((e) => {
        if (!vivo) return;
        if (/não encontrado/i.test(e.message)) setNaoEncontrado(true);
        else setErro(e.message);
      });
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, tentativa]);

  // Rascunho é por conversa: trocar de ticket limpa o campo e devolve o foco a ele.
  useEffect(() => {
    setRascunho("");
    campoRef.current?.focus();
  }, [ticketId]);

  // Enquanto o atendimento trabalha (ou aguarda resposta), consulta a conversa e mostra cada mensagem assim que o N1 a publica.
  // Não para na primeira resposta: continua até o andamento terminar. O botão "Atualizar" faz a mesma consulta na hora.
  const acompanhando = Boolean(conversa && (conversa.ticket.awaitingReply || conversa.ticket.automation?.working));
  const idConversa = conversa?.ticket.id ?? null;
  const mudou = (a, b) =>
    a.messages.length !== b.messages.length || a.ticket.awaitingReply !== b.ticket.awaitingReply || a.ticket.status !== b.ticket.status ||
    a.ticket.automation?.phase !== b.ticket.automation?.phase;
  const sincronizar = async (id, agora = false) => {
    const d = await api.tickets.detalhe(id, { agora });
    // Não mexe numa conversa com envio em andamento: a resposta do envio é quem a atualiza.
    setConversa((atual) => (atual?.ticket.id === id && !atual.messages.some((m) => m.pendente) && mudou(atual, d) ? d : atual));
    atualizarNoHistorico(d.ticket);
  };
  useEffect(() => {
    if (!acompanhando || !idConversa) return;
    const consultar = () => { if (!document.hidden) sincronizar(idConversa).catch(() => { /* a próxima consulta tenta de novo */ }); };
    const timer = setInterval(consultar, INTERVALO_CONSULTA);
    document.addEventListener("visibilitychange", consultar); // ao voltar para a aba, atualiza na hora
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", consultar); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acompanhando, idConversa]);

  const atualizarAgora = async () => {
    if (!idConversa || atualizando) return;
    setAtualizando(true);
    try {
      await sincronizar(idConversa, true);
      setErro(null);
    } catch (e) {
      setErro(e.message);
    } finally {
      setAtualizando(false);
    }
  };

  // Rola até a última mensagem quando a conversa cresce.
  const totalMensagens = conversa?.messages.length ?? 0;
  useEffect(() => {
    fimRef.current?.scrollIntoView({ block: "end" });
  }, [totalMensagens, conversa?.ticket.id]);

  const enviar = async (texto) => {
    const temporaria = { id: `tmp-${Date.now()}`, role: "user", content: texto, createdAt: new Date().toISOString(), pendente: true };
    setEnviando(true);
    setErro(null);
    setRascunho("");
    const anterior = conversa;
    try {
      if (!conversa) {
        // Ticket novo: a primeira mensagem abre o ticket.
        setConversa({ ticket: { id: null, title: texto, status: "open", awaitingReply: true }, messages: [temporaria] });
        const d = await api.tickets.abrir(texto);
        recemCriado.current = d.ticket.id;
        setConversa(d);
        atualizarNoHistorico(d.ticket);
        abrir(d.ticket.id);
      } else {
        setConversa((c) => ({ ...c, messages: [...c.messages, temporaria] }));
        const d = await api.tickets.responder(conversa.ticket.id, texto);
        setConversa((c) => (c?.ticket.id === d.ticket.id ? { ticket: d.ticket, messages: [...c.messages.filter((m) => m.id !== temporaria.id), d.message] } : c));
        atualizarNoHistorico(d.ticket);
      }
    } catch (e) {
      setConversa(anterior);
      setRascunho(texto);
      setErro(e.message);
    } finally {
      setEnviando(false);
      campoRef.current?.focus();
    }
  };

  const executar = async (acao) => {
    try {
      setErro(null);
      await acao();
    } catch (e) {
      setErro(e.message);
    }
  };

  const editarTicket = (ticket, mudanca) =>
    executar(async () => {
      const d = await api.tickets.editar(ticket.id, mudanca);
      atualizarNoHistorico(d.ticket);
      setConversa((c) => (c?.ticket.id === d.ticket.id ? { ...c, ticket: d.ticket } : c));
      setDialogo(null);
    });

  const alternarStatus = (ticket) => editarTicket(ticket, { status: ticket.status === "open" ? "closed" : "open" });

  const excluirTicket = (ticket) =>
    executar(async () => {
      await api.tickets.excluir(ticket.id);
      setTickets((atual) => (atual ?? []).filter((t) => t.id !== ticket.id));
      setDialogo(null);
      if (ticket.id === ticketId) navegar("/atendimento", { substituir: true });
    });

  const recarregar = () => setTentativa((t) => t + 1);

  /* ------------------------------------------------------------ conteúdo principal */

  const telaNova = () => (
    <div className="chat-boas-vindas">
      <span className="chat-boas-vindas-icone" aria-hidden="true"><Icone nome="suporte" tamanho={26} /></span>
      <h1 className="chat-boas-vindas-titulo">Como podemos ajudar?</h1>
      <p className="chat-boas-vindas-texto">Descreva a dúvida ou o problema. Cada ticket é uma conversa e você acompanha a resposta por aqui.</p>
      <Compositor
        valor={rascunho}
        aoMudar={setRascunho}
        aoEnviar={enviar}
        enviando={enviando}
        placeholder="Escreva sua mensagem para o atendimento"
        autoFoco
        campoRef={campoRef}
      />
      <ul className="chat-sugestoes" aria-label="Sugestões de assunto">
        {SUGESTOES.map((s) => (
          <li key={s}>
            <button
              type="button"
              className="chat-sugestao"
              onClick={() => { setRascunho(s); requestAnimationFrame(() => campoRef.current?.focus()); }}
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const telaConversa = () => {
    const { ticket, messages } = conversa;
    const resolvido = ticket.status === "closed";
    return (
      <>
        <header className="chat-topo">
          <div className="chat-topo-titulo">
            <h1 title={ticket.title}>{ticket.title}</h1>
            <span className="chat-status" data-status={resolvido ? "closed" : ticket.awaitingReply || ticket.automation?.working ? "aguardando" : "open"}>
              {resolvido ? "Resolvido" : ticket.automation?.working ? "Em andamento" : ticket.awaitingReply ? "Aguardando resposta" : "Aberto"}
            </span>
          </div>
          {ticket.id ? (
            <div className="chat-topo-acoes">
              <Botao variante="fantasma" icone="atualizar" title="Buscar novas mensagens agora" aria-busy={atualizando} disabled={atualizando} onClick={atualizarAgora}>
                Atualizar
              </Botao>
              <Botao variante="fantasma" icone={resolvido ? "atualizar" : "check"} onClick={() => alternarStatus(ticket)}>
                {resolvido ? "Reabrir" : "Marcar como resolvido"}
              </Botao>
              <Menu
                rotulo="Mais ações do ticket"
                itens={[
                  { rotulo: "Renomear", icone: "lapis", aoClicar: () => setDialogo({ tipo: "renomear", ticket }) },
                  { rotulo: "Excluir", icone: "lixeira", perigo: true, aoClicar: () => setDialogo({ tipo: "excluir", ticket }) },
                ]}
              />
            </div>
          ) : null}
        </header>

        <div className="chat-rolagem">
          <ol className="chat-mensagens" aria-label="Mensagens do ticket" aria-live="polite">
            {messages.map((m) => <Mensagem key={m.id} mensagem={m} />)}
            {!messages.some((m) => m.pendente) ? <Andamento automacao={ticket.automation} /> : null}
          </ol>
          <div ref={fimRef} />
        </div>

        <div className="chat-rodape">
          {resolvido ? (
            <p className="chat-resolvido">
              <Icone nome="check" tamanho={16} />
              Este ticket foi marcado como resolvido. Enviar uma nova mensagem reabre o atendimento.
            </p>
          ) : null}
          <Compositor
            valor={rascunho}
            aoMudar={setRascunho}
            aoEnviar={enviar}
            enviando={enviando}
            placeholder="Responder ao atendimento"
            autoFoco
            campoRef={campoRef}
          />
        </div>
      </>
    );
  };

  const conteudo = () => {
    if (naoEncontrado) {
      return (
        <div className="vazio-canvas">
          <h2>Ticket não encontrado</h2>
          <p>Ele pode ter sido excluído. Abra um novo ticket para falar com o atendimento.</p>
          <Botao variante="primario" icone="novo-balao" onClick={() => abrir(null)}>Novo ticket</Botao>
        </div>
      );
    }
    if (ticketId && !conversa) {
      return <p className="carregando-line chat-carregando" role="status">Carregando conversa…</p>;
    }
    return conversa ? telaConversa() : telaNova();
  };

  return (
    <div className="app">
      <BarraLateral secao="atendimento" navegar={navegar}>
        <HistoricoTickets
          tickets={tickets}
          ticketId={ticketId}
          aoAbrir={abrir}
          aoNovo={() => abrir(null)}
          aoRenomear={(ticket) => setDialogo({ tipo: "renomear", ticket })}
          aoAlternarStatus={alternarStatus}
          aoExcluir={(ticket) => setDialogo({ tipo: "excluir", ticket })}
        />
      </BarraLateral>

      <main className="canvas chat">
        {erro ? (
          <div className="aviso chat-aviso" role="alert">
            <span className="aviso-texto">
              <Icone nome="alerta" tamanho={18} />
              <span>{erro}</span>
            </span>
            <Botao icone="atualizar" onClick={recarregar}>Tentar de novo</Botao>
          </div>
        ) : null}
        {conteudo()}
      </main>

      {dialogo?.tipo === "renomear" ? (
        <Dialogo aberto titulo="Renomear ticket" aoFechar={() => setDialogo(null)}>
          <form
            className="formulario"
            onSubmit={(e) => {
              e.preventDefault();
              const titulo = String(new FormData(e.currentTarget).get("title") ?? "").trim();
              if (titulo) void editarTicket(dialogo.ticket, { title: titulo });
            }}
          >
            <Campo rotulo="Título do ticket" name="title" defaultValue={dialogo.ticket.title} maxLength={120} required autoFocus />
            <div className="acoes">
              <Botao onClick={() => setDialogo(null)}>Cancelar</Botao>
              <Botao variante="primario" type="submit">Salvar alterações</Botao>
            </div>
          </form>
        </Dialogo>
      ) : null}

      {dialogo?.tipo === "excluir" ? (
        <Confirmar
          aberto
          titulo="Excluir ticket"
          descricao={`Excluir "${dialogo.ticket.title}" apaga a conversa inteira. Não dá para desfazer.`}
          rotuloConfirmar="Excluir ticket"
          aoConfirmar={() => void excluirTicket(dialogo.ticket)}
          aoFechar={() => setDialogo(null)}
        />
      ) : null}
    </div>
  );
}
