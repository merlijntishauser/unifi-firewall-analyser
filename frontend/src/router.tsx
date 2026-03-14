import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import FirewallModule from "./components/FirewallModule";
import TopologyModule from "./components/TopologyModule";
import MetricsPlaceholder from "./components/MetricsPlaceholder";
import HealthPlaceholder from "./components/HealthPlaceholder";

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/firewall" replace /> },
      { path: "firewall", element: <FirewallModule /> },
      { path: "topology", element: <TopologyModule /> },
      { path: "metrics", element: <MetricsPlaceholder /> },
      { path: "health", element: <HealthPlaceholder /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}
