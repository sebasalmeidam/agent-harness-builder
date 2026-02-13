import { execFile } from "node:child_process";

export interface CloneResult {
  success: boolean;
  error?: string;
}

const CLONE_TIMEOUT_MS = 120_000;

export function cloneRepository(
  gitUrl: string,
  targetDir: string,
): Promise<CloneResult> {
  if (!gitUrl || typeof gitUrl !== "string" || gitUrl.trim().length === 0) {
    return Promise.resolve({
      success: false,
      error: "Git URL must be a non-empty string",
    });
  }

  return new Promise((resolve) => {
    execFile(
      "git",
      ["clone", gitUrl, targetDir],
      { timeout: CLONE_TIMEOUT_MS },
      (error) => {
        if (error) {
          resolve({
            success: false,
            error: error.message,
          });
          return;
        }
        resolve({ success: true });
      },
    );
  });
}
