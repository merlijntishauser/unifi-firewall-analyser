import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import LoginScreen from "./LoginScreen";
import { renderWithQuery } from "../test-utils";

vi.mock("../api/client", () => ({
  api: {
    login: vi.fn(),
  },
}));

import { api } from "../api/client";

const mockLogin = vi.mocked(api.login);

describe("LoginScreen", () => {
  const onLoggedIn = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the login form with all fields", () => {
    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);

    expect(screen.getByText("Connect to UniFi Controller")).toBeInTheDocument();
    expect(screen.getByLabelText("Controller URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Site")).toBeInTheDocument();
    expect(screen.getByLabelText("Verify SSL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
  });

  it("has default site value of 'default'", () => {
    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);
    expect(screen.getByLabelText("Site")).toHaveValue("default");
  });

  it("has verify SSL unchecked by default", () => {
    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);
    expect(screen.getByLabelText("Verify SSL")).not.toBeChecked();
  });

  it("allows entering form values", () => {
    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.change(screen.getByLabelText("Controller URL"), {
      target: { value: "https://192.168.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret" },
    });
    fireEvent.change(screen.getByLabelText("Site"), {
      target: { value: "mysite" },
    });
    fireEvent.click(screen.getByLabelText("Verify SSL"));

    expect(screen.getByLabelText("Controller URL")).toHaveValue("https://192.168.1.1");
    expect(screen.getByLabelText("Username")).toHaveValue("admin");
    expect(screen.getByLabelText("Password")).toHaveValue("secret");
    expect(screen.getByLabelText("Site")).toHaveValue("mysite");
    expect(screen.getByLabelText("Verify SSL")).toBeChecked();
  });

  it("calls api.login and onLoggedIn on successful submit", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.change(screen.getByLabelText("Controller URL"), {
      target: { value: "https://192.168.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        "https://192.168.1.1",
        "admin",
        "pass",
        "default",
        false,
      );
    });

    await waitFor(() => {
      expect(onLoggedIn).toHaveBeenCalled();
    });
  });

  it("shows 'Connecting...' while loading", async () => {
    let resolveLogin!: () => void;
    mockLogin.mockReturnValue(new Promise((r) => { resolveLogin = r; }));

    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.change(screen.getByLabelText("Controller URL"), {
      target: { value: "https://192.168.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Connecting..." })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: "Connecting..." })).toBeDisabled();

    resolveLogin();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Connect" })).toBeInTheDocument();
    });
  });

  it("displays error message when login fails with Error", async () => {
    mockLogin.mockRejectedValue(new Error("Invalid credentials"));
    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.change(screen.getByLabelText("Controller URL"), {
      target: { value: "https://192.168.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });

    expect(onLoggedIn).not.toHaveBeenCalled();
  });

  it("displays fallback error message when login fails with non-Error", async () => {
    mockLogin.mockRejectedValue("unexpected");
    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.change(screen.getByLabelText("Controller URL"), {
      target: { value: "https://192.168.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(screen.getByText("Login failed")).toBeInTheDocument();
    });
  });

  it("clears error on new submit attempt", async () => {
    mockLogin.mockRejectedValueOnce(new Error("bad"));
    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.change(screen.getByLabelText("Controller URL"), {
      target: { value: "https://192.168.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(screen.getByText("bad")).toBeInTheDocument();
    });

    mockLogin.mockResolvedValueOnce(undefined);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(screen.queryByText("bad")).not.toBeInTheDocument();
    });
  });

  it("passes verifySsl as true when checkbox is checked", async () => {
    mockLogin.mockResolvedValue(undefined);
    renderWithQuery(<LoginScreen onLoggedIn={onLoggedIn} />);

    fireEvent.change(screen.getByLabelText("Controller URL"), {
      target: { value: "https://192.168.1.1" },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "admin" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "pass" },
    });
    fireEvent.click(screen.getByLabelText("Verify SSL"));

    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        "https://192.168.1.1",
        "admin",
        "pass",
        "default",
        true,
      );
    });
  });
});
