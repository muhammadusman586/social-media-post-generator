import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatWeek, STATUS_LABEL, TYPE_LABEL } from "@/features/posts/labels";
import { listPosts } from "@/features/posts/queries";
import { requireOwner } from "@/lib/auth";

export const metadata = { title: "Posts" };

export default async function PostsPage({ searchParams }: PageProps<"/posts">) {
  await requireOwner();
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.slice(0, 200) : "";
  const posts = await listPosts(search);

  return (
    <>
      <h1 className="text-2xl font-semibold">Posts</h1>
      <form role="search" action="/posts">
        <Input type="search" name="q" defaultValue={search} placeholder="Search by title" aria-label="Search posts" />
      </form>

      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {search ? `No post titles match "${search}".` : "No posts yet. Start one from the home screen."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl border">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/posts/${p.id}`} className="flex flex-col gap-1.5 px-4 py-3 hover:bg-muted">
                <span className="font-medium">{p.title || "Untitled post"}</span>
                <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  Week of {formatWeek(p.weekOf)}
                  <Badge variant="outline">{TYPE_LABEL[p.type]}</Badge>
                  <Badge variant={p.status === "posted" ? "default" : "secondary"}>{STATUS_LABEL[p.status]}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
