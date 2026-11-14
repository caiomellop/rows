import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { getPublicProfile } from "@/lib/dal";
import { parseHandleSegment, profilePath } from "@/lib/profile-url";

/**
 * The card LinkedIn shows in the Featured section (product plan §4): a mini
 * resume with name, headline, verified stack and one project.
 */

export const alt = "Portfolio on Rows";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const fontDir = join(process.cwd(), "src/assets/og");
const fonts = Promise.all([
  readFile(join(fontDir, "EBGaramond-Regular.ttf")),
  readFile(join(fontDir, "EBGaramond-Italic.ttf")),
  readFile(join(fontDir, "Figtree-Regular.ttf")),
  readFile(join(fontDir, "Figtree-SemiBold.ttf")),
]);

const INK = "#111111";
const FG2 = "#52504C";
const FG3 = "#706E69";
const PAGE = "#FCFCFA";
const PANEL = "#F5F4F1";

function Mark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ display: "flex", width: 40, height: 40, borderRadius: 11, background: INK, flexDirection: "column", justifyContent: "center", gap: 4, padding: "0 8px" }}>
        <div style={{ height: 5, width: 24, borderRadius: 3, background: "white" }} />
        <div style={{ height: 5, width: 17, borderRadius: 3, background: "white" }} />
        <div style={{ height: 5, width: 21, borderRadius: 3, background: "white" }} />
      </div>
      <div style={{ fontFamily: "Figtree", fontWeight: 600, fontSize: 30, letterSpacing: -1.2, color: INK }}>Rows</div>
    </div>
  );
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const username = parseHandleSegment((await params).handle);
  const [data, [garamond, garamondItalic, figtree, figtreeSemi]] = await Promise.all([username ? getPublicProfile(username) : null, fonts]);

  const fontOptions = {
    ...size,
    fonts: [
      { name: "Garamond", data: garamond, weight: 400 as const, style: "normal" as const },
      { name: "Garamond", data: garamondItalic, weight: 400 as const, style: "italic" as const },
      { name: "Figtree", data: figtree, weight: 400 as const, style: "normal" as const },
      { name: "Figtree", data: figtreeSemi, weight: 600 as const, style: "normal" as const },
    ],
  };

  if (!data) {
    return new ImageResponse(
      (
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: PAGE, padding: 72 }}>
          <Mark />
          <div style={{ display: "flex", fontFamily: "Garamond", fontSize: 76, color: FG2, lineHeight: 1.05 }}>
            Your proof of work,&nbsp;<span style={{ fontStyle: "italic", color: INK }}>readable by recruiters.</span>
          </div>
          <div style={{ fontFamily: "Figtree", fontSize: 28, color: FG3 }}>rows.so</div>
        </div>
      ),
      fontOptions,
    );
  }

  const { profile, stack, projects, image } = data;
  const name = profile.displayName ?? profile.username;
  const top = projects.find((p) => p.cardStatus === "approved" && p.card) ?? projects[0];
  const topLine = top ? (top.cardStatus === "approved" && top.card ? top.card.whatItIs : top.description) : null;
  const host = (process.env.NEXT_PUBLIC_APP_URL ?? "https://rows.so").replace(/^https?:\/\//, "").replace(/\/$/, "");

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: PAGE, padding: "56px 72px", fontFamily: "Figtree" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Mark />
          {profile.openToWork ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(52,110,78,0.1)", color: "#285C40", borderRadius: 999, padding: "8px 18px", fontSize: 24, fontWeight: 600 }}>
              <div style={{ width: 10, height: 10, borderRadius: 5, background: "#348C5A" }} />
              Open to work
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", gap: 40, marginTop: 44, alignItems: "center" }}>
          {image ? (
            <img src={image} width={148} height={148} style={{ borderRadius: 32, border: "1px solid rgba(0,0,0,0.08)" }} alt="" />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ fontFamily: "Garamond", fontSize: 80, color: INK, lineHeight: 1, letterSpacing: -1 }}>{truncate(name, 28)}</div>
            {profile.headline ? <div style={{ fontSize: 32, color: FG2, marginTop: 14 }}>{truncate(profile.headline, 60)}</div> : null}
          </div>
        </div>

        {stack.length ? (
          <div style={{ display: "flex", gap: 12, marginTop: 36, flexWrap: "wrap" }}>
            {stack.slice(0, 4).map((s) => (
              <div key={s.language} style={{ display: "flex", gap: 8, background: PANEL, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 999, padding: "8px 18px", fontSize: 24 }}>
                <span style={{ color: INK, fontWeight: 600 }}>{s.language}</span>
                <span style={{ color: FG3 }}>{`${s.repos} repo${s.repos === 1 ? "" : "s"}`}</span>
              </div>
            ))}
          </div>
        ) : null}

        {top && topLine ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 30, gap: 6 }}>
            <div style={{ fontSize: 22, color: FG3 }}>{top.name}</div>
            <div style={{ fontSize: 28, color: FG2, lineHeight: 1.35 }}>{truncate(topLine, 110)}</div>
          </div>
        ) : null}

        <div style={{ display: "flex", marginTop: "auto", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, color: FG3 }}>{`${host}${profilePath(profile.username)}`}</div>
          <div style={{ display: "flex", background: INK, color: PAGE, borderRadius: 16, padding: "14px 28px", fontSize: 26, fontWeight: 600 }}>View portfolio →</div>
        </div>
      </div>
    ),
    fontOptions,
  );
}
