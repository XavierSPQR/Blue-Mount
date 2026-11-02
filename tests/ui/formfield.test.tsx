import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FormField } from "@/components/FormField";

function idOf(html: string, tag: string) {
  return html.match(new RegExp(`<${tag}[^>]*\\sid="([^"]+)"`))?.[1];
}
function forOf(html: string) {
  return html.match(/<label[^>]*\sfor="([^"]+)"/)?.[1];
}

describe("FormField", () => {
  it("associates the label with a plain input", () => {
    const html = renderToStaticMarkup(
      <FormField label="Quantity (kg)">
        <input type="number" />
      </FormField>,
    );
    expect(forOf(html)).toBeDefined();
    expect(forOf(html)).toBe(idOf(html, "input"));
  });

  it("associates the label with a select carrying spread props", () => {
    const spread = { name: "supplierId", onChange: () => {}, onBlur: () => {} };
    const html = renderToStaticMarkup(
      <FormField label="Supplier">
        <select {...spread}>
          <option value="">Select a supplier</option>
        </select>
      </FormField>,
    );
    expect(forOf(html)).toBe(idOf(html, "select"));
    expect(html).toContain('name="supplierId"');
  });

  it("marks the control invalid and points it at the error text", () => {
    const html = renderToStaticMarkup(
      <FormField label="Quantity (kg)" error="Must be greater than 0">
        <input type="number" />
      </FormField>,
    );
    const describedBy = html.match(/aria-describedby="([^"]+)"/)?.[1];
    expect(html).toContain('aria-invalid="true"');
    expect(describedBy).toBeDefined();
    expect(html).toContain(`id="${describedBy}"`);
    expect(html).toContain("Must be greater than 0");
  });

  it("adds no aria-invalid when there is no error", () => {
    const html = renderToStaticMarkup(
      <FormField label="Notes">
        <input />
      </FormField>,
    );
    expect(html).not.toContain("aria-invalid");
  });
});
