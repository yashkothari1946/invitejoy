let appData = { categories: [] };
let ordersList = [];

// ─── Admin auth (shared Manuplast/Vybtek JWT) ───────────────────────────────
function wedvybToken() { return localStorage.getItem("wedvyb_admin_token") || ""; }
function wedvybAuthHeaders(base) {
  const h = Object.assign({}, base || {});
  const t = wedvybToken();
  if (t) h["Authorization"] = "Bearer " + t;
  return h;
}
function wedvybShowLogin() {
  const el = document.getElementById("wedvyb-login-overlay");
  if (el) el.style.display = "flex";
}
function wedvybHandle401(res) {
  if (res && res.status === 401) {
    localStorage.removeItem("wedvyb_admin_token");
    wedvybShowLogin();
    return true;
  }
  return false;
}
async function wedvybLogin(username, password) {
  try {
    const res = await fetch(window.ADMIN_LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      localStorage.setItem("wedvyb_admin_token", data.token);
      const el = document.getElementById("wedvyb-login-overlay");
      if (el) el.style.display = "none";
      loadData();
      loadOrders();
      return true;
    }
  } catch (e) { /* fall through */ }
  return false;
}
async function wedvybDoLogin() {
  const u = (document.getElementById("wedvyb-login-user").value || "").trim();
  const p = document.getElementById("wedvyb-login-pass").value || "";
  const err = document.getElementById("wedvyb-login-err");
  if (err) err.style.display = "none";
  const ok = await wedvybLogin(u, p);
  if (!ok && err) err.style.display = "block";
}

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

async function loadData() {
  const res = await fetch(`${API_BASE}/data`);
  if (res.ok) {
    appData = await res.json();
    if (!appData.payment) appData.payment = { razorpay_key_id: "", razorpay_key_secret: "" };
    if (!appData.coupons) appData.coupons = [];
    renderEditor();
    renderCategoryDropdown();
    renderPaymentSettings();
    renderCoupons();
  }
}

async function loadOrders() {
  try {
    const res = await fetch(`${API_BASE}/orders`, { headers: wedvybAuthHeaders() });
    if (wedvybHandle401(res)) return;
    if (res.ok) {
      ordersList = await res.json();
      renderOrders();
      renderMetrics();
    }
  } catch(e) {
    console.error("Error loading orders", e);
  }
}

function renderMetrics() {
  let totalRev = 0;
  let activeCount = 0;

  ordersList.forEach(o => {
    totalRev += o.totalAmount || 0;
    if (o.status !== "Delivered" && o.status !== "Cancelled") {
      activeCount++;
    }
  });

  document.getElementById("metricRevenue").textContent = currency.format(totalRev);
  document.getElementById("metricOrders").textContent = ordersList.length;
  document.getElementById("metricActive").textContent = activeCount;
}

