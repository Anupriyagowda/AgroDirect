document.addEventListener("DOMContentLoaded", function () {
    const searchBox = document.querySelector(".search-box");
    const cardContainers = document.querySelectorAll(".col"); // Select column divs

    if (searchBox) {
        searchBox.addEventListener("input", function () {
            const searchTerm = searchBox.value.toLowerCase().trim();

            if (searchTerm === "") {
                // Show all cards when search is empty
                cardContainers.forEach(col => col.style.display = "block");
                return;
            }

            let found = false;
            cardContainers.forEach(col => {
                const title = col.querySelector(".product-title").textContent.toLowerCase();

                if (title.includes(searchTerm)) {
                    col.style.display = "block"; // Show matching cards
                    found = true;
                } else {
                    col.style.display = "none"; // Hide non-matching cards
                }
            });

            // If no matches are found, optionally show a "No results" message
            let noResults = document.querySelector(".no-results");
            if (!found) {
                if (!noResults) {
                    noResults = document.createElement("div");
                    noResults.className = "no-results text-center w-100 mt-3";
                    noResults.textContent = "This product is not available or no farmer added this product.";
                    document.querySelector(".row").appendChild(noResults);
                }
            } else {
                if (noResults) noResults.remove();
            }
        });
    }
});
