// useNearbyRunners.js
// Manages a user's live GPS presence in active_runners table and subscribes
// to nearby runners via Supabase Realtime.
//
// Usage:
//   const { nearbyRunners, publishPresence, removePresence } = useNearbyRunners({
//     userId, displayName, visibility, radiusKm, discipline, runMode, isTracking
//   });
//
// - When isTracking becomes true and visibility is 'nearby'/'regional', the hook
//   upserts the user's position into active_runners every HEARTBEAT_MS.
// - Subscribes to the Realtime channel for active_runners changes and returns
//   the list of other nearby runners filtered to the chosen radiusKm.
// - Cleans up (removes the row) when isTracking stops or the component unmounts.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

const HEARTBEAT_MS = 5_000; // publish GPS every 5 seconds
const STALE_THRESHOLD_MS = 3 * 60 * 1000; // drop runners not seen in 3 minutes

function distanceKmBetween(a, b) {
  if (!a || !b) return Infinity;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export default function useNearbyRunners({
  userId,
  displayName,
  visibility,   // "Private" | "Nearby" | "Regional"
  radiusKm,     // number — battle radius in km
  discipline,
  runMode,      // "Solo" | "Ghost" | "Challenge"
  isTracking,   // boolean — true when GPS tracking is active
  currentPosition, // { lat, lng } — updated as the user moves
}) {
  const [nearbyRunners, setNearbyRunners] = useState([]);
  const heartbeatRef = useRef(null);
  const channelRef = useRef(null);
  const isBroadcasting = isTracking && userId && (visibility === "Nearby" || visibility === "Regional");

  // -------------------------------------------------------------------------
  // Publish presence (upsert own row in active_runners)
  // -------------------------------------------------------------------------
  const publishPresence = useCallback(
    async (position) => {
      if (!userId || !position) return;
      try {
        await supabase.from("active_runners").upsert(
          {
            user_id: Number(userId),
            display_name: String(displayName || "Runner"),
            lat: Number(position.lat),
            lng: Number(position.lng),
            visibility: String(visibility || "Nearby").toLowerCase(),
            radius_km: Number(radiusKm) || 5,
            discipline: String(discipline || "Running").toLowerCase(),
            run_mode: String(runMode || "Challenge").toLowerCase(),
            is_available: true,
            last_seen: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      } catch {
        // best-effort — GPS publishing should never throw for the user
      }
    },
    [userId, displayName, visibility, radiusKm, discipline, runMode]
  );

  // -------------------------------------------------------------------------
  // Remove own presence from active_runners
  // -------------------------------------------------------------------------
  const removePresence = useCallback(async () => {
    if (!userId) return;
    try {
      await supabase
        .from("active_runners")
        .delete()
        .eq("user_id", Number(userId));
    } catch {
      // best-effort
    }
  }, [userId]);

  // -------------------------------------------------------------------------
  // Heartbeat: keep upsert alive every HEARTBEAT_MS while tracking
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isBroadcasting || !currentPosition) return undefined;

    // Publish immediately on mount/change
    publishPresence(currentPosition);

    heartbeatRef.current = window.setInterval(() => {
      publishPresence(currentPosition);
    }, HEARTBEAT_MS);

    return () => {
      if (heartbeatRef.current) {
        window.clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }
    };
  }, [isBroadcasting, currentPosition, publishPresence]);

  // Remove presence when tracking stops or component unmounts
  useEffect(() => {
    if (!isBroadcasting) {
      removePresence();
    }
  }, [isBroadcasting, removePresence]);

  useEffect(() => {
    return () => {
      removePresence();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Realtime subscription: listen to active_runners table changes
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return undefined;

    // Initial fetch of nearby runners
    const fetchNearby = async () => {
      try {
        const { data, error } = await supabase
          .from("active_runners")
          .select("id,user_id,display_name,avatar_url,lat,lng,visibility,radius_km,discipline,run_mode,is_available,last_seen")
          .eq("is_available", true)
          .neq("user_id", Number(userId));

        if (error || !Array.isArray(data)) return;
        const now = Date.now();
        setNearbyRunners(
          data.filter(
            (runner) =>
              new Date(runner.last_seen).getTime() > now - STALE_THRESHOLD_MS
          )
        );
      } catch {
        // keep existing state
      }
    };

    fetchNearby();

    // Realtime channel
    const channel = supabase
      .channel("active-runners-broadcast")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "active_runners",
        },
        (payload) => {
          const { eventType, new: newRow, old: oldRow } = payload;
          const now = Date.now();

          if (eventType === "INSERT" || eventType === "UPDATE") {
            if (!newRow || Number(newRow.user_id) === Number(userId)) return;
            if (!newRow.is_available) {
              setNearbyRunners((prev) =>
                prev.filter((r) => r.user_id !== newRow.user_id)
              );
              return;
            }
            if (new Date(newRow.last_seen).getTime() < now - STALE_THRESHOLD_MS) return;
            setNearbyRunners((prev) => {
              const exists = prev.findIndex((r) => r.user_id === newRow.user_id);
              if (exists >= 0) {
                const next = [...prev];
                next[exists] = newRow;
                return next;
              }
              return [...prev, newRow];
            });
          } else if (eventType === "DELETE") {
            if (!oldRow) return;
            setNearbyRunners((prev) =>
              prev.filter((r) => r.user_id !== oldRow.user_id)
            );
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  // Filter by radiusKm and current position
  const filteredRunners = currentPosition
    ? nearbyRunners.filter(
        (runner) =>
          distanceKmBetween(currentPosition, { lat: runner.lat, lng: runner.lng }) <=
          (Number(radiusKm) || 10)
      )
    : nearbyRunners;

  return {
    nearbyRunners: filteredRunners,
    publishPresence,
    removePresence,
  };
}
