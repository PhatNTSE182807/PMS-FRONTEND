SRS v1.3 – Hệ thống Quản lý Nhiều Bãi Đỗ Xe
Oct 11, 2026 · @f
1. Giới thiệu
SRS v1.3 mô tả hệ thống quản lý nhiều bãi đỗ xe với 5 actor (Admin, Manager, Staff, User, Guest), bỏ phần quản lý ca và bổ sung các quy tắc còn thiếu ở v1.2: trạng thái slot real-time, đặt chỗ, thanh toán trước khi ra, chế độ offline và ủy quyền tạo tài khoản.
1.1 Mục đích
Tự động hóa chuỗi vận hành: xe vào/ra, tính phí, quản lý chỗ đỗ, đặt chỗ, thanh toán, báo cáo; đồng thời cung cấp sơ đồ bãi 3D được render hoàn toàn ở Frontend.
1.2 Phạm vi hệ thống
Web Admin / Dashboard: dành cho Admin và Manager (quản trị, cấu hình, báo cáo, Layout Editor 3D).
App / POS Staff: dành cho Staff tại cổng/quầy (xử lý xe, thu tiền, sự cố).
App / Web Khách hàng: dành cho User và Guest (xem bãi, xem slot trên 3D, đặt chỗ, thanh toán).
Thiết bị ngoại vi: camera ANPR, barie, đầu đọc thẻ/QR, máy in vé, bảng LED, giao tiếp qua IoT Edge Service.
Các hạng mục ngoài phạm vi nằm ở mục 2.5.
1.3 Thuật ngữ và viết tắt
Thuật ngữ
 | Ý nghĩa

ANPR / LPR
 | Nhận diện biển số tự động

Parking Lot / Zone / Slot
 | Bãi xe / Khu vực (tầng, dãy) / Vị trí chỗ đỗ cụ thể

Session
 | Một lượt gửi xe, từ lúc vào đến lúc ra

Reservation
 | Đặt chỗ trước, gắn với một slot và một khung giờ

Zone Counter
 | Bộ đếm số chỗ trống theo zone, dùng cho xe vãng lai không gán slot

Exit Window
 | Khoảng thời gian cho phép ra sau khi đã thanh toán

Maker-Checker
 | Nguyên tắc người đề xuất và người duyệt phải là hai người khác nhau

Edge Service
 | Dịch vụ chạy tại cổng, nhận diện thời gian thực và hoạt động khi mất mạng

3D Renderer
 | Thành phần Frontend dựng mô hình 3D bằng WebGL (Three.js hoặc Babylon.js)

Layout 3D
 | Dữ liệu bố cục bãi (tầng, zone, vị trí và hướng slot, model GLB) do Backend lưu và cung cấp

GLB / glTF
 | Định dạng mô hình 3D nạp vào Renderer

2. Mô tả tổng quan
Hệ thống gồm một Backend API tập trung, IoT Edge Service tại từng cổng và các Frontend (Web Admin, POS Staff, App/Web khách hàng). Phần 3D render hoàn toàn ở Frontend; Backend chỉ cung cấp Layout 3D và trạng thái slot qua REST và WebSocket.
2.1 Danh sách Actor
#
 | Actor
 | Có tài khoản
 | Vai trò

A1
 | Admin
 | Có (nội bộ)
 | Quản trị hệ thống: tài khoản Manager, bãi xe, phân quyền (RBAC), cấu hình chung, thiết bị, Payment Gateway, Audit Log, sao lưu. Không tham gia vận hành hằng ngày.

A2
 | Manager
 | Có (nội bộ)
 | Vận hành bãi được giao: zone, slot, bảng giá, tạo và quản lý Staff, duyệt mất vé và hoàn tiền, đối soát, báo cáo, Layout Editor 3D.

A3
 | Staff
 | Có (nội bộ)
 | Trực cổng/quầy: xử lý xe thủ công khi thiết bị lỗi, xác minh cảnh báo Blacklist, mất vé, thu tiền, ghi nhận sự cố.

A4
 | User
 | Có (công khai)
 | Khách có tài khoản: quản lý xe, đặt chỗ trên 3D, thanh toán, xem lịch sử.

A5
 | Guest
 | Không
 | Khách vãng lai: xem bãi, giá, slot; gửi xe bằng vé QR/thẻ; thanh toán tại quầy hoặc QR động.

Guest không phải một role trong cơ sở dữ liệu. Hệ thống chỉ có 4 role: Admin, Manager, Staff, User.
2.2 Hệ thống và giao diện bên ngoài
#
 | Tên
 | Loại
 | Mô tả

E1
 | Payment Gateway
 | Hệ thống ngoài
 | VNPay, MoMo, VietQR, thẻ; trả kết quả qua callback/webhook.

E2
 | 3D Renderer
 | Giao diện Frontend
 | Engine WebGL trên trình duyệt/mobile, nhận Layout 3D và trạng thái slot để dựng và cập nhật mô hình.

E3
 | Thiết bị IoT
 | Hệ thống ngoài
 | Camera ANPR, barie, đầu đọc thẻ/QR, máy in vé, bảng LED.

E4
 | Notification Service
 | Hệ thống ngoài
 | Gửi OTP, biên lai, cảnh báo qua Push/SMS/Email.

