// Unicom Chemist POS Page Override
console.log("Unicom Chemist POS override script loading...");

// Apply CSS immediately
if (!document.getElementById('unicom-pos-list-style')) {
    const listStyle = document.createElement('style');
    listStyle.id = 'unicom-pos-list-style';
    listStyle.textContent = `
        .items-container {
            display: flex !important;
            flex-direction: column !important;
            gap: var(--margin-md) !important;
        }
        
        .items-container .item-wrapper {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            padding: var(--margin-sm) var(--margin-md) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: var(--border-radius-md) !important;
            background: var(--bg-color) !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            min-height: 53px !important;
        }
        
        .items-container .item-wrapper:hover {
            border-color: var(--primary-color) !important;
            box-shadow: var(--shadow-sm) !important;
        }
        
        .items-container .item-wrapper .item-display.abbr {
            display: none !important;
        }
        
        .items-container .item-wrapper .item-name {
            flex: 1 !important;
            margin-right: 1rem !important;
            font-size: var(--text-base) !important;
            font-weight: 500 !important;
        }
        
        .items-container .item-wrapper .item-rate {
            margin-right: 1rem !important;
            white-space: nowrap !important;
            font-size: var(--text-sm) !important;
        }
        
        .items-container .item-wrapper .item-qty-pill {
            flex-shrink: 0 !important;
            min-width: 2.5rem !important;
            text-align: right !important;
        }
        
        .items-container .item-wrapper .item-qty-pill .indicator-pill {
            background: transparent !important;
            border: none !important;
            font-weight: 600 !important;
        }
    `;
    document.head.appendChild(listStyle);
}

// Override ItemSelector class
$(document).on('app_ready', function() {
    if (window.erpnext && erpnext.PointOfSale && erpnext.PointOfSale.ItemSelector) {
        const OriginalItemSelector = erpnext.PointOfSale.ItemSelector;
        
        erpnext.PointOfSale.ItemSelector = class extends OriginalItemSelector {
            get_item_html(item) {
                const { serial_no, batch_no, actual_qty, uom, price_list_rate } = item;
                const precision = flt(price_list_rate, 2) % 1 != 0 ? 2 : 0;
                let indicator_color;
                let qty_to_display = actual_qty;

                if (item.is_stock_item) {
                    indicator_color = actual_qty > 10 ? "green" : actual_qty <= 0 ? "red" : "orange";
                    if (Math.round(qty_to_display) > 999) {
                        qty_to_display = Math.round(qty_to_display) / 1000;
                        qty_to_display = qty_to_display.toFixed(1) + "K";
                    }
                } else {
                    indicator_color = "";
                    qty_to_display = "";
                }

                return `<div class="item-wrapper"
                        data-item-code="${escape(item.item_code)}" 
                        data-serial-no="${escape(serial_no)}"
                        data-batch-no="${escape(batch_no)}" 
                        data-uom="${escape(uom)}"
                        data-rate="${escape(price_list_rate || 0)}"
                        data-stock-uom="${escape(item.stock_uom)}"
                        title="${item.item_name}">
                        
                        <div class="item-name">${item.item_name}</div>
                        <div class="item-rate">${format_currency(price_list_rate, item.currency, precision) || 0} / ${uom}</div>
                        <div class="item-qty-pill">
                            <span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
                        </div>
                    </div>`;
            }
        };
        
        console.log("Unicom Chemist POS customizations loaded");
    }
});
