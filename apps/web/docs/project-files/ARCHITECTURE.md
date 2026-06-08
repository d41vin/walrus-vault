# WalrusVault — Technical Architecture

---

## Repository Structure

```
walrus-vault/                          ← pnpm workspace root
├── package.json                       ← workspace config, no app code here
├── pnpm-workspace.yaml                ← declares apps/* and packages/*
├── turbo.json                         ← turborepo pipeline config
├── .env.example                       ← shared env var template
├── .gitignore
├── README.md
│
├── apps/
│   ├── web/                           ← Next.js 15 Inspector UI
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   ├── components.json            ← shadcn config
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx               ← landing / connect page
│   │   │   ├── (dashboard)/
│   │   │   │   ├── layout.tsx         ← sidebar layout
│   │   │   │   ├── page.tsx           ← overview / stats
│   │   │   │   ├── artifacts/
│   │   │   │   │   ├── page.tsx       ← artifact browser
│   │   │   │   │   └── [id]/
│   │   │   │   │       └── page.tsx   ← single artifact detail + lineage
│   │   │   │   ├── memories/
│   │   │   │   │   └── page.tsx       ← MemWal memory browser
│   │   │   │   ├── delegates/
│   │   │   │   │   └── page.tsx       ← delegate key manager
│   │   │   │   └── ecosystem/
│   │   │   │       └── page.tsx       ← existing MemWal tools listing
│   │   │   └── api/
│   │   │       ├── artifacts/
│   │   │       │   ├── route.ts       ← list + search artifacts
│   │   │       │   └── [id]/
│   │   │       │       └── route.ts   ← get single artifact
│   │   │       ├── memories/
│   │   │       │   └── route.ts       ← proxy to MemWal recall
│   │   │       ├── delegates/
│   │   │       │   └── route.ts       ← delegate key operations
│   │   │       ├── sync-artifact/
│   │   │       │   └── route.ts       ← webhook: MCP → Convex cache sync
│   │   │       └── blobs/
│   │   │           └── [blobId]/
│   │   │               └── route.ts   ← proxy Walrus blob fetch
│   │   ├── components/
│   │   │   ├── ui/                    ← shadcn components
│   │   │   ├── artifacts/
│   │   │   │   ├── artifact-grid.tsx
│   │   │   │   ├── artifact-card.tsx
│   │   │   │   ├── artifact-preview.tsx
│   │   │   │   ├── version-timeline.tsx
│   │   │   │   ├── lineage-graph.tsx  ← Phase 5: derived_from / depends_on graph
│   │   │   │   └── upload-dropzone.tsx
│   │   │   ├── memories/
│   │   │   │   ├── memory-list.tsx
│   │   │   │   ├── memory-card.tsx
│   │   │   │   └── recall-debugger.tsx
│   │   │   ├── delegates/
│   │   │   │   └── delegate-table.tsx
│   │   │   └── layout/
│   │   │       ├── sidebar.tsx
│   │   │       ├── header.tsx
│   │   │       └── connect-gate.tsx   ← auth wall, requires delegate key
│   │   ├── lib/
│   │   │   ├── memwal.ts              ← MemWal client singleton
│   │   │   ├── walrus.ts              ← Walrus aggregator client
│   │   │   ├── vault-client.ts        ← ArtifactVault client for Inspector
│   │   │   └── utils.ts
│   │   └── convex/                    ← Convex for real-time feed + artifact cache
│   │       ├── schema.ts
│   │       ├── artifacts.ts           ← cached artifact index for fast UI
│   │       └── sessions.ts            ← user session storage
│   │
│   └── mcp/                           ← Artifact Vault MCP server
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts               ← MCP server entry, stdio transport
│           ├── auth.ts                ← credential loading
│           └── tools/
│               ├── store-artifact.ts
│               ├── search-artifacts.ts
│               ├── get-artifact.ts
│               ├── list-artifacts.ts
│               ├── store-version.ts
│               └── link-artifacts.ts  ← Phase 5: declare relationships
│
└── packages/
    ├── sdk/                           ← @walrus-vault/sdk
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts               ← public exports
    │       ├── vault.ts               ← ArtifactVault class (main)
    │       ├── walrus-client.ts       ← Walrus HTTP API wrapper
    │       ├── metadata.ts            ← metadata schema + serialize/parse
    │       ├── dedup.ts               ← groupByLatestVersion() utility
    │       ├── types.ts               ← all TypeScript types
    │       └── errors.ts              ← typed errors
    │
    └── cli/                           ← walrus-vault CLI (P2 priority)
        ├── package.json
        └── src/
            ├── index.ts               ← commander entry
            └── commands/
                ├── store.ts
                ├── search.ts
                ├── get.ts
                └── list.ts
```

