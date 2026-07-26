</script>
<script src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"></script>
<script>
const steps = [
  {emoji:"🧼", main:"てを きれいに しよう", sub:"てを ごしごし する まね"},
  {emoji:"👩‍👧", main:"おとなのひとと かくにん", sub:"おくすりを みる まね"},
  {emoji:"🥤", main:"おみずを もとう", sub:"こっぷを もつ まね"},
  {emoji:"💊", main:"おくすりの じかん", sub:"おとなのひとと いっしょに すすめよう"},
  {emoji:"😊", main:"できたら にっこり", sub:"おくちを ふいて にっこりしよう"}
];

let selectedMode="normal",currentStep=0,progressValue=0,running=false,soundOn=true;
let lastPose=null,lastTime=performance.now(),audioCtx=null,bgmTimer=null,camera=null;
let phase="demo";
const $=id=>document.getElementById(id);

function show(id){
  ["cover","mode","permission","finish"].forEach(x=>$(x).classList.remove("show"));
  $("play").classList.remove("show");
  if(id==="play")$("play").classList.add("show");else $(id).classList.add("show");
}
$("toMode").onclick=()=>{initAudio();show("mode")};
document.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{selectedMode=b.dataset.mode;show("permission")});
$("soundBtn").onclick=()=>{soundOn=!soundOn;$("soundBtn").textContent=soundOn?"🔊":"🔇";soundOn?startBgm():stopBgm()};
$("again").onclick=()=>{currentStep=0;progressValue=0;updateStep();show("play");startBgm();beginStepFlow()};

function initAudio(){if(!audioCtx)audioCtx=new(window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==="suspended")audioCtx.resume()}
function tone(freq,d=.2,vol=.035,type="sine",delay=0){
  if(!soundOn)return;initAudio();
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.value=freq;
  g.gain.setValueAtTime(.0001,audioCtx.currentTime+delay);
  g.gain.exponentialRampToValueAtTime(vol,audioCtx.currentTime+delay+.02);
  g.gain.exponentialRampToValueAtTime(.0001,audioCtx.currentTime+delay+d);
  o.connect(g);g.connect(audioCtx.destination);o.start(audioCtx.currentTime+delay);o.stop(audioCtx.currentTime+delay+d+.05);
}
function startBgm(){
  stopBgm();if(!soundOn)return;
  const notes=selectedMode==="care"?[261.63,329.63,392]:[392,440,523.25,440];
  let i=0,ms=selectedMode==="care"?1600:1200;
  bgmTimer=setInterval(()=>{tone(notes[i%notes.length],.32,selectedMode==="care"?.016:.023);i++},ms);
}
function stopBgm(){if(bgmTimer){clearInterval(bgmTimer);bgmTimer=null}}
function kiran(){
  stopBgm();if(!soundOn)return;initAudio();
  const now=audioCtx.currentTime;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type="sine";o.frequency.setValueAtTime(900,now);o.frequency.exponentialRampToValueAtTime(1900,now+.18);
  g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.085,now+.02);g.gain.exponentialRampToValueAtTime(.0001,now+.65);
  o.connect(g);g.connect(audioCtx.destination);o.start(now);o.stop(now+.7);
  tone(1320,.7,.05,"triangle",.14);
}
function speak(text){
  if(!soundOn||!("speechSynthesis"in window))return;
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang="ja-JP";u.rate=selectedMode==="care"?0.60:0.72;u.pitch=1.15;u.volume=.85;
  speechSynthesis.speak(u);
}
function speakStep(){speak(steps[currentStep].main+"。"+steps[currentStep].sub)}
function updateStep(){
  const s=steps[currentStep];
  $("stepText").textContent=`${currentStep+1} / ${steps.length}`;
  $("emoji").textContent=s.emoji;
  $("mainText").textContent=s.main;
  $("subText").textContent=s.sub;
  $("progress").style.width=progressValue+"%";
  $("emoji").classList.add("demoMove");
}
function beginStepFlow(){
  running=false;
  phase="demo";
  $("demoBadge").textContent="おてほんを みてね";
  $("demoBadge").style.display="block";
  $("emoji").classList.add("demoMove");
  speak("おてほんを みてね。"+steps[currentStep].main);
  setTimeout(startCountdown, selectedMode==="care" ? 7000 : 5500);
}

function startCountdown(){
  phase="countdown";
  $("demoBadge").textContent="もうすぐ はじまるよ";
  let n=3;
  $("countdown").textContent=n;
  $("countdown").classList.add("show");
  speak("さん");
  const timer=setInterval(()=>{
    n--;
    if(n>0){
      $("countdown").textContent=n;
      speak(n===2?"に":"いち");
    }else{
      clearInterval(timer);
      $("countdown").classList.remove("show");
      $("demoBadge").textContent="やってみよう";
      $("emoji").classList.remove("demoMove");
      progressValue=0;
      $("progress").style.width="0%";
      phase="judge";
      running=true;
      speakStep();
    }
  },1000);
}

function praiseAndNext(){
  running=false;
  phase="praise";
  $("demoBadge").textContent="できたね！";
  speak("できたね");
  tone(784,.22,.04);
  setTimeout(()=>{
    currentStep++;
    if(currentStep>=steps.length){
      show("finish");
      kiran();
      speak("できた。じゅんばんに できたね");
    }else{
      progressValue=0;
      updateStep();
      beginStepFlow();
    }
  },2200);
}

$("startCamera").onclick=async()=>{
  initAudio();$("loading").classList.add("show");
  try{
    const video=$("video"),canvas=$("canvas"),ctx=canvas.getContext("2d");
    const pose=new Pose({locateFile:f=>`https://cdn.jsdelivr.net/npm/@mediapipe/pose/${f}`});
    pose.setOptions({modelComplexity:0,smoothLandmarks:true,minDetectionConfidence:.55,minTrackingConfidence:.5});
    pose.onResults(r=>{
      canvas.width=video.videoWidth||innerWidth;canvas.height=video.videoHeight||innerHeight;
      ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(r.image,0,0,canvas.width,canvas.height);
      const ok=!!r.poseLandmarks;$("hint").textContent=ok?"そのまま うごいてね":"からだを かめらに うつしてね";
      processPose(r.poseLandmarks||null);
    });
    camera=new Camera(video,{onFrame:async()=>await pose.send({image:video}),width:1280,height:720});
    await camera.start();video.style.display="none";canvas.style.display="block";
    $("loading").classList.remove("show");show("play");updateStep();startBgm();setTimeout(beginStepFlow,500);
  }catch(e){
    $("loading").classList.remove("show");
    alert("かめらを つけられませんでした。ブラウザの かめらきょかを かくにんしてね。");
  }
};

function processPose(pose){
  if(!running)return;
  const now=performance.now(),dt=Math.min((now-lastTime)/1000,.12);lastTime=now;
  let activity=0;
  if(pose&&lastPose){
    const ids=[0,11,12,13,14,15,16,23,24];
    ids.forEach(i=>{const dx=pose[i].x-lastPose[i].x,dy=pose[i].y-lastPose[i].y;activity+=Math.hypot(dx,dy)});
  }
  lastPose=pose;
  const threshold=selectedMode==="care"?.0035:.0055;
  const gain=selectedMode==="care"?14:18;
  if(pose&&activity>threshold){
    progressValue=Math.min(100,progressValue+gain*dt);
    $("progress").style.width=progressValue+"%";
  }
  if(progressValue>=100){
    praiseAndNext();
  }
}
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopBgm();else if(running&&soundOn)startBgm()});