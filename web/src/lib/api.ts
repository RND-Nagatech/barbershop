const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function getAuthToken(): string | null {
  try {
    return localStorage.getItem("auth_token");
  } catch {
    return null;
  }
}

export function getAuthUser(): UserItem | null {
  try {
    const raw = localStorage.getItem("auth_user");
    if (!raw) return null;
    return JSON.parse(raw) as UserItem;
  } catch {
    return null;
  }
}

async function request<T>(path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

export interface Product {
  id: string;
  kode: string;
  nama: string;
  harga: number;
  stok: number;
  minStok: number;
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

export interface BookingProduct {
  kode: string;
  nama: string;
  harga: number;
  qty: number;
}

export interface BookingItem {
  id: string;
  bookingCode: string;
  antrian: number;
  customerName: string;
  phone: string;
  customerId?: string;
  employeeName: string;
  branchId?: string;
  branchDomain?: string;
  services: BookingService[];
  products: BookingProduct[];
  status: "Menunggu" | "Proses" | "Selesai";
  createdAt: string;
  paymentStatus: "Unpaid" | "Paid";
  paidAt?: string;
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
  tipe?: "Layanan" | "Produk";
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

export interface SaleItem {
  type: "service" | "product";
  kode: string;
  nama: string;
  harga: number;
  qty: number;
}

export interface PayResponse {
  id: string;
  bookingCode: string;
  paymentStatus: "Paid";
  paidAt: string;
  saleId: string;
  customerName: string;
  customerPhone: string;
  items: SaleItem[];
  loyaltyEarnedRp: number;
  total: number;
  received: number;
  change: number;
}

export interface SaleListItem {
  id: string;
  bookingCode: string;
  employeeName: string;
  total: number;
  method: "Cash" | "Legacy";
  received: number;
  change: number;
  paidAt: string;
  paidYmd: string;
  status: "Paid" | "Void";
  voidedAt?: string;
  voidReason?: string;
  voidedBy?: string;
}

export interface SaleDetail extends SaleListItem {
  items: SaleItem[];
  customerName?: string;
  customerPhone?: string;
}

export interface StockMovementItem {
  id: string;
  ymd: string;
  kode: string;
  nama: string;
  delta: number;
  reason: "sale" | "adjust";
  refBookingCode: string;
  createdAt: string;
}

export interface CommissionSetting {
  id: string;
  tipe: "persentase" | "rupiah";
  nilai: number;
}

export interface LoyaltySetting {
  id: string;
  tipe: "persentase" | "rupiah";
  nilai: number;
}

export interface CustomerItem {
  id: string;
  phone: string;
  name: string;
  isMember: boolean;
  loyaltyBalanceRp: number;
  visitCount: number;
  lastVisitAt?: string;
  createdAt: string;
}

export const api = {
  login: (username: string, password: string) => request<{ user: UserItem; token: string }>("/auth/login", "POST", { username, password }),

  getEmployees: () => request<Employee[]>("/employees"),
  createEmployee: (payload: Omit<Employee, "id">) => request<Employee>("/employees", "POST", payload),
  updateEmployee: (id: string, payload: Omit<Employee, "id">) => request<Employee>(`/employees/${id}`, "PUT", payload),
  deleteEmployee: (id: string) => request<void>(`/employees/${id}`, "DELETE"),

  getServices: () => request<Service[]>("/services"),
  createService: (payload: Omit<Service, "id">) => request<Service>("/services", "POST", payload),
  updateService: (id: string, payload: Omit<Service, "id">) => request<Service>(`/services/${id}`, "PUT", payload),
  deleteService: (id: string) => request<void>(`/services/${id}`, "DELETE"),

  getProducts: () => request<Product[]>("/products"),
  getLowStockProducts: () => request<Product[]>("/products/low-stock"),
  createProduct: (payload: Omit<Product, "id">) => request<Product>("/products", "POST", payload),
  updateProduct: (id: string, payload: Omit<Product, "id">) => request<Product>(`/products/${id}`, "PUT", payload),
  deleteProduct: (id: string) => request<void>(`/products/${id}`, "DELETE"),
  adjustProductStock: (id: string, delta: number) => request<Product>(`/products/${id}/adjust-stock`, "PATCH", { delta }),

  getSales: (params?: { from?: string; to?: string; q?: string; includeVoid?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.q) query.set("q", params.q);
    if (params?.includeVoid) query.set("includeVoid", "1");
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<SaleListItem[]>(`/sales${suffix}`);
  },
  getSaleById: (id: string) => request<SaleDetail>(`/sales/${id}`),
  voidSale: (id: string, reason: string) =>
    request<{ id: string; status: "Void"; voidedAt: string; voidReason: string; voidedBy: string }>(`/sales/${id}/void`, "POST", { reason }),

  getStockMovements: (params?: { from?: string; to?: string; kode?: string; reason?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.kode) query.set("kode", params.kode);
    if (params?.reason) query.set("reason", params.reason);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<StockMovementItem[]>(`/stock/movements${suffix}`);
  },

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

  getLoyaltySetting: () => request<LoyaltySetting>("/settings/loyalty"),
  updateLoyaltySetting: (payload: { tipe: "persentase" | "rupiah"; nilai: number }) => request<LoyaltySetting>("/settings/loyalty", "PUT", payload),

  getCustomers: (q?: string) => {
    const query = new URLSearchParams();
    if (q) query.set("q", q);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<CustomerItem[]>(`/customers${suffix}`);
  },
  updateCustomer: (id: string, payload: { phone?: string; name: string; isMember: boolean }) =>
    request<CustomerItem>(`/customers/${id}`, "PUT", payload),
  getCustomerSales: (id: string) =>
    request<Array<{ id: string; bookingCode: string; total: number; status: "Paid" | "Void"; paidAt: string; paidYmd: string }>>(
      `/customers/${id}/sales`,
    ),

  getBookings: (params?: { from?: string; to?: string; status?: string; paymentStatus?: string; branchDomain?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.status) query.set("status", params.status);
    if (params?.paymentStatus) query.set("paymentStatus", params.paymentStatus);
    if (params?.branchDomain) query.set("branchDomain", params.branchDomain);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<BookingItem[]>(`/bookings${suffix}`);
  },
  getQueuePreview: () => request<QueuePreview>("/bookings/queue-preview"),
  createBooking: (payload: { customerName: string; phone: string; employeeName?: string; services: BookingService[]; branchDomain?: string }) =>
    request<BookingItem>("/bookings", "POST", payload),
  payBooking: (id: string, received: number) => request<PayResponse>(`/bookings/${id}/pay`, "POST", { received }),
  addServiceToBooking: (id: string, serviceKode: string) => request<{ id: string; bookingCode: string; services: BookingService[] }>(`/bookings/${id}/add-service`, "POST", { serviceKode }),
  addProductToBooking: (id: string, productKode: string, qty: number) =>
    request<{ id: string; bookingCode: string; products: BookingProduct[] }>(`/bookings/${id}/add-product`, "POST", { productKode, qty }),
  removeProductFromBooking: (id: string, productKode: string) =>
    request<{ id: string; bookingCode: string; products: BookingProduct[] }>(`/bookings/${id}/products/${encodeURIComponent(productKode)}`, "DELETE"),
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
