# README Backend (`server/`)

Dokumen ini menjelaskan perubahan backend terbaru untuk fitur:
1. Komisi per layanan dan per produk (menggantikan komisi global).
2. Bulk update komisi untuk layanan dan produk.
3. Penyimpanan foto hasil cukur terakhir (depan, kiri, kanan, belakang).
4. Pemilihan barberman saat booking.

## Ringkasan Perubahan

### 1) Komisi sekarang item-based (per layanan/per produk)
Sebelumnya komisi dihitung dari `tp_komisi` (global per transaksi). Sekarang komisi dihitung per item transaksi berdasarkan konfigurasi master:
- `tm_layanan.commissionType`, `tm_layanan.commissionValue`
- `tm_produk.commissionType`, `tm_produk.commissionValue`

Saat pembayaran booking (`POST /api/bookings/:id/pay`):
- Sistem ambil konfigurasi komisi dari master layanan dan produk.
- Setiap item transaksi menyimpan:
  - `commissionType`
  - `commissionValue`
  - `commissionEarned`
- `tt_transaksi.komisi_didapat` menjadi total dari `commissionEarned` semua item.
- `tt_transaksi.tipe_komisi` diisi `itemized`.

Catatan:
- Endpoint `GET/PUT /api/settings/commission` masih ada untuk kompatibilitas lama, tetapi tidak dipakai lagi dalam hitung komisi booking.

### 2) Bulk update komisi
Ditambahkan endpoint mass update untuk mengurangi set satu per satu:
- `PATCH /api/layanan/commission/bulk`
- `PATCH /api/services/commission/bulk` (alias)
- `PATCH /api/produk/commission/bulk`
- `PATCH /api/products/commission/bulk` (alias)

### 3) Foto hasil cukur terakhir
Ditambahkan endpoint baru:
- `PATCH /api/bookings/:id/haircut-photos`

Payload menerima salah satu/beberapa field:
- `front`
- `left`
- `right`
- `back`

Format yang diterima:
- URL gambar (`http://` / `https://`), atau
- Data URL base64 (`data:image/...;base64,...`)

Saat simpan:
- File disimpan fisik ke folder `server/uploads/haircut-photos`
- URL file disimpan ke `tt_booking.haircutPhotos` (bukan base64)
- Jika customer ada/terdeteksi, juga disimpan ke `tm_customer.lastHaircutPhotos`

### 4) Pilih barber saat booking
Pada endpoint create booking (`POST /api/bookings`):
- Jika `employeeName` diisi, maka `status` booking otomatis `Proses`.
- Jika kosong, tetap `Menunggu`.

## Detail Model/Schema yang Diubah

### `tm_layanan` (`serviceSchema`)
Tambahan field:
- `commissionType`: `"persentase" | "rupiah"`, default `"persentase"`
- `commissionValue`: number, default `0`

### `tm_produk` (`productSchema`)
Tambahan field:
- `commissionType`: `"persentase" | "rupiah"`, default `"persentase"`
- `commissionValue`: number, default `0`

### `tt_transaksi.item` (`saleItemSchema`)
Tambahan field:
- `commissionType`
- `commissionValue`
- `commissionEarned`

### `tt_transaksi` (`saleSchema`)
Perubahan:
- `tipe_komisi` enum menambah nilai `"itemized"`

### `tt_booking` (`bookingSchema`)
Tambahan field:
- `haircutPhotos`:
  - `front`
  - `left`
  - `right`
  - `back`
  - `updatedAt`

### `tm_customer` (`customerSchema`)
Tambahan field:
- `lastHaircutPhotos` (struktur sama seperti `haircutPhotos` pada booking)

## Endpoint Baru/Diubah

### A. Layanan

#### GET `/api/layanan` / GET `/api/services`
Sekarang response layanan mengandung:
- `commissionType`
- `commissionValue`

#### POST `/api/layanan` / POST `/api/services`
Sekarang bisa menerima:
- `commissionType`
- `commissionValue`

#### PUT `/api/layanan/:id` / PUT `/api/services/:id`
Sekarang bisa update:
- `commissionType`
- `commissionValue`

#### PATCH `/api/layanan/commission/bulk`
Role: `Owner`, `Admin`

Body:
```json
{
  "ids": ["<serviceId1>", "<serviceId2>"],
  "commissionType": "persentase",
  "commissionValue": 10
}
```

Response:
```json
{
  "matchedCount": 2,
  "modifiedCount": 2,
  "commissionType": "persentase",
  "commissionValue": 10
}
```

### B. Produk

#### GET `/api/produk` / GET `/api/products`
Sekarang response produk mengandung:
- `commissionType`
- `commissionValue`

#### POST `/api/produk` / POST `/api/products`
Sekarang bisa menerima:
- `commissionType`
- `commissionValue`

