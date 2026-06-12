# WalrusVault — Design Review, Red Team & Improvement Ideas

> Critical review of PROJECT_BRIEF.md, ARCHITECTURE.md, TECH_STACK.md, BUILD_PLAN.md, and FUTURE.md.
> Organized as: overall assessment → critical correctness flaws → security red team → reliability/scale
> concerns → spec inconsistencies → new feature ideas → demo-day risks → prioritized action list.

---

## 1. Overall Assessment

**Strengths worth keeping exactly as-is:**
- Scope discipline is excellent. The "What We Are NOT Building" section and FUTURE.md separation prevent the #1 hackathon killer: scope creep.
- The docs are genuinely execution-ready for AI coding sessions (exact endpoints, exact dedup code, acceptance criteria per phase, prompt template).
- Option A architecture (Walrus for bytes, MemWal namespace for metadata) is the right call — it keeps WalrusVault a thin, honest layer instead of a parallel database.
- The version-chain-in-latest-metadata decision is clever: it converts an approximate vector store into a deterministic version index — *once you've found the record*.

**The core structural tension:** The entire system's correctness rests on MemWal `recall()` —
an *approximate* vector search — being used as if it were an *exact* key-value lookup
(`get()`, `list()`, version resolution). Several flaws below are downstream of this one
tension, and the fixes mostly involve adding a thin deterministic index alongside recall.

---

## 2. Critical Correctness Flaws

### 2.1 `vault.get(artifactId)` relies on semantically searching for a UUID — HIGH RISK
ARCHITECTURE.md says the artifactId "is in the metadata text → surfaces in recall results."
This is the weakest assumption in the design. Embedding models are notoriously bad at
random token strings: a UUID query embeds as near-noise, and there is no guarantee the
matching metadata memory lands in the top 10 by cosine distance — especially as the vault
grows past a few dozen artifacts, or if `maxDistance` filtering applies. A `get()` that
intermittently returns `null` for an artifact that exists breaks `storeVersion()`,
`getVersions()`, the MCP `vault_get_artifact` tool, and the Inspector detail page.

**Fixes (in order of preference):**
1. Check whether MemWal exposes any exact/keyword retrieval, memory-ID lookup, or metadata
   filter API. If it does, use that for `get()` and reserve `recall()` for `search()` only.
2. If not: make the Convex `artifactCache` a first-class deterministic index, not just a UI
   cache. `get()` = Convex lookup by artifactId → returns `metaMemoryId`/blobId directly.
   MemWal remains source of truth; Convex is the index. (Requires SDK→Inspector sync to be
   reliable, not fire-and-forget — see 4.2.)
3. At minimum: in `get()`, raise `limit` substantially (e.g. 50), drop `maxDistance`
   entirely, and fall back to a full `list()` scan + exact-match filter when recall misses.
   Slow but correct. Document the latency.

**Test to add in Phase 1:** store 50 artifacts, then `get()` each one by ID. If any miss,
the architecture needs fix #1 or #2 before Phase 2.

