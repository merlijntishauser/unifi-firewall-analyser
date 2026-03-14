import type { RouteObject } from "react-router-dom";
import { createBrowserRouter, createMemoryRouter, Navigate } from "react-router-dom";
import AppShell from "./components/AppShell";
import FirewallModule from "./components/FirewallModule";
import TopologyPlaceholder from "./components/TopologyPlaceholder";
import MetricsPlaceholder from "./components/MetricsPlaceholder";
import HealthPlaceholder from "./components/HealthPlaceholder";

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/firewall" replace /> },
      { path: "firewall", element: <FirewallModule /> },
      { path: "topology", element: <TopologyPlaceholder /> },
      { path: "metrics", element: <MetricsPlaceholder /> },
      { path: "health", element: <HealthPlaceholder /> },
    ],
  },
];

export function createAppRouter() {
  return createBrowserRouter(routes);
}

export function createTestRouter(initialEntries?: string[]) {
  return createMemoryRouter(routes, { initialEntries: initialEntries ?? ["/firewall"] });
}
