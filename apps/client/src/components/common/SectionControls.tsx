import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { uiCommonStyles } from "../../styles/uiStyles";

export type SectionViewMode = "TILE" | "LIST";

type SettingsToggleProps = {
  label: string;
  value: boolean;
  accentColor: string;
  onPress: () => void;
};

export const SettingsToggle = ({ label, value, accentColor, onPress }: SettingsToggleProps) => (
  <Pressable
    style={[
      styles.settingsToggleRow,
      { borderColor: accentColor },
      value && { backgroundColor: `${accentColor}22` },
      uiCommonStyles.shadowSoft,
    ]}
    onPress={onPress}
  >
    <Text style={styles.settingsToggleLabel}>{label}</Text>
    <View
      style={[
        styles.settingsToggleValuePill,
        { borderColor: accentColor },
        value && { backgroundColor: accentColor, borderColor: accentColor },
      ]}
    >
      <Text style={[styles.settingsToggleValueText, value && { color: "#ffffff" }]}>{value ? "ON" : "OFF"}</Text>
    </View>
  </Pressable>
);

type SectionRefreshButtonProps = {
  primaryColor: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
};

export const SectionRefreshButton = ({ primaryColor, isRefreshing, onRefresh }: SectionRefreshButtonProps) => (
  <Pressable
    style={[styles.refreshButton, { backgroundColor: primaryColor }, uiCommonStyles.shadowSoft]}
    onPress={() => void onRefresh()}
    disabled={isRefreshing}
  >
    {isRefreshing ? (
      <ActivityIndicator size="small" color="#ffffff" />
    ) : (
      <Ionicons name="refresh-outline" size={16} color="#ffffff" />
    )}
    <Text style={styles.refreshButtonText}>{isRefreshing ? "Refreshing..." : "Refresh"}</Text>
  </Pressable>
);

type SectionViewModeToggleProps = {
  primaryColor: string;
  viewMode: SectionViewMode;
  onToggle: () => void;
};

export const SectionViewModeToggle = ({ primaryColor, viewMode, onToggle }: SectionViewModeToggleProps) => {
  const isTile = viewMode === "TILE";

  return (
    <View style={[styles.sectionModeSegmented, { borderColor: primaryColor }, uiCommonStyles.shadowSoft]}>
      <Pressable
        style={[
          styles.sectionModeSegmentButton,
          styles.sectionModeSegmentButtonLeft,
          { borderColor: primaryColor },
          isTile && { backgroundColor: primaryColor },
        ]}
        onPress={!isTile ? onToggle : undefined}
      >
        <Ionicons name="grid-outline" size={15} color={isTile ? "#ffffff" : primaryColor} />
        <Text style={[styles.sectionModeButtonText, { color: isTile ? "#ffffff" : primaryColor }]}>Tile</Text>
      </Pressable>

      <Pressable
        style={[
          styles.sectionModeSegmentButton,
          styles.sectionModeSegmentButtonRight,
          { borderColor: primaryColor },
          !isTile && { backgroundColor: primaryColor },
        ]}
        onPress={isTile ? onToggle : undefined}
      >
        <Ionicons name="list-outline" size={15} color={!isTile ? "#ffffff" : primaryColor} />
        <Text style={[styles.sectionModeButtonText, { color: !isTile ? "#ffffff" : primaryColor }]}>List</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  refreshButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#14332a",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  sectionModeSegmented: {
    borderWidth: 1,
    borderRadius: 999,
    padding: 2,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  sectionModeSegmentButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
  },
  sectionModeSegmentButtonLeft: {
    marginRight: 4,
  },
  sectionModeSegmentButtonRight: {
    marginLeft: 0,
  },
  sectionModeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  settingsToggleRow: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  settingsToggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f4b3d",
  },
  settingsToggleValuePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 52,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  settingsToggleValueText: {
    fontWeight: "700",
    fontSize: 12,
    color: "#2e5f4f",
  },
});
