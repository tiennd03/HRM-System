/**
 * HRM Mock API - JSON Server mô phỏng backend Java Spring Boot.
 *
 * Chạy:  npm run start-api            (mặc định cổng 3001 theo package.json)
 *        node hrm-mock-api/server.js --port 3001
 *
 * Hỗ trợ:
 *   - CRUD chuẩn json-server cho mọi resource:   GET/POST/PUT/PATCH/DELETE /api/v1/{resource}/{id}
 *   - List phân trang kiểu Spring Page<T>:        GET  /api/v1/{resource}?page=0&size=10&sort=field,desc
 *   - Search nâng cao (keyword + filter + sort):  POST /api/v1/{resource}/search
 *   - Tài liệu OpenAPI:                           GET  /openapi.yaml   và  GET /docs (Swagger UI)
 */
const fs = require('fs');
const path = require('path');
const jsonServer = require('json-server');

const server = jsonServer.create();
const router = jsonServer.router(path.join(__dirname, 'db.json'));
const middlewares = jsonServer.defaults();

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Các trường được tìm theo keyword cho từng resource (giống @Query LIKE của Spring).
const SEARCHABLE = {
  employees: ['employeeCode', 'fullName', 'email', 'phone'],
  departments: ['code', 'name', 'description'],
  positions: ['code', 'name', 'level'],
  attendances: ['status'],
  leaveRequests: ['leaveType', 'status', 'reason'],
  payrolls: ['period', 'status'],
  users: ['username', 'email'],
  roles: ['code', 'name', 'description'],
  permissions: ['code', 'name', 'module', 'action'],
};
const RESOURCES = Object.keys(SEARCHABLE);

