export const genderValues = ["MALE", "FEMALE", "NON_BINARY", "OTHER"] as const;
export type Gender = (typeof genderValues)[number];

export const parentTypeValues = ["BIOLOGICAL", "ADOPTIVE", "STEP", "GUARDIAN"] as const;
export type ParentType = (typeof parentTypeValues)[number];

export type PersonRecord = {
  id: string;
  first_name: string;
  last_name: string;
  gender: Gender | null;
  date_of_birth: string | null;
  date_of_death: string | null;
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ParentChildRelationRecord = {
  id: string;
  parent_id: string;
  child_id: string;
  relation_type: ParentType;
  created_at: string;
};

export type SpouseRelationRecord = {
  id: string;
  person_a_id: string;
  person_b_id: string;
  married_at: string | null;
  divorced_at: string | null;
  created_at: string;
};

export type UiSettingsRecord = {
  id: number;
  active_tab: "TREE" | "MEMBERS" | "RELATIONSHIPS";
  active_page: "HOME" | "SETTINGS";
  selected_theme_id: "FOREST" | "OCEAN" | "SUNSET" | "GRAPHITE";
  primary_color_input: string;
  secondary_color_input: string;
  show_customize_toolbar: 0 | 1;
  sidebar_enabled: 0 | 1;
  layout_mode: "SIDEBAR" | "TOOLBAR";
  show_member_photos: 0 | 1;
  updated_at: string;
};
