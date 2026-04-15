import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { format } from 'date-fns';
import { 
  Plus, 
  Droplet, 
  Scale, 
  Utensils, 
  Dumbbell, 
  Calendar, 
  TrendingUp, 
  Target, 
  Star, 
  Trophy,
  Sparkles,
  Zap,
  HeartPulse,
  Activity,
  TrendingDown
} from 'lucide-react';

const LogsPinnacle = ({ viewerId }) => {
  const { id } = useParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [logs, setLogs] = useState({});
  const [weight, setWeight] = useState('');
  const [water, setWater] = useState('');
  const [loading, setLoading] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [activityForm, setActivityForm] = useState({ name: '', duration: '', notes: '' });
  const [showMealForm, setShowMealForm] = useState(false);
  const [mealForm, setMealForm] = useState({ name: '', notes: '' });
  const [showSupplementForm, setShowSupplementForm] = useState(false);
  const [supplementForm, setSupplementForm] = useState({ name: '', dosage: '' });
  const [insights, setInsights] = useState([]);
  const [streaks, setStreaks] = useState({});
  const [goals] = useState({
    water: 2000,
    weight: 75,
    steps: 10000
  });

  const resolvedViewerId = Number(viewerId || id);

  // Load logs and data
  const loadLogs = useCallback(async () => {
    if (!resolvedViewerId) return;
    
    setLoading(true);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      
      // Load all log types
      const [weightRes, waterRes, mealsRes, supplementsRes, activitiesRes] = await Promise.all([
        supabase.from('athlete_weight_logs').select('*').eq('user_id', resolvedViewerId).eq('date', dateStr),
        supabase.from('athlete_water_logs').select('*').eq('user_id', resolvedViewerId).eq('date', dateStr),
        supabase.from('athlete_meal_logs').select('*').eq('user_id', resolvedViewerId).eq('date', dateStr),
        supabase.from('athlete_supplement_logs').select('*').eq('user_id', resolvedViewerId).eq('date', dateStr),
        supabase.from('athlete_activity_logs').select('*').eq('user_id', resolvedViewerId).eq('date', dateStr)
      ]);

      setLogs({
        weight: weightRes.data?.[0],
        water: waterRes.data?.[0],
        meals: mealsRes.data || [],
        supplements: supplementsRes.data || [],
        activities: activitiesRes.data || []
      });
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }, [resolvedViewerId, selectedDate]);

  const loadStreaks = useCallback(async () => {
    if (!resolvedViewerId) return;
    
    try {
      const { data } = await supabase
        .from('athlete_streaks')
        .select('*')
        .eq('user_id', resolvedViewerId);
      
      if (data) {
        const streakMap = {};
        data.forEach(streak => {
          streakMap[streak.type] = streak;
        });
        setStreaks(streakMap);
      }
    } catch (error) {
      console.error('Error loading streaks:', error);
    }
  }, [resolvedViewerId]);

  const generateInsights = useCallback(() => {
    const insightsList = [];
    
    // Weight trend insight
    if (logs.weight) {
      const weightDiff = parseFloat(weight) - parseFloat(logs.weight.weight_kg || 0);
      if (Math.abs(weightDiff) > 0.5) {
        insightsList.push({
          type: 'weight',
          message: `Weight changed by ${weightDiff > 0 ? '+' : ''}${weightDiff.toFixed(1)}kg`,
          icon: weightDiff > 0 ? TrendingUp : TrendingDown,
          color: weightDiff > 0 ? 'text-orange-500' : 'text-green-500'
        });
      }
    }

    // Hydration insight
    if (logs.water) {
      const hydrationLevel = (parseInt(water || logs.water.amount_ml) / goals.water) * 100;
      if (hydrationLevel < 80) {
        insightsList.push({
          type: 'hydration',
          message: 'Hydration below target - aim for 2000ml',
          icon: Droplet,
          color: 'text-blue-500'
        });
      } else if (hydrationLevel > 120) {
        insightsList.push({
          type: 'hydration',
          message: 'Excellent hydration! Keep it up',
          icon: Droplet,
          color: 'text-green-500'
        });
      }
    }

    // Activity insight
    if (logs.activities.length > 0) {
      insightsList.push({
        type: 'activity',
        message: `Active today with ${logs.activities.length} activities`,
        icon: Activity,
        color: 'text-purple-500'
      });
    }

    setInsights(insightsList);
  }, [goals.water, logs.activities, logs.water, logs.weight, water, weight]);

  // Load logs and data
  useEffect(() => {
    loadLogs();
    loadStreaks();
  }, [loadLogs, loadStreaks]);

  // Generate insights after logs have loaded
  useEffect(() => {
    if (!loading) generateInsights();
  }, [generateInsights, loading]);

  const saveLog = async (type, data) => {
    if (!resolvedViewerId) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const logData = { ...data, user_id: resolvedViewerId, date: dateStr };

    try {
      if (type === 'weight') {
        const { data: existing } = await supabase
          .from('athlete_weight_logs')
          .select('id')
          .eq('user_id', resolvedViewerId)
          .eq('date', dateStr)
          .single();

        if (existing) {
          await supabase.from('athlete_weight_logs').update(logData).eq('id', existing.id);
        } else {
          await supabase.from('athlete_weight_logs').insert(logData);
        }
      } else if (type === 'water') {
        const { data: existing } = await supabase
          .from('athlete_water_logs')
          .select('id')
          .eq('user_id', resolvedViewerId)
          .eq('date', dateStr)
          .single();

        if (existing) {
          await supabase.from('athlete_water_logs').update(logData).eq('id', existing.id);
        } else {
          await supabase.from('athlete_water_logs').insert(logData);
        }
      }
      
      loadLogs();
    } catch (error) {
      console.error('Error saving log:', error);
    }
  };

  const addMeal = async (meal) => {
    if (!resolvedViewerId) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const mealData = { ...meal, user_id: resolvedViewerId, date: dateStr };

    try {
      await supabase.from('athlete_meal_logs').insert(mealData);
      loadLogs();
    } catch (error) {
      console.error('Error adding meal:', error);
    }
  };

  const addSupplement = async (supplement) => {
    if (!resolvedViewerId) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const supplementData = { ...supplement, user_id: resolvedViewerId, date: dateStr };

    try {
      await supabase.from('athlete_supplement_logs').insert(supplementData);
      loadLogs();
    } catch (error) {
      console.error('Error adding supplement:', error);
    }
  };

  const addActivity = async (activity) => {
    if (!resolvedViewerId) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const activityData = { ...activity, user_id: resolvedViewerId, date: dateStr };

    try {
      await supabase.from('athlete_activity_logs').insert(activityData);
      loadLogs();
    } catch (error) {
      console.error('Error adding activity:', error);
    }
  };

  const deleteLog = async (type, id) => {
    if (!resolvedViewerId) return;

    try {
      await supabase.from(`athlete_${type}_logs`).delete().eq('id', id);
      loadLogs();
    } catch (error) {
      console.error('Error deleting log:', error);
    }
  };

  // Calculate progress percentages
  const weightProgress = logs.weight ? ((parseFloat(logs.weight.weight_kg) / goals.weight) * 100) : 0;
  const waterProgress = logs.water ? ((parseInt(logs.water.amount_ml) / goals.water) * 100) : 0;

  const quickMealOptions = [
    'Chicken + Rice',
    'Beef Protein Quesadilla', 
    'Chicken Ham and Leek Pie',
    'Beef Lettuce Cup Snack',
    'Cheese Wrap',
    'Steak Cheese Wrap'
  ];

  const quickSupplementOptions = [
    'Creatine',
    'Vitamin D3',
    'Omega-3',
    'Magnesium',
    'Protein Powder',
    'Electrolytes'
  ];

  return (
    <div className="logs-pinnacle">
      {/* Header with premium branding */}
      <div className="pinnacle-logs-header">
        <div className="header-content">
          <div className="header-branding">
            <div className="brand-icon">
              <Sparkles className="w-8 h-8 text-orange-400" />
            </div>
            <div className="brand-text">
              <h1 className="brand-title">Daily Command Center</h1>
              <p className="brand-subtitle">Body • Fuel • Hydration • Training</p>
            </div>
          </div>
          
          <div className="header-actions">
            <button 
              className="quick-add-btn"
              onClick={() => setShowQuickAdd(!showQuickAdd)}
            >
              <Plus className="w-4 h-4" />
              Quick Add
            </button>
            <button className="insights-btn">
              <Target className="w-4 h-4" />
              AI Insights
            </button>
          </div>
        </div>

        {/* Date Navigation */}
        <div className="date-navigation">
          <button className="nav-btn" onClick={() => setSelectedDate(new Date())}>
            Today
          </button>
          <div className="date-selector">
            <Calendar className="w-4 h-4 text-orange-400" />
            <span>{format(selectedDate, 'EEEE, MMM d, yyyy')}</span>
          </div>
          <div className="streak-display">
            <div className="streak-item">
              <Star className="w-4 h-4 text-yellow-400" />
              <span>{streaks.weight?.current_streak || 0}d</span>
              <span className="streak-label">Weight</span>
            </div>
            <div className="streak-item">
              <Droplet className="w-4 h-4 text-blue-400" />
              <span>{streaks.water?.current_streak || 0}d</span>
              <span className="streak-label">Water</span>
            </div>
            <div className="streak-item">
              <Activity className="w-4 h-4 text-purple-400" />
              <span>{streaks.activity?.current_streak || 0}d</span>
              <span className="streak-label">Activity</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Panel */}
      {showQuickAdd && (
        <div className="quick-add-panel">
          <div className="quick-add-grid">
            <div className="quick-add-section">
              <h3>Quick Meals</h3>
              <div className="quick-options">
                {quickMealOptions.map((meal, index) => (
                  <button 
                    key={index}
                    className="quick-option"
                    onClick={() => addMeal({ meal_name: meal, notes: '' })}
                  >
                    <Utensils className="w-4 h-4" />
                    {meal}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="quick-add-section">
              <h3>Quick Supplements</h3>
              <div className="quick-options">
                {quickSupplementOptions.map((supplement, index) => (
                  <button 
                    key={index}
                    className="quick-option"
                    onClick={() => addSupplement({ supplement_name: supplement, dosage: '' })}
                  >
                    <Zap className="w-4 h-4" />
                    {supplement}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="logs-grid">
        {/* Left Column - Core Metrics */}
        <div className="left-column">
          {/* Weight Card */}
          <div className="metric-card weight-card">
            <div className="card-header">
              <div className="metric-icon">
                <Scale className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <h3>Weight</h3>
                <p>Last logged: {logs.weight?.weight_kg || 'Not logged'}</p>
              </div>
            </div>
            
            <div className="metric-content">
              <div className="progress-ring">
                <svg viewBox="0 0 36 36" className="progress-svg">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="#f97316"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${weightProgress}, 100`}
                    className="progress-path"
                  />
                </svg>
                <div className="progress-value">
                  <span className="value">{logs.weight?.weight_kg || '0'}</span>
                  <span className="unit">kg</span>
                </div>
              </div>
              
              <div className="metric-input">
                <input
                  type="number"
                  placeholder="Enter weight"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="metric-input-field"
                />
                <button 
                  onClick={() => saveLog('weight', { weight_kg: weight })}
                  className="save-btn"
                >
                  Save
                </button>
              </div>
            </div>
          </div>

          {/* Water Card */}
          <div className="metric-card water-card">
            <div className="card-header">
              <div className="metric-icon">
                <Droplet className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <h3>Hydration</h3>
                <p>Target: {goals.water}ml daily</p>
              </div>
            </div>
            
            <div className="metric-content">
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${Math.min(waterProgress, 100)}%` }}
                ></div>
                <div className="progress-label">
                  {logs.water?.amount_ml || '0'} / {goals.water}ml
                </div>
              </div>
              
              <div className="metric-input">
                <input
                  type="number"
                  placeholder="e.g. 2500"
                  value={water}
                  onChange={(e) => setWater(e.target.value)}
                  className="metric-input-field"
                />
                <button 
                  onClick={() => saveLog('water', { amount_ml: water })}
                  className="save-btn"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Activities & Insights */}
        <div className="right-column">
          {/* Today's Training */}
          <div className="activities-card">
            <div className="card-header">
              <div className="metric-icon">
                <Dumbbell className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <h3>Today's Training</h3>
                <p>{logs.activities.length} activities logged</p>
              </div>
            </div>
            
            <div className="activities-list">
              {logs.activities.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-details">
                    <span className="activity-name">{activity.activity_name}</span>
                    <span className="activity-duration">{activity.duration_minutes} min</span>
                  </div>
                  <button 
                    onClick={() => deleteLog('activity', activity.id)}
                    className="remove-btn"
                  >
                    Remove
                  </button>
                </div>
              ))}
              
              <div className="add-activity-form">
                <input
                  type="text"
                  placeholder="Activity name"
                  className="activity-input"
                  value={activityForm.name}
                  onChange={(e) => setActivityForm({ ...activityForm, name: e.target.value })}
                />
                <input
                  type="number"
                  placeholder="Minutes"
                  className="activity-input"
                  value={activityForm.duration}
                  onChange={(e) => setActivityForm({ ...activityForm, duration: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  className="activity-input"
                  value={activityForm.notes}
                  onChange={(e) => setActivityForm({ ...activityForm, notes: e.target.value })}
                />
                <button
                  className="add-activity-btn"
                  onClick={() => {
                    if (!activityForm.name.trim() || !activityForm.duration.trim()) return;
                    addActivity({ activity_name: activityForm.name, duration_minutes: activityForm.duration, notes: activityForm.notes });
                    setActivityForm({ name: '', duration: '', notes: '' });
                  }}
                >
                  Log Activity
                </button>
              </div>
            </div>
          </div>

          {/* AI Insights */}
          <div className="insights-card">
            <div className="card-header">
              <div className="metric-icon">
                <HeartPulse className="w-6 h-6" />
              </div>
              <div className="metric-info">
                <h3>AI Insights</h3>
                <p>Personalized recommendations</p>
              </div>
            </div>
            
            <div className="insights-list">
              {insights.map((insight, index) => (
                <div key={index} className="insight-item">
                  <insight.icon className={`insight-icon ${insight.color}`} />
                  <span className="insight-message">{insight.message}</span>
                </div>
              ))}
              
              {insights.length === 0 && (
                <div className="insight-item">
                  <Sparkles className="insight-icon text-green-500" />
                  <span className="insight-message">Great day! Keep up the consistency.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section - Detailed Logs */}
      <div className="detailed-logs">
        {/* Meals */}
        <div className="log-section meals-section">
          <div className="section-header">
            <h3>Meals</h3>
            <button className="add-meal-btn" onClick={() => setShowMealForm(!showMealForm)}>+ Add Meal</button>
          </div>
          {showMealForm && (
            <div className="inline-add-form">
              <input
                type="text"
                placeholder="Meal name"
                className="activity-input"
                value={mealForm.name}
                onChange={(e) => setMealForm({ ...mealForm, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                className="activity-input"
                value={mealForm.notes}
                onChange={(e) => setMealForm({ ...mealForm, notes: e.target.value })}
              />
              <button
                className="add-activity-btn"
                onClick={() => {
                  if (!mealForm.name.trim()) return;
                  addMeal({ meal_name: mealForm.name, notes: mealForm.notes });
                  setMealForm({ name: '', notes: '' });
                  setShowMealForm(false);
                }}
              >
                Add
              </button>
            </div>
          )}
          <div className="meals-grid">
            {logs.meals?.length === 0 && (
              <div className="empty-state-msg">No meals logged today. Use Quick Add or + Add Meal below.</div>
            )}
            {logs.meals.map((meal, index) => (
              <div key={index} className="meal-card">
                <div className="meal-content">
                  <span className="meal-name">{meal.meal_name}</span>
                  <span className="meal-notes">{meal.notes || 'No notes'}</span>
                </div>
                <button
                  onClick={() => deleteLog('meal', meal.id)}
                  className="remove-meal-btn"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Supplements */}
        <div className="log-section supplements-section">
          <div className="section-header">
            <h3>Supplements</h3>
            <button className="add-supplement-btn" onClick={() => setShowSupplementForm(!showSupplementForm)}>+ Add Supplement</button>
          </div>
          {showSupplementForm && (
            <div className="inline-add-form">
              <input
                type="text"
                placeholder="Supplement name"
                className="activity-input"
                value={supplementForm.name}
                onChange={(e) => setSupplementForm({ ...supplementForm, name: e.target.value })}
              />
              <input
                type="text"
                placeholder="Dosage (optional)"
                className="activity-input"
                value={supplementForm.dosage}
                onChange={(e) => setSupplementForm({ ...supplementForm, dosage: e.target.value })}
              />
              <button
                className="add-activity-btn"
                onClick={() => {
                  if (!supplementForm.name.trim()) return;
                  addSupplement({ supplement_name: supplementForm.name, dosage: supplementForm.dosage });
                  setSupplementForm({ name: '', dosage: '' });
                  setShowSupplementForm(false);
                }}
              >
                Add
              </button>
            </div>
          )}
          <div className="supplements-grid">
            {logs.supplements?.length === 0 && (
              <div className="empty-state-msg">No supplements logged today. Use Quick Add or + Add Supplement below.</div>
            )}
            {logs.supplements.map((supplement, index) => (
              <div key={index} className="supplement-card">
                <div className="supplement-content">
                  <span className="supplement-name">{supplement.supplement_name}</span>
                  <span className="supplement-dosage">{supplement.dosage || 'No dosage'}</span>
                </div>
                <button
                  onClick={() => deleteLog('supplement', supplement.id)}
                  className="remove-supplement-btn"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="logs-footer">
        <div className="footer-stats">
          <div className="stat-item">
            <Trophy className="stat-icon text-yellow-400" />
            <div>
              <span className="stat-value">{streaks.overall?.current_streak || 0}</span>
              <span className="stat-label">Overall Streak</span>
            </div>
          </div>
          <div className="stat-item">
            <Target className="stat-icon text-green-400" />
            <div>
              <span className="stat-value">{Math.round((Object.keys(logs).filter(k => logs[k]).length / 5) * 100)}%</span>
              <span className="stat-label">Daily Completion</span>
            </div>
          </div>
          <div className="stat-item">
            <Activity className="stat-icon text-purple-400" />
            <div>
              <span className="stat-value">{logs.activities.length}</span>
              <span className="stat-label">Activities</span>
            </div>
          </div>
        </div>
        
        <div className="footer-actions">
          <button className="export-btn">Export Data</button>
          <button className="sync-btn">Sync Health Data</button>
        </div>
      </div>
    </div>
  );
};

export default LogsPinnacle;
