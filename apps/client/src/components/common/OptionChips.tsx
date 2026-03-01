import { Pressable, StyleProp, Text, View, ViewStyle } from "react-native";
import { uiCommonStyles } from "../../styles/uiStyles";

export type OptionChip<T extends string> = {
  value: T;
  label: string;
};

type OptionChipsProps<T extends string> = {
  options: OptionChip<T>[];
  selectedValue: T;
  onSelect: (value: T) => void;
  containerStyle?: StyleProp<ViewStyle>;
  activeBackgroundColor?: string;
  activeBorderColor?: string;
  activeTextColor?: string;
  inactiveBackgroundColor?: string;
  inactiveBorderColor?: string;
  inactiveTextColor?: string;
};

export const OptionChips = <T extends string>({
  options,
  selectedValue,
  onSelect,
  containerStyle,
  activeBackgroundColor = "#2e5f4f",
  activeBorderColor = "#2e5f4f",
  activeTextColor = "#ffffff",
  inactiveBackgroundColor,
  inactiveBorderColor,
  inactiveTextColor,
}: OptionChipsProps<T>) => (
  <View style={[uiCommonStyles.optionRowWrap, containerStyle]}>
    {options.map((option) => {
      const isSelected = selectedValue === option.value;
      return (
        <Pressable
          key={`chip-${option.value}`}
          style={[
            uiCommonStyles.optionButton,
            inactiveBackgroundColor ? { backgroundColor: inactiveBackgroundColor } : null,
            inactiveBorderColor ? { borderColor: inactiveBorderColor } : null,
            isSelected && {
              backgroundColor: activeBackgroundColor,
              borderColor: activeBorderColor,
            },
          ]}
          onPress={() => onSelect(option.value)}
        >
          <Text
            style={[
              uiCommonStyles.optionButtonText,
              inactiveTextColor ? { color: inactiveTextColor } : null,
              isSelected && { color: activeTextColor },
            ]}
          >
            {option.label}
          </Text>
        </Pressable>
      );
    })}
  </View>
);
