"use client";

import { ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "explain", label: "Explain it simply" },
  { value: "tried", label: "I tried it" },
] as const;
type RadarType = (typeof TYPES)[number]["value"];

export type RadarCardItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  whyItMatters: string;
  suggestedType: string;
};

export function RadarCard({ item }: { item: RadarCardItem }) {
  const suggested: RadarType = item.suggestedType === "tried" ? "tried" : "explain";
  const [type, setType] = useState<RadarType>(suggested);
  const host = new URL(item.url).hostname.replace(/^www\./, "");

  return (
    <Card>
      <CardHeader className="gap-2">
        <Badge variant="secondary">{TYPES.find((t) => t.value === suggested)!.label}</Badge>
        <CardTitle>
          <a href={item.url} target="_blank" rel="noreferrer" className="hover:underline">
            {item.title}
          </a>
        </CardTitle>
        <a
          href={item.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground"
        >
          {host}
          <ExternalLinkIcon aria-hidden className="size-3" />
        </a>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {item.whyItMatters && <p className="font-medium">{item.whyItMatters}</p>}
        {item.summary && <p className="text-muted-foreground">{item.summary}</p>}
      </CardContent>
      <CardFooter className="flex flex-col items-stretch gap-3 border-t py-3">
        <div role="group" aria-label="Post type" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
          {TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={type === t.value}
              onClick={() => setType(t.value)}
              className={cn(
                "h-8 rounded-md text-xs font-medium text-muted-foreground",
                type === t.value && "bg-background text-foreground shadow-sm",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link
          href={`/posts/new?type=${type}&radarItemId=${item.id}`}
          className={cn(buttonVariants({ size: "lg" }), "w-full")}
        >
          Write about this
        </Link>
      </CardFooter>
    </Card>
  );
}
