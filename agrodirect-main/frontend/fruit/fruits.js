
async function fetchFruits() {
  try {
    const response = await fetch("/client/fruits");
    const fruits = await response.json();

    const fruitContainer = document.getElementById("fruit-container");
    fruitContainer.innerHTML = ""; // Clear previous content

    // Get current cart items
    let cart = JSON.parse(sessionStorage.getItem('cart')) || [];

    // Generate fruit cards dynamically
    fruits.forEach(fruit => {
      const fruitId = fruit.name.replace(/\s+/g, '-');
      const inCart = cart.some(item => item.name === fruit.name);
      
      // Real seller/farmer info and rating from backend
      const sellerName = fruit.sellerName || fruit.sellerEmail || 'Registered Seller';
      const sellerEmail = fruit.sellerEmail || 'N/A';
      const avgRating = fruit.avgRating || 0;
      const ratingCount = fruit.ratingCount || 0;

      // Fetch reviews for this fruit (Note: this is usually better done in parallel or pre-fetched, but I'll keep it simple for now)
      let reviews = [];
      // We don't need to re-fetch reviews individually here if we just want to show the basic info
      // But stay consistent with the existing structure if possible
      // Out of stock logic
      const stock = typeof fruit.stock === 'number' ? fruit.stock : 10;
      let outOfStockMsg = '';
      let addCartBtn = '';
      let role = 'consumer';
      try {
        var user = localStorage.getItem('agroUser');
        role = user ? (JSON.parse(user).role || 'consumer') : 'consumer';
      } catch(e) {}
      if (stock <= 0) {
        outOfStockMsg = `<div class=\"alert alert-warning p-1 mt-2 mb-2\" style=\"font-size:0.95em;\">Currently out of stock, will be added soon.</div>`;
      }
      if (role === 'consumer') {
        if (stock > 0) {
          addCartBtn = `<button class=\"btn ${inCart ? 'btn-danger' : 'btn-success'} w-100\" 
                  onclick=\"${inCart ? `removeFromCart('${fruit.name}')` : `addToCart('${fruit.name}', ${fruit.price}, '${fruit.img}')`}\" 
                  id=\"cart-btn-${fruitId}\">
            <span data-i18n=\"${inCart ? 'removeFromCart' : 'addToCart'}\">${inCart ? 'Remove from Cart' : 'Add to Cart'}</span>
          </button>`;
        } else {
          addCartBtn = `<button class=\"btn btn-secondary w-100\" disabled>Out of Stock</button>`;
        }
      }
      // Review form (only for logged-in consumers)
      let reviewForm = '';
      if (role === 'consumer' && localStorage.getItem('agroToken')) {
        reviewForm = `
          <div class="review-form mt-3 border-top pt-3">
            <h6 class="mb-2 text-start small fw-bold">Rate this product:</h6>
            <div class="d-flex mb-2">
                <select id="review-rating-${fruitId}" class="form-select form-select-sm w-auto me-2">
                  <option value="">Rating</option>
                  <option value="5">5 ★</option>
                  <option value="4">4 ★</option>
                  <option value="3">3 ★</option>
                  <option value="2">2 ★</option>
                  <option value="1">1 ★</option>
                </select>
                <input type="text" id="review-feedback-${fruitId}" class="form-control form-control-sm" placeholder="Add a comment..." />
            </div>
            <button class="btn btn-sm btn-primary w-100" onclick="submitReview('${fruit.id}','fruits','${fruitId}','${fruit.name.replace(/'/g, "\\'")}','${fruit.sellerEmail || 'admin@agrodirect.com'}')" data-i18n="submit">Submit Review</button>
          </div>
        `;
      }
      // Reviews display
      let reviewsHtml = '';
      if (fruit.reviews && fruit.reviews.length > 0) {
        reviewsHtml = `<div class="reviews-list mt-3 border-top pt-2"><h6 class="small fw-bold text-start mb-2" data-i18n="productReviews">Recent Reviews:</h6>` +
          fruit.reviews.slice(0, 3).map(r => `<div class="review-item border rounded p-2 mb-2 text-start bg-light" style="font-size: 0.85rem;">
            <div class="d-flex justify-content-between">
                <b>${r.userName || 'Anonymous'}</b>
                <span class="text-warning">${'★'.repeat(r.rating)}</span>
            </div>
            <div class="text-muted mt-1">${r.comment || ''}</div>
          </div>`).join('') + '</div>';
      }
      const fruitCard = `
        <div class=\"col\">
          <div class=\"card product-card\">
            <div class=\"product-badge\" data-i18n=\"organic\">Organic</div>
            <img src=\"${fruit.img}\" class=\"card-img-top product-img\" alt=\"${fruit.name}\" onerror=\"this.src='https://via.placeholder.com/150?text=No+Image'\">
            <div class=\"card-body text-center\">
              <h5 class=\"product-title\">${fruit.name}</h5>
              <p class=\"product-description\">${fruit.desc}</p>
              <p class=\"product-price\">₹${fruit.price} / kg</p>
              <div class=\"seller-info mt-2 mb-2\">
                <span class=\"badge bg-info text-dark\"><i class=\"fas fa-user me-1\"></i>Farmer: ${sellerName}</span><br>
                <small class=\"text-muted\">${sellerEmail}</small>
              </div>
              <div class=\"product-rating mb-2\">
                <span class=\"star-rating\" id=\"star-rating-${fruitId}\"></span>
                <span class=\"text-warning\">${avgRating ? avgRating.toFixed(1) : '0.0'} ★</span>
                <small class=\"text-muted\">(${ratingCount} ratings)</small>
              </div>
              ${reviewForm}
              ${reviewsHtml}
            </div>
            <div class=\"quantity-selector\">
              <button class=\"btn btn-sm btn-outline-secondary\" onclick=\"decrementQuantity('${fruit.name}')\">-</button>
              <input type=\"number\" class=\"form-control quantity-input\" id=\"quantity-${fruitId}\" value=\"1\" min=\"0.1\" step=\"0.1\">
              <button class=\"btn btn-sm btn-outline-secondary\" onclick=\"incrementQuantity('${fruit.name}')\">+</button>
            </div>
            <div class=\"unit-selector\">
              <select class=\"form-select\" id=\"unit-${fruitId}\">
                <option value=\"kg\">Kilogram (kg)</option>
                <option value=\"g\">Gram (g)</option>
              </select>
            </div>
            <button class=\"btn ${inCart ? 'btn-danger' : 'btn-success'} w-100\" 
                  onclick=\"${inCart ? `removeFromCart('${fruit.name}')` : `addToCart('${fruit.name}', ${fruit.price}, '${fruit.img}', '${sellerEmail}')`}\" 
                  id=\"cart-btn-${fruitId}\">
             <span data-i18n=\"${inCart ? 'removeFromCart' : 'addToCart'}\">${inCart ? 'Remove from Cart' : 'Add to Cart'}</span>
            </button>
          </div>
        </div>
      `;
      fruitContainer.innerHTML += fruitCard + outOfStockMsg;
      setTimeout(() => renderStars(`star-rating-${fruitId}`, avgRating), 0);
    });
// Render static stars for average rating
function renderStars(elementId, avgRating) {
  const el = document.getElementById(elementId);
  if (!el) return;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<i class="fas fa-star${i <= Math.round(avgRating) ? '' : '-o'} text-warning"></i>`;
  }
  el.innerHTML = html;
}


// Real review submission handler
window.submitReview = async function(productId, productType, fruitId, productName, sellerEmail) {
  const ratingSelect = document.getElementById(`review-rating-${fruitId}`);
  const feedbackInput = document.getElementById(`review-feedback-${fruitId}`);
  const rating = ratingSelect.value;
  const comment = feedbackInput.value;
  
  if (!rating) {
    if (window.Toast) Toast.show('Please select a rating!', 'warning');
    else alert('Please select a rating!');
    return;
  }

  let user = {};
  try {
      user = JSON.parse(localStorage.getItem('agroUser') || '{}');
  } catch(e) {}

  try {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
          productName, 
          category: productType, 
          sellerEmail: sellerEmail || 'admin@agrodirect.com',
          userName: user.name || 'Anonymous',
          userEmail: user.email || 'N/A',
          rating: parseInt(rating), 
          comment 
      })
    });
    
    if (res.ok) {
      if (window.Toast) Toast.show('Thank you for your review!', 'success');
      else alert('Thank you for your review!');
      
      ratingSelect.value = '';
      feedbackInput.value = '';
      // Reload fruits to show updated rating info
      fetchFruits();
    } else {
      const data = await res.json();
      if (window.Toast) Toast.show(data.error || 'Failed to submit review', 'error');
      else alert(data.error || 'Failed to submit review');
    }
  } catch (e) {
    console.error("Review Error:", e);
    if (window.Toast) Toast.show('Failed to submit review', 'error');
    else alert('Failed to submit review');
  }
};

    // Re-apply translation
    if (window.applyLanguage) {
      window.applyLanguage(localStorage.getItem('agroDirectLang') || 'en-US');
    }
  } catch (error) {
    console.error("Error fetching fruits:", error);
  }
}

function incrementQuantity(fruitName) {
  const inputId = `quantity-${fruitName.replace(/\s+/g, '-')}`;
  const input = document.getElementById(inputId);
  input.value = (parseFloat(input.value) + 0.1).toFixed(1);
}

function decrementQuantity(fruitName) {
  const inputId = `quantity-${fruitName.replace(/\s+/g, '-')}`;
  const input = document.getElementById(inputId);
  if (parseFloat(input.value) > 0.1) {
    input.value = (parseFloat(input.value) - 0.1).toFixed(1);
  }
}
async function addToCart(itemName, itemPrice, itemImg, sellerEmail) {
  const quantityId = `quantity-${itemName.replace(/\s+/g, '-')}`;
  const unitId = `unit-${itemName.replace(/\s+/g, '-')}`;
  const btnId = `cart-btn-${itemName.replace(/\s+/g, '-')}`;

  const quantity = parseFloat(document.getElementById(quantityId).value);
  const unit = document.getElementById(unitId).value;
  const token = localStorage.getItem('agroToken');

  if (!token) {
    alert('Please login to add items to cart');
    window.location.href = '/index.html'; // Redirect to login
    return;
  }

  try {
    const response = await fetch('/api/cart/add', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        name: itemName,
        price: itemPrice,
        quantity: quantity,
        unit: unit,
        type: 'fruit',
        img: itemImg,
        sellerEmail: sellerEmail || 'admin@agrodirect.com'
      })
    });

    if (response.status === 503) {
      if (typeof Toast !== 'undefined') Toast.error('Failed to add item to cart');
      else alert('Failed to add item to cart');
      return;
    }

    if (!response.ok) throw new Error('Failed to add to cart');

    // Update UI
    const btn = document.getElementById(btnId);
    btn.classList.remove('btn-success');
    btn.classList.add('btn-danger');
    btn.innerHTML = '<span data-i18n="removeFromCart">Remove from Cart</span>';
    btn.onclick = () => removeFromCart(itemName);

    if (window.applyLanguage) {
      window.applyLanguage(localStorage.getItem('agroDirectLang') || 'en-US');
    }

    if (typeof Toast !== 'undefined') Toast.success(`${quantity} ${unit} of ${itemName} added to cart`);
    else alert(`${quantity} ${unit} of ${itemName} added to cart`);
    if (window.VoiceGuidance) {
      window.VoiceGuidance.addedToCart(itemName);
    }

    if (window.VoiceGuidance) {
        if (window.VoiceGuidance) {
            window.VoiceGuidance.addedToCart(itemName);
        }
    }
  } catch (err) {
    console.error("Error adding to cart:", err);
    if (typeof Toast !== 'undefined') Toast.error('Failed to add item to cart');
    else alert('Failed to add item to cart');
  }
}

async function removeFromCart(itemName) {
  const token = localStorage.getItem('agroToken');
  const btnId = `cart-btn-${itemName.replace(/\s+/g, '-')}`;

  if (!token) {
    if (typeof Toast !== 'undefined') Toast.warn('Please login to manage your cart');
    else alert('Please login to manage your cart');
    return;
  }

  try {
    // Fetch user's cart to get the item ID
    const cartResponse = await fetch('/api/cart', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const { cart } = await cartResponse.json();
    const item = cart.find(item => item.name === itemName);

    if (!item) throw new Error('Item not found in cart');

    // Remove item by ID
    const response = await fetch('/api/cart/remove', {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ itemId: item._id })
    });

    if (!response.ok) throw new Error('Failed to remove from cart');

    // Update UI
    const btn = document.getElementById(btnId);
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-success');
    btn.innerHTML = '<span data-i18n="addToCart">Add to Cart</span>';
    btn.onclick = () => addToCart(itemName, item.price);

    if (window.applyLanguage) {
      window.applyLanguage(localStorage.getItem('agroDirectLang') || 'en-US');
    }

    if (typeof Toast !== 'undefined') Toast.info(`${itemName} removed from cart`);
    else alert(`${itemName} removed from cart`);
    
    if (window.VoiceGuidance) {
      window.VoiceGuidance.removedFromCart(itemName);
    }
  } catch (err) {
    console.error("Error removing from cart:", err);
    if (typeof Toast !== 'undefined') Toast.error('Failed to remove item from cart');
    else alert('Failed to remove item from cart');
  }
}

// Load fruits when page is fully loaded
document.addEventListener("DOMContentLoaded", () => {
  fetchFruits();

  // Search filtering logic
  const searchBox = document.querySelector('.search-box');
  if (searchBox) {
    searchBox.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      const cards = document.querySelectorAll('#fruit-container .col');
      
      cards.forEach(card => {
        const title = card.querySelector('.product-title')?.textContent.toLowerCase() || "";
        const desc = card.querySelector('.product-description')?.textContent.toLowerCase() || "";
        if (title.includes(term) || desc.includes(term)) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
      // show no-results message if nothing visible
      const anyVisible = Array.from(document.querySelectorAll('#fruit-container .col')).some(c => c.style.display !== 'none');
      let noResults = document.querySelector('#fruit-container .no-results');
      if (!anyVisible) {
        if (!noResults) {
          noResults = document.createElement('div');
          noResults.className = 'no-results text-center w-100 mt-3';
          noResults.textContent = 'This product is not available or no farmer added this product.';
          document.getElementById('fruit-container').appendChild(noResults);
        }
      } else {
        if (noResults) noResults.remove();
      }
    });
  }
});
