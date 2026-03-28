import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import '../components/AnalyticsDashboard.css';
import { supabase } from '../supabaseClient';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

const AnalyticsDashboard = ({ userId, mode = 'gym' }) => {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d, 1y
  const [selectedMetric, setSelectedMetric] = useState('strength');

  const getSinceDate = (range) => {
    const now = new Date();
    switch (range) {
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      case '90d': return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      case '1y': return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  };

  const fetchAnalyticsData = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const sinceDate = getSinceDate(timeRange);
      
      // Fetch strength data
      const strengthQuery = supabase
        .from('strength_logs')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: true });

      // Fetch training data
      const trainingQuery = supabase
        .from('training_sessions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', sinceDate)
        .order('created_at', { ascending: true });

      // Fetch daily activity
      const activityQuery = supabase
        .from('daily_activity')
        .select('*')
        .eq('user_id', userId)
        .gte('activity_date', sinceDate.toISOString().split('T')[0])
        .order('activity_date', { ascending: true });

      const [strengthRes, trainingRes, activityRes] = await Promise.all([
        strengthQuery,
        trainingQuery,
        activityQuery
      ]);

      const analytics = {
        strength: strengthRes.data || [],
        training: trainingRes.data || [],
        activity: activityRes.data || []
      };

      setData(analytics);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  }, [userId, timeRange]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Chart configurations
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#94a3b8',
          font: { size: 12 }
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: '#334155',
        borderWidth: 1,
        titleColor: '#e2e8f0',
        bodyColor: '#cbd5e1'
      }
    },
    scales: {
      x: {
        grid: { color: '#1e293b' },
        ticks: { color: '#94a3b8' }
      },
      y: {
        grid: { color: '#1e293b' },
        ticks: { color: '#94a3b8' }
      }
    }
  };

  // Strength Progression Chart
  const strengthChartData = useMemo(() => {
    const strengthData = data.strength || [];
    const groupedByExercise = groupBy(strengthData, 'exercise');
    
    return Object.keys(groupedByExercise).map(exercise => ({
      label: exercise,
      data: groupedByExercise[exercise].map(log => ({
        x: new Date(log.created_at),
        y: log.weight
      })),
      borderColor: getColorForExercise(exercise),
      backgroundColor: getColorForExercise(exercise, 0.1),
      tension: 0.4
    }));
  }, [data.strength]);

  // Training Volume Chart
  const volumeChartData = useMemo(() => {
    const dailyVolume = calculateDailyVolume(data.training || []);
    
    return {
      labels: Object.keys(dailyVolume),
      datasets: [{
        label: 'Daily Training Volume',
        data: Object.values(dailyVolume),
        borderColor: '#22c55e',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4
      }]
    };
  }, [data.training]);

  // Recovery vs Performance Chart
  const recoveryChartData = useMemo(() => {
    const strengthData = data.strength || [];
    
    const recoveryData = strengthData.map(log => ({
      x: log.effort_level || 0,
      y: log.weight || 0,
      date: log.created_at
    }));

    return {
      datasets: [{
        label: 'Effort vs Performance',
        data: recoveryData,
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: '#3b82f6',
        pointRadius: 4
      }]
    };
  }, [data.strength]);

  // Performance Insights
  const insights = useMemo(() => {
    const strengthData = data.strength || [];
    const trainingData = data.training || [];
    
    const totalLifts = strengthData.length;
    const totalVolume = calculateTotalVolume(trainingData);
    const avgEffort = trainingData.reduce((sum, session) => sum + (session.effort_level || 0), 0) / Math.max(trainingData.length, 1);
    
    // Calculate PRs
    const prs = strengthData.filter(log => log.is_personal_best).length;
    
    // Calculate trends
    const recentStrength = strengthData.slice(-10);
    const strengthTrend = calculateTrend(recentStrength.map(s => s.weight));
    
    return {
      totalLifts,
      totalVolume,
      avgEffort: Math.round(avgEffort * 10) / 10,
      prs,
      strengthTrend: strengthTrend > 0 ? 'improving' : strengthTrend < 0 ? 'declining' : 'stable',
      trendValue: Math.abs(strengthTrend)
    };
  }, [data.strength, data.training]);

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="analytics-spinner">
          <div className="spinner-ring"></div>
          <p>Crunching your numbers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="analytics-header">
        <div className="analytics-title-section">
          <h2 className="analytics-title">Performance Analytics</h2>
          <p className="analytics-subtitle">Data-driven insights for optimal progress</p>
        </div>
        
        <div className="analytics-controls">
          <div className="analytics-time-range">
            <label htmlFor="timeRange">Time Range:</label>
            <select 
              id="timeRange"
              value={timeRange} 
              onChange={(e) => setTimeRange(e.target.value)}
              className="analytics-select"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
          </div>
          
          <div className="analytics-metric-selector">
            <label htmlFor="metric">Metric:</label>
            <select 
              id="metric"
              value={selectedMetric} 
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="analytics-select"
            >
              <option value="strength">Strength</option>
              <option value="endurance">Endurance</option>
              <option value="recovery">Recovery</option>
            </select>
          </div>
        </div>
      </div>

      {/* Insights Cards */}
      <div className="analytics-insights-grid">
        <div className="insight-card">
          <div className="insight-icon">🏋️</div>
          <div className="insight-content">
            <h3>{insights.totalLifts}</h3>
            <p>Total Lifts</p>
          </div>
        </div>
        
        <div className="insight-card">
          <div className="insight-icon">📈</div>
          <div className="insight-content">
            <h3>{insights.prs}</h3>
            <p>Personal Records</p>
          </div>
        </div>
        
        <div className="insight-card">
          <div className="insight-icon">⚡</div>
          <div className="insight-content">
            <h3>{insights.avgEffort}</h3>
            <p>Avg Effort Level</p>
          </div>
        </div>
        
        <div className="insight-card">
          <div className="insight-icon">📊</div>
          <div className="insight-content">
            <h3>{insights.strengthTrend}</h3>
            <p>Strength Trend</p>
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="analytics-charts-grid">
        {/* Strength Progression */}
        <div className="chart-card">
          <h3>Strength Progression</h3>
          <div className="chart-container">
            <Line
              data={{
                datasets: strengthChartData
              }}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  x: {
                    ...chartOptions.scales.x,
                    type: 'time',
                    time: {
                      unit: timeRange === '7d' ? 'day' : timeRange === '30d' ? 'day' : 'week'
                    }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Training Volume */}
        <div className="chart-card">
          <h3>Training Volume</h3>
          <div className="chart-container">
            <Bar
              data={volumeChartData}
              options={chartOptions}
            />
          </div>
        </div>

        {/* Recovery vs Performance */}
        <div className="chart-card">
          <h3>Recovery vs Performance</h3>
          <div className="chart-container">
            <Line
              data={recoveryChartData}
              options={{
                ...chartOptions,
                scales: {
                  ...chartOptions.scales,
                  x: {
                    ...chartOptions.scales.x,
                    title: { display: true, text: 'Effort Level', color: '#94a3b8' }
                  },
                  y: {
                    ...chartOptions.scales.y,
                    title: { display: true, text: 'Performance (kg)', color: '#94a3b8' }
                  }
                }
              }}
            />
          </div>
        </div>

        {/* Performance Distribution */}
        <div className="chart-card">
          <h3>Performance Distribution</h3>
          <div className="chart-container">
            <Doughnut
              data={{
                labels: ['High Performance', 'Moderate', 'Low Performance'],
                datasets: [{
                  data: [40, 35, 25],
                  backgroundColor: ['#22c55e', '#f59e0b', '#ef4444'],
                  borderWidth: 0
                }]
              }}
              options={{
                ...chartOptions,
                cutout: '60%'
              }}
            />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="analytics-recommendations">
        <h3>AI-Powered Recommendations</h3>
        <div className="recommendations-grid">
          {generateRecommendations(insights, data).map((rec, index) => (
            <div key={index} className="recommendation-card">
              <div className="rec-icon">{rec.icon}</div>
              <div className="rec-content">
                <h4>{rec.title}</h4>
                <p>{rec.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Helper functions
function groupBy(array, key) {
  return array.reduce((groups, item) => {
    const group = (groups[item[key]] || []);
    group.push(item);
    groups[item[key]] = group;
    return groups;
  }, {});
}

function getColorForExercise(exercise, alpha = 1) {
  const colors = {
    'Squat': `rgba(34, 197, 94, ${alpha})`,
    'Bench Press': `rgba(59, 130, 246, ${alpha})`,
    'Deadlift': `rgba(234, 179, 8, ${alpha})`,
    'Overhead Press': `rgba(168, 85, 247, ${alpha})`,
    'Pull Up': `rgba(239, 68, 68, ${alpha})`
  };
  return colors[exercise] || `rgba(${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${Math.floor(Math.random() * 255)}, ${alpha})`;
}

function calculateDailyVolume(trainingData) {
  const dailyVolume = {};
  trainingData.forEach(session => {
    const date = new Date(session.created_at).toISOString().split('T')[0];
    const volume = (session.duration || 0) * (session.effort_level || 0);
    dailyVolume[date] = (dailyVolume[date] || 0) + volume;
  });
  return dailyVolume;
}

function calculateTotalVolume(trainingData) {
  return trainingData.reduce((total, session) => {
    return total + ((session.duration || 0) * (session.effort_level || 0));
  }, 0);
}

function calculateTrend(values) {
  if (values.length < 2) return 0;
  const n = values.length;
  const sumX = (n * (n - 1)) / 2;
  const sumY = values.reduce((a, b) => a + b, 0);
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
  
  return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
}

function generateRecommendations(insights, data) {
  const recommendations = [];
  
  if (insights.strengthTrend === 'declining') {
    recommendations.push({
      icon: '⚠️',
      title: 'Strength Plateau Detected',
      description: 'Consider deloading week or adjusting training volume. Focus on technique over weight.'
    });
  }
  
  if (insights.avgEffort > 7) {
    recommendations.push({
      icon: '🔥',
      title: 'High Training Load',
      description: 'Your effort levels are consistently high. Ensure adequate recovery and nutrition.'
    });
  }
  
  if (insights.prs === 0 && insights.totalLifts > 20) {
    recommendations.push({
      icon: '🎯',
      title: 'Time for New Challenges',
      description: 'No PRs recently. Try new exercises or rep ranges to stimulate growth.'
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      icon: '✅',
      title: 'On Track',
      description: 'Your training metrics look good. Keep consistency and monitor progress.'
    });
  }
  
  return recommendations;
}

export default AnalyticsDashboard;