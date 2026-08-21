/* =========================================================
   MULTI-CROP SOIL ADVISOR - HAWCC JAVASCRIPT VERSION
   No Python, Streamlit, pandas or scikit-learn required.
   ========================================================= */

const FEATURES = ["moisture","temperature","ph","ec","nitrogen","phosphorus","potassium"];

const ROTATION = {
  TOMATO:{growing_season:90,crop_type:"Vegetable",nitrogen_usage:"High",benefits:"Enriches P and K"},
  RAGI:{growing_season:100,crop_type:"Cereal",nitrogen_usage:"Medium",benefits:"Good break crop"},
  RICE:{growing_season:120,crop_type:"Cereal",nitrogen_usage:"High",benefits:"Supports wet-season rotation"},
  MAIZE:{growing_season:100,crop_type:"Cereal",nitrogen_usage:"High",benefits:"Good for soil structure"},
  JOWAR:{growing_season:100,crop_type:"Cereal",nitrogen_usage:"Low",benefits:"Drought tolerant"},
  BAJRA:{growing_season:75,crop_type:"Cereal",nitrogen_usage:"Low",benefits:"Quick cycle crop"},
  WHEAT:{growing_season:120,crop_type:"Cereal",nitrogen_usage:"High",benefits:"Good cool-season crop"},
  RED_GRAM:{growing_season:180,crop_type:"Pulse",nitrogen_usage:"Low",benefits:"Adds biological nitrogen"},
  GREEN_GRAM:{growing_season:70,crop_type:"Pulse",nitrogen_usage:"Low",benefits:"Adds biological nitrogen"},
  BLACK_GRAM:{growing_season:75,crop_type:"Pulse",nitrogen_usage:"Low",benefits:"Adds biological nitrogen"},
  BENGAL_GRAM:{growing_season:110,crop_type:"Pulse",nitrogen_usage:"Low",benefits:"Adds biological nitrogen"},
  GROUNDNUT:{growing_season:110,crop_type:"Oilseed",nitrogen_usage:"Low",benefits:"Improves soil nitrogen"},
  SUNFLOWER:{growing_season:100,crop_type:"Oilseed",nitrogen_usage:"Medium",benefits:"Useful oilseed rotation crop"},
  SOYBEAN:{growing_season:105,crop_type:"Pulse",nitrogen_usage:"Low",benefits:"Adds biological nitrogen"},
  SUGARCANE:{growing_season:365,crop_type:"Commercial",nitrogen_usage:"High",benefits:"Long-duration cash crop"},
  COTTON:{growing_season:180,crop_type:"Commercial",nitrogen_usage:"High",benefits:"Supports fibre production"},
  ONION:{growing_season:120,crop_type:"Vegetable",nitrogen_usage:"Medium",benefits:"Good short rotation crop"},
  POTATO:{growing_season:100,crop_type:"Tuber",nitrogen_usage:"High",benefits:"Improves soil turnover"},
  BRINJAL:{growing_season:150,crop_type:"Vegetable",nitrogen_usage:"High",benefits:"Long harvest window"},
  CHILLI:{growing_season:150,crop_type:"Vegetable",nitrogen_usage:"Medium",benefits:"Good value crop"},
  OKRA:{growing_season:100,crop_type:"Vegetable",nitrogen_usage:"Medium",benefits:"Quick harvest crop"},
  CABBAGE:{growing_season:90,crop_type:"Vegetable",nitrogen_usage:"High",benefits:"Good cool-season crop"},
  CAULIFLOWER:{growing_season:100,crop_type:"Vegetable",nitrogen_usage:"High",benefits:"Good cool-season crop"},
  CARROT:{growing_season:90,crop_type:"Root",nitrogen_usage:"Medium",benefits:"Improves soil turnover"},
  BEANS:{growing_season:75,crop_type:"Pulse",nitrogen_usage:"Low",benefits:"Adds biological nitrogen"},
  CUCUMBER:{growing_season:75,crop_type:"Vegetable",nitrogen_usage:"Medium",benefits:"Quick cycle crop"},
  WATERMELON:{growing_season:100,crop_type:"Fruit",nitrogen_usage:"Medium",benefits:"Good warm-season crop"},
  BANANA:{growing_season:365,crop_type:"Fruit",nitrogen_usage:"High",benefits:"Long-term fruit production"},
  MANGO:{growing_season:365,crop_type:"Fruit",nitrogen_usage:"Medium",benefits:"Long-term orchard crop"},
  POMEGRANATE:{growing_season:365,crop_type:"Fruit",nitrogen_usage:"Medium",benefits:"Drought-tolerant orchard crop"},
  GRAPES:{growing_season:180,crop_type:"Fruit",nitrogen_usage:"Medium",benefits:"Supports perennial fruit production"},
  COCONUT:{growing_season:365,crop_type:"Plantation",nitrogen_usage:"High",benefits:"Long-term plantation crop"},
  ARECANUT:{growing_season:365,crop_type:"Plantation",nitrogen_usage:"High",benefits:"Long-term plantation crop"},
  COFFEE:{growing_season:365,crop_type:"Plantation",nitrogen_usage:"Medium",benefits:"Shade-friendly perennial crop"},
  BLACK_PEPPER:{growing_season:365,crop_type:"Spice",nitrogen_usage:"Medium",benefits:"High-value perennial spice"},
  CARDAMOM:{growing_season:365,crop_type:"Spice",nitrogen_usage:"Medium",benefits:"Shade-friendly spice crop"},
  GINGER:{growing_season:240,crop_type:"Spice",nitrogen_usage:"Medium",benefits:"Improves soil turnover"},
  TURMERIC:{growing_season:240,crop_type:"Spice",nitrogen_usage:"Medium",benefits:"Good soil-covering crop"},
  SESAME:{growing_season:90,crop_type:"Oilseed",nitrogen_usage:"Low",benefits:"Drought tolerant oilseed"},
  CASTOR:{growing_season:180,crop_type:"Oilseed",nitrogen_usage:"Medium",benefits:"Deep-rooted rotation crop"},
  FINGER_MILLET:{growing_season:100,crop_type:"Cereal",nitrogen_usage:"Medium",benefits:"Drought tolerant cereal"}
};

