import { apiClient } from "./apiClient";

export const roomService = {
  list: (params) => apiClient.get("/rooms", { params }).then((r) => r.data),
  get: (id) => apiClient.get(`/rooms/${id}`).then((r) => r.data),
};