### 2.2 Metadata text format is injectable — user fields can corrupt or spoof records
`parseMetadata()` parses line-oriented `key: value` text. Nothing stops a filename,
description, or tag from containing a newline + `version: 99`, `blobId: <attacker-blob>`,
or even a second `ARTIFACT_VAULT_META` block. Sources of hostile input are realistic:
agents store files with names they didn't choose, web-scraped titles become descriptions.
Consequences: parser corruption, version spoofing (dedup picks the forged higher version),
and lineage forgery (`derivedFrom` pointing at someone else's artifact).

**Fixes:**
- `serializeMetadata()` must sanitize every user-supplied field: strip/escape newlines,
  strip leading `key:`-shaped patterns, cap field lengths.
- `parseMetadata()` must validate: `version`/`latestVersion` are positive integers,
  blobIds match the expected base64url shape, artifactId is a valid UUID. Reject the
  record (return `null`) on violation rather than best-effort parsing.
- Add adversarial cases to the Phase 1 vitest suite (description containing
  `\nversion: 999\nblobId: evil`, filename containing `ARTIFACT_VAULT_META`).

### 2.3 `storeVersion()` read-modify-write race forks the version chain
Two agents (or one agent retrying) call `storeVersion(id)` concurrently: both read
`latestVersion: N`, both write metadata with `latestVersion: N+1` and version chains that
each miss the other's blob. Dedup then picks one arbitrarily — the other version's blob is
orphaned: paid for on Walrus, invisible everywhere. Multi-agent workflows are the *stated
target user*, so concurrent writes are not an edge case.

**Fixes:**
- MVP: document last-write-wins explicitly, and make `storeVersion()` re-`get()` after the
  remember-job completes to detect a fork (parsed `latestVersion` ≠ what was written →
  surface a `VersionConflictError` or auto-merge by re-writing a merged chain).
- Better: merge-on-read — when `get()` sees multiple records for one artifactId, union all
  `versions` entries across records instead of discarding lower-`latestVersion` records.
  This makes forks self-healing and costs ~10 lines in dedup logic.

### 2.4 `list()` cannot enumerate reliably
`recall("ARTIFACT_VAULT_META", limit: 100)` is a semantic query for a constant string —
ranking among results is essentially arbitrary, recall may apply distance cutoffs, and at
>100 metadata records (remember: every *version* is a record) enumeration is silently
incomplete. Cursor pagination over an array index of a non-deterministic ordering means
page 2 can repeat or skip items between calls.

**Fixes:**
- Check MemWal for a true list/scan API over a namespace (the Inspector's memory browser
  needs one anyway). Use it if it exists.
- Otherwise back `list()` with the Convex index (same fix as 2.1).
- At minimum: document `list()` as best-effort, raise the recall limit, and derive the
  cursor from stable artifact IDs rather than array positions.

### 2.5 Version history pollutes the embedding and bloats records
The `versions` field grows by one blobId per version inside the *embedded text*. A
30-version artifact carries 30 random base64 strings into its embedding, degrading the
semantic signal of filename/description/tags — the only fields that matter for search.
Unknown MemWal text-size limits make this a potential hard failure too.

**Fixes:**
- Restructure the memory text: semantic fields first (filename, description, tags), then a
  clearly delimited machine block (ids, blobIds, versions) — and check whether MemWal
  supports attaching non-embedded metadata to a memory. If it does, move all machine
  fields there.
- Cap the inline chain (e.g. last 20 versions) with an overflow pointer to a JSON
  version-manifest stored as its own Walrus blob.

---

## 3. Security Red Team

### 3.1 `/api/sync-artifact` is an unauthenticated write endpoint — cache poisoning
Anyone can POST `{ artifact, accountId }` for *any* accountId. Attacks: fill a victim's
Inspector with fake artifacts (phishing via "download" links to malicious blobs), spam the
activity feed, run up Convex quota. The artifact data is attacker-controlled and rendered
in the Inspector UI (filename, description → potential stored XSS if rendering is sloppy).

**Fixes:**
- Sign the webhook: SDK holds the delegate (Ed25519) key already — sign the payload, have
  the route verify the signature against the account's registered delegate public keys.
  This is cheap and on-theme (verifiability).
- Hackathon-minimum: shared secret header (`x-sync-token`) configured alongside
  `inspectorUrl`, plus rate limiting and payload schema validation.
- Either way: validate/sanitize every field before writing to Convex; render all strings
  as text, never HTML.

### 3.2 Delegate private key in localStorage + custom headers on every request
The Ed25519 *private* key sits in localStorage (readable by any XSS) and is shipped to
your Vercel server in `x-memwal-key` headers on every API call — where it can leak into
logs, error reporters, and edge middleware. One npm-supply-chain incident in the Inspector
and every connected user's key is exfiltrated.

**Mitigations (MVP-realistic):**
- Keep MemWal calls client-side wherever possible so the key never leaves the browser
  (`recall`, `remember` go to the relayer directly; Walrus blob fetches don't need the key
  at all). Reduce server-side key handling to the minimum.
- Where the key must transit the server: never log headers, strip them in error handlers,
  and say so in the docs.
- Add a strict CSP to the Inspector to blunt XSS.
- On the connect page, explicitly tell users to use a *scoped delegate key they can
  revoke*, not anything that controls funds — and link to revocation instructions.
- Honest framing for judges: "delegate keys are designed to be low-blast-radius and
  revocable; here's our threat model" beats pretending it's fully secure.

### 3.3 `/api/blobs/[blobId]` is an open proxy with content-type passthrough
Anyone can pull arbitrary Walrus blobs through your Vercel bandwidth (cost abuse), and a
blob with `text/html` served same-origin from the Inspector domain = XSS that reads
localStorage → key theft (combines with 3.2 into full compromise).

**Fixes:** serve with `X-Content-Type-Options: nosniff`; force
`Content-Disposition: attachment` except for an allowlist of preview-safe types
(images, PDF, plain text, JSON); never serve `text/html` inline; consider restricting the
proxy to blobIds present in the account's artifact set; add basic rate limiting.

### 3.4 Public-by-default files deserve louder treatment
The brief is honest that Walrus blobs are public, but agents are exactly the kind of user
that will pipe sensitive output (API results, internal reports, scraped PII) into
`vault.store()` without a human in the loop. **Fixes:** make the MCP tool description
state "stored PUBLICLY on a decentralized network — do not store secrets or personal
data" (the LLM reads tool descriptions and will act on this); show a persistent "public"
badge in the Inspector; consider a required `acknowledgePublic: true`-style flag or a
loud first-run warning in the SDK. This costs nothing and pre-empts the most damaging
judge question.

### 3.5 Smaller items
- `parseInt(process.env.WALRUS_EPOCHS)` → NaN poisoning if malformed; validate and fall back.
- Health-check route receives the key; ensure it never echoes credentials in error bodies.
- `relevanceScore: 1 - distance` goes negative when cosine distance > 1; clamp to [0, 1].

---

## 4. Reliability & Scale Concerns

### 4.1 Base64 file content through MCP tool calls won't survive real files
`vault_store_artifact { content: base64 }` means the *model* must emit the whole file
inside a tool call. A 2 MB PDF ≈ 2.7 MB of base64 ≈ ~700K tokens — far beyond any context
window. In practice this caps MCP uploads at a few hundred KB and burns the agent's
context either way. This undermines the headline use case ("research agent stores a PDF").

**Fix:** add a `filePath` alternative to `content` in `vault_store_artifact` and
`vault_store_version`. The MCP server runs locally on the user's machine — it can read the
path directly with zero tokens spent. Agents (Claude Code, Cursor) almost always have the
file on disk already. Keep `content` for small inline payloads. Same logic applies to
retrieval: add an optional `savePath` to `vault_get_artifact` so the server writes bytes
to disk instead of returning them through the model.

### 4.2 Fire-and-forget sync guarantees Inspector drift
Missed webhooks (Inspector asleep, network blip, cold start) silently desync Convex from
MemWal, and nothing reconciles. **Fix:** add a "Refresh from MemWal" action (and/or a
periodic reconcile on dashboard load) that re-runs `vault.list()` client-side and upserts
the Convex cache. This turns the cache from "hopefully right" into "eventually right" —
and it's also the recovery path that makes fix 2.1-option-2 viable.

### 4.3 Walrus public-endpoint realities will hit during the demo
- Public publishers enforce request-size limits (commonly ~10 MiB) and rate limits; a
  413/429 must produce a clear `WalrusUploadError` message ("file too large for public
  publisher — configure your own"), not a generic failure.
- Testnet epochs are short (~1 day). `epochs: 10` ≈ two weeks — fine for the hackathon,
  but the "permanent storage" pitch should say "persistent, with explicit paid lifetimes"
  or judges who know Walrus will call it out. The FUTURE.md expiry-warning feature is
  actually the honest answer; consider pulling a minimal version (show end-epoch on the
  detail page) into MVP since it's one aggregator/RPC call.
- Add retry-with-fallback to the alt publisher/aggregator already listed in
  ARCHITECTURE.md — single-endpoint dependence is the most likely live-demo failure.

### 4.4 `store()` latency is gated on embedding-job completion
`waitForRememberJob()` is correct for read-your-writes, but if indexing takes seconds, the
MCP tool feels slow and agents may time out. **Fix:** add `waitForIndexing?: boolean`
(default `true`) to store options; MCP can set `false` and return immediately with a note
that the artifact becomes searchable shortly — the blobId/downloadUrl are already valid.

### 4.5 Search-quality and dedup interactions
- Recall `limit: 50` then dedup means a many-versioned artifact can crowd out distinct
  artifacts from the candidate pool. With heavy versioning, distinct-artifact recall
  degrades invisibly. Mitigation: raise the candidate limit, and (better) reduce version
  records' searchability per 2.5.
- Client-side filters (tags/contentType/agentId) apply *after* the recall limit, so
  filtered searches can return 0 results even when matches exist beyond the candidate
  pool. Document it, and raise the candidate limit when filters are present.

---

## 5. Spec Inconsistencies to Clean Up (cheap, do before Phase 1)

1. `StoredArtifact.parentArtifactId` exists in the type but has no line in the
   ARTIFACT_VAULT_META schema and no explanation of when it's set. Remove it or spec it.
2. `activityFeed` defines `artifact_searched` / `memory_recalled` event types, but no
   component is specified to write them (sync webhook only writes `artifact_stored`).
   Either add the producing code paths (Inspector API routes log them) or drop the types.
3. `ArtifactVersion.size`/`description` are optional in the type, but the `versions:`
   field format (`1:BlobId`) can't carry them — so `getVersions()` can never return them
   for historical versions. Either extend the field format
   (`1:BlobId:size:createdAt`) or remove the unfillable optionals.
4. `dedup.ts` compares `artifact.version`, but for forked chains (2.3) records can share
   a `version`. Tie-break deterministically (e.g. by `createdAt`) so results are stable.
5. `uuid@^9` is pinned in TECH_STACK while everything else is `latest`; also Node 20+
   has `crypto.randomUUID()` built-in — the dependency can be dropped entirely.
6. BUILD_PLAN 2.2 says `/api/memories` requires `q`, but the memory browser spec implies
   browsing a namespace without a query. Decide whether empty-query listing is supported
   (relates to 2.4 — MemWal may not support it).
7. Verify the Walrus endpoints (`*.walrus.wal.app`) and `walruscan.com/blob/{id}` URL
   shape against current testnet docs before Phase 1 — host names have churned across
   Walrus releases, and the docs present them as load-bearing facts.

---

## 6. New Feature Ideas (ranked by value-to-effort for the hackathon)

1. **Content hash integrity (`sha256` in metadata)** — compute at store time, verify on
   `download()`. Trivial to build, and it turns "decentralized storage" into *verifiable*
   storage — directly strengthens the hackathon's "verifiable memory" criterion. Also
   enables optional store-time dedup ("identical content already stored as artifact X —
   create new artifact anyway or version X?"), which pairs naturally with Walrus's
   `alreadyCertified` response.
2. **`filePath` / `savePath` in MCP tools** — see 4.1. Arguably a bug fix, not a feature.
3. **Soft delete / archive (tombstones)** — store a `status: archived` metadata record;
   dedup hides archived artifacts from `search()`/`list()` unless `includeArchived: true`.
   Agents accumulate junk artifacts fast; with immutable storage you need *some* answer to
   "remove this from my results," and judges will ask.
4. **Auto-description for searchability** — at store time, optionally extract the first
   ~500 chars of text-like files (txt/md/json/csv) into the metadata description. Massive
   semantic-search quality win for near-zero effort, and demos brilliantly ("I never wrote
   a description, but it found the file from its contents").
5. **Expose artifacts as MCP *resources*, not just tools** — the MCP spec supports
   resources; listing recent artifacts as resources lets users attach them in Claude
   Desktop natively. Differentiates from every tools-only MCP server in the track.
6. **Minimal epoch-expiry display in MVP** — end-epoch on the artifact detail page (see
   4.3). The full warnings/renew flow stays Phase 5.
7. **`vault.stats()`** — counts, total bytes, by-agent/by-type breakdown. Powers the
   dashboard overview honestly (the spec currently doesn't say where those stats come
   from) and is useful SDK surface on its own.
8. **Collections/prefix grouping** — a lightweight `collection: research-run-42` metadata
   field so multi-artifact workflows group naturally in the Inspector. Cheaper than the
   full lineage graph and complements it.

---

## 7. Demo-Day & Judging Risks

- **Live dependencies:** the demo needs MemWal relayer + Walrus publisher + aggregator +
  Convex + Vercel all up simultaneously. Pre-record the video early (BUILD_PLAN already
  implies this); additionally pre-store demo artifacts the night before so search/browse
  works even if *writes* are degraded on demo day.
- **The "why not just S3 + pgvector?" question:** prepare a crisp answer. Current draft:
  verifiable + permanent + decentralized + no infra for the developer + portable across
  any MCP client with just a key pair. Rehearse it; the PROJECT_BRIEF's "defeats the
  purpose of building on Walrus" framing is circular and won't satisfy a skeptical judge.
- **The "isn't metadata-in-a-vector-DB fragile?" question:** after implementing §2 fixes,
  the answer is "recall is for *search*; ID lookups are deterministic via the index/
  merge-on-read." Without the fixes, there is no good answer.
- **Empty-vault first impression:** judges connecting a fresh account see nothing. Add a
  "seed demo artifacts" button or a guided first-upload flow.
- **Name collision check:** search npm and the hackathon field for existing
  "walrus vault"-style projects before printing the name on the submission.

---

## 8. Prioritized Action List

**Must fix before/during Phase 1 (correctness):**
1. Resolve the `get()`/`list()` determinism problem (§2.1, §2.4) — investigate MemWal's
   API surface first; this decision shapes the SDK.
2. Sanitize + validate metadata serialization (§2.2) with adversarial tests.
3. Merge-on-read version chains + conflict detection in `storeVersion()` (§2.3).
4. Clean up spec inconsistencies (§5) — 30 minutes of editing now saves rework later.

**Must fix before shipping Phase 2/3 (security):**
5. Authenticate `/api/sync-artifact` (§3.1).
6. Harden the blob proxy (§3.3) and minimize server-side key handling (§3.2).
7. Public-data warnings in MCP tool descriptions + Inspector (§3.4).

**High-value adds if on schedule:**
8. `filePath`/`savePath` MCP params (§4.1), content hashing (§6.1), reconcile-from-MemWal
   button (§4.2), publisher fallback + clear size-limit errors (§4.3).
