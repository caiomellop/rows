# Rows — visão de produto

## O que é

**Rows** é um copiloto de carreira em [rows.so](https://rows.so). A IA ajuda a pessoa a definir objetivos profissionais, a se identificar como profissional e a ter uma dimensão clara sobre a própria carreira — não só a “melhorar um texto”.

O produto parte do que a pessoa já é (evidência nos documentos) e do onde quer chegar (plano e diagnóstico), e materializa isso em artefatos editáveis: CV, LinkedIn e descrições de experiência.

## Estratégia de entrada: diagnóstico

O primeiro passo no Rows é um **diagnóstico de carreira**, gerado a partir de dois inputs:

1. **Upload do CV** (PDF/DOCX)
2. **PDF exportado do LinkedIn** (modelo de exportação do próprio LinkedIn)

A inspiração de produto é a estratégia do [idem.so](https://idem.so) — onboarding por evidência e leitura estruturada do perfil — com a construção do Rows centrada nesses dois documentos como fonte da verdade.

O diagnóstico responde, em linguagem clara:

- Quem a pessoa parece ser hoje (posicionamento implícito no CV e no LinkedIn)
- Lacunas, inconsistências e oportunidades entre os dois materiais
- Sinais de força e de narrativa fraca
- Hipóteses de direção profissional (não verdades absolutas)

Esse diagnóstico é o contexto base para o resto do produto: plano, geração de artefatos, sugestões inline e exportação.

## Do diagnóstico aos artefatos

Com base no diagnóstico (e, quando existir, no modo **Plan**), a IA cria **artefatos novos** para a pessoa:

- **CV revisado** — estrutura e copy alinhados ao posicionamento desejado
- **LinkedIn reescrito** — headline, about, experiências e demais seções
- **Descrições de experiência** — bullets e narrativas de impacto, sem inventar fatos fora das fontes

A geração não é um one-shot descartável: cada artefato vira um documento vivo no editor.

## Edição em tempo real

Os textos gerados precisam poder ser **editados em tempo real** pela pessoa. A IA propõe; a pessoa manda. Aceitar, cortar, reescrever e ajustar tom são operações de primeira classe — o Rows não tranca o usuário numa versão “final” da IA.

## Sugestão de texto inline (estilo Grok)

No editor, ao digitar ou pausar, a IA pode sugerir a **continuação do texto no próprio campo**:

| Ação | Comportamento |
|------|----------------|
| **Tab** | Aceita a sugestão |
| **Esc** | Ignora |
| Pedir outra | Gera uma versão alternativa |

Por baixo, roda um **completion** no contexto do artefato atual e do diagnóstico (e do plano ativo, se houver). Cada sugestão debita uma **fração de crédito** — barata o suficiente para uso fluido, contabilizada o suficiente para não ser abusada.

## Exportação: três templates

Na exportação do CV, o Rows oferece três templates principais, cada um com formatação e convenções do mercado correspondente:

1. **Default Rows** — identidade visual e hierarquia do produto
2. **Template US** — convenções do mercado americano (ex.: ênfase em impacto, densidade, normas locais)
3. **Template europeu** — convenções europeias (ex.: estrutura, foto/dados pessoais conforme o fluxo do template, tom e layout)

O conteúdo é o mesmo artefato; muda a apresentação e as regras de formatação do mercado escolhido.

## Preview LinkedIn

Antes de exportar ou copiar para o LinkedIn, a pessoa pode **visualizar o perfil como uma tela simulada do LinkedIn** — não só um bloco de texto “parecido”. O perfil inteiro é renderizado como a pessoa veria no site (headline, about, experiências, etc.), para validar narrativa e leitura visual antes de levar o conteúdo para fora do Rows.

## Contexto de plataforma (fundo)

O Rows roda sobre uma plataforma de copiloto com:

- **Skills** — capacidades nomeadas (parse, diagnóstico, plano, edição, export) com contrato claro de entrada/saída
- **Créditos via Stripe** — pacotes comprados; skills e sugestões inline debitam saldo
- **SSO Google e Apple** — entrada sem fricção
- **Modo Plan** — ajuda a elaborar objetivos de carreira e alimenta um prompt/contexto mais preciso para geração e edição

Esses pilares sustentam o produto; a experiência que o usuário sente primeiro é: **upload → diagnóstico → artefatos editáveis → preview → export**.

## Princípios

1. **Diagnóstico antes da reescrita** — sem entender o perfil, não gerar artefato “bonito” vazio.
2. **Evidência nas fontes** — CV + PDF do LinkedIn são a base; hipóteses ficam explícitas.
3. **Pessoa no controle** — edição em tempo real e sugestão inline a serviço do autor, não no lugar dele.
4. **Validar como o mundo vê** — preview LinkedIn e templates de mercado antes de sair do Rows.
5. **Custo legível** — créditos para skills e frações para completions inline.

## Job central

> “A partir do meu CV e do meu LinkedIn exportado, me dá um diagnóstico honesto da minha carreira, gera artefatos que eu posso editar ao vivo, e me deixa ver e exportar como o mercado vai ler.”
