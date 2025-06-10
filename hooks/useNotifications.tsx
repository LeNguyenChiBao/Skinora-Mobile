import { useState } from "react";

export const useNotifications = () => {
  const [isConnected, setIsConnected] = useState(false);

  // Comment out tạm thời để test
  // useEffect(() => {
  //   const initializeCallNotifications = async () => {
  //     try {
  //       const userData = await authService.getUserData();
  //       const token = await authService.getToken();

  //       if (userData?.id && token) {
  //         await callNotificationManager.initialize(userData.id, token);
  //         console.log("🔔 Basic call notification manager initialized");
  //         setIsConnected(true);
  //       }
  //     } catch (error) {
  //       console.error("❌ Error initializing call notifications:", error);
  //       setIsConnected(false);
  //     }
  //   };

  //   initializeCallNotifications();

  //   return () => {
  //     callNotificationManager.destroy();
  //     setIsConnected(false);
  //   };
  // }, []);

  const connect = () => {
    setIsConnected(true);
  };

  const disconnect = () => {
    setIsConnected(false);
  };

  const startCall = (appointmentId: string) => {
    console.log("📞 Starting call notification for:", appointmentId);
  };

  const endCall = (appointmentId: string) => {
    console.log("📞 Ending call notification for:", appointmentId);
  };

  return {
    isConnected,
    connect,
    disconnect,
    startCall,
    endCall,
  };
};
