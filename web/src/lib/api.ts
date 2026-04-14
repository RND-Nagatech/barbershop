const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

async function request<T>(path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message || `HTTP ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export interface Employee {
  id: string;
  kode: string;
  nama: string;
}

export interface Service {
  id: string;
  kode: string;
  nama: string;
  harga: number;
}

export interface Branch {
  id: string;
  nama: string;
  alamat: string;
  noHp: string;
  domain: string;
}

export interface UserItem {
  id: string;
  username: string;
  level: string;
  menuAccess: string[];
}

export interface BookingService {
  kode: string;
  nama: string;
  harga: number;
}

export interface BookingItem {
  id: string;
  bookingCode: string;
  antrian: number;
  customerName: string;
  phone: string;
  employeeName: string;
  branchId?: string;
  branchDomain?: string;
  services: BookingService[];
  status: "Menunggu" | "Proses" | "Selesai";
  createdAt: string;
}

export interface DashboardPayload {
  stats: {
    totalPegawai: number;
    layananTersedia: number;
    bookingHariIni: number;
    pendapatanHariIni: number;
  };
  recentBookings: Array<{
    id: string;
    customer: string;
    layanan: string;
    pegawai: string;
    status: "Menunggu" | "Proses" | "Selesai";
  }>;
}

export interface FinanceRow {
  kode: string;
  nama: string;
  jumlah: number;
  total: number;
}

export interface EmployeeReportRow {
  kode: string;
  nama: string;
  layananSelesai: number;
  totalRp: number;
  komisi: number;
}

export interface QueuePreview {
  queueDate: string;
  nextAntrian: number;
  nextBookingCode: string;
}

export interface CommissionSetting {
  id: string;
  tipe: "persentase" | "rupiah";
  nilai: number;
}

export const api = {
  login: (username: string, password: string) => request<{ user: UserItem }>("/auth/login", "POST", { username, password }),

  getEmployees: () => request<Employee[]>("/employees"),
  createEmployee: (payload: Omit<Employee, "id">) => request<Employee>("/employees", "POST", payload),
  updateEmployee: (id: string, payload: Omit<Employee, "id">) => request<Employee>(`/employees/${id}`, "PUT", payload),
  deleteEmployee: (id: string) => request<void>(`/employees/${id}`, "DELETE"),

  getServices: () => request<Service[]>("/services"),
  createService: (payload: Omit<Service, "id">) => request<Service>("/services", "POST", payload),
  updateService: (id: string, payload: Omit<Service, "id">) => request<Service>(`/services/${id}`, "PUT", payload),
  deleteService: (id: string) => request<void>(`/services/${id}`, "DELETE"),

  getBranches: () => request<Branch[]>("/branches"),
  createBranch: (payload: Omit<Branch, "id">) => request<Branch>("/branches", "POST", payload),
  updateBranch: (id: string, payload: Omit<Branch, "id">) => request<Branch>(`/branches/${id}`, "PUT", payload),
  deleteBranch: (id: string) => request<void>(`/branches/${id}`, "DELETE"),
  getBranchByDomain: (domain: string) => {
    const query = new URLSearchParams();
    query.set("domain", domain);
    return request<Branch>(`/branches/by-domain?${query.toString()}`);
  },

  getUsers: () => request<UserItem[]>("/users"),
  createUser: (payload: { username: string; password: string; level: string }) => request<UserItem>("/users", "POST", payload),
  updateUser: (id: string, payload: { username: string; password?: string; level: string }) => request<UserItem>(`/users/${id}`, "PUT", payload),
  deleteUser: (id: string) => request<void>(`/users/${id}`, "DELETE"),

  getAccessByUsername: (username: string) => request<{ username: string; menuAccess: string[] }>(`/access/${username}`),
  saveAccessByUsername: (username: string, menuAccess: string[]) => request<{ username: string; menuAccess: string[] }>(`/access/${username}`, "PUT", { menuAccess }),

  getCommissionSetting: () => request<CommissionSetting>("/settings/commission"),
  updateCommissionSetting: (payload: { tipe: "persentase" | "rupiah"; nilai: number }) => request<CommissionSetting>("/settings/commission", "PUT", payload),

  getBookings: (params?: { from?: string; to?: string; status?: string; branchDomain?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.status) query.set("status", params.status);
    if (params?.branchDomain) query.set("branchDomain", params.branchDomain);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<BookingItem[]>(`/bookings${suffix}`);
  },
  getQueuePreview: () => request<QueuePreview>("/bookings/queue-preview"),
  createBooking: (payload: { customerName: string; phone: string; employeeName?: string; services: BookingService[]; branchDomain?: string }) =>
    request<BookingItem>("/bookings", "POST", payload),
  assignBooking: (id: string, employeeName: string) => request(`/bookings/${id}/assign`, "PATCH", { employeeName }),
  completeBooking: (id: string) => request(`/bookings/${id}/complete`, "PATCH"),

  getDashboard: () => request<DashboardPayload>("/dashboard"),
  getFinanceReport: (params?: { from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<FinanceRow[]>(`/reports/finance${suffix}`);
  },
  getEmployeeReport: (params?: { from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<EmployeeReportRow[]>(`/reports/employees${suffix}`);
  },
};
