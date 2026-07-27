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

export const categories: Category[] = [
  {
    id: "1",
    label: "Коктейли",
    tagline: "Авторские напитки и не только",
    imageKey: "cocktails",
  },
  {
    id: "2",
    label: "Бургеры",
    tagline: "Мраморная говядина...",
    imageKey: "burgers",
  },
  {
    id: "3",
    label: "DJ/Disco",
    tagline: "Танцуем Vogue!",
    imageKey: "disco",
  },
  {
    id: "4",
    label: "Одежда",
    tagline: "Локальные бренды",
    imageKey: "clothing",
  },
  {
    id: "5",
    label: "Украшения",
    tagline: "Блестим на лунном свете",
    imageKey: "jewelry",
  },
];

export const featuredPlace: Omit<Place, "categoryId"> = {
  id: "1",
  title: "Операционная",
  subtitle: "Объединение казахстанских брендов",
  tag: "ПОПУЛЯРНОЕ",
  imageKey: "operation",
};

export const places: Place[] = [
  {
    id: "1",
    title: "Операционная",
    subtitle: "Объединение казахстанских брендов",
    tag: "ПОПУЛЯРНОЕ",
    imageKey: "operation",
    categoryId: "1",
  },
  {
    id: "2",
    title: "Тёплый вечер",
    subtitle: "Коктейльный бар с видом на город",
    tag: "ВЫБОР РЕДАКЦИИ",
    imageKey: "cooperative",
    categoryId: "1",
  },
  {
    id: "3",
    title: "Форма",
    subtitle: "Локальные дизайнеры и предметы для дома",
    imageKey: "operation",
    categoryId: "4",
  },
  {
    id: "4",
    title: "Булка на углях",
    subtitle: "Сочные бургеры, хрустящий картофель и честный соус",
    tag: "СМЭШ-БУРГЕРЫ",
    imageKey: "cooperative",
    categoryId: "2",
  },
  {
    id: "5",
    title: "Мясо & Бриошь",
    subtitle: "Небольшая бургерная для неспешного обеда",
    imageKey: "operation",
    categoryId: "2",
  },
  {
    id: "6",
    title: "Красный угол",
    subtitle: "Острые бургеры и вечерний плейлист без суеты",
    tag: "ДО ПОЗДНЕГО",
    imageKey: "cooperative",
    categoryId: "2",
  },
  {
    id: "7",
    title: "Ритм",
    subtitle: "Танцпол, винил и селекция от местных диджеев",
    tag: "DJ-СЕТЫ",
    imageKey: "operation",
    categoryId: "3",
  },
  {
    id: "8",
    title: "Подвал 12",
    subtitle: "Камерный клуб с хаусом и мягким светом",
    imageKey: "cooperative",
    categoryId: "3",
  },
  {
    id: "9",
    title: "После полуночи",
    subtitle: "Диско, фанк и люди, которые пришли танцевать",
    tag: "ПЯТНИЦА И СУББОТА",
    imageKey: "operation",
    categoryId: "3",
  },
  {
    id: "10",
    title: "Тихий крой",
    subtitle: "Продуманный гардероб от казахстанских марок",
    imageKey: "cooperative",
    categoryId: "4",
  },
  {
    id: "11",
    title: "Смена",
    subtitle: "Повседневные вещи, деним и аккуратные силуэты",
    tag: "ЛОКАЛЬНЫЕ БРЕНДЫ",
    imageKey: "operation",
    categoryId: "4",
  },
  {
    id: "12",
    title: "Точка света",
    subtitle: "Минималистичные украшения на каждый день",
    imageKey: "cooperative",
    categoryId: "5",
  },
  {
    id: "13",
    title: "Алтын линия",
    subtitle: "Современное прочтение казахских мотивов",
    tag: "РУЧНАЯ РАБОТА",
    imageKey: "operation",
    categoryId: "5",
  },
  {
    id: "14",
    title: "Лунный камень",
    subtitle: "Серебро, натуральные камни и тонкие формы",
    imageKey: "cooperative",
    categoryId: "5",
  },
];

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
    address: "Ул. Панфилова, 15",
    latitude: 43.2567,
    longitude: 76.9456,
    phone: "+7 727 000 00 01",
  },
  "2": {
    address: "Проспект Достык, 40",
    latitude: 43.2445,
    longitude: 76.9568,
    phone: "+7 727 000 00 02",
  },
};

const defaultLocation = {
  address: "Алматы, Казахстан",
  latitude: 43.2389,
  longitude: 76.8897,
  phone: "+7 727 000 00 00",
};

export function getCategoryDetail(id: string): CategoryDetail | undefined {
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

export function getSpaceDetail(id: string): SpaceDetail | undefined {
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
    address: location.address,
    hours: "Открыто до 23:00",
    categoryTag: category?.label.toUpperCase() ?? "VIBE МЕСТО",
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
