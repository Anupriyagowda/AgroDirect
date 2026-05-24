async function fetchCategories() {
    try {
        const response = await fetch("/admin/categories");
        const categories = await response.json();
        const categoriesContainer = document.getElementById("categories-container");

        if (!categoriesContainer) return;
        categoriesContainer.innerHTML = "";

        const fallbackCategories = [
            { name: 'vegetables', displayName: 'Vegetables', image: '' },
            { name: 'fruits', displayName: 'Fruits', image: '' },
            { name: 'grains', displayName: 'Grains', image: '' },
            { name: 'oilextracts', displayName: 'Oil Extracts', image: '' },
            { name: 'saplings', displayName: 'Saplings', image: '' },
            { name: 'seeds', displayName: 'Seeds', image: '' }
        ];

        const categoryList = Array.isArray(categories) ? categories : fallbackCategories;

        // Common category images mapping for premium look
        const categoryImages = {
            'vegetables': '../shopnow_images/vegetableimg.webp'
        };

        // Metadata for modern category descriptions and tags
        const catMetadata = {
            'vegetables': { tag: 'Fresh', desc: 'Farm-fresh vegetables harvested at peak ripeness' },
            'fruits': { tag: 'Seasonal', desc: 'Sweet and juicy fruits, naturally ripened' },
            'seeds': { tag: 'Organic', desc: 'High-quality seeds for your home garden' },
            'oil': { tag: 'Pure', desc: 'Cold-pressed authentic pure oils' },
            'default': { tag: 'Organic', desc: 'Discover our premium authentic natural produce.' }
        };

        categoryList.forEach(cat => {
            const img = (cat.image && typeof cat.image === 'string' && cat.image.trim() !== '') 
                        ? cat.image 
                        : (categoryImages[cat.name] || '../shopnow_images/vegetableimg.webp');
            
            const meta = catMetadata[cat.name.toLowerCase()] || catMetadata['default'];

            const catCard = `
                <div class="col">
                    <div class="card h-100 border-0 shadow-sm hover-lift category-hover-card" style="border-radius: 12px; overflow: hidden; transition: transform 0.3s ease, box-shadow 0.3s ease;">
                        <div style="position: relative;">
                            <span class="badge bg-success" style="position: absolute; top: 15px; left: 15px; font-weight: 600; font-size: 0.8rem; padding: 6px 12px; border-radius: 8px;">${meta.tag}</span>
                            <img src="${img}" class="card-img-top" alt="${cat.displayName}" style="height: 220px; object-fit: cover;">
                        </div>
                        <div class="card-body text-center p-4 bg-white d-flex flex-column">
                            <h4 class="fw-bold mb-3" style="color: #1b5e20;">${cat.displayName}</h4>
                            <p class="text-muted small mb-4 flex-grow-1" style="line-height: 1.5;">${meta.desc}</p>
                            <a href="../shopnow.html?category=${cat.name}" class="btn btn-success rounded-pill w-75 mx-auto fw-semibold py-2" style="background-color: #2e7d32; border: none; transition: background-color 0.3s;">
                                View Products <i class="fas fa-arrow-right ms-1"></i>
                            </a>
                        </div>
                    </div>
                </div>
            `;
            categoriesContainer.innerHTML += catCard;
        });

        // Fetch products for the first category as "Featured"
        if (categoryList.length > 0) {
            fetchFeaturedProducts(categoryList[0].name);
        }
    } catch (error) {
        console.error("Error fetching categories:", error);
    }
}

