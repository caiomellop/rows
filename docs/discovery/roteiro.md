# Discovery script / Roteiro da discovery

The discovery is the guided conversation where the AI coach learns what the candidate wants and what they have really delivered. Its output feeds the résumé, the LinkedIn profile and the interview preparation.

A discovery é a conversa guiada em que o coach de IA descobre o que o candidato quer e o que ele realmente entregou. O resultado alimenta o currículo, o LinkedIn e a preparação para entrevistas.

> Questions are written in Portuguese (PT) and English (EN). The coach asks in the language the candidate is using and may switch if they do.
> As perguntas existem em português (PT) e inglês (EN). O coach pergunta no idioma que o candidato está usando e muda se ele mudar.

The structured result is the `DiscoveryContext` schema in [`src/features/discovery/schema.ts`](../../src/features/discovery/schema.ts).

## 1. Rules for every dimension / Regras para todas as dimensões

| # | Rule (EN) | Regra (PT) |
| --- | --- | --- |
| R1 | **Never invent.** Numbers, results, employers, dates and sources come only from the candidate's answers or from a document or link they provided. The coach asks; it never suggests a number or "rounds up". | **Nunca inventar.** Números, resultados, empresas, datas e fontes vêm só das respostas do candidato ou de um documento ou link que ele enviou. O coach pergunta; nunca sugere um número nem "arredonda para cima". |
| R2 | If the candidate does not know a number, record it as unknown (`result: null`). An honest gap is better than a made-up figure. | Se o candidato não sabe um número, registre como desconhecido (`result: null`). Uma lacuna honesta vale mais do que um número inventado. |
| R3 | One question at a time. Short, plain, no jargon. | Uma pergunta por vez. Curta, simples, sem jargão. |
| R4 | Use "I", not "we": when the candidate says "we", ask what *their* part was. | Prefira "eu" a "nós": quando o candidato diz "nós", pergunte qual foi a parte *dele*. |
| R5 | Reflect back what was understood in one sentence before moving on, so the candidate can correct it. | Repita em uma frase o que entendeu antes de seguir, para o candidato poder corrigir. |
| R6 | At most 3 follow-ups per question. After that, record what exists and move on. | No máximo 3 follow-ups por pergunta. Depois disso, registre o que existe e siga. |
| R7 | The candidate can skip any question or stop at any time. Progress is kept. | O candidato pode pular qualquer pergunta ou parar a qualquer momento. O progresso é mantido. |
| R8 | Respect Memory: items the candidate deleted are never used again, and "things to avoid" apply to every question and every summary. | Respeite a Memória: itens que o candidato apagou nunca voltam a ser usados, e as "coisas a evitar" valem para toda pergunta e todo resumo. |
| R9 | Do not ask for data the résumé does not need (ID numbers, health, family, religion, political views, exact salary history). | Não peça dados que o currículo não precisa (documentos, saúde, família, religião, política, histórico salarial exato). |
| R10 | Never log answers. Log ids and sizes only. | Nunca registre as respostas em log. Registre só ids e tamanhos. |

## 2. Order and flow / Ordem e fluxo

1. **Goals / Objetivos** first, because they decide which achievements matter.
2. **Achievements / Resultados obtidos** next, role by role, starting with the most recent or most relevant to the target role.
3. **Hidden results / Resultados escondidos** last, so the coach does not repeat what was already said.
4. **Closing / Fechamento:** the coach shows a summary of the three dimensions, the candidate confirms or corrects, and only then the `DiscoveryContext` is saved.

The dimensions can be revisited later. A dimension is "complete" when its criterion below is met; the coach never ends a dimension early to move faster.

As dimensões podem ser retomadas depois. Uma dimensão está "completa" quando o critério abaixo é atendido; o coach nunca encerra uma dimensão antes para andar mais rápido.

---

## 3. Dimension 1: Goals / Objetivos

**Purpose / Propósito:** know the target role, level, market and the reasons behind the search, so everything else is written for that target.

Saber o cargo-alvo, o nível, o mercado e as razões da busca, para que todo o resto seja escrito para esse alvo.

**Fills / Preenche:** `targetRole`, `targetLevel`, `targetMarket`, `goals[]`.

### Base questions / Perguntas base

| ID | PT | EN |
| --- | --- | --- |
| G1 | Qual cargo você quer ter no seu próximo emprego? | What role do you want in your next job? |
| G2 | Em que nível você se vê nele: estágio, júnior, pleno, sênior, liderança? | What level do you see yourself at: intern, junior, mid, senior, lead? |
| G3 | Em que país, cidade ou modelo de trabalho (presencial, híbrido, remoto) você quer trabalhar? | In which country, city or work model (on-site, hybrid, remote) do you want to work? |
| G4 | Em que idioma você vai fazer as entrevistas e escrever o currículo? | In which language will you interview and write your résumé? |
| G5 | Para quando você quer estar na nova posição? | By when do you want to be in the new position? |
| G6 | O que é mais importante para você nessa mudança? E o que você quer evitar? | What matters most to you in this move? And what do you want to avoid? |

