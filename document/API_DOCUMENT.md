PARKING MANAGEMENT SYSTEM (PMS)
API DOCUMENTATION
Phiên bản: 1.0
Định dạng dữ liệu: JSON (application/json)
Môi trường phát triển: Local Development

1. THÔNG TIN CHUNG (GENERAL INFORMATION)
1.1. Base URL
Hệ thống hỗ trợ hai địa chỉ chạy local:
HTTP: http://localhost:5000
HTTPS: https://localhost:5001
Swagger UI:
http://localhost:5000/swagger/index.html
1.2. Cơ chế xác thực (Authentication)
Các API yêu cầu xác thực sử dụng JSON Web Token (JWT). Client cần gửi JWT trong HTTP Header theo định dạng sau:
Authorization: Bearer <your_jwt_token>
Token được lấy từ API đăng nhập:
POST /api/users/authenticate
Các endpoint được đánh dấu là không yêu cầu xác thực có thể được gọi mà không cần JWT.
1.3. Cấu trúc phản hồi chuẩn (Standard Response Envelope)
Tất cả API sử dụng cấu trúc phản hồi thống nhất ApiResult<T>, bao gồm ba trường:
succeeded: Cho biết yêu cầu có thành công hay không.
result: Dữ liệu trả về khi xử lý thành công.
errors: Danh sách lỗi phát sinh trong quá trình xử lý.
1.3.1. Phản hồi thành công (Success Response)
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "id": "e309cb69-026d-4767-8cfb-6e9fa566b6c4"
  },
  "errors": []
}
1.3.2. Phản hồi thất bại (Error Response)
HTTP Status: 400 Bad Request, 404 Not Found hoặc 422 Unprocessable Entity
{
  "succeeded": false,
  "result": null,
  "errors": [
    "Specific error description 1",
    "Specific error description 2"
  ]
}

2. TỔNG QUAN CÁC API ENDPOINTS (ENDPOINTS OVERVIEW)
2.1. Authentication & Account Management
STT	Method	Endpoint	Authentication	Permission	Description
1	POST	/api/users/register	Không	Public	Đăng ký tài khoản mới
2	POST	/api/users/authenticate	Không	Public	Đăng nhập và lấy JWT Token
3	GET	/api/users	Không	Public	Lấy danh sách tài khoản
4	GET	/api/users/{id}	Không	Public	Lấy thông tin tài khoản theo ID
5	GET	/api/users/{id}/profile	Có	Admin	Xem hồ sơ chi tiết của người dùng
2.2. User Profile Management
STT	Method	Endpoint	Authentication	Permission	Description
6	GET	/api/users/profile	Có	User	Xem hồ sơ cá nhân
7	PUT	/api/users/profile	Có	User	Cập nhật hồ sơ cá nhân
8	PUT	/api/users/profile/change-password	Có	User	Đổi mật khẩu
2.3. Vehicle Management
STT	Method	Endpoint	Authentication	Permission	Description
9	GET	/api/users/profile/vehicle-types	Có	User	Lấy danh mục loại xe
10	GET	/api/users/profile/vehicles	Có	User	Lấy danh sách phương tiện
11	POST	/api/users/profile/vehicles	Có	User	Đăng ký phương tiện mới
12	PUT	/api/users/profile/vehicles/{vehicleId}	Có	User	Cập nhật phương tiện
13	DELETE	/api/users/profile/vehicles/{vehicleId}	Có	User	Xóa mềm phương tiện
14	PATCH	/api/users/profile/vehicles/{vehicleId}/default	Có	User	Đặt phương tiện làm mặc định
Quy ước:
Public: Không yêu cầu xác thực.
User: Yêu cầu người dùng đăng nhập bằng JWT.
Admin: Yêu cầu JWT và quyền Admin.
{id} và {vehicleId} là các tham số được truyền trực tiếp trên URL.

