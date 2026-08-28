let farmerId =
    localStorage.getItem("krishiFarmerId");


// -----------------------------
// Helper
// -----------------------------

const $ = (id) =>
    document.getElementById(id);


// -----------------------------
// API Function
// -----------------------------

async function api(url, options = {}) {

    const response =
        await fetch(url, {

            headers: {
                "Content-Type":
                    "application/json"
            },

            ...options

        });

    const data =
        await response.json();

    if (!response.ok) {

        throw new Error(
            data.error ||
            "Something went wrong"
        );

    }

    return data;

}


// -----------------------------
// Add Chat Message
// -----------------------------

function addMessage(
    text,
    type
) {

    const message =
        document.createElement("div");

    message.className =
        `message ${type}`;

    message.textContent =
        text;

    $("chat").appendChild(
        message
    );

    $("chat").scrollTop =
        $("chat").scrollHeight;

}


// -----------------------------
// Save Farmer
// -----------------------------

$("saveProfile").onclick =
    async function () {

        const name =
            $("name").value.trim();

        const village =
            $("village").value.trim();

        const crop =
            $("crop").value.trim();

        const soil =
            $("soil").value;

        if (!name) {

            $("profileStatus")
                .textContent =
                "Please enter your name.";

            return;

        }

        try {

            const data =
                await api(
                    "/api/farmers",
                    {

                        method: "POST",

                        body:
                            JSON.stringify({

                                name,
                                village,
                                crop,
                                soil

                            })

                    }
                );

            farmerId =
                data.farmer.id;

            localStorage.setItem(
                "krishiFarmerId",
                farmerId
            );

            $("profileStatus")
                .textContent =
                "✓ Profile saved successfully";

        } catch (error) {

            $("profileStatus")
                .textContent =
                error.message;

        }

    };


// -----------------------------
// Ask AI
// -----------------------------

async function askQuestion() {

    const input =
        $("question");

    const question =
        input.value.trim();

    if (!question) {

        return;

    }

    addMessage(
        question,
        "user"
    );

    input.value = "";

    addMessage(
        "🌾 KrishiMitra is thinking...",
        "bot"
    );

    const thinkingMessage =
        $("chat").lastElementChild;

    try {

        const data =
            await api(
                "/api/ask",
                {

                    method: "POST",

                    body:
                        JSON.stringify({

                            question,
                            farmerId

                        })

                }
            );

        thinkingMessage
            .textContent =
            data.answer;

    } catch (error) {

        thinkingMessage
            .textContent =
            "Sorry, I could not process your question.";

        console.error(error);

    }

}


// -----------------------------
// Send Button
// -----------------------------

$("askButton").onclick =
    askQuestion;


// -----------------------------
// Enter Key
// -----------------------------

$("question")
    .addEventListener(
        "keydown",
        function (event) {

            if (
                event.key === "Enter"
            ) {

                askQuestion();

            }

        }
    );


// -----------------------------
// Quick Questions
// -----------------------------

document
    .querySelectorAll(
        ".quick-buttons button"
    )
    .forEach(button => {

        button.onclick =
            function () {

                $("question").value =
                    this.textContent;

                askQuestion();

            };

    });


// -----------------------------
// Weather
// -----------------------------

async function loadWeather() {

    try {

        const weather =
            await api(
                "/api/weather"
            );

        $("temperature")
            .textContent =
            weather.temperature;

        $("humidity")
            .textContent =
            weather.humidity;

        $("rain")
            .textContent =
            weather.rainfallChance;

        $("wind")
            .textContent =
            weather.wind;

    } catch (error) {

        console.error(
            error
        );

    }

}


// -----------------------------
// Market
// -----------------------------

async function loadMarket() {

    try {

        const market =
            await api(
                "/api/market"
            );

        $("market").innerHTML =
            "";

        market.forEach(
            item => {

                const row =
                    document.createElement(
                        "div"
                    );

                row.className =
                    "market-row";

                const trendClass =
                    item.trend
                        .startsWith("+")
                        ? "up"
                        : "down";

                row.innerHTML = `

                    <span>

                        <strong>
                            ${item.crop}
                        </strong>

                        <br>

                        <small>
                            ${item.market}
                        </small>

                    </span>

                    <span>

                        <strong>
                            ₹${item.price.toLocaleString()}
                        </strong>

                        <br>

                        <small class="${trendClass}">
                            ${item.trend}
                        </small>

                    </span>

                `;

                $("market")
                    .appendChild(row);

            }
        );

    } catch (error) {

        $("market")
            .textContent =
            "Unable to load market data.";

    }

}


// -----------------------------
// Refresh Market
// -----------------------------

$("refreshMarket")
    .onclick =
    loadMarket;


// -----------------------------
// Language Button
// -----------------------------

$("languageBtn")
    .onclick =
    function () {

        alert(
            "Hindi and regional-language support can be connected to a translation or speech API."
        );

    };


// -----------------------------
// Start Application
// -----------------------------

loadWeather();

loadMarket();