function renderOrders(filterQuery = "") {
  const container = document.getElementById("ordersList");
  container.innerHTML = "";

  let filtered = ordersList;
  if (filterQuery.trim()) {
    const q = filterQuery.toLowerCase();
    filtered = ordersList.filter(o => 
      o.id.toLowerCase().includes(q) ||
      (o.customer?.name || '').toLowerCase().includes(q) ||
      (o.customer?.phone || '').includes(q) ||
      (o.customer?.email || '').toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div class="admin-panel" style="text-align: center; color: var(--muted);"><p>${ordersList.length === 0 ? "No customer orders placed yet." : "No orders matching your search."}</p></div>`;
    return;
  }

  filtered.forEach((order) => {
    const card = document.createElement("div");
    card.className = "order-card";

    const badgeClass = order.paymentStatus.includes("Paid") ? "status-paid" : order.paymentStatus.includes("Simulated") ? "status-simulated" : "status-new";

    let itemsHtml = (order.items || []).map(i => {
      const qty = i.quantity || 1;
      const priceDisplay = i.totalPrice ? `₹${i.totalPrice.toLocaleString('en-IN')}` : `₹${(i.price * qty).toLocaleString('en-IN')}`;
      const notesHtml = i.notes ? `<div style="font-size: 0.8rem; color: var(--gold-strong); background: rgba(184,134,11,0.08); padding: 0.35rem 0.65rem; border-radius: 6px; margin-top: 0.3rem; font-weight: 600; white-space: pre-wrap; border-left: 3px solid var(--gold);">📝 <strong>Qty Notes:</strong> ${i.notes}</div>` : '';
      return `<li style="display: flex; flex-direction: column; gap: 0.15rem; padding: 0.45rem 0; border-bottom: 1px dashed rgba(44,42,41,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span><strong>${i.name}</strong> ${qty > 1 ? `<span style="background: rgba(184,134,11,0.15); color: var(--gold-strong); padding: 0.1rem 0.45rem; border-radius: 4px; font-size: 0.78rem; font-weight: 700; margin-left: 0.35rem;">Qty: ${qty}</span>` : ''}</span>
          <strong style="color: var(--text);">${priceDisplay}</strong>
        </div>
        ${notesHtml}
      </li>`;
    }).join("");

      let invActionHtml = "";
      if (order.invitationDocPath) {
        invActionHtml += `<a href="${order.invitationDocPath}" target="_blank" class="button button-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem; text-decoration: none; border-color: var(--gold); color: var(--gold-strong);">📎 Download Customer PDF/Doc</a> `;
      }
      if (order.invitationContent && (order.invitationContent.page1?.groomBride || order.invitationContent.page2?.parentsName || order.invitationContent.page3?.day1Date)) {
        invActionHtml += `<button onclick="viewInvitationDetails('${order.id}')" class="button button-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">💌 View 5-Page Invitation Content</button>`;
      }

      let rawPhone = order.customer?.phone || '';
      let phoneClean = rawPhone.replace(/\D/g, '');
      if (phoneClean && !phoneClean.startsWith('91') && phoneClean.length === 10) phoneClean = '91' + phoneClean;
      const waLink = phoneClean ? `https://wa.me/${phoneClean}?text=${encodeURIComponent(`Hi ${order.customer?.name || 'there'}, regarding your Wedding Order (${order.id}) with Vybtek Studio!`)}` : '#';

      card.innerHTML = `
        <div class="order-header">
          <div>
            <strong style="font-size: 1.1rem; color: var(--gold-strong);">${order.id}</strong>
            <p style="margin: 0; font-size: 0.8rem; color: var(--muted);">${new Date(order.timestamp).toLocaleString()}</p>
          </div>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="order-status-badge ${badgeClass}">${order.paymentStatus}</span>
            <select onchange="updateOrderStatus('${order.id}', this.value)" style="padding: 0.25rem 0.5rem; border-radius: 6px; font-size: 0.85rem; border: 1px solid rgba(44,42,41,0.2);">
              <option value="New" ${order.status === 'New' ? 'selected' : ''}>Status: New</option>
              <option value="Paid & Processing" ${order.status === 'Paid & Processing' ? 'selected' : ''}>Paid & Processing</option>
              <option value="In Progress" ${order.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Delivered" ${order.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${order.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>

        <div class="customer-grid">
          <div><strong>Customer:</strong> ${order.customer?.name || 'N/A'}</div>
          <div><strong>Email:</strong> ${order.customer?.email || 'N/A'}</div>
          <div>
            <strong>Phone:</strong> ${rawPhone || 'N/A'}
            ${phoneClean ? `<a href="${waLink}" target="_blank" style="margin-left: 0.4rem; padding: 0.2rem 0.55rem; background: #25D366; color: white; border-radius: 6px; font-size: 0.78rem; text-decoration: none; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">💬 WhatsApp</a>` : ''}
          </div>
          <div><strong>Event Date:</strong> ${order.customer?.eventDate || 'N/A'}</div>
        </div>

        <ul class="order-items-list">
          ${itemsHtml}
        </ul>

        ${invActionHtml ? `<div style="margin: 0.75rem 0 0.5rem 0; display: flex; gap: 0.5rem; flex-wrap: wrap;">${invActionHtml}</div>` : ''}

        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(44,42,41,0.1); padding-top: 0.75rem; margin-top: 0.5rem;">
          <span style="font-size: 0.85rem; color: var(--muted);">Est. Delivery: <strong>${order.estimatedDelivery}</strong></span>
          <span style="font-size: 1.2rem; font-family: 'Cormorant Garamond', serif; font-weight: 700; color: var(--gold-strong);">Total: ${currency.format(order.totalAmount)}</span>
        </div>
      `;

      container.appendChild(card);
    });
  }

