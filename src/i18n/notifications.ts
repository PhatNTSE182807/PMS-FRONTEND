import { readLanguage } from './language'
import { t } from './index'

/**
 * Vietnamese text of the notifications. The backend stores each one as finished English sentences, so they are
 * matched here against its templates (`NotificationJobs`, `DutyScheduleService`, `LotPriceNotice`) and rebuilt. This
 * also covers notifications saved before the app had a Vietnamese version. Text that matches no template stays in
 * English: when a backend template changes, change its entry here.
 *
 * In a template `{name}` is a value up to the next fixed text and `{name...}` is the longest possible value. The name,
 * without trailing digits, picks how the value is converted (see CONVERT).
 */
type Template = readonly [en: string, vi: string]

/** Values the backend writes in English when the real one is missing. Bay ones follow the word "ô". */
const PHRASES: Record<string, string> = {
  'the parking lot': 'bãi xe',
  'a parking lot': 'một bãi xe',
  'your bay': 'của bạn',
  'a new bay': 'mới',
  'another bay': 'khác',
  'its bay': 'của xe',
  'you booked': 'bạn đã đặt',
  'a penalty bay': 'phạt',
  You: 'Bạn',
  you: 'bạn',
  'The system': 'Hệ thống',
  'A Staff member': 'Một nhân viên',
  'A Manager': 'Một quản lý',
  'A customer': 'Một khách hàng',
}

const phrase = (value: string) => PHRASES[value] ?? t(value)
const lowerFirst = (value: string) => value.charAt(0).toLocaleLowerCase('vi') + value.slice(1)
/** "30,000 VND" → "30.000 VND". */
const money = (value: string) => value.replace(/\d[\d,]*/g, (n) => n.replace(/,/g, '.'))

const duration = (value: string) => value.replace(/\bmin\b/g, 'phút').replace(/\bh\b/g, 'giờ')

const timeSpan = (value: string) =>
  value.replace(/^hour$/, 'giờ').replace(/^(\d+) hours$/, '$1 giờ').replace(/^(\d+) min$/, '$1 phút')

/** PricingRulePrices.Describe(): "20,000 VND for the first 2 hours, then 10,000 VND per hour, at most 100,000 VND a day". */
const prices = (value: string) =>
  money(value)
    .replace(/ for the first (hour|\d+ hours|\d+ min)/g, (_, span: string) => ` cho ${timeSpan(span)} đầu`)
    .replace(/ by day and /g, ' ban ngày và ')
    .replace(/ by night per /g, ' ban đêm per ')
    .replace(/\bper day\b/g, 'mỗi ngày')
    .replace(/\bper (hour|\d+ hours|\d+ min)/g, (_, span: string) => `mỗi ${timeSpan(span)}`)
    .replace(/, then /g, ', sau đó ')
    .replace(/ on entry, plus /g, ' khi vào, cộng ')
    .replace(/, at most (.+?) a day/g, ', tối đa $1 mỗi ngày')

/** Who was paid what: "50,000 VND compensation and the 30,000 VND deposit back". */
const payout = (value: string) =>
  money(value)
    .replace(/^(.+?) compensation and the (.+?) deposit(?: back)?$/, '$1 tiền bồi thường và $2 tiền cọc')
    .replace(/^the (.+?) deposit back \(no compensation is set in the price list\)$/, '$1 tiền cọc (bảng giá không có khoản bồi thường)')
    .replace(/^(.+?) compensation$/, '$1 tiền bồi thường')
    .replace(/^the (.+?) deposit(?: back)?$/, '$1 tiền cọc')

/** "Linh cancelled the booking at the entry lane". */
const action = (value: string) => {
  const m = /^(.*?) (cancelled the booking|let the customer park as a walk-in)( at the entry lane)?$/.exec(value)
  if (!m) return value
  const who = m[1] === 'The system' ? 'hệ thống' : phrase(m[1])
  const done = m[2] === 'cancelled the booking' ? 'đã hủy đặt chỗ' : 'đã cho khách đỗ như xe vãng lai'
  return `${who} ${done}${m[3] ? ' tại làn vào' : ''}`
}

