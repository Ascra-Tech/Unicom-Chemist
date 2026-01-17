// Copyright (c) 2025, Amit Kumar and contributors
// License: MIT. See LICENSE

frappe.query_reports["Sales Invoice Report UCL"] = {
    "filters": [
        {
            "fieldname": "company",
            "label": __("Company"),
            "fieldtype": "Link",
            "options": "Company",
            "reqd": 1,
            "default": frappe.defaults.get_user_default("Company")
        },
        {
            "fieldname": "from_date",
            "label": __("From Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.add_months(frappe.datetime.get_today(), -1),
            "reqd": 1
        },
        {
            "fieldname": "to_date",
            "label": __("To Date"),
            "fieldtype": "Date",
            "default": frappe.datetime.get_today(),
            "reqd": 1
        },
        {
            "fieldname": "invoice_id",
            "label": __("Invoice ID"),
            "fieldtype": "Data",
            "width": 100
        },
        {
            "fieldname": "status",
            "label": __("Status"),
            "fieldtype": "Select",
            "options": "\nPaid\nUnpaid\nOverdue"
        },
        {
            "fieldname": "branch",
            "label": __("Branch"),
            "fieldtype": "Link",
            "options": "Branch"
        },
        {
            "fieldname": "customer",
            "label": __("Customer"),
            "fieldtype": "Link",
            "options": "Customer",
            "get_query": function() {
                var company = frappe.query_report.get_filter_value('company');
                return {
                    filters: {
                        "disabled": 0,
                        "company": company || frappe.defaults.get_user_default("Company")
                    }
                };
            }
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);
        
        if (column.fieldname === "status" && data) {
            let color_class = "";
            switch(data.status) {
                case "Paid":
                    color_class = "green";
                    break;
                case "Overdue":
                    color_class = "red";
                    break;
                case "Unpaid":
                    color_class = "orange";
                    break;
                default:
                    color_class = "gray";
            }
            value = `<span style="color: var(--${color_class}-600); font-weight: bold;">${value}</span>`;
        }
        
        if (column.fieldname === "outstanding_amount" && data) {
            if (flt(data.outstanding_amount) > 0) {
                value = `<span style="color: var(--red-600); font-weight: bold;">${value}</span>`;
            } else {
                value = `<span style="color: var(--green-600); font-weight: bold;">${value}</span>`;
            }
        }
        
        return value;
    },
    
    "onload": function(report) {
        report.page.add_menu_item(__("Export"), function() {
            report.print_report();
        });
        
        // Add custom buttons
        report.page.add_inner_button(__("Create Payment Entry"), function() {
            let selected_rows = report.get_checked_items();
            if (selected_rows.length === 0) {
                frappe.msgprint(__("Please select at least one invoice"));
                return;
            }
            
            if (selected_rows.length > 1) {
                frappe.msgprint(__("Please select only one invoice"));
                return;
            }
            
            let invoice = selected_rows[0];
            if (invoice.status === "Paid") {
                frappe.msgprint(__("This invoice is already paid"));
                return;
            }
            
            frappe.new_doc("Payment Entry", {
                "payment_type": "Receive",
                "party_type": "Customer",
                "party": invoice.customer,
                "paid_amount": invoice.outstanding_amount,
                "received_amount": invoice.outstanding_amount
            });
        });
    },
    
    "get_datatable_options": function(options) {
        return Object.assign(options, {
            checkboxColumn: true,
            events: {
                onCheckRow: function(data) {
                    // Handle row selection
                }
            }
        });
    }
};