let CROPS = {};
let serialPort = null;
let reader = null;
let serialBuffer = "";

const $ = id => document.getElementById(id);
const n = id => Number($(id).value);

function label(crop){ return crop.replaceAll("_"," "); }

async function loadProfiles(){
  try{
    const r = await fetch("crop_profiles.json");
    if(!r.ok) throw new Error("crop_profiles.json not found");
    const data = await r.json();
    CROPS = data.crops || {};
  }catch(e){
    // Minimal fallback so the app still opens if the JSON file was not copied.
    CROPS = {};
    Object.keys(ROTATION).forEach(c => {
      CROPS[c] = {ranges:{
        moisture:{low:35,high:70,default:50},
        temperature:{low:18,high:30,default:25},
        ph:{low:5.5,high:7.5,default:6.5},
        ec:{low:0.5,high:2,default:1},
        nitrogen:{low:40,high:120,default:80},
        phosphorus:{low:20,high:80,default:40},
        potassium:{low:40,high:150,default:80}
      },advice:["Keep soil parameters inside the recommended range.","Use irrigation according to moisture.","Apply targeted nutrients after soil testing."]};
    });
  }
  populateCrops();
}

function populateCrops(){
  const names = Object.keys(CROPS);
  ["crop","crop1","crop2","crop3"].forEach(id=>{
    const el=$(id); el.innerHTML="";
    names.forEach(c=>{
      const o=document.createElement("option"); o.value=c;o.textContent=label(c);el.appendChild(o);
    });
  });
  setDefaults();
}

function setDefaults(){
  const c=$("crop").value;
  const r=CROPS[c]?.ranges;
  if(!r)return;
  FEATURES.forEach(f=>$(f).value=r[f]?.default ?? 0);
}

$("crop").addEventListener("change",setDefaults);

function values(){
  return {
    moisture:n("moisture"),temperature:n("temperature"),ph:n("ph"),ec:n("ec"),
    nitrogen:n("nitrogen"),phosphorus:n("phosphorus"),potassium:n("potassium")
  };
}

function status(v,range){
  if(v<range.low)return "LOW";
  if(v>range.high)return "HIGH";
  return "OK";
}

/* Browser-side replacement for the Python ML pipeline:
   It produces a health class and confidence from all 7 configured
   crop parameters. It is deterministic and requires no Python package. */
function predictHealth(v, crop){
  const ranges=CROPS[crop].ranges;
  let ok=0, distance=0;
  FEATURES.forEach(f=>{
    const r=ranges[f], span=Math.max(r.high-r.low,0.001);
    if(v[f]>=r.low && v[f]<=r.high) ok++;
    else distance += v[f]<r.low ? (r.low-v[f])/span : (v[f]-r.high)/span;
  });
  const score=ok/FEATURES.length;
  let prediction, confidence;
  if(score>=0.85){prediction="Healthy";confidence=75+score*25;}
  else if(score>=0.55){prediction="Warning";confidence=60+score*30;}
  else {prediction="Critical";confidence=65+(1-score)*30;}
  return {prediction,confidence:Math.min(99.9,confidence),ok,distance};
}

