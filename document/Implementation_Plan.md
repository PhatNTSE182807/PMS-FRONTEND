Implementation Plan – Hệ thống Quản lý Nhiều Bãi Đỗ Xe
Oct 11, 2026 · @FrankyMilky
1. Tổng quan và giả định
Kế hoạch chia SRS v1.3 (61 FR, 10 module, 10 UC) thành 3 phase như mục 9 của SRS; Backend và Frontend chạy song song, chốt hợp đồng OpenAPI ở đầu mỗi phase để FE mock được trước khi BE xong.
Phase
 | Trọng tâm
 | Điều kiện nghiệm thu (theo SRS)

1 – MVP
 | Bãi/zone/slot, tài khoản + RBAC, check-in/out thủ công, giá cơ bản, tiền mặt, mất vé, 3D chỉ đọc + 2D, báo cáo doanh thu
 | 1 bãi chạy trọn 1 ngày không lệch Zone Counter; tiền thu khớp báo cáo

2 – Tự động hóa và đặt chỗ
 | Edge Service + ANPR + barie, offline, Blacklist, App User, đặt chỗ + cọc, thanh toán online, Exit Window, đối soát, thông báo
 | Vào/ra ≤ 3 giây; rút mạng vẫn chạy và đồng bộ đúng khi có lại

3 – Tối ưu
 | Layout Editor 3D, LOD/nén tài nguyên, Dynamic Pricing, gợi ý đường đi, dashboard nâng cao
 | Bãi 500 slot ≥ 30 FPS trên máy tầm trung

Giả định của kế hoạch này (cần xác nhận):
Edge Service/ANPR/barie là workstream riêng của đội tích hợp thiết bị; tài liệu này chỉ ghi phần BE và FE phụ thuộc vào nó.
Ước lượng tính bằng người-ngày (ng.ngày), mang tính xấp xỉ, chưa gồm kiểm thử tích hợp thiết bị thật; sprint 2 tuần.
Công nghệ lấy theo SRS mục 7–8: SQL Server + ASP.NET Identity; Web Admin dùng một trong React/Vue/Angular; app khách dùng Flutter/React Native hoặc web responsive.
2. Kiến trúc và công nghệ đề xuất
Một Backend API dạng modular monolith (mỗi module SRS là một bounded context), Edge Service tại từng cổng, và 3 ứng dụng Frontend dùng chung thư viện 3D Renderer và API client sinh từ OpenAPI. Monolith đủ cho NFR-03 (100 bãi, mở rộng ngang) và đỡ phức tạp hơn microservice ở giai đoạn đầu.
Lớp
 | Đề xuất
 | Căn cứ trong SRS

Backend API
 | ASP.NET Core + EF Core + ASP.NET Identity
 | Mục 7: đã có dbo.Users, AspNetRoles

Cơ sở dữ liệu
 | SQL Server
 | Mục 7

Real-time
 | SignalR (WebSocket, fallback SSE) cho /lots/{id}/slots/stream
 | Mục 8.2; NFR-3D-03 ≤ 2 giây

Cache, backplane
 | Redis: Zone Counter, rate limit kênh công khai, backplane SignalR
 | FR-3D-08; NFR-03

Thiết bị
 | MQTT broker + REST cho Edge Service
 | NFR-12; mục 8.3

Job nền
 | Hangfire hoặc Quartz: hết hạn giữ chỗ, đối soát, xóa ảnh quá hạn
 | FR-RSV-05; FR-PAY-05; NFR-07

Lưu trữ
 | Blob Storage + CDN cho GLB và ảnh vào/ra
 | Mục 8.2

Web Admin
 | React + TypeScript (một trong 3 lựa chọn của SRS)
 | Mục 8.1

POS Staff
 | Ứng dụng cảm ứng Android/Windows, tối đa 3 chạm
 | NFR-10

App/Web khách
 | React Native hoặc web responsive
 | Mục 8.1; NFR-11

3D Renderer
 | Three.js, instancing + LOD, GLB nén Draco/KTX2, fallback 2D
 | NFR-3D-01–04

