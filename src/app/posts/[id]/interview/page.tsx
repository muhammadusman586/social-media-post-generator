import { notFound } from "next/navigation";
import { z } from "zod";
import { InterviewView } from "@/features/interview/interview-view";
import { getInterview } from "@/features/interview/queries";

export const metadata = { title: "Interview" };

export default async function Page({ params }: PageProps<"/posts/[id]/interview">) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const post = await getInterview(id);
  if (!post) notFound();
  return <InterviewView post={post} />;
}
