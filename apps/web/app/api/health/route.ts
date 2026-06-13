import { NextResponse } from "next/server";
import { getMemWalClient } from "@/lib/memwal";

export async function GET(request: Request) {
  const key = request.headers.get("x-memwal-key");
  const accountId = request.headers.get("x-memwal-account-id");

  if (!key || !accountId) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  try {
    const memwal = getMemWalClient(key, accountId);
    await memwal.health(); // lightweight ping
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Authentication failed" },
      { status: 401 }
    );
  }
}
