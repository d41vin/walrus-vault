"use client";

import { useSession } from "./connect-gate";
import { Button } from "@/components/ui/button";
import { LogOut, Copy, Check, Shield, Menu } from "lucide-react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";

export function Header() {
  const { accountId, disconnect } = useSession();
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const copyAccountId = () => {
    navigator.clipboard.writeText(accountId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncatedId = `${accountId.slice(0, 6)}...${accountId.slice(-4)}`;

  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-card px-6 text-card-foreground">
      {/* Title placeholder or Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" className="md:hidden h-9 w-9 p-0 flex items-center justify-center border border-border" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r border-border bg-card">
            <Sidebar className="w-full h-full border-r-0" onClick={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <h2 className="text-sm font-semibold text-muted-foreground font-mono flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-full border border-border/50">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
          MemWal Connected
        </h2>
      </div>

      {/* User Session Controls */}
      <div className="flex items-center gap-4">
        {/* Account ID Display */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-xs font-mono">
          <Shield className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-muted-foreground">Account:</span>
          <span className="font-semibold text-foreground">{truncatedId}</span>
          <button
            onClick={copyAccountId}
            className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
            title="Copy Account ID"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Disconnect Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          className="gap-2 text-xs font-semibold hover:bg-destructive/10 hover:text-destructive hover:border-destructive/25 transition-all"
        >
          <LogOut className="h-3.5 w-3.5" />
          Disconnect
        </Button>
      </div>
    </header>
  );
}