Các module Backend: Auth, Parking (Lot/Zone/Slot/ZoneCounter), Layout3D, Operations (Session, Gate, PlateList, LostTicket, Incident), Pricing, Reservation, Payment (Payment, Adjustment, Receipt, Reconciliation), Customer, Reporting, System (Device, Setting, AuditLog, Notification) và EdgeSync.
Quy tắc kỹ thuật mọi module phải tuân theo:
Máy trạng thái slot, session, đặt chỗ (mục 4.2) được ép trong domain; không điều kiện chuyển trạng thái nằm ở controller hay FE.
Phạm vi bãi của Manager/Staff kiểm tra ở Backend qua UserParkingLot, không tin dữ liệu từ form (FR-AUTH-07).
Zone Counter cập nhật trong cùng giao dịch với Session; mọi sự kiện từ Edge mang khóa chống trùng (FR-OPS-09, NFR-14).
Payment bất biến; chỉnh sửa bằng PaymentAdjustment có người đề xuất ≠ người duyệt (NFR-08, Maker-Checker).
AuditLog không đặt khóa ngoại; kênh real-time công khai không bao giờ chứa biển số (FR-3D-08).
3. Kế hoạch Backend
Tổng ước lượng xấp xỉ khoảng 288 ng.ngày: Phase 1 ≈ 108, Phase 2 ≈ 134, Phase 3 ≈ 46. Phase 2 nặng nhất vì chứa Edge sync, thanh toán online và đặt chỗ.
Phase 1 – MVP (≈ 108 ng.ngày)
#
 | Hạng mục
 | FR / UC
 | ng.ngày

B1.1
 | Khung dự án, CI/CD, môi trường Dev/Staging/Prod, OpenAPI, centralized logging
 | NFR-13
 | 8

B1.2
 | Schema đợt 1 + migration: Lot, Zone, Slot, ZoneCounter, UserParkingLot, Vehicle, Session, Ticket, Payment, PricingRule, LostTicketCase, AuditLog, SystemSetting (chạy sau khi chốt câu hỏi 1: kiểu Id của dbo.Users)
 | Mục 7
 | 6

B1.3
 | Auth: đăng nhập nội bộ + 2FA, ủy quyền tạo tài khoản (Admin → Manager → Staff), kích hoạt bằng link, khóa thay vì xóa, RBAC theo phạm vi bãi, policy Maker-Checker, Audit Log
 | FR-AUTH-02–05, 07, 08; UC-09
 | 15

B1.4
 | Parking: CRUD bãi/zone/slot, 4 trạng thái slot, Zone Counter, số slot dành đặt chỗ, bật/tắt bãi
 | FR-LOT-01–04, 06
 | 10

B1.5
 | API công khai: danh sách bãi, giá, số chỗ trống, GET layout3d, GET slots; kênh SignalR slots/stream; rate limit, không trả biển số
 | FR-LOT-05; FR-AUTH-06; FR-3D-01, 02, 08; UC-03
 | 10

B1.6
 | Pricing engine: theo lượt/giờ/block/ngày–đêm/trần ngày, miễn phí ban đầu, qua đêm, ngày hiệu lực + lịch sử
 | FR-PRC-01–04; UC-06
 | 12

B1.7
 | Session: check-in/out thủ công (bắt buộc lý do), vé QR/thẻ, lưu ảnh, đối chiếu biển số, chặn 2 session hoạt động cùng biển số
 | FR-OPS-01–04; UC-01, 02; NFR-14
 | 15

B1.8
 | Thu tiền mặt, xử lý mất vé có Maker-Checker, PaymentAdjustment (hoàn/miễn phí), giao dịch bất biến
 | FR-PAY-01, 04; FR-OPS-05; UC-05, 10
 | 10

B1.9
 | Quản lý nhân viên, gán bãi/cổng; danh mục Gate/Device; tham số hệ thống
 | FR-SYS-01–03
 | 6

