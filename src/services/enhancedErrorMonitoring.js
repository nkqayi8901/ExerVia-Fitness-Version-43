// Enhanced Error Monitoring and Testing Service for ExerVia Fitness
// Provides comprehensive error tracking, performance monitoring, and automated testing

export class EnhancedErrorMonitoring {
  constructor() {
    this.config = {
      enableConsoleLogging: process.env.NODE_ENV === 'development',
      enableRemoteLogging: process.env.NODE_ENV === 'production',
      maxErrorsPerSession: 50,
      sessionTimeout: 30 * 60 * 1000, // 30 minutes
      enablePerformanceTracking: true,
      enableUserSessionTracking: true
    };
    
    this.session = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      errors: [],
      performanceMetrics: [],
      userActions: []
    };
    
    this.init();
  }

  init() {
    this.setupGlobalErrorHandlers();
    this.setupUnhandledRejectionHandler();
    this.setupPerformanceMonitoring();
    this.setupUserSessionTracking();
    this.setupNetworkErrorTracking();
  }

  // Global Error Handling
  setupGlobalErrorHandlers() {
    window.addEventListener('error', (event) => {
      this.captureError({
        type: 'global_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
        timestamp: Date.now(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        sessionId: this.session.id
      });
    });

    // React Error Boundary integration
    window.addEventListener('react_error_boundary', (event) => {
      this.captureError({
        type: 'react_error_boundary',
        componentStack: event.detail.componentStack,
        error: event.detail.error,
        errorInfo: event.detail.errorInfo,
        timestamp: Date.now(),
        sessionId: this.session.id
      });
    });
  }

  setupUnhandledRejectionHandler() {
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        type: 'unhandled_promise_rejection',
        reason: event.reason,
        timestamp: Date.now(),
        sessionId: this.session.id
      });
    });
  }

  // Performance Monitoring
  setupPerformanceMonitoring() {
    if (!this.config.enablePerformanceTracking) return;

    // Monitor Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordPerformanceMetric({
              name: 'LCP',
              value: entry.startTime,
              rating: entry.startTime < 2500 ? 'good' : entry.startTime < 4000 ? 'needs-improvement' : 'poor'
            });
          }
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      } catch (e) {
        // Fallback for older browsers
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            this.recordPerformanceMetric({
              name: 'FID',
              value: entry.processingStart - entry.startTime,
              rating: entry.processingStart - entry.startTime < 100 ? 'good' : 'needs-improvement'
            });
          }
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
      } catch (e) {
        // Fallback for older browsers
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
              this.recordPerformanceMetric({
                name: 'CLS',
                value: clsValue,
                rating: clsValue < 0.1 ? 'good' : clsValue < 0.25 ? 'needs-improvement' : 'poor'
              });
            }
          }
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
      } catch (e) {
        // Fallback for older browsers
      }
    }

    // Custom performance metrics
    this.recordCustomMetrics();
  }

  recordCustomMetrics() {
    // Monitor component render times
    this.observeComponentRenders();
    
    // Monitor API response times
    this.observeApiCalls();
    
    // Monitor memory usage
    this.observeMemoryUsage();
  }

  observeComponentRenders() {
    // Hook into React's render cycle for performance monitoring
    if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
      const originalRender = window.__REACT_DEVTOOLS_GLOBAL_HOOK__.render;
      if (originalRender) {
        window.__REACT_DEVTOOLS_GLOBAL_HOOK__.render = (...args) => {
          const start = performance.now();
          const result = originalRender.apply(this, args);
          const duration = performance.now() - start;
          
          if (duration > 16) { // Slower than 60fps
            this.recordPerformanceMetric({
              name: 'slow_component_render',
              value: duration,
              component: args[0]?.type?.name || 'Unknown'
            });
          }
          
          return result;
        };
      }
    }
  }

  observeApiCalls() {
    const originalFetch = window.fetch;
    if (originalFetch) {
      window.fetch = async (...args) => {
        const start = performance.now();
        const url = args[0];
        
        try {
          const response = await originalFetch(...args);
          const duration = performance.now() - start;
          
          this.recordPerformanceMetric({
            name: 'api_call',
            value: duration,
            url: url,
            status: response.status,
            success: response.ok
          });
          
          return response;
        } catch (error) {
          const duration = performance.now() - start;
          
          this.recordPerformanceMetric({
            name: 'api_error',
            value: duration,
            url: url,
            error: error.message
          });
          
          throw error;
        }
      };
    }
  }

  observeMemoryUsage() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = performance.memory;
        this.recordPerformanceMetric({
          name: 'memory_usage',
          value: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit
        });
      }, 30000);
    }
  }

  // User Session Tracking
  setupUserSessionTracking() {
    if (!this.config.enableUserSessionTracking) return;

    // Track user interactions
    document.addEventListener('click', (event) => {
      this.recordUserAction({
        type: 'click',
        target: event.target.tagName,
        timestamp: Date.now()
      });
    });

    document.addEventListener('keydown', (event) => {
      this.recordUserAction({
        type: 'keydown',
        key: event.key,
        timestamp: Date.now()
      });
    });

    // Track page views
    window.addEventListener('popstate', () => {
      this.recordUserAction({
        type: 'page_view',
        url: window.location.href,
        timestamp: Date.now()
      });
    });

    // Track session duration
    setInterval(() => {
      if (Date.now() - this.session.startTime > this.config.sessionTimeout) {
        this.endSession();
      }
    }, 60000); // Check every minute
  }

  // Network Error Tracking
  setupNetworkErrorTracking() {
    // Track failed network requests
    window.addEventListener('online', () => {
      this.recordUserAction({
        type: 'network_status',
        status: 'online',
        timestamp: Date.now()
      });
    });

    window.addEventListener('offline', () => {
      this.recordUserAction({
        type: 'network_status',
        status: 'offline',
        timestamp: Date.now()
      });
    });

    // Track resource loading failures
    window.addEventListener('error', (event) => {
      if (event.target !== window) {
        this.captureError({
          type: 'resource_error',
          resource: event.target.src || event.target.href,
          timestamp: Date.now(),
          sessionId: this.session.id
        });
      }
    }, true);
  }

  // Error Capture and Reporting
  captureError(errorData) {
    // Rate limiting
    if (this.session.errors.length >= this.config.maxErrorsPerSession) {
      return;
    }

    const error = {
      ...errorData,
      id: this.generateErrorId(),
      session: this.session.id,
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      connection: navigator.connection ? {
        effectiveType: navigator.connection.effectiveType,
        downlink: navigator.connection.downlink,
        rtt: navigator.connection.rtt
      } : null
    };

    this.session.errors.push(error);

    if (this.config.enableConsoleLogging) {
      console.error('ExerVia Error:', error);
    }

    if (this.config.enableRemoteLogging) {
      this.sendErrorToServer(error);
    }

    // Trigger error boundary event
    window.dispatchEvent(new CustomEvent('exervia:error', { detail: error }));
  }

  recordPerformanceMetric(metric) {
    const performanceData = {
      ...metric,
      timestamp: Date.now(),
      sessionId: this.session.id,
      url: window.location.href
    };

    this.session.performanceMetrics.push(performanceData);

    // Send critical performance issues to server
    if (metric.rating === 'poor' || metric.value > 1000) {
      this.sendPerformanceAlert(performanceData);
    }
  }

  recordUserAction(action) {
    const userAction = {
      ...action,
      sessionId: this.session.id,
      timestamp: Date.now()
    };

    this.session.userActions.push(userAction);

    // Keep only last 100 actions to prevent memory bloat
    if (this.session.userActions.length > 100) {
      this.session.userActions = this.session.userActions.slice(-50);
    }
  }

  // Remote Logging
  async sendErrorToServer(error) {
    try {
      await fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(error)
      });
    } catch (e) {
      console.error('Failed to send error to server:', e);
    }
  }

  async sendPerformanceAlert(metric) {
    try {
      await fetch('/api/performance-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(metric)
      });
    } catch (e) {
      console.error('Failed to send performance alert:', e);
    }
  }

  // Session Management
  generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  generateErrorId() {
    return 'error_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  endSession() {
    const sessionData = {
      ...this.session,
      endTime: Date.now(),
      duration: Date.now() - this.session.startTime
    };

    if (this.config.enableRemoteLogging) {
      this.sendSessionData(sessionData);
    }

    // Reset session
    this.session = {
      id: this.generateSessionId(),
      startTime: Date.now(),
      errors: [],
      performanceMetrics: [],
      userActions: []
    };
  }

  async sendSessionData(sessionData) {
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sessionData)
      });
    } catch (e) {
      console.error('Failed to send session data:', e);
    }
  }

  // Diagnostic Tools
  getDiagnosticReport() {
    return {
      session: this.session,
      environment: {
        userAgent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        connection: navigator.connection,
        memory: performance.memory,
        timing: performance.timing
      },
      performance: {
        navigation: performance.getEntriesByType('navigation'),
        resource: performance.getEntriesByType('resource'),
        paint: performance.getEntriesByType('paint')
      },
      errors: this.session.errors,
      recommendations: this.generateRecommendations()
    };
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Analyze error patterns
    const errorTypes = {};
    this.session.errors.forEach(error => {
      errorTypes[error.type] = (errorTypes[error.type] || 0) + 1;
    });

    Object.entries(errorTypes).forEach(([type, count]) => {
      if (count > 5) {
        recommendations.push({
          type: 'error_pattern',
          priority: 'high',
          message: `High frequency of ${type} errors detected (${count} occurrences)`
        });
      }
    });

    // Analyze performance issues
    const slowMetrics = this.session.performanceMetrics.filter(m => m.value > 1000);
    if (slowMetrics.length > 10) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: `Multiple slow operations detected (${slowMetrics.length} operations > 1s)`
      });
    }

    return recommendations;
  }

  // Cleanup
  destroy() {
    // Clear all event listeners
    window.removeEventListener('error', this.errorHandler);
    window.removeEventListener('unhandledrejection', this.rejectionHandler);
    
    // End current session
    this.endSession();
  }
}

// Export singleton instance
export const enhancedErrorMonitoring = new EnhancedErrorMonitoring();

// React Error Boundary Component
export class ExerViaErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Report to error monitoring service
    window.dispatchEvent(new CustomEvent('react_error_boundary', {
      detail: {
        error: error,
        errorInfo: errorInfo,
        componentStack: errorInfo.componentStack
      }
    }));
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-fallback">
          <h2>Something went wrong</h2>
          <p>We've automatically reported this error and are working to fix it.</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
          {process.env.NODE_ENV === 'development' && (
            <details>
              <summary>Error Details</summary>
              <pre>{this.state.error && this.state.error.toString()}</pre>
              <pre>{this.state.errorInfo.componentStack}</pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

// Utility functions for manual error reporting
export function reportError(error, context = {}) {
  enhancedErrorMonitoring.captureError({
    type: 'manual_report',
    error: error,
    context: context,
    timestamp: Date.now()
  });
}

export function reportPerformanceMetric(name, value, metadata = {}) {
  enhancedErrorMonitoring.recordPerformanceMetric({
    name: name,
    value: value,
    ...metadata
  });
}

export function getDiagnosticReport() {
  return enhancedErrorMonitoring.getDiagnosticReport();
}

export default enhancedErrorMonitoring;