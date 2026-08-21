import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../theme";

/** E-ticket sederhana (QR library ditambah di P4). Kode tetap bisa dibuka offline dari params navigasi. */
export default function ETicketScreen({ route, navigation }) {
  const { pesanan, title, seatCodes } = route.params || {};
  const kode =
    pesanan?.orderId ||
    `WTK-${Date.now().toString(36).toUpperCase()}`;

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>E-Ticket</Text>
      <Text style={styles.title}>{title || "Konser"}</Text>
      <View style={styles.box}>
        <Text style={styles.code}>{kode}</Text>
        <Text style={styles.sub}>Tunjukkan di pintu masuk</Text>
        <Text style={styles.seats}>
          {(seatCodes || pesanan?.seatCodes || []).join(" · ") || "GA / standing"}
        </Text>
        <Text style={styles.hint}>
          P4: ganti blok ini dengan QR lokal (tetap tampil tanpa sinyal).
        </Text>
      </View>
      <Text style={styles.meta}>
        Status: {pesanan?.status || "CONFIRMED"} · Sisa kuota event:{" "}
        {pesanan?.sisa ?? "—"}
      </Text>
      <Pressable
        style={styles.btn}
        onPress={() => navigation.popToTop()}
      >
        <Text style={styles.btnText}>Kembali ke daftar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  kicker: { color: colors.accent, fontWeight: "700" },
  title: { color: colors.text, fontSize: 20, fontWeight: "800", marginTop: 8 },
  box: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  code: {
    color: "#0f172a",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  sub: { color: "#475569", marginTop: 8 },
  seats: {
    color: "#0f172a",
    marginTop: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  hint: { color: "#94a3b8", fontSize: 11, marginTop: 16, textAlign: "center" },
  meta: { color: colors.muted, marginTop: 16 },
  btn: {
    marginTop: 24,
    backgroundColor: colors.accent2,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: colors.bg, fontWeight: "800" },
});
