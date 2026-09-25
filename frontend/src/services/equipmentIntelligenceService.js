import { apiClient } from "./apiClient";

export const equipmentIntelligenceService = {
  list: () => apiClient.get("/equipment/intelligence").then((r) => r.data),
};
