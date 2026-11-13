import { put } from "@vercel/blob";
import { z } from "zod";
import { addUpload, getInterview } from "@/features/interview/queries";
import { requireOwner } from "@/lib/auth";

// Route handler, not a server action: server actions cap bodies at 1 MB and phone screenshots are bigger.
const MAX_BYTES = 4 * 1024 * 1024; // Vercel functions accept ~4.5 MB request bodies.

export async function POST(req: Request, ctx: RouteContext<"/posts/[id]/interview/upload">) {
  await requireOwner();
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success || !(await getInterview(id))) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }
  const file = (await req.formData()).get("file");
  if (!(file instanceof File) || !file.type.startsWith("image/")) {
    return Response.json({ error: "Choose an image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return Response.json({ error: "Image is over 4 MB." }, { status: 413 });

  const blob = await put(`posts/${id}/${file.name || "screenshot"}`, file, { access: "public", addRandomSuffix: true });
  const upload = await addUpload({ postId: id, kind: "image", blobUrl: blob.url });
  return Response.json({ id: upload.id });
}
