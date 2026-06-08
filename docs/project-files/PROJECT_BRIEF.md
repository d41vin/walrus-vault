# WalrusVault — Project Brief

> **Hackathon:** Walrus Track  
> **Tagline:** MemWal gives agents memory. WalrusVault gives agents files.

---

## The Problem We're Solving

MemWal solves text memory for AI agents. Walrus solves decentralized blob storage. But neither solves the gap in between: **agents that generate files.**

A research agent produces a PDF report. A data agent outputs a CSV. A code agent writes a script. A monitor agent logs structured JSON. Today, those files go nowhere useful — dumped to disk, lost between sessions, invisible to other agents, unretrievable by meaning.

The Walrus hackathon track explicitly asks for:
> *"Artifact-driven workflows, where agents generate, store, and reuse files like datasets, logs, reports, or intermediate outputs."*

Nobody has built this. WalrusVault is the answer.

---

## What WalrusVault Is

WalrusVault is a two-part system:

### Part 1 — The Artifact Vault (SDK + MCP)
An agent-native file storage layer built on Walrus + MemWal.

- **File bytes** → stored on Walrus as a raw blob → returns a `blob_id`
- **Metadata** (filename, tags, description, agent ID, content type, version chain, artifact relationships) → stored in MemWal as a structured text memory in the `artifact-vault` namespace → semantically searchable
- **Result:** agents can store any file and retrieve it later with a natural language query like `"find the Q3 climate report"` rather than needing to know a blob ID

**What makes it "agent-friendly":**
1. Semantic search over artifacts by meaning, not keywords
2. An MCP server so Claude, Cursor, and Codex can store/retrieve files as native tool calls
3. Versioning — each artifact can have multiple versions, all immutably stored on Walrus, with the full version chain encoded directly in the latest metadata record
4. Artifact relationships — artifacts can declare `derived_from` and `depends_on` links to other artifacts, forming a traceable lineage graph
5. No raw Walrus plumbing — the developer calls `vault.store(file, metadata)` and `vault.search(query)`

### Part 2 — The Inspector UI
A developer-facing dashboard that makes everything stored on Walrus + MemWal visible, browsable, and debuggable.

**What it shows:**
- All artifacts stored via Artifact Vault: preview, versions, metadata, Walrus blob details (blob ID, expiry epoch, size)
- Artifact lineage graph: visual view of how artifacts relate to and derive from each other
- All MemWal text memories (any namespace): raw text, cosine distance scores, recall debugging
- Delegate key management (richer than the basic memwal.ai dashboard)
- An Ecosystem tab listing all existing MemWal tools so developers see the full picture in one place

**Why it matters:** Right now, a developer using MemWal has no way to see what their agent actually stored, why a recall returned the wrong result, or when a blob is about to expire on Walrus. The Inspector makes the invisible visible.

---

## What We Are NOT Building

To be precise about scope:

- We are **not** rebuilding the MemWal MCP — it already exists (`@mysten-incubation/memwal-mcp`). Our MCP is an **Artifact Vault MCP** — specifically for file storage/retrieval, which doesn't exist.
- We are **not** rebuilding the MemWal SDK or relayer — we use them internally as a dependency.
- We are **not** building LangChain adapters or ChatGPT integrations — out of scope.
- We are **not** handling text memory for the developer — MemWal handles that. We handle files.
- We are **not** wrapping MemWal's text memory SDK — that would duplicate work the MemWal team has already done.

---

## Architecture: Option A

This is the architecture we are building. It is the only option we are building.

```
Developer text memories
        ↓
    MemWal (developer manages this themselves, not our concern)

Developer artifacts
        ↓
   WalrusVault SDK
        │
        ├──► Walrus (file bytes)
        └──► MemWal artifact-vault namespace (metadata only, internal to WalrusVault)
```

WalrusVault uses MemWal internally — but only in an isolated `artifact-vault` namespace — to store and semantically search artifact metadata. The developer's own text memories in their own namespaces are completely untouched.

---

## How It Works — End to End

```
Developer/Agent wants to store a file
         │
         ▼
  ArtifactVault.store(fileBuffer, { filename, tags, description })
         │
         ├──► Walrus HTTP API (PUT /v1/blobs)
         │    File bytes uploaded → returns blob_id
         │
         ├──► MemWal SDK (remember())
         │    Structured metadata stored as text memory
         │    in namespace "artifact-vault"
         │
         └──► [Optional] POST /api/sync-artifact to Inspector
              Updates Convex cache in real-time even for headless MCP uploads

Developer/Agent wants to find a file
         │
         ▼
  ArtifactVault.search("Q3 climate research reports")
         │
         └──► MemWal SDK (recall())
              Semantic search over artifact-vault namespace
              → results grouped by artifactId, only latest version per artifact returned
              → includes Walrus download URL for each match

Inspector UI reads everything
         │
         ├──► Calls our own API routes
         ├──► API routes query MemWal relayer for memories + artifact metadata
         └──► API routes query Walrus aggregator for blob details
```

