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
    name: 'Bãi xe Vincom Đồng Khởi',
    address: '72 Lê Thánh Tôn, Phường Bến Nghé, Quận 1, TP.HCM',
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
    zones: ['Tầng hầm B1 - Khu A', 'Tầng hầm B1 - Khu B', 'Tầng hầm B2 - Ô tô', 'Tầng hầm B3 - Ô tô'],
  },
  {
    id: 'lot-02',
    code: 'HCM-BT-LM81',
    name: 'Bãi xe Landmark 81',
    address: '720A Điện Biên Phủ, Phường 22, Quận Bình Thạnh, TP.HCM',
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
    zones: ['Tầng hầm B1 - Xe máy', 'Tầng hầm B2 - Xe máy', 'Tầng hầm B3 - Ô tô', 'Tầng hầm B4 - Ô tô'],
  },
  {
    id: 'lot-03',
    code: 'HCM-TB-TSN',
    name: 'Bãi xe Sân bay Tân Sơn Nhất (P1)',
    address: 'Đường Trường Sơn, Phường 2, Quận Tân Bình, TP.HCM',
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
    zones: ['Khu A - Ô tô', 'Khu B - Ô tô', 'Khu C - Xe máy', 'Khu D - Xe máy'],
  },
  {
    id: 'lot-04',
    code: 'HCM-Q5-CRAY',
    name: 'Bãi xe Bệnh viện Chợ Rẫy',
    address: '201B Nguyễn Chí Thanh, Phường 12, Quận 5, TP.HCM',
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
    zones: ['Khu A - Cổng chính', 'Khu B - Nhà xe nhân viên', 'Khu C - Ô tô'],
  },
  {
    id: 'lot-05',
    code: 'HCM-Q7-CRMA',
    name: 'Bãi xe Crescent Mall',
    address: '101 Tôn Dật Tiên, Phường Tân Phú, Quận 7, TP.HCM',
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
    zones: ['Tầng hầm B1 - Xe máy', 'Tầng hầm B2 - Ô tô', 'Bãi ngoài trời - Ô tô'],
  },
  {
    id: 'lot-06',
    code: 'HCM-TD-FPTU',
    name: 'Bãi xe Đại học FPT',
    address: 'Lô E2a-7, Đường D1, Khu Công nghệ cao, TP. Thủ Đức, TP.HCM',
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
    zones: ['Nhà xe A - Sinh viên', 'Nhà xe B - Sinh viên', 'Nhà xe C - Giảng viên', 'Bãi ô tô'],
  },
]

export const findMockLot = (id: string) => MOCK_PARKING_LOTS.find((lot) => lot.id === id)

export const toLotSummary = ({ id, code, name, address }: MockParkingLot): ParkingLotSummaryDTO => ({
  id,
  code,
  name,
  address,
})
