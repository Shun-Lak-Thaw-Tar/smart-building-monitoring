import { apiClient } from "./apiClient";
export const reportService = { get: (type, filters) => apiClient.get(`/reports/${type}`, { params: Object.fromEntries(Object.entries(filters).filter(([, value]) => value)) }).then((response) => response.data) };
