export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

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

export function resolveMediaUrl(value: string): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/uploads/")) {
    try {
      return `${new URL(API_BASE_URL).origin}${raw}`;
    } catch {
      return raw;
    }
  }
  return raw;
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
  type_komisi: "persentase" | "rupiah";
  nilai_komisi: number;
  compliments?: Array<{ kode: string; qty: number }>;
}

export interface Product {
  id: string;
  kode: string;
  nama: string;
  harga: number;
  stok: number;
  minStok: number;
  type_komisi: "persentase" | "rupiah";
  nilai_komisi: number;
}

export interface HaircutPhotoSet {
  depan: string;
  kiri: string;
  kanan: string;
  belakang: string;
  updatedAt?: string;
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
  isCompliment?: boolean;
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
  foto?: HaircutPhotoSet[];
}

export interface PublicBookingStatus {
  bookingCode: string;
  antrian: number;
  status: "Menunggu" | "Proses" | "Selesai";
  employeeName: string;
  paymentStatus: "Unpaid" | "Paid";
  paidAt?: string;
}

export type WhatsAppStatus = {
  status: "disconnected" | "connecting" | "qr" | "connected";
  me?: string;
  lastError?: string;
};

export type PublicTicket = {
  bookingCode: string;
  antrian: number;
  status: "Menunggu" | "Proses" | "Selesai";
  createdAt: string;
  customerName: string;
  phone: string;
  services: BookingService[];
  products: BookingProduct[];
  branch: Branch | null;
};

export type PublicReceipt = {
  bookingCode: string;
  paidAt: string;
  paidYmd: string;
  items: Array<{ type: "service" | "product"; kode: string; nama: string; harga: number; qty: number; isCompliment?: boolean }>;
  total: number;
  received: number;
  change: number;
  customerName: string;
  customerPhone: string;
  branch: Branch | null;
};

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

export type FinanceJenisTrx = "LAYANAN" | "KAS" | "PRODUK";

export interface FinanceRowRecap {
  kategori: string;
  jenisTrx: FinanceJenisTrx | string;
  uangMasuk: number;
  uangKeluar: number;
}

export interface FinanceRowDetail extends FinanceRowRecap {
  deskripsi: string;
}

export type FinanceRow = FinanceRowRecap | FinanceRowDetail;

export interface EmployeeReportRow {
  kode: string;
  nama: string;
  layananSelesai: number;
  totalRp: number;
  komisi: number;
}

export type TransactionRecapDay = {
  ymd: string;
  totalTransaksi: number;
  totalOmzet: number;
  totalService: number;
  totalProduk: number;
  totalDiskon: number;
};

export type TransactionRecapResponse = {
  from: string;
  to: string;
  includeVoid: boolean;
  days: TransactionRecapDay[];
  totals: Omit<TransactionRecapDay, "ymd">;
};

export type TransactionDetailRow = {
  id: string;
  saleCode: string;
  bookingCode: string;
  customerName: string;
  customerPhone: string;
  barber: string;
  total: number;
  discountTotal: number;
  method: string;
  status: "Paid" | "Void";
  paidAt: string;
  paidYmd: string;
  voidedAt?: string;
  voidReason?: string;
  voidedBy?: string;
};

export type TransactionItemsResponse = {
  sale: {
    id: string;
    saleCode: string;
    bookingCode: string;
    paidAt: string;
    paidYmd: string;
    customerName: string;
    customerPhone: string;
    barber: string;
    method: string;
    status: "Paid" | "Void";
  };
  items: Array<{
    type: "service" | "product";
    kode: string;
    nama: string;
    qty: number;
    harga: number;
    subtotal: number;
    isCompliment?: boolean;
  }>;
};

export type TransactionItemsGroupedResponse = {
  from: string;
  to: string;
  includeVoid: boolean;
  groups: Array<{
    saleId: string;
    saleCode: string;
    bookingCode: string;
    paidAt: string;
    paidYmd: string;
    customerName: string;
    customerPhone: string;
    barber: string;
    status: "Paid" | "Void";
    total: number;
    discountTotal: number;
    items: Array<{
      type: "service" | "product";
      kode: string;
      nama: string;
      qty: number;
      harga: number;
      subtotal: number;
      isCompliment?: boolean;
    }>;
  }>;
};

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
  isCompliment?: boolean;
}

