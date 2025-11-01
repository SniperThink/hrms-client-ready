/**
 * Example: Using the custom logger in a React component
 */

'use client';

import { useEffect, useState } from 'react';
import { logger } from '../src/utils/logger';

export default function LoggerExample() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    logger.info('Component mounted', { componentName: 'LoggerExample' });

    // Simulate data fetching
    const fetchData = async () => {
      try {
        logger.debug('Fetching data from API...');
        
        const response = await fetch('/api/example');
        
        if (!response.ok) {
          logger.warn('API response not OK', { status: response.status });
          return;
        }

        const result = await response.json();
        setData(result);
        logger.info('Data fetched successfully', { recordCount: result.length });
        
      } catch (error) {
        logger.error('Failed to fetch data', { error });
      }
    };

    fetchData();

    return () => {
      logger.debug('Component unmounting', { componentName: 'LoggerExample' });
    };
  }, []);

  const handleButtonClick = () => {
    logger.info('Button clicked by user');
    // Handle click...
  };

  return (
    <div>
      <h1>Logger Example</h1>
      <button onClick={handleButtonClick}>
        Test Logger
      </button>
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
