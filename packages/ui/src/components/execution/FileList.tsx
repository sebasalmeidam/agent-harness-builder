import { FileText } from "lucide-react";

interface FileListProps {
  files: string[];
}

/**
 * List of file paths created or modified during execution.
 * Each entry shows a file icon and the file path in monospace styling.
 * Updates reactively as the files array grows.
 */
export default function FileList({ files }: FileListProps) {
  if (files.length === 0) {
    return (
      <p className="font-body text-sm text-text-secondary">
        No files changed yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1" data-testid="file-list">
      {files.map((filePath) => (
        <li
          key={filePath}
          className="flex items-center gap-2 rounded px-2 py-1"
          data-testid="file-entry"
        >
          <FileText className="h-4 w-4 shrink-0 text-text-secondary" />
          <span className="font-mono text-sm text-text-primary">
            {filePath}
          </span>
        </li>
      ))}
    </ul>
  );
}
