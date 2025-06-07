import CustomTabBar from "@/components/ui/CustomTabBar";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
        }}
      />
      <Tabs.Screen
        name="chatbox"
        options={{
          title: "Chat AI",
        }}
      />
      <Tabs.Screen
        name="scanning"
        options={{
          title: "Quét da",
        }}
      />
      <Tabs.Screen
        name="appointment"
        options={{
          title: "Lịch hẹn",
        }}
      />
      <Tabs.Screen
        name="personal"
        options={{
          title: "Cá nhân",
        }}
      />
    </Tabs>
  );
}
