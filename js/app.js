/* ==========================================================================
   WANDERVISTA - Core Application Logic
   Handles Routing, Auth, Wishlist, Currency Converter, Search, Map, 
   Calculator, Trip Planner, Booking Flow, and Interactive Modules.
   ========================================================================== */

class WanderVistaApp {
  constructor() {
    this.currentCurrency = localStorage.getItem('wv_currency') || 'INR';
    this.currentUser = JSON.parse(localStorage.getItem('wv_user')) || null;
    this.wishlist = JSON.parse(localStorage.getItem('wv_wishlist')) || [];
    this.userTrips = JSON.parse(localStorage.getItem('wv_trips')) || [];
    this.userBookings = JSON.parse(localStorage.getItem('wv_bookings')) || [];
    this.packingState = JSON.parse(localStorage.getItem('wv_packing')) || {};
    this.pendingAction = null;
    this.leafletMap = null;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.updateUserUI();
    this.updateWishlistBadge();
    this.renderHomeViews();
    this.renderDestinationsView();
    this.renderToursView();
    this.renderHotelsView();
    this.renderFoodView();
    this.renderPackingChecklist();
    this.renderSafetyView();
    this.renderTransportView();
    this.initTripPlanner();
    this.setupCalculator();

    // Check URL Hash or default to home
    const initialView = window.location.hash.replace('#', '') || 'home';
    this.navigateTo(initialView, false);
  }

  /* Currency Converter Helper */
  formatPrice(amountINR) {
    const curr = WANDER_DATA.currencies[this.currentCurrency] || WANDER_DATA.currencies['INR'];
    const converted = Math.round(amountINR * curr.rate);
    
    if (this.currentCurrency === 'INR') {
      return `₹${converted.toLocaleString('en-IN')}`;
    }
    return `${curr.symbol}${converted.toLocaleString('en-US')}`;
  }

  /* View Router */
  navigateTo(viewId, pushHash = true) {
    const targetPage = document.getElementById(`page-${viewId}`);
    if (!targetPage) return;

    document.querySelectorAll('.page-view').forEach(page => page.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));

    targetPage.classList.add('active');
    
    // Highlight Nav Link
    const navLink = document.querySelector(`.nav-link[data-view="${viewId}"]`);
    if (navLink) navLink.classList.add('active');

    if (pushHash) {
      window.history.pushState(null, '', `#${viewId}`);
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Special view triggers
    if (viewId === 'map-explorer' && !this.leafletMap) {
      setTimeout(() => this.initLeafletMap(), 300);
    } else if (viewId === 'wishlist') {
      this.renderWishlistView();
    } else if (viewId === 'dashboard') {
      this.renderDashboardView();
    }
  }

  /* Authentication Management */
  updateUserUI() {
    const authBtn = document.getElementById('nav-auth-btn');
    if (this.currentUser) {
      authBtn.innerHTML = `<i class="fas fa-user-circle"></i> ${this.currentUser.name.split(' ')[0]}`;
      authBtn.onclick = () => this.navigateTo('dashboard');
    } else {
      authBtn.innerHTML = `<i class="fas fa-sign-in-alt"></i> Sign In`;
      authBtn.onclick = () => this.openAuthModal();
    }
  }

  openAuthModal(message = null) {
    const modal = document.getElementById('auth-modal');
    const noticeBox = document.getElementById('auth-notice');
    if (message) {
      noticeBox.innerHTML = `<div class="badge badge-gold" style="display:block; margin-bottom:1rem; padding:0.6rem;"><i class="fas fa-lock"></i> ${message}</div>`;
    } else {
      noticeBox.innerHTML = '';
    }
    modal.classList.add('active');
  }

  closeAuthModal() {
    document.getElementById('auth-modal').classList.remove('active');
  }

  login(email, password) {
    if (!email || !password) {
      this.showToast('Please enter both email and password.', 'warning');
      return;
    }
    // Demo Auth logic
    const user = {
      name: email.split('@')[0].toUpperCase(),
      email: email,
      joined: new Date().toLocaleDateString()
    };
    this.currentUser = user;
    localStorage.setItem('wv_user', JSON.stringify(user));
    this.updateUserUI();
    this.closeAuthModal();
    this.showToast(`Welcome back, ${user.name}!`, 'success');

    // Execute pending gated action if any
    if (this.pendingAction) {
      const action = this.pendingAction;
      this.pendingAction = null;
      action();
    }
  }

  register(name, email, phone, password) {
    if (!name || !email || !password) {
      this.showToast('Please fill in all required fields.', 'warning');
      return;
    }
    const user = { name, email, phone, joined: new Date().toLocaleDateString() };
    this.currentUser = user;
    localStorage.setItem('wv_user', JSON.stringify(user));
    this.updateUserUI();
    this.closeAuthModal();
    this.showToast(`Account created! Welcome to WanderVista, ${name}!`, 'success');

    if (this.pendingAction) {
      const action = this.pendingAction;
      this.pendingAction = null;
      action();
    }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('wv_user');
    this.updateUserUI();
    this.showToast('You have been logged out successfully.', 'info');
    this.navigateTo('home');
  }

  requireAuth(callback, noticeMessage = 'Sign in to continue and access this feature.') {
    if (this.currentUser) {
      callback();
    } else {
      this.pendingAction = callback;
      this.openAuthModal(noticeMessage);
    }
  }

  /* Wishlist Engine */
  toggleWishlist(itemId) {
    this.requireAuth(() => {
      const index = this.wishlist.indexOf(itemId);
      if (index > -1) {
        this.wishlist.splice(index, 1);
        this.showToast('Removed from Wishlist', 'info');
      } else {
        this.wishlist.push(itemId);
        this.showToast('Saved to Wishlist ❤️', 'success');
      }
      localStorage.setItem('wv_wishlist', JSON.stringify(this.wishlist));
      this.updateWishlistBadge();
      this.syncWishlistButtons();
    }, 'Sign in to save items to your personal Wishlist');
  }

  updateWishlistBadge() {
    const badge = document.getElementById('wishlist-count-badge');
    if (badge) {
      badge.textContent = this.wishlist.length;
    }
  }

  syncWishlistButtons() {
    document.querySelectorAll('.card-wishlist-btn').forEach(btn => {
      const id = btn.getAttribute('data-id');
      if (this.wishlist.includes(id)) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fas fa-heart"></i>';
      } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="far fa-heart"></i>';
      }
    });
  }

  /* Renderers */

  // 1. Home View Renderers
  renderHomeViews() {
    // National Grid
    const natContainer = document.getElementById('home-national-grid');
    if (natContainer) {
      const nationalItems = WANDER_DATA.destinations.filter(d => d.category === 'national').slice(0, 6);
      natContainer.innerHTML = nationalItems.map(dest => this.createDestinationCardHTML(dest)).join('');
    }

    // International Grid
    const intContainer = document.getElementById('home-international-grid');
    if (intContainer) {
      const intItems = WANDER_DATA.destinations.filter(d => d.category === 'international').slice(0, 6);
      intContainer.innerHTML = intItems.map(dest => this.createDestinationCardHTML(dest)).join('');
    }

    this.syncWishlistButtons();
  }

  createDestinationCardHTML(dest) {
    const isWishlisted = this.wishlist.includes(dest.id);
    return `
      <div class="card-destination">
        <div class="card-img-wrap">
          <img src="${dest.image}" alt="${dest.name}" loading="lazy" />
          <button class="card-wishlist-btn ${isWishlisted ? 'active' : ''}" data-id="${dest.id}" onclick="app.toggleWishlist('${dest.id}')">
            <i class="${isWishlisted ? 'fas' : 'far'} fa-heart"></i>
          </button>
          <span class="card-tag">${dest.type}</span>
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title">${dest.name}</h3>
            <div class="card-rating">
              <i class="fas fa-star"></i> ${dest.rating}
            </div>
          </div>
          <p class="card-desc">${dest.overview}</p>
          <div class="card-details-grid">
            <div class="card-detail-item"><i class="far fa-clock"></i> ${dest.duration}</div>
            <div class="card-detail-item"><i class="far fa-calendar-alt"></i> ${dest.bestTime.split(' ')[0]}</div>
          </div>
          <div class="card-footer">
            <div>
              <div class="price-label">Estimated Starting</div>
              <div class="price-value">${this.formatPrice(dest.priceINR)}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="app.openDestinationDetail('${dest.id}')">
              Explore <i class="fas fa-arrow-right"></i>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // 2. Destinations Page Renderer with live filters
  renderDestinationsView() {
    const grid = document.getElementById('destinations-all-grid');
    if (!grid) return;

    const searchInput = document.getElementById('dest-search-input')?.value.toLowerCase() || '';
    const categoryFilter = document.getElementById('dest-cat-filter')?.value || 'all';
    const typeFilter = document.getElementById('dest-type-filter')?.value || 'all';

    let filtered = WANDER_DATA.destinations.filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(searchInput) || d.country.toLowerCase().includes(searchInput) || d.overview.toLowerCase().includes(searchInput);
      const matchesCat = categoryFilter === 'all' || d.category === categoryFilter;
      const matchesType = typeFilter === 'all' || d.type.toLowerCase().includes(typeFilter);
      return matchesSearch && matchesCat && matchesType;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:4rem;"><i class="fas fa-search-location" style="font-size:3rem; color:var(--turquoise);"></i><h3>No destinations found</h3><p>Try adjusting your search query or filters.</p></div>`;
    } else {
      grid.innerHTML = filtered.map(d => this.createDestinationCardHTML(d)).join('');
    }
    this.syncWishlistButtons();
  }

  // 3. Destination Detail Page Loader
  openDestinationDetail(destId) {
    const dest = WANDER_DATA.destinations.find(d => d.id === destId);
    if (!dest) return;

    const detailContainer = document.getElementById('destination-detail-content');
    if (!detailContainer) return;

    detailContainer.innerHTML = `
      <!-- Hero Banner -->
      <div style="position:relative; height:450px; background:url('${dest.image}') center/cover no-repeat; border-radius:var(--radius-xl); overflow:hidden; margin-bottom:3rem; display:flex; align-items:flex-end; padding:3rem; color:#fff;">
        <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(0,0,0,0.2) 0%, rgba(11,25,44,0.9) 100%);"></div>
        <div style="position:relative; z-index:2; max-width:850px;">
          <div class="badge badge-gold" style="margin-bottom:0.8rem;">${dest.country} &bull; ${dest.type}</div>
          <h1 style="font-size:3.2rem; font-weight:800; margin-bottom:0.5rem;">${dest.name}</h1>
          <p style="font-size:1.2rem; opacity:0.9;">"${dest.tagline}"</p>
        </div>
      </div>

      <!-- Quick Metrics Bar -->
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:1.2rem; margin-bottom:3rem;">
        <div style="background:#fff; padding:1.2rem; border-radius:var(--radius-lg); border:1px solid var(--border-light); text-align:center;">
          <i class="fas fa-star" style="color:var(--accent-gold); font-size:1.5rem;"></i>
          <div style="font-size:1.2rem; font-weight:800; margin-top:0.3rem;">${dest.rating} / 5.0</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">${dest.reviewsCount} Traveler Reviews</div>
        </div>
        <div style="background:#fff; padding:1.2rem; border-radius:var(--radius-lg); border:1px solid var(--border-light); text-align:center;">
          <i class="far fa-clock" style="color:var(--turquoise); font-size:1.5rem;"></i>
          <div style="font-size:1.2rem; font-weight:800; margin-top:0.3rem;">${dest.duration}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">Recommended Trip</div>
        </div>
        <div style="background:#fff; padding:1.2rem; border-radius:var(--radius-lg); border:1px solid var(--border-light); text-align:center;">
          <i class="far fa-sun" style="color:var(--accent-orange); font-size:1.5rem;"></i>
          <div style="font-size:1.2rem; font-weight:800; margin-top:0.3rem;">${dest.bestTime.split(' ')[0]}</div>
          <div style="font-size:0.8rem; color:var(--text-muted);">Best Season</div>
        </div>
        <div style="background:#fff; padding:1.2rem; border-radius:var(--radius-lg); border:1px solid var(--border-light); text-align:center;">
          <i class="fas fa-tag" style="color:var(--tropical-green); font-size:1.5rem;"></i>
          <div style="font-size:1.2rem; font-weight:800; margin-top:0.3rem;">${this.formatPrice(dest.priceINR)}</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Estimated Starting Price</div>
        </div>
      </div>

      <!-- Main Overview & Attractions -->
      <div style="display:grid; grid-template-columns:2fr 1fr; gap:2.5rem; margin-bottom:3rem;">
        <div>
          <h2 class="section-title" style="text-align:left;">Overview</h2>
          <p style="font-size:1.05rem; line-height:1.8; color:var(--text-dark); margin-bottom:2rem;">${dest.overview}</p>

          <h3 style="font-size:1.5rem; font-weight:700; margin-bottom:1rem; color:var(--primary-navy);">Why Visit ${dest.name}?</h3>
          <ul style="list-style:none; display:flex; flex-direction:column; gap:0.8rem; margin-bottom:2.5rem;">
            ${dest.whyVisit.map(w => `<li style="display:flex; align-items:center; gap:0.8rem; font-size:1rem;"><i class="fas fa-check-circle" style="color:var(--tropical-green);"></i> ${w}</li>`).join('')}
          </ul>

          <h3 style="font-size:1.5rem; font-weight:700; margin-bottom:1.2rem; color:var(--primary-navy);">Top Attractions</h3>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:1.5rem; margin-bottom:2.5rem;">
            ${dest.attractions.map(attr => `
              <div style="background:#fff; border-radius:var(--radius-lg); overflow:hidden; border:1px solid var(--border-light); box-shadow:var(--shadow-sm);">
                <img src="${attr.image}" alt="${attr.name}" style="height:150px; width:100%; object-fit:cover;" />
                <div style="padding:1rem;">
                  <h4 style="font-size:1.1rem; margin-bottom:0.4rem; color:var(--primary-navy);">${attr.name}</h4>
                  <p style="font-size:0.85rem; color:var(--text-muted);">${attr.desc}</p>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Sidebar Actions & Info -->
        <div>
          <div style="background:#fff; padding:2rem; border-radius:var(--radius-xl); border:1px solid var(--border-light); box-shadow:var(--shadow-md); position:sticky; top:100px;">
            <h3 style="font-size:1.3rem; margin-bottom:1rem; color:var(--primary-navy);">Plan Your ${dest.name} Trip</h3>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1.5rem;">Estimated starting price: <strong>${this.formatPrice(dest.priceINR)}</strong>/person. *Prices may vary according to season, availability & hotel category.</p>

            <button class="btn btn-accent btn-lg" style="width:100%; margin-bottom:1rem;" onclick="app.startBooking('${dest.id}')">
              <i class="fas fa-paper-plane"></i> Book Now
            </button>

            <button class="btn btn-outline" style="width:100%; margin-bottom:1.5rem;" onclick="app.addToTripPlanner('${dest.id}')">
              <i class="fas fa-calendar-plus"></i> Add to Trip Planner
            </button>

            <div style="border-top:1px solid var(--border-light); padding-top:1.2rem;">
              <div style="font-weight:700; margin-bottom:0.5rem; font-size:0.9rem;">Transport Info:</div>
              <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:1rem;">${dest.transportInfo}</p>
              
              <div style="font-weight:700; margin-bottom:0.5rem; font-size:0.9rem;">Safety Advice:</div>
              <p style="font-size:0.82rem; color:var(--text-muted);">${dest.safetyTips}</p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.navigateTo('destination-detail');
  }

  // 4. Tours & Packages Renderer
  renderToursView() {
    const grid = document.getElementById('tours-grid');
    if (!grid) return;

    grid.innerHTML = WANDER_DATA.packages.map(pkg => `
      <div class="card-destination">
        <div class="card-img-wrap">
          <img src="${pkg.image}" alt="${pkg.title}" />
          <span class="card-tag">${pkg.category}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title" style="font-size:1.2rem; margin-bottom:0.5rem;">${pkg.title}</h3>
          <div style="font-size:0.88rem; color:var(--text-muted); margin-bottom:1.2rem;"><i class="far fa-clock" style="color:var(--turquoise);"></i> ${pkg.duration} &bull; ${pkg.hotelType}</div>
          <ul style="list-style:none; margin-bottom:1.2rem; font-size:0.85rem; display:flex; flex-direction:column; gap:0.4rem;">
            ${pkg.inclusions.map(inc => `<li><i class="fas fa-check" style="color:var(--tropical-green);"></i> ${inc}</li>`).join('')}
          </ul>
          <div class="card-footer">
            <div>
              <div class="price-label">Starting Price</div>
              <div class="price-value">${this.formatPrice(pkg.priceINR)}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="app.startBooking('${pkg.destId}')">
              Book Package
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // 5. Hotels & Resorts Renderer
  renderHotelsView() {
    const grid = document.getElementById('hotels-grid');
    if (!grid) return;

    grid.innerHTML = WANDER_DATA.hotels.map(h => `
      <div class="card-destination">
        <div class="card-img-wrap">
          <img src="${h.image}" alt="${h.name}" />
          <button class="card-wishlist-btn" onclick="app.toggleWishlist('${h.id}')"><i class="far fa-heart"></i></button>
        </div>
        <div class="card-body">
          <div class="card-title-row">
            <h3 class="card-title" style="font-size:1.2rem;">${h.name}</h3>
            <div class="card-rating"><i class="fas fa-star"></i> ${h.rating}</div>
          </div>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:1rem;"><i class="fas fa-map-marker-alt" style="color:var(--turquoise);"></i> ${h.location}</p>
          <div style="display:flex; flex-wrap:wrap; gap:0.4rem; margin-bottom:1.2rem;">
            ${h.amenities.map(a => `<span class="badge badge-blue">${a}</span>`).join('')}
          </div>
          <div class="card-footer">
            <div>
              <div class="price-label">Per Night</div>
              <div class="price-value">${this.formatPrice(h.priceINR)}</div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="app.requireAuth(() => app.showToast('Hotel booking initiated!', 'success'), 'Sign in to book hotels')">
              Book Hotel
            </button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // 6. Food & Local Cuisine Renderer
  renderFoodView() {
    const grid = document.getElementById('food-grid');
    if (!grid) return;

    grid.innerHTML = WANDER_DATA.foodItems.map(f => `
      <div class="food-card">
        <div class="food-img-wrap">
          <img src="${f.image}" alt="${f.dish}" />
          <span class="badge ${f.type === 'Pure Veg' || f.type === 'Veg' ? 'badge-green' : 'badge-gold'}" style="position:absolute; top:12px; left:12px;">${f.type}</span>
        </div>
        <div style="padding:1.5rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.4rem;">
            <h3 style="font-size:1.2rem; color:var(--primary-navy);">${f.dish}</h3>
            <span style="font-size:0.8rem; font-weight:700; color:var(--ocean-blue);">${f.cuisine}</span>
          </div>
          <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:1rem;">${f.desc}</p>
          <div style="background:#f8fafc; padding:0.8rem; border-radius:var(--radius-md); font-size:0.82rem;">
            <div><strong>Top Spot:</strong> ${f.topSpot}</div>
            <div><strong>Avg Cost:</strong> ${this.formatPrice(f.avgCostINR)} / portion</div>
          </div>
        </div>
      </div>
    `).join('');
  }

  // 7. Travel Packing Checklist Renderer
  renderPackingChecklist() {
    const container = document.getElementById('packing-items-grid');
    if (!container) return;

    container.innerHTML = WANDER_DATA.packingItems.map(item => {
      const isChecked = !!this.packingState[item.id];
      return `
        <label class="check-item">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="app.togglePackingItem('${item.id}', this.checked)" />
          <span>${item.label}</span>
        </label>
      `;
    }).join('');

    this.updatePackingProgress();
  }

  togglePackingItem(id, checked) {
    this.packingState[id] = checked;
    localStorage.setItem('wv_packing', JSON.stringify(this.packingState));
    this.updatePackingProgress();
  }

  updatePackingProgress() {
    const total = WANDER_DATA.packingItems.length;
    const checkedCount = Object.values(this.packingState).filter(Boolean).length;
    const percent = Math.round((checkedCount / total) * 100);

    const fill = document.getElementById('packing-progress-fill');
    const text = document.getElementById('packing-progress-text');

    if (fill) fill.style.width = `${percent}%`;
    if (text) text.textContent = `${percent}% Packed (${checkedCount}/${total} Items)`;
  }

  // 8. Safety & Emergency Center Renderer
  renderSafetyView() {
    const container = document.getElementById('emergency-numbers-grid');
    if (!container) return;

    container.innerHTML = WANDER_DATA.emergencyServices.map(e => `
      <div class="emergency-item">
        <div>
          <h4 style="font-size:1.05rem; margin-bottom:0.2rem; color:var(--primary-navy);">${e.country}</h4>
          <div style="font-size:0.82rem; color:var(--text-muted);">Police: <strong>${e.police}</strong> | Ambulance: <strong>${e.ambulance}</strong></div>
          <div style="font-size:0.82rem; color:var(--text-muted);">Helpline: <strong>${e.helpline}</strong></div>
        </div>
      </div>
    `).join('');
  }

  // 9. Transportation Info Renderer
  renderTransportView() {
    const list = document.getElementById('transport-modes-grid');
    if (!list) return;

    const modes = [
      { name: 'Flights', icon: 'fa-plane', desc: 'Domestic flights connected via major hubs. International connections daily.' },
      { name: 'Trains & Railways', icon: 'fa-train', desc: 'Vande Bharat & Shatabdi trains offer luxury high-speed domestic transit.' },
      { name: 'Private Taxis & Cabs', icon: 'fa-taxi', desc: 'Uber, Ola and licensed airport cabs available 24/7.' },
      { name: 'Metro & Subways', icon: 'fa-subway', desc: 'Clean, fast urban subway systems in major metropolitan destinations.' },
      { name: 'Ferry & Cruise Boats', icon: 'fa-ship', desc: 'Scenic island hopping ferries in Goa, Andaman, Kerala & Maldives.' },
      { name: 'Scooter & Bike Rentals', icon: 'fa-motorcycle', desc: 'Affordable self-drive bike rentals starting from ₹350/day in beach hubs.' }
    ];

    list.innerHTML = modes.map(m => `
      <div class="safety-card">
        <div class="safety-icon"><i class="fas ${m.icon}"></i></div>
        <h3>${m.name}</h3>
        <p style="font-size:0.9rem; color:var(--text-muted); margin-top:0.5rem;">${m.desc}</p>
      </div>
    `).join('');
  }

  /* Trip Cost Calculator Logic */
  setupCalculator() {
    const form = document.getElementById('trip-calculator-form');
    if (!form) return;

    form.addEventListener('input', () => this.calculateTripCost());
    this.calculateTripCost();
  }

  calculateTripCost() {
    const destSelect = document.getElementById('calc-destination');
    const days = parseInt(document.getElementById('calc-days')?.value || 3);
    const travelers = parseInt(document.getElementById('calc-travelers')?.value || 2);
    const hotelTier = parseFloat(document.getElementById('calc-hotel-tier')?.value || 1.0);
    const foodTier = parseFloat(document.getElementById('calc-food-tier')?.value || 1.0);

    if (!destSelect) return;

    const dest = WANDER_DATA.destinations.find(d => d.id === destSelect.value) || WANDER_DATA.destinations[0];
    const basePerDay = (dest.priceINR / 3);

    const hotelCost = Math.round(basePerDay * 0.6 * days * hotelTier * Math.ceil(travelers / 2));
    const transportCost = Math.round(basePerDay * 0.4 * travelers);
    const foodCost = Math.round(1000 * days * travelers * foodTier);
    const activityCost = Math.round(1500 * travelers);

    const totalINR = hotelCost + transportCost + foodCost + activityCost;

    document.getElementById('calc-hotel-val').textContent = this.formatPrice(hotelCost);
    document.getElementById('calc-transport-val').textContent = this.formatPrice(transportCost);
    document.getElementById('calc-food-val').textContent = this.formatPrice(foodCost);
    document.getElementById('calc-activity-val').textContent = this.formatPrice(activityCost);
    document.getElementById('calc-total-val').textContent = this.formatPrice(totalINR);
  }

  /* Trip Planner Module */
  initTripPlanner() {
    this.renderPlanner();
  }

  addToTripPlanner(destId) {
    this.requireAuth(() => {
      const dest = WANDER_DATA.destinations.find(d => d.id === destId);
      const newTrip = {
        id: Date.now(),
        destName: dest.name,
        days: 3,
        activities: ['Arrival & Hotel Check-in', 'Explore Local Beach / Market', 'Sunset Dinner']
      };
      this.userTrips.push(newTrip);
      localStorage.setItem('wv_trips', JSON.stringify(this.userTrips));
      this.showToast(`Added ${dest.name} to your Trip Planner!`, 'success');
      this.navigateTo('planner');
      this.renderPlanner();
    }, 'Sign in to create and save itineraries in Trip Planner');
  }

  renderPlanner() {
    const container = document.getElementById('planner-days-list');
    if (!container) return;

    if (this.userTrips.length === 0) {
      container.innerHTML = `
        <div style="background:#fff; padding:3rem; border-radius:var(--radius-xl); text-align:center; border:1px solid var(--border-light);">
          <i class="fas fa-map-marked-alt" style="font-size:3rem; color:var(--turquoise); margin-bottom:1rem;"></i>
          <h3>Your Trip Planner is Empty</h3>
          <p style="color:var(--text-muted); margin-bottom:1.5rem;">Explore destinations and add them to create your custom daily itinerary!</p>
          <button class="btn btn-primary" onclick="app.navigateTo('destinations')">Browse Destinations</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.userTrips.map(trip => `
      <div class="planner-day-card">
        <div class="planner-day-header">
          <h3 style="color:var(--primary-navy);"><i class="fas fa-map-pin" style="color:var(--accent-orange);"></i> ${trip.destName} Trip</h3>
          <button class="btn btn-outline btn-sm" onclick="app.deleteTrip(${trip.id})"><i class="fas fa-trash-alt"></i> Remove</button>
        </div>
        ${trip.activities.map((act, i) => `
          <div class="activity-item">
            <div><strong>Day ${i + 1}:</strong> ${act}</div>
            <i class="fas fa-grip-lines" style="color:var(--text-muted); cursor:grab;"></i>
          </div>
        `).join('')}
      </div>
    `).join('');
  }

  deleteTrip(tripId) {
    this.userTrips = this.userTrips.filter(t => t.id !== tripId);
    localStorage.setItem('wv_trips', JSON.stringify(this.userTrips));
    this.renderPlanner();
    this.showToast('Trip removed', 'info');
  }

  /* Wishlist View Renderer */
  renderWishlistView() {
    const grid = document.getElementById('wishlist-grid');
    if (!grid) return;

    if (this.wishlist.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:4rem; background:#fff; border-radius:var(--radius-xl); border:1px solid var(--border-light);">
          <i class="far fa-heart" style="font-size:3.5rem; color:#cbd5e1; margin-bottom:1rem;"></i>
          <h3>Your travel wishlist is empty ✈️</h3>
          <p style="color:var(--text-muted); margin-bottom:1.5rem;">Start exploring destinations and save your dream escapes!</p>
          <button class="btn btn-primary" onclick="app.navigateTo('destinations')">Start Exploring</button>
        </div>
      `;
      return;
    }

    const items = WANDER_DATA.destinations.filter(d => this.wishlist.includes(d.id));
    grid.innerHTML = items.map(d => this.createDestinationCardHTML(d)).join('');
    this.syncWishlistButtons();
  }

  /* User Dashboard Renderer */
  renderDashboardView() {
    if (!this.currentUser) {
      this.openAuthModal('Sign in to view your User Dashboard');
      return;
    }

    document.getElementById('dash-user-name').textContent = this.currentUser.name;
    document.getElementById('dash-user-email').textContent = this.currentUser.email;

    const tripsCount = document.getElementById('dash-trips-count');
    const wishlistCount = document.getElementById('dash-wishlist-count');
    const bookingsCount = document.getElementById('dash-bookings-count');

    if (tripsCount) tripsCount.textContent = this.userTrips.length;
    if (wishlistCount) wishlistCount.textContent = this.wishlist.length;
    if (bookingsCount) bookingsCount.textContent = this.userBookings.length;
  }

  /* Multi-Step Booking Flow */
  startBooking(destId) {
    this.requireAuth(() => {
      const dest = WANDER_DATA.destinations.find(d => d.id === destId) || WANDER_DATA.destinations[0];
      const modal = document.getElementById('booking-modal');
      
      const body = document.getElementById('booking-modal-body');
      body.innerHTML = `
        <div style="text-align:center; margin-bottom:1.5rem;">
          <h2 style="font-size:1.8rem; color:var(--primary-navy);">Complete Your Booking</h2>
          <p style="color:var(--text-muted); font-size:0.9rem;">${dest.name} &bull; ${dest.duration}</p>
        </div>

        <form id="booking-form" onsubmit="event.preventDefault(); app.confirmBooking('${dest.id}');">
          <div class="form-group">
            <label>Travel Dates</label>
            <input type="date" class="form-control" required />
          </div>
          <div class="form-group">
            <label>Number of Travelers</label>
            <select class="form-control" id="booking-travelers" onchange="app.updateBookingTotal(${dest.priceINR})">
              <option value="1">1 Person</option>
              <option value="2" selected>2 Persons</option>
              <option value="3">3 Persons</option>
              <option value="4">4 Persons</option>
            </select>
          </div>
          <div class="form-group">
            <label>Lead Traveler Full Name</label>
            <input type="text" class="form-control" value="${this.currentUser.name}" required />
          </div>
          <div class="form-group">
            <label>Contact Phone</label>
            <input type="tel" class="form-control" placeholder="+91 98765 43210" required />
          </div>

          <div style="background:#f8fafc; padding:1.2rem; border-radius:var(--radius-md); margin-bottom:1.5rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.9rem;">
              <span>Base Package Price:</span>
              <strong id="booking-base-val">${this.formatPrice(dest.priceINR * 2)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; font-size:0.9rem;">
              <span>Taxes & GST (18%):</span>
              <strong id="booking-tax-val">${this.formatPrice(dest.priceINR * 2 * 0.18)}</strong>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:1.1rem; font-weight:800; border-top:1px solid var(--border-light); padding-top:0.6rem; color:var(--ocean-blue);">
              <span>Estimated Total:</span>
              <strong id="booking-total-val">${this.formatPrice(dest.priceINR * 2 * 1.18)}</strong>
            </div>
          </div>

          <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:1.5rem; text-align:center;">
            *Demo Booking Notice: This is an instant demonstration booking receipt. No actual money will be charged.
          </div>

          <button type="submit" class="btn btn-accent btn-lg" style="width:100%;">
            <i class="fas fa-check-circle"></i> Confirm Demo Booking
          </button>
        </form>
      `;

      modal.classList.add('active');
    }, 'Sign in to complete your trip booking');
  }

  updateBookingTotal(basePriceINR) {
    const count = parseInt(document.getElementById('booking-travelers')?.value || 2);
    const base = basePriceINR * count;
    const tax = base * 0.18;
    const total = base + tax;

    document.getElementById('booking-base-val').textContent = this.formatPrice(base);
    document.getElementById('booking-tax-val').textContent = this.formatPrice(tax);
    document.getElementById('booking-total-val').textContent = this.formatPrice(total);
  }

  confirmBooking(destId) {
    const dest = WANDER_DATA.destinations.find(d => d.id === destId);
    const refId = 'WV-' + Math.floor(100000 + Math.random() * 900000);
    
    this.userBookings.push({
      refId,
      destName: dest.name,
      date: new Date().toLocaleDateString(),
      status: 'Confirmed'
    });
    localStorage.setItem('wv_bookings', JSON.stringify(this.userBookings));

    document.getElementById('booking-modal').classList.remove('active');

    this.showToast(`Booking Confirmed! Ref ID: ${refId}`, 'success');
    this.navigateTo('dashboard');
  }

  /* Global Search System */
  setupGlobalSearch() {
    const input = document.getElementById('global-search-input');
    const modal = document.getElementById('search-results-modal');
    const list = document.getElementById('search-results-list');

    if (!input || !modal) return;

    input.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (q.length < 2) {
        modal.classList.remove('active');
        return;
      }

      const matches = WANDER_DATA.destinations.filter(d => 
        d.name.toLowerCase().includes(q) || 
        d.country.toLowerCase().includes(q) || 
        d.overview.toLowerCase().includes(q)
      );

      if (matches.length > 0) {
        list.innerHTML = matches.map(d => `
          <div style="display:flex; align-items:center; gap:1rem; padding:0.8rem; border-bottom:1px solid var(--border-light); cursor:pointer;" onclick="app.openDestinationDetail('${d.id}'); document.getElementById('search-results-modal').classList.remove('active');">
            <img src="${d.image}" style="width:60px; height:60px; border-radius:var(--radius-md); object-fit:cover;" />
            <div>
              <h4 style="font-size:1rem; color:var(--primary-navy);">${d.name}, ${d.country}</h4>
              <div style="font-size:0.8rem; color:var(--text-muted);">${d.type} &bull; ${app.formatPrice(d.priceINR)}</div>
            </div>
          </div>
        `).join('');
      } else {
        list.innerHTML = `<div style="padding:1.5rem; text-align:center; color:var(--text-muted);">No results found for "${q}"</div>`;
      }

      modal.classList.add('active');
    });
  }

  /* Leaflet Interactive Map */
  initLeafletMap() {
    const container = document.getElementById('map-container');
    if (!container || typeof L === 'undefined') return;

    this.leafletMap = L.map('map-container').setView([20.5937, 78.9629], 4);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(this.leafletMap);

    WANDER_DATA.destinations.forEach(dest => {
      if (dest.lat && dest.lng) {
        const marker = L.marker([dest.lat, dest.lng]).addTo(this.leafletMap);
        marker.bindPopup(`
          <div style="width:180px; text-align:center;">
            <img src="${dest.image}" style="width:100%; height:90px; border-radius:8px; object-fit:cover; margin-bottom:0.4rem;" />
            <h4 style="font-size:0.95rem; margin-bottom:0.2rem;">${dest.name}</h4>
            <div style="font-size:0.8rem; color:var(--ocean-blue); font-weight:700;">Starting ${this.formatPrice(dest.priceINR)}</div>
            <button style="margin-top:0.5rem; background:var(--turquoise); color:#fff; border:none; padding:0.3rem 0.8rem; border-radius:12px; font-size:0.75rem; cursor:pointer;" onclick="app.openDestinationDetail('${dest.id}')">Explore</button>
          </div>
        `);
      }
    });
  }

  /* Toast Notification Utility */
  showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}" style="color:var(--turquoise);"></i> ${message}`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  /* Event Listeners Setup */
  setupEventListeners() {
    // Navigation Links
    document.querySelectorAll('[data-view]').forEach(elem => {
      elem.addEventListener('click', (e) => {
        e.preventDefault();
        const view = elem.getAttribute('data-view');
        this.navigateTo(view);

        // Close mobile drawer if open
        document.querySelector('.nav-links')?.classList.remove('active');
      });
    });

    // Mobile Hamburger
    const hamburger = document.getElementById('hamburger-btn');
    if (hamburger) {
      hamburger.addEventListener('click', () => {
        document.querySelector('.nav-links')?.classList.toggle('active');
      });
    }

    // Currency Selector
    const currencySelect = document.getElementById('currency-select');
    if (currencySelect) {
      currencySelect.value = this.currentCurrency;
      currencySelect.addEventListener('change', (e) => {
        this.currentCurrency = e.target.value;
        localStorage.setItem('wv_currency', this.currentCurrency);
        this.showToast(`Currency changed to ${this.currentCurrency}`, 'info');
        
        // Re-render active views
        this.renderHomeViews();
        this.renderDestinationsView();
        this.renderToursView();
        this.renderHotelsView();
        this.renderFoodView();
        this.setupCalculator();
      });
    }

    // Modal Closers
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.closest('.modal-overlay').classList.remove('active');
      });
    });

    // Auth Form Tabs
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const isSignIn = tab.getAttribute('data-tab') === 'signin';
        document.getElementById('signin-form').style.display = isSignIn ? 'block' : 'none';
        document.getElementById('signup-form').style.display = isSignIn ? 'none' : 'block';
      });
    });

    // Auth Forms Submissions
    document.getElementById('signin-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email').value;
      const pass = document.getElementById('signin-password').value;
      this.login(email, pass);
    });

    document.getElementById('signup-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('signup-name').value;
      const email = document.getElementById('signup-email').value;
      const phone = document.getElementById('signup-phone').value;
      const pass = document.getElementById('signup-password').value;
      this.register(name, email, phone, pass);
    });

    // Global Search setup
    this.setupGlobalSearch();
  }
}

// Global App Instance
let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new WanderVistaApp();
});
