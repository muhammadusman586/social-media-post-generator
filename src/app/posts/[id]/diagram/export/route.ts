import { del, put } from "@vercel/blob";
import { z } from "zod";
import { getDiagram, setDiagramPng } from "@/features/diagrams/queries";
import { requireOwner } from "@/lib/auth";

/** Vercel functions reject request bodies over 4.5 MB. */
const MAX_BYTES = 4_500_000;

/**
 * Receives the exported PNG (raw body) and stores it in Vercel Blob as diagrams.png_url.
 * A route handler, not a server action: actions cap bodies at 1 MB and a 2x PNG can be bigger.
 */
export async function POST(req: Request, ctx: RouteContext<"/posts/[id]/diagram/export">) {
  await requireOwner();
  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return Response.json({ error: "Bad post id" }, { status: 400 });
  if (req.headers.get("content-type") !== "image/png") {
    return Response.json({ error: "Expected image/png" }, { status: 415 });
  }
  const body = await req.arrayBuffer();
  if (body.byteLength === 0 || body.byteLength > MAX_BYTES) {
    return Response.json({ error: "Image is empty or too large" }, { status: 413 });
  }

  const diagram = await getDiagram(id.data);
  if (!diagram) return Response.json({ error: "No diagram for this post" }, { status: 404 });

  try {
    const blob = await put(`diagrams/${id.data}.png`, body, {
      access: "public",
      contentType: "image/png",
      addRandomSuffix: true,
    });
    await setDiagramPng(id.data, blob.url);
    // Old export is no longer referenced; failing to delete it only leaves an orphan.
    if (diagram.pngUrl) await del(diagram.pngUrl).catch(() => {});
    return Response.json({ url: blob.url });
  } catch (err) {
    console.error("diagram export upload failed", err);
    return Response.json({ error: "Upload failed. Is BLOB_READ_WRITE_TOKEN set?" }, { status: 502 });
  }
}
