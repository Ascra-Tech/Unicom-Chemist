import frappe
from frappe import _
from erpnext.accounts.doctype.sales_invoice.sales_invoice import SalesInvoice


class CustomSalesInvoice(SalesInvoice):
    """Custom Sales Invoice class for Unicom Chemist"""
    
    def onload(self):
        super().onload()
        self.fetch_batch_expiry_for_all_items()
    
    def validate(self):
        super().validate()
        self.fetch_batch_expiry_for_all_items()
    
    def fetch_batch_expiry_for_all_items(self):
        """Fetch batch expiry dates for all items with serial_and_batch_bundle"""
        frappe.logger().info(f"DEBUG: fetch_batch_expiry_for_all_items called for Sales Invoice {self.name}")
        
        for idx, item in enumerate(self.items):
            frappe.logger().info(f"DEBUG: Processing item {idx + 1}: {item.item_code}")
            
            if hasattr(item, 'serial_and_batch_bundle') and item.serial_and_batch_bundle:
                frappe.logger().info(f"DEBUG: Item has bundle: {item.serial_and_batch_bundle}")
                
                batch_expiry = self.get_batch_expiry_from_bundle(item.serial_and_batch_bundle)
                frappe.logger().info(f"DEBUG: Retrieved batch expiry: {batch_expiry}")
                
                if batch_expiry and hasattr(item, 'custom_bundle_expiry_date'):
                    item.custom_bundle_expiry_date = batch_expiry
                    frappe.logger().info(f"DEBUG: Set custom_bundle_expiry_date to: {batch_expiry}")
                else:
                    if not batch_expiry:
                        frappe.logger().info("DEBUG: No batch expiry returned")
                    if not hasattr(item, 'custom_bundle_expiry_date'):
                        frappe.logger().info("DEBUG: custom_bundle_expiry_date field not found on item")
            else:
                if not hasattr(item, 'serial_and_batch_bundle'):
                    frappe.logger().info("DEBUG: Item does not have serial_and_batch_bundle field")
                else:
                    frappe.logger().info("DEBUG: Item serial_and_batch_bundle is empty")
    
    def get_batch_expiry_from_bundle(self, bundle_name):
        """Get batch expiry date from Serial and Batch Bundle child table"""
        if not bundle_name:
            return None
        
        try:
            # Get the Serial and Batch Bundle document
            bundle_doc = frappe.get_doc("Serial and Batch Bundle", bundle_name)
            
            # Get custom_batch_expiry from first entry in child table
            if hasattr(bundle_doc, 'entries') and bundle_doc.entries:
                first_entry = bundle_doc.entries[0]
                if hasattr(first_entry, 'custom_batch_expiry') and first_entry.custom_batch_expiry:
                    return first_entry.custom_batch_expiry
            
            return None
            
        except Exception as e:
            frappe.log_error(f"Error fetching batch expiry from bundle {bundle_name}: {str(e)}")
            return None


@frappe.whitelist()
def get_batch_expiry_from_bundle_api(bundle_name):
    """API method to get batch expiry date from Serial and Batch Bundle"""
    print(f"=== BATCH EXPIRY API CALLED ===")
    print(f"DEBUG: get_batch_expiry_from_bundle_api called with bundle_name: {bundle_name}")
    frappe.logger().info(f"DEBUG: get_batch_expiry_from_bundle_api called with bundle_name: {bundle_name}")
    
    if not bundle_name:
        print("DEBUG: bundle_name is empty or None")
        frappe.logger().info("DEBUG: bundle_name is empty or None")
        return {"success": False, "error": "Bundle name is required", "debug": "bundle_name is empty"}
    
    try:
        # Check if bundle exists
        if not frappe.db.exists("Serial and Batch Bundle", bundle_name):
            frappe.logger().info(f"DEBUG: Bundle {bundle_name} does not exist in database")
            return {"success": False, "error": f"Bundle {bundle_name} not found", "debug": "bundle not found"}
        
        bundle_doc = frappe.get_doc("Serial and Batch Bundle", bundle_name)
        print(f"DEBUG: Retrieved bundle document: {bundle_doc.name}")
        frappe.logger().info(f"DEBUG: Retrieved bundle document: {bundle_doc.name}")
        
        # Log all fields in the bundle document for debugging
        all_fields = list(bundle_doc.as_dict().keys())
        print(f"DEBUG: Bundle document fields: {all_fields}")
        frappe.logger().info(f"DEBUG: Bundle document fields: {all_fields}")
        
        # Check if bundle has entries (child table)
        if hasattr(bundle_doc, 'entries') and bundle_doc.entries:
            print(f"DEBUG: Bundle has {len(bundle_doc.entries)} entries")
            frappe.logger().info(f"DEBUG: Bundle has {len(bundle_doc.entries)} entries")
            
            # Get the first entry (all batches have same expiry as per user)
            first_entry = bundle_doc.entries[0]
            print(f"DEBUG: First entry fields: {[attr for attr in dir(first_entry) if not attr.startswith('_')]}")
            
            # Check if custom_batch_expiry field exists in child table
            if hasattr(first_entry, 'custom_batch_expiry'):
                expiry_date = first_entry.custom_batch_expiry
                print(f"DEBUG: custom_batch_expiry field exists in child table, value: {expiry_date}")
                print(f"DEBUG: Expiry date type: {type(expiry_date)}")
                frappe.logger().info(f"DEBUG: custom_batch_expiry field exists in child table, value: {expiry_date}")
                
                if expiry_date:
                    print(f"*** SUCCESS: Returning expiry date from child table: {expiry_date} ***")
                    frappe.logger().info(f"DEBUG: Returning expiry date from child table: {expiry_date}")
                    return {"success": True, "expiry_date": expiry_date, "debug": f"found expiry date in child table: {expiry_date}"}
                else:
                    print("DEBUG: custom_batch_expiry field is empty in child table")
                    frappe.logger().info("DEBUG: custom_batch_expiry field is empty in child table")
                    return {"success": False, "error": "Expiry date field is empty in child table", "debug": "expiry date field empty in child table"}
            else:
                print("DEBUG: custom_batch_expiry field does not exist in child table")
                frappe.logger().info("DEBUG: custom_batch_expiry field does not exist in child table")
                return {"success": False, "error": "custom_batch_expiry field not found in child table", "debug": "field not found in child table"}
        else:
            print("DEBUG: Bundle has no entries in child table")
            frappe.logger().info("DEBUG: Bundle has no entries in child table")
            return {"success": False, "error": "No entries found in Serial and Batch Bundle", "debug": "no entries in child table"}
            
    except Exception as e:
        error_msg = f"Error fetching batch expiry from bundle {bundle_name}: {str(e)}"
        frappe.logger().error(f"DEBUG: Exception occurred: {error_msg}")
        frappe.log_error(error_msg, "Batch Expiry Fetch Error")
        return {"success": False, "error": str(e), "debug": f"exception: {str(e)}"}