export interface PayResponse {
  id: string;
  bookingCode: string;
  paymentStatus: "Paid";
  paidAt: string;
  saleId: string;
  saleCode?: string;
  customerName: string;
  customerPhone: string;
  items: SaleItem[];
  loyaltyEarnedRp?: number;
  pointsEarned?: number;
  total: number;
  received: number;
  change: number;
}

export interface SaleListItem {
  id: string;
  bookingCode: string;
  saleCode?: string;
  employeeName: string;
  total: number;
  method: "Cash" | "QRIS" | "Transfer" | "Legacy";
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
  reason: "sale" | "void" | "adjust";
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

export interface PointSetting {
  id: string;
  mode: "per_transaction" | "per_rupiah";
  pointsPerTransaction: number;
  rupiahStep: number;
  pointsPerStep: number;
}

export interface CustomerItem {
  id: string;
  phone: string;
  name: string;
  isMember: boolean;
  pointsBalance: number;
  visitCount: number;
  lastVisitAt?: string;
  createdAt: string;
}

export type PublicProductsLite = Array<{ kode: string; nama: string }>;

export const api = {
  login: (username: string, password: string) => request<{ user: UserItem; token: string }>("/auth/login", "POST", { username, password }),


  getEmployees: () => request<Employee[]>("/pegawai"),
  createEmployee: (payload: Omit<Employee, "id">) => request<Employee>("/pegawai", "POST", payload),
  updateEmployee: (id: string, payload: Omit<Employee, "id">) => request<Employee>(`/pegawai/${id}`, "PUT", payload),
  deleteEmployee: (id: string) => request<void>(`/pegawai/${id}`, "DELETE"),

  getServices: () => request<Service[]>("/layanan"),
  createService: (payload: Omit<Service, "id">) => request<Service>("/layanan", "POST", payload),
  updateService: (id: string, payload: Omit<Service, "id">) => request<Service>(`/layanan/${id}`, "PUT", payload),
  bulkUpdateServiceCommission: (payload: { ids: string[]; type_komisi: "persentase" | "rupiah"; nilai_komisi: number }) =>
    request<{ matchedCount: number; modifiedCount: number; type_komisi: "persentase" | "rupiah"; nilai_komisi: number }>(
      "/layanan/commission/bulk",
      "PATCH",
      payload,
    ),
  deleteService: (id: string) => request<void>(`/layanan/${id}`, "DELETE"),

  getProducts: () => request<Product[]>("/produk"),
  getLowStockProducts: () => request<Product[]>("/produk/low-stock"),
  createProduct: (payload: Omit<Product, "id">) => request<Product>("/produk", "POST", payload),
  updateProduct: (id: string, payload: Omit<Product, "id">) => request<Product>(`/produk/${id}`, "PUT", payload),
  bulkUpdateProductCommission: (payload: { ids: string[]; type_komisi: "persentase" | "rupiah"; nilai_komisi: number }) =>
    request<{ matchedCount: number; modifiedCount: number; type_komisi: "persentase" | "rupiah"; nilai_komisi: number }>(
      "/produk/commission/bulk",
      "PATCH",
      payload,
    ),
  deleteProduct: (id: string) => request<void>(`/produk/${id}`, "DELETE"),
  adjustProductStock: (id: string, delta: number) => request<Product>(`/produk/${id}/adjust-stock`, "PATCH", { delta }),

  cashIn: (amount: number, description: string) => request(`/cash/in`, "POST", { amount, description }),
  cashOut: (amount: number, description: string) => request(`/cash/out`, "POST", { amount, description }),
  getCashMovements: (params?: { from?: string; to?: string; direction?: "in" | "out" }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.direction) query.set("direction", params.direction);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<Array<{ id: string; ymd: string; direction: "in" | "out"; amount: number; description: string; createdBy: string; createdAt: string }>>(
      `/cash/movements${suffix}`,
    );
  },

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
  getPublicBranch: () => request<Branch>("/public/branch"),
  getBranchByDomain: (domain: string) => {
    const query = new URLSearchParams();
    query.set("domain", domain);
    return request<Branch>(`/branches/by-domain?${query.toString()}`);
  },
  getPublicTicket: (token: string) => request<PublicTicket>(`/public/ticket/${encodeURIComponent(token)}`),
  getPublicReceipt: (token: string) => request<PublicReceipt>(`/public/receipt/${encodeURIComponent(token)}`),
  waConnect: () => request<WhatsAppStatus>("/wa/connect", "POST"),
  waStatus: () => request<WhatsAppStatus>("/wa/status"),
  waQr: () =>
    request<{
      qrDataUrl: string;
      status: WhatsAppStatus["status"];
      me?: string;
      lastError?: string;
      lastErrorDetail?: unknown;
    }>(
      "/wa/qr",
    ),
  waRefreshQr: () =>
    request<{
      qrDataUrl: string;
      status: WhatsAppStatus["status"];
      me?: string;
      lastError?: string;
      lastErrorDetail?: unknown;
    }>(
      "/wa/refresh-qr",
      "POST",
    ),
  waLogout: () => request<WhatsAppStatus>("/wa/logout", "POST"),

