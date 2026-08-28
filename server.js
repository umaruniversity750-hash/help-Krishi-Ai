const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

// -----------------------------
// Middleware
// -----------------------------

app.use(cors());

app.use(express.json({
    limit: "2mb"
}));

app.use(express.static(
    path.join(__dirname, "public")
));

// -----------------------------
// SQLite Database
// -----------------------------

const dataFolder = path.join(__dirname, "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder);
}

const db = new Database(
    path.join(dataFolder, "krishimitra.db")
);

// Create tables

db.exec(`
    CREATE TABLE IF NOT EXISTS farmers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        village TEXT,
        crop TEXT,
        soil TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        farmer_id INTEGER,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// -----------------------------
// Home
// -----------------------------

app.get("/", (req, res) => {

    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );

});

// -----------------------------
// Health Check
// -----------------------------

app.get("/api/health", (req, res) => {

    res.json({
        success: true,
        message: "KrishiMitra.AI server is running"
    });

});

// -----------------------------
// Create Farmer
// -----------------------------

app.post("/api/farmers", (req, res) => {

    const {
        name,
        village,
        crop,
        soil
    } = req.body;

    if (!name || !name.trim()) {

        return res.status(400).json({
            error: "Farmer name is required"
        });

    }

    const statement = db.prepare(`
        INSERT INTO farmers
        (name, village, crop, soil)
        VALUES (?, ?, ?, ?)
    `);

    const result = statement.run(
        name.trim(),
        village || "",
        crop || "",
        soil || ""
    );

    res.json({

        success: true,

        farmer: {
            id: result.lastInsertRowid,
            name,
            village,
            crop,
            soil
        }

    });

});

// -----------------------------
// Get Farmer
// -----------------------------

app.get("/api/farmers/:id", (req, res) => {

    const farmer = db.prepare(`
        SELECT *
        FROM farmers
        WHERE id = ?
    `).get(req.params.id);

    if (!farmer) {

        return res.status(404).json({
            error: "Farmer not found"
        });

    }

    res.json(farmer);

});

// -----------------------------
// Demo AI Response
// -----------------------------

function demoAI(question, farmer) {

    const q = question.toLowerCase();

    if (
        q.includes("yellow") ||
        q.includes("leaf") ||
        q.includes("disease")
    ) {

        return `
Yellow leaves can have several causes, including nutrient
deficiency, excess water, pests, or disease.

First check soil moisture and inspect the underside of the
leaves for insects.

Avoid excessive irrigation.

For an accurate diagnosis, upload a clear leaf image to
a plant-disease detection model.
        `;

    }

    if (
        q.includes("water") ||
        q.includes("irrigation")
    ) {

        return `
For ${farmer.crop || "your crop"}, irrigation should depend
on crop stage and soil moisture.

Check the soil before watering and avoid waterlogging.

Early morning irrigation is generally preferable because
evaporation losses can be lower.
        `;

    }

    if (
        q.includes("fertilizer") ||
        q.includes("urea")
    ) {

        return `
Use fertilizer according to your soil test and the
recommended nutrient schedule for ${farmer.crop || "your crop"}.

Avoid excessive urea because too much nitrogen can cause
excessive leaf growth and nutrient losses.
        `;

    }

    if (
        q.includes("pest") ||
        q.includes("insect")
    ) {

        return `
Inspect the crop regularly for insects and damaged leaves.

Identify the pest before applying pesticides.

Use integrated pest management methods whenever possible,
and follow the label instructions for any pesticide.
        `;

    }

    return `
Namaste ${farmer.name || "Farmer"}! 🌾

I am KrishiMitra.AI.

I can help you with:

🌱 Crop selection
💧 Irrigation
🦠 Crop diseases
🐛 Pest management
🌾 Fertilizers
🌦️ Weather
💰 Market information

Please tell me your crop and farming problem.
    `;

}

// -----------------------------
// Optional AI API
// -----------------------------

async function askAI(question, farmer) {

    // If no API key is available,
    // use the built-in demo assistant.

    if (!process.env.OPENAI_API_KEY) {

        return demoAI(
            question,
            farmer
        );

    }

    try {

        const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {

                method: "POST",

                headers: {

                    "Content-Type": "application/json",

                    "Authorization":
                        `Bearer ${process.env.OPENAI_API_KEY}`

                },

                body: JSON.stringify({

                    model:
                        process.env.OPENAI_MODEL ||
                        "gpt-4o-mini",

                    temperature: 0.3,

                    messages: [

                        {
                            role: "system",

                            content: `
You are KrishiMitra.AI,
an agricultural assistant.

Give simple and practical farming advice.

Do not claim certainty when diagnosing
plant diseases.

Recommend soil testing or agricultural
experts for important decisions.

Respond in the farmer's language when possible.
                            `
                        },

                        {
                            role: "user",

                            content: JSON.stringify({

                                farmer: farmer,

                                question: question

                            })

                        }

                    ]

                })

            }
        );

        const data = await response.json();

        if (
            data.choices &&
            data.choices.length > 0
        ) {

            return data.choices[0]
                .message
                .content;

        }

        return demoAI(question, farmer);

    } catch (error) {

        console.error(
            "AI API error:",
            error.message
        );

        return demoAI(
            question,
            farmer
        );

    }

}

// -----------------------------
// Ask AI
// -----------------------------

app.post("/api/ask", async (req, res) => {

    const {
        question,
        farmerId
    } = req.body;

    if (!question || !question.trim()) {

        return res.status(400).json({
            error: "Question is required"
        });

    }

    let farmer = {};

    if (farmerId) {

        farmer =
            db.prepare(`
                SELECT *
                FROM farmers
                WHERE id = ?
            `)
                .get(farmerId);

    }

    farmer = farmer || {};

    const answer = await askAI(
        question.trim(),
        farmer
    );

    // Save chat history

    if (farmerId) {

        db.prepare(`
            INSERT INTO questions
            (farmer_id, question, answer)
            VALUES (?, ?, ?)
        `).run(
            farmerId,
            question.trim(),
            answer
        );

    }

    res.json({

        success: true,

        answer: answer

    });

});

// -----------------------------
// Chat History
// -----------------------------

app.get(
    "/api/questions/:farmerId",
    (req, res) => {

        const questions =
            db.prepare(`
                SELECT
                    question,
                    answer,
                    created_at
                FROM questions
                WHERE farmer_id = ?
                ORDER BY id DESC
                LIMIT 20
            `)
                .all(req.params.farmerId);

        res.json(questions);

    }
);

// -----------------------------
// Market API
// -----------------------------

app.get("/api/market", (req, res) => {

    // Demo data
    // Replace with a live mandi/government API later.

    res.json([

        {
            crop: "Wheat",
            market: "Lucknow",
            price: 2425,
            unit: "₹/quintal",
            trend: "+2.1%"
        },

        {
            crop: "Rice",
            market: "Barabanki",
            price: 2280,
            unit: "₹/quintal",
            trend: "+1.4%"
        },

        {
            crop: "Potato",
            market: "Agra",
            price: 1650,
            unit: "₹/quintal",
            trend: "-0.8%"
        },

        {
            crop: "Mustard",
            market: "Kanpur",
            price: 5650,
            unit: "₹/quintal",
            trend: "+3.2%"
        }

    ]);

});

// -----------------------------
// Weather API
// -----------------------------

app.get("/api/weather", (req, res) => {

    // Demo weather data.
    // Connect a live weather API later.

    res.json({

        location: "Lucknow",

        temperature: 31,

        humidity: 64,

        rainfallChance: 22,

        wind: 11,

        condition: "Partly Cloudy"

    });

});

// -----------------------------
// Start Server
// -----------------------------

app.listen(PORT, () => {

    console.log(
        `🌾 KrishiMitra.AI running at http://localhost:${PORT}`
    );

});