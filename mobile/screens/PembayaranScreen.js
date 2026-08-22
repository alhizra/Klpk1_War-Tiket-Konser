import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { buatPesanan } from "../api/endpoints";
import { antre } from "../api/outbox";
import { useJaringan } from "../hooks/useJaringan";
import { colors } from "../theme";

function emailOk(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
}

export default function PembayaranScreen({ route, navigation }) {
  const { eventId, title, seatCodes, qty } = route.params;
  const online = useJaringan();
  const [memuat, setMemuat] = useState(false);
  const [galat, setGalat] = useState(null);
  const [email, setEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");

  async function bayar() {
    if (memuat) return;

    const name = buyerName.trim();
    const mail = email.trim();
    if (!name || name.length < 2) {
      setGalat("Isi nama pembeli dulu (min. 2 huruf).");
      return;
    }
    if (!mail) {
      setGalat("Isi email e-ticket dulu.");
      return;
    }
    if (!emailOk(mail)) {
      setGalat("Format email tidak valid.");
      return;
    }

    setMemuat(true);
    setGalat(null);

    const body = {
      eventId,
      qty: qty || seatCodes?.length || 1,
      seatCodes,
      email: mail,
      buyerName: name,
    };

    try {
      if (!online) {
        await antre({
          path: "/orders",
          body,
          meta: { title, seatCodes },
        });
        navigation.replace("ETicket", {
          pesanan: {
            orderId: `PENDING-${Date.now()}`,
            status: "PENDING_SYNC",
            sisa: "—",
            buyerEmail: mail,
            buyerName: name,
          },
          title,
          seatCodes,
          pendingSync: true,
        });
        return;
      }

      const pesanan = await buatPesanan(body);
      navigation.replace("ETicket", {
        pesanan,
        title,
        seatCodes: pesanan.seatCodes?.length ? pesanan.seatCodes : seatCodes,
      });
    } catch (e) {
      if (e.status === 409) {
        setGalat("Kursi/kuota baru saja habis. Pilih kursi lain.");
      } else if (e.status === 429) {
        setGalat("Server sibuk (batas laju). Coba lagi sebentar.");
      } else if (e.status === 400) {
        setGalat(e.message || "Data tidak valid (nama/email/qty).");
      } else if (!e.status) {
        try {
          await antre({ path: "/orders", body, meta: { title, seatCodes } });
          navigation.replace("ETicket", {
            pesanan: {
              orderId: `PENDING-${Date.now()}`,
              status: "PENDING_SYNC",
              buyerEmail: mail,
              buyerName: name,
            },
            title,
            seatCodes,
            pendingSync: true,
          });
          return;
        } catch {
          setGalat(
            e.message ||
              "Jaringan bermasalah. Periksa API & BASE_URL di config.js."
          );
        }
      } else {
        setGalat(`Gagal (${e.status}). ${e.message || ""}`.trim());
      }
    } finally {
      setMemuat(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.kicker}>Pembayaran</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {qty} tiket · {(seatCodes || []).join(", ") || "tanpa seat code"}
        </Text>
        {!online && (
          <Text style={styles.warn}>
            Offline: pesanan masuk antrean dan dikirim otomatis saat online.
          </Text>
        )}

        <Text style={styles.label}>Nama pembeli *</Text>
        <TextInput
          style={styles.input}
          value={buyerName}
          onChangeText={setBuyerName}
          placeholder="Nama di e-ticket"
          placeholderTextColor={colors.muted}
          autoCapitalize="words"
          editable={!memuat}
        />

        <Text style={styles.label}>Email e-ticket *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="nama@email.com"
          placeholderTextColor={colors.muted}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!memuat}
        />

        <Text style={styles.note}>
          POST /orders memotong kuota atomik. Nama & email wajib (sama seperti
          web). Tombol terkunci saat memuat.
        </Text>

        {galat ? <Text style={styles.err}>{galat}</Text> : null}

        <Pressable
          style={[styles.btn, memuat && styles.btnOff]}
          onPress={bayar}
          disabled={memuat}
        >
          {memuat ? (
            <ActivityIndicator color={colors.bg} />
          ) : (
            <Text style={styles.btnText}>
              {online ? "Bayar sekarang" : "Simpan & antre (offline)"}
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  wrap: {
    flexGrow: 1,
    backgroundColor: colors.bg,
    padding: 24,
    justifyContent: "center",
  },
  kicker: { color: colors.accent2, fontWeight: "700" },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", marginTop: 8 },
  meta: { color: colors.muted, marginTop: 8 },
  warn: { color: "#fbbf24", marginTop: 12, fontWeight: "600" },
  label: {
    color: colors.muted,
    marginTop: 16,
    marginBottom: 6,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    backgroundColor: colors.card || "#1e293b",
    borderWidth: 1,
    borderColor: colors.border || "#334155",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 16,
  },
  note: { color: colors.muted, marginTop: 16, lineHeight: 20, fontSize: 13 },
  err: { color: colors.danger, marginTop: 16, textAlign: "center" },
  btn: {
    marginTop: 28,
    backgroundColor: colors.accent,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnOff: { opacity: 0.6 },
  btnText: { color: "#052e16", fontWeight: "800", fontSize: 16 },
});