---

## Package Dependency Graph

```
@walrus-vault/sdk
  ├── @mysten-incubation/memwal   (MemWal SDK — metadata storage + semantic search)
  └── uuid                        (generate artifactIds)
  (Walrus HTTP API via fetch only — no Walrus SDK package needed)

apps/web
  ├── @walrus-vault/sdk           (local workspace package)
  ├── @mysten-incubation/memwal   (direct — for memory browser + delegate manager)
  ├── convex                      (real-time artifact cache + activity feed)
  ├── next, react, typescript
  └── tailwindcss, shadcn/ui

apps/mcp
  └── @walrus-vault/sdk           (local workspace package)

packages/cli
  └── @walrus-vault/sdk           (local workspace package)
```

---

## Core SDK — ArtifactVault Class

### Configuration

```ts
interface ArtifactVaultConfig {
  // MemWal credentials (used internally for artifact metadata storage and search)
  // Developer obtains these from memwal.ai — same account they use for text memories
  // WalrusVault uses these in the isolated "artifact-vault" namespace only
  memwalKey: string;           // Ed25519 delegate private key hex
  memwalAccountId: string;     // MemWalAccount object ID on Sui
  memwalServerUrl?: string;    // Default: https://relayer.memwal.ai

  // Walrus endpoints
  walrusPublisher?: string;    // Default: https://publisher.walrus.wal.app
  walrusAggregator?: string;   // Default: https://aggregator.walrus.wal.app
  walrusEpochs?: number;       // Default: 10 (Walrus epochs to store blob)

  // Namespace for artifact metadata in MemWal
  // Default: "artifact-vault" — fully isolated from developer's own namespaces
  metadataNamespace?: string;

  // Optional: Inspector URL for real-time sync when SDK runs headlessly (e.g. via MCP)
  // When set, SDK fires POST {inspectorUrl}/api/sync-artifact after every store()
  // Fire-and-forget — never blocks or throws if this call fails
  inspectorUrl?: string;
}
```

### Methods

```ts
class ArtifactVault {
  static create(config: ArtifactVaultConfig): ArtifactVault

  // Store a new artifact
  store(
    data: Buffer | Uint8Array | Blob,
    meta: {
      filename: string;
      contentType: string;
      description?: string;
      tags?: string[];
      agentId?: string;
      sessionId?: string;
      derivedFrom?: string;    // artifactId this was derived/generated from
      dependsOn?: string[];    // artifactIds this artifact depends on
    }
  ): Promise<StoredArtifact>

  // Search artifacts by natural language (semantic search via MemWal)
  // Returns only the LATEST version of each artifact — no duplicate stale versions
  search(
    query: string,
    filters?: {
      tags?: string[];
      contentType?: string;
      agentId?: string;
      limit?: number;
      maxDistance?: number;
    }
  ): Promise<ArtifactSearchResult[]>

  // Get a single artifact by ID (deterministic — reads version chain from metadata)
  get(artifactId: string): Promise<ArtifactDetail | null>

  // List artifacts — returns only LATEST version of each artifact
  list(filters?: {
    tags?: string[];
    contentType?: string;
    agentId?: string;
    limit?: number;
    cursor?: string;
  }): Promise<ArtifactListResult>

  // Get full version history for an artifact (reads versions field from metadata)
  getVersions(artifactId: string): Promise<ArtifactVersion[]>

  // Store a new version of an existing artifact
  storeVersion(
    artifactId: string,
    data: Buffer | Uint8Array | Blob,
    meta?: { description?: string }
  ): Promise<StoredArtifact>

  // Get download URL for a blob (does not fetch bytes)
  getDownloadUrl(blobId: string): string

  // Download raw blob bytes
  download(blobId: string): Promise<Uint8Array>
}
```

