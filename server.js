const express = require('express');
const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/api/', (req, res) => {
    res.send('Hello world!')
});

app.listen(port, () => {
    console.log(`sliders-express listening on port ${port}.`);
});