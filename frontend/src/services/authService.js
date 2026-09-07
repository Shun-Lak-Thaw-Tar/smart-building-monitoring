import { apiClient } from "./apiClient";
export const authService = {
  login: (body) =>
    apiClient.post("/auth/login", body, { skipAuth: true }).then((r) => r.data),
  me: () => apiClient.get("/auth/me").then((r) => r.data),
};
