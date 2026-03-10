import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import SettingsModal from "./SettingsModal";
import type { AiConfig, AiPreset } from "../api/types";

vi.mock("../api/client", () => ({
  api: {
    getAiPresets: vi.fn(),
    getAiConfig: vi.fn(),
    saveAiConfig: vi.fn(),
    testAiConnection: vi.fn(),
    deleteAiConfig: vi.fn(),
  },
}));

import { api } from "../api/client";

const mockGetAiPresets = vi.mocked(api.getAiPresets);
const mockGetAiConfig = vi.mocked(api.getAiConfig);
const mockSaveAiConfig = vi.mocked(api.saveAiConfig);
const mockTestAiConnection = vi.mocked(api.testAiConnection);
const mockDeleteAiConfig = vi.mocked(api.deleteAiConfig);

const testPresets: AiPreset[] = [
  {
    id: "openai",
    name: "OpenAI",
    base_url: "https://api.openai.com/v1",
    provider_type: "openai",
    default_model: "gpt-4o",
    models: ["gpt-4o", "gpt-4o-mini"],
  },
  {
    id: "anthropic",
    name: "Anthropic",
    base_url: "https://api.anthropic.com",
    provider_type: "anthropic",
    default_model: "claude-sonnet-4-20250514",
    models: ["claude-sonnet-4-20250514", "claude-3-5-haiku-20241022"],
  },
];

const noConfig: AiConfig = {
  base_url: "",
  model: "",
  provider_type: "",
  has_key: false,
  source: "none",
};

const existingConfig: AiConfig = {
  base_url: "https://api.openai.com/v1",
  model: "gpt-4o",
  provider_type: "openai",
  has_key: true,
  source: "db",
};

describe("SettingsModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders modal with title", () => {
    mockGetAiPresets.mockReturnValue(new Promise(() => {}));
    mockGetAiConfig.mockReturnValue(new Promise(() => {}));

    render(<SettingsModal onClose={vi.fn()} />);

    expect(screen.getByText("AI Provider Settings")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    mockGetAiPresets.mockReturnValue(new Promise(() => {}));
    mockGetAiConfig.mockReturnValue(new Promise(() => {}));

    render(<SettingsModal onClose={vi.fn()} />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("shows provider dropdown after loading", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);

    render(<SettingsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
  });

  it("auto-fills fields when preset is selected", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);

    render(<SettingsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), {
        target: { value: "openai" },
      });
    });

    // Model dropdown should be populated with preset models
    const modelSelect = screen.getByLabelText("Model") as HTMLSelectElement;
    expect(modelSelect.value).toBe("gpt-4o");
  });

  it("calls saveAiConfig on save", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockSaveAiConfig.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();

    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), {
        target: { value: "openai" },
      });
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("API Key"), {
        target: { value: "sk-test-key" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(mockSaveAiConfig).toHaveBeenCalledWith({
      base_url: "https://api.openai.com/v1",
      api_key: "sk-test-key",
      model: "gpt-4o",
      provider_type: "openai",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("calls testAiConnection on test", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockTestAiConnection.mockResolvedValue({ status: "ok" });

    render(<SettingsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test" }));
    });

    expect(mockTestAiConnection).toHaveBeenCalled();
    expect(screen.getByText("Connection successful")).toBeInTheDocument();
  });

  it("calls deleteAiConfig on delete", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(existingConfig);
    mockDeleteAiConfig.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();

    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(mockDeleteAiConfig).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when backdrop is clicked", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    const onClose = vi.fn();

    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    // Click the backdrop (the outer div)
    fireEvent.click(screen.getByRole("dialog").parentElement!);
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when close button is clicked", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    const onClose = vi.fn();

    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText("Close settings"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows error when loading fails", async () => {
    mockGetAiPresets.mockRejectedValue(new Error("Network error"));
    mockGetAiConfig.mockRejectedValue(new Error("Network error"));

    render(<SettingsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load settings")).toBeInTheDocument();
    });
  });

  it("shows error when save fails", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockSaveAiConfig.mockRejectedValue(new Error("Save failed"));
    const onClose = vi.fn();

    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), {
        target: { value: "openai" },
      });
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(screen.getByText("Failed to save settings")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows connection failed when test fails", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockTestAiConnection.mockRejectedValue(new Error("Connection error"));

    render(<SettingsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Test" }));
    });

    expect(screen.getByText("Connection failed")).toBeInTheDocument();
  });

  it("shows error when delete fails", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockDeleteAiConfig.mockRejectedValue(new Error("Delete failed"));
    const onClose = vi.fn();

    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    });

    expect(screen.getByText("Failed to delete settings")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("shows custom fields when custom preset is selected", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);

    render(<SettingsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), {
        target: { value: "custom" },
      });
    });

    expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
    expect(screen.getByLabelText("Provider Type")).toBeInTheDocument();
    // Model should be a text input (no models list for custom)
    const modelInput = screen.getByLabelText("Model") as HTMLInputElement;
    expect(modelInput.type).toBe("text");
  });

  it("allows editing base URL and model for custom preset", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockSaveAiConfig.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();

    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), {
        target: { value: "custom" },
      });
    });

    // Fill in Base URL
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://custom.api.com/v1" },
    });

    // Fill in Model (text input for custom)
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "custom-model" },
    });

    // Change Provider Type
    fireEvent.change(screen.getByLabelText("Provider Type"), {
      target: { value: "anthropic" },
    });

    // Fill in API Key
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "custom-key" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(mockSaveAiConfig).toHaveBeenCalledWith({
      base_url: "https://custom.api.com/v1",
      api_key: "custom-key",
      model: "custom-model",
      provider_type: "anthropic",
    });
  });

  it("allows changing model in preset dropdown", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(noConfig);
    mockSaveAiConfig.mockResolvedValue({ status: "ok" });
    const onClose = vi.fn();

    render(<SettingsModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Provider"), {
        target: { value: "openai" },
      });
    });

    // Change model in the dropdown
    fireEvent.change(screen.getByLabelText("Model"), {
      target: { value: "gpt-4o-mini" },
    });

    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "sk-key" },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }));
    });

    expect(mockSaveAiConfig).toHaveBeenCalledWith({
      base_url: "https://api.openai.com/v1",
      api_key: "sk-key",
      model: "gpt-4o-mini",
      provider_type: "openai",
    });
  });

  it("auto-fills fields from existing config matching a preset", async () => {
    mockGetAiPresets.mockResolvedValue(testPresets);
    mockGetAiConfig.mockResolvedValue(existingConfig);

    render(<SettingsModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByLabelText("Provider")).toBeInTheDocument();
    });

    // Should have matched the openai preset
    const providerSelect = screen.getByLabelText("Provider") as HTMLSelectElement;
    expect(providerSelect.value).toBe("openai");

    // Model should be populated
    const modelSelect = screen.getByLabelText("Model") as HTMLSelectElement;
    expect(modelSelect.value).toBe("gpt-4o");
  });
});
