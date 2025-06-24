// Simple event emitter for auth state changes
class AuthEventEmitter {
  private listeners: Array<() => void> = [];

  subscribe(listener: () => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  emit() {
    this.listeners.forEach((listener) => listener());
  }
}

export const authEventEmitter = new AuthEventEmitter();

// Helper function to refresh auth state from anywhere in the app
export const refreshAuthState = () => {
  console.log("🔄 Broadcasting auth state refresh...");
  authEventEmitter.emit();
};
