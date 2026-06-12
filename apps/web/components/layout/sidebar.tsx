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
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.164 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
          </svg>
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
