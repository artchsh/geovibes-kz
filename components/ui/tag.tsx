import { Text, View } from "react-native";

type TagProps = {
  label: string;
  variant?: "accent" | "dark";
};

export function Tag({ label, variant = "accent" }: TagProps) {
  return (
    <View
      className={`self-start px-[9px] py-1.5 ${
        variant === "dark"
          ? "rounded-full bg-darkSurface"
          : "rounded-md bg-accentOrange"
      }`}
    >
      <Text
        className={`font-sans-bold text-white ${
          variant === "dark" ? "text-xs" : "text-[13px]"
        }`}
      >
        {label}
      </Text>
    </View>
  );
}
