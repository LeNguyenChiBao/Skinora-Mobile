import { useSegments } from "expo-router";
import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";

interface CallIndicatorState {
  isCallActive: boolean;
  isIncomingCall: boolean;
  participantName: string;
  callDuration: number;
  appointmentId: string | null;
  callData: any;
}

interface CallIndicatorActions {
  startCall: (data: {
    participantName: string;
    appointmentId: string;
    callData: any;
  }) => void;
  startIncomingCall: (data: {
    participantName: string;
    appointmentId: string;
    callData: any;
  }) => void;
  endCall: () => void;
  updateDuration: (duration: number) => void;
  acceptIncomingCall: () => void;
  rejectIncomingCall: () => void;
}

export const useCallIndicatorStore = create<
  CallIndicatorState & CallIndicatorActions
>()(
  subscribeWithSelector((set, get) => ({
    isCallActive: false,
    isIncomingCall: false,
    participantName: "",
    callDuration: 0,
    appointmentId: null,
    callData: null,

    startCall: (data) => {
      console.log("📞 Starting outgoing call indicator:", data);
      set({
        isCallActive: true,
        isIncomingCall: false,
        participantName: data.participantName,
        appointmentId: data.appointmentId,
        callData: data.callData,
        callDuration: 0,
      });
    },

    startIncomingCall: (data) => {
      console.log("📞 Starting incoming call indicator:", data);
      set({
        isCallActive: true,
        isIncomingCall: true,
        participantName: data.participantName,
        appointmentId: data.appointmentId,
        callData: data.callData,
        callDuration: 0,
      });
    },

    acceptIncomingCall: () => {
      console.log("📞 Accepting incoming call");
      set({ isIncomingCall: false });
    },

    rejectIncomingCall: () => {
      console.log("📞 Rejecting incoming call");
      set({
        isCallActive: false,
        isIncomingCall: false,
        participantName: "",
        callDuration: 0,
        appointmentId: null,
        callData: null,
      });
    },

    endCall: () => {
      console.log("📞 Ending call indicator");
      set({
        isCallActive: false,
        isIncomingCall: false,
        participantName: "",
        callDuration: 0,
        appointmentId: null,
        callData: null,
      });
    },

    updateDuration: (duration) => {
      if (!get().isIncomingCall) {
        // Only update duration for active calls, not incoming
        set({ callDuration: duration });
      }
    },
  }))
);

export const useCallIndicator = () => {
  const segments = useSegments();
  const store = useCallIndicatorStore();

  const currentRoute = segments.join("/");
  const shouldShow = store.isCallActive && !currentRoute.includes("video-call");

  return {
    ...store,
    shouldShowIndicator: shouldShow,
  };
};
