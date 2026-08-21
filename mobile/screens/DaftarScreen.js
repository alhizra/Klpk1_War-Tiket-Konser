import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ambilDaftarKonser, posterUrl } from "../api/endpoints";
import { PAGE_SIZE } from "../config";
import { useJaringan } from "../hooks/useJaringan";
import { useSinkronOtomatis } from "../hooks/useSinkronOtomatis";
import { colors } from "../theme";

function fmtRp(n) {
  try {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  } catch {
    return `Rp ${n}`;
  }
}

function fmtDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

export default function DaftarScreen({ navigation }) {
  const online = useJaringan();
  useSinkronOtomatis();

  const [data, setData] = useState([]);
  const [halaman, setHalaman] = useState(1);
  const [memuat, setMemuat] = useState(false);
  const [awal, setAwal] = useState(true);
  const [habis, setHabis] = useState(false);
  const [galat, setGalat] = useState(null);
  const [refresh, setRefresh] = useState(false);
  const [dariCache, setDariCache] = useState(false);

  const muatHalaman = useCallback(
    async (h, { reset = false } = {}) => {
      if (memuat) return;
      if (!reset && habis) return;
      setMemuat(true);
      setGalat(null);
      try {
        const { data: json, dariCache: cache } = await ambilDaftarKonser(h);
        const baris = Array.isArray(json)
          ? json
          : json.items || json.data || [];
        setDariCache(!!cache);
        setData((lama) => (h === 1 || reset ? baris : [...lama, ...baris]));
        if (baris.length < PAGE_SIZE) setHabis(true);
        else if (reset) setHabis(false);
        setHalaman(h);
      } catch (e) {
        setGalat(e.message || "Gagal memuat");
      } finally {
        setMemuat(false);
        setAwal(false);
        setRefresh(false);
      }
    },
    [memuat, habis]
  );

  useEffect(() => {
    muatHalaman(1, { reset: true });
  }, []);

  if (awal && memuat) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent2} />
        <Text style={styles.info}>Memuat konser dari API squad…</Text>
      </View>
    );
  }

  if (galat && data.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Gagal memuat: {galat}</Text>
        <Text style={styles.info}>
          Cek BASE_URL di mobile/config.js (IPv4 Wi‑Fi laptop, bukan 172.x WSL)
          dan pastikan HP satu jaringan + API hidup.
        </Text>
        <Pressable
          style={styles.btn}
          onPress={() => {
            setHabis(false);
            muatHalaman(1, { reset: true });
          }}
        >
          <Text style={styles.btnText}>Coba lagi</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {!online && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>
            Mode luring — menampilkan data tersimpan
          </Text>
        </View>
      )}
      {online && dariCache && (
        <View style={[styles.banner, { backgroundColor: "#422006" }]}>
          <Text style={styles.bannerText}>Data dari cache (server gagal)</Text>
        </View>
      )}
      <FlatList
        style={styles.list}
        contentContainerStyle={{ padding: 12, paddingBottom: 32 }}
        data={data}
        keyExtractor={(item) => String(item.eventId ?? item.id)}
        refreshControl={
          <RefreshControl
            refreshing={refresh}
            tintColor={colors.accent2}
            onRefresh={() => {
              setRefresh(true);
              setHabis(false);
              muatHalaman(1, { reset: true });
            }}
          />
        }
        renderItem={({ item }) => {
          const id = item.eventId ?? item.id;
          const uri = posterUrl(id);
          return (
            <Pressable
              style={styles.card}
              onPress={() => navigation.navigate("Denah", { id })}
            >
              {uri ? (
                <Image source={{ uri }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbPh]} />
              )}
              <View style={styles.body}>
                <Text style={styles.title} numberOfLines={2}>
                  {item.title || item.artist || "Event"}
                </Text>
                <Text style={styles.meta}>{fmtDate(item.startsAt)}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.venue || "—"}
                </Text>
                <Text style={styles.meta}>
                  {item.city || ""} · {item.quotaTotal ?? "—"} seats
                </Text>
                <Text style={styles.price}>{fmtRp(item.priceIdr)} ~</Text>
                <Text style={styles.stock}>
                  Sisa {item.sisa ?? "—"} / {item.quotaTotal ?? "—"}
                </Text>
              </View>
            </Pressable>
          );
        }}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (!memuat && !habis && online) muatHalaman(halaman + 1);
        }}
        ListHeaderComponent={
          <Text style={styles.heading}>
            Open Concert · {data.length} dimuat
            {dariCache ? " · cache" : ""}
          </Text>
        }
        ListFooterComponent={
          memuat ? (
            <ActivityIndicator style={{ margin: 16 }} color={colors.accent2} />
          ) : null
        }
        ListEmptyComponent={<Text style={styles.info}>Belum ada data.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  banner: {
    backgroundColor: "#7f1d1d",
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bannerText: {
    color: "#fecaca",
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
  },
  heading: {
    color: colors.muted,
    fontSize: 13,
    marginBottom: 10,
    fontWeight: "600",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    overflow: "hidden",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumb: { width: "100%", height: 160, backgroundColor: "#0b1220" },
  thumbPh: { backgroundColor: "#1e293b" },
  body: { padding: 14 },
  title: { color: colors.text, fontSize: 16, fontWeight: "700" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  price: { color: colors.text, fontWeight: "700", marginTop: 8 },
  stock: {
    color: colors.accent,
    fontSize: 12,
    marginTop: 2,
    fontWeight: "600",
  },
  info: { color: colors.muted, textAlign: "center", marginTop: 8 },
  err: { color: colors.danger, textAlign: "center", fontSize: 15 },
  btn: {
    marginTop: 16,
    backgroundColor: colors.accent2,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  btnText: { color: colors.bg, fontWeight: "700" },
});
