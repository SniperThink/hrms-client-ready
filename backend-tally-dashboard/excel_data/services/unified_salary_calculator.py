"""
Unified Salary Calculator Service

This service provides a centralized, standardized approach to salary calculations
across the entire HRMS system, ensuring consistency and maintainability.

Formula: Gross Salary = (Base Salary ÷ Working Days × Present Days) + OT Charges - Late Deduction
"""

from decimal import Decimal
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

class UnifiedSalaryCalculator:
    """
    Centralized salary calculation service that ensures consistency
    across all payroll calculation methods in the system.
    """
    
    @staticmethod
    def calculate_gross_salary(
        base_salary: Decimal,
        working_days: int,
        present_days: Decimal,
        ot_hours: Decimal,
        ot_rate_per_hour: Decimal,
        late_minutes: int,
        incentive: Decimal = Decimal('0')
    ) -> Dict[str, Decimal]:
        """
        Calculate gross salary using the standardized formula:
        Gross Salary = (Base Salary ÷ Working Days × Present Days) + OT Charges - Late Deduction
        
        Args:
            base_salary: Employee's basic salary
            working_days: Total working days in the period
            present_days: Number of days employee was present
            ot_hours: Overtime hours worked
            ot_rate_per_hour: Overtime rate per hour
            late_minutes: Total late minutes
            incentive: Additional incentive amount (not included in gross salary)
            
        Returns:
            Dict containing all calculated salary components
        """
        
        # 1. Calculate salary for present days
        if working_days > 0:
            daily_rate = base_salary / Decimal(str(working_days))
            salary_for_present_days = daily_rate * present_days
        else:
            salary_for_present_days = Decimal('0')
        
        # 2. Calculate overtime charges
        ot_charges = ot_hours * ot_rate_per_hour
        
        # 3. Calculate late deduction using standardized approach
        late_deduction_per_minute = ot_rate_per_hour / Decimal('60') if ot_rate_per_hour > 0 else Decimal('0')
        late_deduction = late_deduction_per_minute * Decimal(str(late_minutes))
        
        # 4. Apply standardized gross salary formula
        gross_salary = salary_for_present_days + ot_charges - late_deduction
        
        # 5. Calculate TDS on gross salary + incentive
        taxable_amount = gross_salary + incentive
        
        return {
            'salary_for_present_days': salary_for_present_days,
            'ot_charges': ot_charges,
            'late_deduction': late_deduction,
            'gross_salary': gross_salary,
            'incentive': incentive,
            'taxable_amount': taxable_amount,
            'daily_rate': daily_rate if working_days > 0 else Decimal('0'),
            'late_deduction_per_minute': late_deduction_per_minute
        }
    
    @staticmethod
    def calculate_tds(
        gross_salary: Decimal,
        incentive: Decimal,
        tds_percentage: Decimal
    ) -> Dict[str, Decimal]:
        """
        Calculate TDS (Tax Deducted at Source) on gross salary + incentive
        
        Args:
            gross_salary: Calculated gross salary
            incentive: Incentive amount
            tds_percentage: TDS percentage (e.g., 5.0 for 5%)
            
        Returns:
            Dict containing TDS calculations
        """
        taxable_amount = gross_salary + incentive
        tds_rate = tds_percentage / Decimal('100')
        tds_amount = taxable_amount * tds_rate
        salary_after_tds = taxable_amount - tds_amount
        
        return {
            'taxable_amount': taxable_amount,
            'tds_amount': tds_amount,
            'salary_after_tds': salary_after_tds,
            'tds_percentage': tds_percentage
        }
    
    @staticmethod
    def calculate_advance_deduction(
        salary_after_tds: Decimal,
        total_advance_balance: Decimal,
        max_deduction_percentage: Decimal = Decimal('50')
    ) -> Dict[str, Decimal]:
        """
        Calculate advance deduction with smart logic to prevent negative net salary
        
        Args:
            salary_after_tds: Salary after TDS deduction
            total_advance_balance: Total outstanding advance balance
            max_deduction_percentage: Maximum percentage of salary that can be deducted (default 50%)
            
        Returns:
            Dict containing advance deduction calculations
        """
        # Calculate maximum deductible amount (percentage of salary after TDS)
        max_deduction = salary_after_tds * (max_deduction_percentage / Decimal('100'))
        
        # Determine actual advance deduction
        if total_advance_balance > 0:
            # Deduct as much as possible without making net salary negative
            actual_advance_deduction = min(total_advance_balance, max_deduction, salary_after_tds)
        else:
            actual_advance_deduction = Decimal('0')
        
        # Calculate final net salary and remaining advance balance
        net_salary = salary_after_tds - actual_advance_deduction
        remaining_advance_balance = total_advance_balance - actual_advance_deduction
        
        # Ensure net salary is never negative (safety check)
        if net_salary < 0:
            actual_advance_deduction = salary_after_tds
            net_salary = Decimal('0')
            remaining_advance_balance = total_advance_balance - actual_advance_deduction
        
        return {
            'advance_deduction': actual_advance_deduction,
            'net_salary': net_salary,
            'remaining_advance_balance': remaining_advance_balance,
            'max_deduction': max_deduction
        }
    
    @staticmethod
    def calculate_complete_salary(
        base_salary: Decimal,
        working_days: int,
        present_days: Decimal,
        ot_hours: Decimal,
        ot_rate_per_hour: Decimal,
        late_minutes: int,
        incentive: Decimal = Decimal('0'),
        tds_percentage: Decimal = Decimal('5.0'),
        total_advance_balance: Decimal = Decimal('0'),
        max_advance_deduction_percentage: Decimal = Decimal('50')
    ) -> Dict[str, Any]:
        """
        Calculate complete salary breakdown using standardized formulas
        
        Returns:
            Complete salary calculation with all components
        """
        
        # Calculate gross salary components
        gross_calc = UnifiedSalaryCalculator.calculate_gross_salary(
            base_salary=base_salary,
            working_days=working_days,
            present_days=present_days,
            ot_hours=ot_hours,
            ot_rate_per_hour=ot_rate_per_hour,
            late_minutes=late_minutes,
            incentive=incentive
        )
        
        # Calculate TDS
        tds_calc = UnifiedSalaryCalculator.calculate_tds(
            gross_salary=gross_calc['gross_salary'],
            incentive=incentive,
            tds_percentage=tds_percentage
        )
        
        # Calculate advance deduction
        advance_calc = UnifiedSalaryCalculator.calculate_advance_deduction(
            salary_after_tds=tds_calc['salary_after_tds'],
            total_advance_balance=total_advance_balance,
            max_deduction_percentage=max_advance_deduction_percentage
        )
        
        # Combine all calculations
        return {
            **gross_calc,
            **tds_calc,
            **advance_calc,
            'base_salary': base_salary,
            'working_days': working_days,
            'present_days': present_days,
            'ot_hours': ot_hours,
            'late_minutes': late_minutes
        }
    
    @staticmethod
    def validate_calculation_inputs(
        base_salary: Decimal,
        working_days: int,
        present_days: Decimal,
        ot_hours: Decimal,
        late_minutes: int
    ) -> bool:
        """
        Validate inputs for salary calculation
        
        Returns:
            True if inputs are valid, False otherwise
        """
        
        # Check for negative values
        if base_salary < 0:
            logger.warning(f"Negative base salary: {base_salary}")
            return False
        
        if working_days < 0:
            logger.warning(f"Negative working days: {working_days}")
            return False
        
        if present_days < 0:
            logger.warning(f"Negative present days: {present_days}")
            return False
        
        if ot_hours < 0:
            logger.warning(f"Negative OT hours: {ot_hours}")
            return False
        
        if late_minutes < 0:
            logger.warning(f"Negative late minutes: {late_minutes}")
            return False
        
        # Check for reasonable limits
        if present_days > working_days and working_days > 0:
            logger.warning(f"Present days ({present_days}) > working days ({working_days})")
            return False
        
        return True
