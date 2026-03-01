import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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

const tabs: { key: TabKey; label: string }[] = [
  { key: "TREE", label: "Tree" },
  { key: "MEMBERS", label: "Members" },
  { key: "RELATIONSHIPS", label: "Relationships" },
];

const genderOptions: (Gender | "")[] = ["", "MALE", "FEMALE", "NON_BINARY", "OTHER"];
const parentTypeOptions: ParentType[] = ["BIOLOGICAL", "ADOPTIVE", "STEP", "GUARDIAN"];

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
  const [activeTab, setActiveTab] = useState<TabKey>("TREE");
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Family Tree Platform</Text>
          <Text style={styles.subtitle}>Web, Android, iOS | API: {API_BASE_URL}</Text>
        </View>

        <View style={styles.tabRow}>
          {tabs.map((tab) => (
            <Pressable
              key={tab.key}
              style={[styles.tabButton, activeTab === tab.key && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.refreshButton} onPress={() => void reload()}>
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
            <ActivityIndicator size="large" color="#2e5f4f" />
            <Text style={styles.mutedText}>Loading family graph...</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {activeTab === "TREE" ? <TreePanel graph={graph} /> : null}

            {activeTab === "MEMBERS" ? (
              <MembersPanel
                persons={graph.persons}
                isMutating={isMutating}
                onCreate={createPerson}
                onUpdate={updatePerson}
                onDelete={deletePerson}
              />
            ) : null}

            {activeTab === "RELATIONSHIPS" ? (
              <RelationshipsPanel
                graph={graph}
                isMutating={isMutating}
                onCreateParentChild={createParentChild}
                onDeleteParentChild={deleteParentChild}
                onCreateSpouse={createSpouse}
                onDeleteSpouse={deleteSpouse}
              />
            ) : null}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
};

type MembersPanelProps = {
  persons: Person[];
  isMutating: boolean;
  onCreate: (payload: PersonInput) => Promise<void>;
  onUpdate: (personId: string, payload: PersonInput) => Promise<void>;
  onDelete: (personId: string) => Promise<void>;
};

const MembersPanel = ({ persons, isMutating, onCreate, onUpdate, onDelete }: MembersPanelProps) => {
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
        <Pressable style={[styles.selectorPill, !selectedPersonId && styles.selectorPillActive]} onPress={() => selectPerson(null)}>
          <Text style={[styles.selectorPillText, !selectedPersonId && styles.selectorPillTextActive]}>New Member</Text>
        </Pressable>

        {sortedPersons.map((person) => (
          <Pressable
            key={person.id}
            style={[styles.selectorPill, selectedPersonId === person.id && styles.selectorPillActive]}
            onPress={() => selectPerson(person)}
          >
            <Text style={[styles.selectorPillText, selectedPersonId === person.id && styles.selectorPillTextActive]}>
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
              style={[styles.optionButton, isSelected && styles.optionButtonActive]}
              onPress={() => setFormState((prev) => ({ ...prev, gender: option }))}
            >
              <Text style={[styles.optionButtonText, isSelected && styles.optionButtonTextActive]}>{label}</Text>
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
        <Pressable style={styles.primaryButton} onPress={() => void save()} disabled={isMutating}>
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
      <HorizontalPersonSelector persons={persons} selectedId={parentId} onSelect={setParentId} />

      <Text style={styles.label}>Child</Text>
      <HorizontalPersonSelector persons={persons} selectedId={childId} onSelect={setChildId} />

      <Text style={styles.label}>Relationship Type</Text>
      <View style={styles.optionRowWrap}>
        {parentTypeOptions.map((option) => (
          <Pressable
            key={option}
            style={[styles.optionButton, relationType === option && styles.optionButtonActive]}
            onPress={() => setRelationType(option)}
          >
            <Text style={[styles.optionButtonText, relationType === option && styles.optionButtonTextActive]}>
              {option}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.primaryButton} onPress={() => void createParentChildLink()} disabled={isMutating}>
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
      <HorizontalPersonSelector persons={persons} selectedId={spouseAId} onSelect={setSpouseAId} />

      <Text style={styles.label}>Person B</Text>
      <HorizontalPersonSelector persons={persons} selectedId={spouseBId} onSelect={setSpouseBId} />

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

      <Pressable style={styles.primaryButton} onPress={() => void createSpouseLink()} disabled={isMutating}>
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
};

const HorizontalPersonSelector = ({ persons, selectedId, onSelect }: HorizontalPersonSelectorProps) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.selectorRow}>
    {persons.map((person) => (
      <Pressable
        key={person.id}
        style={[styles.selectorPill, selectedId === person.id && styles.selectorPillActive]}
        onPress={() => onSelect(person.id)}
      >
        <Text style={[styles.selectorPillText, selectedId === person.id && styles.selectorPillTextActive]}>
          {displayName(person)}
        </Text>
      </Pressable>
    ))}
  </ScrollView>
);

type TreePanelProps = {
  graph: FamilyGraph;
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

const TreePanel = ({ graph }: TreePanelProps) => {
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
        <Pressable style={styles.treeMiniButton} onPress={expandAll}>
          <Text style={styles.treeMiniButtonText}>Expand all</Text>
        </Pressable>
        <Pressable style={styles.treeMiniButton} onPress={collapseAll}>
          <Text style={styles.treeMiniButtonText}>Collapse all</Text>
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
        style={[styles.treeCard, hasChildren && styles.treeCardBranch]}
        onPress={hasChildren ? () => onToggle(personId, partnerId) : undefined}
      >
        <View style={styles.treeTitleRow}>
          <Text style={styles.treeBranchLabel}>{partner ? "Parent Pair" : "Member"}</Text>
          {hasChildren ? (
            <Text style={styles.treeToggle}>
              {isCollapsed ? `+ ${childRenderNodes.length}` : `- ${childRenderNodes.length}`}
            </Text>
          ) : null}
        </View>

        {partner ? (
          <View style={styles.treePairRow}>
            <View style={styles.treePersonTile}>
              <Text style={styles.treeName}>{displayName(person)}</Text>
              {person.gender ? <Text style={styles.treeMeta}>Gender: {person.gender}</Text> : null}
              {person.dateOfBirth ? <Text style={styles.treeMeta}>Born: {formatDate(person.dateOfBirth)}</Text> : null}
            </View>

            <View style={styles.treePairConnector} />

            <View style={styles.treePersonTile}>
              <Text style={styles.treeName}>{displayName(partner)}</Text>
              {partner.gender ? <Text style={styles.treeMeta}>Gender: {partner.gender}</Text> : null}
              {partner.dateOfBirth ? <Text style={styles.treeMeta}>Born: {formatDate(partner.dateOfBirth)}</Text> : null}
            </View>
          </View>
        ) : (
          <View style={styles.treePersonTile}>
            <Text style={styles.treeName}>{displayName(person)}</Text>
            {person.gender ? <Text style={styles.treeMeta}>Gender: {person.gender}</Text> : null}
            {person.dateOfBirth ? <Text style={styles.treeMeta}>Born: {formatDate(person.dateOfBirth)}</Text> : null}
            {spouseNames.length > 0 ? <Text style={styles.treeMeta}>Spouse(s): {spouseNames.join(", ")}</Text> : null}
          </View>
        )}
      </Pressable>

      {isExpanded ? (
        <View style={styles.treeChildrenBlock}>
          {childRenderNodes.map((childNode, index) => (
            <View key={`${personId}-${partnerId ?? "none"}-${childNode.personId}-${childNode.partnerId ?? "none"}`} style={styles.treeChildItem}>
              <View style={styles.treeChildConnector} />
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
  header: {
    marginTop: 8,
    marginBottom: 16,
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
    color: "#2e5f4f",
    backgroundColor: "#e5f1eb",
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
