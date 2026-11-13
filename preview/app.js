const DOCS = [
  {
    group: "Produto",
    items: [
      { id: "vision", title: "Visão", path: "/docs/product/vision.md" },
      { id: "mvp", title: "MVP", path: "/docs/product/mvp.md" },
    ],
  },
  {
    group: "Arquitetura",
    items: [
      { id: "overview", title: "Overview", path: "/docs/architecture/overview.md" },
      { id: "skills", title: "Skills", path: "/docs/architecture/skills.md" },
      { id: "billing", title: "Billing", path: "/docs/architecture/billing.md" },
    ],
  },
];

const DEFAULT_ID = "vision";

const navEl = document.getElementById("nav-tree");
const contentEl = document.getElementById("content");
const crumbEl = document.getElementById("crumb");

function flattenDocs() {
  return DOCS.flatMap((g) => g.items);
}

function findDoc(id) {
  return flattenDocs().find((d) => d.id === id) ?? flattenDocs()[0];
}

function currentId() {
  const hash = location.hash.replace(/^#\/?/, "");
  return hash || DEFAULT_ID;
}

function renderNav(activeId) {
  navEl.innerHTML = DOCS.map((group) => {
    const links = group.items
      .map((item) => {
        const active = item.id === activeId ? " active" : "";
        return `<a class="nav-link${active}" href="#/${item.id}">${item.title}</a>`;
      })
      .join("");
    return `<div class="nav-group"><p class="nav-group-title">${group.group}</p>${links}</div>`;
  }).join("");
}

function rewriteDocLinks(markdown) {
  return markdown
    .replace(/\]\(\.\/vision\.md\)/g, "](#/vision)")
    .replace(/\]\(\.\/mvp\.md\)/g, "](#/mvp)")
    .replace(/\]\(\.\/overview\.md\)/g, "](#/overview)")
    .replace(/\]\(\.\/skills\.md\)/g, "](#/skills)")
    .replace(/\]\(\.\/billing\.md\)/g, "](#/billing)")
    .replace(/\]\(\.\.\/product\/vision\.md\)/g, "](#/vision)")
    .replace(/\]\(\.\.\/product\/mvp\.md\)/g, "](#/mvp)")
    .replace(/\]\(\.\.\/architecture\/overview\.md\)/g, "](#/overview)")
    .replace(/\]\(\.\.\/architecture\/skills\.md\)/g, "](#/skills)")
    .replace(/\]\(\.\.\/architecture\/billing\.md\)/g, "](#/billing)");
}

function extractMermaid(markdown) {
  const blocks = [];
  const replaced = markdown.replace(/```mermaid\n([\s\S]*?)```/g, (_, code) => {
    const idx = blocks.length;
    blocks.push(code.trim());
    return `\n\n<div class="mermaid" data-mermaid-idx="${idx}"></div>\n\n`;
  });
  return { markdown: replaced, blocks };
}

async function renderMermaid(blocks) {
  if (!window.mermaid || blocks.length === 0) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "neutral",
    securityLevel: "loose",
  });
  const nodes = contentEl.querySelectorAll(".mermaid[data-mermaid-idx]");
  for (const node of nodes) {
    const idx = Number(node.getAttribute("data-mermaid-idx"));
    const def = blocks[idx];
    if (!def) continue;
    try {
      const { svg } = await mermaid.render(`mmd-${idx}-${Date.now()}`, def);
      node.innerHTML = svg;
    } catch (err) {
      node.textContent = def;
      node.title = String(err);
    }
  }
}

async function loadDoc(id) {
  const doc = findDoc(id);
  renderNav(doc.id);
  crumbEl.textContent = `docs → ${doc.path.replace(/^\//, "")}`;
  contentEl.innerHTML = `<p class="loading">Carregando ${doc.title}…</p>`;

  try {
    const res = await fetch(doc.path, { cache: "no-store" });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const raw = await res.text();
    const linked = rewriteDocLinks(raw);
    const { markdown, blocks } = extractMermaid(linked);
    marked.setOptions({ gfm: true, breaks: false });
    contentEl.innerHTML = marked.parse(markdown);
    await renderMermaid(blocks);
    contentEl.querySelectorAll("a[href^='#/']").forEach((a) => {
      a.addEventListener("click", () => {
        /* hashchange handles load */
      });
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    contentEl.innerHTML = `<p class="error">Não foi possível carregar <code>${doc.path}</code>. ${String(err.message || err)}</p>`;
  }
}

function onRoute() {
  loadDoc(currentId());
}

window.addEventListener("hashchange", onRoute);
onRoute();
