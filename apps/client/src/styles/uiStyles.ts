import { StyleSheet } from "react-native";

export const uiTokens = {
  colors: {
    white: "#ffffff",
    textPrimary: "#1f4b3d",
    borderSoft: "#c2d5cc",
    borderSubtle: "#d2e2da",
    shadow: "#000000",
  },
  radius: {
    sm: 8,
    md: 10,
    lg: 12,
    pill: 999,
  },
};

export const uiCommonStyles = StyleSheet.create({
  panel: {
    backgroundColor: uiTokens.colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d9e6de",
    marginBottom: 16,
  },
  shadowSoft: {
    shadowColor: uiTokens.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  shadowStrong: {
    shadowColor: uiTokens.colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
  },
  label: {
    marginBottom: 4,
    fontWeight: "600",
    color: uiTokens.colors.textPrimary,
  },
  panelTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#14332a",
  },
  panelHint: {
    marginTop: 4,
    marginBottom: 12,
    color: "#517467",
  },
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  panelHeaderTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  panelHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: uiTokens.colors.borderSoft,
    borderRadius: uiTokens.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 10,
    backgroundColor: uiTokens.colors.white,
  },
  subsectionTitle: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#153a2f",
  },
  optionRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  },
  optionButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: uiTokens.radius.pill,
    borderWidth: 1,
    borderColor: "#b8ccc2",
  },
  optionButtonText: {
    color: "#2e5f4f",
    fontWeight: "600",
    fontSize: 12,
  },
  optionButtonTextActive: {
    color: "#ffffff",
  },
  selectorRow: {
    marginBottom: 12,
  },
  selectorPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: uiTokens.radius.pill,
    borderWidth: 1,
    borderColor: "#b8ccc2",
    marginRight: 8,
    backgroundColor: uiTokens.colors.white,
  },
  selectorPillText: {
    color: "#2e5f4f",
    fontWeight: "600",
  },
  selectorPillTextActive: {
    color: "#ffffff",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: uiTokens.radius.md,
    backgroundColor: "#2e5f4f",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: uiTokens.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryDangerButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: uiTokens.radius.md,
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#d43838",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: uiTokens.colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  secondaryDangerButtonText: {
    color: "#d43838",
    fontWeight: "700",
  },
});
