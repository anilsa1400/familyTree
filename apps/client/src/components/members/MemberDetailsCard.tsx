import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Person } from "../../types/family";
import { uiCommonStyles } from "../../styles/uiStyles";

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

const displayName = (person: Person) => `${person.firstName} ${person.lastName}`.trim();

const memberInitials = (person: Person) => {
  const first = person.firstName.trim().charAt(0).toUpperCase();
  const last = person.lastName.trim().charAt(0).toUpperCase();
  const initials = `${first}${last}`.trim();
  return initials || "M";
};

const formatDate = (value: string | null) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

const memberLifeLabel = (person: Person) => {
  const birthDate = formatDate(person.dateOfBirth);
  const deathDate = formatDate(person.dateOfDeath);

  if (birthDate && deathDate) {
    return `${birthDate} - ${deathDate}`;
  }

  if (birthDate) {
    return `Born ${birthDate}`;
  }

  if (deathDate) {
    return `Died ${deathDate}`;
  }

  return "Dates not set";
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
  const imageUrl = person.photoUrl?.trim();
  const hasPhoto = showMemberPhotos && Boolean(imageUrl);

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
        {hasPhoto ? (
          <Image source={{ uri: imageUrl }} style={[styles.memberDetailAvatar, { borderColor: primaryColor }]} />
        ) : (
          <View style={[styles.memberDetailAvatarFallback, { borderColor: primaryColor }]}>
            <Text style={[styles.memberDetailAvatarInitials, { color: primaryColor }]}>{memberInitials(person)}</Text>
          </View>
        )}

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
  memberDetailAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: "#ffffff",
  },
  memberDetailAvatarFallback: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    backgroundColor: "#eef5f2",
    alignItems: "center",
    justifyContent: "center",
  },
  memberDetailAvatarInitials: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 0.4,
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