@frappe.whitelist()
def test_batch_expiry_fetch(sales_invoice_name):
    """Test method to manually fetch batch expiry for a sales invoice"""
    try:
        doc = frappe.get_doc("Sales Invoice", sales_invoice_name)
        results = []
        
        for item in doc.items:
            result = {
                "item_code": item.item_code,
                "serial_and_batch_bundle": getattr(item, 'serial_and_batch_bundle', None),
                "current_custom_bundle_expiry_date": getattr(item, 'custom_bundle_expiry_date', None),
                "fetched_batch_expiry": None
            }
            
            if hasattr(item, 'serial_and_batch_bundle') and item.serial_and_batch_bundle:
                try:
                    bundle_doc = frappe.get_doc("Serial and Batch Bundle", item.serial_and_batch_bundle)
                    # Check child table entries for custom_batch_expiry
                    if hasattr(bundle_doc, 'entries') and bundle_doc.entries:
                        first_entry = bundle_doc.entries[0]
                        if hasattr(first_entry, 'custom_batch_expiry') and first_entry.custom_batch_expiry:
                            result["fetched_batch_expiry"] = first_entry.custom_batch_expiry
                            # Update the item
                            if hasattr(item, 'custom_bundle_expiry_date'):
                                item.custom_bundle_expiry_date = first_entry.custom_batch_expiry
                                result["updated"] = True
                            else:
                                result["error"] = "custom_bundle_expiry_date field not found on item"
                        else:
                            result["error"] = "custom_batch_expiry field not found or empty in child table"
                    else:
                        result["error"] = "No entries found in Serial and Batch Bundle"
                except Exception as e:
                    result["error"] = str(e)
            
            results.append(result)
        
        # Save the document to persist changes
        doc.save()
        
        return {
            "success": True,
            "results": results,
            "message": f"Processed {len(results)} items"
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }


@frappe.whitelist()
def debug_bundle_structure(bundle_name):
    """Debug method to inspect Serial and Batch Bundle structure"""
    try:
        if not frappe.db.exists("Serial and Batch Bundle", bundle_name):
            return {"error": f"Bundle {bundle_name} not found"}
        
        bundle_doc = frappe.get_doc("Serial and Batch Bundle", bundle_name)
        bundle_dict = bundle_doc.as_dict()
        
        # Get meta information
        meta = frappe.get_meta("Serial and Batch Bundle")
        custom_fields = [field.fieldname for field in meta.fields if field.fieldname.startswith('custom_')]
        
        # Check child table entries
        entries_info = []
        if hasattr(bundle_doc, 'entries') and bundle_doc.entries:
            for i, entry in enumerate(bundle_doc.entries):
                entry_info = {
                    "entry_index": i,
                    "batch_no": getattr(entry, 'batch_no', 'NOT_FOUND'),
                    "custom_batch_expiry": getattr(entry, 'custom_batch_expiry', 'NOT_FOUND'),
                    "batch_expiry_date": getattr(entry, 'batch_expiry_date', 'NOT_FOUND')
                }
                entries_info.append(entry_info)
        
        return {
            "bundle_name": bundle_name,
            "all_fields": list(bundle_dict.keys()),
            "custom_fields": custom_fields,
            "custom_batch_expiry_date_exists": hasattr(bundle_doc, 'custom_batch_expiry_date'),
            "custom_batch_expiry_date_value": getattr(bundle_doc, 'custom_batch_expiry_date', 'FIELD_NOT_FOUND'),
            "entries_count": len(bundle_doc.entries) if hasattr(bundle_doc, 'entries') else 0,
            "entries_info": entries_info,
            "bundle_data": bundle_dict
        }
    except Exception as e:
        return {"error": str(e)}


