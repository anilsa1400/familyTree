import { ReactNode } from "react";
import { Text, View } from "react-native";
import { uiCommonStyles } from "../../styles/uiStyles";

type PanelHeaderProps = {
  title: string;
  hint: string;
  actions?: ReactNode;
};

export const PanelHeader = ({ title, hint, actions }: PanelHeaderProps) => (
  <View style={uiCommonStyles.panelHeaderRow}>
    <View style={uiCommonStyles.panelHeaderTextBlock}>
      <Text style={uiCommonStyles.panelTitle}>{title}</Text>
      <Text style={uiCommonStyles.panelHint}>{hint}</Text>
    </View>
    {actions ? <View style={uiCommonStyles.panelHeaderActions}>{actions}</View> : null}
  </View>
);
