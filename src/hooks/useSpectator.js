// useSpectator.js
// Subscribes to a live challenge and tracks both runners' real-time positions.
// Increments/decrements spectator_count on the challenge via RPC.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

export default function useSpectator({ challengeId, enabled }) {
  const [challenge, setChallenge] = useState(null);
  const [challengerPosition, setChallengerPosition] = useState(null);
  const [challengedPosition, setChallengedPosition] = useState(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const challengeChannelRef = useRef(null);
  const runnerChannelRef = useRef(null);
  const joinedRef = useRef(false);

  // Fetch the initial challenge state
  const fetchChallenge = useCallback(async () => {
    if (!challengeId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("live_challenges")
        .select("*")
        .eq("id", challengeId)
        .maybeSingle();
      if (data) {
        setChallenge(data);
        setSpectatorCount(Number(data.spectator_count || 0));
      }
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [challengeId]);

  useEffect(() => {
    if (!enabled || !challengeId) return undefined;

    fetchChallenge();

    // Register as spectator
    if (!joinedRef.current) {
      supabase.rpc("join_as_spectator", { p_challenge_id: challengeId }).catch(() => {});
      joinedRef.current = true;
    }

    // Subscribe to challenge state changes (finish times, winner, spectator count)
    const challengeChannel = supabase
      .channel(`spectator-challenge-${challengeId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_challenges", filter: `id=eq.${challengeId}` },
        (payload) => {
          if (payload.new) {
            setChallenge(payload.new);
            setSpectatorCount(Number(payload.new.spectator_count || 0));
          }
        }
      )
      .subscribe();
    challengeChannelRef.current = challengeChannel;

    return () => {
      supabase.removeChannel(challengeChannel);
      challengeChannelRef.current = null;
    };
  }, [enabled, challengeId, fetchChallenge]);

  // Subscribe to active_runners for both competitors' GPS positions
  useEffect(() => {
    if (!enabled || !challenge) return undefined;
    const { challenger_id, challenged_id } = challenge;

    const fetchPositions = async () => {
      try {
        const { data } = await supabase
          .from("active_runners")
          .select("user_id,lat,lng,last_seen")
          .in("user_id", [challenger_id, challenged_id]);
        if (Array.isArray(data)) {
          data.forEach((row) => {
            if (Number(row.user_id) === Number(challenger_id)) {
              setChallengerPosition({ lat: row.lat, lng: row.lng, last_seen: row.last_seen });
            } else {
              setChallengedPosition({ lat: row.lat, lng: row.lng, last_seen: row.last_seen });
            }
          });
        }
      } catch {
        // keep last position
      }
    };

    fetchPositions();

    const runnerChannel = supabase
      .channel(`spectator-runners-${challengeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "active_runners" },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row) return;
          if (Number(row.user_id) === Number(challenger_id)) {
            setChallengerPosition(payload.eventType === "DELETE" ? null : { lat: row.lat, lng: row.lng, last_seen: row.last_seen });
          } else if (Number(row.user_id) === Number(challenged_id)) {
            setChallengedPosition(payload.eventType === "DELETE" ? null : { lat: row.lat, lng: row.lng, last_seen: row.last_seen });
          }
        }
      )
      .subscribe();
    runnerChannelRef.current = runnerChannel;

    return () => {
      supabase.removeChannel(runnerChannel);
      runnerChannelRef.current = null;
    };
  }, [enabled, challenge, challengeId]);

  // Unregister when unmounting or disabled
  useEffect(() => {
    return () => {
      if (joinedRef.current && challengeId) {
        supabase.rpc("leave_as_spectator", { p_challenge_id: challengeId }).catch(() => {});
        joinedRef.current = false;
      }
    };
  }, [challengeId]);

  return {
    challenge,
    challengerPosition,
    challengedPosition,
    spectatorCount,
    loading,
  };
}
