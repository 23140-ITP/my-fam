import React from "react";
import { Platform, StyleSheet } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { GlassSurface } from "@/src/components/GlassSurface";
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
          backgroundColor: "transparent",
          borderTopWidth: 0,
          height: 78,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 8 : 6,
        },
        tabBarBackground: () => (
          <GlassSurface
            style={styles.tabBarGlass}
            contentStyle={styles.tabBarGlassContent}
            tintColor={colors.glass}
            intensity={65}
            interactive
          >
            <></>
          </GlassSurface>
        ),
        tabBarItemStyle: { alignSelf: "center", paddingTop: 1 },
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
            <Ionicons
              name={focused ? "chatbubbles" : "chatbubbles-outline"}
              size={size}
              color={color}
            />
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

const styles = StyleSheet.create({
  tabBarGlass: {
    flex: 1,
    marginHorizontal: 10,
    marginTop: 6,
    marginBottom: 6,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.glassBorder,
  },
  tabBarGlassContent: {
    flex: 1,
  },
});