### Return Types

```ts
interface StoredArtifact {
  id: string;                  // Stable artifact ID (UUID v4) — never changes across versions
  blobId: string;              // Walrus blob ID for this specific version
  filename: string;
  contentType: string;
  description?: string;
  tags: string[];
  agentId?: string;
  sessionId?: string;
  version: number;             // Current version number (1-based)
  latestVersion: number;       // Highest version — equals version if this is latest
  versions: ArtifactVersion[]; // Full version chain (all blob IDs in order)
  parentArtifactId?: string;   // Set only if artifact is a version of another (rare)
  derivedFrom?: string;        // artifactId this was generated from
  dependsOn?: string[];        // artifactIds this artifact depends on
  size: number;                // Bytes
  downloadUrl: string;         // Walrus aggregator URL for this version's blob
  createdAt: string;           // ISO timestamp of this version
  metaMemoryId?: string;       // MemWal blob ID of the metadata memory
}

interface ArtifactSearchResult extends StoredArtifact {
  distance: number;            // Cosine distance from query (lower = more relevant)
  relevanceScore: number;      // 1 - distance, normalized 0-1
}

interface ArtifactDetail extends StoredArtifact {
  walrusBlobInfo: {
    blobId: string;
    size: number;
  };
}

interface ArtifactVersion {
  version: number;
  blobId: string;
  description?: string;
  createdAt: string;
  size?: number;
}

interface ArtifactListResult {
  artifacts: StoredArtifact[];
  total: number;
  cursor?: string;
}
```

---

## Metadata Schema in MemWal

Artifact metadata is stored as a structured text string in MemWal's `artifact-vault` namespace. This text format is what gets embedded and semantically indexed.

**Why text format, not JSON?** MemWal's embedding engine understands natural language. `filename: q3-climate.pdf tags: climate, Q3, final` embeds with far better semantic quality than JSON syntax. Natural language format also means the Inspector can display raw metadata memories without any parsing.

### Full Metadata Format

```
ARTIFACT_VAULT_META
id: {artifactId}
filename: {filename}
contentType: {contentType}
blobId: {walrusBlobId}
size: {sizeInBytes}
version: {currentVersionNumber}
latestVersion: {highestVersionNumber}
versions: {1:BlobId1, 2:BlobId2, 3:BlobId3}
description: {description or ""}
tags: {tag1, tag2, tag3}
agentId: {agentId or "manual"}
sessionId: {sessionId or "none"}
derivedFrom: {artifactId or "none"}
dependsOn: {artifactId1, artifactId2 or "none"}
createdAt: {isoTimestamp}
```

### Key Fields Explained

**`versions`** — The complete, deterministic version chain. Encoded as `version_number:blobId` pairs separated by commas. Always stored in the latest version's metadata. When `vault.get(id)` or `vault.getVersions(id)` is called, the SDK reads this field directly from the retrieved metadata — no secondary recall calls needed.

**`latestVersion`** — The highest version number. Written on every `storeVersion()` call. Allows instant latest-version resolution without scanning all versions.

**`derivedFrom`** — The artifactId of the artifact this one was generated from. Example: a report PDF derived from a dataset CSV. Enables lineage tracking in the Inspector.

**`dependsOn`** — Comma-separated artifactIds that this artifact requires to be meaningful. Example: a summary depends on the raw research files it summarized.

### Example