### Follow-ups / Follow-ups

| When / Quando | PT | EN |
| --- | --- | --- |
| The role is vague ("something in tech") / O cargo é vago | Como seria um dia típico nesse cargo, na sua cabeça? | What would a typical day look like in that role, in your mind? |
| Two or more roles / Dois ou mais cargos | Se só um fosse possível, qual você escolheria? | If only one were possible, which would you pick? |
| The level is unclear / O nível não está claro | Qual o tamanho do time e das decisões que você toma hoje? | How big is the team and what decisions do you make today? |
| The market is unclear / O mercado não está claro | Você aceitaria uma vaga fora dessa região? Em que condições? | Would you accept a job outside that region? Under what conditions? |
| A "thing to avoid" is mentioned / Algo a evitar é citado | Quer que eu guarde isso na sua Memória para usar em tudo que eu escrever? | Do you want me to save this in your Memory so I apply it to everything I write? |

### Complete when / Critério de "dimensão completa"

- `targetRole`, `targetLevel` and `targetMarket` are filled **and confirmed by the candidate**, and
- there is at least one goal, stated in the candidate's own words.

Os três campos estão preenchidos **e confirmados pelo candidato**, e há pelo menos uma meta nas palavras dele.

---

## 4. Dimension 2: Achievements / Resultados obtidos

**Purpose / Propósito:** turn "responsible for…" into things the candidate did, with scope, result and a way to check it.

Transformar "responsável por…" em coisas que o candidato fez, com escopo, resultado e uma forma de conferir.

**Fills / Preenche:** `achievements[]` with `what`, `scope`, `result`, `evidence`.

### Base questions / Perguntas base

Ask these for each role or project, 2 or 3 per role.
Pergunte para cada cargo ou projeto, 2 ou 3 por cargo.

| ID | PT | EN |
| --- | --- | --- |
| A1 | Qual foi uma entrega da qual você teve orgulho nesse cargo? | What is a delivery you were proud of in this role? |
| A2 | O que exatamente *você* fez nela? | What exactly did *you* do in it? |
| A3 | Qual era o tamanho disso: quantas pessoas, usuários, clientes, dinheiro ou tempo estavam envolvidos? | How big was it: how many people, users, customers, money or time were involved? |
| A4 | O que mudou depois? Pode ser número, ou algo que antes não dava e passou a dar. | What changed afterwards? It can be a number, or something that was not possible before and became possible. |
| A5 | Como alguém poderia conferir isso: um painel, um documento, um link, um elogio por escrito, uma pessoa que possa confirmar? | How could someone check this: a dashboard, a document, a link, written praise, a person who can confirm? |

### Follow-ups / Follow-ups

| When / Quando | PT | EN |
| --- | --- | --- |
| The answer says "we" / Responde com "nós" | Dessa entrega, qual parte era sua? | In that delivery, which part was yours? |
| There is a number but no source / Há número sem fonte | De onde vem esse número? É exato ou aproximado? | Where does that number come from? Is it exact or approximate? |
| No number / Sem número | Como era antes e como ficou depois? Quanto tempo levava antes? | What was it like before and after? How long did it take before? |
| Result is "I don't know" / Resultado é "não sei" | Tudo bem. Há alguém ou algum relatório que saiba? (Registro como desconhecido.) | That's fine. Is there someone or a report that would know? (I will record it as unknown.) |
| The scope is missing / Falta o escopo | Quantas pessoas dependiam disso, ou quanto tempo durou? | How many people depended on it, or how long did it last? |
| The task is generic ("managed the team") / A tarefa é genérica | Pode me dar um exemplo concreto de um dia em que isso foi difícil? | Can you give a concrete example of a day when this was hard? |

The coach never proposes a figure ("was it around 30%?"). It asks open questions and writes down the candidate's answer as given.

O coach nunca propõe um valor ("foi uns 30%?"). Faz perguntas abertas e anota a resposta do candidato como ele deu.

### Complete when / Critério de "dimensão completa"

- At least **3 achievements**, covering the most recent role and the roles most relevant to the target role, and
- each one has `what` and `evidence`, and
- each one has `result` filled or explicitly marked unknown by the candidate, and
- the candidate confirmed the summary.

No mínimo **3 conquistas**, cobrindo o cargo mais recente e os mais relevantes para o cargo-alvo; cada uma com `what` e `evidence`; `result` preenchido ou marcado como desconhecido pelo candidato; e o resumo confirmado.

