import { Text, View } from "react-native";

type TagProps = {
  label: string;
  variant?: "accent" | "dark";
};

export function Tag({ label, variant = "accent" }: TagProps) {
  return (
    <View
      className={`self-start px-3 py-2 ${
        variant === "dark"
          ? "rounded-full bg-darkSurface"
          : "rounded-lg bg-accentOrange"
      }`}
    >
      <Text
        className={`font-sans-bold text-xs ${
          variant === "dark" ? "text-white" : "text-darkSurface"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
