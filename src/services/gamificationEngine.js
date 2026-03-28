// Gamification Engine for ExerVia Fitness
// Implements comprehensive gamification system with achievements, streaks, and rewards

export class GamificationEngine {
  constructor() {
    this.player = null;
    this.achievements = [];
    this.badges = [];
    this.rewards = [];
    this.challenges = [];
    this.leaderboards = {};
    
    this.eventListeners = new Map();
    this.observers = new Map();
    
    this.init();
  }

  init() {
    this.loadPlayerData();
    this.setupEventListeners();
    this.setupObservers();
    this.startBackgroundTasks();
  }

  // Player Management
  async loadPlayerData() {
    const playerId = this.getPlayerId();
    if (!playerId) return;

    try {
      const { supabase } = await import('../supabaseClient');
      
      // Load player profile
      const { data: player } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', playerId)
        .single();

      if (player) {
        this.player = {
          ...player,
          achievements: player.achievements || [],
          badges: player.badges || [],
          streak_days: player.streak_days || 0,
          xp: player.xp || 0,
          level: player.level || 1,
          rank: player.rank || 'E'
        };
      }

      // Load achievements
      const { data: achievements } = await supabase
        .from('achievements')
        .select('*')
        .eq('user_id', playerId);

      this.achievements = achievements || [];

      // Load badges
      const { data: badges } = await supabase
        .from('badges')
        .select('*')
        .eq('user_id', playerId);

      this.badges = badges || [];

    } catch (error) {
      console.error('Failed to load player data:', error);
    }
  }

  getPlayerId() {
    return localStorage.getItem('exervia_user_id') || 
           getStoredProfileId() ||
           (window.location.pathname.match(/\/(gym|athlete)\/([^/]+)/)?.[2]);
  }

  // Event System
  setupEventListeners() {
    // Training events
    window.addEventListener('training_completed', (event) => {
      this.handleTrainingEvent(event.detail);
    });

    // Strength PR events
    window.addEventListener('personal_record', (event) => {
      this.handlePREvent(event.detail);
    });

    // Streak events
    window.addEventListener('streak_updated', (event) => {
      this.handleStreakEvent(event.detail);
    });

    // Daily login events
    window.addEventListener('daily_login', () => {
      this.handleDailyLogin();
    });

    // Community events
    window.addEventListener('community_action', (event) => {
      this.handleCommunityEvent(event.detail);
    });
  }

