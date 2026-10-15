import type { ParkingLotSummaryDTO } from '@/types/parking.dto'

/** Mock-only sizing data, shared by the capacity and revenue mocks so they stay consistent. */
export interface MockParkingLot extends ParkingLotSummaryDTO {
  carSlots: number
  motorbikeSlots: number
  evChargers: number
  /** Average check-ins per day, used to derive revenue and hourly flow. */
  dailyMotorbikes: number
  dailyCars: number
  dailyBicycles: number
  monthlySubscribers: number
  /** Average walk-in fee per visit (VND). */
  carFee: number
  motorbikeFee: number
  /** Traffic multiplier on Saturdays and Sundays. */
  weekendFactor: number
  /** Share of revenue per payment method: [cash, QR, RFID wallet]. */
  paymentMix: [number, number, number]
  /** Car and motorbike parking zones (EV chargers are tracked per lot). */
  zones: string[]
}

export const MOCK_PARKING_LOTS: MockParkingLot[] = [
  {
    id: 'lot-01',
    code: 'HCM-Q1-VCDK',
    name: 'Vincom Dong Khoi Parking',
    address: '72 Le Thanh Ton, Ben Nghe Ward, District 1, HCMC',
    carSlots: 180,
    motorbikeSlots: 900,
    evChargers: 12,
    dailyMotorbikes: 2100,
    dailyCars: 420,
    dailyBicycles: 40,
    monthlySubscribers: 520,
    carFee: 40000,
    motorbikeFee: 6000,
    weekendFactor: 1.25,
    paymentMix: [0.22, 0.48, 0.3],
    zones: ['Basement B1 - Zone A', 'Basement B1 - Zone B', 'Basement B2 - Cars', 'Basement B3 - Cars'],
  },
  {
    id: 'lot-02',
    code: 'HCM-BT-LM81',
    name: 'Landmark 81 Parking',
    address: '720A Dien Bien Phu, Ward 22, Binh Thanh District, HCMC',
    carSlots: 420,
    motorbikeSlots: 1500,
    evChargers: 24,
    dailyMotorbikes: 3200,
    dailyCars: 880,
    dailyBicycles: 60,
    monthlySubscribers: 1100,
    carFee: 45000,
    motorbikeFee: 6000,
    weekendFactor: 1.3,
    paymentMix: [0.15, 0.5, 0.35],
    zones: ['Basement B1 - Motorbikes', 'Basement B2 - Motorbikes', 'Basement B3 - Cars', 'Basement B4 - Cars'],
  },
  {
    id: 'lot-03',
    code: 'HCM-TB-TSN',
    name: 'Tan Son Nhat Airport (P1) Parking',
    address: 'Truong Son Street, Ward 2, Tan Binh District, HCMC',
    carSlots: 650,
    motorbikeSlots: 1200,
    evChargers: 16,
    dailyMotorbikes: 2600,
    dailyCars: 1500,
    dailyBicycles: 10,
    monthlySubscribers: 300,
    carFee: 60000,
    motorbikeFee: 8000,
    weekendFactor: 1.1,
    paymentMix: [0.3, 0.42, 0.28],
    zones: ['Zone A - Cars', 'Zone B - Cars', 'Zone C - Motorbikes', 'Zone D - Motorbikes'],
  },
  {
    id: 'lot-04',
    code: 'HCM-Q5-CRAY',
    name: 'Cho Ray Hospital Parking',
    address: '201B Nguyen Chi Thanh, Ward 12, District 5, HCMC',
    carSlots: 120,
    motorbikeSlots: 1800,
    evChargers: 0,
    dailyMotorbikes: 4100,
    dailyCars: 260,
    dailyBicycles: 120,
    monthlySubscribers: 640,
    carFee: 30000,
    motorbikeFee: 5000,
    weekendFactor: 0.8,
    paymentMix: [0.55, 0.3, 0.15],
    zones: ['Zone A - Main gate', 'Zone B - Staff shed', 'Zone C - Cars'],
  },
  {
    id: 'lot-05',
    code: 'HCM-Q7-CRMA',
    name: 'Crescent Mall Parking',
    address: '101 Ton Dat Tien, Tan Phu Ward, District 7, HCMC',
    carSlots: 300,
    motorbikeSlots: 1100,
    evChargers: 10,
    dailyMotorbikes: 1900,
    dailyCars: 540,
    dailyBicycles: 30,
    monthlySubscribers: 380,
    carFee: 35000,
    motorbikeFee: 5000,
    weekendFactor: 1.35,
    paymentMix: [0.2, 0.46, 0.34],
    zones: ['Basement B1 - Motorbikes', 'Basement B2 - Cars', 'Outdoor - Cars'],
  },
  {
    id: 'lot-06',
    code: 'HCM-TD-FPTU',
    name: 'FPT University Parking',
    address: 'Lot E2a-7, D1 Street, Saigon Hi-Tech Park, Thu Duc City, HCMC',
    carSlots: 80,
    motorbikeSlots: 2400,
    evChargers: 6,
    dailyMotorbikes: 3600,
    dailyCars: 140,
    dailyBicycles: 260,
    monthlySubscribers: 1800,
    carFee: 20000,
    motorbikeFee: 4000,
    weekendFactor: 0.45,
    paymentMix: [0.18, 0.37, 0.45],
    zones: ['Shed A - Students', 'Shed B - Students', 'Shed C - Lecturers', 'Car park'],
  },
]

export const findMockLot = (id: string) => MOCK_PARKING_LOTS.find((lot) => lot.id === id)

export const toLotSummary = ({ id, code, name, address }: MockParkingLot): ParkingLotSummaryDTO => ({
  id,
  code,
  name,
  address,
})