/** "3 of 10 bays are taken (30 %), 7 free". */
const counts = (value: string) =>
  value.replace(/^(\d+) of (\d+) bays are taken \((.+?)\), (\d+) free$/, '$1/$2 ô đã có xe ($3), còn trống $4 ô')

/** What still ties an account to the system. */
const ties = (value: string) =>
  money(value)
    .replace(/(\d+) vehicles? still parked/g, '$1 xe còn trong bãi')
    .replace(/(\d+) upcoming bookings?/g, '$1 đặt chỗ sắp tới')
    .replace(/ VND left in the wallet/g, ' VND còn trong ví')

const CONVERT: Record<string, (value: string) => string> = {
  lot: phrase,
  bay: phrase,
  who: phrase,
  money,
  duration,
  prices,
  payout,
  action,
  counts,
  ties,
  type: (value) => lowerFirst(t(value)),
  status: (value) => lowerFirst(t(value)),
  vehicle: (value) => (value === 'your vehicle' ? 'xe của bạn' : `xe ${value}`),
  deposit: (value) => money(value).replace(/ deposit$/, ' tiền cọc'),
  occupant: (value) =>
    value === 'A walk-in parked in' ? 'Một xe vãng lai đang đỗ ở' : 'Một xe quá giờ đặt vẫn đang ở',
  // "Cong Hoa Parking Lot (Motorbike)"
  subject: (value) => {
    const m = /^(.*) \(([^()]+)\)$/.exec(value)
    return m ? `${lowerFirst(t(m[2]))} tại ${m[1]}` : value
  },
  // "Zone A at Cong Hoa Parking Lot"
  where: (value) => value.replace(/^(.+?) at (.+)$/, '$1 tại $2'),
}

const TITLES: readonly Template[] = [
  ['Vehicle registration approved', 'Đăng ký xe đã được duyệt'],
  ['Vehicle registration rejected', 'Đăng ký xe bị từ chối'],
  ['Checked in at {lot...}', 'Đã vào {lot...}'],
  ['Checked out of {lot...}', 'Đã ra khỏi {lot...}'],
  ['Parking Lot Price Update', 'Cập nhật giá bãi xe'],
  ['Price changed at {lot...}', 'Giá tại {lot...} đã thay đổi'],
  ['Your booked bay is taken', 'Ô bạn đặt đã có xe khác'],
  ['Your booking moved to another bay', 'Đặt chỗ của bạn đã chuyển sang ô khác'],
  ['Your booked bay is free again', 'Ô bạn đặt đã trống trở lại'],
  ['Your booking was cancelled by the lot', 'Bãi xe đã hủy đặt chỗ của bạn'],
  ['Deposit refunded to your XXIV wallet', 'Tiền cọc đã hoàn vào Ví XXIV'],
  ['Compensation paid to your XXIV wallet', 'Tiền bồi thường đã vào Ví XXIV'],
  ['Booked bay taken: tow the vehicle', 'Ô đã đặt bị chiếm: cần kéo xe'],
  ['You towed a vehicle out of a booked bay', 'Bạn đã kéo một xe ra khỏi ô đã đặt'],
  ['A vehicle was towed out of a booked bay', 'Một xe đã bị kéo ra khỏi ô đã đặt'],
  ['A booking moved to another bay', 'Một đặt chỗ đã chuyển sang ô khác'],
  ['A booking was moved to another bay', 'Một đặt chỗ đã được chuyển sang ô khác'],
  ['You sent compensation to the customer', 'Bạn đã gửi tiền bồi thường cho khách'],
  ['Compensation sent to a customer', 'Đã gửi tiền bồi thường cho khách'],
  ['Your vehicle was moved to a penalty bay', 'Xe của bạn đã được chuyển đến ô phạt'],
  ['Your vehicle was moved to another bay', 'Xe của bạn đã được chuyển sang ô khác'],
  ['A vehicle was towed for staying past its booking', 'Một xe đã bị kéo vì ở quá giờ đặt'],
  ['Your booked time ends soon', 'Sắp hết thời gian đã đặt'],
  ['Your booked time has ended', 'Đã hết thời gian đã đặt'],
  ['A booked vehicle stayed past its time', 'Một xe đã đặt chỗ ở quá giờ'],
  ['A vehicle stayed past its booking in a booked bay', 'Một xe quá giờ đặt đang ở ô đã được đặt'],
  ['A walk-in took a booked bay', 'Một xe vãng lai đã đỗ vào ô đã đặt'],
  ['A customer was compensated', 'Một khách hàng đã được bồi thường'],
  ['{who} moved a booking to another bay', '{who} đã chuyển một đặt chỗ sang ô khác'],
  ['{who} compensated a customer', '{who} đã bồi thường cho một khách hàng'],
  ['{who} handed in cash drawer {no}', '{who} đã nộp két tiền {no}'],
  ['{who} asked to delete their account', '{who} yêu cầu xóa tài khoản'],
  ['{who} changed the {type} price at {lot...}', '{who} đã đổi giá {type} tại {lot...}'],
  ['{type} price changed at {lot...}', 'Giá {type} tại {lot...} đã thay đổi'],
  ['{zone} is almost full', '{zone} sắp đầy'],
  ['{zone} is full', '{zone} đã đầy'],
  ['{zone} has free bays again', '{zone} đã có ô trống trở lại'],
  ['Shift removed', 'Đã gỡ ca làm'],
  ['New shift', 'Ca làm mới'],
  ['Leave request', 'Yêu cầu nghỉ phép'],
  ['Leave approved', 'Đã duyệt nghỉ phép'],
  ['Leave rejected', 'Đã từ chối nghỉ phép'],
  ['Marked absent', 'Đã ghi nhận vắng mặt'],
  ['Staff absent', 'Nhân viên vắng mặt'],
  ['Salary paid', 'Đã trả lương'],
  ['Payroll ready', 'Bảng lương đã sẵn sàng'],
]

