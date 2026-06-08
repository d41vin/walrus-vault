# WalrusVault — Build Plan

Phased execution plan ordered by dependency. Each phase has clear deliverables and acceptance criteria. Drop the relevant phase into any coding AI session along with ARCHITECTURE.md and TECH_STACK.md.

---

## Phase 0 — Monorepo Setup

**Goal:** Empty but correctly wired monorepo that all subsequent work builds into.

### Tasks

- [ ] `mkdir walrus-vault && cd walrus-vault`
- [ ] Init pnpm workspace: `pnpm init`
- [ ] Create `pnpm-workspace.yaml` (see TECH_STACK.md)
- [ ] Install Turborepo: `pnpm add turbo -D -w`
- [ ] Create `turbo.json` (see TECH_STACK.md)
- [ ] Create `.env.example` with all env var templates from ARCHITECTURE.md
- [ ] Create `.gitignore` (node_modules, .env.local, .next, dist, .turbo)
- [ ] Create `packages/sdk/` with `package.json`, `tsconfig.json`, `src/index.ts` (empty export)
- [ ] Create `packages/cli/` with `package.json` (stub only — build in Phase 4)
- [ ] Create `apps/mcp/` with `package.json`, `src/index.ts` (stub — build in Phase 3)
- [ ] Scaffold `apps/web/` via `pnpm create next-app@latest web` — TypeScript, Tailwind, App Router, import alias `@/`
- [ ] Install shadcn: `pnpm dlx shadcn@latest init` inside `apps/web`
- [ ] Install all shadcn components from TECH_STACK.md
- [ ] Set up Convex: `pnpm dlx convex@latest dev` first run inside `apps/web`
- [ ] Add `@walrus-vault/sdk: "workspace:*"` to `apps/web` and `apps/mcp` package.json
- [ ] Verify `pnpm install` from root — no errors
- [ ] Verify `pnpm turbo dev` starts the Next.js dev server

### Acceptance Criteria
- `pnpm install` from root completes with no errors
- `cd apps/web && pnpm dev` starts Next.js on localhost:3000
- Workspace package `@walrus-vault/sdk` resolves in apps/web without errors

---

## Phase 1 — Core SDK

**Goal:** `@walrus-vault/sdk` fully functional. A developer can store a file, retrieve it, search for it, and version it using only the SDK. No UI needed yet.

### 1.1 — Types (`packages/sdk/src/types.ts`)

Define all TypeScript interfaces (copy exact shapes from ARCHITECTURE.md → "Return Types"):

- `ArtifactVaultConfig` — including new `inspectorUrl?: string` field
- `StoredArtifact` — including `latestVersion`, `versions: ArtifactVersion[]`, `derivedFrom?`, `dependsOn?`
- `ArtifactSearchResult` — extends `StoredArtifact`, adds `distance` and `relevanceScore`
- `ArtifactDetail` — extends `StoredArtifact`, adds `walrusBlobInfo`
- `ArtifactVersion` — `{ version, blobId, description?, createdAt, size? }`
- `ArtifactListResult` — `{ artifacts, total, cursor? }`
- `StoreOptions` — all store() params
- `SearchOptions` — query + filters
- `ListOptions` — filters only

### 1.2 — Metadata Schema (`packages/sdk/src/metadata.ts`)

Implement the full ARTIFACT_VAULT_META text format from ARCHITECTURE.md:

**Functions to implement:**

`serializeMetadata(artifact: StoredArtifact): string`
Converts artifact object to the ARTIFACT_VAULT_META text format. All fields must be present. The `versions` field serializes as `"1:BlobIdA, 2:BlobIdB, 3:BlobIdC"`. The `dependsOn` field serializes as comma-separated artifactIds or `"none"`.

`parseMetadata(text: string): StoredArtifact | null`
Parses the text format back to a `StoredArtifact`. Returns `null` if the text does not start with `"ARTIFACT_VAULT_META"`. Must correctly parse the `versions` field back to `ArtifactVersion[]`. Must handle missing optional fields gracefully (return undefined/empty array, not throw).

`isArtifactMetadata(text: string): boolean`
Returns `text.trimStart().startsWith("ARTIFACT_VAULT_META")`.

`generateArtifactId(): string`
Returns `uuid()` — stable, never changes across versions.

`parseVersionsField(raw: string): ArtifactVersion[]`
Parses `"1:BlobIdA, 2:BlobIdB"` into `[{ version: 1, blobId: "BlobIdA" }, { version: 2, blobId: "BlobIdB" }]`.

`serializeVersionsField(versions: ArtifactVersion[]): string`
Inverse of parseVersionsField.

