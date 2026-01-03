// Unicom Chemist POS Page Override
// This overrides the entire POS page loading using ERPNext standard approach

console.log("Unicom Chemist POS override script loading...");

// Check if style already exists to prevent redeclaration
if (!document.getElementById('unicom-pos-list-style')) {
    const listStyle = document.createElement('style');
    listStyle.id = 'unicom-pos-list-style';
    listStyle.textContent = `
        .items-container {
            display: flex !important;
            flex-direction: column !important;
            gap: var(--margin-md) !important;
        }
        
        .item-wrapper {
            display: flex !important;
            align-items: center !important;
            padding: var(--margin-sm) !important;
            border: 1px solid var(--border-color) !important;
            border-radius: var(--border-radius-md) !important;
            background: var(--bg-color) !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            min-height: 53px !important;
        }
        
        .item-wrapper:hover {
            border-color: var(--primary-color) !important;
            box-shadow: var(--shadow-sm) !important;
        }
        
        .item-display.abbr {
            min-width: 2.5rem !important;
            height: 2.5rem !important;
            font-size: var(--text-base) !important;
            font-weight: 600 !important;
            background: var(--primary) !important;
            color: var(--primary-color) !important;
            border: 1px solid var(--primary-color) !important;
            flex-shrink: 0 !important;
        }
        
        .item-detail {
            flex: 1 !important;
            margin-left: var(--margin-md) !important;
        }
        
        .item-name {
            font-size: var(--text-base) !important;
            font-weight: 500 !important;
            color: var(--text-color) !important;
            line-height: 1.3 !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
        }
        
        .item-rate {
            font-size: var(--text-sm) !important;
            font-weight: 600 !important;
            color: var(--text-muted) !important;
            margin-top: var(--margin-xs) !important;
        }
        
        .item-qty-pill {
            margin-right: var(--margin-md) !important;
            flex-shrink: 0 !important;
        }
        
        .indicator-pill {
            background: transparent !important;
            border: none !important;
            color: var(--text-color) !important;
            font-weight: 600 !important;
        }
        
        .item-display.abbr {
            display: none !important;
        }
    `;
    document.head.appendChild(listStyle);
}

// Wait for frappe.pages to be available, then override POS page
function setup_pos_override() {
    if (typeof frappe !== 'undefined' && frappe.pages && frappe.pages['point-of-sale']) {
        // Store the original on_page_load function
        const original_on_page_load = frappe.pages['point-of-sale'].on_page_load;
        
        // Override the on_page_load function
        frappe.pages['point-of-sale'].on_page_load = function(wrapper) {
            console.log("Unicom Chemist POS page loading with custom override...");
            
            // Call the original function first
            if (original_on_page_load) {
                original_on_page_load.call(this, wrapper);
            }
            
            // Apply our customizations after POS initializes
            setTimeout(function() {
                if (wrapper.pos) {
                    apply_unicom_pos_customizations(wrapper.pos);
                } else {
                    console.error("POS instance not found in wrapper");
                }
            }, 2000);
        };
        
        console.log("Unicom Chemist POS override setup complete");
    } else {
        // If not ready, wait and try again
        setTimeout(setup_pos_override, 100);
    }
}

// Start the setup process
setup_pos_override();

