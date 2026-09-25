import { apiClient } from "./apiClient";

export const alertService = {
  list: (params = {}) => apiClient.get("/alerts", {
    params: Object.fromEntries(Object.entries(params).filter(([, value]) => value)),
  }).then((r) => r.data),
  get: (id) => apiClient.get(`/alerts/${id}`).then((r) => r.data),
  create: (body) => apiClient.post("/alerts", body).then((r) => r.data),
  acknowledge: (id) => apiClient.patch(`/alerts/${id}/acknowledge`).then((r) => r.data),
  createMaintenanceRequest: (id, body) => apiClient.post(`/alerts/${id}/maintenance-request`, body).then((r) => r.data),
  resolve: (id) => apiClient.patch(`/alerts/${id}/resolve`).then((r) => r.data),
};
