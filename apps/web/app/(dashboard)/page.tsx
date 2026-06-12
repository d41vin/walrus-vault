"use client";

import { useSession } from "@/components/layout/connect-gate";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { 
  FileText, 
  Database, 
  Activity, 
  HardDrive,
  ArrowRight,
  TrendingUp,
  Clock,
  Eye
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Format helper since formatBytes might not be in utils
function formatSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function DashboardPage() {
  const { accountId } = useSession();
  const artifacts = useQuery(api.artifacts.listCachedArtifacts, { accountId });
  const activities = useQuery(api.activityFeed.list, { accountId, limit: 10 });

  const totalArtifacts = artifacts?.length ?? 0;
  const totalStorage = artifacts?.reduce((sum, a) => sum + a.size, 0) ?? 0;
  
  // Unique tags count
  const allTags = new Set<string>();
  artifacts?.forEach(a => a.tags.forEach(t => allTags.add(t)));

  const stats = [
    {
      title: "Total Artifacts",
      value: totalArtifacts,
      description: "Cached from MemWal vault",
      icon: FileText,
      color: "from-blue-500/10 to-indigo-500/10 text-indigo-500",
    },
    {
      title: "Estimated Storage",
      value: formatSize(totalStorage),
      description: "Decentralized on Walrus",
      icon: HardDrive,
      color: "from-emerald-500/10 to-teal-500/10 text-teal-500",
    },
    {
      title: "Metadata Memories",
      value: totalArtifacts, // 1 metadata memory per artifact
      description: "Stored in artifact-vault",
      icon: Database,
      color: "from-purple-500/10 to-pink-500/10 text-pink-500",
    },
    {
      title: "Active Tags",
      value: allTags.size,
      description: "Across all stored files",
      icon: TrendingUp,
      color: "from-amber-500/10 to-orange-500/10 text-amber-500",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          Dashboard Overview
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor your agent's files, storage usage, metadata logs, and real-time operations.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-border bg-card shadow-sm hover:shadow-md transition-all duration-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tracking-tight">{stat.value}</div>
                <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two columns layout */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Recent Artifacts */}
        <Card className="col-span-1 border-border bg-card shadow-sm lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="font-heading text-lg font-bold">Recent Artifacts</CardTitle>
              <CardDescription>Latest files stored by your agent on Walrus.</CardDescription>
            </div>
            <Link href="/dashboard/artifacts">
              <Button variant="ghost" size="sm" className="text-primary font-semibold text-xs gap-1">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!artifacts ? (
              <div className="space-y-2">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="h-16 w-full animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : artifacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="mb-4 rounded-full bg-primary/5 p-4 text-primary">
                  <FileText className="h-8 w-8" />
                </div>
                <h3 className="font-semibold text-sm">No artifacts stored yet</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Upload a file directly or call <code>store()</code> in the SDK to see it here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {artifacts.slice(-5).reverse().map((artifact) => (
                  <div key={artifact.artifactId} className="flex items-center justify-between py-3.5 group">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 border border-primary/10 text-primary">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                          {artifact.filename}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span>{artifact.contentType}</span>
                          <span>•</span>
                          <span>{formatSize(artifact.size)}</span>
                          <span>•</span>
                          <span>v{artifact.version}</span>
                        </div>
                      </div>
                    </div>
                    <Link href={`/dashboard/artifacts/${artifact.artifactId}`}>
                      <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Real-time Activity Feed */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="font-heading text-lg font-bold flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Live Activity
            </CardTitle>
            <CardDescription>Real-time Convex sync logs.</CardDescription>
          </CardHeader>
          <CardContent>
            {!activities ? (
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="flex gap-3 animate-pulse">
                    <div className="h-8 w-8 rounded-full bg-muted shrink-0" />
                    <div className="space-y-1.5 w-full">
                      <div className="h-4 w-3/4 bg-muted rounded" />
                      <div className="h-3 w-1/2 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Clock className="h-8 w-8 mb-2 stroke-1" />
                <p className="text-xs">No activity logged yet.</p>
              </div>
            ) : (
              <div className="relative pl-4 border-l border-border space-y-6 py-2">
                {activities.map((activity) => {
                  let title = "";
                  let desc = "";

                  switch (activity.type) {
                    case "artifact_stored":
                      title = "Artifact Stored";
                      desc = `Stored "${activity.filename || "file"}" on Walrus.`;
                      break;
                    case "version_stored":
                      title = "New Version Uploaded";
                      desc = `Uploaded new version of "${activity.filename || "file"}".`;
                      break;
                    case "artifact_searched":
                      title = "Semantic Search";
                      desc = `Searched for "${activity.query}".`;
                      break;
                    case "memory_recalled":
                      title = "Memories Recalled";
                      desc = `Queried MemWal for "${activity.query}".`;
                      break;
                  }

                  return (
                    <div key={activity._id} className="relative group">
                      {/* Timeline dot */}
                      <span className="absolute -left-[21px] top-1.5 flex h-2.5 w-2.5 items-center justify-center rounded-full bg-background border-2 border-primary group-hover:scale-125 transition-transform" />
                      
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-foreground">{title}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{desc}</div>
                        <div className="text-[10px] text-muted-foreground/60 font-mono mt-0.5">
                          {new Date(activity.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
