import { createElement } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

const basicColorPickerPalette = [
  "#2e5f4f",
  "#1e5d8c",
  "#a24d2f",
  "#3a4552",
  "#2a9d8f",
  "#fb8500",
  "#5e548e",
  "#ef476f",
  "#ffd166",
  "#06d6a0",
  "#118ab2",
  "#ffffff",
  "#000000",
];

const toHexSix = (value: string) => {
  const trimmed = value.trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    const [red, green, blue] = trimmed.slice(1).split("");
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }

  return "#2e5f4f";
};

type ColorPickerFieldProps = {
  label: string;
  selectedColor: string;
  onSelectColor: (value: string) => void;
};

export const ColorPickerField = ({ label, selectedColor, onSelectColor }: ColorPickerFieldProps) => {
  const webColorInputValue = toHexSix(selectedColor);
  const isWeb = Platform.OS === "web";

  return (
    <View style={styles.colorPickerBlock}>
      <View style={styles.colorPickerHeaderRow}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.colorPickerValueChip}>
          <View style={[styles.colorPickerValueDot, { backgroundColor: selectedColor }]} />
          <Text style={styles.colorPickerValueText}>{selectedColor.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.colorPickerControlRow}>
        {isWeb ? (
          <View style={styles.webColorPickerFrame}>
            {createElement("input", {
              type: "color",
              value: webColorInputValue,
              onChange: (event: { target?: { value?: string } }) => {
                const value = event.target?.value;
                if (value) {
                  onSelectColor(value);
                }
              },
              style: {
                width: 42,
                height: 32,
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
              },
            })}
          </View>
        ) : (
          <View style={styles.basicPaletteRow}>
            {basicColorPickerPalette.map((colorValue) => {
              const isSelected = selectedColor.trim().toLowerCase() === colorValue.toLowerCase();
              return (
                <Pressable
                  key={`${label}-fallback-${colorValue}`}
                  style={[styles.basicPaletteSwatchButton, isSelected && styles.basicPaletteSwatchButtonActive]}
                  onPress={() => onSelectColor(colorValue)}
                >
                  <View style={[styles.basicPaletteSwatch, { backgroundColor: colorValue }]} />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  colorPickerBlock: {
    marginBottom: 8,
  },
  colorPickerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  label: {
    marginBottom: 4,
    fontWeight: "600",
    color: "#1f4b3d",
  },
  colorPickerValueChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#bfd1c9",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: "#ffffff",
  },
  colorPickerValueDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#9db2a8",
  },
  colorPickerValueText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1f4b3d",
    letterSpacing: 0.4,
  },
  colorPickerControlRow: {
    marginBottom: 8,
  },
  webColorPickerFrame: {
    borderWidth: 1,
    borderColor: "#c2d5cc",
    borderRadius: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
  },
  basicPaletteRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  basicPaletteSwatchButton: {
    width: 26,
    height: 26,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#b8ccc2",
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  basicPaletteSwatchButtonActive: {
    borderWidth: 2,
    borderColor: "#1f4b3d",
  },
  basicPaletteSwatch: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#d2e2da",
  },
});
