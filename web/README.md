# README Frontend (`web/`)

Dokumen ini merangkum perubahan frontend terbaru agar sinkron dengan backend saat ini.

## Ringkasan Perubahan Terbaru

1. Field komisi master layanan/produk sudah full pakai:
- `type_komisi`
- `nilai_komisi`

2. Fitur bulk edit komisi tetap tersedia di:
- `Master Layanan`
- `Master Produk`

3. Data foto booking berubah mengikuti backend:
- dari `haircutPhotos` object
- menjadi `foto` array

4. Key foto yang digunakan UI sekarang:
- `depan`, `kiri`, `kanan`, `belakang`

5. Viewer foto (di Booked dan Riwayat Transaksi) tetap mendukung:
- klik foto untuk modal preview
- zoom in / zoom out via tombol

6. Select status di halaman Booked sudah disesuaikan typing-nya agar tidak error TypeScript (`onValueChange`).

## Halaman Yang Diubah

## 1) `src/pages/MasterLayanan.tsx`
Perubahan:
- Form komisi pakai `type_komisi` dan `nilai_komisi`
- Payload create/update service pakai field baru
- Bulk update komisi layanan pakai field baru
- Kolom tabel komisi baca field baru

## 2) `src/pages/MasterProduk.tsx`
Perubahan:
- Form komisi pakai `type_komisi` dan `nilai_komisi`
- Payload create/update product pakai field baru
- Bulk update komisi produk pakai field baru
- Kolom tabel komisi baca field baru

## 3) `src/pages/BookedList.tsx`
Perubahan:
- Foto booking sekarang baca dari `booking.foto?.[0]`
- Slot upload/preview menggunakan key:
  - `depan`
  - `kiri`
  - `kanan`
  - `belakang`
- Indikator `Foto tersimpan: x/4` hitung dari struktur `foto` baru
- `Select` status diperbaiki typing handler agar lolos TS

## 4) `src/pages/RiwayatTransaksi.tsx`
Perubahan:
- Modal lihat foto (icon mata) sekarang baca response:
  - `{ bookingCode, foto: [...] }`
- Slot tampilan mengikuti key `depan/kiri/kanan/belakang`
- Tetap bisa klik untuk preview + zoom

## 5) `src/lib/api.ts`
Perubahan type dan contract:
- `Service`:
  - `type_komisi`
  - `nilai_komisi`
- `Product`:
  - `type_komisi`
  - `nilai_komisi`
- `HaircutPhotoSet`:
  - `depan`, `kiri`, `kanan`, `belakang`
- `BookingItem`:
  - `foto?: HaircutPhotoSet[]`
- API foto booking:
  - `saveBookingHaircutPhotos(...)` kirim field `depan/kiri/kanan/belakang`
  - `getBookingHaircutPhotosByCode(...)` menerima response `foto` array

## Cara Pakai Fitur (User)

## A. Set komisi massal layanan
1. Buka `Master Layanan`.
2. Centang beberapa layanan.
3. Pilih tipe komisi + isi nilai.
4. Klik `Terapkan`.

## B. Set komisi massal produk
1. Buka `Master Produk`.
2. Centang beberapa produk.
3. Pilih tipe komisi + isi nilai.
4. Klik `Terapkan`.

## C. Booking + barberman
1. Buka `Input Booking`.
2. Isi customer dan layanan.
3. Pilih barberman (opsional).
4. Simpan booking.

Catatan:
- Jika barberman tidak dipilih, booking tetap bisa tersimpan (status awal menunggu).

## D. Upload foto hasil cukur
1. Buka `Booked`.
2. Klik `Foto Hasil Cukur` pada card booking.
3. Upload per sisi (`depan/kiri/kanan/belakang`).
4. Klik `Simpan Foto`.

## E. Lihat foto dari riwayat transaksi
1. Buka `Riwayat Transaksi`.
2. Klik icon mata di kolom aksi.
3. Lihat 4 sisi foto, klik foto untuk modal zoom.

## Catatan Teknis

1. URL/path foto yang diterima frontend bisa berupa `/uploads/...`, lalu di-resolve ke origin API.
2. Frontend tetap melakukan kompresi gambar sebelum upload untuk efisiensi.
3. Perubahan ini menjaga kompatibilitas UX lama sambil mengikuti struktur data backend terbaru.

## Validasi Yang Sudah Dicek

Perubahan terbaru sudah lolos:
```bash
npx tsc --noEmit
npm run build
```

## Referensi File FE Yang Terkait

- `src/lib/api.ts`
- `src/pages/MasterLayanan.tsx`
- `src/pages/MasterProduk.tsx`
- `src/pages/BookedList.tsx`
- `src/pages/RiwayatTransaksi.tsx`
- `src/pages/InputBooking.tsx`
- `src/pages/SettingKomisi.tsx`
