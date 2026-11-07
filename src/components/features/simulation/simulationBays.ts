import type { Bay } from '@/components/customer/garage/garageModel'

/** A bay that holds a booking: held now (yellow) or booked for later. */
export const isBooked = (bay: Bay) => bay.status === 'RESERVED' || Boolean(bay.bookedLater)

/** Bays the Admin can act on in the simulation: parked vehicles (details), free bays and booked bays. */
export function canSimulateInBay(bay: Bay) {
  return bay.status === 'OCCUPIED' || bay.status === 'RESERVED' || bay.status === 'AVAILABLE'
}

/** What a click on a bay of the simulation's 3D model does, in a few words (shown on hover). */
export function simulationBayHint(bay: Bay) {
  if (bay.status === 'OCCUPIED') return 'Click for vehicle details'
  if (isBooked(bay)) return 'Click to park a walk-in here by mistake'
  return 'Click to park a walk-in here'
}
