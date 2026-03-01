import { Image, StyleSheet, Text, View } from "react-native";
import { Person } from "../../types/family";
import { initialsFromPerson } from "../../lib/familyUtils";

type MemberAvatarProps = {
  person: Person;
  borderColor: string;
  size?: number;
  showPhoto?: boolean;
  initialsFontScale?: number;
};

export const MemberAvatar = ({
  person,
  borderColor,
  size = 44,
  showPhoto = true,
  initialsFontScale = 0.35,
}: MemberAvatarProps) => {
  const photoUrl = person.photoUrl?.trim();
  const hasPhoto = Boolean(photoUrl) && showPhoto;

  if (hasPhoto) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          styles.image,
          {
            width: size,
            height: size,
            borderColor,
            borderRadius: size / 2,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderColor,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.initials, { color: borderColor, fontSize: Math.max(12, Math.floor(size * initialsFontScale)) }]}>
        {initialsFromPerson(person)}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    borderWidth: 2,
    backgroundColor: "#ffffff",
  },
  fallback: {
    borderWidth: 2,
    backgroundColor: "#eef5f2",
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    fontWeight: "800",
    letterSpacing: 0.6,
  },
});
