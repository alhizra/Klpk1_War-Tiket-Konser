# DATA-MOBILE — cache & outbox

## AsyncStorage keys

| Key | Isi |
|-----|-----|
| `events_p{n}` | Response list halaman n |
| `events_last` | Cadangan list halaman 1 |
| `event_{id}` | Detail event + seats |
| `wtk_outbox` | Antrean POST `/orders` offline |
| `wtk_tickets` | E-ticket tersimpan (max 30) |

## Aturan

1. Baca online → simpan cache; gagal/offline → tampilkan cache + flag `dariCache`.  
2. Tulis offline → **outbox**; kirim saat online; hapus item hanya jika sukses (atau 409 drop).  
3. Jangan retry membabi buta pada POST stok (selaras Scalable).  
4. QR value = JSON `{ orderId, title, seats, status }` — cukup untuk pintu masuk demo.
