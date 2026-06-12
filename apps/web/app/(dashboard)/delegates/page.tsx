"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/layout/connect-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { 
  Key, 
  Plus, 
  Trash2, 
  Copy, 
  Check, 
  ShieldAlert, 
  Terminal, 
  ExternalLink,
  ShieldCheck,
  Eye,
  EyeOff
} from "lucide-react";

export default function DelegatesPage() {
  const { key: activeKey, accountId } = useSession();
  const [delegates, setDelegates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Key Generation State
  const [newKeyLabel, setNewKeyLabel] = useState("");
  const [generatedKey, setGeneratedKey] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPrivateKey, setShowPrivateKey] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sui package ID (comes from memwal package, usually on mainnet/testnet)
  const [suiPackageId, setSuiPackageId] = useState("0xd1e05d259e8b7c7b80a6c6c7b3c299c30c885c34e0cbcd74ff6db6d734e565ad"); // mock fallback

  const fetchDelegates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/delegates", {
        headers: {
          "x-memwal-account-id": accountId,
        },
      });

      if (!res.ok) throw new Error("Failed to load delegate keys");
      const data = await res.json();
      setDelegates(data);
    } catch (err) {
      console.error(err);
      toast.error("Could not fetch delegate keys. Ensure your Account ID is correct.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelegates();
  }, [accountId]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) {
      toast.error("Please provide a label.");
      return;
    }

    setIsGenerating(true);
    try {
      const res = await fetch("/api/delegates", {
        method: "POST",
      });

      if (!res.ok) throw new Error("Failed to generate delegate key");
      const data = await res.json();
      setGeneratedKey({
        ...data,
        label: newKeyLabel.trim(),
      });
      setIsModalOpen(true);
      setNewKeyLabel("");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate delegate key.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Generate copyable Sui CLI add command
  const getAddCommand = (pubKeyHex: string, label: string) => {
    return `sui client call --package ${suiPackageId} --module account --function add_delegate_key --args ${accountId} "[${hexToBytesArrayString(pubKeyHex)}]" "${label}" --gas-budget 20000000`;
  };

  // Generate copyable Sui CLI remove command
  const getRemoveCommand = (pubKeyHex: string) => {
    return `sui client call --package ${suiPackageId} --module account --function remove_delegate_key --args ${accountId} "[${hexToBytesArrayString(pubKeyHex)}]" --gas-budget 20000000`;
  };

  // Helper: Convert hex string to byte array string e.g. "10,20,30"
  const hexToBytesArrayString = (hex: string) => {
    const bytes = [];
    for (let c = 0; c < hex.length; c += 2) {
      bytes.push(parseInt(hex.substr(c, 2), 16));
    }
    return bytes.join(",");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">Delegate Keys</h1>
          <p className="text-muted-foreground text-sm">
            Manage Ed25519 delegate keys authorized to read and write memories for this vault.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Side: Key Generator */}
        <div className="space-y-6">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
                <Plus className="h-5 w-5 text-primary" />
                Generate Delegate Key
              </CardTitle>
              <CardDescription>Create a new Ed25519 keypair to authorize agents.</CardDescription>
            </CardHeader>
            <form onSubmit={handleGenerateKey}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="label" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">Key Label</Label>
                  <Input
                    id="label"
                    placeholder="e.g. Cursor Agent, Production CLI"
                    value={newKeyLabel}
                    onChange={(e) => setNewKeyLabel(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="packageId" className="font-semibold text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    Sui Contract Package ID
                    <span className="text-[10px] text-muted-foreground font-normal">Used for CLI helper</span>
                  </Label>
                  <Input
                    id="packageId"
                    placeholder="0x..."
                    value={suiPackageId}
                    onChange={(e) => setSuiPackageId(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" className="w-full font-semibold" disabled={isGenerating}>
                  {isGenerating ? (
                    <>
                      <Spinner className="h-4 w-4 text-primary-foreground" /> Generating...
                    </>
                  ) : (
                    "Generate Keypair"
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <Card className="border-border bg-card/60 backdrop-blur-sm p-4 text-xs text-muted-foreground space-y-2.5">
            <div className="flex items-center gap-1.5 font-bold text-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              On-Chain Security
            </div>
            <p>
              Delegate keys are registered onchain inside your <code>MemWalAccount</code>. 
              The MemWal relayer authenticates requests by verifying Ed25519 signatures from these keys. 
              This allows agents to store/recall files without ever exposing your main Sui private key.
            </p>
          </Card>
        </div>

        {/* Right Side: Key Table */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border bg-card shadow-sm h-full flex flex-col min-h-[450px]">
            <CardHeader className="border-b border-border bg-muted/20 py-4">
              <CardTitle className="font-heading text-base font-bold">Authorized Delegate Keys</CardTitle>
              <CardDescription>Onchain records registered inside MemWalAccount.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto bg-muted/5">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
                  <Spinner size="lg" className="text-primary" />
                  <p className="text-xs text-muted-foreground font-mono animate-pulse">Querying Sui Fullnode for delegate registry...</p>
                </div>
              ) : delegates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-16 text-center text-muted-foreground">
                  <Key className="h-12 w-12 mb-3 stroke-1 text-primary/30" />
                  <p className="text-sm font-semibold">No delegate keys registered</p>
                  <p className="text-xs mt-1 max-w-sm">Use the generator on the left to create and register delegate keys.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Label</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Public Key Hex</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider">Sui Address</TableHead>
                      <TableHead className="font-bold text-xs uppercase tracking-wider text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {delegates.map((d, index) => {
                      const isCurrentActive = activeKey && d.publicKey && d.publicKey.toLowerCase() === activeKey.toLowerCase();
                      return (
                        <TableRow key={index} className="border-border hover:bg-muted/10 font-mono text-xs">
                          <TableCell className="font-semibold text-foreground font-sans">
                            <div className="flex items-center gap-2">
                              {d.label}
                              {isCurrentActive && (
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[9px] py-0 px-1.5 font-bold font-sans">
                                  Active Session
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="truncate max-w-[150px]" title={d.publicKey}>{d.publicKey}</TableCell>
                          <TableCell className="truncate max-w-[150px]" title={d.suiAddress}>{d.suiAddress}</TableCell>
                          <TableCell className="text-right">
                            {/* CLI removal commands */}
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-lg bg-card border-border">
                                <DialogHeader>
                                  <DialogTitle className="font-heading font-bold text-xl flex items-center gap-2 text-destructive">
                                    <ShieldAlert className="h-5 w-5" />
                                    Revoke Delegate Key
                                  </DialogTitle>
                                  <DialogDescription>
                                    To remove this delegate key on-chain, run the following Sui CLI command from your owner wallet:
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                                      <span>Sui CLI Command</span>
                                      <button 
                                        onClick={() => copyToClipboard(getRemoveCommand(d.publicKey), "remove-cli")}
                                        className="text-primary hover:underline"
                                      >
                                        {copiedId === "remove-cli" ? "Copied!" : "Copy"}
                                      </button>
                                    </div>
                                    <pre className="font-mono text-[10px] p-3 rounded bg-muted border border-border overflow-auto whitespace-pre-wrap select-all">
                                      {getRemoveCommand(d.publicKey)}
                                    </pre>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Generation Success Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg bg-card border-border font-sans">
          <DialogHeader>
            <DialogTitle className="font-heading font-bold text-xl text-emerald-500 flex items-center gap-2">
              <ShieldCheck className="h-6 w-6" />
              Keypair Generated Successfully
            </DialogTitle>
            <DialogDescription className="text-red-500 font-semibold mt-1">
              Warning: Save these credentials now! The private key will NEVER be shown again.
            </DialogDescription>
          </DialogHeader>

          {generatedKey && (
            <div className="space-y-4 font-mono text-xs">
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-foreground font-sans">Label</span>
                <p className="text-foreground font-semibold font-sans">{generatedKey.label}</p>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-foreground font-sans">Delegate Private Key (Save securely!)</span>
                <div className="flex items-center justify-between border border-border rounded p-2 mt-1 bg-muted/40">
                  <span className="truncate text-foreground font-semibold select-all">
                    {showPrivateKey ? generatedKey.privateKey : "••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••"}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowPrivateKey(!showPrivateKey)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {showPrivateKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button 
                      onClick={() => copyToClipboard(generatedKey.privateKey, "gen-priv")}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedId === "gen-priv" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-foreground font-sans">Public Key Hex</span>
                <div className="flex items-center justify-between border border-border rounded p-2 mt-1 bg-muted/40">
                  <span className="truncate text-foreground font-semibold select-all">{generatedKey.publicKey}</span>
                  <button 
                    onClick={() => copyToClipboard(generatedKey.publicKey, "gen-pub")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedId === "gen-pub" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-foreground font-sans">Derived Sui Address</span>
                <div className="flex items-center justify-between border border-border rounded p-2 mt-1 bg-muted/40">
                  <span className="truncate text-foreground font-semibold select-all">{generatedKey.suiAddress}</span>
                  <button 
                    onClick={() => copyToClipboard(generatedKey.suiAddress, "gen-addr")}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {copiedId === "gen-addr" ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-4 space-y-2 font-sans">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Terminal className="h-4 w-4 text-primary" />
                  Sui CLI Register Command
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Paste and execute this command in your terminal using your owner wallet to register this key on-chain:
                </p>
                <div className="relative font-mono text-[10px] p-3 rounded bg-muted border border-border mt-1">
                  <button 
                    onClick={() => copyToClipboard(getAddCommand(generatedKey.publicKey, generatedKey.label), "register-cli")}
                    className="absolute right-2 top-2 text-primary hover:underline text-xs"
                  >
                    {copiedId === "register-cli" ? "Copied!" : "Copy"}
                  </button>
                  <pre className="whitespace-pre-wrap pr-8 select-all">{getAddCommand(generatedKey.publicKey, generatedKey.label)}</pre>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-border">
            <Button className="font-semibold" onClick={() => setIsModalOpen(false)}>
              I Have Saved the Private Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
