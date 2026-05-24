const express = require('express');
const app = express();
const PORT = 5003;

app.get('/', (req, res) => res.send('Test Server Running'));

console.log('Starting Test Server...');
const server = app.listen(PORT, () => {
    console.log(`Test Server running on port ${PORT}`);
});

// Avoid immediate exit
setInterval(() => {
    console.log('Keep-alive tick...');
}, 10000);
