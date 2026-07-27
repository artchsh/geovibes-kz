import type { ImageSourcePropType } from "react-native";

import type { ImageKey } from "@/lib/mock-data";

export const images: Record<ImageKey, ImageSourcePropType> = {
  operation: require("../assets/images/venue-operacionnaya.png"),
  cooperative: require("../assets/images/place-cooperative.png"),
  cocktails: require("../assets/images/category-cocktails.png"),
  burgers: require("../assets/images/category-burgers.png"),
  disco: require("../assets/images/category-disco.png"),
  clothing: require("../assets/images/category-clothing.png"),
  jewelry: require("../assets/images/category-jewelry.png"),
  atelier: require("../assets/images/place-cooperative.png"),
  rooftop: require("../assets/images/venue-operacionnaya.png"),
};

export const logoHeart: ImageSourcePropType = require("../assets/images/logo-heart.png");
export const onboardingPhone: ImageSourcePropType = require("../assets/images/onboarding-phone.png");
