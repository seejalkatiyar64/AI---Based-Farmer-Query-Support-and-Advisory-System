// PASTE THIS ENTIRE FILE AS App.jsx
// Real-time weather added via OpenWeatherMap API

import { useState, useEffect, useRef } from "react";

// ── CHANGE THESE 2 LINES ──────────────────────────────────────────────────────
const WEATHER_API_KEY = "YOUR WEATHER_API_KEY"; // openweathermap.org → free key
const WEATHER_CITY    = "Kanpur";                  // apna shahar likho (English mein)
// ─────────────────────────────────────────────────────────────────────────────

const CROPS = ["गेहूं (Wheat)","धान (Rice)","सोयाबीन (Soybean)","मक्का (Maize)","कपास (Cotton)","गन्ना (Sugarcane)","टमाटर (Tomato)","प्याज (Onion)"];
const CROP_PROFIT_DATA = {
  "गेहूं (Wheat)":     {cost:18000,revenue:32000,yield:"40 q/ha",season:"रबी",   risk:"कम"},
  "धान (Rice)":        {cost:22000,revenue:38000,yield:"50 q/ha",season:"खरीफ", risk:"मध्यम"},
  "सोयाबीन (Soybean)":{cost:14000,revenue:28000,yield:"25 q/ha",season:"खरीफ", risk:"कम"},
  "मक्का (Maize)":    {cost:16000,revenue:30000,yield:"60 q/ha",season:"खरीफ", risk:"कम"},
  "कपास (Cotton)":    {cost:28000,revenue:55000,yield:"20 q/ha",season:"खरीफ", risk:"उच्च"},
  "गन्ना (Sugarcane)":{cost:35000,revenue:70000,yield:"800 q/ha",season:"वर्षभर",risk:"मध्यम"},
  "टमाटर (Tomato)":   {cost:45000,revenue:90000,yield:"300 q/ha",season:"रबी",  risk:"उच्च"},
  "प्याज (Onion)":    {cost:30000,revenue:60000,yield:"200 q/ha",season:"रबी",  risk:"उच्च"},
};
const DISEASE_MOCK = [
  {name:"पर्ण कुंचन (Leaf Curl)",confidence:87,severity:"मध्यम",treatment:"नीम तेल स्प्रे करें, 3 दिन में दोहराएं",color:"#f59e0b"},
  {name:"भूरा धब्बा (Brown Spot)",confidence:72,severity:"हल्का",treatment:"मैन्कोज़ेब 2g/L पानी में मिलाकर छिड़काव करें",color:"#10b981"},
];
const CHAT_SUGGESTIONS = [
  "मेरी फसल में कीट लग रहे हैं?","इस हफ्ते बारिश होगी?",
  "गेहूं की सबसे अच्छी किस्म?","खाद कब और कितनी डालें?","फसल बीमा कैसे लें?",
];

// Hindi condition map
function conditionHindi(d){
  const m={"clear sky":"साफ आसमान","few clouds":"थोड़े बादल","scattered clouds":"बिखरे बादल","broken clouds":"टूटे बादल","overcast clouds":"घने बादल","light rain":"हल्की बारिश","moderate rain":"मध्यम बारिश","heavy intensity rain":"भारी बारिश","thunderstorm":"गरज-चमक","snow":"बर्फबारी","mist":"धुंध","haze":"धुंध","fog":"कोहरा"};
  return m[d?.toLowerCase()]||d||"आंशिक बादल";
}
function wIcon(id){
  if(!id)return"⛅";
  if(id>=200&&id<300)return"⛈️";
  if(id>=300&&id<400)return"🌦️";
  if(id>=500&&id<600)return"🌧️";
  if(id>=600&&id<700)return"❄️";
  if(id>=700&&id<800)return"🌫️";
  if(id===800)return"☀️";
  if(id>800)return"⛅";
  return"🌤️";
}
function getRisk(h,t){
  if(h>80&&t>25)return{level:"उच्च",color:"#ef4444",icon:"🔴"};
  if(h>65&&t>22)return{level:"मध्यम",color:"#f59e0b",icon:"🟡"};
  return{level:"कम",color:"#10b981",icon:"🟢"};
}
const OPENROUTER_API_KEY = "YOUR OPENROUTER_API_KEY";