  getUsers: () => request<UserItem[]>("/users"),
  createUser: (payload: { username: string; password: string; level: string }) => request<UserItem>("/users", "POST", payload),
  updateUser: (id: string, payload: { username: string; password?: string; level: string }) => request<UserItem>(`/users/${id}`, "PUT", payload),
  deleteUser: (id: string) => request<void>(`/users/${id}`, "DELETE"),

  getAccessByUsername: (username: string) => request<{ username: string; menuAccess: string[] }>(`/access/${username}`),
  saveAccessByUsername: (username: string, menuAccess: string[]) => request<{ username: string; menuAccess: string[] }>(`/access/${username}`, "PUT", { menuAccess }),

  getCommissionSetting: () => request<CommissionSetting>("/settings/commission"),
  updateCommissionSetting: (payload: { tipe: "persentase" | "rupiah"; nilai: number }) => request<CommissionSetting>("/settings/commission", "PUT", payload),

  // Legacy (kept for compatibility, not used by new UI)
  getLoyaltySetting: () => request<LoyaltySetting>("/settings/loyalty"),
  updateLoyaltySetting: (payload: { tipe: "persentase" | "rupiah"; nilai: number }) => request<LoyaltySetting>("/settings/loyalty", "PUT", payload),

  getPointSetting: () => request<PointSetting>("/settings/points"),
  updatePointSetting: (payload: { mode: PointSetting["mode"]; pointsPerTransaction: number; rupiahStep: number; pointsPerStep: number }) =>
    request<PointSetting>("/settings/points", "PUT", payload),