### 1.3 — Deduplication Utility (`packages/sdk/src/dedup.ts`)

```ts
export function groupByLatestVersion(artifacts: StoredArtifact[]): StoredArtifact[] {
  const byId = new Map<string, StoredArtifact>();
  for (const artifact of artifacts) {
    const existing = byId.get(artifact.id);
    if (!existing || artifact.version > existing.version) {
      byId.set(artifact.id, artifact);
    }
  }
  return Array.from(byId.values());
}
```

This is called at the end of both `search()` and `list()` before returning. It is the single most important correctness guarantee in the SDK.

### 1.4 — Custom Errors (`packages/sdk/src/errors.ts`)

```ts
export class WalrusUploadError extends Error { ... }
export class WalrusDownloadError extends Error { ... }
export class MetadataStoreError extends Error { ... }
export class ArtifactNotFoundError extends Error { ... }
export class InvalidConfigError extends Error { ... }
```

### 1.5 — Walrus HTTP Client (`packages/sdk/src/walrus-client.ts`)

Class `WalrusClient`:

```ts
constructor(publisher: string, aggregator: string)

async store(data: Buffer | Uint8Array, contentType: string, epochs: number): Promise<{ blobId: string; size: number; alreadyExists: boolean }>

async download(blobId: string): Promise<Uint8Array>

getBlobUrl(blobId: string): string
// returns: `${this.aggregator}/v1/blobs/${blobId}`
```

**CRITICAL — CORRECT ENDPOINT:** `PUT {publisher}/v1/blobs?epochs={n}` — NOT `/v1/store`. Using the wrong endpoint will cause an immediate 404 failure.

Handle both Walrus response shapes:
- `{ newlyCreated: { blobObject: { blobId, size } } }` — new blob uploaded
- `{ alreadyCertified: { blobId } }` — identical bytes already exist, reuse blobId

Set `Content-Type` header on PUT to match the file's content type. Do not set authentication headers — Walrus public publisher requires none.

Throw `WalrusUploadError` on non-2xx responses. Throw `WalrusDownloadError` on download failures.

### 1.6 — Main ArtifactVault Class (`packages/sdk/src/vault.ts`)

Implement all methods. Critical implementation notes per method:

**`store(data, meta)`**
1. Validate config — throw `InvalidConfigError` if memwalKey or memwalAccountId missing
2. Generate `artifactId` via `generateArtifactId()`
3. Upload to Walrus: `walrusClient.store(data, meta.contentType, config.walrusEpochs ?? 10)`
4. Build `StoredArtifact` object with `version: 1`, `latestVersion: 1`, `versions: [{ version: 1, blobId }]`
5. Serialize to metadata text: `serializeMetadata(artifact)`
6. `await memwal.remember(metadataText)` — get job_id back
7. **`await memwal.waitForRememberJob(job.job_id)`** — DO NOT SKIP. Memory is not searchable until this resolves.
8. If `config.inspectorUrl` set, fire-and-forget `fetch(inspectorUrl + "/api/sync-artifact", ...)` — wrap in try-catch, never await, never throw
9. Return `StoredArtifact`

**`storeVersion(artifactId, data, meta)`**
1. `const current = await this.get(artifactId)` — must exist, throw `ArtifactNotFoundError` if null
2. New version number: `current.latestVersion + 1`
3. Upload new blob to Walrus
4. Build new versions array: `[...current.versions, { version: newVersion, blobId: newBlobId }]`
5. Build new metadata with updated `version`, `latestVersion`, `blobId`, `versions`
6. `await memwal.remember(newMetadataText)` + `await memwal.waitForRememberJob(job_id)`
7. Fire inspector sync if configured
8. Return new `StoredArtifact`

**`get(artifactId)`**
1. `memwal.recall({ query: artifactId, namespace, limit: 10 })`
2. Filter with `isArtifactMetadata()`, parse all
3. Filter for exact `artifact.id === artifactId`
4. `groupByLatestVersion()` — take the single result
5. Read `versions` field from parsed metadata — version chain is deterministic, no secondary recall
6. Return `ArtifactDetail` or `null`

**`search(query, filters)`**
1. `memwal.recall({ query, namespace, limit: 50 })` — fetch more than needed to allow for dedup reduction
2. Filter with `isArtifactMetadata()`, parse all
3. Apply `filters` (contentType, tags, agentId) client-side
4. `groupByLatestVersion()` — single most important step
5. Map distance → relevanceScore: `1 - distance`
6. Add `downloadUrl` per result
7. Sort by distance ascending (most relevant first)
8. Slice to `filters.limit ?? 10`
9. Return `ArtifactSearchResult[]`

