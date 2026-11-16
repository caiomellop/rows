import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isFluxVoice, listenUrl, speakUrl } from "./deepgram-urls";
import { mintBrowserToken } from "./deepgram";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Deepgram addresses", () => {
  it("opens Flux Multilingual with raw 16 kHz audio, an end-of-turn threshold and the English hint", () => {
    const url = new URL(listenUrl());
    expect(url.origin + url.pathname).toBe("wss://api.deepgram.com/v2/listen");
    expect(url.searchParams.get("model")).toBe("flux-general-multi");
    expect(url.searchParams.get("encoding")).toBe("linear16");
    expect(url.searchParams.get("sample_rate")).toBe("16000");
    expect(url.searchParams.get("eot_threshold")).toBe("0.8");
    expect(url.searchParams.getAll("language_hint")).toEqual(["en"]);
  });

  it("opens the voice socket for one Flux voice with raw 24 kHz audio", () => {
    const url = new URL(speakUrl("flux-cliff-en"));
    expect(url.origin + url.pathname).toBe("wss://api.deepgram.com/v2/speak");
    expect(url.searchParams.get("model")).toBe("flux-cliff-en");
    expect(url.searchParams.get("sample_rate")).toBe("24000");
  });

  it("sends the voice's speed and expressivity when they are given", () => {
    const url = new URL(speakUrl("flux-sienna-en", { speed: 0.9, expressivity: 1 }));
    expect(url.searchParams.get("model")).toBe("flux-sienna-en");
    expect(url.searchParams.get("speed")).toBe("0.9");
    expect(url.searchParams.get("expressivity")).toBe("1");
  });

  it("leaves them out when they are not given, so the voice keeps its own pace", () => {
    const url = new URL(speakUrl("flux-cliff-en"));
    expect(url.searchParams.has("speed")).toBe(false);
    expect(url.searchParams.has("expressivity")).toBe(false);
  });

  it("refuses values Deepgram would reject with a 400, instead of closing the voice socket mid-interview", () => {
    expect(() => speakUrl("flux-cliff-en", { speed: 2 })).toThrow("Speed 2 is not valid");
    expect(() => speakUrl("flux-cliff-en", { speed: 0.42 })).toThrow("Speed 0.42 is not valid");
    expect(() => speakUrl("flux-cliff-en", { expressivity: 3 })).toThrow("Expressivity 3 is not valid");
    expect(() => speakUrl("flux-cliff-en", { expressivity: 0.5 })).toThrow("Expressivity 0.5 is not valid");
    expect(() => speakUrl("flux-cliff-en", { speed: 0.5, expressivity: -2 })).not.toThrow();
    expect(() => speakUrl("flux-cliff-en", { speed: 1.5, expressivity: 2 })).not.toThrow();
  });

  it("accepts only Flux voice names, so a setting cannot inject query parameters", () => {
    expect(isFluxVoice("flux-sienna-en")).toBe(true);
    expect(isFluxVoice("aura-2-thalia-en")).toBe(false);
    expect(isFluxVoice("flux-cliff-en&x=1")).toBe(false);
    expect(() => speakUrl("flux-cliff-en&x=1")).toThrow("not a Flux voice");
  });
});

describe("browser token", () => {
  const respond = (status: number, body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

  it("asks Deepgram for a token with the server key and returns only the token", async () => {
    vi.stubEnv("DEEPGRAM_API_KEYS", "secret-key");
    const fetchMock = respond(200, { access_token: "jwt-token", expires_in: 600 });
    vi.stubGlobal("fetch", fetchMock);

    await expect(mintBrowserToken(900)).resolves.toBe("jwt-token");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.deepgram.com/v1/auth/grant");
    expect((init.headers as Record<string, string>).Authorization).toBe("Token secret-key");
    expect(JSON.parse(init.body as string)).toEqual({ ttl_seconds: 900 });
  });

  it("uses the first key when several are listed and caps the lifetime at one hour", async () => {
    vi.stubEnv("DEEPGRAM_API_KEYS", " first-key , second-key");
    const fetchMock = respond(200, { access_token: "t" });
    vi.stubGlobal("fetch", fetchMock);

    await mintBrowserToken(99_999);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Token first-key");
    expect(JSON.parse(init.body as string)).toEqual({ ttl_seconds: 3600 });
  });

  it("explains a key that is missing, rejected or too weak, without leaking it", async () => {
    await expect(mintBrowserToken(60)).rejects.toThrow("Set DEEPGRAM_API_KEYS");

    vi.stubEnv("DEEPGRAM_API_KEYS", "secret-key");
    vi.stubGlobal("fetch", respond(401, {}));
    await expect(mintBrowserToken(60)).rejects.toThrow("rejected the key");

    vi.stubGlobal("fetch", respond(403, { err_code: "FORBIDDEN" }));
    await expect(mintBrowserToken(60)).rejects.toThrow("Member role");

    vi.stubGlobal("fetch", respond(500, {}));
    const error = await mintBrowserToken(60).catch((e: Error) => e);
    expect((error as Error).message).toContain("500");
    expect((error as Error).message).not.toContain("secret-key");
  });
});
