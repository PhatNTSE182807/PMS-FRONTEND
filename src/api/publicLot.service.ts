import { isMockService, SERVICE_PATHS } from '@/config/env'
import { capacityMock } from '@/mocks/capacity.mock'
import type { PublicLotDTO } from '@/types/publicLot.dto'
import type { ParkingLotCapacityDTO } from '@/types/parking.dto'
import { http } from './axiosClient'

/** Mock mode: the public view of the demo capacity data. */
function fromCapacity(lot: ParkingLotCapacityDTO): PublicLotDTO {
  const bookable = lot.status === 'OPEN' || lot.status === 'FULL'
  const baysByVehicle = lot.capacityByVehicle.map((d) => ({
    vehicleType: d.vehicleType,
    totalBays: d.totalSlots,
    freeBays: d.availableSlots,
  }))
  return {
    id: Number(lot.id.replace(/\D/g, '')) || 0,
    code: lot.code,
    name: lot.name,
    address: lot.address,
    city: null,
    district: null,
    layoutTemplate: lot.layoutTemplate ?? null,
    status: bookable ? 'Active' : 'Maintenance',
    isBookable: bookable,
    maintenanceNotice: bookable ? null : 'This lot is under maintenance and cannot take bookings right now.',
    totalBays: baysByVehicle.reduce((sum, b) => sum + b.totalBays, 0),
    freeBays: baysByVehicle.reduce((sum, b) => sum + b.freeBays, 0),
    baysByVehicle,
  }
}

/** Public parking lots with live free bays, for anonymous visitors (homepage). */
export const publicLotService = {
  /** GET /public/lots: every open or maintenance lot, with free and total bays per vehicle family. */
  async list(): Promise<PublicLotDTO[]> {
    if (isMockService('parking')) return (await capacityMock.getCapacityOverview()).map(fromCapacity)
    return http.get<PublicLotDTO[]>(`${SERVICE_PATHS.parking}/public/lots`)
  },
}
