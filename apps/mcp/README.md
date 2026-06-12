# @walrus-vault/mcp

Model Context Protocol (MCP) server for **WalrusVault** — the agent-native decentralized file storage layer. 

This server allows AI agents (like Claude Desktop) to upload files to decentralized storage (Walrus), index their natural language metadata in semantic memory (MemWal), search for them using meaning-based queries, and manage version history directly.

---

## Capabilities & Tools

The MCP server exposes 5 core tools:

1. **`vault_store_artifact`**: Store a new file.
   - **Inputs**: Base64-encoded `content`, `filename`, `contentType` (MIME type).
   - **Optional Inputs**: `description`, `tags`, `agentId`, `derivedFrom` (artifact ID), `dependsOn` (list of artifact IDs), `epochs`.
   - **Behavior**: Uploads the raw file to Walrus, serializes natural language metadata with the `ARTIFACT_VAULT_META` spec, indexes it in MemWal, and returns storage details.

2. **`vault_search_artifacts`**: Semantic, meaning-based file search.
   - **Inputs**: Natural language `query` (e.g. *"Q3 financial reports"* or *"marketing PDFs"*).
   - **Optional Inputs**: `limit` (default: 10), `contentType` (MIME filter), `tags` (any-match filter).
   - **Behavior**: Queries MemWal's vector memory and applies deduplication to return only the latest version of each matching artifact.

3. **`vault_get_artifact`**: Retrieve complete details for a specific file.
   - **Inputs**: `artifactId` (UUID).
   - **Behavior**: Returns the full metadata schema, download/view URLs, and chronological version history.

4. **`vault_list_artifacts`**: List all stored files.
   - **Optional Inputs**: `contentType`, `tags`, `agentId`, `limit` (default: 20).
   - **Behavior**: Lists files matching the filters, returning the latest version of each artifact.

5. **`vault_store_version`**: Upload a new version of an existing file.
   - **Inputs**: `artifactId` (UUID of the stable record), Base64-encoded `content`.
   - **Optional Inputs**: `description` (version changelog).
   - **Behavior**: Uploads the file to Walrus, increments the version number, creates a new entry in MemWal linked to the original artifact, and updates the timeline.

---

## Setup & Setup Requirements

### 1. Build the MCP Server
Ensure you have built the monorepo from the root:
```bash
pnpm install
pnpm build
```
The compiled MCP server is located at `apps/mcp/dist/index.cjs`.

### 2. Environment Variables
The MCP server requires your MemWal credentials and optional Walrus endpoint configurations.

| Variable | Description | Default / Required |
| --- | --- | --- |
| `MEMWAL_PRIVATE_KEY` | Your MemWal developer private key | **Required** |
| `MEMWAL_ACCOUNT_ID` | Your MemWal developer account ID | **Required** |
| `MEMWAL_SERVER_URL` | Custom MemWal node URL | Optional (uses SDK default) |
| `WALRUS_PUBLISHER` | Walrus publisher HTTP endpoint | Optional (uses `https://publisher.walrus.wal.app`) |
| `WALRUS_AGGREGATOR` | Walrus aggregator HTTP endpoint | Optional (uses `https://aggregator.walrus.wal.app`) |
| `WALRUS_EPOCHS` | Number of storage epochs for uploads | Optional (default: `10`) |
| `VAULT_NAMESPACE` | MemWal recall/remember namespace | Optional (default: `artifact-vault`) |
| `INSPECTOR_URL` | The URL of the local/deployed Inspector UI | Optional |

---

## Integration with Claude Desktop

To use WalrusVault with Claude Desktop, add it to your Claude configuration file.

### Configuration Path
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

### Configuration Example
Replace the placeholder credentials below with your actual credentials:

```json
{
  "mcpServers": {
    "walrus-vault": {
      "command": "node",
      "args": [
        "c:/Users/Win8.1/OneDrive/Desktop/walrus-vault/apps/mcp/dist/index.cjs"
      ],
      "env": {
        "MEMWAL_PRIVATE_KEY": "YOUR_MEMWAL_PRIVATE_KEY_HERE",
        "MEMWAL_ACCOUNT_ID": "YOUR_MEMWAL_ACCOUNT_ID_HERE",
        "VAULT_NAMESPACE": "artifact-vault",
        "INSPECTOR_URL": "http://localhost:3000"
      }
    }
  }
}
```

---

## Testing / Verification

### Stdio Test Runner
You can run the server directly on standard input/output using a tool like `@modelcontextprotocol/inspector` or manually to verify it starts and announces its capabilities:

```bash
node dist/index.cjs
```
*(Verify it prints the standard stdio message `WalrusVault MCP server running on stdio transport` on stderr).*
