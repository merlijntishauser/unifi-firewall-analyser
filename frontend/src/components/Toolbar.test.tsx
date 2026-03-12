import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Toolbar from "./Toolbar";

describe("Toolbar", () => {
  const defaultProps = {
    colorMode: "light" as const,
    onColorModeChange: vi.fn(),
    showHidden: false,
    onShowHiddenChange: vi.fn(),
    hasHiddenZones: false,
    hasDisabledRules: false,
    onRefresh: vi.fn(),
    loading: false,
    onLogout: vi.fn(),
    onOpenSettings: vi.fn(),
    connectionInfo: { url: "https://unifi.local", username: "admin", source: "runtime" as const },
    aiInfo: { configured: false, provider: "", model: "" },
  };

  function renderToolbar(overrides = {}) {
    return render(<Toolbar {...defaultProps} {...overrides} />);
  }

  it("renders the title", () => {
    renderToolbar();
    expect(screen.getByText("UniFi Firewall Analyser")).toBeInTheDocument();
  });

  it("does not show toggle when neither hidden zones nor disabled rules", () => {
    renderToolbar();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("shows 'Show disabled rules' when only disabled rules exist", () => {
    renderToolbar({ hasDisabledRules: true });
    expect(screen.getByLabelText("Show disabled rules")).toBeInTheDocument();
  });

  it("shows 'Show filtered zones' when only zones are hidden", () => {
    renderToolbar({ hasHiddenZones: true });
    expect(screen.getByLabelText("Show filtered zones")).toBeInTheDocument();
  });

  it("shows combined label when both hidden zones and disabled rules", () => {
    renderToolbar({ hasHiddenZones: true, hasDisabledRules: true });
    expect(screen.getByLabelText("Show filtered zones and disabled rules")).toBeInTheDocument();
  });

  it("checkbox reflects showHidden prop", () => {
    renderToolbar({ hasDisabledRules: true, showHidden: true });
    expect(screen.getByRole("checkbox")).toBeChecked();
  });

  it("calls onShowHiddenChange when checkbox is toggled", () => {
    const handler = vi.fn();
    renderToolbar({ hasDisabledRules: true, onShowHiddenChange: handler });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(handler).toHaveBeenCalledWith(true);
  });

  it("shows 'Dark' button when colorMode is light", () => {
    renderToolbar({ colorMode: "light" });
    expect(screen.getByRole("button", { name: "Dark" })).toBeInTheDocument();
  });

  it("shows 'Light' button when colorMode is dark", () => {
    renderToolbar({ colorMode: "dark" });
    expect(screen.getByRole("button", { name: "Light" })).toBeInTheDocument();
  });

  it("calls onColorModeChange with 'dark' when clicking Dark button", () => {
    const handler = vi.fn();
    renderToolbar({ colorMode: "light", onColorModeChange: handler });
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));
    expect(handler).toHaveBeenCalledWith("dark");
  });

  it("calls onColorModeChange with 'light' when clicking Light button", () => {
    const handler = vi.fn();
    renderToolbar({ colorMode: "dark", onColorModeChange: handler });
    fireEvent.click(screen.getByRole("button", { name: "Light" }));
    expect(handler).toHaveBeenCalledWith("light");
  });

  it("shows 'Refresh' button when not loading", () => {
    renderToolbar({ loading: false });
    const btn = screen.getByRole("button", { name: "Refresh" });
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it("shows 'Refreshing...' and disables button when loading", () => {
    renderToolbar({ loading: true });
    const btn = screen.getByRole("button", { name: "Refreshing..." });
    expect(btn).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it("calls onRefresh when Refresh button is clicked", () => {
    const handler = vi.fn();
    renderToolbar({ onRefresh: handler });
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders Disconnect button", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("calls onLogout when Disconnect is clicked", () => {
    const handler = vi.fn();
    renderToolbar({ onLogout: handler });
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("renders Settings button", () => {
    renderToolbar();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("calls onOpenSettings when Settings is clicked", () => {
    const handler = vi.fn();
    renderToolbar({ onOpenSettings: handler });
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("shows connected Controller badge with tooltip", () => {
    renderToolbar({ connectionInfo: { url: "https://unifi.local", username: "admin", source: "runtime" as const } });
    expect(screen.getByText("Controller")).toBeInTheDocument();
    expect(screen.getByText(/Connected to: https:\/\/unifi\.local/)).toBeInTheDocument();
    expect(screen.getByText(/As: admin/)).toBeInTheDocument();
    expect(screen.getByText(/Config from: runtime/)).toBeInTheDocument();
  });

  it("shows disconnected Controller badge when connectionInfo is null", () => {
    renderToolbar({ connectionInfo: null });
    expect(screen.getByText("Controller")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("shows active AI badge with provider and model tooltip", () => {
    renderToolbar({ aiInfo: { configured: true, provider: "anthropic", model: "claude-sonnet-4-20250514" } });
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText(/AI LLM: anthropic/)).toBeInTheDocument();
    expect(screen.getByText(/Model: claude-sonnet-4-20250514/)).toBeInTheDocument();
  });

  it("shows inactive AI badge when not configured", () => {
    renderToolbar({ aiInfo: { configured: false, provider: "", model: "" } });
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Not configured")).toBeInTheDocument();
  });
});
