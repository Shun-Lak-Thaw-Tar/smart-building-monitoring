import { apiClient } from "./apiClient";
export const monitoringService = {
  list: () => apiClient.get("/monitoring/buildings").then((r) => r.data),
  history: (id) =>
    apiClient
      .get(`/environment/${id}`, { params: { limit: 10 } })
      .then((r) => r.data),
};
