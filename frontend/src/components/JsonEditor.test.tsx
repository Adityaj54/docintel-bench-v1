import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JsonEditor, parseJson } from "./JsonEditor";

describe("parseJson", () => {
  it("returns the parsed value for valid JSON", () => {
    expect(parseJson('{"a": 1}')).toEqual({ value: { a: 1 }, error: null });
  });

  it("reports a message instead of throwing on invalid JSON", () => {
    const result = parseJson("{");
    expect(result.value).toBeNull();
    expect(result.error).toBeTruthy();
  });
});

describe("JsonEditor", () => {
  it("marks the field invalid while the JSON is broken", () => {
    render(<JsonEditor value="{" label="Definition" onChange={() => undefined} />);
    expect(screen.getByLabelText("Definition")).toHaveAttribute("aria-invalid", "true");
  });

  it("does not mark valid JSON as invalid", () => {
    render(<JsonEditor value='{"a": 1}' label="Definition" onChange={() => undefined} />);
    expect(screen.getByLabelText("Definition")).toHaveAttribute("aria-invalid", "false");
  });

  it("cannot format unparseable text", () => {
    render(<JsonEditor value="{" label="Definition" onChange={() => undefined} />);
    expect(screen.getByRole("button", { name: "Format JSON" })).toBeDisabled();
  });

  it("reports every edit to its owner", async () => {
    const onChange = vi.fn();
    render(<JsonEditor value="" label="Definition" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText("Definition"), "{{");
    expect(onChange).toHaveBeenCalled();
  });

  it("reformats valid JSON on request", async () => {
    const onChange = vi.fn();
    render(<JsonEditor value='{"a":1}' label="Definition" onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Format JSON" }));
    expect(onChange).toHaveBeenCalledWith('{\n  "a": 1\n}');
  });
});
