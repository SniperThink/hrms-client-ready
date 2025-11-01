import React from 'react';
import { BarChart3, TrendingDown } from 'lucide-react';

interface NoDataMessageProps {
  message?: string;
  icon?: React.ReactNode;
  className?: string;
}

const NoDataMessage: React.FC<NoDataMessageProps> = ({
  message = "No data available",
  icon,
  className = ""
}) => {
  const defaultIcon = <BarChart3 size={48} className="text-gray-300 mb-3" />;
  
  return (
    <div className={`flex flex-col items-center justify-center h-full text-gray-500 ${className}`}>
      {icon || defaultIcon}
      <p className="text-sm font-medium text-center">{message}</p>
      <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or date range</p>
    </div>
  );
};

export default NoDataMessage;
