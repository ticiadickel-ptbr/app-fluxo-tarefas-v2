# Fluxo: o que o app faz

O Fluxo é um quadro de tarefas no estilo kanban, com uma área de atendimento por tickets. Ele roda localmente: a interface é em React/Vite, a API em Node e o banco é SQLite.

## Telas

| Caminho | O que tem |
|---|---|
| `/` | Página inicial, com o botão "Abrir meus quadros" |
| `/quadro` | Quadros, listas e cartões |
| `/atendimento` | Tickets de suporte em formato de conversa (`/atendimento/:id` abre um ticket) |

A barra lateral tem o menu **Quadros** / **Atendimento**.

## Como usar o quadro

- **Quadro:** na lateral, clique em **+** ao lado de "Quadros" e dê um nome. Passe o mouse sobre o quadro na lateral para renomear ou excluir. Excluir um quadro apaga as listas e os cartões dele.
- **Lista:** use **Adicionar lista** no fim do quadro. O menu **⋮** da lista tem **Renomear lista** e **Excluir lista**; excluir apaga os cartões da lista.
- **Cartão:** use **Adicionar cartão** na lista. O menu **⋮** do cartão tem:
  - **Editar cartão** (título e descrição);
  - **Mover para** outra lista;
  - **Excluir cartão**.
- **Mover cartão:** arraste o cartão para outra lista ou para outra posição, ou use **Mover para**.
- **Descrição:** cartão com descrição mostra um ícone de nota.
- **Exclusão:** nenhuma exclusão pode ser desfeita.

## Como usar o atendimento

- **Abrir ticket:** **Novo ticket** → escreva a mensagem. A primeira mensagem abre o ticket e vira o título.
- **Enviar mensagem:** Enter envia; Shift+Enter quebra a linha.
- **Status:**
  - **Aberto**;
  - **Aguardando resposta**, quando a última mensagem é do usuário;
  - **Resolvido**. Uma nova mensagem do usuário reabre o ticket.
- **Ações do ticket:** renomear, marcar como resolvido ou reabrir, e excluir.
- **Respostas do atendimento:** chegam pela API, com `POST /api/tickets/:id/messages` e `role: "agent"`. A tela mostra a resposta sozinha em até 5 s.

## O que o app não tem hoje

O app não tem:
- login obrigatório (as rotas de cadastro e login existem na API, mas a interface não usa);
- convite de pessoas;
- permissões por quadro;
- etiquetas, prazos ou datas nos cartões;
- anexos;
- notificações;
- busca.

Quando alguém pedir um desses recursos, ele é um **pedido de produto**, não algo que já existe.

## Rodar localmente

```bash
npm install
npm run dev     # mostra os endereços da interface e da API
npm run build   # gera dist/
npm test        # testes existentes
```
