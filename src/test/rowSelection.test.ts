import { describe, expect, it } from "vitest";

function chooseRows<T>(args: {
  selectionMode: boolean;
  selectedCount: number;
  visibleRows: T[];
  selectedRows: T[];
}) {
  return args.selectionMode && args.selectedCount > 0 ? args.selectedRows : args.visibleRows;
}

describe("selection export rules", () => {
  it("exports selected rows when selectionMode is active and at least one row is selected", () => {
    const visibleRows = [{ id: "a" }, { id: "b" }];
    const selectedRows = [{ id: "b" }];

    expect(
      chooseRows({ selectionMode: true, selectedCount: 1, visibleRows, selectedRows })
    ).toEqual(selectedRows);
  });

  it("exports visible rows when selectionMode is active but no rows are selected", () => {
    const visibleRows = [{ id: "a" }, { id: "b" }];
    const selectedRows: typeof visibleRows = [];

    expect(
      chooseRows({ selectionMode: true, selectedCount: 0, visibleRows, selectedRows })
    ).toEqual(visibleRows);
  });

  it("exports visible rows when selectionMode is inactive", () => {
    const visibleRows = [{ id: "a" }, { id: "b" }];
    const selectedRows = [{ id: "b" }];

    expect(
      chooseRows({ selectionMode: false, selectedCount: 1, visibleRows, selectedRows })
    ).toEqual(visibleRows);
  });
});

