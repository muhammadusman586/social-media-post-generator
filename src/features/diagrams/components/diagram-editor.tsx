"use client";

import { useEffect, useState } from "react";
import { Box, getSnapshot, Tldraw, type Editor, type TLEditorSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { DiagramSpec } from "@/db/schema";
import { saveSnapshot } from "../actions";
import { portraitBox } from "../layout";
import { specToShapes } from "../shapes";

const SAVE_DELAY_MS = 1000;

function drawSpec(editor: Editor, spec: DiagramSpec) {
  const { shapes, arrows, bindings } = specToShapes(spec);
  editor.markHistoryStoppingPoint("draw spec");
  editor.run(() => {
    editor.deleteShapes([...editor.getCurrentPageShapeIds()]);
    editor.createShapes(shapes);
    editor.createShapes(arrows);
    editor.createBindings(bindings);
  });
  editor.zoomToFit();
}

type Props = { postId: string; spec: DiagramSpec; snapshot: unknown; pngUrl: string | null };

/** Client-only (tldraw touches window); load through next/dynamic with ssr: false. */
export default function DiagramEditor({ postId, spec, snapshot, pngUrl }: Props) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [saved, setSaved] = useState(pngUrl);
  const [local, setLocal] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Debounced autosave of the whole store; flushed when the tab hides or the editor unmounts.
  useEffect(() => {
    if (!editor) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      timer = undefined;
      saveSnapshot(postId, getSnapshot(editor.store)).catch(() =>
        toast.error("Couldn't save the diagram. Large pasted images can push it over the size limit."),
      );
    };
    const flush = () => {
      if (!timer) return;
      clearTimeout(timer);
      save();
    };
    const stop = editor.store.listen(
      () => {
        clearTimeout(timer);
        timer = setTimeout(save, SAVE_DELAY_MS);
      },
      { scope: "document", source: "user" },
    );
    const onVisibility = () => document.visibilityState === "hidden" && flush();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, [editor, postId]);

  useEffect(() => () => void (local && URL.revokeObjectURL(local)), [local]);

  function regenerate() {
    if (!editor) return;
    if (!window.confirm("Redraw from the spec? Your edits on the canvas will be replaced (undo still works).")) return;
    drawSpec(editor, spec);
  }

  async function exportPng() {
    if (!editor) return;
    const ids = [...editor.getCurrentPageShapeIds()];
    const bounds = editor.getCurrentPageBounds();
    if (!ids.length || !bounds) return void toast("Nothing on the canvas to export.");
    setExporting(true);
    try {
      const b = portraitBox(bounds);
      const { blob } = await editor.toImage(ids, {
        format: "png",
        scale: 2,
        background: true,
        darkMode: false,
        bounds: new Box(b.x, b.y, b.w, b.h),
      });
      setLocal(URL.createObjectURL(blob));
      const res = await fetch(`/posts/${postId}/diagram/export`, {
        method: "POST",
        headers: { "content-type": "image/png" },
        body: blob,
      });
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? `Upload failed (${res.status})`);
      setSaved(data.url);
      toast.success("Exported. Slides will use this image.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const preview = local ?? saved;
  return (
    <div className="flex flex-col gap-4">
      {/* Full-bleed past the narrow column: the laptop is the main editing device. */}
      <div className="relative left-1/2 h-[70dvh] w-[calc(100vw-2rem)] max-w-6xl -translate-x-1/2 overflow-hidden rounded-lg border">
        <Tldraw
          licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
          snapshot={(snapshot as TLEditorSnapshot | null) ?? undefined}
          onMount={(ed) => {
            if (!snapshot) drawSpec(ed, spec);
            setEditor(ed);
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={exportPng} disabled={!editor || exporting}>
          {exporting ? "Exporting..." : "Export PNG"}
        </Button>
        <Button variant="outline" onClick={regenerate} disabled={!editor}>
          Redraw from spec
        </Button>
      </div>
      {preview && (
        <figure className="flex flex-col gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob/object URLs, no optimisation needed */}
          <img src={preview} alt="Exported diagram" className="w-full max-w-sm rounded-md border" />
          <figcaption className="text-sm">
            <a className="underline" href={local ?? `${saved}?download=1`} download={`diagram-${postId}.png`}>
              Download PNG
            </a>
          </figcaption>
        </figure>
      )}
    </div>
  );
}
