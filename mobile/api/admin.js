import { api } from "./client";
import { ADMIN_TOKEN } from "../config";

function hdr(token) {
  return { "x-admin-token": token || ADMIN_TOKEN };
}

export function adminListEvents(token) {
  return api.get("/admin/events", hdr(token));
}

export function adminCreateEvent(body, token) {
  return api.post("/admin/events", body, hdr(token));
}

export function adminUpdateEvent(id, body, token) {
  return api.patch(`/admin/events/${id}`, body, hdr(token));
}

export function adminResetQuota(id, token) {
  return api.post(`/admin/events/${id}/reset-quota`, {}, hdr(token));
}

export function adminDeleteEvent(id, token) {
  return api.del(`/admin/events/${id}`, hdr(token));
}

export function adminListOrders(limit = 40, token) {
  return api.get(`/admin/orders?limit=${limit}`, hdr(token));
}

/** POST /admin/events/:id/regenerate-seats — denah multi-zona ulang */
export function adminRegenerateSeats(id, token) {
  return api.post(`/admin/events/${id}/regenerate-seats`, {}, hdr(token));
}
