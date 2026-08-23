import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import {
  adminCreateEvent,
  adminDeleteEvent,
  adminListEvents,
  adminListOrders,
  adminRegenerateSeats,
  adminResetQuota,
  adminUpdateEvent,
} from "../api/admin";
import { ADMIN_TOKEN, BASE_URL } from "../config";
import { colors } from "../theme";

const STATUSES = ["PUBLISHED", "DRAFT", "CLOSED"];
const MAX_POSTER_BYTES = 2.5 * 1024 * 1024;

const EMPTY_FORM = {
  title: "",
  artist: "",
  venue: "ICE BSD",
  city: "",
  country: "Indonesia",
  startsAt: "",
  salesOpensAt: "",
  quotaTotal: "100",
  priceIdr: "750000",
  status: "PUBLISHED",
  description: "",
  generateSeats: true,
  /** data URL baru (base64) — dikirim ke API sebagai poster */
  posterDataUrl: null,
  /** preview URI (data URL atau http) */
  posterPreview: null,
  /** path lama dari server (jika edit tanpa ganti) */
  posterExisting: null,
};

function resolvePosterUri(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function mimeFromUri(uri, assetType) {
  if (assetType && /^image\//i.test(assetType)) return assetType.toLowerCase();
  const u = String(uri || "").toLowerCase();
  if (u.includes(".png")) return "image/png";
  if (u.includes(".webp")) return "image/webp";
  if (u.includes(".gif")) return "image/gif";
  return "image/jpeg";
}

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

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("id-ID", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(iso);
  }
}

/** datetime-local style: 2026-10-18T20:00 */
function toLocalInput(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
}

function defaultStartsLocal() {
  const d = new Date(Date.now() + 14 * 864e5);
  return toLocalInput(d.toISOString());
}

function localToIso(local) {
  const s = String(local || "").trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function AdminScreen() {
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState(null);
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    startsAt: defaultStartsLocal(),
  });
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [ev, ord] = await Promise.all([
        adminListEvents(ADMIN_TOKEN),
        adminListOrders(40, ADMIN_TOKEN),
      ]);
      setEvents(ev.items || []);
      setOrders(ord.items || []);
    } catch (e) {
      setMsg(e.message || "Gagal muat admin");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function startEdit(e) {
    const existing = e.posterUrl || e.poster || null;
    setEditingId(e.eventId);
    setForm({
      title: e.title || "",
      artist: e.artist || "",
      venue: e.venue || "",
      city: e.city || "",
      country: e.country || "Indonesia",
      startsAt: toLocalInput(e.startsAt) || defaultStartsLocal(),
      salesOpensAt: toLocalInput(e.salesOpensAt) || "",
      quotaTotal: String(e.quotaTotal ?? 100),
      priceIdr: String(e.priceIdr ?? 0),
      status: e.status || "PUBLISHED",
      description: e.description || "",
      generateSeats: true,
      posterDataUrl: null,
      posterPreview: resolvePosterUri(existing),
      posterExisting: existing,
    });
    setMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, startsAt: defaultStartsLocal() });
  }

  function clearPoster() {
    setForm((f) => ({
      ...f,
      posterDataUrl: null,
      posterPreview: null,
      posterExisting: null,
    }));
  }

  async function pickPoster() {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Izin galeri",
          "Izinkan akses foto untuk memilih poster konser."
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.85,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const uri = asset.uri;
      const mime = mimeFromUri(uri, asset.mimeType);

      let b64 = asset.base64;
      if (!b64) {
        b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: "base64",
        });
      }
      if (!b64) {
        Alert.alert("Gagal", "Tidak bisa baca file gambar");
        return;
      }
      // perkiraan ukuran base64
      const approxBytes = Math.floor((b64.length * 3) / 4);
      if (approxBytes > MAX_POSTER_BYTES) {
        Alert.alert("Terlalu besar", "Ukuran gambar maks. 2.5 MB");
        return;
      }
      const dataUrl = `data:${mime};base64,${b64}`;
      setForm((f) => ({
        ...f,
        posterDataUrl: dataUrl,
        posterPreview: dataUrl,
      }));
      setMsg("Poster dipilih — simpan untuk mengunggah");
    } catch (e) {
      Alert.alert("Gagal pilih foto", e.message || "error");
    }
  }

  function buildBody(isCreate) {
    const startsAt = localToIso(form.startsAt);
    if (!startsAt) throw new Error("Tanggal mulai konser tidak valid");
    const salesOpensAt = localToIso(form.salesOpensAt) || undefined;
    const body = {
      title: form.title.trim(),
      artist: form.artist.trim(),
      venue: form.venue.trim(),
      city: form.city.trim() || undefined,
      country: form.country.trim() || undefined,
      startsAt,
      salesOpensAt,
      quotaTotal: Number(form.quotaTotal),
      priceIdr: Number(form.priceIdr),
      status: form.status || "PUBLISHED",
      description: form.description.trim() || undefined,
    };
    if (isCreate) body.generateSeats = !!form.generateSeats;
    // poster: data URL baru, atau path existing saat edit tanpa ganti
    if (form.posterDataUrl) {
      body.poster = form.posterDataUrl;
    } else if (editingId && form.posterExisting) {
      // biarkan server pakai yang lama — jangan kirim null
    } else if (editingId && !form.posterPreview && form.posterExisting === null) {
      // user hapus poster — kirim string kosong tidak didukung; skip
    }
    return body;
  }

  async function onCreate() {
    try {
      if (!form.title.trim() || !form.artist.trim() || !form.venue.trim()) {
        Alert.alert("Lengkapi form", "Judul, artist, dan venue wajib.");
        return;
      }
      if (editingId) {
        await adminUpdateEvent(editingId, buildBody(false), ADMIN_TOKEN);
        setMsg(`Perubahan #${editingId} disimpan`);
        cancelEdit();
        await load();
        return;
      }
      const created = await adminCreateEvent(buildBody(true), ADMIN_TOKEN);
      setMsg(
        created.posterUrl
          ? `Event #${created.eventId} dibuat + poster`
          : `Event #${created.eventId} dibuat`
      );
      setForm({ ...EMPTY_FORM, startsAt: defaultStartsLocal() });
      await load();
    } catch (e) {
      Alert.alert("Gagal", e.message || "simpan gagal");
    }
  }

  async function toggleStatus(e) {
    const next = e.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    try {
      await adminUpdateEvent(e.eventId, { status: next }, ADMIN_TOKEN);
      await load();
    } catch (err) {
      Alert.alert("Gagal", err.message);
    }
  }

  async function resetQ(e) {
    try {
      const r = await adminResetQuota(e.eventId, ADMIN_TOKEN);
      setMsg(`Stok #${e.eventId} direset · sisa ${r.sisa ?? "—"}`);
      await load();
    } catch (err) {
      Alert.alert("Gagal", err.message);
    }
  }

  async function regenSeats(e) {
    Alert.alert(
      "Buat ulang denah?",
      `Regenerate multi-zona untuk "${e.title}"? Kursi lama diganti.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Buat denah",
          onPress: async () => {
            try {
              const r = await adminRegenerateSeats(e.eventId, ADMIN_TOKEN);
              setMsg(
                `Denah #${e.eventId} siap · ${r.seatsCreated || 0} kursi`
              );
              await load();
            } catch (err) {
              Alert.alert("Gagal", err.message);
            }
          },
        },
      ]
    );
  }

  function deleteEv(e) {
    Alert.alert(
      "Hapus konser",
      `Hapus "${e.title}"? Order & kursi terkait ikut terhapus.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Hapus",
          style: "destructive",
          onPress: async () => {
            try {
              await adminDeleteEvent(e.eventId, ADMIN_TOKEN);
              setMsg(`Event #${e.eventId} dihapus`);
              await load();
            } catch (err) {
              Alert.alert("Gagal", err.message);
            }
          },
        },
      ]
    );
  }

  const publishedCount = events.filter((e) => e.status === "PUBLISHED").length;
  const titleById = Object.fromEntries(
    events.map((e) => [e.eventId, e.title])
  );

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={s.pad}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={s.hero}>
        <View style={{ flex: 1 }}>
          <Text style={s.kicker}>PANEL ADMIN</Text>
          <Text style={s.h1}>Kelola konser</Text>
          <Text style={s.sub}>
            Sama web: kota, jadwal, status, deskripsi, denah
          </Text>
        </View>
        <Pressable style={s.refreshBtn} onPress={load}>
          <Text style={s.refreshT}>Refresh</Text>
        </Pressable>
      </View>

      <View style={s.stats}>
        <View style={s.stat}>
          <Text style={s.statN}>{events.length}</Text>
          <Text style={s.statL}>Event</Text>
        </View>
        <View style={s.statDiv} />
        <View style={s.stat}>
          <Text style={s.statN}>{publishedCount}</Text>
          <Text style={s.statL}>Live</Text>
        </View>
        <View style={s.statDiv} />
        <View style={s.stat}>
          <Text style={s.statN}>{orders.length}</Text>
          <Text style={s.statL}>Order</Text>
        </View>
      </View>

      {msg ? (
        <View style={s.toast}>
          <Text style={s.toastT}>{msg}</Text>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
      ) : null}

      <View style={s.section}>
        <Text style={s.sectionTag}>
          {editingId ? `EDIT #${editingId}` : "BARU"}
        </Text>
        <Text style={s.h2}>
          {editingId ? "Ubah data konser" : "Tambah konser"}
        </Text>

        <Field label="Judul *">
          <TextInput
            style={s.input}
            value={form.title}
            onChangeText={(v) => setField("title", v)}
            placeholder="WORLD TOUR JAKARTA"
            placeholderTextColor={colors.muted2}
          />
        </Field>
        <Field label="Artist *">
          <TextInput
            style={s.input}
            value={form.artist}
            onChangeText={(v) => setField("artist", v)}
            placeholder="Artist Name"
            placeholderTextColor={colors.muted2}
          />
        </Field>
        <Field label="Venue *">
          <TextInput
            style={s.input}
            value={form.venue}
            onChangeText={(v) => setField("venue", v)}
            placeholder="ICE BSD"
            placeholderTextColor={colors.muted2}
          />
        </Field>

        <View style={s.row2}>
          <Field label="Kota" style={{ flex: 1 }}>
            <TextInput
              style={s.input}
              value={form.city}
              onChangeText={(v) => setField("city", v)}
              placeholder="Tangerang"
              placeholderTextColor={colors.muted2}
            />
          </Field>
          <Field label="Negara" style={{ flex: 1 }}>
            <TextInput
              style={s.input}
              value={form.country}
              onChangeText={(v) => setField("country", v)}
              placeholder="Indonesia"
              placeholderTextColor={colors.muted2}
            />
          </Field>
        </View>

        <Field label="Mulai konser * (YYYY-MM-DDTHH:mm)">
          <TextInput
            style={s.input}
            value={form.startsAt}
            onChangeText={(v) => setField("startsAt", v)}
            placeholder="2026-10-18T20:00"
            placeholderTextColor={colors.muted2}
            autoCapitalize="none"
          />
        </Field>
        <Field label="Buka penjualan (opsional)">
          <TextInput
            style={s.input}
            value={form.salesOpensAt}
            onChangeText={(v) => setField("salesOpensAt", v)}
            placeholder="2026-09-01T10:00"
            placeholderTextColor={colors.muted2}
            autoCapitalize="none"
          />
        </Field>

        <View style={s.row2}>
          <Field label="Kuota total *" style={{ flex: 1 }}>
            <TextInput
              style={s.input}
              value={form.quotaTotal}
              onChangeText={(v) => setField("quotaTotal", v)}
              keyboardType="numeric"
              placeholderTextColor={colors.muted2}
            />
          </Field>
          <Field label="Harga (IDR) *" style={{ flex: 1 }}>
            <TextInput
              style={s.input}
              value={form.priceIdr}
              onChangeText={(v) => setField("priceIdr", v)}
              keyboardType="numeric"
              placeholderTextColor={colors.muted2}
            />
          </Field>
        </View>

        <Text style={s.label}>Status</Text>
        <View style={s.statusRow}>
          {STATUSES.map((st) => {
            const on = form.status === st;
            return (
              <Pressable
                key={st}
                onPress={() => setField("status", st)}
                style={[s.statusChip, on && s.statusChipOn]}
              >
                <Text style={[s.statusT, on && s.statusTOn]}>{st}</Text>
              </Pressable>
            );
          })}
        </View>

        {!editingId ? (
          <View style={s.switchRow}>
            <Text style={s.switchLab}>Denah multi-zona</Text>
            <Switch
              value={!!form.generateSeats}
              onValueChange={(v) => setField("generateSeats", v)}
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
        ) : null}

        <Field label="Deskripsi">
          <TextInput
            style={[s.input, s.textarea]}
            value={form.description}
            onChangeText={(v) => setField("description", v)}
            placeholder="Opsional"
            placeholderTextColor={colors.muted2}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </Field>

        <Text style={s.label}>Poster / gambar</Text>
        <View style={s.posterBox}>
          {form.posterPreview ? (
            <Image
              source={{ uri: form.posterPreview }}
              style={s.posterImg}
              resizeMode="cover"
            />
          ) : (
            <View style={s.posterEmpty}>
              <Text style={s.posterEmptyT}>Belum ada gambar</Text>
            </View>
          )}
          <View style={s.posterActs}>
            <Pressable style={s.posterBtn} onPress={pickPoster}>
              <Text style={s.posterBtnT}>Pilih gambar</Text>
            </Pressable>
            {form.posterPreview ? (
              <Pressable style={s.posterBtnGhost} onPress={clearPoster}>
                <Text style={s.posterBtnGhostT}>Hapus</Text>
              </Pressable>
            ) : null}
            <Text style={s.posterHint}>JPG/PNG/WebP · maks 2.5 MB</Text>
          </View>
        </View>

        <Pressable style={s.btnPrimary} onPress={onCreate}>
          <Text style={s.btnPrimaryT}>
            {editingId ? "Simpan perubahan" : "Buat konser"}
          </Text>
        </Pressable>
        {editingId ? (
          <Pressable style={s.btnGhost} onPress={cancelEdit}>
            <Text style={s.btnGhostT}>Batal edit</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={s.listHead}>
        <Text style={s.h2}>Daftar event</Text>
        <Text style={s.count}>{events.length}</Text>
      </View>

      {events.map((e) => {
        const sisaZero = Number(e.sisa) === 0;
        const published = e.status === "PUBLISHED";
        const thumb = resolvePosterUri(e.posterUrl || e.poster);
        return (
          <View key={e.eventId} style={s.card}>
            <View style={s.cardTop}>
              <Text style={s.eid}>#{e.eventId}</Text>
              <View style={[s.badge, published ? s.badgeOk : s.badgeMuted]}>
                <Text
                  style={[s.badgeT, published ? s.badgeOkT : s.badgeMutedT]}
                >
                  {e.status || "—"}
                </Text>
              </View>
            </View>
            <View style={s.cardMain}>
              {thumb ? (
                <Image source={{ uri: thumb }} style={s.cardThumb} />
              ) : (
                <View style={[s.cardThumb, s.cardThumbPh]} />
              )}
              <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.cardT} numberOfLines={2}>
              {e.title}
            </Text>
            <Text style={s.artist} numberOfLines={1}>
              {e.artist || "—"}
              {e.venue ? ` · ${e.venue}` : ""}
            </Text>
            <Text style={s.loc} numberOfLines={1}>
              {[e.city, e.country].filter(Boolean).join(" · ") || "—"}
              {e.startsAt ? ` · ${fmtWhen(e.startsAt)}` : ""}
            </Text>
            <Text style={s.price}>{fmtRp(e.priceIdr)}</Text>
              </View>
            </View>
            <View style={s.chips}>
              <View style={s.chip}>
                <Text style={s.chipT}>Kuota {e.quotaTotal}</Text>
              </View>
              <View style={[s.chip, s.chipSisa, sisaZero && s.chipWarn]}>
                <Text
                  style={[s.chipT, s.chipSisaT, sisaZero && s.chipWarnT]}
                >
                  Sisa {e.sisa ?? "—"}
                </Text>
              </View>
              <View style={s.chip}>
                <Text style={s.chipT}>Order {e.ordersConfirmed || 0}</Text>
              </View>
            </View>
            <View style={s.actions}>
              <Pressable style={s.mini} onPress={() => startEdit(e)}>
                <Text style={s.miniT}>Edit</Text>
              </Pressable>
              <Pressable style={s.mini} onPress={() => toggleStatus(e)}>
                <Text style={s.miniT}>
                  {published ? "Draft" : "Publish"}
                </Text>
              </Pressable>
              <Pressable style={s.mini} onPress={() => resetQ(e)}>
                <Text style={s.miniT}>Reset</Text>
              </Pressable>
              <Pressable style={s.mini} onPress={() => regenSeats(e)}>
                <Text style={s.miniT}>Denah</Text>
              </Pressable>
              <Pressable
                style={[s.mini, s.miniDanger]}
                onPress={() => deleteEv(e)}
              >
                <Text style={[s.miniT, s.miniDangerT]}>Hapus</Text>
              </Pressable>
            </View>
          </View>
        );
      })}

      <View style={[s.listHead, { marginTop: 12 }]}>
        <Text style={s.h2}>Order terbaru</Text>
        <Text style={s.count}>{Math.min(orders.length, 20)}</Text>
      </View>
      {orders.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.empty}>Belum ada order</Text>
        </View>
      ) : (
        orders.slice(0, 20).map((o) => (
          <View key={o.orderId} style={s.orderCard}>
            <View style={s.orderTop}>
              <Text style={s.orderId}>
                {String(o.orderId).slice(0, 8).toUpperCase()}
              </Text>
              <Text style={s.orderSt}>{o.status}</Text>
            </View>
            <Text style={s.muted} numberOfLines={1}>
              {titleById[o.eventId] || `Event #${o.eventId}`}
            </Text>
            <Text style={s.muted}>
              {o.buyerName || "—"}
              {o.buyerEmail ? ` · ${o.buyerEmail}` : ""}
              {" · qty "}
              {o.qty}
            </Text>
            <Text style={s.orderTime}>
              {fmtWhen(o.createdAt || o.created_at || o.paidAt)}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function Field({ label, children, style }) {
  return (
    <View style={[s.field, style]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 16, paddingBottom: 56 },
  hero: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
    gap: 12,
  },
  kicker: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
  },
  h1: {
    color: colors.text,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginTop: 4,
  },
  sub: { color: colors.muted, fontSize: 13, marginTop: 4 },
  refreshBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
  },
  refreshT: { color: colors.onAccent, fontWeight: "800", fontSize: 12 },

  stats: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    marginBottom: 14,
  },
  stat: { flex: 1, alignItems: "center" },
  statN: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.4,
  },
  statL: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    marginTop: 2,
  },
  statDiv: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  toast: {
    backgroundColor: colors.accentSoft,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  toastT: { color: colors.accentDark, fontWeight: "700", fontSize: 13 },

  section: {
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 20,
  },
  sectionTag: {
    color: colors.accentDark,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  h2: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  field: { marginBottom: 12 },
  row2: { flexDirection: "row", gap: 10 },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textarea: { minHeight: 72, paddingTop: 12 },
  posterBox: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    alignItems: "flex-start",
  },
  posterImg: {
    width: 96,
    height: 128,
    borderRadius: 12,
    backgroundColor: colors.borderLight,
  },
  posterEmpty: {
    width: 96,
    height: 128,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    padding: 8,
  },
  posterEmptyT: {
    color: colors.muted2,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  posterActs: { flex: 1, justifyContent: "center", gap: 8 },
  posterBtn: {
    backgroundColor: colors.accentSoft,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  posterBtnT: { color: colors.accentDark, fontWeight: "800", fontSize: 13 },
  posterBtnGhost: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  posterBtnGhostT: { color: colors.muted, fontWeight: "700", fontSize: 12 },
  posterHint: { color: colors.muted2, fontSize: 11, marginTop: 4 },
  cardMain: { flexDirection: "row", gap: 12, marginBottom: 4 },
  cardThumb: {
    width: 56,
    height: 74,
    borderRadius: 8,
    backgroundColor: colors.borderLight,
  },
  cardThumbPh: { backgroundColor: colors.border },
  statusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.inputBg,
  },
  statusChipOn: {
    backgroundColor: colors.accentSoft,
    borderColor: "#bbf7d0",
  },
  statusT: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  statusTOn: { color: colors.accentDark },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingVertical: 4,
  },
  switchLab: { color: colors.text, fontWeight: "700", fontSize: 13 },
  btnPrimary: {
    marginTop: 4,
    backgroundColor: colors.accent,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  btnPrimaryT: { color: colors.onAccent, fontWeight: "800", fontSize: 15 },
  btnGhost: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnGhostT: { color: colors.muted, fontWeight: "700", fontSize: 14 },

  listHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  count: {
    backgroundColor: colors.accentSoft,
    color: colors.accentDark,
    fontWeight: "800",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: "hidden",
  },

  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  eid: { color: colors.muted2, fontWeight: "800", fontSize: 12 },
  badge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeOk: { backgroundColor: colors.accentSoft },
  badgeMuted: { backgroundColor: colors.borderLight },
  badgeT: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  badgeOkT: { color: colors.accentDark },
  badgeMutedT: { color: colors.muted },
  cardT: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
    lineHeight: 20,
  },
  artist: { color: colors.muted, fontSize: 12, marginTop: 3 },
  loc: { color: colors.muted2, fontSize: 11, marginTop: 2 },
  price: {
    color: colors.accentDark,
    fontSize: 14,
    fontWeight: "800",
    marginTop: 6,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  chip: {
    backgroundColor: colors.borderLight,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    marginRight: 6,
    marginBottom: 4,
  },
  chipT: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  chipSisa: { backgroundColor: colors.accentSoft },
  chipSisaT: { color: colors.accentDark },
  chipWarn: { backgroundColor: colors.warningSoft },
  chipWarnT: { color: colors.warning },
  actions: { flexDirection: "row", flexWrap: "wrap", marginTop: 12 },
  mini: {
    backgroundColor: colors.borderLight,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 6,
  },
  miniDanger: {
    backgroundColor: colors.dangerSoft,
    borderColor: "#fecaca",
  },
  miniT: { color: colors.text, fontSize: 12, fontWeight: "700" },
  miniDangerT: { color: colors.danger },

  orderCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  orderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  orderId: { color: colors.text, fontWeight: "800", fontSize: 13 },
  orderSt: {
    color: colors.accentDark,
    fontSize: 11,
    fontWeight: "800",
  },
  muted: { color: colors.muted, marginTop: 4, fontSize: 12 },
  orderTime: { color: colors.muted2, fontSize: 11, marginTop: 4 },
  emptyBox: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  empty: { color: colors.muted2, fontSize: 13 },
});
