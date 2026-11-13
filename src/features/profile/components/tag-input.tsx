"use client";

import { XIcon } from "lucide-react";
import { useId, useState } from "react";
import { Input } from "@/components/ui/input";
import { parseTags } from "../tags";

type Props = { name: string; label: string; hint?: string; defaultValue: string[] };

/** Chips plus a text box. Enter or comma adds a tag; the form gets them newline-joined in `name`. */
export function TagInput({ name, label, hint, defaultValue }: Props) {
  const id = useId();
  const [tags, setTags] = useState(defaultValue);
  const [draft, setDraft] = useState("");

  const add = (text: string) => {
    setTags((prev) => parseTags([...prev, text].join("\n")));
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag} className="flex items-center gap-1 rounded-full bg-secondary py-0.5 pr-1 pl-2.5 text-sm">
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                onClick={() => setTags((prev) => prev.filter((t) => t !== tag))}
              >
                <XIcon className="size-3" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Input
        id={id}
        value={draft}
        placeholder="Type and press Enter"
        enterKeyHint="done"
        onChange={(e) => {
          const v = e.target.value;
          if (/[,\n]/.test(v)) add(v);
          else setDraft(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (draft.trim()) add(draft);
          } else if (e.key === "Backspace" && !draft && tags.length) {
            setTags((prev) => prev.slice(0, -1));
          }
        }}
        onBlur={() => draft.trim() && add(draft)}
      />
      {/* Includes the unsubmitted draft so a typed-but-not-added tag is not lost on save. */}
      <input type="hidden" name={name} value={[...tags, draft].join("\n")} />
    </div>
  );
}