/** One sentence (or a group that always comes together) each: a message is read as a run of these. */
const SENTENCES: readonly Template[] = [
  // Vehicle registration
  ['Staff approved the papers of {vehicle}. You can now book bays and it is recognised at the gates.', 'Nhân viên đã duyệt giấy tờ của {vehicle}. Bây giờ bạn có thể đặt chỗ và xe sẽ được nhận diện tại cổng.'],
  ['Staff rejected the papers of {vehicle}: "{note...}". The vehicle was removed from your account; register it again with new photos.', 'Nhân viên đã từ chối giấy tờ của {vehicle}: "{note...}". Xe đã được gỡ khỏi tài khoản của bạn, hãy đăng ký lại với ảnh mới.'],
  ['Staff rejected the papers of {vehicle}. The vehicle was removed from your account; register it again with new photos.', 'Nhân viên đã từ chối giấy tờ của {vehicle}. Xe đã được gỡ khỏi tài khoản của bạn, hãy đăng ký lại với ảnh mới.'],

  // Check-in and check-out
  ['Vehicle {plate} checked in at {time}. Ticket {code}.', 'Xe {plate} đã vào bãi lúc {time}. Vé {code}.'],
  ['Vehicle {plate} checked out at {time} after {duration}.', 'Xe {plate} đã ra bãi lúc {time}, sau {duration}.'],
  ['Fee: {money}.', 'Phí: {money}.'],
  ['The session was closed by the lot Manager: {note...}.', 'Lượt gửi đã được Quản lý bãi đóng: {note...}.'],
  ['The session was closed by the lot Manager.', 'Lượt gửi đã được Quản lý bãi đóng.'],

  // Prices
  ['The pricing rules for {lot...} have been updated. Please check your booking details.', 'Bảng giá của {lot...} đã được cập nhật. Vui lòng kiểm tra lại thông tin đặt chỗ.'],
  ['Price for {subject} changed from {prices} to {prices2}.', 'Giá {subject} đã đổi từ {prices} thành {prices2}.'],
  ['Price for {subject} is now {prices}.', 'Giá {subject} hiện là {prices}.'],
  ['Vehicles already parked keep the price they entered with.', 'Xe đang đỗ trong bãi vẫn giữ giá lúc vào.'],
  ['{who} changed the {type} price ({rule}) at {lot...} at {time} (the rule is {status}, so nobody pays it yet).', '{who} đã đổi giá {type} ({rule}) tại {lot...} lúc {time} (bảng giá đang ở trạng thái {status}, nên chưa áp dụng cho ai).'],
  ['{who} changed the {type} price ({rule}) at {lot...} at {time}.', '{who} đã đổi giá {type} ({rule}) tại {lot...} lúc {time}.'],
  ['Before: {prices}.', 'Trước đây: {prices}.'],
  ['Now: {prices}.', 'Hiện tại: {prices}.'],

  // A taken booked bay: customer
  ['Another vehicle parked in bay {bay} you booked at {lot} for {time}. Staff will move your booking to another bay and let you know.', 'Một xe khác đã đỗ vào ô {bay} bạn đặt tại {lot} cho lúc {time}. Nhân viên sẽ chuyển đặt chỗ của bạn sang ô khác và báo cho bạn.'],
  ['Your booking {code} at {lot} now has bay {bay} instead of {bay2}. The first hour is free.', 'Đặt chỗ {code} của bạn tại {lot} đã chuyển sang ô {bay} thay cho ô {bay2}. Bạn được miễn phí giờ đầu.'],
  ['The vehicle in bay {bay} at {lot} has left. Your booking {code} keeps that bay.', 'Xe ở ô {bay} tại {lot} đã rời đi. Đặt chỗ {code} của bạn vẫn giữ ô này.'],
  ['The lot towed the vehicle that was in bay {bay} at {lot}. Your booking {code} keeps that bay.', 'Bãi đã kéo xe đang ở ô {bay} tại {lot}. Đặt chỗ {code} của bạn vẫn giữ ô này.'],
  ['Bay {bay} you booked at {lot} was taken and no other bay of your vehicle type was free, so the lot cancelled booking {code}. Sorry for the trouble.', 'Ô {bay} bạn đặt tại {lot} đã có xe và không còn ô trống nào cho loại xe của bạn, nên bãi đã hủy đặt chỗ {code}. Rất xin lỗi vì sự bất tiện này.'],
  ['{money} deposit of booking {code} is back in your XXIV wallet.', '{money} tiền cọc của đặt chỗ {code} đã được hoàn vào Ví XXIV của bạn.'],
  ['{lot} paid you {money} because bay {bay} you booked was taken. It is in your XXIV wallet.', '{lot} đã trả bạn {money} vì ô {bay} bạn đặt đã bị chiếm. Số tiền đã vào Ví XXIV của bạn.'],

  // A taken booked bay: Staff and Manager
  ['{occupant} bay {bay} at {lot}, booked by booking {code} for {time}.', '{occupant} ô {bay} tại {lot}, thuộc đặt chỗ {code} lúc {time}.'],
  ['Tow it to a penalty bay in Exceptions & Alerts, move the booking to another free bay, or compensate the customer when nothing is left.', 'Hãy kéo xe đến ô phạt trong Ngoại lệ & Cảnh báo, chuyển đặt chỗ sang ô trống khác, hoặc bồi thường cho khách khi không còn ô nào.'],
  ['The vehicle in bay {bay} at {lot} was towed to bay {bay2}; it owes a {money} penalty at check-out. Booking {code} keeps bay {bay3}.', 'Xe ở ô {bay} tại {lot} đã bị kéo đến ô {bay2} và phải trả {money} tiền phạt khi ra bãi. Đặt chỗ {code} vẫn giữ ô {bay3}.'],
  ['Booking {code} at {lot} now has bay {bay} instead of {bay2}. The customer was told; the first hour is free.', 'Đặt chỗ {code} tại {lot} đã chuyển sang ô {bay} thay cho ô {bay2}. Khách đã được báo và được miễn phí giờ đầu.'],
  ['You sent {payout} to the XXIV wallet of the customer of booking {code}, because bay {bay} at {lot} was taken. The customer was told.', 'Bạn đã gửi {payout} vào Ví XXIV của khách có đặt chỗ {code}, vì ô {bay} tại {lot} đã bị chiếm. Khách đã được báo.'],
  ['The lot sent {payout} to the XXIV wallet of the customer of booking {code}, because bay {bay} at {lot} was taken. The customer was told.', 'Bãi đã gửi {payout} vào Ví XXIV của khách có đặt chỗ {code}, vì ô {bay} tại {lot} đã bị chiếm. Khách đã được báo.'],
  ['Your vehicle stayed past its booking in bay {bay} at {lot}, which another customer booked, so the lot moved it to bay {bay2}. A {money} penalty is added to your fee at check-out.', 'Xe của bạn ở quá giờ đặt tại ô {bay} của {lot}, ô này đã có khách khác đặt, nên bãi đã chuyển xe đến ô {bay2}. Khoản phạt {money} sẽ được cộng vào phí khi ra bãi.'],
  // The longer ones first: {lot} is a free value and would otherwise swallow ", which another customer booked"
  ['Your vehicle stayed past its booking in bay {bay} at {lot}, which another customer booked, so the lot moved it to bay {bay2}.', 'Xe của bạn ở quá giờ đặt tại ô {bay} của {lot}, ô này đã có khách khác đặt, nên bãi đã chuyển xe đến ô {bay2}.'],
  ['Your vehicle was parked in bay {bay} at {lot}, which another customer booked, so the lot moved it to bay {bay2}.', 'Xe của bạn đỗ tại ô {bay} của {lot}, ô này đã có khách khác đặt, nên bãi đã chuyển xe đến ô {bay2}.'],
  ['Your vehicle stayed past its booking in bay {bay} at {lot}, so the lot moved it to bay {bay2}.', 'Xe của bạn ở quá giờ đặt tại ô {bay} của {lot}, nên bãi đã chuyển xe đến ô {bay2}.'],
  ['A {money} penalty is added to your fee at check-out.', 'Khoản phạt {money} sẽ được cộng vào phí khi ra bãi.'],
  ['The vehicle of booking {code} stayed past its departure time in bay {bay} at {lot} and was towed to bay {bay2}; it owes a {money} penalty at check-out.', 'Xe của đặt chỗ {code} ở quá giờ rời bãi tại ô {bay} của {lot} và đã bị kéo đến ô {bay2}, phải trả {money} tiền phạt khi ra bãi.'],
  ['The system recorded this tow: please move the vehicle to that bay.', 'Hệ thống đã ghi nhận lượt kéo này, vui lòng chuyển xe đến ô đó.'],
  ['Staff must move the booking to another free bay, or compensate the customer when none is left.', 'Nhân viên cần chuyển đặt chỗ sang ô trống khác, hoặc bồi thường cho khách khi không còn ô nào.'],
  ['You will be told how it was handled.', 'Bạn sẽ được báo khi việc này được xử lý.'],
  ['{who} moved the booking from bay {bay} to bay {bay2} at the entry lane at {time}.', '{who} đã chuyển đặt chỗ từ ô {bay} sang ô {bay2} tại làn vào lúc {time}.'],
  ['{who} moved the booking from bay {bay} to bay {bay2} at {time}.', '{who} đã chuyển đặt chỗ từ ô {bay} sang ô {bay2} lúc {time}.'],
  ['The customer was told and gets the first hour free.', 'Khách đã được báo và được miễn phí giờ đầu.'],
  ["No other bay of that vehicle type was free, so {action...} at {time} and sent {payout...} ({money} in all) to the customer's XXIV wallet.", 'Không còn ô trống nào cho loại xe đó, nên {action...} lúc {time} và đã gửi {payout...} (tổng cộng {money}) vào Ví XXIV của khách.'],
  ['No other bay of that vehicle type was free, so {action...} at {time}. No money was due: no deposit was paid and no compensation is set in the price list.', 'Không còn ô trống nào cho loại xe đó, nên {action...} lúc {time}. Không phát sinh khoản tiền nào vì khách chưa đặt cọc và bảng giá không có khoản bồi thường.'],

  // Booked time
  ['Your booking {code} at {lot} ends at {time}. Please drive out by then: another driver may have booked the bay after you.', 'Đặt chỗ {code} của bạn tại {lot} kết thúc lúc {time}. Vui lòng lái xe ra trước giờ đó vì có thể đã có người đặt ô này sau bạn.'],
  ['If you are still inside after {time}, you lose your {deposit} and pay the whole parking fee.', 'Nếu xe vẫn trong bãi sau {time}, bạn sẽ mất {deposit} và phải trả toàn bộ phí gửi xe.'],
  ["If you stay longer, you pay the extra time by the lot's price list.", 'Nếu ở lâu hơn, bạn sẽ trả thêm theo bảng giá của bãi.'],
  ['Your booking {code} at {lot} ended at {time}, and your vehicle is still in bay {bay}.', 'Đặt chỗ {code} của bạn tại {lot} đã kết thúc lúc {time} nhưng xe vẫn đang ở ô {bay}.'],
  ['Because you stayed past it, your {deposit} is kept by the lot and you pay the whole parking fee.', 'Vì ở quá giờ, bãi sẽ giữ {deposit} của bạn và bạn phải trả toàn bộ phí gửi xe.'],
  ["The fee keeps running by the lot's price list.", 'Phí vẫn tiếp tục tính theo bảng giá của bãi.'],
  ['Please drive out as soon as you can.', 'Vui lòng lái xe ra sớm nhất có thể.'],
  ['Bay {bay} at {lot} is out of service, so your booking {code} for {time} now has bay {bay2} of the same type. Nothing else changes.', 'Ô {bay} tại {lot} đang ngừng sử dụng, nên đặt chỗ {code} lúc {time} của bạn đã chuyển sang ô {bay2} cùng loại. Các thông tin khác không đổi.'],
  ['The vehicle of booking {code} is still in bay {bay} at {lot}; its booked time ended at {time}. If the next booking of this bay arrives while it is still there, a booked bay case opens in Exceptions & Alerts to move that booking or compensate the customer.', 'Xe của đặt chỗ {code} vẫn đang ở ô {bay} tại {lot}, thời gian đặt đã hết lúc {time}. Nếu đặt chỗ tiếp theo của ô này đến khi xe vẫn còn đó, một trường hợp ô đã đặt sẽ được mở trong Ngoại lệ & Cảnh báo để chuyển đặt chỗ hoặc bồi thường cho khách.'],

  // Cash drawer
  ['{who} handed in cash drawer {no} at {lot...} at {time} with {money} (float {money2}). Confirm it in the Approval Queue.', '{who} đã nộp két tiền {no} tại {lot...} lúc {time} với {money} (tiền đầu ca {money2}). Hãy xác nhận trong Hàng chờ duyệt.'],

  // How full a zone is
  ['{where} has no free bay left ({counts}). Walk-ins are turned away at the entry lane; booked and whitelisted vehicles still get in.', '{where} đã hết ô trống ({counts}). Xe vãng lai sẽ bị từ chối tại làn vào, xe đã đặt chỗ và xe trong danh sách trắng vẫn được vào.'],
  ['{where} is filling up: {counts}. Customers see the lot as almost full.', '{where} sắp đầy: {counts}. Khách hàng sẽ thấy bãi ở trạng thái sắp đầy.'],
  ['{where} is no longer full: {counts}. Walk-ins can park again.', '{where} không còn đầy: {counts}. Xe vãng lai có thể gửi lại.'],

  // Account deletion
  ['{who} asked for their account to be deleted.', '{who} đã yêu cầu xóa tài khoản.'],
  ['Reason: "{note...}".', 'Lý do: "{note...}".'],
  ['Nothing is open on the account.', 'Tài khoản không còn giao dịch nào đang mở.'],
  ['Still open: {ties}.', 'Còn đang mở: {ties}.'],
  ['Lock the account from User Accounts once it can be closed.', 'Hãy khóa tài khoản trong Danh bạ & tài khoản người dùng khi có thể đóng.'],

  // Duty and payroll
  ['You are no longer on the {when} shift and the same shift every week after.', 'Bạn không còn làm ca {when} và cùng ca này ở các tuần sau.'],
  ['You are no longer on the {when} shift.', 'Bạn không còn làm ca {when}.'],
  ['You are on the {when} shift and the same shift every week after.', 'Bạn được xếp ca {when} và cùng ca này ở các tuần sau.'],
  ['You are on the {when} shift.', 'Bạn được xếp ca {when}.'],
  ['You cover {name}: {shifts}.', 'Bạn làm thay {name}: {shifts}.'],
  ['{name} asked for leave {range}.', '{name} đã xin nghỉ {range}.'],
  ['Your leave {range} is approved.', 'Đơn nghỉ {range} của bạn đã được duyệt.'],
  ['Your leave {range} was rejected: {note...}', 'Đơn nghỉ {range} của bạn đã bị từ chối: {note...}'],
  ['You did not come to your {when} shift.', 'Bạn đã không đến làm ca {when}.'],
  ['{name} did not come to the {when} shift.', '{name} đã không đến làm ca {when}.'],
  ['Your salary for {month} is paid: {money}.', 'Lương tháng {month} của bạn đã được trả: {money}.'],
  ['Payroll for {month} is ready: {count} people, {money}.', 'Bảng lương tháng {month} đã sẵn sàng: {count} người, {money}.'],
]

