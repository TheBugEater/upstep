import { renderProjectWorkspace } from "./workspace";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const { issue } = await searchParams;
  return renderProjectWorkspace({ id, issue });
}
