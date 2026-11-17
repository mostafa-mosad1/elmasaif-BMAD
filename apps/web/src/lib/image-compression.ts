/**
 * Compresses an image file in the browser if it exceeds target size.
 * Prevents Vercel Serverless Function 4.5 MB payload limit (413 Content Too Large).
 */
export async function compressImageIfNeeded(
  file: File,
  maxSizeBytes = 3.5 * 1024 * 1024, // 3.5 MB threshold
  maxDimension = 2048,
  quality = 0.82
): Promise<File> {
  if (typeof window === 'undefined') return file;
  if (!file.type || !file.type.startsWith('image/')) return file;
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') return file;
  if (file.size <= maxSizeBytes) return file;

  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const newFilename = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
    return new File([blob], newFilename, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
