"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { Trash2, Eye, Filter } from "lucide-react";
import { toast } from "sonner";
import { DashboardCard, DashboardCardBody, DashboardCardHeader, PageHeader } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, fetchAuthenticatedBlob, getErrorMessage, MedicalRecord, RECORD_TYPES } from "@/lib/api";
import { VerificationBadge } from "@/components/blockchain/verification-badge";

export default function MedicalRecordsPage() {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [recordType, setRecordType] = useState("blood_report");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewMime, setPreviewMime] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    const params = filter !== "all" ? { record_type: filter } : {};
    api.get("/patients/medical-records", { params })
      .then((res) => setRecords(res.data.data || []))
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error("Title and file are required");
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.append("title", title.trim());
      form.append("record_type", recordType);
      form.append("description", description);
      form.append("file", file);
      await api.post("/patients/medical-records/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Record uploaded");
      setTitle("");
      setDescription("");
      setFile(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/patients/medical-records/${id}`);
      toast.success("Record deleted");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const openPreview = async (record: MedicalRecord) => {
    if (!record.file_url) return;
    try {
      const url = await fetchAuthenticatedBlob(record.file_url);
      setPreviewUrl(url);
      setPreviewTitle(record.title);
      setPreviewMime(record.mime_type || "");
    } catch {
      toast.error("Could not preview file");
    }
  };

  const typeLabel = (t: string) => RECORD_TYPES.find((r) => r.value === t)?.label || t;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader role="patient" title="Medical Records" description="Upload and manage X-rays, lab reports, MRI scans, and more." />

      <DashboardCard padding="none">
        <DashboardCardHeader title="Upload Record" />
        <DashboardCardBody className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Chest X-Ray Jan 2026" />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={recordType} onValueChange={(v) => v && setRecordType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RECORD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description (optional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Additional notes" />
          </div>
          <div className="space-y-2">
            <Label>File (PDF, PNG, JPG — max 25MB)</Label>
            <Input type="file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.tiff" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
          <Button onClick={handleUpload} disabled={uploading} className="rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]">
            {uploading ? "Uploading..." : "Upload Record"}
          </Button>
        </DashboardCardBody>
      </DashboardCard>

      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={filter} onValueChange={(v) => v && setFilter(v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Filter by type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {RECORD_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : records.length === 0 ? (
        <DashboardCard padding="md"><p className="py-8 text-center text-muted-foreground">No medical records found</p></DashboardCard>
      ) : (
        <div className="space-y-3">
          {records.map((r) => (
            <DashboardCard key={r.id} padding="md" hover>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold">{r.title}</p>
                  {r.description && <p className="text-sm text-muted-foreground mt-1">{r.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">
                    {format(new Date(r.recorded_at), "PPP")}
                    {r.file_name && ` · ${r.file_name}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <VerificationBadge status={r.verification_status} />
                  <div className="flex items-center gap-2">
                  <Badge variant="secondary">{typeLabel(r.record_type)}</Badge>
                  {r.file_url && (
                    <Button size="icon" variant="ghost" onClick={() => openPreview(r)} aria-label="Preview">
                      <Eye className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => handleDelete(r.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  </div>
                </div>
              </div>
            </DashboardCard>
          ))}
        </div>
      )}

      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setPreviewTitle(""); setPreviewMime(""); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>{previewTitle}</DialogTitle></DialogHeader>
          {previewUrl && (
            previewMime.includes("pdf")
              ? <iframe src={previewUrl} className="w-full h-[70vh] rounded-lg border" title={previewTitle} />
              : <img src={previewUrl} alt={previewTitle} className="max-w-full rounded-lg mx-auto" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