**`list(filters)`**
1. `memwal.recall({ query: "ARTIFACT_VAULT_META", namespace, limit: 100 })`
2. Filter with `isArtifactMetadata()`, parse all
3. Apply filters client-side
4. `groupByLatestVersion()`
5. Client-side pagination using cursor (array index)
6. Return `ArtifactListResult`

**`getVersions(artifactId)`**
1. `const detail = await this.get(artifactId)` — reads version chain from metadata
2. Return `detail.versions` sorted by version number ascending
3. Throw `ArtifactNotFoundError` if artifact not found

**`getDownloadUrl(blobId)`**
Returns `${aggregator}/v1/blobs/${blobId}`

**`download(blobId)`**
Calls `walrusClient.download(blobId)` → returns `Uint8Array`

### 1.7 — Exports (`packages/sdk/src/index.ts`)

```ts
export { ArtifactVault } from "./vault";
export { WalrusClient } from "./walrus-client";
export * from "./types";
export * from "./errors";
```

### 1.8 — Build and Tests

- `pnpm build` in packages/sdk — verify dist/ generates ESM + CJS + types
- Write vitest tests for:
  - `serializeMetadata()` → `parseMetadata()` round-trip (all fields preserved)
  - `isArtifactMetadata()` positive and negative cases
  - `groupByLatestVersion()` correctly picks highest version when duplicates present
  - `parseVersionsField()` and `serializeVersionsField()` round-trip
  - `WalrusClient.getBlobUrl()` returns correct URL format
  - `generateArtifactId()` returns a valid UUID

### Acceptance Criteria for Phase 1
- `ArtifactVault.create(config)` instantiates without error given valid config
- `vault.store(buffer, meta)` uploads to Walrus and stores metadata in MemWal — verify by checking MemWal dashboard for the artifact-vault namespace
- `vault.search("query")` returns only latest versions, no duplicate stale versions
- `vault.get(id)` returns correct artifact with version chain
- `vault.list()` returns all artifacts, deduplicated by latest version
- `vault.storeVersion(id, buffer)` increments version correctly and updates versions chain in metadata
- `vault.getVersions(id)` returns all versions sorted correctly without secondary recall calls
- All TypeScript types pass `tsc --noEmit` with zero errors

---

## Phase 2 — Inspector Web App

**Goal:** Working Next.js dashboard where a developer connects their MemWal credentials, browses artifacts, inspects memories, manages delegates, and sees the full ecosystem.

### 2.1 — Convex Schema and Auth

**Copy Convex schema exactly from ARCHITECTURE.md → "Convex Schema".**

Note the new fields added vs original: `latestVersion` and `derivedFrom` in `artifactCache`.

**Session (`lib/session.ts`):**
```ts
export const saveCredentials = (key: string, accountId: string): void => {
  localStorage.setItem("wv_key", key);
  localStorage.setItem("wv_account_id", accountId);
};
export const loadCredentials = (): { key: string; accountId: string } | null => { ... };
export const clearCredentials = (): void => { ... };
```

**Connect Gate (`components/layout/connect-gate.tsx`):**
Reads credentials from localStorage. If missing → render connect page. If present → render children.

**Connect Page (`app/page.tsx`):**
- Hero: "MemWal gives agents memory. WalrusVault gives agents files."
- Connect form: delegate key (password input) + account ID (text input)
- Important note: "Use your existing MemWal key — WalrusVault stores in the `artifact-vault` namespace only. Your other memories are untouched."
- Link to memwal.ai for creating a new account
- On submit: validate via `/api/health`, save credentials, redirect to `/dashboard`

**`/api/health` route:** Instantiates MemWal with provided credentials, calls a lightweight operation, returns 200 or 401.

**`/api/sync-artifact` route (POST):**
Receives `{ artifact, accountId }` from SDK's fire-and-forget webhook. Updates `artifactCache` and `activityFeed` in Convex. Returns `{ ok: true }`. This is how MCP uploads show up in the Inspector without a page refresh.

### 2.2 — API Routes

All routes read delegate key and account ID from custom request headers (`x-memwal-key`, `x-memwal-account-id`) sent by the client. Credentials never persist server-side.

**`/api/artifacts` (GET):** `q` param → `vault.search()`, else → `vault.list()`. Returns `StoredArtifact[]`.

**`/api/artifacts/[id]` (GET):** Returns `ArtifactDetail` including full `versions` array.

**`/api/artifacts` (POST):** Multipart form upload. Calls `vault.store()`. Returns `StoredArtifact`.

