import React, { useState } from 'react';
import { Calendar, Calculator } from 'lucide-react';
import SimplePayrollCalculator from './payroll/SimplePayrollCalculator';
import PayrollOverview from './payroll/PayrollOverview';
import AdvanceManager from './payroll/AdvanceManager';

const HRPayrollNew: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'overview'>('calculator');
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);

  return (
    <div className="space-y-6">      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('calculator')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calculator'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Payroll Calculator
              </div>
            </button>
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Payroll Overview
              </div>
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'calculator' && <SimplePayrollCalculator />}
          {activeTab === 'overview' && (
            <PayrollOverview onShowAdvanceModal={() => setShowAdvanceModal(true)} />
          )}
        </div>
      </div>

      {/* Advance Manager Modal */}
      <AdvanceManager 
        showModal={showAdvanceModal}
        onClose={() => setShowAdvanceModal(false)}
      />
    </div>
  );
};

export default HRPayrollNew; 