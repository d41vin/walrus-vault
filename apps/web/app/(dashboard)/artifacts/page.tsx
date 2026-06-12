"use client";

import { useState, useEffect } from "react";
import { useSession } from "@/components/layout/connect-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { 
  FileText, 
  Search, 
  Upload, 
  SlidersHorizontal, 
  Grid, 
  List, 
  Calendar, 
  HardDrive,
  User,
  Plus,
  ArrowUpRight
} from "lucide-react";
import Link from "next/link";

// File size formatting helper
function formatSize(bytes: number) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

// Debounce helper
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function ArtifactsPage() {
  const { key, accountId } = useSession();
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Filters
  const [contentType, setContentType] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Upload Form State
  const [file, setFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadTags, setUploadTags] = useState("");
  const [uploadAgentId, setUploadAgentId] = useState("");
  const [uploadSessionId, setUploadSessionId] = useState("");
  const [uploadDerivedFrom, setUploadDerivedFrom] = useState("");
  const [uploadDependsOn, setUploadDependsOn] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  // Fetch artifacts
  const fetchArtifacts = async () => {
    setLoading(true);
    try {
      const url = new URL("/api/artifacts", window.location.origin);
      if (debouncedSearch) {
        url.searchParams.set("q", debouncedSearch);
      }
      if (contentType) {
        url.searchParams.set("contentType", contentType);
      }
      if (agentFilter) {
        url.searchParams.set("agentId", agentFilter);
      }
      if (tagFilter) {
        url.searchParams.set("tags", tagFilter);
      }

      const res = await fetch(url.toString(), {
        headers: {
          "x-memwal-key": key,
          "x-memwal-account-id": accountId,
        },
      });

      if (!res.ok) throw new Error("Failed to fetch artifacts");
      const data = await res.json();
      setArtifacts(data);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load artifacts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchArtifacts();
  }, [debouncedSearch, contentType, agentFilter, tagFilter]);

  // Handle file select
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      setUploadName(selected.name);
    }
  };

  // Handle upload submit
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      toast.error("Please select a file to store.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("filename", uploadName);
    formData.append("contentType", file.type || "application/octet-stream");
    if (uploadDesc) formData.append("description", uploadDesc);
    if (uploadTags) formData.append("tags", uploadTags);
    if (uploadAgentId) formData.append("agentId", uploadAgentId);
    if (uploadSessionId) formData.append("sessionId", uploadSessionId);
    if (uploadDerivedFrom) formData.append("derivedFrom", uploadDerivedFrom);
    if (uploadDependsOn) formData.append("dependsOn", uploadDependsOn);

    try {
      const res = await fetch("/api/artifacts", {
        method: "POST",
        headers: {
          "x-memwal-key": key,
          "x-memwal-account-id": accountId,
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }

      toast.success("Artifact stored successfully!");
      setIsUploadOpen(false);
      
      // Reset form
      setFile(null);
      setUploadName("");
      setUploadDesc("");
      setUploadTags("");
      setUploadAgentId("");
      setUploadSessionId("");
      setUploadDerivedFrom("");
      setUploadDependsOn("");
      
      // Refresh list
      fetchArtifacts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to store artifact.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-extrabold tracking-tight">Artifact Browser</h1>
          <p className="text-muted-foreground text-sm">
            Search, filter, and upload files to the decentralized vault.
          </p>
        </div>

        {/* Upload Dialog */}
        <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 font-semibold">
              <Plus className="h-4.5 w-4.5" />
              Store Artifact
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="font-heading font-bold text-xl">Store New Artifact</DialogTitle>
              <DialogDescription>
                Upload file bytes to Walrus and index descriptive metadata in MemWal.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpload} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="file" className="font-semibold text-sm">File Selection</Label>
                <div className="flex items-center justify-center border-2 border-dashed border-border rounded-lg p-6 hover:bg-muted/50 transition-colors">
                  <input
                    type="file"
                    id="file"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Label htmlFor="file" className="cursor-pointer flex flex-col items-center gap-2">
                    <Upload className="h-8 w-8 text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      {file ? file.name : "Select or drag file here"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {file ? formatSize(file.size) : "Any format supported"}
                    </span>
                  </Label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="filename" className="font-semibold text-sm">Override Filename (optional)</Label>
                <Input
                  id="filename"
                  placeholder="custom-name.ext"
                  value={uploadName}
                  onChange={(e) => setUploadName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="font-semibold text-sm">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this file contains..."
                  value={uploadDesc}
                  onChange={(e) => setUploadDesc(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tags" className="font-semibold text-sm">Tags</Label>
                  <Input
                    id="tags"
                    placeholder="comma-separated"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="agentId" className="font-semibold text-sm">Agent ID</Label>
                  <Input
                    id="agentId"
                    placeholder="research-bot-01"
                    value={uploadAgentId}
                    onChange={(e) => setUploadAgentId(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="derivedFrom" className="font-semibold text-sm">Derived From (ID)</Label>
                  <Input
                    id="derivedFrom"
                    placeholder="parent-artifact-uuid"
                    value={uploadDerivedFrom}
                    onChange={(e) => setUploadDerivedFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dependsOn" className="font-semibold text-sm">Depends On (IDs)</Label>
                  <Input
                    id="dependsOn"
                    placeholder="dep-uuid1, dep-uuid2"
                    value={uploadDependsOn}
                    onChange={(e) => setUploadDependsOn(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsUploadOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isUploading} className="gap-2">
                  {isUploading ? (
                    <>
                      <Spinner className="h-4 w-4 text-primary-foreground" /> Storing...
                    </>
                  ) : (
                    "Store to Walrus"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-border bg-card/60 backdrop-blur-sm shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4.5 w-4.5 text-muted-foreground" />
            <Input
              placeholder="Semantic search (e.g. 'project layout', 'q3 summaries')..."
              className="pl-9.5 bg-background/50 border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filters:</span>
            </div>
            
            <Input
              placeholder="Content Type"
              className="w-32 h-9 text-xs"
              value={contentType}
              onChange={(e) => setContentType(e.target.value)}
            />

            <Input
              placeholder="Tag"
              className="w-24 h-9 text-xs"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
            />

            <Input
              placeholder="Agent ID"
              className="w-28 h-9 text-xs"
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
            />

            {/* View Toggle */}
            <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/50 ml-auto">
              <Button
                variant={viewMode === "grid" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("grid")}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "secondary" : "ghost"}
                size="icon"
                className="h-8 w-8"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Results Section */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Spinner size="lg" className="text-primary" />
          <p className="text-sm text-muted-foreground font-mono animate-pulse">Running semantic search over MemWal...</p>
        </div>
      ) : artifacts.length === 0 ? (
        <Card className="border-border bg-card p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/5 text-primary">
            <Search className="h-6 w-6" />
          </div>
          <CardTitle className="font-heading text-lg font-bold">No Artifacts Found</CardTitle>
          <CardDescription className="max-w-md mx-auto mt-2">
            No cached artifacts match your filters or search query. 
            Try clearing search inputs or double check your MemWal account settings.
          </CardDescription>
        </Card>
      ) : viewMode === "grid" ? (
        // Grid View
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((artifact) => (
            <Card key={artifact.id} className="border-border bg-card hover:shadow-md hover:border-primary/20 transition-all duration-200 group flex flex-col h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 border border-primary/10 text-primary">
                    <FileText className="h-5 w-5" />
                  </div>
                  {artifact.version > 1 && (
                    <Badge variant="secondary" className="font-semibold text-[10px] bg-primary/10 text-primary border-primary/10">
                      v{artifact.version}
                    </Badge>
                  )}
                </div>
                <CardTitle className="font-heading text-base font-bold truncate mt-3 group-hover:text-primary transition-colors" title={artifact.filename}>
                  {artifact.filename}
                </CardTitle>
                <CardDescription className="text-xs line-clamp-2 mt-1 min-h-[32px]">
                  {artifact.description || "No description provided."}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3 flex-1 flex flex-col justify-end">
                {/* Meta list */}
                <div className="space-y-1.5 text-xs text-muted-foreground font-mono">
                  <div className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{formatSize(artifact.size)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    <span>{new Date(artifact.createdAt).toLocaleDateString()}</span>
                  </div>
                  {artifact.agentId && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">Agent: {artifact.agentId}</span>
                    </div>
                  )}
                </div>

                {/* Tags row */}
                {artifact.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-4">
                    {artifact.tags.slice(0, 3).map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0.5">
                        {tag}
                      </Badge>
                    ))}
                    {artifact.tags.length > 3 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 text-muted-foreground">
                        +{artifact.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-3 border-t border-border mt-auto">
                <Link href={`/dashboard/artifacts/${artifact.id}`} className="w-full">
                  <Button variant="outline" className="w-full text-xs font-semibold gap-1.5">
                    Inspect Artifact <ArrowUpRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        // List View
        <Card className="border-border bg-card shadow-sm divide-y divide-border">
          {artifacts.map((artifact) => (
            <div key={artifact.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors group">
              <div className="flex items-center gap-4 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 border border-primary/10 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                      {artifact.filename}
                    </h4>
                    {artifact.version > 1 && (
                      <Badge variant="secondary" className="font-semibold text-[9px] py-0.5 px-1 bg-primary/10 text-primary border-primary/10">
                        v{artifact.version}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate max-w-xl mt-0.5">
                    {artifact.description || "No description."}
                  </p>
                  <div className="flex items-center gap-3.5 text-xs text-muted-foreground mt-1 font-mono">
                    <span>{artifact.contentType}</span>
                    <span>•</span>
                    <span>{formatSize(artifact.size)}</span>
                    <span>•</span>
                    <span>{new Date(artifact.createdAt).toLocaleDateString()}</span>
                    {artifact.agentId && (
                      <>
                        <span>•</span>
                        <span>Agent: {artifact.agentId}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Link href={`/dashboard/artifacts/${artifact.id}`}>
                <Button variant="outline" size="sm" className="font-semibold text-xs gap-1">
                  Inspect <ArrowUpRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
