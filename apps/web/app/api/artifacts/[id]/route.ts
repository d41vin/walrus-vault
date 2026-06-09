import { NextResponse } from "next/server";
import { getArtifactVault } from "@/lib/vault-client";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
const convex = convexUrl ? new ConvexHttpClient(convexUrl) : null;

// GET: get single artifact details by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const key = request.headers.get("x-memwal-key");
  const accountId = request.headers.get("x-memwal-account-id");

  if (!key || !accountId) {
    return NextResponse.json({ error: "Missing credentials" }, { status: 400 });
  }

  try {
    const vault = getArtifactVault(key, accountId);
    const detail = await vault.get(id);

    if (!detail) {
      return NextResponse.json({ error: "Artifact not found" }, { status: 404 });
    }

    return NextResponse.json(detail);
  } catch (err: any) {
    console.error("Error in artifacts/[id] GET:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch artifact" }, { status: 500 });
  }
}

// POST: store a new version of an existing artifact
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const description = formData.get("description") as string || undefined;

    const arrayBuffer = await file.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    const vault = getArtifactVault(key, accountId);
    const updated = await vault.storeVersion(id, fileBytes, { description });

    // Sync to Convex cache instantly
    if (convex) {
      await convex.mutation(api.artifacts.upsertCache, {
        accountId,
        artifact: updated,
      });

      await convex.mutation(api.activityFeed.append, {
        accountId,
        type: "version_stored",
        artifactId: updated.id,
        filename: updated.filename,
        timestamp: Date.now(),
      });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    console.error("Error in artifacts/[id] POST (storeVersion):", err);
    return NextResponse.json({ error: err.message || "Failed to store new version" }, { status: 500 });
  }
}
