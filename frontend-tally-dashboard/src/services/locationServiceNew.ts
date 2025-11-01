// New location service using country-state-city npm package
import { Country, State, City } from 'country-state-city';
import { DropdownOption } from '../components/Dropdown';

export interface LocationData {
  countries: DropdownOption[];
  states: DropdownOption[];
  cities: DropdownOption[];
}

/**
 * Get all countries as dropdown options
 */
export const getCountryOptions = (): DropdownOption[] => {
  const countries = Country.getAllCountries();
  return countries.map(country => ({
    value: country.isoCode,
    label: country.name
  }));
};

/**
 * Get states for a specific country as dropdown options
 * @param countryCode - ISO code of the country (e.g., 'US', 'IN', 'AF')
 */
export const getStateOptions = (countryCode: string): DropdownOption[] => {
  if (!countryCode) return [];
  
  const states = State.getStatesOfCountry(countryCode);
  return states.map(state => ({
    value: state.isoCode,
    label: state.name
  }));
};

/**
 * Get cities for a specific state as dropdown options
 * @param countryCode - ISO code of the country
 * @param stateCode - ISO code of the state
 */
export const getCityOptions = (countryCode: string, stateCode: string): DropdownOption[] => {
  if (!countryCode || !stateCode) return [];
  
  const cities = City.getCitiesOfState(countryCode, stateCode);
  return cities.map(city => ({
    value: city.name,
    label: city.name
  }));
};

/**
 * Get all cities for a country (useful for large countries like US, India)
 * @param countryCode - ISO code of the country
 * @param limit - Optional limit to prevent performance issues
 */
export const getAllCitiesOfCountry = (countryCode: string, limit?: number): DropdownOption[] => {
  if (!countryCode) return [];
  
  const cities = City.getCitiesOfCountry(countryCode);
  if (!cities || cities.length === 0) return [];
  
  const limitedCities = limit ? cities.slice(0, limit) : cities;
  
  return limitedCities.map(city => ({
    value: city.name,
    label: city.name
  }));
};

/**
 * Search cities by name across all countries
 * @param searchTerm - The search term
 * @param limit - Optional limit to prevent performance issues
 */
export const searchCities = (searchTerm: string, limit: number = 50): DropdownOption[] => {
  if (!searchTerm || searchTerm.length < 2) return [];
  
  const allCountries = Country.getAllCountries();
  const matchingCities: DropdownOption[] = [];
  
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

/**
 * Get country name by ISO code
 */
export const getCountryName = (countryCode: string): string => {
  const country = Country.getCountryByCode(countryCode);
  return country ? country.name : '';
};

/**
 * Get state name by codes
 */
export const getStateName = (countryCode: string, stateCode: string): string => {
  const states = State.getStatesOfCountry(countryCode);
  const state = states.find(s => s.isoCode === stateCode);
  return state ? state.name : '';
};

/**
 * Utility function to get location hierarchy
 * @param countryCode - ISO code of the country
 * @param stateCode - ISO code of the state (optional)
 * @param cityName - Name of the city (optional)
 */
export const getLocationHierarchy = (
  countryCode: string, 
  stateCode?: string, 
  cityName?: string
): {
  country: string;
  state?: string;
  city?: string;
  fullAddress: string;
} => {
  const country = getCountryName(countryCode);
  const state = stateCode ? getStateName(countryCode, stateCode) : undefined;
  
  const parts = [cityName, state, country].filter(Boolean);
  
  return {
    country,
    state,
    city: cityName,
    fullAddress: parts.join(', ')
  };
};

// Popular countries for faster access
export const POPULAR_COUNTRIES = [
  'US', // United States
  'IN', // India
  'GB', // United Kingdom
  'CA', // Canada
  'AU', // Australia
  'DE', // Germany
  'FR', // France
  'JP', // Japan
  'CN', // China
  'BR', // Brazil
];

/**
 * Get popular countries first, then alphabetical
 */
export const getCountryOptionsWithPopular = (): DropdownOption[] => {
  const allCountries = Country.getAllCountries();
  const popular: DropdownOption[] = [];
  const others: DropdownOption[] = [];
  
  allCountries.forEach(country => {
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
  
  return [
    ...popular,
    { value: '---', label: '─────────────' }, // Separator
    ...others
  ];
};