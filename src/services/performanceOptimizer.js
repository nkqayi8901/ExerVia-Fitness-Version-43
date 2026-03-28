// Performance Optimization Service for ExerVia Fitness
// Implements advanced performance optimizations for pinnacle-level user experience

export class PerformanceOptimizer {
  constructor() {
    this.metrics = {
      renderTime: [],
      loadTime: [],
      memoryUsage: [],
      fps: []
    };
    
    this.observers = {
      intersection: null,
      resize: null,
      visibility: null
    };
    
    this.cache = new Map();
    this.lazyComponents = new Map();
    this.virtualizationCache = new Map();
    
    this.init();
  }

  init() {
    this.setupPerformanceMonitoring();
    this.setupIntersectionObserver();
    this.setupResizeObserver();
    this.setupVisibilityObserver();
    this.setupMemoryManagement();
    this.setupCodeSplitting();
  }

  // Performance Monitoring
  setupPerformanceMonitoring() {
    // Monitor render performance
    if ('PerformanceObserver' in window) {
      const renderObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'paint') {
            this.metrics.renderTime.push({
              type: entry.name,
              duration: entry.startTime,
              timestamp: Date.now()
            });
          }
        }
      });
      
      try {
        renderObserver.observe({ entryTypes: ['paint', 'largest-contentful-paint'] });
      } catch (e) {
        // Fallback for older browsers
      }
    }

    // Monitor resource loading
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0];
      this.metrics.loadTime.push({
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        totalLoad: navigation.loadEventEnd - navigation.fetchStart,
        timestamp: Date.now()
      });
    });
  }

  // Intersection Observer for lazy loading
  setupIntersectionObserver() {
    if ('IntersectionObserver' in window) {
      this.observers.intersection = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.handleIntersection(entry.target);
              this.observers.intersection.unobserve(entry.target);
            }
          });
        },
        {
          root: null,
          rootMargin: '50px',
          threshold: 0.01
        }
      );
    }
  }

  handleIntersection(element) {
    const lazyId = element.dataset.lazyId;
    if (lazyId && this.lazyComponents.has(lazyId)) {
      const component = this.lazyComponents.get(lazyId);
      component.load();
      this.lazyComponents.delete(lazyId);
    }
  }

  // Resize Observer for responsive optimizations
  setupResizeObserver() {
    if ('ResizeObserver' in window) {
      this.observers.resize = new ResizeObserver((entries) => {
        for (const entry of entries) {
          this.handleResize(entry.target, entry.contentRect);
        }
      });
    }
  }

  handleResize(element, rect) {
    // Implement responsive optimizations based on element size
    const width = rect.width;
    const height = rect.height;
    
    // Optimize chart rendering based on container size
    if (element.classList.contains('chart-container')) {
      this.optimizeChartRendering(element, width, height);
    }
    
    // Optimize list rendering
    if (element.classList.contains('virtualized-list')) {
      this.optimizeVirtualization(element, width, height);
    }
  }

  // Visibility API for background optimizations
  setupVisibilityObserver() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleVisibilityChange(false);
      } else {
        this.handleVisibilityChange(true);
      }
    });
  }

  handleVisibilityChange(isVisible) {
    if (!isVisible) {
      // Reduce performance when tab is hidden
      this.reduceBackgroundPerformance();
    } else {
      // Restore performance when tab becomes visible
      this.restoreForegroundPerformance();
    }
  }

  // Memory Management
  setupMemoryManagement() {
    // Set up periodic memory cleanup
    setInterval(() => {
      this.performMemoryCleanup();
    }, 30000); // Every 30 seconds

    // Monitor memory usage
    if ('memory' in performance) {
      setInterval(() => {
        this.metrics.memoryUsage.push({
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
          timestamp: Date.now()
        });
      }, 10000);
    }
  }

  performMemoryCleanup() {
    // Clear old cache entries
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > 300000) { // 5 minutes
        this.cache.delete(key);
      }
    }

    // Clear virtualization cache for off-screen items
    for (const [key, value] of this.virtualizationCache.entries()) {
      if (!value.isVisible) {
        this.virtualizationCache.delete(key);
      }
    }
  }

  // Code Splitting and Lazy Loading
  setupCodeSplitting() {
    // Register components for lazy loading
    this.registerLazyComponent('analytics-dashboard', () => 
      import('./../components/AnalyticsDashboard')
    );
    
    this.registerLazyComponent('chart-components', () => 
      import('react-chartjs-2')
    );
    
    this.registerLazyComponent('community-hub', () => 
      import('./../components/CommunityHub')
    );
  }

  registerLazyComponent(id, loader) {
    this.lazyComponents.set(id, {
      load: async () => {
        try {
          const module = await loader();
          return module.default || module;
        } catch (error) {
          console.error(`Failed to load component ${id}:`, error);
          return null;
        }
      },
      isLoaded: false
    });
  }

  // Chart Optimization
  optimizeChartRendering(container, width, height) {
    // Reduce chart detail for small containers
    const detailLevel = width < 400 ? 'low' : width < 800 ? 'medium' : 'high';
    
    const chart = container.querySelector('canvas');
    if (chart && chart.chart) {
      const config = chart.chart.config;
      
      switch (detailLevel) {
        case 'low':
          config.options.animation.duration = 0;
          config.options.elements.point.radius = 0;
          break;
        case 'medium':
          config.options.animation.duration = 200;
          config.options.elements.point.radius = 2;
          break;
        default:
          config.options.animation.duration = 500;
          config.options.elements.point.radius = 4;
      }
      
      chart.chart.update('none');
    }
  }

  // Virtualization Optimization
  optimizeVirtualization(container, width, height) {
    const itemHeight = 60; // Estimated item height
    const visibleItems = Math.ceil(height / itemHeight);
    const bufferSize = Math.min(5, visibleItems);
    
    // Update virtualization parameters
    container.dataset.visibleItems = visibleItems;
    container.dataset.bufferSize = bufferSize;
  }

  // Background Performance Reduction
  reduceBackgroundPerformance() {
    // Pause animations
    document.querySelectorAll('.chart-container canvas').forEach(canvas => {
      if (canvas.chart) {
        canvas.chart.options.animation.duration = 0;
        canvas.chart.update('none');
      }
    });

    // Reduce update frequency
    this.backgroundUpdateInterval = setInterval(() => {
      this.updateBackgroundMetrics();
    }, 5000);

    // Pause non-essential network requests
    this.pauseNonEssentialRequests();
  }

  // Foreground Performance Restoration
  restoreForegroundPerformance() {
    if (this.backgroundUpdateInterval) {
      clearInterval(this.backgroundUpdateInterval);
      this.backgroundUpdateInterval = null;
    }

    // Resume animations
    document.querySelectorAll('.chart-container canvas').forEach(canvas => {
      if (canvas.chart) {
        canvas.chart.options.animation.duration = 500;
        canvas.chart.update();
      }
    });

    // Resume network requests
    this.resumeNonEssentialRequests();
  }

  updateBackgroundMetrics() {
    // Update only essential metrics in background
    const memory = performance.memory;
    if (memory) {
      this.metrics.memoryUsage.push({
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        timestamp: Date.now()
      });
    }
  }

  pauseNonEssentialRequests() {
    // Implement request queuing for non-essential operations
    this.requestQueue = [];
    this.originalFetch = window.fetch;
    
    window.fetch = (...args) => {
      const url = args[0];
      if (this.isNonEssentialRequest(url)) {
        return new Promise((resolve) => {
          this.requestQueue.push(() => this.originalFetch(...args).then(resolve));
        });
      }
      return this.originalFetch(...args);
    };
  }

  resumeNonEssentialRequests() {
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
      this.originalFetch = null;
    }
    
    // Process queued requests
    const queue = [...this.requestQueue];
    this.requestQueue = [];
    
    queue.forEach(request => {
      setTimeout(request, 100); // Stagger requests
    });
  }

  isNonEssentialRequest(url) {
    const essentialPatterns = [
      /auth/,
      /user_state/,
      /strength_logs/,
      /training_sessions/,
      /daily_activity/
    ];
    
    return !essentialPatterns.some(pattern => pattern.test(url));
  }

  // Cache Management
  setCache(key, value, ttl = 300000) { // 5 minutes default
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  getCache(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  // Performance Utilities
  measureAsync(name, fn) {
    const start = performance.now();
    return fn().then(result => {
      const duration = performance.now() - start;
      this.recordMetric('async_operation', { name, duration });
      return result;
    });
  }

  recordMetric(type, data) {
    const metric = {
      type,
      data,
      timestamp: Date.now()
    };
    
    if (!this.metrics[type]) {
      this.metrics[type] = [];
    }
    
    this.metrics[type].push(metric);
    
    // Keep only last 100 entries per metric type
    if (this.metrics[type].length > 100) {
      this.metrics[type] = this.metrics[type].slice(-50);
    }
  }

  getPerformanceReport() {
    const report = {
      timestamp: Date.now(),
      metrics: this.metrics,
      recommendations: this.generateRecommendations()
    };
    
    return report;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analyze render performance
    const renderTimes = this.metrics.renderTime.map(m => m.duration);
    if (renderTimes.length > 0) {
      const avgRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
      if (avgRenderTime > 16) { // More than 1 frame at 60fps
        recommendations.push({
          type: 'render',
          priority: 'high',
          message: 'Consider optimizing render performance. Average render time is above 16ms.'
        });
      }
    }

    // Analyze memory usage
    const memoryUsages = this.metrics.memoryUsage.map(m => m.used / m.total);
    if (memoryUsages.length > 0) {
      const avgMemoryUsage = memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length;
      if (avgMemoryUsage > 0.8) {
        recommendations.push({
          type: 'memory',
          priority: 'medium',
          message: 'High memory usage detected. Consider implementing more aggressive cleanup.'
        });
      }
    }

    // Analyze load times
    const loadTimes = this.metrics.loadTime.map(m => m.totalLoad);
    if (loadTimes.length > 0) {
      const avgLoadTime = loadTimes.reduce((a, b) => a + b, 0) / loadTimes.length;
      if (avgLoadTime > 3000) { // More than 3 seconds
        recommendations.push({
          type: 'load',
          priority: 'high',
          message: 'Page load time is slow. Consider implementing better code splitting and caching.'
        });
      }
    }

    return recommendations;
  }

  // Cleanup
  destroy() {
    if (this.observers.intersection) {
      this.observers.intersection.disconnect();
    }
    if (this.observers.resize) {
      this.observers.resize.disconnect();
    }
    
    this.cache.clear();
    this.lazyComponents.clear();
    this.virtualizationCache.clear();
  }
}

// Export singleton instance
export const performanceOptimizer = new PerformanceOptimizer();

// Utility functions for components
export function withPerformanceMonitoring(Component, name) {
  return function PerformanceMonitoredComponent(props) {
    const start = performance.now();
    
    return (
      <Component
        {...props}
        onMount={() => {
          const duration = performance.now() - start;
          performanceOptimizer.recordMetric('component_mount', { name, duration });
        }}
      />
    );
  };
}

export function memoizeAsync(fn, keyFn = (...args) => JSON.stringify(args)) {
  return async function(...args) {
    const key = keyFn(...args);
    const cached = performanceOptimizer.getCache(key);
    
    if (cached) {
      return cached;
    }
    
    const result = await fn(...args);
    performanceOptimizer.setCache(key, result);
    return result;
  };
}

export default performanceOptimizer;