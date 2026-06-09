"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { 
  LayoutDashboard, 
  FileText, 
  Brain, 
  Key, 
  Globe, 
  BookOpen, 
  Github,
  Database
} from "lucide-react";

interface SidebarProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Sidebar({ className, ...props }: SidebarProps) {
  const pathname = usePathname();

  const routes = [
    {
      label: "Overview",
      icon: LayoutDashboard,
      href: "/dashboard",
      active: pathname === "/dashboard",
    },
    {
      label: "Artifact Browser",
      icon: FileText,
      href: "/dashboard/artifacts",
      active: pathname.startsWith("/dashboard/artifacts"),
    },
    {
      label: "Memory Browser",
      icon: Brain,
      href: "/dashboard/memories",
      active: pathname.startsWith("/dashboard/memories"),
    },
    {
      label: "Delegate Keys",
      icon: Key,
      href: "/dashboard/delegates",
      active: pathname.startsWith("/dashboard/delegates"),
    },
    {
      label: "Ecosystem Tools",
      icon: Globe,
      href: "/dashboard/ecosystem",
      active: pathname.startsWith("/dashboard/ecosystem"),
    },
  ];

  return (
    <div className={cn("flex h-full flex-col border-r border-border bg-card text-card-foreground", className)} {...props}>
      {/* Header / Logo */}
      <div className="flex h-16 items-center px-6 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold text-lg hover:opacity-90 transition-opacity">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <Database className="h-4 w-4" />
          </div>
          <span className="font-heading tracking-tight">
            Walrus<span className="text-primary font-bold">Vault</span>
          </span>
        </Link>
      </div>

      {/* Main Nav */}
      <div className="flex-1 overflow-y-auto py-6 px-4">
        <nav className="space-y-1.5">
          {routes.map((route) => {
            const Icon = route.icon;
            return (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-all duration-200",
                  route.active 
                    ? "bg-primary/10 text-primary" 
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", route.active ? "text-primary" : "text-muted-foreground")} />
                {route.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Nav */}
      <div className="mt-auto border-t border-border p-4 space-y-2">
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
        >
          <Github className="h-4 w-4 shrink-0" />
          GitHub Repository
        </a>
        <a
          href="https://walrus.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3.5 rounded-lg px-3.5 py-2.5 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
        >
          <BookOpen className="h-4 w-4 shrink-0" />
          Walrus Documentation
        </a>
      </div>
    </div>
  );
}
