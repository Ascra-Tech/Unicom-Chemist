import frappe
from frappe import _
from hrms.payroll.doctype.salary_slip.salary_slip import SalarySlip


class CustomSalarySlip(SalarySlip):
    """Custom Salary Slip with Income Tax override"""
    
    def calculate_variable_based_on_taxable_salary(self, tax_component):
        """Override Income Tax calculation for custom formula"""
        
        # Only override for Income Tax component
        if tax_component == "Income Tax":
            # First call parent method to initialize required attributes
            if not self.payroll_period:
                frappe.msgprint(
                    _("Start and end dates not in a valid Payroll Period, cannot calculate {0}.").format(
                        tax_component
                    )
                )
                return 0
            
            # Initialize the component-based variable tax dictionary if not exists
            if not hasattr(self, '_component_based_variable_tax'):
                self._component_based_variable_tax = {}
            
            if tax_component not in self._component_based_variable_tax:
                self._component_based_variable_tax[tax_component] = {}
            
            # Calculate custom income tax
            custom_tax = self.calculate_custom_income_tax()
            
            # Set required attributes for other methods that depend on them
            self._component_based_variable_tax[tax_component].update({
                "previous_total_paid_taxes": 0,
                "total_structured_tax_amount": custom_tax * 12,  # Annual amount
                "current_structured_tax_amount": custom_tax,     # Monthly amount
                "full_tax_on_additional_earnings": 0,
                "current_tax_amount": custom_tax,
            })
            
            # Set the attributes that compute_income_tax_breakup expects
            # total_structured_tax_amount should be annual amount for future tax calculation
            self.total_structured_tax_amount = custom_tax * 12  # Annual amount
            self.current_structured_tax_amount = custom_tax     # Monthly amount
            self.full_tax_on_additional_earnings = 0
            
            return custom_tax
        
        # For other tax components, use default calculation
        return super().calculate_variable_based_on_taxable_salary(tax_component)
    
    def calculate_custom_income_tax(self):
        """Calculate Income Tax using custom formula"""
        
        # Use gross pay as base (monthly salary)
        base = self.gross_pay
        
        # Custom formula: base - SSF(5.5%) - PF(3%) - Tax Relief(150)
        taxable_in_formula = base - (base * 0.055) - (base * 0.03) - 150
        
        # Apply progressive tax rates based on taxable income
        if taxable_in_formula > 730:
            custom_tax = 0 + (110 * 0.05) + (130 * 0.10) + ((taxable_in_formula - 730) * 0.175)
        elif taxable_in_formula > 600:
            custom_tax = (taxable_in_formula - 600) * 0.10 + 5.5
        elif taxable_in_formula > 490:
            custom_tax = (taxable_in_formula - 490) * 0.05
        else:
            custom_tax = 0
        
        # Log the calculation for debugging
        frappe.logger().info(
            f"Custom Income Tax Calculation: Base={base}, Taxable={taxable_in_formula:.2f}, Tax={custom_tax:.2f}"
        )
        
        return custom_tax
    
    def compute_income_tax_breakup(self):
        """Override to ensure deductions_before_tax_calculation is set correctly"""
        
        # Call parent method first
        super().compute_income_tax_breakup()
        
        # Manually calculate deductions_before_tax_calculation regardless of allow_tax_exemption
        # This should include SSF + Provident Fund IT + Tax Relief IT
        deductions_before_tax = 0
        
        for deduction in self.deductions:
            if deduction.exempted_from_income_tax and deduction.salary_component in ['S.S.F', 'Provident Fund IT', 'Tax Relief IT']:
                deductions_before_tax += deduction.amount
        
        # Set the correct monthly value (don't multiply by 12)
        self.deductions_before_tax_calculation = deductions_before_tax
        
        # Recalculate annual_taxable_amount with correct deductions
        self.annual_taxable_amount = self.total_earnings - (
            self.non_taxable_earnings
            + self.deductions_before_tax_calculation
            + self.tax_exemption_declaration
            + self.standard_tax_exemption_amount
        )
        
        frappe.logger().info(
            f"Custom Deductions Before Tax: Monthly={deductions_before_tax}, Annual={self.deductions_before_tax_calculation}"
        )
