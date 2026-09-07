export const labels = {
  PENDING: "Pending",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  OPERATIONAL: "Operational",
  MAINTENANCE_REQUIRED: "Maintenance Required",
  OUT_OF_SERVICE: "Out of Service",
  NORMAL: "Normal",
  ATTENTION: "Attention",
  CRITICAL: "Critical",
  STAFF: "Office Staff",
  ADMIN: "Administrator",
};
export const requestStatuses = ["PENDING", "IN_PROGRESS", "RESOLVED"];
export const priorities = ["LOW", "MEDIUM", "HIGH"];
export const equipmentStatuses = [
  "OPERATIONAL",
  "MAINTENANCE_REQUIRED",
  "OUT_OF_SERVICE",
];
const formatter = new Intl.DateTimeFormat(undefined, {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
export const dateTime = (v) =>
  v ? formatter.format(new Date(v)) : "Not available";
export const homeFor = (user) =>
  user?.role === "ADMIN" ? "/admin/dashboard" : "/staff/dashboard";
