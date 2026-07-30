# Handoff - Conteudo CCAF no Magic Cards, progresso nos cursos e o que falta

Data: 2026-07-27
Sessao anterior: `~/.claude/chats/2026-07-27-ccaf-deck-e-tunnel-coolify.md`
Foco da proxima sessao: **fechar as lacunas de conteudo do CCAF conforme o David avanca nos
cursos da Anthropic Academy.**

---

## 1. Contexto em uma frase

O David quer passar no **Claude Certified Architect - Foundations (CCAF)**. Nesta sessao foram
criados 253 cards de estudo no Magic Cards cobrindo os 5 dominios do blueprint + os 6 cenarios
do exame. O metodo que funcionou: quando ele faz um quiz de curso e erra questoes, os erros
viram cards novos.

**Resultado do exame: ainda nao reportado.** Confirme com ele antes de assumir qualquer coisa.

---

## 2. O conteudo que existe hoje

Ja no ar em `http://david-homelab:5001` (tailnet-only) e versionado em `content/ccaf-*.json`.
**Nao releia os arquivos pra saber o que tem** - o resumo abaixo basta pra decidir onde mexer.

| Subject id | Cards | Dominio / peso no exame |
|---|---|---|
| `ccaf-1-agentic` | 53 | D1 Agentic Architecture - 27% |
| `ccaf-2-claude-code` | 42 | D2 Claude Code - 20% |
| `ccaf-3-prompting` | 37 | D3 Prompt Engineering - 20% |
| `ccaf-4-mcp-tools` | **62** | D4 Tools & MCP - 18% |
| `ccaf-5-context` | 34 | D5 Context & Reliability - 15% |
| `ccaf-6-scenarios` | 25 | Os 6 cenarios do exame |

Mix por deck: ~40% quiz (o exame e multipla escolha), resto entre `open`, `type-answer` e
`match`. **Todos os 253 tem exatamente um hint**, que aponta a ideia discriminante sem nomear a
resposta.

Commits: `a2cd6af` (criacao) e `56702f9` (hints + cards de MCP). Detalhe de cada um esta na
mensagem de commit - nao repita aqui.

### Convencoes que voce precisa respeitar ao adicionar cards

- **Ids sequenciais por deck e tipo**: `ccaf4-quiz-027`, `ccaf1-open-021`. O import faz upsert
  por id, entao reusar um id **sobrescreve** o card existente.
- **`matchPairs`: os valores de `right` tem que ser unicos** dentro do card, senao o import
  rejeita com `cards.matchRightsUnique`. Nao esta documentado em lugar nenhum - descoberto na
  marra nesta sessao.
- **Um hint por card**, no mesmo estilo: estreita a escolha, nao entrega. Depois de escrever,
  rode a validacao da secao 6 pra garantir que nenhum hint contem a propria resposta.
- Regras de validacao por tipo (quiz 2-8 choices com exatamente um `isCorrect`, etc.) estao em
  `docs/content-authoring.md` secao 8. Leia isso antes de escrever, e nao de memoria.

### Divergencia deliberada a manter

`extended thinking` e ensinado como **`budget_tokens`**, que e o que o blueprint do exame
(mar/2026) cobra - mesmo a doc atual ja tendo migrado pra adaptive thinking. **Nao "corrija"
isso** sem falar com ele. Se ele quiser conteudo pos-exame, e card novo, nao edicao.

---

## 3. Progresso nos cursos - o que se sabe de fato

> **Atencao: so ha UM dado concreto.** Tudo mais nesta secao e "status desconhecido". Comece a
> proxima sessao perguntando quais cursos ele completou desde entao, em vez de deduzir.

### Confirmado

**Model Context Protocol: Advanced Topics** - quiz feito, **7/10 (70%), passou**, 3 minutos.

Os 3 erros e o que foi feito sobre eles:

