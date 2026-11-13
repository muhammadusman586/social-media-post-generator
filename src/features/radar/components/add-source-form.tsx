"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addSource } from "../actions";
import { SOURCE_KINDS } from "../lib/candidates";

export function AddSourceForm() {
  const [kind, setKind] = useState("blog");
  const [state, action, pending] = useActionState(addSource, null);
  const isSearch = kind === "search";

  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <Input name="name" placeholder="Name" aria-label="Source name" required />
        <select
          name="kind"
          aria-label="Source kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
          className="h-8 rounded-lg border border-input bg-transparent px-2 text-base md:text-sm"
        >
          {SOURCE_KINDS.map((k) => (
            <option key={k.value} value={k.value}>
              {k.label}
            </option>
          ))}
        </select>
      </div>
      {isSearch ? (
        <Input name="query" placeholder="Search query, e.g. AI engineering news" aria-label="Search query" required />
      ) : (
        <Input name="url" type="url" inputMode="url" placeholder="https://…" aria-label="Page URL" required />
      )}
      {state && !state.ok && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="secondary" disabled={pending}>
        Add source
      </Button>
    </form>
  );
}
