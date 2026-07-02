import { Banknote, ClipboardList, FileBarChart, Gauge, PiggyBank } from "lucide-react";

export const memberMobileNavItems = [
  { id: "member-dashboard", label: "Home", icon: Gauge },
  { id: "my-declaration", label: "Declare", icon: ClipboardList },
  { id: "my-savings", label: "Savings", icon: PiggyBank },
  { id: "my-loans", label: "Loans", icon: Banknote },
  { id: "my-reports", label: "Reports", icon: FileBarChart },
];
