const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8501;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const BASE_DIR = __dirname;
const RULE_FILE = path.join(BASE_DIR, "crop_profiles.json");
const CSV_FILE = path.join(BASE_DIR, "training_data_template.csv");

let PROFILE_DATA = { crops: {} };

try {
  PROFILE_DATA = JSON.parse(
    fs.readFileSync(RULE_FILE, "utf8")
  );
} catch (error) {
  console.warn(
    "crop_profiles.json not found. Put it beside app.js."
  );
}

const CROPS = PROFILE_DATA.crops || {};

const FEATURES = [
  "moisture",
  "temperature",
  "ph",
  "ec",
  "nitrogen",
  "phosphorus",
  "potassium"
];

const CROP_ROTATION_DATA = {
  TOMATO: {
    growing_season: 60,
    crop_type: "Heavy Feeder",
    nitrogen_usage: "High",
    benefits: "Enriches P and K"
  },

  RAGI: {
    growing_season: 90,
    crop_type: "Cereal",
    nitrogen_usage: "Medium",
    benefits: "Good break crop"
  },

  RICE: {
    growing_season: 120,
    crop_type: "Cereal",
    nitrogen_usage: "High",
    benefits: "Nitrogen fixer"
  },

  MAIZE: {
    growing_season: 75,
    crop_type: "Heavy Feeder",
    nitrogen_usage: "High",
    benefits: "Good for soil structure"
  },

  JOWAR: {
    growing_season: 100,
    crop_type: "Cereal",
    nitrogen_usage: "Low",
    benefits: "Drought tolerant"
  },

  BAJRA: {
    growing_season: 65,
    crop_type: "Cereal",
    nitrogen_usage: "Low",
    benefits: "Quick cycle crop"
  }
};

function parameterStatus(value, low, high) {
  if (value < low) {
    return "LOW";
  }

  if (value > high) {
    return "HIGH";
  }

  return "OK";
}

function generateAlerts(crop, values) {
  const ranges = CROPS[crop]?.ranges || {};

  const alerts = [];
  const statuses = {};

  for (const feature of FEATURES) {
    if (!ranges[feature]) {
      continue;
    }

    const status = parameterStatus(
      values[feature],
      ranges[feature].low,
      ranges[feature].high
    );

    statuses[feature] = status;

    if (status === "LOW") {
      alerts.push(`${feature.toUpperCase()} is LOW.`);
    }

    if (status === "HIGH") {
      alerts.push(`${feature.toUpperCase()} is HIGH.`);
    }
  }

  let irrigation = "MOISTURE NORMAL";

  if (ranges.moisture) {
    if (
      values.moisture <
      ranges.moisture.low
    ) {
      irrigation = "IRRIGATION REQUIRED";
    } else if (
      values.moisture >
      ranges.moisture.high
    ) {
      irrigation = "SOIL TOO WET";
    }
  }

  return {
    alerts,
    statuses,
    irrigation
  };
}

function predictHealth(crop, values) {
  const ranges = CROPS[crop]?.ranges || {};

  let ok = 0;
  let checked = 0;

  for (const feature of FEATURES) {
    if (!ranges[feature]) {
      continue;
    }

    checked++;

    if (
      values[feature] >= ranges[feature].low &&
      values[feature] <= ranges[feature].high
    ) {
      ok++;
    }
  }

  const ratio =
    checked > 0
      ? ok / checked
      : 0;

  let prediction = "Critical";

  if (ratio >= 0.85) {
    prediction = "Healthy";
  } else if (ratio >= 0.55) {
    prediction = "Warning";
  }

  const confidence =
    Math.round(
      (0.60 + Math.abs(ratio - 0.5) * 0.75) *
      1000
    ) / 10;

  return {
    prediction,
    confidence: Math.min(
      99.9,
      confidence
    )
  };
}

