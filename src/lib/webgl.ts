let webgl2: boolean | undefined

/** Whether this browser can create a WebGL 2 context (SRS NFR-3D-04: the 3D model needs WebGL 2). */
export function supportsWebGL2(): boolean {
  if (webgl2 !== undefined) return webgl2
  try {
    const canvas = document.createElement('canvas')
    webgl2 = Boolean(canvas.getContext('webgl2'))
  } catch {
    webgl2 = false
  }
  return webgl2
}

/** Low-end hardware starts on the 2D plan (FR-3D-06); people can still switch to 3D. */
export function isLowEndDevice(): boolean {
  const nav = navigator as Navigator & { deviceMemory?: number }
  return (nav.deviceMemory ?? 8) <= 2 || (nav.hardwareConcurrency ?? 8) <= 2
}
