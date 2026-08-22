import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { simpanTiket } from "../api/tickets";
import { colors } from "../theme";

/** E-ticket QR lokal — fallback teks jika modul QR gagal load. */
export default function ETicketScreen({ route, navigation }) {
  const { pesanan, title, seatCodes, pendingSync } = route.params || {};
  const kode =
    pesanan?.orderId || `WTK-${Date.now().toString(36).toUpperCase()}`;
  const seats =
    (seatCodes || pesanan?.seatCodes || []).join(" · ") || "GA / standing";
  const [Qr, setQr] = useState(null);

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

  useEffect(() => {
    let ok = true;
    import("react-native-qrcode-svg")
      .then((m) => {
        if (ok) setQr(() => m.default);
      })
      .catch(() => {
        if (ok) setQr(null);
      });
    return () => {
      ok = false;
    };
  }, []);

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
        {Qr ? (
          <Qr value={qrValue} size={200} backgroundColor="#fff" />
        ) : (
          <View style={styles.qrFallback}>
            <Text style={styles.qrFallbackText}>ORDER</Text>
            <Text style={styles.codeDark}>{kode}</Text>
          </View>
        )}
        <Text style={styles.code}>{kode}</Text>
        <Text style={styles.sub}>Tunjukkan di pintu masuk</Text>
        <Text style={styles.seats}>{seats}</Text>
        <Text style={styles.hint}>
          Tiket tersimpan di HP. Tetap tampil offline setelah dibuka sekali.
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
  pending: { color: "#fbbf24", marginTop: 10, fontWeight: "600" },
  box: {
    marginTop: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  qrFallback: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderColor: "#0f172a",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  qrFallbackText: { color: "#64748b", fontWeight: "700", fontSize: 12 },
  codeDark: {
    color: "#0f172a",
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    marginTop: 8,
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
