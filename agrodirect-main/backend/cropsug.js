const express = require("express");
const cors = require("cors");
const axios = require("axios");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(cors());
app.use(express.json());

// API Keys (use environment variables in production)
const WEATHER_API_KEY = "ee0c213194b30fa25d6bff0361b663d0";
const GEMINI_API_KEY = "AIzaSyC3BnwejWRDl9mz09dlSAzfmTEIxScxvMo";

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Enhanced geocoding service for Indian locations
async function getCoordinates(location) {
    // Clean and prepare location string
    const cleanedLocation = location
        .replace(/\b(Taluka|District|Tehsil)\b/gi, '')
        .trim();
    
    const searchQueries = [
        `${cleanedLocation},India`,              // Original query
        `${cleanedLocation},Gujarat,India`,     // With state
        cleanedLocation.replace(/,/g, ' '),     // Without commas
        cleanedLocation.split(',')[0]           // Just the first part
    ];

    // Try multiple geocoding services with different query formats
    const services = [
        {
            name: "OpenStreetMap",
            url: (q) => `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&countrycodes=in`
        },
        {
            name: "OpenWeatherMap",
            url: (q) => `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(q)}&limit=1&appid=${WEATHER_API_KEY}`
        }
    ];

    for (const query of searchQueries) {
        for (const service of services) {
            try {
                const response = await axios.get(service.url(query));
                if (response.data?.length > 0) {
                    const result = response.data[0];
                    return {
                        lat: result.lat || result.latitude,
                        lon: result.lon || result.longitude,
                        name: result.display_name?.split(',')[0] || result.name || query.split(',')[0],
                        source: service.name
                    };
                }
            } catch (error) {
                console.log(`Failed with ${service.name} using query "${query}":`, error.message);
                continue;
            }
        }
    }

    throw new Error(`Could not find coordinates for "${location}". Try formats like:
- "Village, District" (e.g., "Petlad, Anand")
- "City, State" (e.g., "Anand, Gujarat")
- Nearby major city (e.g., "Vadodara")`);
}

// Improved weather data fetcher
async function getWeather(location) {
    const coords = await getCoordinates(location);
    console.log(`Geocoding successful via ${coords.source}:`, coords);

    try {
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${coords.lat}&lon=${coords.lon}&appid=${WEATHER_API_KEY}&units=metric`;
        const response = await axios.get(weatherUrl);
        
        return {
            temperature: response.data.main.temp,
            humidity: response.data.main.humidity,
            description: response.data.weather[0].description,
            icon: response.data.weather[0].icon,
            actualLocation: coords.name,
            coordinates: { lat: coords.lat, lon: coords.lon }
        };
    } catch (error) {
        console.error("Weather API Error:", error);
        throw new Error(`Weather data unavailable for ${coords.name}. Try again later.`);
    }
}

// Gemini AI crop recommendations
async function getGeminiRecommendations(location, weatherData) {
    const prompt = `Suggest 3-5 best crops to grow in ${location} with:
- Temperature: ${weatherData.temperature}°C
- Humidity: ${weatherData.humidity}%
- Conditions: ${weatherData.description}

Format each recommendation as:
1. Crop Name (Variety): Brief reason (max 10 words)`;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (error) {
        console.error("Gemini API Error:", error);
        return "1. Local Traditional Crops: Best adapted to your area\n2. Seasonal Vegetables: Suitable for current weather\n3. Drought-Resistant Varieties: Given climate conditions";
    }
}

// API Endpoint
app.post("/get_crops", async (req, res) => {
    try {
        const { location } = req.body;
        if (!location) {
            return res.status(400).json({ error: "Location is required" });
        }

        const weatherData = await getWeather(location);
        const crops = await getGeminiRecommendations(weatherData.actualLocation, weatherData);

        res.json({
            location: weatherData.actualLocation,
            coordinates: weatherData.coordinates,
            weather: {
                temperature: weatherData.temperature,
                humidity: weatherData.humidity,
                description: weatherData.description,
                icon: weatherData.icon
            },
            recommended_crops: crops
        });

    } catch (error) {
        console.error("API Error:", error);
        res.status(400).json({ 
            error: error.message,
            suggestion: error.message.includes('coordinates') ? 
                'Try formats like "Village, District" or "City, State"' :
                'Try again later or use a nearby major city'
        });
    }
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log("Ready to handle requests for Indian locations including:");
    console.log("- Small villages (e.g., 'Petlad,Anand')");
    console.log("- District names (e.g., 'Anand,Gujarat')");
    console.log("- Major cities (e.g., 'Vadodara')");
});