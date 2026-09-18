import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom does not implement <dialog>; the workspace opens every form in one.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
}

// jsdom's Blob has no text(), which the ground truth import uses.
if (!Blob.prototype.text) {
  Blob.prototype.text = function text(this: Blob) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error as Error);
      reader.readAsText(this);
    });
  };
}

// jsdom has no object URLs, which the export downloads rely on.
if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:document";
  URL.revokeObjectURL = () => undefined;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
