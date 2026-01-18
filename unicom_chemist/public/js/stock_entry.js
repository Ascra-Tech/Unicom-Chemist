frappe.ui.form.on('Stock Entry', {
    refresh: function(frm) {
        // Override the Material Request button functionality to remove customer column
        setTimeout(() => {
            // Remove existing Material Request button
            frm.remove_custom_button(__("Material Request"), __("Get Items From"));
            
            // Add new Material Request button without customer field
            if (frm.doc.docstatus === 0) {
                frm.add_custom_button(
                    __("Material Request"),
                    function () {
                        const allowed_request_types = [
                            "Material Transfer",
                            "Material Issue", 
                            "Customer Provided"
                        ];
                        
                        // Create the dialog without customer setter
                        const d = erpnext.utils.map_current_doc({
                            method: "erpnext.stock.doctype.material_request.material_request.make_stock_entry",
                            source_doctype: "Material Request",
                            target: frm,
                            date_field: "schedule_date",
                            setters: [
                                {
                                    fieldtype: "Select",
                                    label: __("Purpose"),
                                    options: allowed_request_types.join("\n"),
                                    fieldname: "material_request_type",
                                    default: "Material Transfer",
                                    mandatory: 1
                                }
                                // Customer field removed - no customer column will appear in dialog
                            ],
                            get_query_filters: {
                                docstatus: 1,
                                material_request_type: ["in", allowed_request_types],
                                status: ["not in", ["Transferred", "Issued", "Cancelled", "Stopped"]],
                            },
                        });
                    },
                    __("Get Items From")
                );
            }
        }, 100);
    }
});