```
ARTIFACT_VAULT_META
id: f47ac10b-58cc-4372-a567-0e02b2c3d479
filename: q3-climate-analysis.pdf
contentType: application/pdf
blobId: 6XUOE-Q5-nAXHRifN6n9nomVDtHZQbGuAkW3PjlBuKo
size: 204800
version: 3
latestVersion: 3
versions: 1:PreviousBlobId1, 2:PreviousBlobId2, 3:6XUOE-Q5-nAXHRifN6n9nomVDtHZQbGuAkW3PjlBuKo
description: Final Q3 climate analysis with updated sea level projections
tags: climate, Q3, 2025, sea-level, final
agentId: research-agent-01
sessionId: session-2025-01-15
derivedFrom: a1b2c3d4-dataset-q3-raw-data
dependsOn: a1b2c3d4-dataset-q3-raw-data, e5f6g7h8-citations-index
createdAt: 2025-01-15T14:30:00Z
```

---

## Critical: Version Deduplication in search() and list()

Because MemWal memories are immutable, when a new version is stored, a new metadata memory is written but the old one still exists. A semantic recall for an artifact may return both the V1 and V3 metadata memories.

**The SDK MUST deduplicate before returning results.**

The deduplication logic lives in `packages/sdk/src/dedup.ts`:

```ts
// groupByLatestVersion
// Takes raw recall results (possibly containing multiple versions of same artifact)
// Returns only the highest version per artifactId

function groupByLatestVersion(results: StoredArtifact[]): StoredArtifact[] {
  const byId = new Map<string, StoredArtifact>();

  for (const artifact of results) {
    const existing = byId.get(artifact.id);
    if (!existing || artifact.version > existing.version) {
      byId.set(artifact.id, artifact);
    }
  }

  return Array.from(byId.values());
}
```

This function is called at the end of both `search()` and `list()` before returning results. Agents and developers always receive only the latest version of each artifact — stale versions never surface unless explicitly requested via `getVersions()`.

---

## Walrus Integration

We call the **Walrus HTTP API directly** via `fetch()`. No Walrus SDK package. This keeps the SDK lightweight and avoids Web3 wallet complexity.

### Store a file (CORRECT ENDPOINT)

```
PUT https://publisher.walrus.wal.app/v1/blobs?epochs=10
Content-Type: {file content type}
Body: {raw file bytes}
```

**Note:** The correct endpoint is `/v1/blobs`, NOT `/v1/store`. The latter does not exist and will fail immediately.

Response — new blob:
```json
{
  "newlyCreated": {
    "blobObject": {
      "id": "0x...",
      "blobId": "6XUOE-Q5-...",
      "size": 204800
    }
  }
}
```

Response — blob already exists (identical bytes):
```json
{
  "alreadyCertified": {
    "blobId": "6XUOE-Q5-..."
  }
}
```

Handle both shapes. In the `alreadyCertified` case, the blobId is still valid and can be stored in metadata.

### Read a file

```
GET https://aggregator.walrus.wal.app/v1/blobs/{blobId}
```

Response: raw file bytes with Content-Type header.

### Public endpoints

| Role | URL |
|---|---|
| Publisher (primary) | `https://publisher.walrus.wal.app` |
| Aggregator (primary) | `https://aggregator.walrus.wal.app` |
| Publisher (alt) | `https://walrus-testnet-publisher.staketab.org` |
| Aggregator (alt) | `https://walrus-testnet-aggregator.staketab.org` |

Both publisher and aggregator are configurable in `ArtifactVaultConfig` so developers can use their preferred endpoints.

---

## MemWal Integration

We use `@mysten-incubation/memwal` SDK.

### Credential model

One MemWal account. One delegate key. WalrusVault uses it in the `artifact-vault` namespace only. The developer's own text memories in other namespaces are never touched.

### How we use it

