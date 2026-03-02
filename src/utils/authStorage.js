const safeGetItem = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const safeSetItem = (key, value) => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const safeRemoveItem = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore storage errors
  }
};

export const getStoredProfileId = () => String(safeGetItem("exervia_user_id") || "").trim();

export const setStoredProfileId = (profileId) => {
  const value = String(profileId || "").trim();
  if (!value) {
    safeRemoveItem("exervia_user_id");
    return;
  }
  safeSetItem("exervia_user_id", value);
};

export const setAuthStorage = (profileRow, authUser) => {
  if (profileRow?.id !== undefined && profileRow?.id !== null) {
    setStoredProfileId(profileRow.id);
  }
  safeSetItem("exervia_username", String(profileRow?.username || ""));
  safeSetItem(
    "exervia_display_name",
    String(profileRow?.display_name || profileRow?.full_name || "")
  );
  if (authUser?.id) {
    safeSetItem("exervia_auth_uid", String(authUser.id));
  }
};

export const clearAuthStorage = () => {
  safeRemoveItem("exervia_user_id");
  safeRemoveItem("exervia_username");
  safeRemoveItem("exervia_display_name");
  safeRemoveItem("exervia_auth_uid");
};
