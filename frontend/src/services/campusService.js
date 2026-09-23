import { apiClient } from "./apiClient";

export const campusService = {
  overview: () => apiClient.get("/campus/overview").then((r) => r.data),
};
