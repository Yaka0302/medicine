const steps = [
  {
    emoji:"🧼",
    main:"てを きれいに しよう",
    sub:"おとなのひとと てを あらおう",
    rhythm:"ごしごし・ぴかぴか",
    notes:[392,392,440,392]
  },
  {
    emoji:"🔎",
    main:"おくすりを かくにん",
    sub:"なまえ・おくすり・りょう・じかんを おとなのひとが かくにん",
    rhythm:"みて・かくにん・だいじょうぶ",
    notes:[330,null,392]
  },
  {
    emoji:"🥤",
    main:"おみずを よういしよう",
    sub:"ひつような ときは おとなのひとと おみずを ようい",
    rhythm:"ことん・じゅんび・できた",
    notes:[330,392,440]
  },
  {
    emoji:"🪑",
    main:"すわって ゆっくり",
    sub:"あわてず らくな しせいで じゅんびしよう",
    rhythm:"ゆっくり・すー・はー",
    notes:[392,440,523]
  },
  {
    emoji:"💊",
    main:"おとなのひとと のもう",
    sub:"おとなのひとと いっしょに のみ、のみおわったことを かくにん",
    rhythm:"ゆっくり・だいじょうぶ",
    notes:[392,523,659],
    adultConfirm:true
  },
  {
    emoji:"🧻",
    main:"おくちを きれいに しよう",
    sub:"ひつような ときは おくちを ふいて、おとなのひとが さいごに かくにん",
    rhythm:"ふいて・すっきり・できた",
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
let bgmWanted = false;
let bgmVolume = 0.16;
let bgmFadeTimer = null;

function fadeBgmTo(target, duration=500){
  const audio = $("bgmAudio");
  if(!audio) return;
  if(bgmFadeTimer) clearInterval(bgmFadeTimer);
  const start = audio.volume;
  const steps = 20;
  let i = 0;
  bgmFadeTimer = setInterval(()=>{
    i++;
    audio.volume = Math.max(0, Math.min(1, start + (target-start)*(i/steps)));
    if(i>=steps){
      clearInterval(bgmFadeTimer);
      bgmFadeTimer = null;
    }
  }, Math.max(20, duration/steps));
}

function playEffect(id){
  if(!soundOn) return;
  const a = $(id);
  if(!a) return;
  a.currentTime = 0;
  a.volume = id==="successAudio" ? 0.35 : 0.30;
  a.play().catch(()=>{});
}

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
  if(!soundOn) return;
  const audio = $("bgmAudio");
  if(!audio) return;
  bgmWanted = true;
  audio.volume = selectedMode==="care" ? 0.11 : bgmVolume;
  audio.play().catch(()=>{});
}

function stopBgm(){
  bgmWanted = false;
  const audio = $("bgmAudio");
  if(!audio) return;
  fadeBgmTo(0,350);
  setTimeout(()=>{
    if(!bgmWanted){
      audio.pause();
      audio.currentTime = 0;
    }
  },380);
}

function stopBgm(){
  if(bgmTimer){ clearInterval(bgmTimer); bgmTimer=null; }
}

function stopRhythm(){
  if(rhythmTimer){ clearInterval(rhythmTimer); rhythmTimer=null; }
}

function speak(text){
  return new Promise(resolve=>{
    if(!soundOn || !("speechSynthesis" in window)){
      resolve();
      return;
    }

    speechSynthesis.cancel();
    if(bgmWanted) fadeBgmTo(selectedMode==="care" ? 0.045 : 0.06, 300);

    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ja-JP";
    u.rate = selectedMode==="care" ? 0.56 : 0.68;
    u.pitch = 1.08;
    u.volume = 0.9;

    let finished = false;
    const done = ()=>{
      if(finished) return;
      finished = true;
      if(bgmWanted) fadeBgmTo(selectedMode==="care" ? 0.11 : bgmVolume, 500);
      resolve();
    };

    u.onend = done;
    u.onerror = done;

    speechSynthesis.speak(u);

    // ブラウザ側でonendが返らない場合の保険
    const estimated = Math.max(2200, text.length * (selectedMode==="care" ? 210 : 170));
    setTimeout(done, estimated);
  });
}

function kiran(){ playEffect("kiranAudio"); }

function successJingle(){ playEffect("successAudio"); }

function clearTimers(){
  if("speechSynthesis" in window) speechSynthesis.cancel();
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
  $("stepText").textContent = selectedMode === "normal"
    ? `${currentStep + 1} / ${steps.length}`
    : `できた ${completed.size} / ${steps.length}`;
  $("emoji").textContent = s.emoji;
  $("mainText").textContent = s.main;
  $("subText").textContent = s.sub;
  $("rhythmText").textContent = s.rhythm;
  $("progress").style.width = progressValue + "%";
  $("emoji").classList.add("demoMove");
  $("nextBtn").classList.remove("show");
  $("adultConfirmBtn").classList.remove("show");
}

async function beginStepFlow(){
  clearTimers();
  running = false;
  progressValue = 0;
  $("progress").style.width = "0%";
  $("musicBadge").textContent = "🎵 やさしい オルゴール";
  $("emoji").classList.add("demoMove");

  const s = steps[currentStep];
  const explanation = `${s.main}。${s.sub}。${s.rhythm}。`;

  await speak(explanation);

  if(!$("play").classList.contains("show")) return;

  playNotes(s.notes, selectedMode==="care" ? .95 : .72);

  const pauseAfterSpeech = selectedMode==="care" ? 2200 : 1500;
  flowTimer = setTimeout(()=>{
    if($("play").classList.contains("show")) startCountdown();
  }, pauseAfterSpeech);
}

async function startCountdown(){
  let n = 3;
  $("countdown").textContent = n;
  $("countdown").classList.add("show");

  await speak("さん");
  if(!$("play").classList.contains("show")) return;

  await new Promise(r=>setTimeout(r, selectedMode==="care" ? 900 : 700));
  n = 2;
  $("countdown").textContent = n;
  await speak("に");
  if(!$("play").classList.contains("show")) return;

  await new Promise(r=>setTimeout(r, selectedMode==="care" ? 900 : 700));
  n = 1;
  $("countdown").textContent = n;
  await speak("いち");
  if(!$("play").classList.contains("show")) return;

  await new Promise(r=>setTimeout(r, selectedMode==="care" ? 1000 : 750));

  $("countdown").classList.remove("show");
  $("emoji").classList.remove("demoMove");
  lastPose = null;
  lastTime = performance.now();

  if(steps[currentStep].adultConfirm){
    running = false;
    $("musicBadge").textContent = "👨‍👩‍👧 おとなのひとと いっしょに";
    await speak("おとなのひとと いっしょに のんでね。のみおわったら、おとなのひとが かくにんボタンを おしてね。");
    $("adultConfirmBtn").classList.add("show");
  }else{
    $("musicBadge").textContent = "🎵 ゆっくり すすめよう";
    running = true;
    await speak("ゆっくり すすめよう");
    if(running) startRhythmLoop();
  }
}

function startRhythmLoop(){
  stopRhythm();
  // BGMは音源ファイルで途切れず再生するため、追加の反復音は鳴らしません。
}

async function completeCurrentStep(){
  running = false;
  stopRhythm();
  progressValue = 100;
  $("progress").style.width = "100%";
  $("musicBadge").textContent = "🌟 できたね！";
  successJingle();

  completed.add(currentStep);

  await speak("できたね。つぎに すすむ じゅんびが できたよ。");

  if(selectedMode === "normal"){
    $("nextBtn").classList.add("show");
  }else{
    if(completed.size >= steps.length){
      finishAll();
    }else{
      renderChoices();
      show("selectScreen");
    }
  }
}

function goNextNormal(){
  $("nextBtn").classList.remove("show");
  completed.add(currentStep);
  currentStep++;

  if(currentStep >= steps.length){
    finishAll();
  }else{
    progressValue = 0;
    updateStep();
    beginStepFlow();
  }
}

async function finishAll(){
  clearTimers();
  stopBgm();
  show("finish");
  kiran();
  await speak("ぜんぶ できたよ。おとなのひとと いっしょに、あんぜんに できたね。");
}

async function startSelectedStep(index){
  currentStep = index;
  progressValue = 0;
  show("play");
  updateStep();
  if(selectedMode === "care"){
    await speak(`いまから、${steps[index].main}を します`);
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
    ["successAudio","kiranAudio"].forEach(id=>{ const a=$(id); if(a) a.pause(); });
    if("speechSynthesis" in window) speechSynthesis.cancel();
  }
};

$("nextBtn").onclick = goNextNormal;
$("adultConfirmBtn").onclick = async()=>{
  $("adultConfirmBtn").classList.remove("show");
  progressValue = 100;
  $("progress").style.width = "100%";
  await completeCurrentStep();
};


$("again").onclick = ()=>{
  completed = new Set();
  currentStep = 0;
  progressValue = 0;
  startBgm();

  if(selectedMode === "normal"){
    show("play");
    updateStep();
    beginStepFlow();
  }else{
    renderChoices();
    show("selectScreen");
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
    currentStep = 0;
    progressValue = 0;

    if(selectedMode === "normal"){
      show("play");
      updateStep();
      setTimeout(beginStepFlow,500);
    }else{
      renderChoices();
      show("selectScreen");
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
  const audio = $("bgmAudio");
  if(document.hidden){
    if(audio) audio.pause();
  }else if(soundOn && bgmWanted){
    if(audio) audio.play().catch(()=>{});
  }
});
