
# Sistem Manajemen Barbershop

## Gambaran Umum
Proyek ini adalah Sistem Manajemen Barbershop yang terdiri dari dua bagian utama:
- **server/**: Backend REST API menggunakan Node.js, Express, dan MongoDB.
- **web/**: Aplikasi web frontend menggunakan React, Vite, dan Tailwind CSS.

---

## Fitur
- Manajemen booking/pemesanan
- Manajemen pelanggan/member
- Antrian & transaksi kasir
- Laporan keuangan, stok, dan pegawai
- Integrasi WhatsApp untuk notifikasi
- Autentikasi pengguna & hak akses
- Pembuatan PDF struk & tiket

---

## Struktur Proyek
```
barbershop/
  server/   # Backend API (Node.js, Express, MongoDB)
  web/      # Frontend (React, Vite, Tailwind)
```

### server/
- `src/index.js`: Aplikasi utama Express, autentikasi JWT, koneksi MongoDB, routing API
- `src/pdfUtils.js`: Utilitas pembuatan PDF
- `src/waGateway.js`: Integrasi gateway WhatsApp
- `scripts/`: Script migrasi database
- `.env.example`: Contoh variabel lingkungan

### web/
- `src/`: Komponen React, halaman, hooks, dan utilitas
- `public/`: Aset statis
- `.env.example`: Contoh variabel lingkungan frontend

---

## Kebutuhan Sistem
- Node.js (disarankan v18+)
- npm
- MongoDB

---

## Cara Cepat Menjalankan (Local Development)

### 1. Clone repository
```sh
git clone <repo-url>
cd barbershop
```

### 2. Setup Backend (server)
```sh
cd server
cp .env.example .env # Edit file .env sesuai kebutuhan
npm install
npm run dev
```

### 3. Setup Frontend (web)
```sh
cd ../web
cp .env.example .env # Edit file .env sesuai kebutuhan
npm install
npm run dev
```

Backend berjalan di `http://localhost:3001`, frontend di `http://localhost:8080`.

---

## Panduan Deploy Jaringan (Network Deployment)

### 1. Siapkan Server
- Pastikan Node.js dan MongoDB sudah terinstall di server.
- Buka port yang diperlukan (default: 3001 untuk API, 8080 untuk web).

### 2. Deploy Backend (server)
- Salin folder `server/` ke server.
- Atur file `.env` dengan nilai produksi (MongoDB URI, JWT secret, dll).
- Install dependensi: `npm install`
- Jalankan server: `npm run start`
- (Opsional) Gunakan process manager (misal: PM2) untuk produksi.

### 3. Deploy Frontend (web)
- Salin folder `web/` ke server.
- Atur file `.env` dengan API base URL yang mengarah ke endpoint API server.
- Install dependensi: `npm install`
- Build frontend: `npm run build`
- Layani folder `dist/` menggunakan static file server (misal: nginx, serve, atau Vite preview).

### 4. Konfigurasi Reverse Proxy (Rekomendasi)
- Gunakan nginx atau Caddy untuk proxy request:
  - `/api` → backend server (Node.js)
  - `/` → file statis frontend

### 5. Variabel Lingkungan
- Lihat `.env.example` di `server/` dan `web/` untuk variabel yang dibutuhkan.

---

## Catatan Tambahan
- Untuk integrasi WhatsApp, pastikan server dapat diakses dari internet jika menggunakan webhook.
- Amankan file `.env` dan jangan pernah commit data rahasia ke version control.
- Untuk kustomisasi lebih lanjut, lihat kode dan komentar di setiap modul.

---

## Lisensi
MIT
