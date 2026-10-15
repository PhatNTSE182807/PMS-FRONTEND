# Quản lý bãi xe — bản FE để review

## Cơ sở và phạm vi
Đối chiếu SRS v1.3 (FR-LOT-01–04,06; mục 2.3; luồng Admin/Manager) và Implementation Plan F1.4/B1.4, cùng pms_extension(2).sql.
- Admin: danh sách/chi tiết, tạo/sửa bãi, gán Manager có sẵn. Tên, mã, địa chỉ, GPS, giờ hoạt động, sức chứa, ảnh URL và mô tả.
- Manager: chỉ thấy bãi mà managerUserId khớp tài khoản; cấu hình zone tầng/dãy/khu vực, sức chứa theo loại xe, hạn mức đặt trước; CRUD slot đặt trước; trạng thái bãi và thông báo bảo trì.
- Staff/User không truy cập các route quản lý. Các route nhân sự/doanh thu/công suất hiện có vẫn giữ quyền ADMIN.
- Admin chỉ xem cấu trúc zone/slot; không mặc định cấp thêm quyền Manager. Team cần chốt nếu muốn Admin có quyền cấu hình vượt phạm vi này.
- Slot nghiệp vụ và Layout 2D/3D tách biệt. Không tạo trình dựng/biên tập 3D trong hạng mục này.

## Cách chạy thử
`npm ci`, `npm run dev`. Giữ Terminal chạy; mở URL Vite hiển thị.
1. Login → Admin Demo → menu Quản lý bãi xe (`/admin/lots`). Tạo bãi TEST, sức chứa 20, gán Manager đầu tiên trong danh sách. Bãi mới ở trạng thái Ngừng hoạt động để Manager cấu hình trước.
2. Thử sửa bãi; nhập mã trùng, GPS sai hoặc sức chứa quá thấp phải bị từ chối.
3. Logout → Manager Demo (nút chỉ có khi Vite DEV) → `/management/lots`. Demo này dùng userId usr-0001, là Manager đầu tiên của mock nhân sự; bãi lot-01 cũng được gán sẵn để thử. Manager chỉ thấy bãi được gán.
4. Chọn bãi vừa tạo → thêm zone A, sức chứa 10; cấu hình tổng sức chứa loại xe = 10 và hạn mức đặt trước = 2.
5. Mở zone → thêm A01, A02; thêm A03 phải bị chặn do hạn mức. Mã trùng phải bị từ chối. Thử sửa A01 sang Bảo trì.
6. Thử giảm hạn mức dưới số slot đã tạo, giảm sức chứa bãi dưới tổng zone: phải từ chối.
7. Thử đổi trạng thái bãi và thời gian đóng tạm; thiếu lý do hoặc mốc kết thúc trước bắt đầu phải bị chặn.
8. Reload: cấu hình demo vẫn còn trong cùng origin trình duyệt. localhost và 127.0.0.1 là hai origin khác nhau, không chia sẻ localStorage.
9. Manager không thấy các menu Admin; tài khoản Staff/User bị chuyển về trang riêng khi mở route quản lý. Kiểm tra thêm viewport hẹp, bàn phím Tab/Escape, form báo lỗi.

