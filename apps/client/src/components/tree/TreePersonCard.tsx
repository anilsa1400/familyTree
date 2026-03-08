import { Pressable, StyleSheet, Text, View } from "react-native";
import { MemberAvatar } from "../common/MemberAvatar";
import { Person } from "../../types/family";
import { displayName, formatDate } from "../../lib/familyUtils";
import { uiCommonStyles } from "../../styles/uiStyles";

type SectionViewMode = "TILE" | "LIST";

type TreePersonCardProps = {
  person: Person;
  primaryColor: string;
  showMemberPhotos: boolean;
  familyName: string;
  viewMode: SectionViewMode;
  cardWidth: number;
  cardHeight: number;
  spouseNames?: string[];
  onPressPerson?: (personId: string) => void;
  onShowSpouse?: (personId: string) => void;
  onShowChildren?: (personId: string) => void;
  isShowSpouseActive?: boolean;
  isShowChildrenActive?: boolean;
  isFocused?: boolean;
};

export const TreePersonCard = ({
  person,
  primaryColor,
  showMemberPhotos,
  familyName,
  viewMode,
  cardWidth,
  cardHeight,
  spouseNames = [],
  onPressPerson,
  onShowSpouse,
  onShowChildren,
  isShowSpouseActive = false,
  isShowChildrenActive = false,
  isFocused = false,
}: TreePersonCardProps) => {
  const avatarSize = viewMode === "TILE" ? 54 : 48;
  const spouseSummary = spouseNames.slice(0, 2).join(", ");
  const hasSpouseSummary = spouseSummary.trim().length > 0;
  const genderLabel = person.gender ? person.gender.replace(/_/g, " ") : "Unspecified";
  const birthLabel = person.dateOfBirth ? formatDate(person.dateOfBirth) : "Not set";
  const deathLabel = person.dateOfDeath ? formatDate(person.dateOfDeath) : "Alive";
  const isDeceased = Boolean(person.dateOfDeath);
  const notesPreview = person.notes?.trim() || "No notes provided.";

  return (
    <Pressable
      style={[
        styles.treePersonTile,
        viewMode === "TILE" && styles.treePersonTilePortrait,
        { width: cardWidth, minHeight: cardHeight },
        isFocused && { borderWidth: 2, borderColor: primaryColor },
        { borderColor: primaryColor, backgroundColor: "#ffffff" },
        uiCommonStyles.shadowSoft,
      ]}
      onPress={onPressPerson ? () => onPressPerson(person.id) : undefined}
    >
      <View style={styles.treePersonHeaderRow}>
        <View style={[styles.treePersonAvatarWrap, { borderColor: primaryColor, backgroundColor: "#ffffff" }]}>
          <MemberAvatar
            person={person}
            borderColor={primaryColor}
            size={avatarSize}
            showPhoto={showMemberPhotos}
            initialsFontScale={0.35}
          />
        </View>
        <View style={styles.treePersonDetailColumn}>
          <Text style={styles.treeName} numberOfLines={2}>
            {displayName(person)}
          </Text>
          <Text style={styles.treeMeta} numberOfLines={1}>
            {familyName} Family
          </Text>
        </View>
      </View>

      <View style={styles.treeMetaBadgeRow}>
        <View style={[styles.treeMetaBadge, { borderColor: primaryColor }]}>
          <Text style={[styles.treeMetaBadgeText, { color: primaryColor }]}>{genderLabel}</Text>
        </View>
        {isDeceased ? (
          <View style={styles.treeStatusBadge}>
            <Text style={styles.treeStatusBadgeText}>RIP</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.treeInfoPill}>
        <Text style={styles.treeInfoPillText} numberOfLines={1}>
          DOB: {birthLabel}
        </Text>
      </View>
      <View style={styles.treeInfoPill}>
        <Text style={styles.treeInfoPillText} numberOfLines={1}>
          DOD: {deathLabel}
        </Text>
      </View>
      {hasSpouseSummary ? (
        <View style={styles.treeInfoPill}>
          <Text style={styles.treeInfoPillText} numberOfLines={2}>
            Partner: {spouseSummary}
          </Text>
        </View>
      ) : null}
      <Text style={styles.treeMemberNotes} numberOfLines={3}>
        {notesPreview}
      </Text>

      {onShowSpouse || onShowChildren ? (
        <View style={styles.treeActionRow}>
          {onShowSpouse ? (
            <Pressable
              style={[
                styles.treeActionButton,
                { borderColor: primaryColor },
                isShowSpouseActive && { backgroundColor: primaryColor },
              ]}
              onPress={(event) => {
                event.stopPropagation();
                onShowSpouse(person.id);
              }}
            >
              <Text style={[styles.treeActionButtonText, { color: isShowSpouseActive ? "#ffffff" : primaryColor }]}>
                Show Spouse
              </Text>
            </Pressable>
          ) : null}
          {onShowChildren ? (
            <Pressable
              style={[
                styles.treeActionButton,
                { borderColor: primaryColor },
                isShowChildrenActive && { backgroundColor: primaryColor },
              ]}
              onPress={(event) => {
                event.stopPropagation();
                onShowChildren(person.id);
              }}
            >
              <Text style={[styles.treeActionButtonText, { color: isShowChildrenActive ? "#ffffff" : primaryColor }]}>
                Show Children
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  treePersonTile: {
    borderWidth: 1,
    borderColor: "#d8e3df",
    borderRadius: 12,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    alignItems: "stretch",
    justifyContent: "flex-start",
    gap: 7,
    flexShrink: 0,
  },
  treePersonTilePortrait: {
    flex: 0,
  },
  treePersonAvatarWrap: {
    borderWidth: 2,
    borderRadius: 28,
    padding: 1,
    alignSelf: "flex-start",
  },
  treePersonHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
  },
  treePersonDetailColumn: {
    flex: 1,
    minWidth: 0,
    alignItems: "flex-start",
    gap: 2,
  },
  treeName: {
    fontWeight: "800",
    color: "#1b2e29",
    fontSize: 14,
    lineHeight: 18,
    textAlign: "left",
  },
  treeMeta: {
    color: "#2f4740",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "left",
  },
  treeInfoPill: {
    width: "100%",
    backgroundColor: "#eef4f1",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: "#d7e3de",
  },
  treeInfoPillText: {
    color: "#2f4740",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "left",
    lineHeight: 14,
  },
  treeMetaBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  treeMetaBadge: {
    borderWidth: 1,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingVertical: 3,
    paddingHorizontal: 9,
  },
  treeMetaBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  treeStatusBadge: {
    backgroundColor: "#f45151",
    borderRadius: 999,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  treeStatusBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  treeMemberNotes: {
    marginTop: 1,
    fontSize: 11,
    lineHeight: 15,
    color: "#49685d",
    fontWeight: "500",
  },
  treeActionRow: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    width: "100%",
  },
  treeActionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 7,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  treeActionButtonText: {
    fontSize: 10,
    fontWeight: "700",
  },
});
