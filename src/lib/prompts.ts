import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();

/**
 * Long prompts live as Markdown in prompts/<area>/<name>.md, so changing a prompt is a reviewed code change.
 * next.config.ts adds the folder to the server trace so the files exist in the deployed functions.
 */
export function loadPrompt(area: string, name: string): string {
  const key = `${area}/${name}`;
  let text = cache.get(key);
  if (text === undefined) {
    text = readFileSync(path.join(process.cwd(), "prompts", area, `${name}.md`), "utf8");
    cache.set(key, text);
  }
  return text;
}

/** Replaces each {{name}} with its value. A placeholder without a value is a bug, so it throws. */
export function renderPrompt(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => {
    if (!(name in values)) throw new Error(`The prompt placeholder {{${name}}} has no value.`);
    return values[name];
  });
}