function detectSoilType(values) {
  const characteristics = [];

  let soilType;

  if (values.ph < 6.0) {
    soilType = "Acidic Soil";

    characteristics.push(
      "⚠️ Acidic - Consider lime application"
    );
  } else if (values.ph > 7.5) {
    soilType = "Alkaline Soil";

    characteristics.push(
      "⚠️ Alkaline - Consider sulfur or organic matter"
    );
  } else {
    soilType = "Neutral Soil";

    characteristics.push(
      "✓ Neutral pH - Suitable for most crops"
    );
  }

  if (values.ec > 2.0) {
    characteristics.push(
      "🧂 High Salinity - May need drainage improvement"
    );
  } else if (values.ec < 0.5) {
    characteristics.push(
      "📊 Low fertility - Consider adding nutrients"
    );
  }

  if (values.moisture < 30) {
    characteristics.push(
      "🏜️ Dry soil - Improve water retention with organic matter"
    );
  } else if (values.moisture > 70) {
    characteristics.push(
      "💧 High moisture - Improve drainage to prevent waterlogging"
    );
  } else {
    characteristics.push(
      "💧 Good moisture retention"
    );
  }

  if (values.nitrogen < 40) {
    characteristics.push(
      "⬇️ Low nitrogen - Apply nitrogen fertilizer"
    );
  } else if (values.nitrogen > 120) {
    characteristics.push(
      "⬆️ High nitrogen - Avoid over-fertilization"
    );
  }

  return {
    soilType,
    characteristics
  };
}

function readTrainingData() {
  if (!fs.existsSync(CSV_FILE)) {
    return [];
  }

  const content = fs
    .readFileSync(CSV_FILE, "utf8")
    .trim();

  if (!content) {
    return [];
  }

  const lines =
    content.split(/\r?\n/);

  const headers =
    lines[0]
      .split(",")
      .map(x => x.trim());

  return lines.slice(1).map(line => {
    const cells = line.split(",");
    const row = {};

    headers.forEach((header, index) => {
      row[header] =
        cells[index]?.trim() || "";
    });

    return row;
  });
}

const TRAINING_DATA =
  readTrainingData();

function findAlternativeCrops(values) {
  if (!TRAINING_DATA.length) {
    return [];
  }

  const suitable = [];

  const cropNames =
    [...new Set(
      TRAINING_DATA.map(row => row.Crop)
    )];

  for (const crop of cropNames) {
    const rows =
      TRAINING_DATA.filter(row =>
        row.Crop === crop &&
        (
          row.Status === "Optimal" ||
          row.Status === "Normal"
        )
      );

    if (!rows.length) {
      continue;
    }

    const names = {
      moisture: "Moisture",
      temperature: "Temperature",
      ph: "pH",
      ec: "EC",
      nitrogen: "Nitrogen",
      phosphorus: "Phosphorus",
      potassium: "Potassium"
    };

    let matches = 0;

    for (const feature of FEATURES) {
      const numbers =
        rows
          .map(row =>
            Number(row[names[feature]])
          )
          .filter(Number.isFinite);

      if (!numbers.length) {
        continue;
      }

      const min =
        Math.min(...numbers);

      const max =
        Math.max(...numbers);

      if (
        values[feature] >= min &&
        values[feature] <= max
      ) {
        matches++;
      }
    }

    if (matches >= 5) {
      suitable.push({
        crop,
        match_score:
          (matches / 7) * 100
      });
    }
  }

  return suitable.sort(
    (a, b) =>
      b.match_score - a.match_score
  );
}

function sequenceCropsForRotation(
  selectedCrops,
  values
) {
  const scored =
    selectedCrops.map(crop => {
      let score = 0;

      const profile =
        CROPS[crop];

      if (profile?.ranges) {
        for (
          const nutrient of [
            "nitrogen",
            "phosphorus",
            "potassium"
          ]
        ) {
          const range =
            profile.ranges[nutrient];

          if (
            range &&
            values[nutrient] >= range.low &&
            values[nutrient] <= range.high
          ) {
            score += 2;
          }
        }
      }

      if (
        CROP_ROTATION_DATA[crop]
          ?.nitrogen_usage === "Low"
      ) {
        score += 1;
      }

      return {
        crop,
        score
      };
    });

  return scored
    .sort(
      (a, b) =>
        b.score - a.score
    )
    .map(item => [
      item.crop,
      CROP_ROTATION_DATA[item.crop]
        ?.growing_season || 60
    ]);
}

