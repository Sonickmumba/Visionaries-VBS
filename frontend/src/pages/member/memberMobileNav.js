import { Bell, ClipboardList, FileBarChart, Gauge, Receipt } from "lucide-react";

export const memberMobileNavItems = [
  { id: "member-dashboard", label: "Home", icon: Gauge },
  { id: "my-declaration", label: "Declare", icon: ClipboardList },
  { id: "my-statement", label: "Statement", icon: Receipt },
  { id: "my-reports", label: "Reports", icon: FileBarChart },
  { id: "my-notifications", label: "Alerts", icon: Bell },
];
