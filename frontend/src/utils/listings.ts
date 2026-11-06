const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface HomeListing {
  id: string;
  title: string;
  location: string;
  bhk: number;
  bath: number;
  total_sqft: number;
  balcony: number;
  asking_price_lakhs: number;
  predicted_price_lakhs: number;
  seller_name: string;
  seller_phone: string;
  created_at: string;
  imageUrl?: string;
}

// Initial set of premium mock properties in popular Bengaluru areas
const INITIAL_LISTINGS: HomeListing[] = [
  {
    id: "mock-1",
    title: "Luxurious High-Rise Apartment",
    location: "Indira Nagar",
    bhk: 3,
    bath: 3,
    total_sqft: 1850,
    balcony: 2,
    asking_price_lakhs: 235.0,
    predicted_price_lakhs: 228.6,
    seller_name: "Rohan Gowda",
    seller_phone: "+91 98450 12345",
    created_at: "2026-05-20 10:30:00",
    imageUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "mock-2",
    title: "Premium Modern Villa",
    location: "Whitefield",
    bhk: 4,
    bath: 4,
    total_sqft: 2800,
    balcony: 3,
    asking_price_lakhs: 250.0,
    predicted_price_lakhs: 262.3,
    seller_name: "Priya Nair",
    seller_phone: "+91 99000 67890",
    created_at: "2026-05-22 14:15:00",
    imageUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "mock-3",
    title: "Cozy Family Apartment",
    location: "HSR Layout",
    bhk: 2,
    bath: 2,
    total_sqft: 1150,
    balcony: 1,
    asking_price_lakhs: 92.0,
    predicted_price_lakhs: 96.5,
    seller_name: "Amit Sharma",
    seller_phone: "+91 98860 11223",
    created_at: "2026-05-23 09:00:00",
    imageUrl: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=800&q=80"
  },
  {
    id: "mock-4",
    title: "Spacious Eco-Friendly Penthouse",
    location: "Hebbal Kempapura",
    bhk: 3,
    bath: 3,
    total_sqft: 2100,
    balcony: 2,
    asking_price_lakhs: 185.0,
    predicted_price_lakhs: 198.8,
    seller_name: "Karan Mehta",
    seller_phone: "+91 97410 44556",
    created_at: "2026-05-21 17:45:00",
    imageUrl: "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80"
  }
];

const LOCAL_STORAGE_KEY = "bengaluru_prop_listings";

function getLegacyLocalListings(): HomeListing[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as HomeListing[]) : [];
  } catch (e) {
    console.error("Error accessing localStorage", e);
    return [];
  }
}

/** Fetch persisted listings and retain legacy browser entries and sample cards. */
export async function getStoredListings(): Promise<HomeListing[]> {
  const response = await fetch(`${API_BASE}/api/listings`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load listings (HTTP ${response.status})`);
  const data = (await response.json()) as { listings: HomeListing[] };
  const saved = [...data.listings, ...getLegacyLocalListings()];
  const unique = [...new Map(saved.map((listing) => [listing.id, listing])).values()];
  return [...unique, ...INITIAL_LISTINGS];
}

export function getOfflineListings(): HomeListing[] {
  return [...getLegacyLocalListings(), ...INITIAL_LISTINGS];
}

/**
 * Publishes a listing through the API, which computes the current model estimate
 * and saves the record to DynamoDB in AWS or SQLite during local development.
 */
export async function addStoredListing(
  listing: Omit<HomeListing, "id" | "predicted_price_lakhs" | "created_at" | "imageUrl">
): Promise<HomeListing> {
  const images = [
    "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1605276374104-dee2a0ed3cd6?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=800&q=80",
  ];
  const randomImage = images[Math.floor(Math.random() * images.length)];

  const response = await fetch(`${API_BASE}/api/listings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...listing, imageUrl: randomImage }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw { message: `Could not publish listing (HTTP ${response.status})`, detail: error?.detail };
  }
  return (await response.json()) as HomeListing;
}

/**
 * Computes price analysis compared to predicted rate.
 */
export function analyzeAskingPrice(
  asking: number,
  predicted: number
): {
  badgeText: string;
  badgeClass: string;
  differencePct: number;
} {
  const diffPct = ((asking - predicted) / predicted) * 100;

  if (diffPct < -5) {
    return {
      badgeText: `Below AI Value (${Math.abs(Math.round(diffPct))}% off)`,
      badgeClass: "deal-below",
      differencePct: diffPct,
    };
  } else if (diffPct > 5) {
    return {
      badgeText: "Premium Pricing",
      badgeClass: "deal-premium",
      differencePct: diffPct,
    };
  } else {
    return {
      badgeText: "Fair Market Value",
      badgeClass: "deal-fair",
      differencePct: diffPct,
    };
  }
}