async function callClaude(messages, system) {
  try {
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "KrishiMitra AI"
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct:free",
          messages: [
            {
              role: "system",
              content: system
            },
            ...messages.map((m) => ({
              role: m.role === "assistant" ? "assistant" : "user",
              content: m.content || m.text
            }))
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      }
    );

    const data = await response.json();

    console.log("OPENROUTER RESPONSE:", data);

    if (!response.ok) {
      console.error("API ERROR:", data);
      return "AI service error aa gaya. API key ya model check karo.";
    }

    return (
      data?.choices?.[0]?.message?.content ||
      "माफ करें, अभी जवाब नहीं मिला।"
    );

  } catch (error) {
    console.error("CHAT ERROR:", error);
    return "नेटवर्क समस्या। कृपया दोबारा कोशिश करें।";
  }
}
// ── REAL-TIME WEATHER HOOK ────────────────────────────────────────────────────
function useWeather(){
  const [weather,setWeather]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState(null);

  async function fetch_weather(){
    try{
      setLoading(true);
      const r=await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${WEATHER_CITY}&appid=${WEATHER_API_KEY}&units=metric`);
      if(!r.ok)throw new Error("Invalid API key or city");
      const d=await r.json();
      const fr=await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${WEATHER_CITY}&appid=${WEATHER_API_KEY}&units=metric&cnt=5`);
      const fd=await fr.json();
      const days=["आज","कल","परसों","4 दिन","5 दिन"];
      setWeather({
        city:d.name+", "+d.sys.country,
        temp:Math.round(d.main.temp),
        feelsLike:Math.round(d.main.feels_like),
        humidity:d.main.humidity,
        wind:Math.round(d.wind.speed*3.6),
        condition:conditionHindi(d.weather?.[0]?.description),
        icon:wIcon(d.weather?.[0]?.id),
        rainChance:Math.round(((fd.list?.[0]?.pop)||0)*100),
        forecast:(fd.list||[]).slice(0,5).map((f,i)=>({
          day:days[i],icon:wIcon(f.weather?.[0]?.id),
          high:Math.round(f.main.temp_max),low:Math.round(f.main.temp_min),
          rain:Math.round((f.pop||0)*100),
        })),
        lastUpdated:new Date().toLocaleTimeString("hi-IN"),
      });
      setError(null);
    }catch(e){
      setError(e.message);
      setWeather({city:WEATHER_CITY+" (ऑफलाइन)",temp:28,feelsLike:30,humidity:74,wind:12,
        condition:"आंशिक बादल",icon:"⛅",rainChance:20,
        forecast:[{day:"आज",icon:"⛅",high:30,low:22,rain:20},{day:"कल",icon:"🌧️",high:26,low:20,rain:75},{day:"परसों",icon:"🌦️",high:27,low:21,rain:55},{day:"शुक्र",icon:"☀️",high:32,low:23,rain:5},{day:"शनि",icon:"☀️",high:33,low:24,rain:0}],
        lastUpdated:"ऑफलाइन",
      });
    }finally{setLoading(false);}
  }

  useEffect(()=>{
    fetch_weather();
    const t=setInterval(fetch_weather,10*60*1000); // refresh every 10 min
    return()=>clearInterval(t);
  },[]);

  return{weather,loading,error};
}

// ── ALERT BANNER ──────────────────────────────────────────────────────────────
function AlertBanner({alerts}){
  const [idx,setIdx]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setIdx(i=>(i+1)%alerts.length),4000);return()=>clearInterval(t);},[alerts.length]);
  if(!alerts.length)return null;
  const a=alerts[idx];
  return(
    <div style={{background:a.bg,color:a.color}} className="flex items-center gap-3 px-4 py-2 text-sm font-semibold rounded-xl mb-4 shadow">
      <span>{a.icon}</span><span>{a.text}</span><span className="ml-auto text-xs opacity-70">{idx+1}/{alerts.length}</span>
    </div>
  );
}

