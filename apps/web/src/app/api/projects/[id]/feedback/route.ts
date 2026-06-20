import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const project = await db.project.findFirst({
    where: { id, ownerId: session.user.id },
  });
  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? undefined;
  const status = searchParams.get("status") ?? undefined;
  const sort = searchParams.get("sort") === "votes" ? "upvotes" : "createdAt";

  const feedback = await db.feedback.findMany({
    where: {
      projectId: id,
      ...(type ? { type: type as never } : {}),
      ...(status ? { status: status as never } : {}),
    },
    orderBy: { [sort]: "desc" },
    take: 50,
  });

  return NextResponse.json(feedback);
}
