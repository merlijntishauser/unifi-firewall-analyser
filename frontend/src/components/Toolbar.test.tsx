import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Toolbar from "./Toolbar";

describe("Toolbar", () => {
  const defaultProps = {
    colorMode: "light" as const,
    onColorModeChange: vi.fn(),
    showDisabled: false,
    onShowDisabledChange: vi.fn(),
    onRefresh: vi.fn(),
    loading: false,
    onLogout: vi.fn(),
    onOpenSettings: vi.fn(),
  };

  function renderToolbar(overrides = {}) {
    return render(<Toolbar {...defaultProps} {...overrides} />);
  }

  it("renders the title", () => {
    renderToolbar();
    expect(screen.getByText("UniFi Firewall Analyser")).toBeInTheDocument();
  });

  it("renders 'Show disabled rules' checkbox", () => {
    renderToolbar();
    expect(screen.getByLabelText("Show disabled rules")).toBeInTheDocument();
  });

  it("checkbox reflects showDisabled prop", () => {
    renderToolbar({ showDisabled: true });
    expect(screen.getByLabelText("Show disabled rules")).toBeChecked();
  });

  it("checkbox unchecked when showDisabled is false", () => {
    renderToolbar({ showDisabled: false });
    expect(screen.getByLabelText("Show disabled rules")).not.toBeChecked();
  });

  it("calls onShowDisabledChange when checkbox is toggled", () => {
    const handler = vi.fn();
    renderToolbar({ onShowDisabledChange: handler });
    fireEvent.click(screen.getByLabelText("Show disabled rules"));
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
});
