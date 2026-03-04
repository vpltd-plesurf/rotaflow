"use client";

import { useState, useRef } from "react";
import { format } from "date-fns";
import { Upload, FileText, Trash2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ProfileWithLocation, DocType } from "@/lib/supabase/types";

type DocumentWithEmployee = {
  id: string;
  employee_id: string;
  file_path: string;
  file_name: string;
  file_size: number | null;
  doc_type: DocType;
  uploaded_by: string;
  created_at: string;
  employee: { id: string; full_name: string } | null;
};

interface DocumentsPageClientProps {
  profile: ProfileWithLocation;
  documents: DocumentWithEmployee[];
  employees: { id: string; full_name: string }[];
}

const docTypeLabels: Record<DocType, string> = {
  contract: "Contract",
  insurance: "Insurance",
  id: "ID Document",
  other: "Other",
};

const docTypeVariant: Record<DocType, "default" | "secondary" | "outline"> = {
  contract: "default",
  insurance: "secondary",
  id: "secondary",
  other: "outline",
};

export function DocumentsPageClient({ profile, documents: initialDocs, employees }: DocumentsPageClientProps) {
  const supabase = createClient();
  const [documents, setDocuments] = useState(initialDocs);
  const [uploading, setUploading] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(
    profile.role === "barber" ? profile.id : ""
  );
  const [selectedDocType, setSelectedDocType] = useState<DocType>("contract");
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selectedEmployeeId) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Maximum file size is 10MB." });
      return;
    }

    setUploading(true);
    try {
      const path = `${selectedEmployeeId}/${Date.now()}_${file.name}`;
      const { error: storageError } = await supabase.storage
        .from("documents")
        .upload(path, file);
      if (storageError) throw storageError;

      const { data, error: dbError } = await supabase
        .from("documents")
        .insert({
          employee_id: selectedEmployeeId,
          file_path: path,
          file_name: file.name,
          file_size: file.size,
          doc_type: selectedDocType,
          uploaded_by: profile.id,
        })
        .select("*, employee:profiles!documents_employee_id_fkey(id, full_name)")
        .single();
      if (dbError) throw dbError;

      setDocuments((prev) => [data as DocumentWithEmployee, ...prev]);
      toast({ title: "Document uploaded" });
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Upload failed", description: String(e) });
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(doc: DocumentWithEmployee) {
    const { data, error } = await supabase.storage
      .from("documents")
      .createSignedUrl(doc.file_path, 60);
    if (error || !data) {
      toast({ variant: "destructive", title: "Download failed" });
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  async function handleDelete(doc: DocumentWithEmployee) {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    try {
      await supabase.storage.from("documents").remove([doc.file_path]);
      await supabase.from("documents").delete().eq("id", doc.id);
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast({ title: "Document deleted" });
    } catch (e: unknown) {
      toast({ variant: "destructive", title: "Error", description: String(e) });
    }
  }

  const canManage = profile.role !== "barber";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground">Contracts, insurance certificates, ID documents</p>
      </div>

      {/* Upload area */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-3 items-end">
            {canManage && (
              <div className="space-y-1">
                <label className="text-sm font-medium">Barber</label>
                <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Select barber" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <Select value={selectedDocType} onValueChange={(v) => setSelectedDocType(v as DocType)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(docTypeLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleUpload}
                disabled={uploading || !selectedEmployeeId}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !selectedEmployeeId}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading…" : "Upload file"}
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">PDF, Word, JPG or PNG · Max 10MB</p>
        </CardContent>
      </Card>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No documents yet.
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge variant={docTypeVariant[doc.doc_type]} className="text-xs">
                        {docTypeLabels[doc.doc_type]}
                      </Badge>
                      {canManage && doc.employee && (
                        <span className="text-xs text-muted-foreground">{doc.employee.full_name}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(doc.created_at), "d MMM yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)} title="Download">
                      <Download className="h-4 w-4" />
                    </Button>
                    {canManage && (
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(doc)} title="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
