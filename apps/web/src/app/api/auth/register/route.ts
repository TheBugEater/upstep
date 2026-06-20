import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().optional(),
  email: z.string().email(),
  password: z.string().min(8),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json({ error: "Email already in use" }, { status: 409 });
  }

  const { hash } = await import("bcryptjs");
  const hashed = await hash(parsed.data.password, 12);

  const user = await db.user.create({
    data: { email: parsed.data.email, name: parsed.data.name ?? null, password: hashed },
  });

  return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
}
