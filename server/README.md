# README Backend (`server/`)

Dokumen ini menjelaskan perubahan backend terbaru pada aplikasi barber, termasuk update model komisi dan foto hasil cukur.

## Ringkasan Perubahan Terbaru

1. Komisi master layanan dan produk menggunakan field baru:
- `type_komisi`
- `nilai_komisi`

2. Komisi item transaksi (`tt_transaksi.item`) juga sudah konsisten:
- `type_komisi`
- `nilai_komisi`
- `komisi_didapat`

3. Foto hasil cukur pada booking berubah dari object tunggal ke array:
- dari `tt_booking.haircutPhotos`
- menjadi `tt_booking.foto` (array)

4. Struktur key foto booking berubah:
- `front` -> `depan`
- `left` -> `kiri`
- `right` -> `kanan`
- `back` -> `belakang`

5. File upload foto disimpan di folder backend:
- `server/uploads/haircut-photos`
- yang disimpan di MongoDB adalah path relatif, contoh: `/uploads/haircut-photos/<nama-file>.jpg`

## Perubahan Model / Schema

## 1) `tm_layanan`
Field komisi:
- `type_komisi`: `"persentase" | "rupiah"`
- `nilai_komisi`: `number`

## 2) `tm_produk`
Field komisi:
- `type_komisi`: `"persentase" | "rupiah"`
- `nilai_komisi`: `number`

## 3) `tt_transaksi.item` (`saleItemSchema`)
Field komisi item:
- `type_komisi`
- `nilai_komisi`
- `komisi_didapat`

## 4) `tt_transaksi` (`saleSchema`)
Header transaksi tetap menyimpan ringkasan:
- `tipe_komisi` (untuk flow itemized menggunakan nilai `itemized`)
- `nilai_komisi`
- `komisi_didapat` (total komisi transaksi)

## 5) `tt_booking`
Foto hasil cukur booking:
- `foto: [{ depan, kiri, kanan, belakang, updatedAt }]`

## 6) `tm_customer`
Tetap menyimpan cache foto terakhir customer untuk fallback:
- `lastHaircutPhotos` (format legacy internal: `front/left/right/back`)

Catatan: backend melakukan mapping otomatis antara format booking terbaru (`depan/kiri/kanan/belakang`) dan cache customer lama supaya transisi data tetap aman.

## Endpoint Yang Berkaitan

## A. Layanan / Produk (Komisi)

### Layanan
- `GET /api/layanan`
- `POST /api/layanan`
- `PUT /api/layanan/:id`
- `PATCH /api/layanan/commission/bulk`

Alias:
- `GET /api/services`
- `POST /api/services`
- `PUT /api/services/:id`
- `PATCH /api/services/commission/bulk`

Payload komisi:
```json
{
  "type_komisi": "persentase",
  "nilai_komisi": 10
}
```

### Produk
- `GET /api/produk`
- `POST /api/produk`
- `PUT /api/produk/:id`
- `PATCH /api/produk/commission/bulk`

Alias:
- `GET /api/products`
- `POST /api/products`
- `PUT /api/products/:id`
- `PATCH /api/products/commission/bulk`

Payload komisi:
```json
{
  "type_komisi": "rupiah",
  "nilai_komisi": 5000
}
```

## B. Booking - Foto Hasil Cukur

### Simpan foto booking
- `PATCH /api/bookings/:id/haircut-photos`

Role:
- `Owner`, `Admin`, `Pegawai`

Payload baru (utama):
```json
{
  "depan": "data:image/jpeg;base64,...",
  "kiri": "data:image/jpeg;base64,...",
  "kanan": "data:image/jpeg;base64,...",
  "belakang": "data:image/jpeg;base64,..."
}
```

Payload parsial juga boleh (misal hanya `depan`).

Kompatibilitas:
- Key lama `front/left/right/back` masih diterima untuk transisi.

Response:
```json
{
  "id": "<bookingId>",
  "bookingCode": "BK-260422-001",
  "customerId": "<optionalCustomerId>",
  "foto": [
    {
      "depan": "/uploads/haircut-photos/xxx.jpg",
      "kiri": "",
      "kanan": "",
      "belakang": "",
      "updatedAt": "2026-04-22T...Z"
    }
  ]
}
```

### Ambil foto booking berdasarkan kode booking
- `GET /api/bookings/by-code/:code/haircut-photos`

Response:
```json
{
  "bookingCode": "BK-260422-001",
  "foto": [
    {
      "depan": "/uploads/haircut-photos/xxx.jpg",
      "kiri": "/uploads/haircut-photos/yyy.jpg",
      "kanan": "",
      "belakang": "",
      "updatedAt": "2026-04-22T...Z"
    }
  ]
}
```

## C. Booking Create / List

`POST /api/bookings` dan `GET /api/bookings` sekarang mengembalikan field `foto`.

## D. Pembayaran Booking (`POST /api/bookings/:id/pay`)

Pada saat bayar:
- Sistem ambil komisi dari master layanan/produk (`type_komisi`, `nilai_komisi`)
- Tiap item transaksi menyimpan komisi item di `tt_transaksi.item`
- Total komisi transaksi disimpan ke `tt_transaksi.komisi_didapat`

## Penyimpanan File Upload

Folder upload backend:
- `server/uploads/`
- subfolder foto haircut: `server/uploads/haircut-photos/`

Akses publik file:
- `/uploads/...` (static route dari Express)

Tujuan:
- MongoDB hanya menyimpan path/link file, bukan base64 mentah.

## Catatan Operasional

1. `express.json` sudah di-set limit lebih besar untuk upload data URL gambar.
2. Disarankan frontend tetap kompres foto sebelum kirim.
3. Endpoint dan alias Indonesia/English tetap dipertahankan untuk kompatibilitas.
4. Endpoint setting komisi global masih ada untuk legacy, tapi hitung komisi transaksi mengikuti komisi per item.

## Checklist Uji Backend

1. Buat/update master layanan dengan `type_komisi` dan `nilai_komisi`.
2. Buat/update master produk dengan field komisi yang sama.
3. Bulk update komisi layanan/produk.
4. Buat booking, simpan foto via endpoint haircut photos.
5. Cek dokumen `tt_booking.foto` terisi array dengan key `depan/kiri/kanan/belakang`.
6. Lakukan pembayaran booking, cek `tt_transaksi.item` dan `tt_transaksi.komisi_didapat`.
