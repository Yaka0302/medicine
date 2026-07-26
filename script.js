const steps = [
  {
    emoji:"🧼",
    main:"てを きれいに しよう",
    sub:"おとなのひとと てを きれいに しよう",
    rhythm:"ごしごし・ぴかぴか",
    notes:[392,392,440,392]
  },
  {
    emoji:"🔎",
    main:"おくすりを かくにん",
    sub:"なまえ・りょう・じかんを おとなのひとが かくにん",
    rhythm:"みて・かくにん・だいじょうぶ",
    notes:[330,null,392]
  },
  {
    emoji:"🪑",
    main:"すわって じゅんび",
    sub:"あわてず らくな しせいに なろう",
    rhythm:"ゆっくり・すー・はー",
    notes:[392,440,523]
  },
  {
    emoji:"🥤",
    main:"おみずを じゅんび",
    sub:"ひつような ときだけ おとなのひとと じゅんび",
    rhythm:"ことん・じゅんび・できた",
    notes:[330,392,440]
  },
  {
    emoji:"💊",
    main:"おとなのひとと のもう",
    sub:"のみおわったら おとなのひとが かくにん",
    rhythm:"ゆっくり・だいじょうぶ",
    notes:[392,523,659]
  }
];

let selectedMode = "normal";
let currentStep = 0;
let progressValue = 0;
let running = false;
let soundOn = true;
let lastPose = null;
let lastTime = performance.now();
let audioCtx = null;
let bgmTimer = null;
let rhythmTimer = null;
let camera = null;
let completed = new Set();
let flowTimer = null;
let countdownTimer = null;

const $ = id => document.getElementById(id);

function show(id){
  ["cover","mode","permission","selectScreen","finish"].forEach(x => $(x).classList.remove("show"));
  $("play").classList.remove("show");
  if(id === "play") $("play").classList.add("show");
  else $(id).classList.add("show");
}

function initAudio(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === "suspended") audioCtx.resume();
}

function tone(freq, duration=.9, volume=.02, type="sine", delay=0){
  if(!soundOn || !freq) return;
  initAudio();

  const start = audioCtx.currentTime + delay;
  const osc1 = audioCtx.createOscillator();
  const osc2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();

  osc1.type = "sine";
  osc1.frequency.value = freq;

  osc2.type = "sine";
  osc2.frequency.value = freq * 2;
  osc2.detune.value = -5;

  filter.type = "lowpass";
  filter.frequency.value = selectedMode === "care" ? 1350 : 1650;
  filter.Q.value = 0.5;

  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .018);
  gain.gain.exponentialRampToValueAtTime(volume * .35, start + .16);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);

  const overtoneGain = audioCtx.createGain();
  overtoneGain.gain.value = selectedMode === "care" ? 0.08 : 0.12;

  osc1.connect(filter);
  osc2.connect(overtoneGain);
  overtoneGain.connect(filter);
  filter.connect(gain);
  gain.connect(audioCtx.destination);

  osc1.start(start);
  osc2.start(start);
  osc1.stop(start + duration + .05);
  osc2.stop(start + duration + .05);
}

function playNotes(notes, gap=.55){
  notes.forEach((n,i)=>{
    if(n) tone(n,.26,selectedMode==="care"?.018:.028,"sine",i*gap);
  });
}

function startBgm(){
  stopBgm();
  if(!soundOn) return;

  // Cメジャー中心、低めの音域で安心感を重視
  const melodyNormal = [261.63,329.63,392.00,329.63,293.66,349.23,392.00,329.63];
  const melodyCare   = [261.63,null,329.63,null,392.00,null,329.63,null];
  const melody = selectedMode === "care" ? melodyCare : melodyNormal;

  let i = 0;
  const ms = selectedMode === "care" ? 1900 : 1450;

  const playOne = ()=>{
    const note = melody[i % melody.length];
    if(note){
      tone(note, selectedMode === "care" ? 1.5 : 1.15,
           selectedMode === "care" ? .010 : .014, "sine");
      // ごく小さな低音を添える
      if(i % 2 === 0){
        tone(note / 2, selectedMode === "care" ? 1.7 : 1.3,
             selectedMode === "care" ? .004 : .006, "sine", .03);
      }
    }
    i++;
  };

  playOne();
  bgmTimer = setInterval(playOne, ms);
}

function stopBgm(){
  if(bgmTimer){ clearInterval(bgmTimer); bgmTimer=null; }
}