| # | Questao | Resposta certa | Cobertura criada |
|---|---|---|---|
| 5 | Respostas HTTP simples, JSON puro sem streaming | `json_response=True` | `ccaf4-open-016`, `ccaf4-quiz-019/020/026` |
| 6 | Transport mais simples pra testar local | Stdio | `ccaf4-open-014`, `ccaf4-quiz-018` |
| 7 | Transport que exige mesma maquina | Stdio | `ccaf4-quiz-017`, `ccaf4-type-007`, `ccaf4-match-005` |

Q6 e Q7 sao **o mesmo buraco** (stdio), por isso ganharam peso extra - 5 cards ao todo, atacando
a raiz: stdin/stdout sao pipes entre dois processos do mesmo SO, entao nao ha o que rotear.

O quiz tambem revelou temas que o deck **nao tinha** e que foram adicionados: **roots** (so
existia entre parenteses, virou 5 cards), **SSE** pra mensagens iniciadas pelo servidor,
**request-result vs notification** (a pista e o campo `id`), **progress notifications**, e o
fluxo de **sampling** com os dois checkpoints de aprovacao.

Isso levou o deck 4 de 39 -> 62 cards.

### Desconhecido - perguntar

| Curso | Dominio que alimenta | Status |
|---|---|---|
| Building with the Claude API | D1 + D3 + D5 (**~60% do exame**) | ? |
| Claude Code in Action | D2 (20%) | ? |
| Introduction to subagents | D1 (multi-agente) | ? |
| Introduction to Model Context Protocol | D4 (18%) | ? |
| AI Fluency / Claude 101 / Platform 101 | base conceitual, pouco cai | ? |
| Introduction to agent skills | D2 parcial, menor retorno | ? |

Ordem de dependencia que ele mesmo levantou: `AI Fluency -> Building with the Claude API ->
Claude Platform 101 (opcional) -> Claude Code in Action -> Intro MCP -> MCP Advanced ->
agent skills -> subagents`. Com um ajuste recomendado na sessao: **subagents sobe pra logo
depois do Claude Code in Action**, porque alimenta o D1 (o dominio mais pesado) e nao depende
de agent skills.

---

## 4. O que ainda falta

### No conteudo

1. **Rodar o loop erro -> card pra cada curso que ele fizer.** E o que deu mais retorno. Peca o
   resultado do quiz (questoes, resposta dele, resposta certa) e trate cada erro como um buraco
   a preencher - incluindo os temas vizinhos que o quiz revelou e o deck nao cobria.
2. **Cobertura pos-quiz dos outros cursos**: nenhum outro quiz foi visto ainda. O deck 4 e o
   unico que passou por esse ciclo, e nao por acaso e o maior (62).
3. **Nada foi validado contra questoes reais do exame.** O deck foi escrito a partir do
   blueprint + doc oficial. Se ele fizer simulados (Udemy, certsafari), os erros de la sao a
   melhor fonte de card que existe.

### Fora do conteudo (contexto, nao acao)

O `git push` no magic-cards **agora dispara deploy automatico** - foi consertado nesta sessao
com um Cloudflare Tunnel. Runbook completo em `~/workspace/homelab/cloudflare-tunnel-coolify.md`.
Relevante aqui so por um motivo: **adicionar cards nao precisa de deploy**. Conteudo vive no
Postgres e entra pela API; deploy e do codigo. Sao caminhos separados.

Pendencia menor do repo: o CI esta desligado (`.github/workflows/ci.yml.disabled`). Pra reativar
sao **duas** coisas - renomear pra `ci.yml` **e** descomentar os triggers la dentro. Uma sem a
outra nao funciona.

---

## 5. Como publicar cards novos

A chave de producao vive fora de git, em `~/workspace/homelab/.secrets/magic-cards-prod.env`.
**Use `source`, nunca `cat`/`grep`** - assim ela nunca aparece no transcript:

```bash
set -a; . ~/workspace/homelab/.secrets/magic-cards-prod.env; set +a
cd ~/workspace/magic-cards
curl -sS -X POST http://david-homelab:5001/v1/catalog/import \
  -H "x-api-key: $CONTENT_API_KEY" -H 'Content-Type: application/json' \
  --data-binary @content/ccaf-4-mcp-tools.json
```