```ts
import { MemWal } from "@mysten-incubation/memwal";

const memwal = MemWal.create({
  key: config.memwalKey,
  accountId: config.memwalAccountId,
  serverUrl: config.memwalServerUrl ?? "https://relayer.memwal.ai",
  namespace: config.metadataNamespace ?? "artifact-vault",
});

// Store artifact metadata
const job = await memwal.remember(serializeMetadata(artifact));
// CRITICAL: always await the job — memory is not searchable until indexing completes
await memwal.waitForRememberJob(job.job_id);

// Search artifacts
const result = await memwal.recall({
  query: "Q3 climate analysis reports",
  limit: 50,          // fetch more than needed — dedup reduces final count
  maxDistance: 0.7,
});

// Filter to artifact metadata only, parse, then deduplicate
const artifacts = groupByLatestVersion(
  result.results
    .filter(r => isArtifactMetadata(r.text))
    .map(r => parseMetadata(r.text))
    .filter(Boolean)
);
```

**CRITICAL:** `memwal.remember()` returns immediately with a `job_id`. The memory is **not searchable yet**. Always call `await memwal.waitForRememberJob(job.job_id)` before returning from `store()`. Skipping this means newly stored artifacts won't appear in search results.

---

## MCP → Inspector Sync Webhook

When the SDK runs headlessly (via MCP in Claude Desktop, Cursor, or a terminal), uploads happen on the developer's local machine. The Inspector's Convex database has no automatic way to know about them.

**Solution:** Optional `inspectorUrl` in `ArtifactVaultConfig`. When set, the SDK fires a fire-and-forget POST after every successful `store()`:

```ts
// Inside vault.ts, after successful store
if (config.inspectorUrl) {
  // Fire and forget — never await, never throw, never block
  fetch(`${config.inspectorUrl}/api/sync-artifact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      artifact: storedArtifact,
      accountId: config.memwalAccountId,
    }),
  }).catch(() => {
    // Silently ignore all errors — sync is best-effort
  });
}
```

**The `/api/sync-artifact` route in `apps/web`:**

```ts
// app/api/sync-artifact/route.ts
export async function POST(req: Request) {
  const { artifact, accountId } = await req.json();

  // Write to Convex artifactCache
  await convex.mutation(api.artifacts.upsertCache, { artifact, accountId });

  // Write to Convex activityFeed
  await convex.mutation(api.activityFeed.append, {
    accountId,
    type: "artifact_stored",
    artifactId: artifact.id,
    filename: artifact.filename,
    timestamp: Date.now(),
  });

  return Response.json({ ok: true });
}
```

This means: developer uses Claude Desktop to store a file via the MCP → Inspector dashboard updates in real-time with no manual refresh.

---

## MCP Server Architecture

### Transport: stdio (primary)

Compatible with Claude Desktop, Claude Code, Cursor, Codex, Augment Code.

### Claude Desktop config snippet

```json
{
  "mcpServers": {
    "walrus-vault": {
      "command": "npx",
      "args": ["-y", "@walrus-vault/mcp"],
      "env": {
        "MEMWAL_PRIVATE_KEY": "your-delegate-key-hex",
        "MEMWAL_ACCOUNT_ID": "0x...",
        "WALRUS_PUBLISHER": "https://publisher.walrus.wal.app",
        "INSPECTOR_URL": "https://your-inspector.vercel.app"
      }
    }
  }
}
```

### MCP Tools

| Tool | Description |
|---|---|
| `vault_store_artifact` | Upload a file to Walrus, store metadata in MemWal |
| `vault_search_artifacts` | Semantic search — always returns latest version per artifact |
| `vault_get_artifact` | Get artifact detail and download URL by ID |
| `vault_list_artifacts` | List artifacts with optional filters |
| `vault_store_version` | Store a new version of an existing artifact |

### Tool Schemas

```ts
// vault_store_artifact
{
  content: string;           // base64-encoded file bytes
  filename: string;
  contentType: string;
  description?: string;
  tags?: string[];
  agentId?: string;
  epochs?: number;
  derivedFrom?: string;      // artifactId this was generated from
  dependsOn?: string[];      // artifactIds this depends on
}

// vault_search_artifacts
{
  query: string;             // natural language query
  limit?: number;
  contentType?: string;
  tags?: string[];
}

