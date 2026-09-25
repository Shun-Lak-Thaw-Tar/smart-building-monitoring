import { apiClient } from "./apiClient";

export const safetyService = {
  list: (section) => apiClient.get("/safety/events", { params: section ? { section } : {} }).then((response) => response.data),
  trigger: (body) => apiClient.post("/safety/events", body).then((response) => response.data),
};
