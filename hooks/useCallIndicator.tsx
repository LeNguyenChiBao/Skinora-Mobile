import { useSegments } from "expo-router";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface CallIndicatorState {
  isInCall: boolean;
  callDuration: number;
  participantName: string;
  appointmentId: string;
  callData: any;
  isPersistent: boolean;
  timerId: NodeJS.Timeout | null; // Add timer reference
  startCall: (data: {
    participantName: string;
    appointmentId: string;
    callData?: any;
  }) => void;
  endCall: () => void;
  updateDuration: (duration: number) => void;
  setPersistent: (persistent: boolean) => void;
  startGlobalTimer: () => void;
  stopGlobalTimer: () => void;
}

export const useCallIndicatorStore = create<CallIndicatorState>()(
  subscribeWithSelector((set, get) => ({
    isInCall: false,
    callDuration: 0,
    participantName: "",
    appointmentId: "",
    callData: null,
    isPersistent: false,
    timerId: null,

    startCall: (data) => {
      console.log("Starting call indicator:", data);
      // Use requestAnimationFrame to batch the update
      requestAnimationFrame(() => {
        set({
          isInCall: true,
          participantName: data.participantName,
          appointmentId: data.appointmentId,
          callData: data.callData,
          callDuration: 0,
          isPersistent: true,
        });

        // Start global timer
        get().startGlobalTimer();
      });
    },

    endCall: () => {
      console.log("Ending call indicator");
      const { timerId } = get();

      // Stop global timer
      if (timerId) {
        clearInterval(timerId);
      }

      // Use requestAnimationFrame to batch the update
      requestAnimationFrame(() => {
        set({
          isInCall: false,
          callDuration: 0,
          participantName: "",
          appointmentId: "",
          callData: null,
          isPersistent: false,
          timerId: null,
        });
      });
    },

    updateDuration: (duration) => {
      // Only update if it's different
      const currentDuration = get().callDuration;
      if (duration !== currentDuration) {
        set({ callDuration: duration });
      }
    },

    setPersistent: (persistent) => {
      set({ isPersistent: persistent });
    },

    startGlobalTimer: () => {
      const { timerId } = get();

      // Don't start if already running
      if (timerId) {
        console.log("Global timer already running");
        return;
      }

      console.log("Starting global call timer");
      const newTimerId = setInterval(() => {
        const currentDuration = get().callDuration;
        const newDuration = currentDuration + 1;
        set({ callDuration: newDuration });
      }, 1000);

      set({ timerId: newTimerId });
    },

    stopGlobalTimer: () => {
      const { timerId } = get();
      if (timerId) {
        console.log("Stopping global call timer");
        clearInterval(timerId);
        set({ timerId: null });
      }
    },
  }))
);

export const useCallIndicator = () => {
  const segments = useSegments();
  const store = useCallIndicatorStore();

  const currentRoute = segments.join("/");
  const shouldShow = store.isInCall && !currentRoute.includes("video-call");

  return {
    ...store,
    shouldShowIndicator: shouldShow,
  };
};
