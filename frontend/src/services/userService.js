import { apiClient } from "./apiClient";
export const userService = {
  admins: () => apiClient.get("/users/admins").then((r) => r.data),
  staff: () => apiClient.get("/users/staff").then((r) => r.data),
  createStaff: (body) =>
    apiClient.post("/users/staff", body).then((r) => r.data),
  setStaffStatus: (userId, is_active) =>
    apiClient.patch(`/users/staff/${userId}/status`, { is_active }).then((r) => r.data),
};
