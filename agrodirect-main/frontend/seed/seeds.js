async function fetchSeeds() {
    try {
        const response = await fetch("/client/seeds");
        const seedsData = await response.json();

        const seedsContainer = document.getElementById("seeds-container");
        seedsContainer.innerHTML = ""; // Clear previous content

        // Get current cart items
        let cart = JSON.parse(sessionStorage.getItem('cart')) || [];

        // Generate dynamic cards
        seedsData.forEach(item => {
            const itemId = item.name.replace(/\s+/g, '-');
            const inCart = cart.some(cartItem => cartItem.name === item.name);
            // Real seller/farmer info and rating from backend
            const sellerName = item.sellerName || item.sellerEmail || 'Registered Seller';
            const sellerEmail = item.sellerEmail || 'N/A';
            const avgRating = item.avgRating || 0;
            const ratingCount = item.ratingCount || 0;
            // Determine user role
            let role = 'consumer';
            try {
                var user = localStorage.getItem('agroUser');
                role = user ? (JSON.parse(user).role || 'consumer') : 'consumer';
            } catch(e) {}
            let addCartBtn = '';
            if (role === 'consumer') {
                addCartBtn = `<button class="btn ${inCart ? 'btn-danger' : 'btn-success'} w-100 cart-btn" 
                        onclick="${inCart ? `removeFromCart('${item.name}', ${item.price})` : `addToCart('${item.name}', ${item.price}, '${item.img}', '${sellerEmail}')`}" 
                        id="cart-btn-${itemId}"
                        data-i18n="${inCart ? 'removeFromCart' : 'addToCart'}">
                    ${inCart ? 'Remove from Cart' : 'Add to Cart'}
                </button>`;
            }

            // Review form (only for logged-in consumers)
            let reviewForm = '';
            if (role === 'consumer' && localStorage.getItem('agroToken')) {
              reviewForm = `
                <div class="review-form mt-3 border-top pt-3">
                  <h6 class="mb-2 text-start small fw-bold">Rate this product:</h6>
                  <div class="d-flex mb-2">
                      <select id="review-rating-${itemId}" class="form-select form-select-sm w-auto me-2">
                        <option value="">Rating</option>
                        <option value="5">5 ★</option>
                        <option value="4">4 ★</option>
                        <option value="3">3 ★</option>
                        <option value="2">2 ★</option>
                        <option value="1">1 ★</option>
                      </select>
                      <input type="text" id="review-feedback-${itemId}" class="form-control form-control-sm" placeholder="Add a comment..." />
                  </div>
                  <button class="btn btn-sm btn-primary w-100" onclick="submitReview('${item.id}','seeds','${itemId}','${item.name.replace(/'/g, "\\'")}','${item.sellerEmail || 'admin@agrodirect.com'}')" data-i18n="submit">Submit Review</button>
                </div>
              `;
            }

            // Reviews display
            let reviewsHtml = '';
            if (item.reviews && item.reviews.length > 0) {
              reviewsHtml = `<div class="reviews-list mt-3 border-top pt-2"><h6 class="small fw-bold text-start mb-2" data-i18n="productReviews">Recent Reviews:</h6>` +
                item.reviews.slice(0, 3).map(r => `<div class="review-item border rounded p-2 mb-2 text-start bg-light" style="font-size: 0.85rem;">
                  <div class="d-flex justify-content-between">
                      <b>${r.userName || 'Anonymous'}</b>
                      <span class="text-warning">${'★'.repeat(r.rating)}</span>
                  </div>
                  <div class="text-muted mt-1">${r.comment || ''}</div>
                </div>`).join('') + '</div>';
            }

            const seedCard = `
                <div class="col">
                    <div class="card product-card">
                        <div class="product-badge" data-i18n="organic">Organic</div>
                        <img src="${item.img}" class="card-img-top product-img" alt="${item.name}" onerror="this.src='https://via.placeholder.com/150?text=No+Image'">
                        <div class="card-body text-center">
                            <h5 class="product-title">${item.name}</h5>
                            <p class="product-description">${item.desc}</p>
                            <p class="product-price">₹${item.price} / packet</p>
                            <div class="seller-info mt-2 mb-2">
                                <span class="badge bg-info text-dark"><i class="fas fa-user me-1"></i>Seller: ${sellerName}</span><br>
                                <small class="text-muted">${sellerEmail}</small>
                            </div>
                            <div class="product-rating mb-2">
                                <span class="star-rating" id="star-rating-${itemId}"></span>
                                <span class="text-warning">${avgRating.toFixed(1)} ★</span>
                                <small class="text-muted">(${ratingCount} ratings)</small>
                            </div>
                            ${reviewForm}
                            ${reviewsHtml}
                        </div>
                        <div class="quantity-selector">
                            <button class="btn btn-sm btn-outline-secondary" onclick="decrementQuantity('${item.name}')">-</button>
                            <input type="number" class="form-control quantity-input" id="quantity-${itemId}" value="1" min="1" step="1">
                            <button class="btn btn-sm btn-outline-secondary" onclick="incrementQuantity('${item.name}')">+</button>
                        </div>
                        <div class="unit-selector">
                            <select class="form-select" id="unit-${itemId}">
                                <option value="packet">Packet</option>
                                <option value="kg">Kilogram (kg)</option>
                            </select>
                        </div>
                        ${addCartBtn}
                    </div>
                </div>
            `;
            seedsContainer.innerHTML += seedCard;
            // Render static stars for average rating
            setTimeout(() => renderStars(`star-rating-${itemId}`, avgRating), 0);
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

// Dummy submit rating handler
window.submitRating = function(seedId) {
    const select = document.getElementById(`rate-${seedId}`);
    if (!select || !select.value) {
        alert('Please select a rating!');
        return;
    }
    alert('Thank you for rating! (Demo: not saved)');
    select.value = '';
};

        // Apply translations after rendering
        if (window.applyLanguage) {
            window.applyLanguage();
        }
    } catch (error) {
        console.error("Error fetching seeds:", error);
    }
}

function incrementQuantity(seedName) {
    const inputId = `quantity-${seedName.replace(/\s+/g, '-')}`;
    const input = document.getElementById(inputId);
    input.value = parseInt(input.value) + 1;
}

function decrementQuantity(seedName) {
    const inputId = `quantity-${seedName.replace(/\s+/g, '-')}`;
    const input = document.getElementById(inputId);
    if (parseInt(input.value) > 1) {
        input.value = parseInt(input.value) - 1;
    }
}

async function addToCart(itemName, itemPrice, itemImg, sellerEmail) {
    try {
        const quantityId = `quantity-${itemName.replace(/\s+/g, '-')}`;
        const unitId = `unit-${itemName.replace(/\s+/g, '-')}`;
        const btnId = `cart-btn-${itemName.replace(/\s+/g, '-')}`;

        const quantity = parseFloat(document.getElementById(quantityId).value);
        const unit = document.getElementById(unitId).value;
        const token = localStorage.getItem('agroToken');

        if (!token) {
            alert('Please login to add items to cart');
            window.location.href = '/index.html';
            return;
        }

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
                type: 'product',
                img: itemImg,
                sellerEmail: sellerEmail || 'admin@agrodirect.com'
            })
        });

        if (response.status === 503) {
            if (window.Toast) {
                Toast.show('Failed to add item to cart', 'error');
            } else {
                alert('Failed to add item to cart');
            }
            return;
        }

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to add to cart');
        }

        // Update UI
        const btn = document.getElementById(btnId);
        btn.classList.remove('btn-success');
        btn.classList.add('btn-danger');
        btn.setAttribute('data-i18n', 'removeFromCart');
        btn.onclick = () => removeFromCart(itemName, itemPrice, itemImg);

        // Re-apply translation to the button
        if (window.applyLanguage) {
            window.applyLanguage();
        }

        if (window.Toast) {
            Toast.show(`${itemName} added to cart`, 'success');
        } else {
            alert(`${itemName} added to cart`);
        }
        if (window.VoiceGuidance) {
            window.VoiceGuidance.addedToCart(itemName);
        }

        if (window.VoiceGuidance) {
            window.VoiceGuidance.addedToCart(itemName);
        }
    } catch (err) {
        console.error("Error adding to cart:", err);
        if (window.Toast) {
            Toast.show('Error adding to cart', 'error');
        } else {
            alert('Failed to add item to cart');
        }
    }
}

