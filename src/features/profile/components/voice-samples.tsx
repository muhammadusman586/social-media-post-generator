import { Textarea } from "@/components/ui/textarea";
import type { voiceExamples } from "@/db/schema";
import { ActionForm } from "@/features/posts/components/action-form";
import { addVoiceSample, deleteVoiceSample } from "../actions";

type Example = typeof voiceExamples.$inferSelect;

export function VoiceSamples({ samples, finals }: { samples: Example[]; finals: Example[] }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Paste 3 to 10 things you wrote yourself: old posts, messages, notes. Drafts copy their tone.
      </p>
      <ActionForm action={addVoiceSample} submitLabel="Add sample" success="Sample added" reset>
        <Textarea name="text" rows={4} aria-label="New voice sample" placeholder="Paste your writing here" />
      </ActionForm>

      {samples.length > 0 && (
        <ul className="flex flex-col gap-3">
          {samples.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="line-clamp-4 text-sm whitespace-pre-wrap">{s.text}</p>
              <ActionForm action={deleteVoiceSample} submitLabel="Delete" submitVariant="destructive">
                <input type="hidden" name="id" value={s.id} />
              </ActionForm>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">From your finished posts</h3>
        {finals.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            None yet. Each post you finalize is saved here and used as a voice example.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {finals.map((f) => (
              <li key={f.id} className="rounded-lg bg-muted p-3 text-sm">
                {f.platform && <span className="mb-1 block text-xs text-muted-foreground uppercase">{f.platform}</span>}
                <p className="line-clamp-3 whitespace-pre-wrap">{f.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
