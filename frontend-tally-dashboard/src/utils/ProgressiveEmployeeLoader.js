import { logger } from './logger';
/*
PROGRESSIVE LOADING - COMPLETE FRONTEND SOLUTION
================================================

This JavaScript class handles:
1. Instant loading of first 50 employees
2. Automatic background loading of remaining employees  
3. User change preservation during lazy loading
4. Seamless data merging without UI disruption

Usage:
const loader = new ProgressiveEmployeeLoader('http://localhost:8000');
loader.loadEmployeesForDate('2025-07-25', onInitialLoad, onAllLoaded);
*/

class ProgressiveEmployeeLoader {
    constructor(baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000') {
        this.baseUrl = baseUrl;
        this.userChanges = new Map(); // Store user modifications
        this.currentEmployees = [];
        this.isBackgroundLoading = false;
    }

    // Main method - call this to start progressive loading
    async loadEmployeesForDate(date, onInitialLoad, onAllLoaded, onProgress = null) {
        logger.info( `🚀 Starting progressive loading for ${date}`);
        
        try {
            // STEP 1: Load first 50 employees instantly
            logger.info( '📋 Loading initial 50 employees...');
            const initialResponse = await this.fetchWithAuth(`/api/eligible-employees/?date=${date}&initial=true`);
            
            if (!initialResponse.ok) {
                throw new Error(`Initial load failed: ${initialResponse.status}`);
            }
            
            const initialData = await initialResponse.json();
            logger.info( `✅ Loaded ${initialData.total_count} employees in ${initialData.performance.query_time}`);
            
            this.currentEmployees = initialData.eligible_employees;
            
            // Call the initial load callback
            if (onInitialLoad) {
                onInitialLoad({
                    employees: this.currentEmployees,
                    count: initialData.total_count,
                    isComplete: !initialData.progressive_loading.has_more,
                    metadata: initialData.progressive_loading
                });
            }
            
            // STEP 2: Auto-trigger background loading if there are more employees
            if (initialData.progressive_loading.has_more && initialData.progressive_loading.auto_trigger_remaining) {
                const remainingCount = initialData.progressive_loading.remaining_employees;
                logger.info( `🔄 Auto-triggering background load for ${remainingCount} remaining employees...`);
                
                // Add a small delay to let the UI render the initial data
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

    // Background loading of remaining employees
    async loadRemainingEmployees(date, onAllLoaded, onProgress, remainingCount) {
        if (this.isBackgroundLoading) {
            logger.info( '⚠️ Background loading already in progress');
            return;
        }

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
            
            // STEP 3: Merge data while preserving user changes
            const mergedEmployees = this.mergeEmployeesWithUserChanges(
                this.currentEmployees, 
                remainingData.eligible_employees
            );
            
            this.currentEmployees = mergedEmployees;
            
            // Call the completion callback
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

    // Track user changes to preserve them during lazy loading
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
        
        // Update current employee data immediately
        const employee = this.currentEmployees.find(emp => emp.employee_id === employeeId);
        if (employee) {
            employee[field] = newValue;
        }
    }

    // Merge new data with existing data while preserving user changes
    mergeEmployeesWithUserChanges(existingEmployees, newEmployees) {
        logger.info( `🔄 Merging ${existingEmployees.length} existing + ${newEmployees.length} new employees`);
        
        // Create a map of existing employees for fast lookup
        const existingMap = new Map();
        existingEmployees.forEach(emp => {
            existingMap.set(emp.employee_id, emp);
        });
        
        // Merge all employees
        const allEmployees = [...existingEmployees];
        
        for (const newEmp of newEmployees) {
            if (!existingMap.has(newEmp.employee_id)) {
                // This is a new employee from the remaining batch
                allEmployees.push(newEmp);
            }
            // If employee already exists, keep the existing one (with user changes)
        }
        
        // Apply user changes to the merged data
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

    // Helper method for authenticated API calls
    async fetchWithAuth(url) {
        const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token');
        
        return fetch(this.baseUrl + url, {
            method: 'GET',
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                'Content-Type': 'application/json',
                'X-Tenant-Subdomain': this.getTenantSubdomain()
            }
        });
    }

    // Get tenant subdomain (customize this based on your auth system)
    getTenantSubdomain() {
        return localStorage.getItem('tenant_subdomain') || 'default';
    }

    // Public method to get current employees
    getCurrentEmployees() {
        return this.currentEmployees;
    }

    // Public method to get user changes
    getUserChanges() {
        return Array.from(this.userChanges.entries()).map(([employeeId, changes]) => ({
            employeeId,
            changes
        }));
    }
}

// USAGE EXAMPLE
// =============

/*
// 1. Initialize the loader
const loader = new ProgressiveEmployeeLoader('http://localhost:8000');

// 2. Start progressive loading
loader.loadEmployeesForDate('2025-07-25',
    // Initial load callback (first 50 employees)
    (initialData) => {
        logger.info( `✅ Initial: ${initialData.count} employees loaded`);
        updateEmployeeList(initialData.employees);
        showMessage(`Loaded ${initialData.count} employees instantly!`);
        
        if (!initialData.isComplete) {
            showMessage(`Loading ${initialData.metadata.remaining_employees} more employees in background...`);
        }
    },
    
    // All loaded callback (after background loading)
    (allData) => {
        logger.info( `🎉 Complete: All ${allData.count} employees loaded`);
        updateEmployeeList(allData.employees);
        showMessage(`All ${allData.count} employees loaded! (${allData.userChangesPreserved} user changes preserved)`);
    },
    
    // Progress callback (optional)
    (progress) => {
        if (progress.isLoading) {
            showLoadingIndicator(progress.message);
        } else {
            hideLoadingIndicator();
            if (progress.error) {
                showError(progress.error);
            }
        }
    }
);

// 3. Track user changes
function onEmployeeStatusChange(employeeId, newStatus) {
    const oldStatus = getCurrentStatus(employeeId);
    loader.trackUserChange(employeeId, 'default_status', oldStatus, newStatus);
}

function onOTHoursChange(employeeId, newOTHours) {
    const oldOTHours = getCurrentOTHours(employeeId);
    loader.trackUserChange(employeeId, 'ot_hours', oldOTHours, newOTHours);
}
*/

// Export for use in modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressiveEmployeeLoader;
}
