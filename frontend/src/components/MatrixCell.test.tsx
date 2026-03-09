import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MatrixCell from "./MatrixCell";

describe("MatrixCell", () => {
  it("renders green when all rules are ALLOW", () => {
    render(<MatrixCell allowCount={3} blockCount={0} totalRules={3} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-green-100");
  });

  it("renders red when all rules are BLOCK", () => {
    render(<MatrixCell allowCount={0} blockCount={2} totalRules={2} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-red-100");
  });

  it("renders amber when rules are mixed", () => {
    render(<MatrixCell allowCount={1} blockCount={1} totalRules={2} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-amber-100");
  });

  it("renders gray when no rules exist", () => {
    render(<MatrixCell allowCount={0} blockCount={0} totalRules={0} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-gray-50");
  });

  it("shows rule count", () => {
    render(<MatrixCell allowCount={2} blockCount={1} totalRules={3} onClick={vi.fn()} />);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<MatrixCell allowCount={1} blockCount={0} totalRules={1} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies dimmed style when isSelfPair is true", () => {
    render(<MatrixCell allowCount={0} blockCount={0} totalRules={0} onClick={vi.fn()} isSelfPair />);
    expect(screen.getByRole("button")).toHaveClass("opacity-40");
  });

  it("does not apply dimmed style when isSelfPair is false", () => {
    render(<MatrixCell allowCount={1} blockCount={0} totalRules={1} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).not.toHaveClass("opacity-40");
  });
});
