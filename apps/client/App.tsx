import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
  FamilyGraph,
  Gender,
  ParentType,
  Person,
  PersonInput,
  SpouseRelation,
} from "./src/types/family";

type TabKey = "TREE" | "MEMBERS" | "RELATIONSHIPS";
type AppPage = "HOME" | "SETTINGS";
type LayoutMode = "SIDEBAR" | "TOOLBAR";
type ThemePresetId = "FOREST" | "OCEAN" | "SUNSET" | "GRAPHITE";

const MAX_GENERATION_DEPTH = 10;

const tabs: { key: TabKey; label: string }[] = [
  { key: "TREE", label: "Tree" },
  { key: "MEMBERS", label: "Members" },
  { key: "RELATIONSHIPS", label: "Relationships" },
];

const tabIconByKey: Record<TabKey, "git-branch-outline" | "people-outline" | "swap-horizontal-outline"> = {
  TREE: "git-branch-outline",
  MEMBERS: "people-outline",
  RELATIONSHIPS: "swap-horizontal-outline",
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

const isHexColor = (value: string) => /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(value.trim());

const uiPreferencesStorageKey = "family-tree-ui-preferences-v2";

type UiPreferences = {
  activeTab: TabKey;
  activePage: AppPage;
  selectedThemeId: ThemePresetId;
  primaryColorInput: string;
  secondaryColorInput: string;
  layoutMode: LayoutMode;
  sidebarEnabled: boolean;
  showMemberPhotos: boolean;
};

const isTabKey = (value: unknown): value is TabKey =>
  value === "TREE" || value === "MEMBERS" || value === "RELATIONSHIPS";

const isAppPage = (value: unknown): value is AppPage =>
  value === "HOME" || value === "SETTINGS";

const isThemePresetId = (value: unknown): value is ThemePresetId =>
  value === "FOREST" || value === "OCEAN" || value === "SUNSET" || value === "GRAPHITE";

const isLayoutMode = (value: unknown): value is LayoutMode =>
  value === "SIDEBAR" || value === "TOOLBAR";

const tabSlugByKey: Record<TabKey, string> = {
  TREE: "tree",
  MEMBERS: "members",
  RELATIONSHIPS: "relationships",
};

const tabKeyBySlug: Record<string, TabKey> = {
  tree: "TREE",
  members: "MEMBERS",
  relationships: "RELATIONSHIPS",
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
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("TOOLBAR");
  const [sidebarEnabled, setSidebarEnabled] = useState(false);
  const [showMemberPhotos, setShowMemberPhotos] = useState(true);
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

    if (tabKeyBySlug[urlTab]) {
      setActiveTab(tabKeyBySlug[urlTab]);
    }

    if (pageKeyBySlug[urlPage]) {
      setActivePage(pageKeyBySlug[urlPage]);
    }
  };

  const applyUiSettings = (settings: UiSettingsPayload) => {
    setActiveTab(settings.activeTab);
    setActivePage(settings.activePage);
    setSelectedThemeId(settings.selectedThemeId);
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
        primaryColorInput,
        secondaryColorInput,
        layoutMode,
        sidebarEnabled,
        showMemberPhotos,
      };

      window.localStorage.setItem(uiPreferencesStorageKey, JSON.stringify(preferences));
    } catch {
      // Ignore storage failures (private mode, disabled storage, etc.).
    }
  }, [
    activeTab,
    activePage,
    selectedThemeId,
    primaryColorInput,
    secondaryColorInput,
    layoutMode,
    sidebarEnabled,
    showMemberPhotos,
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

      const nextSearch = searchParams.toString();
      const nextUrl = `${window.location.pathname}?${nextSearch}${window.location.hash}`;
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (nextUrl !== currentUrl) {
        window.history.replaceState(null, "", nextUrl);
      }
    } catch {
      // Ignore URL sync failures in restricted environments.
    }
  }, [activeTab, activePage, isPreferencesHydrated]);

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
  const familyNameByPersonId = useMemo(() => buildFamilyNameMap(graph), [graph]);

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
    graph.persons.length > 0 || graph.parentChildRelations.length > 0 || graph.spouseRelations.length > 0;
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
            primaryColorInput={primaryColorInput}
            secondaryColorInput={secondaryColorInput}
            layoutMode={layoutMode}
            sidebarEnabled={sidebarEnabled}
            showMemberPhotos={showMemberPhotos}
            resolvedPrimaryColor={resolvedPrimaryColor}
            resolvedSecondaryColor={resolvedSecondaryColor}
            onPresetSelect={applyThemePreset}
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
                      familyNameByPersonId={familyNameByPersonId}
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
                      onCreateParentChild={createParentChild}
                      onDeleteParentChild={deleteParentChild}
                      onCreateSpouse={createSpouse}
                      onDeleteSpouse={deleteSpouse}
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
  primaryColorInput: string;
  secondaryColorInput: string;
  layoutMode: LayoutMode;
  sidebarEnabled: boolean;
  showMemberPhotos: boolean;
  resolvedPrimaryColor: string;
  resolvedSecondaryColor: string;
  onPresetSelect: (presetId: ThemePresetId) => void;
  onPrimaryColorChange: (value: string) => void;
  onSecondaryColorChange: (value: string) => void;
  onLayoutModeSelect: (mode: LayoutMode) => void;
  onToggleSidebar: () => void;
  onToggleShowMemberPhotos: () => void;
};

