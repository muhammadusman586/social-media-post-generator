import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { isOwner } from "@/lib/auth";

const PUBLIC_PATHS = ["/sign-in", "/not-allowed"];

/** Every route needs a signed-in Clerk user, and that user must be the owner. */
export default clerkMiddleware(
  async (auth, req) => {
    const { pathname } = req.nextUrl;
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return;

    const { userId } = await auth.protect();
    if (isOwner(userId)) return;

    if (pathname.startsWith("/api")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    return NextResponse.redirect(new URL("/not-allowed", req.url));
  },
  { signInUrl: "/sign-in" },
);

export const config = {
  matcher: [
    // Skip Next internals and static files (incl. the web manifest and icons).
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