async function fetchFeaturedProducts(category) {
    try {
        const response = await fetch(`/client/${category}`);
        const products = await response.json();
        const productsContainer = document.getElementById("featured-products-container");

        if (!productsContainer) return;
        productsContainer.innerHTML = "";

        // Show top 4 products as featured
        const featured = products.slice(0, 4);

        let cart = JSON.parse(sessionStorage.getItem('cart')) || [];
        // Determine user role
        let role = 'consumer';
        try {
            var user = localStorage.getItem('agroUser');
            role = user ? (JSON.parse(user).role || 'consumer') : 'consumer';
        } catch(e) {}

        featured.forEach(product => {
            const productId = product.name.replace(/\s+/g, '-');
            const inCart = cart.some(item => item.name === product.name);
            let addCartBtn = '';
            if (role === 'consumer') {
                addCartBtn = `<button class="btn ${inCart ? 'btn-danger' : 'btn-success'} btn-sm w-100" 
                        id="home-cart-btn-${productId}"
                        onclick="${inCart ? `removeFromHomeCart('${product.name}')` : `addToHomeCart('${product.name}', ${product.price}, '${product.sellerEmail || 'admin@agrodirect.com'}')`}">
                    <span data-i18n="${inCart ? 'remove' : 'addToCart'}">${inCart ? 'Remove' : 'Add to Cart'}</span>
                </button>`;
            }
            const productCard = `
                <div class="col">
                    <div class="card h-100 border-0 glass-card hover-lift shadow-sm">
                        <div class="position-relative">
                            <img src="${product.img}" class="card-img-top" alt="${product.name}" style="height: 180px; object-fit: cover; border-radius: 15px 15px 0 0;">
                            <span class="badge bg-success position-absolute top-0 end-0 m-3" data-i18n="organic">Organic</span>
                        </div>
                        <div class="card-body text-center p-3">
                            <h5 class="fw-bold mb-1">${product.name}</h5>
                            <p class="text-muted small mb-2 text-truncate">${product.desc}</p>
                            <h6 class="text-success fw-bold mb-3">₹${product.price} / kg</h6>
                            ${addCartBtn}
                        </div>
                    </div>
                </div>
            `;
            productsContainer.innerHTML += productCard;
        });

        // Re-apply translation for new elements
        if (window.applyLanguage) {
            window.applyLanguage(localStorage.getItem('agroDirectLang') || 'en-US');
        }
    } catch (error) {
        console.error("Error fetching products:", error);
    }
}

window.addToHomeCart = async function (itemName, itemPrice, sellerEmail) {
    const token = localStorage.getItem('agroToken');
    if (!token) {
        Toast.warn('Please login to add items to cart');
        window.location.href = '../index.html';
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
                quantity: 1,
                unit: 'kg'
            })
        });

        if (response.status === 503) {
            Toast.error('Failed to add item to cart');
            return;
        }

        if (!response.ok) throw new Error('Failed to add to cart');

        updateHomeCartUI(itemName, true);
        Toast.success(`${itemName} added to cart!`);
        if (window.VoiceGuidance) {
            window.VoiceGuidance.addedToCart(itemName);
        }
    } catch (err) {
        console.error("Error adding to cart:", err);
        Toast.error('Failed to add item to cart');
    }
};

window.removeFromHomeCart = async function (itemName) {
    const token = localStorage.getItem('agroToken');
    if (!token) {
        Toast.warn('Please login to manage your cart');
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

        const response = await fetch('/api/cart/remove', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ itemId: item._id })
        });

        if (!response.ok) throw new Error('Failed to remove from cart');

        updateHomeCartUI(itemName, false);
        Toast.info(`${itemName} removed from cart.`);
    } catch (err) {
        console.error("Error removing from cart:", err);
        Toast.error('Failed to remove item from cart');
    }
};

function updateHomeCartUI(itemName, inCart, price) {
    const productId = itemName.replace(/\s+/g, '-');
    const btn = document.getElementById(`home-cart-btn-${productId}`);
    if (btn) {
        if (inCart) {
            btn.classList.replace('btn-success', 'btn-danger');
            btn.innerHTML = `<span data-i18n="remove">Remove</span>`;
            btn.onclick = () => removeFromHomeCart(itemName);
        } else {
            btn.classList.replace('btn-danger', 'btn-success');
            btn.innerHTML = `<span data-i18n="addToCart">Add to Cart</span>`;
            btn.onclick = () => addToHomeCart(itemName, price);
        }

        // Re-apply translation
        if (window.applyLanguage) {
            window.applyLanguage(localStorage.getItem('agroDirectLang') || 'en-US');
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    fetchCategories();
});
