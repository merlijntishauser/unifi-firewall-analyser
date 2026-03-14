import { describe, it, expect, vi, beforeEach } from "vitest";
import { downloadSvg } from "./export";

describe("downloadSvg", () => {
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clickSpy = vi.fn();
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
  });

  it("creates blob with SVG MIME type and triggers download", () => {
    downloadSvg("<svg></svg>", "network.svg");
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    const blob = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0] as Blob;
    expect(blob.type).toBe("image/svg+xml");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:test-url");
  });

  it("uses default filename when not specified", () => {
    downloadSvg("<svg></svg>");
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });
});
