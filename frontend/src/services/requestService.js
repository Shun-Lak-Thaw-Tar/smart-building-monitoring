import { apiClient } from "./apiClient";
export const requestService = {
  list: (params) => apiClient.get("/requests", { params }).then((r) => r.data),
  mine: () => apiClient.get("/requests/my").then((r) => r.data),
  get: (id) => apiClient.get(`/requests/${id}`).then((r) => r.data),
  history: (id) => apiClient.get(`/requests/${id}/history`).then((r) => r.data),
  create: (body) => apiClient.post("/requests", body).then((r) => r.data),
  assign: (id, assigned_to) =>
    apiClient
      .patch(`/requests/${id}/assign`, { assigned_to })
      .then((r) => r.data),
  status: (id, body) =>
    apiClient.patch(`/requests/${id}/status`, body).then((r) => r.data),
};