3. CHI TIẾT API ENDPOINTS
PHẦN A. AUTHENTICATION & ACCOUNT MANAGEMENT
3.1. Đăng ký tài khoản
Endpoint: POST /api/users/register
Mô tả: Tạo tài khoản người dùng mới trong hệ thống. Tài khoản được gán vai trò mặc định là User và tự động liên kết với bảng thông tin khách hàng (Customers).
Authentication: Không yêu cầu (AllowAnonymous).
3.1.1. Quy tắc kiểm tra dữ liệu (Validation Rules)
Trường	Quy tắc
userName	Bắt buộc, từ 3 đến 50 ký tự, không được trùng với tài khoản đã tồn tại
password	Bắt buộc, từ 6 đến 100 ký tự
email	Bắt buộc, đúng định dạng email, không được trùng với email đã tồn tại
phoneNumber	Bắt buộc, số điện thoại Việt Nam hợp lệ
fullName	Không bắt buộc, tối đa 200 ký tự
Số điện thoại được hỗ trợ theo quy tắc được mô tả trong tài liệu:
Số điện thoại Việt Nam gồm 10 chữ số, bắt đầu bằng 03, 05, 07, 08 hoặc 09.
Hỗ trợ tiền tố quốc tế +84.
3.1.2. Request Body
{
  "userName": "nguyenvana",
  "fullName": "Nguyễn Văn A",
  "email": "vana.nguyen@example.com",
  "password": "Password123@",
  "phoneNumber": "0912345678"
}
3.1.3. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "id": "e309cb69-026d-4767-8cfb-6e9fa566b6c4"
  },
  "errors": []
}

3.2. Đăng nhập hệ thống
Endpoint: POST /api/users/authenticate
Mô tả: Xác thực tài khoản bằng tên đăng nhập và mật khẩu. Khi đăng nhập thành công, hệ thống trả về thông tin người dùng và JWT Token.
Authentication: Không yêu cầu (AllowAnonymous).
3.2.1. Request Body
{
  "username": "nguyenvana",
  "password": "Password123@"
}
3.2.2. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "userId": "e309cb69-026d-4767-8cfb-6e9fa566b6c4",
    "username": "nguyenvana",
    "email": "vana.nguyen@example.com",
    "phoneNumber": "0912345678",
    "role": "User",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "errors": []
}
Lưu ý: Sử dụng giá trị result.token để gọi các API yêu cầu xác thực.

3.3. Lấy danh sách tất cả tài khoản
Endpoint: GET /api/users
Mô tả: Trả về danh sách tất cả tài khoản người dùng trong hệ thống Identity.
Authentication: Không yêu cầu (AllowAnonymous).
3.3.1. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": [
    {
      "id": "e309cb69-026d-4767-8cfb-6e9fa566b6c4",
      "userName": "nguyenvana",
      "email": "vana.nguyen@example.com",
      "phoneNumber": "0912345678",
      "role": "User"
    }
  ],
  "errors": []
}

3.4. Lấy thông tin tài khoản theo ID
Endpoint: GET /api/users/{id}
Mô tả: Lấy thông tin cơ bản của một tài khoản theo User ID.
Authentication: Không yêu cầu theo cấu hình được mô tả.
3.4.1. Path Parameters
Tham số	Kiểu dữ liệu	Mô tả
id	String (GUID)	ID duy nhất của tài khoản người dùng
3.4.2. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "id": "e309cb69-026d-4767-8cfb-6e9fa566b6c4",
    "userName": "nguyenvana",
    "email": "vana.nguyen@example.com",
    "phoneNumber": "0912345678",
    "role": "User"
  },
  "errors": []
}

3.5. Admin xem hồ sơ chi tiết người dùng
Endpoint: GET /api/users/{id}/profile
Mô tả: Cho phép quản trị viên xem hồ sơ chi tiết của một người dùng bất kỳ, bao gồm thông tin tài khoản, trạng thái hoạt động, vai trò và danh sách phương tiện đã đăng ký.
Authentication: Bắt buộc.
Authorization: Admin (Authorize(Roles = "Admin")).
3.5.1. Path Parameters
Tham số	Kiểu dữ liệu	Mô tả
id	String (GUID)	ID duy nhất của tài khoản người dùng
3.5.2. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "userId": "e309cb69-026d-4767-8cfb-6e9fa566b6c4",
    "fullName": "Nguyễn Văn A",
    "phoneNumber": "0912345678",
    "email": "vana.nguyen@example.com",
    "avatarUrl": "https://example.com/avatars/vana.jpg",
    "isActive": true,
    "status": "Active",
    "hasPassword": true,
    "role": "User",
    "createdAt": "2026-10-10T15:30:00Z",
    "updatedAt": null,
    "vehicles": [
      {
        "vehicleId": "f7943a75-730b-411d-b061-824bba8ccc05",
        "licensePlate": "51A-123.45",
        "vehicleTypeId": 1,
        "vehicleType": "4-Seat Car",
        "brand": "Toyota",
        "model": "Vios",
        "color": "Trắng",
        "isDefault": true,
        "isActive": true,
        "createdAt": "2026-10-10T15:35:00Z",
        "updatedAt": null
      }
    ]
  },
  "errors": []
}

