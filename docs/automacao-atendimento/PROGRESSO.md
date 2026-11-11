# Progresso: automação do atendimento

## Etapa 00: preparar o projeto e o acesso (2026-11-11)

- **Cópia usada:** https://github.com/ticiadickel-ptbr/app-fluxo-tarefas-v2 (remote `origin`, branch `main`), reutilizada. O repositório original do professor não foi alterado.
- **Node:** v26.13.0 (o projeto pede >= 22.13).
- **Comandos do package.json:** `dev`, `preflight`, `start`, `test`, `build`.
- **Abrir o app:** `npm run dev`. O terminal mostra os endereços: interface em http://127.0.0.1:5173 e API em http://127.0.0.1:3001/api, ou as próximas portas livres. As telas ficam em `/quadro` e `/atendimento`.
- **Instalação:** `npm install` terminou sem erro.
- **Build:** `npm run build` terminou com sucesso (`dist/` gerado em ~3 s).
- **App aberto:** com `npm run dev`, as rotas `/`, `/quadro`, `/atendimento`, `/api/saude` e `/api/tickets` responderam 200.
- **Dados locais:** `server/dados/app.sqlite` foi preservado e continua fora do Git (`.gitignore`).

### Acesso ao GitHub

- **Actions:** habilitadas no repositório (`enabled: true`, `allowed_actions: all`).
- **Copilot:** a conta `ticiadickel-ptbr` está no **Copilot Free** (`free_limited_copilot`).
- **Pendência:** o Copilot cloud agent precisa de um plano pago do Copilot (Pro, Pro+, Business ou Enterprise). Sem isso, os arquivos `.github/agents/*.agent.md` serão montados só localmente.

### Credenciais (somente os nomes, nunca os valores)

- **Credencial local do backend:** fica num `.env` local, que o `.gitignore` já ignora. Ainda não existe, porque o backend não precisa dela nesta etapa.
- **`COPILOT_AGENT_TOKEN`:** é o secret do repositório usado pelas Actions, separado da credencial do backend. Ainda não foi criado, porque esta etapa não faz configuração remota.
- **Demonstrações:** usam somente dados fictícios.

### Próximo passo

- Habilitar um plano pago do Copilot na conta, ou usar uma conta que já tenha.
- Depois, seguir para a próxima etapa da aula.

## Etapa 03: app, issue e coordenador via GitHub Actions (2026-11-11)

O caminho escolhido é `AGENT_RUNTIME=github-actions`, com a API de IA do próprio usuário e sem Copilot.

### Fluxo

1. **Ticket novo:** o backend cria uma issue `origin:app` com a marca do ticket e guarda o vínculo em `ticket_github`, no SQLite. Ele usa o login do `gh` desta máquina.
2. **Workflow:** a issue é aberta com o token do usuário, então o evento `issues: opened` dispara o `ai-agents.yml`.
3. **Controlador** (`automacao/controlador.mjs`):
   - valida a origem: label, autor = `APP_BACKEND_LOGIN` e marca do ticket;
   - relê o estado e registra `requestId` e `resultPath`;
   - chama o coordenador uma única vez, ou simula a chamada com `AGENT_DRY_RUN`;
   - valida o resultado fora do modelo e publica, na mesma issue, o resumo interno e o comentário de estado.
4. **Mensagem do N1 no app:** o backend consulta o comentário de estado (no máximo a cada 15 s) e mostra a mensagem do N1 no app uma única vez.
5. **Resposta do cliente:** vira comentário na mesma issue e um `workflow_dispatch` explícito.
6. **Outcome `code` validado:** o job `propor-pr` grava só os arquivos permitidos e abre um PR em rascunho. O job `conferir-pr` roda o build sem segredos e só com leitura.

### Conferência local

Feita com dados fictícios, sem rede e sem chamada à IA. Passaram:
- a criação da issue;
- a leitura do ticket só pelo dono;
- a montagem da entrada do coordenador;
- o dry-run;
- o bloqueio de repetição;
- a reconciliação da mensagem do N1;
- o dispatch.

`npm run build` e `npm test` também passaram.

### Configuração mínima pendente para o ensaio real

Nada disso foi feito ainda:

- **Variables do repositório:**
  - `AGENT_RUNTIME=github-actions`;
  - `APP_BACKEND_LOGIN=ticiadickel-ptbr`;
  - `AGENT_DRY_RUN=true`, até o ensaio;
  - `AI_PROVIDER` e `AI_MODEL`.
- **Secret `AI_API_KEY`:** criar pela tela do GitHub ou com `gh secret set AI_API_KEY`, sem colar o valor no chat.
- **Provedor de IA:** ainda não foi escolhido, então `ADAPTADORES` em `controlador.mjs` está vazio. Para a chamada real, falta informar o provedor e o modelo e acrescentar o adaptador.
- **PRs pelas Actions:** o repositório está com `can_approve_pull_request_reviews=false`. Para o job `propor-pr` abrir PR, habilite em Settings → Actions → General a opção "Allow GitHub Actions to create and approve pull requests".
- **Backend local:** copie `.env.example` para `.env` (com `AGENT_RUNTIME=github-actions` e `GITHUB_REPO`). Antes disso, ele não cria issues.
- **Atenção:** o repositório é **público**. O texto do ticket vira issue pública, então use só dados fictícios.
