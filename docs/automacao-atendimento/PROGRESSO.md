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
6. **Outcome `code` validado:** o job `propor-pr` grava só os arquivos permitidos e abre um PR (ajustado na etapa 05: PR em rascunho não pode ser integrado pela API). O job `conferir-pr` roda o build sem segredos e só com leitura.

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

## Etapas 04 e 05: validar código e entregar a resposta (2026-11-11)

Na versão deste projeto o "Copilot" das instruções originais é o coordenador rodando no GitHub Actions com a chave de IA do usuário (etapa 03). Por isso o pedido de correção "ao Copilot no mesmo PR" vira uma nova rodada do coordenador sobre o mesmo PR.

### Validação (etapa 04)

- **Verificação mínima:** o job `conferir-pr` já era o CI. Ele faz `npm ci` (lockfile), `npm run build` e `npm test` no commit exato do PR (`propor-pr` informa o sha), sem segredos e só com leitura. Não há gate novo, Docker, red/green, cobertura nem matriz de browsers.
- **Critério:** o controlador aceita `criteria` simples `{id, description}`, sem exigir caminho de teste novo.
- **Revisor:** em `code`, o relatório traz `review: {verdict, text}`, uma frase dizendo se o diff atende. Sem `approved`, o código não é aceito.
- **Para aceitar código, o controlador (`entregar`) confere só:**
  - origem do PR: aberto por `github-actions[bot]`, na branch `ai/issue-*` do próprio repositório, base `main`;
  - o `requestId` no corpo do PR;
  - os caminhos de produto permitidos;
  - o build verde do commit atual: o sha do build deve ser o `head` do PR.
- **Execução do candidato:** o candidato nunca roda no job com tokens de controle.
- **Registro:** o build verde e a frase do Revisor vão para um comentário na issue.
- **Conferência de comportamento:** este fluxo não abre o app sozinho, então o comentário diz que ela **falta**. Quem faz a demonstração abre o app e confere.

### Entrega (etapa 05)

- **`AUTO_MERGE=false` (padrão):** o PR fica aberto para a demonstração.
- **`AUTO_MERGE=true`:** a API faz o merge `squash` enviando o `sha` conferido. Ela respeita as regras da branch e não há bypass. Se o GitHub recusar (405, 409 ou 422), o caso fica em `aguardando-regras`.
- **Depois do merge:**
  - o N1 publica uma resposta curta com id estável `<requestId>:entrega`, que diz que o código foi integrado e que **o app local precisa ser atualizado**;
  - a issue é fechada;
  - o corpo do PR usa `Refs #n` e as palavras de fechamento (`closes`, `fixes`, `resolves`) são neutralizadas, para o PR nunca fechar a issue sozinho.
- **Sem código:**
  - dúvida de uso (`answered`): responde e fecha a issue;
  - `waiting-customer`, `commercial` e `human-review`: respondem e mantêm o caso aberto.
- **App:** quando o app consulta a issue, mostra a resposta no ticket do dono uma única vez.
- **Falha de build ou do Revisor:**
  - o controlador comenta no MESMO PR com o erro curto e o `requestId`, e dispara `workflow_dispatch` com `correcao=true`;
  - o coordenador devolve a correção, que vira um novo commit na mesma branch, sem outro PR, sem outra issue e sem recomeçar;
  - no máximo **uma** rodada automática; se falhar de novo, a fase vira `pendente-instrutor`.

### Retomada

O estado vive em um comentário de controle da issue: `fase`, `prNumber`, `branch`, `headSha`, `correcoes` e as mensagens já enviadas (por id). Toda etapa relê esse estado antes de agir. Se a execução cair **depois do merge** (por exemplo, ao fechar a issue), a fase fica `entregando`. Um `workflow_dispatch` com o número da issue, ou o evento de fechamento do PR (`pos-merge`) quando uma pessoa faz o merge, só completa a resposta e o fechamento, sem chamar a IA e sem tocar no PR, e repetir não duplica nada. Uma rodada de IA que caiu no meio (`chamando-ia`, `incerto` ou `proposta-pronta`) só volta com `retomar_incerto=true`, porque isso faz outra chamada paga. Se a execução parou com o PR aberto e sem build, o instrutor decide: corrige à mão, faz o merge (o `pos-merge` responde e fecha) ou fecha o PR.