PHẦN B. USER PROFILE MANAGEMENT
3.6. Xem hồ sơ cá nhân
Endpoint: GET /api/users/profile
Mô tả: Trả về thông tin hồ sơ của người dùng hiện đang đăng nhập, bao gồm thông tin cá nhân và danh sách phương tiện đã đăng ký.
Authentication: Bắt buộc (Authorize).
3.6.1. Request Headers
Authorization: Bearer <your_jwt_token>
3.6.2. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "userId": "e309cb69-026d-4767-8cfb-6e9fa566b6c4",
    "fullName": "Nguyễn Văn A",
    "phoneNumber": "0912345678",
    "email": "vana.nguyen@example.com",
    "avatarUrl": null,
    "isActive": true,
    "status": "Active",
    "hasPassword": true,
    "role": "User",
    "createdAt": "2026-10-10T15:30:00Z",
    "updatedAt": null,
    "vehicles": []
  },
  "errors": []
}

3.7. Cập nhật hồ sơ cá nhân
Endpoint: PUT /api/users/profile
Mô tả: Cập nhật thông tin hồ sơ của người dùng hiện tại, bao gồm họ tên, email, số điện thoại và đường dẫn ảnh đại diện.
Authentication: Bắt buộc (Authorize).
3.7.1. Quy tắc kiểm tra dữ liệu (Validation Rules)
Trường	Quy tắc
fullName	Tối đa 200 ký tự
email	Tối đa 256 ký tự, đúng định dạng email
phoneNumber	Số điện thoại Việt Nam hợp lệ
avatarUrl	Tối đa 500 ký tự
3.7.2. Request Body
{
  "fullName": "Nguyễn Văn A (Cập nhật)",
  "email": "nguyenvana.new@gmail.com",
  "phoneNumber": "0987654321",
  "avatarUrl": "https://storage.example.com/avatar123.jpg"
}
3.7.3. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "userId": "e309cb69-026d-4767-8cfb-6e9fa566b6c4",
    "fullName": "Nguyễn Văn A (Cập nhật)",
    "phoneNumber": "0987654321",
    "email": "nguyenvana.new@gmail.com",
    "avatarUrl": "https://storage.example.com/avatar123.jpg",
    "isActive": true,
    "status": "Active",
    "hasPassword": true,
    "role": "User",
    "createdAt": "2026-10-10T15:30:00Z",
    "updatedAt": "2026-10-11T01:00:00Z",
    "vehicles": []
  },
  "errors": []
}

3.8. Đổi mật khẩu
Endpoint: PUT /api/users/profile/change-password
Mô tả: Cho phép người dùng đã đăng nhập thay đổi mật khẩu tài khoản.
Authentication: Bắt buộc (Authorize).
3.8.1. Quy tắc kiểm tra dữ liệu (Validation Rules)
Trường	Quy tắc
currentPassword	Bắt buộc, là mật khẩu hiện tại
newPassword	Bắt buộc, từ 6 đến 100 ký tự và phải khác mật khẩu hiện tại
confirmPassword	Bắt buộc, phải trùng khớp hoàn toàn với newPassword
3.8.2. Request Body
{
  "currentPassword": "Password123@",
  "newPassword": "NewPassword456@",
  "confirmPassword": "NewPassword456@"
}
3.8.3. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": true,
  "errors": []
}

PHẦN C. VEHICLE MANAGEMENT
3.9. Lấy danh mục loại xe
Endpoint: GET /api/users/profile/vehicle-types
Mô tả: Trả về danh sách các loại phương tiện đang hoạt động để người dùng lựa chọn khi đăng ký xe mới.
Authentication: Bắt buộc (Authorize).
3.9.1. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": [
    {
      "id": 1,
      "code": "CAR_4",
      "name": "4-Seat Car",
      "description": "Sedan/Hatchback up to 5 seats",
      "sortOrder": 1
    },
    {
      "id": 2,
      "code": "CAR_7",
      "name": "7-Seat Car",
      "description": "SUV/MPV up to 7 seats",
      "sortOrder": 2
    },
    {
      "id": 3,
      "code": "MOTORBIKE",
      "name": "Motorbike",
      "description": "Two-wheeled motorcycles and scooters",
      "sortOrder": 3
    },
    {
      "id": 4,
      "code": "BICYCLE",
      "name": "Bicycle",
      "description": "Bicycles and light electric bikes",
      "sortOrder": 4
    }
  ],
  "errors": []
}

