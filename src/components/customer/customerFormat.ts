import { Bike, Car, CarFront, Zap, type LucideIcon } from 'lucide-react'
import type { VehicleDTO, VehicleTypeDTO } from '@/types/profile.dto'

/** "Alex Nguyen" -> "AN" */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' })

/** "October 2024", or "—" when the date is missing. */
export function formatMonthYear(iso: string | null | undefined): string {
  const date = iso ? new Date(iso) : null
  return date && !Number.isNaN(date.getTime()) ? monthYear.format(date) : '—'
}

/** Short, readable member number from the user id ("USR-740291"). */
export function memberCode(userId: string | undefined): string {
  const digits = (userId ?? '').replace(/\D/g, '')
  const code = digits ? digits.slice(-6) : (userId ?? '').replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()
  return `USR-${code.padStart(6, '0')}`
}

type VehicleKind = 'car' | 'suv' | 'motorbike' | 'ev'

/** Category from the backend type code (CAR, SUV, MOTORBIKE, EV...) or, failing that, its name. */
export function vehicleKind(type: Pick<VehicleTypeDTO, 'code' | 'name'> | { code?: string; name: string }): VehicleKind {
  const text = `${type.code ?? ''} ${type.name}`.toUpperCase()
  if (text.includes('MOTOR') || text.includes('BIKE') || text.includes('SCOOTER')) return 'motorbike'
  if (text.includes('EV') || text.includes('ELECTRIC') || text.includes('HYBRID')) return 'ev'
  if (text.includes('SUV') || text.includes('CROSSOVER')) return 'suv'
  return 'car'
}

export const KIND_ICON: Record<VehicleKind, LucideIcon> = { car: Car, suv: CarFront, motorbike: Bike, ev: Zap }

export const vehicleTitle = (vehicle: VehicleDTO) =>
  [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || vehicle.licensePlate

/** Password strength: one point per rule (length 8+, digit, mixed case, symbol). 0 = empty. */
export function passwordScore(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  let score = 0
  if (password.length >= 8) score++
  if (/[0-9]/.test(password)) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++
  return Math.max(score, 1) as 1 | 2 | 3 | 4
}

export const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const
