import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import useDistanceUnitPreference from "../hooks/useDistanceUnitPreference";
import { supabase } from "../supabaseClient";
import { loadGoogleMapsApi } from "../utils/googleMapsLoader";
import {
  ATHLETE_DEFAULT_MAP_CENTER,
  formatPaceFromSecondsPerKm,
} from "../utils/athleteMetrics";
import { buildPointsRouteBbox, normalizeRoutePoints } from "../utils/routeGeometry";

const haversineDistance = (a, b) => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

const RouteLabsPinnacle = ({ viewerId, mode = "gym" }) => {
  const navigate = useNavigate();
  const { id, runId } = useParams();
  const mapNodeRef = useRef(null);
  const googleMapRef = useRef(null);
  const routeRef = useRef(null);
  const hasGoogleMapsKey = Boolean(process.env.REACT_APP_GOOGLE_MAPS_API_KEY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [run, setRun] = useState(null);
  const [, setMapsReady] = useState(false);
  const [distanceUnit] = useDistanceUnitPreference();
  const [isTracking, setIsTracking] = useState(false);
  const [liveTime, setLiveTime] = useState(0);
  const [liveDistance, setLiveDistance] = useState(0);
  const [livePace, setLivePace] = useState(0);
  const [showAdvancedSetup, setShowAdvancedSetup] = useState(false);
  const [selectedDistance, setSelectedDistance] = useState('5 km');
  const [visibilityMode, setVisibilityMode] = useState('Nearby');
  const [runMode, setRunMode] = useState('Solo');
  const resolvedViewerIdRaw = Number(viewerId || id);
  const resolvedViewerId = Number.isFinite(resolvedViewerIdRaw) ? resolvedViewerIdRaw : null;
  const timerRef = useRef(null);
  const gpsWatchRef = useRef(null);
  const gpsPointsRef = useRef([]);
  const startTimeRef = useRef(null);
  const [userLocation, setUserLocation] = useState(null);
  const [elevationTarget, setElevationTarget] = useState(200);
  const [heartRateZone, setHeartRateZone] = useState('zone2');
  const [weatherCondition, setWeatherCondition] = useState('Clear');
  const [gpsDenied, setGpsDenied] = useState(false);

  // Timer for live tracking
  useEffect(() => {
    if (isTracking) {
      timerRef.current = setInterval(() => {
        setLiveTime(prev => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [isTracking]);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!runId) {
        if (active) {
          setLoadError("No run was selected.");
          setRun(null);
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      setLoadError("");
      try {
        const { data, error } = await supabase
          .from("athlete_runs")
          .select("id,user_id,title,discipline,distance_km,elapsed_seconds,pace_per_km_seconds,visibility,challenge_mode,route_note,route_points,start_lat,start_lng,end_lat,end_lng,created_at")
          .eq("id", Number(runId))
          .maybeSingle();
        if (!active) return;
        if (error || !data) {
          setLoadError("Could not load this run.");
          setRun(null);
          setLoading(false);
          return;
        }
        setRun({
          ...data,
          route_points: normalizeRoutePoints(data.route_points),
        });
      } catch {
        if (active) {
          setLoadError("Could not load this run.");
          setRun(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [runId]);

  const points = useMemo(() => normalizeRoutePoints(run?.route_points), [run]);
  const center = useMemo(() => {
    if (points.length) return points[Math.floor(points.length / 2)];
    if (run?.start_lat && run?.start_lng) {
      return { lat: Number(run.start_lat), lng: Number(run.start_lng) };
    }
    return ATHLETE_DEFAULT_MAP_CENTER;
  }, [points, run]);

  const mapSrc = useMemo(() => {
    const bbox = buildPointsRouteBbox(points, center);
    const marker = `${center.lat},${center.lng}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  }, [center, points]);


  useEffect(() => {
    let active = true;
    if (!hasGoogleMapsKey || !run || !mapNodeRef.current || googleMapRef.current) return undefined;
    loadGoogleMapsApi()
      .then((maps) => {
        if (!active || !mapNodeRef.current) return;
        const map = new maps.Map(mapNodeRef.current, {
          center,
          zoom: 14,
          disableDefaultUI: true,
          zoomControl: true,
          gestureHandling: "greedy",
          mapId: process.env.REACT_APP_GOOGLE_MAPS_MAP_ID || undefined,
        });
        googleMapRef.current = map;
        if (points.length) {
          routeRef.current = new maps.Polyline({
            map,
            path: points,
            geodesic: true,
            strokeColor: "#f97316",
            strokeOpacity: 0.92,
            strokeWeight: 4,
          });
          const bounds = new maps.LatLngBounds();
          points.forEach((point) => bounds.extend(point));
          if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
        } else {
          new maps.Marker({ map, position: center, title: run.title || "Run" });
        }
        setMapsReady(true);
      })
      .catch(() => setMapsReady(false));
    return () => {
      active = false;
    };
  }, [center, hasGoogleMapsKey, points, run]);

  const handleStartRun = () => {
    setIsTracking(true);
    setLiveTime(0);
    setLiveDistance(0);
    setLivePace(0);
    gpsPointsRef.current = [];
    startTimeRef.current = Date.now();
    if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);

    if ('geolocation' in navigator) {
      gpsWatchRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const newPt = { lat: position.coords.latitude, lng: position.coords.longitude };
          const prev = gpsPointsRef.current;
          if (prev.length > 0) {
            const seg = haversineDistance(prev[prev.length - 1], newPt);
            setLiveDistance(d => {
              const total = d + seg;
              const elapsedS = (Date.now() - startTimeRef.current) / 1000;
              if (total > 0) setLivePace(Math.round(elapsedS / total));
              return total;
            });
          }
          gpsPointsRef.current.push(newPt);
          setUserLocation(newPt);
        },
        (err) => {
          if (err.code === 1) setGpsDenied(true);
          console.warn('GPS error:', err.message);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setGpsDenied(true);
    }
  };

  const handleStopRun = async () => {
    setIsTracking(false);
    clearInterval(timerRef.current);
    if (gpsWatchRef.current !== null) {
      navigator.geolocation.clearWatch(gpsWatchRef.current);
      gpsWatchRef.current = null;
    }
    if ('vibrate' in navigator) navigator.vibrate([200, 100, 200]);

    if (resolvedViewerId && liveDistance > 0.01) {
      try {
        const paceSeconds = liveDistance > 0 ? Math.round(liveTime / liveDistance) : 0;
        await supabase.from('athlete_runs').insert({
          user_id: resolvedViewerId,
          title: `Run · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
          discipline: 'running',
          distance_km: parseFloat(liveDistance.toFixed(3)),
          elapsed_seconds: liveTime,
          pace_per_km_seconds: paceSeconds,
          visibility: visibilityMode.toLowerCase(),
          challenge_mode: runMode.toLowerCase(),
          route_points: JSON.stringify(gpsPointsRef.current),
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error('Error saving run:', err);
      }
    }
  };

  const formatLiveTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
  return (
    <div className={`route-labs-pinnacle ${mode === 'athlete' ? 'athlete-mode' : 'gym-mode'}`}>
        <div className="pinnacle-loading">
          <div className="pinnacle-spinner"></div>
          <p>Initializing Route Labs...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="route-labs-pinnacle">
      {loadError && (
        <div className="route-labs-banner">{loadError}</div>
      )}
      {/* Header with premium branding */}
      <div className="pinnacle-header">
        <div className="pinnacle-branding">
          <div className="pinnacle-logo">
            <span className="pinnacle-icon">🗺️</span>
            <span className="pinnacle-title">Route Labs</span>
          </div>
          <div className="pinnacle-subtitle">Trail Forge Route Layer</div>
        </div>
        
        {/* Live tracking status */}
        <div className="pinnacle-live-status">
          {isTracking ? (
            <div className="live-indicator active">
              <div className="pulse-ring"></div>
              <span>TRACKING LIVE</span>
            </div>
          ) : (
            <div className="live-indicator">
              <span>READY TO RUN</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content grid */}
      <div className="pinnacle-grid">
        {/* Left panel - Map and controls */}
        <div className="pinnacle-left-panel">
          {/* Map area */}
          <div className="pinnacle-map-card">
            <div className="map-header">
              <h3>Live Map Surface</h3>
              <div className="map-controls">
                <button className="map-btn" onClick={() => {
                  if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(
                      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                      err => console.warn(err),
                      { enableHighAccuracy: true }
                    );
                  }
                }}>📍 Use My Location</button>
                <button className="map-btn">🗺️ Open Full Map</button>
              </div>
            </div>
            
            <div className="map-container">
              {hasGoogleMapsKey && points.length > 0 ? (
                <div ref={mapNodeRef} className="pinnacle-map-frame" aria-label="Interactive route map" />
              ) : (
                <iframe
                  title="Saved athlete run map"
                  src={mapSrc}
                  className="pinnacle-map-frame"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}
              
              {/* Map overlay for live tracking */}
              {isTracking && (
                <div className="live-tracking-overlay">
                  <div className="gps-indicator">
                    <div className="gps-dot"></div>
                    <span>GPS Acquired</span>
                  </div>
                  <div className="map-lock">Map locked</div>
                </div>
              )}
              {gpsDenied && (
                <div className="gps-denied-warning">
                  GPS access denied. Enable location permissions for live tracking.
                </div>
              )}
            </div>
            
            <div className="map-footer">
              <div className="map-meta">
                <span className="meta-tag">Lat {center.lat.toFixed(5)}</span>
                <span className="meta-tag">Lng {center.lng.toFixed(5)}</span>
                <span className="meta-tag">{userLocation ? `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : (run?.title ? run.title.slice(0, 20) : 'No location')}</span>
              </div>
              {!hasGoogleMapsKey && (
                <div className="map-warning">
                  Add REACT_APP_GOOGLE_MAPS_API_KEY to enable Google Maps.
                </div>
              )}
            </div>
          </div>

          {/* Route setup panel */}
          <div className="pinnacle-setup-card">
            <div className="setup-header">
              <h3>Route Setup</h3>
              <button 
                className="setup-toggle"
                onClick={() => setShowAdvancedSetup(!showAdvancedSetup)}
              >
                {showAdvancedSetup ? 'Hide' : 'Show'} Advanced Setup
              </button>
            </div>
            
            <div className="setup-grid">
              {/* Challenge distance */}
              <div className="setup-section">
                <label className="setup-label">Challenge Distance</label>
                <div className="distance-options">
                  {['1 km', '2 km', '5 km', '10 km'].map((distance) => (
                    <button
                      key={distance}
                      className={`distance-btn ${selectedDistance === distance ? 'active' : ''}`}
                      onClick={() => setSelectedDistance(distance)}
                    >
                      {distance}
                    </button>
                  ))}
                </div>
              </div>

              {/* Presence visibility */}
              <div className="setup-section">
                <label className="setup-label">Presence Visibility</label>
                <div className="visibility-options">
                  {['Private', 'Nearby', 'Regional'].map((mode) => (
                    <button
                      key={mode}
                      className={`visibility-btn ${visibilityMode === mode ? 'active' : ''}`}
                      onClick={() => setVisibilityMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              {/* Run mode */}
              <div className="setup-section">
                <label className="setup-label">Run Mode</label>
                <div className="mode-options">
                  {['Solo', 'Ghost'].map((mode) => (
                    <button
                      key={mode}
                      className={`mode-btn ${runMode === mode ? 'active' : ''}`}
                      onClick={() => setRunMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
                <div className="mode-hint">
                  Live challenges unlock after matchmaking is ready. For now, keep mapped efforts focused on solo or ghost sessions.
                </div>
              </div>

              {showAdvancedSetup && (
                <div className="advanced-setup">
                  <div className="advanced-option">
                    <label>Elevation Gain Target</label>
                    <input type="range" min="0" max="1000" value={elevationTarget} onChange={e => setElevationTarget(parseInt(e.target.value))} />
                    <span className="range-value">{elevationTarget}m</span>
                  </div>
                  <div className="advanced-option">
                    <label>Heart Rate Zone</label>
                    <select value={heartRateZone} onChange={e => setHeartRateZone(e.target.value)}>
                      <option value="zone1">Zone 1 - Recovery</option>
                      <option value="zone2">Zone 2 - Endurance</option>
                      <option value="zone3">Zone 3 - Tempo</option>
                      <option value="zone4">Zone 4 - Threshold</option>
                      <option value="zone5">Zone 5 - VO2 Max</option>
                    </select>
                  </div>
                  <div className="advanced-option">
                    <label>Weather Conditions</label>
                    <div className="weather-options">
                      <button className={`weather-btn ${weatherCondition === 'Clear' ? 'active' : ''}`} onClick={() => setWeatherCondition('Clear')}>Clear</button>
                      <button className={`weather-btn ${weatherCondition === 'Cloudy' ? 'active' : ''}`} onClick={() => setWeatherCondition('Cloudy')}>Cloudy</button>
                      <button className={`weather-btn ${weatherCondition === 'Rain' ? 'active' : ''}`} onClick={() => setWeatherCondition('Rain')}>Rain</button>
                      <button className={`weather-btn ${weatherCondition === 'Wind' ? 'active' : ''}`} onClick={() => setWeatherCondition('Wind')}>Wind</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="setup-footer">
              <span className="setup-note">
                Nearby visibility · Solo mode. Base route block linked to Training Ritual. Lead objective: Hills 6x60s.
              </span>
              <button className="preset-btn">Use Preset</button>
            </div>
          </div>
        </div>

        {/* Right panel - Stats and controls */}
        <div className="pinnacle-right-panel">
          {/* Live stats */}
          <div className="pinnacle-stats-card">
            <div className="stats-header">
              <h3>Run Output</h3>
              <div className="stats-actions">
                <button className="stats-btn">📊 View Analytics</button>
                <button className="stats-btn">📱 Share</button>
              </div>
            </div>

            <div className="live-stats-grid">
              <div className="stat-card time-card">
                <div className="stat-icon">⏱️</div>
                <div className="stat-value">{isTracking ? formatLiveTime(liveTime) : '00:00'}</div>
                <div className="stat-label">Time</div>
              </div>
              
              <div className="stat-card distance-card">
                <div className="stat-icon">📏</div>
                <div className="stat-value">{isTracking ? liveDistance.toFixed(2) : '0.00'} km</div>
                <div className="stat-label">Distance</div>
              </div>
              
              <div className="stat-card pace-card">
                <div className="stat-icon">🏃</div>
                <div className="stat-value">{formatPaceFromSecondsPerKm(livePace, { unit: distanceUnit, includeUnit: true })}</div>
                <div className="stat-label">Avg. Pace</div>
              </div>
            </div>

            <div className="stats-controls">
              {isTracking ? (
                <button className="stop-run-btn" onClick={handleStopRun}>
                  🛑 Stop Run
                </button>
              ) : (
                <button className="start-run-btn" onClick={handleStartRun}>
                  ▶️ Start Run
                </button>
              )}
              <div className="tracking-status">
                {isTracking ? 'Tracking live. Stop the run when the effort is complete.' : 'Ready to track your route.'}
              </div>
            </div>
          </div>

          {/* Performance insights */}
          <div className="pinnacle-insights-card">
            <div className="insights-header">
              <h3>Performance Insights</h3>
              <div className="insights-actions">
                <button className="insight-btn">📈 Trends</button>
                <button className="insight-btn">🎯 Goals</button>
              </div>
            </div>

            <div className="insights-grid">
              <div className="insight-item">
                <div className="insight-icon">🔥</div>
                <div className="insight-data">
                  <div className="insight-value">{Math.round(8 * 70 * (liveTime / 3600))} kcal</div>
                  <div className="insight-label">Calories Burned</div>
                </div>
              </div>

              <div className="insight-item">
                <div className="insight-icon">❤️</div>
                <div className="insight-data">
                  <div className="insight-value">N/A (no HR monitor)</div>
                  <div className="insight-label">Avg Heart Rate</div>
                </div>
              </div>

              <div className="insight-item">
                <div className="insight-icon">⚡</div>
                <div className="insight-data">
                  <div className="insight-value">{isTracking ? '⚡ Active' : (liveDistance > 0 ? 'Complete' : 'Ready')}</div>
                  <div className="insight-label">Effort Level</div>
                </div>
              </div>

              <div className="insight-item">
                <div className="insight-icon">🏆</div>
                <div className="insight-data">
                  <div className="insight-value">+{Math.round(liveDistance * 15)}</div>
                  <div className="insight-label">XP Gained</div>
                </div>
              </div>
            </div>
          </div>

          {/* Route details */}
          <div className="pinnacle-details-card">
            <div className="details-header">
              <h3>Route Details</h3>
              <div className="details-actions">
                <button className="detail-btn">🗺️ View Elevation</button>
                <button className="detail-btn">📊 Export Data</button>
              </div>
            </div>

            <div className="details-content">
              <div className="detail-row">
                <span className="detail-label">Route Name</span>
                <span className="detail-value">{run?.title || "Trail Forge Route"}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Discipline</span>
                <span className="detail-value">{String(run?.discipline || "running").toUpperCase()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Visibility</span>
                <span className="detail-value">{String(run?.visibility || "private").toUpperCase()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Mode</span>
                <span className="detail-value">{String(run?.challenge_mode || "solo").toUpperCase()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Elevation Gain</span>
                <span className="detail-value">120m</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Surface Type</span>
                <span className="detail-value">Mixed Trail</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with navigation */}
      <div className="pinnacle-footer">
        <div className="footer-actions">
          <button className="footer-btn" onClick={() => navigate(-1)}>
            ← Back to Training
          </button>
          <button className="footer-btn primary">
            🎯 View Plan Library
          </button>
          <button className="footer-btn">
            📱 Download GPX
          </button>
        </div>
      </div>
    </div>
  );
};

export default RouteLabsPinnacle;