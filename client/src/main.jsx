import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { Atendimento } from "./Atendimento.jsx";
import "./estilos.css";
import "./atendimento.css";
import { Landing } from "./Landing.jsx";
import "./landing.css";

/** Rotas: "/" é a página inicial, "/atendimento[/:id]" os tickets e o resto os quadros. */
function Raiz() {
  const [caminho, setCaminho] = useState(window.location.pathname);

  useEffect(() => {
    const voltar = () => setCaminho(window.location.pathname);
    window.addEventListener("popstate", voltar);
    return () => window.removeEventListener("popstate", voltar);
  }, []);

  const navegar = (destino, { substituir = false } = {}) => {
    if (destino === window.location.pathname) return;
    window.history[substituir ? "replaceState" : "pushState"](null, "", destino);
    setCaminho(destino);
  };

  if (caminho === "/") return <Landing />;
  if (caminho === "/atendimento" || caminho.startsWith("/atendimento/")) return <Atendimento caminho={caminho} navegar={navegar} />;
  return <App navegar={navegar} />;
}

createRoot(document.getElementById("raiz")).render(
  <StrictMode>
    <Raiz />
  </StrictMode>,
);
