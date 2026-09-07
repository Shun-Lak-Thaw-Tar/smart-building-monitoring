import { apiClient } from "./apiClient";
export const buildingService = {
  list: () => apiClient.get("/buildings").then((r) => r.data),
};
