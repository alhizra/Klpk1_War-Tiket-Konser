import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { ambilDaftarKonser, posterUrl } from "../api/endpoints";
import { API_HINT, PAGE_SIZE } from "../config";
import { metaOf } from "../data/eventMeta";
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
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(iso);
  }
}

function minPrice(item) {
  if (item.categories?.length) {
    const prices = item.categories
      .map((c) => Number(c.priceIdr || item.priceIdr) || 0)
      .filter((p) => p > 0);
    if (prices.length) return Math.min(...prices);
  }
  return Number(item.priceIdr) || 0;
}

function EventCard({ item, onPress, wide }) {
  const id = item.eventId ?? item.id;
  const uri = posterUrl(id, item);
  const meta = metaOf(id);
  const sisa = item.sisa;
  const low = Number(sisa) >= 0 && Number(sisa) <= 20;
  const soldOut = Number(sisa) === 0;
  const price = minPrice(item);
  const tag = soldOut ? "SOLD OUT" : meta.tag || "OPEN";

  if (wide) {
    return (
      <Pressable
        style={({ pressed }) => [styles.gridCard, pressed && styles.pressed]}
        onPress={onPress}
      >
        <View style={styles.gridPosterWrap}>
          {uri ? (
            <Image source={{ uri }} style={styles.gridPoster} resizeMode="cover" />
          ) : (
            <View style={[styles.gridPoster, styles.posterPh]} />
          )}
          <View style={[styles.badge, soldOut && styles.badgeSold]}>
            <Text style={styles.badgeT}>{tag}</Text>
          </View>
        </View>
        <View style={styles.gridBody}>
          {meta.genre ? (
            <Text style={styles.gridGenre} numberOfLines={1}>
              {meta.genre}
            </Text>
          ) : null}
          <Text style={styles.gridTitle} numberOfLines={2}>
            {item.title || item.artist || "Event"}
          </Text>
          {item.artist ? (
            <Text style={styles.gridArtist} numberOfLines={1}>
              {item.artist}
            </Text>
          ) : null}
          <Text style={styles.gridDate}>{fmtDate(item.startsAt)}</Text>
          <Text style={styles.gridMeta} numberOfLines={1}>
            {[item.venue, item.city].filter(Boolean).join(" · ") || "—"}
          </Text>
          <Text style={styles.gridPrice}>{fmtRp(price)}~</Text>
          <Text style={[styles.gridStock, low && styles.stockWarn]}>
            Sisa {sisa ?? "—"}/{item.quotaTotal ?? "—"}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.rowCard, pressed && styles.pressed]}
      onPress={onPress}
    >
      <View style={styles.rowPosterWrap}>
        {uri ? (
          <Image source={{ uri }} style={styles.rowPoster} resizeMode="cover" />
        ) : (
          <View style={[styles.rowPoster, styles.posterPh]} />
        )}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <View style={[styles.badgeSm, soldOut && styles.badgeSold]}>
            <Text style={styles.badgeSmT} numberOfLines={1}>
              {soldOut ? "SOLD" : meta.tag || "OPEN"}
            </Text>
          </View>
          <Text style={styles.rowDate}>{fmtDate(item.startsAt)}</Text>
        </View>
        {meta.genre ? (
          <Text style={styles.rowGenre} numberOfLines={1}>
            {meta.genre}
          </Text>
        ) : null}
        <Text style={styles.rowTitle} numberOfLines={2}>
          {item.title || item.artist || "Event"}
        </Text>
        {item.artist ? (
          <Text style={styles.rowArtist} numberOfLines={1}>
            {item.artist}
          </Text>
        ) : null}
        <Text style={styles.rowVenue} numberOfLines={1}>
          {item.venue || "—"}
        </Text>
        <Text style={styles.rowCity} numberOfLines={1}>
          {[item.city, item.quotaTotal != null ? `${item.quotaTotal} seats` : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        <View style={styles.rowFoot}>
          <Text style={styles.rowPrice}>{fmtRp(price)}~</Text>
          <Text style={[styles.rowStock, low && styles.stockWarn]}>
            Sisa {sisa ?? "—"}/{item.quotaTotal ?? "—"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function DaftarScreen({ navigation }) {
  const online = useJaringan();
  useSinkronOtomatis();
  const { width } = useWindowDimensions();
  const useGrid = width >= 420;

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
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.info}>Memuat konser…</Text>
      </View>
    );
  }

  if (galat && data.length === 0) {
    return (
      <View style={styles.center}>
        <View style={styles.errCard}>
          <Text style={styles.errTitle}>Tidak bisa memuat konser</Text>
          <Text style={styles.err}>{galat}</Text>
          <Text style={styles.debug}>{API_HINT}</Text>
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
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {(!online || dariCache) && (
        <View style={[styles.banner, dariCache && online && styles.bannerWarn]}>
          <Text style={[styles.bannerText, dariCache && online && styles.bannerTextWarn]}>
            {!online ? "Offline — data tersimpan" : "Menampilkan cache"}
          </Text>
        </View>
      )}

      <FlatList
        key={useGrid ? "grid" : "list"}
        style={styles.list}
        contentContainerStyle={styles.listPad}
        data={data}
        numColumns={useGrid ? 2 : 1}
        columnWrapperStyle={useGrid ? styles.gridRow : undefined}
        keyExtractor={(item) => String(item.eventId ?? item.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refresh}
            tintColor={colors.accent}
            colors={[colors.accent]}
            onRefresh={() => {
              setRefresh(true);
              setHabis(false);
              muatHalaman(1, { reset: true });
            }}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <Text style={styles.kicker}>OPEN SALE</Text>
            <Text style={styles.heading}>Pilih konser favoritmu</Text>
          </View>
        }
        renderItem={({ item }) => (
          <EventCard
            item={item}
            wide={useGrid}
            onPress={() =>
              navigation.navigate("Denah", { id: item.eventId ?? item.id })
            }
          />
        )}
        onEndReachedThreshold={0.35}
        onEndReached={() => {
          if (!memuat && !habis && online) muatHalaman(halaman + 1);
        }}
        ListFooterComponent={
          memuat ? (
            <ActivityIndicator style={{ margin: 20 }} color={colors.accent} />
          ) : habis && data.length > 0 ? (
            <Text style={styles.endHint}>— akhir daftar —</Text>
          ) : null
        }
        ListEmptyComponent={
          <Text style={styles.info}>Belum ada konser tersedia.</Text>
        }
      />
    </View>
  );
}

const POSTER_W = 108;
const POSTER_H = 144;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { flex: 1 },
  listPad: { paddingHorizontal: 14, paddingBottom: 36 },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  banner: {
    backgroundColor: colors.dangerSoft,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  bannerWarn: { backgroundColor: colors.warningSoft },
  bannerText: {
    color: colors.danger,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
  },
  bannerTextWarn: { color: colors.warning },
  headerBlock: {
    marginBottom: 14,
    paddingTop: 8,
    paddingHorizontal: 2,
  },
  kicker: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  heading: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  headingSub: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 4,
  },
  rowGenre: {
    color: colors.muted2,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
  },
  rowArtist: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  gridGenre: {
    color: colors.muted2,
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 2,
  },
  gridArtist: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  pressed: { opacity: 0.92 },

  /* —— list row (HP) —— */
  rowCard: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#0f172a",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rowPosterWrap: {
    width: POSTER_W,
    height: POSTER_H,
    backgroundColor: colors.borderLight,
  },
  rowPoster: {
    width: POSTER_W,
    height: POSTER_H,
  },
  posterPh: { backgroundColor: colors.border },
  rowBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    justifyContent: "space-between",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  badgeSm: {
    backgroundColor: colors.accent,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeSold: { backgroundColor: "#94a3b8" },
  badgeSmT: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  rowDate: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  rowTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    lineHeight: 19,
    letterSpacing: -0.2,
  },
  rowVenue: {
    color: "#475569",
    fontSize: 12,
    marginTop: 3,
    fontWeight: "500",
  },
  rowCity: {
    color: colors.muted2,
    fontSize: 11,
    marginTop: 2,
  },
  rowFoot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowPrice: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 14,
  },
  rowStock: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: "800",
  },
  stockWarn: { color: colors.warning },

  /* —— grid (tablet / lebar) —— */
  gridRow: { gap: 10 },
  gridCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    overflow: "hidden",
  },
  gridPosterWrap: {
    width: "100%",
    aspectRatio: 3 / 4,
    backgroundColor: colors.borderLight,
  },
  gridPoster: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: colors.accent,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeT: { color: "#fff", fontSize: 9, fontWeight: "800" },
  gridBody: { padding: 10 },
  gridTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 17,
    minHeight: 34,
  },
  gridDate: { color: colors.muted, fontSize: 11, marginTop: 4, fontWeight: "600" },
  gridMeta: { color: colors.muted2, fontSize: 11, marginTop: 2 },
  gridPrice: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 13,
    marginTop: 8,
  },
  gridStock: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },

  info: { color: colors.muted, textAlign: "center", marginTop: 16 },
  endHint: {
    color: colors.muted2,
    textAlign: "center",
    fontSize: 12,
    marginTop: 10,
  },
  errCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 22,
    width: "100%",
    maxWidth: 360,
  },
  errTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "800",
    textAlign: "center",
  },
  err: {
    color: colors.danger,
    textAlign: "center",
    fontSize: 13,
    marginTop: 8,
  },
  debug: {
    color: colors.muted,
    marginTop: 14,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 18,
  },
  btn: {
    marginTop: 18,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnText: { color: colors.onAccent, fontWeight: "800", fontSize: 15 },
});
