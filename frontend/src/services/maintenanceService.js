import { apiClient } from "./apiClient";
export const maintenanceService = {
  list: (params) =>
    apiClient.get("/maintenance-history", { params }).then((r) => r.data),
  create: (body) =>
    apiClient.post("/maintenance-history", body).then((r) => r.data),
};
