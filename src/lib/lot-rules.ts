import type {
  LotInput,
  ManagedLot,
  ManagedZone,
  SlotInput,
  ZoneInput,
} from '@/types/lot-management.dto'
const check = (ok: boolean, message: string) => {
  if (!ok) throw new Error(message)
}
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0
export const protectedSlot = (zone: ManagedZone) =>
  zone.slots.some((s) => s.status === 'Occupied' || s.status === 'Reserved')
export function validateLot(
  input: LotInput,
  lots: ManagedLot[],
  current?: ManagedLot,
) {
  check(
    input.code.trim().length > 0 && input.code.length <= 30,
    'Mã bãi bắt buộc, tối đa 30 ký tự.',
  )
  check(
    input.name.trim().length > 0 && input.name.length <= 200,
    'Tên bãi bắt buộc, tối đa 200 ký tự.',
  )
  check(
    input.address.trim().length > 0 && input.address.length <= 500,
    'Địa chỉ bắt buộc, tối đa 500 ký tự.',
  )
  check(
    !lots.some(
      (l) =>
        l.id !== current?.id &&
        l.code.toLowerCase() === input.code.trim().toLowerCase(),
    ),
    'Mã bãi đã tồn tại.',
  )
  check(
    integer(input.capacity) && input.capacity > 0,
    'Sức chứa phải là số nguyên dương.',
  )
  check(
    input.capacity >= (current?.zones.reduce((n, z) => n + z.capacity, 0) ?? 0),
    'Sức chứa bãi không được nhỏ hơn tổng sức chứa zone.',
  )
  check(
    input.latitude === null ||
      (Number.isFinite(input.latitude) && Math.abs(input.latitude) <= 90),
    'Vĩ độ phải từ -90 đến 90.',
  )
  check(
    input.longitude === null ||
      (Number.isFinite(input.longitude) && Math.abs(input.longitude) <= 180),
    'Kinh độ phải từ -180 đến 180.',
  )
  check(
    (input.latitude === null) === (input.longitude === null),
    'Nhập đủ cả vĩ độ và kinh độ hoặc để trống cả hai.',
  )
  check(
    input.is24Hours ||
      (/^\d{2}:\d{2}$/.test(input.openTime) &&
        /^\d{2}:\d{2}$/.test(input.closeTime) &&
        input.openTime !== input.closeTime),
    'Nhập giờ mở/đóng khác nhau hoặc chọn hoạt động 24 giờ.',
  )
  if (input.imageUrl) {
    try {
      const u = new URL(input.imageUrl)
      check(
        ['http:', 'https:'].includes(u.protocol),
        'Ảnh phải là URL HTTP/HTTPS.',
      )
    } catch {
      throw new Error('Ảnh phải là URL HTTP/HTTPS hợp lệ.')
    }
  }
}
export function validateZone(
  input: ZoneInput,
  lot: ManagedLot,
  current?: ManagedZone,
) {
  check(
    input.code.trim().length > 0 &&
      input.code.length <= 30 &&
      input.name.trim().length > 0 &&
      input.name.length <= 200,
    'Nhập mã zone (≤30) và tên zone (≤200).',
  )
  check(
    !lot.zones.some(
      (z) =>
        z.id !== current?.id &&
        z.code.toLowerCase() === input.code.trim().toLowerCase(),
    ),
    'Mã zone đã tồn tại trong bãi.',
  )
  check(
    integer(input.capacity) && input.capacity > 0,
    'Sức chứa zone phải là số nguyên dương.',
  )
  check(
    input.capacity +
      lot.zones
        .filter((z) => z.id !== current?.id)
        .reduce((n, z) => n + z.capacity, 0) <=
      lot.capacity,
    'Tổng sức chứa zone vượt sức chứa bãi.',
  )
  check(
    Object.values(input.vehicleCapacities).every(integer) &&
      Object.values(input.vehicleCapacities).reduce((a, b) => a + b, 0) ===
        input.capacity,
    'Tổng sức chứa theo loại xe phải bằng sức chứa zone.',
  )
  check(
    (current?.slots ?? []).every(
      (s) =>
        (current?.slots.filter((x) => x.vehicleTypeId === s.vehicleTypeId)
          .length ?? 0) <= (input.vehicleCapacities[s.vehicleTypeId] ?? 0),
    ),
    'Sức chứa loại xe không được nhỏ hơn số slot đã tạo.',
  )
  check(
    integer(input.reservationLimit) && input.reservationLimit <= input.capacity,
    'Hạn mức đặt chỗ phải từ 0 đến sức chứa zone.',
  )
  check(
    (current?.slots.length ?? 0) <= input.reservationLimit,
    'Hạn mức không được nhỏ hơn số slot đặt chỗ đã cấu hình.',
  )
  check(
    input.zoneType !== 'Floor' ||
      (input.floorNo !== null && Number.isSafeInteger(input.floorNo)),
    'Zone loại tầng cần số tầng nguyên (âm cho tầng hầm).',
  )
  check(
    input.isActive || !current || !protectedSlot(current),
    'Không tắt zone có slot đang giữ hoặc đang đỗ.',
  )
}
export function validateSlot(
  input: SlotInput,
  zone: ManagedZone,
  currentId?: string,
) {
  check(
    input.code.trim().length > 0 && input.code.length <= 30,
    'Mã slot bắt buộc, tối đa 30 ký tự.',
  )
  check(
    !zone.slots.some(
      (s) =>
        s.id !== currentId &&
        s.code.toLowerCase() === input.code.trim().toLowerCase(),
    ),
    'Mã slot đã tồn tại trong zone.',
  )
  check(
    Boolean(currentId) || zone.slots.length < zone.reservationLimit,
    'Đã đạt hạn mức slot đặt chỗ của zone.',
  )
  const sameTypeCount = zone.slots.filter(
    (s) => s.id !== currentId && s.vehicleTypeId === input.vehicleTypeId,
  ).length
  check(
    sameTypeCount < (zone.vehicleCapacities[input.vehicleTypeId] ?? 0),
    'Đã đạt sức chứa của loại xe này trong zone.',
  )
  const current = zone.slots.find((s) => s.id === currentId)
  check(
    !current || !['Reserved', 'Occupied'].includes(current.status),
    'Slot đang giữ/đang đỗ không được sửa bằng màn cấu hình.',
  )
  check(
    ['Available', 'Maintenance'].includes(input.status),
    'Màn cấu hình chỉ chuyển Trống ↔ Bảo trì; giữ chỗ/đang đỗ do luồng vận hành xử lý.',
  )
}
