import { useEffect, useState, useCallback, useRef } from "react";
import { Paperclip, Upload, Trash2, File } from "lucide-react";

interface Attachment {
  name: string;
  size: number;
  modifiedAt: string;
}

interface AttachmentListProps {
  projectId: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AttachmentList({ projectId }: AttachmentListProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/attachments`);
      if (res.ok) {
        setAttachments(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`/api/projects/${projectId}/attachments`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error || `Failed to upload ${file.name}`);
        }
      } catch {
        setError(`Failed to upload ${file.name}`);
      }
    }

    setUploading(false);
    fetchAttachments();

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleDelete(name: string) {
    const confirmed = window.confirm(`Delete "${name}"?`);
    if (!confirmed) return;

    try {
      await fetch(`/api/projects/${projectId}/attachments/${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      fetchAttachments();
    } catch {
      setError(`Failed to delete ${name}`);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    handleUpload(e.dataTransfer.files);
  }

  if (loading) {
    return null;
  }

  return (
    <div className="rounded-lg border border-border bg-bg-primary p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-text-secondary" />
          <h3 className="font-heading text-base font-semibold text-black">
            Attachments
          </h3>
          {attachments.length > 0 && (
            <span className="rounded-full bg-bg-secondary px-2 py-0.5 font-body text-xs text-text-secondary">
              {attachments.length}
            </span>
          )}
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-bg-primary px-3 py-1.5 font-body text-sm text-text-primary transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2">
          <p className="font-body text-xs text-red-700">{error}</p>
        </div>
      )}

      {/* Drop zone when empty */}
      {attachments.length === 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-8 transition-colors ${
            dragOver
              ? "border-primary bg-primary-light"
              : "border-border text-text-secondary"
          }`}
        >
          <Upload className="mb-2 h-6 w-6 text-text-muted" />
          <p className="font-body text-sm text-text-secondary">
            Drop files here or click Upload
          </p>
          <p className="mt-1 font-body text-xs text-text-muted">
            Files will be available to agents during execution
          </p>
        </div>
      )}

      {/* File list */}
      {attachments.length > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`space-y-1.5 ${dragOver ? "rounded-lg border-2 border-dashed border-primary bg-primary-light p-2" : ""}`}
        >
          {attachments.map((file) => (
            <div
              key={file.name}
              className="group flex items-center justify-between rounded-md border border-border bg-bg-secondary px-3 py-2"
            >
              <div className="flex items-center gap-2.5">
                <File className="h-4 w-4 flex-shrink-0 text-text-muted" />
                <div>
                  <p className="font-body text-sm font-medium text-text-primary">
                    {file.name}
                  </p>
                  <p className="font-body text-xs text-text-muted">
                    {formatSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(file.name)}
                className="rounded p-1 text-text-muted opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