2.3 Nguyên tắc thiết kế (mới ở v1.3)
Slot theo hai chế độ: xe đặt chỗ được theo dõi theo slot cụ thể; xe vãng lai chỉ được tính vào Zone Counter, không gán slot. Sơ đồ 3D hiển thị slot đã giữ/đang đỗ của xe đặt chỗ và màu theo mức lấp đầy của zone.
Slot là dữ liệu nghiệp vụ gốc. Layout 3D chỉ lưu phần hiển thị (tọa độ, hướng, tầng, model) và có phiên bản Nháp / Đã công bố.
Thanh toán trước khi ra có Exit Window (mặc định 15 phút, cấu hình được); quá hạn thì tính thêm phí phát sinh.
Maker-Checker cho hoàn tiền, miễn phí thủ công và duyệt mất vé: người đề xuất khác người duyệt; quyền được tách nhỏ trong RBAC chứ không thêm actor.
Ủy quyền tạo tài khoản: Admin tạo Manager; Manager tạo Staff trong bãi mình phụ trách. Không có đăng ký công khai cho nhân sự.
Offline tại cổng là yêu cầu bắt buộc (khớp NFR-04), không phải tùy chọn.
Quyền riêng tư trên 3D: kênh real-time công khai chỉ đẩy trạng thái slot và số chỗ trống theo zone, không đẩy biển số.
2.4 Thay đổi so với v1.2
Mục
 | Thay đổi

Quản lý ca
 | Bỏ FR-OPS-06, UC-06, "phân lịch ca" trong FR-SYS-01, thực thể Shift, "chênh lệch tiền ca" trong FR-RPT-03 và dòng ca trong ma trận

Slot real-time
 | Thêm mô hình hai chế độ (Zone Counter và slot đặt chỗ); sửa FR-LOT-03, FR-3D-02

Offline
 | Nâng FR-OPS-09 từ C lên M (bản cơ bản), thống nhất với NFR-04

Tạo tài khoản
 | Thêm FR-AUTH-07, FR-AUTH-08; sửa FR-AUTH-03, FR-AUTH-04

Đặt chỗ
 | Thêm chính sách giữ chỗ, tiền cọc, no-show (FR-RSV-02, FR-RSV-05, FR-RSV-06)

Thanh toán
 | Thêm Exit Window (FR-PAY-07); làm rõ biên lai cho Guest là tùy chọn (FR-PAY-06)

Phân quyền
 | Maker-Checker (FR-PAY-04, FR-OPS-05); ma trận quyền được cập nhật

3D
 | Layout có phiên bản Nháp/Đã công bố (FR-3D-05); làm rõ quyền riêng tư (FR-3D-08)

Ghi chú
 | Sửa "5 vai trò" thành 4 role trong DB; thống nhất cách dùng "multi-tenancy theo bãi"

2.5 Ngoài phạm vi phiên bản này
Vé tháng / thành viên (gói tuần, tháng, quý, năm, vé doanh nghiệp).
Tích hợp Hóa đơn điện tử; hệ thống chỉ phát hành biên lai thanh toán.
Ví nội bộ, Auto-Pay, tích điểm, đánh giá và khiếu nại.
Quản lý Tenant đa chủ bãi, Public Open API, chia doanh thu cho đối tác.
Quản lý ca làm việc (bàn giao, kiểm đếm, phân lịch).
Cảm biến/camera theo dõi từng slot cho xe vãng lai.
Phân tích dự báo bằng AI, bản đồ dẫn đường ngoài (Google Maps, Mapbox).
3. Yêu cầu chức năng
Có 61 yêu cầu chức năng chia theo 10 module. Mức ưu tiên: M = Must, S = Should, C = Could. Mã FR giữ ổn định so với v1.2; FR-OPS-06 (quản lý ca) bị bỏ và không đánh số lại.
3.1 Tài khoản và phân quyền (FR-AUTH)
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-AUTH-01
 | Đăng ký / đăng nhập bằng SĐT/Email + OTP hoặc mật khẩu; tài khoản đăng ký công khai luôn có role User
 | User
 | M

FR-AUTH-02
 | Đăng nhập nội bộ cho nhân sự, hỗ trợ xác thực 2 yếu tố (2FA)
 | Admin, Manager, Staff
 | M

FR-AUTH-03
 | Phân quyền RBAC theo 4 role (Admin, Manager, Staff, User) kèm phạm vi bãi xe; quyền được tách nhỏ để thực hiện Maker-Checker
 | Admin
 | M

FR-AUTH-04
 | Admin tạo mọi tài khoản nội bộ (Manager, Staff, Admin), khóa, đặt lại mật khẩu, thu hồi phiên
 | Admin
 | M

FR-AUTH-05
 | Ghi Audit Log mọi thao tác tạo, sửa, khóa, đổi vai trò, duyệt, hoàn tiền, mở barie thủ công
 | Admin
 | M

FR-AUTH-06
 | Truy cập chức năng công khai (xem bãi, giá, slot) không cần đăng nhập
 | Guest
 | M

FR-AUTH-07
 | Manager tạo, khóa, đặt lại mật khẩu cho Staff, chỉ trong bãi mình phụ trách; không được cấp role cao hơn Staff. Backend kiểm tra role và phạm vi, không tin dữ liệu từ form
 | Manager
 | M

