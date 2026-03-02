import {
  clearAuthStorage,
  getStoredProfileId,
  setAuthStorage,
  setStoredProfileId,
} from "./authStorage";

describe("authStorage utils", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("setAuthStorage writes canonical auth/profile keys", () => {
    setAuthStorage(
      {
        id: 42,
        username: "tester",
        display_name: "Test User",
      },
      { id: "auth-42" }
    );

    expect(localStorage.getItem("exervia_user_id")).toBe("42");
    expect(localStorage.getItem("exervia_username")).toBe("tester");
    expect(localStorage.getItem("exervia_display_name")).toBe("Test User");
    expect(localStorage.getItem("exervia_auth_uid")).toBe("auth-42");
    expect(getStoredProfileId()).toBe("42");
  });

  test("clearAuthStorage removes all canonical auth/profile keys", () => {
    localStorage.setItem("exervia_user_id", "7");
    localStorage.setItem("exervia_username", "name");
    localStorage.setItem("exervia_display_name", "Display");
    localStorage.setItem("exervia_auth_uid", "uid");

    clearAuthStorage();

    expect(localStorage.getItem("exervia_user_id")).toBeNull();
    expect(localStorage.getItem("exervia_username")).toBeNull();
    expect(localStorage.getItem("exervia_display_name")).toBeNull();
    expect(localStorage.getItem("exervia_auth_uid")).toBeNull();
  });

  test("setStoredProfileId clears key when blank", () => {
    setStoredProfileId("9");
    expect(getStoredProfileId()).toBe("9");
    setStoredProfileId("");
    expect(getStoredProfileId()).toBe("");
  });
});
