import { useEffect, useRef, useState } from 'react'
import { Eye, FolderOpen, Square } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { GateLaneScene, type GateLaneSceneHandle, type LaneFrame, type LaneSample } from '@/components/features/staff/GateLaneScene'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/form-controls'
import { randomPlate } from '@/lib/vnPlate'

/**
 * Development tool: renders the 3D gate lanes with random vehicles, plates, camera poses and light,
 * and saves each frame with its labels (plate box and every character box) for training the plate
 * reader. The Python tools in the backend repo (tools/anpr) turn the folder into YOLO datasets.
 */

const IMAGE_SIZE = { width: 1280, height: 720 }

type DirectoryPicker = (options?: { mode?: 'read' | 'readwrite'; id?: string }) => Promise<FileSystemDirectoryHandle>
const directoryPicker = () => (window as unknown as { showDirectoryPicker?: DirectoryPicker }).showDirectoryPicker

const between = (min: number, max: number) => min + Math.random() * (max - min)

/** A random pose: vehicle, plate, position, camera, light, barrier and plate wear. */
function randomSample(motorbikeShare: number): LaneSample {
  const kind = Math.random() < motorbikeShare ? 'motorbike' : 'car'
  return {
    plate: randomPlate(kind),
    kind,
    offsetX: between(-0.35, 0.35),
    offsetZ: between(-0.9, 0.9),
    yaw: between(-0.14, 0.14),
    camera: { dx: between(-0.7, 0.7), dy: between(-0.45, 0.45), dz: between(-1.1, 1.1), fov: between(26, 44) },
    exposure: between(0.45, 1.5),
    barrierLift: Math.random() < 0.6 ? 0 : Math.random(),
    grime: Math.random() < 0.55 ? 0 : between(0.2, 1),
    paint: hslToHex(Math.random(), between(0, 0.6), between(0.12, 0.8)),
  }
}

/** HSL (0..1 each) to 0xRRGGBB, for random paint colours. */
function hslToHex(h: number, s: number, l: number) {
  const k = (n: number) => (n + h * 12) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return (Math.round(f(0) * 255) << 16) | (Math.round(f(8) * 255) << 8) | Math.round(f(4) * 255)
}

/** The label file written next to each image (boxes are 0..1 from the top-left corner). */
function labelJson(file: string, sample: LaneSample, frame: LaneFrame) {
  return JSON.stringify({
    image: `images/${file}.jpg`,
    width: frame.width,
    height: frame.height,
    plate: sample.plate,
    kind: sample.kind,
    plateBox: frame.plateBox,
    chars: frame.chars.map((c) => ({ char: c.char, ...c.box })),
  })
}

async function writeFile(dir: FileSystemDirectoryHandle, name: string, data: Blob | string) {
  const handle = await dir.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  await writable.write(data)
  await writable.close()
}

/** Draws the frame with its labels: the plate in green, characters in amber. */
async function drawPreview(canvas: HTMLCanvasElement, frame: LaneFrame) {
  const bitmap = await createImageBitmap(frame.image)
  canvas.width = frame.width
  canvas.height = frame.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const rect = (b: { x: number; y: number; width: number; height: number }) => ctx.strokeRect(b.x * frame.width, b.y * frame.height, b.width * frame.width, b.height * frame.height)
  ctx.lineWidth = 2
  if (frame.plateBox) {
    ctx.strokeStyle = '#22c55e'
    rect(frame.plateBox)
  }
  ctx.strokeStyle = '#f59e0b'
  ctx.lineWidth = 1
  frame.chars.forEach((c) => rect(c.box))
}

