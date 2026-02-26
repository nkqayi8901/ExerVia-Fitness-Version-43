import { act, render, screen } from "@testing-library/react";
import ToastHost from "./ToastHost";

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.runOnlyPendingTimers();
  jest.useRealTimers();
});

const pushToast = (message, type = "info", duration = 3200) => {
  window.dispatchEvent(
    new CustomEvent("exervia:toast", {
      detail: { message, type, duration },
    })
  );
};

test("renders nothing when there are no toasts", () => {
  const { container } = render(<ToastHost />);
  expect(container.firstChild).toBeNull();
});

test("renders a toast when event is dispatched", () => {
  render(<ToastHost />);
  act(() => {
    pushToast("Saved successfully", "success", 3000);
  });
  expect(screen.getByText("Saved successfully")).toBeInTheDocument();
});

test("auto dismisses toast after duration", () => {
  render(<ToastHost />);
  act(() => {
    pushToast("Temporary", "info", 1200);
  });
  expect(screen.getByText("Temporary")).toBeInTheDocument();
  act(() => {
    jest.advanceTimersByTime(1300);
  });
  expect(screen.queryByText("Temporary")).not.toBeInTheDocument();
});

test("keeps only the latest four toasts", () => {
  render(<ToastHost />);
  act(() => {
    pushToast("One");
    pushToast("Two");
    pushToast("Three");
    pushToast("Four");
    pushToast("Five");
  });
  expect(screen.queryByText("One")).not.toBeInTheDocument();
  expect(screen.getByText("Two")).toBeInTheDocument();
  expect(screen.getByText("Three")).toBeInTheDocument();
  expect(screen.getByText("Four")).toBeInTheDocument();
  expect(screen.getByText("Five")).toBeInTheDocument();
});
