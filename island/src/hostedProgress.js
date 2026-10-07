// A proposal, invitation, entry fee or cancelled session is not a completed party.
// All five activity controllers record the final cash receipt before publishing
// the hosted achievement. Keep that receipt as the common progression boundary.
export const HOSTED_TEMPLATES=['night','fishing','market','couture','fireworks'];
export function confirmedHostedEvents(s){
 const cash=s.economy?.cashReceipts||{};
 return Object.entries(s.achievementBook?.hosted||{}).filter(([id,event])=>
  /^[-\w:]{1,100}$/.test(id)&&HOSTED_TEMPLATES.includes(event?.template)&&
  Number.isSafeInteger(event.day)&&event.day>0&&event.day<=s.day&&
  cash[event.template==='night'?id:id+':reward']===true);
}