---

## 5. Dimension 3: Hidden results / Resultados escondidos

**Purpose / Propósito:** find what the candidate did that they do not call an achievement because it felt like "just part of the job".

Encontrar o que o candidato fez e não considera uma conquista, porque parecia "só parte do trabalho".

**Fills / Preenche:** `hiddenResults[]` with `what` and `evidence`.

### Base questions / Perguntas base

| ID | PT | EN |
| --- | --- | --- |
| H1 | Pelo que as pessoas do seu time ou de outras áreas costumam procurar você? | What do people on your team or in other areas usually come to you for? |
| H2 | Qual problema você resolveu sem que ninguém tivesse pedido? | What problem did you solve that nobody asked you to? |
| H3 | O que ficaria pior ou pararia de funcionar se você saísse amanhã? | What would get worse or stop working if you left tomorrow? |
| H4 | Que processo, documento ou ferramenta você criou ou melhorou? | What process, document or tool did you create or improve? |
| H5 | Que elogio, feedback ou reconhecimento você já recebeu, mesmo informal? | What praise, feedback or recognition have you received, even informally? |

### Follow-ups / Follow-ups

| When / Quando | PT | EN |
| --- | --- | --- |
| "It was nothing" / "Não foi nada" | Quantas pessoas usavam isso, ou quanto tempo isso poupava por semana? | How many people used it, or how much time did it save per week? |
| Helped others / Ajudou outras pessoas | Quem foi ajudado, e o que essa pessoa conseguiu fazer depois? | Who was helped, and what could they do afterwards? |
| Informal leadership / Liderança informal | Você ensinou, decidiu ou coordenou alguma coisa? Para quantas pessoas? | Did you teach, decide or coordinate something? For how many people? |
| Praise with no source / Elogio sem fonte | Tem esse elogio por escrito (mensagem, e-mail, avaliação)? | Do you have that praise in writing (message, email, review)? |
| Overlaps with an achievement / Repete uma conquista | Isso já entrou nos resultados obtidos. Quer que eu mantenha só lá? | This is already in your achievements. Do you want me to keep it only there? |

### Complete when / Critério de "dimensão completa"

- At least **2 hidden results**, each with `what` and `evidence`, **or**
- after 3 different prompts from the base questions, the candidate says they cannot think of any. The coach does not insist (rule R6), and the dimension closes with an empty list.

No mínimo **2 resultados escondidos**, cada um com `what` e `evidence`, **ou** o candidato diz, depois de 3 perguntas diferentes, que não lembra de nenhum. O coach não insiste e a dimensão fecha com lista vazia.

---

## 6. Structured output / Saída estruturada

When the three dimensions are complete and the candidate confirms the summary, the coach produces a `DiscoveryContext`:

| Field | Dimension | Notes |
| --- | --- | --- |
| `targetRole` | Goals | Text, as confirmed by the candidate. |
| `targetLevel` | Goals | One of `intern`, `junior`, `mid`, `senior`, `lead`, `manager`, `director`, `executive`. |
| `targetMarket` | Goals | Text: country, city or remote, and the working language. |
| `goals[]` | Goals | At least one, in the candidate's words. |
| `achievements[]` | Achievements | `what`, `scope`, `result`, `evidence`. `scope` and `result` can be `null` when unknown. `evidence` is required. |
| `hiddenResults[]` | Hidden results | `what`, `evidence`. Can be empty (see criterion above). |

`evidence` has a `kind` and a `detail`:

| `kind` | Meaning | Significado |
| --- | --- | --- |
| `stated` | The candidate said it and has no document. The weakest level, and it is shown as such. | O candidato disse e não tem documento. O nível mais fraco, e é mostrado assim. |
| `document` | A file the candidate uploaded (résumé, report, review). | Um arquivo enviado pelo candidato (currículo, relatório, avaliação). |
| `link` | A public link the candidate gave. | Um link público informado pelo candidato. |
| `reference` | A person who can confirm it, named by the candidate. | Uma pessoa que pode confirmar, indicada pelo candidato. |

Anything that is not in the candidate's answers is not in the `DiscoveryContext`. Generation features that use it (MVP-09, MVP-10) must ask again when a field is missing instead of filling it.

Tudo o que não está nas respostas do candidato não entra no `DiscoveryContext`. As funcionalidades que o usam (MVP-09, MVP-10) devem perguntar de novo quando faltar um campo, em vez de preenchê-lo.

## 7. Out of scope / Fora de escopo

- Long-term career planning (the "Plan" mode).
- The chat engine and the prompt that runs this script (MVP-09).
- Writing skills that use the result (MVP-10).
- Saving the `DiscoveryContext` in the database.
