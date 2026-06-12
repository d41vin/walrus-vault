"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Globe, 
  Terminal, 
  Copy, 
  Check, 
  ExternalLink,
  Cpu,
  Bookmark,
  Blocks
} from "lucide-react";

export default function EcosystemPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const tools = [
    {
      name: "WalrusVault Core SDK",
      type: "Our SDK",
      description: "Lightweight agent-native files layer integrating Walrus blob uploads with MemWal semantic metadata registry.",
      install: "pnpm add @walrus-vault/sdk",
      link: "https://github.com/d41vin/walrus-vault",
    },
    {
      name: "WalrusVault MCP Server",
      type: "Our MCP",
      description: "Expose search, list, store, and versioning tools directly to LLMs (Claude Desktop, Cursor, Augment Code).",
      install: "npx -y @walrus-vault/mcp",
      link: "https://github.com/d41vin/walrus-vault/tree/main/apps/mcp",
    },
    {
      name: "MemWal TypeScript SDK",
      type: "Official SDK",
      description: "Official TypeScript client for registering MemWalAccounts, writing text memories, and semantic recalls.",
      install: "pnpm add @mysten-incubation/memwal",
      link: "https://memwal.ai",
    },
    {
      name: "MemWal Python SDK",
      type: "Official SDK",
      description: "Official Python client for integrating Sui-backed semantic long-term memory into Python agent codebases.",
      install: "pip install memwal",
      link: "https://memwal.ai",
    },
    {
      name: "MemWal MCP Server",
      type: "Official MCP",
      description: "Standard Model Context Protocol server exposing core remember/recall text memory tools to LLMs.",
      install: "npx -y @mysten-incubation/memwal-mcp",
      link: "https://github.com/mysten-incubation/memwal-mcp",
    },
    {
      name: "MemWal Vercel AI Middleware",
      type: "Official Integration",
      description: "Vercel AI SDK middleware to inject and update context automatically using MemWal memories.",
      install: "pnpm add @mysten-incubation/memwal-vercel",
      link: "https://memwal.ai",
    },
  ];

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Install command copied!");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight">Ecosystem Tools</h1>
        <p className="text-muted-foreground text-sm">
          Explore packages, integrations, and servers built around the MemWal decentralized long-term memory ecosystem.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Card key={tool.name} className="border-border bg-card hover:shadow-md transition-shadow flex flex-col h-full">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <Badge variant={tool.type.startsWith("Our") ? "default" : "secondary"} className="font-semibold text-[10px]">
                  {tool.type}
                </Badge>
                <Cpu className="h-4.5 w-4.5 text-muted-foreground" />
              </div>
              <CardTitle className="font-heading text-base font-bold mt-3">{tool.name}</CardTitle>
              <CardDescription className="text-xs mt-1 min-h-[48px]">
                {tool.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4 flex-1 flex flex-col justify-end">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-muted-foreground font-mono flex items-center gap-1">
                  <Terminal className="h-3 w-3" />
                  Install Command
                </span>
                <div className="flex items-center justify-between border border-border rounded px-2.5 py-1.5 bg-muted/40 font-mono text-[11px]">
                  <span className="truncate text-foreground select-all pr-2">{tool.install}</span>
                  <button 
                    onClick={() => copyToClipboard(tool.install, tool.name)} 
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                  >
                    {copiedId === tool.name ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-3 border-t border-border bg-muted/10">
              <a href={tool.link} target="_blank" rel="noopener noreferrer" className="w-full">
                <Button variant="ghost" size="sm" className="w-full text-xs font-semibold gap-1.5 text-primary hover:bg-primary/5">
                  View Source & Docs <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </a>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
