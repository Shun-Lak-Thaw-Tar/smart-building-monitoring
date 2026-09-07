import axios from "axios";
export const TOKEN_KEY = "smart-building-token";
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api",
  timeout: 15000,
});
apiClient.interceptors.request.use((c) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token && !c.skipAuth) c.headers.Authorization = `Bearer ${token}`;
  return c;
});
apiClient.interceptors.response.use(
  (r) => r,
  (e) => {
    if (
      e.response?.status === 401 &&
      !e.config?.skipAuth &&
      e.config?.headers?.Authorization ===
        `Bearer ${sessionStorage.getItem(TOKEN_KEY)}`
    ) {
      sessionStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new Event("session-expired"));
    }
    return Promise.reject(e);
  },
);
export function errorMessage(e) {
  if (!e.response) return "Unable to connect to the server.";
  const { status, data } = e.response;
  if (status === 403)
    return "You do not have permission to perform this action.";
  if (status === 503)
    return "The service is temporarily unavailable. Please try again.";
  if (status === 422)
    return Array.isArray(data.detail)
      ? data.detail
          .map(
            (v) =>
              `${v.loc?.slice(1).join(" ").replaceAll("_", " ") || "Form"}: ${v.msg}`,
          )
          .join(". ")
      : "Please check the form fields.";
  if (status >= 500) return "Something went wrong. Please try again.";
  return typeof data?.detail === "string"
    ? data.detail
    : "Unable to complete this action.";
}