// ── WEATHER CARD (real-time) ───────────────────────────────────────────────────
function WeatherCard({w,loading,error}){
  if(loading)return(
    <div className="rounded-2xl p-5 shadow-lg flex items-center justify-center h-40" style={{background:"linear-gradient(135deg,#1a472a,#2d6a4f)"}}>
      <div className="text-center"><p className="text-3xl animate-pulse">🌤️</p><p className="text-green-200 text-sm mt-2">मौसम लोड हो रहा है...</p></div>
    </div>
  );
  const risk=getRisk(w.humidity,w.temp);
  return(
    <div className="rounded-2xl p-5 shadow-lg" style={{background:"linear-gradient(135deg,#1a472a,#2d6a4f)"}}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <p className="text-green-200 text-xs font-semibold uppercase tracking-widest">📍 {w.city}</p>
          <div className="flex items-end gap-2 mt-1">
            <p className="text-white text-5xl font-bold">{w.temp}°C</p>
            <p className="text-3xl mb-1">{w.icon}</p>
          </div>
          <p className="text-green-200">{w.condition}</p>
          <p className="text-green-300 text-xs mt-0.5">feels like {w.feelsLike}°C</p>
        </div>
        <div className="bg-white/10 rounded-xl p-3 text-right">
          <p className="text-white/70 text-xs">आर्द्रता</p><p className="text-white font-bold text-lg">{w.humidity}%</p>
          <p className="text-white/70 text-xs mt-1">हवा</p><p className="text-white font-bold">{w.wind} km/h</p>
          <p className="text-white/70 text-xs mt-1">बारिश</p><p className="text-blue-300 font-bold">{w.rainChance}%</p>
        </div>
      </div>
      {error&&<div className="bg-yellow-500/20 rounded-xl p-2 mb-3 text-xs text-yellow-200">⚠️ API key डालें – अभी mock data है। WEATHER_API_KEY बदलें।</div>}
      <div className="bg-white/10 rounded-xl p-3 mb-3">
        <p className="text-green-200 text-xs mb-1">🍄 फफूंद जोखिम (AI)</p>
        <div className="flex items-center gap-2">
          <span>{risk.icon}</span><span className="font-bold text-white">{risk.level}</span>
          <span className="text-white/60 text-xs ml-auto">अपडेट: {w.lastUpdated}</span>
        </div>
      </div>
      <div className="grid grid-cols-5 gap-1">
        {w.forecast.map((f,i)=>(
          <div key={i} className="bg-white/10 rounded-lg p-2 text-center">
            <p className="text-green-200 text-xs">{f.day}</p><p className="text-lg">{f.icon}</p>
            <p className="text-white text-xs font-bold">{f.high}°</p><p className="text-blue-300 text-xs">{f.rain}%🌧</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function DashboardPage({farmer,setFarmer}){
  const [showEdit,setShowEdit]=useState(false);
  const [editForm,setEditForm]=useState({...farmer});
  const {weather,loading,error}=useWeather();

  const alerts=weather?[
    weather.rainChance>50
      ?{icon:"🌧️",title:`${weather.rainChance}% बारिश की संभावना`,desc:"कटाई टालें, नाली बनाएं",color:"#3b82f6",bg:"#eff6ff"}
      :{icon:"☀️",title:"मौसम साफ है",desc:"सिंचाई के लिए उचित समय",color:"#10b981",bg:"#f0fdf4"},
    weather.humidity>75
      ?{icon:"🍄",title:`फफूंद जोखिम: उच्च (${weather.humidity}%)`,desc:"नीम तेल छिड़काव करें",color:"#ef4444",bg:"#fef2f2"}
      :{icon:"🍄",title:`फफूंद जोखिम: कम (${weather.humidity}%)`,desc:"स्थिति सामान्य",color:"#10b981",bg:"#f0fdf4"},
    weather.temp>35
      ?{icon:"🌡️",title:`तापमान अधिक: ${weather.temp}°C`,desc:"सुबह या शाम सिंचाई करें",color:"#f59e0b",bg:"#fffbeb"}
      :{icon:"🌡️",title:`तापमान: ${weather.temp}°C`,desc:`feels like ${weather.feelsLike}°C`,color:"#6b7280",bg:"#f9fafb"},
    {icon:"💨",title:`हवा: ${weather.wind} km/h`,desc:weather.wind>30?"तेज हवा – छिड़काव न करें":"छिड़काव के लिए उचित मौसम",color:"#8b5cf6",bg:"#f5f3ff"},
  ]:[];

  const marquee=[
    {icon:"⚠️",text:"कल भारी वर्षा – फसल की सुरक्षा करें",bg:"#fef3c7",color:"#92400e"},
    {icon:"🌡️",text:"तापमान 30°C से ऊपर – अधिक सिंचाई करें",bg:"#fee2e2",color:"#991b1b"},
    {icon:"✅",text:"गेहूं की MSP ₹2,275/क्विंटल घोषित",bg:"#d1fae5",color:"#065f46"},
  ];

  return(
    <div className="space-y-4 pb-20">
      <AlertBanner alerts={marquee}/>

      {/* Profile */}
      <div className="rounded-2xl p-4 shadow bg-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{background:"#d1fae5"}}>👨‍🌾</div>
          <div><p className="font-bold text-gray-800">{farmer.name}</p><p className="text-sm text-gray-500">📍 {farmer.location}</p></div>
          <button onClick={()=>setShowEdit(true)} className="ml-auto text-xs text-green-600 font-semibold border border-green-200 px-3 py-1 rounded-lg">संपादित करें</button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[["🌾","फसल",farmer.crop.split("(")[0],"#f0fdf4"],["📐","क्षेत्र",farmer.area+" एकड़","#eff6ff"],["📅","अनुभव",farmer.experience+" वर्ष","#fefce8"]].map(([e,l,v,c],i)=>(
            <div key={i} className="rounded-xl p-2 text-center" style={{background:c}}>
              <p className="text-lg">{e}</p><p className="text-xs text-gray-500">{l}</p><p className="text-xs font-bold text-gray-700">{v}</p>
            </div>
          ))}
        </div>
      </div>

      {/* LIVE WEATHER */}
      <WeatherCard w={weather} loading={loading} error={error}/>

      {/* Dynamic Alerts */}
      {weather&&(
        <div className="rounded-2xl p-4 shadow bg-white">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><span>🔔</span> स्मार्ट अलर्ट (Live)</h3>
          <div className="space-y-2">
            {alerts.map((a,i)=>(
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl border-l-4" style={{borderColor:a.color,background:a.bg}}>
                <span className="text-xl">{a.icon}</span>
                <div><p className="font-semibold text-sm" style={{color:a.color}}>{a.title}</p><p className="text-xs text-gray-600">{a.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Crop status */}
      <div className="bg-white rounded-2xl p-4 shadow">
        <h3 className="font-bold text-gray-800 mb-3">🌱 फसल स्थिति – {farmer.crop.split("(")[0]}</h3>
        {[
          {label:"विकास चरण",value:"फूल आना",percent:65,color:"#10b981"},
          {label:"मिट्टी नमी",value:weather?`${weather.humidity}%`:"72%",percent:weather?.humidity||72,color:"#3b82f6"},
          {label:"पोषण स्तर",value:"अच्छा",percent:80,color:"#8b5cf6"},
        ].map((item,i)=>(
          <div key={i} className="mb-3">
            <div className="flex justify-between text-sm mb-1"><span className="text-gray-600">{item.label}</span><span className="font-semibold text-gray-800">{item.value}</span></div>
            <div className="w-full bg-gray-100 rounded-full h-2"><div className="h-2 rounded-full" style={{width:`${item.percent}%`,background:item.color}}/></div>
          </div>
        ))}
      </div>

      {/* AI tip based on live weather */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-500 rounded-2xl p-4 text-white">
        <h3 className="font-bold mb-2 flex items-center gap-2">💡 AI सुझाव (Live मौसम पर)</h3>
        <p className="text-green-100 text-sm leading-relaxed">
          {!weather?"मौसम डेटा लोड हो रहा है...":
           weather.rainChance>50?`🌧️ आज ${weather.rainChance}% बारिश – सिंचाई बंद रखें और जल निकासी सुनिश्चित करें।`:
           weather.humidity>75?`🍄 नमी ${weather.humidity}% – फफूंद जोखिम उच्च है। नीम तेल (5ml/L) तुरंत छिड़काव करें।`:
           weather.temp>35?`🌡️ तापमान ${weather.temp}°C – सुबह 7 बजे से पहले सिंचाई करें। दोपहर में खेत में न जाएं।`:
           `✅ मौसम अनुकूल है (${weather.temp}°C, ${weather.humidity}% नमी)। ${farmer.crop.split("(")[0]} की नियमित देखभाल जारी रखें।`}
        </p>
      </div>

      {/* Edit Modal */}
      {showEdit&&(
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 className="font-bold text-gray-800 text-lg mb-4">प्रोफ़ाइल संपादित करें</h3>
            {[{label:"नाम",key:"name",type:"text"},{label:"स्थान",key:"location",type:"text"},{label:"क्षेत्र (एकड़)",key:"area",type:"number"},{label:"अनुभव (वर्ष)",key:"experience",type:"number"}].map(f=>(
              <div key={f.key} className="mb-3">
                <label className="text-sm text-gray-600 mb-1 block">{f.label}</label>
                <input type={f.type} value={editForm[f.key]} onChange={e=>setEditForm({...editForm,[f.key]:e.target.value})}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400"/>
              </div>
            ))}
            <div className="mb-4">
              <label className="text-sm text-gray-600 mb-1 block">फसल</label>
              <select value={editForm.crop} onChange={e=>setEditForm({...editForm,crop:e.target.value})}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400">
                {CROPS.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowEdit(false)} className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm">रद्द</button>
              <button onClick={()=>{setFarmer(editForm);setShowEdit(false);}} className="flex-1 py-2 rounded-xl text-white text-sm font-semibold" style={{background:"#16a34a"}}>सहेजें</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── CHAT PAGE ─────────────────────────────────────────────────────────────────
function ChatPage({farmer}){
  const {weather}=useWeather();
  const [messages,setMessages]=useState([{role:"assistant",text:`नमस्ते ${farmer.name} जी! 🙏 मैं KrishiMitra हूं। आपकी ${farmer.crop.split("(")[0]} फसल के बारे में पूछें।`}]);
  const [input,setInput]=useState("");
  const [loading,setLoading]=useState(false);
  const [listening,setListening]=useState(false);
  const bottomRef=useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"});},[messages]);

  const SYSTEM=`You are KrishiMitra, expert AI farming assistant. Farmer: ${farmer.name}, ${farmer.location}, Crop: ${farmer.crop}, Area: ${farmer.area} acres. LIVE Weather: ${weather?.temp||28}°C, ${weather?.humidity||74}% humidity, ${weather?.wind||12}km/h wind, Rain: ${weather?.rainChance||20}%. ALWAYS respond in Hindi (3-5 sentences, practical, emoji at end).`;

  
  
  const send = async (text) => {
  const msg = text || input.trim();
  if (!msg) return;

  setInput("");

  const nm = [...messages, { role: "user", text: msg }];
  setMessages(nm);
  setLoading(true);

  try {
    console.log("FRONTEND CHAT HIT");

    const response = await fetch("http://localhost:5000/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: msg,
        farmer,
        weather,
      }),
    });

    const data = await response.json();

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: data.reply || "उत्तर नहीं मिला",
      },
    ]);
  } catch (err) {
    console.error(err);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        text: "सर्वर connect नहीं हुआ ❌",
      },
    ]);
  }

  setLoading(false);
};

  const startVoice=()=>{
    if(!("webkitSpeechRecognition"in window||"SpeechRecognition"in window)){alert("वॉइस सपोर्ट नहीं");return;}
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    const r=new SR();r.lang="hi-IN";
    r.onstart=()=>setListening(true);r.onend=()=>setListening(false);
    r.onresult=e=>setInput(e.results[0][0].transcript);r.start();
  };

  return(
    <div className="flex flex-col h-[calc(100vh-140px)]">
      <div className="flex-1 overflow-y-auto space-y-3 pb-2">
        {messages.map((m,i)=>(
          <div key={i} className={`flex ${m.role==="user"?"justify-end":"justify-start"}`}>
            {m.role==="assistant"&&<div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mr-2 flex-shrink-0" style={{background:"#d1fae5"}}>🤖</div>}
            <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${m.role==="user"?"text-white rounded-br-sm":"bg-white text-gray-700 rounded-bl-sm shadow"}`}
              style={m.role==="user"?{background:"#16a34a"}:{}}>{m.text}</div>
          </div>
        ))}
        {loading&&<div className="flex justify-start"><div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mr-2" style={{background:"#d1fae5"}}>🤖</div><div className="bg-white px-4 py-3 rounded-2xl shadow"><div className="flex gap-1">{[0,1,2].map(i=><div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{background:"#16a34a",animationDelay:`${i*0.15}s`}}/>)}</div></div></div>}
        <div ref={bottomRef}/>
      </div>
      <div className="flex gap-2 overflow-x-auto py-2">
        {CHAT_SUGGESTIONS.map((s,i)=><button key={i} onClick={()=>send(s)} className="flex-shrink-0 text-xs px-3 py-2 rounded-full border text-green-700 border-green-200 bg-green-50 whitespace-nowrap">{s}</button>)}
      </div>
      <div className="flex gap-2 pt-2">
        <button onClick={startVoice} className="w-12 h-12 rounded-xl flex items-center justify-center text-xl"
          style={{background:listening?"#ef4444":"#f0fdf4",border:`2px solid ${listening?"#ef4444":"#bbf7d0"}`}}>
          {listening?"⏹":"🎤"}
        </button>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="अपना सवाल यहाँ लिखें..."
          className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-green-400"/>
        <button onClick={()=>send()} className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl" style={{background:"#16a34a"}}>➤</button>
      </div>
    </div>
  );
}

// ── DISEASE PAGE ──────────────────────────────────────────────────────────────
function DiseasePage({farmer}){
  const [image,setImage]=useState(null);
  const [preview,setPreview]=useState(null);
  const [result,setResult]=useState(null);
  const [loading,setLoading]=useState(false);
  const fileRef=useRef(null);

  const handleFile=f=>{if(!f)return;setImage(f);setResult(null);const r=new FileReader();r.onloadend=()=>setPreview(r.result);r.readAsDataURL(f);};
  const analyze=async()=>{setLoading(true);await new Promise(r=>setTimeout(r,2000));setResult({diseases:DISEASE_MOCK,overall:"मध्यम जोखिम",suggestion:`${farmer.crop.split("(")[0]} में पर्ण कुंचन रोग – नीम तेल (5ml/L) छिड़काव करें।`,prevention:["संक्रमित पत्तियां तोड़ें","खेत में पानी न भरने दें","स्वस्थ बीज प्रयोग करें"]});setLoading(false);};

  return(
    <div className="space-y-4 pb-20">
      <div className="bg-white rounded-2xl p-4 shadow">
        <h3 className="font-bold text-gray-800 mb-1">📸 फसल रोग पहचान</h3>
        <p className="text-xs text-gray-500 mb-4">पत्ती या तने की फोटो अपलोड करें</p>
        <div onDrop={e=>{e.preventDefault();handleFile(e.dataTransfer.files[0]);}} onDragOver={e=>e.preventDefault()}
          onClick={()=>!preview&&fileRef.current?.click()}
          className="border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer hover:border-green-400"
          style={{borderColor:preview?"#16a34a":"#d1d5db",background:preview?"#f0fdf4":"#f9fafb"}}>
          {preview?<img src={preview} alt="crop" className="w-full max-h-48 object-contain rounded-xl"/>:<><p className="text-4xl mb-3">📷</p><p className="text-gray-600 font-semibold">फोटो खींचें या चुनें</p><p className="text-gray-400 text-xs mt-1">JPG, PNG – 10MB तक</p></>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e=>handleFile(e.target.files[0])}/>
        {preview&&<div className="flex gap-2 mt-3">
          <button onClick={()=>{setImage(null);setPreview(null);setResult(null);}} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm">हटाएं</button>
          <button onClick={analyze} disabled={loading} className="flex-1 py-3 rounded-xl text-white text-sm font-bold" style={{background:loading?"#86efac":"#16a34a"}}>{loading?"विश्लेषण जारी...":"🔍 जांच करें"}</button>
        </div>}
      </div>
      {result&&<div className="space-y-3">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4"><p className="font-bold text-amber-800">⚠️ {result.overall}</p><p className="text-sm text-amber-700 mt-1">{result.suggestion}</p></div>
        {result.diseases.map((d,i)=><div key={i} className="bg-white rounded-2xl p-4 shadow">
          <div className="flex justify-between mb-2"><p className="font-bold text-gray-800">{d.name}</p><span className="text-xs px-2 py-1 rounded-full font-bold" style={{background:d.color+"20",color:d.color}}>{d.severity}</span></div>
          <div className="w-full bg-gray-100 rounded-full h-2 mb-2"><div className="h-2 rounded-full" style={{width:`${d.confidence}%`,background:d.color}}/></div>
          <div className="bg-green-50 rounded-xl p-3"><p className="text-xs font-semibold text-green-800">💊 उपचार:</p><p className="text-xs text-green-700 mt-1">{d.treatment}</p></div>
        </div>)}
        <div className="bg-white rounded-2xl p-4 shadow"><p className="font-bold text-gray-800 mb-2">🛡️ रोकथाम</p>{result.prevention.map((p,i)=><div key={i} className="flex items-center gap-2 py-1"><span className="text-green-500 font-bold">✓</span><span className="text-sm text-gray-700">{p}</span></div>)}</div>
      </div>}
      {!preview&&<div className="bg-white rounded-2xl p-4 shadow"><p className="font-semibold text-gray-700 mb-3 text-sm">📋 उदाहरण रोग</p><div className="grid grid-cols-2 gap-2">{[["पर्ण कुंचन","🍃","#fef3c7"],["झुलसा रोग","🍂","#fee2e2"],["कीट नुकसान","🐛","#f0fdf4"],["पीला रोग","🌿","#fefce8"]].map(([n,e,c],i)=><div key={i} className="rounded-xl p-4 text-center" style={{background:c}}><p className="text-3xl mb-1">{e}</p><p className="text-xs font-semibold text-gray-700">{n}</p></div>)}</div></div>}
    </div>
  );
}

// ── PROFIT PAGE ───────────────────────────────────────────────────────────────
function ProfitPage({farmer}){
  const [cropA,setCropA]=useState(farmer.crop);
  const [cropB,setCropB]=useState("कपास (Cotton)");
  const [area,setArea]=useState(farmer.area||2);
  const [ai,setAi]=useState("");
  const [busy,setBusy]=useState(false);
  const calc=c=>{const d=CROP_PROFIT_DATA[c];if(!d)return null;return{...d,totalCost:d.cost*area,totalRevenue:d.revenue*area,profit:(d.revenue-d.cost)*area,roi:(((d.revenue-d.cost)/d.cost)*100).toFixed(1)};};
  const a=calc(cropA),b=calc(cropB),fmt=n=>`₹${n?.toLocaleString("en-IN")}`,winner=a&&b?(a.profit>b.profit?cropA:cropB):null;
  const getAI=async()=>{setBusy(true);const r=await callClaude([{role:"user",content:`Farmer ${farmer.location}: ${cropA} profit ₹${a?.profit} vs ${cropB} profit ₹${b?.profit}, ${area} acres. 4-5 sentences Hindi recommendation.`}],"Agricultural expert. Always Hindi.");setAi(r);setBusy(false);};

  return(
    <div className="space-y-4 pb-20">
      <div className="bg-white rounded-2xl p-4 shadow">
        <h3 className="font-bold text-gray-800 mb-4">💰 फसल लाभ तुलनाकर्ता</h3>
        <div className="space-y-3">
          {[{label:"फसल A",val:cropA,set:setCropA},{label:"फसल B",val:cropB,set:setCropB}].map(({label,val,set},i)=>(
            <div key={i}><label className="text-sm text-gray-600 mb-1 block">{label}</label>
              <select value={val} onChange={e=>set(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400">
                {CROPS.map(c=><option key={c}>{c}</option>)}
              </select></div>
          ))}
          <div><label className="text-sm text-gray-600 mb-1 block">क्षेत्र: <strong>{area} एकड़</strong></label>
            <input type="range" min="0.5" max="10" step="0.5" value={area} onChange={e=>setArea(parseFloat(e.target.value))} className="w-full accent-green-600"/></div>
        </div>
      </div>
      {a&&b&&<div className="grid grid-cols-2 gap-3">
        {[{crop:cropA,data:a},{crop:cropB,data:b}].map(({crop,data},i)=>{
          const isW=winner===crop;
          return<div key={i} className="rounded-2xl p-4 shadow relative overflow-hidden" style={{background:isW?"linear-gradient(135deg,#16a34a,#15803d)":"white",border:isW?"none":"2px solid #e5e7eb"}}>
            {isW&&<div className="absolute top-2 right-2 text-xs bg-yellow-400 text-yellow-900 font-bold px-2 py-0.5 rounded-full">🏆 बेहतर</div>}
            <p className="font-bold text-sm mb-3" style={{color:isW?"white":"#1f2937"}}>{crop.split("(")[0]}</p>
            {[["लागत",fmt(data.totalCost)],["आय",fmt(data.totalRevenue)],["लाभ",fmt(data.profit)],["ROI",data.roi+"%"]].map(([l,v],j)=>(
              <div key={j} className="flex justify-between text-xs py-1" style={{borderBottom:`1px solid ${isW?"rgba(255,255,255,0.2)":"#f3f4f6"}`}}>
                <span style={{color:isW?"#bbf7d0":"#6b7280"}}>{l}</span><span className="font-bold" style={{color:isW?"white":"#1f2937"}}>{v}</span>
              </div>
            ))}
          </div>;
        })}
      </div>}
      <div className="bg-white rounded-2xl p-4 shadow">
        <button onClick={getAI} disabled={busy} className="w-full py-3 rounded-xl text-white font-bold text-sm mb-3" style={{background:busy?"#86efac":"#16a34a"}}>
          {busy?"AI विश्लेषण जारी...":"🤖 AI से सुझाव लें"}
        </button>
        {ai&&<div className="bg-green-50 rounded-xl p-3"><p className="text-xs font-bold text-green-800 mb-1">🌾 KrishiMitra सुझाव:</p><p className="text-sm text-green-700 leading-relaxed">{ai}</p></div>}
      </div>
      <div className="bg-white rounded-2xl p-4 shadow">
        <h4 className="font-bold text-gray-800 mb-3">🏛️ सरकारी योजनाएं</h4>
        {[{name:"PM किसान",amount:"₹6,000/वर्ष",status:"उपलब्ध",color:"#10b981"},{name:"फसल बीमा",amount:"प्रीमियम: 2%",status:"पंजीकरण खुला",color:"#3b82f6"},{name:"KCC ऋण",amount:"₹3 लाख तक",status:"ब्याज 4%",color:"#8b5cf6"}].map((s,i)=>(
          <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
            <div><p className="text-sm font-semibold text-gray-800">{s.name}</p><p className="text-xs text-gray-500">{s.amount}</p></div>
            <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{background:s.color+"20",color:s.color}}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
export default function App(){
  const [page,setPage]=useState("dashboard");
  const [farmer,setFarmer]=useState({name:"रामलाल पटेल",location:"पुणे, महाराष्ट्र",crop:"गेहूं (Wheat)",area:3,experience:12,history:[]});
  const PAGES=[{id:"dashboard",icon:"🏠",label:"होम"},{id:"chat",icon:"🤖",label:"AI चैट"},{id:"disease",icon:"📸",label:"रोग जांच"},{id:"profit",icon:"💰",label:"लाभ"}];

  return(
    <div className="min-h-screen" style={{background:"#f0fdf4",fontFamily:"'Noto Sans Devanagari',sans-serif"}}>
      <header className="sticky top-0 z-40 shadow-sm" style={{background:"linear-gradient(135deg,#14532d,#16a34a)"}}>
        <div className="flex items-center justify-between px-4 py-3 max-w-lg mx-auto">
          <div className="flex items-center gap-2"><span className="text-2xl">🌾</span><div><p className="font-bold text-white text-sm leading-none">KrishiMitra AI</p><p className="text-green-200 text-xs">कृषि बुद्धिमत्ता प्रणाली</p></div></div>
          <div className="bg-white/20 rounded-full px-3 py-1 text-xs text-white">📡 Live</div>
        </div>
      </header>
      <main className="max-w-lg mx-auto px-4 pt-4">
        {page==="dashboard"&&<DashboardPage farmer={farmer} setFarmer={setFarmer}/>}
        {page==="chat"&&<ChatPage farmer={farmer}/>}
        {page==="disease"&&<DiseasePage farmer={farmer}/>}
        {page==="profit"&&<ProfitPage farmer={farmer}/>}
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-green-100 bg-white">
        <div className="max-w-lg mx-auto flex">
          {PAGES.map(p=>(
            <button key={p.id} onClick={()=>setPage(p.id)} className="flex-1 flex flex-col items-center py-3 gap-0.5" style={{color:page===p.id?"#16a34a":"#9ca3af"}}>
              <span className={`text-2xl ${page===p.id?"scale-110":""}`}>{p.icon}</span>
              <span className="text-xs font-semibold">{p.label}</span>
              {page===p.id&&<div className="w-1 h-1 rounded-full" style={{background:"#16a34a"}}/>}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
