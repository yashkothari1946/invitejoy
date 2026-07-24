const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

let catalog = [];
let selectedServices = new Set();
let websiteExtraPages = 0;
let currentGrandTotal = 0;

const servicesContainer = document.getElementById("servicesContainer");
const addonsTotalEl = document.getElementById("addonsTotal");
const subtotalEl = document.getElementById("subtotal");
const discountEl = document.getElementById("discount");
const gstEl = document.getElementById("gst");
const grandTotalEl = document.getElementById("grandTotal");
const selectedCountEl = document.getElementById("selectedCount");
const deliveryTimeEl = document.getElementById("deliveryTime");
const websitePagesGroup = document.getElementById("websitePagesGroup");
const websitePagesInput = document.getElementById("websitePages");

// Check if URL has ?add=item_id to pre-select something from gallery
const urlParams = new URLSearchParams(window.location.search);
const addParam = urlParams.get('add');
if(addParam) {
  selectedServices.add(addParam);
}

async function loadCatalog() {
  const res = await fetch(`${API_BASE}/data`);
  if (res.ok) {
    const data = await res.json();
    catalog = data.categories;
    renderCatalog();
    updateQuote();
  }
}

function renderCatalog() {
  servicesContainer.innerHTML = "";

  catalog.forEach((group) => {
    const section = document.createElement("section");
    section.className = "service-group";

    const heading = document.createElement("h4");
    heading.textContent = group.name;

    const items = document.createElement("div");
    items.className = "service-items";

    group.items.forEach((item) => {
      const option = document.createElement("div");
      option.className = "service-option";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = item.id;
      checkbox.checked = selectedServices.has(item.id);

      const label = document.createElement("label");
      label.htmlFor = item.id;

      const title = document.createElement("strong");
      title.textContent = item.name;

      const price = document.createElement("span");
      price.textContent = currency.format(item.price);

      label.append(title, price);
      option.append(checkbox, label);
      items.appendChild(option);

      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selectedServices.add(item.id);
        } else {
          selectedServices.delete(item.id);
        }
        updateQuote();
      });
    });

    section.append(heading, items);
    servicesContainer.appendChild(section);
  });
}

function updateQuote() {
  let subtotal = 0;
  let totalGraphics = 0;
  let totalVideos = 0;
  let hasWebsite = false;

  catalog.forEach((group) => {
    group.items.forEach((item) => {
      if (selectedServices.has(item.id)) {
        subtotal += item.price;
        
        if (item.type === 'graphic') totalGraphics++;
        if (item.type === 'video') totalVideos++;
        if (item.type === 'website') hasWebsite = true;
      }
    });
  });

  // Website extra pages logic
  if (hasWebsite) {
    websitePagesGroup.style.display = 'block';
    websiteExtraPages = parseInt(websitePagesInput.value) || 0;
    subtotal += (websiteExtraPages * 2000);
  } else {
    websitePagesGroup.style.display = 'none';
    websiteExtraPages = 0;
  }

  // Delivery Time Math
  // Graphics: Max 5 per day (ceil(graphics / 5))
  // Videos: 3 days for 1
  // Website: Minimum 5 days
  let graphicDays = Math.ceil(totalGraphics / 5);
  let videoDays = totalVideos * 3;
  let websiteDays = hasWebsite ? 5 : 0;
  
  let totalDays = graphicDays + videoDays + websiteDays;
  if(totalDays === 0) totalDays = 0;

  let discountAmt = 0;
  if (subtotal >= 100000) discountAmt = subtotal * 0.12;
  else if (subtotal >= 50000) discountAmt = subtotal * 0.10;
  else if (subtotal >= 25000) discountAmt = subtotal * 0.05;

  let afterDiscount = subtotal - discountAmt;
  let gstAmt = afterDiscount * 0.18;
  currentGrandTotal = afterDiscount + gstAmt;

  addonsTotalEl.textContent = currency.format(subtotal);
  subtotalEl.textContent = currency.format(subtotal);
  discountEl.textContent = "-" + currency.format(discountAmt);
  gstEl.textContent = currency.format(gstAmt);
  grandTotalEl.textContent = currency.format(currentGrandTotal);
  selectedCountEl.textContent = selectedServices.size + " items";
  
  deliveryTimeEl.textContent = totalDays > 0 ? `${totalDays} Days (Estimated)` : "-";
}

