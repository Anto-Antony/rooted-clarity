export type DownloadBlobOptions = {
  content: BlobPart;
  filename: string;
  mimeType: string;
};

export function downloadBlob({ content, filename, mimeType }: DownloadBlobOptions) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

