import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ambilDetailKonser, posterUrl } from "../api/endpoints";
import { colors } from "../theme";

const MAX_SELECT = 4;

export default function DenahScreen({ route, navigation }) {
  const { id } = route.params;
  const [item, setItem] = useState(null);
  const [galat, setGalat] = useState(null);
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    let hidup = true;
    ambilDetailKonser(id)
      .then((d) => {
        if (hidup) setItem(d);
      })
      .catch((e) => {
        if (hidup) setGalat(e.message);
      });
    return () => {
      hidup = false;
    };
  }, [id]);

  const seats = useMemo(() => {
    const list = item?.seats || [];
    // tampilkan sample agar UI ringan (max 80 kursi pertama)
    return list.slice(0, 80);
  }, [item]);

  const sold = useMemo(
    () => new Set((item?.soldSeats || []).map((s) => String(s).toUpperCase())),
    [item]
  );

  function toggle(code) {
    const c = String(code).toUpperCase();
    if (sold.has(c)) return;
    setSelected((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= MAX_SELECT) return prev;
      return [...prev, c];
    });
  }

  if (galat) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>{galat}</Text>
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.accent2} />
      </View>
    );
  }

  const uri = posterUrl(item.eventId);

  return (
    <View style={styles.wrap}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {uri ? <Image source={{ uri }} style={styles.poster} /> : null}
        <View style={styles.pad}>
          <Text style={styles.title}>{item.title}</Text>
          <Text style={styles.meta}>
            {item.venue} · {item.city}
          </Text>
          <Text style={styles.stock}>
            Sisa {item.sisa ?? "—"} / {item.quotaTotal ?? "—"}
          </Text>
          <Text style={styles.section}>Pilih kursi (max {MAX_SELECT})</Text>
          <Text style={styles.hint}>
            Menampilkan {seats.length} dari {(item.seats || []).length} kursi
          </Text>
          <View style={styles.grid}>
            {seats.map((s) => {
              const code = String(s.code).toUpperCase();
              const isSold = sold.has(code);
              const isOn = selected.includes(code);
              return (
                <Pressable
                  key={code}
                  disabled={isSold}
                  onPress={() => toggle(code)}
                  style={[
                    styles.seat,
                    isSold && styles.seatSold,
                    isOn && styles.seatOn,
                    { borderColor: s.color || colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.seatText,
                      isSold && { color: "#64748b" },
                      isOn && { color: colors.bg },
                    ]}
                  >
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bar}>
        <Text style={styles.barText}>
          {selected.length
            ? `${selected.length} kursi: ${selected.join(", ")}`
            : "Belum pilih kursi"}
        </Text>
        <Pressable
          style={[styles.cta, selected.length === 0 && styles.ctaOff]}
          disabled={selected.length === 0}
          onPress={() =>
            navigation.navigate("Antrean", {
              eventId: item.eventId,
              title: item.title,
              seatCodes: selected,
              qty: selected.length,
            })
          }
        >
          <Text style={styles.ctaText}>Lanjut antrean</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  poster: { width: "100%", height: 200 },
  pad: { padding: 16 },
  title: { color: colors.text, fontSize: 20, fontWeight: "700" },
  meta: { color: colors.muted, marginTop: 4 },
  stock: { color: colors.accent, marginTop: 8, fontWeight: "600" },
  section: { color: colors.text, marginTop: 18, fontWeight: "700", fontSize: 16 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 4, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  seat: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    backgroundColor: colors.card,
    minWidth: 72,
    alignItems: "center",
  },
  seatOn: { backgroundColor: colors.accent2, borderColor: colors.accent2 },
  seatSold: { opacity: 0.35 },
  seatText: { color: colors.text, fontSize: 11, fontWeight: "600" },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: "#0b1220",
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  barText: { color: colors.muted, marginBottom: 8, fontSize: 12 },
  cta: {
    backgroundColor: colors.accent,
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  ctaOff: { opacity: 0.4 },
  ctaText: { color: "#052e16", fontWeight: "800" },
  err: { color: colors.danger },
});
