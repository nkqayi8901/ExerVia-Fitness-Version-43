// useRivals.js
// Fetches head-to-head rivalry data from challenge_rivalries view.
// Also subscribes to active_runners to show "online now" indicators.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabaseClient";

export default function useRivals({ userId }) {
  const [rivals, setRivals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [onlineRivalIds, setOnlineRivalIds] = useState(new Set());
  const channelRef = useRef(null);

  const fetchRivals = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("challenge_rivalries")
        .select("user_id,opponent_id,opponent_name,total_battles,wins,losses,draws,last_battle_at,is_rival")
        .eq("user_id", Number(userId))
        .order("total_battles", { ascending: false })
        .limit(20);
      if (!error && Array.isArray(data)) setRivals(data);
    } catch {
      // keep empty
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRivals();
  }, [fetchRivals]);

  // Subscribe to active_runners to detect which rivals are online right now
  useEffect(() => {
    if (!userId || rivals.length === 0) return undefined;

    const rivalIdSet = new Set(rivals.map((r) => Number(r.opponent_id)));

    const checkOnline = async () => {
      try {
        const { data } = await supabase
          .from("active_runners")
          .select("user_id")
          .eq("is_available", true)
          .in("user_id", [...rivalIdSet]);
        if (Array.isArray(data)) {
          setOnlineRivalIds(new Set(data.map((r) => Number(r.user_id))));
        }
      } catch {
        // keep existing
      }
    };

    checkOnline();

    const channel = supabase
      .channel("rivals-online-tracker")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_runners" }, () => {
        checkOnline();
      })
      .subscribe();

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [userId, rivals]);

  return { rivals, loading, onlineRivalIds, refetch: fetchRivals };
}
