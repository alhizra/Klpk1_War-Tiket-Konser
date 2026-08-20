# ADR-001: Endpoint daftar wajib paginasi

- **Status:** Accepted
- **Tanggal:** 2026-08-19
- **Deciders:** Arsitek + Backend

## Konteks

Web dan Mobile memuat daftar konser. Respons tanpa batas boros bandwidth dan sulit diuji beban.

## Keputusan

`GET /events` memakai `page` (mulai 1) dan `size`/`limit` (default 20, max 50).

Bentuk respons:

```json
{ "page": 1, "size": 20, "items": [ /* Event */ ] }
```

## Konsekuensi

- (+) Ukuran respons terkontrol untuk load test
- (+) Siap kontrak Mobile
- (-) Klien harus page-by-page
