import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "./client";

const KUNCI = "wtk_outbox";

async function daftar() {
  const m = await AsyncStorage.getItem(KUNCI);
  return m ? JSON.parse(m) : [];
}

/** Simpan aksi POST saat offline — hapus hanya setelah sukses. */
export async function antre(aksi) {
  const isi = await daftar();
  isi.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    path: aksi.path,
    body: aksi.body,
    meta: aksi.meta || {},
  });
  await AsyncStorage.setItem(KUNCI, JSON.stringify(isi));
}

export async function sinkron() {
  const isi = await daftar();
  if (!isi.length) return { terkirim: 0, sisa: 0, hasil: [] };
  const tersisa = [];
  const hasil = [];
  for (const aksi of isi) {
    try {
      const res = await api.post(aksi.path, aksi.body);
      hasil.push({ ok: true, aksi, res });
    } catch (e) {
      // 409 = bisnis gagal, buang dari antrean agar tidak spam
      if (e.status === 409 || e.status === 400) {
        hasil.push({ ok: false, aksi, error: e.message, drop: true });
      } else {
        tersisa.push(aksi);
        hasil.push({ ok: false, aksi, error: e.message });
      }
    }
  }
  await AsyncStorage.setItem(KUNCI, JSON.stringify(tersisa));
  return {
    terkirim: isi.length - tersisa.length,
    sisa: tersisa.length,
    hasil,
  };
}

export async function jumlahOutbox() {
  return (await daftar()).length;
}
