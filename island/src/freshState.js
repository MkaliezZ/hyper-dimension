// Defaults for a genuinely new island. Existing saves never pass through this.
export function initializeZeroProgress(state){
 state.coins=0;for(const id of Object.keys(state.inventory))state.inventory[id]=0;
 state.starterToolsGranted=true;state.startMode='zero';state.freshStartPending=true;
 state.events=['第 1 天：背包与岛币从零开始，亲手采集、制作，写下新的岛屿故事。'];
 return state;
}