function soilType(v){
  let type, chars=[];
  if(v.ph<6){type="Acidic Soil";chars.push("Acidic — consider lime after confirming with a soil test.");}
  else if(v.ph>7.5){type="Alkaline Soil";chars.push("Alkaline — consider sulfur or organic matter.");}
  else {type="Neutral Soil";chars.push("Neutral pH — suitable for many crops.");}
  if(v.ec>2)chars.push("High salinity — drainage improvement may be needed.");
  else if(v.ec<0.5)chars.push("Low EC/fertility indication — consider nutrient management.");
  if(v.moisture<30)chars.push("Dry soil — improve water retention and irrigation.");
  else if(v.moisture>70)chars.push("High moisture — improve drainage to prevent waterlogging.");
  else chars.push("Good moisture retention.");
  if(v.nitrogen<40)chars.push("Low nitrogen — consider nitrogen fertilizer based on soil-test recommendation.");
  if(v.nitrogen>120)chars.push("High nitrogen — avoid over-fertilization.");
  return {type,chars};
}

function analyze(){
  const crop=$("crop").value,v=values(),r=CROPS[crop].ranges;
  const pred=predictHealth(v,crop), soil=soilType(v);
  let alerts=[], rows=[];
  FEATURES.forEach(f=>{
    const s=status(v[f],r[f]);
    if(s!=="OK")alerts.push(`${f.toUpperCase()} is ${s}.`);
    rows.push(`<tr><td>${f.toUpperCase()}</td><td>${v[f].toFixed(2)}</td><td>${r[f].low} - ${r[f].high}</td><td class="${s==="OK"?"ok":s.toLowerCase()}">${s}</td></tr>`);
  });
  const irrigation=v.moisture<r.moisture.low?"🚰 IRRIGATION REQUIRED":v.moisture>r.moisture.high?"💧 SOIL TOO WET":"✅ MOISTURE NORMAL";
  const advice=CROPS[crop].advice||[];
  const alternatives=findAlternatives(v,crop);

  $("result").innerHTML=`
    <div class="panel">
      <h2>🏞️ Soil Type Analysis</h2><h3>${soil.type}</h3>${soil.chars.map(x=>`<p>${x}</p>`).join("")}
    </div>
    <div class="cards">
      <div class="card ${pred.prediction.toLowerCase()}"><div>Soil Health</div><div class="metric">${pred.prediction}</div></div>
      <div class="card"><div>AI-style Confidence</div><div class="metric">${pred.confidence.toFixed(1)}%</div></div>
      <div class="card"><div>Selected Crop</div><div class="metric">${label(crop)}</div></div>
    </div>
    <div class="panel"><h2>### Parameter Analysis</h2>
      <table><thead><tr><th>Parameter</th><th>Value</th><th>Crop Range</th><th>Status</th></tr></thead>
      <tbody>${rows.join("")}</tbody></table>
    </div>
    <div class="panel"><h2>💧 Irrigation Alert</h2><div class="${v.moisture<r.moisture.low?"alert":v.moisture>r.moisture.high?"error":"success"}">${irrigation}</div></div>
    <div class="panel"><h2>⚠️ Parameter Alerts</h2>${alerts.length?alerts.map(a=>`<div class="alert">${a}</div>`).join(""):`<div class="success">All monitored parameters are within the configured crop ranges.</div>`}</div>
    <div class="panel"><h2>🌱 Crop Advice</h2>${advice.map(a=>`<p>• ${a}</p>`).join("")}</div>
    ${pred.prediction!=="Healthy"?`<div class="panel"><h2>🌾 Soil Condition Analysis</h2>
      <h3>Option 1: Improve Current Crop</h3>
      <p>Adjust parameters toward the recommended range, use irrigation/drainage as needed and apply targeted fertilizers.</p>
      <h3>Option 2: Switch to Suitable Crop</h3>
      ${alternatives.length?alternatives.map((a,i)=>`<p><b>${i+1}. ${label(a.crop)}</b> — Compatibility: ${a.score.toFixed(1)}%</p>`).join(""):"<p>No strong alternative found in the loaded training/profile data.</p>"}
    </div>`:""}
  `;
}