FR-AUTH-08
 | Tài khoản nội bộ kích hoạt bằng link hoặc mật khẩu tạm, bắt buộc đổi mật khẩu và bật 2FA ở lần đăng nhập đầu; nhân sự nghỉ việc thì khóa, không xóa để giữ liên kết với session và giao dịch cũ
 | Admin, Manager
 | M

3.2 Bãi, khu vực và slot (FR-LOT)
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-LOT-01
 | CRUD bãi xe: tên, địa chỉ, tọa độ GPS, giờ hoạt động, sức chứa, hình ảnh
 | Admin
 | M

FR-LOT-02
 | Thiết lập Zone/Tầng/Dãy và cấu hình slot theo loại xe
 | Manager
 | M

FR-LOT-03
 | Slot của xe đặt chỗ có 4 trạng thái: Trống, Giữ chỗ, Đang đỗ, Bảo trì. Xe vãng lai không gán slot, hệ thống cập nhật Zone Counter khi xe vào/ra
 | Manager, Staff, Hệ thống
 | M

FR-LOT-04
 | Bật/tắt hoạt động bãi, đóng tạm thời, thông báo bảo trì
 | Manager
 | S

FR-LOT-05
 | Xem danh sách bãi, giá và số chỗ trống theo thời gian thực
 | Guest, User
 | M

FR-LOT-06
 | Cấu hình số slot tối đa dành cho đặt chỗ trong mỗi zone, phần còn lại dành cho xe vãng lai
 | Manager
 | S

3.3 Trực quan hóa 3D (FR-3D)
3D Renderer (E2) chạy hoàn toàn trên Frontend (WebGL). Backend chỉ cung cấp Layout 3D và trạng thái qua REST/WebSocket.
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-3D-01
 | Hiển thị sơ đồ bãi 3D (tầng, zone, slot) trên web và mobile, dựng từ Layout 3D đã công bố
 | Tất cả actor
 | M

FR-3D-02
 | Tô màu slot theo trạng thái và tô màu zone theo mức lấp đầy; tự cập nhật qua WebSocket, không cần tải lại trang
 | Guest, User, Staff, Manager
 | M

FR-3D-03
 | Tương tác: xoay, zoom, pan, chuyển tầng; chạm/click slot hoặc zone để xem loại xe, trạng thái, giá
 | Guest, User, Staff, Manager
 | M

FR-3D-04
 | Chọn slot trống trên mô hình 3D để đặt chỗ
 | User
 | M

FR-3D-05
 | Layout Editor: đặt vị trí, hướng, loại slot, tầng; lưu bản Nháp, xem trước, rồi Công bố thì client mới nhận. Manager chỉ sửa bãi mình phụ trách. Layout không tạo hay xóa slot nghiệp vụ
 | Manager, Admin
 | S

FR-3D-06
 | Fallback sơ đồ 2D khi thiết bị không hỗ trợ WebGL hoặc hiệu năng thấp; có Level of Detail
 | Guest, User, Staff
 | S

FR-3D-07
 | Đánh dấu vị trí xe đang đỗ và gợi ý đường đi tới slot (chỉ với xe đặt chỗ)
 | User
 | C

FR-3D-08
 | Kênh dữ liệu 3D công khai chỉ gồm trạng thái slot và số chỗ trống theo zone, không chứa biển số; có giới hạn tần suất truy cập
 | Hệ thống
 | M

3.4 Xe vào/ra và vận hành cổng (FR-OPS)
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-OPS-01
 | Check-in: đọc biển số (ANPR hoặc nhập tay), chụp ảnh. Guest nhận vé QR/thẻ, User quét QR đặt chỗ để vào đúng slot đã giữ, rồi mở barie
 | Staff, Guest, User, E3
 | M

FR-OPS-02
 | Check-out: nhận diện biển số, kiểm tra đã thanh toán và còn trong Exit Window; nếu chưa thì tính phí và thanh toán; rồi mở barie
 | Staff, Guest, User, E3
 | M

FR-OPS-03
 | Check-in/out thủ công khi thiết bị sự cố, bắt buộc ghi lý do
 | Staff
 | M

FR-OPS-04
 | Đối chiếu ảnh và biển số vào – ra, chặn barie và cảnh báo khi sai lệch để Staff xác minh
 | Staff, E3
 | M

FR-OPS-05
 | Xử lý mất vé/mất thẻ: Staff xác minh chủ xe và tạo hồ sơ với phí phạt cấu hình; Manager duyệt (Maker-Checker) rồi mới cho xe ra
 | Staff, Manager
 | M

FR-OPS-07
 | Quản lý Blacklist/Whitelist biển số; cảnh báo Staff khi phát hiện xe Blacklist
 | Manager, Staff
 | S

FR-OPS-08
 | Ghi nhận và xử lý sự cố (xe hư hỏng, kẹt barie, đỗ quá hạn) kèm ảnh đính kèm
 | Staff, Manager
 | S

FR-OPS-09
 | Offline tại cổng: Edge Service lưu bản sao session đang mở, QR đặt chỗ, Blacklist và bảng giá; xếp hàng sự kiện và đồng bộ khi có mạng, mỗi sự kiện có khóa chống trùng. Khi offline chỉ thu tiền mặt
 | Staff, E3
 | M

3.5 Bảng giá và tính phí (FR-PRC)
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-PRC-01
 | Cấu hình bảng giá theo bãi / khu vực / loại phương tiện
 | Manager
 | M

