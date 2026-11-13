# Rows

Copiloto de carreira em [rows.so](https://rows.so) — diagnóstico a partir de CV + PDF do LinkedIn, artefatos editáveis, créditos via Stripe, SSO Google/Apple (e e-mail).

## Documentação

| Doc | Descrição |
|-----|-----------|
| [docs/product/vision.md](docs/product/vision.md) | Visão de produto |
| [docs/product/mvp.md](docs/product/mvp.md) | Escopo MVP, fluxos, skills, créditos |
| [docs/architecture/overview.md](docs/architecture/overview.md) | Stack, data model, ordem de implementação |
| [docs/architecture/skills.md](docs/architecture/skills.md) | Contrato das skills |
| [docs/architecture/billing.md](docs/architecture/billing.md) | Stripe Checkout + ledger |

## Preview local dos docs

```bash
node preview/server.mjs
```

Abra [http://127.0.0.1:4173/](http://127.0.0.1:4173/). Detalhes em [preview/README.md](preview/README.md).
