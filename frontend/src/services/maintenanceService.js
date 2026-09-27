import { apiClient } from "./apiClient";
export const maintenanceService = {
  list: (params) =>
    apiClient.get("/maintenance-history", { params }).then((r) => r.data),
  create: (body) =>
    apiClient.post("/maintenance-history", body).then((r) => r.data),
  get: (id) => apiClient.get(`/maintenance-history/${id}`).then((r) => r.data),
  resolvedRequests: () => apiClient.get("/maintenance-history/resolved-requests").then((r) => r.data),
};
