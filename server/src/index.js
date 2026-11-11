import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { criarApp } from "./app.js";
import { clienteGitHub } from "./github.js";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
if (existsSync(join(raiz, ".env"))) process.loadEnvFile(join(raiz, ".env"));

const porta = Number(process.env.API_PORT ?? process.env.PORT ?? 3001);
const banco = process.env.BANCO ?? join(raiz, "server", "dados", "app.sqlite");

// Atendimento → GitHub Actions só com AGENT_RUNTIME=github-actions e GITHUB_REPO definidos.
const runtime = process.env.AGENT_RUNTIME ?? "local";
const repo = process.env.GITHUB_REPO;
const github = runtime === "github-actions" && repo ? clienteGitHub({ repo, ghBin: process.env.GH_BIN || "gh" }) : null;

const { servidor } = criarApp({ banco, github });
servidor.listen(porta, "127.0.0.1", () => {
  console.log(`API em http://127.0.0.1:${porta}/api`);
  console.log(github ? `Atendimento ligado ao GitHub: ${repo} (workflow ai-agents.yml)` : "Atendimento local (AGENT_RUNTIME diferente de github-actions)");
});
