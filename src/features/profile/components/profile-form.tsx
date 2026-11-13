import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { profile } from "@/db/schema";
import { ActionForm } from "@/features/posts/components/action-form";
import { saveProfile } from "../actions";
import { TagInput } from "./tag-input";

type Profile = typeof profile.$inferSelect;

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

export function ProfileForm({ value }: { value: Profile | undefined }) {
  return (
    <ActionForm action={saveProfile} submitLabel="Save profile" success="Profile saved" className="gap-4">
      <Field label="Handle" htmlFor="handle">
        <Input id="handle" name="handle" defaultValue={value?.handle} placeholder="@yourhandle" autoCapitalize="none" />
      </Field>
      <Field label="Bio" htmlFor="bio">
        <Textarea id="bio" name="bio" defaultValue={value?.bio} rows={3} />
      </Field>
      <TagInput name="stack" label="Stack" defaultValue={value?.stack ?? []} />
      <Field label="Projects" htmlFor="projects">
        <Textarea
          id="projects"
          name="projects"
          defaultValue={value?.projects}
          rows={4}
          placeholder="One project per line: what it is and what you built"
        />
      </Field>
      <TagInput name="topics" label="Topics you care about" defaultValue={value?.topics ?? []} />
      <TagInput name="avoidTopics" label="Topics to avoid" defaultValue={value?.avoidTopics ?? []} />
      <TagInput
        name="neverMention"
        label="Never mention"
        hint="Client and company names. The slop check flags any draft that contains one."
        defaultValue={value?.neverMention ?? []}
      />
    </ActionForm>
  );
}