Retorna `{subjects:{...},cards:{created,updated},errors:[]}`. **Import e idempotente por id**, e
cards invalidos sao reportados em `errors[]` e pulados - os bons entram. Se der erro, corrija so
aqueles e reenvie.

Escreva sempre no arquivo `content/*.json` **e** importe. O banco e a fonte da verdade, o arquivo
e o snapshot - se voce so importar, o repo fica dessincronizado.

---

## 6. Validacao antes de importar

Rode isto na raiz do magic-cards. Pega os erros que o import rejeitaria, mais hints faltando ou
que vazam a resposta:

```bash
node -e "
const fs=require('fs');let cards=[],bad=[];
for(const f of fs.readdirSync('content').filter(x=>x.startsWith('ccaf-')))
  cards.push(...JSON.parse(fs.readFileSync('content/'+f,'utf8')).cards);
for(const c of cards){
  const h=c.hints&&c.hints.length===1?c.hints[0]:null;
  if(!h){bad.push(c.id+' sem hint');continue}
  if(h.length<25) bad.push(c.id+' hint curto');
  if(c.type==='quiz'){const t=c.choices.find(x=>x.isCorrect).text.replace(/[\\\`*]/g,'').toLowerCase();
    if(t.length>12&&h.toLowerCase().includes(t.slice(0,25))) bad.push(c.id+' HINT VAZA');}
  if(c.shortAnswer&&String(c.shortAnswer).length>3&&h.toLowerCase().includes(String(c.shortAnswer).toLowerCase()))
    bad.push(c.id+' HINT VAZA');
  if(c.type==='match'){const p=c.matchPairs;
    if(new Set(p.map(x=>x.right)).size!==p.length) bad.push(c.id+' rights duplicados');}
}
console.log('cards',cards.length); console.log(bad.length?bad.join('\n'):'OK');
"
```

---

## 7. Suggested skills

- **`claude-api`** - **invoque antes de escrever ou revisar qualquer card**. Todo o deck e sobre
  a API/Claude Code/MCP, e o gatilho da skill cobre exatamente isso. Foi a ausencia desse habito
  que quase deixou passar `budget_tokens` como se fosse a recomendacao atual. Nao responda de
  memoria sobre pricing, limites, caching ou nomes de modelo.
- **`save-session`** - no fim da sessao, pra manter a serie de registros.
- **`handoff`** - se a sessao seguinte tambem terminar com trabalho em aberto.

Nao ha necessidade de skill de codigo (`pr-review`, `simplify`, `nestjs-*`): este trabalho e
conteudo em JSON, nao codigo de aplicacao.

---

## 8. Regras de trabalho que valeram nesta sessao

- **Confira na doc oficial, nao na memoria.** Foram verificados na fonte: hooks, memory/CLAUDE.md,
  permissions, precedencia de settings, prompt caching, `stop_reason`, arquitetura MCP,
  "Building effective agents" e extended thinking. Varios detalhes tinham mudado.
- **Anotacao antiga nao e fato.** Nesta sessao um diagnostico errado veio de confiar num
  parentese explicativo de um doc de duas semanas atras. Quando um registro afirma algo
  verificavel, verifique.
- **pt-BR informal** nas respostas ao David; **ingles simples** dentro dos cards.
- Nao commitar nem mencionar links de sessao. Sem `Co-Authored-By`.

---

## 9. Referencias

- Deck vivo: `http://david-homelab:5001` (tailnet)
- Fonte dos cards: `content/ccaf-*.json` neste repo
- Como escrever card: `docs/content-authoring.md` (tipos, validacao, fluxo de import)
- Auth do catalogo: `docs/content-catalog.md`
- Registro completo da sessao: `~/.claude/chats/2026-07-27-ccaf-deck-e-tunnel-coolify.md`
- Infra do deploy: `~/workspace/homelab/cloudflare-tunnel-coolify.md`
