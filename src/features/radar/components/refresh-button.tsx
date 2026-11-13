"use client";

import { RefreshCwIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshRadar } from "../actions";

export function RefreshButton() {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await refreshRadar();
          if (res.ok) toast.success(res.message);
          else toast.error(res.error);
        })
      }
    >
      <RefreshCwIcon aria-hidden className={pending ? "animate-spin" : undefined} />
      Refresh radar
    </Button>
  );
}
