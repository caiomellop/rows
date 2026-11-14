import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { PublicProfile } from "@/lib/dal";
import { formatRange } from "@/lib/insights";

/**
 * ATS-ready resume (product plan §3.6): one column, real text, standard
 * headings, no tables. Built-in Helvetica keeps text extraction reliable.
 */

const s = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, color: "#111111" },
  name: { fontFamily: "Helvetica-Bold", fontSize: 20, marginBottom: 2 },
  headline: { fontSize: 11, color: "#333333", marginBottom: 4 },
  contact: { fontSize: 9, color: "#333333" },
  link: { color: "#111111", textDecoration: "none" },
  section: { marginTop: 14 },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, borderBottomWidth: 0.75, borderBottomColor: "#999999", paddingBottom: 2, marginBottom: 6 },
  entry: { marginBottom: 8 },
  entryTop: { flexDirection: "row", justifyContent: "space-between" },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  muted: { color: "#444444", fontSize: 9.5 },
  bullet: { flexDirection: "row", marginTop: 2, paddingRight: 8 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
  footer: { position: "absolute", bottom: 22, left: 48, right: 48, fontSize: 8, color: "#666666", textAlign: "center" },
});

const anchor = (name: string) => `project-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

function Bullets({ items }: { items: string[] }) {
  return (
    <>
      {items.map((b) => (
        <View key={b} style={s.bullet}>
          <Text style={s.bulletDot}>•</Text>
          <Text style={s.bulletText}>{b}</Text>
        </View>
      ))}
    </>
  );
}

export function ResumeDocument({ data, email, profileUrl }: { data: PublicProfile; email: string | null; profileUrl: string }) {
  const { profile, experiences, projects, stack } = data;
  const name = profile.displayName ?? profile.username;
  const work = experiences.filter((e) => e.kind === "work");
  const education = experiences.filter((e) => e.kind === "education");
  const shortUrl = profileUrl.replace(/^https?:\/\//, "");

  const skills = [...new Set([...stack.map((x) => x.language), ...experiences.flatMap((e) => e.skills)])].slice(0, 30);

  const contact: { text: string; href?: string }[] = [
    profile.location ? { text: profile.location } : null,
    email ? { text: email, href: `mailto:${email}` } : null,
    { text: shortUrl, href: profileUrl },
    profile.githubLogin ? { text: `github.com/${profile.githubLogin}`, href: `https://github.com/${profile.githubLogin}` } : null,
    profile.links.linkedin ? { text: profile.links.linkedin.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""), href: profile.links.linkedin } : null,
  ].filter((x): x is { text: string; href?: string } => Boolean(x));

  return (
    <Document title={`${name} - Resume`} author={name} subject="Resume" creator="Rows" producer="Rows">
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{name}</Text>
        {profile.headline ? <Text style={s.headline}>{profile.headline}</Text> : null}
        <Text style={s.contact}>
          {contact.map((c, i) => (
            <Text key={c.text}>
              {i > 0 ? "  |  " : ""}
              {c.href ? (
                <Link src={c.href} style={s.link}>
                  {c.text}
                </Link>
              ) : (
                c.text
              )}
            </Text>
          ))}
        </Text>

        {profile.summary ? (
          <View style={s.section}>
            <Text style={s.heading}>Summary</Text>
            <Text>{profile.summary}</Text>
          </View>
        ) : null}

        {work.length ? (
          <View style={s.section}>
            <Text style={s.heading}>Experience</Text>
            {work.map((e) => (
              <View key={e.id} style={s.entry} wrap={false}>
                <View style={s.entryTop}>
                  <Text style={s.entryTitle}>
                    {e.title}, {e.organization}
                  </Text>
                  <Text style={s.muted}>{formatRange(e.startDate, e.endDate, e.current)}</Text>
                </View>
                {e.location ? <Text style={s.muted}>{e.location}</Text> : null}
                <Bullets items={e.bullets} />
              </View>
            ))}
          </View>
        ) : null}

        {projects.length ? (
          <View style={s.section}>
            <Text style={s.heading}>Projects</Text>
            {projects.map((p) => {
              const card = p.cardStatus === "approved" ? p.card : null;
              const langs = Object.entries(p.languages)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([l]) => l);
              return (
                <View key={p.id} style={s.entry} wrap={false}>
                  <View style={s.entryTop}>
                    <Text style={s.entryTitle}>{p.name}</Text>
                    <Link src={`${profileUrl}#${anchor(p.name)}`} style={[s.muted, s.link]}>
                      Details on Rows
                    </Link>
                  </View>
                  {card?.whatItIs || p.description ? <Text>{card?.whatItIs ?? p.description}</Text> : null}
                  {card ? <Bullets items={card.highlights.map((h) => h.text)} /> : null}
                  <Text style={s.muted}>
                    {[langs.length ? langs.join(", ") : p.primaryLanguage, p.userCommits ? `${p.userCommits} commits` : null, p.url.replace(/^https:\/\//, "")]
                      .filter(Boolean)
                      .join("  |  ")}
                  </Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {skills.length ? (
          <View style={s.section}>
            <Text style={s.heading}>Skills</Text>
            <Text>{skills.join(", ")}</Text>
          </View>
        ) : null}

        {education.length ? (
          <View style={s.section}>
            <Text style={s.heading}>Education</Text>
            {education.map((e) => (
              <View key={e.id} style={s.entry} wrap={false}>
                <View style={s.entryTop}>
                  <Text style={s.entryTitle}>
                    {e.title}, {e.organization}
                  </Text>
                  <Text style={s.muted}>{formatRange(e.startDate, e.endDate, e.current)}</Text>
                </View>
                <Bullets items={e.bullets} />
              </View>
            ))}
          </View>
        ) : null}

        <Text style={s.footer} fixed>
          Full portfolio with projects verified from GitHub: {shortUrl}
        </Text>
      </Page>
    </Document>
  );
}
