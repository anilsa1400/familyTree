import { Pressable, StyleSheet, Text, View } from "react-native";
import { Person } from "../../types/family";
import { uiCommonStyles } from "../../styles/uiStyles";
import { displayName, memberLifeLabel } from "../../lib/familyUtils";
import { MemberAvatar } from "../common/MemberAvatar";

type MemberDetailsCardProps = {
  person: Person;
  familyName: string;
  primaryColor: string;
  secondaryColor: string;
  showMemberPhotos: boolean;
  isSelected: boolean;
  cardWidth: number | "100%";
  onPress: () => void;
};

export const MemberDetailsCard = ({
  person,
  familyName,
  primaryColor,
  secondaryColor,
  showMemberPhotos,
  isSelected,
  cardWidth,
  onPress,
}: MemberDetailsCardProps) => {
  const genderLabel = person.gender ? person.gender.replace(/_/g, " ") : "Unspecified";
  const notesPreview = person.notes?.trim() || "No notes provided.";

  return (
    <Pressable
      style={[
        styles.memberDetailCard,
        { width: cardWidth, borderColor: primaryColor },
        isSelected
          ? { borderColor: primaryColor, backgroundColor: `${primaryColor}1a` }
          : { backgroundColor: "#ffffff" },
        uiCommonStyles.shadowSoft,
      ]}
      onPress={onPress}
    >
      <View style={styles.memberDetailHeaderRow}>
        <MemberAvatar person={person} borderColor={primaryColor} size={52} showPhoto={showMemberPhotos} initialsFontScale={0.34} />

        <View style={styles.memberDetailHeaderText}>
          <Text style={styles.memberDetailName} numberOfLines={2}>
            {displayName(person)}
          </Text>
          <Text style={styles.memberDetailFamily} numberOfLines={1}>
            {familyName} Family
          </Text>
        </View>
      </View>

      <View style={styles.memberDetailTagRow}>
        <View style={[styles.memberDetailTag, { borderColor: primaryColor, backgroundColor: `${secondaryColor}` }]}>
          <Text style={[styles.memberDetailTagText, { color: primaryColor }]}>{genderLabel}</Text>
        </View>
        {person.dateOfDeath ? (
          <View style={styles.memberDetailStatusTag}>
            <Text style={styles.memberDetailStatusTagText}>RIP</Text>
          </View>
        ) : null}
      </View>

      <Text style={styles.memberDetailMetaLine}>{memberLifeLabel(person)}</Text>
      <Text style={styles.memberDetailNotes} numberOfLines={3}>
        {notesPreview}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  memberDetailCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    minHeight: 170,
  },
  memberDetailHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memberDetailHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  memberDetailName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1b2e29",
    lineHeight: 18,
  },
  memberDetailFamily: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
    color: "#3a5a4f",
  },
  memberDetailTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    marginBottom: 6,
  },
  memberDetailTag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  memberDetailTagText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  memberDetailStatusTag: {
    borderRadius: 999,
    backgroundColor: "#d43838",
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  memberDetailStatusTagText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#ffffff",
  },
  memberDetailMetaLine: {
    fontSize: 12,
    color: "#355247",
    fontWeight: "600",
    marginBottom: 4,
  },
  memberDetailNotes: {
    fontSize: 12,
    lineHeight: 16,
    color: "#49685d",
    fontWeight: "500",
  },
});
