export type ImageKey =
  | "operation"
  | "cooperative"
  | "cocktails"
  | "burgers"
  | "disco"
  | "clothing"
  | "jewelry"
  | "atelier"
  | "rooftop";

export type Category = {
  id: string;
  label: string;
  tagline: string;
  imageKey: ImageKey;
};

export type Place = {
  id: string;
  title: string;
  subtitle: string;
  tag?: string;
  imageKey: ImageKey;
  categoryId: string;
};

export type CategoryPlace = Omit<Place, "categoryId"> & {
  rating: number;
};

export type CategoryDetail = {
  id: string;
  name: string;
  subtitle: string;
  count: number;
  imageKey: ImageKey;
  places: CategoryPlace[];
};

export type SpaceDetail = {
  id: string;
  name: string;
  rating: number;
  address: string;
  hours: string;
  categoryTag: string;
  description: string;
  phone: string;
  latitude: number;
  longitude: number;
  gallery: ImageKey[];
  inside: Place[];
};

const categoryRecords: Pick<Category, "id" | "imageKey">[] = [
  { id: "1", imageKey: "cocktails" },
  { id: "2", imageKey: "burgers" },
  { id: "3", imageKey: "disco" },
  { id: "4", imageKey: "clothing" },
  { id: "5", imageKey: "jewelry" },
];

const placeRecords: Array<
  Pick<Place, "id" | "imageKey" | "categoryId"> & { hasTag?: boolean }
> = [
  {
    id: "1",
    hasTag: true,
    imageKey: "operation",
    categoryId: "1",
  },
  {
    id: "2",
    hasTag: true,
    imageKey: "cooperative",
    categoryId: "1",
  },
  {
    id: "3",
    imageKey: "operation",
    categoryId: "4",
  },
  {
    id: "4",
    hasTag: true,
    imageKey: "cooperative",
    categoryId: "2",
  },
  {
    id: "5",
    imageKey: "operation",
    categoryId: "2",
  },
  {
    id: "6",
    hasTag: true,
    imageKey: "cooperative",
    categoryId: "2",
  },
  {
    id: "7",
    hasTag: true,
    imageKey: "operation",
    categoryId: "3",
  },
  {
    id: "8",
    imageKey: "cooperative",
    categoryId: "3",
  },
  {
    id: "9",
    hasTag: true,
    imageKey: "operation",
    categoryId: "3",
  },
  {
    id: "10",
    imageKey: "cooperative",
    categoryId: "4",
  },
  {
    id: "11",
    hasTag: true,
    imageKey: "operation",
    categoryId: "4",
  },
  {
    id: "12",
    imageKey: "cooperative",
    categoryId: "5",
  },
  {
    id: "13",
    hasTag: true,
    imageKey: "operation",
    categoryId: "5",
  },
  {
    id: "14",
    imageKey: "cooperative",
    categoryId: "5",
  },
];

export function getCategories(t: TFunction): Category[] {
  return categoryRecords.map((category) => ({
    ...category,
    label: t(`catalog.categories.${category.id}.label`),
    tagline: t(`catalog.categories.${category.id}.tagline`),
  }));
}

export function getPlaces(t: TFunction): Place[] {
  return placeRecords.map(({ hasTag, ...place }) => ({
    ...place,
    title: t(`catalog.places.${place.id}.title`),
    subtitle: t(`catalog.places.${place.id}.subtitle`),
    tag: hasTag ? t(`catalog.places.${place.id}.tag`) : undefined,
  }));
}

export function getFeaturedPlace(t: TFunction): Omit<Place, "categoryId"> {
  const { categoryId: _categoryId, ...featured } = getPlaces(t)[0];
  return featured;
}

const placeRatings: Record<string, number> = {
  "1": 4.9,
  "2": 4.8,
  "3": 4.7,
  "4": 4.8,
  "5": 4.6,
  "6": 4.7,
  "7": 4.9,
  "8": 4.6,
  "9": 4.8,
  "10": 4.7,
  "11": 4.6,
  "12": 4.8,
  "13": 4.9,
  "14": 4.7,
};

const venueLocations: Record<
  string,
  { address: string; latitude: number; longitude: number; phone: string }
> = {
  "1": {
    address: "1",
    latitude: 43.2567,
    longitude: 76.9456,
    phone: "+7 727 000 00 01",
  },
  "2": {
    address: "2",
    latitude: 43.2445,
    longitude: 76.9568,
    phone: "+7 727 000 00 02",
  },
};

const defaultLocation = {
  address: "default",
  latitude: 43.2389,
  longitude: 76.8897,
  phone: "+7 727 000 00 00",
};

export function getCategoryDetail(
  id: string,
  t: TFunction,
): CategoryDetail | undefined {
  const categories = getCategories(t);
  const places = getPlaces(t);
  const category = categories.find((item) => item.id === id);
  if (!category) return undefined;

  const categoryPlaces = places
    .filter((place) => place.categoryId === id)
    .map(({ categoryId: _categoryId, ...place }) => ({
      ...place,
      rating: placeRatings[place.id] ?? 4.7,
    }));

  return {
    id: category.id,
    name: category.label,
    subtitle: category.tagline,
    count: categoryPlaces.length,
    imageKey: category.imageKey,
    places: categoryPlaces,
  };
}

export function getSpaceDetail(
  id: string,
  t: TFunction,
): SpaceDetail | undefined {
  const categories = getCategories(t);
  const places = getPlaces(t);
  const place = places.find((item) => item.id === id);
  if (!place) return undefined;

  const category = categories.find((item) => item.id === place.categoryId);
  const location = venueLocations[id] ?? defaultLocation;
  const gallery = Array.from(
    new Set<ImageKey>([
      place.imageKey,
      category?.imageKey ?? "operation",
      "rooftop",
    ]),
  );

  return {
    id: place.id,
    name: place.title,
    rating: placeRatings[id] ?? 4.7,
    address: t(`catalog.locations.${location.address}`),
    hours: t("space.openUntil", { time: "23:00" }),
    categoryTag: category?.label.toLocaleUpperCase() ?? t("space.fallbackCategory"),
    description: place.subtitle,
    phone: location.phone,
    latitude: location.latitude,
    longitude: location.longitude,
    gallery,
    inside: places
      .filter(
        (item) => item.categoryId === place.categoryId && item.id !== place.id,
      )
      .slice(0, 2),
  };
}
import type { TFunction } from "i18next";
