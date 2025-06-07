import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Dimensions, StyleSheet, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width } = Dimensions.get("window");

interface TabBarProps {
  state: any;
  descriptors: any;
  navigation: any;
}

export default function CustomTabBar({
  state,
  descriptors,
  navigation,
}: TabBarProps) {
  const insets = useSafeAreaInsets();

  const getTabIcon = (routeName: string, focused: boolean) => {
    const iconSize = routeName === "scanning" ? 32 : 24;
    const iconColor = focused ? "#00A86B" : "#8E8E93";

    switch (routeName) {
      case "index":
        return (
          <Ionicons
            name={focused ? "home" : "home-outline"}
            size={iconSize}
            color={iconColor}
          />
        );
      case "chatbox":
        return (
          <Ionicons
            name={focused ? "chatbubbles" : "chatbubbles-outline"}
            size={iconSize}
            color={iconColor}
          />
        );
      case "scanning":
        return (
          <View style={[styles.scanButton, focused && styles.scanButtonActive]}>
            <Ionicons
              name="scan"
              size={iconSize}
              color={focused ? "#FFFFFF" : "#00A86B"}
            />
          </View>
        );
      case "appointment":
        return (
          <Ionicons
            name={focused ? "calendar" : "calendar-outline"}
            size={iconSize}
            color={iconColor}
          />
        );
      case "profile":
        return (
          <Ionicons
            name={focused ? "person" : "person-outline"}
            size={iconSize}
            color={iconColor}
          />
        );
      default:
        return null;
    }
  };

  const getTabLabel = (routeName: string) => {
    switch (routeName) {
      case "index":
        return "Trang chủ";
      case "chatbox":
        return "Chat AI";
      case "scanning":
        return "Quét da";
      case "appointment":
        return "Lịch hẹn";
      case "profile":
        return "Cá nhân";
      default:
        return "";
    }
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.container, { marginBottom: insets.bottom + 20 }]}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[styles.tab, route.name === "scanning" && styles.scanTab]}
              activeOpacity={0.7}
            >
              {getTabIcon(route.name, isFocused)}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
  },
  container: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingTop: 12,
    paddingHorizontal: 12,
    paddingBottom: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  scanTab: {
    marginTop: -25,
    position: "relative",
    zIndex: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 6,
    color: "#8E8E93",
    textAlign: "center",
  },
  labelActive: {
    color: "#00A86B",
    fontWeight: "600",
  },
  scanButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#E8F5E8",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#00A86B",
    shadowColor: "#00A86B",
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  scanButtonActive: {
    backgroundColor: "#00A86B",
  },
});
