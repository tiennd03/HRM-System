/**
 * Sinh dữ liệu mock cho HRM (deterministic).
 *   node hrm-mock-api/generate-db.js
 * Tạo lại hrm-mock-api/db.json với 9 thực thể, dữ liệu tiếng Việt thực tế,
 * đảm bảo toàn vẹn tham chiếu (foreign key hợp lệ).
 */
const fs = require('fs');
const path = require('path');

// ---- PRNG có seed (mulberry32) để dữ liệu ổn định giữa các lần chạy ----
let _seed = 20260616;
function rng() {
  _seed |= 0;
  _seed = (_seed + 0x6d2b79f5) | 0;
  let t = Math.imul(_seed ^ (_seed >>> 15), 1 | _seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const randInt = (min, max) => Math.floor(rng() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const pad = (n, len = 2) => String(n).padStart(len, '0');

// ---- Tham chiếu ngày (cố định để dữ liệu ổn định) ----
const TODAY = new Date('2026-06-16T00:00:00Z');
const fmtDate = (d) => d.toISOString().slice(0, 10);
function addDays(base, days) {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ---- Dữ liệu tên tiếng Việt ----
const HO = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý'];
const DEM_NAM = ['Văn', 'Hữu', 'Đức', 'Công', 'Minh', 'Quang', 'Thành', 'Xuân', 'Bá', 'Đình'];
const DEM_NU = ['Thị', 'Thu', 'Thúy', 'Ngọc', 'Thanh', 'Kim', 'Hồng', 'Mỹ', 'Phương', 'Diệu'];
const TEN = ['Anh', 'Bình', 'Cường', 'Dũng', 'Hà', 'Hải', 'Hạnh', 'Hoa', 'Hùng', 'Hương', 'Khoa', 'Lan', 'Linh', 'Long', 'Mai', 'Nam', 'Nga', 'Ngân', 'Nhung', 'Phong', 'Quân', 'Sơn', 'Tâm', 'Thảo', 'Trang', 'Trung', 'Tú', 'Tuấn', 'Vân', 'Việt'];

function removeDiacritics(str) {
  return str.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

// ---- 1. Departments (20) ----
const DEPT_DEFS = [
  ['BOD', 'Ban Giám đốc'],
  ['HR', 'Phòng Nhân sự'],
  ['ACC', 'Phòng Kế toán'],
  ['FIN', 'Phòng Tài chính'],
  ['IT', 'Phòng Công nghệ thông tin'],
  ['SALES', 'Phòng Kinh doanh'],
  ['MKT', 'Phòng Marketing'],
  ['ADMIN', 'Phòng Hành chính'],
  ['LEGAL', 'Phòng Pháp chế'],
  ['PUR', 'Phòng Mua hàng'],
  ['PROD', 'Phòng Sản xuất'],
  ['LOG', 'Phòng Kho vận'],
  ['CS', 'Phòng Chăm sóc khách hàng'],
  ['RND', 'Phòng Nghiên cứu & Phát triển'],
  ['QA', 'Phòng Đảm bảo chất lượng'],
  ['PMO', 'Phòng Quản lý dự án'],
  ['TRAIN', 'Phòng Đào tạo'],
  ['COMM', 'Phòng Truyền thông'],
  ['RISK', 'Phòng Quản trị rủi ro'],
  ['PR', 'Phòng Đối ngoại'],
];
const departments = DEPT_DEFS.map(([code, name], i) => ({
  id: i + 1,
  code,
  name,
  description: `${name} - phụ trách mảng ${name.replace('Phòng ', '').replace('Ban ', '').toLowerCase()}`,
}));

// ---- 2. Positions (50) ----
const POSITION_TITLES = [
  'Tổng Giám đốc', 'Phó Tổng Giám đốc', 'Giám đốc điều hành', 'Giám đốc Nhân sự', 'Giám đốc Tài chính',
  'Giám đốc Kinh doanh', 'Giám đốc Công nghệ', 'Giám đốc Marketing', 'Trưởng phòng Nhân sự', 'Trưởng phòng Kế toán',
  'Trưởng phòng IT', 'Trưởng phòng Kinh doanh', 'Trưởng phòng Marketing', 'Trưởng phòng Sản xuất', 'Trưởng phòng QA',
  'Phó phòng Nhân sự', 'Phó phòng Kế toán', 'Phó phòng IT', 'Phó phòng Kinh doanh', 'Trưởng nhóm Phát triển',
  'Trưởng nhóm Kiểm thử', 'Trưởng nhóm Hỗ trợ', 'Trưởng nhóm Vận hành', 'Kiến trúc sư phần mềm', 'Lập trình viên cao cấp',
  'Lập trình viên', 'Lập trình viên Frontend', 'Lập trình viên Backend', 'Kỹ sư DevOps', 'Kỹ sư QA',
  'Chuyên viên Nhân sự', 'Chuyên viên Tuyển dụng', 'Chuyên viên Đào tạo', 'Chuyên viên Tiền lương', 'Chuyên viên Kế toán',
  'Kế toán tổng hợp', 'Kế toán thanh toán', 'Chuyên viên Tài chính', 'Chuyên viên Kinh doanh', 'Nhân viên Kinh doanh',
  'Chuyên viên Marketing', 'Chuyên viên Truyền thông', 'Chuyên viên Pháp chế', 'Chuyên viên Mua hàng', 'Nhân viên Kho',
  'Nhân viên Hành chính', 'Nhân viên Chăm sóc khách hàng', 'Lễ tân', 'Thực tập sinh', 'Cộng tác viên',
];
function levelOf(title) {
  if (/Tổng Giám đốc|Phó Tổng/.test(title)) return 'EXECUTIVE';
  if (/Giám đốc/.test(title)) return 'DIRECTOR';
  if (/Trưởng phòng|Phó phòng/.test(title)) return 'MANAGER';
  if (/Trưởng nhóm|Kiến trúc sư/.test(title)) return 'LEAD';
  if (/cao cấp|tổng hợp/.test(title)) return 'SENIOR';
  if (/Thực tập|Cộng tác|Lễ tân/.test(title)) return 'INTERN';
  return 'JUNIOR';
}
const LEVEL_BASE = { EXECUTIVE: 80000000, DIRECTOR: 55000000, MANAGER: 38000000, LEAD: 28000000, SENIOR: 22000000, JUNIOR: 14000000, INTERN: 6000000 };
const positions = POSITION_TITLES.map((name, i) => ({
  id: i + 1,
  code: `POS${pad(i + 1)}`,
  name,
  level: levelOf(name),
}));

// ---- 3. Employees (200) ----
const EMP_STATUS = ['ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'PROBATION', 'INACTIVE', 'TERMINATED'];
const employees = [];
const usedEmails = new Set();
for (let i = 1; i <= 200; i++) {
  const gender = rng() < 0.55 ? 'MALE' : 'FEMALE';
  const ho = pick(HO);
  const dem = gender === 'MALE' ? pick(DEM_NAM) : pick(DEM_NU);
  const ten = pick(TEN);
  const fullName = `${ho} ${dem} ${ten}`;
  const employeeCode = `EMP${pad(i, 4)}`;
  let emailBase = removeDiacritics(`${ten}.${ho}`).toLowerCase().replace(/\s+/g, '');
  let email = `${emailBase}${i}@company.vn`;
  const position = pick(positions);
  const base = LEVEL_BASE[position.level];
  const salary = Math.round((base * (0.85 + rng() * 0.4)) / 100000) * 100000;
  const joinDate = fmtDate(addDays(TODAY, -randInt(30, 365 * 8)));
  const dobYear = randInt(1975, 2002);
  employees.push({
    id: i,
    employeeCode,
    fullName,
    gender,
    dateOfBirth: `${dobYear}-${pad(randInt(1, 12))}-${pad(randInt(1, 28))}`,
    email,
    phone: `0${pick(['9', '8', '7', '3', '5'])}${pad(randInt(0, 99999999), 8)}`,
    departmentId: randInt(1, departments.length),
    positionId: position.id,
    joinDate,
    salary,
    status: pick(EMP_STATUS),
  });
}

// ---- 4. Attendances (1000) ----
const ATT_STATUS = ['PRESENT', 'PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'EARLY_LEAVE', 'ABSENT', 'ON_LEAVE'];
const attendances = [];
for (let i = 1; i <= 1000; i++) {
  const emp = pick(employees);
  const workDate = fmtDate(addDays(TODAY, -randInt(0, 120)));
  const status = pick(ATT_STATUS);
  let checkIn = null, checkOut = null, workingHours = 0;
  if (status !== 'ABSENT' && status !== 'ON_LEAVE') {
    const inH = status === 'LATE' ? randInt(9, 10) : 8;
    const inM = randInt(0, 59);
    const outH = status === 'EARLY_LEAVE' ? randInt(15, 16) : randInt(17, 19);
    const outM = randInt(0, 59);
    checkIn = `${pad(inH)}:${pad(inM)}`;
    checkOut = `${pad(outH)}:${pad(outM)}`;
    workingHours = Math.round((outH + outM / 60 - (inH + inM / 60) - 1) * 10) / 10;
    if (workingHours < 0) workingHours = 0;
  }
  attendances.push({
    id: i,
    employeeId: emp.id,
    workDate,
    checkIn,
    checkOut,
    workingHours,
    status,
  });
}

// ---- 5. Leave Requests (300) ----
const LEAVE_TYPE = ['ANNUAL', 'SICK', 'UNPAID', 'MATERNITY', 'MARRIAGE', 'BEREAVEMENT'];
const LEAVE_STATUS = ['PENDING', 'APPROVED', 'APPROVED', 'REJECTED', 'CANCELLED'];
const leaveRequests = [];
for (let i = 1; i <= 300; i++) {
  const emp = pick(employees);
  const from = addDays(TODAY, randInt(-60, 60));
  const days = randInt(1, 10);
  const to = addDays(from, days - 1);
  const status = pick(LEAVE_STATUS);
  leaveRequests.push({
    id: i,
    employeeId: emp.id,
    leaveType: pick(LEAVE_TYPE),
    fromDate: fmtDate(from),
    toDate: fmtDate(to),
    totalDays: days,
    reason: pick(['Nghỉ phép năm', 'Việc gia đình', 'Khám bệnh', 'Nghỉ ốm', 'Việc cá nhân', 'Du lịch']),
    status,
    approvedBy: status === 'APPROVED' ? randInt(1, 10) : null,
  });
}

// ---- 6. Payrolls (1000): 200 nhân viên x 5 kỳ lương gần nhất ----
const PAY_STATUS = ['PAID', 'PAID', 'PAID', 'APPROVED', 'DRAFT'];
const payrolls = [];
let payId = 1;
const periods = [];
for (let m = 0; m < 5; m++) {
  const d = new Date(TODAY);
  d.setUTCMonth(d.getUTCMonth() - m);
  periods.push(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
}
for (const emp of employees) {
  for (const period of periods) {
    const baseSalary = emp.salary;
    const allowance = Math.round((baseSalary * (0.05 + rng() * 0.1)) / 1000) * 1000;
    const bonus = rng() < 0.3 ? Math.round((baseSalary * rng() * 0.2) / 1000) * 1000 : 0;
    const gross = baseSalary + allowance + bonus;
    const insurance = Math.round(baseSalary * 0.105); // BHXH+BHYT+BHTN ~10.5%
    const tax = Math.round(Math.max(0, gross - insurance - 11000000) * 0.1);
    const deduction = insurance + tax;
    const netSalary = gross - deduction;
    payrolls.push({
      id: payId++,
      employeeId: emp.id,
      period,
      baseSalary,
      allowance,
      bonus,
      insurance,
      tax,
      deduction,
      netSalary,
      status: pick(PAY_STATUS),
    });
  }
}

// ---- 7. Permissions: 8 module x 4 hành động = 32 ----
const MODULES = ['employee', 'department', 'position', 'attendance', 'leave', 'payroll', 'user', 'role'];
const ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE'];
const permissions = [];
let permId = 1;
for (const mod of MODULES) {
  for (const act of ACTIONS) {
    permissions.push({
      id: permId++,
      code: `${mod.toUpperCase()}_${act}`,
      name: `${act === 'VIEW' ? 'Xem' : act === 'CREATE' ? 'Tạo' : act === 'UPDATE' ? 'Sửa' : 'Xóa'} ${mod}`,
      module: mod,
      action: act,
    });
  }
}
const permByCode = Object.fromEntries(permissions.map((p) => [p.code, p.id]));
const allPermIds = permissions.map((p) => p.id);

// ---- 8. Roles ----
const ROLE_DEFS = [
  ['ADMIN', 'Quản trị hệ thống', 'Toàn quyền', allPermIds],
  ['HR_MANAGER', 'Trưởng phòng Nhân sự', 'Quản lý nhân sự, chấm công, nghỉ phép, lương',
    permissions.filter((p) => ['employee', 'attendance', 'leave', 'payroll', 'department', 'position'].includes(p.module)).map((p) => p.id)],
  ['HR_STAFF', 'Nhân viên Nhân sự', 'Nghiệp vụ nhân sự cơ bản',
    permissions.filter((p) => ['employee', 'attendance', 'leave'].includes(p.module) && p.action !== 'DELETE').map((p) => p.id)],
  ['ACCOUNTANT', 'Kế toán', 'Quản lý bảng lương',
    permissions.filter((p) => p.module === 'payroll' || (p.module === 'employee' && p.action === 'VIEW')).map((p) => p.id)],
  ['MANAGER', 'Quản lý', 'Duyệt nghỉ phép, xem nhân sự phòng',
    [permByCode.EMPLOYEE_VIEW, permByCode.ATTENDANCE_VIEW, permByCode.LEAVE_VIEW, permByCode.LEAVE_UPDATE, permByCode.PAYROLL_VIEW]],
  ['EMPLOYEE', 'Nhân viên', 'Tự phục vụ: xem thông tin, gửi đơn nghỉ',
    [permByCode.EMPLOYEE_VIEW, permByCode.ATTENDANCE_VIEW, permByCode.LEAVE_VIEW, permByCode.LEAVE_CREATE, permByCode.PAYROLL_VIEW]],
];
const roles = ROLE_DEFS.map(([code, name, description, permissionIds], i) => ({
  id: i + 1,
  code,
  name,
  description,
  permissionIds,
}));

// ---- 9. Users: 1 tài khoản / nhân viên ----
const users = employees.map((emp, i) => {
  const pos = positions.find((p) => p.id === emp.positionId);
  let roleId;
  if (/Giám đốc|Tổng/.test(pos.name)) roleId = 1; // ADMIN
  else if (/Nhân sự/.test(pos.name) && /Trưởng|Giám đốc/.test(pos.name)) roleId = 2;
  else if (/Nhân sự|Tuyển dụng|Đào tạo|Tiền lương/.test(pos.name)) roleId = 3;
  else if (/Kế toán|Tài chính/.test(pos.name)) roleId = 4;
  else if (/Trưởng phòng|Phó phòng|Trưởng nhóm/.test(pos.name)) roleId = 5;
  else roleId = 6;
  const username = removeDiacritics(emp.employeeCode).toLowerCase();
  return {
    id: i + 1,
    username,
    employeeId: emp.id,
    email: emp.email,
    // mật khẩu giả: 123456 (bcrypt mẫu, chỉ dùng cho mock)
    passwordHash: '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy',
    roleId,
    enabled: emp.status === 'ACTIVE' || emp.status === 'PROBATION',
    lastLoginAt: rng() < 0.7 ? `${fmtDate(addDays(TODAY, -randInt(0, 30)))}T${pad(randInt(7, 19))}:${pad(randInt(0, 59))}:00` : null,
  };
});

// ---- Ghi file ----
const db = {
  employees,
  departments,
  positions,
  attendances,
  leaveRequests,
  payrolls,
  users,
  roles,
  permissions,
};
const out = path.join(__dirname, 'db.json');
fs.writeFileSync(out, JSON.stringify(db, null, 2), 'utf8');
console.log('Đã tạo db.json:');
for (const k of Object.keys(db)) console.log(`  ${k}: ${db[k].length}`);