B1.10
 | Báo cáo: dashboard đa bãi, doanh thu theo ngày/tuần/tháng, bãi, loại xe, phương thức
 | FR-RPT-01, 02; UC-08
 | 8

B1.11
 | Kiểm thử: unit cho máy trạng thái, integration, test đồng thời Zone Counter
 | Mục 4.2
 | 8

Phase 2 – Tự động hóa và đặt chỗ (≈ 134 ng.ngày)
#
 | Hạng mục
 | FR / UC
 | ng.ngày

B2.1
 | EdgeSync: API snapshot (session mở, QR đặt chỗ, Blacklist, bảng giá), nhận hàng đợi sự kiện với khóa chống trùng, giải xung đột theo thời điểm sự kiện, MQTT
 | FR-OPS-09; NFR-14; mục 8.3
 | 20

B2.2
 | Luồng ANPR: nhận kết quả, ngưỡng tin cậy, chặn barie khi Blacklist/lệch biển số, quản lý PlateList
 | FR-OPS-01, 02, 04, 07
 | 12

B2.3
 | Reservation: giữ chỗ theo slot, ReservationPolicy, cọc, QR, đổi/hủy + hoàn cọc, job tự hủy và trừ phí no-show
 | FR-RSV-02–06; UC-04
 | 18

B2.4
 | Tích hợp VNPay, MoMo, VietQR: tạo thanh toán, webhook có xác thực chữ ký + idempotent, QR động cho Guest, cấu hình key/webhook
 | FR-PAY-02, 03; FR-SYS-04
 | 18

B2.5
 | Exit Window: thời hạn ra, phí phát sinh quá hạn, đồng bộ kết quả thanh toán xuống Edge để barie mở ≤ 3 giây
 | FR-PAY-07; FR-PRC-03; NFR-01
 | 8

B2.6
 | Đối soát hằng ngày với Payment Gateway, xử lý giao dịch lệch
 | FR-PAY-05
 | 8

B2.7
 | Customer API: đăng ký/đăng nhập OTP, hồ sơ, xe, lịch sử + ảnh vào/ra, theo dõi xe đang đỗ và trả trước
 | FR-AUTH-01; FR-CUS-01–03
 | 12

B2.8
 | Notification: OTP, biên lai (Guest tùy chọn), cảnh báo thiết bị/bãi đầy qua Push/SMS/Email
 | FR-PAY-06; FR-SYS-06
 | 8

B2.9
 | Sự cố, giám sát Online/Offline theo heartbeat, báo cáo ngoại lệ, xuất Excel/PDF
 | FR-OPS-08; FR-SYS-03; FR-RPT-03, 04
 | 12

B2.10
 | Sao lưu/khôi phục (RPO ≤ 15 phút, RTO ≤ 2 giờ), job xóa ảnh theo thời hạn lưu
 | FR-SYS-05; NFR-09; NFR-07
 | 6

B2.11
 | Hardening OWASP, load test 10.000 lượt/ngày/bãi, test rút mạng và đồng bộ lại
 | NFR-01, 03, 05
 | 12

Phase 3 – Tối ưu (≈ 46 ng.ngày)
#
 | Hạng mục
 | FR / UC
 | ng.ngày

B3.1
 | Layout3D phiên bản Nháp/Đã công bố: PUT lưu nháp, POST publish, Manager chỉ sửa bãi mình, không tạo/xóa slot nghiệp vụ
 | FR-3D-05; UC-07
 | 8

B3.2
 | Upload GLB lên Storage/CDN, cache và ETag cho Layout, giới hạn 10 MB/bãi
 | NFR-3D-02
 | 5

B3.3
 | Dynamic Pricing theo giờ cao điểm/ngày lễ và mã giảm giá
 | FR-PRC-05
 | 10

B3.4
 | API vị trí xe đang đỗ và dữ liệu gợi ý đường đi tới slot (chỉ xe đặt chỗ)
 | FR-3D-07
 | 5

B3.5
 | Analytics nâng cao: bảng tổng hợp để dashboard 12 tháng × 50 bãi ≤ 3 giây
 | NFR-02
 | 10

