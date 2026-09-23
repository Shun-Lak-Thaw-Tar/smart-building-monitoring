import { apiClient } from "./apiClient";

export const alertService = {
  list: (params) => apiClient.get("/alerts", { params }).then((r) => r.data),
  get: (id) => apiClient.get(`/alerts/${id}`).then((r) => r.data),
  create: (body) => apiClient.post("/alerts", body).then((r) => r.data),
  resolve: (id) => apiClient.patch(`/alerts/${id}/resolve`).then((r) => r.data),
};
