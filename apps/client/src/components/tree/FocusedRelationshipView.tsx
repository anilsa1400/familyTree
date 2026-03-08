import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { displayName, familyNameFromLastName } from "../../lib/familyUtils";
import { Person } from "../../types/family";
import { uiCommonStyles } from "../../styles/uiStyles";
import { TreePersonCard } from "./TreePersonCard";

type SectionViewMode = "TILE" | "LIST";

type FocusedRelationshipViewProps = {
  focusedPerson: Person;
  spouses: Person[];
  children: Person[];
  primaryColor: string;
  secondaryColor: string;
  showMemberPhotos: boolean;
  viewMode: SectionViewMode;
  cardWidth: number;
  cardHeight: number;
  familyNameByPersonId: Map<string, string>;
  spouseNamesByPersonId: Map<string, string[]>;
  onSelectPerson: (personId: string) => void;
  onClearFocus: () => void;
};

const familyNameForPerson = (person: Person, familyNameByPersonId: Map<string, string>) =>
  familyNameByPersonId.get(person.id) ?? familyNameFromLastName(person.lastName);

const clampValue = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const FocusedRelationshipView = ({
  focusedPerson,
  spouses,
  children,
  primaryColor,
  secondaryColor,
  showMemberPhotos,
  viewMode,
  cardWidth,
  cardHeight,
  familyNameByPersonId,
  spouseNamesByPersonId,
  onSelectPerson,
  onClearFocus,
}: FocusedRelationshipViewProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const hasChildren = children.length > 0;
  const primarySpouse = spouses[0] ?? null;
  const additionalSpouses = spouses.slice(1);
  const hasPrimarySpouse = Boolean(primarySpouse);

  const isSmallScreen = screenWidth < 560;
  const lineThickness = 2;
  const spouseConnectorWidth = isSmallScreen ? 24 : 30;
  const childrenGap = isSmallScreen ? (viewMode === "LIST" ? 10 : 8) : viewMode === "LIST" ? 12 : 10;
  const minFocusedCardWidth = isSmallScreen ? 148 : 176;
  const availablePairWidth = Math.max(
    minFocusedCardWidth * (hasPrimarySpouse ? 2 : 1) + (hasPrimarySpouse ? spouseConnectorWidth : 0),
    Math.floor(screenWidth - (viewMode === "LIST" ? 122 : 56)),
  );
  const focusedCardWidth = hasPrimarySpouse
    ? clampValue(Math.floor((availablePairWidth - spouseConnectorWidth) / 2), minFocusedCardWidth, cardWidth)
    : clampValue(Math.min(cardWidth, availablePairWidth), minFocusedCardWidth, cardWidth);
  const focusedCardHeight = Math.max(210, Math.round(cardHeight * (focusedCardWidth / cardWidth)));

  const cardCenter = focusedCardWidth / 2;
  const childCenterOffset = cardCenter - lineThickness / 2;
  const childrenTrackWidth = hasChildren
    ? children.length * focusedCardWidth + Math.max(0, children.length - 1) * childrenGap
    : focusedCardWidth;
  const childrenBranchWidth = Math.max(0, childrenTrackWidth - focusedCardWidth);

  const parentPairWidth = hasPrimarySpouse ? focusedCardWidth * 2 + spouseConnectorWidth : focusedCardWidth;
  const parentLeftCenter = cardCenter;
  const parentRightCenter = hasPrimarySpouse ? focusedCardWidth + spouseConnectorWidth + cardCenter : cardCenter;
  const parentMiddleCenter = Math.round((parentLeftCenter + parentRightCenter) / 2);
  const relationshipTrackWidth = Math.max(parentPairWidth, childrenTrackWidth);

  return (
    <View
      style={[
        styles.focusedLayoutContainer,
        { borderColor: primaryColor, backgroundColor: `${secondaryColor}66` },
        uiCommonStyles.shadowSoft,
      ]}
    >
      <View style={styles.focusedHeaderRow}>
        <Text style={[styles.focusedTitle, { color: primaryColor }]}>Focused Relationship View</Text>
        <Pressable
          style={[
            styles.clearFocusButton,
            { borderColor: primaryColor, backgroundColor: "#ffffff" },
            uiCommonStyles.shadowSoft,
          ]}
          onPress={onClearFocus}
        >
          <Ionicons name="close-circle-outline" size={15} color={primaryColor} />
          <Text style={[styles.clearFocusButtonText, { color: primaryColor }]}>Clear Focus</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.relationshipCanvasScrollContent}
      >
        <View style={[styles.relationshipCanvas, { width: relationshipTrackWidth }]}>
          <View
            style={[
              styles.partnerSpouseRow,
              hasPrimarySpouse ? { width: parentPairWidth } : null,
            ]}
          >
            <TreePersonCard
              person={focusedPerson}
              primaryColor={primaryColor}
              showMemberPhotos={showMemberPhotos}
              familyName={familyNameForPerson(focusedPerson, familyNameByPersonId)}
              viewMode={viewMode}
              cardWidth={focusedCardWidth}
              cardHeight={focusedCardHeight}
              spouseNames={spouseNamesByPersonId.get(focusedPerson.id) ?? []}
              onPressPerson={(personId) => {
                if (personId === focusedPerson.id) {
                  onClearFocus();
                  return;
                }
                onSelectPerson(personId);
              }}
              isFocused
            />

            {hasPrimarySpouse ? (
              <View style={styles.spouseLinkedItemInline}>
                <View style={[styles.horizontalLinkRow, { width: spouseConnectorWidth }]}>
                  <View style={[styles.horizontalLinkLine, { backgroundColor: primaryColor, height: lineThickness }]} />
                  <Ionicons style={styles.horizontalLinkArrow} name="arrow-forward" size={14} color={primaryColor} />
                </View>
                <TreePersonCard
                  person={primarySpouse}
                  primaryColor={primaryColor}
                  showMemberPhotos={showMemberPhotos}
                  familyName={familyNameForPerson(primarySpouse, familyNameByPersonId)}
                  viewMode={viewMode}
                  cardWidth={focusedCardWidth}
                  cardHeight={focusedCardHeight}
                  spouseNames={spouseNamesByPersonId.get(primarySpouse.id) ?? []}
                  onPressPerson={onSelectPerson}
                />
              </View>
            ) : null}
          </View>

          <View style={styles.directionHeaderRow}>
            <Text style={[styles.directionLabel, { color: primaryColor }]}>Children</Text>
          </View>

          {hasChildren ? (
            <>
              <View style={[styles.parentChildrenBridge, { width: parentPairWidth }]}>
                {hasPrimarySpouse ? (
                  <>
                    <View
                      style={[
                        styles.parentDropLine,
                        { left: parentLeftCenter - lineThickness / 2, backgroundColor: primaryColor, width: lineThickness },
                      ]}
                    />
                    <View
                      style={[
                        styles.parentDropLine,
                        { left: parentRightCenter - lineThickness / 2, backgroundColor: primaryColor, width: lineThickness },
                      ]}
                    />
                    <View
                      style={[
                        styles.parentJoinLine,
                        {
                          left: parentLeftCenter,
                          width: parentRightCenter - parentLeftCenter,
                          backgroundColor: primaryColor,
                          height: lineThickness,
                        },
                      ]}
                    />
                  </>
                ) : null}
                <View
                  style={[
                    styles.parentCenterLine,
                    {
                      left: parentMiddleCenter - lineThickness / 2,
                      backgroundColor: primaryColor,
                      width: lineThickness,
                    },
                  ]}
                />
              </View>

              <View style={[styles.childrenNetwork, { width: childrenTrackWidth }]}>
                {children.length > 1 ? (
                  <View
                    style={[
                      styles.childrenBranchLine,
                      {
                        left: childCenterOffset + lineThickness / 2,
                        width: childrenBranchWidth,
                        backgroundColor: primaryColor,
                        height: lineThickness,
                      },
                    ]}
                  />
                ) : null}
                <View style={[styles.childrenRow, { gap: childrenGap }]}>
                  {children.map((child) => (
                    <View key={`focused-child-${child.id}`} style={[styles.childLinkedItem, { width: focusedCardWidth }]}>
                      <View
                        style={[
                          styles.childDropLine,
                          { marginLeft: childCenterOffset, backgroundColor: primaryColor, width: lineThickness },
                        ]}
                      />
                      <TreePersonCard
                        person={child}
                        primaryColor={primaryColor}
                        showMemberPhotos={showMemberPhotos}
                        familyName={familyNameForPerson(child, familyNameByPersonId)}
                        viewMode={viewMode}
                        cardWidth={focusedCardWidth}
                        cardHeight={focusedCardHeight}
                        spouseNames={spouseNamesByPersonId.get(child.id) ?? []}
                        onPressPerson={onSelectPerson}
                      />
                    </View>
                  ))}
                </View>
              </View>
            </>
          ) : (
            <Text style={styles.emptyRelationText}>No direct children linked.</Text>
          )}
        </View>
      </ScrollView>

      {additionalSpouses.length > 0 ? (
        <View style={styles.additionalSpousesRow}>
          {additionalSpouses.map((spouse) => (
            <View key={`focused-spouse-extra-${spouse.id}`} style={styles.additionalSpouseItem}>
              <View style={[styles.horizontalLinkRow, { width: spouseConnectorWidth }]}>
                <View style={[styles.horizontalLinkLine, { backgroundColor: primaryColor }]} />
                <Ionicons style={styles.horizontalLinkArrow} name="arrow-forward" size={14} color={primaryColor} />
              </View>
              <TreePersonCard
                person={spouse}
                primaryColor={primaryColor}
                showMemberPhotos={showMemberPhotos}
                familyName={familyNameForPerson(spouse, familyNameByPersonId)}
                viewMode={viewMode}
                cardWidth={focusedCardWidth}
                cardHeight={focusedCardHeight}
                spouseNames={spouseNamesByPersonId.get(spouse.id) ?? []}
                onPressPerson={onSelectPerson}
              />
            </View>
          ))}
        </View>
      ) : null}

      <Text style={styles.focusHintText}>
        Selected member: {displayName(focusedPerson)}. Tap another card to shift focus.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  focusedLayoutContainer: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    gap: 0,
  },
  focusedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  focusedTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  clearFocusButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  clearFocusButtonText: {
    fontSize: 11,
    fontWeight: "700",
  },
  partnerSpouseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "nowrap",
    gap: 0,
    alignSelf: "center",
  },
  relationshipCanvasScrollContent: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: "100%",
  },
  relationshipCanvas: {
    alignItems: "center",
    gap: 0,
  },
  additionalSpousesRow: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  additionalSpouseItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  directionHeaderRow: {
    marginTop: 8,
    marginBottom: 4,
  },
  directionLabel: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  spouseLinkedItemInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  horizontalLinkRow: {
    width: 30,
    height: 18,
    justifyContent: "center",
    marginHorizontal: -1.5,
  },
  horizontalLinkLine: {
    height: 2,
    width: "100%",
    borderRadius: 2,
  },
  horizontalLinkArrow: {
    position: "absolute",
    right: -1,
    top: 2,
  },
  parentChildrenBridge: {
    alignSelf: "center",
    height: 30,
    position: "relative",
    marginTop: -1.5,
  },
  parentDropLine: {
    width: 2,
    height: 10,
    position: "absolute",
    top: -1,
    borderRadius: 2,
  },
  parentJoinLine: {
    height: 2,
    position: "absolute",
    top: 9,
    borderRadius: 2,
  },
  parentCenterLine: {
    width: 2,
    height: 22,
    position: "absolute",
    top: 9,
    borderRadius: 2,
  },
  childrenNetwork: {
    alignSelf: "center",
    position: "relative",
    marginTop: -1.5,
  },
  childrenBranchLine: {
    position: "absolute",
    top: 0,
    height: 2,
    borderRadius: 2,
  },
  childrenRow: {
    flexDirection: "row",
    flexWrap: "nowrap",
    justifyContent: "center",
    paddingTop: 0,
  },
  childLinkedItem: {
    alignItems: "stretch",
  },
  childDropLine: {
    width: 2,
    height: 16,
    borderRadius: 2,
    marginTop: -1.5,
  },
  emptyRelationText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4f6f63",
    paddingVertical: 4,
  },
  focusHintText: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: "600",
    color: "#46665a",
  },
});