FR-PRC-02
 | Mô hình tính phí: theo lượt, theo giờ, block thời gian, ngày/đêm, trần/ngày
 | Manager
 | M

FR-PRC-03
 | Thời gian miễn phí ban đầu, phụ phí qua đêm, phí quá Exit Window, phạt mất vé
 | Manager
 | M

FR-PRC-04
 | Lưu lịch sử thay đổi giá và ngày bắt đầu áp dụng
 | Manager
 | S

FR-PRC-05
 | Giá linh hoạt theo giờ cao điểm/ngày lễ (Dynamic Pricing) và mã giảm giá
 | Manager
 | C

3.6 Đặt chỗ trước (FR-RSV)
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-RSV-01
 | Tìm bãi, so sánh giá và chỗ trống; xem trước trên mô hình 3D
 | User, Guest (chỉ xem)
 | M

FR-RSV-02
 | Đặt giữ chỗ theo khung giờ, chọn slot trên 3D; slot ở trạng thái Giữ chỗ cho đến hết thời gian giữ (mặc định 15 phút sau giờ bắt đầu); đặt cọc qua E1, cọc thành công mới xác nhận
 | User, E1
 | M

FR-RSV-03
 | Đổi/hủy đặt chỗ; hoàn cọc theo chính sách
 | User, Manager
 | S

FR-RSV-04
 | Sinh mã QR đặt chỗ để check-in nhanh tại cổng
 | User, Staff
 | S

FR-RSV-05
 | tự hủy khi hết thời gian giữ: trả slot về Trống, trừ phí no-show từ tiền cọc
 | Hệ thống
 | S

FR-RSV-06
 | Cấu hình chính sách đặt chỗ: thời gian giữ, mức cọc, phí no-show, hạn hủy được hoàn cọc
 | Manager
 | M

3.7 Thanh toán và biên lai (FR-PAY)
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-PAY-01
 | Thu tiền mặt tại cổng/quầy
 | Staff, Guest
 | M

FR-PAY-02
 | Thanh toán online: VietQR động, ví điện tử, thẻ ngân hàng qua Payment Gateway
 | User, E1
 | M

FR-PAY-03
 | Thanh toán QR động tại quầy cho khách không có tài khoản
 | Guest, Staff, E1
 | M

FR-PAY-04
 | Hoàn tiền, điều chỉnh giao dịch, miễn phí thủ công: Staff hoặc Manager đề xuất, Manager khác duyệt (Maker-Checker); giao dịch tài chính không được sửa, chỉ tạo giao dịch điều chỉnh
 | Staff, Manager
 | M

FR-PAY-05
 | Đối soát hằng ngày với Payment Gateway, xử lý giao dịch sai lệch
 | Manager, E1
 | M

FR-PAY-06
 | Phát hành biên lai điện tử gửi qua E4 cho User; Guest có thể nhập SĐT/email để nhận, không bắt buộc
 | User, Guest, E4
 | S

FR-PAY-07
 | Exit Window: sau khi thanh toán, xe được ra trong N phút (mặc định 15); quá hạn thì tính thêm phần phát sinh. Khi thanh toán online, kết quả được đồng bộ xuống Edge Service để barie mở trong ≤ 3 giây
 | Hệ thống
 | M

3.8 Ứng dụng khách hàng (FR-CUS)
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-CUS-01
 | Quản lý hồ sơ cá nhân và danh sách phương tiện
 | User
 | M

FR-CUS-02
 | Tra cứu lịch sử gửi xe, ảnh vào/ra và chi tiết thanh toán
 | User
 | M

FR-CUS-03
 | Theo dõi xe đang đỗ: thời gian đã đỗ, phí tạm tính, thanh toán trước
 | User
 | S

3.9 Báo cáo (FR-RPT)
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-RPT-01
 | Dashboard tổng quan đa bãi: lượt xe, doanh thu, tỷ lệ lấp đầy
 | Admin, Manager
 | M

FR-RPT-02
 | Báo cáo doanh thu theo ngày/tuần/tháng, bãi, loại xe, phương thức thanh toán
 | Manager
 | M

FR-RPT-03
 | Báo cáo ngoại lệ: xe quá hạn, mở barie thủ công, hủy bill, miễn phí thủ công, lệch biển số
 | Manager
 | S

FR-RPT-04
 | Xuất báo cáo Excel/PDF
 | Manager
 | S

3.10 Nhân sự, thiết bị và cấu hình hệ thống (FR-SYS)
ID
 | Mô tả yêu cầu
 | Actor
 | Ưu tiên

FR-SYS-01
 | Quản lý nhân viên và gán bãi/cổng (không có phân lịch ca)
 | Manager
 | M

FR-SYS-02
 | Cấu hình tham số chung: tiền tệ, múi giờ, mẫu vé in, Exit Window, thời hạn lưu ảnh
 | Admin
 | M

FR-SYS-03
 | Quản lý danh mục thiết bị ngoại vi, giám sát Online/Offline và cảnh báo lỗi
 | Admin, Manager
 | M

FR-SYS-04
 | Quản lý cấu hình Payment Gateway, API Keys, Webhooks
 | Admin
 | M

FR-SYS-05
 | Sao lưu và khôi phục dữ liệu
 | Admin
 | M

