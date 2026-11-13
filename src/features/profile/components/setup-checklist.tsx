import { CheckIcon, XIcon } from "lucide-react";
import { ENV_VARS, env, type EnvVar } from "@/lib/env";

/** Which env vars are set. Shows names only, never values. Server component. */
export function SetupChecklist() {
  const vars = Object.keys(ENV_VARS) as EnvVar[];
  const missing = vars.filter((name) => !env(name)).length;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {missing === 0 ? "Every env var is set." : `${missing} of ${vars.length} env vars missing. See .env.example.`}
      </p>
      <ul className="flex flex-col gap-1.5">
        {vars.map((name) => {
          const set = Boolean(env(name));
          return (
            <li key={name} className="flex items-start gap-2 text-sm">
              {set ? (
                <CheckIcon className="mt-0.5 size-4 shrink-0 text-green-600" aria-label="Set" />
              ) : (
                <XIcon className="mt-0.5 size-4 shrink-0 text-destructive" aria-label="Missing" />
              )}
              <span className="flex flex-col">
                <code className="font-mono text-xs break-all">{name}</code>
                <span className="text-xs text-muted-foreground">{ENV_VARS[name]}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
