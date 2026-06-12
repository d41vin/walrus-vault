import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { ArtifactVault } from "@walrus-vault/sdk";
import { loadConfig } from "./auth.js";

// Initialize the ArtifactVault instance
let vault: ArtifactVault;
try {
  const config = loadConfig();
  vault = ArtifactVault.create(config);
} catch (err: any) {
  console.error("Failed to initialize ArtifactVault:", err.message);
  process.exit(1);
}

// Create the MCP server
const server = new Server(
  {
    name: "walrus-vault",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools list
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "vault_store_artifact",
        description: "Upload a file to Walrus decentralized storage and index its metadata in MemWal for semantic search.",
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: "Base64-encoded file contents.",
            },
            filename: {
              type: "string",
              description: "Name of the file.",
            },
            contentType: {
              type: "string",
              description: "MIME type of the file (e.g. application/pdf, text/plain).",
            },
            description: {
              type: "string",
              description: "Optional summary of what this file contains.",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of tags for categorization.",
            },
            agentId: {
              type: "string",
              description: "Optional identifier of the agent storing this file.",
            },
            epochs: {
              type: "number",
              description: "Optional number of Walrus epochs to store this file (default: 10).",
            },
            derivedFrom: {
              type: "string",
              description: "Optional artifact ID that this file was derived/generated from.",
            },
            dependsOn: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of artifact IDs that this file depends on.",
            },
          },
          required: ["content", "filename", "contentType"],
        },
      },
      {
        name: "vault_search_artifacts",
        description: "Semantically search for files using natural language. Always returns the latest version of each matching file.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language search query (e.g. 'project reports', 'updated CSV summaries').",
            },
            limit: {
              type: "number",
              description: "Optional maximum number of search results to return (default: 10).",
            },
            contentType: {
              type: "string",
              description: "Optional filter by MIME type.",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional filter by tags (returns matches containing any of these tags).",
            },
          },
          required: ["query"],
        },
      },
      {
        name: "vault_get_artifact",
        description: "Get detailed metadata, download URL, and complete version history for a specific file by its ID.",
        inputSchema: {
          type: "object",
          properties: {
            artifactId: {
              type: "string",
              description: "The unique UUID v4 of the artifact.",
            },
          },
          required: ["artifactId"],
        },
      },
      {
        name: "vault_list_artifacts",
        description: "List all stored files in the vault with optional filters. Always returns the latest version of each file.",
        inputSchema: {
          type: "object",
          properties: {
            contentType: {
              type: "string",
              description: "Optional filter by MIME type.",
            },
            tags: {
              type: "array",
              items: { type: "string" },
              description: "Optional filter by tags.",
            },
            agentId: {
              type: "string",
              description: "Optional filter by agent ID.",
            },
            limit: {
              type: "number",
              description: "Optional pagination limit (default: 20).",
            },
          },
        },
      },
      {
        name: "vault_store_version",
        description: "Upload a new version of an existing file. Automatically increments version number and updates the version timeline.",
        inputSchema: {
          type: "object",
          properties: {
            artifactId: {
              type: "string",
              description: "The stable ID of the existing artifact.",
            },
            content: {
              type: "string",
              description: "Base64-encoded new version file contents.",
            },
            description: {
              type: "string",
              description: "Optional change log or description for this specific version.",
            },
          },
          required: ["artifactId", "content"],
        },
      },
    ],
  };
});

// Handle tool executions
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "vault_store_artifact": {
        const {
          content,
          filename,
          contentType,
          description,
          tags,
          agentId,
          derivedFrom,
          dependsOn,
        } = args as any;

        const buffer = Buffer.from(content, "base64");
        const artifact = await vault.store(buffer, {
          filename,
          contentType,
          description,
          tags,
          agentId,
          derivedFrom,
          dependsOn,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "Artifact successfully stored on Walrus and registered in MemWal.",
                  artifactId: artifact.id,
                  blobId: artifact.blobId,
                  version: artifact.version,
                  size: artifact.size,
                  downloadUrl: artifact.downloadUrl,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      case "vault_search_artifacts": {
        const { query, limit, contentType, tags } = args as any;
        const results = await vault.search(query, {
          limit,
          contentType,
          tags,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "vault_get_artifact": {
        const { artifactId } = args as any;
        const detail = await vault.get(artifactId);

        if (!detail) {
          throw new McpError(
            ErrorCode.InvalidParams,
            `Artifact not found: ${artifactId}`
          );
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(detail, null, 2),
            },
          ],
        };
      }

      case "vault_list_artifacts": {
        const { contentType, tags, agentId, limit } = args as any;
        const result = await vault.list({
          contentType,
          tags,
          agentId,
          limit,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result.artifacts, null, 2),
            },
          ],
        };
      }

      case "vault_store_version": {
        const { artifactId, content, description } = args as any;
        const buffer = Buffer.from(content, "base64");
        
        const updated = await vault.storeVersion(artifactId, buffer, {
          description,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  message: "New version uploaded successfully.",
                  artifactId: updated.id,
                  blobId: updated.blobId,
                  version: updated.version,
                  size: updated.size,
                  downloadUrl: updated.downloadUrl,
                },
                null,
                2
              ),
            },
          ],
        };
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (err: any) {
    if (err instanceof McpError) throw err;
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error executing tool '${name}': ${err.message || String(err)}`,
        },
      ],
    };
  }
});

// Start the server using stdio transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("WalrusVault MCP server running on stdio transport");
}

run().catch((error) => {
  console.error("Fatal error running MCP server:", error);
  process.exit(1);
});
