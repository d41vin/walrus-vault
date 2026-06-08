# WalrusVault — Tech Stack

All decisions, versions, and rationale in one place. Reference this when starting any package or app in the monorepo.

---

## Monorepo

| Tool | Version | Why |
|---|---|---|
| pnpm | 9.x | Workspace support, fast installs, disk efficient |
| Turborepo | latest | Build pipeline caching, parallel task execution across packages |
| TypeScript | 5.x | Everywhere — SDK, MCP, web, CLI |
| Node.js | 20+ | Required by MemWal SDK, LTS |

### `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `turbo.json`
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

---

## SDK (`packages/sdk`)

| Tool | Version | Why |
|---|---|---|
| TypeScript | 5.x | Type safety, good DX for SDK consumers |
| `@mysten-incubation/memwal` | latest | MemWal SDK — artifact metadata storage and semantic search |
| `uuid` | latest | Generate stable artifactIds |
| tsup | latest | Zero-config bundler for SDK packages (ESM + CJS + types) |
| vitest | latest | Fast unit tests |

### `package.json` (packages/sdk)
```json
{
  "name": "@walrus-vault/sdk",
  "version": "0.1.0",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm,cjs --dts",
    "dev": "tsup src/index.ts --format esm,cjs --dts --watch",
    "test": "vitest"
  },
  "dependencies": {
    "@mysten-incubation/memwal": "latest",
    "uuid": "^9.0.0"
  },
  "devDependencies": {
    "tsup": "latest",
    "typescript": "^5.0.0",
    "vitest": "latest",
    "@types/uuid": "^9.0.0"
  }
}
```

**No Walrus SDK dependency.** We call the Walrus HTTP API via native `fetch()`. The HTTP API (`PUT /v1/blobs`, `GET /v1/blobs/{id}`) is simple enough that a wrapper package adds overhead without value. Keeps the SDK lightweight.

---

## Inspector Web App (`apps/web`)

| Tool | Version | Why |
|---|---|---|
| Next.js | 15 (App Router) | File-based routing, server components, API routes |
| React | 19 | Pairs with Next.js 15 |
| TypeScript | 5.x | Consistent with monorepo |
| Tailwind CSS | 4.x | Utility-first, fast to build with |
| shadcn/ui | latest | Accessible component primitives on Radix |
| Convex | latest | Real-time artifact cache + activity feed |
| `@walrus-vault/sdk` | workspace | Local workspace package |
| `@mysten-incubation/memwal` | latest | Direct use for memory browser + delegate manager |

### UI Design Direction

**Aesthetic:** Industrial developer tooling — precision of Vercel's dashboard, but raw and data-forward. Dark-first. Technical values (blob IDs, cosine scores, epochs) displayed in monospace. No purple gradients, no soft pastels.

**Fonts:**
- Headings: `JetBrains Mono` — precise, technical, distinctive
- Body: `Geist Sans` — clean, readable
- Monospace values (blob IDs, keys, metadata): `JetBrains Mono`

**Colors:**
- Background: `#0a0a0a`
- Surface: `#111111`, `#1a1a1a`
- Border: `#2a2a2a`
- Primary accent: `#00d4aa` (Walrus teal — intentionally ties to brand)
- Text: `#e5e5e5` primary, `#666` muted
- Danger: `#ff4444`
- Version badge: `#3b82f6`

**Key visual elements:**
- Blob IDs in monospace with copy-to-clipboard on hover
- Cosine distance visualized as a bar: green (0.0) → red (1.0) with numeric value
- Version timeline as vertical connector with circles per version
- Content type icons with distinct colors (PDF red, image green, JSON yellow, CSV blue)
- Artifact cards with subtle border glow on hover
- Activity feed as a real-time stream on dashboard overview

