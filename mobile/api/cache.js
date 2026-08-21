import AsyncStorage from "@react-native-async-storage/async-storage";

export async function simpan(kunci, data) {
  await AsyncStorage.setItem(
    kunci,
    JSON.stringify({ data, waktu: Date.now() })
  );
}

export async function baca(kunci) {
  const mentah = await AsyncStorage.getItem(kunci);
  return mentah ? JSON.parse(mentah) : null;
}

export async function hapus(kunci) {
  await AsyncStorage.removeItem(kunci);
}
