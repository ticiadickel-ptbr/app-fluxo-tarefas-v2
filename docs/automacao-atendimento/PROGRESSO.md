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
