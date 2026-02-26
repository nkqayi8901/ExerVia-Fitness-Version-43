import { fireEvent, render, screen } from "@testing-library/react";
import CommunityModal from "./CommunityModal";

test("renders dialog and focuses first focusable element", () => {
  render(
    <CommunityModal open onClose={jest.fn()}>
      <button type="button">First</button>
      <button type="button">Second</button>
    </CommunityModal>
  );

  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "First" })).toHaveFocus();
});

test("traps tab focus inside modal", () => {
  render(
    <CommunityModal open onClose={jest.fn()}>
      <button type="button">First</button>
      <button type="button">Second</button>
    </CommunityModal>
  );

  const first = screen.getByRole("button", { name: "First" });
  const second = screen.getByRole("button", { name: "Second" });

  second.focus();
  fireEvent.keyDown(document, { key: "Tab" });
  expect(first).toHaveFocus();

  first.focus();
  fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
  expect(second).toHaveFocus();
});

test("escape closes only topmost modal when stacked", () => {
  const bottomClose = jest.fn();
  const topClose = jest.fn();

  render(
    <>
      <CommunityModal open onClose={bottomClose}>
        <button type="button">Bottom</button>
      </CommunityModal>
      <CommunityModal open onClose={topClose}>
        <button type="button">Top</button>
      </CommunityModal>
    </>
  );

  fireEvent.keyDown(document, { key: "Escape" });
  expect(topClose).toHaveBeenCalledTimes(1);
  expect(bottomClose).not.toHaveBeenCalled();
});

