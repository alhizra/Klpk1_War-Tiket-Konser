import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ambilDetailKonser, posterUrl } from "../api/endpoints";
import { benefitsOf, metaOf } from "../data/eventMeta";
import { colors } from "../theme";

const MAX_SELECT = 4;
const TABS = [
  { id: "detail", label: "Detail" },
  { id: "denah", label: "Denah" },
  { id: "benefit", label: "Benefit" },
  { id: "notice", label: "Notice" },
];

const DEFAULT_TERMS = [
  "Maksimal 4 tiket per transaksi / pesanan",
  "Satu kursi hanya boleh terjual satu kali",
  "Wajib membawa identitas sesuai nama di e-ticket saat masuk venue",
  "E-ticket dikirim ke email pembeli setelah pembayaran berhasil",
  "Tiket non-refundable kecuali event dibatalkan oleh promoter",
  "Dilarang memindahkan / menjual tiket di atas harga resmi",
  "Penonton wajib mematuhi aturan keamanan dan dress code venue",
  "Gate open mengikuti jadwal di detail event; datang lebih awal disarankan",
];

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
    return new Date(iso).toLocaleString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

function isLight(hex) {
  const h = String(hex || "").replace("#", "");
  if (h.length < 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 155;
}

function withAlpha(hex, a) {
  const h = String(hex || "#94A3B8").replace("#", "");
  if (h.length < 6) return `rgba(148,163,184,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export default function DenahScreen({ route, navigation }) {
  const { id } = route.params;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [item, setItem] = useState(null);
  const [galat, setGalat] = useState(null);
  const [dariCache, setDariCache] = useState(false);
  const [selected, setSelected] = useState([]);
  const [activeCat, setActiveCat] = useState(null);
  const [showAllZones, setShowAllZones] = useState(false);
  const [tab, setTab] = useState("detail");
  const [msg, setMsg] = useState("");

  const load = useCallback(
    async (keepSelection = false) => {
      try {
        const { data, dariCache: c } = await ambilDetailKonser(id);
        setItem(data);
        setDariCache(!!c);
        setGalat(null);
        if (!keepSelection) {
          const cats = data?.categories || [];
          if (cats.length) setActiveCat(cats[0].code);
        }
      } catch (e) {
        if (!keepSelection) setGalat(e.message);
      }
    },
    [id]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  // live refresh sisa/sold seperti web (12s)
  useEffect(() => {
    if (!item) return;
    const t = setInterval(() => load(true), 12000);
    return () => clearInterval(t);
  }, [item?.eventId, load]);

  const meta = useMemo(() => metaOf(item?.eventId || id), [item, id]);

  const categories = useMemo(() => {
    const cats = item?.categories || [];
    if (cats.length) return cats;
    const map = new Map();
    for (const s of item?.seats || []) {
      const code = s.category || "REG";
      if (!map.has(code)) {
        map.set(code, {
          code,
          name: s.categoryName || code,
          priceIdr: s.priceIdr || item?.priceIdr || 0,
          color: s.color || "#94A3B8",
          quota: 0,
        });
      }
      map.get(code).quota += 1;
    }
    return [...map.values()];
  }, [item]);

  const colorByCat = useMemo(() => {
    const m = {};
    for (const c of categories) {
      m[String(c.code).toUpperCase()] = c.color || "#94A3B8";
    }
    return m;
  }, [categories]);

  const soldOut = Number(item?.sisa) === 0;

  const sold = useMemo(() => {
    const set = new Set(
      (item?.soldSeats || []).map((s) => String(s).toUpperCase())
    );
    if (soldOut) {
      for (const s of item?.seats || []) {
        set.add(String(s.code).toUpperCase());
      }
    }
    return set;
  }, [item, soldOut]);

  const seatsFiltered = useMemo(() => {
    const list = item?.seats || [];
    if (!list.length) return [];
    if (showAllZones) return list;
    const cat = activeCat || categories[0]?.code;
    if (!cat) return list;
    return list.filter(
      (s) =>
        String(s.category || "").toUpperCase() === String(cat).toUpperCase()
    );
  }, [item, activeCat, categories, showAllZones]);

  /** grup: category → row → seats (sama web) */
  const mapByCat = useMemo(() => {
    const byCat = new Map();
    for (const s of seatsFiltered) {
      const cat = s.category || "REG";
      if (!byCat.has(cat)) byCat.set(cat, new Map());
      const byRow = byCat.get(cat);
      const row = s.row || String(s.code || "?")[0] || "?";
      if (!byRow.has(row)) byRow.set(row, []);
      byRow.get(row).push(s);
    }
    for (const byRow of byCat.values()) {
      for (const arr of byRow.values()) {
        arr.sort((a, b) => (a.number || 0) - (b.number || 0));
      }
    }
    return byCat;
  }, [seatsFiltered]);

  const priceByCode = useMemo(() => {
    const m = new Map();
    for (const s of item?.seats || []) {
      m.set(
        String(s.code).toUpperCase(),
        Number(s.priceIdr) || Number(item?.priceIdr) || 0
      );
    }
    return m;
  }, [item]);

  const catOf = useCallback(
    (code) => {
      const s = (item?.seats || []).find(
        (x) => String(x.code).toUpperCase() === String(code).toUpperCase()
      );
      return s?.category || "";
    },
    [item]
  );

  const totalPrice = useMemo(
    () =>
      selected.reduce((sum, code) => sum + (priceByCode.get(code) || 0), 0),
    [selected, priceByCode]
  );

  const benefitPreview = useMemo(() => {
    if (!selected.length || !item) return [];
    const cats = [...new Set(selected.map(catOf))];
    return cats.flatMap((c) =>
      benefitsOf(item.eventId, c)
        .slice(0, 2)
        .map((b) => `[${c}] ${b}`)
    );
  }, [selected, item, catOf]);

  const minPrice = useMemo(() => {
    if (categories.length) {
      return Math.min(
        ...categories.map((c) => Number(c.priceIdr) || Number(item?.priceIdr) || 0)
      );
    }
    return Number(item?.priceIdr) || 0;
  }, [categories, item]);

  const maxInRow = useMemo(() => {
    let m = 1;
    for (const byRow of mapByCat.values()) {
      for (const seats of byRow.values()) m = Math.max(m, seats.length);
    }
    return m;
  }, [mapByCat]);

  const seatSize = useMemo(() => {
    const pad = 28 + 36;
    const gap = 3;
    const n = Math.min(maxInRow, 14);
    const avail = width - pad;
    const raw = Math.floor((avail - gap * (n - 1)) / n);
    return Math.max(22, Math.min(30, raw));
  }, [width, maxInRow]);

  function toggle(code, isSold) {
    if (soldOut || isSold) {
      setMsg(soldOut ? "Event sold out" : "Kursi sudah terjual");
      return;
    }
    const c = String(code).toUpperCase();
    setMsg("");
    setSelected((prev) => {
      if (prev.includes(c)) return prev.filter((x) => x !== c);
      if (prev.length >= MAX_SELECT) {
        setMsg(`Maksimal ${MAX_SELECT} kursi`);
        return prev;
      }
      const sisa = Number(item?.sisa);
      if (Number.isFinite(sisa) && prev.length >= sisa) {
        setMsg("Sisa kursi tidak cukup");
        return prev;
      }
      return [...prev, c];
    });
  }

  function clearSeats() {
    setSelected([]);
    setMsg("");
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
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  const uri = posterUrl(item.eventId, item);
  const canPay = selected.length > 0 && !soldOut;
  const barPad = Math.max(insets.bottom, 12);
  const terms =
    Array.isArray(item.terms) && item.terms.length
      ? item.terms
      : DEFAULT_TERMS;
  const eventId = item.eventId;

  return (
    <View style={styles.wrap}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: 118 + barPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Poster + info (web detail top) */}
        <View style={styles.posterRow}>
          <View style={styles.posterBox}>
            {uri ? (
              <Image source={{ uri }} style={styles.poster} resizeMode="cover" />
            ) : (
              <View style={[styles.poster, styles.posterPh]} />
            )}
            <View style={styles.tagBadge}>
              <Text style={styles.tagT}>{meta.tag || "OPEN SALE"}</Text>
            </View>
          </View>
          <View style={styles.infoCol}>
            {dariCache ? (
              <Text style={styles.cacheTag}>Cache / offline</Text>
            ) : null}
            <Text style={styles.genre}>{meta.genre || "Concert"}</Text>
            <Text style={styles.title} numberOfLines={3}>
              {item.title}
            </Text>
            <Text style={styles.artist} numberOfLines={1}>
              {item.artist || "—"}
            </Text>
            <View style={styles.dl}>
              <DlRow k="Periode" v={fmtDate(item.startsAt)} />
              <DlRow
                k="Venue"
                v={`${item.venue || "—"}${item.city ? ` · ${item.city}` : ""}`}
              />
              <DlRow k="Rating" v={item.ageRating || "All ages"} />
              <DlRow k="Gate open" v={item.gateOpen || "—"} />
              <DlRow
                k="Sisa"
                v={`${item.sisa ?? "—"} / ${item.quotaTotal ?? "—"}`}
                hl
              />
            </View>
            <Text style={styles.minP}>{fmtRp(minPrice)} ~</Text>
          </View>
        </View>

        {/* Harga zona */}
        {categories.length > 0 ? (
          <View style={styles.priceBox}>
            <Text style={styles.priceLab}>Harga zona</Text>
            {categories.map((c) => (
              <View key={c.code} style={styles.priceRow}>
                <View style={styles.priceLeft}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: c.color || "#94A3B8" },
                    ]}
                  />
                  <Text style={styles.priceName} numberOfLines={1}>
                    {c.name || c.code}
                  </Text>
                </View>
                <Text style={styles.priceVal}>{fmtRp(c.priceIdr)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabT, on && styles.tabTOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {tab === "detail" ? (
          <View style={styles.panel}>
            <Text style={styles.h3}>Deskripsi</Text>
            <Text style={styles.body}>
              {item.description || "Belum ada deskripsi untuk event ini."}
            </Text>
            <Text style={[styles.h3, { marginTop: 16 }]}>Jadwal</Text>
            <Bullet text={`Show: ${fmtDate(item.startsAt)}`} />
            <Bullet text={`Sale open: ${fmtDate(item.salesOpensAt)}`} />
            <Bullet text={`Gate open: ${item.gateOpen || "—"}`} />
            <Bullet
              text={`Venue: ${item.venue || "—"}${item.city ? ` · ${item.city}` : ""}${item.country ? ` · ${item.country}` : ""}`}
            />
            <Pressable
              style={styles.goSeat}
              onPress={() => setTab("denah")}
              disabled={soldOut}
            >
              <Text style={styles.goSeatT}>
                {soldOut ? "Sold out" : "Pilih kursi"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "denah" ? (
          <View style={styles.panel}>
            <View style={styles.denahHead}>
              <Text style={styles.h3}>Denah venue</Text>
              <Text style={styles.muted}>Max {MAX_SELECT} kursi</Text>
            </View>

            {/* Mode: semua zona / filter */}
            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setShowAllZones(true)}
                style={[styles.modeChip, showAllZones && styles.modeChipOn]}
              >
                <Text
                  style={[styles.modeT, showAllZones && styles.modeTOn]}
                >
                  Semua zona
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowAllZones(false)}
                style={[styles.modeChip, !showAllZones && styles.modeChipOn]}
              >
                <Text
                  style={[styles.modeT, !showAllZones && styles.modeTOn]}
                >
                  Per zona
                </Text>
              </Pressable>
            </View>

            {!showAllZones ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.zoneScroll}
              >
                {categories.map((c) => {
                  const on =
                    String(activeCat).toUpperCase() ===
                    String(c.code).toUpperCase();
                  const col = c.color || "#94A3B8";
                  return (
                    <Pressable
                      key={c.code}
                      onPress={() => setActiveCat(c.code)}
                      style={[
                        styles.zoneChip,
                        on && {
                          borderColor: col,
                          backgroundColor: withAlpha(col, 0.14),
                        },
                      ]}
                    >
                      <View
                        style={[styles.swatch, { backgroundColor: col }]}
                      />
                      <View>
                        <Text style={styles.zoneCode}>{c.code}</Text>
                        <Text style={styles.zonePrice}>
                          {fmtRp(c.priceIdr)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}

            {/* Venue sketch */}
            <View style={styles.sketch}>
              {categories.map((c) => (
                <View
                  key={c.code}
                  style={[
                    styles.zoneBlock,
                    { backgroundColor: c.color || "#64748b" },
                  ]}
                >
                  <Text style={styles.zoneBlockT}>{c.code}</Text>
                  <Text style={styles.zoneBlockQ}>{c.quota ?? "—"}</Text>
                </View>
              ))}
            </View>

            <View style={styles.map}>
              <View style={styles.stage}>
                <Text style={styles.stageT}>STAGE / 무대</Text>
              </View>

              {soldOut ? (
                <View style={styles.soldBox}>
                  <Text style={styles.soldTitle}>Kursi habis</Text>
                  <Text style={styles.soldSub}>
                    Event sold out. Coba konser lain atau reset stok di Admin.
                  </Text>
                </View>
              ) : mapByCat.size === 0 ? (
                <Text style={styles.emptySeats}>Tidak ada kursi</Text>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                >
                  <View style={styles.rowsCol}>
                    {[...mapByCat.entries()].map(([cat, byRow]) => {
                      const catInfo = categories.find(
                        (c) =>
                          String(c.code).toUpperCase() ===
                          String(cat).toUpperCase()
                      );
                      const col = catInfo?.color || "#94A3B8";
                      const sortedRows = [...byRow.entries()].sort((a, b) =>
                        String(a[0]).localeCompare(String(b[0]), undefined, {
                          numeric: true,
                        })
                      );
                      return (
                        <View key={cat} style={styles.catBlock}>
                          <View style={styles.catTag}>
                            <View
                              style={[styles.swatch, { backgroundColor: col }]}
                            />
                            <Text style={styles.catTagT}>
                              {catInfo?.name || cat} ·{" "}
                              {fmtRp(catInfo?.priceIdr || 0)}
                              {catInfo?.quota != null
                                ? ` · quota ${catInfo.quota}`
                                : ""}
                            </Text>
                          </View>
                          {sortedRows.map(([rowLabel, seats]) => (
                            <View key={`${cat}-${rowLabel}`} style={styles.row}>
                              <Text style={styles.rowLab}>{rowLabel}</Text>
                              <View style={styles.seats}>
                                {seats.map((s) => {
                                  const code = String(s.code).toUpperCase();
                                  const isSold = sold.has(code);
                                  const isOn = selected.includes(code);
                                  const sc =
                                    s.color ||
                                    colorByCat[
                                      String(s.category || "").toUpperCase()
                                    ] ||
                                    col;
                                  const light =
                                    isLight(sc) && !isOn && !isSold;
                                  return (
                                    <Pressable
                                      key={code}
                                      disabled={isSold || soldOut}
                                      onPress={() => toggle(code, isSold)}
                                      style={[
                                        styles.seat,
                                        {
                                          width: seatSize,
                                          height: seatSize,
                                          borderRadius: Math.max(
                                            5,
                                            seatSize * 0.2
                                          ),
                                          backgroundColor: isSold
                                            ? "#334155"
                                            : isOn
                                              ? colors.accent
                                              : sc,
                                          borderColor: isOn
                                            ? "#fff"
                                            : "transparent",
                                          opacity: isSold ? 0.5 : 1,
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={{
                                          fontSize: Math.max(
                                            8,
                                            seatSize * 0.32
                                          ),
                                          fontWeight: "800",
                                          color: isSold
                                            ? "#64748b"
                                            : light
                                              ? "#0f172a"
                                              : "#fff",
                                        }}
                                      >
                                        {String(s.number ?? "").slice(-2) ||
                                          "·"}
                                      </Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </View>
                          ))}
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}

              <View style={styles.legend}>
                {categories.map((c) => (
                  <View key={c.code} style={styles.legItem}>
                    <View
                      style={[
                        styles.legDot,
                        { backgroundColor: c.color || "#94A3B8" },
                      ]}
                    />
                    <Text style={styles.legT}>
                      {c.code} · {fmtRp(c.priceIdr)}
                    </Text>
                  </View>
                ))}
                <View style={styles.legItem}>
                  <View
                    style={[styles.legDot, { backgroundColor: "#334155" }]}
                  />
                  <Text style={styles.legT}>SOLD</Text>
                </View>
                <View style={styles.legItem}>
                  <View
                    style={[
                      styles.legDot,
                      { backgroundColor: colors.accent },
                    ]}
                  />
                  <Text style={styles.legT}>SELECTED</Text>
                </View>
              </View>
            </View>

            {benefitPreview.length > 0 ? (
              <View style={styles.benPrev}>
                <Text style={styles.benPrevT}>Benefit zona:</Text>
                {benefitPreview.map((b, i) => (
                  <Text key={i} style={styles.benPrevL}>
                    · {b}
                  </Text>
                ))}
              </View>
            ) : null}

            <Pressable style={styles.resetBtn} onPress={clearSeats}>
              <Text style={styles.resetT}>Reset pilihan</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === "benefit" ? (
          <View style={styles.panel}>
            <Text style={styles.h3}>Benefit per zona</Text>
            <Text style={styles.muted}>
              Benefit menyesuaikan kategori kursi yang kamu beli.
            </Text>
            {categories.map((c) => {
              const bens = benefitsOf(eventId, c.code);
              return (
                <View key={c.code} style={styles.benCard}>
                  <View style={styles.benHead}>
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: c.color || "#94A3B8" },
                      ]}
                    />
                    <Text style={styles.benTitle}>
                      {c.name || c.code}
                    </Text>
                  </View>
                  <Text style={styles.benPrice}>
                    {fmtRp(c.priceIdr)}
                    {c.quota != null ? ` · ${c.quota} seats` : ""}
                  </Text>
                  {bens.map((b, i) => (
                    <Text key={i} style={styles.benLine}>
                      · {b}
                    </Text>
                  ))}
                </View>
              );
            })}
          </View>
        ) : null}

        {tab === "notice" ? (
          <View style={styles.panel}>
            <Text style={styles.h3}>Syarat & ketentuan</Text>
            {terms.map((t, i) => (
              <Bullet key={i} text={t} />
            ))}
          </View>
        ) : null}

        {msg ? (
          <View style={styles.msgBox}>
            <Text style={styles.msg}>{msg}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.bar, { paddingBottom: barPad }]}>
        <View style={styles.barLeft}>
          <Text style={styles.barKicker}>
            {selected.length
              ? `${selected.length} kursi`
              : soldOut
                ? "Sold out"
                : "Belum pilih"}
          </Text>
          <Text style={styles.barSeats} numberOfLines={1}>
            {selected.length
              ? selected.join(" · ")
              : "Pilih di tab Denah"}
          </Text>
          <Text style={styles.barTotal}>
            {selected.length ? fmtRp(totalPrice) : fmtRp(minPrice) + " ~"}
          </Text>
        </View>
        <View style={styles.barActs}>
          {selected.length > 0 ? (
            <Pressable style={styles.barGhost} onPress={clearSeats}>
              <Text style={styles.barGhostT}>Reset</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.cta, !canPay && styles.ctaOff]}
            disabled={!canPay}
            onPress={() => {
              if (tab !== "denah") {
                setTab("denah");
                return;
              }
              navigation.navigate("Antrean", {
                eventId: item.eventId,
                title: item.title,
                seatCodes: selected,
                qty: selected.length,
                amountIdr: totalPrice,
              });
            }}
          >
            <Text style={[styles.ctaText, !canPay && styles.ctaTextOff]}>
              {soldOut
                ? "Sold out"
                : tab !== "denah"
                  ? "Ke denah"
                  : "Lanjut bayar"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function DlRow({ k, v, hl }) {
  return (
    <View style={styles.dlRow}>
      <Text style={styles.dlK}>{k}</Text>
      <Text style={[styles.dlV, hl && styles.dlHl]} numberOfLines={2}>
        {v}
      </Text>
    </View>
  );
}

function Bullet({ text }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletT}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 14 },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  err: { color: colors.danger, fontWeight: "600", padding: 24 },

  posterRow: {
    flexDirection: "row",
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    overflow: "hidden",
  },
  posterBox: { position: "relative" },
  poster: {
    width: 108,
    height: 144,
    borderRadius: 10,
    backgroundColor: colors.borderLight,
  },
  posterPh: { backgroundColor: colors.border },
  tagBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: colors.tag,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagT: { color: "#fff", fontSize: 9, fontWeight: "800" },
  infoCol: { flex: 1, minWidth: 0 },
  cacheTag: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "800",
    marginBottom: 2,
  },
  genre: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 2,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  artist: {
    color: colors.accentDark,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 4,
  },
  dl: { marginTop: 8 },
  dlRow: {
    flexDirection: "row",
    marginBottom: 3,
    gap: 6,
  },
  dlK: {
    width: 68,
    color: colors.muted2,
    fontSize: 10,
    fontWeight: "700",
  },
  dlV: { flex: 1, color: colors.text, fontSize: 11, fontWeight: "600" },
  dlHl: { color: colors.accentDark, fontWeight: "800" },
  minP: {
    marginTop: 8,
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },

  priceBox: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  priceLab: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 8,
    letterSpacing: 0.4,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  priceLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  priceName: { color: colors.text, fontSize: 12, fontWeight: "600", flex: 1 },
  priceVal: { color: colors.text, fontSize: 12, fontWeight: "800" },

  tabs: { marginTop: 14, gap: 6, paddingBottom: 4 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  tabOn: {
    backgroundColor: colors.accentSoft,
    borderColor: "#bbf7d0",
  },
  tabT: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  tabTOn: { color: colors.accentDark },

  panel: {
    marginTop: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  h3: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  body: { color: "#475569", fontSize: 13, lineHeight: 20 },
  muted: { color: colors.muted, fontSize: 12, marginBottom: 10 },
  bullet: { flexDirection: "row", marginBottom: 6, gap: 8 },
  bulletDot: { color: colors.accent, fontWeight: "800" },
  bulletT: { flex: 1, color: "#475569", fontSize: 13, lineHeight: 19 },
  goSeat: {
    marginTop: 16,
    backgroundColor: colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  goSeatT: { color: "#fff", fontWeight: "800", fontSize: 14 },

  denahHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: 10,
  },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  modeChipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: "#bbf7d0",
  },
  modeT: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  modeTOn: { color: colors.accentDark },
  zoneScroll: { paddingBottom: 10 },
  zoneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  zoneCode: { color: colors.text, fontSize: 12, fontWeight: "800" },
  zonePrice: { color: colors.muted, fontSize: 10, fontWeight: "600" },

  sketch: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  zoneBlock: {
    minWidth: 56,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: "center",
  },
  zoneBlockT: { color: "#fff", fontSize: 11, fontWeight: "800" },
  zoneBlockQ: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 2,
  },

  map: {
    backgroundColor: "#0b1220",
    borderRadius: 16,
    padding: 12,
  },
  stage: {
    backgroundColor: "#1e293b",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  stageT: {
    color: "#e2e8f0",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 3,
  },
  catBlock: { marginBottom: 12 },
  catTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6,
  },
  catTagT: { color: "#e2e8f0", fontSize: 11, fontWeight: "700" },
  rowsCol: { paddingRight: 8 },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  rowLab: {
    width: 26,
    color: "#64748b",
    fontSize: 10,
    fontWeight: "800",
    textAlign: "center",
  },
  seats: { flexDirection: "row", flexWrap: "nowrap", gap: 3 },
  seat: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  emptySeats: {
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 24,
  },
  soldBox: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 16,
  },
  soldTitle: {
    color: "#f87171",
    fontWeight: "800",
    fontSize: 15,
    textAlign: "center",
  },
  soldSub: {
    color: "#94a3b8",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#1e293b",
    justifyContent: "center",
  },
  legItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legDot: { width: 8, height: 8, borderRadius: 2 },
  legT: { color: "#94a3b8", fontSize: 9, fontWeight: "700" },

  benPrev: {
    marginTop: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    padding: 10,
  },
  benPrevT: {
    color: colors.accentDark,
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 4,
  },
  benPrevL: { color: "#047857", fontSize: 11, lineHeight: 16 },
  resetBtn: {
    marginTop: 12,
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetT: { color: colors.muted, fontWeight: "700", fontSize: 12 },

  benCard: {
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  benHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  benTitle: { color: colors.text, fontWeight: "800", fontSize: 14 },
  benPrice: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 6,
  },
  benLine: { color: "#475569", fontSize: 12, lineHeight: 18 },

  msgBox: {
    marginTop: 12,
    backgroundColor: colors.warningSoft,
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  msg: {
    color: colors.warning,
    textAlign: "center",
    fontWeight: "700",
    fontSize: 13,
  },

  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
    elevation: 16,
    shadowColor: "#0f172a",
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -6 },
  },
  barLeft: { flex: 1, minWidth: 0 },
  barKicker: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  barSeats: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  barTotal: {
    color: colors.accentDark,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 2,
  },
  barActs: { flexDirection: "row", alignItems: "center", gap: 8 },
  barGhost: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  barGhostT: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  cta: {
    backgroundColor: colors.accent,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 100,
    alignItems: "center",
  },
  ctaOff: { backgroundColor: "#e2e8f0" },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  ctaTextOff: { color: "#94a3b8" },
});
