import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useFamilyTree } from "./src/hooks/useFamilyTree";
import { API_BASE_URL } from "./src/lib/api";
import {
  FamilyGraph,
  Gender,
  ParentType,
  Person,
  PersonInput,
  SpouseRelation,
} from "./src/types/family";

type TabKey = "TREE" | "MEMBERS" | "RELATIONSHIPS";
type AppPage = "HOME" | "SETTINGS";

const tabs: { key: TabKey; label: string }[] = [
  { key: "TREE", label: "Tree" },
  { key: "MEMBERS", label: "Members" },
  { key: "RELATIONSHIPS", label: "Relationships" },
];

const genderOptions: (Gender | "")[] = ["", "MALE", "FEMALE", "NON_BINARY", "OTHER"];
const parentTypeOptions: ParentType[] = ["BIOLOGICAL", "ADOPTIVE", "STEP", "GUARDIAN"];

type ThemePresetId = "FOREST" | "OCEAN" | "SUNSET" | "GRAPHITE";

type ThemePreset = {
  id: ThemePresetId;
  label: string;
  backgroundColor: string;
  primaryColor: string;
  secondaryColor: string;
};

const themePresets: ThemePreset[] = [
  {
    id: "FOREST",
    label: "Forest",
    backgroundColor: "#eef2ee",
    primaryColor: "#2e5f4f",
    secondaryColor: "#d9e6de",
  },
  {
    id: "OCEAN",
    label: "Ocean",
    backgroundColor: "#edf4f8",
    primaryColor: "#1e5d8c",
    secondaryColor: "#d5e7f3",
  },
  {
    id: "SUNSET",
    label: "Sunset",
    backgroundColor: "#fff4ec",
    primaryColor: "#a24d2f",
    secondaryColor: "#f3ddd2",
  },
  {
    id: "GRAPHITE",
    label: "Graphite",
    backgroundColor: "#f1f2f4",
    primaryColor: "#3a4552",
    secondaryColor: "#dce2e8",
  },
];

const isHexColor = (value: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value.trim());

const displayName = (person: Person) => `${person.firstName} ${person.lastName}`.trim();

const formatDate = (value: string | null) => {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
};

const toNullable = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

type PersonFormState = {
  firstName: string;
  lastName: string;
  gender: Gender | "";
  dateOfBirth: string;
  dateOfDeath: string;
  photoUrl: string;
  notes: string;
};

const defaultFormState: PersonFormState = {
  firstName: "",
  lastName: "",
  gender: "",
  dateOfBirth: "",
  dateOfDeath: "",
  photoUrl: "",
  notes: "",
};

const buildPersonPayload = (state: PersonFormState): PersonInput => ({
  firstName: state.firstName,
  lastName: state.lastName,
  gender: state.gender || null,
  dateOfBirth: toNullable(state.dateOfBirth),
  dateOfDeath: toNullable(state.dateOfDeath),
  photoUrl: toNullable(state.photoUrl),
  notes: toNullable(state.notes),
});

