import { useState, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from './button'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // Clipboard API needs a secure context (HTTPS/localhost) and permission.
    return false
  }
}

interface CopyFieldProps {
  value: string
  label: string
  /** Extra buttons next to Copy (e.g. "generate again"). */
  actions?: ReactNode
}

/** Read-only monospace value with a copy button — for generated passwords. */
export function CopyField({ value, label, actions }: CopyFieldProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    if (await copyText(value)) {
      setCopied(true)
      toast.success('Copied to clipboard')
      window.setTimeout(() => setCopied(false), 1500)
    } else {
      toast.error('Could not copy automatically', { description: 'Select and copy it manually.' })
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={value}
        aria-label={label}
        onFocus={(e) => e.currentTarget.select()}
        className="h-9 min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm tracking-wide text-slate-900"
      />
      <Button variant="outline" size="sm" onClick={handleCopy} aria-label={`Copy ${label}`}>
        {copied ? <Check className="text-emerald-600" /> : <Copy />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
      {actions}
    </div>
  )
}
