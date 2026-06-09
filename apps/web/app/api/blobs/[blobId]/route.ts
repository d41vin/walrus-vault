import { NextResponse } from "next/server";

const DEFAULT_AGGREGATOR = "https://aggregator.walrus.wal.app";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ blobId: string }> }
) {
  const { blobId } = await params;
  const aggregator = process.env.NEXT_PUBLIC_WALRUS_AGGREGATOR || DEFAULT_AGGREGATOR;
  const url = `${aggregator}/v1/blobs/${blobId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return new Response(`Aggregator returned status ${response.status}`, {
        status: response.status,
      });
    }

    const contentType = response.headers.get("Content-Type") || "application/octet-stream";
    
    // Return the response stream directly to the client
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err: any) {
    console.error("Error fetching blob from Walrus:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch blob" }, { status: 500 });
  }
}