function calculateRotationTimeline(
  sequenced
) {
  const timeline = [];

  let currentDay = 0;

  const restGap = 14;

  sequenced.forEach(
    ([crop, duration], index) => {
      const endDay =
        currentDay + duration;

      timeline.push({
        sequence: index + 1,
        crop,
        start_day: currentDay,
        end_day: endDay,
        duration,
        rotation_data:
          CROP_ROTATION_DATA[crop] || {
            growing_season: duration,
            crop_type: "Crop",
            nitrogen_usage: "Medium",
            benefits:
              "General rotation benefit"
          }
      });

      currentDay =
        endDay + restGap;
    }
  );

  return timeline;
}

/* ================================
   API
================================ */

app.get(
  "/api/crops",
  (req, res) => {
    res.json(
      Object.keys(CROPS)
    );
  }
);

app.post(
  "/api/analyze",
  (req, res) => {
    const crop =
      req.body.crop;

    const values =
      req.body.values || {};

    if (
      !crop ||
      !CROPS[crop]
    ) {
      return res.status(400).json({
        error: "Invalid crop."
      });
    }

    for (
      const feature of FEATURES
    ) {
      values[feature] =
        Number(values[feature]);

      if (
        !Number.isFinite(
          values[feature]
        )
      ) {
        return res.status(400).json({
          error:
            `Invalid value for ${feature}.`
        });
      }
    }

    const prediction =
      predictHealth(
        crop,
        values
      );

    const soil =
      detectSoilType(values);

    const alerts =
      generateAlerts(
        crop,
        values
      );

    const alternatives =
      prediction.prediction !==
      "Healthy"
        ? findAlternativeCrops(
            values
          ).slice(0, 3)
        : [];

    res.json({
      crop,
      prediction,
      soil,
      ...alerts,
      alternatives,
      advice:
        CROPS[crop].advice || []
    });
  }
);

app.post(
  "/api/rotation",
  (req, res) => {
    const selected =
      [
        ...new Set(
          req.body.crops || []
        )
      ].filter(
        crop => CROPS[crop]
      );

    if (!selected.length) {
      return res.status(400).json({
        error:
          "Select at least one crop."
      });
    }

    const values = {};

    for (
      const feature of FEATURES
    ) {
      values[feature] =
        Number(
          req.body.values?.[feature] ||
          0
        );
    }

    const sequenced =
      sequenceCropsForRotation(
        selected,
        values
      );

    const timeline =
      calculateRotationTimeline(
        sequenced
      );

    const totalDays =
      timeline.length
        ? timeline[
            timeline.length - 1
          ].end_day
        : 0;

    res.json({
      timeline,
      totalDays,
      months:
        totalDays / 30
    });
  }
);

/* ================================
   FRONTEND
================================ */

