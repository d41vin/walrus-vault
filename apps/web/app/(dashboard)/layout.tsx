"use client";

import { ConnectGate } from "@/components/layout/connect-gate";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConnectGate>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        {/* Sidebar - fixed width on desktop */}
        <Sidebar className="hidden md:flex md:w-64 md:shrink-0" />

        {/* Main Panel */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto bg-muted/30 p-6 md:p-8">
            <div className="mx-auto max-w-[1400px] space-y-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ConnectGate>
  );
}
