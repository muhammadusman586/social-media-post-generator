"use client";

import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, ShareIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Platform } from "@/db/schema";
import { markPosted } from "./actions";
import { OPEN_APP, X_LIMIT, shareMode, xLength, type KitImage } from "./lib";

export type PlatformKit = {
  platform: Platform;
  draftId: string;
  posted: boolean;
  texts: string[];
  images: KitImage[];
};

const NAMES: Record<Platform, string> = { linkedin: "LinkedIn", x: "X", instagram: "Instagram" };
const LIMITS: Record<Platform, number> = { linkedin: 3000, x: X_LIMIT, instagram: 2200 };

export function PostKit({ platforms }: { platforms: PlatformKit[] }) {
  const files = usePrefetchedFiles(platforms.flatMap((p) => p.images));
  return (
    <Tabs defaultValue={platforms[0].platform}>
      <TabsList className="w-full">
        {platforms.map((p) => (
          <TabsTrigger key={p.platform} value={p.platform}>
            {NAMES[p.platform]}
            {p.posted ? <CheckIcon aria-label="posted" /> : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {platforms.map((p) => (
        <TabsContent key={p.platform} value={p.platform} className="flex flex-col gap-4 pt-2">
          <PlatformPanel kit={p} files={files} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

/**
 * Fetches every image once on load and keeps it as a File. iOS Safari only opens the
 * share sheet if share() runs right after the tap, so files must be ready beforehand.
 */
function usePrefetchedFiles(images: KitImage[]) {
  const [files, setFiles] = useState<Record<string, File> | null>(null);
  const key = images.map((i) => i.url).join("|");
  useEffect(() => {
    let live = true;
    const unique = new Map(images.map((i) => [i.url, i]));
    Promise.all(
      [...unique].map(async ([url, img]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return null;
          const blob = await res.blob();
          return [url, new File([blob], img.name, { type: blob.type || "image/png" })] as const;
        } catch {
          return null; // e.g. CORS on a cross-origin URL: that image falls back to download
        }
      }),
    ).then((entries) => {
      if (live) setFiles(Object.fromEntries(entries.filter((e) => e !== null)));
    });
    return () => {
      live = false;
    };
    // images is derived from key; re-run only when the set of URLs changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return files;
}

function PlatformPanel({ kit, files }: { kit: PlatformKit; files: Record<string, File> | null }) {
  const thread = kit.platform === "x" && kit.texts.length > 1;
  return (
    <>
      {kit.texts.map((text, i) => (
        <TextBlock
          key={i}
          text={text}
          platform={kit.platform}
          label={thread ? `${i + 1}/${kit.texts.length}` : ""}
        />
      ))}
      {kit.images.length ? <Images images={kit.images} files={files} /> : null}
      <div className="flex flex-col gap-2">
        <a
          href={OPEN_APP[kit.platform].url}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: "outline", size: "lg" })}
        >
          <ExternalLinkIcon />
          {OPEN_APP[kit.platform].label}
        </a>
        <PostedToggle draftId={kit.draftId} posted={kit.posted} />
      </div>
    </>
  );
}

function TextBlock({ text, platform, label }: { text: string; platform: Platform; label: string }) {
  const count = platform === "x" ? xLength(text) : text.length;
  const over = count > LIMITS[platform];

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(label ? `Copied ${label}` : "Copied");
    } catch {
      toast.error("Could not copy. Select the text and copy it by hand.");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <p className="text-sm whitespace-pre-wrap select-text">{text}</p>
      <div className="flex items-center justify-between gap-2">
        <span className={over ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
          {count}/{LIMITS[platform]}
          {over ? " · too long" : ""}
        </span>
        <Button size="lg" onClick={copy}>
          <CopyIcon />
          {label ? `Copy ${label}` : "Copy text"}
        </Button>
      </div>
    </div>
  );
}

function Images({ images, files }: { images: KitImage[]; files: Record<string, File> | null }) {
  const ready = files ? images.map((i) => files[i.url]).filter(Boolean) : [];
  // Any image that failed to load means the whole set falls back to downloads.
  const mode = !files ? null : ready.length === images.length ? shareMode(navigator, ready) : "download";

  async function share() {
    try {
      await navigator.share({ files: ready });
    } catch (e) {
      if ((e as Error).name !== "AbortError") toast.error("Could not open the share sheet. Download the images instead.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex snap-x gap-2 overflow-x-auto pb-1">
        {images.map((img) => (
          <div key={img.url} className="flex shrink-0 snap-start flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG route, no optimizer */}
            <img src={img.url} alt={img.name} className="h-40 w-32 rounded-md border object-cover" />
            {mode === "download" ? (
              <a href={img.url} download={img.name} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <DownloadIcon />
                Download
              </a>
            ) : null}
          </div>
        ))}
      </div>
      {mode === "share" ? (
        <Button size="lg" onClick={share}>
          <ShareIcon />
          {images.length > 1 ? `Share ${images.length} images` : "Share image"}
        </Button>
      ) : mode === null ? (
        <Button size="lg" disabled>
          Preparing images…
        </Button>
      ) : null}
    </div>
  );
}

function PostedToggle({ draftId, posted }: { draftId: string; posted: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Button
      size="lg"
      variant={posted ? "secondary" : "default"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          try {
            await markPosted(draftId, !posted);
          } catch {
            toast.error("Could not save. Try again.");
          }
        })
      }
    >
      {posted ? (
        <>
          <CheckIcon />
          Posted (tap to undo)
        </>
      ) : (
        "Mark as posted"
      )}
    </Button>
  );
}
