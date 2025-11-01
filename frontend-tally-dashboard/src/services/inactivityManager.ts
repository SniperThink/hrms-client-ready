import { logout, hasKeepSignedIn } from "./authService";

class InactivityManager {
  private timeoutId: NodeJS.Timeout | null = null;
  private warningTimeoutId: NodeJS.Timeout | null = null;
  private readonly INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 5 minutes in milliseconds
  private readonly WARNING_TIME = 4.5 * 60 * 1000; // 4.5 minutes - show warning
  private isActive = false;
  private warningCallback: (() => void) | null = null;
  private logoutCallback: (() => void) | null = null;

  constructor() {
    this.bindEvents();
  }

  // Events that indicate user activity
  private readonly activityEvents = [
    "mousedown",
    "mousemove",
    "keypress",
    "scroll",
    "touchstart",
    "click",
    "keydown",
  ];

  private bindEvents() {
    this.activityEvents.forEach((event) => {
      document.addEventListener(event, this.resetTimer.bind(this), true);
    });
  }

  private unbindEvents() {
    this.activityEvents.forEach((event) => {
      document.removeEventListener(event, this.resetTimer.bind(this), true);
    });
  }

  private resetTimer() {
    // Don't track inactivity if "keep signed in" is enabled
    if (hasKeepSignedIn()) {
      return;
    }

    // Clear existing timers
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId);
    }

    // Set warning timer (30 seconds before logout)
    this.warningTimeoutId = setTimeout(() => {
      if (this.warningCallback) {
        this.warningCallback();
      }
    }, this.WARNING_TIME);

    // Set logout timer
    this.timeoutId = setTimeout(() => {
      this.handleLogout();
    }, this.INACTIVITY_TIMEOUT);
  }

  private handleLogout() {
    // Clear authentication data
    logout();

    // Call logout callback if provided
    if (this.logoutCallback) {
      this.logoutCallback();
    } else {
      // Default behavior - redirect to login
      window.location.href = "/login";
    }
  }

  public start() {
    // Only start if user is authenticated and doesn't have "keep signed in" enabled
    const hasToken = localStorage.getItem("access");
    if (hasToken && !hasKeepSignedIn()) {
      this.isActive = true;
      this.resetTimer();
    }
  }

  public stop() {
    this.isActive = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.warningTimeoutId) {
      clearTimeout(this.warningTimeoutId);
      this.warningTimeoutId = null;
    }
  }

  public setWarningCallback(callback: () => void) {
    this.warningCallback = callback;
  }

  public setLogoutCallback(callback: () => void) {
    this.logoutCallback = callback;
  }

  public destroy() {
    this.stop();
    this.unbindEvents();
  }

  public extendSession() {
    // Called when user acknowledges warning and wants to stay logged in
    if (this.isActive) {
      this.resetTimer();
    }
  }
}

// Export a singleton instance
export const inactivityManager = new InactivityManager();
