const steps = [
  {
    emoji:"🧼",
    main:"てを きれいに しよう",
    sub:"ごしごしの リズムで うごこう",
    rhythm:"タン・タン・タン・タン",
    notes:[392,392,440,392]
  },
  {
    emoji:"👩‍👧",
    main:"おとなのひとと かくにん",
    sub:"ゆっくり みて うなずこう",
    rhythm:"タン・おやすみ・タン",
    notes:[330,null,392]
  },
  {
    emoji:"🥤",
    main:"おみずを もとう",
    sub:"こっぷを もつ まねを しよう",
    rhythm:"タン・タン・のびーる",
    notes:[392,440,523]
  },
  {
    emoji:"💊",
    main:"おくすりの じかん",
    sub:"おとなのひとと いっしょに すすめよう",
    rhythm:"ゆっくり・ゆっくり",
    notes:[330,392]
  },
  {
    emoji:"😊",
    main:"できたら にっこり",
    sub:"にっこりして からだを ゆらそう",
    rhythm:"タン・タン・キラリン",
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

function tone(freq, duration=.18, volume=.03, type="sine", delay=0){
  if(!soundOn || !freq) return;
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const start = audioCtx.currentTime + delay;
  gain.gain.setValueAtTime(.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + .02);
  gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(start);
  osc.stop(start + duration + .05);
}

function playNotes(notes, gap=.55){
  notes.forEach((n,i)=>{
    if(n) tone(n,.26,selectedMode==="care"?.018:.028,"sine",i*gap);
  });
}

function startBgm(){
  stopBgm();
  if(!soundOn) return;
  const notes = selectedMode==="care"
    ? [261.63,329.63,392]
    : [392,440,523.25,440];
  let i=0;
  const ms = selectedMode==="care" ? 1700 : 1250;
  bgmTimer = setInterval(()=>{
    tone(notes[i%notes.length],.32,selectedMode==="care"?.012:.018);
    i++;
  },ms);
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
  tone(880,.5,.06,"triangle",0);
  tone(1320,.55,.045,"sine",.12);
  tone(1760,.65,.035,"sine",.24);
}

function successJingle(){
  playNotes([523,659,784],.16);
}

function clearTimers(){
  if(flowTimer){ clearTimeout(flowTimer); flowTimer=null; }
  if(countdownTimer){ clearInterval(countdownTimer); countdownTimer=null; }
  stopRhythm();
}

function renderChoices(){
  const wrap = $("stepChoices");
  wrap.innerHTML = "";
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
  $("stepText").textContent = selectedMode==="care"
    ? `できた ${completed.size} / ${steps.length}`
    : `${currentStep+1} / ${steps.length}`;
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
  speak(`おてほんを みてね。${s.main}。${s.sub}`);
  playNotes(s.notes, selectedMode==="care" ? .78 : .58);
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
      $("musicBadge").textContent = "🎵 おとに あわせて うごこう";
      running = true;
      lastPose = null;
      lastTime = performance.now();
      speak("おとに あわせて、やってみよう");
      startRhythmLoop();
    }
  },1000);
}

function startRhythmLoop(){
  stopRhythm();
  const s = steps[currentStep];
  playNotes(s.notes, selectedMode==="care" ? .82 : .6);
  const interval = selectedMode==="care" ? 3600 : 2700;
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

  if(selectedMode === "normal"){
    $("nextBtn").classList.add("show");
  }else{
    completed.add(currentStep);
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
  currentStep++;
  if(currentStep >= steps.length){
    finishAll();
  }else{
    progressValue=0;
    updateStep();
    beginStepFlow();
  }
}

function finishAll(){
  clearTimers();
  stopBgm();
  show("finish");
  kiran();
  speak("ぜんぶ できた。おとに あわせて、たのしく できたね");
}

function startSelectedStep(index){
  currentStep = index;
  progressValue = 0;
  show("play");
  updateStep();
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
  if(selectedMode==="care"){
    renderChoices();
    show("selectScreen");
  }else{
    show("play");
    updateStep();
    beginStepFlow();
  }
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
      $("hint").textContent = ok ? "そのまま うごいてね" : "からだを かめらに うつしてね";
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

    if(selectedMode==="care"){
      renderChoices();
      show("selectScreen");
    }else{
      currentStep=0;
      updateStep();
      show("play");
      setTimeout(beginStepFlow,500);
    }
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
