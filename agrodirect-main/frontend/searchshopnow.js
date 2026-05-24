document.addEventListener("DOMContentLoaded", function () {
    const searchBox = document.querySelector(".search-box");
    const cards = document.querySelectorAll(".card");
    const cardContainers = document.querySelectorAll(".col");
    const container = document.querySelector(".row");

    if (searchBox) {
        searchBox.addEventListener("input", function () {
            const searchTerm = searchBox.value.toLowerCase().trim();
            let found = false;

            cardContainers.forEach(col => {
                const card = col.querySelector(".card");
                const title = card.querySelector(".card-title").textContent.toLowerCase();

                if (title.includes(searchTerm)) {
                    col.style.display = "block"; // Show the full column
                    found = true;
                } else {
                    col.style.display = "none"; // Hide the full column
                }
            });

            let noResults = document.querySelector(".no-results");
            if (!found) {
                if (!noResults) {
                    noResults = document.createElement("div");
                    noResults.className = "no-results text-center w-100 mt-3";
                    noResults.textContent = "This product is not available or no farmer added this product.";
                    container.appendChild(noResults);
                }
            } else {
                if (noResults) noResults.remove();
            }
        });
    }
});
