import { apiClient } from "./apiClient";

export const energyService = {
  buildings: () => apiClient.get("/energy/buildings").then((r) => r.data),
};
