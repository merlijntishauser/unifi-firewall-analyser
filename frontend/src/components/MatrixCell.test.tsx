import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MatrixCell from "./MatrixCell";

describe("MatrixCell", () => {
  it("renders green when grade is A", () => {
    render(<MatrixCell totalRules={3} grade="A" onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-green-100");
  });

  it("renders green when grade is B", () => {
    render(<MatrixCell totalRules={3} grade="B" onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-green-100");
  });

  it("renders amber when grade is C", () => {
    render(<MatrixCell totalRules={2} grade="C" onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-amber-100");
  });

  it("renders red when grade is D", () => {
    render(<MatrixCell totalRules={1} grade="D" onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-red-100");
  });

  it("renders red when grade is F", () => {
    render(<MatrixCell totalRules={2} grade="F" onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-red-100");
  });

  it("renders gray when no rules exist", () => {
    render(<MatrixCell totalRules={0} grade={null} onClick={vi.fn()} />);
    expect(screen.getByRole("button")).toHaveClass("bg-gray-50");
  });

  it("shows rule count and grade", () => {
    render(<MatrixCell totalRules={3} grade="B" onClick={vi.fn()} />);
    expect(screen.getByText("3 B")).toBeInTheDocument();
  });

  it("shows dash when no rules", () => {
    render(<MatrixCell totalRules={0} grade={null} onClick={vi.fn()} />);
    expect(screen.getByText("\u2014")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<MatrixCell totalRules={1} grade="A" onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("applies dimmed style when isSelfPair is true", () => {
    render(<MatrixCell totalRules={0} grade={null} onClick={vi.fn()} isSelfPair />);
    expect(screen.getByRole("button")).toHaveClass("opacity-40");
  });

  it("does not apply dimmed style when isSelfPair is false", () => {
    render(<MatrixCell totalRules={1} grade="A" onClick={vi.fn()} />);
    expect(screen.getByRole("button")).not.toHaveClass("opacity-40");
  });
});