3.10. Lấy danh sách phương tiện
Endpoint: GET /api/users/profile/vehicles
Mô tả: Trả về danh sách phương tiện đang hoạt động (isActive = true) thuộc người dùng hiện tại. Phương tiện mặc định được ưu tiên hiển thị trước.
Authentication: Bắt buộc (Authorize).
3.10.1. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": [
    {
      "vehicleId": "f7943a75-730b-411d-b061-824bba8ccc05",
      "licensePlate": "51A-123.45",
      "vehicleTypeId": 1,
      "vehicleType": "4-Seat Car",
      "brand": "Toyota",
      "model": "Camry",
      "color": "Đen",
      "isDefault": true,
      "isActive": true,
      "createdAt": "2026-10-10T16:00:00Z",
      "updatedAt": null
    }
  ],
  "errors": []
}

3.11. Đăng ký phương tiện mới
Endpoint: POST /api/users/profile/vehicles
Mô tả: Thêm phương tiện mới vào tài khoản người dùng. Hệ thống tự động sinh vehicleId theo định dạng GUID.
Nếu đây là phương tiện đầu tiên của người dùng, hệ thống tự động gán isDefault = true.
Authentication: Bắt buộc (Authorize).
3.11.1. Quy tắc kiểm tra dữ liệu (Validation Rules)
Trường	Quy tắc
licensePlate	Bắt buộc, tối đa 20 ký tự, đúng định dạng biển số xe Việt Nam
vehicleTypeId	Bắt buộc, lớn hơn 0 và phải là loại xe hợp lệ đang hoạt động
brand	Tối đa 100 ký tự
model	Tối đa 100 ký tự
color	Tối đa 50 ký tự
isDefault	Kiểu Boolean (true hoặc false)
Ví dụ biển số hợp lệ theo tài liệu:
51A-123.45
30E-999.99
29A1-123.45
59-B1 123.45
80B-1234
43A-12345
Lưu ý: Biển số không được trùng với biển số xe đã đăng ký trước đó của cùng người dùng.
3.11.2. Request Body
{
  "licensePlate": "51A-888.88",
  "vehicleTypeId": 1,
  "brand": "Mercedes-Benz",
  "model": "C300 AMG",
  "color": "Trắng",
  "isDefault": true
}
3.11.3. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "vehicleId": "c4794218-a664-4e4b-b0b3-f72674e1d7bc",
    "licensePlate": "51A-888.88",
    "vehicleTypeId": 1,
    "vehicleType": "4-Seat Car",
    "brand": "Mercedes-Benz",
    "model": "C300 AMG",
    "color": "Trắng",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-10-11T01:05:00Z",
    "updatedAt": null
  },
  "errors": []
}

3.12. Cập nhật thông tin phương tiện
Endpoint: PUT /api/users/profile/vehicles/{vehicleId}
Mô tả: Cập nhật thông tin phương tiện thuộc người dùng hiện tại, bao gồm biển số, loại xe, nhãn hiệu, mẫu xe, màu sắc, trạng thái mặc định và trạng thái hoạt động.
Authentication: Bắt buộc (Authorize).
3.12.1. Path Parameters
Tham số	Kiểu dữ liệu	Mô tả
vehicleId	GUID	ID duy nhất của phương tiện cần cập nhật
3.12.2. Request Body
{
  "licensePlate": "51A-888.88",
  "vehicleTypeId": 1,
  "brand": "Mercedes-Benz",
  "model": "C300 AMG",
  "color": "Đen mờ",
  "isDefault": true,
  "isActive": true
}
3.12.3. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "vehicleId": "c4794218-a664-4e4b-b0b3-f72674e1d7bc",
    "licensePlate": "51A-888.88",
    "vehicleTypeId": 1,
    "vehicleType": "4-Seat Car",
    "brand": "Mercedes-Benz",
    "model": "C300 AMG",
    "color": "Đen mờ",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-10-11T01:05:00Z",
    "updatedAt": "2026-10-11T01:07:00Z"
  },
  "errors": []
}