const SettingsPage = ({
  selectedThemeId,
  primaryColorInput,
  secondaryColorInput,
  layoutMode,
  sidebarEnabled,
  showMemberPhotos,
  resolvedPrimaryColor,
  resolvedSecondaryColor,
  onPresetSelect,
  onPrimaryColorChange,
  onSecondaryColorChange,
  onLayoutModeSelect,
  onToggleSidebar,
  onToggleShowMemberPhotos,
}: SettingsPageProps) => (
  <ScrollView contentContainerStyle={styles.content}>
    <View style={[styles.panel, styles.shadowSoft]}>
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

type MembersPanelProps = {
  persons: Person[];
  isMutating: boolean;
  primaryColor: string;
  secondaryColor: string;
  familyNameByPersonId: Map<string, string>;
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
  familyNameByPersonId,
  onCreate,
  onUpdate,
  onDelete,
  onRefresh,
  isRefreshing,
}: MembersPanelProps) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PersonFormState>(defaultFormState);

  const sortedPersons = useMemo(
    () => [...persons].sort((a, b) => displayName(a).localeCompare(displayName(b))),
    [persons],
  );
  const groupedFamilies = useMemo(
    () => groupMembersByFamilyName(sortedPersons, familyNameByPersonId),
    [sortedPersons, familyNameByPersonId],
  );

  const selectedPerson = sortedPersons.find((person) => person.id === selectedPersonId) ?? null;
  const selectedPersonFamilyName = selectedPerson ? familyNameByPersonId.get(selectedPerson.id) ?? "Unknown" : null;

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
        <SectionRefreshButton primaryColor={primaryColor} isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </View>

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

      <View style={styles.familyGroupsContainer}>
        {groupedFamilies.map((familyGroup) => (
          <View
            key={`family-group-${familyGroup.key}`}
            style={[styles.familyGroupCard, { borderColor: primaryColor, backgroundColor: `${secondaryColor}77` }, styles.shadowSoft]}
          >
            <View style={styles.familyGroupHeaderRow}>
              <Text style={[styles.familyGroupTitle, { color: primaryColor }]}>{familyGroup.familyName} Family</Text>
              <Text style={styles.familyGroupCount}>{familyGroup.members.length} member(s)</Text>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
              {familyGroup.members.map((person) => (
                <Pressable
                  key={person.id}
                  style={[
                    styles.selectorPill,
                    { borderColor: primaryColor, backgroundColor: "#ffffff" },
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
          </View>
        ))}
      </View>

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
    <View style={[styles.panel, styles.shadowSoft]}>
      <View style={styles.panelHeaderRow}>
        <View style={styles.panelHeaderTextBlock}>
          <Text style={styles.panelTitle}>Relationships</Text>
          <Text style={styles.panelHint}>Connect members as parent-child and spouses.</Text>
        </View>
        <SectionRefreshButton primaryColor={primaryColor} isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </View>

      <Text style={styles.subsectionTitle}>Parent to Child</Text>
      <Text style={styles.label}>Parent</Text>
      <HorizontalPersonSelector
        persons={persons}
        selectedId={parentId}
        onSelect={setParentId}
        primaryColor={primaryColor}
        familyNameByPersonId={familyNameByPersonId}
      />

      <Text style={styles.label}>Child</Text>
      <HorizontalPersonSelector
        persons={persons}
        selectedId={childId}
        onSelect={setChildId}
        primaryColor={primaryColor}
        familyNameByPersonId={familyNameByPersonId}
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
        familyNameByPersonId={familyNameByPersonId}
      />

      <Text style={styles.label}>Person B</Text>
      <HorizontalPersonSelector
        persons={persons}
        selectedId={spouseBId}
        onSelect={setSpouseBId}
        primaryColor={primaryColor}
        familyNameByPersonId={familyNameByPersonId}
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
  familyNameByPersonId: Map<string, string>;
};

const HorizontalPersonSelector = ({
  persons,
  selectedId,
  onSelect,
  primaryColor,
  familyNameByPersonId,
}: HorizontalPersonSelectorProps) => {
  const groupedFamilies = useMemo(
    () => groupMembersByFamilyName(persons, familyNameByPersonId),
    [persons, familyNameByPersonId],
  );

  return (
    <View style={styles.groupedSelectorContainer}>
      {groupedFamilies.map((familyGroup) => (
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
      ))}
    </View>
  );
};

type TreePanelProps = {
  graph: FamilyGraph;
  primaryColor: string;
  secondaryColor: string;
  showMemberPhotos: boolean;
  familyNameByPersonId: Map<string, string>;
  onRefresh: () => Promise<void>;
  isRefreshing: boolean;
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

type MemberPhotoProps = {
  person: Person;
  primaryColor: string;
  size?: number;
};

const MemberPhoto = ({ person, primaryColor, size = 44 }: MemberPhotoProps) => {
  const photoUrl = person.photoUrl?.trim();
  const hasPhoto = Boolean(photoUrl);

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
      <Ionicons name="person-outline" size={Math.max(16, size * 0.45)} color={primaryColor} />
    </View>
  );
};

type TreePersonCardProps = {
  person: Person;
  primaryColor: string;
  showMemberPhotos: boolean;
  familyName: string;
  spouseNames?: string[];
};

const TreePersonCard = ({ person, primaryColor, showMemberPhotos, familyName, spouseNames = [] }: TreePersonCardProps) => (
  <View style={[styles.treePersonTile, { borderColor: primaryColor, backgroundColor: "#ffffff" }, styles.shadowSoft]}>
    <View style={styles.treePersonHeaderRow}>
      {showMemberPhotos ? <MemberPhoto person={person} primaryColor={primaryColor} /> : null}
      <View style={styles.treePersonDetailColumn}>
        <Text style={styles.treeName}>{displayName(person)}</Text>
        <Text style={styles.treeMeta}>Family: {familyName}</Text>
        {person.gender ? <Text style={styles.treeMeta}>Gender: {person.gender}</Text> : null}
        {person.dateOfBirth ? <Text style={styles.treeMeta}>Born: {formatDate(person.dateOfBirth)}</Text> : null}
        {spouseNames.length > 0 ? <Text style={styles.treeMeta}>Spouse(s): {spouseNames.join(", ")}</Text> : null}
      </View>
    </View>
  </View>
);

const TreePanel = ({
  graph,
  primaryColor,
  secondaryColor,
  showMemberPhotos,
  familyNameByPersonId,
  onRefresh,
  isRefreshing,
}: TreePanelProps) => {
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
    <View style={[styles.panel, styles.shadowSoft]}>
      <View style={styles.panelHeaderRow}>
        <View style={styles.panelHeaderTextBlock}>
          <Text style={styles.panelTitle}>Family Tree</Text>
          <Text style={styles.panelHint}>
            Tap a branch card to expand/collapse descendants. Depth is limited to {MAX_GENERATION_DEPTH} generations.
          </Text>
        </View>
        <SectionRefreshButton primaryColor={primaryColor} isRefreshing={isRefreshing} onRefresh={onRefresh} />
      </View>
      <View style={styles.treePanelActions}>
        <Pressable
          style={[styles.treeMiniButton, { borderColor: primaryColor, backgroundColor: secondaryColor }, styles.shadowSoft]}
          onPress={expandAll}
        >
          <Text style={[styles.treeMiniButtonText, { color: primaryColor }]}>Expand all</Text>
        </Pressable>
        <Pressable
          style={[styles.treeMiniButton, { borderColor: primaryColor, backgroundColor: secondaryColor }, styles.shadowSoft]}
          onPress={collapseAll}
        >
          <Text style={[styles.treeMiniButtonText, { color: primaryColor }]}>Collapse all</Text>
        </Pressable>
      </View>

      {rootNodes.length === 0 ? (
        <Text style={styles.mutedText}>No members yet. Add a member in the Members tab.</Text>
      ) : (
        rootNodesByFamily.map((familyGroup) => (
          <View
            key={`tree-family-${familyGroup.familyName}`}
            style={[styles.familyTreeGroupCard, { borderColor: primaryColor, backgroundColor: `${secondaryColor}66` }, styles.shadowSoft]}
          >
            <Text style={[styles.familyTreeGroupTitle, { color: primaryColor }]}>{familyGroup.familyName} Family</Text>
            {familyGroup.nodes.map((rootNode) => (
              <TreeNode
                key={`${familyGroup.familyName}-${rootNode.personId}-${rootNode.partnerId ?? "single"}`}
                personId={rootNode.personId}
                partnerId={rootNode.partnerId}
                depth={0}
                path={new Set<string>()}
                personById={personById}
                childrenByParent={childrenByParent}
                spouseByPerson={spouseByPerson}
                spouseIdsByPerson={spouseIdsByPerson}
                familyNameByPersonId={familyNameByPersonId}
                collapsedNodeIds={collapsedNodeIds}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                showMemberPhotos={showMemberPhotos}
                onToggle={toggleNode}
              />
            ))}
          </View>
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
  familyNameByPersonId: Map<string, string>;
  collapsedNodeIds: Set<string>;
  primaryColor: string;
  secondaryColor: string;
  showMemberPhotos: boolean;
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
  familyNameByPersonId,
  collapsedNodeIds,
  primaryColor,
  secondaryColor,
  showMemberPhotos,
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
  const personFamilyName = familyNameByPersonId.get(personId) ?? familyNameFromLastName(person.lastName);
  const partnerFamilyName = partner
    ? familyNameByPersonId.get(partner.id) ?? familyNameFromLastName(partner.lastName)
    : null;
  const hasChildren = childRenderNodes.length > 0;
  const isDepthLimitReached = depth >= MAX_GENERATION_DEPTH - 1;
  const canExpandChildren = hasChildren && !isDepthLimitReached;
  const isCollapsed = collapsedNodeIds.has(personId) || (partnerId ? collapsedNodeIds.has(partnerId) : false);
  const isExpanded = canExpandChildren && !isCollapsed;

  return (
    <View style={[styles.treeNode, { marginLeft: depth * 14 }]}>
      <Pressable
        style={[
          styles.treeCard,
          hasChildren && styles.treeCardBranch,
          { borderColor: primaryColor, backgroundColor: secondaryColor },
          styles.shadowSoft,
        ]}
        onPress={canExpandChildren ? () => onToggle(personId, partnerId) : undefined}
      >
        <View style={styles.treeTitleRow}>
          <Text style={[styles.treeBranchLabel, { color: primaryColor }]}>
            {partner ? "Parent Pair" : "Member"} | Generation {depth + 1}
          </Text>
          {canExpandChildren ? (
            <Text style={[styles.treeToggle, { backgroundColor: primaryColor }]}>
              {isCollapsed ? `+ ${childRenderNodes.length}` : `- ${childRenderNodes.length}`}
            </Text>
          ) : null}
        </View>

        {partner ? (
          <View style={styles.treePairRow}>
            <TreePersonCard
              person={person}
              primaryColor={primaryColor}
              showMemberPhotos={showMemberPhotos}
              familyName={personFamilyName}
            />

            <View style={[styles.treePairConnector, { borderTopColor: primaryColor }]} />

            <TreePersonCard
              person={partner}
              primaryColor={primaryColor}
              showMemberPhotos={showMemberPhotos}
              familyName={partnerFamilyName ?? "Unknown"}
            />
          </View>
        ) : (
          <TreePersonCard
            person={person}
            primaryColor={primaryColor}
            showMemberPhotos={showMemberPhotos}
            familyName={personFamilyName}
            spouseNames={spouseNames}
          />
        )}

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
                collapsedNodeIds={collapsedNodeIds}
                primaryColor={primaryColor}
                secondaryColor={secondaryColor}
                showMemberPhotos={showMemberPhotos}
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
    marginLeft: "auto",
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
  panelHeaderTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  panelHint: {
    marginTop: 4,
    marginBottom: 12,
    color: "#517467",
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
  familyGroupCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
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
  groupedSelectorFamilyBlock: {
    marginBottom: 2,
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
  familyTreeGroupCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  familyTreeGroupTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
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
  treePersonHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  treePersonDetailColumn: {
    flex: 1,
  },
  memberPhoto: {
    borderWidth: 1,
    backgroundColor: "#ffffff",
  },
  memberPhotoFallback: {
    borderWidth: 1,
    backgroundColor: "#f3f8f5",
    alignItems: "center",
    justifyContent: "center",
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
  treeDepthLimitText: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
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