#### PUT `/api/produk/:id` / PUT `/api/products/:id`
Sekarang bisa update:
- `commissionType`
- `commissionValue`

#### PATCH `/api/produk/commission/bulk`
Role: `Owner`, `Admin`

Body:
```json
{
  "ids": ["<productId1>", "<productId2>"],
  "commissionType": "rupiah",
  "commissionValue": 5000
}
```

Response:
```json
{
  "matchedCount": 2,
  "modifiedCount": 2,
  "commissionType": "rupiah",
  "commissionValue": 5000
}
```

### C. Booking - Simpan Foto Hasil Cukur

#### PATCH `/api/bookings/:id/haircut-photos`
Role: `Owner`, `Admin`, `Pegawai`

Body (contoh data URL):
```json
{
  "front": "data:image/jpeg;base64,...",
  "left": "data:image/jpeg;base64,...",
  "right": "data:image/jpeg;base64,...",
  "back": "data:image/jpeg;base64,..."
}
```

Body juga bisa parsial (misalnya hanya `front`).

Catatan penyimpanan:
- Jika body berisi data URL base64, backend akan membuat file di `uploads/haircut-photos` lalu menyimpan URL publik file tersebut ke MongoDB.
- Jika body berisi string kosong (`\"\"`), foto pada sisi itu dihapus dan file lokal lama (jika ada) ikut dibersihkan.

Response:
```json
{
  "id": "<bookingId>",
  "bookingCode": "BK-260422-001",
  "customerId": "<optionalCustomerId>",
  "haircutPhotos": {
    "front": "...",
    "left": "...",
    "right": "...",
    "back": "...",
    "updatedAt": "2026-04-22T...Z"
  }
}
```

Validasi:
- Minimal ada 1 field foto yang dikirim.
- Format foto harus URL atau data URL.
- Ada batas panjang string untuk mencegah payload terlalu besar.

## Perubahan Response Booking

### GET `/api/bookings`
Sekarang menambahkan:
- `haircutPhotos`

### POST `/api/bookings`
Sekarang menambahkan:
- `haircutPhotos`

## Perubahan Konfigurasi Express

`express.json()` diubah menjadi:
- `express.json({ limit: "8mb" })`

Tujuan:
- Mengizinkan upload foto base64 dari frontend.
- Menyiapkan static file server untuk folder upload: `/uploads/*`.

## Cara Menggunakan Fitur (Backend Perspective)

### 1) Setup komisi awal layanan/produk
1. Panggil `PATCH /api/layanan/commission/bulk` untuk set mayoritas layanan.
2. Panggil `PATCH /api/produk/commission/bulk` untuk set mayoritas produk.
3. Jika ada item khusus, lakukan edit satuan via `PUT /api/layanan/:id` atau `PUT /api/produk/:id`.

### 2) Alur booking + barber
1. Buat booking via `POST /api/bookings`.
2. Isi `employeeName` jika barber sudah dipilih dari awal.
3. Booking langsung masuk status `Proses` jika barber diisi.

### 3) Simpan foto hasil cukur
1. Setelah atau saat proses haircut, upload foto via `PATCH /api/bookings/:id/haircut-photos`.
2. Data otomatis tersimpan ke booking dan customer (jika customer ditemukan/terhubung).

### 4) Pembayaran + komisi
1. Bayar booking via `POST /api/bookings/:id/pay`.
2. Komisi dihitung otomatis berdasarkan komisi per item.
3. Laporan pegawai tetap membaca `komisi_didapat` dari transaksi yang sudah itemized.

## Kompatibilitas & Catatan Operasional

- Endpoint alias Indonesia/English tetap dipertahankan (`/layanan` & `/services`, `/produk` & `/products`).
- Endpoint setting komisi global belum dihapus untuk menghindari breaking change API lama.
- Disarankan frontend mengirim gambar yang sudah dikompres untuk efisiensi bandwidth.
- Untuk data lama yang belum punya `commissionType` / `commissionValue`, sistem fallback ke default:
  - `commissionType: "persentase"`
  - `commissionValue: 0`

## Quick Smoke Test (Manual)

1. Login sebagai `Owner`/`Admin`.
2. Cek `GET /api/layanan` dan pastikan field komisi muncul.
3. Cek `GET /api/produk` dan pastikan field komisi muncul.
4. Lakukan `PATCH /api/layanan/commission/bulk` dengan 2+ ID.
5. Buat booking dengan `employeeName` terisi.
6. Upload foto haircut via `PATCH /api/bookings/:id/haircut-photos`.
7. Bayar booking, lalu cek transaksi/laporan pegawai dan verifikasi komisi terhitung.

## Referensi Implementasi

File utama perubahan backend:
- `server/src/index.js`
