import { Pressable, Text } from "react-native";

type ActionChipProps = {
  label: string;
  variant?: "primary" | "default";
  onPress?: () => void;
  wide?: boolean;
};

export function ActionChip({
  label,
  variant = "default",
  onPress,
  wide = false,
}: ActionChipProps) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      className={`min-h-12 items-center justify-center rounded-full px-5 ${
        wide ? "flex-1" : ""
      } ${
        isPrimary ? "bg-primary" : "bg-white"
      }`}
      onPress={onPress}
    >
      <Text
        className={`font-sans-semibold text-sm ${
          isPrimary ? "text-white" : "text-darkSurface"
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
