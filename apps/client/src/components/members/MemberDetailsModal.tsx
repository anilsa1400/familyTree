import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { displayName, formatDate, memberLifeLabel, toNullable } from "../../lib/familyUtils";
import { Gender, Person, PersonInput } from "../../types/family";
import { MemberAvatar } from "../common/MemberAvatar";
import { OptionChip, OptionChips } from "../common/OptionChips";
import { uiCommonStyles } from "../../styles/uiStyles";

type MemberDetailsModalProps = {
  visible: boolean;
  person: Person | null;
  familyName: string;
  primaryColor: string;
  secondaryColor: string;
  showMemberPhotos: boolean;
  isMutating: boolean;
  onClose: () => void;
  onSave: (personId: string, payload: PersonInput) => Promise<void>;
  onShowRelations?: (personId: string) => void;
};

type ModalMode = "VIEW" | "EDIT";

type MemberFormState = {
  firstName: string;
  lastName: string;
  gender: Gender | "";
  dateOfBirth: string;
  dateOfDeath: string;
  photoUrl: string;
  notes: string;
};

const genderOptions: OptionChip<Gender | "">[] = [
  { value: "", label: "Unspecified" },
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "NON_BINARY", label: "Non Binary" },
  { value: "OTHER", label: "Other" },
];

const toFormState = (person: Person): MemberFormState => ({
  firstName: person.firstName,
  lastName: person.lastName,
  gender: person.gender ?? "",
  dateOfBirth: formatDate(person.dateOfBirth),
  dateOfDeath: formatDate(person.dateOfDeath),
  photoUrl: person.photoUrl ?? "",
  notes: person.notes ?? "",
});

const formatTimestamp = (value: string | null) => {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
};

const detailValue = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized && normalized.length > 0 ? normalized : "Not set";
};

