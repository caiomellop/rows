import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";

import type { Experience, Profile } from "@/db/schema";
import { formatRange } from "@/lib/experience-format";

/**
 * ATS-ready resume: one column, real text, standard headings, no tables.
 * Built-in Helvetica keeps text extraction reliable. Nothing renders it yet;
 * MVP-16 adds the route and the download.
 */

const s = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 48, fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, color: "#111111" },
  name: { fontFamily: "Helvetica-Bold", fontSize: 20, marginBottom: 2 },
  headline: { fontSize: 11, color: "#333333", marginBottom: 4 },
  contact: { fontSize: 9, color: "#333333" },
  section: { marginTop: 14 },
  heading: { fontFamily: "Helvetica-Bold", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6, borderBottomWidth: 0.75, borderBottomColor: "#999999", paddingBottom: 2, marginBottom: 6 },
  entry: { marginBottom: 8 },
  entryTop: { flexDirection: "row", justifyContent: "space-between" },
  entryTitle: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  muted: { color: "#444444", fontSize: 9.5 },
  bullet: { flexDirection: "row", marginTop: 2, paddingRight: 8 },
  bulletDot: { width: 10 },
  bulletText: { flex: 1 },
});

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

export type ResumeProfile = Pick<Profile, "displayName" | "headline" | "summary" | "location">;

export function ResumeDocument({ profile, experiences, email }: { profile: ResumeProfile; experiences: Experience[]; email: string | null }) {
  const name = profile.displayName ?? email ?? "Resume";
  const work = experiences.filter((e) => e.kind === "work");
  const education = experiences.filter((e) => e.kind === "education");
  const skills = [...new Set(experiences.flatMap((e) => e.skills))].slice(0, 30);
  const contact = [profile.location, email].filter((x): x is string => Boolean(x));

  return (
    <Document title={`${name} - Resume`} author={name} subject="Resume" creator="Rows" producer="Rows">
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{name}</Text>
        {profile.headline ? <Text style={s.headline}>{profile.headline}</Text> : null}
        {contact.length ? <Text style={s.contact}>{contact.join("  |  ")}</Text> : null}

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
      </Page>
    </Document>
  );
}
