import { apiClient } from "./apiClient";

export const comfortService = {
  buildings: () => apiClient.get("/comfort/buildings").then((r) => r.data),
};
