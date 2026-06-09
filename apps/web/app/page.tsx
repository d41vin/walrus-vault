"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { saveCredentials, loadCredentials } from "@/lib/session";
import { Spinner } from "@/components/ui/spinner";
import { 
  Database, 
  Key, 
  FileText, 
  Terminal, 
  ArrowRight, 
  Lock, 
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";

export default function Page() {
  const [key, setKey] = useState("");
  const [accountId, setAccountId] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Redirect to dashboard if already connected
  useEffect(() => {
    const creds = loadCredentials();
    if (creds) {
      router.push("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || !accountId.trim()) {
      setError("Please fill in both fields.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/health", {
        headers: {
          "x-memwal-key": key.trim(),
          "x-memwal-account-id": accountId.trim(),
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Authentication failed. Please check your credentials.");
      }

      // Save credentials and redirect
      saveCredentials(key.trim(), accountId.trim());
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to connect. Make sure your relayer is reachable.");
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-background p-4 overflow-hidden md:p-8">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="absolute top-0 right-1/4 h-[300px] w-[300px] rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-0 left-1/4 h-[300px] w-[300px] rounded-full bg-primary/5 blur-3xl" />

      <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-between gap-12 lg:flex-row">
        {/* Left side: Hero & Features */}
        <div className="flex flex-col gap-6 text-center lg:max-w-[550px] lg:text-left">
          <div className="inline-flex items-center justify-center gap-2 self-center rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary lg:self-start">
            <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
            Walrus Track Hackathon Entry
          </div>

          <h1 className="font-heading text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl md:text-6xl">
            Walrus<span className="text-primary">Vault</span>
          </h1>

          <p className="font-heading text-lg font-medium text-muted-foreground sm:text-xl">
            MemWal gives agents memory. <br className="hidden sm:inline" />
            <strong className="text-foreground">WalrusVault gives agents files.</strong>
          </p>

          <p className="text-sm text-muted-foreground max-w-lg mx-auto lg:mx-0">
            An agent-native file storage layer built on Walrus (decentralized blob storage) + MemWal (semantic memory). 
            Enable your AI agents to store, version, and semantically search files with raw blockchain persistence.
          </p>

          {/* Feature highlights */}
          <div className="mt-4 grid gap-4 text-left sm:grid-cols-2">
            <div className="flex gap-3 rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Semantic File Retrieval</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Find files by meaning (e.g. "Q3 report") rather than raw blob IDs.</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Deterministic Versioning</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Full immutable version history stored directly in your MemWal metadata.</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Terminal className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Agent-Native MCP</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Equip Claude, Cursor, and custom agents with native file tools.</p>
              </div>
            </div>

            <div className="flex gap-3 rounded-lg border border-border bg-card/50 p-4 backdrop-blur-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <Database className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Real-time Inspector</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Inspect files, preview uploads, and debug recall queries in real-time.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side: Connect Form */}
        <div className="w-full max-w-md shrink-0">
          <Card className="border-border bg-card/85 shadow-2xl backdrop-blur-md">
            <CardHeader>
              <CardTitle className="font-heading text-2xl font-bold tracking-tight">Connect to Inspector</CardTitle>
              <CardDescription>
                Provide your MemWal delegate credentials to manage your vault.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive font-medium border border-destructive/20">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="accountId" className="text-sm font-semibold flex items-center justify-between">
                    MemWal Account ID
                    <span className="text-[10px] text-muted-foreground font-normal">Sui Object ID (0x...)</span>
                  </Label>
                  <div className="relative">
                    <Database className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="accountId"
                      type="text"
                      placeholder="0x..."
                      className="pl-9 font-mono text-sm bg-background/50"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="key" className="text-sm font-semibold flex items-center justify-between">
                    Delegate Private Key
                    <span className="text-[10px] text-muted-foreground font-normal">Ed25519 Private Key Hex</span>
                  </Label>
                  <div className="relative">
                    <Key className="absolute top-3 left-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="key"
                      type={showKey ? "text" : "password"}
                      placeholder="HEX-encoded key..."
                      className="pl-9 pr-10 font-mono text-sm bg-background/50"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-3.5 text-muted-foreground hover:text-foreground"
                    >
                      {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/65 p-3.5 text-xs text-muted-foreground border border-border/50">
                  <div className="flex gap-2 font-medium text-foreground mb-1 items-center">
                    <Lock className="h-3.5 w-3.5 text-primary shrink-0" />
                    Secure Client-Side Auth
                  </div>
                  Credentials are saved in your browser's local storage and used locally. They are never saved on our server. 
                  WalrusVault isolates all data in the <code>artifact-vault</code> namespace, leaving your other MemWal namespaces untouched.
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full font-semibold group" disabled={loading}>
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Spinner className="h-4 w-4 text-primary-foreground" /> Connecting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Connect Account <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </Button>
                <div className="text-center text-xs">
                  Don't have a MemWal account?{" "}
                  <a
                    href="https://memwal.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                  >
                    Generate one at memwal.ai <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} WalrusVault. Built for the Mysten Labs Walrus Hackathon.</p>
      </footer>
    </div>
  );
}
