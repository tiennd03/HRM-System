# HRM Mock API

Mock backend cho hệ thống HRM bằng [JSON Server](https://github.com/typicode/json-server) (v0.17),
mô phỏng API của backend Java Spring Boot: phân trang `Page<T>`, search nâng cao, filter, sort.

## Chạy

```bash
npm run start-api          # cổng 3001 (cấu hình trong package.json)
# hoặc
node hrm-mock-api/server.js --port 3001
node hrm-mock-api/server.js                # mặc định 3000
```

- Swagger UI: http://localhost:3001/docs
- OpenAPI spec: http://localhost:3001/openapi.yaml (file: [openapi.yaml](openapi.yaml))

## Sinh lại dữ liệu

```bash
node hrm-mock-api/generate-db.js
```

Dữ liệu được sinh **deterministic** (có seed) nên mỗi lần chạy cho kết quả giống nhau.
Số lượng: 200 nhân viên · 20 phòng ban · 50 chức danh · 1000 chấm công · 300 đơn nghỉ ·
1000 bảng lương · 200 tài khoản · 6 vai trò · 32 quyền.

## Tài nguyên (resource)

| Resource        | Đường dẫn                  |
|-----------------|----------------------------|
| Nhân viên       | `/api/v1/employees`        |
| Phòng ban       | `/api/v1/departments`      |
| Chức danh       | `/api/v1/positions`        |
| Chấm công       | `/api/v1/attendances`      |
| Đơn nghỉ phép   | `/api/v1/leaveRequests`    |
| Bảng lương      | `/api/v1/payrolls`         |
| Tài khoản       | `/api/v1/users`            |
| Vai trò         | `/api/v1/roles`            |
| Quyền           | `/api/v1/permissions`      |

## Xác thực (Auth)

Mock đơn giản: mọi tài khoản dùng mật khẩu **`123456`**, username = mã nhân viên viết thường
(vd `emp0002`). Token là JWT giả (`mockjwt.<payload>`), đủ để FE lưu và gọi `/auth/profile`.

| Method | Endpoint              | Mô tả |
|--------|-----------------------|-------|
| POST   | `/api/v1/auth/login`  | Đăng nhập → `{ accessToken, tokenType, expiresIn, user }` |
| POST   | `/api/v1/auth/logout` | Đăng xuất → `{ message }` |
| GET    | `/api/v1/auth/profile`| Thông tin tài khoản hiện tại (cần header `Authorization: Bearer <token>`) |

```bash
# Đăng nhập
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ "username": "emp0002", "password": "123456" }'

# Lấy profile
curl http://localhost:3001/api/v1/auth/profile \
  -H "Authorization: Bearer mockjwt.xxx"
```

`user` / `profile` trả về kèm `role` (mã + tên), `permissions` (mảng mã quyền) và `employee`
(hồ sơ nhân viên), đã ẩn `passwordHash`. Lưu ý: tài khoản có `enabled: false` (nhân viên
INACTIVE/TERMINATED) sẽ bị **403** khi đăng nhập.

### Bắt buộc token

**Mọi endpoint `/api/v1/*` (trừ `/auth/login`, `/auth/logout`) đều yêu cầu token hợp lệ.**
Thiếu token hoặc token sai → **401**; tài khoản bị khóa → **403**. Body lỗi theo chuẩn:

```json
{ "timestamp": "...", "status": 401, "error": "Unauthorized", "message": "Thiếu token xác thực", "path": "/api/v1/auth" }
```

`/docs` và `/openapi.yaml` là tài liệu nên không cần token.

## Quy ước API (giống Spring Boot)

### 1. Danh sách phân trang — `GET /api/v1/{resource}`

```
GET /api/v1/employees?page=0&size=10&sort=salary,desc
```

Trả về `Page<T>`:

```jsonc
{
  "content": [ ... ],
  "pageable": { "pageNumber": 0, "pageSize": 10, "offset": 0, "paged": true, "unpaged": false, "sort": {...} },
  "totalElements": 200,
  "totalPages": 20,
  "number": 0,
  "size": 10,
  "numberOfElements": 10,
  "first": true,
  "last": false,
  "empty": false,
  "sort": { "empty": false, "sorted": true, "unsorted": false, "orders": [{ "property": "salary", "direction": "desc" }] }
}
```

### 2. Search nâng cao — `POST /api/v1/{resource}/search`

Body gộp tất cả tham số (keyword + filter + page/size/sort):

```bash
curl -X POST http://localhost:3001/api/v1/employees/search \
  -H "Content-Type: application/json" \
  -d '{ "keyword": "nguyen", "status": "ACTIVE", "salary_gte": 30000000, "page": 0, "size": 10, "sort": "fullName,asc" }'
```

### 3. CRUD chi tiết (json-server)

```
GET    /api/v1/employees/{id}
POST   /api/v1/employees
PUT    /api/v1/employees/{id}
PATCH  /api/v1/employees/{id}
DELETE /api/v1/employees/{id}
```

## Toán tử filter

Áp dụng cho cả query string lẫn body của `/search`:

| Cú pháp            | Ý nghĩa                                   | Ví dụ                         |
|--------------------|-------------------------------------------|-------------------------------|
| `keyword`          | LIKE trên các trường tìm kiếm, **không dấu** | `keyword=nguyen`              |
| `field`            | Bằng đúng                                  | `status=ACTIVE`               |
| `field_like`       | Chứa chuỗi (không dấu)                     | `name_like=phong`             |
| `field_gte`        | ≥ (số hoặc ngày)                          | `salary_gte=30000000`         |
| `field_lte`        | ≤ (số hoặc ngày)                          | `workDate_lte=2026-06-16`     |
| `field_in`         | Thuộc danh sách                           | `status_in=ACTIVE,PROBATION`  |

Trường được `keyword` quét theo resource:

- employees: `employeeCode, fullName, email, phone`
- departments / roles: `code, name, description`
- positions: `code, name, level`
- attendances: `status` · leaveRequests: `leaveType, status, reason` · payrolls: `period, status`
- users: `username, email` · permissions: `code, name, module, action`

## Ghi chú

- Mật khẩu user trong mock là bcrypt mẫu (plaintext: `123456`) — chỉ dùng cho dev.
- Mọi thao tác ghi (POST/PUT/PATCH/DELETE) sẽ lưu trực tiếp vào `db.json`.
  Chạy lại `generate-db.js` để reset về dữ liệu gốc.
