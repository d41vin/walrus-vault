import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

// Ensure CONVEX_URL is configured
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.warn("NEXT_PUBLIC_CONVEX_URL is not set");
}
const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { artifact, accountId } = body;

    if (!artifact || !accountId) {
      return NextResponse.json({ error: "Missing artifact or accountId" }, { status: 400 });
    }

    if (!convex) {
      return NextResponse.json({ error: "Convex client not initialized" }, { status: 500 });
    }

    // 1. Write to Convex artifactCache
    await convex.mutation(api.artifacts.upsertCache, { artifact, accountId });

    // 2. Write to Convex activityFeed
    await convex.mutation(api.activityFeed.append, {
      accountId,
      type: "artifact_stored",
      artifactId: artifact.id,
      filename: artifact.filename,
      timestamp: Date.now(),
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Error in sync-artifact API:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