function filterOrders() {
  const input = document.getElementById("orderSearchInput");
  if (input) renderOrders(input.value);
}

  function viewInvitationDetails(orderId) {
    const order = ordersList.find(o => o.id === orderId);
    if (!order || !order.invitationContent) return alert("No invitation details found for this order.");

    const inv = order.invitationContent;
    const contentEl = document.getElementById("invitationModalContent");
    
    let html = `<div style="display: flex; flex-direction: column; gap: 1rem;">`;

    if (inv.page1) {
      html += `
        <div style="background: rgba(184,134,11,0.06); padding: 1rem; border-radius: 10px; border-left: 4px solid var(--gold);">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--gold-strong);">Page 1: Title & Overview</h4>
          <p style="margin: 0.2rem 0;"><strong>Groom & Bride:</strong> ${inv.page1.groomBride || 'N/A'}</p>
          <p style="margin: 0.2rem 0;"><strong>Hashtag:</strong> ${inv.page1.hashtag || 'N/A'}</p>
          <p style="margin: 0.2rem 0;"><strong>Event Date:</strong> ${inv.page1.eventDate || 'N/A'}</p>
          <p style="margin: 0.2rem 0;"><strong>Location:</strong> ${inv.page1.location || 'N/A'}</p>
        </div>
      `;
    }

    if (inv.page2) {
      html += `
        <div style="background: rgba(184,134,11,0.06); padding: 1rem; border-radius: 10px; border-left: 4px solid var(--gold);">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--gold-strong);">Page 2: Invocation & Family Lineage</h4>
          <p style="margin: 0.2rem 0;"><strong>Invocation Header:</strong> ${inv.page2.headerNote || 'N/A'}</p>
          <p style="margin: 0.2rem 0;"><strong>Parents' Names:</strong> ${inv.page2.parentsName || 'N/A'}</p>
          <p style="margin: 0.2rem 0;"><strong>Bride & Grandparents:</strong> ${inv.page2.brideGrandparents || 'N/A'}</p>
          <p style="margin: 0.2rem 0;"><strong>Groom & Grandparents:</strong> ${inv.page2.groomGrandparents || 'N/A'}</p>
          <p style="margin: 0.2rem 0;"><strong>Awaiting Your Presence:</strong> ${inv.page2.awaitingPresence || 'N/A'}</p>
        </div>
      `;
    }

    if (inv.page3) {
      html += `
        <div style="background: rgba(184,134,11,0.06); padding: 1rem; border-radius: 10px; border-left: 4px solid var(--gold);">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--gold-strong);">Page 3: Day 1 Schedule & Venues</h4>
          <p style="margin: 0.2rem 0;"><strong>Day 1 Date:</strong> ${inv.page3.day1Date || 'N/A'}</p>
          <p style="margin: 0.2rem 0; white-space: pre-wrap;"><strong>Details & Timings:</strong> ${inv.page3.day1Details || 'N/A'}</p>
        </div>
      `;
    }

    if (inv.page4) {
      html += `
        <div style="background: rgba(184,134,11,0.06); padding: 1rem; border-radius: 10px; border-left: 4px solid var(--gold);">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--gold-strong);">Page 4: Day 2 Main Ceremony Schedule</h4>
          <p style="margin: 0.2rem 0;"><strong>Day 2 Date:</strong> ${inv.page4.day2Date || 'N/A'}</p>
          <p style="margin: 0.2rem 0; white-space: pre-wrap;"><strong>Details & Timings:</strong> ${inv.page4.day2Details || 'N/A'}</p>
        </div>
      `;
    }

    if (inv.page5) {
      html += `
        <div style="background: rgba(184,134,11,0.06); padding: 1rem; border-radius: 10px; border-left: 4px solid var(--gold);">
          <h4 style="margin: 0 0 0.5rem 0; color: var(--gold-strong);">Page 5: Thank You, RSVP & Notes</h4>
          <p style="margin: 0.2rem 0;"><strong>Thank You Note:</strong> ${inv.page5.thankYouNote || 'N/A'}</p>
          <p style="margin: 0.2rem 0;"><strong>Family Name:</strong> ${inv.page5.familyName || 'N/A'}</p>
          <p style="margin: 0.2rem 0;"><strong>R.S.V.P:</strong> ${inv.page5.rsvp || 'N/A'}</p>
          <p style="margin: 0.2rem 0; white-space: pre-wrap;"><strong>Custom Notes:</strong> ${inv.page5.customNote || 'N/A'}</p>
        </div>
      `;
    }

    html += `</div>`;
    contentEl.innerHTML = html;
    document.getElementById("invitationViewModal").style.display = "flex";
  }

  function closeInvitationModal() {
    document.getElementById("invitationViewModal").style.display = "none";
  }

