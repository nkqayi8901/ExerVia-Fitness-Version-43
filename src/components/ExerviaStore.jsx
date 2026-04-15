// ExerviaStore.jsx
// In-app store for ExerVia fitness app.
// Props: { viewerId, userXp, onXpChange }
// State: items (hardcoded), activeTab, inventory (supabase), activeBoosts, confirmItem, purchasing

import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import "./ExerviaStore.css";

// ---------------------------------------------------------------------------
// Hardcoded item catalogue
// ---------------------------------------------------------------------------

const STORE_ITEMS = [
  // ---- BOOSTS ----
  {
    id: "boost-2x-24h",
    category: "boost",
    icon: "⚡",
    name: "Double XP Boost",
    description: "2× all XP earned for the next 24 hours. Stack your training and rocket up the leaderboard.",
    costXp: 500,
    costUsd: null,
    durationLabel: "24h",
    durationHours: 24,
    effect: { xp_multiplier: 2 },
    consumable: true,
  },
  {
    id: "boost-3x-1h",
    category: "boost",
    icon: "🔥",
    name: "XP Surge",
    description: "3× XP for the next hour. Perfect for your big push session — earn triple on every rep.",
    costXp: 300,
    costUsd: null,
    durationLabel: "1h",
    durationHours: 1,
    effect: { xp_multiplier: 3 },
    consumable: true,
  },
  {
    id: "boost-shield",
    category: "boost",
    icon: "🛡️",
    name: "XP Shield",
    description: "Your next challenge loss won't deduct any XP. One-time safety net when the stakes are high.",
    costXp: 200,
    costUsd: null,
    durationLabel: "1 use",
    durationHours: null,
    effect: { shield: 1 },
    consumable: true,
  },
  {
    id: "boost-streak-7d",
    category: "boost",
    icon: "🏅",
    name: "Streak Defender",
    description: "Miss one day without breaking your streak. Keep your momentum going no matter what life throws at you.",
    costXp: 800,
    costUsd: 2.99,
    durationLabel: "7 days",
    durationHours: 168,
    effect: { streak_shield: 1 },
    consumable: true,
  },

  // ---- FLAIRS ----
  {
    id: "flair-trail-gold",
    category: "flair",
    icon: "✨",
    name: "Gold Trail",
    description: "Your route glows gold on the map. Let everyone see where legends run.",
    costXp: 750,
    costUsd: null,
    durationLabel: null,
    durationHours: null,
    effect: { trail: "gold" },
    consumable: false,
  },
  {
    id: "flair-trail-neon",
    category: "flair",
    icon: "💚",
    name: "Neon Trail",
    description: "Electric green route trail that pulses on the map. Stand out from the crowd.",
    costXp: 750,
    costUsd: null,
    durationLabel: null,
    durationHours: null,
    effect: { trail: "neon" },
    consumable: false,
  },
  {
    id: "flair-trail-inferno",
    category: "flair",
    icon: "🌋",
    name: "Inferno Trail",
    description: "A fire-gradient trail that burns across the map. Rare and unmistakable.",
    costXp: 1200,
    costUsd: 1.99,
    durationLabel: null,
    durationHours: null,
    effect: { trail: "inferno" },
    consumable: false,
  },
  {
    id: "flair-trail-ghost",
    category: "flair",
    icon: "👻",
    name: "Ghost Trail",
    description: "An ethereal white trail with a soft glow. Mysterious. Elegant. Unstoppable.",
    costXp: 500,
    costUsd: null,
    durationLabel: null,
    durationHours: null,
    effect: { trail: "ghost" },
    consumable: false,
  },
  {
    id: "flair-border-champion",
    category: "flair",
    icon: "👑",
    name: "Champion Border",
    description: "A gleaming gold ring around your profile avatar. Signal your dominance to every challenger.",
    costXp: 1500,
    costUsd: null,
    durationLabel: null,
    durationHours: null,
    effect: { border: "champion" },
    consumable: false,
  },
  {
    id: "flair-border-challenger",
    category: "flair",
    icon: "⚔️",
    name: "Challenger Border",
    description: "Fire avatar ring that dynamically shows your challenge win count. Earned respect, displayed proudly.",
    costXp: 1000,
    costUsd: null,
    durationLabel: null,
    durationHours: null,
    effect: { border: "challenger" },
    consumable: false,
  },
  {
    id: "flair-badge-elite",
    category: "flair",
    icon: "🏆",
    name: "Elite Badge",
    description: "A rare badge displayed prominently on your profile. Only the dedicated few ever own this.",
    costXp: 2000,
    costUsd: null,
    durationLabel: null,
    durationHours: null,
    effect: { badge: "elite" },
    consumable: false,
  },

  // ---- PREMIUM ----
  {
    id: "premium-monthly",
    category: "premium",
    icon: "💎",
    name: "ExerVia Premium",
    description:
      "Priority challenge matchmaking · 20% XP bonus on all activities · Premium badge · Advanced analytics · Ad-free experience.",
    costXp: null,
    costUsd: 4.99,
    durationLabel: "/month",
    durationHours: null,
    effect: { premium: true },
    consumable: false,
  },
];

