import React, { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors, font, radius, shadow, spacing } from "@/src/constants/theme";
import { api } from "@/src/lib/api";
import { haptic, isHapticsEnabled, setHapticsEnabled } from "@/src/lib/haptics";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState("friend");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [hapticsOn, setHapticsOn] = useState(true);

  const load = useCallback(async () => {
    try {
      const p = await api.profile();
      setName(p.name);
    } catch {
      /* keep */
    }
    setHapticsOn(isHapticsEnabled());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  useEffect(() => {
    if (editing) setDraft(name);
  }, [editing, name]);

  const save = async () => {
    const value = draft.trim() || "friend";
    haptic.light();
    try {
      const res = await api.setProfile(value);
      setName(res.name);
    } catch {
      setName(value);
    }
    setEditing(false);
  };

  const onToggleHaptics = async (v: boolean) => {
    setHapticsOn(v);
    await setHapticsEnabled(v);
    if (v) haptic.success();
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        bottomOffset={24}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>Profile</Text>

        {/* User card */}
        <View style={[styles.userCard, shadow]}>
          <View style={styles.userAvatar}>
            <Ionicons name="person" size={34} color={colors.brand} />
          </View>
          {editing ? (
            <View style={styles.editRow}>
              <TextInput
                testID="profile-name-input"
                style={styles.nameInput}
                value={draft}
                onChangeText={setDraft}
                placeholder="Your name"
                placeholderTextColor={colors.textFaint}
                autoFocus
                maxLength={40}
                onSubmitEditing={save}
                returnKeyType="done"
              />
              <Pressable testID="profile-name-save" onPress={save} style={styles.saveBtn}>
                <Text style={styles.saveText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.userName} testID="profile-name">
                  {name}
                </Text>
                <Text style={styles.userSub}>Part of the family 💛</Text>
              </View>
              <Pressable
                testID="profile-name-edit"
                onPress={() => setEditing(true)}
                hitSlop={8}
                style={styles.editBtn}
              >
                <Ionicons name="pencil" size={16} color={colors.brand} />
              </Pressable>
            </View>
          )}
        </View>

        {/* AI disclaimer */}
        <View style={styles.aiCard}>
          <View style={styles.aiHead}>
            <Ionicons name="sparkles" size={18} color={colors.clay} />
            <Text style={styles.aiTitle}>About Mom &amp; Dad</Text>
          </View>
          <Text style={styles.aiText}>
            Mom and Dad are caring AI companions, here to check in on you, cheer you on, and give you
            two loving perspectives whenever you need them. They&apos;re not real people — but the
            comfort is meant to feel real.
          </Text>
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={[styles.settingsCard, shadow]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.brandSoft }]}>
                <Ionicons name="pulse" size={17} color={colors.brand} />
              </View>
              <Text style={styles.settingLabel}>Haptic feedback</Text>
            </View>
            <Switch
              testID="profile-haptics-toggle"
              value={hapticsOn}
              onValueChange={onToggleHaptics}
              trackColor={{ true: colors.brand, false: colors.borderStrong }}
              thumbColor={colors.white}
            />
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.dadSoft }]}>
                <Ionicons name="mic" size={17} color={colors.dad} />
              </View>
              <Text style={styles.settingLabel}>Voice calls</Text>
            </View>
            <Text style={styles.settingValue}>Enabled</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.momSoft }]}>
                <Ionicons name="heart" size={17} color={colors.momDeep} />
              </View>
              <Text style={styles.settingLabel}>App</Text>
            </View>
            <Text style={styles.settingValue}>My Fam · 1.0</Text>
          </View>
        </View>

        <Text style={styles.footer}>Made with warmth, so home never feels far away.</Text>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg },
  title: { fontFamily: font.extrabold, fontSize: 30, color: colors.text, letterSpacing: -0.6, marginBottom: spacing.xl },
  userCard: { backgroundColor: colors.card, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.lg },
  userAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  nameRow: { flexDirection: "row", alignItems: "center" },
  userName: { fontFamily: font.extrabold, fontSize: 22, color: colors.text },
  userSub: { fontFamily: font.regular, fontSize: 13.5, color: colors.textMuted, marginTop: 2 },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  editRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  nameInput: {
    flex: 1,
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.text,
  },
  saveBtn: {
    height: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontFamily: font.bold, fontSize: 14, color: colors.white },
  aiCard: {
    backgroundColor: colors.claySoft,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  aiHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  aiTitle: { fontFamily: font.bold, fontSize: 15.5, color: colors.text },
  aiText: { fontFamily: font.regular, fontSize: 14, color: "#5B4A3E", lineHeight: 21 },
  sectionTitle: { fontFamily: font.bold, fontSize: 15, color: colors.textMuted, marginBottom: spacing.sm, marginLeft: 4 },
  settingsCard: { backgroundColor: colors.card, borderRadius: radius.xl, paddingHorizontal: spacing.lg },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: spacing.md },
  settingLeft: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  settingIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  settingLabel: { fontFamily: font.semibold, fontSize: 15, color: colors.text },
  settingValue: { fontFamily: font.medium, fontSize: 13.5, color: colors.textFaint },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  footer: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textFaint,
    textAlign: "center",
    marginTop: spacing.xl,
  },
});
