# Rows — contrato das skills

Overview: [`overview.md`](./overview.md) · Billing: [`billing.md`](./billing.md) · MVP: [`../product/mvp.md`](../product/mvp.md)

## Contrato

Cada skill é um módulo com:

- `id`, `description`, `inputSchema`, `creditCost` (número; `inline_complete` usa fração)
- `run(ctx)` → `{ artifacts, usage, suggestedNext? }`
- `ctx` inclui: `userId`, perfil/revisão atual, diagnóstico ativo, arquivos, thread de chat

### Runtime (`registry.run`)

1. Valida input contra o schema
2. Reserva créditos na wallet
3. Executa (sync ou job)
4. Persiste `SkillRun` + artifacts
5. Confirma débito ou **estorna** em falha

## Skills do MVP

### `parse_documents`

- **Entrada:** referências a `Document` (`cv`, `linkedin_pdf`)
- **Saída:** `ProfileRevision` com seções (`headline`, `about`, `experiences[]`, `education[]`, `skills[]`)
- **Custo:** 5
- **Notas:** heurística + LLM; usuário pode corrigir o parse na UI

### `diagnose_profile`

- **Entrada:** `ProfileRevision` (e docs brutos se necessário)
- **Saída:** `Diagnosis` — posicionamento, lacunas, forças, hipóteses
- **Custo:** 15
- **Notas:** hipóteses explícitas; não inventa empregadores/datas

### `generate_artifacts`

- **Entrada:** diagnóstico + perfil
- **Saída:** artifacts iniciais (`cv`, `linkedin`, experiências)
- **Custo:** 25
- **Notas:** gera artefatos editáveis, não one-shot final

### `edit_section`

- **Entrada:** `sectionId` / path + instrução opcional
- **Saída:** `{ before, after, diff, rationale }` + nova `ArtifactRevision`
- **Custo:** 8

### `rewrite_experience`

- **Entrada:** `experienceId` + restrições (tom, sem inventar métricas)
- **Saída:** bullets/narrativa + diff
- **Custo:** 12

### `inline_complete`

- **Entrada:** texto do campo, cursor, ids de artifact + diagnosis
- **Saída:** `{ suggestion, cursorContext }`
- **Custo:** 0.5 (fração por sugestão gerada)
- **UX:** Tab aceita, Esc ignora, “outra” regenera

### `export_pack`

- **Entrada:** revisionIds + `template`: `rows` | `us` | `eu`
- **Saída:** arquivos CV (DOCX/PDF) + pacote de textos LinkedIn
- **Custo:** 3

## Fora desta trilha

- `plan_career` / modo Plan — branch de produto separada; conecta depois ao `ctx` das skills de edição/geração

## Regras transversais

- Edições sempre expõem diff por seção tocada
- Só fatos presentes nas fontes; marcar hipótese quando inevitável
- Model routing: modelos mais baratos em parse/inline; mais capazes em diagnóstico/geração
- Rate limit por `userId` no registry
