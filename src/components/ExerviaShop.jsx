import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import { emitToast } from "../utils/toast";
import "./ExerviaShop.css";

const SHOP_CATEGORIES = [
  { key: "all",        label: "All" },
  { key: "featured",   label: "⭐ Featured" },
  { key: "boost",      label: "⚡ Boosts" },
  { key: "cosmetic",   label: "🎨 Flairs" },
  { key: "title",      label: "🏷️ Titles" },
  { key: "protection", label: "🛡️ Protection" },
];

const RARITY_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 };

const RARITY_COLOURS = {
  legendary: "#facc15",
  epic:      "#a78bfa",
  rare:      "#60a5fa",
  common:    "#9ca3af",
};

function formatHours(h) {
  if (!h) return "Permanent";
  if (h < 24) return `${h}h`;
  return `${h / 24}d`;
}

function formatTimeLeft(hours) {
  if (hours <= 0) return "Expired";
  if (hours < 1) return `${Math.round(hours * 60)}m left`;
  if (hours < 24) return `${hours.toFixed(1)}h left`;
  return `${(hours / 24).toFixed(1)}d left`;
}

/* ─── Confirm modal ────────────────────────────────────────────── */
function ConfirmModal({ item, xp, onBuy, onClose, purchasing }) {
  if (!item) return null;
  const canAfford = xp >= (item.cost_xp || 0);
  return (
    <div className="shop-confirm-backdrop" onClick={onClose}>
      <div className="shop-confirm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="shop-confirm-icon">{item.icon}</div>
        <div className="shop-confirm-name">{item.name}</div>
        <div
          className="shop-confirm-rarity"
          style={{ color: RARITY_COLOURS[item.rarity] }}
        >
          {item.rarity.toUpperCase()}
        </div>
        <div className="shop-confirm-desc">{item.description}</div>
        {item.duration_hours ? (
          <div className="shop-confirm-duration">
            Active for <strong>{formatHours(item.duration_hours)}</strong>
          </div>
        ) : null}
        <div className="shop-confirm-cost">⚡ {item.cost_xp?.toLocaleString()} XP</div>
        <div className="shop-confirm-balance">
          Your balance: {xp.toLocaleString()} XP
          {!canAfford ? (
            <span className="shop-balance-short">
              {" "}· need {((item.cost_xp || 0) - xp).toLocaleString()} more
            </span>
          ) : (
            <span className="shop-balance-ok">
              {" "}· {(xp - (item.cost_xp || 0)).toLocaleString()} remaining
            </span>
          )}
        </div>
        <div className="shop-confirm-actions">
          <button
            className="shop-confirm-buy"
            type="button"
            onClick={onBuy}
            disabled={purchasing || !canAfford}
          >
            {purchasing ? "Purchasing…" : "Confirm"}
          </button>
          <button className="shop-confirm-cancel" type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Item card ────────────────────────────────────────────────── */
function ItemCard({ item, owned, canAfford, onBuy }) {
  return (
    <div
      className={`shop-item-card rarity-${item.rarity} category-${item.category}`}
      onClick={() => !owned && onBuy(item)}
    >
      <div className="shop-item-rarity-bar" />
      {owned && <div className="shop-owned-badge">Owned</div>}
      <div className="shop-item-body">
        <div className="shop-item-icon-row">
          <span className="shop-item-icon">{item.icon}</span>
          <span
            className="shop-item-rarity-badge"
            style={{ color: RARITY_COLOURS[item.rarity], borderColor: RARITY_COLOURS[item.rarity] }}
          >
            {item.rarity}
          </span>
        </div>
        <div className="shop-item-name">{item.name}</div>
        <div className="shop-item-desc">{item.description}</div>
        {item.duration_hours ? (
          <div className="shop-item-duration">Duration: {formatHours(item.duration_hours)}</div>
        ) : null}
      </div>
      <div className="shop-item-footer">
        <div className="shop-item-cost">
          {item.cost_xp != null ? (
            <>⚡ {item.cost_xp.toLocaleString()} <span className="shop-item-cost-label">XP</span></>
          ) : (
            <span style={{ color: "#a78bfa" }}>💎 Gems</span>
          )}
        </div>
        <button
          className={`shop-buy-btn ${owned ? "owned" : !canAfford ? "cant-afford" : ""}`}
          type="button"
          disabled={owned}
          onClick={(e) => { e.stopPropagation(); if (!owned) onBuy(item); }}
        >
          {owned ? "Owned" : !canAfford ? "Need XP" : "Buy"}
        </button>
      </div>
    </div>
  );
}

/* ─── Locker item card ─────────────────────────────────────────── */
function LockerCard({ inv }) {
  const si = inv.shop_items;
  if (!si) return null;
  const now = new Date();
  const expired = inv.expires_at && new Date(inv.expires_at) <= now;
  const hoursLeft = inv.expires_at
    ? (new Date(inv.expires_at) - now) / 3600000
    : null;
  const isActive = !expired;

  return (
    <div className={`locker-card rarity-${si.rarity} ${expired ? "expired" : ""}`}>
      <div className="locker-card-rarity-bar" style={{ background: RARITY_COLOURS[si.rarity] }} />
      <div className="locker-card-body">
        <span className="locker-card-icon">{si.icon}</span>
        <div className="locker-card-info">
          <div className="locker-card-name">{si.name}</div>
          <div
            className="locker-card-rarity"
            style={{ color: RARITY_COLOURS[si.rarity] }}
          >
            {si.rarity} · {si.category}
          </div>
          {hoursLeft !== null ? (
            <div className={`locker-card-time ${expired ? "expired" : hoursLeft < 2 ? "urgent" : ""}`}>
              {expired ? "Expired" : formatTimeLeft(hoursLeft)}
            </div>
          ) : (
            <div className="locker-card-time permanent">Permanent</div>
          )}
        </div>
        {isActive && (si.category === "cosmetic" || si.category === "title") ? (
          <div className="locker-equipped-badge">Equipped</div>
        ) : null}
        {isActive && si.category === "boost" && hoursLeft !== null ? (
          <div className="locker-active-badge">Active</div>
        ) : null}
        {isActive && si.category === "protection" ? (
          <div className="locker-ready-badge">Ready</div>
        ) : null}
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
export default function ExerviaShop({ userId }) {
  const navigate = useNavigate();
  const [mainTab, setMainTab] = useState("shop"); // "shop" | "locker"
  const [shopTab, setShopTab] = useState("all");
  const [items, setItems] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [activeBoosts, setActiveBoosts] = useState([]);
  const [xp, setXp] = useState(0);
  const [confirmItem, setConfirmItem] = useState(null);
  const [purchasing, setPurchasing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lockerLoading, setLockerLoading] = useState(false);

  const fetchShop = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [itemsRes, xpRes, invRes, boostsRes] = await Promise.all([
        supabase.from("shop_items").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("user_state").select("xp").eq("user_id", Number(userId)).maybeSingle(),
        supabase
          .from("user_inventory")
          .select("item_id, expires_at, is_active")
          .eq("user_id", Number(userId))
          .eq("is_active", true),
        supabase.rpc("get_active_boosts"),
      ]);
      if (itemsRes.data) setItems(itemsRes.data);
      if (xpRes.data?.xp != null) setXp(Number(xpRes.data.xp));
      if (invRes.data) setInventory(invRes.data);
      if (boostsRes.data) setActiveBoosts(boostsRes.data);
    } catch {
      emitToast("Could not load shop.", "error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchLocker = useCallback(async () => {
    if (!userId) return;
    setLockerLoading(true);
    try {
      const { data } = await supabase
        .from("user_inventory")
        .select("id, item_id, purchased_at, expires_at, is_active, meta, shop_items(name, icon, category, rarity, duration_hours)")
        .eq("user_id", Number(userId))
        .order("purchased_at", { ascending: false });
      if (data) setInventory(data);
    } catch {
      emitToast("Could not load locker.", "error");
    } finally {
      setLockerLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchShop(); }, [fetchShop]);
  useEffect(() => {
    if (mainTab === "locker") fetchLocker();
  }, [mainTab, fetchLocker]);

  const isOwned = (itemId) =>
    inventory.some((inv) => {
      if (inv.item_id !== itemId) return false;
      if (!inv.expires_at) return true;
      return new Date(inv.expires_at) > new Date();
    });

  const handleBuy = async () => {
    if (!confirmItem || purchasing) return;
    setPurchasing(true);
    try {
      const { data, error } = await supabase.rpc("purchase_shop_item", {
        p_item_id: confirmItem.id,
      });
      if (error || !data?.ok) {
        emitToast(data?.error || error?.message || "Purchase failed.", "error");
        return;
      }
      setXp((prev) => Math.max(0, prev - confirmItem.cost_xp));
      emitToast(`${confirmItem.icon} ${confirmItem.name} unlocked!`, "success");
      setConfirmItem(null);
      await fetchShop();
      window.dispatchEvent(new CustomEvent("user_state_updated"));
    } catch {
      emitToast("Purchase failed. Try again.", "error");
    } finally {
      setPurchasing(false);
    }
  };

  const visibleItems = items
    .filter((item) => shopTab === "all" || item.category === shopTab)
    .sort((a, b) =>
      shopTab === "all"
        ? a.sort_order - b.sort_order
        : (RARITY_ORDER[a.rarity] ?? 9) - (RARITY_ORDER[b.rarity] ?? 9)
    );

  const lockerItems = inventory.filter((inv) => inv.shop_items);
  const activeLockerItems = lockerItems.filter((inv) => {
    if (!inv.is_active) return false;
    if (!inv.expires_at) return true;
    return new Date(inv.expires_at) > new Date();
  });
  const expiredLockerItems = lockerItems.filter((inv) => {
    if (!inv.is_active) return true;
    if (!inv.expires_at) return false;
    return new Date(inv.expires_at) <= new Date();
  });

  return (
    <div className="shop-root">
      {/* ── Header ── */}
      <div className="shop-header">
        <button className="shop-back-btn" type="button" onClick={() => navigate(-1)}>
          ← Back
        </button>
        <div className="shop-header-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ marginRight: 6, verticalAlign: "middle" }}>
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <line x1="3" y1="6" x2="21" y2="6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M16 10a4 4 0 01-8 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          ExerVia Shop
        </div>
        <div className="shop-xp-chip">
          <span className="shop-xp-icon">⚡</span>
          {xp.toLocaleString()} XP
        </div>
      </div>

      {/* ── Active boosts ticker ── */}
      {activeBoosts.length > 0 && (
        <div className="shop-boosts-bar">
          <span className="shop-boosts-label">Active</span>
          {activeBoosts.map((boost) => (
            <div key={`${boost.item_id}-${boost.expires_at}`} className="shop-boost-chip">
              {boost.icon} {boost.name}
              <span className="shop-boost-chip-time"> · {formatTimeLeft(Number(boost.hours_left))}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Main tabs: Shop | My Locker ── */}
      <div className="shop-main-tabs">
        <button
          type="button"
          className={`shop-main-tab ${mainTab === "shop" ? "active" : ""}`}
          onClick={() => setMainTab("shop")}
        >
          Shop
        </button>
        <button
          type="button"
          className={`shop-main-tab ${mainTab === "locker" ? "active" : ""}`}
          onClick={() => setMainTab("locker")}
        >
          My Locker
          {activeLockerItems.length > 0 && (
            <span className="shop-locker-count">{activeLockerItems.length}</span>
          )}
        </button>
      </div>

      {/* ── SHOP VIEW ── */}
      {mainTab === "shop" && (
        <>
          <div className="shop-tabs">
            {SHOP_CATEGORIES.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`shop-tab ${shopTab === key ? "active" : ""}`}
                onClick={() => setShopTab(key)}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="shop-empty">
              <div className="shop-empty-icon">⏳</div>
              Loading…
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="shop-empty">
              <div className="shop-empty-icon">🛒</div>
              Nothing here yet
            </div>
          ) : (
            <div className="shop-grid">
              {visibleItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  owned={isOwned(item.id)}
                  canAfford={xp >= (item.cost_xp || 0)}
                  onBuy={setConfirmItem}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── LOCKER VIEW ── */}
      {mainTab === "locker" && (
        <div className="locker-shell">
          {lockerLoading ? (
            <div className="shop-empty"><div className="shop-empty-icon">⏳</div>Loading locker…</div>
          ) : lockerItems.length === 0 ? (
            <div className="shop-empty">
              <div className="shop-empty-icon">🎒</div>
              <div style={{ fontWeight: 700, color: "#fff", marginBottom: 8 }}>Your locker is empty</div>
              <div>Head to the Shop tab and grab your first item.</div>
            </div>
          ) : (
            <>
              {activeLockerItems.length > 0 && (
                <div className="locker-section">
                  <div className="locker-section-label">Active & Owned</div>
                  <div className="locker-grid">
                    {activeLockerItems.map((inv) => (
                      <LockerCard key={inv.id} inv={inv} />
                    ))}
                  </div>
                </div>
              )}
              {expiredLockerItems.length > 0 && (
                <div className="locker-section">
                  <div className="locker-section-label" style={{ color: "rgba(255,255,255,0.25)" }}>
                    Expired / Used
                  </div>
                  <div className="locker-grid">
                    {expiredLockerItems.map((inv) => (
                      <LockerCard key={inv.id} inv={inv} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Confirm modal ── */}
      <ConfirmModal
        item={confirmItem}
        xp={xp}
        onBuy={handleBuy}
        onClose={() => setConfirmItem(null)}
        purchasing={purchasing}
      />
    </div>
  );
}