export default function AnprDatasetPage() {
  const entry = useRef<GateLaneSceneHandle>(null)
  const exit = useRef<GateLaneSceneHandle>(null)
  const preview = useRef<HTMLCanvasElement>(null)
  const stop = useRef(false)
  const [count, setCount] = useState(600)
  const [bikeShare, setBikeShare] = useState(50)
  const [running, setRunning] = useState(false)
  const [done, setDone] = useState(0)
  const [message, setMessage] = useState<string | null>(null)
  const [last, setLast] = useState<{ plate: string; chars: number } | null>(null)
  const canSave = Boolean(directoryPicker())

  useEffect(() => () => {
    stop.current = true
  }, [])

  /** One labelled frame from a random lane, or null when the plate ended up out of view. */
  const render = async () => {
    const sample = randomSample(bikeShare / 100)
    const scene = Math.random() < 0.5 ? entry.current : exit.current
    const frame = await scene?.renderSample(sample, IMAGE_SIZE)
    return frame && frame.plateBox ? { sample, frame } : null
  }

  const previewOne = async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const result = await render()
      if (!result) continue
      if (preview.current) await drawPreview(preview.current, result.frame)
      setLast({ plate: result.sample.plate, chars: result.frame.chars.length })
      return
    }
    setMessage('The plate stayed out of view: try again.')
  }

  const generate = async () => {
    const pick = directoryPicker()
    if (!pick) return
    let root: FileSystemDirectoryHandle
    try {
      root = await pick({ mode: 'readwrite', id: 'anpr-dataset' })
    } catch {
      return // the folder picker was closed
    }
    const images = await root.getDirectoryHandle('images', { create: true })
    const labels = await root.getDirectoryHandle('labels', { create: true })
    const prefix = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')

    stop.current = false
    setRunning(true)
    setDone(0)
    setMessage(null)
    let written = 0
    try {
      while (written < count && !stop.current) {
        const result = await render()
        if (!result) continue
        const file = `${prefix}_${String(written + 1).padStart(5, '0')}`
        await writeFile(images, `${file}.jpg`, result.frame.image)
        await writeFile(labels, `${file}.json`, labelJson(file, result.sample, result.frame))
        written++
        setDone(written)
        // Show every tenth frame so the labels can be checked while it runs
        if (written % 10 === 1 && preview.current) {
          await drawPreview(preview.current, result.frame)
          setLast({ plate: result.sample.plate, chars: result.frame.chars.length })
        }
      }
      setMessage(`${written} labelled images saved in "${root.name}".`)
    } catch (e) {
      setMessage(`Stopped after ${written} images: ${e instanceof Error ? e.message : 'the folder could not be written'}.`)
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Developer tools"
        title="Plate reader training images"
        description="Renders the 3D gate lanes with random vehicles, Vietnamese plates, camera angles and light, and saves each frame with the plate and character boxes. Train the plate reader on the folder with the tools in the backend repo (tools/anpr)."
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader>
            <CardTitle>Labels preview</CardTitle>
            <CardDescription>Plate box in green, character boxes in amber. Saved images are 1280 × 720.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <canvas ref={preview} className="aspect-video w-full rounded-lg bg-slate-50 ring-1 ring-slate-200" />
            {last && (
              <p className="font-mono text-sm text-slate-700">
                {last.plate} • {last.chars} characters labelled
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Generate</CardTitle>
            <CardDescription>Choose an empty folder: the images go to images/ and one label file per image to labels/.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="anpr-count">Number of images</Label>
              <Input id="anpr-count" type="number" min={10} max={20000} value={count} disabled={running} onChange={(e) => setCount(Math.max(10, Math.min(20000, Number(e.target.value) || 10)))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="anpr-bikes">Motorbikes (%)</Label>
              <Input id="anpr-bikes" type="number" min={0} max={100} value={bikeShare} disabled={running} onChange={(e) => setBikeShare(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" disabled={running} onClick={() => void previewOne()}>
                <Eye /> Preview a sample
              </Button>
              {running ? (
                <Button variant="outline" onClick={() => (stop.current = true)}>
                  <Square /> Stop
                </Button>
              ) : (
                <Button disabled={!canSave} onClick={() => void generate()}>
                  <FolderOpen /> Choose folder and generate
                </Button>
              )}
            </div>
            {!canSave && <p className="text-sm text-amber-500">Saving to a folder needs Chrome or Edge on a computer.</p>}
            {(running || done > 0) && (
              <div className="space-y-1.5" aria-live="polite">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full bg-indigo-500 transition-[width]" style={{ width: `${(done / count) * 100}%` }} />
                </div>
                <p className="text-sm text-slate-700">
                  {done} / {count} images
                </p>
              </div>
            )}
            {message && <p className="text-sm text-slate-900">{message}</p>}
          </CardContent>
        </Card>
      </div>

      {/* The lanes the images are rendered from */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-slate-200">
          <GateLaneScene ref={entry} direction="entry" vehicle={null} className="absolute inset-0" />
        </div>
        <div className="relative aspect-video overflow-hidden rounded-xl ring-1 ring-slate-200">
          <GateLaneScene ref={exit} direction="exit" vehicle={null} className="absolute inset-0" />
        </div>
      </div>
    </div>
  )
}
