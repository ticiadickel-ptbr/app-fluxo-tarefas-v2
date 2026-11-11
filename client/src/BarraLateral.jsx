import { Botao } from "./componentes/Botao.jsx";
import { Icone } from "./componentes/Icone.jsx";

const SECOES = [
  { id: "quadros", rotulo: "Quadros", icone: "colunas", caminho: "/quadro" },
  { id: "atendimento", rotulo: "Atendimento", icone: "suporte", caminho: "/atendimento" },
];

/** Menu principal do sistema: troca de seção sem recarregar a página. */
function Navegacao({ secao, navegar }) {
  return (
    <nav className="lateral-nav" aria-label="Seções">
      {SECOES.map((s) => (
        <a
          key={s.id}
          href={s.caminho}
          className="lateral-nav-item"
          aria-current={secao === s.id ? "page" : undefined}
          onClick={(e) => {
            if (!navegar || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
            e.preventDefault();
            navegar(s.caminho);
          }}
        >
          <Icone nome={s.icone} tamanho={18} />
          <span>{s.rotulo}</span>
        </a>
      ))}
    </nav>
  );
}

/**
 * Lateral do sistema: marca, menu de seções e o conteúdo da seção aberta.
 * Sem `children`, mostra a lista de quadros; a seção de atendimento passa o histórico de tickets.
 */
export function BarraLateral({ secao = "quadros", navegar, children, quadros, quadroId, aoSelecionar, aoNovoQuadro, aoRenomear, aoExcluir }) {
  return (
    <aside className="lateral" aria-label={secao === "atendimento" ? "Atendimento" : "Quadros"}>
      <a className="marca" href="/" aria-label="Fluxo, voltar ao início" style={{ textDecoration: "none" }}>
        <span className="marca-simbolo" aria-hidden="true">
          <Icone nome="colunas" tamanho={18} />
        </span>
        <span className="marca-nome">Fluxo</span>
      </a>

      <Navegacao secao={secao} navegar={navegar} />

      {children ?? (
        <>
          <div className="lateral-topo">
            <h2 className="lateral-titulo">Quadros</h2>
            <Botao variante="fantasma" icone="mais" aria-label="Criar quadro" onClick={aoNovoQuadro} />
          </div>

          {quadros === null ? (
            <p className="lateral-vazio">Carregando quadros…</p>
          ) : quadros.length ? (
            <ul className="lateral-lista">
              {quadros.map((quadro) => (
                <li key={quadro.id}>
                  <div className="lateral-item" data-ativo={quadro.id === quadroId ? "" : undefined}>
                    <button
                      type="button"
                      className="lateral-escolha"
                      aria-current={quadro.id === quadroId ? "page" : undefined}
                      onClick={() => aoSelecionar(quadro.id)}
                    >
                      {quadro.title}
                    </button>
                    <span className="lateral-acoes">
                      <Botao variante="fantasma" icone="lapis" aria-label={`Renomear quadro ${quadro.title}`} onClick={() => aoRenomear(quadro)} />
                      <Botao variante="fantasma" icone="lixeira" aria-label={`Excluir quadro ${quadro.title}`} onClick={() => aoExcluir(quadro)} />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="lateral-vazio">Nenhum quadro ainda. Crie o primeiro para começar.</p>
          )}
        </>
      )}
    </aside>
  );
}
