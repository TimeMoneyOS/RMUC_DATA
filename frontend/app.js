'use strict';
const $=id=>document.getElementById(id), canvas=$('map'),ctx=canvas.getContext('2d');
const image=new Image();image.src='/assets/official/arena-original.png';
let data=null,matches=[],time=0,playing=false,last=0,selected=null,follow=false,zoom=1,pan={x:0,y:0},points=[],request=null,loading=false;
let eventIndex=Presentation.indexEvents([]);
const statusColors={dead:'#89939e',revived:'#63efaa',countered:'#ffb657',vulnerable:'#ffb657',buff:'#dfc58a'};
const icons={};for(const [type,file] of [['空中','uav'],['哨兵','sentry']]){icons[type]=new Image();icons[type].src=`/assets/icons/${file}.svg`;}
const colors={红:'#ff6574',蓝:'#61b7ff'},order=['英雄','工程','步兵3','步兵4','哨兵','空中','基地','前哨站'];
const fmt=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const value=v=>v==null?'—':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:1});
function upper(frames,t){let l=0,r=frames.length;while(l<r){const m=(l+r)>>1;if(frames[m][0]<=t)l=m+1;else r=m;}return l;}
function state(robot,t){const i=upper(robot.frames,t)-1;if(i<0)return null;const a=robot.frames[i],b=robot.frames[i+1],s=a.slice();if(b&&b[0]-a[0]<=2&&Number.isFinite(a[1])&&Number.isFinite(a[2])&&Number.isFinite(b[1])&&Number.isFinite(b[2])&&Math.hypot(b[1]-a[1],b[2]-a[2])<=6){const f=(t-a[0])/(b[0]-a[0]);s[1]+=(b[1]-a[1])*f;s[2]+=(b[2]-a[2])*f;if(a[3]!=null&&b[3]!=null)s[3]=a[3]+(((b[3]-a[3]+540)%360)-180)*f;}return {s,stale:t-a[0]>2};}
function setTime(t){if(!data)return;time=Math.max(0,Math.min(data.match.时长秒,t));if(time>=data.match.时长秒)playing=false;update();}
function update(){if(!data)return;$('clock').textContent=fmt(time);$('time').textContent=`${fmt(time)} / ${fmt(data.match.时长秒)}`;$('seek').value=time;$('play').textContent=playing?'Ⅱ 暂停':'▶ 播放';$('result').textContent=time>=data.match.时长秒?`${data.match.胜方||'未知'}方获胜`:'距开局时间';for(const robot of data.robots){const st=state(robot,time),card=$(`robot${robot.id}`);if(!card)continue;const s=st?.s;const visual=Presentation.robotStatus(robot,st,time,eventIndex);card.dataset.state=visual.kind;card.querySelector('.badge').textContent=visual.label;card.classList.toggle('selected',selected===robot.id);card.classList.toggle('empty',!s||st.stale);card.querySelector('.hp').textContent=s?`${value(s[4])} / ${value(s[5])} HP${st.stale?' · 过期':''}`:'尚无状态';card.querySelector('.bar i').style.width=`${s&&s[5]>0?Math.max(0,Math.min(100,s[4]/s[5]*100)):0}%`;}
for(const team of ['红','蓝']){const robot=data.robots.find(r=>r.team===team&&state(r,time));$(`${team}coins`).textContent=`剩余金币 ${value(robot?state(robot,time).s[6]:null)}`;}
const robot=data.robots.find(r=>r.id===selected),st=robot&&state(robot,time);$('detail').hidden=!robot;if(robot){$('detail').replaceChildren();const title=document.createElement('b');title.textContent=`${robot.team}方 ${robot.type} · ${robot.id}`;$('detail').append(title);for(const [label,v] of [['位置 X / Y',st?`${value(st.s[1])} / ${value(st.s[2])}`:'—'],['枪口朝向',st?value(st.s[3]):'—'],['累计17mm发弹',st?value(st.s[7]):'—'],['累计42mm发弹',st?value(st.s[8]):'—'],['底盘功率',st?value(st.s[9]):'—'],['小 / 大热量',st?`${value(st.s[10])} / ${value(st.s[11])}`:'—'],['易伤标记',st?value(st.s[12]):'—']]){const line=document.createElement('div');line.textContent=`${label}：${v}`;$('detail').append(line);}}
renderFieldUI();
const events=recent(3);const key=events.filter(e=>!['发弹','受击'].includes(e.事件类型)).slice(-1)[0];$('caption').textContent=$('effects').checked&&key?`${fmt(key.时刻秒)}  ${key.事件类型} · ${key.类别||''}`:'';
}
function recent(windowSeconds=1){if(!data)return [];const es=data.events;let l=0,r=es.length;while(l<r){let m=(l+r)>>1;if(es[m].时刻秒<=time)l=m+1;else r=m;}const end=l;while(l>0&&es[l-1].时刻秒>time-windowSeconds)l--;return es.slice(l,end);}
function cards(){for(const team of ['红','蓝']){const aside=$(team==='红'?'redCards':'blueCards');aside.replaceChildren();const coins=document.createElement('div');coins.className='economy';coins.id=`${team}coins`;aside.append(coins);for(const robot of data.robots.filter(r=>r.team===team).sort((a,b)=>order.indexOf(a.type)-order.indexOf(b.type))){const c=document.createElement('div');c.id=`robot${robot.id}`;c.className='card';c.innerHTML='<div class="cardtop"><span></span><b></b></div><div class="hp"></div><div class="badge"></div><div class="bar"><i></i></div>';c.querySelector('span').textContent=robot.type;if(icons[robot.type]){const icon=document.createElement('img');icon.src=icons[robot.type].src;icon.className='typeicon';icon.alt=robot.type;c.querySelector('span').prepend(icon);}c.querySelector('b').textContent=robot.id%100;c.onclick=()=>{selected=robot.id;update();};aside.append(c);}}}
function draw(){drawSweep();const rect=canvas.getBoundingClientRect(),dpr=devicePixelRatio||1;if(canvas.width!==Math.round(rect.width*dpr)||canvas.height!==Math.round(rect.height*dpr)){canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);const w=rect.width,h=rect.height;ctx.clearRect(0,0,w,h);const scale=Math.min(w/1476,h/790)*zoom;let ox=(w-1476*scale)/2+pan.x,oy=(h-790*scale)/2+pan.y;const target=data?.robots.find(r=>r.id===selected),targetState=target&&state(target,time);if(follow&&targetState&&valid(targetState.s)&&!['基地','前哨站'].includes(target.type)){ox=w/2-targetState.s[1]/28*1476*scale;oy=h/2-(1-targetState.s[2]/15)*790*scale;}
if(image.complete&&image.naturalWidth)ctx.drawImage(image,100,68,1476,790,ox,oy,1476*scale,790*scale);const xy=(x,y)=>[ox+x/28*1476*scale,oy+(1-y/15)*790*scale];points=[];if(!data)return;
const effects=$('effects').checked?recent():[];
if($('effects').checked)drawDartWaves(xy,scale);
for(const robot of data.robots){if(['基地','前哨站'].includes(robot.type))continue;const st=state(robot,time);if(!st||!valid(st.s))continue;const s=st.s,visual=Presentation.robotStatus(robot,st,time,eventIndex),col=statusColors[visual.kind]||colors[robot.team],[x,y]=xy(s[1],s[2]);if($('trails').checked){const start=upper(robot.frames,time-8),end=upper(robot.frames,time);for(let i=Math.max(start,1);i<end;i++){const a=robot.frames[i-1],b=robot.frames[i];if(!valid(a)||!valid(b)||b[0]-a[0]>2||Math.hypot(b[1]-a[1],b[2]-a[2])>6)continue;ctx.globalAlpha=.5*(1-(time-b[0])/8);ctx.strokeStyle=col;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(...xy(a[1],a[2]));ctx.lineTo(...xy(b[1],b[2]));ctx.stroke();}
// 尾迹末端连接当前插值位置；跳点、缺失和过期状态不连线。
const previous=robot.frames[end-1];
if(previous&&!st.stale&&valid(previous)&&time>previous[0]&&Math.hypot(s[1]-previous[1],s[2]-previous[2])<=6){
ctx.globalAlpha=.5;ctx.strokeStyle=col;ctx.lineWidth=2;
ctx.beginPath();ctx.moveTo(...xy(previous[1],previous[2]));ctx.lineTo(x,y);ctx.stroke();
}
ctx.globalAlpha=1;}
points.push({x,y,id:robot.id});const ev=effects.filter(e=>e.robot_id===robot.id),hit=ev.filter(e=>e.事件类型==='受击'),fire=ev.some(e=>e.事件类型==='发弹');ctx.save();ctx.translate(x,y);ctx.globalAlpha=st.stale?.4:1;ctx.strokeStyle=selected===robot.id?'#fff':col;ctx.fillStyle='#0d1728';ctx.lineWidth=selected===robot.id?3:2;ctx.beginPath();if(robot.type==='空中'){ctx.moveTo(0,-19);ctx.lineTo(19,0);ctx.lineTo(0,19);ctx.lineTo(-19,0);ctx.closePath();}else if(robot.type==='哨兵'){ctx.moveTo(0,-19);ctx.lineTo(16,-10);ctx.lineTo(14,9);ctx.lineTo(0,20);ctx.lineTo(-14,9);ctx.lineTo(-16,-10);ctx.closePath();}else ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.stroke();if(s[3]!=null){const angle=s[3]*Math.PI/180;ctx.beginPath();ctx.moveTo(Math.cos(angle)*15,-Math.sin(angle)*15);ctx.lineTo(Math.cos(angle)*25,-Math.sin(angle)*25);ctx.stroke();}ctx.fillStyle=col;ctx.font='bold 12px sans-serif';ctx.textAlign='center';if(icons[robot.type]?.complete&&icons[robot.type].naturalWidth){ctx.drawImage(icons[robot.type],-12,-12,24,24);ctx.fillStyle=col;ctx.font='bold 10px sans-serif';ctx.fillText(robot.id%100,23,4);}else ctx.fillText(robot.id%100,0,4);if(visual.kind==='dead'){ctx.strokeStyle='#aab4bf';ctx.beginPath();ctx.moveTo(-8,-8);ctx.lineTo(8,8);ctx.moveTo(8,-8);ctx.lineTo(-8,8);ctx.stroke();}if(['revived','countered','vulnerable','buff'].includes(visual.kind)){ctx.setLineDash(visual.kind==='revived'?[4,3]:[]);ctx.strokeStyle=col;ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.font='10px sans-serif';ctx.fillText(visual.label,0,36);}ctx.fillStyle='#243041';ctx.fillRect(-17,17,34,4);ctx.fillStyle=col;ctx.fillRect(-17,17,34*(s[5]>0?Math.max(0,Math.min(1,s[4]/s[5])):0),4);if(fire){ctx.strokeStyle='#f3d887';ctx.beginPath();ctx.arc(0,0,18,0,Math.PI*2);ctx.stroke();}if(hit.length){ctx.fillStyle='#ffbdab';ctx.font='bold 14px sans-serif';ctx.fillText(`−${Math.round(hit.reduce((v,e)=>v+(e.数值||0),0))}`,0,-28);}ctx.restore();}}
function valid(s){return Number.isFinite(s[1])&&Number.isFinite(s[2])&&s[1]>=0&&s[1]<=28&&s[2]>=0&&s[2]<=15;}
async function load(id){request?.abort();request=new AbortController();loading=true;playing=false;$('status').textContent='正在读取单局…';$('play').disabled=true;try{const response=await fetch(`/api/replay?id=${id}`,{signal:request.signal});if(!response.ok)throw Error('单局读取失败');const next=await response.json();data=next;eventIndex=Presentation.indexEvents(data.events);time=0;selected=null;follow=false;zoom=1;pan={x:0,y:0};$('redName').textContent=data.match.红方学校;$('blueName').textContent=data.match.蓝方学校;$('round').textContent=`${data.match.赛程} · 第${data.match.局号}局`;$('seek').max=data.match.时长秒;cards();$('eventTrack').replaceChildren();for(const e of data.events.filter(e=>!['发弹','受击'].includes(e.事件类型))){const mark=document.createElement('i');mark.style.left=`${e.时刻秒/data.match.时长秒*100}%`;mark.title=`${fmt(e.时刻秒)} ${e.事件类型}`;mark.onclick=()=>setTime(e.时刻秒);$('eventTrack').append(mark);}$('picker').close();$('status').textContent=`${data.robots.length} 个实体 · ${data.events.length.toLocaleString()} 条事件`;update();}catch(e){if(e.name==='AbortError')return;$('status').textContent=e.message;}finally{loading=false;$('play').disabled=!data;}}
function list(){const q=$('search').value.trim().toLowerCase(),region=$('region').value;$('matches').replaceChildren();for(const m of matches.filter(m=>(!region||m.赛区===region)&&`${m.红方学校} ${m.蓝方学校} ${m.game_id}`.toLowerCase().includes(q))){const b=document.createElement('button');b.className='match';b.textContent=`${m.红方学校}  VS  ${m.蓝方学校}`;const s=document.createElement('small');s.textContent=`${m.赛程} · 第${m.局号}局 · ${m.开始时间} · ${m.时长秒}秒`;b.append(s);b.onclick=()=>load(m.game_id);$('matches').append(b);}}
$('choose').onclick=()=>$('picker').showModal();$('close').onclick=()=>$('picker').close();$('search').oninput=list;$('region').onchange=list;$('play').onclick=()=>{if(!data||loading)return;if(time>=data.match.时长秒)time=0;playing=!playing;update();};$('seek').oninput=()=>setTime(Number($('seek').value));$('back').onclick=()=>setTime(time-1);$('next').onclick=()=>setTime(time+1);$('follow').onclick=()=>{if(selected!=null){follow=!follow;$('follow').textContent=follow?'取消跟随':'跟随选中';}};$('reset').onclick=()=>{follow=false;zoom=1;pan={x:0,y:0};$('follow').textContent='跟随选中';};$('effects').onchange=update;
let drag=null;canvas.onpointerdown=e=>{drag={x:e.clientX,y:e.clientY,moved:false};canvas.setPointerCapture(e.pointerId);};canvas.onpointermove=e=>{if(!drag)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)>2)drag.moved=true;pan.x+=dx;pan.y+=dy;drag.x=e.clientX;drag.y=e.clientY;follow=false;};canvas.onpointerup=e=>{if(drag&&!drag.moved){const r=canvas.getBoundingClientRect(),p=points.filter(p=>Math.hypot(p.x-e.clientX+r.left,p.y-e.clientY+r.top)<22).sort((a,b)=>Math.hypot(a.x-e.clientX+r.left,a.y-e.clientY+r.top)-Math.hypot(b.x-e.clientX+r.left,b.y-e.clientY+r.top))[0];selected=p?.id??null;update();}drag=null;};canvas.onpointercancel=()=>drag=null;canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(1,Math.min(4,zoom*(e.deltaY<0?1.1:.9)));},{passive:false});
let uiLast=0;function tick(now){const dt=last?(now-last)/1000:0;last=now;if(playing&&data){time=Math.min(data.match.时长秒,time+Math.min(dt,.25)*Number($('speed').value));if(time>=data.match.时长秒)playing=false;}if(now-uiLast>100){update();uiLast=now;}draw();requestAnimationFrame(tick);}requestAnimationFrame(tick);
fetch('/api/matches').then(r=>{if(!r.ok)throw Error('比赛列表加载失败');return r.json();}).then(rows=>{matches=rows;for(const name of [...new Set(rows.map(m=>m.赛区))]){const o=document.createElement('option');o.value=o.textContent=name;$('region').append(o);}list();$('status').textContent=`${rows.length} 局区域赛`;if(rows.length)load(rows[0].game_id);}).catch(e=>$('status').textContent=e.message);

