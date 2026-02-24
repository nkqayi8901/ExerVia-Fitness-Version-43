import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";
import Navbar from "./Navbar";

const formatNumber = (value) => Number(value || 0).toLocaleString();

export default function GymProfilePage({ mode = "gym", viewerId }) {
  const navigate = useNavigate();
  const { id, placeId } = useParams();
  const resolvedViewerId = Number(viewerId || id);
  const decodedPlaceId = decodeURIComponent(String(placeId || "").trim());
  const backPath = mode === "gym" ? `/gym/${id}/community` : `/athlete/${id}/community`;

  const [loading, setLoading] = useState(true);
  const [copyState, setCopyState] = useState("");
  const [gymMeta, setGymMeta] = useState({ name: "", address: "" });
  const [memberCount, setMemberCount] = useState(0);
  const [leaderboardRows, setLeaderboardRows] = useState([]);
  const [activeCrews, setActiveCrews] = useState([]);
  const [profileLabels, setProfileLabels] = useState({});

  const topTonnage = useMemo(() => Number(leaderboardRows[0]?.weekly_tonnage || 0), [leaderboardRows]);

  useEffect(() => {
    if (!decodedPlaceId) {
      setLoading(false);
      return;
    }

    const fetchGymPage = async () => {
      setLoading(true);
      setCopyState("");

      const [{ data: gymProfileRow }, { count: gymMembersCount }, { data: leaderboardData }] = await Promise.all([
        supabase
          .from("user_profiles")
          .select("primary_gym_name,primary_gym_address")
          .eq("primary_gym_place_id", decodedPlaceId)
          .not("primary_gym_name", "is", null)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("user_profiles")
          .select("id", { count: "exact", head: true })
          .eq("primary_gym_place_id", decodedPlaceId),
        supabase.rpc("get_weekly_gym_leaderboard_by_place", {
          p_place_id: decodedPlaceId,
          p_limit: 30,
        }),
      ]);

      const leaderboard = leaderboardData || [];
      setLeaderboardRows(leaderboard);
      setGymMeta({
        name: String(gymProfileRow?.primary_gym_name || "").trim(),
        address: String(gymProfileRow?.primary_gym_address || "").trim(),
      });
      setMemberCount(Number(gymMembersCount || 0));

      const leaderboardIds = Array.from(new Set(leaderboard.map((row) => Number(row.user_id)).filter(Boolean)));
      if (leaderboardIds.length) {
        const { data: profileRows } = await supabase
          .from("user_profiles")
          .select("id,username,display_name")
          .in("id", leaderboardIds);
        const nextLabels = {};
        (profileRows || []).forEach((row) => {
          const username = String(row.username || "").trim().replace(/^@+/, "");
          nextLabels[row.id] = username ? `@${username}` : row.display_name || `User ${row.id}`;
        });
        setProfileLabels(nextLabels);
      } else {
        setProfileLabels({});
      }

      const { data: gymUsers } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("primary_gym_place_id", decodedPlaceId)
        .limit(500);
      const gymUserIds = Array.from(new Set((gymUsers || []).map((row) => Number(row.id)).filter(Boolean)));

      if (gymUserIds.length) {
        const { data: crewRows } = await supabase
          .from("community_group_members")
          .select("group_id,user_id,community_groups(name)")
          .in("user_id", gymUserIds)
          .limit(2000);
        const byGroup = {};
        (crewRows || []).forEach((row) => {
          const groupId = String(row.group_id || "");
          if (!groupId) return;
          if (!byGroup[groupId]) {
            byGroup[groupId] = {
              id: groupId,
              name: row.community_groups?.name || "Group",
              members: new Set(),
            };
          }
          byGroup[groupId].members.add(Number(row.user_id));
        });
        const crewList = Object.values(byGroup)
          .map((group) => ({
            id: group.id,
            name: group.name,
            count: group.members.size,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setActiveCrews(crewList);
      } else {
        setActiveCrews([]);
      }

      setLoading(false);
    };

    fetchGymPage();
  }, [decodedPlaceId, resolvedViewerId]);

  const handleCopyShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopyState("Copied");
    } catch {
      setCopyState("Copy failed");
    }
  };

  if (loading) {
    return (
      <div className={`hud-bg mode-${mode}`}>
        <Navbar modeLabel="GYM PROFILE" mode={mode} userId={resolvedViewerId} />
        <div className="page-shell">
          <div className="hud-card">Loading gym profile...</div>
        </div>
      </div>
    );
  }

  if (!decodedPlaceId) {
    return (
      <div className={`hud-bg mode-${mode}`}>
        <Navbar modeLabel="GYM PROFILE" mode={mode} userId={resolvedViewerId} />
        <div className="page-shell">
          <div className="hud-card">
            <button className="studio-back" onClick={() => navigate(backPath)} type="button">
              Back
            </button>
            <div className="page-title mt-3">Gym not found</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`hud-bg mode-${mode}`}>
      <Navbar modeLabel="GYM PROFILE" mode={mode} userId={resolvedViewerId} />
      <div className="page-shell gym-profile-shell">
        <div className="page-header gym-profile-head">
          <div>
            <button className="studio-back" onClick={() => navigate(backPath)} type="button">
              Back
            </button>
            <h2 className="page-title">{gymMeta.name || "Linked Gym"}</h2>
            <p className="page-subtitle">{gymMeta.address || "Weekly standings for this gym location."}</p>
          </div>
          <button className="studio-back community-cta-btn" type="button" onClick={handleCopyShare}>
            {copyState ? `${copyState} link` : "Share gym card"}
          </button>
        </div>

        <div className="grid-3">
          <div className="hud-card">
            <div className="hud-card-title">MEMBERS</div>
            <div className="hud-big">{memberCount}</div>
            <div className="hud-dim">Profiles linked to this gym</div>
          </div>
          <div className="hud-card">
            <div className="hud-card-title">SESSIONS (WEEK)</div>
            <div className="hud-big">{leaderboardRows.reduce((sum, row) => sum + Number(row.session_count || 0), 0)}</div>
            <div className="hud-dim">Logged strength entries</div>
          </div>
          <div className="hud-card">
            <div className="hud-card-title">TOTAL TONNAGE</div>
            <div className="hud-big">{formatNumber(leaderboardRows.reduce((sum, row) => sum + Number(row.weekly_tonnage || 0), 0))} kg</div>
            <div className="hud-dim">Current week reset cycle</div>
          </div>
        </div>

        <div className="gym-profile-grid">
          <div className="hud-card">
            <div className="hud-card-title">TOP LIFTERS THIS WEEK</div>
            {!leaderboardRows.length && <div className="hud-dim mt-2">No lifts logged yet this week.</div>}
            {leaderboardRows.slice(0, 12).map((row, idx) => {
              const tonnage = Number(row.weekly_tonnage || 0);
              const pct = topTonnage > 0 ? Math.max(2, Math.round((tonnage / topTonnage) * 100)) : 0;
              const label = profileLabels[row.user_id] || `User ${row.user_id}`;
              return (
                <div key={`gym-profile-row-${row.user_id}`} className="gym-profile-row">
                  <div className="gym-profile-row-main">
                    <span className="community-meta-pill">#{idx + 1}</span>
                    <span className="gym-profile-user">{label}</span>
                    <span className="community-meta-pill">{formatNumber(tonnage)} kg</span>
                    {Number(row.delta_to_next || 0) > 0 ? (
                      <span className="community-meta-pill">+{formatNumber(row.delta_to_next)} to next</span>
                    ) : null}
                  </div>
                  <div className="gym-profile-bar-track">
                    <div className="gym-profile-bar-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hud-card">
            <div className="hud-card-title">ACTIVE CREWS</div>
            {!activeCrews.length && <div className="hud-dim mt-2">No group overlap yet for this gym.</div>}
            {activeCrews.map((crew) => (
              <div key={`gym-crew-${crew.id}`} className="gym-profile-crew-row">
                <span className="gym-profile-user">{crew.name}</span>
                <span className="community-meta-pill">{crew.count} member{crew.count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
