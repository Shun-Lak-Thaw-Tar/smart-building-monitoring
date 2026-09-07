import { apiClient } from "./apiClient";
export const equipmentService = {
  list: (params) => apiClient.get("/equipment", { params }).then((r) => r.data),
  create: (body) => apiClient.post("/equipment", body).then((r) => r.data),
  update: (id, body) =>
    apiClient.patch(`/equipment/${id}`, body).then((r) => r.data),
};