B3.6
 | Tối ưu index/truy vấn, đo tải 100 bãi
 | NFR-03
 | 8

4. Kế hoạch Frontend
Tổng ước lượng xấp xỉ 293 ng.ngày: Phase 1 ≈ 124, Phase 2 ≈ 108, Phase 3 ≈ 61. Ba ứng dụng là Web Admin (Admin, Manager), POS Staff (Staff, cảm ứng) và App/Web khách (User, Guest); 3D Renderer là thư viện dùng chung, phát triển từ Phase 1 vì cả ba ứng dụng nhúng nó (mục 8.1).
FE không tự quyết định nghiệp vụ: ẩn/hiện nút theo role chỉ để đỡ nhầm, Backend luôn kiểm tra lại quyền và phạm vi bãi.
Phase 1 – MVP (≈ 124 ng.ngày)
#
 | Hạng mục
 | Ứng dụng
 | FR / UC
 | ng.ngày

F1.1
 | Monorepo, design system, API client sinh từ OpenAPI, mock server, route guard theo role
 | Chung
 | NFR-13
 | 8

F1.2
 | Đăng nhập nội bộ + 2FA, kích hoạt bằng link, đổi mật khẩu lần đầu
 | Web Admin, POS
 | FR-AUTH-02, 08
 | 6

F1.3
 | Quản lý tài khoản/nhân viên, gán bãi/cổng, khóa/đặt lại mật khẩu, xem Audit Log
 | Web Admin
 | FR-AUTH-04, 05, 07; FR-SYS-01; UC-09
 | 10

F1.4
 | CRUD bãi, zone, slot; bật/tắt bãi; cấu hình số slot dành đặt chỗ
 | Web Admin
 | FR-LOT-01–04, 06
 | 10

F1.5
 | Thiết lập bảng giá: quy tắc, ngày hiệu lực, lịch sử thay đổi
 | Web Admin
 | FR-PRC-01–04; UC-06
 | 8

F1.6
 | Tham số hệ thống và danh mục thiết bị
 | Web Admin
 | FR-SYS-02, 03
 | 5

F1.7
 | Check-in/out thủ công ≤ 3 chạm, nhập lý do, in vé, chụp ảnh, thu tiền mặt
 | POS Staff
 | FR-OPS-01–03; FR-PAY-01; NFR-10
 | 15

F1.8
 | Hồ sơ mất vé (Staff tạo, Manager duyệt), đề xuất hoàn tiền/miễn phí, hộp duyệt Maker-Checker
 | POS, Web Admin
 | FR-OPS-05; FR-PAY-04; UC-05, 10
 | 10

F1.9
 | 3D Renderer lõi: nạp GLB + Layout JSON, instancing, tô màu slot/zone, xoay/zoom/pan, chuyển tầng, chạm slot → onSlotSelect, cập nhật WebSocket theo delta
 | Thư viện
 | FR-3D-01–03; NFR-3D-03; UC-03
 | 20

F1.10
 | Sơ đồ 2D fallback, phát hiện WebGL 2, Level of Detail cơ bản
 | Thư viện
 | FR-3D-06; NFR-3D-04
 | 8

F1.11
 | Trang công khai cho Guest: danh sách bãi, giá, số chỗ trống, xem 3D (không thấy biển số)
 | App/Web khách
 | FR-LOT-05; FR-AUTH-06
 | 8

F1.12
 | Dashboard đa bãi, báo cáo doanh thu với bộ lọc
 | Web Admin
 | FR-RPT-01, 02; UC-08
 | 10

F1.13
 | Test E2E luồng chính, đo số chạm trên POS
 | Tất cả
 | NFR-10
 | 6

Phase 2 – Tự động hóa và đặt chỗ (≈ 108 ng.ngày)
#
 | Hạng mục
 | Ứng dụng
 | FR / UC
 | ng.ngày

F2.1
 | Màn hình giám sát cổng real-time: cảnh báo Blacklist/lệch biển số để xác minh, trạng thái thiết bị, chế độ offline (chỉ thu tiền mặt)
 | POS Staff
 | FR-OPS-04, 07, 09
 | 15