FR-SYS-06
 | Gửi thông báo Push/SMS/Email: xác nhận đặt chỗ, biên lai, cảnh báo thiết bị/bãi đầy
 | Hệ thống, E4
 | S

4. Luồng nghiệp vụ
Mỗi actor có một luồng chính từ lúc bắt đầu đến lúc xong việc; ba máy trạng thái (slot, session, đặt chỗ) ở mục 4.2 là quy tắc chung mọi luồng phải tuân theo.
4.1 Luồng theo actor
Guest (không tài khoản)
Xem danh sách bãi, giá, số chỗ trống và mô hình 3D; không thấy biển số.
Đến cổng: ANPR đọc biển số, hệ thống kiểm tra Blacklist, tạo session, phát vé QR/thẻ, mở barie; Zone Counter của zone tương ứng giảm 1.
Khi ra: quét vé hoặc đọc biển số, màn hình hiện phí. Guest trả tiền mặt cho Staff hoặc quét QR động.
Thanh toán xong, Guest có Exit Window (mặc định 15 phút) để ra; ANPR khớp biển số thì barie mở, quá hạn thì tính thêm.
Mất vé: chuyển sang luồng xử lý mất vé của Staff.
User (có tài khoản)
Đăng ký/đăng nhập, thêm xe (biển số, loại xe).
Mở mô hình 3D, chọn slot trống và khung giờ; hệ thống chuyển slot sang Giữ chỗ và yêu cầu đặt cọc.
Thanh toán cọc qua Payment Gateway; callback thành công thì đặt chỗ được xác nhận và User nhận mã QR.
Đến cổng, quét QR, hệ thống đối chiếu biển số, check-in vào đúng slot đã giữ.
Trong lúc đỗ, xem thời gian và phí tạm tính, có thể trả trước qua app rồi ra trong Exit Window.
Đến muộn quá thời gian giữ thì đặt chỗ hết hạn, slot về Trống, phí no-show được trừ vào cọc. Hủy trước hạn thì hoàn cọc theo chính sách.
Staff
Tại cổng: thường chỉ giám sát; khi thiết bị lỗi thì check-in/out thủ công và bắt buộc ghi lý do.
Cảnh báo Blacklist hoặc lệch biển số: hệ thống chặn barie, Staff xác minh rồi quyết định cho qua hoặc từ chối; quyết định được ghi log.
Mất vé: tra biển số và ảnh, xác minh giấy tờ, tạo hồ sơ với phí phạt, gửi Manager duyệt, được duyệt thì thu tiền và cho xe ra.
Thu tiền mặt hoặc hiện QR động; hệ thống ghi nhận giao dịch.
Ghi nhận sự cố (xe hư hỏng, kẹt barie, đỗ quá hạn) kèm ảnh.
Đề xuất hoàn tiền hoặc miễn phí khi cần; Manager là người duyệt.
Manager
Thiết lập zone, slot, số slot dành cho đặt chỗ, bảng giá (có ngày hiệu lực) và chính sách đặt chỗ.
Tạo, khóa Staff trong bãi mình; gán cổng.
Duyệt mất vé, hoàn tiền, miễn phí thủ công theo Maker-Checker (không tự duyệt đề xuất của mình).
Đối soát hằng ngày với Payment Gateway, xử lý giao dịch lệch.
Xem dashboard, báo cáo doanh thu, báo cáo ngoại lệ; xuất Excel/PDF.
Dùng Layout Editor: lưu bản Nháp, xem trước, Công bố để đẩy xuống client.
Quản lý Blacklist/Whitelist, theo dõi trạng thái thiết bị của bãi.
Admin
Tạo bãi xe, tạo tài khoản Manager và gán phạm vi bãi; có thể tạo mọi tài khoản nội bộ.
Cấu hình hệ thống: tiền tệ, múi giờ, mẫu vé, Exit Window, thời hạn lưu ảnh, Payment Gateway, API key, webhook.
Quản lý thiết bị, theo dõi online/offline và cảnh báo lỗi.
Xem Audit Log, sao lưu và khôi phục dữ liệu.
4.2 Máy trạng thái
Slot, session và đặt chỗ mỗi thứ có một máy trạng thái; không được chuyển trạng thái ngoài các mũi tên dưới đây.

máy trạng thái · slot, session, đặt chỗ
Slot chỉ theo dõi xe đặt chỗ; session chỉ đóng khi xe ra, và đặt chỗ hết hạn thì slot trả về Trống.
5. Use case chính
Có 10 use case; UC-06 của v1.2 (kết ca) đã bỏ nên các UC sau được đánh số lại, và thêm UC-09, UC-10.
UC
 | Tên
 | Actor chính
 | Luồng thực thi chính

UC-01
 | Xe vào bãi
 | Staff, Guest, User, E3
 | Xe vào vùng cảm biến → ANPR đọc biển số → kiểm tra Blacklist và đặt chỗ → tạo Session (Guest nhận vé QR/thẻ; User vào đúng slot đã giữ) → cập nhật slot hoặc Zone Counter → mở barie.

UC-02
 | Xe ra bãi
 | Staff, Guest, User, E3
 | Quét vé/đọc biển số → đối chiếu ảnh vào/ra → kiểm tra Exit Window → nếu chưa thanh toán thì tính phí và thanh toán → mở barie → đóng Session và trả slot hoặc Zone Counter.