document.getElementById("resetQuote").addEventListener("click", () => {
  selectedServices.clear();
  websitePagesInput.value = 0;
  renderCatalog();
  updateQuote();
});

websitePagesInput.addEventListener("input", updateQuote);

const payNowBtn = document.getElementById("payNowBtn");
if (payNowBtn) {
  payNowBtn.addEventListener("click", async () => {
    if (currentGrandTotal <= 0) {
      alert("Please select at least one service before proceeding to payment.");
      return;
    }

    const name = document.getElementById("custName")?.value.trim();
    const email = document.getElementById("custEmail")?.value.trim();
    const phone = document.getElementById("custPhone")?.value.trim();
    const eventDate = document.getElementById("custEventDate")?.value;

    if (!name || !email || !phone) {
      alert("Please fill in your Name, Email, and Phone Number before ordering.");
      return;
    }

    // Collect selected items list
    const itemsList = [];
    catalog.forEach(group => {
      group.items.forEach(item => {
        if (selectedServices.has(item.id)) {
          itemsList.push({ name: item.name, price: item.price, type: item.type });
        }
      });
    });

    if (websiteExtraPages > 0) {
      itemsList.push({ name: `Additional Website Pages (${websiteExtraPages})`, price: websiteExtraPages * 2000, type: "website_extra" });
    }

    payNowBtn.disabled = true;
    payNowBtn.textContent = "Processing Order...";

    try {
      const res = await fetch(`${API_BASE}/create-order`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: currentGrandTotal })
      });

      const orderData = await res.json();
      
      // Save order to orders.json backend database
      const orderRecord = {
        id: orderData.id || ("ORD_" + Date.now()),
        timestamp: new Date().toISOString(),
        customer: { name, email, phone, eventDate: eventDate || "N/A" },
        items: itemsList,
        websiteExtraPages,
        totalAmount: currentGrandTotal,
        estimatedDelivery: deliveryTimeEl.textContent,
        paymentStatus: orderData.simulated ? "Simulated Paid" : "Pending Payment",
        status: "New"
      };

      await fetch(`${API_BASE}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderRecord)
      });

      payNowBtn.disabled = false;
      payNowBtn.textContent = "Pay Now & Order";

      if (orderData.simulated) {
        alert(`🎉 Order Successfully Placed! (Simulated Mode)\n\nOrder ID: ${orderRecord.id}\nCustomer: ${name}\nTotal Amount: ₹${currentGrandTotal.toLocaleString('en-IN')}\n\nYour order details have been sent to the Admin Dashboard!`);
        return;
      }

      if (typeof Razorpay !== "undefined") {
        const options = {
          key: orderData.key_id,
          amount: orderData.amount,
          currency: orderData.currency,
          name: "Vybtek Wedding Studio",
          description: "Wedding Design Deliverables Payment",
          order_id: orderData.id,
          prefill: {
            name: name,
            email: email,
            contact: phone
          },
          handler: async function (response) {
            // Update status to Paid
            await fetch(`${API_BASE}/orders/update-status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: orderData.id, status: "Paid & Processing" })
            });
            alert(`Payment Successful!\n\nPayment ID: ${response.razorpay_payment_id}\nOrder ID: ${response.razorpay_order_id}\n\nYour order details are logged in the Admin Dashboard!`);
          },
          theme: {
            color: "#b8860b"
          }
        };
        const rzp = new Razorpay(options);
        rzp.open();
      } else {
        alert("Razorpay SDK failed to load. Please check your internet connection.");
      }

    } catch(err) {
      payNowBtn.disabled = false;
      payNowBtn.textContent = "Pay Now & Order";
      alert("Error initiating payment: " + err.message);
    }
  });
}

const downloadQuoteBtn = document.getElementById("downloadQuote");
if (downloadQuoteBtn) {
  downloadQuoteBtn.addEventListener("click", () => {
    window.print();
  });
}

loadCatalog();
