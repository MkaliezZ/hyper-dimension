// Retry only Chromium's transient capture failure, inside the original deadline.
// A PNG remains required; interaction, timeout and persistent errors propagate.
export async function captureNativeScreenshot(page, options) {
 const budget=options.timeout??30000,started=Date.now();
 if(!Number.isFinite(budget)||budget<=0)throw Error('A bounded screenshot deadline is required');
 try{return {buffer:await page.screenshot({...options,timeout:budget}),retried:false};}
 catch(error){
  if(!String(error.message).includes('Protocol error (Page.captureScreenshot): Unable to capture screenshot')||page.isClosed()||Date.now()-started>=budget)throw error;
  await page.waitForTimeout(0);
  const remaining=budget-(Date.now()-started);if(remaining<=0)throw error;
  return {buffer:await page.screenshot({...options,timeout:remaining}),retried:true};
 }
}
