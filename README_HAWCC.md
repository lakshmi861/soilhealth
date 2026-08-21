# QubitX - HAWCC JavaScript Version

This is the Python/Streamlit replacement for the Multi-Crop Soil Advisor.

## Files

- index.html - complete UI
- style.css - dashboard styling
- app.js - application logic, soil analysis, crop alternatives, rotation planner and ESP32 Web Serial
- crop_profiles.json - COPY THE EXISTING FILE FROM YOUR GITHUB REPOSITORY INTO THIS SAME FOLDER

## Run

If HAWCC gives a web preview, open `index.html`.

For local laptop testing, use a local web server because browser Web Serial normally requires localhost/HTTPS.

Example with Node.js:

    npx serve .

Then open the shown localhost address in Chrome/Edge.

## ESP32

1. Upload `MultiCrop_soil_ESP32.ino` from the original repository to ESP32.
2. Connect ESP32 by USB.
3. Open this web app in Chrome/Edge.
4. Press Connect ESP32.
5. Select the ESP32 COM/USB serial port.
6. Baud rate is 115200.
7. ESP32 must output:

SOIL,MOISTURE,TEMPERATURE,PH,EC,N,P,K

The current repository firmware sends -1 for N/P/K because the NPK part is still a placeholder. The JavaScript app therefore keeps manually entered N/P/K values until real NPK values arrive.

## Important

The original repository uses a Python RandomForestClassifier. A browser-only JavaScript app cannot directly import scikit-learn. This version replaces that dependency with a deterministic 7-parameter health classifier based on the same crop ranges, while preserving the soil alerts, alternative-crop logic, rotation planner and ESP32 serial workflow.