async function updateOrderStatus(orderId, status) {
  const res = await fetch(`${API_BASE}/orders/update-status`, {
    method: "POST",
    headers: wedvybAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ orderId, status })
  });

  if (res.ok) {
    showToast("Order status updated!");
    loadOrders();
  } else {
    alert("Error updating order status");
  }
}

function switchTab(tabId, btnEl) {
  document.querySelectorAll(".tab-content").forEach(el => el.style.display = "none");
  document.querySelectorAll(".admin-tab").forEach(el => el.classList.remove("active"));
  document.getElementById(tabId).style.display = "block";
  if (btnEl) btnEl.classList.add("active");
}

function renderEditor() {
  const container = document.getElementById("catalogEditor");
  container.innerHTML = "";
  appData.categories.forEach((cat, catIdx) => {
    const isCatActive = cat.active !== false;
    const catBadge = isCatActive
      ? `<span style="background: #e8f5e9; color: #2e7d32; padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.78rem; font-weight: 700; display: inline-block;">🟢 Category Active</span>`
      : `<span style="background: #ffebee; color: #c62828; padding: 0.2rem 0.65rem; border-radius: 99px; font-size: 0.78rem; font-weight: 700; display: inline-block;">🔴 Category Inactive</span>`;

    const div = document.createElement("div");
    div.className = "category-list admin-panel";
    div.style.borderLeft = isCatActive ? "4px solid #27ae60" : "4px solid #c0392b";
    div.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(44,42,41,0.1); padding-bottom: 0.65rem; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.65rem;">
          <h4 style="margin: 0; font-size: 1.2rem; color: var(--gold-strong); font-family: 'Cormorant Garamond', serif;">${cat.name}</h4>
          ${catBadge}
        </div>
        <button onclick="toggleCategoryActive(${catIdx})" style="background: ${isCatActive ? '#c0392b' : '#27ae60'}; color: white; border: none; padding: 0.35rem 0.85rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700; transition: all 0.2s ease;">
          ${isCatActive ? 'Set Category Inactive' : 'Set Category Active'}
        </button>
      </div>
    `;
    
    cat.items.forEach((item, itemIdx) => {
      const row = document.createElement("div");
      row.className = "item-row";
      const sampleList = (item.samples && item.samples.length) ? item.samples : (item.sample ? [item.sample] : []);
      
      const isVideoFile = (url) => /\.(mp4|webm|ogg|mov)$/i.test(url);

      let thumbsHtml = "";
      if (sampleList.length > 0) {
        thumbsHtml = `<div style="display: flex; gap: 0.25rem; margin-top: 0.25rem; flex-wrap: wrap;">` + 
          sampleList.map(s => isVideoFile(s)
            ? `<video src="${s}" muted loop playsinline style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(44,42,41,0.15);"></video>`
            : `<img src="${s}" style="width: 36px; height: 36px; object-fit: cover; border-radius: 4px; border: 1px solid rgba(44,42,41,0.15);" alt="sample">`
          ).join("") + 
          `</div>`;
      }

      let mainThumbHtml = `<div style="width: 48px; height: 48px; background: rgba(44,42,41,0.05); border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: var(--muted);">No Media</div>`;
      if (sampleList[0]) {
        if (isVideoFile(sampleList[0])) {
          mainThumbHtml = `<video src="${sampleList[0]}" muted loop playsinline style="width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(44,42,41,0.2);"></video>`;
        } else {
          mainThumbHtml = `<img src="${sampleList[0]}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(44,42,41,0.2);" alt="thumb">`;
        }
      }

      const isActive = item.active !== false;
      const statusBadge = isActive 
        ? `<span style="background: #e8f5e9; color: #2e7d32; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.72rem; font-weight: 700; display: inline-block; margin-left: 0.35rem;">🟢 Active</span>`
        : `<span style="background: #ffebee; color: #c62828; padding: 0.15rem 0.5rem; border-radius: 99px; font-size: 0.72rem; font-weight: 700; display: inline-block; margin-left: 0.35rem;">🔴 Inactive</span>`;

      const itemDemoUrls = (item.demoUrls && item.demoUrls.length > 0) ? item.demoUrls : (item.demoUrl ? [item.demoUrl] : []);
      const demoBadge = itemDemoUrls.length > 0 ? `<small style="color: var(--gold-strong); font-weight: 700;"> &bull; 🌐 ${itemDemoUrls.length} Live Demo Link(s)</small>` : '';

      row.innerHTML = `
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          ${mainThumbHtml}
          <div>
            <strong>${item.name}</strong> ${statusBadge} - ₹${item.price} (${item.type})<br>
            <small style="color: var(--muted);">${sampleList.length} sample media file(s)</small> ${demoBadge}
            ${thumbsHtml}
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center;">
          <button onclick="toggleServiceActive(${catIdx}, ${itemIdx})" style="background: ${isActive ? '#e67e22' : '#2e7d32'}; color: white; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">${isActive ? 'Set Inactive' : 'Set Active'}</button>
          <button onclick="openEditModal(${catIdx}, ${itemIdx})" style="background: #27ae60; color: white; border: none; padding: 0.25rem 0.6rem; border-radius: 4px; cursor: pointer; font-size: 0.8rem; font-weight: 600;">Edit</button>
          <button onclick="removeItem(${catIdx}, ${itemIdx})">Remove</button>
        </div>
      `;
      div.appendChild(row);
    });
    container.appendChild(div);
  });
}