async function removeFromCart(itemName, itemPrice) {
    const token = localStorage.getItem('agroToken');
    const btnId = `cart-btn-${itemName.replace(/\s+/g, '-')}`;

    if (!token) {
        alert('Please login to manage your cart');
        return;
    }

    try {
        // Fetch user's cart to get the item ID
        const cartResponse = await fetch('/api/cart', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const { cart } = await cartResponse.json();
        const item = cart.find(item => item.name === itemName && item.type === 'product');

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
        btn.setAttribute('data-i18n', 'addToCart');
        btn.onclick = () => addToCart(itemName, item.price);

        // Re-apply translation to the button
        if (window.applyLanguage) {
            window.applyLanguage();
        }

        if (window.Toast) {
            Toast.show(`${itemName} removed from cart`, 'info');
        } else {
            alert(`${itemName} removed from cart`);
        }
        
        if (window.VoiceGuidance) {
            window.VoiceGuidance.removedFromCart(itemName);
        }
    } catch (err) {
        console.error("Error removing from cart:", err);
        if (window.Toast) {
            Toast.show('Error removing from cart', 'error');
        } else {
            alert('Failed to remove item from cart');
        }
    }
}
// Submit review function
window.submitReview = async function(productId, productType, itemId, productName, sellerEmail) {
    const ratingSelect = document.getElementById(`review-rating-${itemId}`);
    const feedbackInput = document.getElementById(`review-feedback-${itemId}`);
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
            // Reload seeds to show updated rating info
            fetchSeeds();
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
// Load seeds when page is fully loaded
document.addEventListener("DOMContentLoaded", () => {
    fetchSeeds();

    // Search filtering logic
    const searchBox = document.querySelector('.search-box');
    if (searchBox) {
        searchBox.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase().trim();
            const cards = document.querySelectorAll('#seeds-container .col');
            
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
            const anyVisible = Array.from(document.querySelectorAll('#seeds-container .col')).some(c => c.style.display !== 'none');
            let noResults = document.querySelector('#seeds-container .no-results');
            if (!anyVisible) {
                if (!noResults) {
                    noResults = document.createElement('div');
                    noResults.className = 'no-results text-center w-100 mt-3';
                    noResults.textContent = 'This product is not available or no farmer added this product.';
                    document.getElementById('seeds-container').appendChild(noResults);
                }
            } else {
                if (noResults) noResults.remove();
            }
        });
    }
});
