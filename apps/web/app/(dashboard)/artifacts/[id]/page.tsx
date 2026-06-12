"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "@/components/layout/connect-gate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { 
  FileText, 
  Download, 
  Calendar, 
  HardDrive, 
  User, 
  Database,
  ArrowLeft,
  Copy,
  Check,
  History,
  GitBranch,
  Eye,
  ChevronDown,
  ChevronUp,
  Plus
} from "lucide-react";
import Link from "next/link";

function formatSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export default function ArtifactDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);
  const { key, accountId } = useSession();
  const [artifact, setArtifact] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showRawMeta, setShowRawMeta] = useState(false);
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null);

  // Upload New Version States
  const [newVersionFile, setNewVersionFile] = useState<File | null>(null);
  const [newVersionDesc, setNewVersionDesc] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Fetch artifact details
  const fetchArtifact = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/artifacts/${id}`, {
        headers: {
          "x-memwal-key": key,
          "x-memwal-account-id": accountId,
        },
      });
      if (!res.ok) throw new Error("Artifact not found");
      const data = await res.json();
      setArtifact(data);
      setSelectedVersionNum(data.version); // default to current version
    } catch (err) {
      console.error(err);
      toast.error("Failed to load artifact details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtifact();
  }, [id]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(label);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNewVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVersionFile) {
      toast.error("Please select a file.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", newVersionFile);
    if (newVersionDesc) formData.append("description", newVersionDesc);

    try {
      const res = await fetch(`/api/artifacts/${id}`, {
        method: "POST",
        headers: {
          "x-memwal-key": key,
          "x-memwal-account-id": accountId,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to upload new version");
      }

      toast.success("New version stored successfully!");
      setIsUploadOpen(false);
      setNewVersionFile(null);
      setNewVersionDesc("");
      fetchArtifact(); // Refresh details
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to upload new version.");
    } finally {
      setIsUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <Spinner size="lg" className="text-primary" />
        <p className="text-sm text-muted-foreground font-mono animate-pulse">Retrieving artifact metadata from Sui registry...</p>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold">Artifact Not Found</h2>
        <p className="text-muted-foreground mt-2">The requested artifact could not be found.</p>
        <Link href="/dashboard/artifacts" className="mt-4 inline-block">
          <Button variant="outline" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Browser
          </Button>
        </Link>
      </div>
    );
  }

  // Find active version
  const activeVersion = artifact.versions?.find((v: any) => v.version === selectedVersionNum) || {
    version: artifact.version,
    blobId: artifact.blobId,
    size: artifact.size,
    createdAt: artifact.createdAt,
    description: artifact.description,
  };

  const activeDownloadUrl = `/api/blobs/${activeVersion.blobId}`;

  // Check file type preview availability
  const isImage = artifact.contentType.startsWith("image/");
  const isPdf = artifact.contentType === "application/pdf";
  const isText = artifact.contentType.startsWith("text/") || 
                 artifact.contentType === "application/json" || 
                 artifact.contentType === "application/javascript";

  return (
    <div className="space-y-6">
      {/* Top Navigation */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/artifacts">
          <Button variant="outline" size="sm" className="gap-1.5 font-semibold text-xs">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <h1 className="font-heading text-xl font-extrabold truncate max-w-md">{artifact.filename}</h1>
          <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/10 font-bold">
            v{artifact.version}
          </Badge>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Preview & Code */}
        <div className="lg:col-span-2 space-y-6">
          {/* File Preview */}
          <Card className="border-border bg-card shadow-sm overflow-hidden flex flex-col h-[500px]">
            <CardHeader className="py-3 px-6 border-b border-border bg-muted/20 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold">File Preview</CardTitle>
                <CardDescription className="text-xs">
                  Viewing version {activeVersion.version} ({artifact.contentType})
                </CardDescription>
              </div>
              <a href={activeDownloadUrl} download={artifact.filename}>
                <Button size="sm" variant="outline" className="gap-1.5 font-semibold text-xs">
                  <Download className="h-3.5 w-3.5" /> Download File
                </Button>
              </a>
            </CardHeader>
            <CardContent className="p-0 flex-1 bg-muted/10 overflow-auto flex items-center justify-center">
              {isImage ? (
                <img
                  src={activeDownloadUrl}
                  alt={artifact.filename}
                  className="max-h-full max-w-full object-contain p-4"
                />
              ) : isPdf ? (
                <iframe
                  src={`${activeDownloadUrl}#toolbar=0`}
                  className="w-full h-full border-none"
                  title={artifact.filename}
                />
              ) : isText ? (
                <TextPreview url={activeDownloadUrl} />
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                  <FileText className="h-16 w-16 mb-4 stroke-1 text-primary/45" />
                  <h3 className="font-semibold text-sm">Preview Not Supported</h3>
                  <p className="text-xs max-w-xs mt-1">
                    This file format cannot be previewed in the browser. 
                    Download the file to view its contents.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lineage Panel */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                Lineage Graph
              </CardTitle>
              <CardDescription>Trace the dependencies and derivations of this file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Derived From</div>
                  {artifact.derivedFrom ? (
                    <Link href={`/dashboard/artifacts/${artifact.derivedFrom}`} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                      <FileText className="h-4 w-4 shrink-0" />
                      {artifact.derivedFrom.slice(0, 18)}...
                    </Link>
                  ) : (
                    <div className="text-xs text-muted-foreground">No parent derivation declared.</div>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-muted/30 p-4">
                  <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider mb-2">Depends On</div>
                  {artifact.dependsOn && artifact.dependsOn.length > 0 ? (
                    <div className="space-y-1.5">
                      {artifact.dependsOn.map((depId: string) => (
                        <Link key={depId} href={`/dashboard/artifacts/${depId}`} className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
                          <FileText className="h-4 w-4 shrink-0" />
                          {depId.slice(0, 18)}...
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">No dependencies declared.</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right column: Version timeline & metadata info */}
        <div className="space-y-6">
          {/* Metadata & Actions */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="font-heading text-base font-bold">Metadata Info</CardTitle>
                
                {/* Store New Version Dialog */}
                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 font-semibold text-xs">
                      <Plus className="h-3.5 w-3.5" /> New Version
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md bg-card border-border">
                    <DialogHeader>
                      <DialogTitle className="font-heading font-bold text-xl">Upload New Version</DialogTitle>
                      <DialogDescription>
                        Upload a new version for this artifact. The version number will increment.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleNewVersionSubmit} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newFile" className="font-semibold text-sm">Select File</Label>
                        <Input
                          id="newFile"
                          type="file"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              setNewVersionFile(e.target.files[0]);
                            }
                          }}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="versionDesc" className="font-semibold text-sm">Description of Changes</Label>
                        <Input
                          id="versionDesc"
                          placeholder="e.g. Added Q3 margins column"
                          value={newVersionDesc}
                          onChange={(e) => setNewVersionDesc(e.target.value)}
                        />
                      </div>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit" disabled={isUploading} className="gap-2">
                          {isUploading ? (
                            <>
                              <Spinner className="h-4 w-4 text-primary-foreground" /> Storing...
                            </>
                          ) : (
                            "Store Version"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-mono text-muted-foreground">
              {/* Properties list */}
              <div className="space-y-3">
                <div>
                  <span className="text-[10px] uppercase font-bold text-foreground">Artifact ID</span>
                  <div className="flex items-center justify-between border border-border rounded p-2 mt-1 bg-muted/30">
                    <span className="truncate text-foreground font-semibold select-all">{artifact.id}</span>
                    <button onClick={() => copyToClipboard(artifact.id, "id")} className="hover:text-foreground">
                      {copiedId === "id" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-foreground">Walrus Blob ID (Active Version)</span>
                  <div className="flex items-center justify-between border border-border rounded p-2 mt-1 bg-muted/30">
                    <span className="truncate text-foreground font-semibold select-all">{activeVersion.blobId}</span>
                    <button onClick={() => copyToClipboard(activeVersion.blobId, "blob")} className="hover:text-foreground">
                      {copiedId === "blob" ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-foreground">File Size</span>
                    <p className="text-foreground font-semibold mt-0.5">{formatSize(activeVersion.size || artifact.size)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-foreground">Created At</span>
                    <p className="text-foreground font-semibold mt-0.5">{new Date(activeVersion.createdAt || artifact.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-foreground">Content Type</span>
                  <p className="text-foreground font-semibold mt-0.5">{artifact.contentType}</p>
                </div>

                {artifact.agentId && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-foreground">Agent ID</span>
                    <p className="text-foreground font-semibold mt-0.5">{artifact.agentId}</p>
                  </div>
                )}
                
                {artifact.sessionId && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-foreground">Session ID</span>
                    <p className="text-foreground font-semibold mt-0.5">{artifact.sessionId}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Version Timeline */}
          <Card className="border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="font-heading text-base font-bold flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Version Timeline
              </CardTitle>
              <CardDescription>Select a version to preview and inspect.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative pl-4 border-l border-border space-y-4 py-1">
                {artifact.versions?.map((v: any) => {
                  const isCurrent = v.version === selectedVersionNum;
                  return (
                    <div
                      key={v.version}
                      className={`relative cursor-pointer transition-colors p-2.5 rounded-lg border ${
                        isCurrent 
                          ? "bg-primary/5 border-primary/20 text-primary" 
                          : "border-transparent hover:bg-muted/40 text-muted-foreground hover:text-foreground"
                      }`}
                      onClick={() => setSelectedVersionNum(v.version)}
                    >
                      {/* Circle dot */}
                      <span className={`absolute -left-[21px] top-4.5 h-2.5 w-2.5 rounded-full border-2 bg-background ${
                        isCurrent ? "border-primary scale-110" : "border-muted-foreground"
                      }`} />
                      
                      <div className="flex items-center justify-between">
                        <div className="font-semibold text-sm">Version {v.version}</div>
                        {v.version === artifact.version && (
                          <Badge className="text-[9px] bg-primary/20 text-primary border-primary/10 font-bold">Latest</Badge>
                        )}
                      </div>
                      
                      {v.description && (
                        <p className="text-xs mt-1 italic">{v.description}</p>
                      )}
                      
                      <div className="text-[10px] mt-1 font-mono flex items-center gap-2 opacity-80">
                        <span>{formatSize(v.size || artifact.size)}</span>
                        <span>•</span>
                        <span>{v.createdAt ? new Date(v.createdAt).toLocaleDateString() : "Historical"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Raw MemWal Metadata memory */}
      <Card className="border-border bg-card shadow-sm">
        <button
          onClick={() => setShowRawMeta(!showRawMeta)}
          className="flex w-full items-center justify-between p-4 font-heading text-sm font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="flex items-center gap-2">
            <Database className="h-4.5 w-4.5 text-primary" />
            Raw MemWal Metadata Memory
          </span>
          {showRawMeta ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
        </button>
        {showRawMeta && (
          <CardContent className="p-4 border-t border-border bg-muted/10">
            <pre className="font-mono text-xs text-foreground p-3.5 rounded bg-background/80 border border-border overflow-auto max-h-[300px]">
              {serializeRawMetadata(artifact, activeVersion)}
            </pre>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// Inline component for text file previews
function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error();
        return res.text();
      })
      .then((text) => {
        setContent(text.slice(0, 10000)); // limit preview length
      })
      .catch(() => {
        setContent("Failed to load text preview.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [url]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 gap-2">
        <Spinner className="h-6 w-6 text-primary" />
        <span className="text-xs text-muted-foreground font-mono">Loading content...</span>
      </div>
    );
  }

  return (
    <pre className="font-mono text-xs text-foreground p-6 whitespace-pre-wrap text-left w-full h-full align-top select-text">
      {content}
    </pre>
  );
}

// Serialize raw metadata for display
function serializeRawMetadata(artifact: any, version: any) {
  const versionsStr = artifact.versions
    ? artifact.versions.map((v: any) => `${v.version}:${v.blobId}`).join(", ")
    : `1:${artifact.blobId}`;

  return `ARTIFACT_VAULT_META
id: ${artifact.id}
filename: ${artifact.filename}
contentType: ${artifact.contentType}
blobId: ${version.blobId}
size: ${version.size || artifact.size}
version: ${version.version}
latestVersion: ${artifact.version}
versions: ${versionsStr}
description: ${version.description || artifact.description || ""}
tags: ${artifact.tags ? artifact.tags.join(", ") : ""}
agentId: ${artifact.agentId || "manual"}
sessionId: ${artifact.sessionId || "none"}
derivedFrom: ${artifact.derivedFrom || "none"}
dependsOn: ${artifact.dependsOn ? artifact.dependsOn.join(", ") : "none"}
createdAt: ${version.createdAt || artifact.createdAt}`;
}
