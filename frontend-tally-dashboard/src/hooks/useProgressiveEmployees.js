/*
REACT HOOK FOR PROGRESSIVE LOADING
=================================

This hook makes it easy to use progressive loading in React components.
Automatically handles state management, user changes, and loading indicators.

Usage:
const { employees, loading, loadingProgress, trackChange } = useProgressiveEmployees('2025-07-25');
*/

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/logger';

class ProgressiveEmployeeLoader {
    constructor(baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000') {
        this.baseUrl = baseUrl;
        this.userChanges = new Map();
        this.currentEmployees = [];
        this.isBackgroundLoading = false;
    }

    async loadEmployeesForDate(date, onInitialLoad, onAllLoaded, onProgress = null) {
        logger.info( `🚀 Starting progressive loading for ${date}`);
        
        try {
            logger.info( '📋 Loading initial 50 employees...');
            const initialResponse = await this.fetchWithAuth(`/api/eligible-employees/?date=${date}&initial=true`);
            
            if (!initialResponse.ok) {
                throw new Error(`Initial load failed: ${initialResponse.status}`);
            }
            
            const initialData = await initialResponse.json();
            logger.info( `✅ Loaded ${initialData.total_count} employees in ${initialData.performance.query_time}`);
            
            this.currentEmployees = initialData.eligible_employees;
            
            if (onInitialLoad) {
                onInitialLoad({
                    employees: this.currentEmployees,
                    count: initialData.total_count,
                    isComplete: !initialData.progressive_loading.has_more,
                    metadata: initialData.progressive_loading
                });
            }
            
            if (initialData.progressive_loading.has_more && initialData.progressive_loading.auto_trigger_remaining) {
                const remainingCount = initialData.progressive_loading.remaining_employees;
                logger.info( `🔄 Auto-triggering background load for ${remainingCount} remaining employees...`);
                
                const delay = initialData.progressive_loading.recommended_delay_ms || 100;
                setTimeout(() => {
                    this.loadRemainingEmployees(date, onAllLoaded, onProgress, remainingCount);
                }, delay);
            }
            
        } catch (error) {
            logger.error('❌ Progressive loading failed:', error);
            throw error;
        }
    }

    async loadRemainingEmployees(date, onAllLoaded, onProgress, remainingCount) {
        if (this.isBackgroundLoading) return;
        this.isBackgroundLoading = true;
        
        try {
            logger.info( `⏳ Background loading ${remainingCount} remaining employees...`);
            
            if (onProgress) {
                onProgress({ 
                    message: `Loading ${remainingCount} more employees...`, 
                    isLoading: true 
                });
            }
            
            const remainingResponse = await this.fetchWithAuth(`/api/eligible-employees/?date=${date}&remaining=true`);
            
            if (!remainingResponse.ok) {
                throw new Error(`Background load failed: ${remainingResponse.status}`);
            }
            
            const remainingData = await remainingResponse.json();
            logger.info( `✅ Background loaded ${remainingData.total_count} employees in ${remainingData.performance.query_time}`);
            
            const mergedEmployees = this.mergeEmployeesWithUserChanges(
                this.currentEmployees, 
                remainingData.eligible_employees
            );
            
            this.currentEmployees = mergedEmployees;
            
            if (onAllLoaded) {
                onAllLoaded({
                    employees: this.currentEmployees,
                    count: this.currentEmployees.length,
                    isComplete: true,
                    totalLoadTime: `Initial + ${remainingData.performance.query_time}`,
                    userChangesPreserved: this.userChanges.size
                });
            }
            
            if (onProgress) {
                onProgress({ 
                    message: `All ${this.currentEmployees.length} employees loaded!`, 
                    isLoading: false 
                });
            }
            
        } catch (error) {
            logger.error('❌ Background loading failed:', error);
            if (onProgress) {
                onProgress({ 
                    message: 'Background loading failed', 
                    isLoading: false, 
                    error: error.message 
                });
            }
        } finally {
            this.isBackgroundLoading = false;
        }
    }

    trackUserChange(employeeId, field, oldValue, newValue) {
        if (!this.userChanges.has(employeeId)) {
            this.userChanges.set(employeeId, {});
        }
        
        this.userChanges.get(employeeId)[field] = {
            oldValue,
            newValue,
            timestamp: Date.now()
        };
        
        logger.info( `📝 Tracked change for ${employeeId}.${field}: ${oldValue} → ${newValue}`);
        
        const employee = this.currentEmployees.find(emp => emp.employee_id === employeeId);
        if (employee) {
            employee[field] = newValue;
        }
    }

    mergeEmployeesWithUserChanges(existingEmployees, newEmployees) {
        logger.info( `🔄 Merging ${existingEmployees.length} existing + ${newEmployees.length} new employees`);
        
        const existingMap = new Map();
        existingEmployees.forEach(emp => {
            existingMap.set(emp.employee_id, emp);
        });
        
        const allEmployees = [...existingEmployees];
        
        for (const newEmp of newEmployees) {
            if (!existingMap.has(newEmp.employee_id)) {
                allEmployees.push(newEmp);
            }
        }
        
        let changesApplied = 0;
        for (const [employeeId, changes] of this.userChanges.entries()) {
            const employee = allEmployees.find(emp => emp.employee_id === employeeId);
            if (employee) {
                for (const [field, changeData] of Object.entries(changes)) {
                    employee[field] = changeData.newValue;
                    changesApplied++;
                }
            }
        }
        
        logger.info( `✅ Merged complete: ${allEmployees.length} total employees, ${changesApplied} user changes preserved`);
        return allEmployees;
    }