  getCustomers: (params?: { q?: string; memberOnly?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.q) query.set("q", params.q);
    if (params?.memberOnly) query.set("memberOnly", "1");
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<CustomerItem[]>(`/customer${suffix}`);
  },
  createCustomer: (payload: { phone?: string; name: string; isMember: boolean }) => request<CustomerItem>("/customer", "POST", payload),
  updateCustomer: (id: string, payload: { phone?: string; name: string; isMember: boolean }) =>
    request<CustomerItem>(`/customer/${id}`, "PUT", payload),
  deleteCustomer: (id: string) => request<void>(`/customer/${id}`, "DELETE"),
  getCustomerSales: (id: string) =>
    request<Array<{ id: string; bookingCode: string; total: number; status: "Paid" | "Void"; paidAt: string; paidYmd: string }>>(
      `/customer/${id}/sales`,
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
  getPublicBookings: (codes: string[]) => {
    const query = new URLSearchParams();
    query.set("codes", codes.join(","));
    return request<PublicBookingStatus[]>(`/bookings/public?${query.toString()}`);
  },
  getQueuePreview: () => request<QueuePreview>("/bookings/queue-preview"),
  createBooking: (payload: { customerName: string; phone: string; employeeName?: string; services: BookingService[]; branchDomain?: string }) =>
    request<BookingItem>("/bookings", "POST", payload),
  payBooking: (id: string, received: number) => request<PayResponse>(`/bookings/${id}/pay`, "POST", { received }),
  createDirectSale: (payload: {
    customerType: "member" | "regular";
    customerName?: string;
    customerPhone?: string;
    items: Array<{ kode: string; qty: number; isCompliment?: boolean }>;
    received: number;
  }) => request<PayResponse>("/sales", "POST", payload),
  addServiceToBooking: (id: string, serviceKode: string) => request<{ id: string; bookingCode: string; services: BookingService[] }>(`/bookings/${id}/add-service`, "POST", { serviceKode }),
  addProductToBooking: (id: string, productKode: string, qty: number, isCompliment?: boolean) =>
    request<{ id: string; bookingCode: string; products: BookingProduct[] }>(`/bookings/${id}/add-product`, "POST", { productKode, qty, isCompliment: Boolean(isCompliment) }),
  removeProductFromBooking: (id: string, productKode: string, isCompliment?: boolean) => {
    const suffix = isCompliment ? "?isCompliment=1" : "";
    return request<{ id: string; bookingCode: string; products: BookingProduct[] }>(
      `/bookings/${id}/products/${encodeURIComponent(productKode)}${suffix}`,
      "DELETE",
    );
  },
  assignBooking: (id: string, employeeName: string) => request(`/bookings/${id}/assign`, "PATCH", { employeeName }),
  completeBooking: (id: string) => request(`/bookings/${id}/complete`, "PATCH"),
  saveBookingHaircutPhotos: (id: string, payload: Partial<Pick<HaircutPhotoSet, "depan" | "kiri" | "kanan" | "belakang">>) =>
    request<{ id: string; bookingCode: string; customerId?: string; foto: HaircutPhotoSet[] }>(`/bookings/${id}/haircut-photos`, "PATCH", payload),
  getBookingHaircutPhotosByCode: (bookingCode: string) =>
    request<{ bookingCode: string; foto: HaircutPhotoSet[] }>(`/bookings/by-code/${encodeURIComponent(bookingCode)}/haircut-photos`),

  getDashboard: () => request<DashboardPayload>("/dashboard"),
  getFinanceReport: (params?: {
    from?: string;
    to?: string;
    view?: "recap" | "detail";
    jenisTrx?: "all" | "layanan" | "produk" | "kas";
    kategori?: string;
  }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.view) query.set("view", params.view);
    if (params?.jenisTrx) query.set("jenisTrx", params.jenisTrx);
    if (params?.kategori) query.set("kategori", params.kategori);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<FinanceRow[]>(`/reports/finance${suffix}`);
  },
  getFinanceCategories: (params?: { from?: string; to?: string; jenisTrx?: "all" | "layanan" | "produk" | "kas" }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.jenisTrx) query.set("jenisTrx", params.jenisTrx);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<string[]>(`/reports/finance/categories${suffix}`);
  },

  publicMemberLookup: (phone: string) => {
    const query = new URLSearchParams();
    query.set("phone", phone);
    return request<{ found: boolean; name: string }>(`/public/member-lookup?${query.toString()}`);
  },

  getPublicProductsLite: () => request<PublicProductsLite>(`/public/products-lite`),
  getEmployeeReport: (params?: { from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<EmployeeReportRow[]>(`/reports/employees${suffix}`);
  },

  getTransactionRecap: (params?: { from?: string; to?: string }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<TransactionRecapResponse>(`/reports/transactions/recap${suffix}`);
  },
  getTransactionDetails: (params?: { from?: string; to?: string; q?: string; includeVoid?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.q) query.set("q", params.q);
    if (params?.includeVoid) query.set("includeVoid", "1");
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<TransactionDetailRow[]>(`/reports/transactions/details${suffix}`);
  },
  getTransactionItems: (params: { saleId?: string; saleCode?: string; bookingCode?: string }) => {
    const query = new URLSearchParams();
    if (params.saleId) query.set("saleId", params.saleId);
    if (params.saleCode) query.set("saleCode", params.saleCode);
    if (params.bookingCode) query.set("bookingCode", params.bookingCode);
    return request<TransactionItemsResponse>(`/reports/transactions/items?${query.toString()}`);
  },
  getTransactionItemsGrouped: (params?: { from?: string; to?: string; q?: string; includeVoid?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.from) query.set("from", params.from);
    if (params?.to) query.set("to", params.to);
    if (params?.q) query.set("q", params.q);
    if (params?.includeVoid) query.set("includeVoid", "1");
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<TransactionItemsGroupedResponse>(`/reports/transactions/items-grouped${suffix}`);
  },
};
