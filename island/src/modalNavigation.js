let generation=0;
export function advanceModalNavigation(){generation++;return generation;}
export function modalNavigationToken(){const captured=generation;return {current:()=>generation===captured};}
