# README Frontend (`web/`)

Dokumen ini menjelaskan perubahan frontend terbaru untuk fitur:
1. Komisi per layanan dan per produk.
2. Bulk edit komisi di Master Layanan dan Master Produk.
3. Simpan foto hasil cukur terakhir (depan, kiri, kanan, belakang).
4. Pilih barberman saat input booking.

## Ringkasan Perubahan UI

### 1) Master Layanan
Halaman: `src/pages/MasterLayanan.tsx`

Perubahan:
- Tambah field komisi pada form layanan:
  - `Tipe Komisi`: Persentase (%) / Nominal (Rp)
  - `Nilai Komisi`
- Tabel layanan sekarang menampilkan kolom `Komisi`.
- Tambah area `Bulk Edit Komisi`:
  - Multi-select baris layanan (checkbox)
  - `Pilih Semua`
  - `Terapkan (n)` ke banyak layanan sekaligus

API yang dipakai:
- `GET /api/layanan`
- `POST /api/layanan`
- `PUT /api/layanan/:id`
- `PATCH /api/layanan/commission/bulk`

### 2) Master Produk
Halaman: `src/pages/MasterProduk.tsx`

Perubahan:
- Tambah field komisi pada form produk:
  - `Tipe Komisi`
  - `Nilai Komisi`
- Tabel produk sekarang menampilkan kolom `Komisi`.
- Tambah area `Bulk Edit Komisi` dengan pola yang sama seperti layanan.

API yang dipakai:
- `GET /api/produk`
- `POST /api/produk`
- `PUT /api/produk/:id`
- `PATCH /api/produk/commission/bulk`

### 3) Input Booking - pilih barberman
Halaman: `src/pages/InputBooking.tsx`

Perubahan:
- Ditambahkan dropdown `Pilih Barberman (Opsional)`.
- Nilai barberman dikirim sebagai `employeeName` saat create booking.

Dampak alur:
- Jika barberman dipilih, booking akan langsung masuk status `Proses` (di-handle backend).

API yang dipakai:
- `POST /api/bookings`

### 4) Booked - simpan foto hasil cukur
Halaman: `src/pages/BookedList.tsx`

Perubahan:
- Tiap kartu booking sekarang ada tombol `Foto Hasil Cukur`.
- Dialog upload 4 sisi:
  - Tampak Depan (`front`)
  - Samping Kiri (`left`)
  - Samping Kanan (`right`)
  - Tampak Belakang (`back`)
- Tersedia preview foto sebelum simpan.
- Gambar dikompres di sisi frontend sebelum dikirim (canvas + JPEG quality) untuk menekan ukuran payload.
- Menampilkan indikator jumlah foto tersimpan (`x/4`) pada kartu booking.

API yang dipakai:
- `PATCH /api/bookings/:id/haircut-photos`

### 5) Setting Komisi (legacy info)
Halaman: `src/pages/SettingKomisi.tsx`

Perubahan:
- Halaman tidak lagi dipakai untuk set komisi global.
- Diganti menjadi info bahwa komisi diatur di:
  - Master Layanan
  - Master Produk

## Perubahan Type/API Client

File: `src/lib/api.ts`

Perubahan utama:
- `Service` menambah:
  - `commissionType`
  - `commissionValue`
- `Product` menambah:
  - `commissionType`
  - `commissionValue`
- `BookingItem` menambah:
  - `haircutPhotos`
- Tambah type:
  - `HaircutPhotoSet`
- Tambah method API:
  - `bulkUpdateServiceCommission(...)`
  - `bulkUpdateProductCommission(...)`
  - `saveBookingHaircutPhotos(...)`

## Cara Menggunakan Fitur (Panduan User)

### A. Set komisi massal layanan
1. Buka menu `Master Layanan`.
2. Centang layanan yang ingin diubah.
3. Isi `Bulk Edit Komisi`:
   - Pilih tipe (`Persentase` atau `Nominal`)
   - Isi nilai
4. Klik `Terapkan`.
5. Jika ada pengecualian, edit layanan satuan via tombol edit.

### B. Set komisi massal produk
1. Buka menu `Master Produk`.
2. Centang produk yang ingin diubah.
3. Isi `Bulk Edit Komisi`.
4. Klik `Terapkan`.
5. Lakukan fine-tuning per produk jika ada yang berbeda.

### C. Buat booking dengan barberman
1. Buka menu `Input Booking`.
2. Isi data customer + pilih layanan.
3. Pilih barberman di field `Pilih Barberman (Opsional)`.
4. Simpan booking.

Hasil:
- Booking tersimpan dan bisa langsung diproses sesuai barber yang dipilih.

### D. Simpan foto hasil cukur terakhir
1. Buka menu `Booked`.
2. Pilih kartu booking target.
3. Klik `Foto Hasil Cukur`.
4. Upload foto untuk 4 sisi (boleh parsial).
5. Cek preview.
6. Klik `Simpan Foto`.

Tips:
- Foto dipotret dengan pencahayaan konsisten agar hasil before/after lebih mudah dibandingkan.
- Untuk performa, gunakan ukuran foto wajar (frontend sudah otomatis kompres).

## Catatan Teknis Implementasi Frontend

- Komponen baru tidak menambah route baru; seluruh fitur disisipkan ke halaman yang sudah ada.
- Perubahan tetap menjaga pola existing UI (Card/Dialog/Button/Select dari komponen internal).
- Alur lama tetap berjalan:
  - booking, assign/proses, kasir, laporan.
- Halaman `Setting Komisi` dipertahankan sebagai jalur transisi UX agar user lama tidak bingung.

## Checklist Uji Manual (Frontend)

1. Buka `Master Layanan`, pastikan kolom komisi tampil.
2. Coba bulk update komisi 2+ layanan.
3. Buka `Master Produk`, ulangi bulk update.
4. Buat booking baru, pilih barberman, simpan.
5. Buka `Booked`, upload 1-4 foto hasil cukur, simpan.
6. Pastikan toast sukses muncul dan data tetap tampil setelah reload.
7. Buka `Setting Komisi`, pastikan tampil sebagai info legacy.

## Validasi Build

Build frontend sudah diuji:
```bash
npm run build
```

Status:
- Berhasil build.
- Ada warning ukuran chunk besar dari Vite (non-blocking, sudah ada sejak sebelumnya).

## Referensi File yang Diubah

- `src/lib/api.ts`
- `src/pages/MasterLayanan.tsx`
- `src/pages/MasterProduk.tsx`
- `src/pages/InputBooking.tsx`
- `src/pages/BookedList.tsx`
- `src/pages/SettingKomisi.tsx`