F2.2
 | Hiện QR động thanh toán, quét QR đặt chỗ
 | POS Staff
 | FR-PAY-03; FR-RSV-04
 | 8

F2.3
 | Đăng ký/đăng nhập OTP, hồ sơ, danh sách xe
 | App/Web khách
 | FR-AUTH-01; FR-CUS-01
 | 10

F2.4
 | Tìm bãi, so sánh giá, chọn slot trống trên 3D + khung giờ, đặt cọc, nhận QR, đổi/hủy
 | App/Web khách
 | FR-RSV-01–04; FR-3D-04; UC-04
 | 20

F2.5
 | Thanh toán online, theo dõi xe đang đỗ (thời gian, phí tạm tính), trả trước, đếm ngược Exit Window, biên lai
 | App/Web khách
 | FR-PAY-02, 06, 07; FR-CUS-03
 | 12

F2.6
 | Lịch sử gửi xe, ảnh vào/ra, chi tiết thanh toán
 | App/Web khách
 | FR-CUS-02
 | 6

F2.7
 | Quản lý Blacklist/Whitelist, chính sách đặt chỗ, cấu hình Payment Gateway/API key/webhook, đối soát, xử lý sự cố
 | Web Admin
 | FR-OPS-07, 08; FR-RSV-06; FR-SYS-04; FR-PAY-05
 | 15

F2.8
 | Báo cáo ngoại lệ, xuất Excel/PDF, giám sát thiết bị Online/Offline
 | Web Admin
 | FR-RPT-03, 04; FR-SYS-03
 | 8

F2.9
 | Nhận Push trong app (xác nhận đặt chỗ, cảnh báo)
 | App/Web khách
 | FR-SYS-06
 | 4

F2.10
 | Test E2E, tương thích Chrome/Edge/Safari, Android 9+, iOS 15+
 | Tất cả
 | NFR-11
 | 10

Phase 3 – Tối ưu (≈ 61 ng.ngày)
#
 | Hạng mục
 | Ứng dụng
 | FR / UC
 | ng.ngày

F3.1
 | Layout Editor 3D: đặt tầng/zone/slot, hướng, loại slot; lưu Nháp, xem trước, Công bố; Manager chỉ sửa bãi mình
 | Web Admin
 | FR-3D-05; UC-07
 | 25

F3.2
 | Tối ưu 3D: LOD, instancing, Draco/KTX2, cache; ≥ 30 FPS với 500 slot, tải lần đầu ≤ 5 giây
 | Thư viện
 | NFR-3D-01, 02
 | 12

F3.3
 | Đánh dấu vị trí xe đang đỗ và gợi ý đường đi tới slot
 | App/Web khách
 | FR-3D-07
 | 8

F3.4
 | Giao diện Dynamic Pricing và mã giảm giá
 | Web Admin, App khách
 | FR-PRC-05
 | 6

F3.5
 | Dashboard phân tích nâng cao cho Manager
 | Web Admin
 | NFR-02
 | 10

5. Roadmap và phụ thuộc BE–FE

roadmap · 3 phase, 3 mốc nghiệm thu, không theo tỷ lệ thời gian
Mỗi phase chỉ sang phase sau khi qua mốc nghiệm thu của SRS; ngày tháng cụ thể chưa đặt vì phụ thuộc quy mô đội. Các điều kiện sau phải chốt trước để BE và FE không chờ nhau:
Điều kiện chặn
 | Chặn hạng mục
 | Chốt khi nào

Kiểu Id của dbo.Users (câu hỏi mở 1)
 | B1.2, rồi mọi module BE
 | Đầu Phase 1

OpenAPI v1 cho Auth, Parking, Session, Payment tiền mặt
 | F1.2–F1.8 (FE dùng mock server tới khi BE xong)
 | Đầu Phase 1

API layout3d, slots, slots/stream + 1 bộ GLB mẫu
 | F1.9, F1.11
 | Trước khi FE bắt đầu 3D Renderer