// Bỏ dấu tiếng Việt để search không phân biệt dấu (giống unaccent ở backend).
function normalize(v) {
  return String(v ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

// Parse tham số sort kiểu Spring: "field,dir" hoặc mảng ["a,asc","b,desc"].
function parseSort(sort) {
  if (!sort) return [];
  const arr = Array.isArray(sort) ? sort : [sort];
  const orders = [];
  for (const item of arr) {
    String(item)
      .split(';')
      .forEach((part) => {
        const [property, dir] = part.split(',').map((s) => s && s.trim());
        if (property) orders.push({ property, direction: (dir || 'asc').toLowerCase() === 'desc' ? 'desc' : 'asc' });
      });
  }
  return orders;
}

function applySort(data, orders) {
  if (!orders.length) return data;
  return [...data].sort((a, b) => {
    for (const { property, direction } of orders) {
      let av = a[property];
      let bv = b[property];
      if (av == null && bv == null) continue;
      if (av == null) return direction === 'asc' ? -1 : 1;
      if (bv == null) return direction === 'asc' ? 1 : -1;
      if (typeof av === 'number' && typeof bv === 'number') {
        if (av !== bv) return direction === 'asc' ? av - bv : bv - av;
      } else {
        const cmp = String(av).localeCompare(String(bv), 'vi');
        if (cmp !== 0) return direction === 'asc' ? cmp : -cmp;
      }
    }
    return 0;
  });
}

/**
 * Áp dụng filter từ object params.
 * - keyword: LIKE trên các trường SEARCHABLE (không phân biệt dấu/hoa-thường)
 * - <field>:        bằng đúng (exact)
 * - <field>_like:   chứa chuỗi
 * - <field>_gte / _lte: khoảng giá trị (số hoặc ngày)
 * - <field>_in:     thuộc danh sách (mảng hoặc chuỗi "a,b,c")
 */
function applyFilters(data, resource, params) {
  let result = data;
  const keyword = params.keyword;
  if (keyword != null && String(keyword).trim() !== '') {
    const kw = normalize(keyword);
    const fields = SEARCHABLE[resource] || [];
    result = result.filter((row) => fields.some((f) => normalize(row[f]).includes(kw)));
  }

  const reserved = new Set(['keyword', 'page', 'size', 'sort']);
  for (const [key, raw] of Object.entries(params)) {
    if (reserved.has(key) || raw == null || raw === '') continue;

    if (key.endsWith('_like')) {
      const field = key.slice(0, -5);
      const v = normalize(raw);
      result = result.filter((row) => normalize(row[field]).includes(v));
    } else if (key.endsWith('_gte')) {
      const field = key.slice(0, -4);
      result = result.filter((row) => row[field] != null && row[field] >= coerce(raw, row[field]));
    } else if (key.endsWith('_lte')) {
      const field = key.slice(0, -4);
      result = result.filter((row) => row[field] != null && row[field] <= coerce(raw, row[field]));
    } else if (key.endsWith('_in')) {
      const field = key.slice(0, -3);
      const list = (Array.isArray(raw) ? raw : String(raw).split(',')).map((x) => String(x).trim());
      result = result.filter((row) => list.includes(String(row[field])));
    } else {
      // bằng đúng (so sánh dạng chuỗi để khỏi lệch kiểu number/boolean)
      result = result.filter((row) => String(row[key]) === String(raw));
    }
  }
  return result;
}

// Ép kiểu giá trị filter theo kiểu của dữ liệu mẫu (số giữ số, còn lại so sánh chuỗi).
function coerce(raw, sample) {
  if (typeof sample === 'number') return Number(raw);
  return raw;
}

// Bọc kết quả thành Spring Data Page<T>.
function toPage(content, totalElements, page, size, orders) {
  const totalPages = size > 0 ? Math.ceil(totalElements / size) : 0;
  const sort = {
    empty: orders.length === 0,
    sorted: orders.length > 0,
    unsorted: orders.length === 0,
    orders,
  };
  return {
    content,
    pageable: {
      pageNumber: page,
      pageSize: size,
      offset: page * size,
      sort,
      paged: true,
      unpaged: false,
    },
    totalElements,
    totalPages,
    last: page >= totalPages - 1,
    first: page === 0,
    size,
    number: page,
    sort,
    numberOfElements: content.length,
    empty: content.length === 0,
  };
}

// Xử lý chung cho cả GET list lẫn POST search.
function handlePaged(resource, params, res) {
  const all = router.db.get(resource).value() || [];
  const page = Math.max(0, parseInt(params.page, 10) || 0);
  const size = Math.max(1, parseInt(params.size, 10) || 10);
  const orders = parseSort(params.sort);

  let data = applyFilters(all, resource, params);
  const totalElements = data.length;
  data = applySort(data, orders);
  const content = data.slice(page * size, page * size + size);

  res.json(toPage(content, totalElements, page, size, orders));
}

// =================== AUTH ===================
// Mật khẩu mock cho mọi tài khoản (xem generate-db.js). Chỉ dùng cho dev.
const MOCK_PASSWORD = '123456';

// "JWT" giả: mockjwt.<payload base64url>. Đủ để FE lưu token và gọi /profile.
function issueToken(user) {
  const payload = { sub: user.id, username: user.username, roleId: user.roleId };
  return 'mockjwt.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
}
function parseToken(req) {
  const m = String(req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m || !m[1].startsWith('mockjwt.')) return null;
  try {
    return JSON.parse(Buffer.from(m[1].slice(8), 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// Ghép thông tin đầy đủ của user: role + danh sách quyền + nhân viên (bỏ passwordHash).
function buildAuthUser(user) {
  const role = router.db.get('roles').find({ id: user.roleId }).value();
  const employee = router.db.get('employees').find({ id: user.employeeId }).value();
  const permissions = role
    ? router.db.get('permissions').value().filter((p) => role.permissionIds.includes(p.id)).map((p) => p.code)
    : [];
  const { passwordHash, ...safe } = user;
  return {
    ...safe,
    role: role ? { id: role.id, code: role.code, name: role.name } : null,
    permissions,
    employee: employee || null,
  };
}
function authError(res, status, message) {
  res.status(status).json({
    timestamp: new Date().toISOString(),
    status,
    error: status === 401 ? 'Unauthorized' : status === 403 ? 'Forbidden' : 'Error',
    message,
    path: '/api/v1/auth',
  });
}

// POST /api/v1/auth/login
server.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = router.db.get('users').find((u) => u.username === String(username || '').toLowerCase()).value();
  if (!user || password !== MOCK_PASSWORD) return authError(res, 401, 'Sai tài khoản hoặc mật khẩu');
  if (!user.enabled) return authError(res, 403, 'Tài khoản đã bị khóa');
  res.json({
    accessToken: issueToken(user),
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: buildAuthUser(user),
  });
});

// POST /api/v1/auth/logout
server.post('/api/v1/auth/logout', (_req, res) => {
  res.json({ message: 'Đăng xuất thành công' });
});

// GET /api/v1/auth/profile  (yêu cầu header Authorization: Bearer <token>)
server.get('/api/v1/auth/profile', (req, res) => {
  const payload = parseToken(req);
  if (!payload) return authError(res, 401, 'Thiếu hoặc sai token');
  const user = router.db.get('users').find({ id: payload.sub }).value();
  if (!user) return authError(res, 401, 'Token không hợp lệ');
  res.json(buildAuthUser(user));
});

// Guard: mọi route /api/v1/* phía dưới đều yêu cầu token hợp lệ.
// (Các route /api/v1/auth/* đã được đăng ký phía trên nên không bị guard chặn.)
server.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next(); // CORS preflight
  if (!req.path.startsWith('/api/v1')) return next(); // /docs, /openapi.yaml, ...
  const payload = parseToken(req);
  if (!payload) return authError(res, 401, 'Thiếu token xác thực');
  const user = router.db.get('users').find({ id: payload.sub }).value();
  if (!user) return authError(res, 401, 'Token không hợp lệ');
  if (!user.enabled) return authError(res, 403, 'Tài khoản đã bị khóa');
  req.authUser = user;
  next();
});

// POST /api/v1/{resource}/search  -> Page<T>
server.post('/api/v1/:resource/search', (req, res, next) => {
  const { resource } = req.params;
  if (!RESOURCES.includes(resource)) return next();
  const params = { ...req.query, ...req.body };
  handlePaged(resource, params, res);
});

// GET /api/v1/{resource}?page=&size=&sort=  -> Page<T>
server.get('/api/v1/:resource', (req, res, next) => {
  const { resource } = req.params;
  if (!RESOURCES.includes(resource)) return next();
  handlePaged(resource, req.query, res);
});

// Tài liệu OpenAPI
server.get('/openapi.yaml', (_req, res) => {
  res.type('text/yaml').send(fs.readFileSync(path.join(__dirname, 'openapi.yaml'), 'utf8'));
});
server.get('/docs', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>HRM API Docs</title>
<link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"></head>
<body><div id="swagger-ui"></div>
<script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
<script>window.onload=()=>SwaggerUIBundle({url:'/openapi.yaml',dom_id:'#swagger-ui'});</script>
</body></html>`);
});

// CRUD còn lại (GET /:id, POST, PUT, PATCH, DELETE) do json-server đảm nhiệm.
server.use('/api/v1', router);

const portArgIndex = process.argv.indexOf('--port');
const port = portArgIndex !== -1 ? Number(process.argv[portArgIndex + 1]) : Number(process.env.PORT) || 3000;
server.listen(port, () => {
  console.log(`HRM Mock API chạy tại http://localhost:${port}`);
  console.log(`  - REST gốc:    http://localhost:${port}/api/v1/{employees|departments|positions|attendances|leaveRequests|payrolls|users|roles|permissions}`);
  console.log(`  - Swagger UI:  http://localhost:${port}/docs`);
});