const App = () => {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 980;
  const [activeTab, setActiveTab] = useState<TabKey>("TREE");
  const [activePage, setActivePage] = useState<AppPage>("HOME");
  const [selectedThemeId, setSelectedThemeId] = useState<ThemePresetId>("FOREST");
  const initialTheme = themePresets.find((preset) => preset.id === "FOREST") ?? themePresets[0];
  const [primaryColorInput, setPrimaryColorInput] = useState(initialTheme.primaryColor);
  const [secondaryColorInput, setSecondaryColorInput] = useState(initialTheme.secondaryColor);
  const [showCustomizeToolbar, setShowCustomizeToolbar] = useState(true);
  const [sidebarEnabled, setSidebarEnabled] = useState(false);

  const activeThemePreset = useMemo(
    () => themePresets.find((preset) => preset.id === selectedThemeId) ?? themePresets[0],
    [selectedThemeId],
  );

  const resolvedPrimaryColor = isHexColor(primaryColorInput)
    ? primaryColorInput.trim()
    : activeThemePreset.primaryColor;
  const resolvedSecondaryColor = isHexColor(secondaryColorInput)
    ? secondaryColorInput.trim()
    : activeThemePreset.secondaryColor;

  const uiTheme = useMemo(
    () => ({
      backgroundColor: activeThemePreset.backgroundColor,
      primaryColor: resolvedPrimaryColor,
      secondaryColor: resolvedSecondaryColor,
      surfaceColor: "#ffffff",
      subtitleColor: "#507166",
      textOnPrimary: "#ffffff",
      panelBorderColor: resolvedSecondaryColor,
    }),
    [activeThemePreset, resolvedPrimaryColor, resolvedSecondaryColor],
  );

  const applyThemePreset = (presetId: ThemePresetId) => {
    const preset = themePresets.find((item) => item.id === presetId);
    if (!preset) {
      return;
    }

    setSelectedThemeId(preset.id);
    setPrimaryColorInput(preset.primaryColor);
    setSecondaryColorInput(preset.secondaryColor);
  };

  const {
    graph,
    error,
    isLoading,
    isMutating,
    reload,
    createPerson,
    updatePerson,
    deletePerson,
    createParentChild,
    deleteParentChild,
    createSpouse,
    deleteSpouse,
  } = useFamilyTree();

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: uiTheme.backgroundColor }]}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.headerTopRow}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: uiTheme.primaryColor }]}>Family Tree Platform</Text>
            <Text style={[styles.subtitle, { color: uiTheme.subtitleColor }]}>Web, Android, iOS | API: {API_BASE_URL}</Text>
          </View>
          <Pressable
            style={[
              styles.settingsIconButton,
              {
                backgroundColor: uiTheme.secondaryColor,
                borderColor: uiTheme.primaryColor,
              },
            ]}
            onPress={() => setActivePage((previous) => (previous === "HOME" ? "SETTINGS" : "HOME"))}
          >
            <Ionicons name={activePage === "HOME" ? "settings-outline" : "arrow-back"} size={20} color={uiTheme.primaryColor} />
          </Pressable>
        </View>

        {activePage === "SETTINGS" ? (
          <SettingsPage
            selectedThemeId={selectedThemeId}
            primaryColorInput={primaryColorInput}
            secondaryColorInput={secondaryColorInput}
            showCustomizeToolbar={showCustomizeToolbar}
            sidebarEnabled={sidebarEnabled}
            resolvedPrimaryColor={resolvedPrimaryColor}
            resolvedSecondaryColor={resolvedSecondaryColor}
            onPresetSelect={applyThemePreset}
            onPrimaryColorChange={setPrimaryColorInput}
            onSecondaryColorChange={setSecondaryColorInput}
            onToggleCustomizeToolbar={() => setShowCustomizeToolbar((previous) => !previous)}
            onToggleSidebar={() => setSidebarEnabled((previous) => !previous)}
          />
        ) : (
          <View style={[styles.workspace, sidebarEnabled && isWideLayout && styles.workspaceWide]}>
            {sidebarEnabled ? (
              <View
                style={[
                  styles.sidebar,
                  !isWideLayout && styles.sidebarStacked,
                  { backgroundColor: uiTheme.secondaryColor, borderColor: uiTheme.primaryColor },
                ]}
              >
                <Text style={[styles.sidebarTitle, { color: uiTheme.primaryColor }]}>Sidebar</Text>
                <Text style={styles.sidebarHint}>Quick navigation and summary</Text>
                {tabs.map((tab) => (
                  <Pressable
                    key={`sidebar-${tab.key}`}
                    style={[
                      styles.sidebarNavButton,
                      {
                        borderColor: uiTheme.primaryColor,
                        backgroundColor: activeTab === tab.key ? uiTheme.primaryColor : uiTheme.surfaceColor,
                      },
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Text
                      style={[
                        styles.sidebarNavButtonText,
                        { color: activeTab === tab.key ? uiTheme.textOnPrimary : uiTheme.primaryColor },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
                <View style={styles.sidebarStatsBlock}>
                  <Text style={styles.sidebarStatsText}>Members: {graph.persons.length}</Text>
                  <Text style={styles.sidebarStatsText}>Parent Links: {graph.parentChildRelations.length}</Text>
                  <Text style={styles.sidebarStatsText}>Spouse Links: {graph.spouseRelations.length}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.mainWorkspace}>
              {showCustomizeToolbar ? (
                <View style={[styles.customizeToolbar, { borderColor: uiTheme.panelBorderColor }]}>
                  <Text style={[styles.customizeToolbarTitle, { color: uiTheme.primaryColor }]}>Customize Toolbar</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toolbarThemesRow}>
                    {themePresets.map((preset) => (
                      <Pressable
                        key={`preset-${preset.id}`}
                        style={[
                          styles.toolbarThemeChip,
                          {
                            borderColor: uiTheme.primaryColor,
                            backgroundColor: selectedThemeId === preset.id ? uiTheme.primaryColor : uiTheme.surfaceColor,
                          },
                        ]}
                        onPress={() => applyThemePreset(preset.id)}
                      >
                        <Text
                          style={[
                            styles.toolbarThemeChipText,
                            { color: selectedThemeId === preset.id ? uiTheme.textOnPrimary : uiTheme.primaryColor },
                          ]}
                        >
                          {preset.label}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <View style={styles.toolbarActionsRow}>
                    <Pressable
                      style={[styles.toolbarActionButton, { backgroundColor: uiTheme.primaryColor }]}
                      onPress={() => setSidebarEnabled((previous) => !previous)}
                    >
                      <Text style={styles.toolbarActionButtonText}>
                        {sidebarEnabled ? "Hide Sidebar" : "Show Sidebar"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.toolbarActionButton,
                        { backgroundColor: uiTheme.surfaceColor, borderColor: uiTheme.primaryColor, borderWidth: 1 },
                      ]}
                      onPress={() => setActivePage("SETTINGS")}
                    >
                      <Text style={[styles.toolbarActionButtonText, { color: uiTheme.primaryColor }]}>More Settings</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}

              <View style={styles.tabRow}>
                {tabs.map((tab) => (
                  <Pressable
                    key={tab.key}
                    style={[
                      styles.tabButton,
                      { backgroundColor: uiTheme.secondaryColor },
                      activeTab === tab.key && { backgroundColor: uiTheme.primaryColor, borderColor: uiTheme.primaryColor },
                    ]}
                    onPress={() => setActiveTab(tab.key)}
                  >
                    <Text
                      style={[
                        styles.tabText,
                        { color: uiTheme.primaryColor },
                        activeTab === tab.key && { color: uiTheme.textOnPrimary },
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                ))}
                <Pressable style={[styles.refreshButton, { backgroundColor: uiTheme.primaryColor }]} onPress={() => void reload()}>
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </Pressable>
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {isLoading ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={uiTheme.primaryColor} />
                  <Text style={styles.mutedText}>Loading family graph...</Text>
                </View>
              ) : (
                <ScrollView contentContainerStyle={styles.content}>
                  {activeTab === "TREE" ? (
                    <TreePanel graph={graph} primaryColor={uiTheme.primaryColor} secondaryColor={uiTheme.secondaryColor} />
                  ) : null}

                  {activeTab === "MEMBERS" ? (
                    <MembersPanel
                      persons={graph.persons}
                      isMutating={isMutating}
                      primaryColor={uiTheme.primaryColor}
                      secondaryColor={uiTheme.secondaryColor}
                      onCreate={createPerson}
                      onUpdate={updatePerson}
                      onDelete={deletePerson}
                    />
                  ) : null}

                  {activeTab === "RELATIONSHIPS" ? (
                    <RelationshipsPanel
                      graph={graph}
                      isMutating={isMutating}
                      primaryColor={uiTheme.primaryColor}
                      secondaryColor={uiTheme.secondaryColor}
                      onCreateParentChild={createParentChild}
                      onDeleteParentChild={deleteParentChild}
                      onCreateSpouse={createSpouse}
                      onDeleteSpouse={deleteSpouse}
                    />
                  ) : null}
                </ScrollView>
              )}
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

type SettingsPageProps = {
  selectedThemeId: ThemePresetId;
  primaryColorInput: string;
  secondaryColorInput: string;
  showCustomizeToolbar: boolean;
  sidebarEnabled: boolean;
  resolvedPrimaryColor: string;
  resolvedSecondaryColor: string;
  onPresetSelect: (presetId: ThemePresetId) => void;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  onToggleCustomizeToolbar: () => void;
  onToggleSidebar: () => void;
};

const SettingsPage = ({
  selectedThemeId,
  primaryColorInput,
  secondaryColorInput,
  showCustomizeToolbar,
  sidebarEnabled,
  resolvedPrimaryColor,
  resolvedSecondaryColor,
  onPresetSelect,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onToggleCustomizeToolbar,
  onToggleSidebar,
}: SettingsPageProps) => (
  <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Settings</Text>
      <Text style={styles.panelHint}>
        Select a theme, customize primary and secondary colors, and configure interface options.
      </Text>

      <Text style={styles.label}>Theme Preset</Text>
      <View style={styles.optionRowWrap}>
        {themePresets.map((preset) => {
          const isSelected = selectedThemeId === preset.id;
          return (
            <Pressable
              key={`settings-preset-${preset.id}`}
              style={[
                styles.optionButton,
                isSelected && { backgroundColor: resolvedPrimaryColor, borderColor: resolvedPrimaryColor },
              ]}
              onPress={() => onPresetSelect(preset.id)}
            >
              <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextActive]}>
                {preset.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Primary Color (#RGB or #RRGGBB)</Text>
      <TextInput
        value={primaryColorInput}
        onChangeText={onPrimaryColorChange}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="#2e5f4f"
      />
      {!isHexColor(primaryColorInput) ? (
        <Text style={styles.invalidHint}>Invalid color format. Use values like #123abc.</Text>
      ) : null}

      <Text style={styles.label}>Secondary Color (#RGB or #RRGGBB)</Text>
      <TextInput
        value={secondaryColorInput}
        onChangeText={onSecondaryColorChange}
        style={styles.input}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="#d9e6de"
      />
      {!isHexColor(secondaryColorInput) ? (
        <Text style={styles.invalidHint}>Invalid color format. Use values like #def0ab.</Text>
      ) : null}

      <View style={styles.settingsSwatchRow}>
        <View style={[styles.settingsSwatch, { backgroundColor: resolvedPrimaryColor }]} />
        <Text style={styles.settingsSwatchText}>Applied primary: {resolvedPrimaryColor}</Text>
      </View>
      <View style={styles.settingsSwatchRow}>
        <View style={[styles.settingsSwatch, { backgroundColor: resolvedSecondaryColor }]} />
        <Text style={styles.settingsSwatchText}>Applied secondary: {resolvedSecondaryColor}</Text>
      </View>

      <Text style={styles.subsectionTitle}>Layout Options</Text>
      <SettingsToggle
        label="Show Customize Toolbar"
        value={showCustomizeToolbar}
        accentColor={resolvedPrimaryColor}
        onPress={onToggleCustomizeToolbar}
      />
      <SettingsToggle
        label="Enable Sidebar"
        value={sidebarEnabled}
        accentColor={resolvedPrimaryColor}
        onPress={onToggleSidebar}
      />
    </View>
  </ScrollView>
);

type SettingsToggleProps = {
  label: string;
  value: boolean;
  accentColor: string;
  onPress: () => void;
};

const SettingsToggle = ({ label, value, accentColor, onPress }: SettingsToggleProps) => (
  <Pressable
    style={[styles.settingsToggleRow, { borderColor: accentColor }, value && { backgroundColor: `${accentColor}22` }]}
    onPress={onPress}
  >
    <Text style={styles.settingsToggleLabel}>{label}</Text>
    <View
      style={[
        styles.settingsToggleValuePill,
        { borderColor: accentColor },
        value && { backgroundColor: accentColor, borderColor: accentColor },
      ]}
    >
      <Text style={[styles.settingsToggleValueText, value && { color: "#ffffff" }]}>{value ? "ON" : "OFF"}</Text>
    </View>
  </Pressable>
);

type MembersPanelProps = {
  persons: Person[];
  isMutating: boolean;
  primaryColor: string;
  secondaryColor: string;
  onCreate: (payload: PersonInput) => Promise<void>;
  onUpdate: (personId: string, payload: PersonInput) => Promise<void>;
  onDelete: (personId: string) => Promise<void>;
};

const MembersPanel = ({
  persons,
  isMutating,
  primaryColor,
  secondaryColor,
  onCreate,
  onUpdate,
  onDelete,
}: MembersPanelProps) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PersonFormState>(defaultFormState);

  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [persons],
  );

  const selectedPerson = sortedPersons.find((person) => person.id === selectedPersonId) ?? null;

  const selectPerson = (person: Person | null) => {
    if (!person) {
      setSelectedPersonId(null);
      setFormState(defaultFormState);
      return;
    }

    setSelectedPersonId(person.id);
    setFormState({
      firstName: person.firstName,
      lastName: person.lastName,
      gender: person.gender ?? "",
      dateOfBirth: formatDate(person.dateOfBirth),
      dateOfDeath: formatDate(person.dateOfDeath),
      photoUrl: person.photoUrl ?? "",
      notes: person.notes ?? "",
    });
  };

  const save = async () => {
    const payload = buildPersonPayload(formState);

    if (!payload.firstName.trim() || !payload.lastName.trim()) {
      return;
    }

    if (selectedPersonId) {
      await onUpdate(selectedPersonId, payload);
    } else {
      await onCreate(payload);
    }

    selectPerson(null);
  };

  const remove = async () => {
    if (!selectedPersonId) {
      return;
    }

    await onDelete(selectedPersonId);
    selectPerson(null);
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Members</Text>
      <Text style={styles.panelHint}>Create, edit, and delete family members.</Text>

      <Text style={styles.label}>Select Existing Member</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
        <Pressable
          style={[
            styles.selectorPill,
            { borderColor: primaryColor },
            !selectedPersonId && { backgroundColor: primaryColor, borderColor: primaryColor },
          ]}
          onPress={() => selectPerson(null)}
        >
          <Text style={[styles.selectorPillText, { color: primaryColor }, !selectedPersonId && styles.selectorPillTextActive]}>
            New Member
          </Text>
        </Pressable>

        {sortedPersons.map((person) => (
          <Pressable
            key={person.id}
            style={[
              styles.selectorPill,
              { borderColor: primaryColor },
              selectedPersonId === person.id && { backgroundColor: primaryColor, borderColor: primaryColor },
            ]}
            onPress={() => selectPerson(person)}
          >
            <Text
              style={[
                styles.selectorPillText,
                { color: primaryColor },
                selectedPersonId === person.id && styles.selectorPillTextActive,
              ]}
            >
              {displayName(person)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.label}>First Name</Text>
      <TextInput
        value={formState.firstName}
        onChangeText={(text) => setFormState((prev) => ({ ...prev, firstName: text }))}
        style={styles.input}
        placeholder="John"
      />

      <Text style={styles.label}>Last Name</Text>
      <TextInput
        value={formState.lastName}
        onChangeText={(text) => setFormState((prev) => ({ ...prev, lastName: text }))}
        style={styles.input}
        placeholder="Doe"
      />

      <Text style={styles.label}>Gender</Text>
      <View style={styles.optionRowWrap}>
        {genderOptions.map((option) => {
          const isSelected = formState.gender === option;
          const label = option || "Unspecified";

          return (
            <Pressable
              key={label}
              style={[
                styles.optionButton,
                { borderColor: primaryColor, backgroundColor: secondaryColor },
                isSelected && { backgroundColor: primaryColor, borderColor: primaryColor },
              ]}
              onPress={() => setFormState((prev) => ({ ...prev, gender: option }))}
            >
              <Text style={[styles.optionButtonText, { color: primaryColor }, isSelected && styles.optionButtonTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Date of Birth (YYYY-MM-DD)</Text>
      <TextInput
        value={formState.dateOfBirth}
        onChangeText={(text) => setFormState((prev) => ({ ...prev, dateOfBirth: text }))}
        style={styles.input}
        placeholder="1985-10-20"
      />

      <Text style={styles.label}>Date of Death (optional)</Text>
      <TextInput
        value={formState.dateOfDeath}
        onChangeText={(text) => setFormState((prev) => ({ ...prev, dateOfDeath: text }))}
        style={styles.input}
        placeholder="2024-02-02"
      />

      <Text style={styles.label}>Photo URL (optional)</Text>
      <TextInput
        value={formState.photoUrl}
        onChangeText={(text) => setFormState((prev) => ({ ...prev, photoUrl: text }))}
        style={styles.input}
        autoCapitalize="none"
        placeholder="https://..."
      />

      <Text style={styles.label}>Notes</Text>
      <TextInput
        value={formState.notes}
        onChangeText={(text) => setFormState((prev) => ({ ...prev, notes: text }))}
        style={[styles.input, styles.multilineInput]}
        multiline
        placeholder="Biography, achievements, context..."
      />

      <View style={styles.actionRow}>
        <Pressable style={[styles.primaryButton, { backgroundColor: primaryColor }]} onPress={() => void save()} disabled={isMutating}>
          <Text style={styles.primaryButtonText}>{selectedPerson ? "Update Member" : "Add Member"}</Text>
        </Pressable>

        {selectedPerson ? (
          <Pressable style={styles.secondaryDangerButton} onPress={() => void remove()} disabled={isMutating}>
            <Text style={styles.secondaryDangerButtonText}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

type RelationshipsPanelProps = {
  graph: FamilyGraph;
  isMutating: boolean;
  primaryColor: string;
  secondaryColor: string;
  onCreateParentChild: (payload: { parentId: string; childId: string; relationType: ParentType }) => Promise<void>;
  onDeleteParentChild: (parentId: string, childId: string) => Promise<void>;
  onCreateSpouse: (payload: {
    personAId: string;
    personBId: string;
    marriedAt?: string | null;
    divorcedAt?: string | null;
  }) => Promise<void>;
  onDeleteSpouse: (personAId: string, personBId: string) => Promise<void>;
};

const RelationshipsPanel = ({
  graph,
  isMutating,
  primaryColor,
  secondaryColor,
  onCreateParentChild,
  onDeleteParentChild,
  onCreateSpouse,
  onDeleteSpouse,
}: RelationshipsPanelProps) => {
  const persons = useMemo(
    () => [...graph.persons].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [graph.persons],
  );

  const personById = useMemo(() => {
    const map = new Map<string, Person>();
    persons.forEach((person) => map.set(person.id, person));
    return map;
  }, [persons]);

  const [parentId, setParentId] = useState<string>("");
  const [childId, setChildId] = useState<string>("");
  const [relationType, setRelationType] = useState<ParentType>("BIOLOGICAL");

  const [spouseAId, setSpouseAId] = useState<string>("");
  const [spouseBId, setSpouseBId] = useState<string>("");
  const [marriedAt, setMarriedAt] = useState<string>("");
  const [divorcedAt, setDivorcedAt] = useState<string>("");

  const createParentChildLink = async () => {
    if (!parentId || !childId || parentId === childId) {
      return;
    }

    await onCreateParentChild({
      parentId,
      childId,
      relationType,
    });

    setParentId("");
    setChildId("");
    setRelationType("BIOLOGICAL");
  };

  const createSpouseLink = async () => {
    if (!spouseAId || !spouseBId || spouseAId === spouseBId) {
      return;
    }

    await onCreateSpouse({
      personAId: spouseAId,
      personBId: spouseBId,
      marriedAt: toNullable(marriedAt),
      divorcedAt: toNullable(divorcedAt),
    });

    setSpouseAId("");
    setSpouseBId("");
    setMarriedAt("");
    setDivorcedAt("");
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Relationships</Text>
      <Text style={styles.panelHint}>Connect members as parent-child and spouses.</Text>

      <Text style={styles.subsectionTitle}>Parent to Child</Text>
      <Text style={styles.label}>Parent</Text>
      <HorizontalPersonSelector
        persons={persons}
        selectedId={parentId}
        onSelect={setParentId}
        primaryColor={primaryColor}
      />

      <Text style={styles.label}>Child</Text>
      <HorizontalPersonSelector
        persons={persons}
        selectedId={childId}
        onSelect={setChildId}
        primaryColor={primaryColor}
      />

      <Text style={styles.label}>Relationship Type</Text>
      <View style={styles.optionRowWrap}>
        {parentTypeOptions.map((option) => (
          <Pressable
            key={option}
            style={[
              styles.optionButton,
              { borderColor: primaryColor, backgroundColor: secondaryColor },
              relationType === option && { backgroundColor: primaryColor, borderColor: primaryColor },
            ]}
            onPress={() => setRelationType(option)}
          >
            <Text
              style={[
                styles.optionButtonText,
                { color: primaryColor },
                relationType === option && styles.optionButtonTextActive,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: primaryColor }]}
        onPress={() => void createParentChildLink()}
        disabled={isMutating}
      >
        <Text style={styles.primaryButtonText}>Add Parent-Child Link</Text>
      </Pressable>

      <View style={styles.listBlock}>
        {graph.parentChildRelations.map((relation) => {
          const parent = personById.get(relation.parentId);
          const child = personById.get(relation.childId);

          if (!parent || !child) {
            return null;
          }

          return (
            <View key={relation.id} style={styles.listRow}>
              <Text style={styles.listText}>
                {displayName(parent)}
                {" -> "}
                {displayName(child)}
                {" "}
                ({relation.relationType})
              </Text>
              <Pressable
                style={styles.inlineDangerButton}
                onPress={() => void onDeleteParentChild(relation.parentId, relation.childId)}
                disabled={isMutating}
              >
                <Text style={styles.inlineDangerButtonText}>Remove</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <Text style={styles.subsectionTitle}>Spouses</Text>
      <Text style={styles.label}>Person A</Text>
      <HorizontalPersonSelector
        persons={persons}
        selectedId={spouseAId}
        onSelect={setSpouseAId}
        primaryColor={primaryColor}
      />

      <Text style={styles.label}>Person B</Text>
      <HorizontalPersonSelector
        persons={persons}
        selectedId={spouseBId}
        onSelect={setSpouseBId}
        primaryColor={primaryColor}
      />

      <Text style={styles.label}>Married At (optional)</Text>
      <TextInput
        value={marriedAt}
        onChangeText={setMarriedAt}
        style={styles.input}
        placeholder="YYYY-MM-DD"
      />

      <Text style={styles.label}>Divorced At (optional)</Text>
      <TextInput
        value={divorcedAt}
        onChangeText={setDivorcedAt}
        style={styles.input}
        placeholder="YYYY-MM-DD"
      />

      <Pressable
        style={[styles.primaryButton, { backgroundColor: primaryColor }]}
        onPress={() => void createSpouseLink()}
        disabled={isMutating}
      >
        <Text style={styles.primaryButtonText}>Add Spouse Link</Text>
      </Pressable>

      <View style={styles.listBlock}>
        {graph.spouseRelations.map((relation) => {
          const personA = personById.get(relation.personAId);
          const personB = personById.get(relation.personBId);

          if (!personA || !personB) {
            return null;
          }

          return (
            <View key={relation.id} style={styles.listRow}>
              <Text style={styles.listText}>
                {displayName(personA)}
                {" <-> "}
                {displayName(personB)}
              </Text>
              <Pressable
                style={styles.inlineDangerButton}
                onPress={() => void onDeleteSpouse(relation.personAId, relation.personBId)}
                disabled={isMutating}
              >
                <Text style={styles.inlineDangerButtonText}>Remove</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
};

type HorizontalPersonSelectorProps = {
  persons: Person[];
  selectedId: string;
  onSelect: (personId: string) => void;
  primaryColor: string;
};

const HorizontalPersonSelector = ({ persons, selectedId, onSelect, primaryColor }: HorizontalPersonSelectorProps) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
    {persons.map((person) => (
      <Pressable
        key={person.id}
        style={[
          styles.selectorPill,
          { borderColor: primaryColor },
          selectedId === person.id && { backgroundColor: primaryColor, borderColor: primaryColor },
        ]}
        onPress={() => onSelect(person.id)}
      >
        <Text
          style={[
            styles.selectorPillText,
            { color: primaryColor },
            selectedId === person.id && styles.selectorPillTextActive,
          ]}
        >
          {displayName(person)}
        </Text>
      </Pressable>
    ))}
  </ScrollView>
);

type TreePanelProps = {
  graph: FamilyGraph;
  primaryColor: string;
  secondaryColor: string;
};

type TreeRenderNode = {
  personId: string;
  partnerId?: string;
};

const orderNodeByName = (
  firstId: string,
  secondId: string,
  personById: Map<string, Person>,
): TreeRenderNode => {
  const first = personById.get(firstId);
  const second = personById.get(secondId);

  if (!first || !second) {
    return firstId < secondId
      ? { personId: firstId, partnerId: secondId }
      : { personId: secondId, partnerId: firstId };
  }

  return displayName(first).localeCompare(displayName(second)) <= 0
    ? { personId: firstId, partnerId: secondId }
    : { personId: secondId, partnerId: firstId };
};

const TreePanel = ({ graph, primaryColor, secondaryColor }: TreePanelProps) => {
  const personById = useMemo(() => {
    const map = new Map<string, Person>();
    graph.persons.forEach((person) => map.set(person.id, person));
    return map;
  }, [graph.persons]);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, string[]>();

    graph.parentChildRelations.forEach((relation) => {
      const children = map.get(relation.parentId) ?? [];
      children.push(relation.childId);
      map.set(relation.parentId, children);
    });

    return map;
  }, [graph.parentChildRelations]);

  const spouseByPerson = useMemo(() => {
    const map = new Map<string, SpouseRelation[]>();

    graph.spouseRelations.forEach((relation) => {
      const listA = map.get(relation.personAId) ?? [];
      listA.push(relation);
      map.set(relation.personAId, listA);

      const listB = map.get(relation.personBId) ?? [];
      listB.push(relation);
      map.set(relation.personBId, listB);
    });

    return map;
  }, [graph.spouseRelations]);

  const spouseIdsByPerson = useMemo(() => {
    const map = new Map<string, string[]>();

    graph.spouseRelations.forEach((relation) => {
      const a = relation.personAId;
      const b = relation.personBId;

      const listA = map.get(a) ?? [];
      if (!listA.includes(b)) {
        listA.push(b);
        map.set(a, listA);
      }

      const listB = map.get(b) ?? [];
      if (!listB.includes(a)) {
        listB.push(a);
        map.set(b, listB);
      }
    });

    return map;
  }, [graph.spouseRelations]);

  const childIds = useMemo(() => {
    const set = new Set<string>();
    graph.parentChildRelations.forEach((relation) => set.add(relation.childId));
    return set;
  }, [graph.parentChildRelations]);

  const rootNodes = useMemo(() => {
    const roots = graph.persons.filter((person) => !childIds.has(person.id));
    const sortedRoots = [...(roots.length > 0 ? roots : graph.persons)].sort((a, b) =>
      displayName(a).localeCompare(displayName(b)),
    );
    const rootIds = new Set(sortedRoots.map((person) => person.id));
    const seenRootIds = new Set<string>();
    const nodes: TreeRenderNode[] = [];

    sortedRoots.forEach((rootPerson) => {
      if (seenRootIds.has(rootPerson.id)) {
        return;
      }

      const partnerId = (spouseIdsByPerson.get(rootPerson.id) ?? []).find(
        (candidateId) => rootIds.has(candidateId) && !seenRootIds.has(candidateId),
      );

      if (partnerId) {
        nodes.push(orderNodeByName(rootPerson.id, partnerId, personById));
        seenRootIds.add(rootPerson.id);
        seenRootIds.add(partnerId);
        return;
      }

      nodes.push({ personId: rootPerson.id });
      seenRootIds.add(rootPerson.id);
    });

    return nodes;
  }, [graph.persons, childIds, spouseIdsByPerson, personById]);

  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());

  const toggleNode = (personId: string, partnerId?: string) => {
    setCollapsedNodeIds((previous) => {
      const next = new Set(previous);
      const isCurrentlyCollapsed = next.has(personId) || (partnerId ? next.has(partnerId) : false);

      if (isCurrentlyCollapsed) {
        next.delete(personId);
        if (partnerId) {
          next.delete(partnerId);
        }
      } else {
        next.add(personId);
        if (partnerId) {
          next.add(partnerId);
        }
      }
      return next;
    });
  };

  const expandAll = () => setCollapsedNodeIds(new Set());

  const collapseAll = () => {
    const parentsWithChildren = new Set(graph.parentChildRelations.map((relation) => relation.parentId));
    setCollapsedNodeIds(parentsWithChildren);
  };

  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>Family Tree</Text>
      <Text style={styles.panelHint}>Tap a branch card to expand/collapse descendants.</Text>
      <View style={styles.treePanelActions}>
        <Pressable style={[styles.treeMiniButton, { borderColor: primaryColor, backgroundColor: secondaryColor }]} onPress={expandAll}>
          <Text style={[styles.treeMiniButtonText, { color: primaryColor }]}>Expand all</Text>
        </Pressable>
        <Pressable
          style={[styles.treeMiniButton, { borderColor: primaryColor, backgroundColor: secondaryColor }]}
          onPress={collapseAll}
        >
          <Text style={[styles.treeMiniButtonText, { color: primaryColor }]}>Collapse all</Text>
        </Pressable>
      </View>

      {rootNodes.length === 0 ? (
        <Text style={styles.mutedText}>No members yet. Add a member in the Members tab.</Text>
      ) : (
        rootNodes.map((rootNode) => (
          <TreeNode
            key={`${rootNode.personId}-${rootNode.partnerId ?? "single"}`}
            personId={rootNode.personId}
            partnerId={rootNode.partnerId}
            depth={0}
            path={new Set<string>()}
            personById={personById}
            childrenByParent={childrenByParent}
            spouseByPerson={spouseByPerson}
            spouseIdsByPerson={spouseIdsByPerson}
            collapsedNodeIds={collapsedNodeIds}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            onToggle={toggleNode}
          />
        ))
      )}
    </View>
  );
};

type TreeNodeProps = {
  personId: string;
  partnerId?: string;
  depth: number;
  path: Set<string>;
  personById: Map<string, Person>;
  childrenByParent: Map<string, string[]>;
  spouseByPerson: Map<string, SpouseRelation[]>;
  spouseIdsByPerson: Map<string, string[]>;
  collapsedNodeIds: Set<string>;
  primaryColor: string;
  secondaryColor: string;
  onToggle: (personId: string, partnerId?: string) => void;
};

const TreeNode = ({
  personId,
  partnerId,
  depth,
  path,
  personById,
  childrenByParent,
  spouseByPerson,
  spouseIdsByPerson,
  collapsedNodeIds,
  primaryColor,
  secondaryColor,
  onToggle,
}: TreeNodeProps) => {
  const person = personById.get(personId);
  const partner = partnerId ? personById.get(partnerId) ?? null : null;
  if (!person) {
    return null;
  }

  if (path.has(personId) || (partnerId ? path.has(partnerId) : false)) {
    return (
      <View style={[styles.treeNode, { marginLeft: depth * 14 }]}>
        <Text style={styles.treeCycleText}>
          Cycle detected at {partner ? `${displayName(person)} + ${displayName(partner)}` : displayName(person)}
        </Text>
      </View>
    );
  }

  const nextPath = new Set(path);
  nextPath.add(personId);
  if (partnerId) {
    nextPath.add(partnerId);
  }

  const nodePersonIds = partnerId ? [personId, partnerId] : [personId];
  const uniqueChildIds = Array.from(
    new Set(nodePersonIds.flatMap((nodePersonId) => childrenByParent.get(nodePersonId) ?? [])),
  );

  const children = uniqueChildIds
    .map((childId) => personById.get(childId))
    .filter((value): value is Person => Boolean(value))
    .sort((a, b) => displayName(a).localeCompare(displayName(b)));

  const renderedChildIds = new Set<string>();
  const childRenderNodes: TreeRenderNode[] = [];

  children.forEach((child) => {
    if (renderedChildIds.has(child.id)) {
      return;
    }

    const partnerCandidate = (spouseIdsByPerson.get(child.id) ?? [])
      .filter((candidateId) => !nextPath.has(candidateId) && !nodePersonIds.includes(candidateId))
      .map((candidateId) => personById.get(candidateId))
      .filter((candidate): candidate is Person => Boolean(candidate))
      .sort((a, b) => displayName(a).localeCompare(displayName(b)))[0];

    if (partnerCandidate && !renderedChildIds.has(partnerCandidate.id)) {
      childRenderNodes.push(orderNodeByName(child.id, partnerCandidate.id, personById));
      renderedChildIds.add(partnerCandidate.id);
    } else {
      childRenderNodes.push({ personId: child.id });
    }

    renderedChildIds.add(child.id);
  });

  const spouseNameSet = new Set<string>();
  nodePersonIds.forEach((nodePersonId) => {
    (spouseByPerson.get(nodePersonId) ?? []).forEach((relation) => {
      const relationPartnerId = relation.personAId === nodePersonId ? relation.personBId : relation.personAId;
      if (nodePersonIds.includes(relationPartnerId)) {
        return;
      }
      const relationPartner = personById.get(relationPartnerId);
      if (relationPartner) {
        spouseNameSet.add(displayName(relationPartner));
      }
    });
  });

  const spouseNames = Array.from(spouseNameSet).sort((a, b) => a.localeCompare(b));
  const hasChildren = childRenderNodes.length > 0;
  const isCollapsed = collapsedNodeIds.has(personId) || (partnerId ? collapsedNodeIds.has(partnerId) : false);
  const isExpanded = hasChildren && !isCollapsed;

  return (
    <View style={[styles.treeNode, { marginLeft: depth * 14 }]}>
      <Pressable
        style={[
          styles.treeCard,
          hasChildren && styles.treeCardBranch,
          { borderColor: primaryColor, backgroundColor: secondaryColor },
        ]}
        onPress={hasChildren ? () => onToggle(personId, partnerId) : undefined}
      >
        <View style={styles.treeTitleRow}>
          <Text style={[styles.treeBranchLabel, { color: primaryColor }]}>{partner ? "Parent Pair" : "Member"}</Text>
          {hasChildren ? (
            <Text style={[styles.treeToggle, { backgroundColor: primaryColor }]}>
              {isCollapsed ? `+ ${childRenderNodes.length}` : `- ${childRenderNodes.length}`}
            </Text>
          ) : null}
        </View>

        {partner ? (
          <View style={styles.treePairRow}>
            <View style={[styles.treePersonTile, { borderColor: primaryColor, backgroundColor: "#ffffff" }]}>
              <Text style={styles.treeName}>{displayName(person)}</Text>
              {person.gender ? <Text style={styles.treeMeta}>Gender: {person.gender}</Text> : null}
              {person.dateOfBirth ? <Text style={styles.treeMeta}>Born: {formatDate(person.dateOfBirth)}</Text> : null}
            </View>

            <View style={[styles.treePairConnector, { borderTopColor: primaryColor }]} />

            <View style={[styles.treePersonTile, { borderColor: primaryColor, backgroundColor: "#ffffff" }]}>
              <Text style={styles.treeName}>{displayName(partner)}</Text>
              {partner.gender ? <Text style={styles.treeMeta}>Gender: {partner.gender}</Text> : null}
              {partner.dateOfBirth ? <Text style={styles.treeMeta}>Born: {formatDate(partner.dateOfBirth)}</Text> : null}
            </View>
          </View>
        ) : (
          <View style={[styles.treePersonTile, { borderColor: primaryColor, backgroundColor: "#ffffff" }]}>
            <Text style={styles.treeName}>{displayName(person)}</Text>
            {person.gender ? <Text style={styles.treeMeta}>Gender: {person.gender}</Text> : null}
            {person.dateOfBirth ? <Text style={styles.treeMeta}>Born: {formatDate(person.dateOfBirth)}</Text> : null}
            {spouseNames.length > 0 ? <Text style={styles.treeMeta}>Spouse(s): {spouseNames.join(", ")}</Text> : null}
          </View>
        )}
      </Pressable>

      {isExpanded ? (
        <View style={[styles.treeChildrenBlock, { borderLeftColor: primaryColor }]}>
          {childRenderNodes.map((childNode, index) => (
            <View key={`${personId}-${partnerId ?? "none"}-${childNode.personId}-${childNode.partnerId ?? "none"}`} style={styles.treeChildItem}>
              <View style={[styles.treeChildConnector, { borderTopColor: primaryColor }]} />
              {index === childRenderNodes.length - 1 ? <View style={styles.treeChildTailMask} /> : null}
              <TreeNode
                personId={childNode.personId}
                partnerId={childNode.partnerId}
                depth={depth + 1}
                path={nextPath}
                personById={personById}
                childrenByParent={childrenByParent}
                spouseByPerson={spouseByPerson}
                spouseIdsByPerson={spouseIdsByPerson}
                collapsedNodeIds={collapsedNodeIds}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                onToggle={onToggle}
              />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef2ee",
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  header: {
    flex: 1,
    marginTop: 8,
    marginBottom: 16,
  },
  settingsIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  workspace: {
    flex: 1,
  },
  workspaceWide: {
    flexDirection: "row",
    gap: 12,
  },
  sidebar: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    minWidth: 210,
  },
  sidebarStacked: {
    width: "100%",
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  sidebarHint: {
    color: "#45695d",
    marginTop: 4,
    marginBottom: 8,
    fontSize: 12,
  },
  sidebarNavButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  sidebarNavButtonText: {
    fontWeight: "700",
    fontSize: 13,
  },
  sidebarStatsBlock: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#b7cdc2",
    paddingTop: 8,
    gap: 4,
  },
  sidebarStatsText: {
    color: "#1d3f34",
    fontSize: 12,
    fontWeight: "600",
  },
  mainWorkspace: {
    flex: 1,
  },
  customizeToolbar: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  customizeToolbarTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  toolbarThemesRow: {
    marginBottom: 8,
  },
  toolbarThemeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginRight: 8,
  },
  toolbarThemeChipText: {
    fontWeight: "700",
    fontSize: 12,
  },
  toolbarActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  toolbarActionButton: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  toolbarActionButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#14332a",
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: "#507166",
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#2e5f4f",
    backgroundColor: "#d9e6de",
  },
  tabButtonActive: {
    backgroundColor: "#2e5f4f",
  },
  tabText: {
    fontWeight: "600",
    color: "#26463b",
  },
  tabTextActive: {
    color: "#ffffff",
  },
  refreshButton: {
    marginLeft: "auto",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#14332a",
  },
  refreshButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  content: {
    paddingBottom: 80,
  },
  panel: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#d9e6de",
    marginBottom: 16,
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
  subsectionTitle: {
    marginTop: 12,
    marginBottom: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#153a2f",
  },
  selectorRow: {
    marginBottom: 12,
  },
  selectorPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b8ccc2",
    marginRight: 8,
  },
  selectorPillActive: {
    backgroundColor: "#2e5f4f",
    borderColor: "#2e5f4f",
  },
  selectorPillText: {
    color: "#2e5f4f",
    fontWeight: "600",
  },
  selectorPillTextActive: {
    color: "#ffffff",
  },
  label: {
    marginBottom: 4,
    fontWeight: "600",
    color: "#1f4b3d",
  },
  input: {
    borderWidth: 1,
    borderColor: "#c2d5cc",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    marginBottom: 10,
    backgroundColor: "#ffffff",
  },
  invalidHint: {
    color: "#b43a3a",
    marginTop: -6,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  settingsSwatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  settingsSwatch: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#8fa49a",
  },
  settingsSwatchText: {
    color: "#2f4f43",
    fontSize: 12,
    fontWeight: "600",
  },
  settingsToggleRow: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  settingsToggleLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1f4b3d",
  },
  settingsToggleValuePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    minWidth: 52,
    alignItems: "center",
    backgroundColor: "#ffffff",
  },
  settingsToggleValueText: {
    fontWeight: "700",
    fontSize: 12,
    color: "#2e5f4f",
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
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
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b8ccc2",
  },
  optionButtonActive: {
    backgroundColor: "#2e5f4f",
    borderColor: "#2e5f4f",
  },
  optionButtonText: {
    color: "#2e5f4f",
    fontWeight: "600",
    fontSize: 12,
  },
  optionButtonTextActive: {
    color: "#ffffff",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#2e5f4f",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  secondaryDangerButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: "#fff5f5",
    borderWidth: 1,
    borderColor: "#d43838",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  secondaryDangerButtonText: {
    color: "#d43838",
    fontWeight: "700",
  },
  listBlock: {
    marginTop: 12,
    gap: 8,
  },
  listRow: {
    borderWidth: 1,
    borderColor: "#d2e1d9",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  listText: {
    flex: 1,
    color: "#1d3f34",
    fontSize: 13,
  },
  inlineDangerButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d43838",
    backgroundColor: "#fff7f7",
  },
  inlineDangerButtonText: {
    color: "#d43838",
    fontWeight: "600",
    fontSize: 12,
  },
  treePanelActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  treeMiniButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#eaf3ee",
    borderWidth: 1,
    borderColor: "#c3d7cc",
  },
  treeMiniButtonText: {
    color: "#2e5f4f",
    fontWeight: "700",
    fontSize: 12,
  },
  treeNode: {
    marginBottom: 6,
  },
  treeCard: {
    borderWidth: 1,
    borderColor: "#c9dbd1",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "#f8fcf9",
  },
  treeCardBranch: {
    borderColor: "#a5c1b4",
    backgroundColor: "#f4faf6",
  },
  treeBranchLabel: {
    fontWeight: "700",
    color: "#2e5f4f",
    fontSize: 12,
  },
  treeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  treePairRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
  },
  treePersonTile: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#c9dbd1",
    borderRadius: 10,
    padding: 8,
    backgroundColor: "#f8fcf9",
  },
  treePairConnector: {
    alignSelf: "center",
    width: 14,
    borderTopWidth: 1,
    borderTopColor: "#7da698",
  },
  treeName: {
    fontWeight: "700",
    color: "#184033",
    fontSize: 14,
  },
  treeToggle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#ffffff",
    backgroundColor: "#2e5f4f",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    minWidth: 42,
    textAlign: "center",
  },
  treeMeta: {
    color: "#3f6356",
    marginTop: 2,
    fontSize: 12,
  },
  treeChildrenBlock: {
    marginTop: 8,
    marginLeft: 14,
    paddingLeft: 12,
    borderLeftWidth: 1,
    borderLeftColor: "#a4c1b4",
  },
  treeChildItem: {
    position: "relative",
  },
  treeChildConnector: {
    position: "absolute",
    left: -12,
    top: 20,
    width: 12,
    borderTopWidth: 1,
    borderTopColor: "#a4c1b4",
  },
  treeChildTailMask: {
    position: "absolute",
    left: -13,
    top: 21,
    bottom: 0,
    width: 2,
    backgroundColor: "#ffffff",
  },
  treeCycleText: {
    color: "#b43a3a",
    fontWeight: "600",
  },
  errorBanner: {
    marginBottom: 10,
    backgroundColor: "#ffe8e8",
    borderColor: "#d43838",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: "#ad2a2a",
    fontWeight: "600",
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  mutedText: {
    color: "#5f7d72",
  },
});

export default App;
