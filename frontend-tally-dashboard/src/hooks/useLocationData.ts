// Updated location hooks for the new country-state-city package
import { useState, useEffect } from 'react';
import { 
  getCountryOptionsWithPopular, 
  getStateOptions, 
  getCityOptions 
} from '../services/locationServiceNew';
import { DropdownOption } from '../components/Dropdown';
import { logger } from '../utils/logger';

export interface LocationState {
  countryOptions: DropdownOption[];
  stateOptions: DropdownOption[];
  cityOptions: DropdownOption[];
  selectedCountry: string;
  selectedState: string;
  selectedCity: string;
  loading: boolean;
}

export const useLocationData = () => {
  const [locationState, setLocationState] = useState<LocationState>({
    countryOptions: [],
    stateOptions: [],
    cityOptions: [],
    selectedCountry: '',
    selectedState: '',
    selectedCity: '',
    loading: true
  });

  // Load countries on mount
  useEffect(() => {
    try {
      const countries = getCountryOptionsWithPopular();
      setLocationState(prev => ({
        ...prev,
        countryOptions: countries,
        loading: false
      }));
    } catch (error) {
      logger.error('Error loading countries:', error);
      setLocationState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  // Handle country change
  const handleCountryChange = (countryCode: string) => {
    try {
      const states = getStateOptions(countryCode);
      setLocationState(prev => ({
        ...prev,
        selectedCountry: countryCode,
        selectedState: '',
        selectedCity: '',
        stateOptions: states,
        cityOptions: []
      }));
    } catch (error) {
      logger.error('Error loading states:', error);
    }
  };

  // Handle state change
  const handleStateChange = (stateCode: string) => {
    try {
      const cities = getCityOptions(locationState.selectedCountry, stateCode);
      setLocationState(prev => ({
        ...prev,
        selectedState: stateCode,
        selectedCity: '',
        cityOptions: cities
      }));
    } catch (error) {
      logger.error('Error loading cities:', error);
    }
  };

  // Handle city change
  const handleCityChange = (cityName: string) => {
    setLocationState(prev => ({
      ...prev,
      selectedCity: cityName
    }));
  };

  // Reset all location data
  const resetLocationData = () => {
    setLocationState(prev => ({
      ...prev,
      selectedCountry: '',
      selectedState: '',
      selectedCity: '',
      stateOptions: [],
      cityOptions: []
    }));
  };

  return {
    ...locationState,
    handleCountryChange,
    handleStateChange,
    handleCityChange,
    resetLocationData
  };
};