// 场地事件保留最后发生时刻；没有占领字段的道具明确显示未知。
let fieldKey='';
function renderFieldUI(){
 const categories=[['能量机关',e=>['能量机关','增益'].includes(e.事件类型)&&(e.事件类型==='能量机关'||(e.类别||'').includes('能量机关'))],['飞镖闸门',e=>e.事件类型==='飞镖闸门开'],['科技核心',e=>e.事件类型==='装配成功'],['跨越增益',e=>e.事件类型==='增益'&&!(e.类别||'').includes('能量机关')]];
 const entries=categories.map(([name,predicate])=>({name,event:Presentation.latest(eventIndex.special,time,predicate)}));
 const feed=eventIndex.special.filter(e=>e.时刻秒<=time&&time-e.时刻秒<=12).slice(-4);
 const key=JSON.stringify([entries,feed,$('effects').checked]);if(key===fieldKey)return;fieldKey=key;
 $('fieldHud').replaceChildren();for(const {name,event} of entries){const chip=document.createElement('div');chip.className='fieldchip';chip.style.borderColor=event?colors[event.阵营]||'#dbc27d':'#465261';const b=document.createElement('b');b.textContent=name;const line=document.createElement('span');line.textContent=event?`${event.阵营||''}方 · ${fmt(event.时刻秒)}`:'暂无事件';chip.title=event?`${Presentation.eventLabel(event)}\n数值：${value(event.数值)}\n${event.备注||''}\n此处显示事件记录，不表示持续占领或增益仍有效。`:'尚无事件记录';chip.append(b,line);$('fieldHud').append(chip);}
 const unknown=document.createElement('div');unknown.className='fieldchip unknown';unknown.textContent='高地 / 堡垒占领：未知';unknown.title='数据库未提供持续占领字段；不能以机器人经过位置推断占领。';$('fieldHud').append(unknown);
 $('eventFeed').replaceChildren();if($('effects').checked)for(const e of feed){const item=document.createElement('div');item.style.borderLeftColor=colors[e.阵营]||'#dbc27d';item.textContent=`${fmt(e.时刻秒)} ${Presentation.eventLabel(e)}`;$('eventFeed').append(item);}
}
function drawSweep(){
 const e=data&&$('effects').checked?Presentation.latest(eventIndex.special,time,e=>e.事件类型==='雷达反制UAV'):null;
 const age=e?time-e.时刻秒:Infinity;$('sweep').hidden=age<0||age>=3;
 if($('sweep').hidden)return;
 const team=e.阵营||'未知';$('sweep').style.setProperty('--sweep-color',colors[team]||'#f3be73');
 $('sweep').style.setProperty('--scan-x',`${-20+age/3*140}%`);
 $('sweep').style.opacity=Math.min(1,age*5,(3-age)*3);
 $('sweep').querySelector('strong').textContent=`${team}方无人机遭雷达反制`;
 $('sweep').querySelector('span').textContent=e.备注||'反制事件已触发';
}