// vault_get_artifact
{
  artifactId: string;
}

// vault_list_artifacts
{
  tags?: string[];
  contentType?: string;
  agentId?: string;
  limit?: number;
}

// vault_store_version
{
  artifactId: string;        // ID of existing artifact (stable across versions)
  content: string;           // base64-encoded new version bytes
  description?: string;      // what changed in this version
}
```

---

## Inspector UI — Page Architecture

### Auth Flow

The Inspector requires MemWal credentials. On first load, if no credentials are stored in `localStorage`, the user sees the connect page. Credentials are stored client-side only — never persisted server-side.

**One account, two uses.** The same delegate key that WalrusVault uses internally is also the key the developer may use for their own text memories. The Inspector clarifies this on the connect page: "This is your MemWal account key. WalrusVault uses it in the `artifact-vault` namespace only — your other namespaces are untouched."

### Pages

#### `/` — Landing / Connect
- Hero section: "MemWal gives agents memory. WalrusVault gives agents files."
- Feature cards: Store, Search, Inspect
- SDK code snippet (5 lines)
- Connect form: delegate key + account ID
- Note: "Already using MemWal? Use your existing key — your memories won't be affected."
- Link to memwal.ai for creating a new account

#### `/dashboard` — Overview
- Stats row: total artifacts, total memories, storage used (estimated), namespaces active
- Recent artifacts grid (last 10)
- Recent activity feed (real-time Convex updates)
- Walrus epoch info: current epoch, days until oldest artifact expires

#### `/dashboard/artifacts` — Artifact Browser
- Grid/list toggle
- Filter bar: content type, tags, agent ID, date range
- Search bar: semantic search (debounced 300ms) → `vault.search()`
- Results: always latest version only (deduplication happens in SDK)
- Each card: file type icon, filename, tags badges, size, date, version badge if v>1
- Click → artifact detail

#### `/dashboard/artifacts/[id]` — Artifact Detail
- File preview: images inline, PDF iframe, JSON syntax highlighted, text monospace, others as download
- Metadata panel: filename, content type, tags, agent ID, session ID
- Walrus panel: blob ID (monospace + copy), download URL, link to walruscan.com/blob/{blobId}
- Version timeline: vertical connector, circles per version, current highlighted, click any version to load it
- "Store New Version" button — upload sheet with artifactId pre-filled
- Lineage panel: `derived_from` and `depends_on` links as clickable artifact references
- Raw metadata memory: expandable section showing the exact ARTIFACT_VAULT_META text

#### `/dashboard/memories` — Memory Browser
- Namespace selector (dropdown — includes `artifact-vault` and any others)
- Search input → `recall()` → results with cosine distance scores
- Each memory card: full text, distance bar (green 0.0 → red 1.0), numeric score, blob ID (copy), date
- Recall debugger mode: side-by-side query vs results

#### `/dashboard/delegates` — Delegate Key Manager
- Table: label, created date, public key (truncated + copy), actions
- Add key button → modal with label input
- Remove key button
- Current key badge — indicates which key is in active session
- Richer than memwal.ai's basic page

#### `/dashboard/ecosystem` — MemWal Ecosystem
Cards for every tool in the ecosystem — so developers see everything available in one place:

| Tool | Type |
|---|---|
| MemWal TypeScript SDK | SDK |
| MemWal Python SDK | SDK |
| MemWal MCP Server | MCP |
| MemWal Vercel AI Middleware | Integration |
| MemWal OpenClaw Plugin | Plugin |
| WalrusVault SDK (ours) | SDK |
| WalrusVault MCP (ours) | MCP |
| WalrusVault CLI (ours) | CLI |

Each card: name, one-line description, copy-able install command, link to docs.

---

## Convex Schema

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Local cache of artifact metadata for fast Inspector loads
  // Updated by /api/sync-artifact webhook (from MCP uploads) and directly (from web uploads)
  artifactCache: defineTable({
    artifactId: v.string(),
    blobId: v.string(),
    filename: v.string(),
    contentType: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),
    agentId: v.optional(v.string()),
    size: v.number(),
    version: v.number(),
    latestVersion: v.number(),
    derivedFrom: v.optional(v.string()),
    createdAt: v.string(),
    cachedAt: v.number(),    // unix ms, for cache invalidation
    accountId: v.string(),   // which account this belongs to
  })
    .index("by_account", ["accountId"])
    .index("by_account_content_type", ["accountId", "contentType"])
    .searchIndex("search_artifacts", {
      searchField: "filename",
      filterFields: ["accountId", "contentType"],
    }),

  // Real-time activity feed for dashboard overview
  activityFeed: defineTable({
    accountId: v.string(),
    type: v.union(
      v.literal("artifact_stored"),
      v.literal("artifact_searched"),
      v.literal("memory_recalled"),
      v.literal("version_stored")
    ),
    artifactId: v.optional(v.string()),
    filename: v.optional(v.string()),
    query: v.optional(v.string()),
    timestamp: v.number(),
  })
    .index("by_account", ["accountId"])
    .index("by_account_time", ["accountId", "timestamp"]),
});
```