UC-03
 | Xem sơ đồ bãi 3D
 | Guest, User
 | Chọn bãi → Frontend tải Layout 3D đã công bố (GLB + JSON) → E2 dựng mô hình → nhận trạng thái qua WebSocket → xoay/zoom/chọn slot xem chi tiết.

UC-04
 | Đặt chỗ trước qua 3D
 | User, E1
 | Tìm bãi → chọn slot trống trên 3D và khung giờ → slot chuyển Giữ chỗ → đặt cọc qua E1 → nhận mã QR check-in; không cọc thành công trong hạn thì nhả slot.

UC-05
 | Xử lý mất vé
 | Staff, Manager
 | Nhận báo mất → tra biển số/ảnh → xác minh chủ xe → tính phí phạt → Manager duyệt → thu tiền → cho xe ra.

UC-06
 | Thiết lập bảng giá
 | Manager
 | Chọn bãi/khu vực → cấu hình quy tắc tính phí → đặt thời gian hiệu lực → lưu và kích hoạt, giá cũ được lưu lịch sử.

UC-07
 | Thiết kế Layout 3D
 | Manager, Admin
 | Mở Layout Editor → đặt tầng/zone/slot → lưu bản Nháp → xem trước → Công bố → client nhận Layout mới.

UC-08
 | Xem báo cáo chuỗi
 | Admin, Manager
 | Chọn khoảng thời gian và bộ lọc bãi → xem Dashboard → xuất Excel/PDF.

UC-09
 | Tạo tài khoản nhân sự
 | Admin, Manager
 | Nhập thông tin, chọn bãi/cổng (Manager chỉ tạo Staff trong bãi mình) → backend kiểm tra role và phạm vi → gửi link kích hoạt → nhân sự đổi mật khẩu và bật 2FA → ghi Audit Log.

UC-10
 | Hoàn tiền / miễn phí thủ công
 | Staff, Manager
 | Người đề xuất tạo phiếu kèm lý do → Manager khác duyệt → hệ thống tạo giao dịch điều chỉnh (không sửa giao dịch gốc) → hoàn qua E1 nếu là online → ghi Audit Log.

6. Yêu cầu phi chức năng
Mốc quan trọng nhất là một lượt xe vào/ra xử lý trong 3 giây kể cả khi thanh toán online, và cổng vẫn hoạt động khi mất mạng.
ID
 | Phân loại
 | Nội dung yêu cầu

NFR-01
 | Hiệu năng
 | Xử lý một lượt xe vào/ra (ANPR đến mở barie) ≤ 3 giây; với xe đã thanh toán online, thời gian tính từ lúc Edge Service nhận kết quả đồng bộ.

NFR-02
 | Hiệu năng
 | Dashboard báo cáo 12 tháng của 50 bãi tải ≤ 3 giây.

NFR-03
 | Mở rộng
 | Hỗ trợ tối thiểu 100 bãi, 10.000 lượt xe/ngày/bãi (mở rộng ngang).

NFR-04
 | Sẵn sàng
 | Uptime Cloud ≥ 99,5%; cổng vẫn vào/ra được khi mất mạng theo FR-OPS-09.

NFR-05
 | Bảo mật
 | TLS toàn bộ kết nối, băm mật khẩu, RBAC, 2FA cho nhân sự, tuân thủ OWASP Top 10.

NFR-06
 | Bảo mật
 | Không lưu thông tin thẻ ngân hàng; tuân thủ PCI-DSS thông qua Payment Gateway.

NFR-07
 | Quyền riêng tư
 | Lưu hình ảnh/biển số theo thời hạn cấu hình; tuân thủ Nghị định 13/2023/NĐ-CP; dữ liệu công khai không chứa biển số (FR-3D-08).

NFR-08
 | Toàn vẹn
 | Giao dịch tài chính bất biến, mọi chỉnh sửa có Audit Trail; điều chỉnh bằng giao dịch mới.

NFR-09
 | Sao lưu
 | RPO ≤ 15 phút, RTO ≤ 2 giờ.

NFR-10
 | Usability
 | POS Staff tối giản, tối đa 3 chạm cho một lượt check-in/out, tối ưu màn hình cảm ứng.

NFR-11
 | Tương thích
 | Chrome, Edge, Safari bản mới; Android 9+ và iOS 15+.

NFR-12
 | Tích hợp
 | Giao tiếp thiết bị qua REST API, MQTT, WebSockets, SDK nhà cung cấp.

NFR-13
 | Vận hành
 | Centralized Logging, Metrics real-time, CI/CD, tách môi trường Dev/Staging/Prod, tài liệu OpenAPI.

NFR-14
 | Nhất quán
 | Đồng bộ Edge Service dùng khóa chống trùng; hai cổng không thể cùng mở hai session đang hoạt động cho cùng một biển số trong một bãi.

NFR-3D-01
 | Hiệu năng 3D
 | Duy trì ≥ 30 FPS trên thiết bị tầm trung với bãi tối đa 500 slot; có Level of Detail và instancing cho slot.

NFR-3D-02
 | Hiệu năng 3D
 | Tải và hiển thị mô hình lần đầu ≤ 5 giây (mạng 4G); GLB ≤ 10 MB/bãi, nén Draco/KTX2, có cache.

NFR-3D-03
 | Real-time
 | Cập nhật trạng thái slot và Zone Counter lên mô hình 3D ≤ 2 giây kể từ khi thay đổi.

