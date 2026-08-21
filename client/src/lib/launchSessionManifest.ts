export type PersistedLaunchManifestFile = {
  name?: string;
  url?: string;
  mimeType?: string;
  label?: string;
};

export type RestoredLaunchManifestFile = {
  id: string;
  name: string;
  mimeType: string;
  type: "pdf" | "docx" | "xlsx" | "zip" | "other";
  label: string;
  url?: string;
};

function getFileType(fileName: string, mimeType: string): RestoredLaunchManifestFile["type"] {
  const name = fileName.toLowerCase();
  if (name.endsWith(".pdf") || mimeType === "application/pdf") return "pdf";
  if (name.endsWith(".docx") || name.endsWith(".doc")) return "docx";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "xlsx";
  if (name.endsWith(".zip") || mimeType.includes("zip")) return "zip";
  return "other";
}

/** Creates display-only persisted manifest entries; it deliberately never reconstructs File objects. */
export function restoreLaunchManifest(files: unknown): RestoredLaunchManifestFile[] {
  if (!Array.isArray(files)) return [];
  return files.map((value, index) => {
    const file = (value && typeof value === "object" ? value : {}) as PersistedLaunchManifestFile;
    const name = file.name?.trim() || `RFP source ${index + 1}`;
    const mimeType = file.mimeType?.trim() || "application/octet-stream";
    return {
      id: `restored-${index}-${name}`,
      name,
      mimeType,
      type: getFileType(name, mimeType),
      label: file.label?.trim() || "Supplemental",
      ...(file.url ? { url: file.url } : {}),
    };
  });
}
