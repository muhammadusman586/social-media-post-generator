import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { SlideContent } from "@/db/schema";
import { SLIDE_SIZE, type SlideKind, fitFontSize, slideTemplate } from "./lib";

const FONT_DIR = join(process.cwd(), "src/features/slides/fonts");

// Read lazily (not at import) and once per server instance.
let fonts: Promise<NonNullable<ConstructorParameters<typeof ImageResponse>[1]>["fonts"]> | undefined;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, "Geist-Regular.ttf")),
    readFile(join(FONT_DIR, "Geist-Bold.ttf")),
    readFile(join(FONT_DIR, "GeistMono-Regular.ttf")),
  ]).then(([regular, bold, mono]) => [
    { name: "Geist", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Geist", data: bold, weight: 700 as const, style: "normal" as const },
    { name: "Geist Mono", data: mono, weight: 400 as const, style: "normal" as const },
  ]);
  return fonts;
}

const INK = "#111111";
const PAPER = "#FAFAF7";
const MUTED = "#5C5C5C";
const ACCENT = "#2448E6";

export type RenderInput = {
  kind: SlideKind;
  content: SlideContent;
  handle: string;
  number: number;
  total: number;
  diagramPngUrl?: string | null;
};

export async function renderSlide(input: RenderInput): Promise<ImageResponse> {
  const template = slideTemplate(input.kind, input.content, input.diagramPngUrl);
  const dark = template === "code";
  const handle = input.handle.trim() ? `@${input.handle.trim().replace(/^@/, "")}` : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "88px 88px 72px",
          background: dark ? INK : PAPER,
          color: dark ? PAPER : INK,
          fontFamily: "Geist",
        }}
      >
        <div style={{ width: 96, height: 12, background: ACCENT, marginBottom: 56 }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <Body template={template} content={input.content} diagramPngUrl={input.diagramPngUrl} />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 32,
            color: dark ? "#BDBDBD" : MUTED,
            marginTop: 40,
          }}
        >
          <span>{handle}</span>
          <span>{`${input.number}/${input.total}`}</span>
        </div>
      </div>
    ),
    {
      ...SLIDE_SIZE,
      fonts: await loadFonts(),
      headers: { "Cache-Control": "private, max-age=60" },
    },
  );
}

function Heading({ text, size }: { text: string; size: number }) {
  return (
    <div style={{ fontSize: size, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1 }}>{text}</div>
  );
}

function Body({
  template,
  content,
  diagramPngUrl,
}: {
  template: SlideKind;
  content: SlideContent;
  diagramPngUrl?: string | null;
}) {
  const heading = content.heading?.trim() ?? "";
  const body = content.body?.trim() ?? "";

  if (template === "title") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <Heading text={heading || body} size={fitFontSize(heading || body, 112, 64)} />
        {heading && body ? (
          <div style={{ fontSize: 44, color: MUTED, lineHeight: 1.35 }}>{body}</div>
        ) : null}
      </div>
    );
  }

  if (template === "quote") {
    const quote = content.quote!.trim();
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ fontSize: 200, lineHeight: 0.6, color: ACCENT, fontWeight: 700 }}>“</div>
        <Heading text={quote} size={fitFontSize(quote, 88, 48)} />
        {heading || body ? (
          <div style={{ fontSize: 40, color: MUTED }}>{heading || body}</div>
        ) : null}
      </div>
    );
  }

  if (template === "code") {
    const code = content.code!.replace(/\s+$/, "");
    const longest = Math.max(...code.split("\n").map((l) => l.length));
    // Monospace: about 0.6em per char; fit the longest line in the box (904px minus padding).
    const size = Math.max(22, Math.min(40, Math.floor(816 / (longest * 0.62))));
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
        {heading ? <Heading text={heading} size={64} /> : null}
        <div
          style={{
            display: "flex",
            fontFamily: "Geist Mono",
            fontSize: size,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            padding: 40,
            borderRadius: 24,
            background: "#1E1E1E",
            border: "2px solid #333",
          }}
        >
          {code}
        </div>
        {content.language ? (
          <div style={{ fontSize: 28, color: "#BDBDBD", fontFamily: "Geist Mono" }}>{content.language}</div>
        ) : null}
      </div>
    );
  }

  if (template === "diagram") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 40, alignItems: "center" }}>
        {heading ? <Heading text={heading} size={64} /> : null}
        {/* eslint-disable-next-line @next/next/no-img-element -- satori renders plain <img> */}
        <img
          src={(content.imageUrl ?? diagramPngUrl)!}
          alt=""
          width={904}
          height={heading ? 860 : 1000}
          style={{ objectFit: "contain" }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      {heading ? <Heading text={heading} size={fitFontSize(heading, 80, 56)} /> : null}
      {body ? <div style={{ fontSize: fitFontSize(body, 52, 32), lineHeight: 1.4, whiteSpace: "pre-wrap" }}>{body}</div> : null}
    </div>
  );
}
