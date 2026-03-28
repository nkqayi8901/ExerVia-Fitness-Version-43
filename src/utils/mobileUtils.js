// Mobile and Touch Optimization Utilities for ExerVia Fitness

export const MOBILE_BREAKPOINTS = {
  xs: 320,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280
};

export const TOUCH_TARGETS = {
  minimum: 44, // Minimum touch target size in px (Apple HIG)
  recommended: 48, // Recommended touch target size
  large: 64 // Large touch targets for gym use
};

export const GESTURE_THRESHOLDS = {
  swipe: 30, // Minimum pixels to register a swipe
  longPress: 500, // Milliseconds to register a long press
  doubleTap: 300 // Maximum time between taps for double tap
};

// Detect mobile devices
export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function isTablet() {
  const userAgent = navigator.userAgent;
  return /iPad|Android(?!.*Mobile)/i.test(userAgent);
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

// Touch gesture detection
export class TouchGestures {
  constructor(element, options = {}) {
    this.element = element;
    this.options = {
      onSwipeLeft: null,
      onSwipeRight: null,
      onSwipeUp: null,
      onSwipeDown: null,
      onLongPress: null,
      onDoubleTap: null,
      ...options
    };
    
    this.startX = 0;
    this.startY = 0;
    this.startTime = 0;
    this.isLongPressActive = false;
    this.lastTapTime = 0;
    
    this.bindEvents();
  }

  bindEvents() {
    if (!isTouchDevice()) return;

    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: true });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: true });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: true });
  }

  handleTouchStart(e) {
    const touch = e.touches[0];
    this.startX = touch.clientX;
    this.startY = touch.clientY;
    this.startTime = Date.now();
    this.isLongPressActive = false;

    // Long press detection
    this.longPressTimer = setTimeout(() => {
      this.isLongPressActive = true;
      if (this.options.onLongPress) {
        this.options.onLongPress(e);
      }
    }, GESTURE_THRESHOLDS.longPress);

    // Double tap detection
    const currentTime = Date.now();
    if (currentTime - this.lastTapTime < GESTURE_THRESHOLDS.doubleTap) {
      if (this.options.onDoubleTap) {
        this.options.onDoubleTap(e);
      }
      this.lastTapTime = 0;
    } else {
      this.lastTapTime = currentTime;
    }
  }

  handleTouchMove(e) {
    if (this.isLongPressActive) {
      clearTimeout(this.longPressTimer);
    }
  }

  handleTouchEnd(e) {
    if (this.isLongPressActive) {
      clearTimeout(this.longPressTimer);
      return;
    }

    const touch = e.changedTouches[0];
    const endX = touch.clientX;
    const endY = touch.clientY;
    const deltaX = endX - this.startX;
    const deltaY = endY - this.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    if (distance > GESTURE_THRESHOLDS.swipe) {
      const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
      
      if (angle >= -45 && angle <= 45) {
        // Horizontal swipe
        if (deltaX > 0 && this.options.onSwipeRight) {
          this.options.onSwipeRight(e);
        } else if (deltaX < 0 && this.options.onSwipeLeft) {
          this.options.onSwipeLeft(e);
        }
      } else if (angle > 45 && angle < 135) {
        // Down swipe
        if (this.options.onSwipeDown) {
          this.options.onSwipeDown(e);
        }
      } else if (angle < -45 && angle > -135) {
        // Up swipe
        if (this.options.onSwipeUp) {
          this.options.onSwipeUp(e);
        }
      } else {
        // Vertical swipe (up or down)
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          if (deltaY > 0 && this.options.onSwipeDown) {
            this.options.onSwipeDown(e);
          } else if (deltaY < 0 && this.options.onSwipeUp) {
            this.options.onSwipeUp(e);
          }
        }
      }
    }

    clearTimeout(this.longPressTimer);
  }

  destroy() {
    this.element.removeEventListener('touchstart', this.handleTouchStart);
    this.element.removeEventListener('touchend', this.handleTouchEnd);
    this.element.removeEventListener('touchmove', this.handleTouchMove);
    clearTimeout(this.longPressTimer);
  }
}

// Responsive utilities
export function getBreakpoint() {
  const width = window.innerWidth;
  if (width < MOBILE_BREAKPOINTS.sm) return 'xs';
  if (width < MOBILE_BREAKPOINTS.md) return 'sm';
  if (width < MOBILE_BREAKPOINTS.lg) return 'md';
  if (width < MOBILE_BREAKPOINTS.xl) return 'lg';
  return 'xl';
}

export function isMobileBreakpoint() {
  return getBreakpoint() === 'xs' || getBreakpoint() === 'sm';
}

export function isTabletBreakpoint() {
  return getBreakpoint() === 'md';
}

// Touch-friendly CSS classes
export const TOUCH_STYLES = {
  touchTarget: `
    min-width: ${TOUCH_TARGETS.recommended}px;
    min-height: ${TOUCH_TARGETS.recommended}px;
    padding: 12px 16px;
    border-radius: 12px;
    touch-action: manipulation;
  `,
  largeTouchTarget: `
    min-width: ${TOUCH_TARGETS.large}px;
    min-height: ${TOUCH_TARGETS.large}px;
    padding: 16px 20px;
    border-radius: 16px;
    touch-action: manipulation;
  `,
  swipeable: `
    touch-action: pan-y;
    -webkit-overflow-scrolling: touch;
  `
};

// Virtual keyboard detection and handling
export function setupKeyboardHandling() {
  let initialViewportHeight = window.innerHeight;
  
  window.addEventListener('resize', () => {
    const viewportHeight = window.innerHeight;
    const keyboardHeight = initialViewportHeight - viewportHeight;
    
    if (keyboardHeight > 150) { // Likely a virtual keyboard
      document.body.classList.add('keyboard-open');
      document.body.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
    } else {
      document.body.classList.remove('keyboard-open');
      document.body.style.removeProperty('--keyboard-height');
    }
  });
}

// Haptic feedback simulation (for future native app)
export function triggerHapticFeedback(type = 'light') {
  if ('vibrate' in navigator) {
    switch (type) {
      case 'light':
        navigator.vibrate(50);
        break;
      case 'medium':
        navigator.vibrate(100);
        break;
      case 'heavy':
        navigator.vibrate(200);
        break;
      case 'success':
        navigator.vibrate([50, 100, 50]);
        break;
      case 'error':
        navigator.vibrate([100, 100, 100]);
        break;
    }
  }
}

// Performance optimization for mobile
export function optimizeForMobile() {
  // Disable zoom on double tap for better UX in gym mode
  if (isMobile()) {
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      viewport.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no');
    }
  }
}

// Export default configuration for easy import
export default {
  isMobile,
  isTablet,
  isTouchDevice,
  TouchGestures,
  getBreakpoint,
  isMobileBreakpoint,
  TOUCH_TARGETS,
  GESTURE_THRESHOLDS,
  TOUCH_STYLES,
  setupKeyboardHandling,
  triggerHapticFeedback,
  optimizeForMobile
};