import { CliError } from "./errors.js";

export interface ZapCategory {
  id: string;
  hebrewName: string;
  englishName: string;
  rssUrl: string;
}

const RSS_BASE_URL = "https://www.zap.co.il/xmls/general/rss.aspx";

export const categories: ZapCategory[] = [
  category("electric", "חשמל ואלקטרוניקה", "Electricity and electronics"),
  category("comp", "מחשבים ותוכנות", "Computers and software"),
  category("bait", "לבית לגן ולמשרד", "Home, garden, and office"),
  category("sport", "פנאי וספורט", "Leisure and sport"),
  category("etc", "מתנות ושונות", "Gifts and miscellaneous"),
  category("gifts", "ילדים", "Kids"),
  category("health", "טיפוח יופי ובריאות", "Health and beauty"),
  category("tayarot", "רכב ואביזרים", "Vehicles and accessories"),
  category("service", "שרותים", "Services"),
  category("fashion", "אופנה", "Fashion")
];

export function getCategory(id: string): ZapCategory | undefined {
  return categories.find((categoryItem) => categoryItem.id === id);
}

export function requireCategory(id: string): ZapCategory {
  const found = getCategory(id);
  if (!found) {
    const supported = categories.map((categoryItem) => categoryItem.id).join(", ");
    throw new CliError("INVALID_ARGUMENTS", `Unsupported RSS category "${id}".`, `Supported categories: ${supported}.`);
  }
  return found;
}

function category(id: string, hebrewName: string, englishName: string): ZapCategory {
  return {
    id,
    hebrewName,
    englishName,
    rssUrl: `${RSS_BASE_URL}?cat=${encodeURIComponent(id)}`
  };
}
