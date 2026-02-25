const API_KEY = import.meta.env.VITE_KLIPY_APP_KEY as string | undefined;
const BASE_URL = `https://api.klipy.com/api/v1/${API_KEY ?? ''}`;

export type KlipyGif = {
  id: string;
  title: string;
  url: string;
  preview_url: string;
  width: number;
  height: number;
};

type KlipyCategory = {
  name: string;
  image: string;
  search_term: string;
};

// Klipy actual response shape: { result, data: { data: [...], has_next, ... } }
type KlipyFileVariant = {
  url?: string;
  width?: number;
  height?: number;
};

type KlipyRawItem = {
  id?: number;
  type?: string;
  title?: string;
  file?: {
    hd?: { gif?: KlipyFileVariant; webp?: KlipyFileVariant };
    md?: { gif?: KlipyFileVariant; webp?: KlipyFileVariant };
    sm?: { gif?: KlipyFileVariant; webp?: KlipyFileVariant };
    xs?: { gif?: KlipyFileVariant; webp?: KlipyFileVariant };
  };
};

type KlipyResponse = {
  result?: boolean;
  data?: {
    data?: KlipyRawItem[];
    has_next?: boolean;
  };
};

type KlipyCategoriesResponse = {
  data?: KlipyCategory[];
};

function parseGifs(raw: KlipyResponse | undefined): { gifs: KlipyGif[]; hasNext: boolean } {
  const items = raw?.data?.data;
  const hasNext = raw?.data?.has_next ?? false;
  if (!Array.isArray(items)) return { gifs: [], hasNext: false };

  const gifs: KlipyGif[] = [];
  for (const item of items) {
    if (item?.type === 'ad') continue;

    // Use hd.gif for the full URL to send, sm.webp (or sm.gif) for preview in the grid
    const fullUrl = item?.file?.hd?.gif?.url ?? item?.file?.md?.gif?.url;
    const previewUrl = item?.file?.sm?.webp?.url ?? item?.file?.sm?.gif?.url ?? item?.file?.xs?.gif?.url;
    if (!fullUrl || !previewUrl) continue;

    const hdFile = item?.file?.hd?.gif ?? item?.file?.md?.gif;
    gifs.push({
      id: String(item.id ?? ''),
      title: item.title ?? '',
      url: fullUrl,
      preview_url: previewUrl,
      width: hdFile?.width ?? 200,
      height: hdFile?.height ?? 200,
    });
  }
  return { gifs, hasNext };
}

export async function searchGifs(query: string, page = 1, perPage = 20): Promise<{ gifs: KlipyGif[]; hasNext: boolean }> {
  if (!API_KEY) return { gifs: [], hasNext: false };
  try {
    const params = new URLSearchParams({
      q: query,
      page: String(page),
      per_page: String(perPage),
    });
    const res = await fetch(`${BASE_URL}/gifs/search?${params}`);
    if (!res.ok) return { gifs: [], hasNext: false };
    const json = (await res.json()) as KlipyResponse;
    return parseGifs(json);
  } catch {
    return { gifs: [], hasNext: false };
  }
}

export async function getTrendingGifs(page = 1, perPage = 20): Promise<{ gifs: KlipyGif[]; hasNext: boolean }> {
  if (!API_KEY) return { gifs: [], hasNext: false };
  try {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    const res = await fetch(`${BASE_URL}/gifs/trending?${params}`);
    if (!res.ok) return { gifs: [], hasNext: false };
    const json = (await res.json()) as KlipyResponse;
    return parseGifs(json);
  } catch {
    return { gifs: [], hasNext: false };
  }
}

export async function getGifCategories(): Promise<KlipyCategory[]> {
  if (!API_KEY) return [];
  try {
    const res = await fetch(`${BASE_URL}/gifs/categories`);
    if (!res.ok) return [];
    const json = (await res.json()) as KlipyCategoriesResponse;
    return json?.data ?? [];
  } catch {
    return [];
  }
}
