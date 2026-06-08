# WalrusVault — Future Directions

> **Important:** Nothing in this file is part of the hackathon MVP. These are post-MVP directions, tackled after Phases 0-4 are complete and polished. Do not build any of this until the core is shipped and working.

---

## Why This File Exists Separately

The BUILD_PLAN.md covers only the hackathon MVP — Phases 0-4. This file captures where WalrusVault goes after that, so the ideas aren't lost but also don't pollute the build plan that coding AIs execute against.

---

## Near-Term Stretch Goals (Post-MVP, Pre-Hackathon-End if time allows)

These are achievable within the hackathon window if all MVP phases are complete early. Listed in priority order.

**1. Artifact Lineage Graph (Inspector)**
The `derived_from` and `depends_on` fields are already in the metadata schema. This feature just renders them visually. A force-directed D3 graph on the artifact detail page. Nodes = artifacts, edges = relationship type. Click any node → navigate to that artifact. No schema changes needed — the data is already there.

**2. `vault_link_artifacts` MCP Tool**
Lets agents declare relationships between already-stored artifacts. Implementation: fetch the source artifact's current metadata, write a new metadata memory with updated `derived_from`/`depends_on` fields, deduplication in `get()` surfaces the new version. Adds one MCP tool to `apps/mcp`.

**3. Walrus Epoch Expiry Warnings**
Query Walrus blob objects on-chain for end epoch via the Walrus RPC. Inspector shows amber badge at < 5 epochs remaining, red badge at < 2. One-click "Renew" button re-stores the blob with fresh epochs via `storeVersion()`. This is a genuine developer utility — blobs expiring silently is a real footgun.

**4. Agent State Checkpointing**
Two new MCP tools: `vault_save_checkpoint(taskId, stateJson)` and `vault_load_checkpoint(taskId)`. Stores agent state as a Walrus blob, retrievable by task ID. Enables long-running workflows to pause and resume across sessions or machines. The demo moment: agent crashes mid-task, resumes perfectly on a different device.

---

## Medium-Term Directions (Post-Hackathon V2)

**5. SEAL File Encryption**
Encrypt artifact file bytes via `@mysten/seal` before upload to Walrus. Currently, artifact files are public blobs (metadata is encrypted via MemWal/SEAL automatically, files are not). File-level encryption would make WalrusVault appropriate for sensitive documents. Requires `@mysten/seal` integration and Inspector-side decryption flow.

**6. Multi-Account Inspector**
Switch between MemWal accounts without disconnecting. Useful for developers managing multiple agents or projects with separate delegate keys.

**7. CLI (`packages/cli`)**
Currently P2 priority in MVP — likely deferred to here. Basic commands: `store`, `search`, `get`, `list`, `version`. Built on top of `@walrus-vault/sdk`.

**8. Python SDK**
`walrus-vault` Python package implementing the same `ArtifactVault` interface. MemWal already has a Python SDK. Expands reach to the ML/data science developer audience who work in Python notebooks and scripts.

---

## Longer-Term Vision

**9. Artifact Graph as First-Class Feature**
As `derived_from` and `depends_on` relationships accumulate across many artifacts, WalrusVault starts to look like a knowledge graph. Future work: graph traversal queries (`vault.findDependencies(id)`, `vault.findDerivedChain(id)`), visual graph explorer in Inspector spanning multiple artifact trees.

**10. LLM Wiki (Second Hackathon Submission)**
A separate project built on top of WalrusVault. A multi-agent system where agents read sources, extract concepts, and write interlinked Markdown wiki pages stored permanently on Walrus. Every page is a WalrusVault artifact. Semantic search via `vault.search()` surfaces pages by meaning. Wiki compounds across sessions — new sources enrich the existing graph without overwriting history.

This is a separate hackathon submission targeting multi-agent coordination and long-running workflow criteria. Build it after WalrusVault MVP is complete, using `@walrus-vault/sdk` as an npm dependency.

**Pitch for LLM Wiki submission:** "We built WalrusVault to give agents a file system. Then we used it to build a decentralized LLM Wiki — a Wikipedia that agents write themselves, permanently on-chain, retrievable by meaning."