---

## Environment Variables

```bash
# apps/web/.env.local

# Credentials come from user input (localStorage) — NOT server env vars
# NEXT_PUBLIC_MEMWAL_KEY=         ← comes from UI, stored in localStorage
# NEXT_PUBLIC_MEMWAL_ACCOUNT_ID=  ← comes from UI, stored in localStorage

# Walrus endpoints
NEXT_PUBLIC_WALRUS_AGGREGATOR=https://aggregator.walrus.wal.app
WALRUS_PUBLISHER=https://publisher.walrus.wal.app

# Convex
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
CONVEX_DEPLOY_KEY=

# MemWal relayer
NEXT_PUBLIC_MEMWAL_SERVER_URL=https://relayer.memwal.ai
```

```bash
# apps/mcp env (set in Claude Desktop config or .env)

MEMWAL_PRIVATE_KEY=          # delegate private key hex
MEMWAL_ACCOUNT_ID=           # MemWalAccount object ID on Sui
MEMWAL_SERVER_URL=https://relayer.memwal.ai
WALRUS_PUBLISHER=https://publisher.walrus.wal.app
WALRUS_AGGREGATOR=https://aggregator.walrus.wal.app
WALRUS_EPOCHS=10
VAULT_NAMESPACE=artifact-vault
INSPECTOR_URL=               # optional: your deployed Inspector URL for sync webhook
```

---

## Data Flow Diagrams

### Store an Artifact

```
vault.store(file, meta)
    │
    ├── 1. Generate artifactId (UUID v4)
    │
    ├── 2. PUT /v1/blobs to Walrus publisher  ← CORRECT ENDPOINT
    │   └── Returns blobId
    │
    ├── 3. Build metadata text (serializeMetadata())
    │   └── Includes: versions field (just "1:blobId" for new artifacts)
    │                 derivedFrom, dependsOn if provided
    │
    ├── 4. memwal.remember(metadataText)
    │   └── Returns job_id immediately — memory NOT searchable yet
    │
    ├── 5. await memwal.waitForRememberJob(job_id)  ← CRITICAL: do not skip
    │   └── Now memory is indexed and searchable
    │
    ├── 6. If config.inspectorUrl set → fire-and-forget POST /api/sync-artifact
    │
    └── 7. Return StoredArtifact { id, blobId, downloadUrl, version, versions, ... }
```

### Store a New Version

```
vault.storeVersion(artifactId, file, meta)
    │
    ├── 1. vault.get(artifactId) → retrieve current latest version's metadata
    │   └── latestVersion = N, versions = [1:BlobA, 2:BlobB, ..., N:BlobN]
    │
    ├── 2. PUT /v1/blobs to Walrus → new blobId for this version
    │
    ├── 3. Build new metadata with:
    │   ├── version: N+1
    │   ├── latestVersion: N+1
    │   ├── blobId: new blobId
    │   └── versions: [1:BlobA, 2:BlobB, ..., N:BlobN, N+1:newBlobId]
    │
    ├── 4. memwal.remember(newMetadataText)
    ├── 5. await memwal.waitForRememberJob(job_id)
    │
    └── 6. Return StoredArtifact (new version)

Note: old version's metadata memory still exists in MemWal.
The deduplication in search() and list() ensures only N+1 is returned.
```

