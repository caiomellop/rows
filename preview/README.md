# Rows docs preview

Camada local para navegar a documentação em `docs/` no navegador. **Não altera** os markdowns de produto/arquitetura.

## Rodar

Na raiz do repositório:

```bash
node preview/server.mjs
```

Abra [http://127.0.0.1:4173/](http://127.0.0.1:4173/).

Porta alternativa:

```bash
PORT=5180 node preview/server.mjs
```

## O que serve

| Rota | Conteúdo |
|------|----------|
| `/` | UI do preview (`preview/index.html`) |
| `/preview/*` | assets da UI |
| `/docs/*` | markdowns originais (somente leitura) |

Navegação: Visão · MVP · Overview · Skills · Billing.