function stopRhythm(){
  if(rhythmTimer){ clearInterval(rhythmTimer); rhythmTimer=null; }
}

function speak(text){
  if(!soundOn || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ja-JP";
  u.rate = selectedMode==="care" ? .60 : .72;
  u.pitch = 1.15;
  u.volume = .85;
  speechSynthesis.speak(u);
}

function kiran(){
  if(!soundOn) return;
  initAudio();
  tone(523,.8,.025,"sine",0);
  tone(659,.9,.018,"sine",.14);
  tone(784,1.0,.014,"sine",.28);
}

function successJingle(){
  playNotes([392,523,659],.22);
}

function clearTimers(){
  if(flowTimer){ clearTimeout(flowTimer); flowTimer=null; }
  if(countdownTimer){ clearInterval(countdownTimer); countdownTimer=null; }
  stopRhythm();
}

function renderChoices(){
  const wrap = $("stepChoices");
  wrap.innerHTML = "";

  $("selectTitle").textContent = selectedMode === "care"
    ? "これからの ながれを みよう"
    : "どれから やる？";

  const forecast = $("careForecast");
  forecast.hidden = selectedMode !== "care";

  if(selectedMode === "care"){
    const list = $("forecastList");
    list.innerHTML = "";
    steps.forEach((s,index)=>{
      const item = document.createElement("div");
      const done = completed.has(index);
      item.className = "forecastItem" + (done ? " done" : "");
      item.textContent = `${done ? "✅" : "○"} ${index+1}. ${s.main}`;
      list.appendChild(item);
    });

    const remaining = steps.length - completed.size;
    $("currentGuide").textContent = remaining
      ? `つぎは、したい こうていを 1つ えらびます。あと ${remaining}こです。`
      : "ぜんぶ できました";
  }

  steps.forEach((s,index)=>{
    const b = document.createElement("button");
    const done = completed.has(index);
    b.className = "choice" + (done ? " done" : "");
    b.textContent = `${done ? "✅" : s.emoji} ${s.main}`;
    b.disabled = done;
    b.onclick = ()=>startSelectedStep(index);
    wrap.appendChild(b);
  });

  const remaining = steps.length - completed.size;
  $("remainingText").textContent = remaining ? `あと ${remaining}こ` : "ぜんぶ できた！";
  $("stars").textContent = "★".repeat(completed.size) + "☆".repeat(steps.length-completed.size);
}

function updateStep(){
  const s = steps[currentStep];
  $("stepText").textContent = `できた ${completed.size} / ${steps.length}`;
  $("emoji").textContent = s.emoji;
  $("mainText").textContent = s.main;
  $("subText").textContent = s.sub;
  $("rhythmText").textContent = s.rhythm;
  $("progress").style.width = progressValue + "%";
  $("emoji").classList.add("demoMove");
  $("nextBtn").classList.remove("show");
}

function beginStepFlow(){
  clearTimers();
  running = false;
  progressValue = 0;
  $("progress").style.width = "0%";
  $("musicBadge").textContent = "🎵 おてほんの おと";
  $("emoji").classList.add("demoMove");
  const s = steps[currentStep];
  speak(`おとを きいてね。${s.main}。${s.sub}`);
  playNotes(s.notes, selectedMode==="care" ? .95 : .72);
  const delay = selectedMode==="care" ? 6500 : 5000;
  flowTimer = setTimeout(startCountdown,delay);
}

function startCountdown(){
  let n=3;
  $("countdown").textContent = n;
  $("countdown").classList.add("show");
  speak("さん");
  countdownTimer = setInterval(()=>{
    n--;
    if(n>0){
      $("countdown").textContent = n;
      speak(n===2 ? "に" : "いち");
    }else{
      clearInterval(countdownTimer);
      countdownTimer = null;
      $("countdown").classList.remove("show");
      $("emoji").classList.remove("demoMove");
      $("musicBadge").textContent = "🎵 やさしい おとを きこう";
      running = true;
      lastPose = null;
      lastTime = performance.now();
      speak("ゆっくり すすめよう");
      startRhythmLoop();
    }
  },1000);
}

function startRhythmLoop(){
  stopRhythm();
  const s = steps[currentStep];
  playNotes(s.notes, selectedMode==="care" ? .95 : .72);
  const interval = selectedMode==="care" ? 4200 : 3200;
  rhythmTimer = setInterval(()=>playNotes(s.notes, selectedMode==="care" ? .82 : .6),interval);
}

function completeCurrentStep(){
  running = false;
  stopRhythm();
  progressValue = 100;
  $("progress").style.width = "100%";
  $("musicBadge").textContent = "🌟 できたね！";
  successJingle();
  speak("できたね");

  completed.add(currentStep);

  if(selectedMode === "normal"){
    $("nextBtn").classList.add("show");
  }else{
    flowTimer = setTimeout(()=>{
      if(completed.size >= steps.length){
        finishAll();
      }else{
        renderChoices();
        show("selectScreen");
      }
    },1800);
  }
}

function goNextNormal(){
  $("nextBtn").classList.remove("show");
  completed.add(currentStep);
  if(completed.size >= steps.length){
    finishAll();
  }else{
    renderChoices();
    show("selectScreen");
  }
}

function finishAll(){
  clearTimers();
  stopBgm();
  show("finish");
  kiran();
  speak("ぜんぶ できた。おとなのひとと、あんぜんに できたね");
}

function startSelectedStep(index){
  currentStep = index;
  progressValue = 0;
  show("play");
  updateStep();
  if(selectedMode === "care"){
    speak(`いまから、${steps[index].main}を します`);
  }
  beginStepFlow();
}

$("toMode").onclick = ()=>{
  initAudio();
  tone(523,.18,.035);
  show("mode");
};

document.querySelectorAll("[data-mode]").forEach(btn=>{
  btn.onclick = ()=>{
    selectedMode = btn.dataset.mode;
    tone(selectedMode==="care"?392:523,.22,.035);
    show("permission");
  };
});

$("soundBtn").onclick = ()=>{
  soundOn = !soundOn;
  $("soundBtn").textContent = soundOn ? "🔊" : "🔇";
  if(soundOn){
    initAudio();
    startBgm();
  }else{
    stopBgm();
    stopRhythm();
    if("speechSynthesis" in window) speechSynthesis.cancel();
  }
};

$("nextBtn").onclick = goNextNormal;

$("again").onclick = ()=>{
  completed = new Set();
  currentStep = 0;
  progressValue = 0;
  startBgm();
  renderChoices();
  show("selectScreen");
};

$("startCamera").onclick = async()=>{
  initAudio();
  $("loading").classList.add("show");
  try{
    const video = $("video");
    const canvas = $("canvas");
    const ctx = canvas.getContext("2d");

    const pose = new Pose({
      locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
    });
    pose.setOptions({
      modelComplexity:0,
      smoothLandmarks:true,
      minDetectionConfidence:.5,
      minTrackingConfidence:.5
    });

    pose.onResults(results=>{
      canvas.width = video.videoWidth || innerWidth;
      canvas.height = video.videoHeight || innerHeight;
      ctx.clearRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(results.image,0,0,canvas.width,canvas.height);
      const ok = !!results.poseLandmarks;
      $("hint").textContent = ok ? "ゆっくり すすめてね" : "からだを かめらに うつしてね";
      processPose(results.poseLandmarks || null);
    });

    camera = new Camera(video,{
      onFrame:async()=>await pose.send({image:video}),
      width:1280,
      height:720
    });
    await camera.start();

    video.style.display = "none";
    canvas.style.display = "block";
    $("loading").classList.remove("show");
    startBgm();

    completed = new Set();
    renderChoices();
    show("selectScreen");
  }catch(error){
    console.error(error);
    $("loading").classList.remove("show");
    alert("かめらを つけられませんでした。ブラウザの かめらきょかを かくにんしてね。");
  }
};

function processPose(pose){
  if(!running) return;

  const now = performance.now();
  const dt = Math.min((now-lastTime)/1000,.12);
  lastTime = now;

  let activity = 0;
  if(pose && lastPose){
    const ids = [0,11,12,13,14,15,16,23,24];
    ids.forEach(i=>{
      const dx = pose[i].x-lastPose[i].x;
      const dy = pose[i].y-lastPose[i].y;
      activity += Math.hypot(dx,dy);
    });
  }
  lastPose = pose;

  const threshold = selectedMode==="care" ? .0028 : .0045;
  const gain = selectedMode==="care" ? 18 : 22;

  if(pose && activity > threshold){
    progressValue = Math.min(100,progressValue + gain*dt);
    $("progress").style.width = progressValue + "%";
  }

  if(progressValue >= 100){
    completeCurrentStep();
  }
}

document.addEventListener("visibilitychange",()=>{
  if(document.hidden){
    stopBgm();
    stopRhythm();
  }else if(soundOn){
    startBgm();
  }
});
