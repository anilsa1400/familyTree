import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Person } from "../../types/family";
import { initialsFromPerson } from "../../lib/familyUtils";

type MemberAvatarProps = {
  person: Person;
  borderColor: string;
  size?: number;
  showPhoto?: boolean;
  initialsFontScale?: number;
  enablePhotoPreview?: boolean;
};

export const MemberAvatar = ({
  person,
  borderColor,
  size = 44,
  showPhoto = true,
  initialsFontScale = 0.35,
  enablePhotoPreview = true,
}: MemberAvatarProps) => {
  const [isPhotoPreviewVisible, setIsPhotoPreviewVisible] = useState(false);
  const photoUrl = person.photoUrl?.trim();
  const hasPhoto = Boolean(photoUrl) && showPhoto;

  const openPhotoPreview = () => {
    if (!hasPhoto || !enablePhotoPreview) {
      return;
    }

    setIsPhotoPreviewVisible(true);
  };

  const closePhotoPreview = () => {
    setIsPhotoPreviewVisible(false);
  };

  const stopPressPropagation = (event: { stopPropagation?: () => void }) => {
    event.stopPropagation?.();
  };

  if (hasPhoto) {
    return (
      <>
        <Pressable
          onPress={(event) => {
            stopPressPropagation(event);
            openPhotoPreview();
          }}
          disabled={!enablePhotoPreview}
          style={[styles.photoPressable, { borderRadius: size / 2 }]}
        >
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
        </Pressable>

        {isPhotoPreviewVisible ? (
          <Modal transparent visible animationType="fade" onRequestClose={closePhotoPreview}>
            <View style={styles.photoPreviewOverlay}>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={(event) => {
                  stopPressPropagation(event);
                  closePhotoPreview();
                }}
              />
              <View style={styles.photoPreviewFrame}>
                <Image source={{ uri: photoUrl }} style={styles.photoPreviewImage} resizeMode="contain" />
              </View>
              <Pressable
                style={styles.photoPreviewCloseButton}
                onPress={(event) => {
                  stopPressPropagation(event);
                  closePhotoPreview();
                }}
              >
                <Ionicons name="close" size={18} color="#ffffff" />
              </Pressable>
            </View>
          </Modal>
        ) : null}
      </>
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
  photoPressable: {
    alignSelf: "flex-start",
  },
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
  photoPreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(8, 14, 18, 0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  photoPreviewFrame: {
    width: "96%",
    maxWidth: 960,
    height: "84%",
    maxHeight: 960,
    alignItems: "center",
    justifyContent: "center",
  },
  photoPreviewImage: {
    width: "100%",
    height: "100%",
  },
  photoPreviewCloseButton: {
    position: "absolute",
    top: 16,
    right: 16,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
});
