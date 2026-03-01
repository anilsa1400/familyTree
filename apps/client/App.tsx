import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useFamilyTree } from "./src/hooks/useFamilyTree";
import { API_BASE_URL, getUiSettings, UiSettingsPayload, updateUiSettings } from "./src/lib/api";
import {
  Family,
  FamilyGraph,
  FamilyInput,
  Gender,
  ParentType,
  Person,
  PersonInput,
  SpouseRelation,
} from "./src/types/family";

type TabKey = "TREE" | "MEMBERS" | "RELATIONSHIPS" | "FAMILIES";
type AppPage = "HOME" | "SETTINGS";
type LayoutMode = "SIDEBAR" | "TOOLBAR";
type SectionViewMode = "TILE" | "LIST";
type ThemePresetId = "FOREST" | "OCEAN" | "SUNSET" | "GRAPHITE";
type ThemeEditorMode = "PRESET" | "CUSTOMIZE";

const MAX_GENERATION_DEPTH = 10;

const tabs: { key: TabKey; label: string }[] = [
  { key: "TREE", label: "Tree" },
  { key: "MEMBERS", label: "Members" },
  { key: "RELATIONSHIPS", label: "Relationships" },
  { key: "FAMILIES", label: "Families" },
];

const tabIconByKey: Record<TabKey, "git-branch-outline" | "people-outline" | "swap-horizontal-outline" | "albums-outline"> = {
  TREE: "git-branch-outline",
  MEMBERS: "people-outline",
  RELATIONSHIPS: "swap-horizontal-outline",
  FAMILIES: "albums-outline",
};

const genderOptions: (Gender | "")[] = ["", "MALE", "FEMALE", "NON_BINARY", "OTHER"];
const parentTypeOptions: ParentType[] = ["BIOLOGICAL", "ADOPTIVE", "STEP", "GUARDIAN"];

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

const isHexColor = (value: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value.trim());

const uiPreferencesStorageKey = "family-tree-ui-preferences-v2";

type UiPreferences = {
  activeTab: TabKey;
  activePage: AppPage;
  selectedThemeId: ThemePresetId;
  themeEditorMode: ThemeEditorMode;
  primaryColorInput: string;
  secondaryColorInput: string;
  layoutMode: LayoutMode;
  sidebarEnabled: boolean;
  showMemberPhotos: boolean;
  selectedFamilyName: string | null;
  sectionViewModeByTab: Record<TabKey, SectionViewMode>;
};

const isTabKey = (value: unknown): value is TabKey =>
  value === "TREE" || value === "MEMBERS" || value === "RELATIONSHIPS" || value === "FAMILIES";

const isAppPage = (value: unknown): value is AppPage =>
  value === "HOME" || value === "SETTINGS";

const isThemePresetId = (value: unknown): value is ThemePresetId =>
  value === "FOREST" || value === "OCEAN" || value === "SUNSET" || value === "GRAPHITE";

const isThemeEditorMode = (value: unknown): value is ThemeEditorMode =>
  value === "PRESET" || value === "CUSTOMIZE";

const isLayoutMode = (value: unknown): value is LayoutMode =>
  value === "SIDEBAR" || value === "TOOLBAR";

const isSectionViewMode = (value: unknown): value is SectionViewMode =>
  value === "TILE" || value === "LIST";

const tabSlugByKey: Record<TabKey, string> = {
  TREE: "tree",
  MEMBERS: "members",
  RELATIONSHIPS: "relationships",
  FAMILIES: "families",
};

const tabKeyBySlug: Record<string, TabKey> = {
  tree: "TREE",
  members: "MEMBERS",
  relationships: "RELATIONSHIPS",
  families: "FAMILIES",
};

const pageSlugByKey: Record<AppPage, string> = {
  HOME: "home",
  SETTINGS: "settings",
};

const pageKeyBySlug: Record<string, AppPage> = {
  home: "HOME",
  settings: "SETTINGS",
};

const displayName = (person: Person) => `${person.firstName} ${person.lastName}`.trim();

type FamilyGroup = {
  key: string;
  familyName: string;
  members: Person[];
};

const familyNameFromLastName = (lastName: string | null | undefined) => {
  const trimmed = (lastName ?? "").trim();
  return trimmed.length > 0 ? trimmed : "Unknown";
};

const buildFamilyNameMap = (graph: FamilyGraph): Map<string, string> => {
  const personById = new Map<string, Person>();
  graph.persons.forEach((person) => {
    personById.set(person.id, person);
  });

  const parentIdsByChild = new Map<string, string[]>();
  graph.parentChildRelations.forEach((relation) => {
    const parentIds = parentIdsByChild.get(relation.childId) ?? [];
    parentIds.push(relation.parentId);
    parentIdsByChild.set(relation.childId, parentIds);
  });

  const spouseRelationsByPerson = new Map<string, SpouseRelation[]>();
  graph.spouseRelations.forEach((relation) => {
    const listA = spouseRelationsByPerson.get(relation.personAId) ?? [];
    listA.push(relation);
    spouseRelationsByPerson.set(relation.personAId, listA);

    const listB = spouseRelationsByPerson.get(relation.personBId) ?? [];
    listB.push(relation);
    spouseRelationsByPerson.set(relation.personBId, listB);
  });

  const birthFamilyMemo = new Map<string, string>();
  const resolvingBirth = new Set<string>();

  const resolveBirthFamily = (personId: string): string => {
    if (birthFamilyMemo.has(personId)) {
      return birthFamilyMemo.get(personId) ?? "Unknown";
    }

    const self = personById.get(personId);
    if (!self) {
      return "Unknown";
    }

    if (resolvingBirth.has(personId)) {
      return familyNameFromLastName(self.lastName);
    }

    resolvingBirth.add(personId);

    const parentIds = parentIdsByChild.get(personId) ?? [];
    let familyName = familyNameFromLastName(self.lastName);

    if (parentIds.length > 0) {
      const fatherId = parentIds.find((parentId) => personById.get(parentId)?.gender === "MALE");
      const motherId = parentIds.find((parentId) => personById.get(parentId)?.gender === "FEMALE");
      const lineageParentId = fatherId ?? motherId ?? parentIds[0];

      if (lineageParentId) {
        familyName = resolveBirthFamily(lineageParentId);
      }
    }

    birthFamilyMemo.set(personId, familyName);
    resolvingBirth.delete(personId);
    return familyName;
  };

  const resolveHusbandIdForPerson = (personId: string): string | null => {
    const relations = (spouseRelationsByPerson.get(personId) ?? []).filter((relation) => !relation.divorcedAt);
    if (relations.length === 0) {
      return null;
    }

    const normalized = [...relations].sort((left, right) => {
      const leftDate = left.marriedAt ?? left.createdAt;
      const rightDate = right.marriedAt ?? right.createdAt;
      return rightDate.localeCompare(leftDate);
    });

    for (const relation of normalized) {
      const spouseId = relation.personAId === personId ? relation.personBId : relation.personAId;
      const spouse = personById.get(spouseId);
      if (spouse?.gender === "MALE") {
        return spouseId;
      }
    }

    return null;
  };

  const finalFamilyMap = new Map<string, string>();

  graph.persons.forEach((person) => {
    let familyName = resolveBirthFamily(person.id);

    if (person.gender === "FEMALE") {
      const husbandId = resolveHusbandIdForPerson(person.id);
      if (husbandId) {
        familyName = resolveBirthFamily(husbandId);
      }
    }

    finalFamilyMap.set(person.id, familyName);
  });

  return finalFamilyMap;
};