async function toggleCategoryActive(catIdx) {
  const cat = appData.categories[catIdx];
  cat.active = cat.active === false ? true : false;
  renderEditor();
  renderCategoryDropdown();
  await saveData();
  showToast(`Category "${cat.name}" is now ${cat.active ? "Active" : "Inactive"}`);
}

async function toggleServiceActive(catIdx, itemIdx) {
  const item = appData.categories[catIdx].items[itemIdx];
  item.active = item.active === false ? true : false;
  renderEditor();
  await saveData();
  showToast(`Service "${item.name}" is now ${item.active ? "Active" : "Inactive"}`);
}

function renderCategoryDropdown() {
  const select = document.getElementById("newCategory");
  select.innerHTML = "";
  appData.categories.forEach((cat, idx) => {
    const catStatus = cat.active !== false ? "🟢 Active" : "🔴 Inactive";
    select.innerHTML += `<option value="${idx}">${cat.name} (${catStatus})</option>`;
  });
}

function renderPaymentSettings() {
  if (appData.payment) {
    document.getElementById("razorpayKeyId").value = appData.payment.razorpay_key_id || "";
    document.getElementById("razorpayKeySecret").value = appData.payment.razorpay_key_secret || "";
  }
}

function renderCoupons() {
  const container = document.getElementById("couponsList");
  if (!container) return;

  if (!appData.coupons || appData.coupons.length === 0) {
    container.innerHTML = `
      <div class="admin-panel" style="text-align: center; padding: 2.5rem 1rem; color: var(--muted);">
        <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎟️</div>
        <p style="margin: 0; font-size: 0.95rem;">No active promo coupons. Add a new coupon using the form on the right.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = "";
  appData.coupons.forEach((cp, idx) => {
    const card = document.createElement("div");
    card.className = "admin-panel";
    card.style.cssText = "margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; border-left: 4px solid var(--gold); padding: 1rem 1.25rem;";

    const type = cp.discountType || cp.type;
    const valueDisplay = type === "percent" ? `${cp.value}% OFF` : `Flat ₹${cp.value.toLocaleString('en-IN')} OFF`;
    const minSubDisplay = cp.minSubtotal > 0 ? `Min subtotal ₹${cp.minSubtotal.toLocaleString('en-IN')}` : `No min order requirement`;

    card.innerHTML = `
      <div>
        <div style="display: flex; align-items: center; gap: 0.65rem; margin-bottom: 0.35rem;">
          <span style="font-size: 1.15rem; font-weight: 800; color: var(--gold-strong); font-family: monospace; letter-spacing: 0.12em; background: rgba(184,134,11,0.12); padding: 0.25rem 0.65rem; border-radius: 6px; border: 1px dashed var(--gold);">${cp.code}</span>
          <span style="background: #e8f5e9; color: #2e7d32; font-size: 0.78rem; font-weight: 700; padding: 0.18rem 0.55rem; border-radius: 99px;">${valueDisplay}</span>
        </div>
        <p style="margin: 0.2rem 0 0.15rem 0; font-size: 0.88rem; color: var(--text); font-weight: 600;">${cp.description || cp.desc || ''}</p>
        <small style="color: var(--muted); font-size: 0.78rem;">${minSubDisplay}</small>
      </div>
      <button onclick="removeCoupon(${idx})" style="background: rgba(192, 57, 43, 0.1); color: #c0392b; border: 1px solid rgba(192, 57, 43, 0.3); padding: 0.4rem 0.85rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700; transition: all 0.2s ease;" onmouseover="this.style.background='#c0392b'; this.style.color='#fff';" onmouseout="this.style.background='rgba(192, 57, 43, 0.1)'; this.style.color='#c0392b';">
        🗑️ Delete
      </button>
    `;

    container.appendChild(card);
  });
}

async function addCoupon() {
  const codeInput = document.getElementById("couponCode");
  const typeInput = document.getElementById("couponType");
  const valueInput = document.getElementById("couponValue");
  const minSubInput = document.getElementById("couponMinSubtotal");
  const descInput = document.getElementById("couponDesc");

  const code = (codeInput?.value || "").trim().toUpperCase();
  const discountType = typeInput?.value || "percent";
  const value = parseFloat(valueInput?.value);
  const minSubtotal = parseFloat(minSubInput?.value) || 0;
  const description = (descInput?.value || "").trim();

  if (!code) {
    alert("Please enter a valid coupon code (e.g. FESTIVE20).");
    return;
  }

  if (isNaN(value) || value <= 0) {
    alert("Please enter a valid discount value greater than 0.");
    return;
  }

  if (!appData.coupons) appData.coupons = [];

  if (appData.coupons.some(c => c.code === code)) {
    alert(`Coupon code "${code}" already exists! Please use a different code.`);
    return;
  }

  appData.coupons.push({
    code,
    discountType,
    value,
    minSubtotal,
    description: description || (discountType === "percent" ? `${value}% OFF` : `Flat ₹${value} OFF`)
  });

  if (codeInput) codeInput.value = "";
  if (valueInput) valueInput.value = "";
  if (minSubInput) minSubInput.value = "0";
  if (descInput) descInput.value = "";

  renderCoupons();
  await saveData();
  showToast(`🎉 Promo Coupon "${code}" added successfully!`);
}

async function removeCoupon(idx) {
  if (!appData.coupons || !appData.coupons[idx]) return;
  const code = appData.coupons[idx].code;

  if (confirm(`Are you sure you want to delete promo coupon "${code}"?`)) {
    appData.coupons.splice(idx, 1);
    renderCoupons();
    await saveData();
    showToast(`Coupon "${code}" deleted.`);
  }
}

async function addService() {
  const catIdx = document.getElementById("newCategory").value;
  const name = document.getElementById("newName").value.trim();
  const price = parseInt(document.getElementById("newPrice").value);
  const type = document.getElementById("newType").value;
  let textSamples = document.getElementById("newSample").value.trim().split(",").map(s => s.trim()).filter(Boolean);
  const fileInput = document.getElementById("newSampleFile");

  if (!name) return alert("Please enter a service name.");

  let uploadedSamples = [];
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i];
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      try {
        const res = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: wedvybAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ filename: file.name, base64 })
        });
        const data = await res.json();
        if (data.path) uploadedSamples.push(data.path);
      } catch(err) {
        console.error("Error uploading file", err);
      }
    }
  }

  const allSamples = [...uploadedSamples, ...textSamples];
  const id = name.toLowerCase().replace(/\s+/g, '-');
  const demoUrlRaw = (document.getElementById("newDemoUrl")?.value || "").trim();
  const demoUrls = demoUrlRaw.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
  const active = document.getElementById("newActive") ? (document.getElementById("newActive").value === "true") : true;
  
  appData.categories[catIdx].items.push({
    id,
    name,
    price,
    type,
    active,
    demoUrl: demoUrls[0] || "",
    demoUrls: demoUrls,
    sample: allSamples[0] || "",
    samples: allSamples
  });

  document.getElementById("newName").value = "";
  document.getElementById("newSample").value = "";
  if (document.getElementById("newDemoUrl")) document.getElementById("newDemoUrl").value = "";
  if (fileInput) fileInput.value = "";

  renderEditor();
  await saveData();
  showToast("Service added and saved!");
}

// EDIT MODAL FUNCTIONS
let editingItemSamples = [];

function openEditModal(catIdx, itemIdx) {
  const item = appData.categories[catIdx].items[itemIdx];
  document.getElementById("editCatIdx").value = catIdx;
  document.getElementById("editItemIdx").value = itemIdx;
  document.getElementById("editName").value = item.name;
  document.getElementById("editPrice").value = item.price;
  document.getElementById("editType").value = item.type || "graphic";
  if (document.getElementById("editActive")) document.getElementById("editActive").value = item.active !== false ? "true" : "false";
  
  const existingDemoUrls = item.demoUrls && item.demoUrls.length > 0 ? item.demoUrls.join(", ") : (item.demoUrl || "");
  if (document.getElementById("editDemoUrl")) document.getElementById("editDemoUrl").value = existingDemoUrls;
  
  const fileInput = document.getElementById("editSampleFile");
  if (fileInput) fileInput.value = "";
  const textInput = document.getElementById("editSampleText");
  if (textInput) textInput.value = "";

  editingItemSamples = [...(item.samples || (item.sample ? [item.sample] : []))];
  renderEditSamplesList();
  
  document.getElementById("editModal").style.display = "flex";
}

function closeEditModal() {
  const fileInput = document.getElementById("editSampleFile");
  if (fileInput) fileInput.value = "";
  const textInput = document.getElementById("editSampleText");
  if (textInput) textInput.value = "";
  if (document.getElementById("editDemoUrl")) document.getElementById("editDemoUrl").value = "";
  document.getElementById("editModal").style.display = "none";
}

function renderEditSamplesList() {
  const list = document.getElementById("editSamplesList");
  list.innerHTML = "";
  if (editingItemSamples.length === 0) {
    list.innerHTML = `<span style="font-size: 0.8rem; color: var(--muted);">No media attached</span>`;
    return;
  }

  editingItemSamples.forEach((img, idx) => {
    const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(img);
    const badge = document.createElement("div");
    badge.style.cssText = "display: flex; align-items: center; gap: 0.35rem; background: rgba(44,42,41,0.08); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem;";
    
    const mediaPreview = isVideo
      ? `<span style="font-size: 1.1rem; line-height: 1;" title="Video File">🎬</span>`
      : `<img src="${img}" style="width: 28px; height: 28px; object-fit: cover; border-radius: 3px; border: 1px solid rgba(44,42,41,0.15);" alt="thumb" onerror="this.style.display='none'">`;

    badge.innerHTML = `
      ${mediaPreview}
      <span>${img.split('/').pop()}</span>
      <button type="button" onclick="removeEditSample(${idx})" style="border:none; background:none; color:red; cursor:pointer; font-weight:bold; font-size: 1rem; line-height: 1;">&times;</button>
    `;
    list.appendChild(badge);
  });
}

function removeEditSample(idx) {
  editingItemSamples.splice(idx, 1);
  renderEditSamplesList();
}

async function saveEditedService() {
  const catIdx = document.getElementById("editCatIdx").value;
  const itemIdx = document.getElementById("editItemIdx").value;
  const item = appData.categories[catIdx].items[itemIdx];

  const saveBtn = document.getElementById("saveEditBtn");
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving...";
  }

  item.name = document.getElementById("editName").value.trim();
  item.price = parseInt(document.getElementById("editPrice").value);
  item.type = document.getElementById("editType").value;
  if (document.getElementById("editActive")) item.active = document.getElementById("editActive").value === "true";
  
  const demoUrlRaw = (document.getElementById("editDemoUrl")?.value || "").trim();
  const demoUrls = demoUrlRaw.split(/[\n,]+/).map(u => u.trim()).filter(Boolean);
  item.demoUrls = demoUrls;
  item.demoUrl = demoUrls[0] || "";

  const fileInput = document.getElementById("editSampleFile");
  if (fileInput && fileInput.files && fileInput.files.length > 0) {
    for (let i = 0; i < fileInput.files.length; i++) {
      const file = fileInput.files[i];
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      try {
        const res = await fetch(`${API_BASE}/upload`, {
          method: "POST",
          headers: wedvybAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ filename: file.name, base64 })
        });
        const data = await res.json();
        if (data.path) editingItemSamples.push(data.path);
      } catch(err) {
        console.error("Error uploading", err);
      }
    }
  }

  const textInput = document.getElementById("editSampleText");
  if (textInput && textInput.value.trim()) {
    const textSamples = textInput.value.trim().split(",").map(s => s.trim()).filter(Boolean);
    editingItemSamples.push(...textSamples);
  }

  item.samples = editingItemSamples;
  item.sample = editingItemSamples[0] || "";

  closeEditModal();
  renderEditor();
  await saveData();
  
  if (saveBtn) {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
}

async function removeItem(catIdx, itemIdx) {
  if (confirm("Are you sure you want to remove this service?")) {
    appData.categories[catIdx].items.splice(itemIdx, 1);
    renderEditor();
    await saveData();
  }
}

async function saveData() {
  const res = await fetch(`${API_BASE}/data`, {
    method: "POST",
    headers: wedvybAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(appData, null, 2)
  });
  
  if (res.ok) {
    showToast("Catalog Saved Successfully!");
  } else {
    alert("Error saving data");
  }
}

function savePaymentSettings() {
  if (!appData.payment) appData.payment = {};
  appData.payment.razorpay_key_id = document.getElementById("razorpayKeyId").value.trim();
  appData.payment.razorpay_key_secret = document.getElementById("razorpayKeySecret").value.trim();
  saveData();
}

function showToast(msg) {
  const toast = document.getElementById("toast");
  if (msg) toast.textContent = msg;
  toast.style.opacity = 1;
  setTimeout(() => { toast.style.opacity = 0; }, 3000);
}

function logoutAdmin() {
  if (confirm("Are you sure you want to log out of Admin Control Center?")) {
    localStorage.removeItem("wedvyb_admin_token");
    window.location.href = "index.html";
  }
}

// Gate the admin panel behind the shared JWT: load data only when authed.
if (wedvybToken()) {
  loadData();
  loadOrders();
} else {
  wedvybShowLogin();
}