    async fetchWithAuth(url) {
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        
        return fetch(this.baseUrl + url, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
                'X-Tenant-Subdomain': localStorage.getItem('tenant_subdomain') || 'default'
            }
        });
    }

    getCurrentEmployees() {
        return this.currentEmployees;
    }

    getUserChanges() {
        return Array.from(this.userChanges.entries()).map(([employeeId, changes]) => ({
            employeeId,
            changes
        }));
    }
}

// REACT HOOK
export const useProgressiveEmployees = (date, baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000') => {
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState({ message: '', isLoading: false });
    const [isComplete, setIsComplete] = useState(false);
    const [error, setError] = useState(null);
    
    const loaderRef = useRef(null);
    
    // Initialize loader
    useEffect(() => {
        loaderRef.current = new ProgressiveEmployeeLoader(baseUrl);
    }, [baseUrl]);
    
    // Track user changes
    const trackChange = useCallback((employeeId, field, oldValue, newValue) => {
        if (loaderRef.current) {
            loaderRef.current.trackUserChange(employeeId, field, oldValue, newValue);
            // Update local state immediately
            setEmployees(prev => prev.map(emp => 
                emp.employee_id === employeeId 
                    ? { ...emp, [field]: newValue }
                    : emp
            ));
        }
    }, []);
    
    // Load employees for date
    const loadEmployees = useCallback(async (targetDate) => {
        if (!loaderRef.current || loading) return;
        
        setLoading(true);
        setError(null);
        setIsComplete(false);
        
        try {
            await loaderRef.current.loadEmployeesForDate(
                targetDate,
                // Initial load callback
                (initialData) => {
                    logger.info( `✅ React Hook: Initial load - ${initialData.count} employees`);
                    setEmployees(initialData.employees);
                    setIsComplete(initialData.isComplete);
                    
                    if (!initialData.isComplete) {
                        setLoadingProgress({
                            message: `Loading ${initialData.metadata.remaining_employees} more employees in background...`,
                            isLoading: true
                        });
                    }
                },
                // All loaded callback
                (allData) => {
                    logger.info( `🎉 React Hook: All loaded - ${allData.count} employees`);
                    setEmployees(allData.employees);
                    setIsComplete(true);
                    setLoadingProgress({
                        message: `All ${allData.count} employees loaded! ${allData.userChangesPreserved ? `(${allData.userChangesPreserved} changes preserved)` : ''}`,
                        isLoading: false
                    });
                    
                    // Clear progress message after 3 seconds
                    setTimeout(() => {
                        setLoadingProgress({ message: '', isLoading: false });
                    }, 3000);
                },
                // Progress callback
                (progress) => {
                    setLoadingProgress(progress);
                }
            );
        } catch (err) {
            logger.error('❌ React Hook: Loading failed:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [loading]);
    
    // Auto-load when date changes
    useEffect(() => {
        if (date) {
            loadEmployees(date);
        }
    }, [date, loadEmployees]);
    
    return {
        employees,
        loading,
        loadingProgress,
        isComplete,
        error,
        trackChange,
        reload: () => loadEmployees(date),
        getUserChanges: () => loaderRef.current?.getUserChanges() || []
    };
};

// EXAMPLE COMPONENT USAGE
export const EmployeeAttendanceComponent = ({ date }) => {
    const { 
        employees, 
        loading, 
        loadingProgress, 
        isComplete, 
        error, 
        trackChange 
    } = useProgressiveEmployees(date);

    const handleStatusChange = (employeeId, newStatus) => {
        const employee = employees.find(emp => emp.employee_id === employeeId);
        const oldStatus = employee?.default_status;
        trackChange(employeeId, 'default_status', oldStatus, newStatus);
    };

    const handleOTChange = (employeeId, newOTHours) => {
        const employee = employees.find(emp => emp.employee_id === employeeId);
        const oldOTHours = employee?.ot_hours || 0;
        trackChange(employeeId, 'ot_hours', oldOTHours, parseFloat(newOTHours));
    };

    if (loading && employees.length === 0) {
        return <div>Loading initial employees...</div>;
    }

    if (error) {
        return <div>Error: {error}</div>;
    }

    return (
        <div>
            <div className="header">
                <h2>Employee Attendance - {date}</h2>
                <div className="status">
                    {loading && <span>⏳ Loading...</span>}
                    {loadingProgress.isLoading && <span>{loadingProgress.message}</span>}
                    {isComplete && <span>✅ All {employees.length} employees loaded</span>}
                </div>
            </div>
            
            <div className="employee-list">
                {employees.map(employee => (
                    <div key={employee.employee_id} className="employee-card">
                        <h3>{employee.name}</h3>
                        <p>Department: {employee.department}</p>
                        
                        <div className="attendance-controls">
                            <select 
                                value={employee.default_status}
                                onChange={(e) => handleStatusChange(employee.employee_id, e.target.value)}
                                className="w-full p-3 border border-gray-200 rounded-lg cursor-pointer text-sm flex items-center justify-between transition-colors duration-200 border-gray-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 bg-white text-gray-700 hover:border-gray-300"
                            >
                                <option value="present">Present</option>
                                <option value="absent">Absent</option>
                                <option value="half_day">Half Day</option>
                            </select>
                            
                            <input
                                type="number"
                                placeholder="OT Hours"
                                value={employee.ot_hours || ''}
                                onChange={(e) => handleOTChange(employee.employee_id, e.target.value)}
                                min="0"
                                max="12"
                                step="0.5"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProgressiveEmployeeLoader;
