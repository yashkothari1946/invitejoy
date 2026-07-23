const CartManager = {
  getCart() {
    try {
      return JSON.parse(localStorage.getItem("vybtek_cart") || "[]");
    } catch(e) {
      return [];
    }
  },

  isInCart(itemId) {
    const cart = this.getCart();
    return cart.some(i => i.id === itemId);
  },

  saveCart(cart) {
    localStorage.setItem("vybtek_cart", JSON.stringify(cart));
    this.updateBadges();
  },

  addItem(item, qty = 1) {
    const quantity = Math.max(1, parseInt(qty) || 1);
    const cart = this.getCart();
    const existing = cart.find(i => i.id === item.id);
    if (!existing) {
      cart.push({
        id: item.id,
        name: item.name,
        price: item.price,
        type: item.type || "graphic",
        quantity: quantity,
        sample: item.sample || (item.samples ? item.samples[0] : ""),
        samples: item.samples || (item.sample ? [item.sample] : [])
      });
      this.saveCart(cart);
      this.showToast(`✨ Added ${quantity > 1 ? quantity + ' × ' : ''}"${item.name}" to Cart!`, true);
    } else {
      existing.quantity = (existing.quantity || 1) + quantity;
      this.saveCart(cart);
      this.showToast(`✨ Updated "${item.name}" quantity (${existing.quantity}) in Cart!`, true);
    }
  },

  updateQuantity(itemId, newQty) {
    let cart = this.getCart();
    const item = cart.find(i => i.id === itemId);
    if (item) {
      const qty = parseInt(newQty);
      if (isNaN(qty) || qty <= 0) {
        cart = cart.filter(i => i.id !== itemId);
      } else {
        item.quantity = qty;
      }
      this.saveCart(cart);
    }
  },

  updateNotes(itemId, notesText) {
    let cart = this.getCart();
    const item = cart.find(i => i.id === itemId);
    if (item) {
      item.notes = notesText;
      this.saveCart(cart);
    }
  },

  removeItem(itemId) {
    let cart = this.getCart();
    cart = cart.filter(i => i.id !== itemId);
    this.saveCart(cart);
  },

  clearCart() {
    localStorage.removeItem("vybtek_cart");
    this.updateBadges();
  },

  getTotal() {
    const cart = this.getCart();
    return cart.reduce((sum, i) => sum + ((Number(i.price) || 0) * (Number(i.quantity) || 1)), 0);
  },

  updateBadges() {
    const cart = this.getCart();
    const count = cart.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
    const total = this.getTotal();
    
    document.querySelectorAll(".header-cart-btn").forEach(link => {
      link.innerHTML = `🛒 Cart <span class="cart-badge-count">${count}</span>`;
    });

    document.querySelectorAll(".cart-count-badge").forEach(el => {
      el.textContent = count;
    });

    // Update floating quick cart widget
    this.renderFloatingCartWidget(count, total);
  },

  renderFloatingCartWidget(count, total) {
    let widget = document.getElementById("floatingCartWidget");
    if (count === 0) {
      if (widget) widget.style.display = "none";
      return;
    }

    if (!widget) {
      widget = document.createElement("a");
      widget.id = "floatingCartWidget";
      widget.href = "cart.html";
      widget.className = "floating-cart-btn";
      document.body.appendChild(widget);
    }

    widget.style.display = "flex";
    widget.innerHTML = `
      <span style="font-size: 1.1rem;">🛒</span>
      <span><strong>Selected Designs (${count})</strong></span>
      <span style="font-size: 0.8rem; background: rgba(255,255,255,0.25); padding: 0.18rem 0.6rem; border-radius: 99px;">View Proposal &rarr;</span>
    `;
  },

  showToast(msg, showCartBtn = false) {
    let toast = document.getElementById("globalToast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "globalToast";
      toast.className = "global-toast-msg";
      document.body.appendChild(toast);
    }
    
    const cartActionHtml = showCartBtn ? `<a href="cart.html" class="toast-cart-btn">View Cart 🛒</a>` : '';
    toast.innerHTML = `<span>${msg}</span>${cartActionHtml}`;
    toast.classList.add("show");
    
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 4000);
  }
};

document.addEventListener("DOMContentLoaded", () => {
  CartManager.updateBadges();
});
