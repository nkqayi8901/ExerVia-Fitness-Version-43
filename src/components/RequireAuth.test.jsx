import { render, screen, waitFor } from "@testing-library/react";

const mockPathname = { value: "/gym/123" };

jest.mock(
  "react-router-dom",
  () => ({
    Navigate: ({ to }) => <div>Navigate:{to}</div>,
    useLocation: () => ({ pathname: mockPathname.value }),
  }),
  { virtual: true }
);

import RequireAuth from "./RequireAuth";

const mockGetSession = jest.fn();
const mockOnAuthStateChange = jest.fn();
const mockMaybeSingle = jest.fn();
const mockEqAuthUser = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

jest.mock("../supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: (...args) => mockGetSession(...args),
      onAuthStateChange: (...args) => mockOnAuthStateChange(...args),
    },
    from: (...args) => mockFrom(...args),
  },
}));

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: jest.fn() } },
  });
  mockMaybeSingle.mockResolvedValue({ data: null });
  mockEqAuthUser.mockReturnValue({ maybeSingle: mockMaybeSingle });
  mockSelect.mockReturnValue({ eq: mockEqAuthUser });
  mockFrom.mockReturnValue({ select: mockSelect });
});

function renderRequireAuthAt(pathname = "/gym/123") {
  mockPathname.value = pathname;
  return render(
    <RequireAuth>
      <div>Protected Area</div>
    </RequireAuth>
  );
}

test("shows loading state briefly during session check", async () => {
  mockGetSession.mockImplementation(
    () =>
      new Promise((resolve) => {
        setTimeout(() => resolve({ data: { session: null } }), 25);
      })
  );

  renderRequireAuthAt("/gym/123");
  expect(screen.getByText("Checking account session...")).toBeInTheDocument();
});

test("redirects unauthenticated users to auth route", async () => {
  mockGetSession.mockResolvedValue({ data: { session: null } });

  renderRequireAuthAt("/gym/123");

  await waitFor(() => {
    expect(screen.getByText("Navigate:/auth")).toBeInTheDocument();
  });
});

test("renders protected content for authenticated users", async () => {
  localStorage.setItem("exervia_user_id", "123");
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "auth-user-1" } } },
  });

  renderRequireAuthAt("/gym/123");

  await waitFor(() => {
    expect(screen.getByText("Protected Area")).toBeInTheDocument();
  });
});

test("redirects to resolved profile path when URL id mismatches stored profile", async () => {
  localStorage.setItem("exervia_user_id", "999");
  mockGetSession.mockResolvedValue({
    data: { session: { user: { id: "auth-user-2" } } },
  });

  renderRequireAuthAt("/gym/123/nutrition");

  await waitFor(() => {
    expect(screen.getByText(/Navigate:\/gym\/999\/nutrition/)).toBeInTheDocument();
  });
});
