// Copyright (c) 2025, Amit Kumar and contributors
// License: MIT. See LICENSE

frappe.query_reports["Batch Expiry Status"] = {
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
            "fieldname": "warehouse",
            "label": __("Warehouse"),
            "fieldtype": "Link",
            "options": "Warehouse",
            "get_query": function() {
                var company = frappe.query_report.get_filter_value('company');
                return {
                    filters: {
                        "disabled": 0,
                        "company": company || frappe.defaults.get_user_default("Company")
                    }
                };
            }
        },
        {
            "fieldname": "item_code",
            "label": __("Item Code"),
            "fieldtype": "Link",
            "options": "Item",
            "get_query": function() {
                return {
                    filters: {
                        "has_batch_no": 1,
                        "is_stock_item": 1
                    }
                };
            }
        },
        {
            "fieldname": "status",
            "label": __("Status"),
            "fieldtype": "Select",
            "options": "\nExpired\nUse Immediately\nNear Expiry\nHealthy\nNo Expiry Date"
        }
    ],
    
    "formatter": function(value, row, column, data, default_formatter) {
        value = default_formatter(value, row, column, data);
        
        if (column.fieldname === "status" && data) {
            let color_class = "";
            switch(data.status) {
                case "Expired":
                    color_class = "red";
                    break;
                case "Use Immediately":
                    color_class = "orange";
                    break;
                case "Near Expiry":
                    color_class = "yellow";
                    break;
                case "Healthy":
                    color_class = "green";
                    break;
                default:
                    color_class = "gray";
            }
            value = `<span style="color: var(--${color_class}-600); font-weight: bold;">${value}</span>`;
        }
        
        if (column.fieldname === "days_remaining" && data && data.days_remaining !== null) {
            if (data.days_remaining < 0) {
                value = `<span style="color: var(--red-600); font-weight: bold;">${Math.abs(data.days_remaining)} days ago</span>`;
            } else if (data.days_remaining <= 30) {
                value = `<span style="color: var(--orange-600); font-weight: bold;">${value}</span>`;
            }
        }
        
        return value;
    },
    
    "onload": function(report) {
        report.page.add_menu_item(__("Export"), function() {
            report.print_report();
        });
    }
};