  setupObservers() {
    // Observe user state changes
    const stateObserver = new MutationObserver(() => {
      this.checkAchievements();
      this.updateRank();
    });

    // Observe DOM for gamification triggers
    const domObserver = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          this.checkForGamificationTriggers(mutation.target);
        }
      });
    });

    this.observers.set('state', stateObserver);
    this.observers.set('dom', domObserver);
  }

  // Core Gamification Logic
  async handleTrainingEvent(trainingData) {
    // Award XP for training
    const xpAwarded = this.calculateTrainingXP(trainingData);
    await this.awardXP(xpAwarded);

    // Check for training streaks
    this.checkTrainingStreak();

    // Check for volume milestones
    this.checkVolumeMilestones(trainingData);

    // Trigger celebration if significant
    if (xpAwarded > 50) {
      this.triggerCelebration('training_complete', { xp: xpAwarded });
    }
  }

  async handlePREvent(prData) {
    // Award bonus XP for PRs
    const bonusXP = prData.effort_level > 7 ? 100 : 50;
    await this.awardXP(bonusXP);

    // Award PR achievement
    await this.awardAchievement('personal_record', {
      exercise: prData.exercise,
      weight: prData.weight,
      date: new Date().toISOString()
    });

    // Trigger celebration
    this.triggerCelebration('personal_record', {
      exercise: prData.exercise,
      weight: prData.weight
    });
  }

  handleStreakEvent(streakData) {
    // Award streak bonus
    if (streakData.days % 7 === 0) {
      this.awardXP(streakData.days * 10);
    }

    // Award streak badge
    if (streakData.days % 30 === 0) {
      this.awardBadge('streak_master', {
        days: streakData.days,
        title: `${streakData.days} Day Streak Master`
      });
    }
  }

  async handleDailyLogin() {
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = localStorage.getItem('exervia_last_login');

    if (lastLogin !== today) {
      localStorage.setItem('exervia_last_login', today);
      
      // Award daily login bonus
      await this.awardXP(10);

      // Check for consecutive login streak
      this.checkConsecutiveLoginStreak();
    }
  }

  handleCommunityEvent(action) {
    let xpBonus = 0;

    switch (action.type) {
      case 'post_created':
        xpBonus = 20;
        break;
      case 'comment_made':
        xpBonus = 10;
        break;
      case 'like_received':
        xpBonus = 5;
        break;
      case 'challenge_completed':
        xpBonus = 50;
        break;
    }

    if (xpBonus > 0) {
      this.awardXP(xpBonus);
    }
  }

  // Achievement System
  async awardAchievement(type, data) {
    const achievement = {
      type: type,
      data: data,
      awarded_at: new Date().toISOString(),
      user_id: this.player.id
    };

    this.achievements.push(achievement);

    // Update database
    try {
      const { supabase } = await import('../supabaseClient');
      await supabase.from('achievements').insert(achievement);
    } catch (error) {
      console.error('Failed to save achievement:', error);
    }

    // Trigger achievement notification
    this.triggerAchievementNotification(achievement);
  }

  checkAchievements() {
    const checks = [
      this.checkFirstLogin.bind(this),
      this.checkFirstTraining.bind(this),
      this.checkConsistency.bind(this),
      this.checkVolumeMilestones.bind(this),
      this.checkPRFrequency.bind(this),
      this.checkCommunityEngagement.bind(this)
    ];

    checks.forEach(check => {
      try {
        check();
      } catch (error) {
        console.error('Achievement check failed:', error);
      }
    });
  }

  async checkFirstLogin() {
    if (!this.player.first_login_awarded) {
      await this.awardAchievement('first_login', {
        date: new Date().toISOString()
      });
      
      // Update player flag
      this.player.first_login_awarded = true;
      await this.updatePlayerData();
    }
  }

  async checkFirstTraining() {
    // Check if this is the first training session
    // This would need to query the database for training_sessions count
  }

  checkConsistency() {
    // Check for consistent training patterns
    if (this.player.streak_days >= 7) {
      this.awardAchievement('consistent_trainer', {
        streak: this.player.streak_days
      });
    }
  }

  checkVolumeMilestones(trainingData) {
    // Check for training volume milestones
    const totalVolume = this.calculateTotalVolume();
    
    const milestones = [1000, 5000, 10000, 25000, 50000];
    milestones.forEach(milestone => {
      if (totalVolume >= milestone && !this.hasAchievement(`volume_${milestone}`)) {
        this.awardAchievement('volume_milestone', {
          milestone: milestone,
          volume: totalVolume
        });
      }
    });
  }

  checkPRFrequency() {
    // Check for frequent PRs
    const recentPRs = this.achievements.filter(a => 
      a.type === 'personal_record' && 
      new Date(a.awarded_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    );

    if (recentPRs.length >= 5) {
      this.awardAchievement('progress_champion', {
        pr_count: recentPRs.length,
        period: '7 days'
      });
    }
  }

  checkCommunityEngagement() {
    // Check for community engagement
    const communityActions = this.achievements.filter(a => 
      ['post_created', 'comment_made', 'like_received'].includes(a.type)
    );

    if (communityActions.length >= 10) {
      this.awardAchievement('community_builder', {
        actions: communityActions.length
      });
    }
  }

  // Badge System
  async awardBadge(type, data) {
    const badge = {
      type: type,
      data: data,
      awarded_at: new Date().toISOString(),
      user_id: this.player.id
    };

    this.badges.push(badge);

    // Update database
    try {
      const { supabase } = await import('../supabaseClient');
      await supabase.from('badges').insert(badge);
    } catch (error) {
      console.error('Failed to save badge:', error);
    }

    // Trigger badge notification
    this.triggerBadgeNotification(badge);
  }

  // XP and Level System
  async awardXP(amount) {
    this.player.xp += amount;
    const oldLevel = this.player.level;
    this.updateLevel();
    
    // Update database
    try {
      const { supabase } = await import('../supabaseClient');
      await supabase.from('user_profiles')
        .update({ xp: this.player.xp, level: this.player.level })
        .eq('id', this.player.id);
    } catch (error) {
      console.error('Failed to update XP:', error);
    }

    // Level up celebration
    if (this.player.level > oldLevel) {
      this.triggerLevelUp(this.player.level);
    }
  }

  updateLevel() {
    const xp = this.player.xp;
    const level = Math.floor(Math.sqrt(xp / 100)) + 1;
    this.player.level = level;
    this.updateRank();
  }

  updateRank() {
    const level = this.player.level;
    const xp = this.player.xp;
    
    let rank = 'E';
    
    if (xp >= 10000) rank = 'S';
    else if (xp >= 5000) rank = 'A';
    else if (xp >= 2000) rank = 'B';
    else if (xp >= 1000) rank = 'C';
    else if (xp >= 500) rank = 'D';

    this.player.rank = rank;
  }

  // Celebration System
  triggerCelebration(type, data) {
    // Trigger confetti
    this.triggerConfetti();

    // Show toast notification
    this.showNotification({
      type: 'celebration',
      message: this.getCelebrationMessage(type, data),
      duration: 5000
    });

    // Play sound effect
    this.playSoundEffect(type);

    // Trigger haptic feedback
    this.triggerHapticFeedback('success');
  }

  triggerConfetti() {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }

  getCelebrationMessage(type, data) {
    switch (type) {
      case 'training_complete':
        return `Great work! +${data.xp} XP earned`;
      case 'personal_record':
        return `New PR on ${data.exercise}! ${data.weight}kg`;
      case 'level_up':
        return `Level Up! You've reached level ${data.level}`;
      default:
        return 'Congratulations!';
    }
  }

  playSoundEffect(type) {
    // Simple Web Audio API sound effects
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    switch (type) {
      case 'training_complete':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioContext.currentTime + 0.5);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        break;
      case 'personal_record':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
        oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
        oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        break;
    }

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
  }

  triggerHapticFeedback(type) {
    if ('vibrate' in navigator) {
      switch (type) {
        case 'success':
          navigator.vibrate([50, 100, 50]);
          break;
        case 'level_up':
          navigator.vibrate([100, 50, 100, 50, 100]);
          break;
        case 'achievement':
          navigator.vibrate([50, 25, 50]);
          break;
      }
    }
  }

  // Notification System
  showNotification(notification) {
    // Create notification element
    const notificationEl = document.createElement('div');
    notificationEl.className = `gamification-notification gamification-notification-${notification.type}`;
    notificationEl.innerHTML = `
      <div class="notification-content">
        <span class="notification-message">${notification.message}</span>
      </div>
    `;

    // Add to DOM
    document.body.appendChild(notificationEl);

    // Auto-remove after duration
    setTimeout(() => {
      notificationEl.classList.add('fade-out');
      setTimeout(() => {
        document.body.removeChild(notificationEl);
      }, 300);
    }, notification.duration || 3000);
  }

  triggerAchievementNotification(achievement) {
    this.showNotification({
      type: 'achievement',
      message: `Achievement Unlocked: ${achievement.type}`,
      duration: 4000
    });
  }

  triggerBadgeNotification(badge) {
    this.showNotification({
      type: 'badge',
      message: `New Badge: ${badge.data.title || badge.type}`,
      duration: 4000
    });
  }

  triggerLevelUp(level) {
    this.showNotification({
      type: 'level_up',
      message: `Level Up! Welcome to level ${level}`,
      duration: 6000
    });
  }

  // Utility Methods
  calculateTrainingXP(trainingData) {
    const baseXP = 10;
    const durationXP = Math.floor(trainingData.duration / 10); // 1 XP per 10 minutes
    const effortXP = trainingData.effort_level * 5;
    
    return baseXP + durationXP + effortXP;
  }

  calculateTotalVolume() {
    // This would calculate total training volume from database
    // For now, return a placeholder
    return this.player.xp * 10;
  }

  hasAchievement(type) {
    return this.achievements.some(a => a.type === type);
  }

  async updatePlayerData() {
    try {
      const { supabase } = await import('../supabaseClient');
      await supabase.from('user_profiles')
        .update({
          achievements: this.player.achievements,
          badges: this.player.badges,
          streak_days: this.player.streak_days,
          xp: this.player.xp,
          level: this.player.level,
          rank: this.player.rank
        })
        .eq('id', this.player.id);
    } catch (error) {
      console.error('Failed to update player data:', error);
    }
  }

  startBackgroundTasks() {
    // Daily challenge refresh
    setInterval(() => {
      this.refreshDailyChallenges();
    }, 24 * 60 * 60 * 1000);

    // Weekly leaderboard update
    setInterval(() => {
      this.updateLeaderboards();
    }, 7 * 24 * 60 * 60 * 1000);

    // Streak check
    setInterval(() => {
      this.checkDailyStreak();
    }, 60 * 60 * 1000); // Every hour
  }

  refreshDailyChallenges() {
    // Generate new daily challenges
    const challenges = this.generateDailyChallenges();
    this.challenges = challenges;
  }

  generateDailyChallenges() {
    const challengeTypes = [
      { type: 'train_30_minutes', description: 'Train for 30+ minutes', reward: 25 },
      { type: 'log_3_exercises', description: 'Log 3 different exercises', reward: 20 },
      { type: 'hit_100_reps', description: 'Complete 100+ total reps', reward: 30 },
      { type: 'post_in_community', description: 'Post in community', reward: 15 },
      { type: 'log_nutrition', description: 'Log your meals', reward: 10 }
    ];

    return challengeTypes.slice(0, 3).map(challenge => ({
      ...challenge,
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      completed: false
    }));
  }

  updateLeaderboards() {
    // Update global and friend leaderboards
    // This would query the database for ranking data
  }

  checkDailyStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastActive = localStorage.getItem('exervia_last_active');
    
    if (lastActive && lastActive !== today) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (lastActive === yesterday) {
        this.player.streak_days += 1;
        localStorage.setItem('exervia_last_active', today);
        
        // Trigger streak notification
        if (this.player.streak_days % 7 === 0) {
          this.showNotification({
            type: 'streak',
            message: `Streak: ${this.player.streak_days} days! Keep it going!`,
            duration: 3000
          });
        }
      } else {
        this.player.streak_days = 1;
        localStorage.setItem('exervia_last_active', today);
      }
    } else if (!lastActive) {
      localStorage.setItem('exervia_last_active', today);
      this.player.streak_days = 1;
    }
  }

  checkConsecutiveLoginStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = localStorage.getItem('exervia_last_login');
    
    if (lastLogin) {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      if (lastLogin === yesterday) {
        const currentStreak = parseInt(localStorage.getItem('exervia_login_streak') || '0');
        localStorage.setItem('exervia_login_streak', (currentStreak + 1).toString());
      } else {
        localStorage.setItem('exervia_login_streak', '1');
      }
    }
  }

  // Cleanup
  destroy() {
    // Clear observers
    this.observers.forEach(observer => observer.disconnect());
    
    // Clear event listeners
    window.removeEventListener('training_completed', this.handleTrainingEvent);
    window.removeEventListener('personal_record', this.handlePREvent);
    window.removeEventListener('streak_updated', this.handleStreakEvent);
    window.removeEventListener('daily_login', this.handleDailyLogin);
    window.removeEventListener('community_action', this.handleCommunityEvent);
  }
}

// Export singleton instance
export const gamificationEngine = new GamificationEngine();

// Utility functions for components
export function triggerTrainingEvent(trainingData) {
  window.dispatchEvent(new CustomEvent('training_completed', { detail: trainingData }));
}

export function triggerPREvent(prData) {
  window.dispatchEvent(new CustomEvent('personal_record', { detail: prData }));
}

export function triggerStreakEvent(streakData) {
  window.dispatchEvent(new CustomEvent('streak_updated', { detail: streakData }));
}

export function triggerDailyLogin() {
  window.dispatchEvent(new CustomEvent('daily_login'));
}

export function triggerCommunityEvent(action) {
  window.dispatchEvent(new CustomEvent('community_action', { detail: action }));
}

export default gamificationEngine;