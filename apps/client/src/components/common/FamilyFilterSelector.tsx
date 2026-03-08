import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { uiCommonStyles } from "../../styles/uiStyles";

type FamilyFilterSelectorProps = {
  familyNames: string[];
  selectedFamilyName: string | null;
  primaryColor: string;
  onSelectFamily: (familyName: string | null) => void;
  allowAllFamilies?: boolean;
};

export const FamilyFilterSelector = ({
  familyNames,
  selectedFamilyName,
  primaryColor,
  onSelectFamily,
  allowAllFamilies = true,
}: FamilyFilterSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  if (familyNames.length === 0) {
    return null;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredFamilyNames = normalizedQuery
    ? familyNames.filter((familyName) => familyName.toLowerCase().includes(normalizedQuery))
    : familyNames;
  const selectedLabel =
    selectedFamilyName ?? (allowAllFamilies ? "All Families" : familyNames[0] ?? "Select Family");

  return (
    <View style={styles.familyFilterBlock}>
      <Text style={styles.familyFilterLabel}>Viewing Family</Text>
      <View style={styles.familyDropdownContainer}>
        <Pressable
          style={[styles.familyDropdownTrigger, { borderColor: primaryColor, backgroundColor: "#ffffff" }, uiCommonStyles.shadowSoft]}
          onPress={() => {
            setSearchQuery("");
            setIsOpen(true);
          }}
        >
          <Text style={[styles.familyDropdownTriggerText, { color: primaryColor }]} numberOfLines={1}>
            {selectedLabel}
          </Text>
          <Ionicons name="chevron-down" size={16} color={primaryColor} />
        </Pressable>

        <Modal
          transparent
          animationType="fade"
          visible={isOpen}
          onRequestClose={() => {
            setIsOpen(false);
            setSearchQuery("");
          }}
        >
          <View style={styles.familyDropdownOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setIsOpen(false);
                setSearchQuery("");
              }}
            />
            <View style={[styles.familyDropdownMenu, { borderColor: primaryColor, backgroundColor: "#ffffff" }, uiCommonStyles.shadowStrong]}>
              <View style={styles.familyDropdownHeaderRow}>
                <Text style={[styles.familyDropdownTitle, { color: primaryColor }]}>Select Family</Text>
                <Pressable
                  style={[styles.familyDropdownCloseButton, { borderColor: primaryColor }]}
                  onPress={() => {
                    setIsOpen(false);
                    setSearchQuery("");
                  }}
                >
                  <Ionicons name="close" size={15} color={primaryColor} />
                </Pressable>
              </View>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search family..."
                autoCapitalize="none"
                autoFocus
                style={[styles.familyDropdownSearchInput, { borderColor: primaryColor }]}
              />
              <ScrollView style={styles.familyDropdownList} nestedScrollEnabled>
                {allowAllFamilies ? (
                  <Pressable
                    style={[
                      styles.familyDropdownOption,
                      { borderColor: primaryColor },
                      selectedFamilyName === null && { backgroundColor: `${primaryColor}1f` },
                    ]}
                    onPress={() => {
                      onSelectFamily(null);
                      setIsOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    <Text style={[styles.familyDropdownOptionText, { color: primaryColor }]}>All Families</Text>
                    {selectedFamilyName === null ? <Ionicons name="checkmark" size={15} color={primaryColor} /> : null}
                  </Pressable>
                ) : null}
                {filteredFamilyNames.length > 0 ? (
                  filteredFamilyNames.map((familyName) => {
                    const isSelected = selectedFamilyName === familyName;
                    return (
                      <Pressable
                        key={`family-dropdown-option-${familyName}`}
                        style={[
                          styles.familyDropdownOption,
                          { borderColor: primaryColor },
                          isSelected && { backgroundColor: `${primaryColor}1f` },
                        ]}
                        onPress={() => {
                          onSelectFamily(familyName);
                          setIsOpen(false);
                          setSearchQuery("");
                        }}
                      >
                        <Text style={[styles.familyDropdownOptionText, { color: primaryColor }]}>{familyName}</Text>
                        {isSelected ? <Ionicons name="checkmark" size={15} color={primaryColor} /> : null}
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.familyDropdownNoResults}>No matching family found.</Text>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  familyFilterBlock: {
    marginBottom: 10,
  },
  familyFilterLabel: {
    marginBottom: 4,
    fontSize: 12,
    fontWeight: "700",
    color: "#1f4b3d",
  },
  familyDropdownContainer: {
    position: "relative",
    zIndex: 12,
  },
  familyDropdownTrigger: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  familyDropdownTriggerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    marginRight: 8,
  },
  familyDropdownMenu: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    maxHeight: "80%",
  },
  familyDropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(16, 28, 22, 0.34)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  familyDropdownHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    gap: 8,
  },
  familyDropdownTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  familyDropdownCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  familyDropdownSearchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 8,
    marginBottom: 8,
    fontSize: 13,
  },
  familyDropdownList: {
    maxHeight: 180,
  },
  familyDropdownOption: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  familyDropdownOptionText: {
    fontSize: 13,
    fontWeight: "600",
  },
  familyDropdownNoResults: {
    paddingVertical: 8,
    paddingHorizontal: 2,
    fontSize: 12,
    color: "#5f7d72",
    fontWeight: "600",
  },
});
