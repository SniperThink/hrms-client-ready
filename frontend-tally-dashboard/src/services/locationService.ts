// Location service using country-state-city npm package
import { Country, State, City } from 'country-state-city';
import { logger } from '../utils/logger';

// Export types for compatibility with existing components
export interface CountryOption {
  value: string;
  label: string;
}

export interface StateOption {
  value: string;
  label: string;
}

export interface CityOption {
  value: string;
  label: string;
}

// Popular countries for better UX
const POPULAR_COUNTRIES = [
  'US', 'IN', 'GB', 'CA', 'AU', 'DE', 'FR', 'JP', 'CN', 'BR'
];

/**
 * Get all countries as dropdown options
 */
export const getCountryOptions = async (): Promise<CountryOption[]> => {
  try {
    const countries = Country.getAllCountries();
    const popular: CountryOption[] = [];
    const others: CountryOption[] = [];
    
    countries.forEach(country => {
      const option = {
        value: country.isoCode,
        label: country.name
      };
      
      if (POPULAR_COUNTRIES.includes(country.isoCode)) {
        popular.push(option);
      } else {
        others.push(option);
      }
    });
    
    // Sort popular by the order in POPULAR_COUNTRIES array
    popular.sort((a, b) => {
      const indexA = POPULAR_COUNTRIES.indexOf(a.value);
      const indexB = POPULAR_COUNTRIES.indexOf(b.value);
      return indexA - indexB;
    });
    
    // Sort others alphabetically
    others.sort((a, b) => a.label.localeCompare(b.label));
    
    return [...popular, ...others];
  } catch (error) {
    logger.error('Error loading countries:', error);
    return [];
  }
};

/**
 * Get states for a specific country as dropdown options
 * @param countryId - For backward compatibility, but now expects ISO code
 */
export const getStateOptions = async (countryId: number | string): Promise<StateOption[]> => {
  try {
    // Convert old numeric IDs to ISO codes for backward compatibility
    let countryCode: string;
    
    if (typeof countryId === 'number') {
      // Legacy numeric ID mapping - you may want to update this
      const countryMap: { [key: number]: string } = {
        1: 'AF',   // Afghanistan
        99: 'IN',  // India
        226: 'US', // United States
        225: 'GB', // United Kingdom
        // Add more mappings as needed
      };
      countryCode = countryMap[countryId] || 'US';
    } else {
      countryCode = countryId;
    }
    
    const states = State.getStatesOfCountry(countryCode);
    
    if (!states || states.length === 0) {
      return [];
    }
    
    return states.map(state => ({
      value: state.isoCode,
      label: state.name
    }));
  } catch (error) {
    logger.error('Error loading states:', error);
    return [];
  }
};

/**
 * Get cities for a specific state as dropdown options
 * @param stateId - Can be numeric (legacy), state ISO code, or "COUNTRY_STATE" format
 */
export const getCityOptions = async (stateId: number | string): Promise<CityOption[]> => {
  try {
    let countryCode = 'US'; // Default
    let stateCode: string;
    
    if (typeof stateId === 'number') {
      // Legacy - try to map numeric IDs to state codes
      const stateMap: { [key: number]: { country: string; state: string } } = {
        3901: { country: 'AF', state: 'BDS' }, // Badakhshan
        3902: { country: 'AF', state: 'KAB' }, // Kabul
        // Add more mappings as needed
      };
      
      const mapping = stateMap[stateId];
      if (mapping) {
        countryCode = mapping.country;
        stateCode = mapping.state;
      } else {
        return []; // Unknown state ID
      }
    } else if (stateId.includes('_')) {
      // New format: "COUNTRY_STATE"
      [countryCode, stateCode] = stateId.split('_');
    } else {
      // Just state code - we need country context
      stateCode = stateId;
      
      // Try to find which country this state belongs to
      const allCountries = Country.getAllCountries();
      for (const country of allCountries) {
        const states = State.getStatesOfCountry(country.isoCode);
        if (states?.some(state => state.isoCode === stateCode)) {
          countryCode = country.isoCode;
          break;
        }
      }
    }
    
    const cities = City.getCitiesOfState(countryCode, stateCode);
    
    if (!cities || cities.length === 0) {
      return [];
    }
    
    // Limit to prevent performance issues
    return cities.slice(0, 200).map(city => ({
      value: city.name,
      label: city.name
    }));
  } catch (error) {
    logger.error('Error loading cities:', error);
    return [];
  }
};

// Legacy functions for backward compatibility
export const loadCountries = async () => {
  return getCountryOptions();
};

export const loadStates = async () => {
  const countries = Country.getAllCountries();
  const allStates: StateOption[] = [];
  
  countries.forEach(country => {
    const states = State.getStatesOfCountry(country.isoCode);
    states.forEach(state => {
      allStates.push({
        value: state.isoCode,
        label: state.name
      });
    });
  });
  
  return allStates;
};

export const loadCities = async () => {
  // Note: Loading all cities would be very expensive
  // Return empty array and recommend using getCityOptions with specific state
  logger.warn('loadCities() is deprecated. Use getCityOptions(stateId) instead.');
  return [];
};

// New helper functions using the npm package
export const getCountryName = (countryCode: string): string => {
  const country = Country.getCountryByCode(countryCode);
  return country ? country.name : '';
};

export const getStateName = (countryCode: string, stateCode: string): string => {
  const states = State.getStatesOfCountry(countryCode);
  const state = states?.find(s => s.isoCode === stateCode);
  return state ? state.name : '';
};

export const searchCities = (searchTerm: string, limit: number = 50): CityOption[] => {
  if (!searchTerm || searchTerm.length < 2) return [];
  
  const allCountries = Country.getAllCountries();
  const matchingCities: CityOption[] = [];
  
  for (const country of allCountries) {
    if (matchingCities.length >= limit) break;
    
    const cities = City.getCitiesOfCountry(country.isoCode);
    if (!cities || cities.length === 0) continue;
    
    const filtered = cities
      .filter(city => 
        city.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, limit - matchingCities.length)
      .map(city => ({
        value: city.name,
        label: `${city.name}, ${city.stateCode || country.name}`
      }));
    
    matchingCities.push(...filtered);
  }
  
  return matchingCities;
};

// Clear cache function for compatibility (no-op since npm package doesn't use cache)
export const clearLocationCache = () => {
  logger.info( 'Cache cleared (npm package doesn\'t use cache)');
};
