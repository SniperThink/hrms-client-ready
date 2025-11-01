// Service for fetching dropdown options from the backend
import { API_CONFIG } from "../config/apiConfig";
import { logger } from '../utils/logger';

export interface DropdownOptions {
  departments: string[];
  locations: string[];
  designations: string[];
  cities: string[];
  states: string[];
}

/**
 * Fetch dropdown options from the backend API
 * This includes departments, locations, designations, cities, and states
 * sourced directly from the database
 */
export const fetchDropdownOptions = async (): Promise<DropdownOptions> => {
  try {
    const response = await fetch(API_CONFIG.getApiUrl("/dropdown-options/"));

    if (!response.ok) {
      throw new Error(`Failed to fetch dropdown options: ${response.status}`);
    }

    const data = await response.json();

    return {
      departments: data.departments || [],
      locations: data.locations || [],
      designations: data.designations || [],
      cities: data.cities || [],
      states: data.states || [],
    };
  } catch (error) {
    logger.error("Error fetching dropdown options:", error);
    // Return fallback data
    return {
      departments: [
        "Engineering",
        "Sales",
        "HR",
        "Finance",
        "Design",
        "Marketing",
      ],
      locations: [],
      designations: [],
      cities: [],
      states: [],
    };
  }
};

// Cache for dropdown options to avoid repeated API calls
let dropdownCache: DropdownOptions | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Get dropdown options with caching
 */
export const getDropdownOptions = async (): Promise<DropdownOptions> => {
  const now = Date.now();

  // Return cached data if it's still valid
  if (dropdownCache && now - cacheTimestamp < CACHE_DURATION) {
    return dropdownCache;
  }

  // Fetch fresh data
  dropdownCache = await fetchDropdownOptions();
  cacheTimestamp = now;

  return dropdownCache;
};

/**
 * Clear the dropdown options cache
 * Call this when departments/locations are updated
 */
export const clearDropdownCache = () => {
  dropdownCache = null;
  cacheTimestamp = 0;
  logger.info( "Dropdown cache cleared - will fetch fresh data on next request");
};
