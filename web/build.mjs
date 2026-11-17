// Builds the browser files the Python app serves from prepermint/static/: the interview client bundle and HTMX.
// The outputs are committed, so the Vercel build needs no Node; CI checks they are up to date.
import { copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const statics = join(here, "..", "prepermint", "static");

await build({
  entryPoints: [join(here, "interview", "page.ts")],
  outfile: join(statics, "interview.js"),
  bundle: true,
  format: "iife",
  target: "es2022",
  minify: true,
  legalComments: "none",
  logLevel: "info",
});

copyFileSync(join(here, "node_modules", "htmx.org", "dist", "htmx.min.js"), join(statics, "htmx.min.js"));
