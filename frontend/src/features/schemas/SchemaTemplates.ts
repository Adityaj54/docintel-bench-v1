import type { Json } from "../../types/domain";

export const templates: Record<string, Record<string, Json>> = {
  "Blank object": {
    type: "object",
    properties: {},
    required: [],
    additionalProperties: false,
  },
  Invoice: {
    type: "object",
    properties: {
      invoice_number: { type: "string" },
      vendor: { type: "string" },
      invoice_date: { type: "string", format: "date" },
      total: { type: "number", minimum: 0 },
      currency: { type: "string", enum: ["USD", "EUR", "GBP"] },
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            quantity: { type: "integer", minimum: 1 },
            unit_price: { type: "number", minimum: 0 },
          },
          required: ["description", "quantity", "unit_price"],
          additionalProperties: false,
        },
      },
    },
    required: ["invoice_number", "vendor", "total", "currency", "items"],
    additionalProperties: false,
  },
  Receipt: {
    type: "object",
    properties: {
      merchant: { type: "string" },
      purchased_at: { type: "string", format: "date" },
      subtotal: { type: "number", minimum: 0 },
      tax: { type: "number", minimum: 0 },
      total: { type: "number", minimum: 0 },
      payment_method: { type: "string", enum: ["cash", "card", "other"] },
    },
    required: ["merchant", "total"],
    additionalProperties: false,
  },
  "Contact record": {
    type: "object",
    properties: {
      name: { type: "string" },
      organization: { type: ["string", "null"] },
      email: { type: "string", format: "email" },
      phone: { type: ["string", "null"] },
      address: {
        type: "object",
        properties: {
          street: { type: "string" },
          city: { type: "string" },
          postal_code: { type: "string" },
          country: { type: "string" },
        },
        required: ["city", "country"],
        additionalProperties: false,
      },
    },
    required: ["name", "email"],
    additionalProperties: false,
  },
};
