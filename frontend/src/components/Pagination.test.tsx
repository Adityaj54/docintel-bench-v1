import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./Pagination";

describe("Pagination", () => {
  it("stays hidden when there is nothing to page through", () => {
    const { container } = render(<Pagination total={0} offset={0} limit={20} onChange={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("describes the window of items on screen", () => {
    render(<Pagination total={53} offset={20} limit={20} onChange={vi.fn()} />);
    expect(screen.getByText("21–40 of 53")).toBeInTheDocument();
  });

  it("does not claim more items than exist on the last page", () => {
    render(<Pagination total={53} offset={40} limit={20} onChange={vi.fn()} />);
    expect(screen.getByText("41–53 of 53")).toBeInTheDocument();
  });

  it("moves forward by one page", async () => {
    const onChange = vi.fn();
    render(<Pagination total={53} offset={0} limit={20} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(onChange).toHaveBeenCalledWith(20);
  });

  it("moves back without passing a negative offset", async () => {
    const onChange = vi.fn();
    render(<Pagination total={53} offset={10} limit={20} onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: /Previous/ }));
    expect(onChange).toHaveBeenCalledWith(0);
  });

  it("disables the edges of the range", () => {
    const { rerender } = render(<Pagination total={40} offset={0} limit={20} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();

    rerender(<Pagination total={40} offset={20} limit={20} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Next/ })).toBeDisabled();
  });
});