Hợp đồng Edge Service: schema sự kiện, khóa chống trùng, topic MQTT
 | B2.1, B2.2, F2.1
 | Đầu Phase 2

Sandbox Payment Gateway và quy định cọc/no-show (câu hỏi mở 3)
 | B2.3, B2.4, F2.4, F2.5
 | Đầu Phase 2

API Layout3D nháp/công bố
 | F3.1
 | Đầu Phase 3

6. Kiểm thử, triển khai, rủi ro và câu hỏi mở
Rủi ro lớn nhất là đồng bộ Edge khi mất mạng và hiệu năng 3D trên máy tầm trung; cả hai nên được đo sớm chứ không đợi đến cuối phase.
Kiểm thử và triển khai
Backend: unit test cho 3 máy trạng thái; integration test cho Maker-Checker, phạm vi bãi, webhook trùng lặp; test đồng thời cho Zone Counter và “1 biển số = 1 session hoạt động” (NFR-14).
Frontend: E2E cho luồng chính của từng actor; đo FPS và thời gian tải 3D trên thiết bị thật (NFR-3D-01, 02); kiểm thử fallback 2D khi tắt WebGL.
Tích hợp: kịch bản rút mạng tại cổng, webhook trễ/trùng, barie mở ≤ 3 giây sau khi thanh toán online (NFR-01).
Triển khai: CI/CD tách Dev/Staging/Prod, migration có rollback, OpenAPI là hợp đồng bắt buộc giữa BE và FE (NFR-13); pilot 1 bãi trước khi mở rộng.
Rủi ro
Rủi ro
 | Ảnh hưởng
 | Giảm thiểu

Edge sync sai thứ tự hoặc trùng sự kiện
 | Lệch Zone Counter, 2 session cùng biển số
 | Khóa chống trùng bắt buộc, giải xung đột theo thời điểm sự kiện, test rút mạng từ Phase 2 sớm

3D không đạt 30 FPS với 500 slot
 | Trải nghiệm kém trên mobile
 | Instancing + LOD ngay từ F1.9, đo sớm, có fallback 2D

Webhook thanh toán trễ hoặc lặp
 | Barie không mở ≤ 3 giây, thu tiền trùng
 | Xử lý idempotent, đồng bộ kết quả xuống Edge, đối soát hằng ngày

Thiết bị ANPR/barie giao chậm hoặc SDK khác nhau
 | Trễ nghiệm thu Phase 2
 | Lớp trừu tượng thiết bị trong Edge, chốt danh sách thiết bị sớm

Quy tắc nghiệp vụ chưa chốt (câu hỏi mở)
 | Làm lại API và màn hình liên quan
 | Chốt trước đầu phase tương ứng (bảng dưới)

Câu hỏi mở từ SRS mục 11 và tác động tới kế hoạch
#
 | Câu hỏi
 | Ảnh hưởng tới

1
 | Kiểu Id của dbo.Users (int, uniqueidentifier, nvarchar(450))?
 | Chặn B1.2 và toàn bộ script database

2
 | Xác nhận Exit Window 15 phút và thời gian giữ chỗ 15 phút
 | B2.3, B2.5

3
 | Mức cọc và phí no-show: số tiền cố định hay % giá giờ đầu
 | B2.3, F2.4, F2.7

4
 | Zone hết chỗ cho xe vãng lai: chặn tại cổng hay vẫn cho vào và cảnh báo
 | B1.7, B2.2, F2.1

5
 | Ngưỡng tin cậy ANPR bắt buộc Staff xác minh (gợi ý 85%)
 | B2.2, F2.1

6
 | Thời gian offline tối đa; Guest trả bằng gì ngoài tiền mặt
 | B2.1, F2.1

7
 | Manager phụ trách nhiều bãi không; bãi chỉ có 1 Manager thì ai duyệt hoàn tiền
 | B1.3, B1.8, F1.8

8
 | Thời hạn lưu ảnh vào/ra (gợi ý 90 ngày)
 | B2.10