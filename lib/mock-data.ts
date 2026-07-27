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
  name: string;
  subtitle: string;
  count: number;
  imageKey: ImageKey;
  places: CategoryPlace[];
};

export type SpaceDetail = {
  name: string;
  rating: number;
  address: string;
  hours: string;
  categoryTag: string;
  description: string;
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

export const categoryDetail: CategoryDetail = {
  name: "Коктейли",
  subtitle: "Авторские напитки и не только",
  count: 8,
  imageKey: "cocktails",
  places: [
    {
      id: "love-cooperative",
      title: 'Кооператив "Любовь"',
      subtitle: "Место для отдыха, работы и творчества.",
      rating: 4.8,
      tag: "ПОПУЛЯРНОЕ",
      imageKey: "cooperative",
    },
    {
      id: "warm-evening",
      title: "Тёплый вечер",
      subtitle: "Коктейльный бар с видом на город.",
      rating: 4.8,
      imageKey: "operation",
    },
    {
      id: "forma-bar",
      title: "Форма",
      subtitle: "Авторские коктейли и музыка до позднего вечера.",
      rating: 4.7,
      imageKey: "cooperative",
    },
  ],
};

export const spaceDetail: SpaceDetail = {
  name: 'Кооператив "Любовь"',
  rating: 4.9,
  address: "Ул. Панфилова, 15",
  hours: "Открыто до 23:00",
  categoryTag: "ТВОРЧЕСКОЕ ПРОСТРАНСТВО",
  description:
    "Уютное пространство для отдыха, работы и творчества: коворкинг, лекции и локальные бренды под одной крышей в самом сердце города.",
  gallery: ["operation", "cooperative", "rooftop"],
  inside: [places[0], places[2]],
};
