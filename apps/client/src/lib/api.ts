import {
  Family,
  FamilyGraph,
  FamilyInput,
  ParentChildInput,
  Person,
  PersonInput,
  SpouseInput,
} from "../types/family";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:4000";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const request = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.message || "Request failed";
    throw new ApiError(message, response.status);
  }

  return data as T;
};

export const getFamilyGraph = () => request<FamilyGraph>("/api/tree");

export const createPerson = (payload: PersonInput) =>
  request<Person>("/api/persons", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const getFamilies = () => request<Family[]>("/api/families");

export const createFamily = (payload: FamilyInput) =>
  request<Family>("/api/families", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const updateFamily = (familyId: string, payload: FamilyInput) =>
  request<Family>(`/api/families/${familyId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteFamily = (familyId: string) =>
  request<void>(`/api/families/${familyId}`, {
    method: "DELETE",
  });

export const updatePerson = (personId: string, payload: PersonInput) =>
  request<Person>(`/api/persons/${personId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deletePerson = (personId: string) =>
  request<void>(`/api/persons/${personId}`, {
    method: "DELETE",
  });

export const createParentChildRelation = (payload: ParentChildInput) =>
  request("/api/relations/parent-child", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteParentChildRelation = (parentId: string, childId: string) =>
  request<void>(
    `/api/relations/parent-child?parentId=${encodeURIComponent(parentId)}&childId=${encodeURIComponent(childId)}`,
    {
      method: "DELETE",
    },
  );

export const createSpouseRelation = (payload: SpouseInput) =>
  request("/api/relations/spouse", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const deleteSpouseRelation = (personAId: string, personBId: string) =>
  request<void>(
    `/api/relations/spouse?personAId=${encodeURIComponent(personAId)}&personBId=${encodeURIComponent(personBId)}`,
    {
      method: "DELETE",
    },
  );

export type UiSettingsPayload = {
  activeTab: "TREE" | "MEMBERS" | "RELATIONSHIPS" | "FAMILIES";
  activePage: "HOME" | "SETTINGS";
  selectedThemeId: "FOREST" | "OCEAN" | "SUNSET" | "GRAPHITE";
  themeEditorMode: "PRESET" | "CUSTOMIZE";
  primaryColorInput: string;
  secondaryColorInput: string;
  layoutMode: "SIDEBAR" | "TOOLBAR";
  sidebarEnabled: boolean;
  showMemberPhotos: boolean;
};

export type UiSettingsResponse = UiSettingsPayload & {
  updatedAt: string;
};

export const getUiSettings = () => request<UiSettingsResponse>("/api/settings/ui");

export const updateUiSettings = (payload: UiSettingsPayload) =>
  request<UiSettingsResponse>("/api/settings/ui", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export { ApiError, API_BASE_URL };
