import { Bike, Car, CarFront, type LucideIcon } from 'lucide-react'
import { PASSWORD_RULES } from '@/lib/password'
import { resolveMediaUrl } from '@/lib/format'
import type { VehicleDTO, VehicleTypeDTO } from '@/types/profile.dto'

export { resolveMediaUrl }

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

/** The only vehicle types: 4-seat cars ("car"), 7-seat cars ("suv") and motorbikes. */
type VehicleKind = 'car' | 'suv' | 'motorbike'

/** Category from the backend type code (CAR_4, CAR_7, MOTORBIKE) or, failing that, its name. */
export function vehicleKind(type: Pick<VehicleTypeDTO, 'code' | 'name'> | { code?: string; name: string }): VehicleKind {
  const text = `${type.code ?? ''} ${type.name}`.toUpperCase()
  if (text.includes('MOTOR')) return 'motorbike'
  if (text.includes('CAR_7') || text.includes('7-SEAT') || text.includes('SUV')) return 'suv'
  return 'car'
}

export const KIND_ICON: Record<VehicleKind, LucideIcon> = { car: Car, suv: CarFront, motorbike: Bike }

export const vehicleTitle = (vehicle: VehicleDTO) =>
  [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || vehicle.licensePlate

/** Length from which a password that passes the API rule is rated "Strong" rather than "Good". */
const STRONG_PASSWORD_LENGTH = 10

/**
 * Password strength for the 4-bar meter, based on the API rule (lib/password PASSWORD_RULES):
 * one point per rule met (6+ characters, upper-case letter, special character), so 3 = the API
 * accepts it, plus one more for 10+ characters. Anything typed scores at least 1; 0 = empty.
 */
export function passwordScore(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  const met = PASSWORD_RULES.filter((rule) => rule.test(password)).length
  const bonus = met === PASSWORD_RULES.length && password.length >= STRONG_PASSWORD_LENGTH ? 1 : 0
  return Math.max(met + bonus, 1) as 1 | 2 | 3 | 4
}

export const STRENGTH_LABEL = ['', 'Weak', 'Fair', 'Good', 'Strong'] as const
