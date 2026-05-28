/** Shape of the order payload sent to Shiprocket POST /orders/create/adhoc */
export interface ShiprocketOrderPayload {
  order_id:          string;   // our DB order UUID — used as Shiprocket order_id
  order_date:        string;   // ISO date string
  pickup_location:   string;   // pickup address label configured in Shiprocket dashboard
  channel_id?:       string;
  billing_customer_name:  string;
  billing_last_name?:     string;
  billing_address:        string;
  billing_city:           string;
  billing_pincode:        string;
  billing_state:          string;
  billing_country:        string;
  billing_email?:         string;
  billing_phone:          string;
  shipping_is_billing:    boolean;
  order_items: {
    name:      string;
    sku:       string;
    units:     number;
    selling_price: number;  // in rupees (Shiprocket uses rupees, not paise)
  }[];
  payment_method:    'Prepaid';
  sub_total:         number;   // in rupees
  length:            number;   // cm
  breadth:           number;   // cm
  height:            number;   // cm
  weight:            number;   // kg
}

/** Shiprocket response after creating an order */
export interface ShiprocketOrderResponse {
  order_id:          number;
  shipment_id:       number;
  status:            string;
  courier_company_id?: number;
  courier_name?:     string;
  awb_code?:         string;   // tracking number
}

/** Shiprocket tracking response */
export interface ShiprocketTrackingResponse {
  tracking_data?: {
    track_status:      number;
    shipment_status?:  string;
    shipment_track?:   {
      awb_code:        string;
      courier_name:    string;
      current_status:  string;
      delivered_date?: string;
    }[];
  };
}

/**
 * Build the Shiprocket order payload from our order data.
 * Prices are converted from paise to rupees here — the only place this conversion happens.
 */
export function buildShiprocketPayload(params: {
  orderId:        string;
  productName:    string;
  brand:          string;
  paidPricePaise: number;
  deliveryName:   string;
  deliveryPhone:  string;
  deliveryLine1:  string;
  deliveryCity:   string;
  deliveryPincode: string;
  deliveryState:  string;
  pickupLocation: string;
}): ShiprocketOrderPayload {
  const paidPriceRupees = params.paidPricePaise / 100;

  return {
    order_id:          params.orderId,
    order_date:        new Date().toISOString().split('T')[0],
    pickup_location:   params.pickupLocation,
    billing_customer_name: params.deliveryName,
    billing_address:       params.deliveryLine1,
    billing_city:          params.deliveryCity,
    billing_pincode:       params.deliveryPincode,
    billing_state:         params.deliveryState,
    billing_country:       'India',
    billing_phone:         params.deliveryPhone,
    shipping_is_billing:   true,
    order_items: [{
      name:          `${params.brand} ${params.productName}`,
      sku:           params.orderId.slice(0, 8),
      units:         1,
      selling_price: paidPriceRupees,
    }],
    payment_method: 'Prepaid',
    sub_total:      paidPriceRupees,
    // Default dimensions for audio gear — seller can update in Shiprocket dashboard
    length:  20,
    breadth: 15,
    height:  10,
    weight:  0.5,
  };
}