const TABS = [
  { id: "boost", label: "Boosts" },
  { id: "flair", label: "Flairs" },
  { id: "premium", label: "Premium" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function calcExpiresAt(durationHours) {
  if (!durationHours) return null;
  const d = new Date();
  d.setTime(d.getTime() + durationHours * 60 * 60 * 1000);
  return d.toISOString();
}

function isBoostActive(inventoryRow) {
  if (!inventoryRow.is_active) return false;
  if (!inventoryRow.expires_at) return true; // one-use consumables stay active until consumed
  return new Date(inventoryRow.expires_at) > new Date();
}

function formatCountdown(expiresAt) {
  if (!expiresAt) return "1 use";
  const diff = new Date(expiresAt) - new Date();
  if (diff <= 0) return "Expired";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActiveBoostsBanner({ activeBoosts, items }) {
  if (!activeBoosts.length) return null;

  return (
    <div className="active-boosts-banner">
      <span className="active-boosts-label">Active Boosts</span>
      <div className="active-boosts-list">
        {activeBoosts.map((inv) => {
          const item = items.find((i) => i.id === inv.item_id);
          if (!item) return null;
          return (
            <div key={inv.id} className="active-boost-chip">
              <span className="active-boost-icon">{item.icon}</span>
              <span className="active-boost-name">{item.name}</span>
              <span className="active-boost-timer">{formatCountdown(inv.expires_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DurationBadge({ label }) {
  if (!label) return null;
  return <span className="duration-badge">{label}</span>;
}

function PriceTag({ item }) {
  if (item.costXp && item.costUsd) {
    return (
      <div className="item-price-combo">
        <span className="item-price-xp">
          <span className="coin-icon">🪙</span>
          {item.costXp.toLocaleString()} XP
        </span>
        <span className="price-or">or</span>
        <span className="item-price-usd">${item.costUsd.toFixed(2)}</span>
      </div>
    );
  }
  if (item.costXp) {
    return (
      <div className="item-price-xp">
        <span className="coin-icon">🪙</span>
        {item.costXp.toLocaleString()} XP
      </div>
    );
  }
  if (item.costUsd) {
    return (
      <div className="item-price-usd">
        ${item.costUsd.toFixed(2)}
        {item.durationLabel === "/month" ? (
          <span className="price-period">/mo</span>
        ) : null}
      </div>
    );
  }
  return null;
}

function ItemCard({ item, owned, activeInv, userXp, onBuy, onActivate }) {
  const isOwned = owned;
  const isActive = activeInv && isBoostActive(activeInv);
  const canAfford = item.costXp ? userXp >= item.costXp : true;

  return (
    <div className={`store-item-card store-item-card--${item.category}${isOwned ? " owned" : ""}${isActive ? " is-active" : ""}`}>
      <div className="item-card-top">
        <div className="item-icon-wrap">
          <span className="item-icon" role="img" aria-label={item.name}>
            {item.icon}
          </span>
        </div>
        <div className="item-badges-row">
          {isOwned && <span className="owned-badge">Owned</span>}
          {isActive && <span className="active-badge">Active</span>}
          <DurationBadge label={item.durationLabel !== "/month" ? item.durationLabel : null} />
        </div>
      </div>

      <div className="item-card-body">
        <h3 className="item-name">{item.name}</h3>
        <p className="item-description">{item.description}</p>
      </div>

      <div className="item-card-footer">
        <PriceTag item={item} />
        <div className="item-actions">
          {!isOwned && item.costXp && (
            <button
              className={`buy-btn${canAfford ? "" : " buy-btn--disabled"}`}
              onClick={() => canAfford && onBuy(item)}
              disabled={!canAfford}
              title={!canAfford ? "Not enough XP" : `Buy ${item.name}`}
            >
              {canAfford ? "Buy" : "Need XP"}
            </button>
          )}
          {!isOwned && !item.costXp && item.costUsd && (
            <button
              className="buy-btn buy-btn--usd"
              onClick={() => onBuy(item)}
            >
              Subscribe
            </button>
          )}
          {!isOwned && item.costXp && item.costUsd && (
            <button
              className="buy-btn buy-btn--usd buy-btn--alt"
              onClick={() => onBuy(item, "usd")}
            >
              Pay ${item.costUsd.toFixed(2)}
            </button>
          )}
          {isOwned && item.category === "flair" && !isActive && (
            <button className="activate-btn" onClick={() => onActivate(item)}>
              Activate
            </button>
          )}
          {isOwned && item.category === "flair" && isActive && (
            <span className="equipped-label">Equipped</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ item, userXp, purchasing, purchaseSuccess, payMode, onConfirm, onCancel }) {
  if (!item) return null;

  const costXp = item.costXp;
  const costUsd = item.costUsd;
  const usingXp = payMode !== "usd" && costXp;
  const newBalance = usingXp ? userXp - costXp : userXp;
  const insufficient = usingXp && userXp < costXp;

  return (
    <div className="confirm-modal-overlay" onClick={onCancel}>
      <div
        className={`confirm-modal${purchaseSuccess ? " confirm-modal--success" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {purchaseSuccess ? (
          <div className="confirm-success-state">
            <span className="confirm-success-checkmark">✓</span>
            <p className="confirm-success-text">Added to your inventory!</p>
          </div>
        ) : (
          <>
            <div className="confirm-modal-header">
              <span className="confirm-item-icon">{item.icon}</span>
              <div className="confirm-item-info">
                <h2 className="confirm-item-name">{item.name}</h2>
                {item.durationLabel && item.durationLabel !== "/month" && (
                  <DurationBadge label={item.durationLabel} />
                )}
              </div>
            </div>

            <p className="confirm-item-description">{item.description}</p>

            {usingXp && (
              <div className="confirm-xp-summary">
                <div className="confirm-xp-row">
                  <span className="confirm-xp-label">Cost</span>
                  <span className="confirm-xp-value cost">
                    <span className="coin-icon">🪙</span> {costXp.toLocaleString()} XP
                  </span>
                </div>
                <div className="confirm-xp-row">
                  <span className="confirm-xp-label">Your balance</span>
                  <span className="confirm-xp-value">{userXp.toLocaleString()} XP</span>
                </div>
                <div className="confirm-xp-divider" />
                <div className="confirm-xp-row">
                  <span className="confirm-xp-label">After purchase</span>
                  <span className={`confirm-xp-value${insufficient ? " insufficient" : " remaining"}`}>
                    {insufficient ? "Insufficient XP" : `${newBalance.toLocaleString()} XP`}
                  </span>
                </div>
              </div>
            )}

            {!usingXp && costUsd && (
              <div className="confirm-usd-summary">
                <span className="confirm-usd-label">You will be charged</span>
                <span className="confirm-usd-amount">
                  ${costUsd.toFixed(2)}
                  {item.durationLabel === "/month" ? "/month" : ""}
                </span>
                <p className="confirm-usd-note">
                  Payment processing is handled securely. This is a demo — no real charge will occur.
                </p>
              </div>
            )}

            <div className="confirm-actions">
              <button
                className="confirm-cancel-btn"
                onClick={onCancel}
                disabled={purchasing}
              >
                Cancel
              </button>
              <button
                className={`confirm-buy-btn${insufficient ? " confirm-buy-btn--disabled" : ""}`}
                onClick={onConfirm}
                disabled={purchasing || insufficient}
              >
                {purchasing ? (
                  <span className="confirm-spinner" />
                ) : (
                  "Confirm Purchase"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ExerviaStore({ viewerId, userXp: initialXp, onXpChange }) {
  const [activeTab, setActiveTab] = useState("boost");
  const [inventory, setInventory] = useState([]);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [confirmItem, setConfirmItem] = useState(null);
  const [confirmPayMode, setConfirmPayMode] = useState("xp");
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseSuccess, setPurchaseSuccess] = useState(false);
  const [userXp, setUserXp] = useState(typeof initialXp === "number" ? initialXp : 0);
  const [errorMsg, setErrorMsg] = useState(null);

  // Sync external xp prop
  useEffect(() => {
    if (typeof initialXp === "number") setUserXp(initialXp);
  }, [initialXp]);

  // ---- Load inventory ----
  useEffect(() => {
    if (!viewerId) {
      setInventoryLoading(false);
      return;
    }
    let cancelled = false;
    async function loadInventory() {
      setInventoryLoading(true);
      try {
        const { data, error } = await supabase
          .from("user_inventory")
          .select("*")
          .eq("user_id", viewerId);
        if (error) throw error;
        if (!cancelled) setInventory(Array.isArray(data) ? data : []);
      } catch (err) {
        if (!cancelled) {
          console.error("[ExerviaStore] Failed to load inventory:", err);
        }
      } finally {
        if (!cancelled) setInventoryLoading(false);
      }
    }
    loadInventory();
    return () => {
      cancelled = true;
    };
  }, [viewerId]);

  // ---- Derived state ----
  const ownedItemIds = useMemo(() => new Set(inventory.map((r) => r.item_id)), [inventory]);

  const activeBoosts = useMemo(
    () => inventory.filter((r) => r.item_id?.startsWith("boost-") && isBoostActive(r)),
    [inventory]
  );

  const filteredItems = useMemo(
    () => STORE_ITEMS.filter((i) => i.category === activeTab),
    [activeTab]
  );

  // ---- Handlers ----
  function handleBuy(item, payMode = "xp") {
    setConfirmItem(item);
    setConfirmPayMode(payMode);
    setPurchaseSuccess(false);
    setErrorMsg(null);
  }

  async function handleActivateFlair(item) {
    if (!viewerId) return;
    // Deactivate other flairs of same type, activate this one
    try {
      const inv = inventory.find((r) => r.item_id === item.id);
      if (!inv) return;
      await supabase
        .from("user_inventory")
        .update({ is_active: true })
        .eq("id", inv.id);
      setInventory((prev) =>
        prev.map((r) => {
          if (r.item_id?.startsWith("flair-")) return { ...r, is_active: r.id === inv.id };
          return r;
        })
      );
    } catch (err) {
      console.error("[ExerviaStore] Activate flair error:", err);
    }
  }

  async function handleConfirmPurchase() {
    if (!confirmItem || !viewerId) return;
    const item = confirmItem;
    const usingXp = confirmPayMode !== "usd" && item.costXp;

    // For USD items, stub the payment
    if (!usingXp) {
      setPurchasing(true);
      // Simulate payment delay
      await new Promise((r) => setTimeout(r, 900));
      setPurchasing(false);
      setPurchaseSuccess(true);
      setTimeout(() => {
        setConfirmItem(null);
        setPurchaseSuccess(false);
      }, 1800);
      return;
    }

    if (userXp < item.costXp) {
      setErrorMsg("Insufficient XP balance.");
      return;
    }

    setPurchasing(true);
    setErrorMsg(null);

    try {
      // 1. Deduct XP
      const { error: xpError } = await supabase
        .from("user_profiles")
        .update({ xp: userXp - item.costXp })
        .eq("id", viewerId);
      if (xpError) throw xpError;

      // 2. Insert into inventory
      const expiresAt = calcExpiresAt(item.durationHours);
      const { data: newInvRow, error: invError } = await supabase
        .from("user_inventory")
        .insert({
          user_id: viewerId,
          item_id: item.id,
          purchased_at: new Date().toISOString(),
          expires_at: expiresAt,
          is_active: false,
        })
        .select()
        .single();
      if (invError) throw invError;

      // 3. Update local state
      const newXp = userXp - item.costXp;
      setUserXp(newXp);
      if (typeof onXpChange === "function") onXpChange(newXp);
      setInventory((prev) => [...prev, newInvRow]);

      setPurchaseSuccess(true);
      setTimeout(() => {
        setConfirmItem(null);
        setPurchaseSuccess(false);
      }, 1800);
    } catch (err) {
      console.error("[ExerviaStore] Purchase error:", err);
      setErrorMsg(err.message || "Purchase failed. Please try again.");
    } finally {
      setPurchasing(false);
    }
  }

  function handleCancelModal() {
    if (purchasing) return;
    setConfirmItem(null);
    setPurchaseSuccess(false);
    setErrorMsg(null);
  }

  // ---- Render ----
  return (
    <div className="exervia-store">
      {/* Header */}
      <div className="store-header">
        <div className="store-header-left">
          <h1 className="store-title">ExerVia Store</h1>
          <p className="store-subtitle">Boost your performance. Customize your journey.</p>
        </div>
        <div className="store-xp-balance">
          <span className="xp-coin-icon">🪙</span>
          <span className="xp-balance-value">{userXp.toLocaleString()}</span>
          <span className="xp-balance-label">XP</span>
        </div>
      </div>

      {/* Active Boosts Banner */}
      <ActiveBoostsBanner activeBoosts={activeBoosts} items={STORE_ITEMS} />

      {/* Category Tabs */}
      <div className="store-tabs" role="tablist" aria-label="Store categories">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`store-tab${activeTab === tab.id ? " store-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === "boost" && activeBoosts.length > 0 && (
              <span className="tab-badge">{activeBoosts.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content intro */}
      <div className="store-tab-intro">
        {activeTab === "boost" && (
          <p>Temporary power-ups that multiply your XP gains or protect your streak.</p>
        )}
        {activeTab === "flair" && (
          <p>Permanent cosmetics that customize how your profile and routes appear to others.</p>
        )}
        {activeTab === "premium" && (
          <p>Unlock the full ExerVia experience with an enhanced membership.</p>
        )}
      </div>

      {/* Items Grid */}
      {inventoryLoading ? (
        <div className="store-loading">
          <div className="store-loading-spinner" />
          <span>Loading your inventory…</span>
        </div>
      ) : (
        <div className={`store-items-grid store-items-grid--${activeTab}`}>
          {filteredItems.map((item) => {
            const invRow = inventory.find((r) => r.item_id === item.id);
            const owned = ownedItemIds.has(item.id);
            const activeInv = invRow && isBoostActive(invRow) ? invRow : null;
            return (
              <ItemCard
                key={item.id}
                item={item}
                owned={owned}
                activeInv={activeInv}
                userXp={userXp}
                onBuy={handleBuy}
                onActivate={handleActivateFlair}
              />
            );
          })}
        </div>
      )}

      {/* Error */}
      {errorMsg && (
        <div className="store-error-banner">
          <span>⚠ {errorMsg}</span>
          <button className="store-error-dismiss" onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmItem && (
        <ConfirmModal
          item={confirmItem}
          userXp={userXp}
          purchasing={purchasing}
          purchaseSuccess={purchaseSuccess}
          payMode={confirmPayMode}
          onConfirm={handleConfirmPurchase}
          onCancel={handleCancelModal}
        />
      )}
    </div>
  );
}
