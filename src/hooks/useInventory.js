import { useEffect, useState, useCallback } from "react";
import { supabase } from "../supabaseClient";

/**
 * useInventory(userId)
 * Loads the athlete's owned shop items and resolves:
 *   - activeFlair  : the highest-rarity cosmetic flair they own (icon string)
 *   - activeTitle  : their equipped title (name string)
 *   - activeBoosts : list of timed boosts currently running
 *   - hasBoost(name) : helper — true if a named boost is active
 *   - xpMultiplier : combined XP multiplier from active boosts (min 1)
 */

const RARITY_RANK = { legendary: 4, epic: 3, rare: 2, common: 1 };

export function useInventory(userId) {
  const [activeFlair, setActiveFlair] = useState(null);
  const [activeTitle, setActiveTitle] = useState(null);
  const [activeBoosts, setActiveBoosts] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      // owned non-expired items joined with shop_items
      const { data } = await supabase
        .from("user_inventory")
        .select("item_id, expires_at, shop_items(name, icon, category, rarity, duration_hours)")
        .eq("user_id", Number(userId))
        .eq("is_active", true);

      if (!data) return;

      const now = new Date();
      const valid = data.filter((row) => {
        if (!row.shop_items) return false;
        if (!row.expires_at) return true;
        return new Date(row.expires_at) > now;
      });

      // Flairs: pick highest rarity cosmetic
      const flairs = valid
        .filter((r) => r.shop_items.category === "cosmetic")
        .sort((a, b) => (RARITY_RANK[b.shop_items.rarity] || 0) - (RARITY_RANK[a.shop_items.rarity] || 0));
      setActiveFlair(flairs[0]?.shop_items?.icon || null);

      // Title: pick highest rarity title
      const titles = valid
        .filter((r) => r.shop_items.category === "title")
        .sort((a, b) => (RARITY_RANK[b.shop_items.rarity] || 0) - (RARITY_RANK[a.shop_items.rarity] || 0));
      setActiveTitle(titles[0]?.shop_items?.name || null);

      // Active timed boosts
      const boosts = valid
        .filter((r) => r.shop_items.category === "boost" && r.expires_at)
        .map((r) => ({
          name: r.shop_items.name,
          icon: r.shop_items.icon,
          expires_at: r.expires_at,
        }));
      setActiveBoosts(boosts);
    } catch {
      // fail silently — cosmetics are non-critical
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    // refresh when a purchase happens elsewhere on the page
    const handler = () => load();
    window.addEventListener("user_state_updated", handler);
    return () => window.removeEventListener("user_state_updated", handler);
  }, [load]);

  const hasBoost = useCallback(
    (boostName) => activeBoosts.some((b) => b.name.toLowerCase().includes(boostName.toLowerCase())),
    [activeBoosts]
  );

  // Compute XP multiplier from active boosts
  const xpMultiplier = (() => {
    let mult = 1;
    for (const b of activeBoosts) {
      const n = b.name.toLowerCase();
      if (n.includes("triple xp")) mult = Math.max(mult, 3);
      else if (n.includes("double xp") || n.includes("2×")) mult = Math.max(mult, 2);
      else if (n.includes("streak multiplier") || n.includes("1.5×")) mult = Math.max(mult, 1.5);
    }
    return mult;
  })();

  return { activeFlair, activeTitle, activeBoosts, hasBoost, xpMultiplier, loading, reload: load };
}
