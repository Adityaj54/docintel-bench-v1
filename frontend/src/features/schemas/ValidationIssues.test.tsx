import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ValidationIssues } from "./ValidationIssues";
import { aValidationReport } from "../../test/factories";

describe("ValidationIssues", () => {
  it("confirms a value that satisfies the schema", () => {
    render(<ValidationIssues report={{ valid: true, errors: [] }} />);
    expect(screen.getByText("JSON satisfies the selected schema.")).toBeInTheDocument();
  });

  it("explains every violation with its path and expectation", () => {
    render(<ValidationIssues report={aValidationReport()} />);
    expect(screen.getByText("1 validation issue(s)")).toBeInTheDocument();
    expect(screen.getByText("$.total")).toBeInTheDocument();
    expect(screen.getByText("type")).toBeInTheDocument();
    expect(screen.getByText("'12,40' is not of type 'number'")).toBeInTheDocument();
    expect(screen.getByText(/Received \(string\)/)).toBeInTheDocument();
  });

  it("falls back to counting the errors it was given", () => {
    const report = aValidationReport();
    render(<ValidationIssues report={{ valid: false, errors: report.errors }} />);
    expect(screen.getByText("1 validation issue(s)")).toBeInTheDocument();
  });

  it("labels a root-level violation", () => {
    render(<ValidationIssues report={{
      valid: false,
      errors: [{ path: "", validator: "type", expected: "object", received: [], received_type: "array", message: "not an object" }],
    }} />);
    expect(screen.getByText("$")).toBeInTheDocument();
  });
});