const groupMembersByFamilyName = (
  persons: Person[],
  familyNameByPersonId: Map<string, string>,
): FamilyGroup[] => {
  const groups = new Map<string, FamilyGroup>();

  persons.forEach((person) => {
    const familyName = familyNameByPersonId.get(person.id) ?? familyNameFromLastName(person.lastName);
    const key = familyName.toLowerCase();
    const current = groups.get(key);

    if (current) {
      current.members.push(person);
      return;
    }

    groups.set(key, {
      key,
      familyName,
      members: [person],
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      members: [...group.members].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    }))
    .sort((a, b) => a.familyName.localeCompare(b.familyName));
};

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

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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

type FamilyFormState = {
  name: string;
  motto: string;
  description: string;
};

const defaultFamilyFormState: FamilyFormState = {
  name: "",
  motto: "",
  description: "",
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

const defaultSectionViewModeByTab: Record<TabKey, SectionViewMode> = {
  TREE: "TILE",
  MEMBERS: "TILE",
  RELATIONSHIPS: "TILE",
  FAMILIES: "TILE",
};

const App = () => {
  const { width } = useWindowDimensions();
  const isWideLayout = width >= 980;
  const [activeTab, setActiveTab] = useState<TabKey>("TREE");
  const [activePage, setActivePage] = useState<AppPage>("HOME");
  const [selectedThemeId, setSelectedThemeId] = useState<ThemePresetId>("FOREST");
  const [themeEditorMode, setThemeEditorMode] = useState<ThemeEditorMode>("PRESET");
  const initialTheme = themePresets.find((preset) => preset.id === "FOREST") ?? themePresets[0];
  const [primaryColorInput, setPrimaryColorInput] = useState(initialTheme.primaryColor);
  const [secondaryColorInput, setSecondaryColorInput] = useState(initialTheme.secondaryColor);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("TOOLBAR");
  const [sidebarEnabled, setSidebarEnabled] = useState(false);
  const [showMemberPhotos, setShowMemberPhotos] = useState(true);
  const [selectedFamilyName, setSelectedFamilyName] = useState<string | null>(null);
  const [sectionViewModeByTab, setSectionViewModeByTab] = useState<Record<TabKey, SectionViewMode>>(
    defaultSectionViewModeByTab,
  );
  const [showSidebarHoverToggle, setShowSidebarHoverToggle] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPreferencesHydrated, setIsPreferencesHydrated] = useState(false);
  const [isServerSettingsHydrated, setIsServerSettingsHydrated] = useState(false);
  const sidebarToggleHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const serverSettingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastServerSyncedSettingsRef = useRef<string>("");

  const clearSidebarToggleHideTimer = () => {
    if (!sidebarToggleHideTimerRef.current) {
      return;
    }

    clearTimeout(sidebarToggleHideTimerRef.current);
    sidebarToggleHideTimerRef.current = null;
  };

  const clearServerSettingsSaveTimer = () => {
    if (!serverSettingsSaveTimerRef.current) {
      return;
    }

    clearTimeout(serverSettingsSaveTimerRef.current);
    serverSettingsSaveTimerRef.current = null;
  };

  const revealSidebarToggle = () => {
    clearSidebarToggleHideTimer();
    setShowSidebarHoverToggle(true);
  };

  const hideSidebarToggleWithDelay = () => {
    clearSidebarToggleHideTimer();
    sidebarToggleHideTimerRef.current = setTimeout(() => {
      setShowSidebarHoverToggle(false);
      sidebarToggleHideTimerRef.current = null;
    }, 140);
  };

  const applyUrlSelection = () => {
    if (typeof window === "undefined" || !window.location?.search) {
      return;
    }

    const searchParams = new URLSearchParams(window.location.search);
    const urlTab = searchParams.get("tab")?.toLowerCase() ?? "";
    const urlPage = searchParams.get("page")?.toLowerCase() ?? "";
    const urlFamily = searchParams.get("family")?.trim() ?? "";

    if (tabKeyBySlug[urlTab]) {
      setActiveTab(tabKeyBySlug[urlTab]);
    }

    if (pageKeyBySlug[urlPage]) {
      setActivePage(pageKeyBySlug[urlPage]);
    }

    if (urlFamily) {
      setSelectedFamilyName(urlFamily);
    }
  };

  const applyUiSettings = (settings: UiSettingsPayload) => {
    setActiveTab(settings.activeTab);
    setActivePage(settings.activePage);
    setSelectedThemeId(settings.selectedThemeId);
    setThemeEditorMode(settings.themeEditorMode);
    setPrimaryColorInput(settings.primaryColorInput);
    setSecondaryColorInput(settings.secondaryColorInput);
    setLayoutMode(settings.layoutMode);
    setSidebarEnabled(settings.sidebarEnabled);
    setShowMemberPhotos(settings.showMemberPhotos);
  };

  useEffect(
    () => () => {
      clearSidebarToggleHideTimer();
      clearServerSettingsSaveTimer();
    },
    [],
  );

  useEffect(() => {
    try {
      if (typeof window === "undefined") {
        setIsPreferencesHydrated(true);
        return;
      }

      if (window.localStorage) {
        const rawPreferences = window.localStorage.getItem(uiPreferencesStorageKey);
        if (rawPreferences) {
          const parsed = JSON.parse(rawPreferences) as Partial<UiPreferences>;

          if (isTabKey(parsed.activeTab)) {
            setActiveTab(parsed.activeTab);
          }

          if (isAppPage(parsed.activePage)) {
            setActivePage(parsed.activePage);
          }

          if (isThemePresetId(parsed.selectedThemeId)) {
            setSelectedThemeId(parsed.selectedThemeId);
          }

          if (isThemeEditorMode(parsed.themeEditorMode)) {
            setThemeEditorMode(parsed.themeEditorMode);
          }

          if (typeof parsed.primaryColorInput === "string") {
            setPrimaryColorInput(parsed.primaryColorInput);
          }

          if (typeof parsed.secondaryColorInput === "string") {
            setSecondaryColorInput(parsed.secondaryColorInput);
          }

          if (isLayoutMode(parsed.layoutMode)) {
            setLayoutMode(parsed.layoutMode);
          }

          if (typeof parsed.sidebarEnabled === "boolean") {
            setSidebarEnabled(parsed.sidebarEnabled);
          }

          if (typeof parsed.showMemberPhotos === "boolean") {
            setShowMemberPhotos(parsed.showMemberPhotos);
          }

          if (typeof parsed.selectedFamilyName === "string" || parsed.selectedFamilyName === null) {
            setSelectedFamilyName(parsed.selectedFamilyName);
          }

          if (parsed.sectionViewModeByTab && typeof parsed.sectionViewModeByTab === "object") {
            const rawModes = parsed.sectionViewModeByTab as Partial<Record<TabKey, SectionViewMode>>;
            const nextModes: Record<TabKey, SectionViewMode> = { ...defaultSectionViewModeByTab };

            (Object.keys(defaultSectionViewModeByTab) as TabKey[]).forEach((tabKey) => {
              const value = rawModes[tabKey];
              if (isSectionViewMode(value)) {
                nextModes[tabKey] = value;
              }
            });

            setSectionViewModeByTab(nextModes);
          }
        }
      }

      applyUrlSelection();
    } catch {
      // Ignore malformed preference state and keep defaults.
    } finally {
      setIsPreferencesHydrated(true);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const hydrateSettingsFromServer = async () => {
      try {
        const settings = await getUiSettings();
        if (!isMounted) {
          return;
        }

        const payload: UiSettingsPayload = {
          activeTab: settings.activeTab,
          activePage: settings.activePage,
          selectedThemeId: settings.selectedThemeId,
          themeEditorMode: settings.themeEditorMode,
          primaryColorInput: settings.primaryColorInput,
          secondaryColorInput: settings.secondaryColorInput,
          layoutMode: settings.layoutMode,
          sidebarEnabled: settings.sidebarEnabled,
          showMemberPhotos: settings.showMemberPhotos,
        };

        applyUiSettings(payload);
        lastServerSyncedSettingsRef.current = JSON.stringify(payload);

        // URL query params should be authoritative when explicitly provided.
        applyUrlSelection();
      } catch {
        // Ignore server hydration failures and continue with local/url settings.
      } finally {
        if (isMounted) {
          setIsServerSettingsHydrated(true);
        }
      }
    };

    void hydrateSettingsFromServer();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isPreferencesHydrated) {
      return;
    }

    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return;
      }

      const preferences: UiPreferences = {
        activeTab,
        activePage,
        selectedThemeId,
        themeEditorMode,
        primaryColorInput,
        secondaryColorInput,
        layoutMode,
        sidebarEnabled,
        showMemberPhotos,
        selectedFamilyName,
        sectionViewModeByTab,
      };

      window.localStorage.setItem(uiPreferencesStorageKey, JSON.stringify(preferences));
    } catch {
      // Ignore storage failures (private mode, disabled storage, etc.).
    }
  }, [
    activeTab,
    activePage,
    selectedThemeId,
    themeEditorMode,
    primaryColorInput,
    secondaryColorInput,
    layoutMode,
    sidebarEnabled,
    showMemberPhotos,
    selectedFamilyName,
    sectionViewModeByTab,
    isPreferencesHydrated,
  ]);

  useEffect(() => {
    if (!isPreferencesHydrated || !isServerSettingsHydrated) {
      return;
    }

    const payload: UiSettingsPayload = {
      activeTab,
      activePage,
      selectedThemeId,
      themeEditorMode,
      primaryColorInput,
      secondaryColorInput,
      layoutMode,
      sidebarEnabled,
      showMemberPhotos,
    };

    const serialized = JSON.stringify(payload);
    if (serialized === lastServerSyncedSettingsRef.current) {
      return;
    }

    clearServerSettingsSaveTimer();
    serverSettingsSaveTimerRef.current = setTimeout(() => {
      void updateUiSettings(payload)
        .then(() => {
          lastServerSyncedSettingsRef.current = serialized;
        })
        .catch(() => {
          // Ignore transient server persistence failures.
        })
        .finally(() => {
          serverSettingsSaveTimerRef.current = null;
        });
    }, 350);

    return () => {
      clearServerSettingsSaveTimer();
    };
  }, [
    activeTab,
    activePage,
    selectedThemeId,
    themeEditorMode,
    primaryColorInput,
    secondaryColorInput,
    layoutMode,
    sidebarEnabled,
    showMemberPhotos,
    isPreferencesHydrated,
    isServerSettingsHydrated,
  ]);

  useEffect(() => {
    if (!isPreferencesHydrated) {
      return;
    }

    try {
      if (typeof window === "undefined" || !window.history || !window.location) {
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      searchParams.set("tab", tabSlugByKey[activeTab]);
      searchParams.set("page", pageSlugByKey[activePage]);
      if (selectedFamilyName) {
        searchParams.set("family", selectedFamilyName);
      } else {
        searchParams.delete("family");
      }

      const nextSearch = searchParams.toString();
      const nextUrl = `${window.location.pathname}?${nextSearch}${window.location.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (nextUrl !== currentUrl) {
        window.history.replaceState(null, "", nextUrl);
      }
    } catch {
      // Ignore URL sync failures in restricted environments.
    }
  }, [activeTab, activePage, selectedFamilyName, isPreferencesHydrated]);

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

    setThemeEditorMode("PRESET");
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
    createFamily,
    updateFamily,
    deleteFamily,
  } = useFamilyTree();
  const familyNameByPersonId = useMemo(() => buildFamilyNameMap(graph), [graph]);
  const familyNames = useMemo(
    () =>
      Array.from(
        new Set(
          graph.persons.map(
            (person) => familyNameByPersonId.get(person.id) ?? familyNameFromLastName(person.lastName),
          ),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [graph.persons, familyNameByPersonId],
  );

  useEffect(() => {
    if (familyNames.length === 0) {
      if (selectedFamilyName !== null) {
        setSelectedFamilyName(null);
      }
      return;
    }

    if (!selectedFamilyName || !familyNames.includes(selectedFamilyName)) {
      setSelectedFamilyName(familyNames[0]);
    }
  }, [familyNames, selectedFamilyName]);

  const homeHeaderByTab: Record<TabKey, { title: string; description: string }> = {
    TREE: {
      title: "Family Tree View",
      description: `Visual lineage with expandable branches up to ${MAX_GENERATION_DEPTH} generations.`,
    },
    MEMBERS: {
      title: "Members Directory",
      description: "Create and manage family member profiles, details, and photos.",
    },
    RELATIONSHIPS: {
      title: "Relationship Manager",
      description: "Link members as parents, children, and spouses with clear relationship records.",
    },
    FAMILIES: {
      title: "Family Directory",
      description: "Create and maintain family details such as name, motto, and description.",
    },
  };

  const pageHeader =
    activePage === "SETTINGS"
      ? {
          title: "Workspace Settings",
          description: "Choose navigation mode, theme colors, and profile display preferences.",
        }
      : homeHeaderByTab[activeTab];

  const isSidebarMode = layoutMode === "SIDEBAR";
  const hasGraphContent =
    graph.families.length > 0 ||
    graph.persons.length > 0 ||
    graph.parentChildRelations.length > 0 ||
    graph.spouseRelations.length > 0;
  const showInitialLoader = isLoading && !isRefreshing && !hasGraphContent;
  const showRefreshIndicator = isRefreshing || (isLoading && hasGraphContent);
  const isSidebarToggleVisible = !isWideLayout || !sidebarEnabled || showSidebarHoverToggle;
  const showTopTabButtons = !isSidebarMode;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await reload();
    } finally {
      setIsRefreshing(false);
    }
  };

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
              styles.shadowStrong,
            ]}
            onPress={() => setActivePage((previous) => (previous === "HOME" ? "SETTINGS" : "HOME"))}
          >
            <Ionicons name={activePage === "HOME" ? "settings-outline" : "arrow-back"} size={20} color={uiTheme.primaryColor} />
          </Pressable>
        </View>

        <View style={[styles.pageHeaderCard, { borderColor: uiTheme.panelBorderColor, backgroundColor: uiTheme.surfaceColor }, styles.shadowSoft]}>
          <Text style={[styles.pageHeaderTitle, { color: uiTheme.primaryColor }]}>{pageHeader.title}</Text>
          <Text style={[styles.pageHeaderDescription, { color: uiTheme.subtitleColor }]}>{pageHeader.description}</Text>
        </View>

        {activePage === "SETTINGS" ? (
          <SettingsPage
            selectedThemeId={selectedThemeId}
            themeEditorMode={themeEditorMode}
            primaryColorInput={primaryColorInput}
            secondaryColorInput={secondaryColorInput}
            layoutMode={layoutMode}
            sidebarEnabled={sidebarEnabled}
            showMemberPhotos={showMemberPhotos}
            resolvedPrimaryColor={resolvedPrimaryColor}
            resolvedSecondaryColor={resolvedSecondaryColor}
            onPresetSelect={applyThemePreset}
            onThemeEditorModeChange={setThemeEditorMode}
            onPrimaryColorChange={setPrimaryColorInput}
            onSecondaryColorChange={setSecondaryColorInput}
            onLayoutModeSelect={(mode) => {
              setLayoutMode(mode);
              if (mode === "SIDEBAR") {
                setSidebarEnabled(true);
              }
            }}
            onToggleSidebar={() => setSidebarEnabled((previous) => !previous)}
            onToggleShowMemberPhotos={() => setShowMemberPhotos((previous) => !previous)}
          />
        ) : (
          <View style={[styles.workspace, isWideLayout && styles.workspaceWide]}>
            {isSidebarMode ? (
              <Pressable
                style={[
                  styles.sidebar,
                  !sidebarEnabled && isWideLayout && styles.sidebarCollapsed,
                  !sidebarEnabled && !isWideLayout && styles.sidebarCollapsedMobile,
                  !isWideLayout && styles.sidebarStacked,
                  { backgroundColor: uiTheme.secondaryColor, borderColor: uiTheme.primaryColor },
                  styles.shadowSoft,
                ]}
                onHoverIn={revealSidebarToggle}
                onHoverOut={hideSidebarToggleWithDelay}
              >
                <Pressable
                  style={[
                    styles.sidebarHoverToggleButton,
                    { borderColor: uiTheme.primaryColor, backgroundColor: uiTheme.surfaceColor },
                    !isSidebarToggleVisible && styles.sidebarHoverToggleButtonHidden,
                  ]}
                  pointerEvents="auto"
                  onHoverIn={revealSidebarToggle}
                  onHoverOut={hideSidebarToggleWithDelay}
                  onPress={() => setSidebarEnabled((previous) => !previous)}
                >
                  <Ionicons
                    name={sidebarEnabled ? "chevron-back" : "chevron-forward"}
                    size={16}
                    color={uiTheme.primaryColor}
                  />
                </Pressable>

                {sidebarEnabled ? (
                  <>
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
                          styles.shadowSoft,
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                      >
                        <Ionicons
                          name={tabIconByKey[tab.key]}
                          size={15}
                          color={activeTab === tab.key ? uiTheme.textOnPrimary : uiTheme.primaryColor}
                        />
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
                      <Text style={styles.sidebarStatsText}>Families: {graph.families.length}</Text>
                      <Text style={styles.sidebarStatsText}>Members: {graph.persons.length}</Text>
                      <Text style={styles.sidebarStatsText}>Parent Links: {graph.parentChildRelations.length}</Text>
                      <Text style={styles.sidebarStatsText}>Spouse Links: {graph.spouseRelations.length}</Text>
                    </View>
                  </>
                ) : null}

                {!sidebarEnabled ? (
                  <View style={[styles.sidebarCollapsedTabs, !isWideLayout && styles.sidebarCollapsedTabsMobile]}>
                    {tabs.map((tab) => (
                      <Pressable
                        key={`collapsed-sidebar-${tab.key}`}
                        style={[
                          styles.sidebarCollapsedTabButton,
                          {
                            borderColor: uiTheme.primaryColor,
                            backgroundColor: activeTab === tab.key ? uiTheme.primaryColor : uiTheme.surfaceColor,
                          },
                          styles.shadowSoft,
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                      >
                        <Ionicons
                          name={tabIconByKey[tab.key]}
                          size={18}
                          color={activeTab === tab.key ? uiTheme.textOnPrimary : uiTheme.primaryColor}
                        />
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            ) : null}

            <View style={styles.mainWorkspace}>
              <View style={styles.tabRow}>
                {showTopTabButtons
                  ? tabs.map((tab) => (
                      <Pressable
                        key={tab.key}
                        style={[
                          styles.tabButton,
                          { backgroundColor: uiTheme.secondaryColor },
                          activeTab === tab.key && { backgroundColor: uiTheme.primaryColor, borderColor: uiTheme.primaryColor },
                          styles.shadowSoft,
                        ]}
                        onPress={() => setActiveTab(tab.key)}
                      >
                        <Ionicons
                          name={tabIconByKey[tab.key]}
                          size={16}
                          color={activeTab === tab.key ? uiTheme.textOnPrimary : uiTheme.primaryColor}
                        />
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
                    ))
                  : null}
              </View>

              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {showInitialLoader ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={uiTheme.primaryColor} />
                  <Text style={styles.mutedText}>Loading family graph...</Text>
                </View>
              ) : (
                <ScrollView
                  contentContainerStyle={styles.content}
                  refreshControl={
                    <RefreshControl
                      refreshing={showRefreshIndicator}
                      onRefresh={() => void handleRefresh()}
                      colors={[uiTheme.primaryColor]}
                      tintColor={uiTheme.primaryColor}
                    />
                  }
                >
                  {showRefreshIndicator ? (
                    <View style={[styles.refreshIndicator, { borderColor: uiTheme.panelBorderColor }, styles.shadowSoft]}>
                      <ActivityIndicator size="small" color={uiTheme.primaryColor} />
                      <Text style={[styles.refreshIndicatorText, { color: uiTheme.primaryColor }]}>Syncing latest family data...</Text>
                    </View>
                  ) : null}

                  {activeTab === "TREE" ? (
                    <TreePanel
                      graph={graph}
                      primaryColor={uiTheme.primaryColor}
                      secondaryColor={uiTheme.secondaryColor}
                      showMemberPhotos={showMemberPhotos}
                      familyNameByPersonId={familyNameByPersonId}
                      familyNames={familyNames}
                      selectedFamilyName={selectedFamilyName}
                      onSelectFamily={setSelectedFamilyName}
                      viewMode={sectionViewModeByTab.TREE}
                      onToggleViewMode={() =>
                        setSectionViewModeByTab((previous) => ({
                          ...previous,
                          TREE: previous.TREE === "TILE" ? "LIST" : "TILE",
                        }))
                      }
                      onRefresh={handleRefresh}
                      isRefreshing={showRefreshIndicator}
                    />
                  ) : null}

                  {activeTab === "MEMBERS" ? (
                    <MembersPanel
                      persons={graph.persons}
                      isMutating={isMutating}
                      primaryColor={uiTheme.primaryColor}
                      secondaryColor={uiTheme.secondaryColor}
                      showMemberPhotos={showMemberPhotos}
                      familyNameByPersonId={familyNameByPersonId}
                      familyNames={familyNames}
                      selectedFamilyName={selectedFamilyName}
                      onSelectFamily={setSelectedFamilyName}
                      viewMode={sectionViewModeByTab.MEMBERS}
                      onToggleViewMode={() =>
                        setSectionViewModeByTab((previous) => ({
                          ...previous,
                          MEMBERS: previous.MEMBERS === "TILE" ? "LIST" : "TILE",
                        }))
                      }
                      onCreate={createPerson}
                      onUpdate={updatePerson}
                      onDelete={deletePerson}
                      onRefresh={handleRefresh}
                      isRefreshing={showRefreshIndicator}
                    />
                  ) : null}

                  {activeTab === "RELATIONSHIPS" ? (
                    <RelationshipsPanel
                      graph={graph}
                      isMutating={isMutating}
                      primaryColor={uiTheme.primaryColor}
                      secondaryColor={uiTheme.secondaryColor}
                      familyNameByPersonId={familyNameByPersonId}
                      familyNames={familyNames}
                      selectedFamilyName={selectedFamilyName}
                      onSelectFamily={setSelectedFamilyName}
                      viewMode={sectionViewModeByTab.RELATIONSHIPS}
                      onToggleViewMode={() =>
                        setSectionViewModeByTab((previous) => ({
                          ...previous,
                          RELATIONSHIPS: previous.RELATIONSHIPS === "TILE" ? "LIST" : "TILE",
                        }))
                      }
                      onCreateParentChild={createParentChild}
                      onDeleteParentChild={deleteParentChild}
                      onCreateSpouse={createSpouse}
                      onDeleteSpouse={deleteSpouse}
                      onRefresh={handleRefresh}
                      isRefreshing={showRefreshIndicator}
                    />
                  ) : null}

                  {activeTab === "FAMILIES" ? (
                    <FamiliesPanel
                      families={graph.families}
                      isMutating={isMutating}
                      primaryColor={uiTheme.primaryColor}
                      secondaryColor={uiTheme.secondaryColor}
                      onCreate={createFamily}
                      onUpdate={updateFamily}
                      onDelete={deleteFamily}
                      onRefresh={handleRefresh}
                      isRefreshing={showRefreshIndicator}
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
  themeEditorMode: ThemeEditorMode;
  primaryColorInput: string;
  secondaryColorInput: string;
  layoutMode: LayoutMode;
  sidebarEnabled: boolean;
  showMemberPhotos: boolean;
  resolvedPrimaryColor: string;
  resolvedSecondaryColor: string;
  onPresetSelect: (presetId: ThemePresetId) => void;
  onThemeEditorModeChange: (mode: ThemeEditorMode) => void;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  onLayoutModeSelect: (mode: LayoutMode) => void;
  onToggleSidebar: () => void;
  onToggleShowMemberPhotos: () => void;
};

type ColorPickerFieldProps = {
  label: string;
  selectedColor: string;
  onSelectColor: (value: string) => void;
};

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

const ColorPickerField = ({ label, selectedColor, onSelectColor }: ColorPickerFieldProps) => {
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

const SettingsPage = ({
  selectedThemeId,
  themeEditorMode,
  primaryColorInput,
  secondaryColorInput,
  layoutMode,
  sidebarEnabled,
  showMemberPhotos,
  resolvedPrimaryColor,
  resolvedSecondaryColor,
  onPresetSelect,
  onThemeEditorModeChange,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onLayoutModeSelect,
  onToggleSidebar,
  onToggleShowMemberPhotos,
}: SettingsPageProps) => {
  const isCustomizeMode = themeEditorMode === "CUSTOMIZE";

  const applyPrimaryColor = (value: string) => {
    onThemeEditorModeChange("CUSTOMIZE");
    onPrimaryColorChange(value);
  };

  const applySecondaryColor = (value: string) => {
    onThemeEditorModeChange("CUSTOMIZE");
    onSecondaryColorChange(value);
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={[styles.panel, styles.shadowSoft]}>
        <Text style={styles.panelTitle}>Settings</Text>
        <Text style={styles.panelHint}>
          Select a theme using preset mode or switch to customize mode for manual colors.
        </Text>

        <Text style={styles.label}>Theme Mode</Text>
        <View style={styles.optionRowWrap}>
          {(["PRESET", "CUSTOMIZE"] as ThemeEditorMode[]).map((mode) => {
            const isSelected = themeEditorMode === mode;
            const label = mode === "PRESET" ? "Preset" : "Customize";

            return (
              <Pressable
                key={`theme-editor-mode-${mode}`}
                style={[
                  styles.optionButton,
                  { borderColor: resolvedPrimaryColor, backgroundColor: resolvedSecondaryColor },
                  isSelected && { borderColor: resolvedPrimaryColor, backgroundColor: resolvedPrimaryColor },
                ]}
                onPress={() => onThemeEditorModeChange(mode)}
              >
                <Text style={[styles.optionButtonText, { color: resolvedPrimaryColor }, isSelected && styles.optionButtonTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!isCustomizeMode ? (
          <>
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
          </>
        ) : (
          <>
            <ColorPickerField
              label="Primary Color Picker"
              selectedColor={resolvedPrimaryColor}
              onSelectColor={applyPrimaryColor}
            />
            <TextInput
              value={primaryColorInput}
              onChangeText={applyPrimaryColor}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="#2e5f4f"
            />
            {!isHexColor(primaryColorInput) ? (
              <Text style={styles.invalidHint}>Invalid color format. Use values like #123abc.</Text>
            ) : null}

            <ColorPickerField
              label="Secondary Color Picker"
              selectedColor={resolvedSecondaryColor}
              onSelectColor={applySecondaryColor}
            />
            <TextInput
              value={secondaryColorInput}
              onChangeText={applySecondaryColor}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="#d9e6de"
            />
            {!isHexColor(secondaryColorInput) ? (
              <Text style={styles.invalidHint}>Invalid color format. Use values like #def0ab.</Text>
            ) : null}
          </>
        )}

        <View style={styles.settingsSwatchRow}>
          <View style={[styles.settingsSwatch, { backgroundColor: resolvedPrimaryColor }]} />
          <Text style={styles.settingsSwatchText}>Applied primary: {resolvedPrimaryColor}</Text>
        </View>
        <View style={styles.settingsSwatchRow}>
          <View style={[styles.settingsSwatch, { backgroundColor: resolvedSecondaryColor }]} />
          <Text style={styles.settingsSwatchText}>Applied secondary: {resolvedSecondaryColor}</Text>
        </View>

        <Text style={styles.subsectionTitle}>Navigation</Text>
        <View style={styles.optionRowWrap}>
          {(["SIDEBAR", "TOOLBAR"] as LayoutMode[]).map((mode) => {
            const isSelected = layoutMode === mode;
            const label = mode === "SIDEBAR" ? "Sidebar" : "Toolbar";

            return (
              <Pressable
                key={`layout-mode-${mode}`}
                style={[
                  styles.optionButton,
                  { borderColor: resolvedPrimaryColor, backgroundColor: resolvedSecondaryColor },
                  isSelected && { borderColor: resolvedPrimaryColor, backgroundColor: resolvedPrimaryColor },
                ]}
                onPress={() => onLayoutModeSelect(mode)}
              >
                <Text style={[styles.optionButtonText, { color: resolvedPrimaryColor }, isSelected && styles.optionButtonTextActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.subsectionTitle}>Display Options</Text>
        <SettingsToggle
          label="Show Member Photos"
          value={showMemberPhotos}
          accentColor={resolvedPrimaryColor}
          onPress={onToggleShowMemberPhotos}
        />
        <SettingsToggle
          label="Expand Sidebar (Sidebar mode)"
          value={sidebarEnabled}
          accentColor={resolvedPrimaryColor}
          onPress={onToggleSidebar}
        />
      </View>
    </ScrollView>
  );
};

type SettingsToggleProps = {
  label: string;
  value: boolean;
  accentColor: string;
  onPress: () => void;
};

const SettingsToggle = ({ label, value, accentColor, onPress }: SettingsToggleProps) => (
  <Pressable
    style={[
      styles.settingsToggleRow,
      { borderColor: accentColor },
      value && { backgroundColor: `${accentColor}22` },
      styles.shadowSoft,
    ]}
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

type SectionRefreshButtonProps = {
  primaryColor: string;
  isRefreshing: boolean;
  onRefresh: () => Promise<void>;
};

const SectionRefreshButton = ({ primaryColor, isRefreshing, onRefresh }: SectionRefreshButtonProps) => (
  <Pressable
    style={[styles.refreshButton, { backgroundColor: primaryColor }, styles.shadowSoft]}
    onPress={() => void onRefresh()}
    disabled={isRefreshing}
  >
    {isRefreshing ? (
      <ActivityIndicator size="small" color="#ffffff" />
    ) : (
      <Ionicons name="refresh-outline" size={16} color="#ffffff" />
    )}
    <Text style={styles.refreshButtonText}>{isRefreshing ? "Refreshing..." : "Refresh"}</Text>
  </Pressable>
);

type SectionViewModeToggleProps = {
  primaryColor: string;
  viewMode: SectionViewMode;
  onToggle: () => void;
};

const SectionViewModeToggle = ({ primaryColor, viewMode, onToggle }: SectionViewModeToggleProps) => {
  const isTile = viewMode === "TILE";

  return (
    <Pressable
      style={[styles.sectionModeButton, { borderColor: primaryColor, backgroundColor: "#ffffff" }, styles.shadowSoft]}
      onPress={onToggle}
    >
      <Ionicons name={isTile ? "grid-outline" : "list-outline"} size={15} color={primaryColor} />
      <Text style={[styles.sectionModeButtonText, { color: primaryColor }]}>{isTile ? "Tile" : "List"}</Text>
    </Pressable>
  );
};

type FamilyFilterSelectorProps = {
  familyNames: string[];
  selectedFamilyName: string | null;
  primaryColor: string;
  onSelectFamily: (familyName: string) => void;
};

const FamilyFilterSelector = ({
  familyNames,
  selectedFamilyName,
  primaryColor,
  onSelectFamily,
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
  const selectedLabel = selectedFamilyName ?? "Select family";

  return (
    <View style={styles.familyFilterBlock}>
      <Text style={styles.familyFilterLabel}>Viewing Family</Text>
      <View style={styles.familyDropdownContainer}>
        <Pressable
          style={[styles.familyDropdownTrigger, { borderColor: primaryColor, backgroundColor: "#ffffff" }, styles.shadowSoft]}
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
            <View style={[styles.familyDropdownMenu, { borderColor: primaryColor, backgroundColor: "#ffffff" }, styles.shadowStrong]}>
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

type FamiliesPanelProps = {
  families: Family[];
  isMutating: boolean;
  primaryColor: string;
  secondaryColor: string;
  onCreate: (payload: FamilyInput) => Promise<void>;
  onUpdate: (familyId: string, payload: FamilyInput) => Promise<void>;
  onDelete: (familyId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
};

const FamiliesPanel = ({
  families,
  isMutating,
  primaryColor,
  secondaryColor,
  onCreate,
  onUpdate,
  onDelete,
  onRefresh,
  isRefreshing,
}: FamiliesPanelProps) => {
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);
  const [formState, setFormState] = useState<FamilyFormState>(defaultFamilyFormState);

  const sortedFamilies = useMemo(() => [...families].sort((left, right) => left.name.localeCompare(right.name)), [families]);
  const selectedFamily = sortedFamilies.find((family) => family.id === selectedFamilyId) ?? null;

  useEffect(() => {
    if (!selectedFamilyId) {
      return;
    }

    const exists = sortedFamilies.some((family) => family.id === selectedFamilyId);
    if (!exists) {
      setSelectedFamilyId(null);
      setFormState(defaultFamilyFormState);
    }
  }, [selectedFamilyId, sortedFamilies]);

  const selectFamily = (family: Family | null) => {
    if (!family) {
      setSelectedFamilyId(null);
      setFormState(defaultFamilyFormState);
      return;
    }

    setSelectedFamilyId(family.id);
    setFormState({
      name: family.name,
      motto: family.motto ?? "",
      description: family.description ?? "",
    });
  };

  const saveFamily = async () => {
    const name = formState.name.trim();
    if (!name) {
      return;
    }

    const payload: FamilyInput = {
      name,
      motto: toNullable(formState.motto),
      description: toNullable(formState.description),
    };

    if (selectedFamilyId) {
      await onUpdate(selectedFamilyId, payload);
    } else {
      await onCreate(payload);
    }

    selectFamily(null);
  };

  const removeFamily = async () => {
    if (!selectedFamilyId) {
      return;
    }

    await onDelete(selectedFamilyId);
    selectFamily(null);
  };

  return (
    <View style={[styles.panel, styles.shadowSoft]}>
      <View style={styles.panelHeaderRow}>
        <View style={styles.panelHeaderTextBlock}>
          <Text style={styles.panelTitle}>Families</Text>
          <Text style={styles.panelHint}>Add, edit, and remove family details.</Text>
        </View>
        <View style={styles.panelHeaderActions}>
          <SectionRefreshButton primaryColor={primaryColor} isRefreshing={isRefreshing} onRefresh={onRefresh} />
        </View>
      </View>

      <Text style={styles.label}>Select Family</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
        <Pressable
          style={[
            styles.selectorPill,
            { borderColor: primaryColor, backgroundColor: "#ffffff" },
            !selectedFamilyId && { backgroundColor: primaryColor, borderColor: primaryColor },
          ]}
          onPress={() => selectFamily(null)}
        >
          <Text style={[styles.selectorPillText, { color: primaryColor }, !selectedFamilyId && styles.selectorPillTextActive]}>
            New Family
          </Text>
        </Pressable>
        {sortedFamilies.map((family) => (
          <Pressable
            key={family.id}
            style={[
              styles.selectorPill,
              { borderColor: primaryColor, backgroundColor: "#ffffff" },
              selectedFamilyId === family.id && { backgroundColor: primaryColor, borderColor: primaryColor },
            ]}
            onPress={() => selectFamily(family)}
          >
            <Text
              style={[
                styles.selectorPillText,
                { color: primaryColor },
                selectedFamilyId === family.id && styles.selectorPillTextActive,
              ]}
            >
              {family.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={[styles.familyInfoCard, { borderColor: primaryColor, backgroundColor: `${secondaryColor}66` }]}>
        <Text style={[styles.familyInfoText, { color: primaryColor }]}>
          Total families: {sortedFamilies.length}
          {selectedFamily ? ` | Editing: ${selectedFamily.name}` : ""}
        </Text>
      </View>

      <Text style={styles.label}>Family Name</Text>
      <TextInput
        value={formState.name}
        onChangeText={(text) => setFormState((previous) => ({ ...previous, name: text }))}
        style={styles.input}
        placeholder="Johnson"
      />

      <Text style={styles.label}>Motto (optional)</Text>
      <TextInput
        value={formState.motto}
        onChangeText={(text) => setFormState((previous) => ({ ...previous, motto: text }))}
        style={styles.input}
        placeholder="Together we grow"
      />

      <Text style={styles.label}>Description (optional)</Text>
      <TextInput
        value={formState.description}
        onChangeText={(text) => setFormState((previous) => ({ ...previous, description: text }))}
        style={[styles.input, styles.multilineInput]}
        multiline
        placeholder="Family background, history, and notes..."
      />

      <View style={styles.actionRow}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: primaryColor }]}
          onPress={() => void saveFamily()}
          disabled={isMutating}
        >
          <Text style={styles.primaryButtonText}>{selectedFamily ? "Update Family" : "Add Family"}</Text>
        </Pressable>

        {selectedFamily ? (
          <Pressable style={styles.secondaryDangerButton} onPress={() => void removeFamily()} disabled={isMutating}>
            <Text style={styles.secondaryDangerButtonText}>Delete</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

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

const memberInitials = (person: Person) => {
  const first = person.firstName.trim().charAt(0).toUpperCase();
  const last = person.lastName.trim().charAt(0).toUpperCase();
  const initials = `${first}${last}`.trim();
  return initials || "M";
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

const MemberDetailsCard = ({
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
        styles.shadowSoft,
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

type MembersPanelProps = {
  persons: Person[];
  isMutating: boolean;
  primaryColor: string;
  secondaryColor: string;
  showMemberPhotos: boolean;
  familyNameByPersonId: Map<string, string>;
  familyNames: string[];
  selectedFamilyName: string | null;
  onSelectFamily: (familyName: string) => void;
  viewMode: SectionViewMode;
  onToggleViewMode: () => void;
  onCreate: (payload: PersonInput) => Promise<void>;
  onUpdate: (personId: string, payload: PersonInput) => Promise<void>;
  onDelete: (personId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
};

const MembersPanel = ({
  persons,
  isMutating,
  primaryColor,
  secondaryColor,
  showMemberPhotos,
  familyNameByPersonId,
  familyNames,
  selectedFamilyName,
  onSelectFamily,
  viewMode,
  onToggleViewMode,
  onCreate,
  onUpdate,
  onDelete,
  onRefresh,
  isRefreshing,
}: MembersPanelProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PersonFormState>(defaultFormState);
  const listFamilyCardWidth = useMemo(() => clamp(screenWidth - 96, 240, 380), [screenWidth]);
  const tileMemberCardWidth = useMemo(() => {
    if (screenWidth < 640) {
      return clamp(screenWidth - 92, 220, 380);
    }
    if (screenWidth < 980) {
      return clamp(Math.floor((screenWidth - 142) / 2), 220, 320);
    }
    return clamp(Math.floor((screenWidth - 196) / 3), 220, 300);
  }, [screenWidth]);

  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [persons],
  );
  const groupedFamilies = useMemo(
    () => groupMembersByFamilyName(sortedPersons, familyNameByPersonId),
    [sortedPersons, familyNameByPersonId],
  );
  const visibleGroupedFamilies = useMemo(
    () =>
      selectedFamilyName
        ? groupedFamilies.filter((familyGroup) => familyGroup.familyName === selectedFamilyName)
        : groupedFamilies,
    [groupedFamilies, selectedFamilyName],
  );

  const selectedPerson = sortedPersons.find((person) => person.id === selectedPersonId) ?? null;
  const selectedPersonFamilyName = selectedPerson ? familyNameByPersonId.get(selectedPerson.id) ?? "Unknown" : null;

  useEffect(() => {
    if (!selectedPersonId || !selectedFamilyName) {
      return;
    }

    const selectedPersonValue = sortedPersons.find((person) => person.id === selectedPersonId);
    if (!selectedPersonValue) {
      return;
    }

    const familyNameForSelected =
      familyNameByPersonId.get(selectedPersonValue.id) ?? familyNameFromLastName(selectedPersonValue.lastName);
    if (familyNameForSelected !== selectedFamilyName) {
      setSelectedPersonId(null);
      setFormState(defaultFormState);
    }
  }, [familyNameByPersonId, selectedFamilyName, selectedPersonId, sortedPersons]);

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
    <View style={[styles.panel, styles.shadowSoft]}>
      <View style={styles.panelHeaderRow}>
        <View style={styles.panelHeaderTextBlock}>
          <Text style={styles.panelTitle}>Members</Text>
          <Text style={styles.panelHint}>Create, edit, and delete family members grouped by family name.</Text>
        </View>
        <View style={styles.panelHeaderActions}>
          <SectionViewModeToggle primaryColor={primaryColor} viewMode={viewMode} onToggle={onToggleViewMode} />
          <SectionRefreshButton primaryColor={primaryColor} isRefreshing={isRefreshing} onRefresh={onRefresh} />
        </View>
      </View>
      <FamilyFilterSelector
        familyNames={familyNames}
        selectedFamilyName={selectedFamilyName}
        primaryColor={primaryColor}
        onSelectFamily={onSelectFamily}
      />

      {selectedPersonFamilyName ? (
        <Text style={[styles.memberFamilyBadge, { borderColor: primaryColor, color: primaryColor }]}>
          Linked Family: {selectedPersonFamilyName} Family
        </Text>
      ) : null}

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
      </ScrollView>

      {viewMode === "LIST" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
          <View style={styles.horizontalSectionsRow}>
            {visibleGroupedFamilies.map((familyGroup) => (
              <View
                key={`family-group-${familyGroup.key}`}
                style={[
                  styles.familyGroupCard,
                  styles.memberFamilyCardListMode,
                  { width: listFamilyCardWidth },
                  { borderColor: primaryColor, backgroundColor: `${secondaryColor}77` },
                  styles.shadowSoft,
                ]}
              >
                <View style={styles.familyGroupHeaderRow}>
                  <Text style={[styles.familyGroupTitle, { color: primaryColor }]}>{familyGroup.familyName} Family</Text>
                  <Text style={styles.familyGroupCount}>{familyGroup.members.length} member(s)</Text>
                </View>

                <View style={styles.memberCardColumn}>
                  {familyGroup.members.map((person) => {
                    const familyName = familyNameByPersonId.get(person.id) ?? familyGroup.familyName;
                    return (
                      <MemberDetailsCard
                        key={person.id}
                        person={person}
                        familyName={familyName}
                        primaryColor={primaryColor}
                        secondaryColor={secondaryColor}
                        showMemberPhotos={showMemberPhotos}
                        isSelected={selectedPersonId === person.id}
                        cardWidth={"100%"}
                        onPress={() => selectPerson(person)}
                      />
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <View style={styles.familyGroupsContainer}>
          {visibleGroupedFamilies.map((familyGroup) => (
            <View
              key={`family-group-${familyGroup.key}`}
              style={[styles.familyGroupCard, { borderColor: primaryColor, backgroundColor: `${secondaryColor}77` }, styles.shadowSoft]}
            >
              <View style={styles.familyGroupHeaderRow}>
                <Text style={[styles.familyGroupTitle, { color: primaryColor }]}>{familyGroup.familyName} Family</Text>
                <Text style={styles.familyGroupCount}>{familyGroup.members.length} member(s)</Text>
              </View>

              <View style={styles.memberCardGrid}>
                {familyGroup.members.map((person) => {
                  const familyName = familyNameByPersonId.get(person.id) ?? familyGroup.familyName;
                  return (
                    <MemberDetailsCard
                      key={person.id}
                      person={person}
                      familyName={familyName}
                      primaryColor={primaryColor}
                      secondaryColor={secondaryColor}
                      showMemberPhotos={showMemberPhotos}
                      isSelected={selectedPersonId === person.id}
                      cardWidth={tileMemberCardWidth}
                      onPress={() => selectPerson(person)}
                    />
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      )}

      {visibleGroupedFamilies.length === 0 ? (
        <Text style={styles.mutedText}>No members found for the selected family.</Text>
      ) : null}

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
  familyNameByPersonId: Map<string, string>;
  familyNames: string[];
  selectedFamilyName: string | null;
  onSelectFamily: (familyName: string) => void;
  viewMode: SectionViewMode;
  onToggleViewMode: () => void;
  onCreateParentChild: (payload: { parentId: string; childId: string; relationType: ParentType }) => Promise<void>;
  onDeleteParentChild: (parentId: string, childId: string) => Promise<void>;
  onCreateSpouse: (payload: {
    personAId: string;
    personBId: string;
    marriedAt?: string | null;
    divorcedAt?: string | null;
  }) => Promise<void>;
  onDeleteSpouse: (personAId: string, personBId: string) => Promise<void>;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
};

const RelationshipsPanel = ({
  graph,
  isMutating,
  primaryColor,
  secondaryColor,
  familyNameByPersonId,
  familyNames,
  selectedFamilyName,
  onSelectFamily,
  viewMode,
  onToggleViewMode,
  onCreateParentChild,
  onDeleteParentChild,
  onCreateSpouse,
  onDeleteSpouse,
  onRefresh,
  isRefreshing,
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
  const filteredPersons = useMemo(
    () =>
      selectedFamilyName
        ? persons.filter((person) => {
            const familyName = familyNameByPersonId.get(person.id) ?? familyNameFromLastName(person.lastName);
            return familyName === selectedFamilyName;
          })
        : persons,
    [persons, selectedFamilyName, familyNameByPersonId],
  );
  const filteredPersonIdSet = useMemo(() => new Set(filteredPersons.map((person) => person.id)), [filteredPersons]);
  const visibleParentChildRelations = useMemo(
    () =>
      selectedFamilyName
        ? graph.parentChildRelations.filter(
            (relation) => filteredPersonIdSet.has(relation.parentId) || filteredPersonIdSet.has(relation.childId),
          )
        : graph.parentChildRelations,
    [graph.parentChildRelations, selectedFamilyName, filteredPersonIdSet],
  );
  const visibleSpouseRelations = useMemo(
    () =>
      selectedFamilyName
        ? graph.spouseRelations.filter(
            (relation) => filteredPersonIdSet.has(relation.personAId) || filteredPersonIdSet.has(relation.personBId),
          )
        : graph.spouseRelations,
    [graph.spouseRelations, selectedFamilyName, filteredPersonIdSet],
  );

  const [parentId, setParentId] = useState<string>("");
  const [childId, setChildId] = useState<string>("");
  const [relationType, setRelationType] = useState<ParentType>("BIOLOGICAL");

  const [spouseAId, setSpouseAId] = useState<string>("");
  const [spouseBId, setSpouseBId] = useState<string>("");
  const [marriedAt, setMarriedAt] = useState<string>("");
  const [divorcedAt, setDivorcedAt] = useState<string>("");

  useEffect(() => {
    if (!parentId || filteredPersonIdSet.has(parentId)) {
      return;
    }
    setParentId("");
  }, [parentId, filteredPersonIdSet]);

  useEffect(() => {
    if (!childId || filteredPersonIdSet.has(childId)) {
      return;
    }
    setChildId("");
  }, [childId, filteredPersonIdSet]);

  useEffect(() => {
    if (!spouseAId || filteredPersonIdSet.has(spouseAId)) {
      return;
    }
    setSpouseAId("");
  }, [spouseAId, filteredPersonIdSet]);

  useEffect(() => {
    if (!spouseBId || filteredPersonIdSet.has(spouseBId)) {
      return;
    }
    setSpouseBId("");
  }, [spouseBId, filteredPersonIdSet]);

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
    <View style={[styles.panel, styles.shadowSoft]}>
      <View style={styles.panelHeaderRow}>
        <View style={styles.panelHeaderTextBlock}>
          <Text style={styles.panelTitle}>Relationships</Text>
          <Text style={styles.panelHint}>Connect members as parent-child and spouses.</Text>
        </View>
        <View style={styles.panelHeaderActions}>
          <SectionViewModeToggle primaryColor={primaryColor} viewMode={viewMode} onToggle={onToggleViewMode} />
          <SectionRefreshButton primaryColor={primaryColor} isRefreshing={isRefreshing} onRefresh={onRefresh} />
        </View>
      </View>
      <FamilyFilterSelector
        familyNames={familyNames}
        selectedFamilyName={selectedFamilyName}
        primaryColor={primaryColor}
        onSelectFamily={onSelectFamily}
      />
      {filteredPersons.length === 0 ? <Text style={styles.mutedText}>No members found for the selected family.</Text> : null}

      <Text style={styles.subsectionTitle}>Parent to Child</Text>
      <Text style={styles.label}>Parent</Text>
      <HorizontalPersonSelector
        persons={filteredPersons}
        selectedId={parentId}
        onSelect={setParentId}
        primaryColor={primaryColor}
        familyNameByPersonId={familyNameByPersonId}
        viewMode={viewMode}
      />

      <Text style={styles.label}>Child</Text>
      <HorizontalPersonSelector
        persons={filteredPersons}
        selectedId={childId}
        onSelect={setChildId}
        primaryColor={primaryColor}
        familyNameByPersonId={familyNameByPersonId}
        viewMode={viewMode}
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
        {visibleParentChildRelations.map((relation) => {
          const parent = personById.get(relation.parentId);
          const child = personById.get(relation.childId);

          if (!parent || !child) {
            return null;
          }

          return (
            <View key={relation.id} style={[styles.listRow, viewMode === "LIST" && styles.listRowCompact]}>
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
        persons={filteredPersons}
        selectedId={spouseAId}
        onSelect={setSpouseAId}
        primaryColor={primaryColor}
        familyNameByPersonId={familyNameByPersonId}
        viewMode={viewMode}
      />

      <Text style={styles.label}>Person B</Text>
      <HorizontalPersonSelector
        persons={filteredPersons}
        selectedId={spouseBId}
        onSelect={setSpouseBId}
        primaryColor={primaryColor}
        familyNameByPersonId={familyNameByPersonId}
        viewMode={viewMode}
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
        {visibleSpouseRelations.map((relation) => {
          const personA = personById.get(relation.personAId);
          const personB = personById.get(relation.personBId);

          if (!personA || !personB) {
            return null;
          }

          return (
            <View key={relation.id} style={[styles.listRow, viewMode === "LIST" && styles.listRowCompact]}>
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
  familyNameByPersonId: Map<string, string>;
  viewMode: SectionViewMode;
};

const HorizontalPersonSelector = ({
  persons,
  selectedId,
  onSelect,
  primaryColor,
  familyNameByPersonId,
  viewMode,
}: HorizontalPersonSelectorProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const groupedFamilies = useMemo(
    () => groupMembersByFamilyName(persons, familyNameByPersonId),
    [persons, familyNameByPersonId],
  );
  const listFamilyBlockWidth = useMemo(() => clamp(screenWidth - 110, 220, 340), [screenWidth]);

  return (
    <View style={styles.groupedSelectorContainer}>
      {viewMode === "LIST" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
          <View style={styles.horizontalSectionsRow}>
            {groupedFamilies.map((familyGroup) => (
              <View
                key={`selector-family-${familyGroup.key}`}
                style={[styles.groupedSelectorFamilyBlock, styles.groupedSelectorFamilyBlockList, { width: listFamilyBlockWidth }]}
              >
                <Text style={[styles.groupedSelectorFamilyLabel, { color: primaryColor }]}>{familyGroup.familyName} Family</Text>
                <View style={styles.groupedSelectorListColumn}>
                  {familyGroup.members.map((person) => (
                    <Pressable
                      key={person.id}
                      style={[
                        styles.memberListRow,
                        { borderColor: primaryColor },
                        selectedId === person.id && { backgroundColor: `${primaryColor}22`, borderColor: primaryColor },
                      ]}
                      onPress={() => onSelect(person.id)}
                    >
                      <Text style={[styles.memberListName, { color: primaryColor }]}>{displayName(person)}</Text>
                      <Text style={styles.memberListMeta}>
                        {person.gender ?? "Unspecified"} | {familyGroup.familyName} Family
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        groupedFamilies.map((familyGroup) => (
          <View key={`selector-family-${familyGroup.key}`} style={styles.groupedSelectorFamilyBlock}>
            <Text style={[styles.groupedSelectorFamilyLabel, { color: primaryColor }]}>{familyGroup.familyName} Family</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
              {familyGroup.members.map((person) => (
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
          </View>
        ))
      )}
    </View>
  );
};

type TreePanelProps = {
  graph: FamilyGraph;
  primaryColor: string;
  secondaryColor: string;
  showMemberPhotos: boolean;
  familyNameByPersonId: Map<string, string>;
  familyNames: string[];
  selectedFamilyName: string | null;
  onSelectFamily: (familyName: string) => void;
  viewMode: SectionViewMode;
  onToggleViewMode: () => void;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
};

type TreeRenderNode = {
  personId: string;
  partnerId?: string;
};

const treeNodeKey = (node: TreeRenderNode) => `${node.personId}-${node.partnerId ?? "single"}`;

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

type MemberPhotoProps = {
  person: Person;
  primaryColor: string;
  size?: number;
  showPhoto?: boolean;
};

const initialsFromPerson = (person: Person) => {
  const first = person.firstName.trim().charAt(0).toUpperCase();
  const last = person.lastName.trim().charAt(0).toUpperCase();
  const initials = `${first}${last}`.trim();
  return initials || "M";
};

const MemberPhoto = ({ person, primaryColor, size = 44, showPhoto = true }: MemberPhotoProps) => {
  const photoUrl = person.photoUrl?.trim();
  const hasPhoto = Boolean(photoUrl) && showPhoto;

  if (hasPhoto) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={[
          styles.memberPhoto,
          {
            width: size,
            height: size,
            borderColor: primaryColor,
            borderRadius: size / 2,
          },
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.memberPhotoFallback,
        {
          width: size,
          height: size,
          borderColor: primaryColor,
          borderRadius: size / 2,
        },
      ]}
    >
      <Text style={[styles.memberPhotoInitials, { color: primaryColor, fontSize: Math.max(12, Math.floor(size * 0.35)) }]}>
        {initialsFromPerson(person)}
      </Text>
    </View>
  );
};

type TreePersonCardProps = {
  person: Person;
  primaryColor: string;
  showMemberPhotos: boolean;
  familyName: string;
  viewMode: SectionViewMode;
  cardWidth: number;
  cardHeight: number;
  spouseNames?: string[];
};

const TreePersonCard = ({
  person,
  primaryColor,
  showMemberPhotos,
  familyName,
  viewMode,
  cardWidth,
  cardHeight,
  spouseNames = [],
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
    <View
      style={[
        styles.treePersonTile,
        viewMode === "TILE" && styles.treePersonTilePortrait,
        { width: cardWidth, minHeight: cardHeight },
        { borderColor: primaryColor, backgroundColor: "#ffffff" },
        styles.shadowSoft,
      ]}
    >
      <View style={styles.treePersonHeaderRow}>
        <View style={[styles.treePersonAvatarWrap, { borderColor: primaryColor, backgroundColor: "#ffffff" }]}>
          <MemberPhoto person={person} primaryColor={primaryColor} size={avatarSize} showPhoto={showMemberPhotos} />
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
    </View>
  );
};

const TreePanel = ({
  graph,
  primaryColor,
  secondaryColor,
  showMemberPhotos,
  familyNameByPersonId,
  familyNames,
  selectedFamilyName,
  onSelectFamily,
  viewMode,
  onToggleViewMode,
  onRefresh,
  isRefreshing,
}: TreePanelProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const personById = useMemo(() => {
    const map = new Map<string, Person>();
    graph.persons.forEach((person) => map.set(person.id, person));
    return map;
  }, [graph.persons]);
  const familySectionWidth = useMemo(
    () => (viewMode === "LIST" ? clamp(screenWidth - 96, 300, 720) : clamp(screenWidth - 44, 320, 1200)),
    [screenWidth, viewMode],
  );
  const memberCardsPerRow = useMemo(() => {
    if (familySectionWidth < 430) {
      return 1;
    }
    if (familySectionWidth < 760) {
      return 2;
    }
    if (familySectionWidth < 980) {
      return 3;
    }
    if (familySectionWidth < 1180) {
      return 4;
    }
    if (familySectionWidth >= 1180) {
      return 5;
    }
    return 2;
  }, [familySectionWidth]);
  const memberCardWidth = useMemo(
    () => clamp(Math.floor((familySectionWidth - 36 - (memberCardsPerRow - 1) * 12) / memberCardsPerRow), 190, 252),
    [familySectionWidth, memberCardsPerRow],
  );
  const memberCardHeight = useMemo(() => Math.round(memberCardWidth * 1.52), [memberCardWidth]);

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

  const rootNodesByFamily = useMemo(() => {
    const grouped = new Map<string, TreeRenderNode[]>();

    rootNodes.forEach((rootNode) => {
      const familyName =
        familyNameByPersonId.get(rootNode.personId) ??
        familyNameFromLastName(personById.get(rootNode.personId)?.lastName);
      const familyNodes = grouped.get(familyName) ?? [];
      familyNodes.push(rootNode);
      grouped.set(familyName, familyNodes);
    });

    return Array.from(grouped.entries())
      .map(([familyName, nodes]) => ({
        familyName,
        nodes,
      }))
      .sort((left, right) => left.familyName.localeCompare(right.familyName));
  }, [rootNodes, familyNameByPersonId, personById]);
  const visibleRootNodesByFamily = useMemo(
    () =>
      selectedFamilyName
        ? rootNodesByFamily.filter((familyGroup) => familyGroup.familyName === selectedFamilyName)
        : rootNodesByFamily,
    [rootNodesByFamily, selectedFamilyName],
  );

  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(new Set());
  const [collapsedFamilySections, setCollapsedFamilySections] = useState<Set<string>>(new Set());
  const [focusedRootNodeKeyByFamily, setFocusedRootNodeKeyByFamily] = useState<Record<string, string>>({});
  const parentIdsWithChildren = useMemo(
    () => new Set(graph.parentChildRelations.map((relation) => relation.parentId)),
    [graph.parentChildRelations],
  );
  const collapsibleBranchCount = parentIdsWithChildren.size;
  const collapsedBranchCount = useMemo(
    () => Array.from(parentIdsWithChildren).filter((parentId) => collapsedNodeIds.has(parentId)).length,
    [parentIdsWithChildren, collapsedNodeIds],
  );
  const isFullyCollapsed = collapsibleBranchCount > 0 && collapsedBranchCount === collapsibleBranchCount;
  const familySectionCount = visibleRootNodesByFamily.length;
  const collapsedFamilyCount = useMemo(
    () =>
      visibleRootNodesByFamily.reduce(
        (count, familyGroup) => (collapsedFamilySections.has(familyGroup.familyName) ? count + 1 : count),
        0,
      ),
    [collapsedFamilySections, visibleRootNodesByFamily],
  );
  const areAllFamilySectionsCollapsed =
    familySectionCount > 0 && collapsedFamilyCount === familySectionCount;

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

  const collapseAll = () => setCollapsedNodeIds(new Set(parentIdsWithChildren));

  const toggleFamilySection = (familyName: string) => {
    setCollapsedFamilySections((previous) => {
      const next = new Set(previous);
      if (next.has(familyName)) {
        next.delete(familyName);
      } else {
        next.add(familyName);
      }
      return next;
    });
  };

  useEffect(() => {
    const familyNames = new Set(rootNodesByFamily.map((familyGroup) => familyGroup.familyName));
    setCollapsedFamilySections((previous) => {
      const next = new Set<string>();
      previous.forEach((name) => {
        if (familyNames.has(name)) {
          next.add(name);
        }
      });
      return next;
    });

    setFocusedRootNodeKeyByFamily((previous) => {
      const next: Record<string, string> = {};
      Object.entries(previous).forEach(([familyName, nodeKeyValue]) => {
        if (familyNames.has(familyName)) {
          next[familyName] = nodeKeyValue;
        }
      });
      return next;
    });
  }, [rootNodesByFamily]);

  useEffect(() => {
    if (viewMode === "TILE") {
      return;
    }

    setFocusedRootNodeKeyByFamily({});
  }, [viewMode]);

  const shouldCollapseAll = !isFullyCollapsed || !areAllFamilySectionsCollapsed;
  const handleToggleAllBranches = () => {
    if (shouldCollapseAll) {
      collapseAll();
      setCollapsedFamilySections(new Set(visibleRootNodesByFamily.map((familyGroup) => familyGroup.familyName)));
      setFocusedRootNodeKeyByFamily({});
      return;
    }

    expandAll();
    setCollapsedFamilySections(new Set());
    setFocusedRootNodeKeyByFamily({});
  };

  const focusRootNodeForFamily = (familyName: string, node: TreeRenderNode) => {
    const nextNodeKey = treeNodeKey(node);
    setFocusedRootNodeKeyByFamily((previous) => ({
      ...previous,
      [familyName]: nextNodeKey,
    }));

    setCollapsedNodeIds((previous) => {
      const next = new Set(previous);
      next.delete(node.personId);
      if (node.partnerId) {
        next.delete(node.partnerId);
      }
      return next;
    });
  };

  const clearFocusedRootForFamily = (familyName: string) => {
    setFocusedRootNodeKeyByFamily((previous) => {
      const next = { ...previous };
      delete next[familyName];
      return next;
    });
  };

  const familySections = visibleRootNodesByFamily.map((familyGroup) => {
    const isFamilyCollapsed = collapsedFamilySections.has(familyGroup.familyName);
    const focusedNodeKey = focusedRootNodeKeyByFamily[familyGroup.familyName];
    const visibleRootNodes =
      viewMode === "TILE" && focusedNodeKey
        ? familyGroup.nodes.filter((node) => treeNodeKey(node) === focusedNodeKey)
        : familyGroup.nodes;
    const showRootFocusHint = viewMode === "TILE" && !focusedNodeKey && familyGroup.nodes.length > 1;

    return (
      <View
        key={`tree-family-${familyGroup.familyName}`}
        style={[
          styles.familyTreeGroupCard,
          viewMode === "LIST" && styles.familyTreeGroupCardList,
          { minWidth: familySectionWidth },
          { borderColor: primaryColor, backgroundColor: `${secondaryColor}66` },
          styles.shadowSoft,
        ]}
      >
        <Pressable
          style={styles.familyTreeGroupHeader}
          onPress={() => toggleFamilySection(familyGroup.familyName)}
        >
          <Text style={[styles.familyTreeGroupTitle, { color: primaryColor }]}>{familyGroup.familyName} Family</Text>
          <View style={[styles.familyTreeGroupTogglePill, { borderColor: primaryColor, backgroundColor: "#ffffff" }]}>
            <Ionicons
              name={isFamilyCollapsed ? "chevron-down" : "chevron-up"}
              size={16}
              color={primaryColor}
            />
            <Text style={[styles.familyTreeGroupToggleText, { color: primaryColor }]}>
              {isFamilyCollapsed ? "Expand" : "Collapse"}
            </Text>
          </View>
        </Pressable>

        {!isFamilyCollapsed && showRootFocusHint ? (
          <Text style={[styles.familyTreeHintText, { color: primaryColor }]}>
            Select a root card to focus this family branch.
          </Text>
        ) : null}

        {!isFamilyCollapsed && viewMode === "TILE" && focusedNodeKey ? (
          <Pressable
            style={[styles.familyTreeFocusButton, { borderColor: primaryColor, backgroundColor: "#ffffff" }, styles.shadowSoft]}
            onPress={() => clearFocusedRootForFamily(familyGroup.familyName)}
          >
            <Ionicons name="arrow-undo-outline" size={14} color={primaryColor} />
            <Text style={[styles.familyTreeFocusButtonText, { color: primaryColor }]}>Show All Root Cards</Text>
          </Pressable>
        ) : null}

        {!isFamilyCollapsed
          ? visibleRootNodes.map((rootNode) => (
              <TreeNode
                key={`${familyGroup.familyName}-${treeNodeKey(rootNode)}`}
                personId={rootNode.personId}
                partnerId={rootNode.partnerId}
                depth={0}
                path={new Set<string>()}
                personById={personById}
                childrenByParent={childrenByParent}
                spouseByPerson={spouseByPerson}
                spouseIdsByPerson={spouseIdsByPerson}
                familyNameByPersonId={familyNameByPersonId}
                viewMode={viewMode}
                collapsedNodeIds={collapsedNodeIds}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                showMemberPhotos={showMemberPhotos}
                onToggle={toggleNode}
                cardWidth={memberCardWidth}
                cardHeight={memberCardHeight}
                onRootFocusSelect={(personId, partnerId) =>
                  focusRootNodeForFamily(familyGroup.familyName, { personId, partnerId })
                }
                isRootFocusSelectable={viewMode === "TILE" && !focusedNodeKey && familyGroup.nodes.length > 1}
              />
            ))
          : null}
      </View>
    );
  });

  return (
    <View style={[styles.panel, styles.treePanelCanvas, styles.shadowSoft]}>
      <View style={styles.panelHeaderRow}>
        <View style={styles.panelHeaderTextBlock}>
          <Text style={styles.panelTitle}>Family Tree</Text>
          <Text style={styles.panelHint}>
            Tap a branch card to expand/collapse descendants. Depth is limited to {MAX_GENERATION_DEPTH} generations.
          </Text>
        </View>
        <View style={styles.panelHeaderActions}>
          <SectionViewModeToggle primaryColor={primaryColor} viewMode={viewMode} onToggle={onToggleViewMode} />
          <SectionRefreshButton primaryColor={primaryColor} isRefreshing={isRefreshing} onRefresh={onRefresh} />
        </View>
      </View>
      <FamilyFilterSelector
        familyNames={familyNames}
        selectedFamilyName={selectedFamilyName}
        primaryColor={primaryColor}
        onSelectFamily={onSelectFamily}
      />
      <View style={styles.treePanelActions}>
        <Pressable
          style={[
            styles.treeActionButton,
            {
              borderColor: primaryColor,
              backgroundColor: shouldCollapseAll ? primaryColor : secondaryColor,
            },
            styles.shadowStrong,
          ]}
          onPress={handleToggleAllBranches}
        >
          <View style={styles.treeActionHeaderRow}>
            <Ionicons
              name={shouldCollapseAll ? "remove-circle-outline" : "add-circle-outline"}
              size={18}
              color={shouldCollapseAll ? "#ffffff" : primaryColor}
            />
            <Text style={[styles.treeActionTitle, { color: shouldCollapseAll ? "#ffffff" : primaryColor }]}>
              {shouldCollapseAll ? "Collapse All Sections" : "Expand All Sections"}
            </Text>
          </View>
          <Text style={[styles.treeActionHint, { color: shouldCollapseAll ? "#e8f8f1" : "#3f6356" }]}>
            {shouldCollapseAll
              ? "Collapse all family sections and descendant branches."
              : "Expand every family section and all descendant branches."}
          </Text>
          <Text style={[styles.treeActionMeta, { color: shouldCollapseAll ? "#ffffff" : primaryColor }]}>
            {collapsedFamilyCount}/{familySectionCount} sections, {collapsedBranchCount}/{collapsibleBranchCount} branches collapsed
          </Text>
        </Pressable>
      </View>

      {rootNodes.length === 0 ? (
        <Text style={styles.mutedText}>No members yet. Add a member in the Members tab.</Text>
      ) : familySections.length === 0 ? (
        <Text style={styles.mutedText}>No tree data found for the selected family.</Text>
      ) : viewMode === "LIST" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.horizontalSectionsRow}>{familySections}</View>
        </ScrollView>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.treeHorizontalScrollContent}
        >
          <View style={styles.verticalSectionsColumn}>{familySections}</View>
        </ScrollView>
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
  familyNameByPersonId: Map<string, string>;
  viewMode: SectionViewMode;
  collapsedNodeIds: Set<string>;
  primaryColor: string;
  secondaryColor: string;
  showMemberPhotos: boolean;
  onToggle: (personId: string, partnerId?: string) => void;
  cardWidth: number;
  cardHeight: number;
  onRootFocusSelect?: (personId: string, partnerId?: string) => void;
  isRootFocusSelectable?: boolean;
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
  familyNameByPersonId,
  viewMode,
  collapsedNodeIds,
  primaryColor,
  secondaryColor,
  showMemberPhotos,
  onToggle,
  cardWidth,
  cardHeight,
  onRootFocusSelect,
  isRootFocusSelectable = false,
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

  const membersForNode = partner ? [person, partner] : [person];
  const shouldStackNodeMembers = viewMode === "TILE" && membersForNode.length > 1;
  const pairPenalty = shouldStackNodeMembers ? 0 : membersForNode.length > 1 ? 8 : 0;
  const depthPenalty = depth * 6;
  const maxDepthWidth = cardWidth;
  const minDepthWidth = shouldStackNodeMembers ? 188 : 176;
  const depthAdjustedCardWidth = clamp(cardWidth - depthPenalty - pairPenalty, minDepthWidth, maxDepthWidth);
  const depthAdjustedCardHeight = Math.max(Math.round(cardHeight * (depthAdjustedCardWidth / cardWidth)), 210);
  const treeCardContentWidth = shouldStackNodeMembers
    ? depthAdjustedCardWidth
    : depthAdjustedCardWidth * membersForNode.length + (membersForNode.length - 1) * 12;
  const treeCardMinWidth = Math.max(treeCardContentWidth + 16, 220);
  const resolveSpouseNamesForPerson = (nodePersonId: string) => {
    const spouseNames = new Set<string>();
    (spouseByPerson.get(nodePersonId) ?? []).forEach((relation) => {
      const relationPartnerId = relation.personAId === nodePersonId ? relation.personBId : relation.personAId;
      const relationPartner = personById.get(relationPartnerId);
      if (relationPartner) {
        spouseNames.add(displayName(relationPartner));
      }
    });
    return Array.from(spouseNames).sort((left, right) => left.localeCompare(right));
  };
  const hasChildren = childRenderNodes.length > 0;
  const isDepthLimitReached = depth >= MAX_GENERATION_DEPTH - 1;
  const canExpandChildren = hasChildren && !isDepthLimitReached;
  const isCollapsed = collapsedNodeIds.has(personId) || (partnerId ? collapsedNodeIds.has(partnerId) : false);
  const isExpanded = canExpandChildren && !isCollapsed;
  const isRootNode = depth === 0;
  const handleCardPress = () => {
    if (isRootNode && isRootFocusSelectable && onRootFocusSelect) {
      onRootFocusSelect(personId, partnerId);
      return;
    }

    if (canExpandChildren) {
      onToggle(personId, partnerId);
    }
  };

  return (
    <View
      style={[
        styles.treeNode,
        viewMode === "LIST" && styles.treeNodeList,
        depth === 0 && styles.treeRootNode,
      ]}
    >
      <Pressable
        style={[
          styles.treeCard,
          viewMode === "LIST" && styles.treeCardList,
          hasChildren && styles.treeCardBranch,
          { minWidth: treeCardMinWidth },
          { borderColor: primaryColor, backgroundColor: secondaryColor },
          styles.shadowSoft,
        ]}
        onPress={isRootFocusSelectable || canExpandChildren ? handleCardPress : undefined}
      >
        <View style={styles.treeTitleRow}>
          <Text style={[styles.treeBranchLabel, { color: primaryColor }]}>Generation {depth + 1}</Text>
          {canExpandChildren ? (
            <Text style={[styles.treeToggle, { backgroundColor: primaryColor }]}>
              {isCollapsed ? `+ ${childRenderNodes.length}` : `- ${childRenderNodes.length}`}
            </Text>
          ) : null}
        </View>

        <View style={[styles.treeMemberCardsRow, shouldStackNodeMembers && styles.treeMemberCardsRowStacked]}>
          {membersForNode.map((nodeMember) => (
            <TreePersonCard
              key={`${personId}-${partnerId ?? "single"}-${nodeMember.id}`}
              person={nodeMember}
              primaryColor={primaryColor}
              showMemberPhotos={showMemberPhotos}
              familyName={familyNameByPersonId.get(nodeMember.id) ?? familyNameFromLastName(nodeMember.lastName)}
              viewMode={viewMode}
              cardWidth={depthAdjustedCardWidth}
              cardHeight={depthAdjustedCardHeight}
              spouseNames={resolveSpouseNamesForPerson(nodeMember.id)}
            />
          ))}
        </View>

        {isDepthLimitReached && hasChildren ? (
          <Text style={[styles.treeDepthLimitText, { color: primaryColor }]}>
            Maximum depth reached ({MAX_GENERATION_DEPTH}). Expand further by switching root if needed.
          </Text>
        ) : null}
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
                familyNameByPersonId={familyNameByPersonId}
                viewMode={viewMode}
                collapsedNodeIds={collapsedNodeIds}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                showMemberPhotos={showMemberPhotos}
                onToggle={onToggle}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
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
  shadowSoft: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  shadowStrong: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 5,
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
  pageHeaderCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  pageHeaderTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  pageHeaderDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  workspace: {
    flex: 1,
  },
  workspaceWide: {
    flexDirection: "row",
    gap: 12,
  },
  sidebar: {
    position: "relative",
    overflow: "visible",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    minWidth: 210,
  },
  sidebarCollapsed: {
    minWidth: 58,
    width: 58,
    paddingTop: 36,
    paddingBottom: 8,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  sidebarCollapsedMobile: {
    width: "100%",
    minWidth: 0,
    paddingTop: 36,
    paddingBottom: 10,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  sidebarHoverToggleButton: {
    position: "absolute",
    top: 6,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 5,
  },
  sidebarHoverToggleButtonHidden: {
    opacity: 0,
  },
  sidebarCollapsedTabs: {
    width: "100%",
    alignItems: "center",
    gap: 8,
  },
  sidebarCollapsedTabsMobile: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 10,
    paddingVertical: 4,
  },
  sidebarCollapsedTabButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#14332a",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  refreshButtonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
  content: {
    paddingBottom: 80,
  },
  refreshIndicator: {
    marginBottom: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  refreshIndicatorText: {
    fontSize: 12,
    fontWeight: "600",
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
  panelHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  panelHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  panelHeaderTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  panelHint: {
    marginTop: 4,
    marginBottom: 12,
    color: "#517467",
  },
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
  memberFamilyBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: "700",
    backgroundColor: "#ffffff",
  },
  familyInfoCard: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  familyInfoText: {
    fontSize: 12,
    fontWeight: "700",
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
  familyGroupsContainer: {
    marginBottom: 10,
    gap: 10,
  },
  verticalSectionsColumn: {
    gap: 8,
    alignItems: "center",
  },
  horizontalSectionsRow: {
    flexDirection: "row",
    gap: 10,
    paddingRight: 6,
  },
  familyGroupCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  memberFamilyCardListMode: {
    minHeight: 120,
  },
  familyGroupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    gap: 8,
  },
  familyGroupTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  familyGroupCount: {
    fontSize: 12,
    color: "#3f6356",
    fontWeight: "600",
  },
  groupedSelectorContainer: {
    marginBottom: 8,
    gap: 6,
  },
  groupedSelectorListColumn: {
    gap: 6,
    marginBottom: 8,
  },
  groupedSelectorFamilyBlock: {
    marginBottom: 2,
  },
  groupedSelectorFamilyBlockList: {
    minHeight: 42,
  },
  groupedSelectorFamilyLabel: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
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
  memberListColumn: {
    gap: 6,
    marginBottom: 8,
  },
  memberListRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#ffffff",
  },
  memberListName: {
    fontSize: 13,
    fontWeight: "700",
  },
  memberListMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "#48695d",
    fontWeight: "600",
  },
  memberCardColumn: {
    gap: 10,
    marginBottom: 8,
  },
  memberCardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "flex-start",
    justifyContent: "center",
    marginBottom: 4,
  },
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
  label: {
    marginBottom: 4,
    fontWeight: "600",
    color: "#1f4b3d",
  },
  colorPickerBlock: {
    marginBottom: 8,
  },
  colorPickerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
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
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    backgroundColor: "#ffffff",
  },
  listRowCompact: {
    borderRadius: 8,
    paddingVertical: 8,
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
    marginBottom: 12,
  },
  treePanelCanvas: {
    backgroundColor: "#e6eeef",
    borderColor: "#d5e1e2",
  },
  treeHorizontalScrollContent: {
    paddingRight: 8,
  },
  sectionModeButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
  },
  sectionModeButtonText: {
    fontSize: 12,
    fontWeight: "700",
  },
  treeActionButton: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  treeActionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  treeActionTitle: {
    fontSize: 13,
    fontWeight: "800",
  },
  treeActionHint: {
    fontSize: 11,
    fontWeight: "600",
  },
  treeActionMeta: {
    fontSize: 11,
    fontWeight: "700",
  },
  familyTreeGroupCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  familyTreeGroupCardList: {
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  familyTreeGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 8,
  },
  familyTreeGroupTitle: {
    fontSize: 15,
    fontWeight: "800",
    flex: 1,
  },
  familyTreeGroupTogglePill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  familyTreeGroupToggleText: {
    fontSize: 11,
    fontWeight: "700",
  },
  familyTreeHintText: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 6,
  },
  familyTreeFocusButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 8,
    marginBottom: 8,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ffffff",
  },
  familyTreeFocusButtonText: {
    fontSize: 11,
    fontWeight: "700",
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
    marginBottom: 14,
    alignSelf: "flex-start",
  },
  treeRootNode: {
    alignSelf: "center",
  },
  treeNodeList: {
    marginBottom: 10,
  },
  treeCard: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 14,
    padding: 8,
    backgroundColor: "transparent",
    alignItems: "center",
    alignSelf: "flex-start",
  },
  treeCardList: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  treeCardBranch: {
    borderColor: "#d5e3df",
    backgroundColor: "#f3f7f7",
  },
  treeBranchLabel: {
    fontWeight: "700",
    color: "#344a43",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  treeTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  treeMemberCardsRow: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: 12,
    flexWrap: "nowrap",
    alignSelf: "flex-start",
  },
  treeMemberCardsRowStacked: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
  },
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
  memberPhoto: {
    borderWidth: 2,
    backgroundColor: "#ffffff",
  },
  memberPhotoFallback: {
    borderWidth: 2,
    backgroundColor: "#eef5f2",
    alignItems: "center",
    justifyContent: "center",
  },
  memberPhotoInitials: {
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  treeName: {
    fontWeight: "800",
    color: "#1b2e29",
    fontSize: 14,
    lineHeight: 18,
    textAlign: "left",
  },
  treeToggle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#263f37",
    backgroundColor: "#d9e8e3",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minWidth: 42,
    textAlign: "center",
  },
  treeMeta: {
    color: "#2f4740",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "left",
  },
  treeMetaSecondary: {
    color: "#415b53",
    marginTop: 1,
    fontSize: 11,
    lineHeight: 13,
    textAlign: "center",
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
  treeDepthLimitText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
  },
  treeChildrenBlock: {
    marginTop: 10,
    marginLeft: 0,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "#596862",
  },
  treeChildItem: {
    position: "relative",
  },
  treeChildConnector: {
    position: "absolute",
    left: -10,
    top: 24,
    width: 10,
    borderTopWidth: 2,
    borderTopColor: "#596862",
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