### Conferência desta etapa

Feita localmente, com GitHub, git e disco simulados, sem rede e sem IA. Passaram:
- uma entrega completa, sem merge e depois com merge, com falha ao fechar a issue e retomada;
- a resposta mostrada uma única vez no app do dono;
- uma correção no mesmo PR, seguida de pendência para o instrutor.

`npm run build` e `npm test` passaram (27/27). O YAML do workflow é válido.

### Ainda pendente (nada disso foi feito)

- **Merge automático:** `AUTO_MERGE=false` até você autorizar `true` (a `main` não tem proteção hoje).
- **Provedor de IA:** sem adaptador, então a chamada real não acontece. O ensaio usa `AGENT_DRY_RUN=true`, que só simula respostas `answered`.
- **Disparo real do caminho de código:** não foi exercitado no GitHub, porque o dry-run não produz código. Só a simulação local cobre essa parte.

## Ajuste: acompanhamento do chat e fim da resposta "automática" (2026-11-11)

- **Mensagens chegando só no final:** a tela só consultava enquanto a última mensagem era do cliente, então parava na primeira resposta do N1. Agora ela consulta a cada 4 s enquanto o atendimento estiver em andamento (`ticket.automation.working`) e quando a aba volta ao foco. O backend busca na issue a cada 6 s no máximo. O botão **Atualizar** força a busca na hora (`GET /api/tickets/:id?agora=1`, mínimo de 2 s).
- **Resposta que parecia automática:** o balão fixo "Recebemos sua mensagem…" saiu da tela. No lugar entra uma linha de **andamento** (fase real da issue), sem avatar e sem aparência de agente. No modo de ensaio (`AGENT_DRY_RUN`), o controlador **não publica mais nenhuma resposta** ao cliente: a tela avisa que é um ensaio e que nenhum agente de IA analisou a mensagem.
- **Resposta de verdade:** exige um provedor de IA. Enquanto `ADAPTADORES` em `automacao/controlador.mjs` estiver vazio e o `AGENT_DRY_RUN` ligado, nenhum agente responde.

## Base de conhecimento (2026-11-11)

- **Onde fica:** `docs/knowledge/`, com `README.md` (formato e regras), `INDEX.md` (gerado) e uma entrada por item (`issue-N.md`, `pr-N.md`), cada uma com frontmatter.
- **Quando nasce uma entrada:** quando uma issue é fechada ou um PR é fechado ou integrado. O workflow `knowledge.yml` (código da `main`, sem executar código de PR) roda `automacao/conhecimento.mjs sync` e commita só em `docs/knowledge/`. O `sync` gera o que faltar, então um evento perdido é coberto pelo seguinte. O gatilho `workflow_run` cobre o que o `ai-agents` fecha com o token das Actions.
- **Curadoria dos agents:** o coordenador devolve `knowledge` (`summary`, `tags`, `lessons`) no relatório; o controlador valida, guarda no estado da issue e o gerador usa na entrada. Sem curadoria, a entrada traz só os fatos do GitHub e diz isso em `source`.
- **Consulta antes de trabalhar:** todos os perfis em `.github/agents/` mandam ler o índice e as entradas parecidas, e o controlador injeta o índice e as 4 entradas mais relevantes no prompt do coordenador, antes das instruções.
- **Ensaio não é conhecimento:** casos de `AGENT_DRY_RUN` entram no índice como `outcome: "ensaio"`, sem o texto simulado, e nunca entram no prompt.
- **Backfill de hoje:** o repositório tinha 1 issue fechada (#4, um ensaio) e nenhum PR, então só `issue-4.md` foi gerada. O repositório original da aula também não tem PRs.
