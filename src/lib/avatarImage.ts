/** Longest side of a stored profile photo. The header shows it at 56px, so 512px stays sharp on any screen. */
const AVATAR_MAX_SIDE = 512
const AVATAR_QUALITY = 0.85

function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, AVATAR_QUALITY))
}

/**
 * Shrinks a profile photo in the browser before upload: a 10 MB phone photo becomes a few dozen KB,
 * which keeps the upload fast and the database small. Returns the original file when the browser
 * cannot decode it, so the server still gets a chance to accept or reject it.
 */
export async function shrinkAvatarImage(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    const scale = Math.min(1, AVATAR_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    // WebP keeps transparency; browsers that cannot encode it fall back to JPEG on a white background
    ctx.drawImage(bitmap, 0, 0, width, height)
    let blob = await canvasToBlob(canvas, 'image/webp')
    if (!blob || blob.type !== 'image/webp') {
      ctx.globalCompositeOperation = 'destination-over'
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      blob = await canvasToBlob(canvas, 'image/jpeg')
    }
    if (!blob || blob.size >= file.size) return file

    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'avatar'
    return new File([blob], `${baseName}.${extension}`, { type: blob.type })
  } finally {
    bitmap.close()
  }
}