### `components.json` (shadcn)
```json
{
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

### shadcn Components to Install
```bash
pnpm dlx shadcn@latest add button input label card badge
pnpm dlx shadcn@latest add table dialog sheet tabs
pnpm dlx shadcn@latest add dropdown-menu separator tooltip
pnpm dlx shadcn@latest add scroll-area progress skeleton
pnpm dlx shadcn@latest add toast sonner
```

---

## MCP Server (`apps/mcp`)

| Tool | Version | Why |
|---|---|---|
| `@modelcontextprotocol/sdk` | latest | Official MCP TypeScript SDK |
| `@walrus-vault/sdk` | workspace | Local — all vault operations go through it |
| tsup | latest | Bundle to single CJS file for npx usage |

### Transport
**stdio** — same pattern as `@mysten-incubation/memwal-mcp`. Works with Claude Desktop, Claude Code, Cursor, Codex, Augment Code.

### `package.json` (apps/mcp)
```json
{
  "name": "@walrus-vault/mcp",
  "version": "0.1.0",
  "bin": {
    "walrus-vault-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsup src/index.ts --format cjs --no-splitting",
    "dev": "tsup src/index.ts --format cjs --watch"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "@walrus-vault/sdk": "workspace:*"
  }
}
```

---

## CLI (`packages/cli`)

| Tool | Version | Why |
|---|---|---|
| `commander` | latest | Mature, well-documented CLI framework |
| `ora` | latest | Spinner for async operations (Walrus uploads take a moment) |
| `chalk` | latest | Colored terminal output |
| `@walrus-vault/sdk` | workspace | All vault operations |

### Commands (P2 priority — build after MCP)
```bash
walrus-vault store <file> --tags tag1,tag2 --description "..." --epochs 10
walrus-vault search "Q3 climate reports" --limit 5
walrus-vault get <artifactId>
walrus-vault list --content-type application/pdf
walrus-vault version <artifactId> <newFile> --description "What changed"
```

---

## External Services

| Service | Role | URL |
|---|---|---|
| MemWal Relayer | Artifact metadata storage + semantic search | `https://relayer.memwal.ai` |
| Walrus Publisher | Upload file blobs | `https://publisher.walrus.wal.app` |
| Walrus Aggregator | Download file blobs | `https://aggregator.walrus.wal.app` |
| Convex | Real-time Inspector cache + activity feed | `https://convex.dev` |
| Vercel | Deploy Inspector web app | `https://vercel.com` |
| npm | Publish SDK and MCP packages | `https://npmjs.com` |

---

## Key Third-Party Packages

| Package | Used in | Purpose |
|---|---|---|
| `@mysten-incubation/memwal` | SDK, web | MemWal SDK — artifact metadata storage and recall |
| `@modelcontextprotocol/sdk` | MCP | MCP protocol implementation |
| `uuid` | SDK | Generate stable artifact IDs |
| `convex` | web | Real-time database for Inspector |
| `commander` | CLI | CLI argument parsing |
| `ora` | CLI | Spinner feedback for async uploads |

---

## What We Explicitly Do NOT Use

| Skipped | Reason |
|---|---|
| `@mysten/walrus` TypeScript SDK | We use Walrus HTTP API directly — simpler, fewer dependencies |
| `@mysten/sui` | Not needed — MemWal SDK handles all Sui interaction |
| `@mysten/seal` | Not needed at MVP — SEAL encrypts MemWal metadata automatically; file-level encryption is Phase 5 |
| Prisma / Drizzle / Postgres | No traditional DB — Convex handles our data layer |
| tRPC | Next.js API routes are sufficient for our surface area |
| LangChain adapters | Out of scope |
| ChatGPT / Gemini integrations | Out of scope |

---

## Deployment

| Component | Platform | Notes |
|---|---|---|
| Inspector UI (`apps/web`) | Vercel | Next.js native, automatic deploys from GitHub |
| Convex backend | Convex cloud | Managed, comes with Convex dashboard |
| SDK (`packages/sdk`) | npm registry | Published as `@walrus-vault/sdk` |
| MCP server (`apps/mcp`) | npm registry | Published as `@walrus-vault/mcp`, run via `npx` |
| CLI (`packages/cli`) | npm registry | Published as `walrus-vault` binary |