export const MemberDetailsModal = ({
  visible,
  person,
  familyName,
  primaryColor,
  secondaryColor,
  showMemberPhotos,
  isMutating,
  onClose,
  onSave,
  onShowRelations,
}: MemberDetailsModalProps) => {
  const [mode, setMode] = useState<ModalMode>("VIEW");
  const [formState, setFormState] = useState<MemberFormState | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [photoPickerError, setPhotoPickerError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !person) {
      return;
    }

    setMode("VIEW");
    setFormState(toFormState(person));
    setValidationError(null);
    setPhotoPickerError(null);
  }, [visible, person]);

  const openEditMode = () => {
    if (!person) {
      return;
    }

    setMode("EDIT");
    setFormState(toFormState(person));
    setValidationError(null);
    setPhotoPickerError(null);
  };

  const cancelEditMode = () => {
    if (!person) {
      setMode("VIEW");
      return;
    }

    setMode("VIEW");
    setFormState(toFormState(person));
    setValidationError(null);
    setPhotoPickerError(null);
  };

  const saveMember = async () => {
    if (!person || !formState) {
      return;
    }

    const firstName = formState.firstName.trim();
    const lastName = formState.lastName.trim();

    if (!firstName || !lastName) {
      setValidationError("First name and last name are required.");
      return;
    }

    setValidationError(null);

    const payload: PersonInput = {
      firstName,
      lastName,
      gender: formState.gender || null,
      dateOfBirth: toNullable(formState.dateOfBirth),
      dateOfDeath: toNullable(formState.dateOfDeath),
      photoUrl: toNullable(formState.photoUrl),
      notes: toNullable(formState.notes),
    };

    await onSave(person.id, payload);
    setMode("VIEW");
    onClose();
  };

  const uploadPhoto = async () => {
    if (!formState) {
      return;
    }

    setPhotoPickerError(null);

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoPickerError("Media library permission is required to upload a photo.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        base64: true,
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.base64) {
        setPhotoPickerError("Unable to read selected image. Please try another image.");
        return;
      }

      const mimeType = asset.mimeType || "image/jpeg";
      const dataUrl = `data:${mimeType};base64,${asset.base64}`;
      setFormState((previous) => {
        if (!previous) {
          return previous;
        }

        return {
          ...previous,
          photoUrl: dataUrl,
        };
      });
    } catch {
      setPhotoPickerError("Image upload failed. Please try again.");
    }
  };

  const removePhoto = () => {
    setFormState((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        photoUrl: "",
      };
    });
    setPhotoPickerError(null);
  };

  const isUploadedDataUrl = Boolean(formState?.photoUrl.trim().startsWith("data:"));

  const genderLabel = useMemo(() => {
    if (!person?.gender) {
      return "Unspecified";
    }

    return person.gender.replace(/_/g, " ");
  }, [person]);

  const heroAvatarPerson = useMemo(() => {
    if (!person) {
      return null;
    }

    if (mode !== "EDIT" || !formState) {
      return person;
    }

    return {
      ...person,
      photoUrl: formState.photoUrl.trim() || null,
    };
  }, [person, mode, formState]);

  const previewPhotoUrl = useMemo(() => {
    const photoUrl = heroAvatarPerson?.photoUrl?.trim();
    if (!photoUrl || !showMemberPhotos) {
      return null;
    }

    return photoUrl;
  }, [heroAvatarPerson, showMemberPhotos]);

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.modalCard, { borderColor: primaryColor, backgroundColor: "#ffffff" }, uiCommonStyles.shadowStrong]}>
          <View style={styles.headerRow}>
            <Text style={[styles.headerTitle, { color: primaryColor }]}>{mode === "VIEW" ? "Member Details" : "Edit Member"}</Text>
            <Pressable
              style={[styles.closeButton, { borderColor: primaryColor }]}
              onPress={onClose}
              disabled={isMutating}
            >
              <Ionicons name="close" size={16} color={primaryColor} />
            </Pressable>
          </View>

          <ScrollView style={styles.bodyScroll} contentContainerStyle={styles.bodyScrollContent}>
            {person ? (
              <>
                <View style={styles.heroCard}>
                  <MemberAvatar
                    person={heroAvatarPerson ?? person}
                    borderColor={primaryColor}
                    size={74}
                    showPhoto={showMemberPhotos}
                    initialsFontScale={0.32}
                  />
                  <View style={styles.heroTextBlock}>
                    <Text style={styles.heroName}>{displayName(person)}</Text>
                    <Text style={styles.heroFamily}>{familyName} Family</Text>
                    <Text style={styles.heroLifeLabel}>{memberLifeLabel(person)}</Text>
                    {previewPhotoUrl ? <Text style={styles.heroPhotoHint}>Tap photo to view</Text> : null}
                  </View>
                </View>

                {mode === "VIEW" ? (
                  <>
                    <View style={styles.detailGrid}>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Gender</Text>
                        <Text style={styles.detailValue}>{genderLabel}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Date of Birth</Text>
                        <Text style={styles.detailValue}>{detailValue(formatDate(person.dateOfBirth))}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Date of Death</Text>
                        <Text style={styles.detailValue}>{detailValue(formatDate(person.dateOfDeath))}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Photo URL</Text>
                        <Text style={styles.detailValue} numberOfLines={2}>
                          {detailValue(person.photoUrl ?? null)}
                        </Text>
                      </View>
                      <View style={styles.detailItemWide}>
                        <Text style={styles.detailLabel}>Notes</Text>
                        <Text style={styles.detailValue}>{detailValue(person.notes ?? null)}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Created At</Text>
                        <Text style={styles.detailValue}>{formatTimestamp(person.createdAt)}</Text>
                      </View>
                      <View style={styles.detailItem}>
                        <Text style={styles.detailLabel}>Updated At</Text>
                        <Text style={styles.detailValue}>{formatTimestamp(person.updatedAt)}</Text>
                      </View>
                    </View>
                    <View style={styles.actionsRow}>
                      <Pressable
                        style={[styles.actionButtonPrimary, { backgroundColor: primaryColor }]}
                        onPress={openEditMode}
                      >
                        <Text style={styles.actionButtonPrimaryText}>Edit</Text>
                      </Pressable>
                      {onShowRelations ? (
                        <Pressable
                          style={[styles.actionButtonSecondary, { borderColor: primaryColor }]}
                          onPress={() => {
                            onShowRelations(person.id);
                          }}
                        >
                          <Text style={[styles.actionButtonSecondaryText, { color: primaryColor }]}>Show Relations</Text>
                        </Pressable>
                      ) : null}
                      <Pressable
                        style={[styles.actionButtonSecondary, { borderColor: primaryColor }]}
                        onPress={onClose}
                      >
                        <Text style={[styles.actionButtonSecondaryText, { color: primaryColor }]}>Close</Text>
                      </Pressable>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={uiCommonStyles.label}>First Name</Text>
                    <TextInput
                      value={formState?.firstName ?? ""}
                      onChangeText={(text) =>
                        setFormState((previous) => (previous ? { ...previous, firstName: text } : previous))
                      }
                      style={uiCommonStyles.input}
                      placeholder="John"
                    />

                      <Text style={uiCommonStyles.label}>Last Name</Text>
                      <TextInput
                        value={formState?.lastName ?? ""}
                        onChangeText={(text) =>
                          setFormState((previous) => (previous ? { ...previous, lastName: text } : previous))
                        }
                        style={uiCommonStyles.input}
                        placeholder="Doe"
                      />

                      <Text style={uiCommonStyles.label}>Gender</Text>
                      <OptionChips
                        options={genderOptions}
                        selectedValue={formState?.gender ?? ""}
                        onSelect={(value) => setFormState((previous) => (previous ? { ...previous, gender: value } : previous))}
                        activeBackgroundColor={primaryColor}
                        activeBorderColor={primaryColor}
                        inactiveBackgroundColor={secondaryColor}
                        inactiveBorderColor={primaryColor}
                        inactiveTextColor={primaryColor}
                      />

                      <Text style={uiCommonStyles.label}>Date of Birth (YYYY-MM-DD)</Text>
                      <TextInput
                        value={formState?.dateOfBirth ?? ""}
                        onChangeText={(text) =>
                          setFormState((previous) => (previous ? { ...previous, dateOfBirth: text } : previous))
                        }
                        style={uiCommonStyles.input}
                        placeholder="1985-10-20"
                      />

                      <Text style={uiCommonStyles.label}>Date of Death (optional)</Text>
                      <TextInput
                        value={formState?.dateOfDeath ?? ""}
                        onChangeText={(text) =>
                          setFormState((previous) => (previous ? { ...previous, dateOfDeath: text } : previous))
                        }
                        style={uiCommonStyles.input}
                        placeholder="2024-02-02"
                      />

                      <View style={styles.photoActionRow}>
                        <Pressable
                          style={[styles.photoActionButton, { backgroundColor: primaryColor }]}
                          onPress={() => void uploadPhoto()}
                          disabled={isMutating}
                        >
                          <Ionicons name="image-outline" size={14} color="#ffffff" />
                          <Text style={styles.photoActionButtonText}>Upload Photo</Text>
                        </Pressable>
                        <Pressable
                          style={[styles.photoActionButtonSecondary, { borderColor: primaryColor }]}
                          onPress={removePhoto}
                          disabled={isMutating}
                        >
                          <Ionicons name="trash-outline" size={14} color={primaryColor} />
                          <Text style={[styles.photoActionButtonSecondaryText, { color: primaryColor }]}>Remove Photo</Text>
                        </Pressable>
                      </View>

                      <Text style={uiCommonStyles.label}>Photo URL (optional)</Text>
                      <TextInput
                        value={isUploadedDataUrl ? "" : formState?.photoUrl ?? ""}
                        onChangeText={(text) =>
                          setFormState((previous) => (previous ? { ...previous, photoUrl: text } : previous))
                        }
                        style={uiCommonStyles.input}
                        placeholder={isUploadedDataUrl ? "Uploaded device image selected" : "https://..."}
                        autoCapitalize="none"
                      />

                      {isUploadedDataUrl ? (
                        <Text style={styles.uploadedHint}>Device photo selected (stored as encoded image data).</Text>
                      ) : null}

                      {photoPickerError ? <Text style={styles.errorText}>{photoPickerError}</Text> : null}
                      {validationError ? <Text style={styles.errorText}>{validationError}</Text> : null}

                      <Text style={uiCommonStyles.label}>Notes</Text>
                      <TextInput
                        value={formState?.notes ?? ""}
                        onChangeText={(text) =>
                          setFormState((previous) => (previous ? { ...previous, notes: text } : previous))
                        }
                        style={[uiCommonStyles.input, styles.notesInput]}
                        multiline
                        placeholder="Biography, achievements, context..."
                      />

                      <View style={styles.actionsRow}>
                        <Pressable
                          style={[styles.actionButtonPrimary, { backgroundColor: primaryColor }]}
                          onPress={() => void saveMember()}
                          disabled={isMutating}
                        >
                          {isMutating ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.actionButtonPrimaryText}>Save</Text>}
                        </Pressable>
                        <Pressable
                          style={[styles.actionButtonSecondary, { borderColor: primaryColor }]}
                          onPress={cancelEditMode}
                          disabled={isMutating}
                        >
                          <Text style={[styles.actionButtonSecondaryText, { color: primaryColor }]}>Cancel</Text>
                        </Pressable>
                      </View>
                  </>
                )}
              </>
            ) : (
              <Text style={styles.emptyText}>Member details are not available.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(10, 24, 18, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 700,
    maxHeight: "92%",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#d5e5dd",
    backgroundColor: "#f8fbf9",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  bodyScroll: {
    flex: 1,
  },
  bodyScrollContent: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    paddingBottom: 18,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  heroTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  heroName: {
    fontSize: 18,
    fontWeight: "800",
    color: "#17352c",
  },
  heroFamily: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: "700",
    color: "#3c5f52",
  },
  heroLifeLabel: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    color: "#53766a",
  },
  heroPhotoHint: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
    color: "#456c5f",
  },
  detailGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  detailItem: {
    width: "48%",
    minWidth: 220,
    borderWidth: 1,
    borderColor: "#d9e6de",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  detailItemWide: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#d9e6de",
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4f7265",
    marginBottom: 3,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  detailValue: {
    fontSize: 13,
    lineHeight: 18,
    color: "#1f3f34",
    fontWeight: "600",
  },
  photoActionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  photoActionButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  photoActionButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  photoActionButtonSecondary: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  photoActionButtonSecondaryText: {
    fontSize: 12,
    fontWeight: "700",
  },
  uploadedHint: {
    marginTop: -4,
    marginBottom: 8,
    color: "#4d6d61",
    fontSize: 12,
    fontWeight: "600",
  },
  errorText: {
    marginTop: -2,
    marginBottom: 8,
    color: "#b43a3a",
    fontSize: 12,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 90,
    textAlignVertical: "top",
  },
  actionsRow: {
    marginTop: 8,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  actionButtonPrimary: {
    minWidth: 110,
    borderRadius: 8,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  actionButtonPrimaryText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 13,
  },
  actionButtonSecondary: {
    minWidth: 110,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },
  actionButtonSecondaryText: {
    fontWeight: "700",
    fontSize: 13,
  },
  emptyText: {
    color: "#5f7d72",
    fontSize: 13,
    fontWeight: "600",
  },
});