**`/api/memories` (GET):** `q` param required. Calls MemWal `recall()` directly. Returns raw recall results with distance scores.

**`/api/delegates` (GET):** Returns delegate keys from MemWal account.

**`/api/blobs/[blobId]` (GET):** Proxies to Walrus aggregator. Streams blob bytes. Sets Content-Type from Walrus response. Use this for file preview — avoids CORS issues with direct Walrus URLs.

### 2.3 — Dashboard Layout

Sidebar nav: Overview, Artifacts, Memories, Delegates, Ecosystem. Active state highlight. Bottom: links to docs and GitHub. Header: truncated account ID, disconnect button.

### 2.4 — Overview Page (`/dashboard`)

Stats row: total artifacts, total memories, estimated storage, active namespaces. Recent artifacts grid (last 10). Real-time activity feed from Convex `activityFeed` table (updates when MCP uploads happen via sync webhook).

### 2.5 — Artifact Browser (`/dashboard/artifacts`)

Grid/list toggle. Filter bar (content type, tags, agent ID). Semantic search bar debounced 300ms. Results are always deduped latest versions (SDK handles this). Upload button → drag-drop sheet → POST `/api/artifacts`. Each card shows version badge if v>1.

### 2.6 — Artifact Detail (`/dashboard/artifacts/[id]`)

File preview: images via `<img>`, PDFs via `<iframe>`, JSON syntax highlighted, text in monospace, others as download link. All served via `/api/blobs/[blobId]` to handle CORS.

Metadata panel: all fields. Blob ID in monospace with copy button. Link to `https://walruscan.com/blob/{blobId}`.

Version timeline: vertical connector, circle per version, current version highlighted, click any to load that version's blob.

**Lineage panel:** Shows `derived_from` as a clickable link to that artifact's detail page. Shows `depends_on` list as clickable links. If both are empty, show "No lineage declared — agents can declare relationships using `derived_from` and `depends_on` fields."

Raw metadata section: expandable, shows the exact `ARTIFACT_VAULT_META` text stored in MemWal.

"Store New Version" button: opens upload sheet with `artifactId` pre-filled.

### 2.7 — Memory Browser (`/dashboard/memories`)

Namespace selector. Search input → `/api/memories?q=...&namespace=...`. Each result card: full text, distance bar (Tailwind gradient green→red), numeric cosine distance, relevance percentage, blob ID copy button. Recall debugger mode: two-column layout, query left, results right.

### 2.8 — Delegate Key Manager (`/dashboard/delegates`)

Table of all registered keys. Current key badge. Add/remove actions. Richer than memwal.ai's basic page.

### 2.9 — Ecosystem Tab (`/dashboard/ecosystem`)

Cards for all tools listed in ARCHITECTURE.md → Ecosystem. Each card: name, description, install command (copy button), link to docs.

### Acceptance Criteria for Phase 2
- Connect page validates credentials correctly
- `/dashboard/artifacts` loads, searches, and filters
- Artifact detail shows preview, version timeline, lineage panel, raw metadata
- Memory browser shows recall results with distance scores
- Delegate manager shows and manages keys
- MCP upload → sync webhook → real-time update in Inspector (test with a manual POST to `/api/sync-artifact`)
- No TypeScript errors across entire apps/web

---

## Phase 3 — MCP Server

**Goal:** Working MCP server installable via `npx @walrus-vault/mcp`. Developers can store and retrieve files from Claude Desktop, Cursor, and Codex as native tool calls.

### Setup

Entry: `apps/mcp/src/index.ts`. Transport: stdio. Build: tsup to single CJS file.

### Credential Loading (`apps/mcp/src/auth.ts`)

Load from environment:
```ts
function loadConfig(): ArtifactVaultConfig {
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  if (!key || !accountId) {
    throw new Error("MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID are required");
  }
  return {
    memwalKey: key,
    memwalAccountId: accountId,
    memwalServerUrl: process.env.MEMWAL_SERVER_URL,
    walrusPublisher: process.env.WALRUS_PUBLISHER,
    walrusAggregator: process.env.WALRUS_AGGREGATOR,
    walrusEpochs: process.env.WALRUS_EPOCHS ? parseInt(process.env.WALRUS_EPOCHS) : 10,
    metadataNamespace: process.env.VAULT_NAMESPACE ?? "artifact-vault",
    inspectorUrl: process.env.INSPECTOR_URL,  // optional sync webhook
  };
}
```

### Tool Implementations

**`vault_store_artifact`:** base64 decode `content` → Buffer → `vault.store()`. Return: id, blobId, downloadUrl, version, size, filename.

