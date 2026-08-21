import AsyncStorage from "@react-native-async-storage/async-storage";

const KUNCI = "wtk_tickets";

export async function simpanTiket(tiket) {
  const m = await AsyncStorage.getItem(KUNCI);
  const list = m ? JSON.parse(m) : [];
  list.unshift({
    ...tiket,
    disimpanAt: Date.now(),
  });
  // max 30 tiket lokal
  await AsyncStorage.setItem(KUNCI, JSON.stringify(list.slice(0, 30)));
}

export async function daftarTiket() {
  const m = await AsyncStorage.getItem(KUNCI);
  return m ? JSON.parse(m) : [];
}