interface Rule {
  pattern: RegExp
  vi: string
}

const PLACEHOLDER = /\{(\w+)(\.\.\.)?\}/g
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function compile([en, vi]: Template, end: string): Rule {
  let source = '^'
  let last = 0
  for (const match of en.matchAll(PLACEHOLDER)) {
    source += escapeRegExp(en.slice(last, match.index))
    source += `(?<${match[1]}>.${match[2] ? '+' : '+?'})`
    last = match.index + match[0].length
  }
  return { pattern: new RegExp(source + escapeRegExp(en.slice(last)) + end, 's'), vi }
}

const fill = (rule: Rule, groups: Record<string, string> = {}) =>
  rule.vi.replace(PLACEHOLDER, (_, name: string) => {
    const convert = CONVERT[name.replace(/\d+$/, '')]
    return convert ? convert(groups[name]) : groups[name]
  })

const titleRules = TITLES.map((template) => compile(template, '$'))
const sentenceRules = SENTENCES.map((template) => compile(template, '(?:\\s+|$)'))

function translateTitle(text: string): string | null {
  for (const rule of titleRules) {
    const match = rule.pattern.exec(text)
    if (match) return fill(rule, match.groups)
  }
  return null
}

/** Reads the message sentence by sentence; if any part is unknown the whole message stays in English. */
function translateMessage(text: string): string | null {
  const parts: string[] = []
  let rest = text.trim()
  while (rest) {
    let consumed = 0
    for (const rule of sentenceRules) {
      const match = rule.pattern.exec(rest)
      if (!match) continue
      parts.push(fill(rule, match.groups))
      consumed = match[0].length
      break
    }
    if (consumed === 0) return null
    rest = rest.slice(consumed)
  }
  return parts.join(' ')
}

/** The title or message of a notification in the current language. */
export function tNotification(text: string): string {
  if (!text || readLanguage() !== 'vi') return text
  const known = t(text)
  if (known !== text) return known
  // Messages first: a title template with a free value could otherwise swallow a whole message. Titles have no full stop.
  return translateMessage(text) ?? (text.endsWith('.') ? null : translateTitle(text)) ?? text
}