**`vault_search_artifacts`:** `vault.search(query, options)`. Return: array of artifacts with downloadUrls and relevance scores. Results are already deduped by SDK.

**`vault_get_artifact`:** `vault.get(artifactId)`. Return: full artifact detail including all versions.

**`vault_list_artifacts`:** `vault.list(filters)`. Return: artifacts array.

**`vault_store_version`:** base64 decode `content` → `vault.storeVersion(artifactId, buffer, { description })`. Return: new version detail.

### Tool Schemas

See ARCHITECTURE.md → "MCP Tools" → "Tool Schemas" for exact input shapes.

### README for MCP (`apps/mcp/README.md`)

Include:
- What it does in one sentence
- Claude Desktop config JSON snippet (see ARCHITECTURE.md)
- All 5 tool names with one-line descriptions
- Environment variables table
- Link to WalrusVault Inspector

### Acceptance Criteria for Phase 3
- `npx @walrus-vault/mcp` starts without error (after building)
- Tool `vault_store_artifact` successfully uploads a file when called from Claude Desktop
- Tool `vault_search_artifacts` returns correct results
- If `INSPECTOR_URL` is set, the Inspector dashboard updates in real-time after MCP upload
- All 5 tools function correctly
- `tsc --noEmit` passes with zero errors

---

## Phase 4 — Polish, Landing Page, Deploy

**Goal:** Everything is deployed, documented, and ready for judges to use and evaluate.

### UI Polish
- [ ] Loading skeletons on all data-fetching pages
- [ ] Error states: failed to connect, no artifacts found, Walrus timeout
- [ ] Toast notifications for all mutations (store, version, remove delegate)
- [ ] Empty states with helpful CTAs
- [ ] Mobile-responsive sidebar (sheet drawer on small screens)
- [ ] Keyboard shortcut: `Cmd+K` → search

### Landing Page
Landing page at `app/page.tsx` (before auth):
- Hero: "MemWal gives agents memory. WalrusVault gives agents files."
- 3 feature cards: Store, Search, Inspect
- SDK code snippet (store + search, 8 lines max)
- Install commands: npm + npx for MCP
- "Open Inspector" CTA → scrolls to connect form
- GitHub and docs links

### Deployment
- [ ] Push to GitHub (public repo)
- [ ] Deploy `apps/web` to Vercel (connect GitHub repo)
- [ ] Deploy Convex backend: `pnpm dlx convex@latest deploy`
- [ ] Publish `@walrus-vault/sdk` to npm: `npm publish --access public`
- [ ] Publish `@walrus-vault/mcp` to npm: `npm publish --access public`
- [ ] Verify `npx @walrus-vault/mcp` installs and runs correctly
- [ ] Verify `npm install @walrus-vault/sdk` installs in a fresh project

### Demo Video Script (3-4 minutes)
1. State the problem: "Agents generate files. Those files have nowhere to go." (30s)
2. Show SDK: 5 lines to store a PDF and search for it by meaning (45s)
3. Show MCP: Claude Desktop stores a file via tool call, new session retrieves it (60s)
4. Show Inspector: artifact browser, detail page, version timeline, lineage panel (45s)
5. Show memory browser: debug a recall query, see cosine distance scores (30s)
6. Close: "WalrusVault. The missing artifact layer for AI agents." (30s)

---

## After Phase 4 — What's Next

See `FUTURE.md` for all stretch goals, post-MVP directions, and the second hackathon submission (LLM Wiki). Nothing in FUTURE.md is part of the MVP build. Do not start any of it until Phases 0-4 are complete and polished.

---

## Prompt Templates for Coding AI Sessions

Use this when starting a new session with Claude Code, Codex, or Augment Code:

```
I am building WalrusVault, a file artifact storage layer for AI agents built on 
Walrus and MemWal. Read the attached files for complete context:

- PROJECT_BRIEF.md — what we're building and why, architecture decision (Option A)
- ARCHITECTURE.md — technical design, all method signatures, metadata schema, 
                     data flow diagrams, MCP tools, Convex schema
- TECH_STACK.md — all technology decisions, package.json shapes, design tokens
- BUILD_PLAN.md — phased task list with acceptance criteria

Today's task: [describe specific Phase N task from BUILD_PLAN.md]

Important implementation notes for this session:
- Walrus upload endpoint is PUT /v1/blobs (NOT /v1/store)
- Always await memwal.waitForRememberJob(job_id) after remember() — never skip this
- search() and list() must call groupByLatestVersion() before returning — no stale duplicates
- vault.get(id) reads version chain from metadata text — no secondary recall calls
```
