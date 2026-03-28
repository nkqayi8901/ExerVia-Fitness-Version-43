let googleMapsPromise = null;
const GOOGLE_MAPS_TIMEOUT_MS = 15000;

export function loadGoogleMapsApi() {
  const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(new Error("Missing REACT_APP_GOOGLE_MAPS_API_KEY"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    let settled = false;
    const cleanupTimeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      googleMapsPromise = null;
      reject(new Error("Google Maps load timed out"));
    }, GOOGLE_MAPS_TIMEOUT_MS);
    const resolveOnce = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(cleanupTimeout);
      resolve(value);
    };
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(cleanupTimeout);
      googleMapsPromise = null;
      reject(error);
    };
    const existing = document.querySelector('script[data-google-maps-loader="true"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.maps) resolveOnce(window.google.maps);
      });
      existing.addEventListener("error", () => rejectOnce(new Error("Google Maps failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = "true";
    script.onload = () => {
      if (window.google?.maps) {
        resolveOnce(window.google.maps);
      } else {
        rejectOnce(new Error("Google Maps loaded without maps namespace"));
      }
    };
    script.onerror = () => rejectOnce(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