NFR-3D-04
 | Tương thích 3D
 | Yêu cầu WebGL 2; tự động fallback 2D nếu không hỗ trợ (FR-3D-06); hỗ trợ chuột, chạm và đa điểm.

7. Mô hình dữ liệu sơ bộ
Cơ sở dữ liệu dùng SQL Server và ASP.NET Identity có sẵn (dbo.Users, AspNetRoles, AspNetUserRoles, ...): các bảng mới tham chiếu tới dbo.Users, không tạo lại bảng Identity. Role trong Identity là toàn hệ thống, nên phạm vi bãi của Manager/Staff được lưu ở bảng UserParkingLot.
Nhóm
 | Thực thể
 | Ghi chú chính

Bãi
 | ParkingLot, Zone, Slot
 | Slot là dữ liệu nghiệp vụ gốc, có trạng thái Trống/Giữ chỗ/Đang đỗ/Bảo trì

Bãi
 | ZoneCounter
 | Số chỗ trống theo zone cho xe vãng lai; cập nhật khi xe vào/ra

3D
 | Layout3D, Slot3DMeta
 | Layout có phiên bản Nháp/Đã công bố; Slot3DMeta chỉ lưu tọa độ, hướng, tầng, model GLB và trỏ tới Slot

Thiết bị
 | Gate, Device
 | Device gắn Gate; lưu trạng thái online/offline và thời điểm heartbeat cuối

Người dùng
 | Users (Identity), UserParkingLot, Vehicle
 | Role: Admin, Manager, Staff, User; Guest không có bản ghi người dùng

Vận hành
 | ParkingSession, Ticket/Card, SessionImage
 | Session có trạng thái, thời điểm hết Exit Window, mốc ANPR, cờ lệch biển số

Vận hành
 | LostTicketCase, Incident, PlateList
 | PlateList gồm Blacklist và Whitelist

Đặt chỗ
 | Reservation, ReservationPolicy
 | Reservation gắn Slot, có thời gian giữ, tiền cọc, mã QR

Giá
 | PricingRule
 | Có ngày hiệu lực và lịch sử thay đổi

Tài chính
 | Payment, PaymentAdjustment, Receipt, Reconciliation
 | PaymentAdjustment lưu hoàn tiền/miễn phí/điều chỉnh kèm người đề xuất và người duyệt; Payment không được sửa

Hệ thống
 | Notification, AuditLog, SystemSetting
 | AuditLog không đặt khóa ngoại để tồn tại độc lập với dữ liệu gốc

Không có thực thể Shift.
8. Giao diện bên ngoài
8.1 Tổng quan
Phân loại
 | Chi tiết tích hợp

UI
 | Web Admin Dashboard (React/Vue/Angular); POS Staff (Android/Windows cảm ứng); App/Web khách hàng (Flutter/React Native hoặc web responsive). 3D Renderer nhúng trong các UI này.

Phần cứng
 | Camera ANPR/LPR, barie tự động, máy in vé nhiệt, đầu đọc RFID/QR, bảng LED.

Phần mềm
 | Payment Gateway (VNPay, MoMo, VietQR), SMS/Push/Email Gateway.

8.2 Giao diện 3D Renderer (E2)
Thành phần
 | Mô tả

Vị trí chạy
 | Frontend (trình duyệt/WebView mobile), WebGL 2 qua Three.js hoặc Babylon.js; không render phía server.

Tài nguyên
 | Mô hình GLB (khung bãi, slot, xe mẫu) trên Storage/CDN; Layout 3D dạng JSON.

API dữ liệu
 | GET /lots/{id}/layout3d trả Layout 3D đã công bố và URL tài nguyên. GET /lots/{id}/slots trả trạng thái slot và Zone Counter hiện tại.

Real-time
 | WebSocket/SSE kênh /lots/{id}/slots/stream đẩy sự kiện thay đổi; Renderer chỉ cập nhật phần thay đổi. Kênh công khai không chứa biển số và có giới hạn tần suất (FR-3D-08).

Sự kiện từ Renderer
 | onSlotSelect(slotId) để Frontend mở chi tiết/đặt chỗ. Layout Editor gọi PUT /lots/{id}/layout3d để lưu bản Nháp và POST /lots/{id}/layout3d/publish để công bố.

Phân quyền
 | Guest/User/Staff chỉ xem và chọn slot; Manager (bãi mình) và Admin được dùng Layout Editor.

8.3 Giao diện Edge Service (E3)
Thành phần
 | Mô tả

Vai trò
 | Chạy tại từng cổng; nhận sự kiện từ camera, đầu đọc, barie; quyết định mở barie cục bộ.

Dữ liệu lưu cục bộ
 | Session đang mở, QR đặt chỗ, Blacklist/Whitelist, bảng giá, kết quả thanh toán đã đồng bộ.

Đồng bộ
 | Xếp hàng sự kiện khi mất mạng; gửi lại với khóa chống trùng khi có mạng; xung đột được Backend giải quyết theo thời điểm sự kiện.

Giao thức
 | REST, MQTT, WebSocket hoặc SDK nhà cung cấp thiết bị (NFR-12).

