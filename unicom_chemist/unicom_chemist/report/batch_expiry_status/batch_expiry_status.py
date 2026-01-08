# Copyright (c) 2025, Amit Kumar and contributors
# License: MIT. See LICENSE

import frappe
from frappe import _
from datetime import datetime


def execute(filters=None):
	if not filters:
		filters = {}
	
	validate_filters(filters)
	columns = get_columns()
	data = get_data(filters)
	
	return columns, data


def validate_filters(filters):
	if not filters.get("company"):
		frappe.throw(_("Company is required"))


def get_columns():
	return [
		{
			"label": _("Item Code"),
			"fieldname": "item_code",
			"fieldtype": "Link",
			"options": "Item",
			"width": 100
		},
		{
			"label": _("Item Name"),
			"fieldname": "item_name",
			"fieldtype": "Data",
			"width": 150
		},
		{
			"label": _("UOM"),
			"fieldname": "uom",
			"fieldtype": "Link",
			"options": "UOM",
			"width": 80
		},
		{
			"label": _("Batch ID"),
			"fieldname": "batch_id",
			"fieldtype": "Link",
			"options": "Batch",
			"width": 120
		},
		{
			"label": _("Warehouse"),
			"fieldname": "warehouse",
			"fieldtype": "Link",
			"options": "Warehouse",
			"width": 120
		},
		{
			"label": _("Manufacturing Date"),
			"fieldname": "manufacturing_date",
			"fieldtype": "Date",
			"width": 120
		},
		{
			"label": _("Expiry Date"),
			"fieldname": "expiry_date",
			"fieldtype": "Date",
			"width": 120
		},
		{
			"label": _("Days Remaining"),
			"fieldname": "days_remaining",
			"fieldtype": "Int",
			"width": 100
		},
		{
			"label": _("Batch Qty"),
			"fieldname": "batch_qty",
			"fieldtype": "Float",
			"width": 100
		},
		{
			"label": _("Status"),
			"fieldname": "status",
			"fieldtype": "Data",
			"width": 120
		}
	]


def get_data(filters):
	"""
	Fetch batch data with hybrid approach:
	1. Try Stock Ledger Entry for accurate warehouse tracking
	2. Fallback to Batch.batch_qty for manually created batches
	"""
	item_code = filters.get("item_code")
	company = filters.get("company")
	warehouse = filters.get("warehouse")
	status_filter = filters.get("status")
	
	
	# First, try to get data from Stock Ledger Entry (accurate warehouse tracking)
	query = """
		SELECT 
			sle.batch_no,
			sle.item_code,
			sle.warehouse,
			b.manufacturing_date,
			b.expiry_date,
			SUM(sle.actual_qty) as batch_qty
		FROM `tabStock Ledger Entry` sle
		INNER JOIN `tabBatch` b ON sle.batch_no = b.name
		INNER JOIN `tabItem` i ON sle.item_code = i.name
		WHERE sle.is_cancelled = 0
		AND sle.docstatus < 2
		AND i.has_batch_no = 1
		AND i.is_stock_item = 1
		AND b.disabled = 0
		AND sle.company = %s
	"""
	
	params = [company]
	
	# Apply item code filter
	if item_code:
		query += " AND sle.item_code = %s"
		params.append(item_code)
	
	# Apply warehouse filter
	if warehouse:
		query += " AND sle.warehouse = %s"
		params.append(warehouse)
	
	query += """
		GROUP BY sle.batch_no, sle.item_code, sle.warehouse
		HAVING SUM(sle.actual_qty) > 0
		ORDER BY b.expiry_date ASC
	"""
	
	batch_data = frappe.db.sql(query, params, as_dict=1)
	
	# If no SLE data, fallback to Batch doctype
	if not batch_data:
		
		batch_filters = {
			"disabled": 0,
			"batch_qty": [">", 0]
		}
		
		if item_code:
			batch_filters["item"] = item_code
		
		batches = frappe.db.get_list(
			"Batch",
			fields=["name as batch_no", "item as item_code", "batch_qty", "manufacturing_date", "expiry_date"],
			filters=batch_filters,
			order_by="expiry_date asc"
		)
		
		# Get default warehouse from Item Defaults for each batch
		batch_data = []
		for batch in batches:
			# Get default warehouse for this item and company from Item Defaults child table
			default_warehouse = frappe.db.get_value(
				"Item Default",
				{"parent": batch.item_code, "company": company},
				"default_warehouse"
			)
			
			batch["warehouse"] = default_warehouse or ""
			
			# Apply warehouse filter in fallback scenario
			if warehouse and batch["warehouse"] != warehouse:
				continue
				
			batch_data.append(batch)
	
	data = []
	today = datetime.now().date()
	
	for row in batch_data:
		try:
			# Get item details
			item_doc = frappe.get_cached_doc("Item", row.item_code)
		except frappe.DoesNotExistError:
			continue
		
		# Calculate expiry status
		expiry_date = row.expiry_date
		if expiry_date:
			days_remaining = (expiry_date - today).days
		else:
			days_remaining = None
		
		# Determine status
		if not expiry_date:
			status = "No Expiry Date"
		elif days_remaining < 0:
			status = "Expired"
		elif days_remaining <= 30:
			status = "Use Immediately"
		elif days_remaining <= 90:
			status = "Near Expiry"
		else:
			status = "Healthy"
		
		# Apply status filter if specified
		if status_filter and status != status_filter:
			continue
		
		# Add row to data
		data_row = {
			"batch_id": row.batch_no,
			"item_code": row.item_code,
			"item_name": item_doc.item_name,
			"warehouse": row.get("warehouse") or "Not Specified",
			"manufacturing_date": row.manufacturing_date,
			"expiry_date": expiry_date,
			"days_remaining": days_remaining,
			"batch_qty": row.batch_qty,
			"uom": item_doc.stock_uom,
			"status": status,
		}
		
		data.append(data_row)
	
	return data