app.get(
  "/",
  (req, res) => {
    res.send(`
<!DOCTYPE html>

<html lang="en">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>
Multi-Crop Soil Advisor
</title>

<style>

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: Arial, sans-serif;
  background: #f4f8f2;
  color: #263238;
}

.container {
  max-width: 1180px;
  margin: auto;
  padding: 30px 20px;
}

.hero,
.card {
  background: white;
  border: 1px solid #a5d6a7;
  border-radius: 20px;
  box-shadow:
    0 12px 30px #26323812;
  padding: 24px;
}

.hero {
  margin-bottom: 20px;

  background:
    linear-gradient(
      135deg,
      #f4f8f2,
      #edf6ee
    );
}

h1,
h2,
h3 {
  font-weight: 800;
}

.badge {
  display: inline-block;

  background: #e8f5e9;

  color: #2e7d32;

  padding: 8px 14px;

  border-radius: 999px;

  font-weight: 700;
}

button {
  background:
    linear-gradient(
      135deg,
      #2e7d32,
      #66bb6a
    );

  color: white;

  border: 0;

  border-radius: 12px;

  padding: 12px 20px;

  font-weight: 800;

  cursor: pointer;
}

button:hover {
  opacity: 0.9;
}

.grid {
  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 15px;
}

label {
  display: block;

  font-weight: 700;

  margin:
    12px 0 6px;
}

input,
select {
  width: 100%;

  padding: 11px;

  border:
    1px solid #a5d6a7;

  border-radius: 10px;

  font-size: 16px;
}

.tabs {
  display: flex;

  gap: 10px;

  margin: 20px 0;
}

.tab {
  background: #e8f5e9;

  color: #2e7d32;
}

.tab.active {
  background: #2e7d32;

  color: white;
}

.result {
  margin-top: 20px;
}

.ok {
  background: #e8f5e9;

  padding: 15px;

  border-radius: 12px;
}

.warn {
  background: #fff8e1;

  padding: 15px;

  border-radius: 12px;
}

.bad {
  background: #ffebee;

  padding: 15px;

  border-radius: 12px;
}

table {
  width: 100%;

  border-collapse:
    collapse;

  margin-top: 15px;
}

th,
td {
  padding: 10px;

  border-bottom:
    1px solid #ddd;

  text-align: left;
}

.metric-grid {
  display: grid;

  grid-template-columns:
    repeat(3, 1fr);

  gap: 15px;
}

.metric {
  padding: 18px;

  background: white;

  border:
    1px solid #a5d6a7;

  border-radius: 15px;
}

.hidden {
  display: none;
}

.muted {
  color: #607d68;
}

@media(max-width:700px) {

  .grid,
  .metric-grid {
    grid-template-columns: 1fr;
  }

  .container {
    padding: 15px;
  }

}

</style>

</head>

<body>

<div class="container">

<section
  id="landing"
  class="hero"
>

<span class="badge">
SMART FARMING
</span>

<h1>
Grow healthier crops with
smart soil insights.
</h1>

<p>
A soil advisory system for
monitoring soil health,
detecting imbalances and
planning better crop rotations.
</p>

<div class="grid">

<div class="card">

<b>Soil Health</b>

<h2>AI</h2>

</div>

<div class="card">

<b>Crop Planning</b>

<h2>360°</h2>

</div>

<div class="card">

<b>Farm Impact</b>

<h2>+30%</h2>

</div>

</div>

<br>

<button
  onclick="showApp()"
>
Next →
</button>

</section>


<section
  id="app"
  class="hidden"
>

<h1>
🌱 Multi-Crop Soil Advisor
</h1>

<p class="muted">

AI Soil Health Alert System —
enter sensor values manually
for testing.

ESP32 values can later be
sent to these API endpoints.

</p>


<div class="card">

<div class="grid">

<div>

<label>
Primary Crop
</label>

<select
  id="crop"
></select>

</div>


<div>

<label>
Soil Moisture (%)
</label>

<input
  id="moisture"
  type="number"
  min="0"
  max="100"
  step=".1"
>

</div>


<div>

<label>
Soil Temperature (°C)
</label>

<input
  id="temperature"
  type="number"
  min="0"
  max="60"
  step=".1"
>

</div>


<div>

<label>
Soil pH
</label>

<input
  id="ph"
  type="number"
  min="0"
  max="14"
  step=".1"
>

</div>


<div>

<label>
EC (mS/cm)
</label>

<input
  id="ec"
  type="number"
  min="0"
  max="20"
  step=".01"
>

</div>


<div>

<label>
Nitrogen (N)
</label>

<input
  id="nitrogen"
  type="number"
  min="0"
  max="500"
  step="1"
>

</div>


<div>

<label>
Phosphorus (P)
</label>

<input
  id="phosphorus"
  type="number"
  min="0"
  max="500"
  step="1"
>

</div>


<div>

<label>
Potassium (K)
</label>

<input
  id="potassium"
  type="number"
  min="0"
  max="500"
  step="1"
>

</div>

</div>

<br>

<button
  onclick="analyze()"
>
🔍 TEST SOIL HEALTH
</button>

</div>


<div
  id="result"
  class="result"
></div>


<div class="tabs">

<button
  class="tab active"
  onclick="
    openTab('single',this)
  "
>
🔍 Single Crop Analysis
</button>

<button
  class="tab"
  onclick="
    openTab('rotation',this)
  "
>
🌾 Multi-Crop Rotation Planning
</button>

</div>


<div
  id="rotation"
  class="hidden card"
>

<h2>
🌾 Crop Rotation
& Sequencing Plan
</h2>

<p>
Select up to 3 crops based
on current soil conditions.
</p>

<div class="grid">

<div>

<label>Crop 1</label>

<select id="r1"></select>

</div>

<div>

<label>Crop 2</label>

<select id="r2"></select>

</div>

<div>

<label>Crop 3</label>

<select id="r3"></select>

</div>

</div>

<br>

<button
  onclick="rotation()"
>
📅 Plan Crop Rotation
</button>

<div
  id="rotationResult"
></div>

</div>

</section>

</div>


<script>

let crops = [];

const fields = [
  "moisture",
  "temperature",
  "ph",
  "ec",
  "nitrogen",
  "phosphorus",
  "potassium"
];


function showApp() {

  document
    .getElementById("landing")
    .classList
    .add("hidden");

  document
    .getElementById("app")
    .classList
    .remove("hidden");

}


function openTab(id, btn) {

  document
    .getElementById("rotation")
    .classList
    .toggle(
      "hidden",
      id !== "rotation"
    );

  document
    .querySelectorAll(".tab")
    .forEach(
      x =>
        x.classList
          .remove("active")
    );

  btn.classList.add("active");

}


function fillSelect(
  id,
  values
) {

  const element =
    document.getElementById(id);

  element.innerHTML = "";

  values.forEach(crop => {

    const option =
      document.createElement(
        "option"
      );

    option.value = crop;

    option.textContent = crop;

    element.appendChild(
      option
    );

  });

}


async function init() {

  crops =
    await (
      await fetch(
        "/api/crops"
      )
    ).json();

  fillSelect(
    "crop",
    crops
  );

  fillSelect(
    "r1",
    crops
  );

  fillSelect(
    "r2",
    crops
  );

  fillSelect(
    "r3",
    crops
  );

}


function getValues() {

  const values = {};

  fields.forEach(
    field => {

      values[field] =
        Number(
          document
            .getElementById(field)
            .value || 0
        );

    }
  );

  return values;

}


async function analyze() {

  const crop =
    document
      .getElementById("crop")
      .value;

  const data =
    await (
      await fetch(
        "/api/analyze",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              crop,
              values:
                getValues()
            })
        }
      )
    ).json();


  if (data.error) {

    document
      .getElementById("result")
      .innerHTML =
        "<div class='bad'>" +
        data.error +
        "</div>";

    return;

  }


  let html =
    "<div class='card'>";


  html +=
    "<h2>" +
    "Soil Health Result — " +
    crop +
    "</h2>";


  html +=
    "<div class='metric-grid'>";


  html +=
    "<div class='metric'>" +
    "<b>Status</b>" +
    "<h2>" +
    data.prediction.prediction +
    "</h2>" +
    "</div>";


  html +=
    "<div class='metric'>" +
    "<b>AI Confidence</b>" +
    "<h2>" +
    data.prediction.confidence +
    "%</h2>" +
    "</div>";


  html +=
    "<div class='metric'>" +
    "<b>Soil Type</b>" +
    "<h2>" +
    data.soil.soilType +
    "</h2>" +
    "</div>";


  html +=
    "</div>";


  html +=
    "<h3>" +
    "🏞️ Soil Type Analysis" +
    "</h3>";


  html +=
    "<ul>" +
    data.soil.characteristics
      .map(
        x =>
          "<li>" +
          x +
          "</li>"
      )
      .join("") +
    "</ul>";


  html +=
    "<h3>" +
    "📊 Parameter Analysis" +
    "</h3>";


  html +=
    "<table>" +
    "<tr>" +
    "<th>Parameter</th>" +
    "<th>Value</th>" +
    "<th>Status</th>" +
    "</tr>";


  const names = {

    moisture:
      "Soil Moisture",

    temperature:
      "Temperature",

    ph:
      "pH",

    ec:
      "EC",

    nitrogen:
      "Nitrogen",

    phosphorus:
      "Phosphorus",

    potassium:
      "Potassium"

  };


  const currentValues =
    getValues();


  fields.forEach(field => {

    html +=
      "<tr>" +
      "<td>" +
      names[field] +
      "</td>" +
      "<td>" +
      currentValues[field] +
      "</td>" +
      "<td>" +
      data.statuses[field] +
      "</td>" +
      "</tr>";

  });


  html +=
    "</table>";


  html +=
    "<h3>" +
    "💧 Irrigation Alert" +
    "</h3>";


  let irrigationClass =
    "ok";


  if (
    data.irrigation ===
    "SOIL TOO WET"
  ) {

    irrigationClass = "bad";

  } else if (
    data.irrigation !==
    "MOISTURE NORMAL"
  ) {

    irrigationClass = "warn";

  }


  html +=
    "<div class='" +
    irrigationClass +
    "'>" +
    data.irrigation +
    "</div>";


  html +=
    "<h3>" +
    "⚠️ Parameter Alerts" +
    "</h3>";


  if (data.alerts.length) {

    html +=
      data.alerts
        .map(
          alert =>
            "<div class='warn'>" +
            alert +
            "</div>"
        )
        .join("");

  } else {

    html +=
      "<div class='ok'>" +
      "All monitored parameters are " +
      "within the configured crop ranges." +
      "</div>";

  }


  html +=
    "<h3>" +
    "🌱 Crop Advice" +
    "</h3>";


  html +=
    "<ul>" +
    (data.advice || [])
      .map(
        advice =>
          "<li>" +
          advice +
          "</li>"
      )
      .join("") +
    "</ul>";


  if (
    data.alternatives &&
    data.alternatives.length
  ) {

    html +=
      "<h3>" +
      "🌾 Suitable Alternative Crops" +
      "</h3>";


    html +=
      data.alternatives
        .map(
          (item, index) =>
            "<div class='ok'>" +
            (index + 1) +
            ". <b>" +
            item.crop +
            "</b> — Compatibility: " +
            item.match_score
              .toFixed(1) +
            "%" +
            "</div>"
        )
        .join("");

  }


  html += "</div>";


  document
    .getElementById("result")
    .innerHTML = html;

}


async function rotation() {

  const values =
    getValues();


  const selectedCrops = [

    document
      .getElementById("r1")
      .value,

    document
      .getElementById("r2")
      .value,

    document
      .getElementById("r3")
      .value

  ];


  const data =
    await (
      await fetch(
        "/api/rotation",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify({
              crops:
                selectedCrops,
              values
            })
        }
      )
    ).json();


  if (data.error) {

    document
      .getElementById(
        "rotationResult"
      )
      .innerHTML =
        "<div class='bad'>" +
        data.error +
        "</div>";

    return;

  }


  let html =
    "<hr>" +
    "<h3>" +
    "📊 Optimal Crop Rotation Sequence" +
    "</h3>";


  data.timeline.forEach(
    item => {

      html +=
        "<div class='card'>" +

        "<h3>" +
        "Step " +
        item.sequence +
        ": " +
        item.crop +
        "</h3>" +

        "<p>" +

        "Duration: " +
        item.duration +
        " days<br>" +

        "Type: " +
        item.rotation_data.crop_type +
        "<br>" +

        "N Usage: " +
        item.rotation_data.nitrogen_usage +
        "<br>" +

        "Benefit: " +
        item.rotation_data.benefits +

        "</p>" +

        "</div>";

    }
  );


  html +=
    "<div class='ok'>" +

    "<b>Total Rotation Cycle:</b> " +

    data.totalDays +

    " days (" +

    data.months.toFixed(1) +

    " months)" +

    "</div>";


  html +=
    "<h3>" +
    "✨ Crop Rotation Benefits" +
    "</h3>";


  html +=
    "<ul>" +

    "<li>Maintains soil fertility</li>" +

    "<li>Reduces pest buildup</li>" +

    "<li>Improves soil structure</li>" +

    "<li>Allow 14 days rest between crops</li>" +

    "</ul>";


  document
    .getElementById(
      "rotationResult"
    )
    .innerHTML = html;

}


init();

</script>

</body>

</html>
`);
  }
);


app.listen(
  PORT,
  () => {

    console.log(
      "🌱 Multi-Crop Soil Advisor running at " +
      `http://localhost:${PORT}`
    );

  }
);
