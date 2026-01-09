frappe.ui.form.on('Sales Invoice Item', {
    serial_and_batch_bundle: function(frm, cdt, cdn) {
        console.log('=== BATCH EXPIRY FETCH DEBUG START ===');
        console.log('DEBUG: serial_and_batch_bundle field changed');
        var row = locals[cdt][cdn];
        console.log('DEBUG: Current row data:', row);
        console.log('DEBUG: Bundle value:', row.serial_and_batch_bundle);
        console.log('DEBUG: Item code:', row.item_code);
        console.log('DEBUG: Current expiry date:', row.custom_bundle_expiry_date);
        
        if (row.serial_and_batch_bundle) {
            console.log('DEBUG: Calling server method to fetch batch expiry');
            
            // Show a message to user that we're fetching
            frappe.show_alert({
                message: `Fetching batch expiry for ${row.serial_and_batch_bundle}...`,
                indicator: 'blue'
            });
            
            // Call server method to get batch expiry date
            frappe.call({
                method: 'unicom_chemist.unicom_chemist.sales_invoice.get_batch_expiry_from_bundle_api',
                args: {
                    bundle_name: row.serial_and_batch_bundle
                },
                callback: function(r) {
                    console.log('DEBUG: Server response received:', r);
                    console.log('DEBUG: Full response object:', JSON.stringify(r, null, 2));
                    
                    if (r.message) {
                        console.log('DEBUG: Response message exists:', r.message);
                        console.log('DEBUG: Response message details:', JSON.stringify(r.message, null, 2));
                        
                        if (r.message.success) {
                            console.log('*** SUCCESS! ***');
                            console.log('DEBUG: Expiry date received:', r.message.expiry_date);
                            console.log('DEBUG: Expiry date type:', typeof r.message.expiry_date);
                            console.log('DEBUG: Setting field custom_bundle_expiry_date to:', r.message.expiry_date);
                            
                            // Set the batch expiry date in the current row
                            frappe.model.set_value(cdt, cdn, 'custom_bundle_expiry_date', r.message.expiry_date);
                            frm.refresh_field('items');
                            
                            console.log('DEBUG: Field set successfully');
                            console.log('DEBUG: Updated row data:', locals[cdt][cdn]);
                            
                            frappe.show_alert({
                                message: `✅ Batch expiry date set: ${r.message.expiry_date}`,
                                indicator: 'green'
                            });
                            
                            console.log('=== BATCH EXPIRY FETCH SUCCESS ===');
                        } else {
                            console.log('*** ERROR FROM SERVER ***');
                            console.log('DEBUG: Error message:', r.message.error);
                            console.log('DEBUG: Debug info:', r.message.debug);
                            
                            frappe.show_alert({
                                message: `❌ Error: ${r.message.error}`,
                                indicator: 'red'
                            });
                            
                            // Clear the field on error
                            frappe.model.set_value(cdt, cdn, 'custom_bundle_expiry_date', '');
                            frm.refresh_field('items');
                            
                            console.log('=== BATCH EXPIRY FETCH ERROR ===');
                        }
                    } else {
                        console.log('*** NO MESSAGE IN RESPONSE ***');
                        console.log('DEBUG: Response structure issue');
                        frappe.show_alert({
                            message: '❌ No response from server',
                            indicator: 'red'
                        });
                        console.log('=== BATCH EXPIRY FETCH FAILED ===');
                    }
                },
                error: function(r) {
                    console.log('DEBUG: Server call failed:', r);
                    frappe.show_alert({
                        message: 'Failed to fetch batch expiry date',
                        indicator: 'red'
                    });
                }
            });
        } else {
            console.log('DEBUG: Bundle field cleared or empty');
            console.log('DEBUG: Clearing expiry date field');
            // Clear the expiry date if bundle is removed
            frappe.model.set_value(cdt, cdn, 'custom_bundle_expiry_date', '');
            frm.refresh_field('items');
            console.log('=== BATCH EXPIRY FIELD CLEARED ===');
        }
    }
});

// Also add debugging for form load
frappe.ui.form.on('Sales Invoice', {
    onload: function(frm) {
        console.log('DEBUG: Sales Invoice form loaded');
        console.log('DEBUG: Form doc:', frm.doc);
        console.log('DEBUG: Items:', frm.doc.items);
    },
    
    refresh: function(frm) {
        console.log('DEBUG: Sales Invoice form refreshed');
        
        // Add debug buttons
        if (frm.doc.docstatus === 0) {
            frm.add_custom_button(__('Debug Batch Expiry'), function() {
                console.log('DEBUG: Manual test button clicked');
                
                // Test with the first item that has a bundle
                let test_item = null;
                frm.doc.items.forEach(function(item) {
                    if (item.serial_and_batch_bundle && !test_item) {
                        test_item = item;
                    }
                });
                
                if (test_item) {
                    console.log('DEBUG: Testing with item:', test_item);
                    frappe.call({
                        method: 'unicom_chemist.unicom_chemist.sales_invoice.get_batch_expiry_from_bundle_api',
                        args: {
                            bundle_name: test_item.serial_and_batch_bundle
                        },
                        callback: function(r) {
                            console.log('DEBUG: Manual test response:', r);
                            frappe.msgprint({
                                title: 'Debug Results',
                                message: `<pre>${JSON.stringify(r.message, null, 2)}</pre>`
                            });
                        }
                    });
                } else {
                    frappe.msgprint('No items with Serial and Batch Bundle found');
                }
            });
            
            frm.add_custom_button(__('Debug Bundle Structure'), function() {
                // Get bundle name from user
                frappe.prompt([
                    {
                        label: 'Bundle Name',
                        fieldname: 'bundle_name',
                        fieldtype: 'Data',
                        default: frm.doc.items.length > 0 && frm.doc.items[0].serial_and_batch_bundle ? frm.doc.items[0].serial_and_batch_bundle : ''
                    }
                ], function(values) {
                    if (values.bundle_name) {
                        frappe.call({
                            method: 'unicom_chemist.unicom_chemist.sales_invoice.debug_bundle_structure',
                            args: {
                                bundle_name: values.bundle_name
                            },
                            callback: function(r) {
                                console.log('DEBUG: Bundle structure response:', r);
                                frappe.msgprint({
                                    title: 'Bundle Structure Debug',
                                    message: `<pre>${JSON.stringify(r.message, null, 2)}</pre>`
                                });
                            }
                        });
                    }
                }, 'Debug Bundle Structure', 'Inspect');
            });
        }
    }
});
