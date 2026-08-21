import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { simpanTiket } from "../api/tickets";
import { colors } from "../theme";

/** E-ticket QR tersimpan lokal — tetap tampil tanpa sinyal (materi P4). */
export default function ETicketScreen({ route, navigation }) {
  const { pesanan, title, seatCodes, pendingSync } = route.params || {};
  const kode =
    pesanan?.orderId ||
    `WTK-${Date.now().toString(36).toUpperCase()}`;
  const seats =
    (seatCodes || pesanan?.seatCodes || []).join(" · ") || "GA / standing";

  useEffect(() => {
    simpanTiket({
      orderId: kode,
      title: title || "Konser",
      seatCodes: seatCodes || pesanan?.seatCodes || [],
      status: pesanan?.status || "CONFIRMED",
      amountIdr: pesanan?.amountIdr,
      pendingSync: !!pendingSync,
    }).catch(() => {});
  }, [kode]);

  const qrValue = JSON.stringify({
    orderId: kode,
    title: title || "Konser",
    seats: seatCodes || pesanan?.seatCodes || [],
    status: pesanan?.status || "CONFIRMED",
  });

  return (
    <View style={styles.wrap}>
      <Text style={styles.kicker}>E-Ticket</Text>
      <Text style={styles.title}>{title || "Konser"}</Text>

      {pendingSync ? (
        <Text style={styles.pending}>
          Menunggu sinkron — akan dikirim saat online
        </Text>
      ) : null}

      <View style={styles.box}>
        <QRCode value={qrValue} size={200} backgroundColor="#fff" />
        <Text style={styles.code}>{kode}</Text>
        <Text style={styles.sub}>Tunjukkan di pintu masuk</Text>
        <Text style={styles.seats}>{seats}</Text>
        <Text style={styles.hint}>
          QR tersimpan di HP. Tetap tampil walau Mode Pesawat (setelah dibuka
          sekali online).
        </Text>
      </View>

      <Text style={styles.meta}>
        Status: {pesanan?.status || "CONFIRMED"}
        {pesanan?.sisa != null ? ` · Sisa kuota: ${pesanan.sisa}` : ""}
      </Text>

      <Pressable style={styles.btn} onPress={() => navigation.popToTop()}>
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
  pending: {
    color: "#fbbf24",
    marginTop: 10,
    fontWeight: "600",
  },
  box: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  code: {
    color: "#0f172a",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 16,
  },
  sub: { color: "#475569", marginTop: 8 },
  seats: {
    color: "#0f172a",
    marginTop: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  hint: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 16,
    textAlign: "center",
  },
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
