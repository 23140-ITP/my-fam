import React from "react";
import { Platform } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { colors, font } from "@/src/constants/theme";

const isIOS26 =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export default function TabsLayout() {
  if (isIOS26) {
    try {
      const { NativeTabs, Icon, Label } = require("expo-router/unstable-native-tabs");
      return (
        <NativeTabs>
          <NativeTabs.Trigger name="home">
            <Label>Home</Label>
            <Icon sf="house.fill" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="chats">
            <Label>Chats</Label>
            <Icon sf="message.fill" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="care">
            <Label>Care</Label>
            <Icon sf="heart.fill" />
          </NativeTabs.Trigger>
          <NativeTabs.Trigger name="profile">
            <Label>Profile</Label>
            <Icon sf="person.fill" />
          </NativeTabs.Trigger>
        </NativeTabs>
      );
    } catch {
      /* fall through to classic tabs */
    }
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          ...(Platform.OS === "web" ? { height: 64 } : {}),
        },
        tabBarItemStyle: { alignSelf: "center" },
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="care"
        options={{
          title: "Care",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "heart" : "heart-outline"} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? "person" : "person-outline"} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
