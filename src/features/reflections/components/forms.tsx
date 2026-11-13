import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ActionForm } from "@/features/posts/components/action-form";
import { addQuestion, answerReflection } from "../actions";

export function AnswerForm({ id, question, answer }: { id: string; question: string; answer?: string | null }) {
  return (
    <ActionForm action={answerReflection} submitLabel={answer ? "Save" : "Save answer"} success="Answer saved">
      <input type="hidden" name="id" value={id} />
      <Textarea
        name="answer"
        aria-label={question}
        defaultValue={answer ?? ""}
        rows={4}
        placeholder="Rough words are fine. Dictation works. Leave client names out."
      />
    </ActionForm>
  );
}

export function AddQuestionForm() {
  return (
    <ActionForm action={addQuestion} submitLabel="Add question" success="Question added" reset>
      <Input name="question" aria-label="Your question" placeholder="Your own reflection question" />
    </ActionForm>
  );
}