function findAlternatives(v,current){
  return Object.keys(CROPS).filter(c=>c!==current).map(c=>{
    const r=CROPS[c].ranges; let m=0;
    FEATURES.forEach(f=>{if(v[f]>=r[f].low&&v[f]<=r[f].high)m++;});
    return {crop:c,score:m/FEATURES.length*100};
  }).filter(x=>x.score>=70).sort((a,b)=>b.score-a.score).slice(0,3);
}

function planRotation(){
  const selected=[$("crop1").value,$("crop2").value,$("crop3").value].filter(Boolean);
  const v=values();
  const ranked=selected.map(c=>{
    const r=CROPS[c].ranges;let score=0;
    ["nitrogen","phosphorus","potassium"].forEach(f=>{if(v[f]>=r[f].low&&v[f]<=r[f].high)score+=2;});
    if(ROTATION[c]?.nitrogen_usage==="Low")score++;
    return {crop:c,score};
  }).sort((a,b)=>b.score-a.score);
  let day=0,total=0,html='<div class="timeline">';
  ranked.forEach((x,i)=>{
    const d=ROTATION[x.crop]?.growing_season||100;
    const start=day,end=day+d;
    html+=`<div class="timeline-item"><b>Step ${i+1}: ${label(x.crop)}</b><br>Duration: ${d} days<br>Days ${start}–${end}<br>Type: ${ROTATION[x.crop]?.crop_type||"Crop"}<br>N Usage: ${ROTATION[x.crop]?.nitrogen_usage||"Medium"}<br>Benefit: ${ROTATION[x.crop]?.benefits||"Rotation benefit"}</div>`;
    day=end+14;total=end;
  });
  html+=`</div><div class="success"><b>Total Rotation Cycle:</b> ${total} days (${(total/30).toFixed(1)} months)</div>`;
  $("rotationResult").innerHTML=html;
}

async function connectESP32(){
  if(!("serial" in navigator)){
    alert("Web Serial is not available in this browser. Use Google Chrome or Microsoft Edge on the laptop.");
    return;
  }
  try{
    serialPort=await navigator.serial.requestPort();
    await serialPort.open({baudRate:115200});
    $("connectBtn").disabled=true;$("disconnectBtn").disabled=false;
    $("serialStatus").textContent="ESP32 connected — waiting for SOIL data...";
    $("serialStatus").className="status connected";
    readSerial();
  }catch(e){
    $("serialStatus").textContent="ESP32 connection failed: "+e.message;
  }
}

async function readSerial(){
  if(!serialPort)return;
  const decoder=new TextDecoderStream();
  serialPort.readable.pipeTo(decoder.writable).catch(()=>{});
  reader=decoder.readable.getReader();
  try{
    while(true){
      const {value,done}=await reader.read();
      if(done)break;
      serialBuffer+=value;
      const lines=serialBuffer.split(/\r?\n/);
      serialBuffer=lines.pop();
      for(const line of lines) processSerialLine(line.trim());
    }
  }catch(e){}
}

function processSerialLine(line){
  if(!line.startsWith("SOIL,"))return;
  const p=line.split(",");
  if(p.length!==8)return;
  const vals=[p[1],p[2],p[3],p[4],p[5],p[6],p[7]].map(Number);
  if(vals.some(Number.isNaN))return;
  ["moisture","temperature","ph","ec","nitrogen","phosphorus","potassium"].forEach((id,i)=>{
    // Ignore NPK placeholder -1 from the current repository firmware.
    if(vals[i]!==-1)$(id).value=vals[i];
  });
  $("serialStatus").textContent="ESP32 connected — live sensor data received";
  $("serialStatus").className="status connected";
  analyze();
}

async function disconnectESP32(){
  try{if(reader)await reader.cancel();}catch(e){}
  try{if(serialPort)await serialPort.close();}catch(e){}
  serialPort=null;reader=null;
  $("connectBtn").disabled=false;$("disconnectBtn").disabled=true;
  $("serialStatus").textContent="ESP32 disconnected — manual input mode";
  $("serialStatus").className="status";
}

$("testBtn").addEventListener("click",analyze);
$("rotationBtn").addEventListener("click",planRotation);
$("connectBtn").addEventListener("click",connectESP32);
$("disconnectBtn").addEventListener("click",disconnectESP32);

document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>{
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.querySelectorAll(".tab-content").forEach(x=>x.classList.remove("active"));
  btn.classList.add("active");$(btn.dataset.tab).classList.add("active");
}));

loadProfiles();
