import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import FirewallModule from "./components/FirewallModule";
import TopologyModule from "./components/TopologyModule";
import MetricsModule from "./components/MetricsModule";
import HealthModule from "./components/HealthModule";

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/firewall" replace /> },
      { path: "firewall", element: <FirewallModule /> },
      { path: "topology", element: <TopologyModule /> },
      { path: "metrics", element: <MetricsModule /> },
      { path: "health", element: <HealthModule /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