9. Lộ trình triển khai
Ba giai đoạn, mỗi giai đoạn có điều kiện nghiệm thu trước khi sang giai đoạn sau. So với v1.2, bỏ phần quản lý ca, thêm sơ đồ 2D làm nền cho 3D ở Phase 1, và đẩy chế độ offline vào cùng đợt với Edge Service.
Phase 1 – MVP, vận hành ổn định 1–3 bãi
Quản lý bãi/zone/slot, Zone Counter; tài khoản Admin → Manager → Staff, RBAC, Audit Log.
Check-in/out thủ công trên POS + vé QR/thẻ; bảng giá cơ bản; thanh toán tiền mặt; xử lý mất vé có Maker-Checker.
Sơ đồ 2D và 3D chỉ đọc (FR-3D-01, 02, 03, 06); báo cáo doanh thu cơ bản.
Nghiệm thu: một bãi chạy trọn một ngày không lệch Zone Counter; tiền thu khớp báo cáo.
Phase 2 – Tự động hóa và đặt chỗ
Edge Service, ANPR, điều khiển barie tự động, chế độ offline (FR-OPS-09), Blacklist/Whitelist.
App/Web User: đăng ký, đặt chỗ chọn slot trên 3D (FR-3D-04), tiền cọc, QR check-in, lịch sử.
Thanh toán online, Exit Window, đối soát, biên lai, thông báo.
Nghiệm thu: xe vào/ra ≤ 3 giây, cổng chạy được khi rút mạng và đồng bộ đúng khi có lại.
Phase 3 – Tối ưu
Layout Editor 3D có bản Nháp/Công bố, tối ưu hiệu năng (LOD, nén tài nguyên).
Dynamic Pricing, mã giảm giá, đánh dấu vị trí xe và gợi ý đường đi (FR-3D-07).
Dashboard phân tích nâng cao cho Manager.
Nghiệm thu: bãi 500 slot đạt ≥ 30 FPS trên thiết bị tầm trung.
10. Ma trận phân quyền Actor – Module
● = thao tác đầy đủ · ○ = xem hoặc quyền giới hạn · trống = không có quyền. Manager và Staff chỉ thao tác trong bãi được gán; người đề xuất không được tự duyệt đề xuất của mình.
Module
 | Admin
 | Manager
 | Staff
 | User
 | Guest

Tài khoản & Phân quyền
 | ●
 | ○ (tạo/khóa Staff)
 |  | ● (hồ sơ mình)
 | 
Bãi xe / Khu vực / Slot
 | ●
 | ●
 | ○
 | ○
 | ○

Sơ đồ 3D
 | ● (Editor)
 | ● (Editor)
 | ○
 | ● (chọn slot)
 | ○

Xe vào / ra & Vận hành
 |  | ○
 | ●
 | ○
 | ●

Bảng giá & Tính phí
 | ○
 | ●
 | ○
 | ○
 | ○

Đặt chỗ trước
 |  | ● (chính sách)
 | ○ (xác thực QR)
 | ●
 | ○ (chỉ xem)

Thanh toán & Biên lai
 |  | ●
 | ●
 | ●
 | ●

Duyệt mất vé / hoàn tiền / miễn phí
 |  | ● (duyệt)
 | ○ (đề xuất)
 |  | 
Báo cáo & Phân tích
 | ○
 | ●
 |  |  | 
Nhân sự & Gán bãi/cổng
 | ●
 | ●
 | ○
 |  | 
Cấu hình & Thiết bị
 | ●
 | ○
 |  |  | 
11. Câu hỏi mở và nhật ký thay đổi
Còn 8 câu hỏi cần chốt trước khi thiết kế chi tiết; câu 1 chặn việc viết script database.
Cột Id của dbo.Users là kiểu gì (int, uniqueidentifier hay nvarchar(450))? Cần biết để tạo khóa ngoại.
Xác nhận mặc định Exit Window 15 phút và thời gian giữ chỗ 15 phút sau giờ bắt đầu.
Mức cọc đặt chỗ và phí no-show tính theo cách nào (số tiền cố định hay phần trăm giá giờ đầu)?
Zone đã hết chỗ cho xe vãng lai thì chặn tại cổng hay vẫn cho vào và cảnh báo Staff?
Ngưỡng độ tin cậy ANPR để bắt buộc Staff xác minh (gợi ý 85%).
Thời gian tối đa chấp nhận khi cổng offline, và khi offline có cho Guest thanh toán bằng gì ngoài tiền mặt.
Manager có thể phụ trách nhiều bãi không, và người đề xuất hoàn tiền là Manager thì ai duyệt khi bãi chỉ có một Manager?
Thời hạn lưu ảnh vào/ra theo quy định nội bộ và pháp lý (gợi ý 90 ngày).
Phiên bản
 | Ngày
 | Thay đổi

1.3
 | 2026-10-11
 | Bỏ quản lý ca; thêm mô hình slot hai chế độ, Exit Window, Maker-Checker, ủy quyền tạo tài khoản, chính sách đặt chỗ, Layout Nháp/Công bố; nâng offline lên Must; bổ sung luồng theo actor và UC-09, UC-10

1.2
 | 2026-10-07
 | Thu gọn còn 5 actor, thêm 3D Renderer phía Frontend

1.1
 | 2026-10-07
 | Bỏ chuyển ca và phân ca khỏi bản 1.0

1.0
 | 2026-10-07
 | Bản nháp đầu tiên, 13 actor