---

## Key Design Decisions

**Why MemWal for metadata, not a database?**
Because MemWal makes metadata semantically searchable and verifiable on-chain. A Postgres database is centralized and not portable — it defeats the purpose of building on Walrus. MemWal's semantic search is exactly what turns a flat storage bucket into a retrieval system.

**Why a separate `artifact-vault` namespace?**
So that artifact metadata never pollutes or interferes with the developer's own MemWal text memories in their app. Clean separation. The developer's `personal`, `work`, `research` namespaces are completely untouched. They share one MemWal account but the namespaces isolate everything.

**Why store metadata as readable text, not JSON?**
MemWal's embedding engine understands natural language better than JSON syntax. Storing `filename: q3-report.pdf tags: climate, Q3, final` produces better semantic search results than `{"filename":"q3-report.pdf","tags":["climate","Q3","final"]}`. The text format is also readable directly in the Inspector without any parsing layer.

**Why is the version chain stored in metadata, not via secondary recall?**
Walrus blobs are immutable. MemWal recall is approximate (vector search, not exact lookup). Storing the full version chain directly in the latest version's metadata text (`versions: 1:BlobIdA, 2:BlobIdB, 3:BlobIdC`) makes version history 100% deterministic — no secondary searches, no missed versions.

**Are artifacts encrypted?**
Artifact metadata (stored via MemWal) is encrypted via SEAL automatically. The artifact files themselves on Walrus are public by default (Walrus blobs are public by nature). File-level encryption via SEAL is a Phase 5 stretch goal.

**Are artifacts immutable?**
Yes, like all Walrus blobs. "Editing" creates a new version. Every version lives on-chain. The Inspector shows the full version history.

**Does the developer need their own MemWal account?**
Yes — one MemWal delegate key and account ID, obtained in ~2 minutes at memwal.ai. This same key is used for two purposes under one account: (1) by WalrusVault internally to store artifact metadata in the `artifact-vault` namespace, and (2) by the developer directly if they use MemWal for their own text memories in separate namespaces. One account, one key, namespaces keep everything separated.

---

## Target User

A developer building an AI agent system who:
- Has agents that generate files as output (reports, datasets, logs, code, analysis)
- Currently has no good place to put those files that persists across sessions
- Wants to retrieve them later by meaning, not by blob ID
- May or may not already be using MemWal for text memory

Secondary user: any developer using MemWal who wants a better way to inspect and debug what their agents are remembering.

---

## Hackathon Criteria Coverage

| Criteria | How WalrusVault hits it |
|---|---|
| Long-term memory using persistent, verifiable memory | Artifact metadata in MemWal = persistent + verifiable on-chain |
| Persistent data and file access using Walrus | Files stored as Walrus blobs, retrieved by blob ID |
| Cross-tool memory sharing | Artifacts stored via SDK are retrievable via MCP in any MCP client |
| Artifact-driven workflows | This is the entire point of the Artifact Vault |
| Integrations and tooling for developers | SDK + MCP + CLI = complete developer toolchain |
| Inspect, debug, or manage agent memory | Inspector UI is purpose-built for this |

---

## Components Summary

| Component | Type | Priority | Description |
|---|---|---|---|
| `@walrus-vault/sdk` | npm package | P0 — build first | Core ArtifactVault class wrapping Walrus + MemWal |
| Inspector Web App | Next.js app | P0 — build alongside | Dashboard for artifacts + memories + delegates |
| `@walrus-vault/mcp` | MCP server | P1 — build second | Artifact tools for Claude, Cursor, Codex |
| `walrus-vault` CLI | npm binary | P2 — build last | Terminal interface for artifact operations |

---


## Beyond MVP

See `FUTURE.md` for all post-MVP work: stretch goals, the second hackathon submission (LLM Wiki on Walrus), and longer-term vision. Nothing in FUTURE.md is part of the MVP build.

---

## Project Name

**WalrusVault** — final. Not a working title. The name communicates files, Walrus, and permanence in two words. Judges who know Walrus understand immediately.