3.13. Xóa phương tiện
Endpoint: DELETE /api/users/profile/vehicles/{vehicleId}
Mô tả: Thực hiện xóa mềm phương tiện bằng cách chuyển isActive = false.
Nếu phương tiện bị xóa là xe mặc định, hệ thống tự động gán một phương tiện còn lại làm xe mặc định thay thế.
Authentication: Bắt buộc (Authorize).
3.13.1. Path Parameters
Tham số	Kiểu dữ liệu	Mô tả
vehicleId	GUID	ID duy nhất của phương tiện cần xóa
3.13.2. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": true,
  "errors": []
}

3.14. Đặt phương tiện làm mặc định
Endpoint: PATCH /api/users/profile/vehicles/{vehicleId}/default
Mô tả: Đặt phương tiện được chỉ định làm phương tiện mặc định (isDefault = true). Các phương tiện khác thuộc cùng tài khoản sẽ được chuyển thành isDefault = false.
Authentication: Bắt buộc (Authorize).
3.14.1. Path Parameters
Tham số	Kiểu dữ liệu	Mô tả
vehicleId	GUID	ID duy nhất của phương tiện cần đặt làm mặc định
3.14.2. Response
HTTP Status: 200 OK
{
  "succeeded": true,
  "result": {
    "vehicleId": "c4794218-a664-4e4b-b0b3-f72674e1d7bc",
    "licensePlate": "51A-888.88",
    "vehicleTypeId": 1,
    "vehicleType": "4-Seat Car",
    "brand": "Mercedes-Benz",
    "model": "C300 AMG",
    "color": "Đen mờ",
    "isDefault": true,
    "isActive": true,
    "createdAt": "2026-10-11T01:05:00Z",
    "updatedAt": "2026-10-11T01:09:00Z"
  },
  "errors": []
}

4. CÁC MÃ TRẠNG THÁI HTTP THƯỜNG GẶP (COMMON HTTP STATUS CODES)
HTTP Status	Tên trạng thái	Ý nghĩa
200	OK	Yêu cầu được xử lý thành công. Dữ liệu nằm trong trường result.
400	Bad Request	Dữ liệu đầu vào không hợp lệ hoặc vi phạm quy tắc nghiệp vụ. Chi tiết nằm trong errors.
401	Unauthorized	Chưa đăng nhập hoặc JWT Token không hợp lệ/hết hạn.
403	Forbidden	Người dùng không có quyền truy cập tài nguyên được yêu cầu.
404	Not Found	Không tìm thấy tài nguyên, chẳng hạn User hoặc Vehicle.
422	Unprocessable Entity	Dữ liệu không đáp ứng các quy tắc validation, ví dụ FluentValidation.
500	Internal Server Error	Xảy ra lỗi nội bộ phía máy chủ.

5. LƯU Ý KHI TÍCH HỢP API
5.1. Xác thực
Đối với các API yêu cầu đăng nhập, client cần gửi JWT Token trong header:
Authorization: Bearer <your_jwt_token>
5.2. Xử lý phản hồi
Client nên kiểm tra cả HTTP Status Code và trường succeeded trong response để xác định kết quả xử lý.
Khi succeeded = true, đọc dữ liệu từ result.
Khi succeeded = false, đọc danh sách lỗi từ errors.
Khi nhận HTTP 401, kiểm tra trạng thái đăng nhập và tính hợp lệ của token.
Khi nhận HTTP 403, kiểm tra quyền truy cập của tài khoản.
Khi nhận HTTP 404, kiểm tra ID của tài nguyên được yêu cầu.
5.3. Quản lý phương tiện
Người dùng chỉ quản lý các phương tiện thuộc tài khoản của mình.
Phương tiện mặc định được đánh dấu bằng isDefault = true.
Khi xóa phương tiện, hệ thống sử dụng cơ chế xóa mềm.
Khi thay đổi phương tiện mặc định, chỉ một phương tiện trong tài khoản nên được đánh dấu là mặc định.
5.4. Bảo mật
Các API công khai cần được xem xét kỹ trước khi triển khai trên môi trường production. Đặc biệt, endpoint lấy danh sách người dùng (GET /api/users) và endpoint lấy thông tin tài khoản theo ID (GET /api/users/{id}) nên được đánh giá về quyền truy cập và nguy cơ lộ dữ liệu cá nhân.
Thông tin nhạy cảm như mật khẩu và JWT Token không nên được ghi vào log hoặc chia sẻ công khai.

END OF DOCUMENT