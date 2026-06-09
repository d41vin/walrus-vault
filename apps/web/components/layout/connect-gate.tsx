"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { loadCredentials, clearCredentials } from "@/lib/session";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Database } from "lucide-react";

interface SessionContextType {
  key: string;
  accountId: string;
  disconnect: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a ConnectGate or SessionProvider");
  }
  return context;
}

export function ConnectGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ key: string; accountId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const creds = loadCredentials();
    if (creds) {
      setSession(creds);
    }
    setLoading(false);
  }, []);

  const disconnect = () => {
    clearCredentials();
    setSession(null);
    router.push("/");
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" className="text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse font-mono">Authenticating with MemWal relayer...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-border bg-card shadow-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Database className="h-6 w-6" />
            </div>
            <CardTitle className="font-heading text-2xl font-bold tracking-tight">Authentication Required</CardTitle>
            <CardDescription className="text-muted-foreground">
              Please connect your MemWal account to access the WalrusVault Inspector dashboard.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              WalrusVault stores your file metadata securely in your isolated <code>artifact-vault</code> namespace.
            </p>
          </CardContent>
          <CardFooter>
            <Button className="w-full" onClick={() => router.push("/")}>
              Go to Connect Page
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ key: session.key, accountId: session.accountId, disconnect }}>
      {children}
    </SessionContext.Provider>
  );
}
