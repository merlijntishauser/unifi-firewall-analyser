import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import MatrixCell from "./MatrixCell";

const baseProps = {
  actionLabel: "Allow All" as const,
  userRuleCount: 0,
  predefinedRuleCount: 1,
  grade: null,
  onClick: vi.fn(),
  isSelfPair: false,
};

describe("MatrixCell", () => {
  describe("action colors", () => {
    it("renders green for Allow All", () => {
      render(<MatrixCell {...baseProps} actionLabel="Allow All" />);
      expect(screen.getByRole("button")).toHaveClass("bg-green-50");
    });

    it("renders blue for Allow Return", () => {
      render(<MatrixCell {...baseProps} actionLabel="Allow Return" />);
      expect(screen.getByRole("button")).toHaveClass("bg-blue-50");
    });

    it("renders red for Block All", () => {
      render(<MatrixCell {...baseProps} actionLabel="Block All" />);
      expect(screen.getByRole("button")).toHaveClass("bg-red-50");
    });

    it("renders amber for Mixed", () => {
      render(<MatrixCell {...baseProps} actionLabel="Mixed" />);
      expect(screen.getByRole("button")).toHaveClass("bg-amber-50");
    });

    it("renders gray when actionLabel is null", () => {
      render(<MatrixCell {...baseProps} actionLabel={null} userRuleCount={0} predefinedRuleCount={0} />);
      expect(screen.getByRole("button")).toHaveClass("bg-gray-50");
    });
  });

  describe("action label text", () => {
    it("shows action label", () => {
      render(<MatrixCell {...baseProps} actionLabel="Block All" />);
      expect(screen.getByText("Block All")).toBeInTheDocument();
    });

    it("shows dash when no action", () => {
      render(<MatrixCell {...baseProps} actionLabel={null} userRuleCount={0} predefinedRuleCount={0} />);
      expect(screen.getByText("\u2014")).toBeInTheDocument();
    });
  });

  describe("user rule count", () => {
    it("shows user rule count when > 0", () => {
      render(<MatrixCell {...baseProps} userRuleCount={3} />);
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    it("hides user rule count when 0", () => {
      render(<MatrixCell {...baseProps} userRuleCount={0} />);
      expect(screen.queryByText("(0)")).not.toBeInTheDocument();
    });
  });

  describe("grade dot", () => {
    it("shows green dot for grade A", () => {
      render(<MatrixCell {...baseProps} grade="A" />);
      expect(screen.getByTestId("grade-dot")).toHaveClass("bg-green-500");
    });

    it("shows green dot for grade B", () => {
      render(<MatrixCell {...baseProps} grade="B" />);
      expect(screen.getByTestId("grade-dot")).toHaveClass("bg-green-500");
    });

    it("shows amber dot for grade C", () => {
      render(<MatrixCell {...baseProps} grade="C" />);
      expect(screen.getByTestId("grade-dot")).toHaveClass("bg-amber-500");
    });

    it("shows red dot for grade D", () => {
      render(<MatrixCell {...baseProps} grade="D" />);
      expect(screen.getByTestId("grade-dot")).toHaveClass("bg-red-500");
    });

    it("shows red dot for grade F", () => {
      render(<MatrixCell {...baseProps} grade="F" />);
      expect(screen.getByTestId("grade-dot")).toHaveClass("bg-red-500");
    });

    it("shows no dot when grade is null", () => {
      render(<MatrixCell {...baseProps} grade={null} />);
      expect(screen.queryByTestId("grade-dot")).not.toBeInTheDocument();
    });
  });

  describe("tooltip", () => {
    it("shows user and predefined counts", () => {
      render(<MatrixCell {...baseProps} userRuleCount={3} predefinedRuleCount={2} />);
      expect(screen.getByTestId("cell-tooltip")).toHaveTextContent("3 user rules, 2 predefined rules");
    });

    it("shows only user count when no predefined", () => {
      render(<MatrixCell {...baseProps} userRuleCount={1} predefinedRuleCount={0} />);
      expect(screen.getByTestId("cell-tooltip")).toHaveTextContent("1 user rule");
    });

    it("shows only predefined count when no user rules", () => {
      render(<MatrixCell {...baseProps} userRuleCount={0} predefinedRuleCount={1} />);
      expect(screen.getByTestId("cell-tooltip")).toHaveTextContent("1 predefined rule");
    });

    it("shows no tooltip when no rules", () => {
      render(<MatrixCell {...baseProps} actionLabel={null} userRuleCount={0} predefinedRuleCount={0} />);
      expect(screen.queryByTestId("cell-tooltip")).not.toBeInTheDocument();
    });
  });

  describe("self-pair", () => {
    it("renders inert div instead of button", () => {
      render(<MatrixCell {...baseProps} isSelfPair />);
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
      expect(screen.getByTestId("matrix-cell")).toBeInTheDocument();
    });

    it("shows dash", () => {
      render(<MatrixCell {...baseProps} isSelfPair />);
      expect(screen.getByText("\u2014")).toBeInTheDocument();
    });

    it("does not fire onClick", () => {
      const onClick = vi.fn();
      render(<MatrixCell {...baseProps} isSelfPair onClick={onClick} />);
      fireEvent.click(screen.getByTestId("matrix-cell"));
      expect(onClick).not.toHaveBeenCalled();
    });
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<MatrixCell {...baseProps} onClick={onClick} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
