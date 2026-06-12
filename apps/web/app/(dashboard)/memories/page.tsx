"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/layout/connect-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { 
  Brain, 
  Search, 
  Database,
  ArrowRight,
  Sparkles,
  Layers,
  Copy,
  Check,
  TrendingDown
} from "lucide-react";

export default function MemoriesPage() {
  const { key, accountId } = useSession();
  const [queryText, setQueryText] = useState("");
  const [namespace, setNamespace] = useState("artifact-vault");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Common namespaces
  const namespaces = ["artifact-vault", "default", "personal", "work", "research"];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queryText.trim()) {
      toast.error("Please enter a query.");
      return;
    }

    setLoading(true);
    try {
      const url = new URL("/api/memories", window.location.origin);
      url.searchParams.set("q", queryText.trim());
      url.searchParams.set("namespace", namespace);

      const res = await fetch(url.toString(), {
        headers: {
          "x-memwal-key": key,
          "x-memwal-account-id": accountId,
        },
      });

      if (!res.ok) throw new Error("Failed to recall memories");
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to fetch memories from relayer.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight flex items-center gap-2">
          Memory Browser
        </h1>
        <p className="text-muted-foreground text-sm">
          Recall raw MemWal text memories directly from the relayer and debug embedding matches.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Side: Query Panel */}
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Recall Query
              </CardTitle>
              <CardDescription>Perform semantic search over your Sui vector indices.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSearch}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="query" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Search Query</Label>
                  <div className="relative">
                    <Search className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="query"
                      placeholder="e.g. Q3 margin analysis, vault setup"
                      className="pl-9 bg-background/50 border-border"
                      value={queryText}
                      onChange={(e) => setQueryText(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    Namespace Selector
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {namespaces.map((ns) => (
                      <button
                        key={ns}
                        type="button"
                        onClick={() => setNamespace(ns)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold border transition-all duration-200 ${
                          namespace === ns
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-muted text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground"
                        }`}
                      >
                        {ns}
                      </button>
                    ))}
                  </div>
                  <div className="pt-2">
                    <Label htmlFor="customNamespace" className="text-[10px] text-muted-foreground">Or Custom Namespace</Label>
                    <Input
                      id="customNamespace"
                      placeholder="Enter custom namespace..."
                      className="h-8 mt-1 text-xs"
                      value={namespace}
                      onChange={(e) => setNamespace(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full gap-2 font-semibold" disabled={loading}>
                  {loading ? (
                    <>
                      <Spinner className="h-4 w-4 text-primary-foreground" /> Recalling...
                    </>
                  ) : (
                    <>
                      Recall Memories <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm p-4 text-xs text-muted-foreground space-y-2">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              How Recall Works
            </div>
            <p>
              Your query is converted into a vector embedding by the MemWal relayer. 
              The relayer performs a cosine similarity lookup against your account's onchain memories 
              and returns matching segments sorted by distance.
            </p>
          </Card>
        </div>

        {/* Right Side: Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card shadow-sm h-full flex flex-col min-h-[500px]">
            <CardHeader className="border-b border-border bg-muted/20 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-heading text-base font-bold">Recall Results</CardTitle>
                  <CardDescription>
                    Memories in namespace <code>{namespace}</code> matching your query.
                  </CardDescription>
                </div>
                {results.length > 0 && (
                  <Badge variant="secondary" className="font-semibold text-xs bg-primary/10 text-primary border-primary/10">
                    {results.length} matches
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-6 overflow-y-auto max-h-[600px] bg-muted/5">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                  <Spinner size="lg" className="text-primary" />
                  <p className="text-xs text-muted-foreground font-mono animate-pulse">Running cosine distance query...</p>
                </div>
              ) : results.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center text-muted-foreground">
                  <Database className="h-12 w-12 mb-3 stroke-1 text-primary/30" />
                  <p className="text-sm font-semibold">No memories recalled yet</p>
                  <p className="text-xs mt-1 max-w-xs">Enter a search query on the left to pull data from your vector storage.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {results.map((result, index) => {
                    const relevance = Math.max(0, Math.min(100, Math.round((1 - result.distance) * 100)));
                    return (
                      <Card key={index} className="border-border bg-card hover:shadow-md transition-shadow">
                        <CardHeader className="pb-2 pt-3.5 px-4 flex flex-row items-start justify-between gap-4">
                          <div className="flex items-center gap-2.5">
                            <Badge variant="outline" className="font-mono text-[10px] px-2 py-0.5">
                              #{index + 1}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-mono">Distance: {result.distance.toFixed(4)}</span>
                          </div>
                          
                          {/* Relevance percentage badge */}
                          <Badge 
                            variant="secondary" 
                            className={`font-bold text-[10px] ${
                              relevance > 75 
                                ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
                                : relevance > 50 
                                  ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                            }`}
                          >
                            {relevance}% Relevant
                          </Badge>
                        </CardHeader>
                        <CardContent className="pb-3.5 px-4 text-sm whitespace-pre-wrap font-sans text-foreground">
                          {result.text}
                        </CardContent>
                        <CardFooter className="pt-2 pb-2.5 px-4 border-t border-border/50 bg-muted/20 flex items-center justify-between text-xs text-muted-foreground font-mono">
                          <span className="truncate max-w-[200px]" title={result.blobId}>Memory Blob: {result.blobId.slice(0, 8)}...</span>
                          <button 
                            onClick={() => copyToClipboard(result.text, `mem-${index}`)} 
                            className="flex items-center gap-1.5 font-semibold text-primary hover:text-primary/80 transition-colors"
                          >
                            {copiedId === `mem-${index}` ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied!
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" /> Copy Text
                              </>
                            )}
                          </button>
                        </CardFooter>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