## Dữ liệu mẫu và giới hạn
- Đây là FE demo, KHÔNG phải phần nghiệp vụ BE đã hoàn tất. Lớp service từ chối chế độ live chưa tích hợp, không đoán endpoint hay giả báo đã lưu SQL Server.
- Dùng mock parking của repo (hoặc Demo session). Dữ liệu lưu tại localStorage pms_lot_management_demo_v1, riêng với dashboard công suất/doanh thu và assignment của module nhân sự. Có banner rõ trên trang.
- Phân công Manager của module này chưa đồng bộ hai chiều với mock nhân sự. Danh sách chọn Manager lấy từ mock nhân sự hiện có. Không tạo thêm tài khoản ở module bãi.
- Xe vãng lai chỉ phân bổ sức chứa = zone.capacity - reservationLimit; KHÔNG tạo từng slot cho xe vãng lai. Chưa tích hợp Zone Counter vận hành.
- Không sửa tay Reserved/Occupied từ màn cấu hình. Trống ↔ Bảo trì dành cho cấu hình; trạng thái giữ/đỗ do luồng reservation/check-in xử lý.
- Xóa demo giới hạn dữ liệu chưa vận hành: bãi không Active và không có zone; zone chưa có slot; slot không Reserved/Occupied. API thật phải kiểm tra cả lịch sử/session/reservation, dùng soft delete và Audit Log theo yêu cầu.
- Đóng bãi demo kiểm tra slot đang giữ/đỗ; chưa có dữ liệu session vãng lai nên không thể xác nhận điều kiện đóng bãi ngoài đời.
- Chưa có lịch tự động mở lại theo thời gian đóng, upload ảnh, API lưu thật, SignalR, audit server. Không coi FE là ranh giới bảo mật: BE phải kiểm tra JWT, role, quyền bãi và version/concurrency.

## Điểm cần chốt với BE/team
1. Schema Slots có trạng thái Dedicated nhưng SRS chỉ 4 trạng thái. FE mới theo SRS, không thêm Dedicated.
2. reservationLimit là trường DTO đề xuất; schema zone hiện chưa có cột tương ứng rõ ràng. BE cần chốt nơi lưu và quy tắc hạn mức.
3. VehicleTypes demo dùng code CAR_4/CAR_7/MOTORBIKE/BICYCLE. API thật phải trả catalog và ánh xạ ID int, không gửi code này như ID SQL.
4. Scope SRS gọi UserParkingLot còn SQL có UserLotAccess/ManagerUserId; cần một hợp đồng phạm vi bãi chính thức, gồm trường hợp nhiều Manager/bãi. Demo dùng ManagerUserId đơn như schema hiện tại.
5. Chốt uniqueness mã bãi/zone/slot, sức chứa tổng, quy tắc sửa/xóa khi có lịch đặt chỗ tương lai. Các kiểm tra cấu hình hiện tại là đề xuất bảo toàn dữ liệu cần review.
6. Phân quyền cập nhật trạng thái theo FR-LOT-04 là Manager. Nếu Admin cần override phải được chốt riêng, không tự suy diễn từ vai trò hệ thống.

## Bố cục code
- types/lot-management.dto.ts: DTO cấu hình riêng, không đổi DTO công suất.
- lib/lot-rules.ts: quy tắc cấu hình thuần để kiểm thử.
- api/lot-management.service.ts: mock data adapter + kiểm tra phạm vi cho demo.
- pages/admin/ParkingLotsPage.tsx: danh sách, chi tiết bãi, zone và slot.
- components/features/lots/LotForms.tsx: form và dialog dùng UI có sẵn.
- router.tsx, adminNav.ts, AdminLayout.tsx: thêm menu và route riêng cho Admin/Manager.
- mocks/auth.mock.ts, LoginScreen.jsx, hooks/useAuth.ts: Manager Demo DEV và điều hướng đúng role.
- vite.config.ts: bỏ qua .vs để xử lý lỗi watcher trên Visual Studio; là thay đổi công cụ riêng với tính năng.

## Kiểm tra
- npm run build: đã qua TypeScript + Vite build; có cảnh báo chunk lớn và annotation từ thư viện hiện có.
- npm run lint: đã qua.
- node --test tests/parking/lot-rules.test.mjs: 12 ca quy tắc đã qua.
- node --test tests/parking/lot-service.test.mjs: luồng Admin → Manager → CRUD zone/slot, kiểm tra chặn ngoài phạm vi và Staff đã qua (service demo).
- Chưa kiểm tra trực quan/browser tự động: runtime thiếu browser, download browser kiểm thử không thành công. Cần thực hiện checklist UI trên máy trước khi coi là nghiệm thu.
- Chưa build/run BE hoặc kiểm tra lưu DB vì bản này chỉ thay đổi FE.
