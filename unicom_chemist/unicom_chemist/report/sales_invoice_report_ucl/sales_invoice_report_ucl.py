# Copyright (c) 2025, Amit Kumar and contributors
# License: MIT. See LICENSE

import frappe
from frappe import _
from frappe.utils import flt, getdate, today


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
			"label": _("Invoice ID"),
			"fieldname": "name",
			"fieldtype": "Link",
			"options": "Sales Invoice",
			"width": 140
		},
		{
			"label": _("Customer"),
			"fieldname": "customer_name",
			"fieldtype": "Data",
			"width": 150
		},
		{
			"label": _("Branch"),
			"fieldname": "branch",
			"fieldtype": "Link",
			"options": "Branch",
			"width": 120
		},
		{
			"label": _("Status"),
			"fieldname": "status",
			"fieldtype": "Data",
			"width": 100
		},
		{
			"label": _("Due Date"),
			"fieldname": "due_date",
			"fieldtype": "Date",
			"width": 100
		},
		{
			"label": _("Grand Total"),
			"fieldname": "grand_total",
			"fieldtype": "Currency",
			"options": "currency",
			"width": 120
		},
		{
			"label": _("Outstanding Amount"),
			"fieldname": "outstanding_amount",
			"fieldtype": "Currency",
			"options": "currency",
			"width": 140
		}
	]


def get_data(filters):
	"""
	Fetch Sales Invoice data with filters
	"""
	company = filters.get("company")
	customer = filters.get("customer")
	from_date = filters.get("from_date")
	to_date = filters.get("to_date")
	status = filters.get("status")
	invoice_id = filters.get("invoice_id")
	branch = filters.get("branch")
	
	conditions = []
	params = []
	
	# Base query
	query = """
		SELECT 
			si.name,
			si.customer,
			si.customer_name,
			si.posting_date,
			si.due_date,
			si.grand_total,
			si.outstanding_amount,
			si.status,
			si.currency,
			si.docstatus,
			si.custom_branch
		FROM `tabSales Invoice` si
		WHERE si.docstatus = 1
		AND si.company = %s
		AND si.is_pos = 0
	"""
	
	params.append(company)
	
	# Apply invoice ID filter
	if invoice_id:
		query += " AND si.name LIKE %s"
		params.append(f"%{invoice_id}%")
	
	# Apply customer filter
	if customer:
		query += " AND si.customer = %s"
		params.append(customer)
	
	# Apply branch filter
	if branch:
		query += " AND si.custom_branch = %s"
		params.append(branch)
	
	# Apply date range filter
	if from_date:
		query += " AND si.posting_date >= %s"
		params.append(from_date)
	
	if to_date:
		query += " AND si.posting_date <= %s"
		params.append(to_date)
	
	# Apply status filter
	if status:
		query += " AND si.status = %s"
		params.append(status)
	
	query += " ORDER BY si.posting_date DESC, si.creation DESC"
	
	invoices = frappe.db.sql(query, params, as_dict=1)
	
	data = []
	
	for invoice in invoices:
		# Determine status based on outstanding amount and due date
		invoice_status = get_invoice_status(invoice)
		
		data_row = {
			"name": invoice.name,
			"customer": invoice.customer,
			"customer_name": invoice.customer_name or invoice.customer,
			"posting_date": invoice.posting_date,
			"due_date": invoice.due_date,
			"grand_total": flt(invoice.grand_total, 2),
			"outstanding_amount": flt(invoice.outstanding_amount, 2),
			"status": invoice_status,
			"currency": invoice.currency,
			"branch": invoice.get("custom_branch") or ""
		}
		
		data.append(data_row)
	
	return data


def get_invoice_status(invoice):
	"""
	Determine invoice status based on outstanding amount and due date
	"""
	outstanding = flt(invoice.outstanding_amount)
	
	if outstanding <= 0:
		return "Paid"
	elif invoice.due_date and getdate(invoice.due_date) < getdate(today()):
		return "Overdue"
	else:
		return "Unpaid"
