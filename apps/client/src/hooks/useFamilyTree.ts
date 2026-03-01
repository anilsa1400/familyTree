import { useCallback, useEffect, useState } from "react";
import {
  createFamily,
  createParentChildRelation,
  createPerson,
  createSpouseRelation,
  deleteFamily,
  deleteParentChildRelation,
  deletePerson,
  deleteSpouseRelation,
  getFamilyGraph,
  updateFamily,
  updatePerson,
} from "../lib/api";
import {
  FamilyGraph,
  FamilyInput,
  ParentChildInput,
  PersonInput,
  SpouseInput,
} from "../types/family";

const emptyGraph: FamilyGraph = {
  families: [],
  persons: [],
  parentChildRelations: [],
  spouseRelations: [],
};

export const useFamilyTree = () => {
  const [graph, setGraph] = useState<FamilyGraph>(emptyGraph);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getFamilyGraph();
      setGraph({
        families: Array.isArray(data.families) ? data.families : [],
        persons: Array.isArray(data.persons) ? data.persons : [],
        parentChildRelations: Array.isArray(data.parentChildRelations) ? data.parentChildRelations : [],
        spouseRelations: Array.isArray(data.spouseRelations) ? data.spouseRelations : [],
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load family graph");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const wrapMutation = useCallback(
    async (operation: () => Promise<void>) => {
      setIsMutating(true);
      try {
        await operation();
        await reload();
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      } finally {
        setIsMutating(false);
      }
    },
    [reload],
  );

  return {
    graph,
    isLoading,
    isMutating,
    error,
    reload,
    createPerson: async (payload: PersonInput) => {
      await wrapMutation(async () => {
        await createPerson(payload);
      });
    },
    updatePerson: async (personId: string, payload: PersonInput) => {
      await wrapMutation(async () => {
        await updatePerson(personId, payload);
      });
    },
    deletePerson: async (personId: string) => {
      await wrapMutation(async () => {
        await deletePerson(personId);
      });
    },
    createParentChild: async (payload: ParentChildInput) => {
      await wrapMutation(async () => {
        await createParentChildRelation(payload);
      });
    },
    deleteParentChild: async (parentId: string, childId: string) => {
      await wrapMutation(async () => {
        await deleteParentChildRelation(parentId, childId);
      });
    },
    createSpouse: async (payload: SpouseInput) => {
      await wrapMutation(async () => {
        await createSpouseRelation(payload);
      });
    },
    deleteSpouse: async (personAId: string, personBId: string) => {
      await wrapMutation(async () => {
        await deleteSpouseRelation(personAId, personBId);
      });
    },
    createFamily: async (payload: FamilyInput) => {
      await wrapMutation(async () => {
        await createFamily(payload);
      });
    },
    updateFamily: async (familyId: string, payload: FamilyInput) => {
      await wrapMutation(async () => {
        await updateFamily(familyId, payload);
      });
    },
    deleteFamily: async (familyId: string) => {
      await wrapMutation(async () => {
        await deleteFamily(familyId);
      });
    },
  };
};
