import { NextResponse } from "next/server";
import { getArtifactVault } from "@/lib/vault-client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;

// GET: search or list artifacts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const key = request.headers.get("x-memwal-key");
  const accountId = request.headers.get("x-memwal-account-id");

  if (!key || !accountId) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  const queryText = searchParams.get("q");
  const contentType = searchParams.get("contentType") || undefined;
  const agentId = searchParams.get("agentId") || undefined;
  const tagsParam = searchParams.get("tags");
  const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? parseInt(limitParam, 10) : undefined;
  const cursor = searchParams.get("cursor") || undefined;

  try {
    const vault = getArtifactVault(key, accountId);

    if (queryText) {
      // Perform semantic search
      const results = await vault.search(queryText, {
        contentType,
        agentId,
        tags,
        limit,
      });

      // Convex activity log: search occurred
      if (convex) {
        convex.mutation(api.activityFeed.append, {
          accountId,
          type: "artifact_searched",
          query: queryText,
          timestamp: Date.now(),
        }).catch((e) => console.error("Convex log search error:", e));
      }

      return NextResponse.json(results);
    } else {
      // List artifacts
      const result = await vault.list({
        contentType,
        agentId,
        tags,
        limit,
        cursor,
      });
      return NextResponse.json(result.artifacts);
    }
  } catch (err: any) {
    console.error("Error in artifacts GET:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch artifacts" }, { status: 500 });
  }
}

// POST: store a new artifact (multipart upload)
export async function POST(request: Request) {
  const key = request.headers.get("x-memwal-key");
  const accountId = request.headers.get("x-memwal-account-id");

  if (!key || !accountId) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    const filename = formData.get("filename") as string || file.name;
    const contentType = formData.get("contentType") as string || file.type || "application/octet-stream";
    const description = formData.get("description") as string || undefined;
    
    const tagsParam = formData.get("tags") as string;
    const tags = tagsParam ? tagsParam.split(",").map((t) => t.trim()).filter(Boolean) : [];

    const agentId = formData.get("agentId") as string || undefined;
    const sessionId = formData.get("sessionId") as string || undefined;
    const derivedFrom = formData.get("derivedFrom") as string || undefined;
    
    const dependsOnParam = formData.get("dependsOn") as string;
    const dependsOn = dependsOnParam ? dependsOnParam.split(",").map((d) => d.trim()).filter(Boolean) : undefined;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const vault = getArtifactVault(key, accountId);
    const storedArtifact = await vault.store(fileBytes, {
      filename,
      contentType,
      description,
      tags,
      agentId,
      sessionId,
      derivedFrom,
      dependsOn,
    });

    // Sync to Convex cache instantly
    if (convex) {
      await convex.mutation(api.artifacts.upsertCache, {
        accountId,
        artifact: storedArtifact,
      });

      await convex.mutation(api.activityFeed.append, {
        accountId,
        type: "artifact_stored",
        artifactId: storedArtifact.id,
        filename: storedArtifact.filename,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json(storedArtifact);
  } catch (err: any) {
    console.error("Error in artifacts POST:", err);
    return NextResponse.json({ error: err.message || "Failed to store artifact" }, { status: 500 });
  }
}