function apply_unicom_pos_customizations(pos_instance) {
    if (!pos_instance || !pos_instance.item_selector) {
        console.error("POS instance or item_selector not available");
        return;
    }

    console.log("Applying Unicom Chemist POS customizations...");

    const item_selector = pos_instance.item_selector;
    
    // Override get_item_html to use list layout with ERPNext standard classes
    item_selector.get_item_html = function(item) {
        const { item_image, serial_no, batch_no, barcode, actual_qty, uom, price_list_rate } = item;
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

        // Custom list layout using ERPNext standard classes - KEEP STOCK VALUES, REMOVE ABBREVIATION
        function get_item_image_html() {
            return `<div class="item-qty-pill">
                        <span class="indicator-pill whitespace-nowrap ${indicator_color}">${qty_to_display}</span>
                    </div>`;
        }

        return `<div class="item-wrapper"
                data-item-code="${escape(item.item_code)}" data-serial-no="${escape(serial_no)}"
                data-batch-no="${escape(batch_no)}" data-uom="${escape(uom)}"
                data-rate="${escape(price_list_rate || 0)}"
                data-stock-uom="${escape(item.stock_uom)}"
                title="${item.item_name}">

                ${get_item_image_html()}

                <div class="item-detail">
                    <div class="item-name">
                        ${item.item_name}
                    </div>
                    <div class="item-rate">${format_currency(price_list_rate, item.currency, precision) || 0} / ${uom}</div>
                </div>
            </div>`;
    };

    // Override render_item_list to use list layout
    const original_render_item_list = item_selector.render_item_list;
    item_selector.render_item_list = function(items) {
        console.log("Custom render_item_list called with", items ? items.length : 0, "items");
        
        this.$items_container.html("");

        items.forEach((item) => {
            const item_html = this.get_item_html(item);
            this.$items_container.append(item_html);
        });
    };

    // Re-bind events to use ERPNext standard click handler
    item_selector.bind_events = function() {
        const me = this;
        
        // Use the exact same click handler as ERPNext
        this.$component.on("click", ".item-wrapper", function () {
            const $item = $(this);
            const item_code = unescape($item.attr("data-item-code"));
            let batch_no = unescape($item.attr("data-batch-no"));
            let serial_no = unescape($item.attr("data-serial-no"));
            let uom = unescape($item.attr("data-uom"));
            let rate = unescape($item.attr("data-rate"));
            let stock_uom = unescape($item.attr("data-stock-uom"));

            // escape(undefined) returns "undefined" then unescape returns "undefined"
            batch_no = batch_no === "undefined" ? undefined : batch_no;
            serial_no = serial_no === "undefined" ? undefined : serial_no;
            uom = uom === "undefined" ? undefined : uom;
            rate = rate === "undefined" ? undefined : rate;
            stock_uom = stock_uom === "undefined" ? undefined : stock_uom;

            me.events.item_selected({
                field: "qty",
                value: "+1",
                item: { item_code, batch_no, serial_no, uom, rate, stock_uom },
            });
            me.search_field.set_focus();
        });

        // Keep other event bindings
        this.search_field.$input.on("input", (e) => {
            clearTimeout(this.last_search);
            this.last_search = setTimeout(() => {
                const search_term = e.target.value;
                this.filter_items({ search_term });
            }, 300);
        });
    };

    // Override cart checkout button behavior
    if (pos_instance.cart) {
        pos_instance.cart.highlight_checkout_btn = function(toggle) {
            const $checkout_btn = this.$cart_container.find(".checkout-btn");
            
            if (toggle) {
                this.$add_discount_elem.css("display", "flex");
                $checkout_btn.css({
                    "background-color": "var(--blue-500)",
                    "pointer-events": "auto",
                    "opacity": "1",
                    "cursor": "pointer",
                    "transition": "all 0.3s ease"
                });
                $checkout_btn.removeAttr("disabled");
                $checkout_btn.removeClass("disabled");
            } else {
                this.$add_discount_elem.css("display", "none");
                $checkout_btn.css({
                    "background-color": "var(--blue-200)",
                    "pointer-events": "none",
                    "opacity": "0.6",
                    "cursor": "not-allowed",
                    "transition": "all 0.3s ease"
                });
                $checkout_btn.attr("disabled", "disabled");
                $checkout_btn.addClass("disabled");
            }
        };

        // Override checkout button click handler
        pos_instance.cart.$component.off("click", ".checkout-btn").on("click", ".checkout-btn", async (e) => {
            const $btn = $(e.currentTarget);
            
            if ($btn.attr("disabled") === "disabled" || $btn.hasClass("disabled")) {
                frappe.show_alert({
                    message: __("Please add items to cart before checkout"),
                    indicator: "orange"
                });
                frappe.utils.play_sound("error");
                return;
            }

            await pos_instance.cart.events.checkout();
            pos_instance.cart.toggle_checkout_btn(false);
            pos_instance.cart.disable_customer_selection();

            pos_instance.cart.allow_discount_change && pos_instance.cart.$add_discount_elem.removeClass("d-none");
        });
    }

    // Force refresh items if data is already loaded
    if (item_selector.items && item_selector.items.length > 0) {
        console.log("Refreshing existing items display");
        item_selector.render_item_list(item_selector.items);
    }

    console.log("Unicom Chemist POS customizations applied successfully!");
}