### Search Artifacts (with deduplication)

```
vault.search("Q3 climate reports")
    │
    ├── 1. memwal.recall({ query, namespace: "artifact-vault", limit: 50 })
    │   └── Returns up to 50 results — may include multiple versions of same artifact
    │
    ├── 2. Filter: keep only results where isArtifactMetadata(text) === true
    │
    ├── 3. Parse each: parseMetadata(text) → StoredArtifact
    │
    ├── 4. groupByLatestVersion(artifacts)
    │   └── For each artifactId, keep only the entry with highest version number
    │
    ├── 5. Add downloadUrl = aggregator + "/v1/blobs/" + blobId per result
    │
    └── 6. Return sorted by relevance (distance ascending)
```

### vault.get(artifactId) — Deterministic Lookup

```
vault.get("f47ac10b-...")
    │
    ├── 1. memwal.recall({ query: "f47ac10b-...", namespace: "artifact-vault", limit: 10 })
    │   └── The artifactId string is in the metadata text → surfaces in recall results
    │
    ├── 2. Filter for isArtifactMetadata(), parse all results
    │
    ├── 3. Find exact match: artifact.id === "f47ac10b-..."
    │   └── Take the one with highest version (groupByLatestVersion)
    │
    ├── 4. Read versions field directly from metadata text
    │   └── Full version chain is deterministic — no secondary recall needed
    │
    └── 5. Return ArtifactDetail { ...artifact, versions: [...] }
    
    If no exact match found → return null
```

---

## Phase 5 Stretch Goals (Architecture Notes)

These are not part of MVP. Document the intended architecture so Phase 5 implementation is straightforward.

### Artifact Lineage Graph (Inspector)

The `derived_from` and `depends_on` fields in metadata already provide the data. Phase 5 adds a visual graph in the Inspector's artifact detail page using a lightweight graph library (D3 or similar). Nodes are artifacts. Edges are relationship types. Clicking a node navigates to that artifact's detail page.

### vault_link_artifacts MCP Tool (Phase 5)

Allows agents to declare relationships after the fact — not just at store time.

```ts
// Phase 5 MCP tool schema
vault_link_artifacts: {
  sourceArtifactId: string;
  targetArtifactId: string;
  relationship: "derived_from" | "depends_on" | "supersedes" | "references";
}
```

Implementation: updates the source artifact's MemWal metadata memory by storing a new memory with updated relationship fields. The existing memory remains (MemWal immutability) but deduplication in `get()` returns the newest.

### Agent State Checkpointing (Phase 5)

```ts
// Phase 5 MCP tools
vault_save_checkpoint: {
  taskId: string;       // stable identifier for the workflow
  state: object;        // agent state as JSON
  description?: string;
}

vault_load_checkpoint: {
  taskId: string;
}
```

Implementation: `save_checkpoint` serializes state to JSON, stores as a Walrus blob, metadata tags with `type: checkpoint, taskId: {id}`. `load_checkpoint` searches for latest checkpoint matching `taskId`.

### SEAL File Encryption (Phase 5)

Artifact file bytes encrypted via `@mysten/seal` before `PUT /v1/blobs`. Decryption key stored in SEAL's policy system tied to the developer's Sui address. Inspector handles decryption transparently when downloading.

### Walrus Epoch Expiry Warnings (Phase 5)

Query Walrus on-chain blob objects for end epoch. Inspector shows a warning badge on artifacts with fewer than 5 epochs remaining. One-click "Renew" button re-stores the file with a fresh epoch count (downloads current blob, re-uploads, updates metadata with new blobId as new version).
