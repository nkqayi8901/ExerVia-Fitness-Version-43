// useLiveChallenge.js
// Manages the full challenge lifecycle:
//   send → pending → accepted/rejected/cancelled → in_progress → completed
//
// Usage:
//   const challenge = useLiveChallenge({ userId, displayName, userXp })
//
//   challenge.sendChallenge(runner, distanceKm, distanceLabel, xpWager)
//   challenge.respondToChallenge(id, 'accepted' | 'rejected')
//   challenge.cancelChallenge(id)
//   challenge.submitFinishTime(id, elapsedSeconds)
//   challenge.activeChallenge  — current challenge object or null
//   challenge.incomingChallenge — challenge waiting for this user's response

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";
import { questProgress } from "../utils/questProgress";

export default function useLiveChallenge({ userId, displayName, userXp }) {
  const [activeChallenge, setActiveChallenge] = useState(null);
  const [incomingChallenge, setIncomingChallenge] = useState(null);
  const [challengeError, setChallengeError] = useState("");
  const channelRef = useRef(null);

  // -------------------------------------------------------------------------
  // Realtime: subscribe to live_challenges where user is challenger/challenged
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!userId) return undefined;

    const handleChange = (payload) => {
      const row = payload.new || payload.old;
      if (!row) return;

      const isChallenger = Number(row.challenger_id) === Number(userId);
      const isChallenged = Number(row.challenged_id) === Number(userId);
      if (!isChallenger && !isChallenged) return;

      if (payload.eventType === "DELETE" || row.status === "cancelled" || row.status === "rejected") {
        setActiveChallenge((prev) => (prev?.id === row.id ? null : prev));
        setIncomingChallenge((prev) => (prev?.id === row.id ? null : prev));
        return;
      }

      if (row.status === "pending" && isChallenged) {
        setIncomingChallenge(row);
        return;
      }

      if (row.status === "accepted" || row.status === "in_progress" || row.status === "completed") {
        setIncomingChallenge(null);
        setActiveChallenge(row);
        return;
      }
    };

    const channel = supabase
      .channel(`live-challenge-user-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_challenges",
          filter: `challenger_id=eq.${userId}`,
        },
        handleChange
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "live_challenges",
          filter: `challenged_id=eq.${userId}`,
        },
        handleChange
      )
      .subscribe();

    channelRef.current = channel;

    // Also fetch any pending/active challenge on mount
    const fetchExisting = async () => {
      try {
        const { data } = await supabase
          .from("live_challenges")
          .select("*")
          .or(`challenger_id.eq.${userId},challenged_id.eq.${userId}`)
          .in("status", ["pending", "accepted", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!data) return;
        if (data.status === "pending" && Number(data.challenged_id) === Number(userId)) {
          setIncomingChallenge(data);
        } else {
          setActiveChallenge(data);
        }
      } catch {
        // keep empty state
      }
    };
    fetchExisting();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId]);

  // -------------------------------------------------------------------------
  // Send a challenge to a nearby runner
  // -------------------------------------------------------------------------
  const sendChallenge = useCallback(
    async (targetRunner, distanceKm, distanceLabel, xpWager) => {
      if (!userId || !targetRunner) return;
      setChallengeError("");
      const safeWager = Math.min(500, Math.max(10, Number(xpWager) || 50));
      if (userXp < safeWager) {
        setChallengeError("Not enough XP to cover this wager.");
        return;
      }
      try {
        const { data, error } = await supabase
          .from("live_challenges")
          .insert([
            {
              challenger_id: Number(userId),
              challenger_name: String(displayName || "You"),
              challenged_id: Number(targetRunner.user_id),
              challenged_name: String(targetRunner.display_name || "Runner"),
              distance_km: Number(distanceKm) || 5,
              distance_label: String(distanceLabel || "5K"),
              xp_wager: safeWager,
              status: "pending",
              expires_at: new Date(Date.now() + 60_000).toISOString(),
            },
          ])
          .select("*")
          .single();
        if (error) throw error;
        setActiveChallenge(data);
      } catch (err) {
        setChallengeError(err?.message || "Challenge failed. Try again.");
      }
    },
    [userId, displayName, userXp]
  );

  // -------------------------------------------------------------------------
  // Accept or reject an incoming challenge
  // -------------------------------------------------------------------------
  const respondToChallenge = useCallback(async (challengeId, response) => {
    if (!challengeId) return;
    setChallengeError("");
    try {
      const { data, error } = await supabase
        .from("live_challenges")
        .update({ status: response })
        .eq("id", challengeId)
        .select("*")
        .single();
      if (error) throw error;
      setIncomingChallenge(null);
      if (response === "accepted") setActiveChallenge(data);
    } catch (err) {
      setChallengeError(err?.message || "Could not respond to challenge.");
    }
  }, []);

  // -------------------------------------------------------------------------
  // Cancel a pending challenge (challenger side)
  // -------------------------------------------------------------------------
  const cancelChallenge = useCallback(async (challengeId) => {
    if (!challengeId) return;
    try {
      await supabase
        .from("live_challenges")
        .update({ status: "cancelled" })
        .eq("id", challengeId)
        .eq("challenger_id", Number(userId));
      setActiveChallenge(null);
      setIncomingChallenge(null);
    } catch {
      // best-effort
    }
  }, [userId]);

  // -------------------------------------------------------------------------
  // Submit finish time — triggers winner determination + XP settlement
  // -------------------------------------------------------------------------
  const submitFinishTime = useCallback(
    async (challengeId, elapsedSeconds) => {
      if (!challengeId || !userId) return;
      setChallengeError("");
      try {
        const isChallenger = activeChallenge?.challenger_id === Number(userId);
        const update = isChallenger
          ? { challenger_time_seconds: elapsedSeconds }
          : { challenged_time_seconds: elapsedSeconds };

        const { data, error } = await supabase
          .from("live_challenges")
          .update(update)
          .eq("id", challengeId)
          .select("*")
          .single();
        if (error) throw error;

        // If both times are in, determine winner and mark completed
        const challengerTime = isChallenger
          ? elapsedSeconds
          : data.challenger_time_seconds;
        const challengedTime = isChallenger
          ? data.challenged_time_seconds
          : elapsedSeconds;

        if (challengerTime && challengedTime) {
          const winnerId =
            challengerTime <= challengedTime
              ? data.challenger_id
              : data.challenged_id;

          const { data: settled } = await supabase
            .from("live_challenges")
            .update({ status: "completed", winner_id: winnerId })
            .eq("id", challengeId)
            .select("*")
            .single();

          if (settled) {
            setActiveChallenge(settled);
            // Trigger server-side XP settlement
            await supabase.rpc("settle_live_challenge", { p_challenge_id: challengeId });
            // Quest progress: all participants get challenge credit; winner gets win credit
            questProgress.challenge(1);
            if (winnerId === userId) questProgress.challengeWin(1);
            // Achievement check (fire-and-forget)
            supabase.rpc("check_and_award_achievements").then(() => {
              window.dispatchEvent(new CustomEvent("achievements_updated"));
            });
          }
        } else {
          setActiveChallenge(data);
        }
      } catch (err) {
        setChallengeError(err?.message || "Could not submit finish time.");
      }
    },
    [userId, activeChallenge]
  );

  return {
    activeChallenge,
    incomingChallenge,
    challengeError,
    sendChallenge,
    respondToChallenge,
    cancelChallenge,
    submitFinishTime,
  };
}
