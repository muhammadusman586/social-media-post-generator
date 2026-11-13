import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Not allowed" };

export default async function NotAllowedPage() {
  const { userId } = await auth();
  return (
    <section className="flex flex-col gap-4 pt-8">
      <h1 className="text-2xl font-semibold">Not allowed</h1>
      <p className="text-muted-foreground">
        Brand Studio is a private app with a single owner. This account cannot use it.
      </p>
      {userId && (
        <p className="text-sm text-muted-foreground">
          Signed in as <code className="font-mono break-all">{userId}</code>. If this is you, set{" "}
          <code className="font-mono">OWNER_CLERK_USER_ID</code> to this id.
        </p>
      )}
      <SignOutButton redirectUrl="/sign-in">
        <Button variant="outline" className="self-start">Sign out</Button>
      </SignOutButton>
    </section>
  );
}
