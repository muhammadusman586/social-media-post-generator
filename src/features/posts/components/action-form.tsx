"use client";

import { useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Props = {
  action: (form: FormData) => Promise<{ error?: string }>;
  submitLabel: string;
  submitVariant?: "default" | "outline" | "ghost" | "destructive";
  /** Toast shown on success. */
  success?: string;
  /** Clear the fields on success (add forms). Errors never clear what was typed. */
  reset?: boolean;
  className?: string;
  children?: ReactNode;
};

/** A form that calls a server action, keeps input on error and toasts the result. */
export function ActionForm({ action, submitLabel, submitVariant, success, reset, className, children }: Props) {
  const [pending, startTransition] = useTransition();

  return (
    <form
      className={cn("flex flex-col gap-3", className)}
      onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        startTransition(async () => {
          const result = await action(new FormData(form));
          if (result.error) {
            toast.error(result.error);
            return;
          }
          if (success) toast.success(success);
          if (reset) form.reset();
        });
      }}
    >
      {children}
      <Button type="submit" variant={submitVariant} disabled={pending} className="self-start">
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
