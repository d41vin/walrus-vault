import { NextResponse } from "next/server";
import { getMemWalClient } from "@/lib/memwal";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = request.headers.get("x-memwal-key");
  const accountId = request.headers.get("x-memwal-account-id");

  if (!key || !accountId) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const queryText = searchParams.get("q");
  const namespace = searchParams.get("namespace") || "artifact-vault";
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : 50;

  if (!queryText) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  try {
    const memwal = getMemWalClient(key, accountId, namespace);
    const recallResult = await memwal.recall({
      query: queryText,
      limit,
      namespace,
    });

    // Write to Convex activityFeed as best-effort
    if (convex) {
      convex.mutation(api.activityFeed.append, {
        accountId,
        type: "memory_recalled",
        query: queryText,
        timestamp: Date.now(),
      }).catch((e) => console.error("Convex activity feed append failed:", e));
    }

    return NextResponse.json(recallResult.results || []);
  } catch (err: any) {
    console.error("Error in memories API:", err);
    return NextResponse.json({ error: err.message || "Failed to recall memories" }, { status: 500 });
  }
}
