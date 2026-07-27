import { Pressable, Text } from "react-native";

type ActionChipProps = {
  label: string;
  variant?: "primary" | "default";
  onPress?: () => void;
};

export function ActionChip({
  label,
  variant = "default",
  onPress,
}: ActionChipProps) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityRole="button"
      className={`items-center justify-center rounded-[18px] px-4 py-2.5 ${
        isPrimary ? "bg-primary" : "bg-bg"
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
