/**
 * The prototype has no login and no database, so the environment is its only gate: it opens where
 * PROTOTYPE_ENABLED=true (a local run or a protected preview deployment) and never in production.
 * Every page and route checks this first, because anyone who can reach an open route spends our API credits.
 */
export function prototypeEnabled(): boolean {
  return process.env.PROTOTYPE_ENABLED === "true";
}

export function disabledResponse(): Response {
  return new Response(null, { status: 404 });
}
