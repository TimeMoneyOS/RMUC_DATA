/* 数据状态与视觉提示分开：展示时长不是比赛状态持续时间。 */
(function(root){
  function upper(frames,t){let l=0,r=frames.length;while(l<r){const m=(l+r)>>1;if(frames[m][0]<=t)l=m+1;else r=m;}return l;}
  function indexEvents(events){const byRobot=new Map(),special=[];for(const e of events){if(e.robot_id!=null){if(!byRobot.has(e.robot_id))byRobot.set(e.robot_id,[]);byRobot.get(e.robot_id).push(e);}if(!['发弹','受击'].includes(e.事件类型))special.push(e);}return {byRobot,special};}
  function latest(events,t,predicate){for(let i=events.length-1;i>=0;i--){const e=events[i];if(e.时刻秒<=t&&predicate(e))return e;}return null;}
  function robotStatus(robot,st,t,index){
    if(!st||st.stale)return {kind:'unknown',label:st?'状态过期':'暂无状态'};
    const s=st.s;
    if(s[4]==null)return {kind:'unknown',label:'血量未知'};
    if(s[4]<=0)return {kind:'dead',label:'零血量'};
    const i=upper(robot.frames,t)-1;
    // 回溯邻近样本确定回血转变，不把首次出现判作复活。
    for(let j=i;j>0&&t-robot.frames[j][0]<3;j--){const a=robot.frames[j-1],b=robot.frames[j];if(a[4]===0&&b[4]>0&&b[0]-a[0]<=2)return {kind:'revived',label:'复活提示',since:b[0]};}
    const counter=latest(index.special,t,e=>e.事件类型==='雷达反制UAV'&&e.阵营===robot.team);
    if(robot.type==='空中'&&counter&&t-counter.时刻秒<3)return {kind:'countered',label:'遭反制',event:counter};
    if(s[12]===1)return {kind:'vulnerable',label:'雷达易伤'};
    const gain=latest(index.byRobot.get(robot.id)||[],t,e=>e.事件类型==='增益');
    if(gain&&t-gain.时刻秒<3)return {kind:'buff',label:gain.类别||'获得增益',event:gain};
    return {kind:'active',label:'有血量'};
  }
  function eventLabel(e){return `${e.阵营||''}方 ${e.事件类型}${e.类别?' · '+e.类别:''}`;}
  const api={upper,indexEvents,latest,robotStatus,eventLabel};
  if(typeof module!=='undefined')module.exports=api;else root.Presentation=api;
})(typeof window!=='undefined'?window:this);