// 建筑锚点由底图近似配准；目标编号优先，未知目标不猜测。
function drawDartWaves(xy,scale){
 const anchors={10:[2.4,7.5],110:[25.6,7.5],11:[10.9,3.6],111:[17.1,11.4]};
 const duration=3,cycle=1.2;
 for(const e of data.events){
  const age=time-e.时刻秒;
  if(e.事件类型!=='飞镖命中'||age<0||age>=duration)continue;
  const anchor=anchors[e.目标robot_id];if(!anchor)continue;
  const [x,y]=xy(...anchor),unit=Math.min(scale,2);
  const fade=Math.min(1,age/.12,(duration-age)/1.3);
  ctx.save();ctx.translate(x,y);
  // 三道错相位冲击波：快速扫描，末段统一淡出，暂停时保持同一相位。
  for(let layer=0;layer<3;layer++){
   const elapsed=age-layer*.4;if(elapsed<0)continue;
   const phase=(elapsed%cycle)/cycle,radius=(20+phase*260)*unit;
   const opacity=fade*(1-phase)*.65;
   const glow=ctx.createRadialGradient(0,0,Math.max(0,radius-18*unit),0,0,radius+12*unit);
   glow.addColorStop(0,'rgba(255,172,65,0)');glow.addColorStop(.5,`rgba(255,191,99,${opacity*.3})`);
   glow.addColorStop(.65,`rgba(255,236,194,${opacity*.75})`);glow.addColorStop(1,'rgba(255,172,65,0)');
   ctx.fillStyle=glow;ctx.beginPath();ctx.arc(0,0,radius+12*unit,0,Math.PI*2);ctx.fill();
   ctx.globalAlpha=opacity;ctx.strokeStyle='#ffe3ad';ctx.lineWidth=1.5;
   // 留出空隙的扫描弧，比整圈实色环更轻。
   for(let arc=0;arc<6;arc++){const angle=age*4.5+arc*Math.PI/3+layer*.3;
    ctx.beginPath();ctx.arc(0,0,radius,angle,angle+.55);ctx.stroke();}
  }
  ctx.globalAlpha=fade;ctx.strokeStyle='#ffdf9b';ctx.lineWidth=2;
  for(let arc=0;arc<4;arc++){const angle=age*5+arc*Math.PI/2;
   ctx.beginPath();ctx.arc(0,0,24*unit,angle,angle+.8);ctx.stroke();}
  ctx.fillStyle='#17202ddd';ctx.fillRect(-110,-52,220,25);
  ctx.fillStyle='#ffe5b4';ctx.font='bold 13px "Microsoft YaHei",sans-serif';ctx.textAlign='center';
  ctx.fillText(`飞镖命中 · ${e.目标类型||'建筑'}  −${value(e.数值)}`,0,-34);
  ctx.restore();
 }
}
