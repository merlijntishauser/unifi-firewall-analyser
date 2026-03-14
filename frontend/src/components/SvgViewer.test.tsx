import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SvgViewer from "./SvgViewer";

const STUB_SVG = '<svg data-testid="test-svg"><rect width="100" height="50"/></svg>';

describe("SvgViewer", () => {
  it("renders SVG content", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    expect(screen.getByTestId("svg-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("test-svg")).toBeInTheDocument();
  });

  it("shows zoom controls", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom out")).toBeInTheDocument();
    expect(screen.getByLabelText("Reset zoom")).toBeInTheDocument();
  });

  it("displays 100% zoom by default", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    expect(screen.getByLabelText("Reset zoom")).toHaveTextContent("100%");
  });

  it("zooms in when zoom in button is clicked", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    fireEvent.click(screen.getByLabelText("Zoom in"));
    const zoomLabel = screen.getByLabelText("Reset zoom");
    expect(parseInt(zoomLabel.textContent ?? "0")).toBeGreaterThan(100);
  });

  it("zooms out when zoom out button is clicked", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    fireEvent.click(screen.getByLabelText("Zoom out"));
    const zoomLabel = screen.getByLabelText("Reset zoom");
    expect(parseInt(zoomLabel.textContent ?? "0")).toBeLessThan(100);
  });

  it("resets zoom when reset button is clicked", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    fireEvent.click(screen.getByLabelText("Zoom in"));
    fireEvent.click(screen.getByLabelText("Reset zoom"));
    expect(screen.getByLabelText("Reset zoom")).toHaveTextContent("100%");
  });

  it("changes cursor on pointer down/up", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    const viewer = screen.getByTestId("svg-viewer");
    expect(viewer.className).toContain("cursor-grab");
    fireEvent.pointerDown(viewer, { clientX: 50, clientY: 50 });
    expect(viewer.className).toContain("cursor-grabbing");
    fireEvent.pointerUp(viewer);
    expect(viewer.className).toContain("cursor-grab");
  });

  it("pans on pointer drag", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    const viewer = screen.getByTestId("svg-viewer");
    fireEvent.pointerDown(viewer, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(viewer, { clientX: 150, clientY: 120 });
    fireEvent.pointerUp(viewer);
    // After drag, container should still be in grab mode
    expect(viewer.className).toContain("cursor-grab");
  });

  it("zooms on wheel event", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    const viewer = screen.getByTestId("svg-viewer");
    // Mock getBoundingClientRect for the wheel handler
    vi.spyOn(viewer, "getBoundingClientRect").mockReturnValue({
      left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600, x: 0, y: 0, toJSON: () => {},
    });
    fireEvent.wheel(viewer, { deltaY: -100, clientX: 400, clientY: 300 });
    const zoomLabel = screen.getByLabelText("Reset zoom");
    expect(parseInt(zoomLabel.textContent ?? "0")).toBeGreaterThan(100);
  });

  it("does not pan when not dragging", () => {
    render(<SvgViewer svgContent={STUB_SVG} />);
    const viewer = screen.getByTestId("svg-viewer");
    // Move without pressing down
    fireEvent.pointerMove(viewer, { clientX: 150, clientY: 120 });
    expect(viewer.className).toContain("cursor-grab");
  });
});
